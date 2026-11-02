import { describe, expect, it } from "vitest";
import { addDays, joinLocal, plusHours, quickDays, splitLocal, tillLate, weekdayOf } from "./quick-dates";

describe("quick dates", () => {
  it("steps across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayOf("2026-11-06")).toBe(5); // a Friday
  });

  it("offers tonight, tomorrow and the next Sat and Sun, without repeats", () => {
    // Friday 6 Nov 2026
    expect(quickDays("2026-11-06").map((d) => [d.key, d.ymd])).toEqual([
      ["tonight", "2026-11-06"], ["tomorrow", "2026-11-07"], ["sun", "2026-11-08"],
    ]);
  });

  it("on a Saturday, 'This Sat' means next week and 'tomorrow' is Sunday", () => {
    expect(quickDays("2026-11-07").map((d) => d.ymd)).toEqual(["2026-11-07", "2026-11-08", "2026-11-14"]);
    expect(quickDays("2026-11-07").map((d) => d.key)).toEqual(["tonight", "tomorrow", "sat"]);
  });

  it("on a Wednesday gives four distinct days", () => {
    const days = quickDays("2026-11-04");
    expect(days.map((d) => d.ymd)).toEqual(["2026-11-04", "2026-11-05", "2026-11-07", "2026-11-08"]);
  });

  it("splits and joins the datetime-local text", () => {
    expect(splitLocal("2026-11-06T19:00")).toEqual({ ymd: "2026-11-06", time: "19:00" });
    expect(splitLocal("nonsense")).toEqual({ ymd: "", time: "" });
    expect(joinLocal("2026-11-06", "20:30")).toBe("2026-11-06T20:30");
    expect(joinLocal("2026-11-06", "")).toBe("2026-11-06T19:00"); // 7 pm unless told otherwise
    expect(joinLocal("", "20:30")).toBe("");
    expect(joinLocal("06-11-2026", "20:30")).toBe("");
  });

  it("works out end times, across midnight too", () => {
    expect(plusHours("2026-11-06T19:00", 3)).toBe("2026-11-06T22:00");
    expect(plusHours("2026-11-06T22:30", 3)).toBe("2026-11-07T01:30");
    expect(plusHours("2026-12-31T23:00", 2)).toBe("2027-01-01T01:00");
    expect(plusHours("2026-11-06T19:00", 2.5)).toBe("2026-11-06T21:30");
    expect(plusHours("", 3)).toBe("");
    expect(tillLate("2026-11-06T19:00")).toBe("2026-11-07T01:00");
    expect(tillLate("")).toBe("");
  });
});
