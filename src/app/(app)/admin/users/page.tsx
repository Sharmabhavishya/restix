import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireModerator } from "@/server/auth/viewer";
import { ACCOUNTS_PER_PAGE, listAccounts, type AccountFilter } from "@/server/admin";
import { formatLongDate } from "@/lib/format";
import { ModForm, type ModOp } from "../mod-form";
import { EmptyState, PageTitle, Panel, Pill } from "@/components/ui/bits";
import { Input } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Students" };

const SHOWS: { key: AccountFilter; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "flagged", label: "Needs a look" },
  { key: "team", label: "Team" },
];

const EXPORT_LINK = (
  // A plain link: the file downloads, and the download is logged.
  <a href="/api/admin/export" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90">
    <Download className="size-4" aria-hidden /> Export to Excel
  </a>
);

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const mod = await requireModerator();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const show = SHOWS.find((s) => s.key === sp.show)?.key ?? "all";
  const pageNo = Math.min(10_000, Math.max(1, Math.floor(Number(sp.page)) || 1));
  const { rows, total } = await listAccounts(mod.id, { q, show, page: pageNo });
  const pages = Math.max(1, Math.ceil(total / ACCOUNTS_PER_PAGE));

  const href = (over: { show?: AccountFilter; page?: number }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const s = over.show ?? show;
    if (s !== "all") p.set("show", s);
    if (over.page && over.page > 1) p.set("page", String(over.page));
    const qs = p.toString();
    return `/admin/users${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageTitle
        title="Students"
        sub={`${total.toLocaleString("en-IN")} ${total === 1 ? "account" : "accounts"}${q ? ` matching “${q}”` : ""}, newest first.`}
        actions={mod.role === "admin" ? EXPORT_LINK : undefined}
      />
      <div role="tablist" aria-label="Filter accounts" className="mb-4 flex gap-1 border-b border-border">
        {SHOWS.map((s) => (
          <Link
            key={s.key}
            role="tab"
            aria-selected={show === s.key}
            href={href({ show: s.key, page: 1 })}
            className={`tap -mb-px border-b-2 px-3 py-2.5 text-sm transition-colors ${show === s.key ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {s.label}
          </Link>
        ))}
      </div>
      <form method="get" className="mb-5 flex max-w-xl gap-2">
        {show !== "all" && <input type="hidden" name="show" value={show} />}
        <Input name="q" type="search" defaultValue={q} placeholder="Name or email" aria-label="Search accounts" />
        <button className={buttonClass("dark")}>Search</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={q || show !== "all" ? "no matches" : "no accounts yet"} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((u) => {
            const ops: ModOp[] = u.status === "active"
              ? [{ op: "user:restrict", label: "Restrict" }, { op: "user:suspend", label: "Suspend", tone: "danger" }]
              : [{ op: "user:reinstate", label: "Reinstate" }];
            const roleOps: ModOp[] = u.role === "moderator"
              ? [{ op: "role:none", label: "Remove moderator", tone: "danger" }]
              : u.role ? [] : [{ op: "role:moderator", label: "Make moderator" }];
            return (
              <li key={u.id}>
                <Panel className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{u.displayName}</span>
                      <Pill tone={u.status === "active" ? "positive" : "negative"}>{u.status}</Pill>
                      {u.role && <Pill tone="accent">{u.role}</Pill>}
                      {u.reportsAgainst > 0 && <Pill tone="warning">{u.reportsAgainst} {u.reportsAgainst === 1 ? "report" : "reports"}</Pill>}
                    </div>
                    <p className="mt-1 text-[13px] break-all text-muted">{u.email}</p>
                    {mod.role === "admin" && <p className="num mt-0.5 text-[13px] text-muted">{u.whatsappNumber ?? "no WhatsApp number"}</p>}
                    <p className="mt-2 text-[13px] text-muted">
                      Joined {formatLongDate(u.createdAt)} · <span className="num">{u.listings}</span> {u.listings === 1 ? "listing" : "listings"}
                      {u.liveListings > 0 && <> (<span className="num">{u.liveListings}</span> live)</>} · <span className="num">{u.requests}</span> {u.requests === 1 ? "request" : "requests"} sent
                    </p>
                  </div>
                  {u.id === mod.id ? (
                    <p className="text-sm text-muted md:self-start">That&apos;s you.</p>
                  ) : (
                    <details className="group md:w-80">
                      <summary className="tap cursor-pointer list-none text-[14px] font-medium text-accent-strong underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                        Actions
                      </summary>
                      <div className="mt-3 flex flex-col gap-4">
                        {!u.role && <ModForm hidden={{ userId: u.id }} compact ops={ops} placeholder="Shown to the person" />}
                        {mod.role === "admin" && roleOps.length > 0 && <ModForm hidden={{ userId: u.id }} compact ops={roleOps} reasonLabel="Reason for the role change" />}
                        {u.role && mod.role !== "admin" && <p className="text-[13px] text-muted">Only the admin can change a team member.</p>}
                      </div>
                    </details>
                  )}
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      <nav aria-label="Pages" className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">Page {pageNo} of {pages}</p>
        <div className="flex gap-2">
          {pageNo > 1 && <Link href={href({ page: pageNo - 1 })} className={buttonClass("secondary")}>Previous</Link>}
          {pageNo < pages && <Link href={href({ page: pageNo + 1 })} className={buttonClass("secondary")}>Next</Link>}
        </div>
      </nav>
      {mod.role === "admin" && (
        <p className="mt-6 flex flex-wrap items-center gap-3 text-[13px] text-muted">
          The spreadsheet has everyone, not just this page: name, email, WhatsApp, status, role, join date, listings, requests and reports. {EXPORT_LINK}
        </p>
      )}
    </>
  );
}
