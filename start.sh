#!/usr/bin/env bash
# One command to run the CRM locally:  ./start.sh
# First run: creates .env with random secrets, builds the image, starts Postgres + the app,
# applies migrations and seeds the demo workspace. Later runs just start/update it.
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { echo "Docker is required: https://docs.docker.com/get-docker/" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required (the 'docker compose' command)." >&2; exit 1; }

if [ ! -f .env ]; then
  gen() { head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
  PG=$(gen); ADMIN=$(gen); DEMO=$(gen)
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      POSTGRES_PASSWORD=*)    echo "POSTGRES_PASSWORD=$PG" ;;
      DATABASE_URL=*)         echo "DATABASE_URL=postgres://crm:$PG@localhost:5432/crm" ;;
      ADMIN_PASSWORD=*)       echo "ADMIN_PASSWORD=$ADMIN" ;;
      DEMO_USERS_PASSWORD=*)  echo "DEMO_USERS_PASSWORD=$DEMO" ;;
      *)                      echo "$line" ;;
    esac
  done < .env.example > .env
  { echo; echo "# File ownership for ./data inside containers (set by start.sh)"; echo "HOST_UID=$(id -u)"; echo "HOST_GID=$(id -g)"; } >> .env
  chmod 600 .env
  echo "Created .env with freshly generated secrets (it is git-ignored)."
fi

mkdir -p data/postgres data/backups
docker compose up --build --wait

set -a; . ./.env; set +a
echo
echo "Personal CRM is running:  http://localhost:${APP_PORT:-3000}"
echo "  Admin login: ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}   (stored in .env)"
if [ "${SEED_DEMO:-true}" = "true" ]; then
  echo "  Demo users:  alex@example.com (member), sam@example.com (viewer) / ${DEMO_USERS_PASSWORD}"
fi
echo "  Your data:   ./data/postgres   Backups: ./data/backups"
echo "  Stop: docker compose down      Logs: docker compose logs -f app"
