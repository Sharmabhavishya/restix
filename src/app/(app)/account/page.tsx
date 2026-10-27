import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireViewer } from "@/server/auth/viewer";
import { privateProfile, profileSummary } from "@/server/profile";
import { myAppeals, myReports } from "@/server/moderation";
import { REPORT_REASONS } from "@/lib/validation";
import { formatLongDate, relativeTime } from "@/lib/format";
import { ProfileForm } from "./profile-form";
import { AppealForm, DeleteForm } from "./account-forms";
import { VerifiedEmail } from "@/components/listing-bits";
import { KeyValue, Notice, PageTitle, Pill } from "@/components/ui/bits";
import { signOut } from "@/app/auth/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata: Metadata = { title: "Account" };

function Section({ id, title, description, children }: { id?: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="grid gap-4 border-b border-border py-8 first:pt-0 last:border-0 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      <div className="min-w-0 rounded-2xl bg-[#fafafa] p-4 sm:p-5">{children}</div>
    </section>
  );
}

const APPEAL_TONE = { open: "warning", upheld: "neutral", reversed: "positive" } as const;

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const sp = await searchParams;
  const viewer = await requireViewer("/account");
  const [priv, summary, reports, appeals] = await Promise.all([
    privateProfile(viewer.id),
    profileSummary(viewer.id),
    myReports(viewer.id),
    myAppeals(viewer.id),
  ]);
  const underAction = viewer.status !== "active";

  return (
    <>
      <PageTitle title="Account" sub={priv?.email ? `Signed in as ${priv.email}. Only you and moderators can see this address.` : undefined} />
      {sp.notice === "suspended" && (
        <Notice tone="error" className="mb-6" title="Your account is suspended">
          You can&apos;t use the marketplace while the suspension stands. {viewer.statusReason ? `Reason: ${viewer.statusReason}.` : ""} You can appeal below.
        </Notice>
      )}

      <Section title="Profile" description="Your name shows on listings and requests. Your email and number stay private.">
        <ProfileForm displayName={viewer.displayName} whatsapp={priv?.whatsappNumber ?? null} />
      </Section>

      <Section
        title="Verification"
        description="What signing in with Google proves, and what it doesn't."
      >
        <KeyValue
          items={[
            { label: "Institutional email", value: viewer.emailVerifiedAt ? <VerifiedEmail college={viewer.collegeShortName} /> : "Not verified" },
            { label: "Verified on", value: viewer.emailVerifiedAt ? formatLongDate(viewer.emailVerifiedAt) : "—" },
            { label: "College", value: viewer.collegeName },
            { label: "Account status", value: <Pill tone={viewer.status === "active" ? "positive" : "negative"}>{viewer.status === "active" ? "Active" : viewer.status === "restricted" ? "Restricted" : "Suspended"}</Pill> },
          ]}
        />
        <p className="mt-3 text-[13px] text-muted">
          Verification means you control a {viewer.collegeShortName} Google account. It isn&apos;t proof of enrolment, and it never vouches for a ticket.
        </p>
      </Section>

      <Section title="Your activity" description="Only you see this.">
        <KeyValue
          items={[
            { label: "Listings created", value: <span className="num">{summary.listings}</span> },
            { label: "Live right now", value: <span className="num">{summary.activeListings}</span> },
            { label: "Marked sold", value: <span className="num">{summary.sold}</span> },
            { label: "Requests you sent", value: <span className="num">{summary.inquiriesSent}</span> },
            { label: "Requests you received", value: <span className="num">{summary.inquiriesReceived}</span> },
          ]}
        />
      </Section>

      <Section title="Reports you sent" description="Reports are private. The person you reported isn't told who sent them.">
        {reports.length === 0 ? (
          <p className="text-sm text-muted">None. Hopefully it stays that way.</p>
        ) : (
          <ul className="divide-y divide-rule text-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{REPORT_REASONS[r.reason]}</span>
                  <span className="text-muted"> · {String(r.targetSnapshot.event ?? r.targetSnapshot.userName ?? "")} · {relativeTime(r.createdAt)}</span>
                </span>
                <Pill tone={r.status === "resolved" ? "positive" : r.status === "dismissed" ? "neutral" : "warning"}>
                  {r.status === "in_review" ? "In review" : r.status[0].toUpperCase() + r.status.slice(1)}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="appeal"
        title="Appeals"
        description={underAction ? "Think a moderator got it wrong? Tell us why." : "If a moderator ever restricts your account or removes a listing, you can appeal here."}
      >
        {appeals.length > 0 && (
          <ul className="mb-5 flex flex-col gap-3 text-sm">
            {appeals.map((a) => (
              <li key={a.id} className="rounded-[var(--radius-control)] bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">{relativeTime(a.createdAt)}</span>
                  <Pill tone={APPEAL_TONE[a.status as keyof typeof APPEAL_TONE] ?? "neutral"}>
                    {a.status === "open" ? "Waiting" : a.status === "reversed" ? "Decision reversed" : "Decision upheld"}
                  </Pill>
                </div>
                <p className="mt-1.5 line-clamp-2">{a.message}</p>
                {a.decisionNote && <p className="mt-1.5 text-muted">Moderator: {a.decisionNote}</p>}
              </li>
            ))}
          </ul>
        )}
        <AppealForm />
      </Section>

      <Section title="Sign out" description="Signs you out on this device.">
        <form action={signOut}>
          <SubmitButton variant="secondary" pendingLabel="Signing out…">Sign out</SubmitButton>
        </form>
      </Section>

      <Section
        title="Delete account"
        description={
          <>
            Permanently removes your profile, listings, requests and outcome confirmations. Reports you sent stay, without your name, so moderation history isn&apos;t lost.
            {underAction && " Accounts under a restriction can't be deleted here; appeal or email the team."}
          </>
        }
      >
        <DeleteForm />
      </Section>
    </>
  );
}
