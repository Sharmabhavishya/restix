import { describe, expect, it } from "vitest";
import { niceMax } from "./charts";

describe("niceMax", () => {
  it.each([[0, 4], [3, 4], [5, 8], [9, 20], [37, 40], [120, 200], [1999, 2000]])("%d -> %d", (max, top) => {
    const n = niceMax(max);
    expect(n).toBe(top);
    expect(n).toBeGreaterThanOrEqual(max);
    expect(Number.isInteger(n / 4)).toBe(true);
  });
});
