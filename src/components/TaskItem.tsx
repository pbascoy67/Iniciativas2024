import Link from "next/link";
import { deleteTask, toggleTask } from "@/app/actions/activities";
import { formatDate } from "@/lib/dates";
import type { TaskRow } from "@/lib/queries";
import { ActionForm } from "./form";

export function TaskItem({ t, today, canWrite, canDelete, showRelated = true }: { t: TaskRow; today: string; canWrite: boolean; canDelete?: boolean; showRelated?: boolean }) {
  const done = !!t.completedAt;
  const overdue = !done && t.dueDate && t.dueDate < today;
  const related = t.opportunityId ? { href: `/opportunities/${t.opportunityId}`, label: t.opportunityName } : t.contactId ? { href: `/contacts/${t.contactId}`, label: t.contactName } : t.companyId ? { href: `/companies/${t.companyId}`, label: t.companyName } : null;
  return (
    <div className={`task${done ? " done" : ""}`}>
      {canWrite && (
        <ActionForm action={toggleTask} inline submit={done ? "Reabrir" : "✓ Hecha"} submitClass="sm" hideMessage>
          <input type="hidden" name="id" value={t.id} />
        </ActionForm>
      )}
      <div className="grow">
        <div className="t">{t.title}</div>
        <div className="small muted">
          {showRelated && related?.label && <><Link prefetch={false} href={related.href}>{related.label}</Link> · </>}
          {t.ownerName ?? "Sin asignar"}
        </div>
      </div>
      {t.dueDate && <span className={`badge${overdue ? " bad" : t.dueDate === today && !done ? " warn" : ""}`}>{overdue ? "Vencida · " : t.dueDate === today ? "Hoy · " : ""}{formatDate(t.dueDate)}</span>}
      {canDelete && (
        <ActionForm action={deleteTask} inline submit="Eliminar" submitClass="sm danger" confirm="¿Eliminar esta tarea?" hideMessage>
          <input type="hidden" name="id" value={t.id} />
        </ActionForm>
      )}
    </div>
  );
}
