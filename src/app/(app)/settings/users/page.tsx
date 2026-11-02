import { createUser, resetPassword, updateUser } from "@/app/actions/admin";
import { ActionForm, Field } from "@/components/form";
import { BackLink } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listUsers } from "@/lib/queries";

const ROLES = [{ value: "admin", label: "Administrador" }, { value: "member", label: "Miembro" }, { value: "viewer", label: "Solo lectura" }];

export default async function UsersSettings() {
  const user = await requireUser();
  if (!can(user.role, "manageUsers")) return <Forbidden what="la gestión de usuarios" />;
  const users = await listUsers(true);
  return (
    <>
      <BackLink href="/settings">Configuración</BackLink>
      <h1>Usuarios y roles</h1>
      <p className="muted">Los usuarios son locales a esta instalación. No hay registro ni cuentas externas; los administradores crean a todos aquí.</p>
      {users.map((u) => (
        <div className="card" key={u.id}>
          <div className="row" style={{ alignItems: "center" }}><b>{u.name}</b><span className="muted">{u.email}</span>{!u.active && <span className="badge bad">desactivado</span>}{u.id === user.id && <span className="badge">tú</span>}</div>
          <ActionForm action={updateUser} submit="Guardar" className="row" >
            <input type="hidden" name="id" value={u.id} />
            <Field label="Rol" name="role" defaultValue={u.role} options={ROLES} />
            <label className="f" style={{ flex: "0 0 auto" }}><span className="ctl"><input type="checkbox" name="active" defaultChecked={u.active} /> Activo</span></label>
          </ActionForm>
          <details><summary className="small">Restablecer contraseña</summary>
            <ActionForm action={resetPassword} submit="Establecer nueva contraseña" className="row">
              <input type="hidden" name="id" value={u.id} /><Field label="Nueva contraseña (12+ caracteres)" name="password" type="password" required />
            </ActionForm></details>
        </div>
      ))}
      <div className="card"><h2>Agregar un usuario</h2>
        <ActionForm action={createUser} submit="Crear usuario">
          <div className="row"><Field label="Nombre" name="name" required /><Field label="Correo" name="email" type="email" required /></div>
          <div style={{ height: ".75rem" }} />
          <div className="row"><Field label="Rol" name="role" defaultValue="member" options={ROLES} /><Field label="Contraseña (12+ caracteres)" name="password" type="password" required /></div>
        </ActionForm></div>
    </>
  );
}
