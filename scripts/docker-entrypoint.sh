#!/bin/sh
# Container start: apply migrations (idempotent), seed on first run, then serve.
set -e
i=0
until node_modules/.bin/tsx scripts/migrate.ts; do
  i=$((i + 1))
  [ "$i" -ge 20 ] && { echo "Database never became ready; giving up." >&2; exit 1; }
  echo "Waiting for the database... ($i)"; sleep 2
done
node_modules/.bin/tsx scripts/seed.ts
exec node_modules/.bin/next start -H 0.0.0.0 -p 3000
