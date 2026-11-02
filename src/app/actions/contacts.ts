"use server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { contacts, db, interactions, notes, opportunities, tasks } from "@/db";
import { go, guarded, UserFacingError, type FormState } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { matchesForContact } from "@/lib/duplicates";
import { mergeFields } from "@/lib/merge";
import { optEmail, optStr, optUuid, parseForm } from "@/lib/validation";

const contactSchema = z
  .object({
    firstName: optStr(100), lastName: optStr(100), email: optEmail, phone: optStr(50), jobTitle: optStr(120),
    companyId: optUuid, ownerId: optUuid, force: z.string().optional(),
  })
  .refine((v) => v.firstName || v.lastName || v.email, { message: "Enter a name or an email", path: ["firstName"] });

const display = (c: { firstName: string | null; lastName: string | null; email: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "contact";

export async function createContact(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const { force, ...v } = parseForm(contactSchema, fd);
    if (!force) {
      const existing = await db.select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email, phone: contacts.phone, companyId: contacts.companyId }).from(contacts);
      const hits = matchesForContact({ firstName: v.firstName ?? "", lastName: v.lastName ?? "", email: v.email, phone: v.phone, companyId: v.companyId }, existing);
      if (hits.length) return { warning: `Possible duplicate of ${hits.slice(0, 3).map(display).join(", ")}. Submit again to create it anyway.` };
    }
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(contacts).values({ ...v, firstName: v.firstName ?? "", lastName: v.lastName ?? "" }).returning({ id: contacts.id });
      await logActivity(tx, user, { action: "contact.create", entity: "contact", entityId: row.id, summary: `Created contact ${display(v)}` });
      return row.id;
    });
    return go(`/contacts/${id}`, "Contact created");
  });
}

export async function updateContact(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    const { force: _f, ...v } = parseForm(contactSchema, fd);
    await db.transaction(async (tx) => {
      const res = await tx.update(contacts).set({ ...v, firstName: v.firstName ?? "", lastName: v.lastName ?? "", updatedAt: new Date() }).where(eq(contacts.id, id)).returning({ id: contacts.id });
      if (!res.length) throw new UserFacingError("This contact no longer exists.");
      await logActivity(tx, user, { action: "contact.update", entity: "contact", entityId: id, summary: `Updated contact ${display(v)}` });
    });
    return go(`/contacts/${id}`, "Contact saved");
  });
}

export async function deleteContact(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("delete", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    await db.transaction(async (tx) => {
      const [c] = await tx.delete(contacts).where(eq(contacts.id, id)).returning();
      if (!c) throw new UserFacingError("This contact no longer exists.");
      await logActivity(tx, user, { action: "contact.delete", entity: "contact", entityId: id, summary: `Deleted contact ${display(c)}`, details: { record: c } });
    });
    return go("/contacts", "Contact deleted");
  });
}

const FILL = ["firstName", "lastName", "email", "phone", "jobTitle", "companyId", "ownerId"] as const;

export async function mergeContacts(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("merge", async (user) => {
    const ids = z.array(z.string().uuid()).min(2, "Select at least two contacts").parse(fd.getAll("ids"));
    const keep = z.string().uuid("Choose which contact to keep").parse(fd.get("keep"));
    const others = ids.filter((i) => i !== keep);
    if (others.length === ids.length || !others.length) throw new UserFacingError("Choose which contact to keep.");
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(contacts).where(inArray(contacts.id, ids));
      const primary = rows.find((r) => r.id === keep);
      if (!primary || rows.length !== ids.length) throw new UserFacingError("One of these contacts no longer exists. Refresh and try again.");
      const donors = others.map((o) => rows.find((r) => r.id === o)!);
      const patch = mergeFields(primary, donors, [...FILL]);
      if (Object.keys(patch).length) await tx.update(contacts).set({ ...patch, updatedAt: new Date() }).where(eq(contacts.id, keep));
      await tx.update(notes).set({ contactId: keep }).where(inArray(notes.contactId, others));
      await tx.update(tasks).set({ contactId: keep }).where(inArray(tasks.contactId, others));
      await tx.update(interactions).set({ contactId: keep }).where(inArray(interactions.contactId, others));
      await tx.update(opportunities).set({ contactId: keep }).where(inArray(opportunities.contactId, others));
      await tx.delete(contacts).where(inArray(contacts.id, others));
      await logActivity(tx, user, {
        action: "contact.merge", entity: "contact", entityId: keep,
        summary: `Merged ${others.length} duplicate(s) into ${display(primary)}`,
        details: { merged: donors, patch },
      });
    });
    return { ok: true, message: "Contacts merged. Notes, tasks, interactions and opportunities were moved to the kept contact." };
  });
}

