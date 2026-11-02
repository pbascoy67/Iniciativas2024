import Link from "next/link";
import { moveOpportunity } from "@/app/actions/opportunities";
import { ActionForm } from "@/components/form";
import { Empty } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, todayISO } from "@/lib/dates";
import { resolveFilters, type RawParams } from "@/lib/filters";
import { can } from "@/lib/permissions";
import { listOpportunities, listStages, listUsers, viewsFor } from "@/lib/queries";

export const metadata = { title: "Embudo · CRM Personal" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireUser();
  const { filters, viewId } = await resolveFilters("opportunities", await searchParams, ["q", "owner", "status"]);
  const [{ rows }, stages, users, views] = await Promise.all([listOpportunities(filters, { all: true }), listStages(), listUsers(), viewsFor("opportunities", user.id)]);
  const canWrite = can(user.role, "write");
  const today = todayISO();
  const visible = stages.filter((s) => !filters.status || s.kind === filters.status);
  return (
    <>
      <div className="page-head"><h1>Embudo</h1>{canWrite && <Link prefetch={false} className="btn primary" href="/opportunities/new">Nueva oportunidad</Link>}</div>
      <FilterBar entity="opportunities" path="/pipeline" filters={filters} views={views} activeViewId={viewId} user={user}
        fields={[{ name: "q", label: "Buscar" },
          { name: "status", label: "Estado", options: [{ value: "", label: "Todas" }, { value: "open", label: "Abiertas" }, { value: "won", label: "Ganadas" }, { value: "lost", label: "Perdidas" }] },
          { name: "owner", label: "Propietario", options: [{ value: "", label: "Cualquiera" }, { value: "none", label: "Sin asignar" }, ...users.map((u) => ({ value: u.id, label: u.name }))] }]} />
      {rows.length === 0 && !Object.values(filters).some(Boolean) ? (
        <div className="card"><Empty title="Aún no hay oportunidades" action={canWrite && <Link prefetch={false} className="btn primary" href="/opportunities/new">Crea tu primera oportunidad</Link>}>Sigue tus oportunidades a lo largo de las etapas. Puedes renombrar y reordenar las etapas en Configuración.</Empty></div>
      ) : (
        <div className="kanban">
          {visible.map((s, idx) => {
            const col = rows.filter((r) => r.stageId === s.id);
            const next = stages[stages.findIndex((x) => x.id === s.id) + 1];
            return (
              <section className="col" key={s.id} aria-label={s.name}>
                <h3><span>{s.name}</span><span className="muted small">{col.length} · {formatMoney(col.reduce((n, r) => n + r.valueCents, 0))}</span></h3>
                {col.length === 0 && <p className="muted small">Vacía</p>}
                {col.map((o) => (
                  <div className="opp" key={o.id}>
                    <Link prefetch={false} href={`/opportunities/${o.id}`}><b>{o.name}</b></Link>
                    <div className="small muted">{[o.companyName, formatMoney(o.valueCents)].filter(Boolean).join(" · ")}</div>
                    {o.stageKind === "open" && (o.nextTask
                      ? <div className="small">Siguiente: {o.nextTask}{o.nextTaskDue && <span className={`badge${o.nextTaskDue < today ? " bad" : ""}`} style={{ marginLeft: 4 }}>{formatDate(o.nextTaskDue)}</span>}</div>
                      : <div className="small"><span className="badge warn">Sin próxima acción</span></div>)}
                    {canWrite && next && (
                      <ActionForm action={moveOpportunity} inline submit={`→ ${next.name}`} submitClass="sm" hideMessage>
                        <input type="hidden" name="id" value={o.id} /><input type="hidden" name="stageId" value={next.id} />
                      </ActionForm>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
