import { describe, expect, it } from "vitest";
import { findCompanyDuplicates, findContactDuplicates, matchesForContact, normalizeCompanyName, normalizePhone } from "@/lib/duplicates";
import { mergeFields } from "@/lib/merge";
import { sortTimeline } from "@/lib/timeline";
import { can } from "@/lib/permissions";
import { parseMoneyToCents } from "@/lib/dates";

const c = (id: string, o: Partial<Parameters<typeof findContactDuplicates>[0][0]> = {}) => ({
  id, firstName: "", lastName: "", email: null, phone: null, companyId: null, ...o,
});

describe("duplicate detection", () => {
  it("groups contacts transitively by email, phone and name+company", () => {
    const groups = findContactDuplicates([
      c("1", { firstName: "Jon", lastName: "Smith", email: "JON@x.com" }),
      c("2", { firstName: "Jonathan", lastName: "Smith", email: "jon@x.com", phone: "+1 (555) 010-9999" }),
      c("3", { firstName: "J", lastName: "S", phone: "555.010.9999" }),
      c("4", { firstName: "Ann", lastName: "Lee", companyId: "co1" }),
      c("5", { firstName: "ann", lastName: "LEE", companyId: "co1" }),
      c("6", { firstName: "Ann", lastName: "Lee", companyId: "co2" }),
    ]);
    const sorted = groups.map((g) => g.ids.sort()).sort();
    expect(sorted).toEqual([["1", "2", "3"], ["4", "5"]]);
    expect(groups.find((g) => g.ids.includes("1"))!.reasons).toEqual(expect.arrayContaining(["mismo correo", "mismo teléfono"]));
  });

  it("ignores single-word names and short phone numbers", () => {
    expect(findContactDuplicates([c("1", { firstName: "Sam" }), c("2", { firstName: "Sam" })])).toEqual([]);
    expect(normalizePhone("12345")).toBe("");
  });

  it("matches companies ignoring legal suffixes, case and domain prefixes", () => {
    expect(normalizeCompanyName("The Acme Corp.")).toBe("acme");
    const groups = findCompanyDuplicates([
      { id: "a", name: "Acme Corporation", domain: null, website: null },
      { id: "b", name: "ACME, Inc.", domain: null, website: null },
      { id: "c", name: "Globex", domain: "globex.com", website: null },
      { id: "d", name: "Globex Holdings", domain: null, website: "https://www.globex.com/about" },
      { id: "e", name: "Initech", domain: "gmail.com", website: null },
      { id: "f", name: "Hooli", domain: "gmail.com", website: null },
    ]);
    expect(groups.map((g) => g.ids.sort()).sort()).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("warns about likely duplicates before creating", () => {
    const hits = matchesForContact({ firstName: "x", lastName: "", email: "A@B.co", phone: null, companyId: null }, [c("1", { email: "a@b.co" }), c("2", { email: "z@z.co" })]);
    expect(hits.map((h) => h.id)).toEqual(["1"]);
  });
});

describe("merge, timeline, permissions, money", () => {
  it("fills blanks on the primary from the first donor that has a value", () => {
    const patch = mergeFields(
      { phone: "", jobTitle: "CEO", email: null as string | null },
      [{ phone: "", jobTitle: "CTO", email: null }, { phone: "555", jobTitle: "x", email: "a@b.co" }],
      ["phone", "jobTitle", "email"],
    );
    expect(patch).toEqual({ phone: "555", email: "a@b.co" });
  });

  it("sorts the timeline newest first", () => {
    const mk = (id: string, iso: string) => ({ id, kind: "note" as const, title: id, at: new Date(iso) });
    expect(sortTimeline([mk("old", "2026-01-01"), mk("new", "2026-03-01"), mk("mid", "2026-02-01")]).map((i) => i.id)).toEqual(["new", "mid", "old"]);
  });

  it("enforces the role matrix", () => {
    expect(can("viewer", "read")).toBe(true);
    expect(can("viewer", "write")).toBe(false);
    expect(can("member", "import")).toBe(true);
    expect(can("member", "manageUsers")).toBe(false);
    expect(can("admin", "backup")).toBe(true);
    expect(can(undefined, "read")).toBe(false);
  });

  it("parses typed money values", () => {
    expect(parseMoneyToCents("1234.5")).toBe(123450);
    expect(parseMoneyToCents("$12,500")).toBe(1250000);
    expect(parseMoneyToCents("1.234,50")).toBe(123450);
    expect(parseMoneyToCents("abc")).toBe(0);
    expect(parseMoneyToCents("-5")).toBeNull();
  });
});
