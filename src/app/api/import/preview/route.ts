import { sameOrigin, userOrResponse } from "@/lib/auth";
import { autoMap, FIELDS, MAX_IMPORT_BYTES, transform, type ImportEntity } from "@/lib/import-mapping";
import { parseImportText } from "@/lib/import-run";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userOrResponse("import");
  if (user instanceof Response) return user;
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    const body = (await req.json()) as { entity?: string; text?: string; mapping?: Record<string, number> };
    if (body.entity !== "contacts" && body.entity !== "companies") return Response.json({ error: "Choose contacts or companies." }, { status: 400 });
    if (typeof body.text !== "string" || !body.text.trim()) return Response.json({ error: "The file is empty." }, { status: 400 });
    if (body.text.length > MAX_IMPORT_BYTES) return Response.json({ error: "File is larger than 5 MB. Split it into smaller files." }, { status: 413 });
    const entity = body.entity as ImportEntity;
    const { headers, rows } = parseImportText(body.text);
    const mapping = body.mapping ?? autoMap(headers, entity);
    const { records, errors } = transform(entity, rows, mapping);
    return Response.json({
      headers, mapping, fields: FIELDS[entity].map(({ key, label, required }) => ({ key, label, required: !!required })),
      totalRows: rows.length, validRows: records.length, errorCount: errors.length, errors: errors.slice(0, 20),
      sample: records.slice(0, 5).map((r) => r.record),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not read that file." }, { status: 400 });
  }
}
