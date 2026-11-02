import "server-only";
import { activityLog, type DbOrTx } from "@/db";
import type { SessionUser } from "./auth";

export interface ActivityInput {
  action: string; // e.g. contact.create
  entity: string; // contact | company | opportunity | task | note | interaction | stage | user | import | export | backup | auth
  entityId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
}

/** Append to the immutable activity log. Pass the transaction so the entry commits with the change. */
export async function logActivity(tx: DbOrTx, actor: Pick<SessionUser, "id" | "name"> | null, input: ActivityInput) {
  await tx.insert(activityLog).values({
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "system",
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    summary: input.summary.slice(0, 500),
    details: input.details ?? null,
  });
}
