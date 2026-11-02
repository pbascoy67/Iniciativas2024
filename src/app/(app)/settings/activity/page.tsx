import Link from "next/link";
import { count, desc } from "drizzle-orm";
import { BackLink } from "@/components/forms";
import { Empty, Forbidden } from "@/components/ui";
import { activityLog, db } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";

export const metadata = { title: "Registro de actividad · CRM Personal" };
const SIZE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "viewActivity")) return <Forbidden what="el registro de actividad" />;
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(SIZE).offset((page - 1) * SIZE),
    db.select({ total: count() }).from(activityLog),
  ]);
  return (
    <>
      <BackLink href="/settings">Configuración</BackLink>
      <h1>Registro de actividad</h1>
      <p className="muted">Solo se agrega: los disparadores de la base de datos rechazan cualquier edición o eliminación de estas filas. Expórtalo desde Importar / Exportar.</p>
      <div className="card tablewrap">
        {rows.length === 0 ? <Empty title="Aún no hay nada registrado" /> : (
          <table><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Acción</th></tr></thead><tbody>
            {rows.map((r) => <tr key={r.id}><td className="nowrap">{formatDateTime(r.at)}</td><td>{r.actorName}</td><td>{r.summary}</td><td><span className="badge">{r.action}</span></td></tr>)}
          </tbody></table>
        )}
      </div>
      <div className="row" style={{ alignItems: "center" }}>
        <span className="muted small">{total} entradas</span>
        {page > 1 && <Link prefetch={false} className="btn sm" href={`?page=${page - 1}`}>← Más recientes</Link>}
        {page * SIZE < total && <Link prefetch={false} className="btn sm" href={`?page=${page + 1}`}>Más antiguas →</Link>}
      </div>
    </>
  );
}
