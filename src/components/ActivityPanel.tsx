import { addNote, addTask, logInteraction } from "@/app/actions/activities";
import { formatDateTime, tz } from "@/lib/dates";
import type { TaskRow } from "@/lib/queries";
import type { TimelineItem } from "@/lib/timeline";
import { ActionForm, Field } from "./form";
import { Empty } from "./ui";
import { TaskItem } from "./TaskItem";

const ICON: Record<TimelineItem["kind"], string> = { email: "✉", meeting: "👥", call: "☎", note: "📝", task: "✓", stage: "➜" };

function Hidden({ target }: { target: Record<string, string | undefined> }) {
  return <>{Object.entries(target).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}</>;
}

const nowLocal = () => new Date().toLocaleString("sv-SE", { timeZone: tz() }).slice(0, 16).replace(" ", "T");

export function ActivityPanel({
  target, timeline, tasks, today, canWrite, canDelete, users, currentUserId,
}: {
  target: { contactId?: string; companyId?: string; opportunityId?: string }; timeline: TimelineItem[]; tasks: TaskRow[]; today: string;
  canWrite: boolean; canDelete: boolean; users: { id: string; name: string }[]; currentUserId: string;
}) {
  return (
    <div>
      {canWrite && (
        <div className="card">
          <details open>
            <summary>Add a note</summary>
            <ActionForm action={addNote} submit="Add note">
              <Hidden target={target} />
              <Field label="Note" name="body" rows={3} required maxLength={10000} />
            </ActionForm>
          </details>
          <details>
            <summary>Log an email, meeting or call</summary>
            <ActionForm action={logInteraction} submit="Log it">
              <Hidden target={target} />
              <div className="row">
                <Field label="Type" name="type" options={[{ value: "email", label: "Email" }, { value: "meeting", label: "Meeting" }, { value: "call", label: "Call" }]} defaultValue="email" />
                <Field label="When" name="occurredAt" type="datetime-local" defaultValue={nowLocal()} required />
              </div>
              <Field label="Subject" name="subject" required maxLength={200} />
              <Field label="Details (paste the email, or meeting notes)" name="body" rows={4} maxLength={10000} />
            </ActionForm>
          </details>
          <details>
            <summary>Add a task / next action</summary>
            <ActionForm action={addTask} submit="Add task">
              <Hidden target={target} />
              <Field label="What needs to happen?" name="title" required maxLength={300} />
              <div className="row">
                <Field label="Due" name="dueDate" type="date" />
                <Field label="Owner" name="ownerId" defaultValue={currentUserId} options={users.map((u) => ({ value: u.id, label: u.name }))} />
              </div>
            </ActionForm>
          </details>
        </div>
      )}
      <div className="card">
        <h2>Tasks</h2>
        {tasks.length === 0 ? <p className="muted small">No tasks yet. Add a next action so this doesn&apos;t go quiet.</p> : tasks.map((t) => <TaskItem key={t.id} t={t} today={today} canWrite={canWrite} canDelete={canDelete} showRelated={false} />)}
      </div>
      <div className="card">
        <h2>Timeline</h2>
        {timeline.length === 0 ? (
          <Empty title="Nothing logged yet">Notes, emails, meetings and calls will appear here, newest first.</Empty>
        ) : (
          <ol className="tl">
            {timeline.map((i) => (
              <li key={i.id}>
                <span className="ic" title={i.kind}>{ICON[i.kind]}</span>
                <div>
                  <div><b>{i.kind === "note" ? "Note" : i.title}</b>{" "}
                    <span className="muted small">{i.kind === "email" || i.kind === "meeting" || i.kind === "call" ? `${i.kind} · ` : ""}{formatDateTime(i.at)}{i.author ? ` · ${i.author}` : ""}</span>
                  </div>
                  {i.body && <pre>{i.body}</pre>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
