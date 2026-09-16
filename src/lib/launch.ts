/**
 * Launch-MVP product decisions that must stay consistent across marketing,
 * pricing, entitlement checks, and upgrade prompts.
 */

export const LAUNCH_LIMITS = {
  /**
   * Mirrors `TIER_LIMITS.free.books` and the book-limit trigger.
   *
   * Three since 2026-09-15, up from one. One was stricter than every
   * competitor checked (WriteO and Novlr give two, Reedsy Studio unlimited) and
   * the design note named it as the first thing to revisit; three lets a writer
   * try a series before paying.
   */
  freeBooks: 3,
  /**
   * **Every format, on both plans, and the two arrays being identical is the
   * point rather than an oversight.**
   *
   * The launch MVP shipped `["docx"]` here and sold EPUB and PDF as the two
   * things Pro bought. That reversed a rule this app had already written down —
   * *export must never move behind the plan* — and it was the wrong thing to
   * charge for: a writer has to be able to take the book and go, and a tool
   * that holds the finished file back is the one thing this trade's writers
   * have been burned by often enough to look for first. Pro is unlimited books
   * and unlimited title checks; it is not the door.
   *
   * The pair stays as a pair so the decision has somewhere to live and so
   * narrowing it again is still one edit — `exportAllowed` reads both.
   */
  freeExports: ["docx", "epub", "pdf"],
  proExports: ["docx", "epub", "pdf"],
} as const;

export type LaunchExportFormat = (typeof LAUNCH_LIMITS.proExports)[number];

export function exportAllowed(format: string, pro: boolean): boolean {
  const allowed = pro ? LAUNCH_LIMITS.proExports : LAUNCH_LIMITS.freeExports;
  return (allowed as readonly string[]).includes(format);
}

/**
 * Whether the reader is *known* to be on the metered free plan.
 *
 * **All three parts matter, and the middle one is a bug this app has already
 * paid for.** With no payment gateway configured there are no plans and
 * nothing is held back, so `billing` is half the question. The other half is
 * `loading`: `usePlan()` starts at UNKNOWN — `loading: true, pro: false` — and
 * asks the server on mount, so for the width of one request a Pro account is
 * indistinguishable from a free one. Gating during that window told a writer
 * with unlimited books that there was no room to restore their own book.
 * **Not knowing yet is not a reason to refuse.**
 *
 * Structural rather than typed to `PlanState`, so this module keeps importing
 * nothing — and so the same three-part test cannot be written four ways in
 * four call sites, which is how it came to be missing a part in two of them.
 */
export function onFreePlan(plan: {
  loading: boolean;
  billing: boolean;
  pro: boolean;
}): boolean {
  return !plan.loading && plan.billing && !plan.pro;
}

/**
 * Whether a book's inside is shut to this reader.
 *
 * **The trash is the free plan's one closed door, and it is a browser gate
 * that is honest about being one.** The manuscript is already on this machine
 * — `localStorage` and IndexedDB — so no server check could keep a determined
 * reader out of a book they have, and none is claimed to. What this does is
 * keep the trash from being a free shelf: a book put there is on its way out,
 * and reading it is what restoring it is for. Pro opens one where it sits.
 *
 * It reads the *book*, never the shelf view, so the editor route and the card
 * cannot disagree about which books are shut — a pasted URL is the same
 * question as a press.
 */
export function trashedBookClosed(
  book: { trashedAt?: number | null } | null | undefined,
  plan: { loading: boolean; billing: boolean; pro: boolean },
): boolean {
  return !!book?.trashedAt && onFreePlan(plan);
}

/**
 * Whether the paid plans can actually be bought.
 *
 * **False since 2026-09-07, and off on purpose rather than by accident.**
 * No stranger has ever completed a checkout against the live prices, and the
 * one card available to test with was declined by its bank. A pricing page
 * that takes money down a path nobody has walked is worse than one that says
 * it is not open yet, so every paid button opens the "Available Soon" dialog
 * and the press is recorded instead. (The prices themselves changed on
 * 2026-09-14, when the three paid plans became Pro; the two new Paddle price
 * ids have to exist before this can flip.)
 *
 * **Do not do this by unsetting the Paddle environment variables**, which is
 * the shortcut it looks like. `billingConfigured()` answering false means no
 * plans and nothing held back — the site would stop selling *and* give the
 * paid product away. That is not a hypothetical: it is the state this
 * deployment sat in from 2026-08-23 to 2026-09-07, when six renamed price
 * variables went unset and nothing noticed, because "no gateway configured" is
 * a legitimate state that opens everything rather than breaking anything. The
 * gate belongs over the buttons, with the billing configuration left intact
 * underneath.
 *
 * Flipping it back is this one edit and a deploy — after a real checkout has
 * been proven end to end with a card that works.
 *
 * Plain const rather than an environment read: `launch.ts` imports nothing and
 * is read by client and server alike, so one boolean serves every call site.
 */
export const PLANS_ON_SALE: boolean = true;

/**
 * The book-tool segments the proxy sends home, plus `read`.
 *
 * **`title-check` came off this list on 2026-09-02 and `comps` went back on it
 * on 2026-09-03.** Both are catalogue-backed searches over Google Books merged
 * with Open Library, neither of which needs a key to answer, and both are
 * built and tested. Only the title check is wanted for now, so the dashboard
 * holds it alone and comps waits here — which is what this list is for.
 *
 * **`/api/comps` stays open**, because it is the route the title check runs on.
 * Gating a screen and gating the data behind it are separate decisions, and
 * this is the case that shows why they have to be.
 *
 * **`paperback` and `provenance` came off on 2026-09-15**, ranked first by
 * that day's research: writers suspected of using AI (the writing record) and
 * KDP refusing a paperback over its margins and spine (paperback setup).
 * `arc` came off the same day and went back on it: the owner reviewed it in
 * the running app and took it out again. Neither remaining screen links to one
 * still on this list.
 */
const HIDDEN_BOOK_TOOL_PATHS = new Set([
  "arc",
  "blurb",
  "categories",
  "comps",
  "covers",
  "listing",
  "money",
  "progress",
  "prose",
  "read",
  "roadmap",
  "structure",
  "track",
]);

export function hiddenLaunchRoute(pathname: string): boolean {
  if (pathname === "/tools") return true;
  if (pathname.startsWith("/invite/")) return true;

  const match = pathname.match(/^\/book\/[^/]+\/([^/?#]+)/);
  return match ? HIDDEN_BOOK_TOOL_PATHS.has(match[1]) : false;
}

export const LAUNCH_POST_BACKLOG = [
  "Publishing roadmap",
  "Store listing details",
  "Comparable-title research",
  "Blurb workshop",
  "Categories and keyword tools",
  "Cover checker",
  "Structure report",
  "Prose report",
  "Progress",
  "Money tracking",
  "Advance copies",
  "Collaboration and invitations",
  "Story bible panel",
  "Bookmarks panel",
  "Markdown export",
] as const;
