import { expect, test } from "@playwright/test";
import { asFixture, selectByText, signIn, uniqueEmail } from "./helpers";

test.describe("who gets in", () => {
  test("rejects other domains and lookalikes, and keeps them out", async ({ page }) => {
    for (const email of ["someone@gmail.com", "x@snu.edu.in.evil.com", "x@evilsnu.edu.in"]) {
      await signIn(page, email);
      await expect(page).toHaveURL(/error=domain_not_allowed/);
      await expect(page.getByText(/That's not a snu.edu.in account/)).toBeVisible();
    }
    await page.goto("/tickets");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("rejects an unverified email", async ({ page }) => {
    await signIn(page, uniqueEmail("e2e.unverified"), undefined, { unverified: true });
    await expect(page).toHaveURL(/error=unverified_email/);
    await page.goto("/sell");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("sends signed-out visitors to sign in and back to where they were going", async ({ page }) => {
    await page.goto("/events");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fevents/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("a forged session cookie is ignored", async ({ page, context }) => {
    await context.addCookies([{ name: "restix_dev_session", value: "eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDMifQ.forged", url: "http://localhost:3100" }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("signing out ends the session", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Rohan M");
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).last().click();
    await expect(page).toHaveURL(/localhost:3100\/$/);
    await page.goto("/inquiries");
    await expect(page).toHaveURL(/\/sign-in/);
    await context.close();
  });
});

test.describe("rules and states", () => {
  test("prohibited events can't be listed; unknown ones go to review", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Rohan M");
    await page.goto("/sell");
    await selectByText(page, "Event", "Interface Design Workshop");
    await expect(page.getByText(/don't allow these tickets to be resold/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish listing" })).toBeDisabled();

    await selectByText(page, "Event", "Senior Prom");
    await page.getByLabel(/Asking price/).fill("900");
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByText(/Sent for a quick policy check/)).toBeVisible();
    await expect(page.getByText("In review").first()).toBeVisible();
    await context.close();
  });

  test("face-value events cap the price", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Rohan M");
    await page.goto("/sell");
    await selectByText(page, "Event", "Freshers' Party");
    await page.getByLabel(/Asking price/).fill("650");
    await page.getByLabel(/What you paid/).fill("500");
    await page.getByRole("button", { name: "Publish listing" }).click();
    await expect(page.getByText(/at or below face value/)).toBeVisible();
    await context.close();
  });

  test("cancelled events show as cancelled and can't be listed", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Rohan M");
    await page.goto("/events/hostel-football-final");
    await expect(page.getByText("This event was cancelled")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sell yours" })).toHaveCount(0);
    await context.close();
  });

  test("unknown pages and listings 404", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Rohan M");
    const res = await page.goto("/listings/00000000-0000-4000-8000-00000000dead");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("this page isn't on the list")).toBeVisible();
    await context.close();
  });

  test("a stale tab can't overwrite a newer listing version", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Asha K");
    await page.goto("/selling?tab=live");
    await page.locator('a[href^="/listings/"]').first().click();
    await page.waitForURL(/\/listings\/[0-9a-f-]{36}$/);
    const stale = await context.newPage();
    await stale.goto(page.url());
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText(/Paused/).first()).toBeVisible();
    await stale.getByRole("button", { name: "Mark sold" }).click();
    await expect(stale.getByText(/changed since you opened it/)).toBeVisible();
    await page.getByRole("button", { name: "Resume" }).click();
    await context.close();
  });
});

test.describe("endpoints", () => {
  test("analytics endpoint rejects junk and cross-site posts", async ({ request }) => {
    const headers = { origin: "http://localhost:3100" };
    expect((await request.post("/api/track", { data: { name: "drop_table" }, headers })).status()).toBe(400);
    expect((await request.post("/api/track", { data: { name: "listing_viewed", listingId: "not-a-uuid" }, headers })).status()).toBe(400);
    expect((await request.post("/api/track", { data: { name: "landing_viewed" }, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  });

  test("analytics endpoint refuses requests that aren't from the site itself", async ({ request }) => {
    // No Origin and no Sec-Fetch-Site: a script, not a browser on this site.
    expect((await request.post("/api/track", { data: { name: "landing_viewed" } })).status()).toBe(403);
  });

  test("sign-in never redirects off-site, whatever ?next= says", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Rohan M");
    for (const next of ["/.//evil.example", "/..//evil.example", "/%2e%2e//evil.example", "//evil.example", "https://evil.example"]) {
      await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
      expect(new URL(page.url()).host).toBe("localhost:3100");
    }
    await context.close();
  });

  test("a strict, nonce-based content security policy is sent", async ({ request }) => {
    const csp = (await request.get("/")).headers()["content-security-policy"] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  test("pages run without a single CSP violation", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Asha K");
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (/Content Security Policy|Refused to (execute|load|apply)/i.test(msg.text())) violations.push(msg.text());
    });
    for (const path of ["/", "/tickets", "/sell", "/inquiries", "/account", "/safety", "/does-not-exist"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    // Interactivity proves hydration ran under the policy.
    await page.goto("/sell");
    await page.getByLabel("Event", { exact: true }).selectOption({ index: 1 });
    await expect(page.getByRole("status").or(page.getByRole("alert")).first()).toBeVisible();
    expect(violations).toEqual([]);
    await context.close();
  });

  test("maintenance cron needs its secret", async ({ request }) => {
    expect((await request.get("/api/cron/maintenance")).status()).toBe(401);
    expect((await request.get("/api/cron/maintenance", { headers: { authorization: "Bearer wrong-secret-wrong-secret" } })).status()).toBe(401);
    const ok = await request.get("/api/cron/maintenance", { headers: { authorization: "Bearer e2e-cron-secret-0123456789" } });
    expect(ok.status()).toBe(200);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });

  test("public pages are indexable, private ones are not", async ({ page, request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    await page.goto("/safety");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);
    await page.goto("/sign-in");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("keyboard", () => {
  test("skip link and focus order work on app pages", async ({ browser }) => {
    const { page, context } = await asFixture(browser, "Rohan M");
    await page.goto("/tickets");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main/);
    await context.close();
  });
});
