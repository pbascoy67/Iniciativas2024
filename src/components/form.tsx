"use client";
import { createContext, useActionState, useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/action";

const Errors = createContext<Record<string, string> | undefined>(undefined);

function Submit({ label, className = "primary", pendingLabel = "Saving…" }: { label: string; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function SubmitButton(props: { label: string; className?: string; pendingLabel?: string }) {
  return <Submit {...props} />;
}

/**
 * Form wired to a server action. Shows pending state, field errors, a duplicate warning
 * (re-submitting with the hidden `force` flag proceeds) and success/error messages.
 */
export function ActionForm({
  action, children, submit = "Save", submitClass, confirm, className, inline, hideMessage, noSubmit,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children?: ReactNode; submit?: string; submitClass?: string; confirm?: string; className?: string; inline?: boolean; hideMessage?: boolean; noSubmit?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok) return;
    if (state.redirectTo) {
      window.location.assign(state.redirectTo); // hard navigation: deterministic after a mutation
      return;
    }
    if (state.reset) ref.current?.reset();
    // Pull fresh server data with a plain reload. In testing, Next's client-side refresh mechanisms
    // (router.refresh, revalidatePath in the action response, same-page replace) intermittently
    // dropped the update; a reload is deterministic and cheap for a local, server-rendered app.
    try {
      if (state.message && !hideMessage) sessionStorage.setItem("crm_flash", state.message);
    } catch {
      /* storage unavailable: the page still reloads, just without the banner */
    }
    window.location.reload();
  }, [state, hideMessage]);
  return (
    <Errors.Provider value={state?.fieldErrors}>
      <form
        ref={ref}
        action={formAction}
        className={className}
        style={inline ? { display: "inline-flex", gap: ".4rem", alignItems: "center" } : undefined}
        onSubmit={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        {children}
        {state?.warning && <input type="hidden" name="force" value="1" />}
        {!noSubmit && <Submit label={state?.warning ? "Create anyway" : submit} className={submitClass} />}
        {!hideMessage && (
          <div role="status" aria-live="polite">
            {state?.error && <div className="notice err">{state.error}</div>}
            {state?.warning && <div className="notice warn">{state.warning}</div>}
            {state?.ok && state.message && <div className="notice ok">{state.message}</div>}
          </div>
        )}
      </form>
    </Errors.Provider>
  );
}

export function Field({
  label, name, type = "text", defaultValue, required, options, placeholder, rows, step, min, max, maxLength,
}: {
  label: string; name: string; type?: string; defaultValue?: string | number | null; required?: boolean; placeholder?: string; rows?: number; step?: string; min?: string | number; max?: string | number; maxLength?: number;
  options?: { value: string; label: string }[];
}) {
  const err = useContext(Errors)?.[name];
  const uid = useId();
  const common = { name, id: `${uid}-${name}`, required, "aria-invalid": !!err, "aria-describedby": err ? `${uid}-e-${name}` : undefined };
  return (
    <label className="f" htmlFor={`${uid}-${name}`}>
      {label}
      {required && <span aria-hidden> *</span>}
      <span className="ctl">
        {options ? (
          <select {...common} defaultValue={defaultValue ?? ""}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : rows ? (
          <textarea {...common} rows={rows} defaultValue={defaultValue ?? ""} placeholder={placeholder} maxLength={maxLength} />
        ) : (
          <input {...common} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} step={step} min={min} max={max} maxLength={maxLength} />
        )}
      </span>
      {err && <span className="err" id={`${uid}-e-${name}`}>{err}</span>}
    </label>
  );
}
