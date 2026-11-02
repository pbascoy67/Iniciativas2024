"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Shows a one-shot success message passed as ?ok=... then removes it from the URL. */
export function Flash() {
  const params = useSearchParams();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("crm_flash");
      if (stored) {
        sessionStorage.removeItem("crm_flash");
        setMsg(stored.slice(0, 200));
        const t = setTimeout(() => setMsg(null), 6000);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
    const ok = params.get("ok");
    if (!ok) return;
    setMsg(ok.slice(0, 200));
    const url = new URL(window.location.href);
    url.searchParams.delete("ok");
    window.history.replaceState(null, "", url.pathname + url.search);
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [params]);
  if (!msg) return null;
  return <div className="notice ok" role="status">{msg}</div>;
}
