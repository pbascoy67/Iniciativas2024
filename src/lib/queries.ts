import "server-only";
import { and, asc, count, desc, eq, gte, ilike, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { activityLog, companies, contacts, db, interactions, notes, opportunities, pipelineStages, savedViews, tasks, users } from "@/db";
import { addDays, todayISO } from "./dates";
import { sortTimeline, type TimelineItem } from "./timeline";

export const PAGE_SIZE = 25;

export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const contains = (q: string) => `%${likeEscape(q.trim())}%`;

export type Filters = Record<string, string | undefined>;
const page = (f: Filters) => Math.max(1, Number.parseInt(f.page ?? "1", 10) || 1);
const ownerCond = (col: Parameters<typeof eq>[0], owner?: string): SQL | undefined =>
  !owner ? undefined : owner === "none" ? isNull(col) : eq(col, owner);

const fullName = sql<string>`trim(${contacts.firstName} || ' ' || ${contacts.lastName})`;
const optionalName = sql<string | null>`nullif(trim(${contacts.firstName} || ' ' || ${contacts.lastName}), '')`;

export async function listUsers(includeInactive = false) {
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active }).from(users).orderBy(asc(users.name));
  return includeInactive ? rows : rows.filter((u) => u.active);
}

export async function listStages() {
  return db.select().from(pipelineStages).orderBy(asc(pipelineStages.position));
}

export async function companyOptions() {
  return db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(asc(companies.name));
}

export async function contactOptions() {
  return db
    .select({ id: contacts.id, name: fullName, email: contacts.email, companyId: contacts.companyId })
    .from(contacts)
    .orderBy(asc(contacts.lastName), asc(contacts.firstName));
}

/* ---------- lists ---------- */

export async function listContacts(f: Filters) {
  const p = page(f);
  const where = and(
    f.q ? or(sql`${fullName} ILIKE ${contains(f.q)}`, ilike(contacts.email, contains(f.q)), ilike(contacts.phone, contains(f.q)), ilike(contacts.jobTitle, contains(f.q))) : undefined,
    ownerCond(contacts.ownerId, f.owner),
    f.company ? eq(contacts.companyId, f.company) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: contacts.id, name: fullName, email: contacts.email, phone: contacts.phone,
        jobTitle: contacts.jobTitle, companyId: contacts.companyId, companyName: companies.name, ownerName: users.name,
      })
      .from(contacts)
      .leftJoin(companies, eq(companies.id, contacts.companyId))
      .leftJoin(users, eq(users.id, contacts.ownerId))
      .where(where)
      .orderBy(asc(contacts.lastName), asc(contacts.firstName))
      .limit(PAGE_SIZE)
      .offset((p - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(contacts).where(where),
  ]);
  return { rows, total, page: p };
}

export async function listCompanies(f: Filters) {
  const p = page(f);
  const where = and(
    f.q ? or(ilike(companies.name, contains(f.q)), ilike(companies.domain, contains(f.q)), ilike(companies.industry, contains(f.q))) : undefined,
    ownerCond(companies.ownerId, f.owner),
    f.industry ? ilike(companies.industry, contains(f.industry)) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: companies.id, name: companies.name, domain: companies.domain, industry: companies.industry, phone: companies.phone, ownerName: users.name,
        contactCount: sql<number>`(select count(*)::int from contacts c where c.company_id = ${companies.id})`,
        openOpps: sql<number>`(select count(*)::int from opportunities o join pipeline_stages s on s.id = o.stage_id where o.company_id = ${companies.id} and s.kind = 'open')`,
      })
      .from(companies)
      .leftJoin(users, eq(users.id, companies.ownerId))
      .where(where)
      .orderBy(asc(companies.name))
      .limit(PAGE_SIZE)
      .offset((p - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(companies).where(where),
  ]);
  return { rows, total, page: p };
}

const oppWhere = (f: Filters) =>
  and(
    f.q ? or(ilike(opportunities.name, contains(f.q)), ilike(companies.name, contains(f.q))) : undefined,
    ownerCond(opportunities.ownerId, f.owner),
    f.stage ? eq(opportunities.stageId, f.stage) : undefined,
    f.status && ["open", "won", "lost"].includes(f.status) ? eq(pipelineStages.kind, f.status as "open" | "won" | "lost") : undefined,
  );

export async function listOpportunities(f: Filters, opts: { all?: boolean } = {}) {
  const p = page(f);
  const where = oppWhere(f);
  const q = db
    .select({
      id: opportunities.id, name: opportunities.name, valueCents: opportunities.valueCents, expectedCloseDate: opportunities.expectedCloseDate,
      stageId: opportunities.stageId, stageName: pipelineStages.name, stageKind: pipelineStages.kind,
      companyId: opportunities.companyId, companyName: companies.name, contactId: opportunities.contactId, ownerName: users.name,
      nextTask: sql<string | null>`(select t.title from tasks t where t.opportunity_id = ${opportunities.id} and t.completed_at is null order by t.due_date nulls last limit 1)`,
      nextTaskDue: sql<string | null>`(select t.due_date::text from tasks t where t.opportunity_id = ${opportunities.id} and t.completed_at is null order by t.due_date nulls last limit 1)`,
    })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(where)
    .orderBy(asc(pipelineStages.position), desc(opportunities.valueCents));
  const rows = opts.all ? await q.limit(500) : await q.limit(PAGE_SIZE).offset((p - 1) * PAGE_SIZE);
  const [{ total }] = await db
    .select({ total: count() })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .where(where);
  return { rows, total, page: p };
}

function listTasksRaw(where: SQL | undefined, limit = 200) {
  return db
    .select({
      id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, completedAt: tasks.completedAt, ownerName: users.name,
      contactId: tasks.contactId, companyId: tasks.companyId, opportunityId: tasks.opportunityId,
      contactName: optionalName, companyName: companies.name, opportunityName: opportunities.name,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.ownerId))
    .leftJoin(contacts, eq(contacts.id, tasks.contactId))
    .leftJoin(companies, eq(companies.id, tasks.companyId))
    .leftJoin(opportunities, eq(opportunities.id, tasks.opportunityId))
    .where(where)
    .orderBy(sql`${tasks.completedAt} is not null`, asc(tasks.dueDate), asc(tasks.createdAt))
    .limit(limit);
}
export type TaskRow = Awaited<ReturnType<typeof listTasksRaw>>[number];

export async function listTasks(f: Filters) {
  const today = todayISO();
  const status = f.status ?? "open";
  return listTasksRaw(
    and(
      f.q ? ilike(tasks.title, contains(f.q)) : undefined,
      ownerCond(tasks.ownerId, f.owner),
      status === "open" ? isNull(tasks.completedAt) : undefined,
      status === "done" ? sql`${tasks.completedAt} is not null` : undefined,
      status === "overdue" ? and(isNull(tasks.completedAt), lt(tasks.dueDate, today)) : undefined,
      status === "today" ? and(isNull(tasks.completedAt), eq(tasks.dueDate, today)) : undefined,
    ),
  );
}

export interface Target { contactId?: string; companyId?: string; opportunityId?: string }

export async function tasksFor(t: Target) {
  const cond = t.contactId ? eq(tasks.contactId, t.contactId) : t.companyId ? eq(tasks.companyId, t.companyId) : eq(tasks.opportunityId, t.opportunityId!);
  return listTasksRaw(cond, 100);
}

/* ---------- dashboard ---------- */

export async function dashboard(ownerId: string | null) {
  const today = todayISO();
  const week = addDays(today, 7);
  const own = (col: Parameters<typeof eq>[0]) => (ownerId ? eq(col, ownerId) : undefined);
  const open = isNull(tasks.completedAt);
  const [overdue, dueToday, upcoming, openOpps, stages, recent] = await Promise.all([
    listTasksRaw(and(open, lt(tasks.dueDate, today), own(tasks.ownerId)), 50),
    listTasksRaw(and(open, eq(tasks.dueDate, today), own(tasks.ownerId)), 50),
    listTasksRaw(and(open, gte(tasks.dueDate, addDays(today, 1)), lte(tasks.dueDate, week), own(tasks.ownerId)), 50),
    db
      .select({
        id: opportunities.id, name: opportunities.name, valueCents: opportunities.valueCents, companyName: companies.name, stageName: pipelineStages.name,
        hasOpenTask: sql<boolean>`exists(select 1 from tasks t where t.opportunity_id = ${opportunities.id} and t.completed_at is null)`,
        lastTouch: sql<string | null>`greatest(
          (select max(i.occurred_at) from interactions i where i.opportunity_id = ${opportunities.id}),
          (select max(n.created_at) from notes n where n.opportunity_id = ${opportunities.id}))::text`,
        createdAt: opportunities.createdAt,
      })
      .from(opportunities)
      .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
      .leftJoin(companies, eq(companies.id, opportunities.companyId))
      .where(and(eq(pipelineStages.kind, "open"), own(opportunities.ownerId))),
    db
      .select({ id: pipelineStages.id, name: pipelineStages.name, kind: pipelineStages.kind, n: sql<number>`count(${opportunities.id})::int`, total: sql<number>`coalesce(sum(${opportunities.valueCents}),0)::float8` })
      .from(pipelineStages)
      .leftJoin(opportunities, and(eq(opportunities.stageId, pipelineStages.id), own(opportunities.ownerId)))
      .groupBy(pipelineStages.id)
      .orderBy(asc(pipelineStages.position)),
    db
      .select({ id: interactions.id, type: interactions.type, subject: interactions.subject, occurredAt: interactions.occurredAt, contactId: interactions.contactId, contactName: optionalName })
      .from(interactions)
      .leftJoin(contacts, eq(contacts.id, interactions.contactId))
      .orderBy(desc(interactions.occurredAt))
      .limit(6),
  ]);
  const staleBefore = Date.now() - 14 * 86400_000;
  const needsAttention = openOpps
    .map((o) => {
      const reasons: string[] = [];
      if (!o.hasOpenTask) reasons.push("No next action scheduled");
      const touched = new Date(o.lastTouch ?? o.createdAt).getTime();
      if (touched < staleBefore) reasons.push(`No contact in ${Math.floor((Date.now() - touched) / 86400_000)} days`);
      return { ...o, reasons };
    })
    .filter((o) => o.reasons.length);
  return { overdue, dueToday, upcoming, needsAttention, stages, recent, today };
}

/* ---------- timeline ---------- */

export async function timelineFor(t: Target): Promise<TimelineItem[]> {
  const ic = t.contactId ? interactions.contactId : t.companyId ? interactions.companyId : interactions.opportunityId;
  const nc = t.contactId ? notes.contactId : t.companyId ? notes.companyId : notes.opportunityId;
  const tc = t.contactId ? tasks.contactId : t.companyId ? tasks.companyId : tasks.opportunityId;
  const id = (t.contactId ?? t.companyId ?? t.opportunityId)!;
  const [ints, nts, doneTasks, stageChanges] = await Promise.all([
    db.select({ id: interactions.id, type: interactions.type, subject: interactions.subject, body: interactions.body, at: interactions.occurredAt, author: users.name })
      .from(interactions).leftJoin(users, eq(users.id, interactions.authorId)).where(eq(ic, id)),
    db.select({ id: notes.id, body: notes.body, at: notes.createdAt, author: users.name })
      .from(notes).leftJoin(users, eq(users.id, notes.authorId)).where(eq(nc, id)),
    db.select({ id: tasks.id, title: tasks.title, at: tasks.completedAt, author: users.name })
      .from(tasks).leftJoin(users, eq(users.id, tasks.ownerId)).where(and(eq(tc, id), sql`${tasks.completedAt} is not null`)),
    t.opportunityId
      ? db.select({ id: activityLog.id, summary: activityLog.summary, at: activityLog.at, author: activityLog.actorName })
          .from(activityLog).where(and(eq(activityLog.entity, "opportunity"), eq(activityLog.entityId, t.opportunityId), eq(activityLog.action, "opportunity.stage")))
      : Promise.resolve([]),
  ]);
  return sortTimeline([
    ...ints.map((i): TimelineItem => ({ id: `i${i.id}`, kind: i.type, at: i.at, title: i.subject, body: i.body, author: i.author })),
    ...nts.map((n): TimelineItem => ({ id: `n${n.id}`, kind: "note", at: n.at, title: "Note", body: n.body, author: n.author })),
    ...doneTasks.map((x): TimelineItem => ({ id: `t${x.id}`, kind: "task", at: x.at!, title: `Completed task: ${x.title}`, author: x.author })),
    ...stageChanges.map((s): TimelineItem => ({ id: `s${s.id}`, kind: "stage", at: s.at, title: s.summary, author: s.author })),
  ]);
}

/* ---------- saved views ---------- */

export async function viewsFor(entity: string, userId: string) {
  return db.select().from(savedViews).where(and(eq(savedViews.entity, entity), or(eq(savedViews.ownerId, userId), eq(savedViews.shared, true)))).orderBy(asc(savedViews.name));
}

/* ---------- search ---------- */

export interface SearchHit { id: string; name: string; sub: string; href: string }
export interface SearchResults { contacts: SearchHit[]; companies: SearchHit[]; opportunities: SearchHit[]; notes: SearchHit[] }

export async function globalSearch(q: string, limit = 6): Promise<SearchResults> {
  const term = contains(q);
  const [c, co, o, n] = await Promise.all([
    db.select({ id: contacts.id, name: fullName, email: contacts.email, company: companies.name })
      .from(contacts).leftJoin(companies, eq(companies.id, contacts.companyId))
      .where(or(sql`${fullName} ILIKE ${term}`, ilike(contacts.email, term), ilike(contacts.phone, term)))
      .orderBy(asc(contacts.lastName)).limit(limit),
    db.select({ id: companies.id, name: companies.name, domain: companies.domain, industry: companies.industry })
      .from(companies).where(or(ilike(companies.name, term), ilike(companies.domain, term))).orderBy(asc(companies.name)).limit(limit),
    db.select({ id: opportunities.id, name: opportunities.name, stage: pipelineStages.name, company: companies.name })
      .from(opportunities).innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId)).leftJoin(companies, eq(companies.id, opportunities.companyId))
      .where(ilike(opportunities.name, term)).limit(limit),
    db.select({ id: notes.id, body: notes.body, contactId: notes.contactId, companyId: notes.companyId, opportunityId: notes.opportunityId })
      .from(notes).where(ilike(notes.body, term)).orderBy(desc(notes.createdAt)).limit(limit),
  ]);
  return {
    contacts: c.map((x) => ({ id: x.id, name: x.name || x.email || "(unnamed)", sub: [x.email, x.company].filter(Boolean).join(" · "), href: `/contacts/${x.id}` })),
    companies: co.map((x) => ({ id: x.id, name: x.name, sub: [x.domain, x.industry].filter(Boolean).join(" · "), href: `/companies/${x.id}` })),
    opportunities: o.map((x) => ({ id: x.id, name: x.name, sub: [x.company, x.stage].filter(Boolean).join(" · "), href: `/opportunities/${x.id}` })),
    notes: n.map((x) => ({
      id: x.id,
      name: x.body.length > 90 ? `${x.body.slice(0, 90)}…` : x.body,
      sub: "Note",
      href: x.contactId ? `/contacts/${x.contactId}` : x.companyId ? `/companies/${x.companyId}` : `/opportunities/${x.opportunityId}`,
    })),
  };
}
