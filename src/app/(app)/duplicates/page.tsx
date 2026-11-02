import Link from "next/link";
import { mergeCompanies } from "@/app/actions/companies";
import { mergeContacts } from "@/app/actions/contacts";
import { ActionForm } from "@/components/form";
import { Empty } from "@/components/ui";
import { companies, contacts, db } from "@/db";
import { requireUser } from "@/lib/auth";
import { findCompanyDuplicates, findContactDuplicates } from "@/lib/duplicates";
import { can } from "@/lib/permissions";

export const metadata = { title: "Duplicados · CRM Personal" };

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
      <h1>Duplicados</h1>
      <p className="muted">Las coincidencias son sugerencias basadas en correo, teléfono, nombre + empresa, nombre de empresa y dominio web. Al fusionar se conserva el registro que elijas, se completan sus campos vacíos con los de los demás y se mueven todas las notas, tareas, interacciones y oportunidades. Cada fusión queda en el registro de actividad.</p>
      {contactGroups.length + companyGroups.length === 0 && <div className="card"><Empty title="No se encontraron duplicados">Tus contactos y empresas se ven limpios.</Empty></div>}
      {contactGroups.length > 0 && <h2>Contacts ({contactGroups.length})</h2>}
      {contactGroups.map((g) => (
        <div className="card" key={g.ids.join()}>
          <p className="small muted">Coincide por: {g.reasons.join(", ")}</p>
          <ActionForm action={mergeContacts} submit="Fusionar en el seleccionado" confirm="¿Fusionar estos contactos? No se puede deshacer desde la aplicación." noSubmit={!canMerge}>
            {g.ids.map((id) => { const c = ctById.get(id)!; return (
              <label key={id} className="task" style={{ cursor: canMerge ? "pointer" : "default" }}>
                <input type="hidden" name="ids" value={id} />
                {canMerge && <input type="radio" name="keep" value={id} aria-label="Conservar este" />}
                <span className="grow"><Link prefetch={false} href={`/contacts/${id}`}>{[c.firstName, c.lastName].join(" ").trim() || c.email}</Link>
                  <span className="small muted"> {[c.email, c.phone, coName(c.companyId)].filter(Boolean).join(" · ")}</span></span>
              </label>); })}
          </ActionForm>
        </div>
      ))}
      {companyGroups.length > 0 && <h2>Companies ({companyGroups.length})</h2>}
      {companyGroups.map((g) => (
        <div className="card" key={g.ids.join()}>
          <p className="small muted">Coincide por: {g.reasons.join(", ")}</p>
          <ActionForm action={mergeCompanies} submit="Fusionar en el seleccionado" confirm="¿Fusionar estas empresas? No se puede deshacer desde la aplicación." noSubmit={!canMerge}>
            {g.ids.map((id) => { const c = coById.get(id)!; return (
              <label key={id} className="task" style={{ cursor: canMerge ? "pointer" : "default" }}>
                <input type="hidden" name="ids" value={id} />
                {canMerge && <input type="radio" name="keep" value={id} aria-label="Conservar este" />}
                <span className="grow"><Link prefetch={false} href={`/companies/${id}`}>{c.name}</Link><span className="small muted"> {[c.domain, c.industry].filter(Boolean).join(" · ")}</span></span>
              </label>); })}
          </ActionForm>
        </div>
      ))}
      {!canMerge && contactGroups.length + companyGroups.length > 0 && <p className="notice warn">Tu rol es de solo lectura, por eso la fusión está desactivada.</p>}
    </>
  );
}
