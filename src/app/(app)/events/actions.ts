"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, formValues, type ActionState } from "@/lib/action-state";
import { cleanText } from "@/lib/validation";
import { getViewer, writeBlockReason } from "@/server/auth/viewer";
import { redirect } from "next/navigation";
import { approveSuggestion, decideSuggestion, suggestEvent, suggestionInput } from "@/server/event-admin";
import { setWant } from "@/server/wants";

export async function suggest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const blocked = writeBlockReason(viewer);
  if (blocked) return { error: blocked };
  const parsed = suggestionInput.safeParse({
    name: formData.get("name") ?? "",
    startsAt: formData.get("startsAt") || undefined,
    venue: formData.get("venue") ?? undefined,
    category: formData.get("category") || undefined,
    details: formData.get("details") ?? undefined,
    ticketFormat: formData.get("ticketFormat") ?? undefined,
    // Ticked presets plus anything typed into "Other levels".
    ticketTypes: [...formData.getAll("ticketTypes"), formData.get("otherTypes") ?? ""].filter((v): v is string => typeof v === "string"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: formValues(formData) };
  const result = await suggestEvent(viewer!.id, parsed.data);
  if (!result.ok) return { error: result.error, values: formValues(formData) };
  revalidatePath("/events");
  revalidatePath("/admin/events");
  return { ok: true, message: "sent. an admin checks it, and once it's approved it shows up for everyone and you can list your ticket." };
}

export async function decide(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer?.role || viewer.access !== "ok") return { error: "Moderators only." };
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (!z.uuid().safeParse(id).success || (status !== "approve" && status !== "declined")) return { error: "Invalid request." };
  const note = cleanText(String(formData.get("note") ?? "")).slice(0, 500) || null;
  if (status === "approve") {
    const result = await approveSuggestion(viewer.id, id, note);
    if (!result.ok) return { error: result.error };
    // Live the moment it's approved: every page that lists events is refreshed.
    revalidatePath("/", "layout");
    redirect(`/events/${result.slug}`);
  }
  const result = await decideSuggestion(viewer.id, { id, status, note });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/events");
  return { ok: true, message: "Declined." };
}

/** "I want a ticket" for an event, or not any more. Returns the new state for the button. */
export async function toggleWant(eventId: string, want: boolean): Promise<{ ok: boolean; wanted?: boolean; error?: string }> {
  const viewer = await getViewer();
  const blocked = writeBlockReason(viewer);
  if (blocked) return { ok: false, error: blocked };
  if (!z.uuid().safeParse(eventId).success || typeof want !== "boolean") return { ok: false, error: "Invalid request." };
  const result = await setWant(viewer!.id, eventId, want);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/events");
  return { ok: true, wanted: result.wanted };
}
