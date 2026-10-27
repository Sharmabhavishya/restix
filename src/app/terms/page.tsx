import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Callout } from "@/components/prose-page";

export const metadata: Metadata = {
  title: "Terms",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <ProsePage
      title="Terms"
      intro={
        <>
          Short version: be honest, only sell what is yours to sell, do not scam or harass anyone, and remember ResTix is a noticeboard,
          not a marketplace with protections. By using ResTix you agree to the rules below.
        </>
      }
      updated="27 October 2026"
    >
      <Callout>
        This is a template written for a student project. It should be reviewed by the institution and, where needed, a legal
        professional before wide launch.
      </Callout>

      <h2>Who can use ResTix</h2>
      <ul>
        <li>Access is limited to verified institutional email accounts.</li>
        <li>One account per person.</li>
        <li>
          No impersonation. Display names cannot impersonate staff, organisers or other people, and you must not pretend to be someone
          you are not.
        </li>
      </ul>

      <h2>What ResTix is, and is not</h2>
      <p>
        Short version: a board where verified students list tickets they can&apos;t use, from fest wristbands to e-tickets, and contact each other.
        It is a student project. It is not affiliated with event organisers or the university administration unless an event page says
        so.
      </p>
      <p>
        ResTix does not sell tickets, does not check that a ticket or wristband is genuine, valid or unused, and does not guarantee
        that any deal will happen. Verifying an institutional email proves control of that email address only. See our{" "}
        <Link href="/safety">Safety</Link> page for how to protect yourself.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Only list tickets you own and are allowed to resell.</li>
        <li>Follow the event&apos;s rules and your university&apos;s rules.</li>
        <li>
          Respect each event&apos;s resale policy. Prohibited events cannot be listed, face value only events cap your asking price at
          the original price, and listings for events with an unconfirmed policy wait for a moderator check.
        </li>
        <li>No scalping above the limits that apply to the event.</li>
        <li>Keep listings accurate. Do not list counterfeit or already used tickets.</li>
        <li>Do not put QR codes, booking references, phone numbers, emails or social handles in listings.</li>
      </ul>

      <h2>Prohibited conduct</h2>
      <ul>
        <li>Scams, including taking payment and not handing over a ticket.</li>
        <li>Harassment, threats or abuse.</li>
        <li>Spam, including repeated or duplicate listings and requests.</li>
        <li>Misleading listings.</li>
        <li>Evading moderation, for example by making a new account after a restriction or suspension.</li>
        <li>Automated scraping or other automated use of ResTix.</li>
      </ul>

      <h2>Moderation, enforcement and appeals</h2>
      <p>
        Moderators can hide, remove or restore listings, restrict accounts (browse only, with no listing, contacting or reporting) and
        suspend accounts, which takes live listings down. Every moderation action is recorded in an append-only audit log with a
        reason. Any eligible student can report a listing, and reports are private.
      </p>
      <p>
        If you disagree with a decision, you can appeal from your <Link href="/account">account page</Link>. Where possible, a
        different moderator decides your appeal.
      </p>

      <h2>No payments, no warranties, limited liability</h2>
      <p>
        ResTix never processes payments, holds money, charges fees, provides escrow or handles refunds. Buyers and sellers pay each
        other directly, and ResTix cannot recover money sent privately. You deal with other users at your own risk.
      </p>
      <p>To the extent the law allows:</p>
      <ul>
        <li>ResTix is provided as is and as available, without warranties of any kind.</li>
        <li>
          We do not promise that listings are accurate, that tickets are genuine, or that the service will always be available.
        </li>
        <li>
          We are not responsible for losses from deals between users, including money lost, invalid tickets or missed events, or for
          what other users say or do.
        </li>
        <li>Nothing here limits any right you have that the law does not allow to be limited.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        How we handle personal data is explained on our <Link href="/privacy">Privacy</Link> page.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms as ResTix changes. The date at the top shows when they were last updated. If you keep using ResTix
        after a change, you accept the updated terms.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account from the <Link href="/account">Account page</Link>. We can restrict or suspend accounts that break
        these terms. If your account is under a moderation restriction, you need to appeal or email the team to request deletion.
        Contact: the ResTix team at the email address listed on the sign-in page of this deployment. Not signed in?{" "}
        <Link href="/sign-in">Sign in</Link>.
      </p>
    </ProsePage>
  );
}
