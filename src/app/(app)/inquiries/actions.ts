"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState } from "@/lib/action-state";
import { cleanText } from "@/lib/validation";
import { getViewer, writeBlockReason } from "@/server/auth/viewer";
import { closeInquiry, confirmOutcome, respondToInquiry, withdrawInquiry } from "@/server/inquiries";

const id = z.uuid();

export async function respond(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const decision = formData.get("decision") === "decline" ? "decline" : "accept";
  // Restricted sellers may still decline; accepting (sharing contact) needs a full account.
  const blocked = writeBlockReason(viewer);
  if (!viewer || (blocked && !(decision === "decline" && viewer.access === "restricted"))) return { error: blocked ?? "Please sign in." };
  const inquiryId = String(formData.get("inquiryId") ?? "");
  if (!id.safeParse(inquiryId).success) return { error: "Invalid request." };
  const rawNote = cleanText(String(formData.get("note") ?? ""));
  if (rawNote.length > 200) return { fieldErrors: { note: "Keep it under 200 characters." } };
  if (/[<>]/.test(rawNote)) return { fieldErrors: { note: "Plain text only." } };
  const result = await respondToInquiry(viewer.id, {
    inquiryId,
    decision,
    shareWhatsapp: formData.get("shareWhatsapp") === "on",
    note: rawNote || null,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/inquiries");
  return { ok: true, message: decision === "accept" ? "Shared. They can reach you now." : "Declined." };
}

export async function withdraw(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please sign in." };
  const inquiryId = String(formData.get("inquiryId") ?? "");
  if (!id.safeParse(inquiryId).success) return { error: "Invalid request." };
  const result = await withdrawInquiry(viewer.id, inquiryId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/inquiries");
  return { ok: true, message: "Withdrawn." };
}

export async function close(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please sign in." };
  const inquiryId = String(formData.get("inquiryId") ?? "");
  if (!id.safeParse(inquiryId).success) return { error: "Invalid request." };
  const result = await closeInquiry(viewer.id, inquiryId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/inquiries");
  return { ok: true, message: "Closed." };
}

export async function confirm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || viewer.access === "no_profile" || viewer.access === "domain_not_allowed" || viewer.access === "unverified") {
    return { error: "Please sign in." };
  }
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (!id.safeParse(inquiryId).success || !["completed", "not_completed", "disputed"].includes(outcome)) return { error: "Choose what happened." };
  const note = cleanText(String(formData.get("note") ?? "")).slice(0, 500) || null;
  const result = await confirmOutcome(viewer.id, { inquiryId, outcome: outcome as "completed", note });
  if (!result.ok) return { error: result.error };
  revalidatePath("/inquiries");
  return { ok: true, message: result.message };
}
