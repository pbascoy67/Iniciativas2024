import "./_env";
import { createBackup, pruneBackups, backupDir } from "../src/lib/backup";

createBackup()
  .then(({ file, bytes }) => {
    pruneBackups(Number(process.env.BACKUP_KEEP) || 14);
    console.log(`Backup written: ${backupDir()}/${file} (${(bytes / 1024).toFixed(0)} KB)`);
  })
  .catch((e) => {
    console.error("Backup failed:", e.message);
    process.exit(1);
  });
