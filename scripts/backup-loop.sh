#!/bin/sh
# Scheduled backups for the docker compose "backup" service.
set -e
HOURS="${BACKUP_INTERVAL_HOURS:-24}"
while true; do
  node_modules/.bin/tsx scripts/backup.ts || echo "Backup failed; will retry next interval." >&2
  sleep $((HOURS * 3600))
done
