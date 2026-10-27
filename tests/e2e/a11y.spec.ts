// Automated accessibility checks (axe-core, WCAG 2.1 A/AA rules) on the main pages.
// Automated tools catch roughly a third of issues; keyboard and screen-reader checks are separate.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { asFixture } from "./helpers";

async function scan(page: Page, path: string) {
  // Reduced motion keeps scroll-entrance content visible, so axe checks the whole page.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}x ${v.nodes[0]?.target.join(" ")} — ${v.help}`);
  expect(summary, `${path}\n${summary.join("\n")}`).toEqual([]);
}

test("public pages", async ({ page }) => {
  for (const path of ["/", "/sign-in", "/safety", "/privacy", "/terms", "/nope-404"]) await scan(page, path);
});

test("student pages", async ({ browser }) => {
  const { page, context } = await asFixture(browser, "Asha K");
  for (const path of ["/tickets", "/events", "/events/spring-fest-night-2", "/sell", "/selling", "/inquiries", "/account"]) {
    await scan(page, path);
  }
  await page.goto("/selling");
  await page.locator('a[href^="/listings/"]').first().click();
  await page.waitForURL(/\/listings\//);
  await scan(page, page.url().replace(/^https?:\/\/[^/]+/, ""));
  await context.close();
});

test("moderator pages", async ({ browser }) => {
  const { page, context } = await asFixture(browser, "Meera (moderator)");
  for (const path of ["/admin", "/admin/reviews", "/admin/appeals", "/admin/events", "/admin/events/new", "/admin/users", "/admin/audit", "/admin/analytics"]) {
    await scan(page, path);
  }
  await context.close();
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("public and student pages keep contrast in dark mode", async ({ page, browser }) => {
    for (const path of ["/", "/sign-in", "/safety"]) await scan(page, path);
    const { page: student, context } = await asFixture(browser, "Asha K");
    await student.emulateMedia({ colorScheme: "dark" });
    for (const path of ["/tickets", "/events", "/sell", "/inquiries", "/account", "/selling"]) await scan(student, path);
    await context.close();
  });

  test("moderator pages keep contrast in dark mode", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Meera (moderator)");
    await page.emulateMedia({ colorScheme: "dark" });
    for (const path of ["/admin", "/admin/events", "/admin/analytics", "/admin/audit"]) await scan(page, path);
    await context.close();
  });
});
