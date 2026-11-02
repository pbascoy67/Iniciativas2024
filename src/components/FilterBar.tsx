import Link from "next/link";
import { deleteView, saveView } from "@/app/actions/admin";
import type { SessionUser } from "@/lib/auth";
import type { Filters } from "@/lib/queries";
import { ActionForm, Field } from "./form";

export interface FilterField {
  name: string;
  label: string;
  options?: { value: string; label: string }[];
}

export function FilterBar({
  entity, path, fields, filters, views, activeViewId, user,
}: {
  entity: "contacts" | "companies" | "opportunities" | "tasks"; path: string; fields: FilterField[]; filters: Filters;
  views: { id: string; name: string; shared: boolean; ownerId: string | null }[]; activeViewId: string | null; user: SessionUser;
}) {
  const active = Object.entries(filters).filter(([k, v]) => v && k !== "page");
  const activeView = views.find((v) => v.id === activeViewId);
  return (
    <div className="card">
      <form method="get" action={path} className="row">
        {fields.map((f) => (
          <label className="f" key={f.name}>
            {f.label}
            <span className="ctl">
              {f.options ? (
                <select name={f.name} defaultValue={filters[f.name] ?? ""}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input name={f.name} defaultValue={filters[f.name] ?? ""} />
              )}
            </span>
          </label>
        ))}
        <button type="submit" className="primary">Apply</button>
        {active.length > 0 && <Link prefetch={false} className="btn" href={path}>Clear</Link>}
      </form>
      {(views.length > 0 || active.length > 0) && (
        <div style={{ marginTop: ".75rem" }}>
          <div className="chips" aria-label="Saved views">
            {views.map((v) => (
              <Link prefetch={false} key={v.id} href={`${path}?view=${v.id}`} className={`chip${v.id === activeViewId ? " on" : ""}`}>
                {v.name}{v.shared ? " (shared)" : ""}
              </Link>
            ))}
          </div>
          {activeView && (activeView.ownerId === user.id || user.role === "admin") && (
            <ActionForm action={deleteView} inline submit="Delete this view" submitClass="sm danger" confirm={`Delete the saved view "${activeView.name}"?`}>
              <input type="hidden" name="id" value={activeView.id} />
              <input type="hidden" name="entity" value={entity} />
            </ActionForm>
          )}
          {active.length > 0 && !activeViewId && (
            <details>
              <summary className="small">Save these filters as a view</summary>
              <ActionForm action={saveView} submit="Save view" className="row">
                <input type="hidden" name="entity" value={entity} />
                {active.map(([k, v]) => <input key={k} type="hidden" name={`f_${k}`} value={v} />)}
                <Field label="View name" name="name" required maxLength={60} />
                {user.role === "admin" && <label className="small"><input type="checkbox" name="shared" /> Share with everyone</label>}
              </ActionForm>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
