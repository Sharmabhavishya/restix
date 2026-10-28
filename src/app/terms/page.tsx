import type { Metadata } from "next";
import Link from "next/link";
import { Contents, ProsePage } from "@/components/prose-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  robots: { index: true, follow: true },
};

const SECTIONS: [string, string][] = [
  ["agreement", "1. Agreement"],
  ["service", "2. What ResTix is"],
  ["accounts", "3. Eligibility and accounts"],
  ["selling", "4. Selling"],
  ["buying", "5. Buying, offers and contact"],
  ["payments", "6. Payments between users"],
  ["conduct", "7. Prohibited conduct"],
  ["moderation", "8. Reports, moderation and appeals"],
  ["content", "9. Your content"],
  ["liability", "10. Disclaimers and liability"],
  ["ending", "11. Ending your account"],
  ["general", "12. Changes, law and contact"],
];

export default function TermsPage() {
  return (
    <ProsePage
      title="Terms of Service"
      intro="The rules for using ResTix. Please read them before you list or request a ticket."
      updated="28 October 2026"
    >
      <Contents items={SECTIONS} />

      <h2 id="agreement">1. Agreement</h2>
      <p>
        These Terms of Service (&quot;Terms&quot;) are an agreement between you and ResTix (&quot;ResTix&quot;, &quot;we&quot;,
        &quot;us&quot;) and govern your use of the ResTix website and services. By creating an account or using ResTix, you agree to
        these Terms, our <Link href="/privacy">Privacy Policy</Link> and our <Link href="/safety">Safety guidelines</Link>. If you
        don&apos;t agree, please don&apos;t use ResTix.
      </p>

      <h2 id="service">2. What ResTix is</h2>
      <p>
        ResTix is a listing and connection service. Verified college students list event tickets they can no longer use, and other
        students request them. When a seller accepts a request, ResTix puts the two people in touch so they can complete the handover
        themselves.
      </p>
      <p>ResTix is not a party to any deal between users. In particular, ResTix:</p>
      <ul>
        <li>does not own, issue, sell or transfer tickets;</li>
        <li>does not check whether a ticket or wristband is genuine, valid or unused;</li>
        <li>does not process payments, hold money, provide escrow, charge fees or issue refunds;</li>
        <li>does not guarantee that a listing is accurate, that a deal will happen or that you will get into an event;</li>
        <li>
          is independent, and is not operated or endorsed by any university, college or event organiser unless an event page on
          ResTix says so.
        </li>
      </ul>

      <h2 id="accounts">3. Eligibility and accounts</h2>
      <ul>
        <li>
          You need an approved college email account, or an account we have individually approved, and you must sign in with Google.
          A verified email shows that you control that address. It is not proof of identity, enrolment or ticket ownership.
        </li>
        <li>If you are under 18, you may use ResTix only with the consent of a parent or guardian.</li>
        <li>One account per person. Don&apos;t share your account or use anyone else&apos;s.</li>
        <li>
          Your name comes from your Google account and is shown on your listings and requests. Don&apos;t use an account that
          impersonates another person or organisation.
        </li>
        <li>You are responsible for activity on your account. Keep your Google account secure.</li>
      </ul>

      <h2 id="selling">4. Selling</h2>
      <p>When you list a ticket, you confirm that:</p>
      <ul>
        <li>you own the ticket, or are allowed to transfer it, and you are allowed to resell it;</li>
        <li>the details are accurate and complete, including the event, ticket type, format, quantity and price;</li>
        <li>
          the ticket is genuine and unused, and you will update or remove the listing as soon as it is sold, used or no longer
          available;
        </li>
        <li>you will follow the event organiser&apos;s rules and any rules of your college.</li>
      </ul>
      <p>
        An event can carry a resale rule. If resale is not allowed, its tickets can&apos;t be listed. If an event allows resale at face
        value only, your price can&apos;t be above face value. If nobody has confirmed an event&apos;s rule yet, a moderator checks the
        listing before it goes live. That check covers the event&apos;s rule only, not your ticket.
      </p>
      <p>
        Listing text must not include phone numbers, email addresses, social media handles, QR codes, barcodes or booking references.
      </p>

      <h2 id="buying">5. Buying, offers and contact</h2>
      <ul>
        <li>
          A request is an expression of interest, not a binding purchase. Either person can step back until the handover is done.
        </li>
        <li>
          On listings open to offers, buyers and sellers can offer and counter-offer. When one side accepts the other&apos;s offer, that
          becomes the agreed price for the request. If a seller accepts a request while the buyer&apos;s offer is open, the seller
          agrees to that offer.
        </li>
        <li>
          When a seller accepts, each person&apos;s chosen contact details are shared with the other person in that request only. Use
          them only to complete that deal.
        </li>
        <li>
          Check the ticket before you pay. Once you move to WhatsApp or another app, that app&apos;s terms apply to your conversation.
        </li>
      </ul>

      <h2 id="payments">6. Payments between users</h2>
      <p>
        Buyers and sellers pay each other directly, outside ResTix. ResTix never receives or holds money and cannot reverse, refund or
        recover a payment. You are responsible for deciding whether to go ahead with a deal, for checking the ticket and for agreeing a
        safe handover. See our <Link href="/safety">Safety guidelines</Link>.
      </p>

      <h2 id="conduct">7. Prohibited conduct</h2>
      <p>You must not:</p>
      <ul>
        <li>scam anyone, including taking payment without handing over a valid ticket;</li>
        <li>list counterfeit, used, cancelled or duplicate tickets, or tickets you are not allowed to resell;</li>
        <li>get around an event&apos;s resale rule or price limit;</li>
        <li>harass, threaten, abuse or discriminate against anyone;</li>
        <li>impersonate another person or organisation;</li>
        <li>share another person&apos;s private information without their permission;</li>
        <li>spam, including repeated or duplicate listings, requests or offers;</li>
        <li>use bots, scrapers or other automated means to access ResTix or collect its data;</li>
        <li>try to break, overload or gain unauthorised access to ResTix or other people&apos;s accounts;</li>
        <li>create a new account to get around a restriction or suspension;</li>
        <li>use ResTix for anything unlawful.</li>
      </ul>

      <h2 id="moderation">8. Reports, moderation and appeals</h2>
      <p>
        You can report any listing from its page, including problems with the person who listed it. Reports are private: the person
        reported isn&apos;t told who reported them.
      </p>
      <p>
        To keep ResTix safe, our moderators may hide, remove or restore listings; restrict an account so that it can browse but
        can&apos;t list, request or report; or suspend an account, which also takes down its live listings. We may act without notice
        when we reasonably believe someone is at risk or these Terms have been broken. Every moderation action is recorded with a
        reason.
      </p>
      <p>
        If you disagree with a decision, appeal from your <Link href="/account">Account page</Link>. Where possible, a different
        moderator reviews the appeal. Moderation decisions are not legal findings, and our moderators are not law enforcement.
      </p>

      <h2 id="content">9. Your content</h2>
      <p>
        You own what you post. You allow ResTix to store and display your listings, requests and other content as needed to run the
        service. We may remove content that breaks these Terms or puts people at risk.
      </p>

      <h2 id="liability">10. Disclaimers and liability</h2>
      <p>
        ResTix is provided &quot;as is&quot; and &quot;as available&quot;. To the extent the law allows, we make no promises that
        listings are accurate, that tickets are genuine, that users will behave as they should or that the service will always be
        available.
      </p>
      <p>
        To the extent the law allows, ResTix is not liable for losses arising from deals between users, including money paid to
        another user, invalid tickets or missed events, or for indirect or consequential losses. Nothing in these Terms excludes
        liability or rights that cannot legally be excluded.
      </p>

      <h2 id="ending">11. Ending your account</h2>
      <p>
        You can delete your account at any time from your <Link href="/account">Account page</Link>. If there is an open report about
        your account, or your account is restricted, it can&apos;t be deleted until that is resolved. What we keep after deletion is
        described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <p>We may restrict, suspend or close accounts that break these Terms or put other users at risk.</p>

      <h2 id="general">12. Changes, law and contact</h2>
      <p>
        We may update these Terms as ResTix changes, and we will change the date at the top when we do. Where the law requires notice
        of a change, we will give it. If you keep using ResTix after a change takes effect, the updated Terms apply.
      </p>
      <p>
        These Terms are governed by the laws of India, and disputes are subject to the jurisdiction of the competent courts in India.
      </p>
      <p>
        For problems with a listing or the person behind it, use Report on the listing. To challenge a moderation decision, use Appeal on your{" "}
        <Link href="/account">Account page</Link>.
      </p>
    </ProsePage>
  );
}
