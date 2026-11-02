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
  name: reqStr("El nombre de la empresa"), domain: optStr(120), website: optStr(300), phone: optStr(50), industry: optStr(100), address: optStr(300),
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
      if (hits.length) return { warning: `Posible duplicado de ${hits.slice(0, 3).map((h) => h.name).join(", ")}. Envía de nuevo para crearla de todos modos.` };
    }
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(companies).values(v).returning({ id: companies.id });
      await logActivity(tx, user, { action: "company.create", entity: "company", entityId: row.id, summary: `Creó la empresa ${v.name}` });
      return row.id;
    });
    return go(`/companies/${id}`, "Empresa creada");
  });
}

export async function updateCompany(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("write", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    const v = clean(parseForm(companySchema, fd));
    await db.transaction(async (tx) => {
      const res = await tx.update(companies).set({ ...v, updatedAt: new Date() }).where(eq(companies.id, id)).returning({ id: companies.id });
      if (!res.length) throw new UserFacingError("Esta empresa ya no existe.");
      await logActivity(tx, user, { action: "company.update", entity: "company", entityId: id, summary: `Actualizó la empresa ${v.name}` });
    });
    return go(`/companies/${id}`, "Empresa guardada");
  });
}

export async function deleteCompany(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("delete", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    await db.transaction(async (tx) => {
      const [c] = await tx.delete(companies).where(eq(companies.id, id)).returning();
      if (!c) throw new UserFacingError("Esta empresa ya no existe.");
      await logActivity(tx, user, { action: "company.delete", entity: "company", entityId: id, summary: `Eliminó la empresa ${c.name}`, details: { record: c } });
    });
    return go("/companies", "Empresa eliminada (sus contactos se conservaron)");
  });
}

const FILL = ["domain", "website", "phone", "industry", "address", "ownerId"] as const;

export async function mergeCompanies(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("merge", async (user) => {
    const ids = z.array(z.string().uuid()).min(2, "Selecciona al menos dos empresas").parse(fd.getAll("ids"));
    const keep = z.string().uuid("Elige qué empresa conservar").parse(fd.get("keep"));
    const others = ids.filter((i) => i !== keep);
    if (others.length === ids.length || !others.length) throw new UserFacingError("Elige qué empresa conservar.");
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(companies).where(inArray(companies.id, ids));
      const primary = rows.find((r) => r.id === keep);
      if (!primary || rows.length !== ids.length) throw new UserFacingError("Una de estas empresas ya no existe. Actualiza e inténtalo de nuevo.");
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
        summary: `Fusionó ${others.length} duplicado(s) en ${primary.name}`, details: { merged: donors, patch },
      });
    });
    return { ok: true, message: "Empresas fusionadas. Los contactos, oportunidades e historial pasaron a la empresa conservada." };
  });
}
