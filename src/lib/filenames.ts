/** Produce a filename that is safe on every OS and in Content-Disposition headers. */
export function safeFilename(name: string, fallback = "file"): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\-]+|[.\-]+$/g, "")
    .slice(0, 100);
  return cleaned || fallback;
}

/** Backup files are only ever addressed by name, never by path. */
export function isBackupFilename(name: string): boolean {
  return /^crm-\d{8}-\d{6}\.dump$/.test(name);
}

export function timestampForFilename(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}
