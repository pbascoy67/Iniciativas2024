import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { BackLink, CompanyForm } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { companies, db } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listUsers } from "@/lib/queries";

export default async function EditCompany({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "write")) return <Forbidden what="editar empresas" />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [c] = await db.select().from(companies).where(eq(companies.id, id));
  if (!c) notFound();
  return (
    <>
      <BackLink href={`/companies/${id}`}>Volver a la empresa</BackLink>
      <h1>Editar empresa</h1>
      <div className="card" style={{ maxWidth: 640 }}><CompanyForm company={c} users={await listUsers()} defaults={{ ownerId: user.id }} /></div>
    </>
  );
}
