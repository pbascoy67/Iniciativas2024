/** Minimal RFC 4180 CSV parser/serializer (quotes, CRLF, BOM, comma/semicolon/tab). */

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") {
      quoted = true;
    } else if (c === d) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("Campo entrecomillado sin cerrar: el archivo parece truncado o mal formado.");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // drop fully blank lines
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Spreadsheet apps execute cells beginning with = + - @ (or tab/CR) as formulas.
 * Prefix such cells with an apostrophe so exported data cannot run code when opened.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  s = neutralizeFormula(s);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(toCsvCell).join(",")];
  for (const r of rows) lines.push(columns.map((c) => toCsvCell(r[c])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
