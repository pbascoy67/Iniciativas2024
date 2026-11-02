import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteOpportunity, moveOpportunity } from "@/app/actions/opportunities";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ActionForm, Field } from "@/components/form";
import { BackLink } from "@/components/forms";
import { companies, contacts, db, opportunities, pipelineStages, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, todayISO } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listStages, listUsers, tasksFor, timelineFor } from "@/lib/queries";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db.select({ o: opportunities, stage: pipelineStages, company: companies.name, contactFirst: contacts.firstName, contactLast: contacts.lastName, owner: users.name })
    .from(opportunities).innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId)).leftJoin(contacts, eq(contacts.id, opportunities.contactId)).leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(eq(opportunities.id, id));
  if (!row) notFound();
  const { o, stage } = row;
  const [timeline, tasks, allUsers, stages] = await Promise.all([timelineFor({ opportunityId: id }), tasksFor({ opportunityId: id }), listUsers(), listStages()]);
  const canWrite = can(user.role, "write");
  const contactName = [row.contactFirst, row.contactLast].filter(Boolean).join(" ");
  const hasNext = tasks.some((t) => !t.completedAt);
  return (
    <>
      <BackLink href="/pipeline">Pipeline</BackLink>
      <div className="page-head">
        <div><h1>{o.name}</h1><p className="muted"><span className={`badge ${stage.kind === "won" ? "good" : stage.kind === "lost" ? "bad" : ""}`}>{stage.name}</span> · {formatMoney(o.valueCents)}</p></div>
        <div className="row">
          {canWrite && <Link prefetch={false} className="btn" href={`/opportunities/${id}/edit`}>Edit</Link>}
          {can(user.role, "delete") && <ActionForm action={deleteOpportunity} inline submit="Delete" submitClass="danger" confirm="Delete this opportunity and its notes, tasks and interactions?"><input type="hidden" name="id" value={id} /></ActionForm>}
        </div>
      </div>
      {stage.kind === "open" && !hasNext && <div className="notice warn">No next action scheduled. Add a task so this deal doesn&apos;t stall.</div>}
      <div className="split">
        <div>
          <div className="card"><dl className="kv">
            <dt>Company</dt><dd>{o.companyId ? <Link prefetch={false} href={`/companies/${o.companyId}`}>{row.company}</Link> : "—"}</dd>
            <dt>Contact</dt><dd>{o.contactId ? <Link prefetch={false} href={`/contacts/${o.contactId}`}>{contactName || "contact"}</Link> : "—"}</dd>
            <dt>Expected close</dt><dd>{formatDate(o.expectedCloseDate)}</dd><dt>Owner</dt><dd>{row.owner ?? "Unassigned"}</dd></dl></div>
          {canWrite && (
            <div className="card"><h2>Move stage</h2>
              <ActionForm action={moveOpportunity} submit="Move" className="row">
                <input type="hidden" name="id" value={id} />
                <Field label="Stage" name="stageId" defaultValue={o.stageId} options={stages.map((s) => ({ value: s.id, label: s.name }))} />
              </ActionForm></div>
          )}
        </div>
        <ActivityPanel target={{ opportunityId: id }} timeline={timeline} tasks={tasks} today={todayISO()} canWrite={canWrite} canDelete={can(user.role, "delete")} users={allUsers} currentUserId={user.id} />
      </div>
    </>
  );
}
