import Link from "next/link";
import { Empty } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { globalSearch } from "@/lib/queries";

export const metadata = { title: "Search · Personal CRM" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const r = q.length >= 2 ? await globalSearch(q, 25) : null;
  const groups: [string, NonNullable<typeof r>["contacts"]][] = r ? [["Contacts", r.contacts], ["Companies", r.companies], ["Opportunities", r.opportunities], ["Notes", r.notes]] : [];
  const total = groups.reduce((n, [, g]) => n + g.length, 0);
  return (
    <>
      <h1>Search</h1>
      {!r && <div className="card"><Empty title="Type at least 2 characters">Use the search box above.</Empty></div>}
      {r && total === 0 && <div className="card"><Empty title={`No matches for “${q}”`}>Check the spelling, or try part of a name, email or phone number.</Empty></div>}
      {groups.map(([label, hits]) => hits.length > 0 && (
        <div className="card" key={label}><h2>{label}</h2>
          {hits.map((h) => <div className="task" key={h.id}><div className="grow"><Link prefetch={false} href={h.href}>{h.name}</Link>{h.sub && <div className="small muted">{h.sub}</div>}</div></div>)}
        </div>
      ))}
    </>
  );
}
