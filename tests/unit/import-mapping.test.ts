import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { autoMap, transform, transformContacts, splitFullName } from "@/lib/import-mapping";

describe("import mapping and transformation", () => {
  it("auto-maps common header spellings", () => {
    const m = autoMap(["First Name", "Last Name", "E-mail Address", "Mobile", "Organization", "Position"], "contacts");
    expect(m).toMatchObject({ firstName: 0, lastName: 1, email: 2, phone: 3, company: 4, jobTitle: 5, fullName: -1 });
  });

  it("maps a lone Name column to full name and splits it", () => {
    const m = autoMap(["Name", "Email", "Company Name"], "contacts");
    expect(m.fullName).toBe(0);
    const rows = parseCsv("Name,Email,Company Name\nAda Lovelace,ADA@Example.com,Analytical Engines\n\"Hopper, Grace\",,Navy").slice(1);
    const { records, errors } = transformContacts(rows, m);
    expect(errors).toEqual([]);
    expect(records[0].record).toMatchObject({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", company: "Analytical Engines" });
    expect(records[1].record).toMatchObject({ firstName: "Grace", lastName: "Hopper", email: null });
  });

  it("reports row-level errors without dropping good rows", () => {
    const m = autoMap(["First Name", "Email"], "contacts");
    const { records, errors } = transformContacts([["A", "not-an-email"], ["", ""], ["B", "b@x.io; c@x.io"]], m);
    expect(records.map((r) => r.record.email)).toEqual(["b@x.io"]);
    expect(errors.map((e) => e.row)).toEqual([1, 2]);
    expect(errors[0].message).toMatch(/Correo no válido/);
  });

  it("requires a company name for company imports", () => {
    const m = autoMap(["Company", "Website"], "companies");
    const out = transform("companies", [["Acme", "https://acme.test"], ["", "x"]], m);
    expect(out.records).toHaveLength(1);
    expect(out.errors[0]).toEqual({ row: 2, message: "El nombre de la empresa es obligatorio" });
  });

  it("splits names", () => {
    expect(splitFullName("Mary Ann van Dyke")).toEqual({ firstName: "Mary Ann van", lastName: "Dyke" });
    expect(splitFullName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });
});
