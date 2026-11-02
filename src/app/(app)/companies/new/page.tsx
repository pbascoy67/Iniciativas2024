import { BackLink, CompanyForm } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listUsers } from "@/lib/queries";

export const metadata = { title: "New company · Personal CRM" };

export default async function NewCompany() {
  const user = await requireUser();
  if (!can(user.role, "write")) return <Forbidden what="creating companies" />;
  return (
    <>
      <BackLink href="/companies">Companies</BackLink>
      <h1>New company</h1>
      <div className="card" style={{ maxWidth: 640 }}><CompanyForm users={await listUsers()} defaults={{ ownerId: user.id }} /></div>
    </>
  );
}
