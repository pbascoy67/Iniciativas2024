export interface DupContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
}
export interface DupCompany {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
}
export interface DupGroup {
  ids: string[];
  reasons: string[];
}

export const normalizeEmail = (e?: string | null) => (e ?? "").trim().toLowerCase();

/** Digits only, last 10 so "+1 (555) 010-1234" equals "555-010-1234". */
export function normalizePhone(p?: string | null): string {
  const digits = (p ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : "";
}

export function normalizeName(...parts: (string | null | undefined)[]): string {
  return parts
    .join(" ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SUFFIXES = new Set(["inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "co", "company", "gmbh", "sa", "plc", "lp", "llp", "the"]);

export function normalizeCompanyName(name?: string | null): string {
  const words = normalizeName(name).split(" ").filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  while (words.length > 1 && words[0] === "the") words.shift();
  return words.join(" ");
}

export function domainOf(value?: string | null): string {
  if (!value) return "";
  let v = value.trim().toLowerCase();
  if (v.includes("@")) v = v.split("@").pop()!;
  v = v.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return v;
}

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "protonmail.com", "aol.com"]);
export const isFreeMailDomain = (d: string) => FREE_MAIL.has(d);

class UnionFind {
  parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p === x) return x;
    const r = this.find(p);
    this.parent.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    this.parent.set(this.find(a), this.find(b));
  }
}

function group<T extends { id: string }>(items: T[], keys: (item: T) => { reason: string; key: string }[]): DupGroup[] {
  const uf = new UnionFind();
  const buckets = new Map<string, { reason: string; ids: string[] }>();
  for (const item of items) {
    uf.find(item.id);
    for (const { reason, key } of keys(item)) {
      if (!key) continue;
      const bk = `${reason}\u0000${key}`;
      const b = buckets.get(bk) ?? { reason, ids: [] };
      b.ids.push(item.id);
      buckets.set(bk, b);
    }
  }
  const reasonsByRoot = new Map<string, Set<string>>();
  for (const b of buckets.values()) {
    if (b.ids.length < 2) continue;
    for (const id of b.ids.slice(1)) uf.union(b.ids[0], id);
  }
  for (const b of buckets.values()) {
    if (b.ids.length < 2) continue;
    const root = uf.find(b.ids[0]);
    (reasonsByRoot.get(root) ?? reasonsByRoot.set(root, new Set()).get(root)!).add(b.reason);
  }
  const members = new Map<string, string[]>();
  for (const item of items) {
    const root = uf.find(item.id);
    if (reasonsByRoot.has(root)) (members.get(root) ?? members.set(root, []).get(root)!).push(item.id);
  }
  return [...members.entries()].map(([root, ids]) => ({ ids, reasons: [...reasonsByRoot.get(root)!] }));
}

export function findContactDuplicates(contacts: DupContact[]): DupGroup[] {
  return group(contacts, (c) => {
    const name = normalizeName(c.firstName, c.lastName);
    return [
      { reason: "same email", key: normalizeEmail(c.email) },
      { reason: "same phone", key: normalizePhone(c.phone) },
      // name alone is too weak; require the same company (or both companyless)
      { reason: "same name and company", key: name.includes(" ") ? `${name}|${c.companyId ?? "none"}` : "" },
    ];
  });
}

export function findCompanyDuplicates(companies: DupCompany[]): DupGroup[] {
  return group(companies, (c) => {
    const dom = domainOf(c.domain || c.website);
    return [
      { reason: "same name", key: normalizeCompanyName(c.name) },
      { reason: "same domain", key: isFreeMailDomain(dom) ? "" : dom },
    ];
  });
}

/** Existing contacts that look like `candidate` (used to warn before creating one). */
export function matchesForContact(candidate: Omit<DupContact, "id">, existing: DupContact[]): DupContact[] {
  const probe: DupContact = { ...candidate, id: "__candidate__" };
  const groups = findContactDuplicates([probe, ...existing]);
  const g = groups.find((x) => x.ids.includes("__candidate__"));
  return g ? existing.filter((e) => g.ids.includes(e.id)) : [];
}

export function matchesForCompany(candidate: Omit<DupCompany, "id">, existing: DupCompany[]): DupCompany[] {
  const probe: DupCompany = { ...candidate, id: "__candidate__" };
  const g = findCompanyDuplicates([probe, ...existing]).find((x) => x.ids.includes("__candidate__"));
  return g ? existing.filter((e) => g.ids.includes(e.id)) : [];
}
