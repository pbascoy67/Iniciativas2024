import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { BackLink, ContactForm } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { contacts, db } from "@/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { companyOptions, listUsers } from "@/lib/queries";

export default async function EditContact({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "write")) return <Forbidden what="editar contactos" />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!c) notFound();
  const [companies, users] = await Promise.all([companyOptions(), listUsers()]);
  return (
    <>
      <BackLink href={`/contacts/${id}`}>Volver al contacto</BackLink>
      <h1>Editar contacto</h1>
      <div className="card" style={{ maxWidth: 640 }}><ContactForm contact={c} companies={companies} users={users} defaults={{ ownerId: user.id }} /></div>
    </>
  );
}
