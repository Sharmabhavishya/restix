// How good a price is, for the price colours and the "good deal" alert. Pure, so it's testable.
//
// The yardstick is the face value the organisers published, or otherwise the median asking price
// of the live listings for the same ticket type (only when there are enough of them to mean
// something). What a seller says they paid is never used: they could inflate it to fake a deal.

export type PriceTier = "steal" | "good" | "fair" | "high" | "steep";

export interface PriceRef {
  /** The reference price in paise. */
  paise: number;
  source: "face" | "market";
}

export const MIN_MARKET_SAMPLE = 3;

export function priceRef(input: {
  faceValuePaise: number | null;
  marketMedianPaise?: number | null;
  marketCount?: number | null;
}): PriceRef | null {
  if (input.faceValuePaise !== null && input.faceValuePaise > 0) return { paise: input.faceValuePaise, source: "face" };
  if (input.marketMedianPaise != null && input.marketMedianPaise > 0 && (input.marketCount ?? 0) >= MIN_MARKET_SAMPLE) {
    return { paise: Math.round(input.marketMedianPaise), source: "market" };
  }
  return null;
}

/**
 * Where `askingPaise` sits against the reference:
 *   steal  30% or more under    good  10-30% under    fair  under 10% off, up to the reference
 *   high   up to 20% over       steep more than 20% over
 */
export function priceTier(askingPaise: number, ref: PriceRef | null): PriceTier | null {
  if (!ref) return null;
  const ratio = askingPaise / ref.paise;
  if (ratio <= 0.7) return "steal";
  if (ratio <= 0.9) return "good";
  if (ratio <= 1) return "fair";
  if (ratio <= 1.2) return "high";
  return "steep";
}

/** Whole-percent saving against the reference, when there is one (never negative or zero). */
export function savingPercent(askingPaise: number, ref: PriceRef | null): number | null {
  if (!ref || askingPaise >= ref.paise) return null;
  return Math.floor(((ref.paise - askingPaise) / ref.paise) * 100) || null;
}

export interface Deal {
  ref: PriceRef | null;
  tier: PriceTier | null;
  saving: number | null;
  /** Worth shouting about: a steal or a good deal. */
  alert: boolean;
}

/** Everything the UI needs about one listing's price. */
export function dealFor(l: {
  askingPricePaise: number;
  faceValuePaise: number | null;
  marketMedianPaise?: number | null;
  marketCount?: number | null;
}): Deal {
  const ref = priceRef(l);
  const tier = priceTier(l.askingPricePaise, ref);
  return { ref, tier, saving: savingPercent(l.askingPricePaise, ref), alert: tier === "steal" || tier === "good" };
}

export const TIER_LABEL: Record<PriceTier, string> = {
  steal: "Steal",
  good: "Good deal",
  fair: "Fair price",
  high: "Above face value",
  steep: "Pricey",
};

/** Plain words for where the yardstick came from. */
export const REF_LABEL: Record<PriceRef["source"], string> = {
  face: "face value",
  market: "other listings",
};
