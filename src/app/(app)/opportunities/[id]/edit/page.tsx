import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { BackLink, OpportunityForm } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { db, opportunities } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { companyOptions, contactOptions, listStages, listUsers } from "@/lib/queries";

export default async function EditOpportunity({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "write")) return <Forbidden what="editar oportunidades" />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [o] = await db.select().from(opportunities).where(eq(opportunities.id, id));
  if (!o) notFound();
  const [companies, contacts, stages, users] = await Promise.all([companyOptions(), contactOptions(), listStages(), listUsers()]);
  return (
    <>
      <BackLink href={`/opportunities/${id}`}>Volver a la oportunidad</BackLink>
      <h1>Editar oportunidad</h1>
      <div className="card" style={{ maxWidth: 640 }}>
        <OpportunityForm opp={o} companies={companies} contacts={contacts.map((c) => ({ id: c.id, name: c.name || c.email || "(unnamed)" }))} stages={stages} users={users} defaults={{ ownerId: user.id }} />
      </div>
    </>
  );
}
