// Prices are stored as integer paise. These helpers convert to and from what people type and read.

const formatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const wholeFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const MAX_PRICE_PAISE = 10_000_000; // ₹1,00,000

export function formatPaise(paise: number): string {
  return paise % 100 === 0 ? wholeFormatter.format(paise / 100) : formatter.format(paise / 100);
}

/** Parses "1,250", "1250.50" or "₹ 1250" into paise. Returns null for anything else. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return paise <= MAX_PRICE_PAISE ? paise : null;
}

export function paiseToInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}
