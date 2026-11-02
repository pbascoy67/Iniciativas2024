import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";
import { safeFilename, isBackupFilename } from "@/lib/filenames";

describe("csv", () => {
  it("parses quotes, embedded newlines, CRLF, BOM and semicolons", () => {
    const text = '﻿Name;Note\r\n"Smith; Jo";"line1\nline2 ""q"""\r\n\r\nLee;ok';
    expect(parseCsv(text)).toEqual([["Name", "Note"], ["Smith; Jo", 'line1\nline2 "q"'], ["Lee", "ok"]]);
  });

  it("rejects truncated quoted files with a clear message", () => {
    expect(() => parseCsv('a,b\n"oops,1')).toThrow(/Unterminated/);
  });

  it("round-trips and neutralizes spreadsheet formulas on export", () => {
    const out = toCsv(["name", "note"], [{ name: '=HYPERLINK("http://x")', note: 'a,"b"' }, { name: "+1", note: null }]);
    const parsed = parseCsv(out);
    expect(parsed[1][0]).toBe(`'=HYPERLINK("http://x")`);
    expect(parsed[1][1]).toBe('a,"b"');
    expect(parsed[2][0]).toBe("'+1");
  });
});

describe("filenames", () => {
  it("strips traversal, separators and unicode tricks", () => {
    expect(safeFilename("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFilename("Contacts: Q1 / été.csv")).toBe("Contacts-Q1-ete.csv");
    expect(safeFilename("...", "export")).toBe("export");
    expect(safeFilename('a"\r\nb.csv')).toBe("a-b.csv");
  });
  it("only accepts our own backup file names", () => {
    expect(isBackupFilename("crm-20260102-030405.dump")).toBe(true);
    expect(isBackupFilename("../crm-20260102-030405.dump")).toBe(false);
    expect(isBackupFilename("other.dump")).toBe(false);
  });
});
