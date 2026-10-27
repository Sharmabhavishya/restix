import "server-only";
import { asSystem, asUser } from "./db";
import { allow } from "./rate-limit";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function privateProfile(viewerId: string) {
  const [row] = await asUser(viewerId, (tx) => tx<{ email: string; whatsappNumber: string | null }[]>`
    select email, whatsapp_number from restix.profile_private where user_id = ${viewerId}`);
  return row ?? null;
}

export async function updateProfile(viewerId: string, input: { displayName: string; whatsapp: string | null; finishOnboarding?: boolean }): Promise<Result> {
  if (!(await allow("profile", viewerId))) return { ok: false, error: "Too many changes in a short time. Try again later." };
  try {
    await asUser(viewerId, async (tx) => {
      await tx`update restix.profiles set display_name = ${input.displayName} where id = ${viewerId}`;
      await tx`update restix.profile_private set whatsapp_number = ${input.whatsapp} where user_id = ${viewerId}`;
    });
    if (input.finishOnboarding) {
      // onboarded_at is not client-writable; the server stamps it once the person has set their name.
      await asSystem((tx) => tx`update restix.profiles set onboarded_at = coalesce(onboarded_at, now()) where id = ${viewerId}`);
    }
    return { ok: true, message: "saved" };
  } catch (err) {
    console.error("profile update failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Your changes weren't saved because of a server error. Try again." };
  }
}

/**
 * Deletes the account and everything that belongs to it: profile, private details, listings,
 * conversations and outcome confirmations. Reports the person filed stay (without their name)
 * so moderation history is not lost; the moderation log keeps entries with the account unlinked.
 */
export async function deleteAccount(viewerId: string): Promise<Result> {
  const [profile] = await asSystem((tx) => tx<{ status: string }[]>`select status from restix.profiles where id = ${viewerId}`);
  if (!profile) return { ok: false, error: "Account not found." };
  if (profile.status !== "active") {
    return {
      ok: false,
      error: "Accounts under a moderation restriction can't be deleted from here, so a decision can't be dodged by re-joining. Send an appeal, or email the ResTix team to request deletion.",
    };
  }
  try {
    await asSystem(async (tx) => {
      await tx`delete from restix.profiles where id = ${viewerId}`;
      // Removes the sign-in identity too where the database role is allowed to (local dev, and
      // Supabase projects where `postgres` may write auth.users). Otherwise only the identity
      // record remains in Supabase Auth; see docs/DEPLOYMENT.md for the admin clean-up step.
      await tx`savepoint auth_cleanup`;
      try {
        await tx`delete from auth.users where id = ${viewerId}`;
      } catch {
        await tx`rollback to savepoint auth_cleanup`;
      }
    });
    return { ok: true };
  } catch (err) {
    console.error("account deletion failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Your account wasn't deleted because of a server error. Nothing was removed; try again." };
  }
}

export async function profileSummary(viewerId: string) {
  const [row] = await asUser(viewerId, (tx) => tx<{ listings: number; activeListings: number; sold: number; inquiriesSent: number; inquiriesReceived: number }[]>`
    select (select count(*)::int from restix.ticket_listings where seller_id = ${viewerId}) as listings,
           (select count(*)::int from restix.ticket_listings where seller_id = ${viewerId} and status = 'active' and expires_at > now()) as active_listings,
           (select count(*)::int from restix.ticket_listings where seller_id = ${viewerId} and status = 'sold') as sold,
           (select count(*)::int from restix.inquiries where buyer_id = ${viewerId}) as inquiries_sent,
           (select count(*)::int from restix.inquiries where seller_id = ${viewerId}) as inquiries_received`);
  return row;
}

export async function pendingInquiryCount(viewerId: string): Promise<number> {
  const [row] = await asUser(viewerId, (tx) => tx<{ n: number }[]>`
    select count(*)::int as n from restix.inquiries where seller_id = ${viewerId} and status = 'pending'`);
  return row?.n ?? 0;
}
