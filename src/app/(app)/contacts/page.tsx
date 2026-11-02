import Link from "next/link";
import { Empty, Pager } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";
import { requireUser } from "@/lib/auth";
import { resolveFilters, type RawParams } from "@/lib/filters";
import { can } from "@/lib/permissions";
import { companyOptions, listContacts, listUsers, viewsFor } from "@/lib/queries";

export const metadata = { title: "Contacts · Personal CRM" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireUser();
  const { filters, viewId } = await resolveFilters("contacts", await searchParams, ["q", "owner", "company"]);
  const [{ rows, total, page }, users, companies, views] = await Promise.all([listContacts(filters), listUsers(), companyOptions(), viewsFor("contacts", user.id)]);
  const filtered = Object.entries(filters).some(([k, v]) => v && k !== "page");
  return (
    <>
      <div className="page-head">
        <div><h1>Contacts</h1></div>
        {can(user.role, "write") && <Link prefetch={false} className="btn primary" href="/contacts/new">New contact</Link>}
      </div>
      <FilterBar entity="contacts" path="/contacts" filters={filters} views={views} activeViewId={viewId} user={user}
        fields={[
          { name: "q", label: "Search" },
          { name: "owner", label: "Owner", options: [{ value: "", label: "Anyone" }, { value: "none", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))] },
          { name: "company", label: "Company", options: [{ value: "", label: "Any" }, ...companies.map((c) => ({ value: c.id, label: c.name }))] },
        ]} />
      <div className="card tablewrap">
        {rows.length === 0 ? (
          <Empty title={filtered ? "No contacts match these filters" : "No contacts yet"} action={!filtered && can(user.role, "write") && <><Link prefetch={false} className="btn primary" href="/contacts/new">Add a contact</Link>{" "}<Link prefetch={false} className="btn" href="/data">Import a CSV</Link></>}>
            {filtered ? "Try clearing a filter." : "Add your first contact or import them from a CSV."}
          </Empty>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Owner</th></tr></thead>
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
