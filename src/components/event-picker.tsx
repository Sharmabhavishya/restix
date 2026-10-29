"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { controlClass } from "./ui/field";

export interface PickableEvent {
  id: string;
  name: string;
  startsAt: string;
  isFixture: boolean;
  wants?: number;
}

/**
 * A search box that doubles as the event list: type any part of a name or date to narrow it,
 * arrow keys and Enter to pick, Escape to close. The chosen id goes out as a hidden `eventId`
 * field, so the form and the server's checks work as they did with a plain select.
 */
export function EventPicker({
  events, value, onChange, id, invalid, describedBy,
}: {
  events: PickableEvent[];
  value: string;
  onChange: (id: string) => void;
  id: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const chosen = events.find((e) => e.id === value);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const when = (e: PickableEvent) => formatDateTime(new Date(e.startsAt));
  const shown = typing ? query : chosen?.name ?? "";
  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!typing || words.length === 0) return events;
    return events.filter((e) => {
      const hay = `${e.name} ${when(e)}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [events, query, typing]);

  const pick = (e: PickableEvent) => {
    onChange(e.id);
    setTyping(false);
    setQuery("");
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (matches.length) setCursor((c) => (c + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
    } else if (e.key === "Enter" && open && matches[cursor]) {
      e.preventDefault(); // Enter must not submit the form while a result is highlighted
      pick(matches[cursor]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setTyping(false);
    }
  };

  return (
    <div
      ref={box}
      className="relative"
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget)) {
          setOpen(false);
          setTyping(false);
        }
      }}
    >
      <input type="hidden" name="eventId" value={value} />
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[cursor] ? `${listId}-${matches[cursor].id}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Search events"
        value={shown}
        onFocus={(e) => { setOpen(true); setCursor(0); if (chosen) e.currentTarget.select(); }}
        onChange={(e) => { setTyping(true); setQuery(e.target.value); setOpen(true); setCursor(0); }}
        onKeyDown={onKey}
        className={`${controlClass} h-11 pr-10 pl-9 sm:h-10`}
      />
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Events"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[var(--radius-control)] border border-border bg-surface p-1 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.35)]"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">No event matches “{query.trim()}”. Can&apos;t find yours? Add it below.</li>
          ) : (
            matches.map((e, i) => (
              <li
                key={e.id}
                id={`${listId}-${e.id}`}
                role="option"
                aria-selected={e.id === value}
                // mousedown, not click, so the input keeps focus and the list doesn't close first
                onMouseDown={(ev) => { ev.preventDefault(); pick(e); }}
                onMouseMove={() => setCursor(i)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[8px] px-3 py-2 ${i === cursor ? "bg-raised" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">
                    {e.name}
                    {e.isFixture && <span className="ml-2 rounded-full bg-notice-soft px-1.5 text-[11px] font-medium text-notice-ink">sample</span>}
                  </span>
                  <span className="block truncate text-[13px] text-muted">
                    {when(e)}{(e.wants ?? 0) > 0 ? ` · ${e.wants} looking` : ""}
                  </span>
                </span>
                {e.id === value && <Check className="size-4 flex-none text-accent-strong" aria-hidden />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
