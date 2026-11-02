import { userOrResponse } from "@/lib/auth";
import { globalSearch } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await userOrResponse("read");
  if (user instanceof Response) return user;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ contacts: [], companies: [], opportunities: [], notes: [] });
  try {
    return Response.json(await globalSearch(q));
  } catch (e) {
    console.error("[search]", e);
    return Response.json({ error: "La búsqueda no está disponible por ahora." }, { status: 503 });
  }
}
