import { z } from "zod";
import { parseRupees } from "./money";
import { fromLocalInput } from "./format";
import { defaultHandover, FORMATS, handoversFor, type TicketFormat } from "./listing-rules";
import { REPORT_REASONS, type ReportReason } from "./report-reasons";

// Strips control characters (keeping newlines and tabs) and trims. React escapes
// output, so this is about tidy data, not HTML safety.
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, "").trim();
}

// Ten or more digits of any script, with up to three non-letters (space, dot, slash, bracket...)
// between each. Each step is one digit then a bounded gap, so it can't backtrack badly.
const PHONE_RE = /(?:\p{Nd}[^\p{L}\p{Nd}]{0,3}){10,}/u;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const SPELLED_EMAIL_RE = /\b\w+\s*[([]at[)\]]\s*\w+|\b\w+\s+at\s+\w+\s+dot\s+\w{2,}/i;
const HANDLE_RE = /\b(?:wa\.me|whatsapp\.com|t\.me|telegram\.me|instagram\.com|instagr\.am|snapchat\.com)\b/i;
const AT_HANDLE_RE = /(?:^|[^\p{L}\p{Nd}])@[\p{L}\p{Nd}._]{3,}/u;
const NAMED_HANDLE_RE = /\b(?:ig|insta(?:gram)?|snap(?:chat)?|whats ?app|wa|telegram|tg)\s*[:@=-]\s*\S{3,}/i;

/** Folds look-alikes: full-width and styled characters become plain ones; invisible ones go. */
function fold(text: string): string {
  return text.normalize("NFKC").replace(/[\p{Cf}\p{Zl}\p{Zp}]/gu, "");
}

/**
 * Public listing text must not carry contact details; those are shared privately on accepting an
 * inquiry. Best effort: it catches the common ways of writing a number, email or handle, including
 * spaced out, full-width, Devanagari or with invisible characters. Reports and moderators handle the rest.
 */
export function containsContactDetails(text: string): boolean {
  const t = fold(text);
  return PHONE_RE.test(t) || EMAIL_RE.test(t) || SPELLED_EMAIL_RE.test(t) || HANDLE_RE.test(t) || AT_HANDLE_RE.test(t) || NAMED_HANDLE_RE.test(t);
}


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

const optionalRupees = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const paise = parseRupees(v);
      if (paise === null) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return paise;
    });

export const listingInput = z
  .object({
    eventId: z.uuid("Choose an event."),
    ticketTypeId: z.uuid("Choose a ticket type."),
    // "digital" is what older forms and links sent; it meant a QR e-ticket.
    format: z.preprocess((v) => (v === "digital" ? "qr" : v), z.enum(FORMATS as [TicketFormat, ...TicketFormat[]], "Choose what kind of ticket it is.")),
    quantity: z.coerce.number("Enter how many tickets.").int().min(1, "List at least one ticket.").max(10, "List at most 10 tickets at once."),
    askingPrice: rupees("asking price"),
    originalPrice: optionalRupees("Enter the original price in rupees, or leave it blank."),
    priceNegotiable: checkbox,
    // Optional: the quick form leaves it out and the format decides (see defaultHandover).
    handoverMethod: z.enum(["in_person", "digital_transfer", "either"], "Choose how you'll hand it over.").optional(),
    // Multi-ticket deal: both blank, or both filled.
    bulkMinQuantity: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 2 || n > 10) {
          ctx.addIssue({ code: "custom", message: "A multi-ticket deal starts at 2 to 10 tickets." });
          return z.NEVER;
        }
        return n;
      }),
    bulkPrice: optionalRupees("Enter the deal price per ticket in rupees, or leave it blank."),
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
  .transform((v) => ({ ...v, handoverMethod: v.handoverMethod ?? defaultHandover(v.format) }))
  .refine((v) => handoversFor(v.format).includes(v.handoverMethod), {
    path: ["handoverMethod"],
    message: "That handover doesn't fit this kind of ticket. Physical tickets are handed over in person; app transfers happen in the app.",
  })
  .refine((v) => (v.bulkMinQuantity === null) === (v.bulkPrice === null), {
    path: ["bulkPrice"],
    message: "Fill in both the number of tickets and the deal price, or leave both blank.",
  })
  .refine((v) => v.bulkMinQuantity === null || v.bulkMinQuantity <= v.quantity, {
    path: ["bulkMinQuantity"],
    message: "The deal can't need more tickets than you're listing.",
  })
  .refine((v) => v.bulkPrice === null || v.bulkPrice < v.askingPrice, {
    path: ["bulkPrice"],
    message: "The deal price has to be lower than your asking price.",
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
  // Whether the seller gets the buyer's WhatsApp if (and only when) they accept.
  shareWhatsapp: checkbox,
  // A number to save to the buyer's own profile for that, when they don't have one yet.
  whatsapp: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const e164 = normalizeWhatsapp(v);
      if (!e164) {
        ctx.addIssue({ code: "custom", message: "Enter a 10-digit mobile number, or +country code and number." });
        return z.NEVER;
      }
      return e164;
    }),
});

export const offerInput = z.object({
  inquiryId: z.uuid(),
  amount: offerAmount(true),
});

// Kept in their own module so the report form can list them without shipping zod to the browser.
export { REPORT_REASONS, type ReportReason };

export const reportInput = z
  .object({
    listingId: z.uuid().optional(),
    reportedUserId: z.uuid().optional(),
    reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]], "Choose a reason."),
    details: optionalText(2000),
  })
  .refine((v) => v.listingId || v.reportedUserId, { message: "Nothing to report." });

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
