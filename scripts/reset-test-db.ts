// Wipes and re-seeds a DISPOSABLE database for end-to-end tests. Refuses anything not named *_e2e / *_test.
import "./_env";
import postgres from "postgres";
import { runMigrations } from "./migrate";
import { seed } from "./seed";

export async function resetTestDb(url = process.env.E2E_DATABASE_URL) {
  if (!url) throw new Error("E2E_DATABASE_URL is not set");
  const dbName = new URL(url).pathname.slice(1);
  if (!/_(e2e|test)$/.test(dbName)) throw new Error(`Refusing to reset "${dbName}": test databases must end in _e2e or _test.`);
  // create the disposable database on first use (name is validated above, so quoting is safe)
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const adminSql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    const [row] = await adminSql`select 1 as ok from pg_database where datname = ${dbName}`;
    if (!row) await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminSql.end();
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  } finally {
    await sql.end();
  }
  await runMigrations(url);
  await seed(url, { demo: true });
}

if (process.argv[1]?.endsWith("reset-test-db.ts")) {
  resetTestDb().then(() => console.log("Test database reset.")).catch((e) => { console.error(e.message); process.exit(1); });
}
