-- Immutable activity log: the application (and any ad-hoc SQL) cannot edit or remove entries.
-- Note: the database owner can still DROP the table; this guards against accidents and app bugs.
CREATE OR REPLACE FUNCTION activity_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only (% blocked)', TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER activity_log_no_update_delete
  BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION activity_log_immutable();
--> statement-breakpoint
CREATE TRIGGER activity_log_no_truncate
  BEFORE TRUNCATE ON activity_log
  FOR EACH STATEMENT EXECUTE FUNCTION activity_log_immutable();
--> statement-breakpoint
-- Fast global search (ILIKE '%term%') via trigram indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX contacts_name_trgm ON contacts USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX contacts_email_trgm ON contacts USING gin (email gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX companies_name_trgm ON companies USING gin (name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX opportunities_name_trgm ON opportunities USING gin (name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX notes_body_trgm ON notes USING gin (body gin_trgm_ops);
