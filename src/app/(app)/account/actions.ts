"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, formValues, type ActionState } from "@/lib/action-state";
import { cleanText, normalizeWhatsapp } from "@/lib/validation";
import { safeNext } from "@/lib/safe-redirect";
import { getViewer } from "@/server/auth/viewer";
import { deleteAccount, updateProfile } from "@/server/profile";
import { submitAppeal } from "@/server/moderation";
import { devAuthEnabled, supabaseAuthConfigured } from "@/server/env";
import { DEV_COOKIE } from "@/server/auth/dev-session";
import { supabaseServer } from "@/server/auth/supabase";

// The name comes from the college Google account and can't be changed here.
const profileSchema = z.object({
  whatsapp: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const n = normalizeWhatsapp(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number, or the full number with its country code." });
        return z.NEVER;
      }
      return n;
    }),
});

async function signedInViewer() {
  const viewer = await getViewer();
  // Account changes are allowed for any verified account, including restricted ones.
  if (!viewer || viewer.access === "no_profile" || viewer.access === "unverified" || viewer.access === "domain_not_allowed") return null;
  return viewer;
}

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await signedInViewer();
  if (!viewer) return { error: "Please sign in again." };
  const parsed = profileSchema.safeParse({ whatsapp: formData.get("whatsapp") ?? undefined });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: formValues(formData) };
  const onboarding = formData.get("onboarding") === "1";
  if (onboarding && formData.get("rules") !== "on") {
    return { fieldErrors: { rules: "Tick this to continue." }, values: formValues(formData) };
  }
  const result = await updateProfile(viewer.id, { ...parsed.data, finishOnboarding: onboarding });
  if (!result.ok) return { error: result.error, values: formValues(formData) };
  if (onboarding) redirect(safeNext(formData.get("next")));
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function deleteMyAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await signedInViewer();
  if (!viewer) return { error: "Please sign in again." };
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== "delete my account") {
    return { fieldErrors: { confirm: 'Type "delete my account" to confirm.' } };
  }
  const result = await deleteAccount(viewer.id);
  if (!result.ok) return { error: result.error };
  if (devAuthEnabled()) (await cookies()).delete(DEV_COOKIE);
  else if (supabaseAuthConfigured()) {
    try {
      await (await supabaseServer()).auth.signOut();
    } catch {
      /* the session cookie is cleared on the next request anyway */
    }
  }
  redirect("/?notice=deleted");
}

export async function appeal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await signedInViewer();
  if (!viewer) return { error: "Please sign in again." };
  const message = cleanText(String(formData.get("message") ?? ""));
  if (message.length < 10 || message.length > 2000) {
    return { fieldErrors: { message: "Explain in 10 to 2000 characters." }, values: formValues(formData) };
  }
  const result = await submitAppeal(viewer.id, { message });
  return result.ok ? { ok: true, message: result.message } : { error: result.error, values: formValues(formData) };
}
