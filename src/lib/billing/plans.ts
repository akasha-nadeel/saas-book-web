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
 * The three ways to buy, and the third one is not a cycle at all.
 *
 * **`lifetime` is a one-off payment**, and it is here because of what this
 * market actually does: Scrivener is bought once, Atticus is bought once,
 * Vellum and Publisher Rocket are bought once. A writer looking at those and
 * then at a monthly bill is being asked to accept a model the whole category
 * has trained them to distrust. Offering the subscription *and* the outright
 * purchase is how this competes on its own terms rather than on price.
 *
 * It costs more in code than a third price, and the cost is worth naming
 * because every place that branches on `Period` has to know: PayHere is sent
 * **no recurrence and no duration** for it (those two fields are what make a
 * charge repeat), nothing ever renews it, `isPro` never checks a date against
 * it, and there is nothing to cancel. See each of those in turn.
 */
export type Period = "monthly" | "annual" | "lifetime";

/** True for the one that does not come round again. */
export function isOneOff(period: Period): boolean {
  return period === "lifetime";
}

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
 * The prices. `total` is what PayHere charges; `perMonth` is what the card
 * shows, because a reader compares plans by the month whatever the cycle. The
 * annual rate is the monthly one less a third, and `total` is exactly twelve
 * times it, so the two figures cannot disagree.
 *
 * **Lifetime has no monthly figure**, and the null is load-bearing rather than
 * a gap: dividing a one-off purchase by an assumed number of months would be
 * inventing a rate out of a guess about how long somebody keeps writing, which
 * is the sort of number this product refuses everywhere else. The card prints
 * the whole figure and the word "once".
 *
 * The lifetime price is set against what this market charges for a single
 * purchase — Atticus at $147, Publisher Rocket at $199, Vellum at $199–250 —
 * rather than against a multiple of the subscription.
 */
const PRICES: Record<
  Currency,
  Record<Period, { total: number; perMonth: number | null }>
> = {
  USD: {
    monthly: { total: 9.0, perMonth: 9.0 },
    annual: { total: 72.0, perMonth: 6.0 },
    lifetime: { total: 199.0, perMonth: null },
  },
  LKR: {
    monthly: { total: 2900, perMonth: 2900 },
    annual: { total: 23400, perMonth: 1950 },
    lifetime: { total: 64000, perMonth: null },
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

/** Null for lifetime, which has no per-month rate that is not invented. */
export function perMonthOf(
  period: Period,
  currency: Currency = CURRENCY,
): number | null {
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

/**
 * What PayHere calls the cycle, or null for the purchase that has none.
 *
 * **Null is what makes lifetime a one-off.** PayHere decides whether a payment
 * repeats from the presence of `recurrence` and `duration` on the checkout —
 * send them and it sets up an authorisation that charges again; leave them out
 * and it takes the money once. So a lifetime checkout that shipped these by
 * accident would bill somebody $199 a month, which is the worst mistake
 * available in this file and the reason the type is nullable rather than
 * defaulted.
 */
export function recurrenceOf(period: Period): string | null {
  if (period === "lifetime") return null;
  return period === "annual" ? "1 Year" : "1 Month";
}

/**
 * How long the recurrence runs for. "Forever" means it keeps renewing until
 * somebody cancels, which is what a subscription is — a fixed duration would
 * silently stop charging and silently stop the plan. Null alongside a null
 * recurrence, for the same reason.
 */
export function durationOf(period: Period): string | null {
  return period === "lifetime" ? null : "Forever";
}

/** What the writer is buying, shown on PayHere's own page. */
export function itemNameOf(period: Period): string {
  const how =
    period === "lifetime" ? "lifetime" : period === "annual" ? "annual" : "monthly";
  return `OpenChapter Pro (${how})`;
}

/** How the cycle reads in a sentence, on the checkout summary. */
export function cycleLabel(period: Period): string {
  return period === "lifetime"
    ? "once"
    : period === "annual"
      ? "a year"
      : "a month";
}

/**
 * When the paid-up period runs out, given when it started.
 *
 * Calendar arithmetic, not 30 days: a month added to the 31st lands on a month
 * that has no 31st, so the day is clamped rather than rolled into the next
 * month — which is also how PayHere's own cycle behaves.
 *
 * **Lifetime returns null**, because there is no such date, and a sentinel far
 * in the future would have been the easy wrong answer: every screen that
 * renders `currentPeriodEnd` would then tell a writer their plan "renews on 1
 * January 2999", which is a lie about something they paid for outright.
 * `isPro` reads the period rather than the date for that one.
 */
export function periodEnd(from: Date, period: Period): Date | null {
  if (period === "lifetime") return null;

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
  return value === "monthly" || value === "annual" || value === "lifetime"
    ? value
    : null;
}
