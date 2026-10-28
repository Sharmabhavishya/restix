import { describe, expect, it } from "vitest";
import { csvCell, phoneCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes cells and doubles inner quotes", () => {
    expect(csvCell('Asha "AK" K')).toBe('"Asha ""AK"" K"');
    expect(csvCell(null)).toBe('""');
  });

  it("defuses text that a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+91 98765")).toBe('"\'+91 98765"');
    expect(csvCell("@sum")).toBe('"\'@sum"');
  });

  it("keeps phone numbers as text, and only real ones", () => {
    expect(csvCell(phoneCell("+919876543210"))).toBe('"=""+919876543210"""');
    expect(csvCell(phoneCell("=1+1"))).toBe('""');
    expect(csvCell(phoneCell(null))).toBe('""');
  });

  it("starts with a BOM and ends rows with CRLF, so Excel reads Unicode names", () => {
    const out = toCsv(["Name"], [["प्रिया"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe('﻿"Name"\r\n"प्रिया"\r\n');
  });
});
