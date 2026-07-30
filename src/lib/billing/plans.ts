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

export type Period = "monthly" | "annual";

/**
 * The currencies PayHere will take on a *recurring* payment. It settles more
 * than these one-off, but a subscription is LKR or USD, so those are the two
 * this app offers.
 */
export type Currency = "LKR" | "USD";

/**
 * Which one this deployment charges in. Public because the pricing page renders
 * the figure and the pricing page runs in the browser; Next only inlines a
 * NEXT_PUBLIC_ name written out literally, hence no dynamic lookup.
 */
export const CURRENCY: Currency =
  process.env.NEXT_PUBLIC_PAYHERE_CURRENCY === "LKR" ? "LKR" : "USD";

/**
 * The prices. `total` is what PayHere charges on each cycle; `perMonth` is what
 * the card shows, because a reader compares plans by the month whatever the
 * cycle. The annual rate is the monthly one less a fifth — "two months free" —
 * and `total` is exactly twelve times it, so the two figures cannot disagree.
 */
const PRICES: Record<Currency, Record<Period, { total: number; perMonth: number }>> = {
  USD: {
    monthly: { total: 5.0, perMonth: 5.0 },
    annual: { total: 48.0, perMonth: 4.0 },
  },
  LKR: {
    monthly: { total: 1990, perMonth: 1990 },
    annual: { total: 19080, perMonth: 1590 },
  },
};

/** How the figure is written. LKR takes no decimals; nobody prices in cents. */
const FORMAT: Record<Currency, { symbol: string; decimals: number }> = {
  USD: { symbol: "$", decimals: 2 },
  LKR: { symbol: "Rs ", decimals: 0 },
};

export function priceOf(period: Period, currency: Currency = CURRENCY): number {
  return PRICES[currency][period].total;
}

export function perMonthOf(period: Period, currency: Currency = CURRENCY): number {
  return PRICES[currency][period].perMonth;
}

/** For a card, not for PayHere. `$5.00`, `Rs 1,990`. */
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

/** What PayHere calls the cycle. A number and a unit, space-separated. */
export function recurrenceOf(period: Period): string {
  return period === "annual" ? "1 Year" : "1 Month";
}

/**
 * How long the recurrence runs for. "Forever" means it keeps renewing until
 * somebody cancels, which is what a subscription is — a fixed duration would
 * silently stop charging and silently stop the plan.
 */
export const DURATION = "Forever";

/** What the writer is buying, shown on PayHere's own page. */
export function itemNameOf(period: Period): string {
  return period === "annual" ? "OpenChapter Pro (annual)" : "OpenChapter Pro (monthly)";
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
