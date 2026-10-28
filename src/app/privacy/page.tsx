import type { Metadata } from "next";
import Link from "next/link";
import { Contents, ProsePage } from "@/components/prose-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: true, follow: true },
};

const SECTIONS: [string, string][] = [
  ["scope", "1. About this policy"],
  ["collect", "2. Information we collect"],
  ["visible", "3. What other people can see"],
  ["use", "4. How we use information"],
  ["sharing", "5. Who we share it with"],
  ["cookies", "6. Cookies and analytics"],
  ["retention", "7. How long we keep it"],
  ["choices", "8. Your choices and rights"],
  ["security", "9. Security"],
  ["eligibility", "10. Age and eligibility"],
  ["changes", "11. Changes and contact"],
];

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy Policy"
      intro="We collect only what we need to run the exchange. We don't sell your data, and we don't use advertising or third-party tracking."
      updated="28 October 2026"
    >
      <Contents items={SECTIONS} />

      <h2 id="scope">1. About this policy</h2>
      <p>
        ResTix (&quot;ResTix&quot;, &quot;we&quot;, &quot;us&quot;) runs an exchange where verified college students list event tickets
        they can no longer use and connect with other students who want them. This policy explains what personal information we
        handle when you use ResTix, why we handle it, who can see it, how long we keep it and the choices you have.
      </p>
      <p>
        ResTix is an independent service. It is not operated or endorsed by any university, college or event organiser unless an event
        page on ResTix says so.
      </p>

      <h2 id="collect">2. Information we collect</h2>
      <table className="stack-table">
        <thead>
          <tr>
            <th>Information</th>
            <th>Where it comes from</th>
            <th>Why we need it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Your name and email address</td>
            <td>Your Google account, when you sign in with Google</td>
            <td>To confirm you have an approved college email and to create your account. Your name is refreshed from Google each time you sign in.</td>
          </tr>
          <tr>
            <td>WhatsApp number (optional)</td>
            <td>You, on your account page or when sending a request</td>
            <td>So the other person can contact you once a seller accepts a request</td>
          </tr>
          <tr>
            <td>Listings: event, ticket type and format, quantity, prices, meetup area and notes</td>
            <td>You, when you list a ticket</td>
            <td>To show what is available</td>
          </tr>
          <tr>
            <td>Requests and offers: your message, quantity, offers and counter-offers, and the agreed price</td>
            <td>You, when you ask about a ticket or bargain</td>
            <td>To connect buyers and sellers and record what they agree</td>
          </tr>
          <tr>
            <td>Saved listings and the events you mark &quot;I want a ticket&quot;</td>
            <td>You</td>
            <td>To keep your watchlist and to show sellers how many people are looking</td>
          </tr>
          <tr>
            <td>Event suggestions</td>
            <td>You, when you suggest an event</td>
            <td>So an admin can review and add it</td>
          </tr>
          <tr>
            <td>Outcomes: whether a handover happened, didn&apos;t happen or was disputed</td>
            <td>You and the other person, after contact</td>
            <td>For a seller&apos;s track record and for overall totals</td>
          </tr>
          <tr>
            <td>Reports, appeals and moderation records</td>
            <td>You, other users and our moderators</td>
            <td>To deal with problems, review decisions and keep a record of every moderation action</td>
          </tr>
          <tr>
            <td>Usage events, such as a page viewed, a listing created or a request sent</td>
            <td>Our own systems, as you use ResTix</td>
            <td>To understand how ResTix is used and to fix problems</td>
          </tr>
          <tr>
            <td>Rate-limit counters</td>
            <td>Our own systems</td>
            <td>To stop spam and abuse</td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not collect government ID, Aadhaar numbers, ID card photos, payment details, contact lists or your location. ResTix does
        not process payments, so we never ask for bank details, card details or UPI PINs.
      </p>

      <h2 id="visible">3. What other people can see</h2>
      <ul>
        <li>
          <strong>Other signed-in students at your college</strong> see your name on your listings, your live listings, when you
          joined, how quickly you usually reply to requests, and how many handovers both sides confirmed as completed.
        </li>
        <li>
          <strong>A seller you send a request to</strong> sees your name, your message, the quantity you asked for and any offer you
          make.
        </li>
        <li>
          <strong>Your WhatsApp number stays private until a seller accepts a request.</strong> Only then can the two people in that
          request see the numbers they chose to share, and nobody else can.
        </li>
        <li>
          <strong>Nobody sees your email address</strong>, apart from our moderators when they need it to run the service.
        </li>
        <li>
          Saved listings are visible only to you. &quot;I want a ticket&quot; marks are only ever shown as a count, never with names.
        </li>
        <li>
          Reports are private. The person you report is not told who reported them, although the circumstances can sometimes make it
          obvious.
        </li>
      </ul>

      <h2 id="use">4. How we use information</h2>
      <p>We use personal information only to run and protect ResTix:</p>
      <ul>
        <li>to sign you in and check that your email address is eligible;</li>
        <li>to publish listings and send requests, offers and contact details to the right person;</li>
        <li>to show sellers&apos; track records and overall totals;</li>
        <li>to review reports and appeals, and to prevent fraud, spam, harassment and impersonation;</li>
        <li>to enforce our <Link href="/terms">Terms of Service</Link>;</li>
        <li>to understand how the service is used and to fix problems;</li>
        <li>to meet our legal obligations.</li>
      </ul>
      <p>We do not sell personal information and we do not use it for advertising.</p>

      <h2 id="sharing">5. Who we share it with</h2>
      <p>We share personal information only:</p>
      <ul>
        <li>
          with the companies that run our infrastructure: Supabase (database and sign-in) and Vercel (hosting). They process data on
          our behalf, only to provide their services, and may do so outside India;
        </li>
        <li>with Google, when you choose to sign in with your Google account;</li>
        <li>
          when the law requires it, or when it is reasonably necessary to protect someone&apos;s safety or to stop fraud or abuse.
        </li>
      </ul>
      <p>
        If you move a conversation to WhatsApp or another app, that app&apos;s own privacy policy applies to what you share there.
      </p>

      <h2 id="cookies">6. Cookies and analytics</h2>
      <p>We use our own basic analytics. There are no advertising cookies and no third-party trackers.</p>
      <ul>
        <li>
          <strong>Sign-in cookies</strong> keep you signed in. They are strictly necessary, and ResTix won&apos;t work without them.
        </li>
        <li>
          <strong><code>restix_aid</code></strong> is an analytics cookie with a random id, used to count visits from people who
          aren&apos;t signed in. It lasts 180 days. It is not set at all if your browser sends Global Privacy Control or Do Not Track.
        </li>
      </ul>
      <p>
        When you are signed in, usage events are linked to your account. They hold the kind of event and a few counts, never the text
        of your searches, messages or listings.
      </p>
      <p>
        We don&apos;t store IP addresses with your account or your usage events. For visitors who are not signed in, the network
        address is used briefly as a spam-limit key and deleted within two days. Our hosting provider keeps standard request logs,
        which include IP addresses, for a short period to run and secure the service.
      </p>

      <h2 id="retention">7. How long we keep it</h2>
      <ul>
        <li>Account information, listings and requests: for as long as your account exists.</li>
        <li>Usage events: 18 months, then deleted automatically.</li>
        <li>Rate-limit counters: deleted automatically after two days.</li>
        <li>Backups: deleted information can remain in backups for up to about 30 days.</li>
        <li>
          Reports and the moderation audit log: kept after an account is deleted, with your account unlinked, so that past safety
          decisions stay accurate.
        </li>
      </ul>

      <h2 id="choices">8. Your choices and rights</h2>
      <ul>
        <li>
          <strong>See and update your details.</strong> Your <Link href="/account">Account page</Link> shows your details and lets you
          change or remove your WhatsApp number. Your name comes from your Google account, so to change it, change it there and sign in
          again.
        </li>
        <li>
          <strong>Delete your account.</strong> From your Account page, type &quot;delete my account&quot;. This permanently removes
          your profile, private details, listings, requests, offers, saved listings and outcomes. Reports you filed stay, without your
          name. Audit log entries stay, with your account unlinked.
        </li>
        <li>
          <strong>If there is an open report about your account, or your account is restricted,</strong> it can&apos;t be deleted
          until that is resolved. This stops people deleting an account to avoid a decision. A restricted account can appeal from the
          Account page.
        </li>
        <li>
          <strong>Browse without the analytics cookie</strong> by turning on Global Privacy Control or Do Not Track in your browser.
          This applies while you are signed out.
        </li>
      </ul>
      <p>
        These choices sit alongside your rights under India&apos;s Digital Personal Data Protection Act, 2023, and nothing in this
        policy limits them.
      </p>

      <h2 id="security">9. Security</h2>
      <p>
        Access to data is restricted at the database level, so each person can reach only what they are allowed to see. Moderator
        actions are logged, and limits are in place to stop spam and automated abuse. No system is perfectly secure, so never put
        passwords, OTPs, UPI PINs, QR codes or booking references in a listing or message. ResTix will never ask you for them.
      </p>

      <h2 id="eligibility">10. Age and eligibility</h2>
      <p>
        ResTix is for college students with an approved college email account. If you are under 18, use ResTix only with the consent of
        a parent or guardian. If you think a child&apos;s information has reached us without that consent, report it from the relevant
        listing and we will look into it.
      </p>

      <h2 id="changes">11. Changes and contact</h2>
      <p>
        We will update this policy when our services or data practices change, and change the date at the top. Where the law requires
        notice or consent for a change, we will give it.
      </p>
      <p>
        To manage or delete your data, use your <Link href="/account">Account page</Link>. To raise a concern about a listing or another
        user, use Report on the listing. To challenge a moderation decision, use Appeal on your Account page. See also our{" "}
        <Link href="/terms">Terms of Service</Link> and <Link href="/safety">Safety guidelines</Link>.
      </p>
    </ProsePage>
  );
}
