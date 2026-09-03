import { PAID_TIERS, TIER_NAMES, type PaidTier } from "./tiers";

/**
 * What Pro costs, and how often.
 *
 * One table, read by three places that must never disagree: the pricing page's
 * headline figure, the amount signed into the PayHere checkout, and the period
 * the webhook extends a subscription by. A price that lives in a component is a
 * price that drifts from the one actually charged.
 *
 * Pure and public — none of it is a secret, and the pricing page is a client
 * component, so it has to be readable in the browser.
 */

/**
 * The two ways to buy. Both are cycles: everything here renews until somebody
 * cancels, and nothing in this file describes a one-off purchase.
 *
 * A lifetime tier was built and then removed, and the removal is worth a line
 * because it is not a gap waiting to be filled. Selling a book tool outright is
 * what this market mostly does, but it trades recurring revenue for a support
 * obligation with no end date, which is a business decision rather than a
 * pricing one. If it ever comes back, the things that made it expensive in code
 * are: PayHere must be sent no `recurrence` and no `duration` or it bills the
 * one-off price every month, there is no period end to store, and `isPro` has
 * to answer without a date.
 */
export type Period = "monthly" | "annual";

export type { PaidTier, PlanTier } from "./tiers";

/**
 * What a charge is denominated in.
 *
 * **One member, and that is the decision rather than an oversight.** There used
 * to be an LKR table beside the USD one, priced for its own market rather than
 * converted, selected by `NEXT_PUBLIC_PAYHERE_CURRENCY`. It came out when the
 * plans went to four: three tiers times two cycles times two currencies is
 * twelve figures to keep true, and eleven of them were never rendered — this
 * deployment charges in USD, and only PayHere could have shown the others.
 *
 * The type survives the table because PayHere's payload carries the string and
 * ought to be typed. Putting a second currency back means restoring the record
 * shape here and the `FORMAT` entry below; nothing else reads it.
 */
export type Currency = "USD";

/** Which one this deployment charges in. */
export const CURRENCY: Currency = "USD";

/**
 * What each plan costs. `total` is what the gateway charges on a cycle;
 * `perMonth` is what a card shows for comparison.
 *
 * Every annual price is 25% below paying monthly for twelve months. That the
 * three agree is what lets the period toggle print one badge over three
 * columns — and because it is a coincidence of the numbers rather than a rule,
 * `uniformAnnualSaving()` below checks it rather than assuming it.
 *
 * **`perMonth` is divided, never typed.** A hand-written figure drifts from the
 * charge the first time a total moves, and the drift is invisible: both numbers
 * look plausible. `plans.test.ts` pins this.
 */
const PRICES: Record<PaidTier, Record<Period, { total: number; perMonth: number }>> = {
  draft: {
    monthly: { total: 5.98, perMonth: 5.98 },
    annual: { total: 53.99, perMonth: 53.99 / 12 },
  },
  writer: {
    monthly: { total: 14.98, perMonth: 14.98 },
    annual: { total: 134.99, perMonth: 134.99 / 12 },
  },
  studio: {
    monthly: { total: 24.98, perMonth: 24.98 },
    annual: { total: 224.99, perMonth: 224.99 / 12 },
  },
};

/** How the figure is written. */
const FORMAT: Record<Currency, { symbol: string; decimals: number }> = {
  USD: { symbol: "$", decimals: 2 },
};

export function priceOf(tier: PaidTier, period: Period): number {
  return PRICES[tier][period].total;
}

export function perMonthOf(tier: PaidTier, period: Period): number {
  return PRICES[tier][period].perMonth;
}

/**
 * What the annual cycle saves, as a whole percent.
 *
 * **Derived, never typed.** It is the one figure on the pricing page that is a
 * claim about the other two, so a hand-written "Save 25%" is a sentence that
 * silently becomes false the next time either price moves — which is exactly
 * what happened to the 34% in this file's own comment. Rounded rather than
 * printed to a decimal: a badge saying "Save 24.9%" reads as arithmetic rather
 * than as an offer.
 *
 * Per tier, because three ladders need not agree — see `uniformAnnualSaving`
 * for the one place that cares whether they do.
 */
export function annualSavingPercent(tier: PaidTier): number {
  const monthly = PRICES[tier].monthly.perMonth;
  const annual = PRICES[tier].annual.perMonth;
  return Math.round(((monthly - annual) / monthly) * 100);
}

/**
 * The saving all three paid plans share, or null when they do not share one.
 *
 * **The period toggle prints one badge above three columns**, and a single
 * percentage over three different savings is the same stale claim
 * `annualSavingPercent` was written to prevent, one level up. So the badge asks
 * this first and renders nothing when the answer is null, rather than picking a
 * tier's figure and hoping.
 *
 * Today all three round to 25%.
 */
export function uniformAnnualSaving(): number | null {
  const [first, ...rest] = PAID_TIERS.map(annualSavingPercent);
  return rest.every((saving) => saving === first) ? first : null;
}

/** For a card, not for PayHere. `$5.98`. */
export function displayPrice(amount: number, currency: Currency = CURRENCY): string {
  const { symbol, decimals } = FORMAT[currency];
  return (
    symbol +
    amount.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

/**
 * For PayHere, not for a card.
 *
 * Always two decimals and never a thousands separator: this exact string is
 * what goes into the checkout hash, and PayHere formats its side with PHP's
 * `number_format($amount, 2, '.', '')`. A comma here and the signature is wrong
 * for a reason nothing on screen would explain.
 */
export function payhereAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * What PayHere calls the cycle. A number and a unit, space-separated.
 *
 * This and `durationOf` are the two fields that make a charge repeat at all —
 * PayHere takes the money once if either is missing. Every checkout here is a
 * subscription, so both are always sent.
 */
export function recurrenceOf(period: Period): string {
  return period === "annual" ? "1 Year" : "1 Month";
}

/**
 * How long the recurrence runs for. "Forever" means it keeps renewing until
 * somebody cancels, which is what a subscription is — a fixed duration would
 * silently stop charging and silently stop the plan.
 */
export function durationOf(): string {
  return "Forever";
}

/**
 * What the writer is buying, shown on PayHere's own page.
 *
 * The plan's name comes from `TIER_NAMES` rather than being written here, so
 * the words on the receipt cannot disagree with the words on the card.
 */
export function itemNameOf(tier: PaidTier, period: Period): string {
  return `OpenChapter ${TIER_NAMES[tier]} (${
    period === "annual" ? "annual" : "monthly"
  })`;
}

/** How the cycle reads in a sentence, on the checkout summary. */
export function cycleLabel(period: Period): string {
  return period === "annual" ? "a year" : "a month";
}

/**
 * When the paid-up period runs out, given when it started.
 *
 * Calendar arithmetic, not 30 days: a month added to the 31st lands on a month
 * that has no 31st, so the day is clamped rather than rolled into the next
 * month — which is also how PayHere's own cycle behaves.
 */
export function periodEnd(from: Date, period: Period): Date {
  const end = new Date(from.getTime());
  const day = end.getUTCDate();

  if (period === "annual") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }

  // setUTCMonth rolls over when the target month is short (Jan 31 → Mar 3).
  // Pull it back to the last day of the month we meant.
  if (end.getUTCDate() !== day) end.setUTCDate(0);

  return end;
}

/** Narrows whatever came back off a URL or a database row. */
export function asPeriod(value: unknown): Period | null {
  return value === "monthly" || value === "annual" ? value : null;
}
