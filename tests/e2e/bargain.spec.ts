// Bargaining and the WhatsApp hand-off, through the real screens.
import { expect, test } from "@playwright/test";
import { asFixture, selectByText, signIn, uniqueEmail } from "./helpers";

test("offer, counter, deal, then WhatsApp with the message already written", async ({ browser, page }) => {
  // A new seller, with a WhatsApp number on file, lists a ticket that's open to offers.
  await signIn(page, uniqueEmail("e2e.haggle"), "Kabir D");
  await page.getByLabel("Display name").fill("Kabir D");
  await page.getByLabel("WhatsApp number").fill("98765 43210");
  await page.getByLabel(/I'll only list tickets I own/).check();
  await page.getByRole("button", { name: "Let's go" }).click();
  await expect(page).toHaveURL(/\/tickets/);

  await page.goto("/sell");
  await selectByText(page, "Event", "Spring Fest: Night 2");
  await selectByText(page, "Ticket type", "Night pass");
  await page.getByLabel(/Asking price/).fill("800");
  await page.getByLabel("Open to offers").check();
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\?saved=publish/);
  const listingUrl = page.url().split("?")[0];

  // The seller can post it to their group chats.
  const share = page.getByRole("link", { name: /Share in your WhatsApp groups/ });
  await expect(share).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=Selling%20/);

  // A buyer asks with an offer; going over the asking price is refused.
  const buyer = await asFixture(browser, "Rohan M");
  await buyer.page.goto(listingUrl);
  await buyer.page.getByLabel(/Message to Kabir D/).fill("Hey! Would you take a bit less?");
  await buyer.page.getByLabel(/Make an offer/).fill("900");
  await buyer.page.getByRole("button", { name: "Ask the seller" }).click();
  await expect(buyer.page.getByText("Offers can't go above the asking price.")).toBeVisible();
  await buyer.page.getByLabel(/Make an offer/).fill("650");
  await buyer.page.getByRole("button", { name: "Ask the seller" }).click();
  // The page refreshes into its "you've asked" state.
  await expect(buyer.page.getByText("Request sent")).toBeVisible();

  // The seller counters.
  await page.goto("/inquiries?tab=received");
  const card = page.locator("article", { hasText: "Would you take a bit less?" });
  await expect(card.getByText("Bargaining")).toBeVisible();
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

  await buyer.page.reload();
  const chat = mine.getByRole("link", { name: "Message on WhatsApp" });
  await expect(chat).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=Hey%20Kabir!/);
  await expect(chat).toHaveAttribute("href", /we%20agreed%20%E2%82%B9720/);
  await buyer.context.close();
});
