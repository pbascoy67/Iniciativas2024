import Link from "next/link";
import type { ReactNode } from "react";

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
      {action && <div style={{ marginTop: ".75rem" }}>{action}</div>}
    </div>
  );
}

export function Forbidden({ what = "esta página" }: { what?: string }) {
  return (
    <div className="card">
      <h1>No permitido</h1>
      <p className="muted">Tu rol no tiene acceso a {what}. Pídele a un administrador si lo necesitas.</p>
      <Link prefetch={false} href="/">Volver a la agenda</Link>
    </div>
  );
}

export function Pager({ path, params, page, total, size = 25 }: { path: string; params: Record<string, string | undefined>; page: number; total: number; size?: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return <p className="muted small">{total} resultado{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    sp.set("page", String(p));
    return `${path}?${sp}`;
  };
  return (
    <div className="row" style={{ marginTop: ".75rem", alignItems: "center" }}>
      <span className="muted small">{total} resultados · página {page} de {pages}</span>
      {page > 1 && <Link prefetch={false} className="btn sm" href={href(page - 1)}>← Anterior</Link>}
      {page < pages && <Link prefetch={false} className="btn sm" href={href(page + 1)}>Siguiente →</Link>}
    </div>
  );
}

export const personName = (c: { firstName?: string | null; lastName?: string | null; name?: string | null; email?: string | null }) =>
  c.name?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "(sin nombre)";
