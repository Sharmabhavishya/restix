import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Callout } from "@/components/prose-page";

export const metadata: Metadata = {
  title: "Safety",
  robots: { index: true, follow: true },
};

export default function SafetyPage() {
  return (
    <ProsePage
      title="Safety"
      intro={
        <>
          Short version: ResTix helps you find another student with a spare ticket. It does not check the ticket, hold your money or
          referee the deal. That part is on you, so here is how to do it without getting burned.
        </>
      }
      updated="27 October 2026"
    >
      <Callout>
        ResTix never handles payments. Buyers and sellers pay each other directly, and ResTix cannot recover money you send privately.
      </Callout>

      <h2>What ResTix does and does not check</h2>
      <p>
        Short version: a listing tells you a few separate things, and none of them is &quot;this ticket is real&quot;.
      </p>
      <ul>
        <li>
          <strong>Seller&apos;s email verified.</strong> Signing in with a verified institutional Google account proves control of that
          email address only. It is not proof of enrolment, identity or ticket validity.
        </li>
        <li>
          <strong>The event&apos;s resale policy.</strong> Moderators set it per event as allowed, face value only, prohibited or
          unconfirmed, and show the source. If a listing for an unconfirmed event is approved, that approval is only a policy check.
        </li>
        <li>
          <strong>ResTix does not check the ticket itself.</strong> We do not guarantee that any ticket or wristband is genuine, valid
          or unused, or that a deal will go ahead.
        </li>
      </ul>
      <p>
        Wristbands can be fake, already used, cut and re-sealed, or invalidated by the organisers. Check what you are buying before you
        pay.
      </p>

      <h2>Meeting up</h2>
      <p>Short version: keep it public, keep it daylight, and keep your money in your pocket until you have seen the thing.</p>
      <ul>
        <li>Meet in a busy, public spot on campus, in daylight or a well-lit area.</li>
        <li>Never go to someone&apos;s room, and do not invite a stranger to yours.</li>
        <li>Check the wristband or ticket in person before you pay.</li>
        <li>Pay at the handover, never in advance. Do not &quot;pay first to hold it&quot;.</li>
        <li>Bring a friend if you can, and tell someone where you are going.</li>
      </ul>

      <h2>Keep QR codes and booking details private</h2>
      <p>
        Never share or post QR codes, booking IDs or receipts, in a listing, a request or a chat. Anyone who sees one could use it, and
        then the real ticket is gone. ResTix listings are blocked from containing phone numbers, emails and social handles, and you
        should treat ticket codes the same way.
      </p>

      <h2>Red flags</h2>
      <p>Short version: if it feels off, it probably is. Be wary of:</p>
      <ul>
        <li>Urgency, such as &quot;someone else is paying now, decide in five minutes&quot;.</li>
        <li>Anyone asking you to pay first, or to pay a deposit to hold the ticket.</li>
        <li>Prices far below face value.</li>
        <li>Pressure to move off the platform early, before you have agreed anything in a request.</li>
        <li>Someone who will not meet in person or keeps changing the plan.</li>
        <li>Anyone asking for a bank detail, card detail or UPI PIN. ResTix never asks for these, and neither should a seller.</li>
      </ul>

      <h2>How contact works</h2>
      <p>
        A buyer sends a request with a message and a quantity. The seller accepts or declines. If the seller accepts, they choose what
        to share: a WhatsApp link built from their optional private number, a short note, or both. Only that buyer sees it. There is no
        in-app chat, so once you move to WhatsApp, the rules of that app apply. Use its block and report tools if someone harasses you.
      </p>
      <p>
        After contact, each person can privately record an outcome: handed over, didn&apos;t happen, or disputed. These are used only
        for anonymous totals.
      </p>

      <h2>If something goes wrong</h2>
      <ul>
        <li>
          <strong>Report it in ResTix.</strong> Any eligible student can report a listing. Reasons include suspected scam, fake or
          misleading, duplicate, resale not allowed, impersonation, spam, harassment, suspicious seller behaviour, disputed handover
          and other.
        </li>
        <li>
          <strong>Harassment.</strong> Report it in ResTix and block the person on the messaging app.
        </li>
        <li>
          <strong>Crimes or threats.</strong> Contact your campus security using the contact details your university provides, or the
          police. ResTix moderators are students, not law enforcement.
        </li>
      </ul>

      <h2>What happens to a report</h2>
      <p>
        Reports are private. The reported person is not told who reported them. You can have one open report per person per listing.
        Moderators can hide, remove or restore listings, restrict accounts (a restricted account can browse but cannot list, contact or
        report) or suspend them, which takes their live listings down. Every moderation action is recorded in an append-only audit log
        with a reason. Rate limits on listings, requests and reports help keep spam down.
      </p>
      <p>
        More detail is in our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy</Link> pages. To manage your own
        details or appeal a decision, go to your <Link href="/account">account</Link>. New here? <Link href="/sign-in">Sign in</Link>{" "}
        with your institutional Google account.
      </p>
    </ProsePage>
  );
}
