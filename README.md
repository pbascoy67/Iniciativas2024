# Personal CRM

A local-first replacement for Less Annoying CRM: contacts, companies, a configurable sales pipeline, a chronological interaction timeline, and a daily agenda that tells you what to do next.

**Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL 16 · Drizzle ORM · Docker Compose.

Everything runs on your machine. There are no hosted accounts, billing, telemetry, analytics, or outbound network calls. Your data lives in `./data`.

## Quick start

Requires Docker with Compose v2.

```bash
./start.sh
```

On first run this creates `.env` with random secrets (git-ignored), builds the image, starts Postgres and the app, applies migrations, and loads a realistic demo workspace. It prints the URL and logins when ready (default `http://localhost:3000`). Re-running it later just starts/updates the stack.

- Admin login: the `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.
- Demo users (same `DEMO_USERS_PASSWORD`): `alex@example.com` (member), `sam@example.com` (viewer).
- Start empty instead: set `SEED_DEMO=false` in `.env` **before** the first run (or delete `./data/postgres` and start again).
- Stop: `docker compose down` (data stays in `./data`). Logs: `docker compose logs -f app`.

## What it does

| Area | Details |
|---|---|
| Records | Contacts, companies, opportunities, notes, tasks. Every record has an **owner**. |
| Pipeline | Kanban board; stages are configurable (rename, reorder, add, delete, mark won/lost) in **Settings → Pipeline stages**. |
| Timeline | Notes, manually logged **emails, meetings and calls**, completed tasks and stage changes, newest first, on every contact, company and opportunity. |
| Agenda ("Today") | Overdue → due today → next 7 days, plus open deals with **no next action** or **no contact in 14+ days**. Toggle *Mine / Everyone*. |
| Search | Global search box (press `/`) across contacts, companies, deals and notes, backed by trigram indexes. Full results at `/search`. |
| Duplicates | Detection by email, phone, name + company (contacts) and normalised name / web domain (companies). Warns when you create a likely duplicate. **Merge** keeps one record, fills its blanks, and moves notes/tasks/interactions/deals across. |
| Saved views | Save any filter combination on contacts, companies, pipeline or tasks; admins can share views. |
| Import / export | CSV import with column mapping and a preview; CSV export per entity plus a full JSON export. |
| Access control | Three roles (below). |
| Activity log | Immutable record of every change, sign-in, import, export and backup. |
| Backups | Scheduled `pg_dump` backups, a button in Settings, and a recovery command. |

Deliberately **not** included: automatic mailbox ingestion (you log emails by hand), commercial enrichment databases, enterprise forecasting/integrations/compliance, user sign-up, billing, telemetry.

## Permissions

Users are local to the installation; admins create them in **Settings → Users & roles**. There is no sign-up.

| Permission | viewer | member | admin |
|---|:-:|:-:|:-:|
| Read everything | ✓ | ✓ | ✓ |
| Create / edit records, notes, tasks, log interactions | | ✓ | ✓ |
| Import CSV, export data | | ✓ | ✓ |
| Merge duplicates | | ✓ | ✓ |
| Delete records and tasks | | | ✓ |
| Pipeline stages, users & roles, backups, activity log | | | ✓ |

Checks are enforced on the server (every action and API route), not just by hiding buttons. Sessions are random tokens stored hashed in the database; passwords use scrypt; repeated failed sign-ins are throttled.

## Data location

| What | Where |
|---|---|
| Database files | `./data/postgres` (bind mount into the `db` container) |
| Backups | `./data/backups` |
| Secrets | `.env` (git-ignored; `.env.example` is the template) |

Postgres is published on `127.0.0.1` only. Nothing leaves your machine.

## Export

**Import / Export** page, or directly:

- `GET /api/export/{contacts|companies|opportunities|tasks|interactions|notes}` → CSV (UTF-8 with BOM, opens in Excel/Numbers/Sheets)
- `GET /api/export/all` → one JSON file with all records, stages and saved views (no password hashes)
- `GET /api/export/activity` → activity log CSV (admin)

Filenames are sanitised (`crm-contacts-2026-11-02.csv`). Cells that begin with `= + - @` are prefixed with `'` so a spreadsheet can never execute them as formulas.

## Backups and recovery

- **Automatic:** the `backup` compose service writes `crm-YYYYMMDD-HHMMSS.dump` to `./data/backups` every `BACKUP_INTERVAL_HOURS` (default 24) and keeps the newest `BACKUP_KEEP` (default 14).
- **On demand:** **Settings → Backups → Create backup now**, or `docker compose exec app npm run backup`.
- **Off-machine copy:** copy `./data/backups` somewhere else yourself (the app never uploads anything).

**Restore** (replaces all current data; a safety backup of the current state is taken first, so a mistaken restore can be undone):

```bash
docker compose stop app backup
docker compose run --rm app npm run restore -- crm-20261102-031500.dump --yes
docker compose start app backup
```

Run `npm run restore` with no arguments to list available backups. Restore is deliberately a command, not a button. After a restore, a `system.restore` entry is appended to the activity log.

## CSV import: field mapping

Open **Import / Export → Import from CSV**, pick *Contacts* or *Companies*, choose the file (≤ 5 MB, ≤ 20,000 rows; comma, semicolon or tab separated). Columns are matched automatically by header name; you can change any mapping and see the first rows exactly as they will be imported before committing. Rows that fail validation are reported with their row number and skipped; the rest import. The whole import runs in one transaction.

**Contacts**

| CRM field | Recognised headers (case/punctuation-insensitive) | Notes |
|---|---|---|
| Full name | `Name`, `Full Name`, `Contact Name`, `Contact` | Split into first/last (`"Lovelace, Ada"` and `Ada Lovelace` both work). Used only when no first/last columns are mapped. |
| First name | `First Name`, `Given Name`, `First` | |
| Last name | `Last Name`, `Surname`, `Family Name`, `Last` | |
| Email | `Email`, `E-mail`, `Email Address`, `Work Email`, `Primary Email` | Lower-cased and validated; if a cell holds several addresses the first is used. |
| Phone | `Phone`, `Phone Number`, `Telephone`, `Mobile`, `Cell`, `Work Phone` | Stored as typed. |
| Job title | `Job Title`, `Title`, `Position`, `Role` | |
| Company | `Company`, `Company Name`, `Organization`, `Account`, `Employer` | Matched to an existing company by normalised name (ignores `Inc`, `LLC`, `Ltd`…), otherwise created. |
| Owner | `Owner`, `Assigned To`, `User`, `Account Owner` | User email or name; unknown values fall back to the importing user. |

A row needs a name or an email. **Duplicates:** a row whose email already exists is *skipped* (default) or *updates* the existing contact's blank/changed fields, your choice per import.

**Companies**

| CRM field | Recognised headers | Notes |
|---|---|---|
| Name (required) | `Name`, `Company`, `Company Name`, `Organization`, `Account` | Existing company (same normalised name or domain) is skipped or updated. |
| Domain | `Domain`, `Website Domain` | Derived from the website when empty. |
| Website | `Website`, `URL`, `Web`, `Site` | |
| Phone | `Phone`, `Phone Number`, `Telephone`, `Main Phone` | |
| Industry | `Industry`, `Sector`, `Category` | |
| Address | `Address`, `Street Address`, `Location`, `HQ` | |
| Owner | as above | |

Exports from Less Annoying CRM use headers such as *Name*, *Company Name*, *Email*, *Phone* and *Job Title*, which map automatically; I have not been able to test against a real LACRM export file, so check the preview step. Anything not mapped (e.g. custom fields, pipelines, notes history) is not imported.

The mapping logic lives in `src/lib/import-mapping.ts` (pure functions, unit-tested); to teach it a new header, add an alias there.

## Architecture

```
Browser ── Next.js 15 (App Router, one container) ── PostgreSQL 16 (one container)
           ├─ Server Components  → read pages (src/app/(app)/**)
           ├─ Server Actions     → every mutation (src/app/actions/*): permission check → zod validation
           │                       → DB transaction → activity-log row in the same transaction
           ├─ Route handlers     → search, CSV/JSON export, CSV import, backup download (src/app/api/**)
           └─ Drizzle ORM        → schema in src/db/schema.ts, SQL migrations in drizzle/
```

- `src/lib/` holds the pure, tested logic (CSV, import mapping, duplicate detection, merge, permissions, timeline, filenames) separate from database code.
- `drizzle/0000_init.sql` is generated from the schema; `0001_*.sql` is hand-written: the immutable-log triggers and `pg_trgm` search indexes.
- **Immutable log:** database triggers reject `UPDATE`, `DELETE` and `TRUNCATE` on `activity_log`. This protects against application bugs and ad-hoc SQL; the database *owner* can still drop the table, so it is tamper-*evident* storage for a personal tool, not a compliance control.
- **Unavailable services:** if the database is down, pages show a retry screen, forms show a recoverable message instead of crashing, and the search box shows "unavailable · Retry" (and an offline notice). `GET /api/health` reports database status (used by the compose healthcheck).
- **Forms:** after a successful save the page does a full reload/navigation rather than a client-side refresh. This was a deliberate choice: Next's client-side refresh paths dropped updates intermittently in testing, and a reload is deterministic for a local app. Costs: scroll position and half-typed text in *other* forms on the page are lost on save.

## Development

```bash
cp .env.example .env            # or run ./start.sh once, then `docker compose stop app backup`
docker compose up -d db         # Postgres on 127.0.0.1:5432
npm install
npm run db:migrate && npm run db:seed
npm run dev                     # http://localhost:3000
```

Scripts: `db:generate` (new migration from schema changes), `db:migrate`, `db:seed`, `backup`, `restore`, `typecheck`, `test`, `test:e2e`.

### Tests

```bash
npm test               # unit tests (vitest): CSV, import transformation, duplicates, merge, timeline, permissions, filenames
npx playwright install chromium   # once
npm run test:e2e       # end-to-end happy path
```

`test:e2e` builds the app and runs it against a **disposable database named `<your db>_e2e`** that it creates, wipes and re-seeds each run (it refuses to touch any database not ending in `_e2e`/`_test`). It needs Postgres reachable via `DATABASE_URL` (see above). The happy path: sign in → create company → contact → opportunity → move stage → log an email → add a task due today → see it on the agenda → global search → export CSV.

## Security notes

- No credentials are committed. `.env` is git-ignored; `start.sh` generates random secrets. The only fixed passwords in the repo are fixtures for the throwaway e2e database in `playwright.config.ts`.
- The app and Postgres listen on `127.0.0.1` only. To expose it on a network, put it behind your own HTTPS reverse proxy and set `COOKIE_SECURE=true`.
- `npm audit` reports advisories in `postcss`, which is bundled inside Next.js and only runs at build time on this project's own CSS. They are not reachable from user input.
