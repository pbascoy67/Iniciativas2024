import { sameOrigin, userOrResponse } from "@/lib/auth";
import { MAX_IMPORT_BYTES, type ImportEntity } from "@/lib/import-mapping";
import { runImport } from "@/lib/import-run";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userOrResponse("import");
  if (user instanceof Response) return user;
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  let body: { entity?: string; text?: string; mapping?: Record<string, number>; onDuplicate?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.entity !== "contacts" && body.entity !== "companies") return Response.json({ error: "Choose contacts or companies." }, { status: 400 });
  if (typeof body.text !== "string" || body.text.length > MAX_IMPORT_BYTES) return Response.json({ error: "Missing or oversized file." }, { status: 400 });
  if (!body.mapping || typeof body.mapping !== "object") return Response.json({ error: "Missing column mapping." }, { status: 400 });
  const mapping = Object.fromEntries(Object.entries(body.mapping).map(([k, v]) => [k, Number.isInteger(v) ? v : -1]));
  try {
    const result = await runImport(user, body.entity as ImportEntity, body.text, mapping, body.onDuplicate === "update" ? "update" : "skip");
    return Response.json(result);
  } catch (e) {
    console.error("[import]", e);
    const msg = e instanceof Error && /header row|Too many rows|Unterminated/.test(e.message) ? e.message : "Import failed and nothing was changed. Check that the database is running and try again.";
    return Response.json({ error: msg }, { status: 400 });
  }
}
