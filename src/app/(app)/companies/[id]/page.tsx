import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteCompany } from "@/app/actions/companies";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ActionForm } from "@/components/form";
import { BackLink } from "@/components/forms";
import { companies, contacts, db, opportunities, pipelineStages, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatMoney, todayISO } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listUsers, tasksFor, timelineFor } from "@/lib/queries";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db.select({ c: companies, owner: users.name }).from(companies).leftJoin(users, eq(users.id, companies.ownerId)).where(eq(companies.id, id));
  if (!row) notFound();
  const { c } = row;
  const [timeline, tasks, allUsers, people, opps] = await Promise.all([
    timelineFor({ companyId: id }), tasksFor({ companyId: id }), listUsers(),
    db.select().from(contacts).where(eq(contacts.companyId, id)),
    db.select({ id: opportunities.id, name: opportunities.name, valueCents: opportunities.valueCents, stage: pipelineStages.name }).from(opportunities)
      .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId)).where(eq(opportunities.companyId, id)),
  ]);
  const canWrite = can(user.role, "write");
  return (
    <>
      <BackLink href="/companies">Empresas</BackLink>
      <div className="page-head">
        <div><h1>{c.name}</h1><p className="muted">{c.industry}</p></div>
        <div className="row">
          {canWrite && <Link prefetch={false} className="btn" href={`/companies/${id}/edit`}>Editar</Link>}
          {canWrite && <Link prefetch={false} className="btn" href={`/contacts/new?company=${id}`}>Agregar contacto</Link>}
          {canWrite && <Link prefetch={false} className="btn" href={`/opportunities/new?company=${id}`}>Nueva oportunidad</Link>}
          {can(user.role, "delete") && <ActionForm action={deleteCompany} inline submit="Eliminar" submitClass="danger" confirm="¿Eliminar esta empresa? Sus contactos se conservan pero quedan desvinculados; sus notas, tareas e interacciones se eliminan.">
            <input type="hidden" name="id" value={id} /></ActionForm>}
        </div>
      </div>
      <div className="split">
        <div>
          <div className="card"><dl className="kv">
            <dt>Sitio web</dt><dd>{c.website ?? "—"}</dd><dt>Dominio</dt><dd>{c.domain ?? "—"}</dd><dt>Teléfono</dt><dd>{c.phone ?? "—"}</dd>
            <dt>Dirección</dt><dd>{c.address ?? "—"}</dd><dt>Propietario</dt><dd>{row.owner ?? "Sin asignar"}</dd></dl></div>
          <div className="card"><h2>Personas</h2>
            {people.length === 0 ? <p className="muted small">Aún no hay contactos vinculados.</p> : people.map((p) => (
              <div key={p.id} className="task"><div className="grow"><Link prefetch={false} href={`/contacts/${p.id}`}>{[p.firstName, p.lastName].join(" ").trim() || p.email}</Link><div className="small muted">{p.jobTitle ?? p.email}</div></div></div>))}
          </div>
          <div className="card"><h2>Oportunidades</h2>
            {opps.length === 0 ? <p className="muted small">Ninguna todavía.</p> : opps.map((o) => (
              <div key={o.id} className="task"><div className="grow"><Link prefetch={false} href={`/opportunities/${o.id}`}>{o.name}</Link><div className="small muted">{o.stage} · {formatMoney(o.valueCents)}</div></div></div>))}
          </div>
        </div>
        <ActivityPanel target={{ companyId: id }} timeline={timeline} tasks={tasks} today={todayISO()} canWrite={canWrite} canDelete={can(user.role, "delete")} users={allUsers} currentUserId={user.id} />
      </div>
    </>
  );
}
