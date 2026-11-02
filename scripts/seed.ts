import "./_env";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/db/schema";
import { addDays, todayISO } from "../src/lib/dates";
import { hashPassword } from "../src/lib/password";

const DEFAULT_STAGES = [
  { name: "Lead", probability: 10, kind: "open" },
  { name: "Qualified", probability: 25, kind: "open" },
  { name: "Proposal", probability: 50, kind: "open" },
  { name: "Negotiation", probability: 75, kind: "open" },
  { name: "Won", probability: 100, kind: "won" },
  { name: "Lost", probability: 0, kind: "lost" },
] as const;

type Db = ReturnType<typeof drizzle<typeof s>>;

export async function seed(url = process.env.DATABASE_URL, opts: { demo?: boolean } = {}) {
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema: s });
  try {
    await bootstrap(db);
    if (opts.demo ?? process.env.SEED_DEMO === "true") await demo(db);
  } finally {
    await client.end();
  }
}

async function bootstrap(db: Db) {
  const [{ n: stageCount }] = await db.select({ n: count() }).from(s.pipelineStages);
  if (stageCount === 0) await db.insert(s.pipelineStages).values(DEFAULT_STAGES.map((st, position) => ({ ...st, position })));

  const [{ n: userCount }] = await db.select({ n: count() }).from(s.users);
  if (userCount > 0) return;
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 12 || password.startsWith("change-me")) {
    throw new Error("Set ADMIN_EMAIL and a real ADMIN_PASSWORD (12+ characters) in .env before first start. ./start.sh does this for you.");
  }
  const [admin] = await db.insert(s.users).values({ email, name: process.env.ADMIN_NAME || "Admin", role: "admin", passwordHash: await hashPassword(password) }).returning();
  await db.insert(s.activityLog).values({ actorName: "system", action: "user.create", entity: "user", entityId: admin.id, summary: `Created first admin ${email}` });
  console.log(`Created admin user ${email}`);
}

async function demo(db: Db) {
  const [{ n: existing }] = await db.select({ n: count() }).from(s.contacts);
  const [{ n: existingCo }] = await db.select({ n: count() }).from(s.companies);
  if (existing > 0 || existingCo > 0) return console.log("Database already has data; skipping demo workspace.");
  const demoPw = process.env.DEMO_USERS_PASSWORD ?? "";
  if (demoPw.length < 12 || demoPw.startsWith("change-me")) throw new Error("Set DEMO_USERS_PASSWORD (12+ characters) in .env, or set SEED_DEMO=false.");

  const [admin] = await db.select().from(s.users).limit(1);
  const hash = await hashPassword(demoPw);
  const [alex, sam] = await db.insert(s.users).values([
    { email: "alex@example.com", name: "Alex Rivera", role: "member", passwordHash: hash },
    { email: "sam@example.com", name: "Sam Patel", role: "viewer", passwordHash: hash },
  ]).onConflictDoNothing().returning();
  void sam;
  const owners = [admin.id, alex?.id ?? admin.id];
  const stages = await db.select().from(s.pipelineStages).orderBy(s.pipelineStages.position);
  const stage = (name: string) => stages.find((x) => x.name === name)!.id;

  const today = todayISO();
  const ago = (d: number, hour = 10) => { const t = new Date(`${addDays(today, -d)}T${String(hour).padStart(2, "0")}:00:00Z`); return t; };

  // [name, domain, industry, phone, address]
  const companyRows: [string, string | null, string, string, string][] = [
    ["Northwind Traders", "northwind.example", "Wholesale food", "+1 206 555 0110", "410 Pike St, Seattle, WA"],
    ["Contoso Labs", "contoso-labs.example", "Biotech", "+1 617 555 0142", "1 Kendall Sq, Cambridge, MA"],
    ["Fabrikam Studio", "fabrikam.example", "Design agency", "+1 503 555 0177", "88 Burnside Ave, Portland, OR"],
    ["Tailspin Aviation", "tailspin.example", "Aerospace", "+1 316 555 0150", "Airport Rd 4, Wichita, KS"],
    ["Lakeview Dental Group", "lakeviewdental.example", "Healthcare", "+1 312 555 0123", "250 N Lake St, Chicago, IL"],
    ["Harbor & Pine Coffee", "harborpine.example", "Food & beverage", "+1 207 555 0191", "12 Wharf St, Portland, ME"],
    ["Summit Ridge Outfitters", "summitridge.example", "Retail", "+1 303 555 0108", "900 Pearl St, Boulder, CO"],
    ["Brightpath Learning", "brightpath.example", "Education", "+1 512 555 0164", "301 Congress Ave, Austin, TX"],
    ["Copperline Logistics", "copperline.example", "Logistics", "+1 602 555 0136", "77 Industrial Way, Phoenix, AZ"],
    ["Evergreen Property Partners", "evergreenpp.example", "Real estate", "+1 415 555 0119", "500 Market St, San Francisco, CA"],
    ["Northwind Traders, Inc.", null, "Wholesale food", "", ""], // deliberate duplicate
  ];
  const cos = await db.insert(s.companies).values(companyRows.map(([name, domain, industry, phone, address], i) => ({ name, domain, industry, phone: phone || null, address: address || null, website: domain ? `https://${domain}` : null, ownerId: owners[i % 2] }))).returning();

  // [first, last, email, phone, title, companyIdx|null, owner]
  const contactRows: [string, string, string | null, string | null, string | null, number | null, number][] = [
    ["Dana", "Whitfield", "dana.whitfield@northwind.example", "206-555-0111", "Head of Purchasing", 0, 0],
    ["Marcus", "Oyelaran", "marcus@northwind.example", "206-555-0112", "Operations Manager", 0, 0],
    ["Priya", "Raman", "priya.raman@contoso-labs.example", "617-555-0143", "VP Research", 1, 1],
    ["Tom", "Eriksen", "tom.eriksen@contoso-labs.example", null, "Lab Manager", 1, 1],
    ["Lucía", "Fernández", "lucia@fabrikam.example", "503-555-0178", "Creative Director", 2, 0],
    ["Ben", "Hallworth", "ben@fabrikam.example", null, "Account Lead", 2, 0],
    ["Karen", "Doyle", "kdoyle@tailspin.example", "316-555-0151", "Procurement Director", 3, 1],
    ["Hiro", "Tanaka", "hiro.tanaka@tailspin.example", "316-555-0152", "Chief Engineer", 3, 1],
    ["Naomi", "Brooks", "naomi@lakeviewdental.example", "312-555-0124", "Practice Manager", 4, 0],
    ["Dr. Elias", "Kowalski", "ekowalski@lakeviewdental.example", null, "Managing Partner", 4, 0],
    ["Siobhan", "Keane", "siobhan@harborpine.example", "207-555-0192", "Owner", 5, 1],
    ["Jake", "Moreno", "jake@harborpine.example", null, "Store Manager", 5, 1],
    ["Aisha", "Rahman", "aisha@summitridge.example", "303-555-0109", "Buyer", 6, 0],
    ["Colin", "Park", "colin.park@summitridge.example", null, "E-commerce Lead", 6, 0],
    ["Rosa", "Delgado", "rdelgado@brightpath.example", "512-555-0165", "Director of Partnerships", 7, 1],
    ["Owen", "Fitzgerald", "owen@brightpath.example", null, "Curriculum Lead", 7, 1],
    ["Yusuf", "Demir", "yusuf@copperline.example", "602-555-0137", "COO", 8, 0],
    ["Mei", "Chen", "mei.chen@copperline.example", "602-555-0138", "Fleet Manager", 8, 0],
    ["Graham", "Sutter", "gsutter@evergreenpp.example", "415-555-0120", "Principal", 9, 1],
    ["Tessa", "Lindqvist", "tessa@evergreenpp.example", null, "Asset Manager", 9, 1],
    ["Noah", "Abernathy", "noah.abernathy@gmail.com", "555-010-4477", "Freelance consultant", null, 0],
    ["Grace", "Okafor", "grace.okafor@outlook.com", null, "Advisor", null, 1],
    // deliberate duplicates: same email (different case), and same name + company
    ["Dana", "W.", "Dana.Whitfield@Northwind.example", "+1 (206) 555-0111", null, 10, 0],
    ["Priya", "Raman", null, "617-555-0199", "Research VP", 1, 1],
  ];
  const cts = await db.insert(s.contacts).values(contactRows.map(([firstName, lastName, email, phone, jobTitle, ci, o]) => ({
    firstName, lastName, email, phone, jobTitle, companyId: ci === null ? null : cos[ci].id, ownerId: owners[o],
  }))).returning();

  // [name, companyIdx, contactIdx, stage, value, closeInDays, owner]
  const oppRows: [string, number, number, string, number, number | null, number][] = [
    ["Northwind – annual supply contract", 0, 0, "Negotiation", 84000, 14, 0],
    ["Contoso – lab automation pilot", 1, 2, "Proposal", 56000, 30, 1],
    ["Fabrikam – brand refresh retainer", 2, 4, "Qualified", 24000, 45, 0],
    ["Tailspin – maintenance portal", 3, 6, "Lead", 120000, 90, 1],
    ["Lakeview – patient intake rebuild", 4, 8, "Proposal", 38000, 21, 0],
    ["Harbor & Pine – online ordering", 5, 10, "Qualified", 12500, 35, 1],
    ["Summit Ridge – inventory sync", 6, 12, "Lead", 18000, 60, 0],
    ["Brightpath – partner portal", 7, 14, "Negotiation", 67000, 10, 1],
    ["Copperline – fleet dashboard", 8, 16, "Won", 45000, null, 0],
    ["Evergreen – tenant app", 9, 18, "Lost", 30000, null, 1],
    ["Northwind – seasonal catalog", 0, 1, "Lead", 9000, 75, 0],
    ["Fabrikam – packaging redesign", 2, 5, "Won", 15000, null, 0],
  ];
  const opps = await db.insert(s.opportunities).values(oppRows.map(([name, ci, ki, st, value, close, o]) => ({
    name, companyId: cos[ci].id, contactId: cts[ki].id, stageId: stage(st), valueCents: value * 100,
    expectedCloseDate: close === null ? null : addDays(today, close), ownerId: owners[o],
  }))).returning();

  // Tasks: [title, due offset (days), kind, index, owner, completedDaysAgo?]
  const taskRows: [string, number | null, "opp" | "contact", number, number, number?][] = [
    ["Send revised pricing to Dana", -2, "opp", 0, 0],
    ["Call Dana to confirm delivery terms", 0, "opp", 0, 0],
    ["Follow up on pilot scope with Priya", -5, "opp", 1, 1],
    ["Prepare proposal deck for Fabrikam", 3, "opp", 2, 0],
    ["Schedule discovery call with Karen", 1, "opp", 3, 1],
    ["Book demo of intake prototype", 0, "opp", 4, 0],
    ["Send menu integration options", 6, "opp", 5, 1],
    ["Get legal review of Brightpath MSA", 2, "opp", 7, 1],
    ["Intro email to Colin about API access", -1, "contact", 13, 0],
    ["Wish Siobhan happy birthday", 5, "contact", 10, 1],
    ["Check in with Noah about referral", 12, "contact", 20, 0],
    ["Send kickoff agenda to Yusuf", null, "opp", 8, 0, 20],
    ["Send contract to Naomi", null, "opp", 4, 0, 6],
  ];
  await db.insert(s.tasks).values(taskRows.map(([title, due, kind, idx, o, done]) => ({
    title, dueDate: due === null ? null : addDays(today, due),
    completedAt: done ? ago(done) : null,
    opportunityId: kind === "opp" ? opps[idx].id : null,
    contactId: kind === "contact" ? cts[idx].id : kind === "opp" ? oppRows[idx][2] !== undefined ? cts[oppRows[idx][2]].id : null : null,
    companyId: kind === "opp" ? cos[oppRows[idx][1]].id : cts[idx].companyId,
    ownerId: owners[o],
  })));

  // Interactions: [type, subject, body, daysAgo, contactIdx, oppIdx|null, owner]
  const interRows: ["email" | "meeting" | "call", string, string, number, number, number | null, number][] = [
    ["email", "Re: Annual supply terms", "Dana confirmed volumes for Q1. Wants net-45 instead of net-30. I said I'd come back with pricing.", 3, 0, 0, 0],
    ["meeting", "Contract review with Northwind", "Walked through the draft with Dana and Marcus. Open items: payment terms, delivery SLAs.", 8, 0, 0, 0],
    ["call", "Intro call – Marcus", "Ops perspective on the seasonal catalog. Interested but busy until January.", 16, 1, 10, 0],
    ["email", "Pilot scope questions", "Priya asked about integration with their LIMS and who owns validation.", 12, 2, 1, 1],
    ["meeting", "Pilot kickoff workshop", "Two hours with Priya and Tom. Agreed on three success metrics.", 25, 2, 1, 1],
    ["email", "Brand refresh – first brief", "Lucía sent the brief and a reference deck.", 9, 4, 2, 0],
    ["call", "Discovery call – Karen", "Tailspin's procurement is moving to a new vendor portal in Q2.", 30, 6, 3, 1],
    ["email", "Intake prototype feedback", "Naomi liked the flow; wants Spanish-language support.", 4, 8, 4, 0],
    ["meeting", "Stakeholder demo – Lakeview", "Demo to Naomi and Dr. Kowalski. Positive; budget approval next.", 11, 9, 4, 0],
    ["email", "Ordering platform options", "Sent comparison of three approaches to Siobhan.", 7, 10, 5, 1],
    ["call", "Quick call – Aisha", "Pricing question on inventory sync; will send sample data.", 40, 12, 6, 0],
    ["email", "Partner portal – security questionnaire", "Rosa returned the completed questionnaire.", 2, 14, 7, 1],
    ["meeting", "Brightpath contract negotiation", "Haggled over SLA credits. Close to agreement.", 6, 14, 7, 1],
    ["email", "Kickoff scheduled", "Yusuf confirmed kickoff for next Tuesday.", 21, 16, 8, 0],
    ["email", "Thanks and next steps", "Final note after the tenant app proposal was declined.", 33, 18, 9, 1],
    ["call", "Referral chat", "Noah may introduce us to two clients.", 18, 20, null, 0],
  ];
  await db.insert(s.interactions).values(interRows.map(([type, subject, body, d, ci, oi, o]) => ({
    type, subject, body, occurredAt: ago(d, 9 + (d % 8)), contactId: cts[ci].id, companyId: cts[ci].companyId, opportunityId: oi === null ? null : opps[oi].id, authorId: owners[o],
  })));

  const noteRows: [string, number, number | null][] = [
    ["Prefers email over phone. Mornings are best for calls.", 0, null],
    ["Budget is approved for this fiscal year; decision-maker is the COO.", 8, 7],
    ["Allergic to peanuts — avoid the catered lunch option.", 4, null],
    ["Competing with an incumbent vendor; they are cheaper but slow on support.", 6, 3],
    ["Spanish-language support is a hard requirement from the practice side.", 8, 4],
    ["Introduced by Grace Okafor at the March conference.", 20, null],
  ];
  await db.insert(s.notes).values(noteRows.map(([body, ci, oi], i) => ({
    body, contactId: cts[ci].id, companyId: cts[ci].companyId, opportunityId: oi === null ? null : opps[oi].id, authorId: owners[i % 2],
  })));

  await db.insert(s.savedViews).values([
    { entity: "opportunities", name: "Closing soon", filters: { status: "open" }, ownerId: admin.id, shared: true },
    { entity: "tasks", name: "Overdue", filters: { status: "overdue" }, ownerId: admin.id, shared: true },
    { entity: "contacts", name: "Northwind people", filters: { q: "northwind" }, ownerId: admin.id, shared: true },
  ]);
  await db.insert(s.activityLog).values({ actorName: "system", action: "seed.demo", entity: "system", summary: "Seeded demo workspace" });
  console.log(`Seeded demo workspace: ${cos.length} companies, ${cts.length} contacts, ${opps.length} opportunities. Demo users: alex@example.com (member), sam@example.com (viewer).`);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed().catch((e) => {
    console.error("Seed failed:", e.message);
    process.exit(1);
  });
}
