import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "member", "viewer"]);
export const stageKindEnum = pgEnum("stage_kind", ["open", "won", "lost"]);
export const interactionTypeEnum = pgEnum("interaction_type", ["email", "meeting", "call"]);

const ts = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("member"),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at"),
});

export const sessions = pgTable("sessions", {
  /** sha256 of the cookie token; the raw token is never stored. */
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    domain: text("domain"),
    website: text("website"),
    phone: text("phone"),
    industry: text("industry"),
    address: text("address"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("companies_owner_idx").on(t.ownerId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    email: text("email"),
    phone: text("phone"),
    jobTitle: text("job_title"),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("contacts_company_idx").on(t.companyId), index("contacts_owner_idx").on(t.ownerId)],
);

export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  /** Win probability 0-100, informational only (no forecasting engine). */
  probability: integer("probability").notNull().default(0),
  kind: stageKindEnum("kind").notNull().default("open"),
});

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    stageId: uuid("stage_id").notNull().references(() => pipelineStages.id, { onDelete: "restrict" }),
    valueCents: bigint("value_cents", { mode: "number" }).notNull().default(0),
    expectedCloseDate: date("expected_close_date", { mode: "string" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("opps_stage_idx").on(t.stageId), index("opps_company_idx").on(t.companyId)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    body: text("body").notNull(),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at"),
  },
  (t) => [index("notes_contact_idx").on(t.contactId), index("notes_company_idx").on(t.companyId), index("notes_opp_idx").on(t.opportunityId)],
);

export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: interactionTypeEnum("type").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at"),
  },
  (t) => [index("inter_contact_idx").on(t.contactId), index("inter_company_idx").on(t.companyId), index("inter_opp_idx").on(t.opportunityId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at"),
  },
  (t) => [index("tasks_due_idx").on(t.dueDate), index("tasks_opp_idx").on(t.opportunityId)],
);

export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  entity: text("entity").notNull(),
  name: text("name").notNull(),
  filters: jsonb("filters").$type<Record<string, string>>().notNull(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
  shared: boolean("shared").notNull().default(false),
  createdAt: ts("created_at"),
});

/** Append-only. UPDATE/DELETE/TRUNCATE are rejected by triggers (see drizzle/0001_*.sql). */
export const activityLog = pgTable("activity_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: ts("at"),
  actorId: uuid("actor_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>(),
});
