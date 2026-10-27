import { z } from "zod";
import { parseRupees } from "./money";
import { fromLocalInput } from "./format";

// Strips control characters (keeping newlines and tabs) and trims. React escapes
// output, so this is about tidy data, not HTML safety.
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, "").trim();
}

const PHONE_RE = /(?:\+?\d[\s-]?){10,}/;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const HANDLE_RE = /\b(?:wa\.me|whatsapp\.com|t\.me|telegram\.me|instagram\.com|instagr\.am|snapchat\.com)\b/i;

/** Public listing text must not carry contact details; those are shared privately on accepting an inquiry. */
export function containsContactDetails(text: string): boolean {
  return PHONE_RE.test(text) || EMAIL_RE.test(text) || HANDLE_RE.test(text);
}

const RESERVED_NAME_RE = /\b(admin|administrator|moderator|mod team|restix|official|support|staff)\b/i;

const optionalText = (max: number) =>
  z
    .string()
    .transform(cleanText)
    .pipe(z.string().max(max, `Keep this under ${max} characters.`))
    .optional()
    .transform((v) => (v ? v : null));

const publicText = (max: number) =>
  optionalText(max).refine((v) => v === null || !containsContactDetails(v), {
    message: "Keep phone numbers, emails and social handles out of public text. You can share them privately when you accept an inquiry.",
  });

// HTML checkboxes submit "on" when ticked and nothing otherwise.
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

const rupees = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}.`)
    .transform((v, ctx) => {
      const paise = parseRupees(v);
      if (paise === null) {
        ctx.addIssue({ code: "custom", message: `Enter the ${label} in rupees, up to ₹1,00,000.` });
        return z.NEVER;
      }
      return paise;
    });

export const listingInput = z
  .object({
    eventId: z.uuid("Choose an event."),
    ticketTypeId: z.uuid("Choose a ticket type."),
    format: z.enum(["wristband", "digital", "paper", "other"], "Choose the ticket format."),
    quantity: z.coerce.number("Enter how many tickets.").int().min(1, "List at least one ticket.").max(10, "List at most 10 tickets at once."),
    askingPrice: rupees("asking price"),
    originalPrice: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const paise = parseRupees(v);
        if (paise === null) {
          ctx.addIssue({ code: "custom", message: "Enter the original price in rupees, or leave it blank." });
          return z.NEVER;
        }
        return paise;
      }),
    priceNegotiable: checkbox,
    handoverMethod: z.enum(["in_person", "digital_transfer", "either"], "Choose how you'll hand it over."),
    meetupArea: publicText(80),
    handoverNotes: publicText(500),
    sellerNotes: publicText(1000),
    expiresAt: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const d = fromLocalInput(v);
        if (!d) {
          ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
          return z.NEVER;
        }
        return d;
      }),
  })
  .refine((v) => v.format !== "wristband" || v.handoverMethod !== "digital_transfer", {
    path: ["handoverMethod"],
    message: "A physical wristband has to be handed over in person.",
  });
export type ListingInput = z.output<typeof listingInput>;

// An offer in rupees, per ticket. Blank means "no offer" where the field is optional.
const offerAmount = (required: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) {
        if (required) ctx.addIssue({ code: "custom", message: "Enter your offer in rupees, like 750." });
        return null;
      }
      const paise = parseRupees(v);
      if (paise === null || paise < 100) {
        ctx.addIssue({ code: "custom", message: "Enter your offer in rupees, like 750." });
        return z.NEVER;
      }
      return paise;
    });

export const inquiryInput = z.object({
  listingId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(10),
  message: z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(10, "Write at least a short note (10+ characters).").max(1000, "Keep it under 1000 characters.")),
  offer: offerAmount(false),
});

export const offerInput = z.object({
  inquiryId: z.uuid(),
  amount: offerAmount(true),
});

export const REPORT_REASONS = {
  scam: "Suspected scam",
  fake_listing: "Fake or misleading listing",
  duplicate: "Duplicate listing",
  prohibited_resale: "Resale isn't allowed for this event",
  impersonation: "Impersonating someone",
  spam: "Spam",
  harassment: "Harassment",
  suspicious_behaviour: "Suspicious seller behaviour",
  disputed_handover: "Disputed handover",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const reportInput = z
  .object({
    listingId: z.uuid().optional(),
    reportedUserId: z.uuid().optional(),
    reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]], "Choose a reason."),
    details: optionalText(2000),
  })
  .refine((v) => v.listingId || v.reportedUserId, { message: "Nothing to report." });

export const displayNameInput = z
  .string()
  .transform((v) => cleanText(v).replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Use at least 2 characters.")
      .max(40, "Keep it under 40 characters.")
      .refine((v) => !RESERVED_NAME_RE.test(v), "That name could be mistaken for staff. Pick another.")
      .refine((v) => !containsContactDetails(v) && !v.includes("@"), "Don't put contact details in your name."),
  );

/** Accepts +<country><number> or a 10-digit Indian mobile number; returns E.164 or null. */
export function normalizeWhatsapp(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}

export const contactShareInput = z.object({
  inquiryId: z.uuid(),
  shareWhatsapp: checkbox,
  note: optionalText(200).refine((v) => v === null || !/<|>/.test(v), "Plain text only."),
});
