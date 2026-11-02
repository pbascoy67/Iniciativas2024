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
      <BackLink href="/contacts">Contactos</BackLink>
      <div className="page-head">
        <div><h1>{name}</h1><p className="muted">{[c.jobTitle, row.company].filter(Boolean).join(" at ")}</p></div>
        <div className="row">
          {canWrite && <Link prefetch={false} className="btn" href={`/contacts/${id}/edit`}>Editar</Link>}
          {canWrite && <Link prefetch={false} className="btn" href={`/opportunities/new?contact=${id}`}>Nueva oportunidad</Link>}
          {can(user.role, "delete") && <ActionForm action={deleteContact} inline submit="Eliminar" submitClass="danger" confirm="¿Eliminar este contacto y sus notas, tareas e interacciones? Queda registrado en el registro de actividad.">
            <input type="hidden" name="id" value={id} /></ActionForm>}
        </div>
      </div>
      <div className="split">
        <div>
          <div className="card">
            <dl className="kv">
              <dt>Correo</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</dd>
              <dt>Teléfono</dt><dd>{c.phone ?? "—"}</dd>
              <dt>Empresa</dt><dd>{c.companyId ? <Link prefetch={false} href={`/companies/${c.companyId}`}>{row.company}</Link> : "—"}</dd>
              <dt>Propietario</dt><dd>{row.owner ?? "Sin asignar"}</dd>
            </dl>
          </div>
          <div className="card">
            <h2>Oportunidades</h2>
            {opps.length === 0 ? <p className="muted small">Ninguna todavía.</p> : opps.map((o) => (
              <div key={o.id} className="task"><div className="grow"><Link prefetch={false} href={`/opportunities/${o.id}`}>{o.name}</Link><div className="small muted">{o.stage} · {formatMoney(o.valueCents)}</div></div></div>
            ))}
          </div>
        </div>
        <ActivityPanel target={{ contactId: id }} timeline={timeline} tasks={tasks} today={todayISO()} canWrite={canWrite} canDelete={can(user.role, "delete")} users={allUsers} currentUserId={user.id} />
      </div>
    </>
  );
}
