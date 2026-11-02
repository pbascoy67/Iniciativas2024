import { normalizeEmail } from "./duplicates";

export type ImportEntity = "contacts" | "companies";

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export const CONTACT_FIELDS: FieldDef[] = [
  { key: "fullName", label: "Nombre completo (se separa en nombre/apellido)", aliases: ["name", "full name", "contact name", "contact"] },
  { key: "firstName", label: "Nombre", aliases: ["first name", "firstname", "given name", "first"] },
  { key: "lastName", label: "Apellido", aliases: ["last name", "lastname", "surname", "family name", "last"] },
  { key: "email", label: "Correo", aliases: ["email", "e-mail", "email address", "e-mail address", "work email", "primary email"] },
  { key: "phone", label: "Teléfono", aliases: ["phone", "phone number", "telephone", "mobile", "cell", "work phone", "primary phone"] },
  { key: "jobTitle", label: "Cargo", aliases: ["job title", "title", "position", "role"] },
  { key: "company", label: "Empresa (se crea si no existe)", aliases: ["company", "company name", "organization", "organisation", "account", "employer"] },
  { key: "owner", label: "Propietario (correo o nombre del usuario)", aliases: ["owner", "assigned to", "assigned", "user", "account owner"] },
];

export const COMPANY_FIELDS: FieldDef[] = [
  { key: "name", label: "Nombre", required: true, aliases: ["name", "company", "company name", "organization", "organisation", "account"] },
  { key: "domain", label: "Dominio", aliases: ["domain", "website domain"] },
  { key: "website", label: "Sitio web", aliases: ["website", "url", "web", "site", "web site"] },
  { key: "phone", label: "Teléfono", aliases: ["phone", "phone number", "telephone", "main phone"] },
  { key: "industry", label: "Industria", aliases: ["industry", "sector", "category"] },
  { key: "address", label: "Dirección", aliases: ["address", "street address", "location", "hq"] },
  { key: "owner", label: "Propietario (correo o nombre del usuario)", aliases: ["owner", "assigned to", "assigned", "user", "account owner"] },
];

export const FIELDS: Record<ImportEntity, FieldDef[]> = { contacts: CONTACT_FIELDS, companies: COMPANY_FIELDS };

/** field key -> column index (or -1 for "don't import") */
export type Mapping = Record<string, number>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Best-effort header -> field mapping. Each column is used at most once; exact alias beats loose. */
export function autoMap(headers: string[], entity: ImportEntity): Mapping {
  const fields = FIELDS[entity];
  const mapping: Mapping = Object.fromEntries(fields.map((f) => [f.key, -1]));
  const used = new Set<number>();
  const normalized = headers.map(norm);
  for (const f of fields) {
    // "name" is ambiguous for contacts: it only maps to fullName if no first/last column exists
    const idx = normalized.findIndex((h, i) => !used.has(i) && f.aliases.map(norm).includes(h));
    if (idx >= 0) {
      if (entity === "contacts" && f.key === "fullName" && normalized.some((h) => CONTACT_FIELDS[1].aliases.map(norm).includes(h))) continue;
      mapping[f.key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

export interface ContactRecord {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  company: string | null;
  owner: string | null;
}
export interface CompanyRecord {
  name: string;
  domain: string | null;
  website: string | null;
  phone: string | null;
  industry: string | null;
  address: string | null;
  owner: string | null;
}
export interface RowError {
  row: number; // 1-based data row number (header excluded)
  message: string;
}
export interface Transformed<T> {
  records: { row: number; record: T }[];
  errors: RowError[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: string | undefined) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};

export function splitFullName(full: string): { firstName: string; lastName: string } {
  const s = full.trim();
  if (s.includes(",")) {
    const [last, first] = s.split(",", 2).map((x) => x.trim());
    return { firstName: first ?? "", lastName: last };
  }
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function cell(row: string[], mapping: Mapping, key: string): string | null {
  const i = mapping[key];
  return i === undefined || i < 0 ? null : clean(row[i]);
}

export function transformContacts(rows: string[][], mapping: Mapping): Transformed<ContactRecord> {
  const out: Transformed<ContactRecord> = { records: [], errors: [] };
  rows.forEach((row, idx) => {
    const n = idx + 1;
    let firstName = cell(row, mapping, "firstName") ?? "";
    let lastName = cell(row, mapping, "lastName") ?? "";
    const full = cell(row, mapping, "fullName");
    if (!firstName && !lastName && full) ({ firstName, lastName } = splitFullName(full));
    const emailRaw = cell(row, mapping, "email");
    // LACRM-style multi-value cells ("a@x.com; b@x.com"): keep the first
    const email = emailRaw ? normalizeEmail(emailRaw.split(/[;,\s]+/)[0]) : null;
    if (email && !EMAIL_RE.test(email)) return void out.errors.push({ row: n, message: `Correo no válido "${emailRaw}"` });
    if (!firstName && !lastName && !email) return void out.errors.push({ row: n, message: "Necesita un nombre o un correo" });
    out.records.push({
      row: n,
      record: {
        firstName,
        lastName,
        email,
        phone: cell(row, mapping, "phone"),
        jobTitle: cell(row, mapping, "jobTitle"),
        company: cell(row, mapping, "company"),
        owner: cell(row, mapping, "owner"),
      },
    });
  });
  return out;
}

export function transformCompanies(rows: string[][], mapping: Mapping): Transformed<CompanyRecord> {
  const out: Transformed<CompanyRecord> = { records: [], errors: [] };
  rows.forEach((row, idx) => {
    const n = idx + 1;
    const name = cell(row, mapping, "name");
    if (!name) return void out.errors.push({ row: n, message: "El nombre de la empresa es obligatorio" });
    out.records.push({
      row: n,
      record: {
        name,
        domain: cell(row, mapping, "domain")?.toLowerCase() ?? null,
        website: cell(row, mapping, "website"),
        phone: cell(row, mapping, "phone"),
        industry: cell(row, mapping, "industry"),
        address: cell(row, mapping, "address"),
        owner: cell(row, mapping, "owner"),
      },
    });
  });
  return out;
}

export function transform(entity: ImportEntity, rows: string[][], mapping: Mapping) {
  return entity === "contacts" ? transformContacts(rows, mapping) : transformCompanies(rows, mapping);
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 20000;
