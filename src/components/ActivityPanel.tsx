import { addNote, addTask, logInteraction } from "@/app/actions/activities";
import { TYPE_ES } from "@/lib/i18n";
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
            <summary>Agregar una nota</summary>
            <ActionForm action={addNote} submit="Agregar nota">
              <Hidden target={target} />
              <Field label="Nota" name="body" rows={3} required maxLength={10000} />
            </ActionForm>
          </details>
          <details>
            <summary>Registrar un correo, reunión o llamada</summary>
            <ActionForm action={logInteraction} submit="Registrar">
              <Hidden target={target} />
              <div className="row">
                <Field label="Tipo" name="type" options={[{ value: "email", label: "Correo" }, { value: "meeting", label: "Reunión" }, { value: "call", label: "Llamada" }]} defaultValue="email" />
                <Field label="Cuándo" name="occurredAt" type="datetime-local" defaultValue={nowLocal()} required />
              </div>
              <Field label="Asunto" name="subject" required maxLength={200} />
              <Field label="Detalles (pega el correo o las notas de la reunión)" name="body" rows={4} maxLength={10000} />
            </ActionForm>
          </details>
          <details>
            <summary>Agregar una tarea / próxima acción</summary>
            <ActionForm action={addTask} submit="Agregar tarea">
              <Hidden target={target} />
              <Field label="¿Qué hay que hacer?" name="title" required maxLength={300} />
              <div className="row">
                <Field label="Vence" name="dueDate" type="date" />
                <Field label="Propietario" name="ownerId" defaultValue={currentUserId} options={users.map((u) => ({ value: u.id, label: u.name }))} />
              </div>
            </ActionForm>
          </details>
        </div>
      )}
      <div className="card">
        <h2>Tareas</h2>
        {tasks.length === 0 ? <p className="muted small">Aún no hay tareas. Agrega una próxima acción para que esto no se enfríe.</p> : tasks.map((t) => <TaskItem key={t.id} t={t} today={today} canWrite={canWrite} canDelete={canDelete} showRelated={false} />)}
      </div>
      <div className="card">
        <h2>Cronología</h2>
        {timeline.length === 0 ? (
          <Empty title="Aún no hay nada registrado">Las notas, correos, reuniones y llamadas aparecerán aquí, los más recientes primero.</Empty>
        ) : (
          <ol className="tl">
            {timeline.map((i) => (
              <li key={i.id}>
                <span className="ic" title={i.kind === "note" ? "nota" : i.kind === "task" ? "tarea" : i.kind === "stage" ? "etapa" : TYPE_ES[i.kind]}>{ICON[i.kind]}</span>
                <div>
                  <div><b>{i.kind === "note" ? "Nota" : i.title}</b>{" "}
                    <span className="muted small">{i.kind === "email" || i.kind === "meeting" || i.kind === "call" ? `${TYPE_ES[i.kind as keyof typeof TYPE_ES]} · ` : ""}{formatDateTime(i.at)}{i.author ? ` · ${i.author}` : ""}</span>
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
