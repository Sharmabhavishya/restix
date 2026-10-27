import { describe, expect, it } from "vitest";
import { buyerOpener, sellerShare, waLink } from "./whatsapp";
import { inquiryInput, offerInput } from "./validation";

const ctx = {
  buyerName: "Asha K",
  sellerName: "Rohan M",
  eventName: "Spring Fest: Night 2",
  ticketTypeName: "Night pass",
  quantity: 1,
  askingPricePaise: 90000,
  agreedPricePaise: null,
};

describe("WhatsApp links", () => {
  it("writes the buyer's first message so the seller knows which ticket", () => {
    expect(buyerOpener(ctx)).toBe(
      "Hey Rohan! It's Asha K from ResTix. About your Spring Fest: Night 2 (Night pass), listed at ₹900. Is it still on? When works for the handover on campus?",
    );
    expect(buyerOpener({ ...ctx, quantity: 2, agreedPricePaise: 80000 })).toContain("for 2 tickets, listed at ₹900, and we agreed ₹800 each");
  });

  it("only links to well-formed numbers, and encodes the text", () => {
    expect(waLink("+919876543210", "Hi & bye")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye");
    expect(waLink("919876543210", "x")).toBeNull();
    expect(waLink("+91 98765", "x")).toBeNull();
    expect(waLink(null, "share me")).toBe("https://wa.me/?text=share%20me");
  });

  it("gives sellers a group-chat post with the link", () => {
    expect(sellerShare({ eventName: "Indie Night", ticketTypeName: "General", askingPricePaise: 25000, quantity: 3, url: "https://restix.app/listings/1", college: "SNU" }))
      .toBe("Selling 3x Indie Night (General) for ₹250 each on ResTix. SNU students can grab it here: https://restix.app/listings/1");
  });
});

describe("offer amounts", () => {
  const base = { listingId: "6f1c1c6e-8f4e-4b8a-9a55-0d1b2c3d4e5f", quantity: "1", message: "Is this still available?" };

  it("is optional when asking, and parsed to paise", () => {
    expect(inquiryInput.parse(base).offer).toBeNull();
    expect(inquiryInput.parse({ ...base, offer: "  " }).offer).toBeNull();
    expect(inquiryInput.parse({ ...base, offer: "₹ 750" }).offer).toBe(75000);
    expect(inquiryInput.safeParse({ ...base, offer: "seven fifty" }).success).toBe(false);
    expect(inquiryInput.safeParse({ ...base, offer: "0.5" }).success).toBe(false);
  });

  it("is required when making one", () => {
    const id = "6f1c1c6e-8f4e-4b8a-9a55-0d1b2c3d4e5f";
    expect(offerInput.safeParse({ inquiryId: id, amount: "" }).success).toBe(false);
    expect(offerInput.parse({ inquiryId: id, amount: "1,200" }).amount).toBe(120000);
  });
});
