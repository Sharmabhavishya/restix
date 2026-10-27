"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

// The ticket types most events use, one tap each. Anything else can still be typed in.
const PRESETS = ["General", "Day pass", "Night pass", "Early bird", "Student", "VIP", "Fan pit", "Couple", "Group of 4", "All-access", "Backstage", "Food coupons"];

interface Row {
  key: number;
  name: string;
  price: string;
}

function parse(text: string | undefined): Row[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [name, price] = line.split(",").map((s) => s.trim());
      return { key: i, name: name ?? "", price: price ?? "" };
    });
}

/**
 * Ticket types as rows: a name and an optional face value each, with presets to add the usual
 * ones in a tap. Sends the same "Name, price" lines the server has always read.
 */
export function TicketTypesEditor({ initial, error }: { initial?: string; error?: string }) {
  const [rows, setRows] = useState<Row[]>(() => {
    const parsed = parse(initial);
    return parsed.length ? parsed : [{ key: 0, name: "General", price: "" }];
  });
  const [next, setNext] = useState(1000);
  const names = new Set(rows.map((r) => r.name.trim().toLowerCase()));
  const value = rows.filter((r) => r.name.trim()).map((r) => (r.price.trim() ? `${r.name.trim()}, ${r.price.trim()}` : r.name.trim())).join("\n");

  const add = (name = "") => {
    // A lone empty row is just a placeholder: fill it instead of adding beside it.
    setRows((rs) => (rs.length === 1 && !rs[0].name.trim() ? [{ ...rs[0], name }] : [...rs, { key: next, name, price: "" }]));
    setNext((n) => n + 1);
  };
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [{ ...rs[0], name: "", price: "" }]));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">Ticket types</legend>
      <input type="hidden" name="ticketTypes" value={value} />
      <div className="flex flex-wrap gap-1.5" aria-label="Add a common ticket type">
        {PRESETS.filter((p) => !names.has(p.toLowerCase())).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => add(p)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-[13px] font-medium transition-[border-color,transform] hover:border-accent active:scale-95"
          >
            <Plus className="size-3.5 text-accent-strong" aria-hidden /> {p}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-2">
            <input
              aria-label={`Ticket type ${i + 1} name`}
              value={r.name}
              maxLength={60}
              onChange={(e) => update(r.key, { name: e.target.value.replace(/,/g, "") })}
              placeholder="e.g. Day pass"
              className="h-10 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-[15px] focus:border-accent focus:ring-3 focus:ring-accent-track focus:outline-none"
            />
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">₹</span>
              <input
                aria-label={`Ticket type ${i + 1} face value in rupees (optional)`}
                value={r.price}
                inputMode="decimal"
                onChange={(e) => update(r.key, { price: e.target.value.replace(/[^\d.]/g, "") })}
                placeholder="Face value"
                className="num h-10 w-full rounded-[var(--radius-control)] border border-control bg-surface pr-2 pl-7 text-[15px] focus:border-accent focus:ring-3 focus:ring-accent-track focus:outline-none"
              />
            </div>
            <button type="button" onClick={() => remove(r.key)} aria-label={`Remove ticket type ${i + 1}`} className="grid size-10 place-items-center rounded-[var(--radius-control)] text-muted hover:bg-raised hover:text-ink">
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => add()} className="inline-flex items-center gap-1.5 self-start text-[14px] font-medium text-accent-strong hover:underline">
        <Plus className="size-4" aria-hidden /> Add another type
      </button>
      {error ? (
        <p className="text-[13px] font-medium text-negative" role="alert">{error}</p>
      ) : (
        <p className="text-[13px] text-muted">Face value is optional; it powers the green &ldquo;good deal&rdquo; prices. Existing types are kept.</p>
      )}
    </fieldset>
  );
}
