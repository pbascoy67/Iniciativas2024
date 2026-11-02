import Link from "next/link";
import { createCompany, updateCompany } from "@/app/actions/companies";
import { createContact, updateContact } from "@/app/actions/contacts";
import { createOpportunity, updateOpportunity } from "@/app/actions/opportunities";
import { ActionForm, Field } from "./form";

type Opt = { id: string; name: string };
const withBlank = (label: string, rows: Opt[]) => [{ value: "", label }, ...rows.map((r) => ({ value: r.id, label: r.name }))];

export function ContactForm({ contact, companies, users, defaults }: {
  contact?: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; jobTitle: string | null; companyId: string | null; ownerId: string | null };
  companies: Opt[]; users: Opt[]; defaults: { ownerId: string; companyId?: string };
}) {
  return (
    <ActionForm action={contact ? updateContact : createContact} submit={contact ? "Save contact" : "Create contact"}>
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <div className="row"><Field label="First name" name="firstName" defaultValue={contact?.firstName} maxLength={100} /><Field label="Last name" name="lastName" defaultValue={contact?.lastName} maxLength={100} /></div>
      <div className="row"><Field label="Email" name="email" type="email" defaultValue={contact?.email} /><Field label="Phone" name="phone" defaultValue={contact?.phone} maxLength={50} /></div>
      <div className="row"><Field label="Job title" name="jobTitle" defaultValue={contact?.jobTitle} maxLength={120} />
        <Field label="Company" name="companyId" defaultValue={contact?.companyId ?? defaults.companyId} options={withBlank("— none —", companies)} /></div>
      <div style={{ height: ".75rem" }} />
      <Field label="Owner" name="ownerId" defaultValue={contact?.ownerId ?? defaults.ownerId} options={withBlank("— unassigned —", users)} />
    </ActionForm>
  );
}

export function CompanyForm({ company, users, defaults }: {
  company?: { id: string; name: string; domain: string | null; website: string | null; phone: string | null; industry: string | null; address: string | null; ownerId: string | null };
  users: Opt[]; defaults: { ownerId: string };
}) {
  return (
    <ActionForm action={company ? updateCompany : createCompany} submit={company ? "Save company" : "Create company"}>
      {company && <input type="hidden" name="id" value={company.id} />}
      <Field label="Name" name="name" defaultValue={company?.name} required maxLength={200} />
      <div className="row"><Field label="Website" name="website" defaultValue={company?.website} placeholder="https://" /><Field label="Domain" name="domain" defaultValue={company?.domain} placeholder="derived from website" /></div>
      <div className="row"><Field label="Phone" name="phone" defaultValue={company?.phone} /><Field label="Industry" name="industry" defaultValue={company?.industry} /></div>
      <Field label="Address" name="address" defaultValue={company?.address} maxLength={300} />
      <Field label="Owner" name="ownerId" defaultValue={company?.ownerId ?? defaults.ownerId} options={withBlank("— unassigned —", users)} />
    </ActionForm>
  );
}

export function OpportunityForm({ opp, companies, contacts, stages, users, defaults }: {
  opp?: { id: string; name: string; companyId: string | null; contactId: string | null; stageId: string; valueCents: number; expectedCloseDate: string | null; ownerId: string | null };
  companies: Opt[]; contacts: Opt[]; stages: Opt[]; users: Opt[]; defaults: { ownerId: string; companyId?: string; contactId?: string };
}) {
  return (
    <ActionForm action={opp ? updateOpportunity : createOpportunity} submit={opp ? "Save opportunity" : "Create opportunity"}>
      {opp && <input type="hidden" name="id" value={opp.id} />}
      <Field label="Name" name="name" defaultValue={opp?.name} required maxLength={200} />
      <div className="row"><Field label="Company" name="companyId" defaultValue={opp?.companyId ?? defaults.companyId} options={withBlank("— none —", companies)} />
        <Field label="Contact" name="contactId" defaultValue={opp?.contactId ?? defaults.contactId} options={withBlank("— none —", contacts)} /></div>
      <div style={{ height: ".75rem" }} />
      <div className="row"><Field label="Stage" name="stageId" defaultValue={opp?.stageId ?? stages[0]?.id} options={stages.map((s) => ({ value: s.id, label: s.name }))} required />
        <Field label="Value" name="value" defaultValue={opp ? String(opp.valueCents / 100) : ""} placeholder="e.g. 12,500" /></div>
      <div style={{ height: ".75rem" }} />
      <div className="row"><Field label="Expected close" name="expectedCloseDate" type="date" defaultValue={opp?.expectedCloseDate} />
        <Field label="Owner" name="ownerId" defaultValue={opp?.ownerId ?? defaults.ownerId} options={withBlank("— unassigned —", users)} /></div>
    </ActionForm>
  );
}

export const BackLink = ({ href, children }: { href: string; children: React.ReactNode }) => <Link prefetch={false} href={href} className="small">← {children}</Link>;
