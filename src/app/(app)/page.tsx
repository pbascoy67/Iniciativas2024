import Link from "next/link";
import { Empty } from "@/components/ui";
import { TaskItem } from "@/components/TaskItem";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatMoney } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { dashboard } from "@/lib/queries";

export const metadata = { title: "Today · Personal CRM" };

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
        <div><h1>Today</h1><p className="muted">Your next actions, in the order they need attention.</p></div>
        <div className="chips">
          <Link prefetch={false} href="/" className={`chip${mine ? " on" : ""}`}>Mine</Link>
          <Link prefetch={false} href="/?scope=all" className={`chip${!mine ? " on" : ""}`}>Everyone</Link>
        </div>
      </div>

      {nothing && (
        <div className="card"><Empty title="You're all caught up" action={canWrite && <Link prefetch={false} className="btn primary" href="/tasks">Add a task</Link>}>No overdue or upcoming tasks, and every open deal has a next step.</Empty></div>
      )}

      {d.overdue.length > 0 && <div className="card"><h2>Overdue <span className="badge bad">{d.overdue.length}</span></h2>{taskList(d.overdue)}</div>}
      {d.dueToday.length > 0 && <div className="card"><h2>Due today <span className="badge warn">{d.dueToday.length}</span></h2>{taskList(d.dueToday)}</div>}
      <div className="grid2">
        {d.upcoming.length > 0 && <div className="card"><h2>Next 7 days</h2>{taskList(d.upcoming)}</div>}
        {d.needsAttention.length > 0 && (
          <div className="card">
            <h2>Deals needing a next step <span className="badge">{d.needsAttention.length}</span></h2>
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
          <h2>Pipeline</h2>
          {d.stages.every((s) => s.n === 0) ? <p className="muted small">No opportunities yet. <Link prefetch={false} href="/opportunities/new">Create one</Link>.</p> : (
            <table><tbody>{d.stages.map((s) => (
              <tr key={s.id}><td>{s.name}{s.kind !== "open" && <span className={`badge ${s.kind === "won" ? "good" : "bad"}`} style={{ marginLeft: 6 }}>{s.kind}</span>}</td><td className="right">{s.n}</td><td className="right nowrap">{formatMoney(s.total)}</td></tr>
            ))}</tbody></table>
          )}
        </div>
        <div className="card">
          <h2>Recent interactions</h2>
          {d.recent.length === 0 ? <p className="muted small">Nothing logged yet. Log an email or meeting from a contact page.</p> : d.recent.map((r) => (
            <div className="task" key={r.id}><div className="grow"><b>{r.subject}</b><div className="small muted">{r.type} · {formatDateTime(r.occurredAt)}{r.contactName && <> · <Link prefetch={false} href={`/contacts/${r.contactId}`}>{r.contactName}</Link></>}</div></div></div>
          ))}
        </div>
      </div>
    </>
  );
}
