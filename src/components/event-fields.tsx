"use client";

import type { ReactNode } from "react";
import { CalendarDays, Music, PartyPopper, Sparkles, Trophy, Wine, Wrench } from "lucide-react";
import { Field, Input, describedBy } from "@/components/ui/field";
import { toLocalInput } from "@/lib/format";
import { QUICK_TIMES, joinLocal, plusHours, quickDays, splitLocal, tillLate } from "@/lib/quick-dates";

const chip =
  "inline-flex h-9 cursor-pointer items-center rounded-full border border-border bg-surface px-3.5 text-[14px] font-medium transition-[border-color,background-color,transform] " +
  "hover:border-control-hover active:scale-[0.97] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Chip({ pressed, onClick, children }: { pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={chip} aria-pressed={pressed ?? false} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * A date-and-time field with one-tap shortcuts. The value is the same "YYYY-MM-DDTHH:mm" text a
 * datetime-local input holds, so the server contract doesn't change; the chips just fill it in.
 * `startValue` turns the shortcuts into end-time ones (+2 h, +3 h, till late).
 */
export function DateTimeQuick({
  id, name, label, value, onChange, error, hint, optional, startValue,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  startValue?: string;
}) {
  const { ymd, time } = splitLocal(value);
  const isEnd = startValue !== undefined;
  const beforeStart = isEnd && Boolean(value) && Boolean(startValue) && value <= startValue!;

  return (
    <Field label={label} htmlFor={id} optional={optional} error={error ?? (beforeStart ? "That's before it starts." : undefined)} hint={hint}>
      <Input id={id} name={name} type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} {...describedBy(id, error ?? (beforeStart ? "x" : undefined), Boolean(hint))} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick picks">
        {isEnd ? (
          <>
            {[2, 3, 4].map((h) => (
              <Chip key={h} pressed={Boolean(startValue) && value === plusHours(startValue!, h)} onClick={() => onChange(plusHours(startValue!, h))}>
                {h} hours later
              </Chip>
            ))}
            <Chip pressed={Boolean(startValue) && value === tillLate(startValue!)} onClick={() => onChange(tillLate(startValue!))}>Till late</Chip>
          </>
        ) : (
          <>
            {quickDays(toLocalInput(new Date()).slice(0, 10)).map((d) => (
              <Chip key={d.key} pressed={ymd === d.ymd} onClick={() => onChange(joinLocal(d.ymd, time))}>{d.label}</Chip>
            ))}
            {ymd && QUICK_TIMES.map((t) => (
              <Chip key={t.time} pressed={time === t.time} onClick={() => onChange(joinLocal(ymd, t.time))}>{t.label}</Chip>
            ))}
          </>
        )}
      </div>
    </Field>
  );
}

const KINDS = [
  ["fest", "Fest", Sparkles],
  ["concert", "Concert", Music],
  ["party", "Party", PartyPopper],
  ["prom", "Prom", Wine],
  ["workshop", "Workshop", Wrench],
  ["sports", "Sports", Trophy],
  ["other", "Other", CalendarDays],
] as const;

/** Pick the kind of event with big tap targets. Rebuild it with a new `key` after a failed submit. */
export function KindPicker({ value, onChange, optional }: { value: string; onChange: (v: string) => void; optional?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        Kind of event{optional && <span className="font-normal text-muted"> (optional)</span>}
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {KINDS.map(([v, label, Icon]) => (
          <label
            key={v}
            className="flex h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-[14px] font-medium transition-[border-color,background-color,transform] hover:border-control-hover active:scale-[0.98] has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
          >
            <input type="radio" name="category" value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const VENUES = ["Auditorium", "Main ground", "Amphitheatre", "Off campus"];

/** Quick venue suggestions under the venue field; tapping one fills it in. */
export function VenueChips({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Venue suggestions">
      {VENUES.map((v) => (
        <Chip key={v} pressed={value === v} onClick={() => onPick(v)}>{v}</Chip>
      ))}
    </div>
  );
}
