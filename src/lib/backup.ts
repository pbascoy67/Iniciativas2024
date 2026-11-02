import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { isBackupFilename, timestampForFilename } from "./filenames";

export const backupDir = () => path.resolve(process.env.BACKUP_DIR || "./data/backups");

/** Split DATABASE_URL into libpq env vars so the password never shows up in `ps` output. */
export function pgEnv(url = process.env.DATABASE_URL): NodeJS.ProcessEnv {
  if (!url) throw new Error("DATABASE_URL is not set");
  const u = new URL(url);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.replace(/^\//, ""),
  };
}

export function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e: NodeJS.ErrnoException) =>
      reject(new Error(e.code === "ENOENT" ? `${cmd} was not found. Install the PostgreSQL client tools, or run this inside the docker compose "app" container.` : e.message)),
    );
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed (exit ${code}): ${err.trim().slice(-600)}`))));
  });
}

export async function createBackup(): Promise<{ file: string; bytes: number }> {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const file = `crm-${timestampForFilename()}.dump`;
  await run("pg_dump", ["--format=custom", "--no-owner", "--file", path.join(dir, file)], pgEnv());
  return { file, bytes: statSync(path.join(dir, file)).size };
}

export function listBackups(): { file: string; bytes: number; modified: Date }[] {
  try {
    return readdirSync(backupDir())
      .filter(isBackupFilename)
      .map((file) => {
        const s = statSync(path.join(backupDir(), file));
        return { file, bytes: s.size, modified: s.mtime };
      })
      .sort((a, b) => b.file.localeCompare(a.file));
  } catch {
    return [];
  }
}

export function pruneBackups(keep: number) {
  for (const b of listBackups().slice(Math.max(1, keep))) unlinkSync(path.join(backupDir(), b.file));
}
