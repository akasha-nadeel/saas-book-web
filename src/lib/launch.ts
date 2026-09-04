/* No import of `tiers.ts` any more: this file reads a balance rather than a
   plan, and the one thing it used it for — `chatAllowed` — is now the pricing
   screens' question rather than the gate's. */

/**
 * Launch-MVP product decisions that must stay consistent across marketing,
 * pricing, entitlement checks, and upgrade prompts.
 */

export const LAUNCH_LIMITS = {
  freeBooks: 5,
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
   * and the assistant's allowance; it is not the door.
   *
   * The pair stays as a pair so the decision has somewhere to live and so
   * narrowing it again is still one edit — `exportAllowed` reads both.
   */
  freeExports: ["docx", "epub", "pdf"],
  proExports: ["docx", "epub", "pdf"],
  /**
   * **Whether the assistant may put a passage into the chapter.**
   *
   * The third thing Pro buys, after unlimited books and the larger reply
   * allowance — and the first that is a capability rather than a number, which
   * is why it is stated here rather than left to the switch in the panel.
   *
   * **What is sold is the model writing applicable prose, not the pressing of a
   * button.** The manuscript is on the writer's own machine and the app says
   * so everywhere else; no browser gate could keep somebody out of their own
   * document, and none is claimed to. What the server actually decides is
   * whether `/api/chat` answers in write mode at all — see `requirePro` in the
   * route. That is a real gate on the thing that costs, which is the house rule
   * for anything sold: no Pro row whose value depends on a browser gate being
   * unbreakable.
   */
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
 * Whether the writing assistant is shut to this reader.
 *
 * **It asks about the balance, not about the plan**, and that is the whole of
 * what changed when credits arrived. A Free account holding bought credits may
 * use the assistant; a Writer who has spent their month may not, until the 1st.
 * Neither of those is a fact about the tier, and a gate written against
 * `chatAllowed` alone gets both of them wrong in opposite directions.
 *
 * `credits` is the total a writer can spend right now — the month's grant plus
 * anything bought. **`null` means nothing is metered here** (no gateway
 * configured, the self-hosted case) and must open, not close.
 *
 * The same loading rule as `onFreePlan`, for the same reason: `credits`
 * undefined is the state before the server has answered, and not knowing yet
 * is not a reason to refuse.
 *
 * `chatAllowed(tier)` still has a job — it is what the *pricing* screens ask,
 * because "this plan grants credits" is a different question from "this reader
 * has some". It is not the gate.
 */
export function aiChatClosed(plan: {
  loading: boolean;
  billing: boolean;
  credits?: number | null;
}): boolean {
  if (plan.loading || !plan.billing) return false;
  if (plan.credits === null || plan.credits === undefined) return false;
  return plan.credits <= 0;
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
 * **Whether the model steps around the comps search are reachable.**
 *
 * The catalogue search itself is live: `/api/comps` is free, keyless and
 * answers again as of 2026-09-02. The two routes that put a model over it are
 * not — `/api/comps/query`, which turns a plain sentence into a catalogue
 * query, and `/api/comps/rank`, which reads the manuscript's opening and says
 * which of the results are actually like it. Both still answer 404 through
 * `launchFeatureEnabled()`.
 *
 * **This is here rather than in `launch-server.ts` because a component has to
 * read it.** That module touches `process.env` and cannot be imported by a
 * client screen; this one reads no environment at all, which is exactly what
 * makes it safe to import anywhere. Same reasoning as
 * `HIDDEN_BOOK_TOOL_PATHS` below.
 *
 * **What it buys is the house rule about dead UI.** `comps-page.tsx` draws a
 * "Rank these" button and a paragraph listing the prose that press would send.
 * With the route gated that button cannot do anything but fail, and a control
 * that always errors is worse than one that is not there. The query
 * translation needs no such care — its failure is already swallowed on
 * purpose — so the flag only saves it a guaranteed 404 on every search.
 *
 * Flip it to `true` the day those two routes are un-gated. Nothing else needs
 * editing: `ResultsBar`, `rank()` and the whole ranking path are untouched in
 * the page, kept whole for exactly that.
 */
export const COMPS_RANKING_LIVE: boolean = false;

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
 * this is the case that shows why they have to be. `COMPS_RANKING_LIVE` above
 * covers the model routes over that data, which stay shut.
 */
const HIDDEN_BOOK_TOOL_PATHS = new Set([
  "arc",
  "blurb",
  "categories",
  "comps",
  "covers",
  "listing",
  "money",
  "paperback",
  "progress",
  "prose",
  "provenance",
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
  "Paperback setup",
  "Comparable-title research",
  "Blurb workshop",
  "Categories and keyword tools",
  "Cover checker",
  "Structure report",
  "Prose report",
  "Progress and writing record",
  "Money tracking",
  "Advance copies",
  "Collaboration and invitations",
  "Story bible, ideas, and bookmarks panels",
  "Markdown and audiobook export",
] as const;
