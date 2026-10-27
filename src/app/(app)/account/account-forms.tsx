"use client";

import { useActionState } from "react";
import { initialState } from "@/lib/action-state";
import { appeal, deleteMyAccount } from "./actions";
import { Field, Input, Textarea, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";

export function AppealForm() {
  const [state, action] = useActionState(appeal, initialState);
  if (state.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="What should a moderator know?" htmlFor="appeal-message" error={state.fieldErrors?.message} hint="Be specific. A different moderator reviews appeals where possible.">
        <Textarea id="appeal-message" name="message" rows={4} maxLength={2000} defaultValue={state.values?.message ?? ""} {...describedBy("appeal-message", state.fieldErrors?.message, true)} />
      </Field>
      <div>
        <SubmitButton variant="dark" pendingLabel="Sending…">Send appeal</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteForm() {
  const [state, action] = useActionState(deleteMyAccount, initialState);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label='Type "delete my account" to confirm' htmlFor="confirm" error={state.fieldErrors?.confirm}>
        <Input id="confirm" name="confirm" autoComplete="off" {...describedBy("confirm", state.fieldErrors?.confirm)} />
      </Field>
      <div>
        <SubmitButton variant="danger" pendingLabel="Deleting…">Delete my account</SubmitButton>
      </div>
    </form>
  );
}
