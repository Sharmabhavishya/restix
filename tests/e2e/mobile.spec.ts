import { expect, test } from "@playwright/test";

test("phone: landing has no sideways scroll and the app menu folds into a sheet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.goto("/sign-in");
  await page.getByRole("button", { name: /^Rohan M/ }).click();
  await expect(page).toHaveURL(/\/tickets/);
  const overflowApp = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowApp).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: /Open menu/ }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Events" }).click();
  await expect(page).toHaveURL(/\/events/);
  await expect(menu).toBeHidden();
});
