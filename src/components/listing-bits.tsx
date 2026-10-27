import { BadgeCheck, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import { POLICY_LABEL, STATUS_LABEL, type ListingStatus, type TransferPolicy } from "@/lib/listing-rules";
import { Pill, type Tone } from "./ui/bits";

const STATUS_TONE: Record<ListingStatus, Tone> = {
  draft: "neutral",
  pending_review: "warning",
  active: "positive",
  paused: "neutral",
  sold: "neutral",
  unavailable: "neutral",
  expired: "neutral",
  removed: "negative",
  rejected: "negative",
};

export function StatusPill({ status }: { status: ListingStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}

const POLICY_ICON = { allowed: ShieldCheck, face_value_only: ShieldAlert, prohibited: ShieldX, unknown: ShieldQuestion };
const POLICY_TONE: Record<TransferPolicy, Tone> = { allowed: "positive", face_value_only: "accent", prohibited: "negative", unknown: "warning" };

/** Event-level fact: whether resale is allowed. Never a claim about a specific ticket. */
export function PolicyPill({ policy }: { policy: TransferPolicy }) {
  const Icon = POLICY_ICON[policy];
  return (
    <Pill tone={POLICY_TONE[policy]}>
      <Icon className="size-3.5" aria-hidden />
      {POLICY_LABEL[policy]}
    </Pill>
  );
}

/** Seller-level fact: they control an institutional mailbox. Not proof of enrolment or of the ticket. */
export function VerifiedEmail({ short }: { short?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-positive" title="Signed in with a verified college email address. This does not verify the ticket.">
      <BadgeCheck className="size-4" aria-hidden />
      {short ? "college email" : "college email verified"}
    </span>
  );
}

export function FixtureTag() {
  return (
    <Pill tone="warning" className="h-5 px-2 text-[11px]">
      Sample data
    </Pill>
  );
}
