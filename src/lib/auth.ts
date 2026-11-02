import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { db, sessions, users } from "@/db";
import { can, type Permission, type Role } from "./permissions";

export { hashPassword, verifyPassword } from "./password";

export const SESSION_COOKIE = "crm_session";
const SESSION_DAYS = 14;

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** Resolve the logged-in user (null if none). Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
    .limit(1);
  return row ?? null;
});

/** For pages: redirect to login if signed out; throws ForbiddenError if permission missing. */
export async function requireUser(permission: Permission = "read"): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}

/** For route handlers: returns a user or a Response to send back. */
export async function userOrResponse(permission: Permission = "read"): Promise<SessionUser | Response> {
  let user: SessionUser | null = null;
  try {
    user = await getUser();
  } catch {
    return Response.json({ error: "The database is unavailable. Try again shortly." }, { status: 503 });
  }
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (!can(user.role, permission)) return Response.json({ error: "You do not have permission to do that." }, { status: 403 });
  return user;
}

/** Basic CSRF defence for cookie-authenticated JSON endpoints. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients (curl) don't send Origin; cookies still required
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

// naive in-memory login throttle: 8 attempts / 5 min per key
const attempts = new Map<string, { n: number; reset: number }>();
export function loginThrottled(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.reset < now) {
    attempts.set(key, { n: 1, reset: now + 300_000 });
    return false;
  }
  a.n++;
  return a.n > 8;
}
