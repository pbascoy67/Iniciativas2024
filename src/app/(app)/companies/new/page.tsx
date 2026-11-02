import { BackLink, CompanyForm } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listUsers } from "@/lib/queries";

export const metadata = { title: "Nueva empresa · CRM Personal" };

export default async function NewCompany() {
  const user = await requireUser();
  if (!can(user.role, "write")) return <Forbidden what="crear empresas" />;
  return (
    <>
      <BackLink href="/companies">Empresas</BackLink>
      <h1>Nueva empresa</h1>
      <div className="card" style={{ maxWidth: 640 }}><CompanyForm users={await listUsers()} defaults={{ ownerId: user.id }} /></div>
    </>
  );
}
