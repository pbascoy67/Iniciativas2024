import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { ActionForm, Field } from "@/components/form";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Iniciar sesión · CRM Personal" };

export default async function LoginPage() {
  const user = await getUser().catch(() => null);
  if (user) redirect("/");
  return (
    <div className="login card">
      <h1>CRM Personal</h1>
      <p className="muted">Inicia sesión con un usuario local. Tus datos permanecen en esta máquina.</p>
      <ActionForm action={login} submit="Iniciar sesión">
        <Field label="Correo" name="email" type="email" required />
        <Field label="Contraseña" name="password" type="password" required />
      </ActionForm>
    </div>
  );
}
