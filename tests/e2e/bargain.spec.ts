// Bargaining and the WhatsApp hand-off, through the real screens.
import { expect, test } from "@playwright/test";
import { asFixture, selectByText, signIn, uniqueEmail } from "./helpers";

test("offer, counter, deal, then WhatsApp with the message already written", async ({ browser, page }) => {
  // A new seller, with a WhatsApp number on file, lists a ticket that's open to offers.
  await signIn(page, uniqueEmail("e2e.haggle"), "Kabir D");
  await expect(page.getByText("Kabir D", { exact: true })).toBeVisible(); // name comes from the account
  await expect(page.getByLabel("Display name")).toHaveCount(0); // and can't be edited
  await page.getByLabel("WhatsApp number").fill("98765 43210");
  await page.getByLabel(/I'll only list tickets I own/).check();
  await page.getByRole("button", { name: "Let's go" }).click();
  await expect(page).toHaveURL(/\/tickets/);

  await page.goto("/sell");
  await selectByText(page, "Event", "Spring Fest: Night 2");
  await selectByText(page, "Ticket type", "Night pass");
  await page.getByLabel("Price", { exact: true }).fill("800");
  await page.getByText("Offers and deals", { exact: true }).click();
  await expect(page.getByLabel("Open to offers")).toBeChecked(); // bargaining is on by default
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\?saved=publish/);
  const listingUrl = page.url().split("?")[0];

  // No group-chat sharing: the seller's number stays private.
  await expect(page.getByRole("link", { name: /Share in your WhatsApp groups/ })).toHaveCount(0);
  await expect(page.getByText(/Your number stays private/)).toBeVisible();

  // A buyer asks with an offer; going over the asking price is refused.
  const buyer = await asFixture(browser, "Rohan M");
  await buyer.page.goto(listingUrl);
  // The buyer's number goes in now, but the seller only sees it after saying yes.
  const ownNumber = buyer.page.getByLabel("Your WhatsApp number");
  if (await ownNumber.count()) await ownNumber.fill("98111 22233");
  await buyer.page.getByText("Add a note", { exact: true }).click();
  await buyer.page.getByLabel(/Message to Kabir D/).fill("Hey! Would you take a bit less?");
  await buyer.page.getByText("Don't like the price? Make an offer").click();
  await buyer.page.getByLabel(/Your offer per ticket/).fill("900");
  await buyer.page.getByRole("button", { name: "Request this ticket" }).click();
  await expect(buyer.page.getByText("Offers can't go above the asking price.")).toBeVisible();
  await buyer.page.getByLabel(/Your offer per ticket/).fill("650");
  await buyer.page.getByRole("button", { name: "Request this ticket" }).click();
  // The page refreshes into its "you've asked" state.
  await expect(buyer.page.getByText("Request sent")).toBeVisible();

  // The seller counters. No WhatsApp for anyone yet.
  await page.goto("/inquiries?tab=received");
  const card = page.locator("article", { hasText: "Would you take a bit less?" });
  await expect(card.getByRole("link", { name: /^WhatsApp/ })).toHaveCount(0);
  await expect(card.getByText("Bargaining")).toBeVisible();
  await card.getByRole("button", { name: "Counter offer" }).click();
  await card.getByLabel(/Or counter with/).fill("720");
  await card.getByRole("button", { name: "Counter" }).click();
  await expect(card.getByText("waiting on Rohan to reply")).toBeVisible();

  // The buyer takes the counter.
  await buyer.page.goto("/inquiries?tab=sent");
  const mine = buyer.page.locator("article", { hasText: "Would you take a bit less?" });
  await mine.getByRole("button", { name: "Take ₹720" }).click();
  await expect(mine.getByText(/Agreed at/)).toBeVisible();

  // The seller says yes and shares WhatsApp; the buyer's button opens a chat with the deal written in.
  await page.reload();
  await card.getByRole("button", { name: "Accept" }).click();
  await card.getByRole("button", { name: "Share & accept" }).click();
  await expect(card.getByText("Contact shared")).toBeVisible();

  // Now the seller gets the buyer's WhatsApp, with their opener written and signed by ResTix...
  const toBuyer = card.getByRole("link", { name: /^WhatsApp Rohan/ });
  await expect(toBuyer).toHaveAttribute("href", /^https:\/\/wa\.me\/919811122233\?text=Hi%20Rohan!%20I've%20accepted/);
  await expect(toBuyer).toHaveAttribute("href", /close%20it%20at%20%E2%82%B9720/);
  await expect(toBuyer).toHaveAttribute("href", /Sent%20via%20ResTix/);

  // ...and the buyer gets the seller's.
  await buyer.page.reload();
  const chat = mine.getByRole("link", { name: /^WhatsApp Kabir/ });
  await expect(chat).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=Hi%20Kabir!%20You%20accepted/);
  await expect(chat).toHaveAttribute("href", /close%20it%20at%20%E2%82%B9720/);
  await buyer.context.close();
});
