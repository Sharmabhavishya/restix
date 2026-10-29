import { describe, expect, it } from "vitest";
import { MAX_LEVELS, parseLevels } from "./ticket-levels";

describe("parseLevels", () => {
  it("keeps picked and typed levels in order, tidied", () => {
    expect(parseLevels(["Normal", "Fan pit", "  Gold   stand , Silver\nBronze "])).toEqual(["Normal", "Fan pit", "Gold stand", "Silver", "Bronze"]);
  });

  it("drops blanks, duplicates (any case) and control characters", () => {
    expect(parseLevels(["", "  ", "VIP", "vip", "V\u0007IP", "Fan pit", "FAN PIT"])).toEqual(["VIP", "Fan pit"]);
  });

  it("caps the length of each name and the number of levels", () => {
    expect(parseLevels(["x".repeat(80)])[0]).toHaveLength(60);
    expect(parseLevels(Array.from({ length: 20 }, (_, i) => `Level ${i}`))).toHaveLength(MAX_LEVELS);
  });
});
