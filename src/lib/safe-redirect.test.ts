import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNext("/listings/abc?x=1")).toBe("/listings/abc?x=1");
    expect(safeNext("/")).toBe("/");
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "javascript:alert(1)",
    "evil.com",
    "/auth/callback?code=x",
    "",
    null,
    undefined,
    42,
    `/${"a".repeat(600)}`,
  ])("falls back for %j", (value) => {
    expect(safeNext(value)).toBe("/tickets");
  });
});
