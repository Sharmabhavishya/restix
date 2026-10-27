import { describe, expect, it } from "vitest";
import { countdown, daysUntil, formatDateTime, fromLocalInput, toLocalInput } from "./format";

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

describe("countdown", () => {
  // 10:00 IST on 5 Nov 2026
  const now = new Date("2026-11-05T04:30:00Z");

  it("counts campus-calendar days, not 24-hour blocks", () => {
    // 01:00 IST on 6 Nov is tomorrow, even though it's only 15 hours away
    expect(daysUntil(new Date("2026-11-05T19:30:00Z"), now)).toBe(1);
    // 23:30 IST on 5 Nov is still today
    expect(daysUntil(new Date("2026-11-05T18:00:00Z"), now)).toBe(0);
  });

  it("says it the way people say it", () => {
    expect(countdown(new Date("2026-11-05T14:00:00Z"), now)).toBe("tonight"); // 19:30 IST
    expect(countdown(new Date("2026-11-05T07:30:00Z"), now)).toBe("today"); // 13:00 IST
    expect(countdown(new Date("2026-11-06T13:30:00Z"), now)).toBe("tomorrow");
    expect(countdown(new Date("2026-11-10T13:30:00Z"), now)).toBe("in 5 days");
    expect(countdown(new Date("2026-12-03T13:30:00Z"), now)).toBe("in 4 weeks");
    expect(countdown(new Date("2026-11-05T04:00:00Z"), now)).toBe("happening now");
  });
});
