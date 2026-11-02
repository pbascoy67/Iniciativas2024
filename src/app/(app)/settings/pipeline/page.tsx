import { addStage, deleteStage, moveStage, updateStage } from "@/app/actions/admin";
import { ActionForm, Field } from "@/components/form";
import { BackLink } from "@/components/forms";
import { Forbidden } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listStages } from "@/lib/queries";

const KINDS = [{ value: "open", label: "Open" }, { value: "won", label: "Won (closed)" }, { value: "lost", label: "Lost (closed)" }];

export default async function PipelineSettings() {
  const user = await requireUser();
  if (!can(user.role, "manageStages")) return <Forbidden what="pipeline settings" />;
  const stages = await listStages();
  return (
    <>
      <BackLink href="/settings">Settings</BackLink>
      <h1>Pipeline stages</h1>
      <p className="muted">Stages appear left to right on the pipeline board. A stage can only be deleted when no opportunity is in it.</p>
      {stages.map((s, i) => (
        <div className="card" key={s.id}>
          <ActionForm action={updateStage} submit="Save" className="row" >
            <input type="hidden" name="id" value={s.id} />
            <Field label={`Stage ${i + 1}`} name="name" defaultValue={s.name} required maxLength={60} />
            <Field label="Win probability %" name="probability" type="number" min={0} max={100} defaultValue={s.probability} />
            <Field label="Type" name="kind" defaultValue={s.kind} options={KINDS} />
          </ActionForm>
          <div className="row" style={{ marginTop: ".5rem" }}>
            <ActionForm action={moveStage} inline submit="↑ Up" submitClass="sm" hideMessage><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="up" /></ActionForm>
            <ActionForm action={moveStage} inline submit="↓ Down" submitClass="sm" hideMessage><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="down" /></ActionForm>
            <ActionForm action={deleteStage} inline submit="Delete" submitClass="sm danger" confirm={`Delete the stage "${s.name}"?`}><input type="hidden" name="id" value={s.id} /></ActionForm>
          </div>
        </div>
      ))}
      <div className="card"><h2>Add a stage</h2>
        <ActionForm action={addStage} submit="Add stage" className="row">
          <Field label="Name" name="name" required maxLength={60} /><Field label="Win probability %" name="probability" type="number" min={0} max={100} defaultValue={10} />
          <Field label="Type" name="kind" defaultValue="open" options={KINDS} />
        </ActionForm></div>
    </>
  );
}
