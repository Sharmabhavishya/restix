"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3, CalendarDays, ClipboardCheck, Flag, Gavel, Inbox, LayoutDashboard, LayoutList, Menu, ScrollText, Search, ShieldCheck, Tag, User, Users, X,
} from "lucide-react";
import { Wordmark } from "../logo";

const ICONS = {
  search: Search, calendar: CalendarDays, tag: Tag, list: LayoutList, inbox: Inbox, user: User,
  flag: Flag, review: ClipboardCheck, users: Users, gavel: Gavel, log: ScrollText, chart: BarChart3, dash: LayoutDashboard, team: ShieldCheck,
} as const;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Shown only on queues that need action, with the noun in the label. */
  count?: number;
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label && <p className="mb-2 px-3 text-[13px] text-muted">{group.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm transition-colors duration-150 md:h-8 ${
                      active ? "bg-accent-soft font-medium text-accent-ink" : "text-nav hover:bg-raised hover:text-ink"
                    }`}
                  >
                    <Icon className={`size-4 flex-none ${active ? "text-accent-strong" : ""}`} strokeWidth={1.75} aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.count ? (
                      <span className="num min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] leading-5 font-semibold text-white">
                        {item.count}
                        <span className="sr-only"> waiting</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ groups, footer, scope }: { groups: NavGroup[]; footer: React.ReactNode; scope: string }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[230px] flex-none flex-col border-r border-border px-3 py-5 md:flex">
      <Link href="/tickets" className="mb-7 flex flex-col gap-1.5 px-3 pt-2">
        <Wordmark className="text-[26px]" />
        <span className="text-[12px] text-muted">{scope}</span>
      </Link>
      <div className="flex-1 overflow-y-auto">
        <NavLinks groups={groups} />
      </div>
      <div className="mt-4 border-t border-border pt-4">{footer}</div>
    </aside>
  );
}

export function MobileBar({ groups, footer, scope }: { groups: NavGroup[]; footer: React.ReactNode; scope: string }) {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const opener = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
      // Keep Tab inside the sheet while it covers the page.
      if (e.key !== "Tab" || !sheet.current) return;
      const items = sheet.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    const button = opener.current;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // Back to where they were, unless they navigated away.
      if (button?.isConnected) button.focus();
    };
  }, [open]);
  const waiting = groups.flatMap((g) => g.items).reduce((n, i) => n + (i.count ?? 0), 0);

  return (
    <div className="md:hidden">
      <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-ground px-4">
        <Link href="/tickets" className="pt-1">
          <Wordmark className="text-[22px]" />
        </Link>
        <button
          ref={opener}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="relative -mr-2 flex size-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-raised"
        >
          <Menu className="size-5" aria-hidden />
          <span className="sr-only">Open menu{waiting ? `, ${waiting} waiting` : ""}</span>
          {waiting > 0 && <span aria-hidden className="absolute top-2.5 right-2.5 size-2 rounded-full bg-accent" />}
        </button>
      </div>
      {open && (
        <div ref={sheet} id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-40 flex flex-col bg-ground">
          <div className="flex h-12 flex-none items-center justify-between border-b border-border px-4">
            <span className="text-sm text-muted">{scope}</span>
            <button type="button" onClick={() => setOpen(false)} className="-mr-2 flex size-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-raised" autoFocus>
              <X className="size-5" aria-hidden />
              <span className="sr-only">Close menu</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-border px-4 py-4">{footer}</div>
        </div>
      )}
    </div>
  );
}
