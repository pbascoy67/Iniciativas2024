import { addTask } from "@/app/actions/activities";
import { ActionForm, Field } from "@/components/form";
import { FilterBar } from "@/components/FilterBar";
import { TaskItem } from "@/components/TaskItem";
import { Empty } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { resolveFilters, type RawParams } from "@/lib/filters";
import { can } from "@/lib/permissions";
import { listTasks, listUsers, viewsFor } from "@/lib/queries";

export const metadata = { title: "Tareas · CRM Personal" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireUser();
  const { filters, viewId } = await resolveFilters("tasks", await searchParams, ["q", "owner", "status"]);
  const [tasks, users, views] = await Promise.all([listTasks(filters), listUsers(), viewsFor("tasks", user.id)]);
  const canWrite = can(user.role, "write");
  return (
    <>
      <div className="page-head"><h1>Tareas</h1></div>
      {canWrite && (
        <div className="card">
          <ActionForm action={addTask} submit="Agregar tarea" className="row">
            <Field label="Nueva tarea" name="title" required maxLength={300} />
            <Field label="Vence" name="dueDate" type="date" />
            <Field label="Propietario" name="ownerId" defaultValue={user.id} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </ActionForm>
        </div>
      )}
      <FilterBar entity="tasks" path="/tasks" filters={filters} views={views} activeViewId={viewId} user={user}
        fields={[{ name: "q", label: "Buscar" },
          { name: "status", label: "Estado", options: [{ value: "open", label: "Abiertas" }, { value: "overdue", label: "Vencidas" }, { value: "today", label: "Vencen hoy" }, { value: "done", label: "Completadas" }] },
          { name: "owner", label: "Propietario", options: [{ value: "", label: "Cualquiera" }, { value: "none", label: "Sin asignar" }, ...users.map((u) => ({ value: u.id, label: u.name }))] }]} />
      <div className="card">
        {tasks.length === 0 ? <Empty title="No hay tareas aquí">Nada coincide. Agrega una tarea arriba o cambia el filtro de estado.</Empty>
          : tasks.map((t) => <TaskItem key={t.id} t={t} today={todayISO()} canWrite={canWrite} canDelete={can(user.role, "delete")} />)}
      </div>
    </>
  );
}
