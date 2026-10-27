import { expect, test, type Page } from "@playwright/test";

/** Visible text that runs past the right edge, even when a wrapper clips the overflow. */
async function clippedText(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, p, a, button, label, li span"))) {
      if (el.closest("[aria-hidden='true']")) continue; // decorative crops are intentional
      // Rows designed to scroll sideways (chip filters) are fine; the page itself must not.
      let scroller: HTMLElement | null = el.parentElement;
      while (scroller && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowX)) scroller = scroller.parentElement;
      if (scroller && scroller !== document.documentElement) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > width + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    return out;
  });
}

test("phone: nothing runs off the screen, and the app menu folds into a sheet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(await clippedText(page)).toEqual([]);

  await page.goto("/sign-in");
  await page.getByRole("button", { name: /^Rohan M/ }).click();
  await expect(page).toHaveURL(/\/tickets/);
  for (const path of ["/tickets", "/sell", "/inquiries", "/account", "/events"]) {
    await page.goto(path);
    const overflowApp = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowApp, path).toBeLessThanOrEqual(1);
    expect(await clippedText(page), path).toEqual([]);
  }

  await page.goto("/tickets");
  await page.getByRole("button", { name: /Open menu/ }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Events" }).click();
  await expect(page).toHaveURL(/\/events/);
  await expect(menu).toBeHidden();
});
