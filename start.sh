#!/usr/bin/env bash
# Un solo comando para ejecutar el CRM en local:  ./start.sh
# Primera vez: crea .env con secretos aleatorios, construye la imagen, inicia Postgres y la app,
# aplica las migraciones y carga el espacio de demostración. Las siguientes veces solo inicia/actualiza.
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { echo "Se requiere Docker: https://docs.docker.com/get-docker/" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Se requiere Docker Compose v2 (el comando 'docker compose')." >&2; exit 1; }

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
  { echo; echo "# Propietario de los archivos de ./data dentro de los contenedores (lo define start.sh)"; echo "HOST_UID=$(id -u)"; echo "HOST_GID=$(id -g)"; } >> .env
  chmod 600 .env
  echo "Se creó .env con secretos recién generados (git lo ignora)."
fi

mkdir -p data/postgres data/backups
docker compose up --build --wait

set -a; . ./.env; set +a
echo
echo "CRM Personal en marcha:  http://localhost:${APP_PORT:-3000}"
echo "  Administrador: ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}   (guardado en .env)"
if [ "${SEED_DEMO:-true}" = "true" ]; then
  echo "  Usuarios demo: alex@example.com (miembro), sam@example.com (solo lectura) / ${DEMO_USERS_PASSWORD}"
fi
echo "  Tus datos:   ./data/postgres   Copias: ./data/backups"
echo "  Detener: docker compose down      Registros: docker compose logs -f app"
