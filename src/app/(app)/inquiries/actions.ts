"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState } from "@/lib/action-state";
import { cleanText, offerInput } from "@/lib/validation";
import { fieldErrors, formValues } from "@/lib/action-state";
import { getViewer, writeBlockReason, type Viewer } from "@/server/auth/viewer";
import { closeInquiry, confirmOutcome, respondToInquiry, withdrawInquiry } from "@/server/inquiries";
import { decideOffer, makeOffer } from "@/server/offers";

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

// Restricted accounts may still withdraw, close and record outcomes; nobody else may act.
const canWindDown = (v: Viewer | null): v is Viewer => v !== null && (v.access === "ok" || v.access === "restricted");

export async function withdraw(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!canWindDown(viewer)) return { error: "Please sign in." };
  const inquiryId = String(formData.get("inquiryId") ?? "");
  if (!id.safeParse(inquiryId).success) return { error: "Invalid request." };
  const result = await withdrawInquiry(viewer.id, inquiryId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/inquiries");
  return { ok: true, message: "Withdrawn." };
}

export async function close(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!canWindDown(viewer)) return { error: "Please sign in." };
  const inquiryId = String(formData.get("inquiryId") ?? "");
  if (!id.safeParse(inquiryId).success) return { error: "Invalid request." };
  const result = await closeInquiry(viewer.id, inquiryId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/inquiries");
  return { ok: true, message: "Closed." };
}

export async function confirm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!canWindDown(viewer)) return { error: "Please sign in." };
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (!id.safeParse(inquiryId).success || !["completed", "not_completed", "disputed"].includes(outcome)) return { error: "Choose what happened." };
  const note = cleanText(String(formData.get("note") ?? "")).slice(0, 500) || null;
  const result = await confirmOutcome(viewer.id, { inquiryId, outcome: outcome as "completed", note });
  if (!result.ok) return { error: result.error };
  revalidatePath("/inquiries");
  return { ok: true, message: result.message };
}

export async function offer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const blocked = writeBlockReason(viewer);
  if (!viewer || blocked) return { error: blocked ?? "Please sign in." };
  const parsed = offerInput.safeParse({ inquiryId: formData.get("inquiryId"), amount: formData.get("amount") ?? undefined });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: formValues(formData) };
  const result = await makeOffer(viewer.id, { inquiryId: parsed.data.inquiryId, amountPaise: parsed.data.amount! });
  if (!result.ok) return { error: result.error, values: formValues(formData) };
  revalidatePath("/inquiries");
  return { ok: true, message: "Offer sent. Ball's in their court." };
}

export async function answerOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const decision = String(formData.get("decision") ?? "");
  // Anyone signed in can back out of their own offer; agreeing a price needs a full account.
  const blocked = writeBlockReason(viewer);
  if (!viewer || (blocked && decision !== "withdraw" && decision !== "decline")) return { error: blocked ?? "Please sign in." };
  const offerId = String(formData.get("offerId") ?? "");
  if (!id.safeParse(offerId).success || !["accept", "decline", "withdraw"].includes(decision)) return { error: "Invalid request." };
  const result = await decideOffer(viewer.id, { offerId, decision: decision as "accept" });
  if (!result.ok) return { error: result.error };
  revalidatePath("/inquiries");
  return { ok: true, message: decision === "accept" ? "Deal. Price agreed." : decision === "decline" ? "Passed on that one." : "Offer withdrawn." };
}
