"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { LEVEL_PRESETS, SINGLE_LEVEL } from "@/lib/ticket-levels";

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

const priceInput = "num h-10 w-full rounded-[var(--radius-control)] border border-control bg-surface pr-2 pl-7 text-base sm:text-[15px] focus:border-accent focus:ring-3 focus:ring-accent-track focus:outline-none";

/**
 * Ticket levels for an event. "One kind for everyone" is a single "General" level (with an optional
 * face value); "Different levels" lists them, e.g. Normal and Fan pit, with the usual ones a tap away.
 * Either way it sends the same "Name, price" lines the server has always read.
 */
export function TicketTypesEditor({ initial, error }: { initial?: string; error?: string }) {
  const parsed = parse(initial);
  const [levels, setLevels] = useState(parsed.length > 1 || (parsed.length === 1 && parsed[0].name.toLowerCase() !== SINGLE_LEVEL.toLowerCase()));
  const [rows, setRows] = useState<Row[]>(() => (parsed.length ? parsed : [{ key: 0, name: SINGLE_LEVEL, price: "" }]));
  const [next, setNext] = useState(1000);
  const names = new Set(rows.map((r) => r.name.trim().toLowerCase()));
  const value = (levels ? rows : rows.slice(0, 1).map((r) => ({ ...r, name: SINGLE_LEVEL })))
    .filter((r) => r.name.trim())
    .map((r) => (r.price.trim() ? `${r.name.trim()}, ${r.price.trim()}` : r.name.trim()))
    .join("\n");

  const add = (name = "") => {
    // An empty row is a placeholder waiting to be filled: a preset fills it instead of adding beside it.
    setRows((rs) => {
      const blank = name ? rs.findIndex((r) => !r.name.trim()) : -1;
      return blank >= 0 ? rs.map((r, i) => (i === blank ? { ...r, name } : r)) : [...rs, { key: next, name, price: "" }];
    });
    setNext((n) => n + 1);
  };
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [{ ...rs[0], name: "", price: "" }]));

  const choose = (multi: boolean) => {
    if (multi === levels) return;
    setLevels(multi);
    // One kind becomes the first level ("Normal", keeping its face value) plus an empty one to fill in;
    // going back keeps just the first price.
    setRows((rs) => (multi
      ? [{ key: rs[0]?.key ?? 0, name: "Normal", price: rs[0]?.price ?? "" }, { key: next, name: "", price: "" }]
      : [{ key: rs[0]?.key ?? 0, name: SINGLE_LEVEL, price: rs[0]?.price ?? "" }]));
    setNext((n) => n + 1);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">Ticket levels</legend>
      <input type="hidden" name="ticketTypes" value={value} />
      <div role="radiogroup" aria-label="Ticket levels" className="grid gap-2 sm:grid-cols-2">
        {([[false, "One kind for everyone", "No levels: everyone has the same ticket"], [true, "Different levels", "e.g. Normal and Fan pit, or Day and VIP"]] as const).map(([multi, label, sub]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={levels === multi}
            onClick={() => choose(multi)}
            className={`flex min-h-14 flex-col justify-center rounded-[10px] border px-4 py-2.5 text-left transition-[border-color,background-color] ${
              levels === multi ? "border-accent bg-accent-soft text-accent-ink" : "border-control bg-surface hover:border-control-hover"
            }`}
          >
            <span className="text-[15px] font-semibold">{label}</span>
            <span className={`text-[12px] ${levels === multi ? "text-accent-ink/80" : "text-muted"}`}>{sub}</span>
          </button>
        ))}
      </div>

      {!levels ? (
        <div className="max-w-56">
          <label htmlFor="single-face" className="mb-1 block text-[13px] font-medium">Face value <span className="font-normal text-muted">(optional)</span></label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">₹</span>
            <input
              id="single-face"
              value={rows[0]?.price ?? ""}
              inputMode="decimal"
              onChange={(e) => setRows((rs) => [{ key: rs[0]?.key ?? 0, name: SINGLE_LEVEL, price: e.target.value.replace(/[^\d.]/g, "") }])}
              placeholder="e.g. 500"
              className={priceInput}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" aria-label="Add a common level">
            {LEVEL_PRESETS.filter((p) => !names.has(p.toLowerCase())).map((p) => (
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
                  aria-label={`Level ${i + 1} name`}
                  value={r.name}
                  maxLength={60}
                  onChange={(e) => update(r.key, { name: e.target.value.replace(/,/g, "") })}
                  placeholder={i === 0 ? "e.g. Normal" : "e.g. Fan pit"}
                  className="h-10 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-base sm:text-[15px] focus:border-accent focus:ring-3 focus:ring-accent-track focus:outline-none"
                />
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">₹</span>
                  <input
                    aria-label={`Level ${i + 1} face value in rupees (optional)`}
                    value={r.price}
                    inputMode="decimal"
                    onChange={(e) => update(r.key, { price: e.target.value.replace(/[^\d.]/g, "") })}
                    placeholder="Face value"
                    className={priceInput}
                  />
                </div>
                <button type="button" onClick={() => remove(r.key)} aria-label={`Remove level ${i + 1}`} className="grid size-10 place-items-center rounded-[var(--radius-control)] text-muted hover:bg-raised hover:text-ink">
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => add()} className="tap inline-flex items-center gap-1.5 self-start text-[14px] font-medium text-accent-strong hover:underline">
            <Plus className="size-4" aria-hidden /> Add another level
          </button>
        </>
      )}
      {error ? (
        <p className="text-[13px] font-medium text-negative" role="alert">{error}</p>
      ) : (
        <p className="text-[13px] text-muted">Face value is optional; it powers the green &ldquo;good deal&rdquo; prices. Levels already on an event are kept.</p>
      )}
    </fieldset>
  );
}
