"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { contacts, db, opportunities, pipelineStages } from "@/db";
import { go, guarded, UserFacingError, type FormState } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { parseMoneyToCents } from "@/lib/dates";
import { optDate, optStr, optUuid, parseForm, reqStr } from "@/lib/validation";

const oppSchema = z.object({
  name: reqStr("Opportunity name"),
  companyId: optUuid, contactId: optUuid, stageId: z.string().uuid("Choose a stage"), ownerId: optUuid,
  value: optStr(30), expectedCloseDate: optDate,
});

function build(v: z.output<typeof oppSchema>) {
  const valueCents = v.value ? parseMoneyToCents(v.value) : 0;
  if (valueCents === null) throw new UserFacingError("Value must be a positive number.");
  const { value: _v, ...rest } = v;
  return { ...rest, valueCents };
}

export async function createOpportunity(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const v = build(parseForm(oppSchema, fd));
    if (v.contactId && !v.companyId) {
      const [c] = await db.select({ companyId: contacts.companyId }).from(contacts).where(eq(contacts.id, v.contactId));
      v.companyId = c?.companyId ?? null;
    }
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(opportunities).values(v).returning({ id: opportunities.id });
      await logActivity(tx, user, { action: "opportunity.create", entity: "opportunity", entityId: row.id, summary: `Created opportunity ${v.name}` });
      return row.id;
    });
    return go(`/opportunities/${id}`, "Opportunity created");
  });
}

export async function updateOpportunity(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    const v = build(parseForm(oppSchema, fd));
    await db.transaction(async (tx) => {
      const [before] = await tx.select({ stageId: opportunities.stageId }).from(opportunities).where(eq(opportunities.id, id));
      if (!before) throw new UserFacingError("This opportunity no longer exists.");
      await tx.update(opportunities).set({ ...v, updatedAt: new Date() }).where(eq(opportunities.id, id));
      await logActivity(tx, user, { action: "opportunity.update", entity: "opportunity", entityId: id, summary: `Updated opportunity ${v.name}` });
      if (before.stageId !== v.stageId) await logStage(tx, user, id, v.name, before.stageId, v.stageId);
    });
    return go(`/opportunities/${id}`, "Opportunity saved");
  });
}

async function logStage(tx: Parameters<typeof logActivity>[0], user: { id: string; name: string }, id: string, name: string, from: string, to: string) {
  const stages = await (tx as typeof db).select().from(pipelineStages);
  const f = stages.find((s) => s.id === from)?.name ?? "?";
  const t = stages.find((s) => s.id === to)?.name ?? "?";
  await logActivity(tx, user, { action: "opportunity.stage", entity: "opportunity", entityId: id, summary: `Stage changed: ${f} → ${t}`, details: { opportunity: name, from, to } });
}

export async function moveOpportunity(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const { id, stageId } = z.object({ id: z.string().uuid(), stageId: z.string().uuid("Choose a stage") }).parse(Object.fromEntries(fd));
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(opportunities).where(eq(opportunities.id, id));
      if (!before) throw new UserFacingError("This opportunity no longer exists.");
      if (before.stageId === stageId) return;
      const [stage] = await tx.select().from(pipelineStages).where(eq(pipelineStages.id, stageId));
      if (!stage) throw new UserFacingError("That stage no longer exists. Refresh the page.");
      await tx.update(opportunities).set({ stageId, updatedAt: new Date() }).where(eq(opportunities.id, id));
      await logStage(tx, user, id, before.name, before.stageId, stageId);
    });
    return { ok: true, message: "Moved" };
  });
}

export async function deleteOpportunity(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("delete", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    await db.transaction(async (tx) => {
      const [o] = await tx.delete(opportunities).where(eq(opportunities.id, id)).returning();
      if (!o) throw new UserFacingError("This opportunity no longer exists.");
      await logActivity(tx, user, { action: "opportunity.delete", entity: "opportunity", entityId: id, summary: `Deleted opportunity ${o.name}`, details: { record: o } });
    });
    return go("/pipeline", "Opportunity deleted");
  });
}
