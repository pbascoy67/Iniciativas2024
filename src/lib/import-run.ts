import "server-only";
import { eq } from "drizzle-orm";
import { companies, contacts, db, users } from "@/db";
import { logActivity } from "./activity";
import type { SessionUser } from "./auth";
import { parseCsv } from "./csv";
import { domainOf, normalizeCompanyName, normalizeEmail } from "./duplicates";
import { MAX_IMPORT_ROWS, transform, type CompanyRecord, type ContactRecord, type ImportEntity, type Mapping, type RowError } from "./import-mapping";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errorCount: number;
  errors: RowError[];
}

export function parseImportText(text: string): { headers: string[]; rows: string[][] } {
  const all = parseCsv(text);
  if (all.length < 2) throw new Error("The file needs a header row and at least one data row.");
  if (all.length - 1 > MAX_IMPORT_ROWS) throw new Error(`Too many rows (${all.length - 1}). Split the file into chunks of ${MAX_IMPORT_ROWS} or fewer.`);
  return { headers: all[0].map((h) => h.trim()), rows: all.slice(1) };
}

export async function runImport(user: SessionUser, entity: ImportEntity, text: string, mapping: Mapping, onDuplicate: "skip" | "update"): Promise<ImportResult> {
  const { rows } = parseImportText(text);
  const { records, errors } = transform(entity, rows, mapping);
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errorCount: errors.length, errors: errors.slice(0, 50) };

  await db.transaction(async (tx) => {
    const allUsers = await tx.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.active, true));
    const ownerOf = (v: string | null) => {
      if (!v) return user.id;
      const k = v.trim().toLowerCase();
      return allUsers.find((u) => u.email === k || u.name.toLowerCase() === k)?.id ?? user.id;
    };
    const existingCompanies = await tx.select().from(companies);
    const byName = new Map(existingCompanies.map((c) => [normalizeCompanyName(c.name), c]));
    const byDomain = new Map(existingCompanies.filter((c) => c.domain).map((c) => [c.domain!, c]));

    if (entity === "companies") {
      for (const { record } of records as { row: number; record: CompanyRecord }[]) {
        const domain = domainOf(record.domain || record.website) || null;
        const hit = byName.get(normalizeCompanyName(record.name)) ?? (domain ? byDomain.get(domain) : undefined);
        if (hit) {
          if (onDuplicate === "skip") { result.skipped++; continue; }
          const patch = { website: record.website ?? hit.website, phone: record.phone ?? hit.phone, industry: record.industry ?? hit.industry, address: record.address ?? hit.address, domain: domain ?? hit.domain, updatedAt: new Date() };
          await tx.update(companies).set(patch).where(eq(companies.id, hit.id));
          result.updated++;
        } else {
          const [c] = await tx.insert(companies).values({ name: record.name, domain, website: record.website, phone: record.phone, industry: record.industry, address: record.address, ownerId: ownerOf(record.owner) }).returning();
          byName.set(normalizeCompanyName(c.name), c);
          if (c.domain) byDomain.set(c.domain, c);
          result.created++;
        }
      }
    } else {
      const existing = await tx.select().from(contacts);
      const byEmail = new Map(existing.filter((c) => c.email).map((c) => [normalizeEmail(c.email), c]));
      const companyFor = async (name: string | null) => {
        if (!name) return null;
        const key = normalizeCompanyName(name);
        let c = byName.get(key);
        if (!c) {
          [c] = await tx.insert(companies).values({ name, ownerId: user.id }).returning();
          byName.set(key, c);
        }
        return c.id;
      };
      for (const { record } of records as { row: number; record: ContactRecord }[]) {
        const hit = record.email ? byEmail.get(record.email) : undefined;
        if (hit) {
          if (onDuplicate === "skip") { result.skipped++; continue; }
          await tx.update(contacts).set({
            firstName: record.firstName || hit.firstName, lastName: record.lastName || hit.lastName, phone: record.phone ?? hit.phone,
            jobTitle: record.jobTitle ?? hit.jobTitle, companyId: (await companyFor(record.company)) ?? hit.companyId, updatedAt: new Date(),
          }).where(eq(contacts.id, hit.id));
          result.updated++;
        } else {
          const [c] = await tx.insert(contacts).values({
            firstName: record.firstName, lastName: record.lastName, email: record.email, phone: record.phone, jobTitle: record.jobTitle,
            companyId: await companyFor(record.company), ownerId: ownerOf(record.owner),
          }).returning();
          if (c.email) byEmail.set(normalizeEmail(c.email), c);
          result.created++;
        }
      }
    }
    await logActivity(tx, user, {
      action: "import.csv", entity: "import",
      summary: `Imported ${entity}: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errorCount} rejected`,
      details: { entity, onDuplicate, ...result },
    });
  });
  return result;
}
