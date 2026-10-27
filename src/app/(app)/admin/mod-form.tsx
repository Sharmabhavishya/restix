"use client";

import { useActionState } from "react";
import { initialState } from "@/lib/action-state";
import { moderate } from "./actions";
import { Field, Textarea, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";

export interface ModOp {
  op: string;
  label: string;
  tone?: "primary" | "secondary" | "danger" | "dark";
}

/**
 * One moderation decision: a required reason plus the buttons for each option. Every
 * submission is recorded in the audit log with that reason.
 */
export function ModForm({
  ops,
  hidden,
  reasonLabel = "Reason",
  placeholder,
  compact,
}: {
  ops: ModOp[];
  hidden: Record<string, string | null | undefined>;
  reasonLabel?: string;
  placeholder?: string;
  compact?: boolean;
}) {
  const [state, action] = useActionState(moderate, initialState);
  const id = `reason-${Object.values(hidden).filter(Boolean).join("-").slice(0, 60)}-${ops[0]?.op}`;
  return (
    <form action={action} className="flex flex-col gap-3">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.message}</Notice>}
      <Field label={reasonLabel} htmlFor={id} error={state.fieldErrors?.reason}>
        <Textarea id={id} name="reason" rows={compact ? 2 : 3} maxLength={1000} placeholder={placeholder} defaultValue={state.ok ? "" : state.values?.reason ?? ""} {...describedBy(id, state.fieldErrors?.reason)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {ops.map((o) => (
          <SubmitButton key={o.op} name="op" value={o.op} variant={o.tone ?? "secondary"} size="sm" pendingLabel="Saving…">
            {o.label}
          </SubmitButton>
        ))}
      </div>
    </form>
  );
}
