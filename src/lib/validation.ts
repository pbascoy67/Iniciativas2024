import { z, ZodError, type ZodTypeAny } from "zod";

export const reqStr = (label: string, max = 200) =>
  z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `${label} is too long (max ${max})`);

export const optStr = (max = 200) =>
  z.string().trim().max(max, `Too long (max ${max})`).optional().transform((v) => (v ? v : null));

export const optUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.string().uuid("Invalid selection").nullable());

export const optEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null))
  .pipe(z.string().email("Enter a valid email address").nullable());

export const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable());

export class ValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>) {
    super("Please fix the highlighted fields.");
  }
}

export function parseForm<S extends ZodTypeAny>(schema: S, fd: FormData): z.output<S> {
  const raw: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) raw[k] = v;
  const res = schema.safeParse(raw);
  if (res.success) return res.data;
  throw new ValidationError(zodToFieldErrors(res.error));
}

function zodToFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** datetime-local ("2026-03-04T09:30") -> Date, interpreted in the server's TZ env. */
export const dateTime = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return new Date();
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
      return z.NEVER;
    }
    return d;
  });
