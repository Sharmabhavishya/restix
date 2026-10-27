import { describe, expect, it } from "vitest";
import { formatDateTime, fromLocalInput, toLocalInput } from "./format";

describe("campus time", () => {
  it("parses datetime-local input as IST regardless of the server's zone", () => {
    expect(fromLocalInput("2026-11-06T19:00")?.toISOString()).toBe("2026-11-06T13:30:00.000Z");
    expect(fromLocalInput("not a date")).toBeNull();
    expect(fromLocalInput("2026-11-06")).toBeNull();
  });

  it("round-trips through the input format", () => {
    const d = new Date("2026-11-06T13:30:00Z");
    expect(toLocalInput(d)).toBe("2026-11-06T19:00");
    expect(fromLocalInput(toLocalInput(d))?.getTime()).toBe(d.getTime());
  });

  it("displays in IST", () => {
    expect(formatDateTime(new Date("2026-11-06T13:30:00Z"))).toMatch(/7:00\s?pm/);
  });
});
