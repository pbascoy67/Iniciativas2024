import { ROLE_ES, PERM_ES } from "@/lib/i18n";
import Link from "next/link";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Configuración · CRM Personal" };

export default async function Settings() {
  const user = await requireUser();
  if (!can(user.role, "manageStages") && !can(user.role, "manageUsers")) return <Forbidden what="la configuración" />;
  return (
    <>
      <h1>Configuración</h1>
      <div className="grid2">
        <Link prefetch={false} className="card" href="/settings/pipeline"><h2>Etapas del embudo</h2><span className="muted">Renombra, reordena, agrega o elimina etapas.</span></Link>
        <Link prefetch={false} className="card" href="/settings/users"><h2>Usuarios y roles</h2><span className="muted">Agrega usuarios locales y define qué pueden hacer.</span></Link>
        <Link prefetch={false} className="card" href="/settings/backups"><h2>Copias de seguridad</h2><span className="muted">Crea y descarga copias de seguridad de la base de datos.</span></Link>
        <Link prefetch={false} className="card" href="/settings/activity"><h2>Registro de actividad</h2><span className="muted">Registro inmutable de cada cambio.</span></Link>
      </div>
      <div className="card"><h2>Permisos por rol</h2>
        <table><thead><tr><th>Rol</th><th>Puede</th></tr></thead><tbody>
          {Object.entries(ROLE_PERMISSIONS).reverse().map(([role, perms]) => <tr key={role}><td><b>{ROLE_ES[role as keyof typeof ROLE_ES]}</b></td><td>{perms.map((p) => PERM_ES[p]).join(", ")}</td></tr>)}
        </tbody></table></div>
    </>
  );
}
