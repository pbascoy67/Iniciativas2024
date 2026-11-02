"use server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { companies, contacts, db, interactions, notes, opportunities, tasks } from "@/db";
import { go, guarded, UserFacingError, type FormState } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { domainOf, matchesForCompany } from "@/lib/duplicates";
import { mergeFields } from "@/lib/merge";
import { optStr, optUuid, parseForm, reqStr } from "@/lib/validation";

const companySchema = z.object({
  name: reqStr("Company name"), domain: optStr(120), website: optStr(300), phone: optStr(50), industry: optStr(100), address: optStr(300),
  ownerId: optUuid, force: z.string().optional(),
});

function clean(v: z.output<typeof companySchema>) {
  const { force: _f, ...rest } = v;
  return { ...rest, domain: domainOf(rest.domain || rest.website) || null };
}

export async function createCompany(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const parsed = parseForm(companySchema, fd);
    const v = clean(parsed);
    if (!parsed.force) {
      const existing = await db.select({ id: companies.id, name: companies.name, domain: companies.domain, website: companies.website }).from(companies);
      const hits = matchesForCompany({ name: v.name, domain: v.domain, website: v.website }, existing);
      if (hits.length) return { warning: `Possible duplicate of ${hits.slice(0, 3).map((h) => h.name).join(", ")}. Submit again to create it anyway.` };
    }
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(companies).values(v).returning({ id: companies.id });
      await logActivity(tx, user, { action: "company.create", entity: "company", entityId: row.id, summary: `Created company ${v.name}` });
      return row.id;
    });
    return go(`/companies/${id}`, "Company created");
  });
}

export async function updateCompany(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    const v = clean(parseForm(companySchema, fd));
    await db.transaction(async (tx) => {
      const res = await tx.update(companies).set({ ...v, updatedAt: new Date() }).where(eq(companies.id, id)).returning({ id: companies.id });
      if (!res.length) throw new UserFacingError("This company no longer exists.");
      await logActivity(tx, user, { action: "company.update", entity: "company", entityId: id, summary: `Updated company ${v.name}` });
    });
    return go(`/companies/${id}`, "Company saved");
  });
}

export async function deleteCompany(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("delete", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    await db.transaction(async (tx) => {
      const [c] = await tx.delete(companies).where(eq(companies.id, id)).returning();
      if (!c) throw new UserFacingError("This company no longer exists.");
      await logActivity(tx, user, { action: "company.delete", entity: "company", entityId: id, summary: `Deleted company ${c.name}`, details: { record: c } });
    });
    return go("/companies", "Company deleted (its contacts were kept)");
  });
}

const FILL = ["domain", "website", "phone", "industry", "address", "ownerId"] as const;

export async function mergeCompanies(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("merge", async (user) => {
    const ids = z.array(z.string().uuid()).min(2, "Select at least two companies").parse(fd.getAll("ids"));
    const keep = z.string().uuid("Choose which company to keep").parse(fd.get("keep"));
    const others = ids.filter((i) => i !== keep);
    if (others.length === ids.length || !others.length) throw new UserFacingError("Choose which company to keep.");
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(companies).where(inArray(companies.id, ids));
      const primary = rows.find((r) => r.id === keep);
      if (!primary || rows.length !== ids.length) throw new UserFacingError("One of these companies no longer exists. Refresh and try again.");
      const donors = others.map((o) => rows.find((r) => r.id === o)!);
      const patch = mergeFields(primary, donors, [...FILL]);
      if (Object.keys(patch).length) await tx.update(companies).set({ ...patch, updatedAt: new Date() }).where(eq(companies.id, keep));
      await tx.update(contacts).set({ companyId: keep }).where(inArray(contacts.companyId, others));
      await tx.update(opportunities).set({ companyId: keep }).where(inArray(opportunities.companyId, others));
      await tx.update(notes).set({ companyId: keep }).where(inArray(notes.companyId, others));
      await tx.update(tasks).set({ companyId: keep }).where(inArray(tasks.companyId, others));
      await tx.update(interactions).set({ companyId: keep }).where(inArray(interactions.companyId, others));
      await tx.delete(companies).where(inArray(companies.id, others));
      await logActivity(tx, user, {
        action: "company.merge", entity: "company", entityId: keep,
        summary: `Merged ${others.length} duplicate(s) into ${primary.name}`, details: { merged: donors, patch },
      });
    });
    return { ok: true, message: "Companies merged. Contacts, opportunities and history were moved to the kept company." };
  });
}
