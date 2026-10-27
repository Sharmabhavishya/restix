import { describe, expect, it } from "vitest";
import { formatPaise, parseRupees } from "./money";
import { containsContactDetails, inquiryInput, listingInput, normalizeWhatsapp } from "./validation";

const base = {
  eventId: "11111111-1111-4111-8111-111111111111",
  ticketTypeId: "22222222-2222-4222-8222-222222222222",
  format: "wristband",
  quantity: "2",
  askingPrice: "900",
  originalPrice: "800",
  handoverMethod: "in_person",
  meetupArea: "Library steps",
};

describe("money", () => {
  it("parses rupee input into paise", () => {
    expect(parseRupees("1,250")).toBe(125_000);
    expect(parseRupees("₹ 99.5")).toBe(9_950);
    expect(parseRupees("0")).toBe(0);
  });
  it.each(["-5", "abc", "1.234", "", "100000.01", "1e3"])("rejects %j", (v) => {
    expect(parseRupees(v)).toBeNull();
  });
  it("formats paise as Indian rupees", () => {
    expect(formatPaise(125_000)).toBe("₹1,250");
    expect(formatPaise(10_000_000)).toBe("₹1,00,000");
  });
});

describe("listingInput", () => {
  it("accepts a valid wristband listing", () => {
    const r = listingInput.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.askingPrice).toBe(90_000);
      expect(r.data.quantity).toBe(2);
      expect(r.data.priceNegotiable).toBe(false);
    }
  });

  it.each([
    [{ quantity: "0" }, "quantity"],
    [{ quantity: "11" }, "quantity"],
    [{ quantity: "1.5" }, "quantity"],
    [{ askingPrice: "-100" }, "askingPrice"],
    [{ askingPrice: "200000" }, "askingPrice"],
    [{ format: "hologram" }, "format"],
    [{ format: "" }, "format"],
    [{ eventId: "not-a-uuid" }, "eventId"],
    [{ expiresAt: "yesterday-ish" }, "expiresAt"],
  ])("rejects %j", (over, field) => {
    const r = listingInput.safeParse({ ...base, ...over });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain(field);
  });

  it("refuses digital transfer for a physical wristband", () => {
    expect(listingInput.safeParse({ ...base, handoverMethod: "digital_transfer" }).success).toBe(false);
  });

  it.each([
    ["wristband", "in_person"],
    ["paper", "in_person"],
    ["pass", "in_person"],
    ["token", "in_person"],
    ["qr", "digital_transfer"],
    ["email", "digital_transfer"],
    ["app", "digital_transfer"],
    ["other", "digital_transfer"],
  ])("picks a sensible handover for a %s when none is given", (format, handover) => {
    const r = listingInput.safeParse({ ...base, format, handoverMethod: undefined });
    expect(r.success && r.data.handoverMethod).toBe(handover);
  });

  it.each([
    ["paper", "digital_transfer"],
    ["pass", "either"],
    ["token", "digital_transfer"],
    ["app", "in_person"],
    ["app", "either"],
  ])("refuses a %s handed over as %s", (format, handoverMethod) => {
    expect(listingInput.safeParse({ ...base, format, handoverMethod }).success).toBe(false);
  });

  it("reads the old 'digital' format as a QR e-ticket", () => {
    const r = listingInput.safeParse({ ...base, format: "digital", handoverMethod: "digital_transfer" });
    expect(r.success && r.data.format).toBe("qr");
  });

  describe("multi-ticket deal", () => {
    const many = { ...base, quantity: "5", askingPrice: "900" };
    it("accepts a real discount for buying several", () => {
      const r = listingInput.safeParse({ ...many, bulkMinQuantity: "3", bulkPrice: "750" });
      expect(r.success && [r.data.bulkMinQuantity, r.data.bulkPrice]).toEqual([3, 75_000]);
    });
    it("treats both blank as no deal", () => {
      const r = listingInput.safeParse({ ...many, bulkMinQuantity: "", bulkPrice: "" });
      expect(r.success && [r.data.bulkMinQuantity, r.data.bulkPrice]).toEqual([null, null]);
    });
    it.each([
      [{ bulkMinQuantity: "3" }, "bulkPrice"],
      [{ bulkPrice: "700" }, "bulkPrice"],
      [{ bulkMinQuantity: "6", bulkPrice: "700" }, "bulkMinQuantity"],
      [{ bulkMinQuantity: "1", bulkPrice: "700" }, "bulkMinQuantity"],
      [{ bulkMinQuantity: "11", bulkPrice: "700" }, "bulkMinQuantity"],
      [{ bulkMinQuantity: "2.5", bulkPrice: "700" }, "bulkMinQuantity"],
      [{ bulkMinQuantity: "3", bulkPrice: "900" }, "bulkPrice"],
      [{ bulkMinQuantity: "3", bulkPrice: "1000" }, "bulkPrice"],
      [{ bulkMinQuantity: "3", bulkPrice: "-5" }, "bulkPrice"],
      [{ bulkMinQuantity: "3", bulkPrice: "₹ lots" }, "bulkPrice"],
    ])("refuses %j", (over, field) => {
      const r = listingInput.safeParse({ ...many, ...over });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain(field);
    });
    it("allows a free deal (₹0 each) when the asking price is above zero", () => {
      expect(listingInput.safeParse({ ...many, bulkMinQuantity: "2", bulkPrice: "0" }).success).toBe(true);
    });
  });

  describe("extreme inputs", () => {
    it("takes the top price and the most tickets", () => {
      const r = listingInput.safeParse({ ...base, quantity: "10", askingPrice: "1,00,000", originalPrice: "100000" });
      expect(r.success && [r.data.quantity, r.data.askingPrice]).toEqual([10, 10_000_000]);
    });
    it("takes a free ticket", () => {
      expect(listingInput.safeParse({ ...base, askingPrice: "0" }).success).toBe(true);
    });
    it.each(["1e9", "Infinity", "NaN", "99999999999999999999", "0x10", " "])("refuses the price %j", (askingPrice) => {
      expect(listingInput.safeParse({ ...base, askingPrice }).success).toBe(false);
    });
    it("keeps non-Latin text and emoji in notes, and stops at the length limit", () => {
      const r = listingInput.safeParse({ ...base, sellerNotes: "सामने मिलते हैं 🎟️ 会场で" });
      expect(r.success && r.data.sellerNotes).toBe("सामने मिलते हैं 🎟️ 会场で");
      expect(listingInput.safeParse({ ...base, sellerNotes: "x".repeat(1000) }).success).toBe(true);
      expect(listingInput.safeParse({ ...base, sellerNotes: "x".repeat(1001) }).success).toBe(false);
      expect(listingInput.safeParse({ ...base, meetupArea: "y".repeat(81) }).success).toBe(false);
    });
    it("turns whitespace-only notes into nothing", () => {
      const r = listingInput.safeParse({ ...base, sellerNotes: "   \n\t  ", handoverNotes: "\u0000" });
      expect(r.success && [r.data.sellerNotes, r.data.handoverNotes]).toEqual([null, null]);
    });
    it("ignores unknown fields instead of trusting them", () => {
      const r = listingInput.safeParse({ ...base, sellerId: "00000000-0000-4000-8000-000000000009", status: "active", version: 99 });
      expect(r.success && Object.keys(r.data)).not.toContain("sellerId");
      expect(r.success && Object.keys(r.data)).not.toContain("status");
    });
  });

  it("keeps contact details out of public listing text", () => {
    expect(listingInput.safeParse({ ...base, sellerNotes: "Call me on 98765 43210" }).success).toBe(false);
    expect(listingInput.safeParse({ ...base, meetupArea: "DM insta instagram.com/asha" }).success).toBe(false);
    expect(listingInput.safeParse({ ...base, handoverNotes: "mail me at a@b.com" }).success).toBe(false);
  });

  it("strips control characters", () => {
    const r = listingInput.safeParse({ ...base, sellerNotes: "hello\u0000‮world" });
    expect(r.success && r.data.sellerNotes).toBe("helloworld");
  });
});

describe("containsContactDetails", () => {
  it("spots phone numbers, emails and messaging links", () => {
    expect(containsContactDetails("+91 98765-43210")).toBe(true);
    expect(containsContactDetails("wa.me/919876543210")).toBe(true);
    expect(containsContactDetails("Meet at gate 2 after 6pm")).toBe(false);
    expect(containsContactDetails("2 tickets, row 12")).toBe(false);
  });
});

describe("normalizeWhatsapp", () => {
  it("normalises Indian mobile numbers to E.164", () => {
    expect(normalizeWhatsapp("98765 43210")).toBe("+919876543210");
    expect(normalizeWhatsapp("+44 7700 900123")).toBe("+447700900123");
  });
  it("rejects junk", () => {
    expect(normalizeWhatsapp("12345")).toBeNull();
    expect(normalizeWhatsapp("call me")).toBeNull();
  });
});

describe("inquiryInput WhatsApp", () => {
  const ask = { listingId: "11111111-1111-4111-8111-111111111111", quantity: "1", message: "Hey, still available?" };
  it("normalises an Indian mobile and keeps the choice to share", () => {
    const r = inquiryInput.safeParse({ ...ask, shareWhatsapp: "on", whatsapp: "98765 43210" });
    expect(r.success && [r.data.shareWhatsapp, r.data.whatsapp]).toEqual([true, "+919876543210"]);
  });
  it("treats a blank number as none and an unticked box as no", () => {
    const r = inquiryInput.safeParse({ ...ask, whatsapp: "  " });
    expect(r.success && [r.data.shareWhatsapp, r.data.whatsapp]).toEqual([false, null]);
  });
  it.each(["12345", "abc", "+0 98765 43210", "0098765432101234567"])("refuses %j", (whatsapp) => {
    expect(inquiryInput.safeParse({ ...ask, whatsapp }).success).toBe(false);
  });
});
