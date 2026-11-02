import "server-only";
import { ForbiddenError, requireUser, type SessionUser } from "./auth";
import type { Permission } from "./permissions";
import { ValidationError } from "./validation";

export type FormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  warning?: string;
  reset?: boolean;
  /** Client navigates here after success (avoids Next's flaky server-action redirect handshake). */
  redirectTo?: string;
  fieldErrors?: Record<string, string>;
} | null;

export class UserFacingError extends Error {}

function isRedirect(e: unknown) {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"));
}

/**
 * Wraps a server action: checks permission, converts validation / permission / database
 * problems into a recoverable message the form can show instead of a crashed page.
 */
export async function guarded(permission: Permission, fn: (user: SessionUser) => Promise<FormState | void>): Promise<FormState> {
  try {
    const user = await requireUser(permission);
    const result = (await fn(user)) ?? { ok: true };
    return result;
  } catch (e) {
    if (isRedirect(e)) throw e;
    if (e instanceof ValidationError) return { error: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof ForbiddenError || e instanceof UserFacingError) return { error: e.message };
    console.error("[action]", e);
    return { error: "Algo salió mal y no se guardó nada. Verifica que la base de datos esté en marcha e inténtalo de nuevo." };
  }
}

/** Redirect target carrying a one-shot success message. */
export const withNotice = (path: string, message: string) => `${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(message)}`;

export const go = (path: string, message: string): FormState => ({ ok: true, redirectTo: withNotice(path, message) });
