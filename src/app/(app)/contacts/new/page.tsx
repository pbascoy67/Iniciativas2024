import { BackLink, ContactForm } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { companyOptions, listUsers } from "@/lib/queries";

export const metadata = { title: "Nuevo contacto · CRM Personal" };

export default async function NewContact({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "write")) return <Forbidden what="crear contactos" />;
  const { company } = await searchParams;
  const [companies, users] = await Promise.all([companyOptions(), listUsers()]);
  return (
    <>
      <BackLink href="/contacts">Contactos</BackLink>
      <h1>Nuevo contacto</h1>
      <div className="card" style={{ maxWidth: 640 }}>
        <ContactForm companies={companies} users={users} defaults={{ ownerId: user.id, companyId: company }} />
      </div>
    </>
  );
}
