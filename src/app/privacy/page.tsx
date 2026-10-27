import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Callout } from "@/components/prose-page";

export const metadata: Metadata = {
  title: "Privacy",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy"
      intro={
        <>
          Short version: we collect what we need to run a student ticket exchange, we do not sell it, and we do not use third-party
          analytics or ad trackers. Below is exactly what is stored and who can see it.
        </>
      }
      updated="27 October 2026"
    >
      <Callout>
        This is a template written for a student project. It should be reviewed by the institution and, where needed, a legal
        professional before wide launch.
      </Callout>

      <h2>Who this covers</h2>
      <p>
        ResTix lets verified students list tickets they can&apos;t use, from fest wristbands to e-tickets, and contact each other.
        Access is limited to verified institutional email accounts. We aim to follow the principles of India&apos;s Digital Personal
        Data Protection Act, 2023. Contact: the ResTix team at the email address listed on the sign-in page of this deployment.
      </p>

      <h2>What we collect</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Why</th>
            <th>Who can see it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Google account name and email, from Google sign-in via Supabase Auth</td>
            <td>To verify your institutional email and create your account</td>
            <td>You and moderators. Your email is never shown to other students.</td>
          </tr>
          <tr>
            <td>Display name (you choose it, 2 to 40 characters)</td>
            <td>To identify you on listings and requests</td>
            <td>Signed-in students</td>
          </tr>
          <tr>
            <td>Optional WhatsApp number</td>
            <td>So a seller can share a contact link</td>
            <td>Stored privately. Shared only with a specific buyer, and only if the seller chooses to when accepting that request.</td>
          </tr>
          <tr>
            <td>Listings: event, ticket type, format, quantity, prices, meetup area, notes</td>
            <td>To show what is for sale</td>
            <td>Signed-in eligible students of the same college while the listing is live, and always the seller</td>
          </tr>
          <tr>
            <td>Requests: message, quantity, status, shared contact</td>
            <td>To let buyers and sellers connect</td>
            <td>The buyer, the seller and moderators</td>
          </tr>
          <tr>
            <td>Outcome confirmations</td>
            <td>To produce anonymous totals</td>
            <td>The two parties and moderators. Counted anonymously.</td>
          </tr>
          <tr>
            <td>Reports and appeals</td>
            <td>To handle problems and review decisions</td>
            <td>The person who filed it and moderators. The reported person does not learn who reported.</td>
          </tr>
          <tr>
            <td>Moderation audit log</td>
            <td>To keep a record of every moderation action and its reason</td>
            <td>Moderators</td>
          </tr>
          <tr>
            <td>Analytics events, such as page viewed, listing created, request sent</td>
            <td>To see how the service is used and fix problems</td>
            <td>Admins see aggregates</td>
          </tr>
          <tr>
            <td>Rate-limit counters, keyed by account</td>
            <td>To prevent spam</td>
            <td>The system and admins</td>
          </tr>
        </tbody>
      </table>

      <h2>Analytics and cookies</h2>
      <p>
        Short version: our own basic analytics, no tracking companies. Analytics events are linked to your account id when you are
        signed in, or to a random cookie id when you are not. We do not record IP addresses or search text, and we do not use
        third-party analytics or ad trackers.
      </p>
      <ul>
        <li>Supabase auth session cookies are strictly necessary to keep you signed in.</li>
        <li>
          <code>restix_aid</code> is an analytics cookie that lasts 180 days. It is not set when your browser sends Global Privacy
          Control or Do Not Track, so those browsers get no anonymous id.
        </li>
        <li>In local development only, a signed dev-session cookie is used.</li>
      </ul>

      <h2>What we do not collect</h2>
      <p>
        We do not collect government ID, Aadhaar, ID card photos, payment details, location tracking or your contacts. ResTix does not
        process payments, so it never asks for bank details, card details or UPI PINs.
      </p>

      <h2>Where data is stored</h2>
      <p>
        The database and authentication run on Supabase. The app is hosted on a cloud provider such as Vercel. Your data may be
        processed outside India by these providers.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account data is kept while your account exists.</li>
        <li>
          Analytics events are kept for up to 18 months, then deleted or aggregated. This is our policy.
        </li>
        <li>
          Backups may keep deleted data for a limited period, typically up to 30 days.
        </li>
      </ul>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account from the <Link href="/account">Account page</Link> by typing &quot;delete my account&quot;. This
        permanently removes your profile, private details, listings, requests and outcome confirmations. Reports you filed remain,
        without your name. Audit log entries remain, with your account unlinked.
      </p>
      <p>
        If your account is under a moderation restriction, you need to appeal or email the team to request deletion. This is so
        decisions cannot be dodged by deleting an account.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see and correct your details on your <Link href="/account">Account page</Link>, delete your account as described
        above, and ask us questions about your data. Contact: the ResTix team at the email address listed on the sign-in page of this
        deployment.
      </p>

      <h2>Related pages</h2>
      <p>
        Read our <Link href="/terms">Terms</Link> and <Link href="/safety">Safety</Link> pages. Ready to go? <Link href="/sign-in">Sign in</Link>.
      </p>
    </ProsePage>
  );
}
