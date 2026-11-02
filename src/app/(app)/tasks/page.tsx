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

export const metadata = { title: "Tasks · Personal CRM" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireUser();
  const { filters, viewId } = await resolveFilters("tasks", await searchParams, ["q", "owner", "status"]);
  const [tasks, users, views] = await Promise.all([listTasks(filters), listUsers(), viewsFor("tasks", user.id)]);
  const canWrite = can(user.role, "write");
  return (
    <>
      <div className="page-head"><h1>Tasks</h1></div>
      {canWrite && (
        <div className="card">
          <ActionForm action={addTask} submit="Add task" className="row">
            <Field label="New task" name="title" required maxLength={300} />
            <Field label="Due" name="dueDate" type="date" />
            <Field label="Owner" name="ownerId" defaultValue={user.id} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </ActionForm>
        </div>
      )}
      <FilterBar entity="tasks" path="/tasks" filters={filters} views={views} activeViewId={viewId} user={user}
        fields={[{ name: "q", label: "Search" },
          { name: "status", label: "Status", options: [{ value: "open", label: "Open" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" }, { value: "done", label: "Completed" }] },
          { name: "owner", label: "Owner", options: [{ value: "", label: "Anyone" }, { value: "none", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))] }]} />
      <div className="card">
        {tasks.length === 0 ? <Empty title="No tasks here">Nothing matches. Add a task above, or change the status filter.</Empty>
          : tasks.map((t) => <TaskItem key={t.id} t={t} today={todayISO()} canWrite={canWrite} canDelete={can(user.role, "delete")} />)}
      </div>
    </>
  );
}
