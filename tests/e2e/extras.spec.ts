// Smaller features from the pre-launch pass: sell-form draft, wanted alert, price hint, share and install.
import { expect, test } from "@playwright/test";
import { asFixture, chooseEvent } from "./helpers";

test("a half-filled Sell form is offered back after the tab is closed", async ({ browser }) => {
  const { page, context } = await asFixture(browser, "Rohan M");
  await page.goto("/sell");
  await expect(page.getByText("Pick up where you left off?")).toHaveCount(0);
  await chooseEvent(page, "Spring Fest: Night 2");
  await page.getByLabel("Price", { exact: true }).fill("640");
  await page.waitForTimeout(300);

  const again = await context.newPage(); // like reopening the site later
  await again.goto("/sell");
  await expect(again.getByText("Pick up where you left off?")).toBeVisible();
  await again.getByRole("button", { name: "Continue it" }).click();
  await expect(again.getByRole("combobox", { name: "Event" })).toHaveValue(/Spring Fest: Night 2/);
  await expect(again.getByLabel("Price", { exact: true })).toHaveValue("640");

  // "Start fresh" forgets it.
  const third = await context.newPage();
  await third.goto("/sell");
  await third.getByRole("button", { name: "Start fresh" }).click();
  await expect(third.getByText("Pick up where you left off?")).toHaveCount(0);
  const fourth = await context.newPage();
  await fourth.goto("/sell");
  await expect(fourth.getByText("Pick up where you left off?")).toHaveCount(0);
  await context.close();
});

test("events you wanted tickets for are flagged when some are up", async ({ browser }) => {
  const { page, context } = await asFixture(browser, "Rohan M");
  await page.goto("/events");
  await expect(page.getByText("Tickets are up for events you wanted")).toHaveCount(0);
  await page.goto("/events/spring-fest-night-2");
  const want = page.getByRole("button", { name: /I want a ticket|You're looking/ });
  if ((await want.getAttribute("aria-pressed")) !== "true") await want.click();
  await expect(page.getByRole("button", { name: /You're looking/ })).toBeVisible();
  await page.goto("/events");
  await expect(page.getByText("Tickets are up for events you wanted")).toBeVisible();
  await page.goto("/events/spring-fest-night-2");
  await page.getByRole("button", { name: /You're looking/ }).click(); // leave things as they were
  await expect(page.getByRole("button", { name: /I want a ticket/ })).toBeVisible();
  await context.close();
});
