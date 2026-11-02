import { addStage, deleteStage, moveStage, updateStage } from "@/app/actions/admin";
import { ActionForm, Field } from "@/components/form";
import { BackLink } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listStages } from "@/lib/queries";

const KINDS = [{ value: "open", label: "Abiertas" }, { value: "won", label: "Ganada (cerrada)" }, { value: "lost", label: "Perdida (cerrada)" }];

export default async function PipelineSettings() {
  const user = await requireUser();
  if (!can(user.role, "manageStages")) return <Forbidden what="la configuración del embudo" />;
  const stages = await listStages();
  return (
    <>
      <BackLink href="/settings">Configuración</BackLink>
      <h1>Etapas del embudo</h1>
      <p className="muted">Las etapas aparecen de izquierda a derecha en el tablero del embudo. Una etapa solo se puede eliminar cuando no tiene oportunidades.</p>
      {stages.map((s, i) => (
        <div className="card" key={s.id}>
          <ActionForm action={updateStage} submit="Guardar" className="row" >
            <input type="hidden" name="id" value={s.id} />
            <Field label={`Etapa ${i + 1}`} name="name" defaultValue={s.name} required maxLength={60} />
            <Field label="Probabilidad de ganar %" name="probability" type="number" min={0} max={100} defaultValue={s.probability} />
            <Field label="Tipo" name="kind" defaultValue={s.kind} options={KINDS} />
          </ActionForm>
          <div className="row" style={{ marginTop: ".5rem" }}>
            <ActionForm action={moveStage} inline submit="↑ Subir" submitClass="sm" hideMessage><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="up" /></ActionForm>
            <ActionForm action={moveStage} inline submit="↓ Bajar" submitClass="sm" hideMessage><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="down" /></ActionForm>
            <ActionForm action={deleteStage} inline submit="Eliminar" submitClass="sm danger" confirm={`¿Eliminar la etapa "${s.name}"?`}><input type="hidden" name="id" value={s.id} /></ActionForm>
          </div>
        </div>
      ))}
      <div className="card"><h2>Agregar una etapa</h2>
        <ActionForm action={addStage} submit="Agregar etapa" className="row">
          <Field label="Nombre" name="name" required maxLength={60} /><Field label="Probabilidad de ganar %" name="probability" type="number" min={0} max={100} defaultValue={10} />
          <Field label="Tipo" name="kind" defaultValue="open" options={KINDS} />
        </ActionForm></div>
    </>
  );
}
