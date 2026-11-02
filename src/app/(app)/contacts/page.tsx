import Link from "next/link";
import { Empty, Pager } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";
import { requireUser } from "@/lib/auth";
import { resolveFilters, type RawParams } from "@/lib/filters";
import { can } from "@/lib/permissions";
import { companyOptions, listContacts, listUsers, viewsFor } from "@/lib/queries";

export const metadata = { title: "Contactos · CRM Personal" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireUser();
  const { filters, viewId } = await resolveFilters("contacts", await searchParams, ["q", "owner", "company"]);
  const [{ rows, total, page }, users, companies, views] = await Promise.all([listContacts(filters), listUsers(), companyOptions(), viewsFor("contacts", user.id)]);
  const filtered = Object.entries(filters).some(([k, v]) => v && k !== "page");
  return (
    <>
      <div className="page-head">
        <div><h1>Contactos</h1></div>
        {can(user.role, "write") && <Link prefetch={false} className="btn primary" href="/contacts/new">Nuevo contacto</Link>}
      </div>
      <FilterBar entity="contacts" path="/contacts" filters={filters} views={views} activeViewId={viewId} user={user}
        fields={[
          { name: "q", label: "Buscar" },
          { name: "owner", label: "Propietario", options: [{ value: "", label: "Cualquiera" }, { value: "none", label: "Sin asignar" }, ...users.map((u) => ({ value: u.id, label: u.name }))] },
          { name: "company", label: "Empresa", options: [{ value: "", label: "Cualquiera" }, ...companies.map((c) => ({ value: c.id, label: c.name }))] },
        ]} />
      <div className="card tablewrap">
        {rows.length === 0 ? (
          <Empty title={filtered ? "Ningún contacto coincide con estos filtros" : "Aún no hay contactos"} action={!filtered && can(user.role, "write") && <><Link prefetch={false} className="btn primary" href="/contacts/new">Agregar un contacto</Link>{" "}<Link prefetch={false} className="btn" href="/data">Importar un CSV</Link></>}>
            {filtered ? "Prueba quitando un filtro." : "Agrega tu primer contacto o impórtalos desde un CSV."}
          </Empty>
        ) : (
          <table>
            <thead><tr><th>Nombre</th><th>Empresa</th><th>Correo</th><th>Teléfono</th><th>Propietario</th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id}>
                <td><Link prefetch={false} href={`/contacts/${c.id}`}>{c.name || c.email || "(unnamed)"}</Link>{c.jobTitle && <div className="small muted">{c.jobTitle}</div>}</td>
                <td>{c.companyId ? <Link prefetch={false} href={`/companies/${c.companyId}`}>{c.companyName}</Link> : "—"}</td>
                <td>{c.email ?? "—"}</td><td>{c.phone ?? "—"}</td><td>{c.ownerName ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <Pager path="/contacts" params={filters} page={page} total={total} />
    </>
  );
}
