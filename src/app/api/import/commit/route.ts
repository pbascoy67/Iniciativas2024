import { sameOrigin, userOrResponse } from "@/lib/auth";
import { MAX_IMPORT_BYTES, type ImportEntity } from "@/lib/import-mapping";
import { runImport } from "@/lib/import-run";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userOrResponse("import");
  if (user instanceof Response) return user;
  if (!sameOrigin(req)) return Response.json({ error: "Solicitud de otro origen bloqueada." }, { status: 403 });
  let body: { entity?: string; text?: string; mapping?: Record<string, number>; onDuplicate?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Solicitud no válida." }, { status: 400 });
  }
  if (body.entity !== "contacts" && body.entity !== "companies") return Response.json({ error: "Elige contactos o empresas." }, { status: 400 });
  if (typeof body.text !== "string" || body.text.length > MAX_IMPORT_BYTES) return Response.json({ error: "Archivo ausente o demasiado grande." }, { status: 400 });
  if (!body.mapping || typeof body.mapping !== "object") return Response.json({ error: "Falta la asignación de columnas." }, { status: 400 });
  const mapping = Object.fromEntries(Object.entries(body.mapping).map(([k, v]) => [k, Number.isInteger(v) ? v : -1]));
  try {
    const result = await runImport(user, body.entity as ImportEntity, body.text, mapping, body.onDuplicate === "update" ? "update" : "skip");
    return Response.json(result);
  } catch (e) {
    console.error("[import]", e);
    const msg = e instanceof Error && /encabezados|Demasiadas filas|sin cerrar/.test(e.message) ? e.message : "La importación falló y no se cambió nada. Verifica que la base de datos esté en marcha e inténtalo de nuevo.";
    return Response.json({ error: msg }, { status: 400 });
  }
}
