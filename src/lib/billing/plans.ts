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
 * cycle.
 *
 * **`total` is exactly twelve times `perMonth`, and that is a rule rather than a
 * coincidence** — the annual card says "$8.25 a month, billed yearly", and the
 * two figures disagreeing by a cent would make one of them a lie. A test asserts
 * it, so a future price change cannot quietly break the pair.
 *
 * **The annual was $87 and is now $99, and the reason is the discount rather
 * than the price.** $87 against $10.99 a month is 34% off — roughly double what
 * this trade does. The convention is "two months free", twelve for the price of
 * ten, which is 16.7%; 15–20% is the usual band and 20–25% is already the
 * aggressive end. Dabble, the nearest subscription competitor, uses 20%. So the
 * old figure was not cheap for the market, it was *discounted* far past it, and
 * the money was being left on the table by the arithmetic rather than by a
 * decision.
 *
 * $99 is 25% off, still visibly generous, lands exactly on Plottr Pro's annual,
 * and divides by twelve into $8.25 with nothing left over — which the rule above
 * requires. Changed while there were no subscribers, since a price rise
 * afterwards is an announcement rather than an edit.
 *
 * The comparison worth keeping in view is not the other subscriptions, though.
 * Atticus is $147 **once**, Vellum $199–$250 once, Scrivener $60 once: this
 * market is used to buying a tool rather than renting one. See TODO.md on the
 * lifetime tier that was built and removed on 2026-08-03 — that is the real
 * pricing question, and it is a business decision rather than a number here.
 */
const PRICES: Record<Currency, Record<Period, { total: number; perMonth: number }>> = {
  USD: {
    monthly: { total: 10.99, perMonth: 10.99 },
    annual: { total: 99.0, perMonth: 8.25 },
  },
  LKR: {
    monthly: { total: 2900, perMonth: 2900 },
    annual: { total: 23400, perMonth: 1950 },
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
 * Currency-aware, because the LKR table is priced for its own market and its
 * saving need not match the USD one. Today both come to 25%.
 */
export function annualSavingPercent(currency: Currency = CURRENCY): number {
  const monthly = PRICES[currency].monthly.perMonth;
  const annual = PRICES[currency].annual.perMonth;
  return Math.round(((monthly - annual) / monthly) * 100);
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

/** What the writer is buying, shown on PayHere's own page. */
export function itemNameOf(period: Period): string {
  return `OpenChapter Pro (${period === "annual" ? "annual" : "monthly"})`;
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
