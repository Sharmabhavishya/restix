"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, formValues, type ActionState } from "@/lib/action-state";
import { cleanText } from "@/lib/validation";
import { getViewer, writeBlockReason } from "@/server/auth/viewer";
import { decideSuggestion, suggestEvent, suggestionInput } from "@/server/event-admin";

export async function suggest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const blocked = writeBlockReason(viewer);
  if (blocked) return { error: blocked };
  const parsed = suggestionInput.safeParse({
    name: formData.get("name") ?? "",
    happensOn: formData.get("happensOn") || undefined,
    details: formData.get("details") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: formValues(formData) };
  const result = await suggestEvent(viewer!.id, parsed.data);
  if (!result.ok) return { error: result.error, values: formValues(formData) };
  revalidatePath("/events");
  revalidatePath("/admin/events");
  return { ok: true, message: "sent to the mods. once they confirm the resale rules it'll show up here." };
}

export async function decide(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer?.role || viewer.access !== "ok") return { error: "Moderators only." };
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (!z.uuid().safeParse(id).success || (status !== "added" && status !== "declined")) return { error: "Invalid request." };
  const note = cleanText(String(formData.get("note") ?? "")).slice(0, 500) || null;
  const result = await decideSuggestion(viewer.id, { id, status, note });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/events");
  return { ok: true, message: status === "added" ? "Marked as added." : "Declined." };
}
