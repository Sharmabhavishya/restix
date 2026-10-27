"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, formValues, type ActionState } from "@/lib/action-state";
import { cleanText } from "@/lib/validation";
import { getViewer, writeBlockReason } from "@/server/auth/viewer";
import { redirect } from "next/navigation";
import { approveSuggestion, decideSuggestion, suggestEvent, suggestionInput } from "@/server/event-admin";

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
    revalidatePath("/admin/events");
    revalidatePath("/events");
    revalidatePath("/sell");
    redirect(`/events/${result.slug}`);
  }
  const result = await decideSuggestion(viewer.id, { id, status, note });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/events");
  return { ok: true, message: "Declined." };
}
