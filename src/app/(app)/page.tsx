import { STAGE_KIND_ES, TYPE_ES } from "@/lib/i18n";
import Link from "next/link";
import { Empty } from "@/components/ui";
import { TaskItem } from "@/components/TaskItem";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatMoney } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { dashboard } from "@/lib/queries";

export const metadata = { title: "Hoy · CRM Personal" };

export default async function Today({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireUser();
  const { scope } = await searchParams;
  const mine = scope !== "all";
  const d = await dashboard(mine ? user.id : null);
  const canWrite = can(user.role, "write");
  const nothing = !d.overdue.length && !d.dueToday.length && !d.upcoming.length && !d.needsAttention.length;
  const taskList = (rows: typeof d.overdue) => rows.map((t) => <TaskItem key={t.id} t={t} today={d.today} canWrite={canWrite} />);
  return (
    <>
      <div className="page-head">
        <div><h1>Hoy</h1><p className="muted">Tus próximas acciones, en el orden en que necesitan atención.</p></div>
        <div className="chips">
          <Link prefetch={false} href="/" className={`chip${mine ? " on" : ""}`}>Mías</Link>
          <Link prefetch={false} href="/?scope=all" className={`chip${!mine ? " on" : ""}`}>Todos</Link>
        </div>
      </div>

      {nothing && (
        <div className="card"><Empty title="Estás al día" action={canWrite && <Link prefetch={false} className="btn primary" href="/tasks">Agregar una tarea</Link>}>No hay tareas vencidas ni próximas, y cada oportunidad abierta tiene un siguiente paso.</Empty></div>
      )}

      {d.overdue.length > 0 && <div className="card"><h2>Vencidas <span className="badge bad">{d.overdue.length}</span></h2>{taskList(d.overdue)}</div>}
      {d.dueToday.length > 0 && <div className="card"><h2>Vencen hoy <span className="badge warn">{d.dueToday.length}</span></h2>{taskList(d.dueToday)}</div>}
      <div className="grid2">
        {d.upcoming.length > 0 && <div className="card"><h2>Próximos 7 días</h2>{taskList(d.upcoming)}</div>}
        {d.needsAttention.length > 0 && (
          <div className="card">
            <h2>Oportunidades que necesitan un siguiente paso <span className="badge">{d.needsAttention.length}</span></h2>
            {d.needsAttention.map((o) => (
              <div className="task" key={o.id}>
                <div className="grow">
                  <Link prefetch={false} href={`/opportunities/${o.id}`}>{o.name}</Link>
                  <div className="small muted">{[o.companyName, o.stageName, formatMoney(o.valueCents)].filter(Boolean).join(" · ")}</div>
                  <div className="small">{o.reasons.map((r) => <span key={r} className="badge warn" style={{ marginRight: 4 }}>{r}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Embudo</h2>
          {d.stages.every((s) => s.n === 0) ? <p className="muted small">Aún no hay oportunidades. <Link prefetch={false} href="/opportunities/new">Crea una</Link>.</p> : (
            <table><tbody>{d.stages.map((s) => (
              <tr key={s.id}><td>{s.name}{s.kind !== "open" && <span className={`badge ${s.kind === "won" ? "good" : "bad"}`} style={{ marginLeft: 6 }}>{STAGE_KIND_ES[s.kind]}</span>}</td><td className="right">{s.n}</td><td className="right nowrap">{formatMoney(s.total)}</td></tr>
            ))}</tbody></table>
          )}
        </div>
        <div className="card">
          <h2>Interacciones recientes</h2>
          {d.recent.length === 0 ? <p className="muted small">Aún no hay nada registrado. Registra un correo o reunión desde la página de un contacto.</p> : d.recent.map((r) => (
            <div className="task" key={r.id}><div className="grow"><b>{r.subject}</b><div className="small muted">{TYPE_ES[r.type]} · {formatDateTime(r.occurredAt)}{r.contactName && <> · <Link prefetch={false} href={`/contacts/${r.contactId}`}>{r.contactName}</Link></>}</div></div></div>
          ))}
        </div>
      </div>
    </>
  );
}
