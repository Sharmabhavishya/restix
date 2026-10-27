import { describe, expect, it } from "vitest";
import { buyerOpener, sellerOpener, waLink, type DealContext } from "./whatsapp";

const ctx: DealContext = {
  buyerName: "Rohan Mehta",
  sellerName: "Asha K",
  eventName: "Spring Fest: Night 2",
  ticketTypeName: "Night pass",
  quantity: 1,
  unitPricePaise: 80000,
  format: "wristband",
  site: "restix.app",
};

describe("WhatsApp handoff", () => {
  it("writes the seller's opener to the accepted buyer, signed by ResTix", () => {
    expect(sellerOpener(ctx)).toBe(
      "Hi Rohan! I've accepted your request for a ticket (Night pass) to Spring Fest: Night 2 on ResTix. Let's close it at ₹800. When and where works for you to meet?\n\nSent via ResTix · restix.app",
    );
  });

  it("writes the buyer's opener to the seller who accepted", () => {
    expect(buyerOpener(ctx)).toBe(
      "Hi Asha! You accepted my request for a ticket (Night pass) to Spring Fest: Night 2 on ResTix. Happy to close it at ₹800. When and where works for you to meet?\n\nSent via ResTix · restix.app",
    );
  });

  it("spells out each and total for several tickets", () => {
    expect(sellerOpener({ ...ctx, quantity: 3, unitPricePaise: 70000 })).toContain("3 tickets (Night pass)");
    expect(sellerOpener({ ...ctx, quantity: 3, unitPricePaise: 70000 })).toContain("₹700 each (₹2,100 in total)");
  });

  it("asks to send it over for tickets that travel online, with payment after", () => {
    for (const format of ["qr", "email", "app"] as const) {
      expect(sellerOpener({ ...ctx, format })).toContain("you can pay once you've got it");
      expect(buyerOpener({ ...ctx, format })).toContain("I'll pay as soon as I've got it");
    }
  });

  it("copes with odd names", () => {
    expect(sellerOpener({ ...ctx, buyerName: "   " })).toMatch(/^Hi there!/);
    expect(buyerOpener({ ...ctx, sellerName: "प्रिया शर्मा" })).toMatch(/^Hi प्रिया!/);
  });

  it("only links to a real international number", () => {
    expect(waLink("+919876543210", "Hi & bye?")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye%3F");
    expect(waLink("9876543210", "x")).toBeNull();
    expect(waLink("+91 98765", "x")).toBeNull();
    expect(waLink(null, "x")).toBeNull();
  });
});
