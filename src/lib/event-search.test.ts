import { describe, expect, it } from "vitest";
import { matchesSearch } from "./event-search";

describe("matchesSearch", () => {
  const e = { name: "Spring Fest: Night 2", venue: "Main Ground" };
  it("needs every word, in any order, in the name or venue", () => {
    expect(matchesSearch(e, "")).toBe(true);
    expect(matchesSearch(e, "fest night")).toBe(true);
    expect(matchesSearch(e, "ground spring")).toBe(true);
    expect(matchesSearch(e, "fest prom")).toBe(false);
  });
  it("ignores case and copes with a missing venue", () => {
    expect(matchesSearch({ name: "Prom", venue: null }, "PROM")).toBe(true);
    expect(matchesSearch({ name: "Prom" }, "ground")).toBe(false);
  });
});
