import Link from "next/link";
import { Empty, Pager } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";
import { requireUser } from "@/lib/auth";
import { resolveFilters, type RawParams } from "@/lib/filters";
import { can } from "@/lib/permissions";
import { listCompanies, listUsers, viewsFor } from "@/lib/queries";

export const metadata = { title: "Empresas · CRM Personal" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireUser();
  const { filters, viewId } = await resolveFilters("companies", await searchParams, ["q", "owner", "industry"]);
  const [{ rows, total, page }, users, views] = await Promise.all([listCompanies(filters), listUsers(), viewsFor("companies", user.id)]);
  const filtered = Object.entries(filters).some(([k, v]) => v && k !== "page");
  return (
    <>
      <div className="page-head"><h1>Empresas</h1>{can(user.role, "write") && <Link prefetch={false} className="btn primary" href="/companies/new">Nueva empresa</Link>}</div>
      <FilterBar entity="companies" path="/companies" filters={filters} views={views} activeViewId={viewId} user={user}
        fields={[{ name: "q", label: "Buscar" }, { name: "industry", label: "Industria" },
          { name: "owner", label: "Propietario", options: [{ value: "", label: "Cualquiera" }, { value: "none", label: "Sin asignar" }, ...users.map((u) => ({ value: u.id, label: u.name }))] }]} />
      <div className="card tablewrap">
        {rows.length === 0 ? (
          <Empty title={filtered ? "Ninguna empresa coincide con estos filtros" : "Aún no hay empresas"} action={!filtered && can(user.role, "write") && <Link prefetch={false} className="btn primary" href="/companies/new">Agregar una empresa</Link>}>
            {filtered ? "Prueba quitando un filtro." : "Las empresas agrupan tus contactos y oportunidades."}
          </Empty>
        ) : (
          <table>
            <thead><tr><th>Nombre</th><th>Industria</th><th>Contactos</th><th>Oportunidades abiertas</th><th>Propietario</th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id}><td><Link prefetch={false} href={`/companies/${c.id}`}>{c.name}</Link>{c.domain && <div className="small muted">{c.domain}</div>}</td>
                <td>{c.industry ?? "—"}</td><td>{c.contactCount}</td><td>{c.openOpps}</td><td>{c.ownerName ?? "—"}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <Pager path="/companies" params={filters} page={page} total={total} />
    </>
  );
}
