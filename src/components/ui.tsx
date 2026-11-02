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

export function Forbidden({ what = "this page" }: { what?: string }) {
  return (
    <div className="card">
      <h1>Not allowed</h1>
      <p className="muted">Your role doesn&apos;t have access to {what}. Ask an admin if you need it.</p>
      <Link prefetch={false} href="/">Back to the agenda</Link>
    </div>
  );
}

export function Pager({ path, params, page, total, size = 25 }: { path: string; params: Record<string, string | undefined>; page: number; total: number; size?: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return <p className="muted small">{total} result{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    sp.set("page", String(p));
    return `${path}?${sp}`;
  };
  return (
    <div className="row" style={{ marginTop: ".75rem", alignItems: "center" }}>
      <span className="muted small">{total} results · page {page} of {pages}</span>
      {page > 1 && <Link prefetch={false} className="btn sm" href={href(page - 1)}>← Previous</Link>}
      {page < pages && <Link prefetch={false} className="btn sm" href={href(page + 1)}>Next →</Link>}
    </div>
  );
}

export const personName = (c: { firstName?: string | null; lastName?: string | null; name?: string | null; email?: string | null }) =>
  c.name?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "(unnamed)";
