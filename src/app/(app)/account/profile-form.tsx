"use client";

import { useActionState } from "react";
import Link from "next/link";
import { initialState } from "@/lib/action-state";
import { saveProfile } from "./actions";
import { Checkbox, Field, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";

export function ProfileForm({
  displayName,
  whatsapp,
  onboarding,
  next,
}: {
  displayName: string;
  whatsapp: string | null;
  onboarding?: boolean;
  next?: string;
}) {
  const [state, action] = useActionState(saveProfile, initialState);
  const v = state.values;
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {onboarding && <input type="hidden" name="onboarding" value="1" />}
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Name</p>
        <p className="text-[17px] font-semibold">{displayName}</p>
        <p className="text-[13px] text-muted">From your college Google account, so everyone knows who they&apos;re dealing with. Shown on your listings and messages; your email never is.</p>
      </div>

      <Field
        label="WhatsApp number"
        htmlFor="whatsapp"
        optional
        error={fe.whatsapp}
        hint="Private. Only shared with a buyer if you choose to when you accept their request."
      >
        <PhoneInput id="whatsapp" name="whatsapp" defaultValue={v?.whatsapp ?? (whatsapp?.startsWith("+91") ? whatsapp.slice(3) : whatsapp) ?? ""} {...describedBy("whatsapp", fe.whatsapp, true)} />
      </Field>

      {onboarding && (
        <div className="flex flex-col gap-2">
          <Checkbox
            id="rules"
            name="rules"
            label="I'll only list tickets I own and am allowed to resell"
            hint="ResTix doesn't handle payments or guarantee tickets. Check the ticket before paying."
          />
          {fe.rules && <p className="text-[13px] font-medium text-negative" role="alert">{fe.rules}</p>}
          <p className="text-[13px] text-muted">
            Read the <Link href="/safety" className="underline">safety guide</Link> and <Link href="/terms" className="underline">terms</Link>.
          </p>
        </div>
      )}

      <div>
        <SubmitButton pendingLabel={onboarding ? "Setting up…" : "Saving…"}>{onboarding ? "Let's go" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}
