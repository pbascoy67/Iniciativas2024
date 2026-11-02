import { BackLink, OpportunityForm } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { companyOptions, contactOptions, listStages, listUsers } from "@/lib/queries";

export const metadata = { title: "New opportunity · Personal CRM" };

export default async function NewOpportunity({ searchParams }: { searchParams: Promise<{ company?: string; contact?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "write")) return <Forbidden what="creating opportunities" />;
  const sp = await searchParams;
  const [companies, contacts, stages, users] = await Promise.all([companyOptions(), contactOptions(), listStages(), listUsers()]);
  return (
    <>
      <BackLink href="/pipeline">Pipeline</BackLink>
      <h1>New opportunity</h1>
      <div className="card" style={{ maxWidth: 640 }}>
        <OpportunityForm companies={companies} contacts={contacts.map((c) => ({ id: c.id, name: c.name || c.email || "(unnamed)" }))}
          stages={stages.filter((s) => s.kind === "open")} users={users} defaults={{ ownerId: user.id, companyId: sp.company, contactId: sp.contact }} />
      </div>
    </>
  );
}
