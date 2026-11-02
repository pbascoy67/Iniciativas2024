#!/usr/bin/env bash
# Ejecutar el CRM SIN Docker:  ./start-local.sh
# Requiere Node.js 20+ y PostgreSQL 14+ instalados (con psql). Crea .env con secretos aleatorios,
# crea la base de datos, instala dependencias, aplica migraciones, carga la demo y arranca la app.
set -euo pipefail
cd "$(dirname "$0")"

CRM_DB="${CRM_DB:-crm}"; CRM_DB_USER="${CRM_DB_USER:-crm}"; PORT="${PORT:-3000}"

command -v node >/dev/null 2>&1 || { echo "Falta Node.js 20 o superior: https://nodejs.org" >&2; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "Se requiere Node.js 20 o superior (tienes $(node -v))." >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { cat >&2 <<'MSG'
Falta PostgreSQL (el comando psql). Instálalo y vuelve a ejecutar:
  macOS:          brew install postgresql@16 && brew services start postgresql@16
  Ubuntu/Debian:  sudo apt install postgresql && sudo service postgresql start
  Windows:        usa WSL (Ubuntu) o el instalador de https://www.postgresql.org/download/windows/
MSG
  exit 1; }

gen() { head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

if [ ! -f .env ]; then
  PG=$(gen); ADMIN=$(gen); DEMO=$(gen)
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      POSTGRES_USER=*)        echo "POSTGRES_USER=$CRM_DB_USER" ;;
      POSTGRES_DB=*)          echo "POSTGRES_DB=$CRM_DB" ;;
      POSTGRES_PASSWORD=*)    echo "POSTGRES_PASSWORD=$PG" ;;
      DATABASE_URL=*)         echo "DATABASE_URL=postgres://$CRM_DB_USER:$PG@localhost:5432/$CRM_DB" ;;
      APP_PORT=*)             echo "APP_PORT=$PORT" ;;
      ADMIN_PASSWORD=*)       echo "ADMIN_PASSWORD=$ADMIN" ;;
      DEMO_USERS_PASSWORD=*)  echo "DEMO_USERS_PASSWORD=$DEMO" ;;
      *)                      echo "$line" ;;
    esac
  done < .env.example > .env
  chmod 600 .env
  echo "Se creó .env con secretos recién generados (git lo ignora)."
fi
set -a; . ./.env; set +a
export TZ="${APP_TIMEZONE:-UTC}" BACKUP_DIR="${BACKUP_DIR:-./data/backups}"

# Crear usuario y base si no existen (usa tu usuario de PostgreSQL; en Linux puede requerir sudo -u postgres).
PGPW="$(printf '%s' "$DATABASE_URL" | sed -E 's#^postgres://[^:]*:([^@]*)@.*#\1#')"
admin_psql() { psql -v ON_ERROR_STOP=1 -qtA -d postgres "$@" 2>/dev/null || sudo -n -u postgres psql -v ON_ERROR_STOP=1 -qtA -d postgres "$@"; }
if ! psql "$DATABASE_URL" -qtAc 'select 1' >/dev/null 2>&1; then
  echo "Creando el usuario y la base de datos '$CRM_DB'…"
  if ! { admin_psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='$CRM_DB_USER') THEN CREATE ROLE $CRM_DB_USER LOGIN PASSWORD '$PGPW'; END IF; END \$\$;" \
      && { [ -n "$(admin_psql -c "select 1 from pg_database where datname='$CRM_DB'")" ] || admin_psql -c "CREATE DATABASE $CRM_DB OWNER $CRM_DB_USER"; }; }; then
    cat >&2 <<MSG
No pude crear la base automáticamente. Ejecuta esto como administrador de PostgreSQL y vuelve a lanzar el script:
  CREATE ROLE $CRM_DB_USER LOGIN PASSWORD '$PGPW';
  CREATE DATABASE $CRM_DB OWNER $CRM_DB_USER;
MSG
    exit 1
  fi
fi

mkdir -p data/backups
npm ci
npm run db:migrate
npm run db:seed
npm run build
echo
echo "CRM Personal en marcha:  http://localhost:${PORT}"
echo "  Administrador: ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}   (guardado en .env)"
[ "${SEED_DEMO:-true}" = "true" ] && echo "  Usuarios demo: alex@example.com (miembro), sam@example.com (solo lectura) / ${DEMO_USERS_PASSWORD}"
echo "  Detener: Ctrl+C. Para volver a iniciar sin reinstalar: npm run start -- -p ${PORT}"
exec npm run start -- -p "$PORT"
