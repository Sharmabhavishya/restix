import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Contents, ProsePage } from "@/components/prose-page";

export const metadata: Metadata = {
  title: "Safety",
  robots: { index: true, follow: true },
};

const SECTIONS: [string, string][] = [
  ["checks", "1. What ResTix checks, and what it doesn't"],
  ["before", "2. Before you buy"],
  ["paying", "3. Paying safely"],
  ["meeting", "4. Meeting up"],
  ["details", "5. Keep ticket details private"],
  ["flags", "6. Warning signs"],
  ["contact", "7. How contact works"],
  ["report", "8. Reporting a problem"],
  ["wrong", "9. If something has gone wrong"],
  ["community", "10. Community standards"],
];

export default function SafetyPage() {
  return (
    <ProsePage
      title="Safety"
      intro="ResTix connects you with another student who has a spare ticket. The handover is between the two of you, so here's how to do it safely."
      updated="28 October 2026"
    >
      <Callout>
        ResTix never handles payments. Check the ticket first, then pay at the handover. Money sent privately to another user
        can&apos;t be recovered by ResTix.
      </Callout>

      <Contents items={SECTIONS} />

      <h2 id="checks">1. What ResTix checks, and what it doesn&apos;t</h2>
      <ul>
        <li>
          <strong>The seller&apos;s email.</strong> Everyone signs in with a Google account on an approved college email. That proves
          they control the address. It doesn&apos;t prove who they are or that they own a ticket.
        </li>
        <li>
          <strong>The event&apos;s resale rule.</strong> Admins mark events where resale isn&apos;t allowed, or is limited to face
          value. Listings for events whose rule nobody has confirmed are checked by a moderator before going live.
        </li>
        <li>
          <strong>The seller&apos;s track record.</strong> Listings show when the seller joined, how quickly they usually reply and how
          many handovers both sides confirmed as completed. It&apos;s a useful signal, not a guarantee.
        </li>
        <li>
          <strong>Not the ticket itself.</strong> ResTix doesn&apos;t check whether a ticket or wristband is genuine, valid or unused.
        </li>
      </ul>

      <h2 id="before">2. Before you buy</h2>
      <ul>
        <li>Check the organiser&apos;s rules on resale and transfer.</li>
        <li>Confirm the event, date, ticket type, quantity and price.</li>
        <li>
          For QR, email and app tickets, use the organiser&apos;s official transfer where there is one, and check the ticket shows up
          in your own account.
        </li>
        <li>
          For wristbands, paper tickets and passes, inspect them in person. Wristbands can be fake, already used, cut and re-sealed, or
          cancelled by the organiser.
        </li>
        <li>Screenshots can be edited and don&apos;t prove a ticket is still valid.</li>
      </ul>

      <h2 id="paying">3. Paying safely</h2>
      <ul>
        <li>Pay at the handover, once you have checked the ticket. Never pay in advance to &quot;hold&quot; a ticket.</li>
        <li>Agree the price, quantity and handover plan before you meet.</li>
        <li>Never share your UPI PIN, card PIN, OTP, banking password or account recovery codes. You never need them to receive money.</li>
        <li>Watch out for fake payment screenshots, UPI collect requests and links or apps you weren&apos;t expecting.</li>
        <li>If someone insists on payment up front, refuses reasonable checks or rushes you, walk away.</li>
      </ul>

      <h2 id="meeting">4. Meeting up</h2>
      <ul>
        <li>Meet in a busy, public place, in daylight or a well-lit area.</li>
        <li>Don&apos;t go to a stranger&apos;s room, and don&apos;t invite one to yours.</li>
        <li>Tell a friend where you&apos;re going, or bring one along.</li>
        <li>If you feel unsafe, leave. You don&apos;t owe anyone a deal or an explanation.</li>
      </ul>

      <h2 id="details">5. Keep ticket details private</h2>
      <p>
        Never post or send QR codes, barcodes, booking IDs or full receipts to anyone except the person you are handing the ticket to,
        and only at the handover. Anyone who sees a code can use it, and then the real ticket is gone. ResTix blocks phone numbers,
        emails and social handles in listings, and you should treat ticket codes the same way.
      </p>

      <h2 id="flags">6. Warning signs</h2>
      <p>Be careful if someone:</p>
      <ul>
        <li>says you must decide or pay within minutes;</li>
        <li>asks for an advance, a deposit or a &quot;verification fee&quot;;</li>
        <li>offers a price far below face value, or keeps changing it;</li>
        <li>won&apos;t meet in person or use an official transfer;</li>
        <li>only sends cropped screenshots;</li>
        <li>asks for your UPI PIN, OTP, card or bank details;</li>
        <li>wants to move to another app before agreeing anything on ResTix;</li>
        <li>asks you to keep the deal secret, or gets angry when you ask questions.</li>
      </ul>
      <p>A verified college email doesn&apos;t rule any of this out. Scammers can have real accounts too.</p>

      <h2 id="contact">7. How contact works</h2>
      <p>
        A buyer sends a request with a message, a quantity and, if the listing is open to offers, a price. Both sides can offer and
        counter until one accepts. Nobody&apos;s phone number is shared at this stage.
      </p>
      <p>
        When the seller accepts, each person&apos;s chosen contact details, such as a WhatsApp number or a short note, are shared with
        the other person in that request only. ResTix prepares a first WhatsApp message with the agreed price, which you can edit
        before sending.
      </p>
      <p>
        Once you&apos;re on WhatsApp, use its block and report tools if someone harasses you, and report the listing on ResTix too.
        After the handover, each of you can privately record whether it happened. Confirmed handovers count towards the seller&apos;s
        track record.
      </p>

      <h2 id="report">8. Reporting a problem</h2>
      <p>
        Use Report on any listing. You can report a suspected scam, a fake or misleading listing, a duplicate, resale that isn&apos;t
        allowed, impersonation, spam, harassment, suspicious seller behaviour, a disputed handover or anything else.
      </p>
      <ul>
        <li>Describe what happened and when.</li>
        <li>Keep your messages and payment records in case a moderator needs more detail.</li>
        <li>Don&apos;t post private information publicly.</li>
      </ul>
      <p>
        Reports are private, and the person you report isn&apos;t told who reported them. Moderators can hide or remove listings,
        restrict accounts or suspend them. Every action is recorded with a reason, and decisions can be appealed from the{" "}
        <Link href="/account">Account page</Link>.
      </p>

      <h2 id="wrong">9. If something has gone wrong</h2>
      <ul>
        <li>Stop sending money or information.</li>
        <li>Contact your bank or payment app straight away, using its official app or helpline.</li>
        <li>
          Report cyber fraud at <a href="https://cybercrime.gov.in" rel="noopener noreferrer" target="_blank">cybercrime.gov.in</a> or by
          calling 1930.
        </li>
        <li>Keep the messages, transaction references and listing details.</li>
        <li>Report the listing on ResTix.</li>
        <li>If you shared a password or OTP, change it and secure the account.</li>
      </ul>
      <p>
        If you are threatened or in danger, contact campus security or call 112. ResTix moderators can act on accounts and listings, but
        they are not law enforcement and can&apos;t recover money or tickets.
      </p>

      <h2 id="community">10. Community standards</h2>
      <p>
        Treat people with respect. Harassment, threats, discrimination, sharing someone&apos;s private details, impersonation, spam,
        scams and retaliation against someone who reported you are not allowed. The full rules are in our{" "}
        <Link href="/terms">Terms of Service</Link>, and how we handle your data is in our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </ProsePage>
  );
}
