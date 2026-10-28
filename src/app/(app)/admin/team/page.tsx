import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/viewer";
import { team } from "@/server/admin";
import { findUsers } from "@/server/moderation";
import { formatLongDate } from "@/lib/format";
import { ModForm } from "../mod-form";
import { EmptyState, PageTitle, Panel, Pill } from "@/components/ui/bits";
import { Input } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Team" };

const CAN = [
  "Review reports and decide appeals",
  "Approve, hide, remove and restore listings",
  "Restrict, suspend and reinstate students",
  "Add and edit events, and approve event requests",
];
const ADMIN_ONLY = ["Delete events", "Add or remove moderators", "Export accounts", "See analytics"];

export default async function TeamPage({ searchParams }: PageProps<"/admin/team">) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const [members, found] = await Promise.all([team(admin.id), q ? findUsers(admin.id, q) : Promise.resolve([])]);
  const candidates = found.filter((u) => !u.role && u.status === "active");

  return (
    <>
      <PageTitle title="Team" sub="The people who run ResTix with you. You're the only admin; everyone you add here is a moderator." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="flex flex-col gap-6">
          <Panel className="p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold">Current team ({members.length})</h2>
            <ul className="mt-4 flex flex-col divide-y divide-border">
              {members.map((m) => (
                <li key={m.id} className="grid gap-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {m.displayName} <Pill tone={m.role === "admin" ? "accent" : "neutral"}>{m.role}</Pill>
                    </p>
                    <p className="mt-0.5 text-[13px] break-all text-muted">{m.email}</p>
                    <p className="mt-1 text-[13px] text-muted">Since {formatLongDate(m.grantedAt)}</p>
                  </div>
                  {m.id === admin.id ? (
                    <p className="text-sm text-muted">That&apos;s you.</p>
                  ) : m.role === "moderator" ? (
                    <ModForm hidden={{ userId: m.id }} compact ops={[{ op: "role:none", label: "Remove moderator", tone: "danger" }]} reasonLabel="Reason" />
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold">Add a moderator</h2>
            <p className="mt-1 text-[13px] text-muted">Find a student by name or college email. They need to have signed in to ResTix once.</p>
            <form method="get" className="mt-4 flex max-w-xl gap-2">
              <Input name="q" type="search" defaultValue={q} placeholder="Name or email" aria-label="Find a student" />
              <button className={buttonClass("dark")}>Search</button>
            </form>
            {q && (candidates.length === 0 ? (
              <EmptyState title="no one to add" className="mt-4">No active student without a role matches “{q}”.</EmptyState>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-border">
                {candidates.map((u) => (
                  <li key={u.id} className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
                    <div className="min-w-0">
                      <p className="font-semibold">{u.displayName}</p>
                      <p className="mt-0.5 text-[13px] break-all text-muted">{u.email}</p>
                      <p className="mt-1 text-[13px] text-muted">Joined {formatLongDate(u.createdAt)} · <span className="num">{u.listings}</span> listings</p>
                    </div>
                    <ModForm hidden={{ userId: u.id }} compact ops={[{ op: "role:moderator", label: "Make moderator" }]} reasonLabel="Why them?" />
                  </li>
                ))}
              </ul>
            ))}
          </Panel>
        </div>

        <Panel className="h-fit p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">Moderators can</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-ink-soft">
            {CAN.map((c) => <li key={c}>· {c}</li>)}
          </ul>
          <h2 className="mt-5 text-[15px] font-semibold">Only you can</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-ink-soft">
            {ADMIN_ONLY.map((c) => <li key={c}>· {c}</li>)}
          </ul>
          <p className="mt-5 text-[13px] text-muted">Every change here is recorded in the audit log with its reason.</p>
        </Panel>
      </div>
    </>
  );
}
