import { ROLE_ES } from "@/lib/i18n";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { ActionForm } from "@/components/form";
import { Flash } from "@/components/Flash";
import { GlobalSearch } from "@/components/GlobalSearch";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav: [string, string][] = [["/", "Hoy"], ["/contacts", "Contactos"], ["/companies", "Empresas"], ["/pipeline", "Embudo"], ["/tasks", "Tareas"], ["/duplicates", "Duplicados"], ["/data", "Importar / Exportar"]];
  if (can(user.role, "manageStages") || can(user.role, "manageUsers")) nav.push(["/settings", "Configuración"]);
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">CRM Personal</div>
        <nav aria-label="Principal" style={{ display: "contents" }}>
          {nav.map(([href, label]) => <Link prefetch={false} key={href} href={href} className="nav">{label}</Link>)}
        </nav>
        <div className="grow" />
        <div className="who">{user.name}<br /><span className="muted">{ROLE_ES[user.role]}</span></div>
        <div style={{ margin: "0 .6rem" }}><ActionForm action={logout} submit="Cerrar sesión" submitClass="sm" hideMessage /></div>
      </aside>
      <main className="main">
        <div className="topbar"><GlobalSearch /></div>
        <Suspense><Flash /></Suspense>
        {children}
      </main>
    </div>
  );
}
