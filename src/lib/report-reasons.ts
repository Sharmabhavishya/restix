// Why someone can report a listing or a person. Plain data, safe to import in the browser.
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
