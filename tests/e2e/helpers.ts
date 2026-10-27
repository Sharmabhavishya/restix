import { expect, type Browser, type Page } from "@playwright/test";

/** Signs in through the local development form (the real Google flow can't run in CI). */
export async function signIn(page: Page, email: string, name?: string, opts: { unverified?: boolean } = {}) {
  await page.goto("/sign-in");
  await page.getByLabel("Any email").fill(email);
  if (name) await page.getByLabel(/^Name/).fill(name);
  if (opts.unverified) await page.getByLabel("Pretend the email is unverified").check();
  await page.getByRole("button", { name: "Sign in locally" }).click();
}

/** A fresh browser context signed in as a seeded fixture user. */
export async function asFixture(browser: Browser, who: "Asha K" | "Rohan M" | "Meera (moderator)") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: new RegExp(`^${who.replace(/[()]/g, "\\$&")}`) }).click();
  await expect(page).toHaveURL(/\/tickets/);
  return { context, page };
}

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@snu.edu.in`;
}

/** Selects the <option> whose visible text contains `text` (selectOption needs exact labels). */
export async function selectByText(page: Page, label: string, text: string) {
  const select = page.getByLabel(label, { exact: true });
  const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
  if (!value) throw new Error(`No option containing "${text}" in ${label}`);
  await select.selectOption(value);
}
