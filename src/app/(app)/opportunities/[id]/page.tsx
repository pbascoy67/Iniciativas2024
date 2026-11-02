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
      <BackLink href="/pipeline">Embudo</BackLink>
      <div className="page-head">
        <div><h1>{o.name}</h1><p className="muted"><span className={`badge ${stage.kind === "won" ? "good" : stage.kind === "lost" ? "bad" : ""}`}>{stage.name}</span> · {formatMoney(o.valueCents)}</p></div>
        <div className="row">
          {canWrite && <Link prefetch={false} className="btn" href={`/opportunities/${id}/edit`}>Editar</Link>}
          {can(user.role, "delete") && <ActionForm action={deleteOpportunity} inline submit="Eliminar" submitClass="danger" confirm="¿Eliminar esta oportunidad y sus notas, tareas e interacciones?"><input type="hidden" name="id" value={id} /></ActionForm>}
        </div>
      </div>
      {stage.kind === "open" && !hasNext && <div className="notice warn">No hay una próxima acción programada. Agrega una tarea para que esta oportunidad no se estanque.</div>}
      <div className="split">
        <div>
          <div className="card"><dl className="kv">
            <dt>Empresa</dt><dd>{o.companyId ? <Link prefetch={false} href={`/companies/${o.companyId}`}>{row.company}</Link> : "—"}</dd>
            <dt>Contacto</dt><dd>{o.contactId ? <Link prefetch={false} href={`/contacts/${o.contactId}`}>{contactName || "contacto"}</Link> : "—"}</dd>
            <dt>Cierre esperado</dt><dd>{formatDate(o.expectedCloseDate)}</dd><dt>Propietario</dt><dd>{row.owner ?? "Sin asignar"}</dd></dl></div>
          {canWrite && (
            <div className="card"><h2>Mover de etapa</h2>
              <ActionForm action={moveOpportunity} submit="Mover" className="row">
                <input type="hidden" name="id" value={id} />
                <Field label="Etapa" name="stageId" defaultValue={o.stageId} options={stages.map((s) => ({ value: s.id, label: s.name }))} />
              </ActionForm></div>
          )}
        </div>
        <ActivityPanel target={{ opportunityId: id }} timeline={timeline} tasks={tasks} today={todayISO()} canWrite={canWrite} canDelete={can(user.role, "delete")} users={allUsers} currentUserId={user.id} />
      </div>
    </>
  );
}
