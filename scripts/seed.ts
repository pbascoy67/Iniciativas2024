import "./_env";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/db/schema";
import { addDays, todayISO } from "../src/lib/dates";
import { hashPassword } from "../src/lib/password";

const DEFAULT_STAGES = [
  { name: "Prospecto", probability: 10, kind: "open" },
  { name: "Calificado", probability: 25, kind: "open" },
  { name: "Propuesta", probability: 50, kind: "open" },
  { name: "Negociación", probability: 75, kind: "open" },
  { name: "Ganada", probability: 100, kind: "won" },
  { name: "Perdida", probability: 0, kind: "lost" },
] as const;

type Db = ReturnType<typeof drizzle<typeof s>>;

export async function seed(url = process.env.DATABASE_URL, opts: { demo?: boolean } = {}) {
  if (!url) throw new Error("DATABASE_URL no está definida (ver .env.example)");
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
    throw new Error("Define ADMIN_EMAIL y un ADMIN_PASSWORD real (12+ caracteres) en .env antes del primer inicio. ./start.sh lo hace por ti.");
  }
  const [admin] = await db.insert(s.users).values({ email, name: process.env.ADMIN_NAME || "Admin", role: "admin", passwordHash: await hashPassword(password) }).returning();
  await db.insert(s.activityLog).values({ actorName: "sistema", action: "user.create", entity: "user", entityId: admin.id, summary: `Creó al primer administrador ${email}` });
  console.log(`Usuario administrador creado: ${email}`);
}

async function demo(db: Db) {
  const [{ n: existing }] = await db.select({ n: count() }).from(s.contacts);
  const [{ n: existingCo }] = await db.select({ n: count() }).from(s.companies);
  if (existing > 0 || existingCo > 0) return console.log("La base de datos ya tiene datos; se omite el espacio de demostración.");
  const demoPw = process.env.DEMO_USERS_PASSWORD ?? "";
  if (demoPw.length < 12 || demoPw.startsWith("change-me")) throw new Error("Define DEMO_USERS_PASSWORD (12+ caracteres) en .env, o pon SEED_DEMO=false.");

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

  // [nombre, dominio, industry, phone, address]
  const companyRows: [string, string | null, string, string, string][] = [
    ["Northwind Traders", "northwind.example", "Alimentos al por mayor", "+1 206 555 0110", "410 Pike St, Seattle, WA"],
    ["Contoso Labs", "contoso-labs.example", "Biotecnología", "+1 617 555 0142", "1 Kendall Sq, Cambridge, MA"],
    ["Fabrikam Studio", "fabrikam.example", "Agencia de diseño", "+1 503 555 0177", "88 Burnside Ave, Portland, OR"],
    ["Tailspin Aviation", "tailspin.example", "Aeroespacial", "+1 316 555 0150", "Airport Rd 4, Wichita, KS"],
    ["Lakeview Dental Group", "lakeviewdental.example", "Salud", "+1 312 555 0123", "250 N Lake St, Chicago, IL"],
    ["Harbor & Pine Coffee", "harborpine.example", "Alimentos y bebidas", "+1 207 555 0191", "12 Wharf St, Portland, ME"],
    ["Summit Ridge Outfitters", "summitridge.example", "Comercio minorista", "+1 303 555 0108", "900 Pearl St, Boulder, CO"],
    ["Brightpath Learning", "brightpath.example", "Educación", "+1 512 555 0164", "301 Congress Ave, Austin, TX"],
    ["Copperline Logistics", "copperline.example", "Logística", "+1 602 555 0136", "77 Industrial Way, Phoenix, AZ"],
    ["Evergreen Property Partners", "evergreenpp.example", "Bienes raíces", "+1 415 555 0119", "500 Market St, San Francisco, CA"],
    ["Northwind Traders, Inc.", null, "Alimentos al por mayor", "", ""], // deliberate duplicate
  ];
  const cos = await db.insert(s.companies).values(companyRows.map(([name, domain, industry, phone, address], i) => ({ name, domain, industry, phone: phone || null, address: address || null, website: domain ? `https://${domain}` : null, ownerId: owners[i % 2] }))).returning();

  // [first, last, email, phone, title, companyIdx|null, owner]
  const contactRows: [string, string, string | null, string | null, string | null, number | null, number][] = [
    ["Dana", "Whitfield", "dana.whitfield@northwind.example", "206-555-0111", "Jefa de Compras", 0, 0],
    ["Marcus", "Oyelaran", "marcus@northwind.example", "206-555-0112", "Gerente de Operaciones", 0, 0],
    ["Priya", "Raman", "priya.raman@contoso-labs.example", "617-555-0143", "Vicepresidenta de Investigación", 1, 1],
    ["Tom", "Eriksen", "tom.eriksen@contoso-labs.example", null, "Gerente de Laboratorio", 1, 1],
    ["Lucía", "Fernández", "lucia@fabrikam.example", "503-555-0178", "Directora Creativa", 2, 0],
    ["Ben", "Hallworth", "ben@fabrikam.example", null, "Líder de Cuentas", 2, 0],
    ["Karen", "Doyle", "kdoyle@tailspin.example", "316-555-0151", "Directora de Adquisiciones", 3, 1],
    ["Hiro", "Tanaka", "hiro.tanaka@tailspin.example", "316-555-0152", "Ingeniero Jefe", 3, 1],
    ["Naomi", "Brooks", "naomi@lakeviewdental.example", "312-555-0124", "Gerente de Clínica", 4, 0],
    ["Dr. Elías", "Kowalski", "ekowalski@lakeviewdental.example", null, "Socio Director", 4, 0],
    ["Siobhan", "Keane", "siobhan@harborpine.example", "207-555-0192", "Propietaria", 5, 1],
    ["Jake", "Moreno", "jake@harborpine.example", null, "Encargado de Tienda", 5, 1],
    ["Aisha", "Rahman", "aisha@summitridge.example", "303-555-0109", "Compradora", 6, 0],
    ["Colin", "Park", "colin.park@summitridge.example", null, "Líder de Comercio Electrónico", 6, 0],
    ["Rosa", "Delgado", "rdelgado@brightpath.example", "512-555-0165", "Directora de Alianzas", 7, 1],
    ["Owen", "Fitzgerald", "owen@brightpath.example", null, "Líder de Currículo", 7, 1],
    ["Yusuf", "Demir", "yusuf@copperline.example", "602-555-0137", "Director de Operaciones", 8, 0],
    ["Mei", "Chen", "mei.chen@copperline.example", "602-555-0138", "Gerente de Flota", 8, 0],
    ["Graham", "Sutter", "gsutter@evergreenpp.example", "415-555-0120", "Socio Principal", 9, 1],
    ["Tessa", "Lindqvist", "tessa@evergreenpp.example", null, "Gestora de Activos", 9, 1],
    ["Noah", "Abernathy", "noah.abernathy@gmail.com", "555-010-4477", "Consultor independiente", null, 0],
    ["Grace", "Okafor", "grace.okafor@outlook.com", null, "Asesora", null, 1],
    // deliberate duplicates: same email (different case), and same name + company
    ["Dana", "W.", "Dana.Whitfield@Northwind.example", "+1 (206) 555-0111", null, 10, 0],
    ["Priya", "Raman", null, "617-555-0199", "VP de Investigación", 1, 1],
  ];
  const cts = await db.insert(s.contacts).values(contactRows.map(([firstName, lastName, email, phone, jobTitle, ci, o]) => ({
    firstName, lastName, email, phone, jobTitle, companyId: ci === null ? null : cos[ci].id, ownerId: owners[o],
  }))).returning();

  // [name, companyIdx, contactIdx, stage, value, closeInDays, owner]
  const oppRows: [string, number, number, string, number, number | null, number][] = [
    ["Northwind – contrato anual de suministro", 0, 0, "Negociación", 84000, 14, 0],
    ["Contoso – piloto de automatización de laboratorio", 1, 2, "Propuesta", 56000, 30, 1],
    ["Fabrikam – iguala de renovación de marca", 2, 4, "Calificado", 24000, 45, 0],
    ["Tailspin – portal de mantenimiento", 3, 6, "Prospecto", 120000, 90, 1],
    ["Lakeview – rediseño del ingreso de pacientes", 4, 8, "Propuesta", 38000, 21, 0],
    ["Harbor & Pine – pedidos en línea", 5, 10, "Calificado", 12500, 35, 1],
    ["Summit Ridge – sincronización de inventario", 6, 12, "Prospecto", 18000, 60, 0],
    ["Brightpath – portal de socios", 7, 14, "Negociación", 67000, 10, 1],
    ["Copperline – panel de flota", 8, 16, "Ganada", 45000, null, 0],
    ["Evergreen – aplicación para inquilinos", 9, 18, "Perdida", 30000, null, 1],
    ["Northwind – catálogo de temporada", 0, 1, "Prospecto", 9000, 75, 0],
    ["Fabrikam – rediseño de empaques", 2, 5, "Ganada", 15000, null, 0],
  ];
  const opps = await db.insert(s.opportunities).values(oppRows.map(([name, ci, ki, st, value, close, o]) => ({
    name, companyId: cos[ci].id, contactId: cts[ki].id, stageId: stage(st), valueCents: value * 100,
    expectedCloseDate: close === null ? null : addDays(today, close), ownerId: owners[o],
  }))).returning();

  // Tasks: [title, due offset (days), kind, index, owner, completedDaysAgo?]
  const taskRows: [string, number | null, "opp" | "contact", number, number, number?][] = [
    ["Enviar a Dana la lista de precios revisada", -2, "opp", 0, 0],
    ["Llamar a Dana para confirmar las condiciones de entrega", 0, "opp", 0, 0],
    ["Dar seguimiento con Priya al alcance del piloto", -5, "opp", 1, 1],
    ["Preparar la presentación de la propuesta para Fabrikam", 3, "opp", 2, 0],
    ["Agendar llamada de descubrimiento con Karen", 1, "opp", 3, 1],
    ["Reservar demostración del prototipo de ingreso", 0, "opp", 4, 0],
    ["Enviar opciones de integración del menú", 6, "opp", 5, 1],
    ["Obtener revisión legal del contrato marco de Brightpath", 2, "opp", 7, 1],
    ["Correo de presentación a Colin sobre acceso a la API", -1, "contact", 13, 0],
    ["Felicitar a Siobhan por su cumpleaños", 5, "contact", 10, 1],
    ["Consultar con Noah sobre la recomendación", 12, "contact", 20, 0],
    ["Enviar la agenda de arranque a Yusuf", null, "opp", 8, 0, 20],
    ["Enviar el contrato a Naomi", null, "opp", 4, 0, 6],
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
    ["email", "Re: Condiciones del suministro anual", "Dana confirmó los volúmenes del primer trimestre. Quiere pago a 45 días en lugar de 30. Le dije que volvería con precios.", 3, 0, 0, 0],
    ["meeting", "Revisión del contrato con Northwind", "Revisamos el borrador con Dana y Marcus. Pendientes: plazos de pago y acuerdos de nivel de entrega.", 8, 0, 0, 0],
    ["call", "Llamada de presentación – Marcus", "Perspectiva de operaciones sobre el catálogo de temporada. Interesado, pero ocupado hasta enero.", 16, 1, 10, 0],
    ["email", "Preguntas sobre el alcance del piloto", "Priya preguntó por la integración con su LIMS y quién es responsable de la validación.", 12, 2, 1, 1],
    ["meeting", "Taller de arranque del piloto", "Dos horas con Priya y Tom. Acordamos tres métricas de éxito.", 25, 2, 1, 1],
    ["email", "Renovación de marca – primer brief", "Lucía envió el brief y una presentación de referencia.", 9, 4, 2, 0],
    ["call", "Llamada de descubrimiento – Karen", "Las adquisiciones de Tailspin pasarán a un nuevo portal de proveedores en el segundo trimestre.", 30, 6, 3, 1],
    ["email", "Comentarios sobre el prototipo de ingreso", "A Naomi le gustó el flujo; quiere soporte en español.", 4, 8, 4, 0],
    ["meeting", "Demostración a interesados – Lakeview", "Demostración a Naomi y al Dr. Kowalski. Positiva; sigue la aprobación del presupuesto.", 11, 9, 4, 0],
    ["email", "Opciones de plataforma de pedidos", "Envié a Siobhan la comparación de tres enfoques.", 7, 10, 5, 1],
    ["call", "Llamada rápida – Aisha", "Consulta de precios sobre la sincronización de inventario; enviará datos de muestra.", 40, 12, 6, 0],
    ["email", "Portal de socios – cuestionario de seguridad", "Rosa devolvió el cuestionario completado.", 2, 14, 7, 1],
    ["meeting", "Negociación del contrato con Brightpath", "Negociamos los créditos por incumplimiento de nivel de servicio. Cerca de un acuerdo.", 6, 14, 7, 1],
    ["email", "Arranque programado", "Yusuf confirmó el arranque para el próximo martes.", 21, 16, 8, 0],
    ["email", "Gracias y próximos pasos", "Nota final tras el rechazo de la propuesta de la aplicación para inquilinos.", 33, 18, 9, 1],
    ["call", "Conversación sobre recomendaciones", "Noah podría presentarnos a dos clientes.", 18, 20, null, 0],
  ];
  await db.insert(s.interactions).values(interRows.map(([type, subject, body, d, ci, oi, o]) => ({
    type, subject, body, occurredAt: ago(d, 9 + (d % 8)), contactId: cts[ci].id, companyId: cts[ci].companyId, opportunityId: oi === null ? null : opps[oi].id, authorId: owners[o],
  })));

  const noteRows: [string, number, number | null][] = [
    ["Prefiere el correo al teléfono. Las mañanas son mejores para llamar.", 0, null],
    ["El presupuesto está aprobado para este año fiscal; quien decide es el director de operaciones.", 8, 7],
    ["Alérgico al maní: evitar la opción de almuerzo con catering.", 4, null],
    ["Competimos con un proveedor actual; es más barato pero lento en soporte.", 6, 3],
    ["El soporte en español es un requisito indispensable de parte de la clínica.", 8, 4],
    ["Presentado por Grace Okafor en la conferencia de marzo.", 20, null],
  ];
  await db.insert(s.notes).values(noteRows.map(([body, ci, oi], i) => ({
    body, contactId: cts[ci].id, companyId: cts[ci].companyId, opportunityId: oi === null ? null : opps[oi].id, authorId: owners[i % 2],
  })));

  await db.insert(s.savedViews).values([
    { entity: "opportunities", name: "Abiertas", filters: { status: "open" }, ownerId: admin.id, shared: true },
    { entity: "tasks", name: "Vencidas", filters: { status: "overdue" }, ownerId: admin.id, shared: true },
    { entity: "contacts", name: "Gente de Northwind", filters: { q: "northwind" }, ownerId: admin.id, shared: true },
  ]);
  await db.insert(s.activityLog).values({ actorName: "sistema", action: "seed.demo", entity: "system", summary: "Cargó el espacio de demostración" });
  console.log(`Espacio de demostración cargado: ${cos.length} empresas, ${cts.length} contactos, ${opps.length} oportunidades. Usuarios demo: alex@example.com (miembro), sam@example.com (solo lectura).`);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed().catch((e) => {
    console.error("Falló la carga inicial:", e.message);
    process.exit(1);
  });
}
