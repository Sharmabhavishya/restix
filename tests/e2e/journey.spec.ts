// The master prompt's end-to-end journey, against the production build.
import { expect, test } from "@playwright/test";
import { asFixture, chooseEvent, signIn, uniqueEmail } from "./helpers";

/** datetime-local value `days` from now, in IST. */
function isoLocal(days: number) {
  const d = new Date(Date.now() + days * 86_400_000 + 5.5 * 3_600_000);
  return d.toISOString().slice(0, 16);
}

test("list a wristband, get contacted, sell, report, moderate, measure", async ({ browser, page }) => {
  // 0. A moderator adds a real (non-sample) event with a confirmed resale policy.
  const mod = await asFixture(browser, "Meera (moderator)");
  const eventName = `E2E Fest ${Date.now().toString(36)}`;
  await mod.page.goto("/admin/events/new");
  await mod.page.getByLabel("Name", { exact: true }).fill(eventName);
  await mod.page.getByLabel("Starts").fill(isoLocal(5));
  await mod.page.getByLabel(/^Ends/).fill(isoLocal(5.2));
  // No restriction chosen: open to resale at any price, the default.
  await expect(mod.page.getByLabel("Resale rule")).toBeHidden();
  // Tickets: what kind they are (wristbands), then levels. Try levels, then settle on one kind with a face value.
  await mod.page.getByText("Wristband", { exact: true }).click();
  await mod.page.getByRole("radio", { name: /Different levels/ }).click();
  await expect(mod.page.getByLabel("Level 1 name")).toHaveValue("Normal");
  await mod.page.getByRole("button", { name: "Fan pit" }).click(); // fills the empty second row
  await expect(mod.page.getByLabel("Level 2 name")).toHaveValue("Fan pit");
  await expect(mod.page.getByLabel("Level 3 name")).toHaveCount(0);
  await mod.page.getByRole("radio", { name: /One kind for everyone/ }).click();
  await expect(mod.page.getByLabel("Level 1 name")).toHaveCount(0);
  await mod.page.getByLabel(/^Face value/).fill("600");
  await mod.page.getByLabel("Reason for this change").fill("E2E test event");
  await mod.page.getByRole("button", { name: "Create event" }).click();
  await expect(mod.page.getByText(`Saved “${eventName}”.`)).toBeVisible();

  // 1-2. A new student signs in with an allowed, verified email and gets the name from their account.
  const sellerEmail = uniqueEmail("e2e.seller");
  await signIn(page, sellerEmail, "Tara S");
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByText("Tara S", { exact: true })).toBeVisible(); // name comes from the account
  await page.getByLabel(/I'll only list tickets I own/).check();
  await page.getByRole("button", { name: "Let's go" }).click();
  await expect(page).toHaveURL(/\/tickets/);

  // 3. Browse eligible events.
  await page.getByRole("link", { name: "Events", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(page.getByText("Spring Fest: Night 2")).toBeVisible();

  // 4. Create a wristband listing.
  await page.goto("/sell");
  await chooseEvent(page, eventName);
  // One kind of ticket: the form doesn't ask for a level, and the event already says they're wristbands.
  await expect(page.getByText("Which level?")).toHaveCount(0);
  await expect(page.getByText("Set by the event, so you don't need to pick.")).toBeVisible();
  // A seller with a different kind can still change it, and go back.
  await page.getByRole("button", { name: "Isn't this your ticket? Change it" }).click();
  await expect(page.getByRole("radio", { name: /Wristband/ })).toBeChecked();
  await page.getByRole("group", { name: "Kind of ticket", exact: true }).getByText("QR e-ticket", { exact: true }).click();
  await page.getByRole("button", { name: /Use the event's ticket type/ }).click();
  await expect(page.getByText("Set by the event, so you don't need to pick.")).toBeVisible();
  await page.getByLabel("Tickets", { exact: true }).fill("1");
  await page.getByLabel("Price", { exact: true }).fill("750");
  // Extras live in sections that stay shut until opened.
  await expect(page.getByLabel("Meetup spot")).toBeHidden();
  await page.getByText("Handover", { exact: true }).click();
  await page.getByLabel("Meetup spot").fill("Library steps");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\?saved=publish/);
  await expect(page.getByText("Your listing is live")).toBeVisible();
  const listingUrl = page.url().split("?")[0];

  // Public text can't carry contact details.
  await page.goto("/sell");
  await chooseEvent(page, "Spring Fest: Night 2");
  await page.getByLabel("Price", { exact: true }).fill("750");
  await page.getByText("Notes and timing", { exact: true }).click();
  await page.getByLabel("Anything else").fill("call me on 98765 43210");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.getByText(/Keep phone numbers, emails and social handles out/)).toBeVisible();

  // 5-6. Another eligible student finds it and contacts the seller.
  const buyer = await asFixture(browser, "Rohan M");
  await buyer.page.goto(`/tickets?q=${encodeURIComponent(eventName)}`);
  await expect(buyer.page.locator(`a[href="${new URL(listingUrl).pathname}"]`)).toBeVisible();
  await buyer.page.goto(listingUrl);
  await expect(buyer.page.getByText("Tara S", { exact: true }).first()).toBeVisible();
  await expect(buyer.page.getByText(sellerEmail)).toHaveCount(0); // email never shown
  await buyer.page.getByText("Add a note", { exact: true }).click();
  await buyer.page.getByLabel(/Message to Tara S/).fill("Hey! Can we meet at the library at 6?");
  await buyer.page.getByRole("button", { name: "Request this ticket" }).click();
  await expect(buyer.page.getByText("Request sent")).toBeVisible();

  // The seller accepts and shares a contact note privately.
  await page.goto("/inquiries");
  await expect(page.getByText("Hey! Can we meet at the library at 6?")).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByLabel(/Or a note with how to reach you/).fill("Insta @tara.s, see you at 6");
  await page.getByRole("button", { name: "Share & accept" }).click();
  // The card refreshes into its accepted state.
  await expect(page.getByText("Contact shared")).toBeVisible();
  await expect(page.getByText("You said yes. Close the deal")).toBeVisible();
  await buyer.page.goto("/inquiries?tab=sent");
  await expect(buyer.page.getByText("Insta @tara.s, see you at 6")).toBeVisible();

  // 7. The seller marks it sold; it leaves search.
  await page.goto(listingUrl);
  await page.getByRole("button", { name: "Mark sold" }).click();
  await expect(page.getByText("Marked sold")).toBeVisible();
  await buyer.page.goto(`/tickets?q=${encodeURIComponent(eventName)}`);
  await expect(buyer.page.locator(`a[href="${new URL(listingUrl).pathname}"]`)).toHaveCount(0);

  // Both sides record the outcome.
  await buyer.page.goto("/inquiries?tab=sent");
  // Scoped to this conversation: the fixture buyer has others from earlier specs.
  const thread = buyer.page.locator("article", { hasText: "Hey! Can we meet at the library at 6?" });
  await thread.getByRole("button", { name: "Done, ticket handed over" }).click();
  await expect(thread.getByText(/You marked this handed over/)).toBeVisible();

  // 8. The buyer reports a suspicious listing (a seeded one by Asha).
  await buyer.page.goto("/tickets?q=Indie");
  await buyer.page.locator('a[href^="/listings/"]').first().click();
  await buyer.page.getByRole("button", { name: /Report this listing/ }).click();
  await buyer.page.getByLabel("What's wrong?").selectOption("scam");
  await buyer.page.getByLabel("Details").fill("Asked me to pay before meeting");
  await buyer.page.getByRole("button", { name: "Send report" }).click();
  await expect(buyer.page.getByText(/A moderator will review this/)).toBeVisible();

  // 9. A moderator resolves it, with the action in the audit log.
  await mod.page.goto("/admin");
  await expect(mod.page.getByText("Reports to review").first()).toBeVisible(); // the dashboard flags it
  await mod.page.goto("/admin/reports");
  await mod.page.getByText("Suspected scam").first().click();
  await expect(mod.page.getByText("Asked me to pay before meeting")).toBeVisible();
  await mod.page.getByLabel("Reason for the listing action").fill("Hidden while we check the pay-first request");
  await mod.page.getByRole("button", { name: "Hide while reviewing" }).click();
  await expect(mod.page.getByText("Done. Logged in the audit trail.").first()).toBeVisible();
  await mod.page.getByLabel("Note").fill("Seller asked for payment upfront; listing hidden");
  await mod.page.getByRole("button", { name: "Resolve" }).click();
  await expect(mod.page.getByText("Done. Logged in the audit trail.").first()).toBeVisible();
  await mod.page.goto("/admin/audit");
  await expect(mod.page.getByText("resolve report").first()).toBeVisible();
  await expect(mod.page.getByText("hide listing").first()).toBeVisible();

  // 10. Analytics reflect the recorded actions (and never sample data).
  await mod.page.goto("/admin/analytics?days=7");
  const published = mod.page.getByText("Listings published", { exact: true }).locator("..");
  await expect(published.locator(".num")).toHaveText("1");
  // Sample-data events never count: the KPI and its chart agree.
  const requests = mod.page.getByText("Contact requests", { exact: true }).locator("..");
  await expect(requests.locator(".num")).toHaveText("1");
  await expect(mod.page.getByText("Both sides confirmed a handover")).toBeVisible();

  // 11. An ordinary student is denied moderator pages and actions.
  await buyer.page.goto("/admin");
  await expect(buyer.page).toHaveURL(/notice=forbidden/);
  await buyer.page.goto("/admin/analytics");
  await expect(buyer.page).toHaveURL(/notice=forbidden/);

  await buyer.context.close();
  await mod.context.close();
});
