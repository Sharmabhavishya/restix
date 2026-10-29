"use client";

import { HelpCircle } from "lucide-react";
import { FORMAT_HINT, FORMAT_LABEL, FORMATS, type TicketFormat } from "@/lib/listing-rules";
import { FORMAT_ICON } from "./format-icon";

/**
 * "What kind of ticket does this event have?": one card per format plus "Not sure / it varies"
 * (sent as an empty value, which leaves it to each seller). Plain radios, so it works in any form.
 */
export function FormatChoice({
  name = "ticketFormat",
  defaultValue,
  legend,
  hint,
  error,
}: {
  name?: string;
  defaultValue: TicketFormat | "" | null | undefined;
  legend: string;
  hint?: string;
  error?: string;
}) {
  const options: { value: TicketFormat | ""; label: string; sub: string }[] = [
    ...FORMATS.map((f) => ({ value: f, label: FORMAT_LABEL[f], sub: FORMAT_HINT[f] })),
    { value: "", label: "Not sure / it varies", sub: "Each seller picks theirs" },
  ];
  const current = defaultValue ?? "";
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {hint && <p className="mb-2.5 text-[13px] text-muted">{hint}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const Icon = o.value ? FORMAT_ICON[o.value] : HelpCircle;
          return (
            <label
              key={o.value || "unset"}
              className="group/fmt flex min-h-[4.25rem] cursor-pointer flex-col justify-between gap-1.5 rounded-[10px] border border-control bg-surface px-3 py-2.5 transition-[border-color,background-color,transform] duration-200 hover:border-control-hover has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent motion-safe:active:scale-[0.97]"
            >
              <input type="radio" name={name} value={o.value} defaultChecked={current === o.value} className="peer sr-only" />
              <Icon className="size-5 text-muted peer-checked:text-accent-strong" strokeWidth={1.75} aria-hidden />
              <span className="leading-tight">
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-[12px] text-muted">{o.sub}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[13px] font-medium text-negative" role="alert">{error}</p>}
    </fieldset>
  );
}
