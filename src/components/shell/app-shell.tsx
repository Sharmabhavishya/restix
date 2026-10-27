import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import type { Viewer } from "@/server/auth/viewer";
import { pendingInquiryCount } from "@/server/profile";
import { unseenReplies } from "@/server/inquiries";
import { offersWaiting } from "@/server/offers";
import { queueCounts } from "@/server/moderation";
import { listUpcomingEvents } from "@/server/events";
import { NextUp } from "./next-up";
import { signOut } from "@/app/auth/actions";
import { MobileBar, Sidebar, type NavGroup } from "./nav";
import { Notice } from "../ui/bits";
import Link from "next/link";

async function navFor(viewer: Viewer): Promise<NavGroup[]> {
  const [pending, replies, offers] = await Promise.all([
    pendingInquiryCount(viewer.id).catch(() => 0),
    unseenReplies(viewer.id).catch(() => 0),
    offersWaiting(viewer.id).catch(() => 0),
  ]);
  const waiting = pending + replies + offers;
  const kinds = [pending && "requests", offers && "offers", replies && "replies"].filter(Boolean) as string[];
  const inboxLabel =
    kinds.length > 1 ? "Things to answer"
    : pending ? "Requests to answer"
    : offers ? "Offers to answer"
    : replies ? "New replies"
    : "Inquiries";
  const groups: NavGroup[] = [
    {
      items: [
        { href: "/tickets", label: "Find tickets", icon: "search" },
        { href: "/events", label: "Events", icon: "calendar" },
        { href: "/sell", label: "Sell a ticket", icon: "tag" },
        { href: "/selling", label: "My listings", icon: "list" },
        { href: "/inquiries", label: inboxLabel, icon: "inbox", count: waiting },
        { href: "/account", label: "Account", icon: "user" },
      ],
    },
  ];
  if (viewer.role && viewer.access === "ok") {
    const q = await queueCounts(viewer.id).catch(() => null);
    groups.push({
      label: "Moderation",
      items: [
        { href: "/admin", label: q?.open ? "Reports to review" : "Reports", icon: "flag", count: q ? q.open : 0, exact: true },
        { href: "/admin/reviews", label: q?.pendingListings ? "Listings to check" : "Listing checks", icon: "review", count: q?.pendingListings ?? 0 },
        { href: "/admin/appeals", label: q?.openAppeals ? "Appeals to decide" : "Appeals", icon: "gavel", count: q?.openAppeals ?? 0 },
        { href: "/admin/events", label: "Events", icon: "calendar" },
        { href: "/admin/users", label: "Accounts", icon: "users" },
        { href: "/admin/audit", label: "Audit log", icon: "log" },
        ...(viewer.role === "admin" ? [{ href: "/admin/analytics", label: "Analytics", icon: "chart" as const }] : []),
      ],
    });
  }
  return groups;
}

function UserFooter({ viewer }: { viewer: Viewer }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span aria-hidden className="flex size-8 flex-none items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">
        {viewer.displayName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{viewer.displayName}</p>
        <p className="truncate text-[12px] text-muted">{viewer.role ? (viewer.role === "admin" ? "Admin" : "Moderator") : "Student"}</p>
      </div>
      <form action={signOut}>
        <button className="flex size-9 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-raised hover:text-ink" title="Sign out">
          <LogOut className="size-4" aria-hidden />
          <span className="sr-only">Sign out</span>
        </button>
      </form>
    </div>
  );
}

export async function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const [groups, upcoming] = await Promise.all([navFor(viewer), listUpcomingEvents(viewer.id).catch(() => [])]);
  const scope = `${viewer.collegeShortName || "Campus"} exchange`;
  const next = upcoming.find((e) => e.status === "scheduled" || e.status === "postponed");
  const footer = (
    <div className="flex flex-col gap-4">
      {next && <NextUp event={next} />}
      <UserFooter viewer={viewer} />
    </div>
  );
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Sidebar groups={groups} footer={footer} scope={scope} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar groups={groups} footer={footer} scope={scope} />
        <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-6 pb-16 sm:px-8 md:pt-9">
          {viewer.access === "restricted" && (
            <Notice tone="warning" className="mb-6" title="Your account is restricted">
              You can browse, but listing, contacting sellers and reporting are paused. {viewer.statusReason ? `Reason: ${viewer.statusReason}. ` : ""}
              <Link href="/account#appeal" className="font-medium underline">Appeal this decision</Link>
            </Notice>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
