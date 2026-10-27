import { describe, expect, it } from "vitest";
import { effectiveStatus, isAvailable, publishDecision, sellerActionsFor, sellerCan, type EventFacts, type ListingFacts } from "./listing-rules";

const now = new Date("2026-11-01T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

const event = (over: Partial<EventFacts> = {}): EventFacts => ({
  status: "scheduled",
  transferPolicy: "allowed",
  startsAt: inDays(10),
  endsAt: inDays(10.2),
  ...over,
});
const listing = (over: Partial<ListingFacts> = {}): ListingFacts => ({
  status: "active",
  expiresAt: inDays(5),
  askingPricePaise: 50_000,
  originalPricePaise: 50_000,
  ...over,
});

describe("effectiveStatus", () => {
  it("keeps an open listing active before it expires", () => {
    expect(effectiveStatus(listing(), event(), now)).toBe("active");
    expect(isAvailable(listing(), event(), now)).toBe(true);
  });

  it("treats a listing past its expiry as expired even if the stored status says active", () => {
    expect(effectiveStatus(listing({ expiresAt: inDays(-0.01) }), event(), now)).toBe("expired");
  });

  it("expires listings once the event has ended", () => {
    const past = event({ startsAt: inDays(-2), endsAt: inDays(-1.9) });
    expect(effectiveStatus(listing({ expiresAt: inDays(1) }), past, now)).toBe("expired");
    expect(effectiveStatus(listing(), event({ status: "completed" }), now)).toBe("expired");
  });

  it("makes listings for a cancelled event unavailable", () => {
    expect(effectiveStatus(listing(), event({ status: "cancelled" }), now)).toBe("unavailable");
    expect(isAvailable(listing(), event({ status: "cancelled" }), now)).toBe(false);
  });

  it("never revives terminal statuses", () => {
    for (const status of ["sold", "unavailable", "removed", "rejected", "expired"] as const) {
      expect(effectiveStatus(listing({ status }), event(), now)).toBe(status);
    }
  });

  it("does not show paused listings as available", () => {
    expect(isAvailable(listing({ status: "paused" }), event(), now)).toBe(false);
  });
});

describe("publishDecision", () => {
  it("publishes immediately when resale is allowed", () => {
    expect(publishDecision(listing(), event(), now)).toEqual({ ok: true, status: "active" });
  });

  it("blocks events whose organisers prohibit resale", () => {
    const d = publishDecision(listing(), event({ transferPolicy: "prohibited" }), now);
    expect(d.ok).toBe(false);
  });

  it("sends listings for events with an unknown policy to review instead of assuming resale is fine", () => {
    const d = publishDecision(listing(), event({ transferPolicy: "unknown" }), now);
    expect(d).toMatchObject({ ok: true, status: "pending_review" });
  });

  it("enforces face value when required", () => {
    const fv = event({ transferPolicy: "face_value_only" });
    expect(publishDecision(listing({ askingPricePaise: 50_000, originalPricePaise: 50_000 }), fv, now).ok).toBe(true);
    expect(publishDecision(listing({ askingPricePaise: 40_000, originalPricePaise: 50_000 }), fv, now).ok).toBe(true);
    expect(publishDecision(listing({ askingPricePaise: 50_100, originalPricePaise: 50_000 }), fv, now).ok).toBe(false);
    expect(publishDecision(listing({ originalPricePaise: null }), fv, now).ok).toBe(false);
    // A seller can't lift the cap by claiming they paid more than the published face value.
    expect(publishDecision(listing({ askingPricePaise: 90_000, originalPricePaise: 90_000, faceValuePaise: 50_000 }), fv, now).ok).toBe(false);
  });

  it("blocks cancelled, finished or already-started-and-ended events", () => {
    expect(publishDecision(listing(), event({ status: "cancelled" }), now).ok).toBe(false);
    expect(publishDecision(listing(), event({ status: "completed" }), now).ok).toBe(false);
    expect(publishDecision(listing({ expiresAt: inDays(1) }), event({ startsAt: inDays(-1), endsAt: inDays(-0.5) }), now).ok).toBe(false);
  });

  it("rejects expiry dates in the past or after the event ends", () => {
    expect(publishDecision(listing({ expiresAt: inDays(-1) }), event(), now).ok).toBe(false);
    expect(publishDecision(listing({ expiresAt: inDays(11) }), event(), now).ok).toBe(false);
  });

  it("allows postponed events (they still happen) while respecting the policy", () => {
    expect(publishDecision(listing(), event({ status: "postponed" }), now)).toEqual({ ok: true, status: "active" });
  });
});

describe("seller actions", () => {
  it("only lets sellers pause an active listing and resume a paused one", () => {
    expect(sellerCan("pause", "active")).toBe(true);
    expect(sellerCan("pause", "paused")).toBe(false);
    expect(sellerCan("resume", "paused")).toBe(true);
    expect(sellerCan("resume", "expired")).toBe(false);
  });

  it("never lets sellers act on listings a moderator removed", () => {
    expect(sellerActionsFor("removed")).toEqual([]);
  });

  it("does not let sellers edit sold or expired listings", () => {
    expect(sellerCan("edit", "sold")).toBe(false);
    expect(sellerCan("edit", "expired")).toBe(false);
  });
});
