/**
 * The four plans, what each one gives, and the order they climb in.
 *
 * **Plan used to be a boolean.** `isPro()` answered yes or no, and every gate
 * in the tree asked that one question. The column `subscriptions.plan` existed
 * from the first billing migration, was written on every purchase and was never
 * once read back — a name with nowhere to be said. This module is what makes it
 * mean something.
 *
 * **Its own file, importing nothing.** `plans.ts` is about money and `launch.ts`
 * is about what the MVP hides; the tier is a third thing that both of them and
 * the pricing cards need, so it sits below all three rather than inside one of
 * them. No `"use client"` either — the landing page is a Server Component, and a
 * client module's exports arrive there as client *references* rather than
 * values. That rule has already cost this codebase one 500.
 *
 * **The limits here are the browser's copy. Postgres holds the real one** —
 * `claim_assistant_reply` and the free-book trigger decide in SQL, because a
 * number a browser can edit is not a limit. The two are two statements of one
 * rule and must move together, the same way `booksAgainstPlan` and the book
 * trigger already do. SQL cannot import TypeScript; that is the whole of why
 * this is stated twice, and it is deliberate rather than a duplication waiting
 * to be tidied away.
 */

/**
 * Cheapest first, and the order is load-bearing: `tierAtLeast` compares
 * positions in this array, so a tier inserted in the wrong place silently opens
 * or shuts every gate above it.
 */
export const TIER_ORDER = ["free", "draft", "writer", "studio"] as const;

export type PlanTier = (typeof TIER_ORDER)[number];

/** The three that can be bought. `free` is the absence of a subscription row. */
export type PaidTier = Exclude<PlanTier, "free">;

export const PAID_TIERS: readonly PaidTier[] = ["draft", "writer", "studio"];

/**
 * What each plan gives.
 *
 * **`chat` is the line the product is drawn on.** Free and Draft get the whole
 * of OpenChapter except the assistant; Writer and Studio get the assistant.
 * Everything else — imports, sync, all three export formats, the title and
 * consistency checks, unlimited words and chapters — is on every tier including
 * Free, and that is not an oversight to be monetised later. *Export must never
 * move behind the plan.*
 *
 * **Two meters, two windows, on purpose.** Quick resets daily and Careful
 * monthly. A monthly cap on the cheap model would teach a writer to hoard the
 * thing that costs almost nothing; a daily cap on the expensive one would be
 * either uselessly small or ruinous on a busy week. The window follows the
 * cost, not the calendar.
 *
 * `books: null` means unlimited. It is `null` rather than `Infinity` because
 * this value is serialised to the browser through `/api/billing/subscription`
 * and JSON has no infinity.
 */
export const TIER_LIMITS = {
  free: {
    books: 5 as number | null,
    chat: false,
    quickPerDay: 0,
    carefulPerMonth: 0,
    assistantWrite: false,
  },
  draft: {
    books: null as number | null,
    chat: false,
    quickPerDay: 0,
    carefulPerMonth: 0,
    assistantWrite: false,
  },
  writer: {
    books: null as number | null,
    chat: true,
    quickPerDay: 25,
    carefulPerMonth: 100,
    assistantWrite: true,
  },
  studio: {
    books: null as number | null,
    chat: true,
    quickPerDay: 40,
    carefulPerMonth: 300,
    assistantWrite: true,
  },
} as const satisfies Record<PlanTier, TierLimits>;

export interface TierLimits {
  /** How many books may be held. `null` is unlimited. */
  books: number | null;
  /** Whether the writing assistant is reachable at all. */
  chat: boolean;
  /** Replies on the quick model, per UTC day. */
  quickPerDay: number;
  /** Replies on the careful model, per UTC calendar month. */
  carefulPerMonth: number;
  /** Whether the assistant may offer text to put into the chapter. */
  assistantWrite: boolean;
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
  draft: "Draft",
  writer: "Writer",
  studio: "Studio",
};

/**
 * Narrows whatever came back off a URL, a request body or a database row.
 *
 * **`"pro"` is refused rather than mapped.** Rows written before the tiers
 * existed carry it, and the migration that adds the CHECK constraint rewrites
 * them to `writer` in the same statement. Quietly translating it here would
 * hide a row the migration missed, and a subscriber silently on the wrong plan
 * is worse than one whose plan reads as `free` until somebody looks.
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
 * Every server gate asks this rather than naming tiers, so adding a fifth plan
 * is an edit to `TIER_ORDER` and nothing else.
 */
export function tierAtLeast(tier: PlanTier, minimum: PlanTier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}

/** Whether the assistant is reachable on this plan at all. */
export function chatAllowed(tier: PlanTier): boolean {
  return TIER_LIMITS[tier].chat;
}

/** Whether the assistant may offer text to put into the chapter. */
export function assistantWriteAllowed(tier: PlanTier): boolean {
  return TIER_LIMITS[tier].assistantWrite;
}

/** How many books this plan holds. `null` is unlimited. */
export function bookLimit(tier: PlanTier): number | null {
  return TIER_LIMITS[tier].books;
}
