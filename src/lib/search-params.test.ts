import { describe, expect, it } from "vitest";
import { activeFilterCount, parseFilters, withParams } from "./search-params";

describe("parseFilters", () => {
  it("accepts a valid set", () => {
    const f = parseFilters({ q: " indie ", format: "wristband", min: "100", max: "900", sort: "price_asc", page: "2", event: "spring-fest" });
    expect(f).toMatchObject({ q: "indie", format: "wristband", minPaise: 10_000, maxPaise: 90_000, sort: "price_asc", page: 2, event: "spring-fest" });
    expect(activeFilterCount(f)).toBe(5);
  });

  it("drops anything invalid instead of passing it on", () => {
    const f = parseFilters({ format: "qr", sort: "drop table", page: "-3", min: "abc", event: "../etc", category: "rave", from: "yesterday" });
    expect(f).toEqual({ q: undefined, event: undefined, category: undefined, format: undefined, minPaise: undefined, maxPaise: undefined, from: undefined, to: undefined, offers: undefined, sort: "newest", page: 1 });
    expect(parseFilters({ offers: "yes" }).offers).toBeUndefined();
  });

  it("filters to listings open to offers", () => {
    const f = parseFilters({ offers: "1" });
    expect(f.offers).toBe(true);
    expect(activeFilterCount(f)).toBe(1);
  });

  it("ignores a max below the min and caps long queries", () => {
    expect(parseFilters({ min: "500", max: "100" }).maxPaise).toBeUndefined();
    expect(parseFilters({ q: "x".repeat(200) }).q).toHaveLength(80);
  });

  it("makes the 'to' date inclusive of the whole day (IST)", () => {
    const f = parseFilters({ from: "2026-11-06", to: "2026-11-06" });
    expect(f.from?.toISOString()).toBe("2026-11-05T18:30:00.000Z");
    expect(f.to?.toISOString()).toBe("2026-11-06T18:30:00.000Z");
  });
});

describe("withParams", () => {
  it("replaces and removes keys", () => {
    expect(withParams({ q: "a", page: "3" }, { page: undefined, format: "digital" })).toBe("?q=a&format=digital");
    expect(withParams({}, {})).toBe("");
  });
});
