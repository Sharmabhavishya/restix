"use server";

import { processCover, removeCover, setCover, type Cover } from "@/server/event-covers";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, formValues, type ActionState } from "@/lib/action-state";
import { cleanText } from "@/lib/validation";
import { getViewer, type Viewer } from "@/server/auth/viewer";
import {
  decideAppeal, moderateListing, moderateUser, setRole, updateReport,
  type ListingModAction, type UserModAction,
} from "@/server/moderation";
import { eventInput, saveEvent, linkSuggestion } from "@/server/event-admin";
import { createTestEvents, deleteEvent, removeTestEvents } from "@/server/admin";

const uuid = z.uuid();

// Every moderation action re-checks the role server-side; the pages' checks are not enough.
async function moderator(): Promise<Viewer | null> {
  const v = await getViewer();
  return v && v.role && v.access === "ok" ? v : null;
}

function reasonOf(formData: FormData): string | null {
  const reason = cleanText(String(formData.get("reason") ?? ""));
  return reason.length >= 3 && reason.length <= 1000 ? reason : null;
}

const NEED_REASON: ActionState = { fieldErrors: { reason: "Write a short reason (it goes in the audit log)." } };

export async function moderate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const mod = await moderator();
  if (!mod) return { error: "Moderators only." };
  const op = String(formData.get("op") ?? "");
  const reason = reasonOf(formData);
  if (!reason) return { ...NEED_REASON, values: formValues(formData) };
  const reportId = formData.get("reportId") ? String(formData.get("reportId")) : null;
  if (reportId && !uuid.safeParse(reportId).success) return { error: "Invalid request." };

  let result: { ok: boolean; error?: string; message?: string };
  if (op.startsWith("listing:")) {
    const listingId = String(formData.get("listingId") ?? "");
    const action = op.slice(8) as ListingModAction;
    if (!uuid.safeParse(listingId).success || !["approve", "reject", "hide", "remove", "restore"].includes(action)) return { error: "Invalid request." };
    const v = formData.get("version");
    const version = v === null || v === "" ? undefined : Number(v);
    if (version !== undefined && !Number.isInteger(version)) return { error: "Invalid request." };
    result = await moderateListing(mod.id, { listingId, action, reason, reportId, version });
  } else if (op.startsWith("user:")) {
    const userId = String(formData.get("userId") ?? "");
    const action = op.slice(5) as UserModAction;
    if (!uuid.safeParse(userId).success || !["restrict", "suspend", "reinstate"].includes(action)) return { error: "Invalid request." };
    result = await moderateUser(mod.id, { userId, action, reason, reportId });
  } else if (op.startsWith("report:")) {
    const status = op.slice(7) as "in_review" | "resolved" | "dismissed";
    if (!reportId || !["in_review", "resolved", "dismissed"].includes(status)) return { error: "Invalid request." };
    result = await updateReport(mod.id, { reportId, status, note: reason });
  } else if (op.startsWith("appeal:")) {
    const appealId = String(formData.get("appealId") ?? "");
    const decision = op.slice(7) as "upheld" | "reversed";
    if (!uuid.safeParse(appealId).success || !["upheld", "reversed"].includes(decision)) return { error: "Invalid request." };
    result = await decideAppeal(mod.id, { appealId, decision, note: reason });
  } else if (op.startsWith("role:")) {
    if (mod.role !== "admin") return { error: "Admins only." };
    const userId = String(formData.get("userId") ?? "");
    const role = op.slice(5);
    // One admin runs ResTix; the team is moderators. (A second admin could remove the first.)
    if (!uuid.safeParse(userId).success || !["moderator", "none"].includes(role)) return { error: "Invalid request." };
    result = await setRole(mod.id, { userId, role: role === "none" ? null : "moderator", reason });
  } else {
    return { error: "Unknown action." };
  }
  if (!result.ok) return { error: result.error ?? "That didn't work.", values: formValues(formData) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: result.message ?? "Done. Logged in the audit trail." };
}

export async function saveEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const mod = await moderator();
  if (!mod) return { error: "Moderators only." };
  const parsed = eventInput.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    category: formData.get("category"),
    venue: formData.get("venue") ?? undefined,
    description: formData.get("description") ?? undefined,
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") || undefined,
    status: formData.get("status"),
    transferPolicy: formData.get("transferPolicy"),
    policySource: formData.get("policySource") ?? undefined,
    ticketTypes: formData.get("ticketTypes") ?? undefined,
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "Fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values: formValues(formData) };
  const eventId = formData.get("eventId") ? String(formData.get("eventId")) : undefined;
  if (eventId && !uuid.safeParse(eventId).success) return { error: "Invalid request." };
  // Check the cover before saving anything, so a bad image doesn't leave a half-saved event.
  const upload = formData.get("cover");
  let cover: Cover | null = null;
  if (upload instanceof File && upload.size > 0) {
    const processed = await processCover(upload);
    if (!processed.ok) return { error: processed.error, fieldErrors: { cover: processed.error }, values: formValues(formData) };
    cover = processed.cover;
  }
  const result = await saveEvent(mod.id, mod.collegeId, parsed.data, eventId);
  if (!result.ok) return { error: result.error, values: formValues(formData) };
  if (cover) {
    const saved = await setCover(mod.id, result.id, cover);
    if (!saved.ok) return { error: `The event was saved, but not its cover: ${saved.error}`, values: formValues(formData) };
  } else if (formData.get("removeCover") === "on") {
    await removeCover(mod.id, result.id);
  }
  const requestId = formData.get("requestId");
  if (typeof requestId === "string" && uuid.safeParse(requestId).success) await linkSuggestion(mod.id, requestId, result.id);
  revalidatePath("/sell");
  revalidatePath("/events");
  revalidatePath("/admin/events");
  redirect(`/admin/events?saved=${encodeURIComponent(parsed.data.name)}`);
}

export async function deleteEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const mod = await moderator();
  if (!mod || mod.role !== "admin") return { error: "Admins only." };
  const eventId = String(formData.get("eventId") ?? "");
  if (!uuid.safeParse(eventId).success) return { error: "Invalid request." };
  const reason = reasonOf(formData);
  if (!reason) return { ...NEED_REASON, values: formValues(formData) };
  const result = await deleteEvent(mod.id, { eventId, confirmName: String(formData.get("confirmName") ?? ""), reason });
  if (!result.ok) return { error: result.error, values: formValues(formData) };
  revalidatePath("/", "layout");
  redirect("/admin/events?deleted=1");
}

export async function testEventsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const mod = await moderator();
  if (!mod || mod.role !== "admin") return { error: "Admins only." };
  const op = String(formData.get("op") ?? "");
  if (!["add", "remove"].includes(op)) return { error: "Unknown action." };
  const result = op === "add" ? await createTestEvents(mod.id) : await removeTestEvents(mod.id);
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  return { ok: true, message: result.message };
}
