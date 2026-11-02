"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Hit = { id: string; name: string; sub: string; href: string };
type Results = Record<"contacts" | "companies" | "opportunities" | "notes", Hit[]>;
const LABELS: [keyof Results, string][] = [["contacts", "Contactos"], ["companies", "Empresas"], ["opportunities", "Oportunidades"], ["notes", "Notas"]];

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "offline">("idle");
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); setStatus("idle"); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        if (res.status === 401) { router.push("/login"); return; }
        if (!res.ok) throw new Error(String(res.status));
        setResults(await res.json());
        setStatus("idle");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setStatus(navigator.onLine ? "error" : "offline");
      }
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, retry, router]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); box.current?.querySelector("input")?.focus(); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, []);

  const total = results ? LABELS.reduce((n, [k]) => n + results[k].length, 0) : 0;
  return (
    <div className="search" ref={box} role="search">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) { setOpen(false); router.push(`/search?q=${encodeURIComponent(q.trim())}`); } }}>
        <label className="sr" htmlFor="global-search">Buscar en todo</label>
        <input id="global-search" type="search" placeholder='Buscar contactos, empresas, oportunidades, notas…  (presiona "/")' value={q} autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      </form>
      {open && q.trim().length >= 2 && (
        <div className="dropdown" role="listbox">
          {status === "loading" && !results && <div className="muted small" style={{ padding: ".5rem" }}>Buscando…</div>}
          {(status === "error" || status === "offline") && (
            <div className="notice err">
              {status === "offline" ? "Parece que no tienes conexión." : "La búsqueda no está disponible ahora."}{" "}
              <button type="button" className="sm" onClick={() => setRetry((n) => n + 1)}>Reintentar</button>
            </div>
          )}
          {status === "idle" && results && total === 0 && <div className="muted small" style={{ padding: ".5rem" }}>Sin resultados para “{q}”.</div>}
          {results && LABELS.map(([k, label]) => results[k].length > 0 && (
            <div key={k}>
              <div className="grp">{label}</div>
              {results[k].map((h) => (
                <Link prefetch={false} key={h.id} href={h.href} onClick={() => setOpen(false)}>
                  {h.name}
                  {h.sub && <span className="muted small"> — {h.sub}</span>}
                </Link>
              ))}
            </div>
          ))}
          {results && total > 0 && <div className="grp"><Link prefetch={false} href={`/search?q=${encodeURIComponent(q.trim())}`} onClick={() => setOpen(false)}>Ver todos los resultados</Link></div>}
        </div>
      )}
    </div>
  );
}
