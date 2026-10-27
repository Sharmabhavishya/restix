"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, formValues, type ActionState } from "@/lib/action-state";
import { inquiryInput, listingInput, reportInput } from "@/lib/validation";
import type { SellerAction } from "@/lib/listing-rules";
import { getViewer, writeBlockReason } from "@/server/auth/viewer";
import { createListing, sellerAction, updateListing } from "@/server/listings";
import { sendInquiry } from "@/server/inquiries";
import { submitReport } from "@/server/moderation";
import { setSaved } from "@/server/saved";

function listingFields(formData: FormData) {
  return {
    eventId: formData.get("eventId"),
    ticketTypeId: formData.get("ticketTypeId"),
    format: formData.get("format"),
    quantity: formData.get("quantity"),
    askingPrice: formData.get("askingPrice") ?? "",
    originalPrice: formData.get("originalPrice") ?? undefined,
    priceNegotiable: formData.get("priceNegotiable") ?? undefined,
    // Blank or missing: the format decides (see defaultHandover).
    handoverMethod: formData.get("handoverMethod") || undefined,
    bulkMinQuantity: formData.get("bulkMinQuantity") ?? undefined,
    bulkPrice: formData.get("bulkPrice") ?? undefined,
    meetupArea: formData.get("meetupArea") ?? undefined,
    handoverNotes: formData.get("handoverNotes") ?? undefined,
    sellerNotes: formData.get("sellerNotes") ?? undefined,
    expiresAt: formData.get("expiresAt") || undefined,
  };
}

export async function saveListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const blocked = writeBlockReason(viewer);
  if (blocked) return { error: blocked, values: formValues(formData) };

  const parsed = listingInput.safeParse(listingFields(formData));
  if (!parsed.success) {
    return { error: "Fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values: formValues(formData) };
  }
  const intent = formData.get("intent") === "draft" ? "draft" : "publish";
  const listingId = formData.get("listingId");
  let id: string;
  let note: string | undefined;
  if (typeof listingId === "string" && listingId) {
    const version = Number(formData.get("version"));
    const result = await updateListing(viewer!.id, listingId, version, parsed.data);
    if (!result.ok) return { error: result.error, fieldErrors: result.field ? { [result.field]: result.error } : undefined, values: formValues(formData) };
    id = result.id;
  } else {
    const result = await createListing(viewer!.id, parsed.data, intent);
    if (!result.ok) return { error: result.error, fieldErrors: result.field ? { [result.field]: result.error } : undefined, values: formValues(formData) };
    id = result.id;
    note = result.message;
  }
  revalidatePath("/selling");
  revalidatePath("/tickets");
  redirect(`/listings/${id}?saved=${listingId ? "edited" : note ? "review" : intent}`);
}

const ACTIONS: SellerAction[] = ["publish", "pause", "resume", "mark_sold", "mark_unavailable", "withdraw", "delete"];

export async function listingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  // Sellers may always close or delete their own listings, even when restricted.
  const action = String(formData.get("action")) as SellerAction;
  if (!ACTIONS.includes(action)) return { error: "Unknown action." };
  const closing = action === "mark_sold" || action === "mark_unavailable" || action === "pause" || action === "delete" || action === "withdraw";
  const blocked = writeBlockReason(viewer);
  if (!viewer || (blocked && !(closing && viewer.access === "restricted"))) return { error: blocked ?? "Please sign in." };

  const id = String(formData.get("listingId") ?? "");
  const version = Number(formData.get("version"));
  if (!z.uuid().safeParse(id).success || !Number.isInteger(version)) return { error: "Invalid request." };
  const result = await sellerAction(viewer.id, id, version, action);
  if (!result.ok) return { error: result.error };
  revalidatePath("/selling");
  revalidatePath("/tickets");
  if (action === "delete") redirect("/selling?deleted=1");
  revalidatePath(`/listings/${id}`);
  return { ok: true, message: result.message ?? DONE[action] };
}

const DONE: Record<SellerAction, string> = {
  publish: "Live! People can find it now.",
  pause: "Paused. It's hidden from search until you resume.",
  resume: "Back up and visible.",
  mark_sold: "Marked sold. Nice one.",
  mark_unavailable: "Taken down.",
  withdraw: "Moved back to drafts.",
  edit: "Saved.",
  delete: "Deleted.",
};

export async function contactSeller(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const blocked = writeBlockReason(viewer);
  if (blocked) return { error: blocked, values: formValues(formData) };
  const parsed = inquiryInput.safeParse({
    listingId: formData.get("listingId"),
    quantity: formData.get("quantity"),
    message: formData.get("message") ?? "",
    offer: formData.get("offer") ?? undefined,
    shareWhatsapp: formData.get("shareWhatsapp") ?? undefined,
    whatsapp: formData.get("whatsapp") ?? undefined,
  });
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values: formValues(formData) };
  const { offer, ...rest } = parsed.data;
  const result = await sendInquiry(viewer!.id, { ...rest, offerPaise: offer });
  if (!result.ok) return { error: result.error, values: formValues(formData) };
  revalidatePath(`/listings/${parsed.data.listingId}`);
  revalidatePath("/inquiries");
  return { ok: true, message: offer ? "Sent, with your offer. The seller can take it, counter or pass." : "Sent. You'll see the seller's reply in Inquiries." };
}

export async function reportListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const blocked = writeBlockReason(viewer);
  if (blocked) return { error: blocked };
  const parsed = reportInput.safeParse({
    listingId: formData.get("listingId") || undefined,
    reportedUserId: formData.get("reportedUserId") || undefined,
    reason: formData.get("reason"),
    details: formData.get("details") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: formValues(formData) };
  const result = await submitReport(viewer!.id, parsed.data);
  return result.ok ? { ok: true, message: result.message } : { error: result.error, values: formValues(formData) };
}

/** Saves or unsaves a listing. Called from the heart button; the result drives its state. */
export async function toggleSaved(listingId: string, save: boolean): Promise<{ ok: boolean; saved?: boolean; error?: string }> {
  const viewer = await getViewer();
  const blocked = writeBlockReason(viewer);
  if (blocked) return { ok: false, error: blocked };
  if (!z.uuid().safeParse(listingId).success || typeof save !== "boolean") return { ok: false, error: "Invalid request." };
  const result = await setSaved(viewer!.id, listingId, save);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/tickets");
  return { ok: true, saved: result.saved };
}
