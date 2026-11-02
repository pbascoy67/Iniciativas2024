import { desc, eq } from "drizzle-orm";
import { activityLog, companies, contacts, db, interactions, notes, opportunities, pipelineStages, savedViews, tasks, users } from "@/db";
import { logActivity } from "@/lib/activity";
import { sameOrigin, userOrResponse } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import { safeFilename } from "@/lib/filenames";
import type { Permission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const KINDS = ["contacts", "companies", "opportunities", "tasks", "interactions", "notes", "activity", "all"] as const;
type Kind = (typeof KINDS)[number];

async function rowsFor(kind: Exclude<Kind, "all">): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  switch (kind) {
    case "contacts": {
      const rows = await db.select({ id: contacts.id, first_name: contacts.firstName, last_name: contacts.lastName, email: contacts.email, phone: contacts.phone, job_title: contacts.jobTitle, company: companies.name, owner: users.email, created_at: contacts.createdAt })
        .from(contacts).leftJoin(companies, eq(companies.id, contacts.companyId)).leftJoin(users, eq(users.id, contacts.ownerId));
      return { columns: ["id", "first_name", "last_name", "email", "phone", "job_title", "company", "owner", "created_at"], rows };
    }
    case "companies": {
      const rows = await db.select({ id: companies.id, name: companies.name, domain: companies.domain, website: companies.website, phone: companies.phone, industry: companies.industry, address: companies.address, owner: users.email, created_at: companies.createdAt })
        .from(companies).leftJoin(users, eq(users.id, companies.ownerId));
      return { columns: ["id", "name", "domain", "website", "phone", "industry", "address", "owner", "created_at"], rows };
    }
    case "opportunities": {
      const rows = await db.select({ id: opportunities.id, name: opportunities.name, stage: pipelineStages.name, stage_kind: pipelineStages.kind, value: opportunities.valueCents, expected_close_date: opportunities.expectedCloseDate, company: companies.name, owner: users.email, created_at: opportunities.createdAt })
        .from(opportunities).innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId)).leftJoin(companies, eq(companies.id, opportunities.companyId)).leftJoin(users, eq(users.id, opportunities.ownerId));
      return { columns: ["id", "name", "stage", "stage_kind", "value", "expected_close_date", "company", "owner", "created_at"], rows: rows.map((r) => ({ ...r, value: (r.value / 100).toFixed(2) })) };
    }
    case "tasks": {
      const rows = await db.select({ id: tasks.id, title: tasks.title, due_date: tasks.dueDate, completed_at: tasks.completedAt, owner: users.email, contact_id: tasks.contactId, company_id: tasks.companyId, opportunity_id: tasks.opportunityId })
        .from(tasks).leftJoin(users, eq(users.id, tasks.ownerId));
      return { columns: ["id", "title", "due_date", "completed_at", "owner", "contact_id", "company_id", "opportunity_id"], rows };
    }
    case "interactions": {
      const rows = await db.select({ id: interactions.id, type: interactions.type, subject: interactions.subject, body: interactions.body, occurred_at: interactions.occurredAt, contact_id: interactions.contactId, company_id: interactions.companyId, opportunity_id: interactions.opportunityId, author: users.email })
        .from(interactions).leftJoin(users, eq(users.id, interactions.authorId)).orderBy(desc(interactions.occurredAt));
      return { columns: ["id", "type", "subject", "body", "occurred_at", "contact_id", "company_id", "opportunity_id", "author"], rows };
    }
    case "notes": {
      const rows = await db.select({ id: notes.id, body: notes.body, created_at: notes.createdAt, contact_id: notes.contactId, company_id: notes.companyId, opportunity_id: notes.opportunityId, author: users.email })
        .from(notes).leftJoin(users, eq(users.id, notes.authorId)).orderBy(desc(notes.createdAt));
      return { columns: ["id", "body", "created_at", "contact_id", "company_id", "opportunity_id", "author"], rows };
    }
    case "activity": {
      const rows = await db.select({ id: activityLog.id, at: activityLog.at, actor: activityLog.actorName, action: activityLog.action, entity: activityLog.entity, entity_id: activityLog.entityId, summary: activityLog.summary }).from(activityLog).orderBy(desc(activityLog.id));
      return { columns: ["id", "at", "actor", "action", "entity", "entity_id", "summary"], rows };
    }
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.includes(kind as Kind)) return Response.json({ error: "Unknown export type." }, { status: 404 });
  const perm: Permission = kind === "activity" ? "viewActivity" : "export";
  const user = await userOrResponse(perm);
  if (user instanceof Response) return user;
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    const stamp = todayISO();
    let body: string, type: string, name: string;
    if (kind === "all") {
      const entries = await Promise.all((["contacts", "companies", "opportunities", "tasks", "interactions", "notes"] as const).map(async (k) => [k, (await rowsFor(k)).rows] as const));
      const [stages, views, people] = await Promise.all([
        db.select().from(pipelineStages),
        db.select().from(savedViews),
        db.select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active }).from(users),
      ]);
      body = JSON.stringify({ exportedAt: new Date().toISOString(), format: "personal-crm/1", pipelineStages: stages, savedViews: views, users: people, ...Object.fromEntries(entries) }, null, 2);
      type = "application/json; charset=utf-8";
      name = safeFilename(`crm-full-export-${stamp}.json`);
    } else {
      const { columns, rows } = await rowsFor(kind as Exclude<Kind, "all">);
      body = toCsv(columns, rows);
      type = "text/csv; charset=utf-8";
      name = safeFilename(`crm-${kind}-${stamp}.csv`);
    }
    await logActivity(db, user, { action: "export", entity: "export", summary: `Exported ${kind}`, details: { bytes: body.length } });
    return new Response(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[export]", e);
    return Response.json({ error: "Export failed. The database may be unavailable; try again." }, { status: 503 });
  }
}
