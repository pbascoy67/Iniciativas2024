"use server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db, users } from "@/db";
import { logActivity } from "@/lib/activity";
import type { FormState } from "@/lib/action";
import { createSession, destroySession, getUser, hashPassword, loginThrottled, verifyPassword } from "@/lib/auth";

// Used so unknown emails cost the same time as wrong passwords.
let dummyHash: Promise<string> | undefined;

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter your email and password." };
  const { email, password } = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (loginThrottled(`${ip}|${email}`)) return { error: "Too many attempts. Wait a few minutes and try again." };
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    dummyHash ??= hashPassword("not-a-real-password");
    const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
    if (!user || !user.active || !ok) {
      await logActivity(db, null, { action: "auth.login_failed", entity: "auth", summary: `Failed sign-in for ${email.slice(0, 120)}` });
      return { error: "That email and password don't match an active user." };
    }
    await createSession(user.id);
    await logActivity(db, user, { action: "auth.login", entity: "auth", entityId: user.id, summary: `${user.name} signed in` });
  } catch (e) {
    console.error("[login]", e);
    return { error: "The database is unavailable. Check that it is running and try again." };
  }
  return { ok: true, redirectTo: "/" };
}

export async function logout(_prev: FormState, _fd: FormData): Promise<FormState> {
  const user = await getUser().catch(() => null);
  await destroySession().catch(() => {});
  if (user) await logActivity(db, user, { action: "auth.logout", entity: "auth", entityId: user.id, summary: `${user.name} signed out` }).catch(() => {});
  return { ok: true, redirectTo: "/login" };
}
