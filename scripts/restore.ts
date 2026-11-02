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
    console.error(`Usage: npm run restore -- <backup-file> --yes\n\nAvailable backups in ${backupDir()}:`);
    for (const b of listBackups()) console.error(`  ${b.file}  (${(b.bytes / 1024).toFixed(0)} KB, ${b.modified.toISOString()})`);
    process.exit(2);
  }
  // accept a bare name (looked up in the backup dir) or an explicit path
  const file = existsSync(arg) ? path.resolve(arg) : path.join(backupDir(), path.basename(arg));
  if (!existsSync(file)) throw new Error(`Backup not found: ${file}`);
  if (!yes) {
    console.error(`This will REPLACE all data in the database with ${file}.\nStop the app first (docker compose stop app), then re-run with --yes.`);
    process.exit(2);
  }
  const env = pgEnv();
  try {
    const safety = await createBackup();
    console.log(`Safety backup of current data: ${path.join(backupDir(), safety.file)}`);
  } catch (e) {
    console.warn(`Could not take a safety backup (${(e as Error).message}). Continuing because the database may be empty or broken.`);
  }
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--single-transaction", "--exit-on-error", "--dbname", env.PGDATABASE!, file], env);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`insert into activity_log (actor_name, action, entity, summary) values ('system', 'system.restore', 'system', ${`Restored from ${path.basename(file)}`})`;
  } finally {
    await sql.end();
  }
  console.log(`Restored from ${file}. Start the app again (docker compose start app).`);
}

main().catch((e) => {
  console.error("Restore failed:", e.message);
  process.exit(1);
});
