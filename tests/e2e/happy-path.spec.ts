import { expect, test, type Page } from "@playwright/test";

// Streaming SSR briefly keeps a hidden copy of a page's content next to the visible one, so these
// helpers always target the first *visible* match instead of tripping Playwright's strict mode.
const label = (page: Page, text: string) => page.getByLabel(text).locator("visible=true").first();
const text = (page: Page, t: string) => page.getByText(t).locator("visible=true").first();
const heading = (page: Page, name: string | RegExp) => page.getByRole("heading", { name }).locator("visible=true").first();
const button = (page: Page, name: string) => page.getByRole("button", { name }).locator("visible=true").first();
const link = (page: Page, name: string) => page.getByRole("link", { name }).locator("visible=true").first();

test("core loop: company → contact → deal → stage move → logged email → task → agenda → search → export", async ({ page }) => {
  // sign in
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await label(page, "Email").fill("admin@example.com");
  await label(page, "Password").fill("e2e-admin-password-1");
  await button(page, "Sign in").click();
  await expect(heading(page, "Today")).toBeVisible();
  // seeded demo data is on the agenda
  await expect(text(page, "Send revised pricing to Dana")).toBeVisible();

  // company
  await page.goto("/companies/new");
  await label(page, "Name").fill("Zephyr Robotics");
  await button(page, "Create company").click();
  await expect(heading(page, "Zephyr Robotics")).toBeVisible();
  await expect(text(page, "Company created")).toBeVisible();

  // contact, linked to the company
  await link(page, "Add contact").click();
  await label(page, "First name").fill("Ada");
  await label(page, "Last name").fill("Quinn");
  await label(page, "Email").fill("ada@zephyr.example");
  await expect(label(page, "Company")).toHaveValue(/.+/); // pre-selected from the company page
  await button(page, "Create contact").click();
  await expect(heading(page, "Ada Quinn")).toBeVisible();

  // opportunity from the contact
  await link(page, "New opportunity").click();
  await label(page, "Name").fill("Zephyr – pilot");
  await label(page, "Value").fill("15,000");
  await button(page, "Create opportunity").click();
  await expect(heading(page, "Zephyr – pilot")).toBeVisible();
  await expect(text(page, "No next action scheduled")).toBeVisible();

  // move through the pipeline
  await label(page, "Stage").selectOption({ label: "Qualified" });
  await button(page, "Move").click();
  await expect(text(page, "Stage changed: Lead → Qualified")).toBeVisible();

  // log an email on the contact's timeline
  await link(page, "Ada Quinn").click();
  await text(page, "Log an email, meeting or call").click();
  await label(page, "Subject").fill("Intro and pricing question");
  await label(page, "Details").fill("Ada asked whether the pilot includes on-site setup.");
  await button(page, "Log it").click();
  await expect(page.locator(".tl").getByText("Intro and pricing question")).toBeVisible();
  await expect(text(page, "Email logged")).toBeVisible();

  // next action due today surfaces on the daily agenda
  await text(page, "Add a task / next action").click();
  await label(page, "What needs to happen?").fill("Send Ada the pricing sheet");
  await label(page, "Due").fill(new Date().toISOString().slice(0, 10));
  await button(page, "Add task").click();
  await expect(page.locator(".task").getByText("Send Ada the pricing sheet")).toBeVisible();
  await page.goto("/");
  await expect(heading(page, /Due today/)).toBeVisible();
  await expect(text(page, "Send Ada the pricing sheet")).toBeVisible();

  // global search
  await page.getByRole("searchbox").fill("zephyr");
  await expect(page.getByRole("listbox").getByText("Ada Quinn")).toBeVisible();

  // export contains the new contact, with a safe filename
  const res = await page.request.get("/api/export/contacts");
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-disposition"]).toMatch(/filename="crm-contacts-\d{4}-\d{2}-\d{2}\.csv"/);
  expect(await res.text()).toContain("ada@zephyr.example");
});
