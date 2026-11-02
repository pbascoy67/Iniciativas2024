/**
 * Field-level merge: keep the primary's values, fill blanks from the others (in order).
 * Returns only the fields that changed on the primary.
 */
export function mergeFields<T extends Record<string, unknown>>(primary: T, others: T[], fields: (keyof T)[]): Partial<T> {
  const patch: Partial<T> = {};
  for (const f of fields) {
    const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
    if (!isBlank(primary[f])) continue;
    const donor = others.find((o) => !isBlank(o[f]));
    if (donor) patch[f] = donor[f];
  }
  return patch;
}
