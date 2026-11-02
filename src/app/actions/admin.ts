"use server";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, opportunities, pipelineStages, savedViews, sessions, users } from "@/db";
import { guarded, UserFacingError, type FormState } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { hashPassword } from "@/lib/auth";
import { createBackup, pruneBackups } from "@/lib/backup";
import { optStr, parseForm, reqStr } from "@/lib/validation";

/* ---------- pipeline stages ---------- */

const stageSchema = z.object({
  name: reqStr("Stage name", 60),
  probability: z.coerce.number({ invalid_type_error: "Enter a number from 0 to 100" }).int().min(0, "0-100").max(100, "0-100").default(0),
  kind: z.enum(["open", "won", "lost"]),
});

export async function addStage(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("manageStages", async (user) => {
    const v = parseForm(stageSchema, fd);
    await db.transaction(async (tx) => {
      const stages = await tx.select().from(pipelineStages);
      const position = Math.max(-1, ...stages.map((s) => s.position)) + 1;
      const [s] = await tx.insert(pipelineStages).values({ ...v, position }).returning({ id: pipelineStages.id });
      await logActivity(tx, user, { action: "stage.create", entity: "stage", entityId: s.id, summary: `Added pipeline stage ${v.name}` });
    });
    return { ok: true, message: "Stage added", reset: true };
  });
}

export async function updateStage(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("manageStages", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    const v = parseForm(stageSchema, fd);
    await db.transaction(async (tx) => {
      const stages = await tx.select().from(pipelineStages);
      if (!stages.some((s) => s.id === id)) throw new UserFacingError("This stage no longer exists.");
      if (v.kind !== "open" && !stages.some((s) => s.id !== id && s.kind === "open")) throw new UserFacingError("Keep at least one open stage.");
      await tx.update(pipelineStages).set(v).where(eq(pipelineStages.id, id));
      await logActivity(tx, user, { action: "stage.update", entity: "stage", entityId: id, summary: `Updated pipeline stage ${v.name}` });
    });
    return { ok: true, message: "Saved" };
  });
}

export async function moveStage(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("manageStages", async (user) => {
    const { id, dir } = z.object({ id: z.string().uuid(), dir: z.enum(["up", "down"]) }).parse(Object.fromEntries(fd));
    await db.transaction(async (tx) => {
      const stages = await tx.select().from(pipelineStages).orderBy(asc(pipelineStages.position));
      const i = stages.findIndex((s) => s.id === id);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= stages.length) return;
      // renumber to avoid ties, then swap
      const order = stages.map((s) => s.id);
      [order[i], order[j]] = [order[j], order[i]];
      for (const [pos, sid] of order.entries()) await tx.update(pipelineStages).set({ position: pos }).where(eq(pipelineStages.id, sid));
      await logActivity(tx, user, { action: "stage.reorder", entity: "stage", entityId: id, summary: `Moved stage ${stages[i].name} ${dir}` });
    });
    return { ok: true };
  });
}

export async function deleteStage(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("manageStages", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    await db.transaction(async (tx) => {
      const stages = await tx.select().from(pipelineStages);
      const s = stages.find((x) => x.id === id);
      if (!s) throw new UserFacingError("This stage no longer exists.");
      const [{ n }] = await tx.select({ n: count() }).from(opportunities).where(eq(opportunities.stageId, id));
      if (n > 0) throw new UserFacingError(`${n} opportunit${n === 1 ? "y is" : "ies are"} in "${s.name}". Move them to another stage first.`);
      if (s.kind === "open" && !stages.some((x) => x.id !== id && x.kind === "open")) throw new UserFacingError("Keep at least one open stage.");
      await tx.delete(pipelineStages).where(eq(pipelineStages.id, id));
      await logActivity(tx, user, { action: "stage.delete", entity: "stage", entityId: id, summary: `Deleted pipeline stage ${s.name}` });
    });
    return { ok: true };
  });
}

/* ---------- users ---------- */

const passwordField = z.string().min(12, "Use at least 12 characters").max(200);

export async function createUser(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("manageUsers", async (actor) => {
    const v = parseForm(
      z.object({ name: reqStr("Name", 100), email: z.string().trim().toLowerCase().email("Enter a valid email"), role: z.enum(["admin", "member", "viewer"]), password: passwordField }),
      fd,
    );
    await db.transaction(async (tx) => {
      const [dupe] = await tx.select({ id: users.id }).from(users).where(eq(users.email, v.email));
      if (dupe) throw new UserFacingError("A user with that email already exists.");
      const [u] = await tx.insert(users).values({ name: v.name, email: v.email, role: v.role, passwordHash: await hashPassword(v.password) }).returning({ id: users.id });
      await logActivity(tx, actor, { action: "user.create", entity: "user", entityId: u.id, summary: `Created ${v.role} user ${v.email}` });
    });
    return { ok: true, message: "User created", reset: true };
  });
}

export async function updateUser(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("manageUsers", async (actor) => {
    const v = z.object({ id: z.string().uuid(), role: z.enum(["admin", "member", "viewer"]), active: z.string().optional() }).parse(Object.fromEntries(fd));
    const active = v.active === "on";
    await db.transaction(async (tx) => {
      const [u] = await tx.select().from(users).where(eq(users.id, v.id));
      if (!u) throw new UserFacingError("This user no longer exists.");
      const demotingAdmin = u.role === "admin" && u.active && (v.role !== "admin" || !active);
      if (demotingAdmin) {
        const [{ n }] = await tx.select({ n: count() }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, v.id)));
        if (n === 0) throw new UserFacingError("There must be at least one active admin.");
      }
      await tx.update(users).set({ role: v.role, active }).where(eq(users.id, v.id));
      if (!active || v.role !== u.role) await tx.delete(sessions).where(eq(sessions.userId, v.id));
      await logActivity(tx, actor, { action: "user.update", entity: "user", entityId: v.id, summary: `Updated ${u.email}: role ${v.role}, ${active ? "active" : "deactivated"}` });
    });
    return { ok: true, message: "Saved" };
  });
}

export async function resetPassword(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("manageUsers", async (actor) => {
    const v = z.object({ id: z.string().uuid(), password: passwordField }).parse(Object.fromEntries(fd));
    await db.transaction(async (tx) => {
      const [u] = await tx.update(users).set({ passwordHash: await hashPassword(v.password) }).where(eq(users.id, v.id)).returning({ email: users.email });
      if (!u) throw new UserFacingError("This user no longer exists.");
      await tx.delete(sessions).where(eq(sessions.userId, v.id));
      await logActivity(tx, actor, { action: "user.password_reset", entity: "user", entityId: v.id, summary: `Reset password for ${u.email}` });
    });
    return { ok: true, message: "Password changed and sessions signed out" };
  });
}

/* ---------- saved views ---------- */

export async function saveView(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("read", async (user) => {
    const entity = z.enum(["contacts", "companies", "opportunities", "tasks"]).parse(fd.get("entity"));
    const name = reqStr("View name", 60).parse(fd.get("name"));
    const filters: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith("f_") && typeof v === "string" && v) filters[k.slice(2)] = v.slice(0, 200);
    if (!Object.keys(filters).length) throw new UserFacingError("Apply at least one filter before saving a view.");
    const shared = fd.get("shared") === "on" && user.role === "admin";
    await db.transaction(async (tx) => {
      const [v] = await tx.insert(savedViews).values({ entity, name, filters, ownerId: user.id, shared }).returning({ id: savedViews.id });
      await logActivity(tx, user, { action: "view.create", entity: "view", entityId: v.id, summary: `Saved view "${name}" on ${entity}` });
    });
    return { ok: true, message: "View saved", reset: true };
  });
}

export async function deleteView(_p: FormState, fd: FormData): Promise<FormState> {
  return guarded("read", async (user) => {
    const id = z.string().uuid().parse(fd.get("id"));
    await db.transaction(async (tx) => {
      const [v] = await tx.select().from(savedViews).where(eq(savedViews.id, id));
      if (!v) throw new UserFacingError("This view no longer exists.");
      if (v.ownerId !== user.id && user.role !== "admin") throw new UserFacingError("Only the owner or an admin can delete this view.");
      await tx.delete(savedViews).where(eq(savedViews.id, id));
      await logActivity(tx, user, { action: "view.delete", entity: "view", entityId: id, summary: `Deleted view "${v.name}"` });
    });
    return { ok: true };
  });
}

/* ---------- backups ---------- */

export async function makeBackup(_p: FormState, _fd: FormData): Promise<FormState> {
  return guarded("backup", async (user) => {
    const { file, bytes } = await createBackup().catch((e) => {
      throw new UserFacingError(`Backup failed: ${e.message}`);
    });
    pruneBackups(Number(process.env.BACKUP_KEEP) || 14);
    await logActivity(db, user, { action: "backup.create", entity: "backup", summary: `Created backup ${file}`, details: { bytes } });
    return { ok: true, message: `Backup ${file} created` };
  });
}
