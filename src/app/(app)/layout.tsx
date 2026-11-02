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
  const nav: [string, string][] = [["/", "Today"], ["/contacts", "Contacts"], ["/companies", "Companies"], ["/pipeline", "Pipeline"], ["/tasks", "Tasks"], ["/duplicates", "Duplicates"], ["/data", "Import / Export"]];
  if (can(user.role, "manageStages") || can(user.role, "manageUsers")) nav.push(["/settings", "Settings"]);
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Personal CRM</div>
        <nav aria-label="Main" style={{ display: "contents" }}>
          {nav.map(([href, label]) => <Link prefetch={false} key={href} href={href} className="nav">{label}</Link>)}
        </nav>
        <div className="grow" />
        <div className="who">{user.name}<br /><span className="muted">{user.role}</span></div>
        <div style={{ margin: "0 .6rem" }}><ActionForm action={logout} submit="Sign out" submitClass="sm" hideMessage /></div>
      </aside>
      <main className="main">
        <div className="topbar"><GlobalSearch /></div>
        <Suspense><Flash /></Suspense>
        {children}
      </main>
    </div>
  );
}
