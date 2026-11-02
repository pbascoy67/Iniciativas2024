import { makeBackup } from "@/app/actions/admin";
import { ActionForm } from "@/components/form";
import { BackLink } from "@/components/forms";
import { Empty, Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { backupDir, listBackups } from "@/lib/backup";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";

export const metadata = { title: "Copias de seguridad · CRM Personal" };

export default async function BackupsSettings() {
  const user = await requireUser();
  if (!can(user.role, "backup")) return <Forbidden what="las copias de seguridad" />;
  const backups = listBackups();
  return (
    <>
      <BackLink href="/settings">Configuración</BackLink>
      <h1>Copias de seguridad</h1>
      <p className="muted">Guardadas en esta máquina en <code>{backupDir()}</code>. El servicio <code>backup</code> de docker compose también crea una automáticamente según un calendario. Para restaurar, usa el comando del README (reemplaza los datos actuales, por eso no es un botón).</p>
      <div className="card"><ActionForm action={makeBackup} submit="Crear copia ahora" /></div>
      <div className="card tablewrap">
        {backups.length === 0 ? <Empty title="Aún no hay copias de seguridad">Crea una ahora o espera a la copia programada.</Empty> : (
          <table><thead><tr><th>Archivo</th><th>Creada</th><th>Tamaño</th><th /></tr></thead><tbody>
            {backups.map((b) => <tr key={b.file}><td><code>{b.file}</code></td><td>{formatDateTime(b.modified)}</td><td>{(b.bytes / 1024).toFixed(0)} KB</td><td><a className="btn sm" href={`/api/backups/${b.file}`} download>Descargar</a></td></tr>)}
          </tbody></table>
        )}
      </div>
    </>
  );
}
