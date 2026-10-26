import { describe, expect, it } from "vitest";
import { emailDomain, isAllowedEmail, parseDomainList } from "./email-domain";

const allowed = ["snu.edu.in"];

describe("isAllowedEmail", () => {
  it("accepts an address on the allowed domain, case-insensitively", () => {
    expect(isAllowedEmail("asha.k@snu.edu.in", allowed)).toBe(true);
    expect(isAllowedEmail("  Asha.K@SNU.EDU.IN ", allowed)).toBe(true);
  });

  it.each([
    "someone@gmail.com",
    "x@snu.edu.in.evil.com",
    "x@evilsnu.edu.in",
    "x@sub.snu.edu.in",
    "snu.edu.in@gmail.com",
    "x@snu.edu.in@gmail.com",
    "x@@snu.edu.in",
    "@snu.edu.in",
    "x@",
    "",
    "x@snu.edu.in.",
  ])("rejects %j", (email) => {
    expect(isAllowedEmail(email, allowed)).toBe(false);
  });
});

describe("emailDomain", () => {
  it("returns the lower-cased domain", () => {
    expect(emailDomain("A@B.Example.ORG")).toBe("b.example.org");
  });
  it("returns null for malformed addresses", () => {
    expect(emailDomain("no-at-sign")).toBeNull();
    expect(emailDomain("a@b")).toBeNull();
  });
});

describe("parseDomainList", () => {
  it("normalises and de-duplicates", () => {
    expect(parseDomainList(" SNU.edu.in, snu.edu.in ,iitd.ac.in")).toEqual(["snu.edu.in", "iitd.ac.in"]);
  });
  it("refuses an empty or malformed list rather than allowing everyone", () => {
    expect(() => parseDomainList("")).toThrow();
    expect(() => parseDomainList(" , ")).toThrow();
    expect(() => parseDomainList("*.edu.in")).toThrow();
    expect(() => parseDomainList("@snu.edu.in")).toThrow();
  });
});
