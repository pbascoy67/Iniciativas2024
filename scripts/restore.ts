/**
 * Recovery command: npm run restore -- <backup-file> --yes
 * Replaces ALL current data with the contents of the backup. A safety backup of the current
 * state is taken first, so a mistaken restore can itself be undone.
 */
import "./_env";
import { existsSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { backupDir, createBackup, listBackups, pgEnv, run } from "../src/lib/backup";

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes("--yes");
  const arg = args.find((a) => !a.startsWith("--"));
  if (!arg) {
    console.error(`Uso: npm run restore -- <archivo-de-copia> --yes\n\nCopias disponibles en ${backupDir()}:`);
    for (const b of listBackups()) console.error(`  ${b.file}  (${(b.bytes / 1024).toFixed(0)} KB, ${b.modified.toISOString()})`);
    process.exit(2);
  }
  // accept a bare name (looked up in the backup dir) or an explicit path
  const file = existsSync(arg) ? path.resolve(arg) : path.join(backupDir(), path.basename(arg));
  if (!existsSync(file)) throw new Error(`No se encontró la copia: ${file}`);
  if (!yes) {
    console.error(`Esto REEMPLAZARÁ todos los datos de la base de datos con ${file}.\nDetén primero la aplicación (docker compose stop app) y vuelve a ejecutar con --yes.`);
    process.exit(2);
  }
  const env = pgEnv();
  try {
    const safety = await createBackup();
    console.log(`Copia de seguridad de los datos actuales: ${path.join(backupDir(), safety.file)}`);
  } catch (e) {
    console.warn(`No se pudo crear la copia de seguridad previa (${(e as Error).message}). Se continúa porque la base de datos puede estar vacía o dañada.`);
  }
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--single-transaction", "--exit-on-error", "--dbname", env.PGDATABASE!, file], env);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`insert into activity_log (actor_name, action, entity, summary) values ('sistema', 'system.restore', 'system', ${`Restauró desde ${path.basename(file)}`})`;
  } finally {
    await sql.end();
  }
  console.log(`Restaurado desde ${file}. Vuelve a iniciar la aplicación (docker compose start app).`);
}

main().catch((e) => {
  console.error("Falló la restauración:", e.message);
  process.exit(1);
});
