import Link from "next/link";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Settings · Personal CRM" };

export default async function Settings() {
  const user = await requireUser();
  if (!can(user.role, "manageStages") && !can(user.role, "manageUsers")) return <Forbidden what="settings" />;
  return (
    <>
      <h1>Settings</h1>
      <div className="grid2">
        <Link prefetch={false} className="card" href="/settings/pipeline"><h2>Pipeline stages</h2><span className="muted">Rename, reorder, add or remove stages.</span></Link>
        <Link prefetch={false} className="card" href="/settings/users"><h2>Users &amp; roles</h2><span className="muted">Add local users and set what they can do.</span></Link>
        <Link prefetch={false} className="card" href="/settings/backups"><h2>Backups</h2><span className="muted">Create and download database backups.</span></Link>
        <Link prefetch={false} className="card" href="/settings/activity"><h2>Activity log</h2><span className="muted">Immutable record of every change.</span></Link>
      </div>
      <div className="card"><h2>Role permissions</h2>
        <table><thead><tr><th>Role</th><th>Can</th></tr></thead><tbody>
          {Object.entries(ROLE_PERMISSIONS).reverse().map(([role, perms]) => <tr key={role}><td><b>{role}</b></td><td>{perms.join(", ")}</td></tr>)}
        </tbody></table></div>
    </>
  );
}
