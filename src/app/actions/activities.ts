"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { companies, contacts, db, interactions, notes, opportunities, tasks, type Tx } from "@/db";
import { TYPE_ES } from "@/lib/i18n";
import { guarded, UserFacingError, type FormState } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { dateTime, optDate, optStr, optUuid, parseForm, reqStr } from "@/lib/validation";

const targetSchema = { contactId: optUuid, companyId: optUuid, opportunityId: optUuid };

/** Fill in the related ids so the entry shows on the contact, its company and the opportunity. */
async function resolveTarget(tx: Tx, t: { contactId: string | null; companyId: string | null; opportunityId: string | null }) {
  let { contactId, companyId, opportunityId } = t;
  if (!contactId && !companyId && !opportunityId) throw new UserFacingError("No hay nada a lo que asociar esto.");
  if (opportunityId) {
    const [o] = await tx.select().from(opportunities).where(eq(opportunities.id, opportunityId));
    if (!o) throw new UserFacingError("Esta oportunidad ya no existe.");
    contactId ??= o.contactId;
    companyId ??= o.companyId;
  }
  if (contactId) {
    const [c] = await tx.select().from(contacts).where(eq(contacts.id, contactId));
    if (!c) throw new UserFacingError("Este contacto ya no existe.");
    companyId ??= c.companyId;
  }
  if (companyId) {
    const [c] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId));
    if (!c) throw new UserFacingError("Esta empresa ya no existe.");
  }
  return { contactId, companyId, opportunityId };
}

const entityOf = (t: { contactId: string | null; companyId: string | null; opportunityId: string | null }) =>
  t.opportunityId ? { entity: "opportunity", id: t.opportunityId } : t.contactId ? { entity: "contact", id: t.contactId } : { entity: "company", id: t.companyId };

export async function addNote(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const v = parseForm(z.object({ body: reqStr("La nota", 10000), ...targetSchema }), fd);
    await db.transaction(async (tx) => {
      const t = await resolveTarget(tx, v);
      const [n] = await tx.insert(notes).values({ body: v.body, ...t, authorId: user.id }).returning({ id: notes.id });
      await logActivity(tx, user, { action: "note.create", entity: "note", entityId: n.id, summary: "Agregó una nota", details: { on: entityOf(t) } });
    });
    return { ok: true, message: "Nota agregada", reset: true };
  });
}

export async function logInteraction(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const v = parseForm(
      z.object({ type: z.enum(["email", "meeting", "call"], { errorMap: () => ({ message: "Elige un tipo" }) }), subject: reqStr("El asunto", 200), body: optStr(10000), occurredAt: dateTime, ...targetSchema }),
      fd,
    );
    if (v.occurredAt.getTime() > Date.now() + 86400_000) throw new UserFacingError("La fecha está en el futuro. Usa una tarea para lo que viene.");
    await db.transaction(async (tx) => {
      const t = await resolveTarget(tx, v);
      const [row] = await tx.insert(interactions).values({ type: v.type, subject: v.subject, body: v.body ?? "", occurredAt: v.occurredAt, ...t, authorId: user.id }).returning({ id: interactions.id });
      await logActivity(tx, user, { action: `interaction.${v.type}`, entity: "interaction", entityId: row.id, summary: `Registró ${TYPE_ES[v.type]}: ${v.subject}`, details: { on: entityOf(t) } });
    });
    return { ok: true, message: `${TYPE_ES[v.type][0].toUpperCase()}${TYPE_ES[v.type].slice(1)} registrado`, reset: true };
  });
}

export async function addTask(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const v = parseForm(z.object({ title: reqStr("La tarea", 300), dueDate: optDate, ownerId: optUuid, ...targetSchema }), fd);
    await db.transaction(async (tx) => {
      const t = v.contactId || v.companyId || v.opportunityId ? await resolveTarget(tx, v) : { contactId: null, companyId: null, opportunityId: null };
      const [row] = await tx.insert(tasks).values({ title: v.title, dueDate: v.dueDate, ownerId: v.ownerId ?? user.id, ...t }).returning({ id: tasks.id });
      await logActivity(tx, user, { action: "task.create", entity: "task", entityId: row.id, summary: `Creó la tarea: ${v.title}`, details: { due: v.dueDate } });
    });
    return { ok: true, message: "Tarea agregada", reset: true };
  });
}

export async function toggleTask(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    await db.transaction(async (tx) => {
      const [t] = await tx.select().from(tasks).where(eq(tasks.id, id));
      if (!t) throw new UserFacingError("Esta tarea ya no existe.");
      const done = !t.completedAt;
      await tx.update(tasks).set({ completedAt: done ? new Date() : null }).where(eq(tasks.id, id));
      await logActivity(tx, user, { action: done ? "task.complete" : "task.reopen", entity: "task", entityId: id, summary: `${done ? "Completó" : "Reabrió"} la tarea: ${t.title}` });
    });
    return { ok: true };
  });
}

export async function deleteTask(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("delete", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    await db.transaction(async (tx) => {
      const [t] = await tx.delete(tasks).where(eq(tasks.id, id)).returning();
      if (!t) throw new UserFacingError("Esta tarea ya no existe.");
      await logActivity(tx, user, { action: "task.delete", entity: "task", entityId: id, summary: `Eliminó la tarea: ${t.title}`, details: { record: t } });
    });
    return { ok: true };
  });
}
