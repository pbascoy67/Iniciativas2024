import { expect, test, type Page } from "@playwright/test";

// El render por streaming deja brevemente una copia oculta del contenido junto a la visible, así que
// estos ayudantes apuntan siempre a la primera coincidencia *visible* en vez de chocar con el modo estricto.
const label = (page: Page, text: string) => page.getByLabel(text).locator("visible=true").first();
const text = (page: Page, t: string) => page.getByText(t).locator("visible=true").first();
const heading = (page: Page, name: string | RegExp) => page.getByRole("heading", { name }).locator("visible=true").first();
const button = (page: Page, name: string) => page.getByRole("button", { name }).locator("visible=true").first();
const link = (page: Page, name: string) => page.getByRole("link", { name }).locator("visible=true").first();

test("flujo principal: empresa → contacto → oportunidad → cambio de etapa → correo registrado → tarea → agenda → búsqueda → exportación", async ({ page }) => {
  // iniciar sesión
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await label(page, "Correo").fill("admin@example.com");
  await label(page, "Contraseña").fill("e2e-admin-password-1");
  await button(page, "Iniciar sesión").click();
  await expect(heading(page, "Hoy")).toBeVisible();
  // los datos de demostración aparecen en la agenda
  await expect(text(page, "Enviar a Dana la lista de precios revisada")).toBeVisible();

  // empresa
  await page.goto("/companies/new");
  await label(page, "Nombre").fill("Zephyr Robotics");
  await button(page, "Crear empresa").click();
  await expect(heading(page, "Zephyr Robotics")).toBeVisible();
  await expect(text(page, "Empresa creada")).toBeVisible();

  // contacto, vinculado a la empresa
  await link(page, "Agregar contacto").click();
  await label(page, "Nombre").fill("Ada");
  await label(page, "Apellido").fill("Quinn");
  await label(page, "Correo").fill("ada@zephyr.example");
  await expect(label(page, "Empresa")).toHaveValue(/.+/); // preseleccionada desde la página de la empresa
  await button(page, "Crear contacto").click();
  await expect(heading(page, "Ada Quinn")).toBeVisible();

  // oportunidad desde el contacto
  await link(page, "Nueva oportunidad").click();
  await label(page, "Nombre").fill("Zephyr – piloto");
  await label(page, "Valor").fill("15.000");
  await button(page, "Crear oportunidad").click();
  await expect(heading(page, "Zephyr – piloto")).toBeVisible();
  await expect(text(page, "No hay una próxima acción programada")).toBeVisible();

  // avanzar en el embudo
  await label(page, "Etapa").selectOption({ label: "Calificado" });
  await button(page, "Mover").click();
  await expect(text(page, "Cambio de etapa: Prospecto → Calificado")).toBeVisible();

  // registrar un correo en la cronología del contacto
  await link(page, "Ada Quinn").click();
  await text(page, "Registrar un correo, reunión o llamada").click();
  await label(page, "Asunto").fill("Presentación y consulta de precios");
  await label(page, "Detalles").fill("Ada preguntó si el piloto incluye instalación en sitio.");
  await button(page, "Registrar").click();
  await expect(page.locator(".tl").getByText("Presentación y consulta de precios")).toBeVisible();
  await expect(text(page, "Correo registrado")).toBeVisible();

  // la próxima acción con vencimiento hoy aparece en la agenda diaria
  await text(page, "Agregar una tarea / próxima acción").click();
  await label(page, "¿Qué hay que hacer?").fill("Enviar a Ada la hoja de precios");
  await label(page, "Vence").fill(new Date().toISOString().slice(0, 10));
  await button(page, "Agregar tarea").click();
  await expect(page.locator(".task").getByText("Enviar a Ada la hoja de precios")).toBeVisible();
  await page.goto("/");
  await expect(heading(page, /Vencen hoy/)).toBeVisible();
  await expect(text(page, "Enviar a Ada la hoja de precios")).toBeVisible();

  // búsqueda global
  await page.getByRole("searchbox").fill("zephyr");
  await expect(page.getByRole("listbox").getByText("Ada Quinn")).toBeVisible();

  // la exportación incluye al nuevo contacto, con nombre de archivo seguro
  const res = await page.request.get("/api/export/contacts");
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-disposition"]).toMatch(/filename="crm-contacts-\d{4}-\d{2}-\d{2}\.csv"/);
  expect(await res.text()).toContain("ada@zephyr.example");
});
