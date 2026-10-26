import { describe, expect, it } from "vitest";
import { formatPaise, parseRupees } from "./money";
import { containsContactDetails, displayNameInput, listingInput, normalizeWhatsapp } from "./validation";

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
    [{ format: "qr" }, "format"],
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

describe("displayNameInput", () => {
  it("accepts ordinary names and collapses whitespace", () => {
    expect(displayNameInput.parse("  Asha   K ")).toBe("Asha K");
  });
  it.each(["A", "ResTix Admin", "Official Moderator", "asha@snu.edu.in", "x".repeat(41)])("rejects %j", (name) => {
    expect(displayNameInput.safeParse(name).success).toBe(false);
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
