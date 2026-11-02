import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { ActionForm, Field } from "@/components/form";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Personal CRM" };

export default async function LoginPage() {
  const user = await getUser().catch(() => null);
  if (user) redirect("/");
  return (
    <div className="login card">
      <h1>Personal CRM</h1>
      <p className="muted">Sign in with a local user. Your data stays on this machine.</p>
      <ActionForm action={login} submit="Sign in">
        <Field label="Email" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required />
      </ActionForm>
    </div>
  );
}
