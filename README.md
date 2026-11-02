# CRM Personal

Un reemplazo local de Less Annoying CRM: contactos, empresas, un embudo de ventas configurable, una cronología cronológica de interacciones y una agenda diaria que te dice qué hacer a continuación. **Toda la interfaz está en español.**

**Tecnologías:** Next.js 15 (App Router) · TypeScript · PostgreSQL 16 · Drizzle ORM · Docker Compose.

Todo corre en tu máquina. No hay cuentas alojadas, facturación, telemetría, analítica ni llamadas a servicios externos. Tus datos viven en `./data`.

## Inicio rápido

Requiere Docker con Compose v2.

```bash
./start.sh
```

La primera vez crea `.env` con secretos aleatorios (git lo ignora), construye la imagen, inicia Postgres y la aplicación, aplica las migraciones y carga un espacio de demostración realista. Al terminar imprime la URL y los accesos (por defecto `http://localhost:3000`). Volver a ejecutarlo solo inicia/actualiza el sistema.

- Administrador: el `ADMIN_EMAIL` / `ADMIN_PASSWORD` de `.env`.
- Usuarios demo (misma `DEMO_USERS_PASSWORD`): `alex@example.com` (miembro), `sam@example.com` (solo lectura).
- Para empezar vacío: pon `SEED_DEMO=false` en `.env` **antes** del primer inicio (o borra `./data/postgres` y reinicia).
- Detener: `docker compose down` (los datos quedan en `./data`). Registros: `docker compose logs -f app`.
- Nota: los datos de demostración y los nombres de etapa por defecto se crean en español solo en instalaciones nuevas; una base creada antes conserva sus nombres.

## Inicio rápido sin Docker

Si no tienes Docker, necesitas **Node.js 20+** y **PostgreSQL 14+** (con `psql`) instalados:

- macOS: `brew install node postgresql@16 && brew services start postgresql@16`
- Ubuntu/Debian/WSL: `sudo apt install nodejs npm postgresql && sudo service postgresql start`

Luego:

```bash
./start-local.sh
```

Crea `.env` con secretos aleatorios, crea el usuario y la base de datos en tu PostgreSQL, instala dependencias, aplica migraciones, carga la demostración, compila y arranca en `http://localhost:3000` (cambia el puerto con `PORT=3100 ./start-local.sh`). Es seguro volver a ejecutarlo. Si no puede crear la base automáticamente, te imprime las dos líneas de SQL que debes ejecutar como administrador de PostgreSQL. Las copias de seguridad quedan en `./data/backups` (`npm run backup`; requiere `pg_dump`, que viene con PostgreSQL) y la restauración es `npm run restore -- <archivo> --yes`.

## Qué hace

| Área | Detalle |
|---|---|
| Registros | Contactos, empresas, oportunidades, notas y tareas. Todo tiene un **propietario**. |
| Embudo | Tablero kanban; las etapas son configurables (renombrar, reordenar, agregar, eliminar, marcar ganada/perdida) en **Configuración → Etapas del embudo**. |
| Cronología | Notas, **correos, reuniones y llamadas** registrados a mano, tareas completadas y cambios de etapa, de más reciente a más antiguo, en cada contacto, empresa y oportunidad. |
| Agenda ("Hoy") | Vencidas → vencen hoy → próximos 7 días, más oportunidades abiertas **sin próxima acción** o **sin contacto en 14+ días**. Alterna *Mías / Todos*. |
| Búsqueda | Cuadro de búsqueda global (tecla `/`) en contactos, empresas, oportunidades y notas, con índices de trigramas. Resultados completos en `/search`. |
| Duplicados | Detección por correo, teléfono, nombre + empresa (contactos) y nombre normalizado / dominio web (empresas). Avisa al crear un posible duplicado. **Fusionar** conserva un registro, completa sus vacíos y mueve notas, tareas, interacciones y oportunidades. |
| Vistas guardadas | Guarda cualquier combinación de filtros en contactos, empresas, embudo o tareas; los administradores pueden compartirlas. |
| Importar / exportar | Importación CSV con asignación de columnas y vista previa; exportación CSV por entidad y una exportación JSON completa. |
| Control de acceso | Tres roles (abajo). |
| Registro de actividad | Registro inmutable de cada cambio, inicio de sesión, importación, exportación y copia. |
| Copias de seguridad | `pg_dump` programado, un botón en Configuración y un comando de recuperación. |

**No** incluye a propósito: ingesta automática de buzones (los correos se registran a mano), bases de datos comerciales de enriquecimiento, pronósticos/integraciones/cumplimiento empresarial, registro de usuarios, facturación ni telemetría.

## Permisos

Los usuarios son locales a la instalación; los administradores los crean en **Configuración → Usuarios y roles**. No hay registro público.

| Permiso | solo lectura | miembro | administrador |
|---|:-:|:-:|:-:|
| Ver todo | ✓ | ✓ | ✓ |
| Crear/editar registros, notas, tareas; registrar interacciones | | ✓ | ✓ |
| Importar CSV y exportar datos | | ✓ | ✓ |
| Fusionar duplicados | | ✓ | ✓ |
| Eliminar registros y tareas | | | ✓ |
| Etapas del embudo, usuarios y roles, copias, registro de actividad | | | ✓ |

Los permisos se verifican en el servidor (cada acción y ruta de API), no solo ocultando botones. Las sesiones son tokens aleatorios guardados con hash; las contraseñas usan scrypt; los inicios de sesión fallidos repetidos se limitan.

## Ubicación de los datos

| Qué | Dónde |
|---|---|
| Archivos de la base de datos | `./data/postgres` |
| Copias de seguridad | `./data/backups` |
| Secretos | `.env` (ignorado por git; `.env.example` es la plantilla) |

Postgres solo se publica en `127.0.0.1`. Nada sale de tu máquina.

## Exportar

Página **Importar / Exportar**, o directamente:

- `GET /api/export/{contacts|companies|opportunities|tasks|interactions|notes}` → CSV (UTF-8 con BOM; abre en Excel/Numbers/Sheets)
- `GET /api/export/all` → un JSON con todos los registros, etapas y vistas guardadas (sin hashes de contraseña)
- `GET /api/export/activity` → CSV del registro de actividad (administrador)

Los nombres de archivo se sanean (`crm-contacts-2026-11-02.csv`). Las celdas que empiezan con `= + - @` llevan un `'` delante para que una hoja de cálculo nunca las ejecute como fórmulas.

## Copias de seguridad y recuperación

- **Automática:** el servicio `backup` de compose escribe `crm-AAAAMMDD-HHMMSS.dump` en `./data/backups` cada `BACKUP_INTERVAL_HOURS` (24 por defecto) y conserva las últimas `BACKUP_KEEP` (14).
- **Bajo demanda:** **Configuración → Copias de seguridad → Crear copia ahora**, o `docker compose exec app npm run backup`.
- **Copia fuera de la máquina:** copia `./data/backups` a otro lugar tú mismo (la aplicación nunca sube nada).

**Restaurar** (reemplaza todos los datos actuales; antes se hace una copia de seguridad del estado actual, así que una restauración equivocada se puede deshacer):

```bash
docker compose stop app backup
docker compose run --rm app npm run restore -- crm-20261102-031500.dump --yes
docker compose start app backup
```

Ejecuta `npm run restore` sin argumentos para listar las copias. La restauración es un comando a propósito, no un botón. Después se agrega una entrada `system.restore` al registro de actividad.

## Importación CSV: asignación de campos

Abre **Importar / Exportar → Importar desde CSV**, elige *Contactos* o *Empresas* y el archivo (≤ 5 MB, ≤ 20 000 filas; separado por comas, punto y coma o tabulaciones). Las columnas se asignan automáticamente por el nombre del encabezado; puedes cambiar cualquier asignación y ver las primeras filas tal como se importarán antes de confirmar. Las filas inválidas se informan con su número de fila y se omiten; el resto se importa. Toda la importación corre en una sola transacción.

**Contactos**

| Campo del CRM | Encabezados reconocidos (sin distinguir mayúsculas ni signos) | Notas |
|---|---|---|
| Nombre completo | `Name`, `Full Name`, `Contact Name`, `Contact` | Se separa en nombre/apellido (`"Lovelace, Ada"` y `Ada Lovelace` funcionan). Solo se usa si no hay columnas de nombre/apellido. |
| Nombre | `First Name`, `Given Name`, `First` | |
| Apellido | `Last Name`, `Surname`, `Family Name`, `Last` | |
| Correo | `Email`, `E-mail`, `Email Address`, `Work Email`, `Primary Email` | Se pasa a minúsculas y se valida; si la celda trae varias direcciones se usa la primera. |
| Teléfono | `Phone`, `Phone Number`, `Telephone`, `Mobile`, `Cell`, `Work Phone` | Se guarda tal cual. |
| Cargo | `Job Title`, `Title`, `Position`, `Role` | |
| Empresa | `Company`, `Company Name`, `Organization`, `Account`, `Employer` | Se enlaza con una empresa existente por nombre normalizado (ignora `Inc`, `LLC`, `Ltd`…); si no existe, se crea. |
| Propietario | `Owner`, `Assigned To`, `User`, `Account Owner` | Correo o nombre del usuario; los desconocidos pasan al usuario que importa. |

Una fila necesita un nombre o un correo. **Duplicados:** si el correo ya existe, la fila se *omite* (por defecto) o *actualiza* el contacto existente, a tu elección en cada importación.

**Empresas**

| Campo del CRM | Encabezados reconocidos | Notas |
|---|---|---|
| Nombre (obligatorio) | `Name`, `Company`, `Company Name`, `Organization`, `Account` | Una empresa existente (mismo nombre normalizado o dominio) se omite o se actualiza. |
| Dominio | `Domain`, `Website Domain` | Se obtiene del sitio web si está vacío. |
| Sitio web | `Website`, `URL`, `Web`, `Site` | |
| Teléfono | `Phone`, `Phone Number`, `Telephone`, `Main Phone` | |
| Industria | `Industry`, `Sector`, `Category` | |
| Dirección | `Address`, `Street Address`, `Location`, `HQ` | |
| Propietario | igual que arriba | |

Los encabezados reconocidos son los de exportaciones habituales (en inglés, como los de Less Annoying CRM: *Name*, *Company Name*, *Email*, *Phone*, *Job Title*); no pude probar con un archivo real de LACRM, así que revisa la vista previa. Lo que no se asigne (campos personalizados, embudos, historial de notas) no se importa. La lógica está en `src/lib/import-mapping.ts` (funciones puras con pruebas); para enseñarle un encabezado nuevo, agrega un alias ahí.

## Arquitectura

```
Navegador ── Next.js 15 (App Router, un contenedor) ── PostgreSQL 16 (un contenedor)
             ├─ Server Components  → páginas de lectura (src/app/(app)/**)
             ├─ Server Actions     → cada modificación (src/app/actions/*): permiso → validación zod
             │                       → transacción → fila en el registro de actividad en la misma transacción
             ├─ Route handlers     → búsqueda, exportación CSV/JSON, importación CSV, descarga de copias (src/app/api/**)
             └─ Drizzle ORM        → esquema en src/db/schema.ts, migraciones SQL en drizzle/
```

- `src/lib/` contiene la lógica pura y probada (CSV, asignación de importación, detección de duplicados, fusión, permisos, cronología, nombres de archivo), separada del código de base de datos. Los textos de la interfaz están en español directamente en el código; las etiquetas de valores internos (roles, tipos) están en `src/lib/i18n.ts`.
- `drizzle/0000_init.sql` se genera desde el esquema; `0001_*.sql` es manual: disparadores del registro inmutable e índices de búsqueda `pg_trgm`.
- **Registro inmutable:** disparadores de la base de datos rechazan `UPDATE`, `DELETE` y `TRUNCATE` sobre `activity_log`. Protege contra errores de la aplicación y SQL manual; el *dueño* de la base aún puede borrar la tabla, así que es un registro que evidencia manipulación para una herramienta personal, no un control de cumplimiento.
- **Servicios no disponibles:** si la base de datos cae, las páginas muestran una pantalla para reintentar, los formularios muestran un mensaje recuperable y el buscador muestra "no disponible · Reintentar" (y aviso sin conexión). `GET /api/health` informa el estado de la base (lo usa el healthcheck de compose).
- **Formularios:** tras guardar con éxito la página se recarga por completo en vez de refrescarse del lado del cliente. Fue deliberado: los mecanismos de refresco de Next fallaron de forma intermitente en las pruebas. Costo: se pierden la posición de scroll y el texto a medio escribir en *otros* formularios de la misma página.

## Desarrollo

```bash
cp .env.example .env            # o ejecuta ./start.sh una vez y luego `docker compose stop app backup`
docker compose up -d db         # Postgres en 127.0.0.1:5432
npm install
npm run db:migrate && npm run db:seed
npm run dev                     # http://localhost:3000
```

Scripts: `db:generate` (nueva migración desde el esquema), `db:migrate`, `db:seed`, `backup`, `restore`, `typecheck`, `test`, `test:e2e`.

### Pruebas

```bash
npm test               # pruebas unitarias (vitest): CSV, transformación de importación, duplicados, fusión, cronología, permisos, nombres de archivo
npx playwright install chromium   # una vez
npm run test:e2e       # flujo principal de extremo a extremo
```

`test:e2e` construye la aplicación y la ejecuta contra una **base desechable llamada `<tu base>_e2e`** que crea, borra y recarga en cada ejecución (se niega a tocar cualquier base que no termine en `_e2e`/`_test`). Necesita Postgres accesible vía `DATABASE_URL`. El flujo: iniciar sesión → crear empresa → contacto → oportunidad → mover de etapa → registrar un correo → agregar una tarea para hoy → verla en la agenda → búsqueda global → exportar CSV.

## Notas de seguridad

- No se suben credenciales. `.env` está ignorado por git; `start.sh` genera secretos aleatorios. Las únicas contraseñas fijas del repositorio son datos de prueba de la base desechable en `playwright.config.ts`.
- La aplicación y Postgres escuchan solo en `127.0.0.1`. Para exponerla en una red, ponla detrás de tu propio proxy HTTPS y define `COOKIE_SECURE=true`.
- `npm audit` reporta avisos en `postcss`, incluido dentro de Next.js y que solo corre en la compilación sobre el CSS de este proyecto; no es alcanzable desde la entrada de usuarios.
