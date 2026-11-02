import "server-only";
import { eq } from "drizzle-orm";
import { db, savedViews } from "@/db";
import type { Filters } from "./queries";

export type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads filters from the URL; `?view=<id>` replaces them with a saved view's filters. */
export async function resolveFilters(entity: string, sp: RawParams, allowed: string[]): Promise<{ filters: Filters; viewId: string | null }> {
  const page = first(sp.page);
  const viewId = first(sp.view);
  if (viewId && /^[0-9a-f-]{36}$/.test(viewId)) {
    const [v] = await db.select().from(savedViews).where(eq(savedViews.id, viewId));
    if (v && v.entity === entity) return { filters: { ...Object.fromEntries(allowed.filter((k) => v.filters[k]).map((k) => [k, v.filters[k]])), page }, viewId };
  }
  return { filters: { ...Object.fromEntries(allowed.map((k) => [k, first(sp[k])?.slice(0, 200) || undefined])), page }, viewId: null };
}
