import { describe, expect, it } from "vitest";
import { dealFor, priceRef, priceTier, savingPercent } from "./deal";

describe("price reference", () => {
  it("prefers the organiser's face value", () => {
    expect(priceRef({ faceValuePaise: 50000, marketMedianPaise: 80000, marketCount: 9 })).toEqual({ paise: 50000, source: "face" });
  });

  it("falls back to the market only with enough listings", () => {
    expect(priceRef({ faceValuePaise: null, marketMedianPaise: 60000, marketCount: 2 })).toBeNull();
    expect(priceRef({ faceValuePaise: null, marketMedianPaise: 60000.5, marketCount: 3 })).toEqual({ paise: 60001, source: "market" });
  });

  it("ignores zero or missing references (free events, no data)", () => {
    expect(priceRef({ faceValuePaise: 0, marketMedianPaise: 0, marketCount: 10 })).toBeNull();
    expect(priceRef({ faceValuePaise: null })).toBeNull();
  });
});

describe("price tiers", () => {
  const face = { paise: 100000, source: "face" as const };
  it.each([
    [0, "steal"],
    [70000, "steal"],
    [70001, "good"],
    [90000, "good"],
    [90001, "fair"],
    [100000, "fair"],
    [100001, "high"],
    [120000, "high"],
    [120001, "steep"],
    [10_000_000, "steep"],
  ])("₹%i paise against ₹1000 is %s", (asking, tier) => {
    expect(priceTier(asking, face)).toBe(tier);
  });

  it("has no tier without a reference", () => {
    expect(priceTier(5000, null)).toBeNull();
  });

  it("reports savings as whole percents, never zero or negative", () => {
    expect(savingPercent(66600, face)).toBe(33);
    expect(savingPercent(99999, face)).toBeNull(); // 0.001% isn't a saving worth showing
    expect(savingPercent(100000, face)).toBeNull();
    expect(savingPercent(150000, face)).toBeNull();
    expect(savingPercent(0, face)).toBe(100);
  });

  it("only alerts for good deals and steals", () => {
    expect(dealFor({ askingPricePaise: 60000, faceValuePaise: 100000 }).alert).toBe(true);
    expect(dealFor({ askingPricePaise: 95000, faceValuePaise: 100000 }).alert).toBe(false);
    expect(dealFor({ askingPricePaise: 60000, faceValuePaise: null }).alert).toBe(false);
  });
});
