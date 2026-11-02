import Link from "next/link";
import { mergeCompanies } from "@/app/actions/companies";
import { mergeContacts } from "@/app/actions/contacts";
import { ActionForm } from "@/components/form";
import { Empty } from "@/components/ui";
import { companies, contacts, db } from "@/db";
import { requireUser } from "@/lib/auth";
import { findCompanyDuplicates, findContactDuplicates } from "@/lib/duplicates";
import { can } from "@/lib/permissions";

export const metadata = { title: "Duplicates · Personal CRM" };

export default async function DuplicatesPage() {
  const user = await requireUser();
  const canMerge = can(user.role, "merge");
  const [cts, cos] = await Promise.all([db.select().from(contacts), db.select().from(companies)]);
  const contactGroups = findContactDuplicates(cts);
  const companyGroups = findCompanyDuplicates(cos);
  const ctById = new Map(cts.map((c) => [c.id, c]));
  const coById = new Map(cos.map((c) => [c.id, c]));
  const coName = (id: string | null) => (id ? coById.get(id)?.name : null);
  return (
    <>
      <h1>Duplicates</h1>
      <p className="muted">Matches are suggestions based on email, phone, name + company, company name and web domain. Merging keeps the record you choose, fills its blanks from the others, and moves all notes, tasks, interactions and deals across. Every merge is written to the activity log.</p>
      {contactGroups.length + companyGroups.length === 0 && <div className="card"><Empty title="No duplicates found">Your contacts and companies look clean.</Empty></div>}
      {contactGroups.length > 0 && <h2>Contacts ({contactGroups.length})</h2>}
      {contactGroups.map((g) => (
        <div className="card" key={g.ids.join()}>
          <p className="small muted">Matched on: {g.reasons.join(", ")}</p>
          <ActionForm action={mergeContacts} submit="Merge into selected" confirm="Merge these contacts? This cannot be undone from the app." noSubmit={!canMerge}>
            {g.ids.map((id) => { const c = ctById.get(id)!; return (
              <label key={id} className="task" style={{ cursor: canMerge ? "pointer" : "default" }}>
                <input type="hidden" name="ids" value={id} />
                {canMerge && <input type="radio" name="keep" value={id} aria-label="Keep this one" />}
                <span className="grow"><Link prefetch={false} href={`/contacts/${id}`}>{[c.firstName, c.lastName].join(" ").trim() || c.email}</Link>
                  <span className="small muted"> {[c.email, c.phone, coName(c.companyId)].filter(Boolean).join(" · ")}</span></span>
              </label>); })}
          </ActionForm>
        </div>
      ))}
      {companyGroups.length > 0 && <h2>Companies ({companyGroups.length})</h2>}
      {companyGroups.map((g) => (
        <div className="card" key={g.ids.join()}>
          <p className="small muted">Matched on: {g.reasons.join(", ")}</p>
          <ActionForm action={mergeCompanies} submit="Merge into selected" confirm="Merge these companies? This cannot be undone from the app." noSubmit={!canMerge}>
            {g.ids.map((id) => { const c = coById.get(id)!; return (
              <label key={id} className="task" style={{ cursor: canMerge ? "pointer" : "default" }}>
                <input type="hidden" name="ids" value={id} />
                {canMerge && <input type="radio" name="keep" value={id} aria-label="Keep this one" />}
                <span className="grow"><Link prefetch={false} href={`/companies/${id}`}>{c.name}</Link><span className="small muted"> {[c.domain, c.industry].filter(Boolean).join(" · ")}</span></span>
              </label>); })}
          </ActionForm>
        </div>
      ))}
      {!canMerge && contactGroups.length + companyGroups.length > 0 && <p className="notice warn">Your role is read-only, so merging is disabled.</p>}
    </>
  );
}
