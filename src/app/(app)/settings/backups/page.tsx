import { makeBackup } from "@/app/actions/admin";
import { ActionForm } from "@/components/form";
import { BackLink } from "@/components/forms";
import { Empty, Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { backupDir, listBackups } from "@/lib/backup";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";

export const metadata = { title: "Backups · Personal CRM" };

export default async function BackupsSettings() {
  const user = await requireUser();
  if (!can(user.role, "backup")) return <Forbidden what="backups" />;
  const backups = listBackups();
  return (
    <>
      <BackLink href="/settings">Settings</BackLink>
      <h1>Backups</h1>
      <p className="muted">Stored on this machine in <code>{backupDir()}</code>. The docker compose <code>backup</code> service also creates one automatically on a schedule. To restore, use the command in the README (it replaces the current data, so it is intentionally not a button).</p>
      <div className="card"><ActionForm action={makeBackup} submit="Create backup now" /></div>
      <div className="card tablewrap">
        {backups.length === 0 ? <Empty title="No backups yet">Create one now, or wait for the scheduled backup.</Empty> : (
          <table><thead><tr><th>File</th><th>Created</th><th>Size</th><th /></tr></thead><tbody>
            {backups.map((b) => <tr key={b.file}><td><code>{b.file}</code></td><td>{formatDateTime(b.modified)}</td><td>{(b.bytes / 1024).toFixed(0)} KB</td><td><a className="btn sm" href={`/api/backups/${b.file}`} download>Download</a></td></tr>)}
          </tbody></table>
        )}
      </div>
    </>
  );
}
