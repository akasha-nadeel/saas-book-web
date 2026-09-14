/**
 * The two plans, what each one gives, and the order they climb in.
 *
 * **Two since 2026-09-14.** There were four — Free, Draft, Writer and Studio —
 * and the three paid ones differed only by how many assistant credits they
 * granted. The assistant was removed with every other model call, which left
 * three identical products at three prices, so they became one: Pro.
 *
 * **Its own file, importing nothing.** `plans.ts` is about money and `launch.ts`
 * is about what the MVP hides; the tier is a third thing that both of them and
 * the pricing cards need, so it sits below all three rather than inside one of
 * them. No `"use client"` either — the landing page is a Server Component, and a
 * client module's exports arrive there as client *references* rather than
 * values. That rule has already cost this codebase one 500.
 *
 * **The limits here are the browser's copy. Postgres holds the real one** —
 * the free-book trigger decides in SQL, because a number a browser can edit is
 * not a limit. The two are two statements of one rule and must move together,
 * the same way `booksAgainstPlan` and the book trigger already do. SQL cannot
 * import TypeScript; that is the whole of why this is stated twice, and it is
 * deliberate rather than a duplication waiting to be tidied away.
 */

/**
 * Cheapest first, and the order is load-bearing: `tierAtLeast` compares
 * positions in this array, so a tier inserted in the wrong place silently opens
 * or shuts every gate above it.
 */
export const TIER_ORDER = ["free", "pro"] as const;

export type PlanTier = (typeof TIER_ORDER)[number];

/** What can be bought. `free` is the absence of a subscription row. */
export type PaidTier = Exclude<PlanTier, "free">;

export const PAID_TIERS: readonly PaidTier[] = ["pro"];

/**
 * What each plan gives.
 *
 * **Books are the one difference the server enforces.** Everything else —
 * imports, sync, all three export formats, the consistency check, unlimited
 * words and chapters — is on both plans, and that is not an oversight to be
 * monetised later. *Export must never move behind the plan.* The daily title
 * check allowance is the other difference, and it lives in `free-limits.ts`
 * with the rest of the browser's meters.
 *
 * `books: null` means unlimited. It is `null` rather than `Infinity` because
 * this value is serialised to the browser through `/api/billing/subscription`
 * and JSON has no infinity.
 */
export const TIER_LIMITS = {
  free: {
    books: 1 as number | null,
  },
  pro: {
    books: null as number | null,
  },
} as const satisfies Record<PlanTier, TierLimits>;

export interface TierLimits {
  /** How many books may be held. `null` is unlimited. */
  books: number | null;
}

/**
 * What each plan is called on screen.
 *
 * Here rather than in the cards because five places say these words — the
 * pricing cards, the account menu, `/billing`, the checkout summary and the
 * item name PayHere prints on its own page — and a plan renamed in four of them
 * is a plan that appears to be two different products.
 */
export const TIER_NAMES: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
};

/**
 * Narrows whatever came back off a URL, a request body or a database row.
 *
 * **The retired tiers are refused rather than mapped.** `draft`, `writer` and
 * `studio` rows are rewritten to `pro` by the migration that retired them.
 * Quietly translating them here would hide a row the migration missed, and a
 * subscriber silently on the wrong plan is worse than one whose plan reads as
 * `free` until somebody looks.
 */
export function asTier(value: unknown): PlanTier | null {
  return typeof value === "string" &&
    (TIER_ORDER as readonly string[]).includes(value)
    ? (value as PlanTier)
    : null;
}

/** The same, for the places that may not be handed `free` — a checkout, mostly. */
export function asPaidTier(value: unknown): PaidTier | null {
  const tier = asTier(value);
  return tier && tier !== "free" ? tier : null;
}

/**
 * Whether `tier` reaches `minimum`.
 *
 * Every server gate asks this rather than naming tiers, so adding a plan is an
 * edit to `TIER_ORDER` and nothing else.
 */
export function tierAtLeast(tier: PlanTier, minimum: PlanTier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}

/** How many books this plan holds. `null` is unlimited. */
export function bookLimit(tier: PlanTier): number | null {
  return TIER_LIMITS[tier].books;
}
