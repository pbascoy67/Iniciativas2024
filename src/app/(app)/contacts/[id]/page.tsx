import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteContact } from "@/app/actions/contacts";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ActionForm } from "@/components/form";
import { BackLink } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { companies, contacts, db, opportunities, pipelineStages, users } from "@/db";
import { formatMoney, todayISO } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listUsers, tasksFor, timelineFor } from "@/lib/queries";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db.select({ c: contacts, company: companies.name, owner: users.name }).from(contacts)
    .leftJoin(companies, eq(companies.id, contacts.companyId)).leftJoin(users, eq(users.id, contacts.ownerId)).where(eq(contacts.id, id));
  if (!row) notFound();
  const { c } = row;
  const [timeline, tasks, allUsers, opps] = await Promise.all([
    timelineFor({ contactId: id }), tasksFor({ contactId: id }), listUsers(),
    db.select({ id: opportunities.id, name: opportunities.name, valueCents: opportunities.valueCents, stage: pipelineStages.name }).from(opportunities)
      .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId)).where(eq(opportunities.contactId, id)),
  ]);
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "(unnamed)";
  const canWrite = can(user.role, "write");
  return (
    <>
      <BackLink href="/contacts">Contacts</BackLink>
      <div className="page-head">
        <div><h1>{name}</h1><p className="muted">{[c.jobTitle, row.company].filter(Boolean).join(" at ")}</p></div>
        <div className="row">
          {canWrite && <Link prefetch={false} className="btn" href={`/contacts/${id}/edit`}>Edit</Link>}
          {canWrite && <Link prefetch={false} className="btn" href={`/opportunities/new?contact=${id}`}>New opportunity</Link>}
          {can(user.role, "delete") && <ActionForm action={deleteContact} inline submit="Delete" submitClass="danger" confirm="Delete this contact and its notes, tasks and interactions? This is recorded in the activity log.">
            <input type="hidden" name="id" value={id} /></ActionForm>}
        </div>
      </div>
      <div className="split">
        <div>
          <div className="card">
            <dl className="kv">
              <dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</dd>
              <dt>Phone</dt><dd>{c.phone ?? "—"}</dd>
              <dt>Company</dt><dd>{c.companyId ? <Link prefetch={false} href={`/companies/${c.companyId}`}>{row.company}</Link> : "—"}</dd>
              <dt>Owner</dt><dd>{row.owner ?? "Unassigned"}</dd>
            </dl>
          </div>
          <div className="card">
            <h2>Opportunities</h2>
            {opps.length === 0 ? <p className="muted small">None yet.</p> : opps.map((o) => (
              <div key={o.id} className="task"><div className="grow"><Link prefetch={false} href={`/opportunities/${o.id}`}>{o.name}</Link><div className="small muted">{o.stage} · {formatMoney(o.valueCents)}</div></div></div>
            ))}
          </div>
        </div>
        <ActivityPanel target={{ contactId: id }} timeline={timeline} tasks={tasks} today={todayISO()} canWrite={canWrite} canDelete={can(user.role, "delete")} users={allUsers} currentUserId={user.id} />
      </div>
    </>
  );
}
