import { createUser, resetPassword, updateUser } from "@/app/actions/admin";
import { ActionForm, Field } from "@/components/form";
import { BackLink } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listUsers } from "@/lib/queries";

const ROLES = [{ value: "admin", label: "Admin" }, { value: "member", label: "Member" }, { value: "viewer", label: "Viewer (read-only)" }];

export default async function UsersSettings() {
  const user = await requireUser();
  if (!can(user.role, "manageUsers")) return <Forbidden what="user management" />;
  const users = await listUsers(true);
  return (
    <>
      <BackLink href="/settings">Settings</BackLink>
      <h1>Users &amp; roles</h1>
      <p className="muted">Users are local to this installation. There is no sign-up and no external account; admins create everyone here.</p>
      {users.map((u) => (
        <div className="card" key={u.id}>
          <div className="row" style={{ alignItems: "center" }}><b>{u.name}</b><span className="muted">{u.email}</span>{!u.active && <span className="badge bad">deactivated</span>}{u.id === user.id && <span className="badge">you</span>}</div>
          <ActionForm action={updateUser} submit="Save" className="row" >
            <input type="hidden" name="id" value={u.id} />
            <Field label="Role" name="role" defaultValue={u.role} options={ROLES} />
            <label className="f" style={{ flex: "0 0 auto" }}><span className="ctl"><input type="checkbox" name="active" defaultChecked={u.active} /> Active</span></label>
          </ActionForm>
          <details><summary className="small">Reset password</summary>
            <ActionForm action={resetPassword} submit="Set new password" className="row">
              <input type="hidden" name="id" value={u.id} /><Field label="New password (12+ characters)" name="password" type="password" required />
            </ActionForm></details>
        </div>
      ))}
      <div className="card"><h2>Add a user</h2>
        <ActionForm action={createUser} submit="Create user">
          <div className="row"><Field label="Name" name="name" required /><Field label="Email" name="email" type="email" required /></div>
          <div style={{ height: ".75rem" }} />
          <div className="row"><Field label="Role" name="role" defaultValue="member" options={ROLES} /><Field label="Password (12+ characters)" name="password" type="password" required /></div>
        </ActionForm></div>
    </>
  );
}
