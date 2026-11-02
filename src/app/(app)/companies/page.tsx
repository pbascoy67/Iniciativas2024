import Link from "next/link";
import { Empty, Pager } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";
import { requireUser } from "@/lib/auth";
import { resolveFilters, type RawParams } from "@/lib/filters";
import { can } from "@/lib/permissions";
import { listCompanies, listUsers, viewsFor } from "@/lib/queries";

export const metadata = { title: "Companies · Personal CRM" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireUser();
  const { filters, viewId } = await resolveFilters("companies", await searchParams, ["q", "owner", "industry"]);
  const [{ rows, total, page }, users, views] = await Promise.all([listCompanies(filters), listUsers(), viewsFor("companies", user.id)]);
  const filtered = Object.entries(filters).some(([k, v]) => v && k !== "page");
  return (
    <>
      <div className="page-head"><h1>Companies</h1>{can(user.role, "write") && <Link prefetch={false} className="btn primary" href="/companies/new">New company</Link>}</div>
      <FilterBar entity="companies" path="/companies" filters={filters} views={views} activeViewId={viewId} user={user}
        fields={[{ name: "q", label: "Search" }, { name: "industry", label: "Industry" },
          { name: "owner", label: "Owner", options: [{ value: "", label: "Anyone" }, { value: "none", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))] }]} />
      <div className="card tablewrap">
        {rows.length === 0 ? (
          <Empty title={filtered ? "No companies match these filters" : "No companies yet"} action={!filtered && can(user.role, "write") && <Link prefetch={false} className="btn primary" href="/companies/new">Add a company</Link>}>
            {filtered ? "Try clearing a filter." : "Companies group your contacts and deals."}
          </Empty>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Industry</th><th>Contacts</th><th>Open deals</th><th>Owner</th></tr></thead>
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
