/**
 * What the free plan limits, and how much of it is left.
 *
 * **One rule: the free plan runs the tools on five books.** Inside those five,
 * nothing is metered — search the catalogues as often as naming a book actually
 * takes, import as often as you like, redo the covers shelf all afternoon. The
 * sixth book is where Pro begins.
 *
 * **It replaced four meters of ten, and the reason is what the meters charged
 * for.** Ten comp searches, ten cover searches, ten title checks, ten imports:
 * each counted an *attempt*, and every one of those screens is a screen you use
 * badly on purpose. Naming is iterative — type a title, read the shelf, change
 * one word, try again — so ten searches is perhaps three real candidates, and
 * the meter ran out in the middle of the one activity the tool exists for. The
 * writer who felt it first was the writer using it properly, which is the wrong
 * person to stop.
 *
 * Counting books instead charges for *scale* rather than for effort, which is
 * also the honest description of who ought to be paying: somebody with a
 * backlist and several listings to build is running a business, and somebody
 * naming their first novel is not. Figma's free plan is the same shape and
 * nearly the same sentence — three files, unlimited work inside them — and it is
 * a limit a reader can hold in their head, which "ten of each of four different
 * things" never was.
 *
 * Everything outside those five books is unbounded as it always was: books,
 * words, chapters, all four exports, sync, the pre-upload check and the roadmap.
 * **A book you never open a tool on costs nothing** — the shelf is not the
 * limit, the tooling is.
 *
 * The list lives in `prefs.toolBooks` and travels with the rest of the prefs
 * blob, so a second machine does not hand out five more. This is a **browser
 * gate**, like the prose report and the money screens: the work it guards
 * happens in the browser or through a route that is deliberately free and
 * keyless, and no server check is possible without taking that away. What it is
 * for is telling a writer the truth about the plan they are on. The routes that
 * actually cost money — the assistant, narration, transcription and the three
 * model steps around comps — are gated by `requirePro()` on the server and are
 * not touched by any of this.
 *
 * With no payment gateway configured the subscription route answers `pro: true`
 * for everyone, so a self-hosted copy has no limits at all — the same shape as
 * every other gate here.
 *
 * Seats are the other number with a free-plan figure on it, and they work
 * differently again — see `SEATS_PER_BOOK`. Both live in this file because the
 * rule about plan numbers is one number in one place, and the pricing page reads
 * them from here rather than restating them.
 */

/**
 * How many books a free writer may use the tools on. Unlimited on Pro.
 *
 * Quoted by the pricing page, the Help dialog and the terms rather than restated
 * in any of them — the same rule the prices follow: one number, one place.
 */
export const FREE_TOOL_BOOKS = 5;

/**
 * How few have to be left before a screen mentions it.
 *
 * **A limit nobody has approached is not news, and saying it anyway is the
 * commonest mistake in freemium software.** "1 of 5 books used" on a first visit
 * teaches a writer that this is a metered product before they have had a single
 * thing out of it, and it is the line every reader of a pricing page has been
 * burned by. So it is silent until nearly spent, speaks once with enough room to
 * act on it, and is explicit when it is gone.
 *
 * Two rather than three, because the number is five rather than ten: warning at
 * three of five would speak on a writer's third book, which is well inside
 * ordinary use.
 *
 * Nothing is hidden by this: the number is on the pricing page and in the Help
 * dialog, where somebody deciding what to pay for goes looking.
 */
export const WARN_WHEN_LEFT = 2;

// ---------------------------------------------------------------------------
// Seats on a shared book
// ---------------------------------------------------------------------------

/**
 * How many people one book may hold, the owner included.
 *
 * **Two on free means the writer and one other**; ten on Pro means the writer
 * and nine. The number on the pricing page is the number of faces on the book,
 * which is what a reader of that page expects it to mean.
 *
 * Counted **per book**, not per account: a writer with three co-written books
 * gets the allowance on each. That is the shape the feature was asked for — some
 * books have two writers — and it is the only version of the rule that can be
 * stated in one line without a worked example.
 *
 * **The owner's plan governs the book**, not the collaborator's. Figma and Notion
 * both do it this way, and the alternative (Dabble's, where each side needs their
 * own subscription) turns every invitation into a sales pitch the owner has to
 * make on our behalf.
 */
export const SEATS_PER_BOOK = { free: 2, pro: 10 } as const;

/**
 * Anything with a free-plan number attached: the tooled books, and seats.
 *
 * **Neither is a spend, which is why there is no longer a tally in this file.**
 * `bookTools` is a *set* of books — one already on it costs nothing however much
 * work is done there — and a seat is *current occupancy*, given back when
 * somebody is removed or an invitation lapses. The old `Counted` type was a
 * monotonic count of attempts, and it went with the meters it served.
 *
 * The other difference is where each is enforced. `bookTools` is a browser gate
 * and says so; seats are checked in a Server Action holding the secret key,
 * because the member list is in Postgres and nothing a reader can edit decides
 * it.
 */
export type Limited = "bookTools" | "collaborators";

/**
 * Seats have their own words. "Used" and "left" fit a spend; a book holds
 * *people*, and the question an owner is asking is how many more will fit.
 */
const SEAT_LABELS = {
  one: "person",
  many: "people",
  short: "seats",
  shortOne: "seat",
};

/**
 * The tool allowance counts *books*, so its words are books. Anything phrased as
 * searches or checks would be the one sentence a reader could act on wrongly:
 * those are unlimited, and what runs out is manuscripts.
 */
const BOOK_LABELS = {
  one: "book",
  many: "books",
  short: "books",
  shortOne: "book",
};

function labelsFor(action: Limited) {
  return action === "collaborators" ? SEAT_LABELS : BOOK_LABELS;
}

/** The name for this many of them. */
function label(action: Limited, count: number): string {
  const names = labelsFor(action);
  return count === 1 ? names.one : names.many;
}

export interface Allowance {
  action: Limited;
  /** How many have been spent. */
  used: number;
  /** What is allowed, or null when there is no limit. */
  limit: number | null;
  /** What remains, or null when there is no limit. Never negative. */
  left: number | null;
  /** True when the next one would be one too many. */
  blocked: boolean;
}

/**
 * How much of the five is left, and whether *this* book is already inside it.
 *
 * **`onThisBook` is the whole of the "unlimited within a book" rule**, and it is
 * why this takes two arguments rather than one. A book already counted is never
 * blocked, whatever is left and however much is done there — so the allowance
 * refuses the *sixth book* and never the sixth search. Without it a writer four
 * books in would be cut off mid-sentence on a book they had already opened, and
 * the limit would be back to charging for effort.
 *
 * `books` comes out of storage, which no compiler has ever checked — a missing
 * key, a string left by an older version or a negative all mean nought here
 * rather than throwing the arithmetic off by an unknown amount.
 */
export function bookToolAllowance(
  books: number,
  onThisBook: boolean,
  pro: boolean,
): Allowance {
  const counted =
    typeof books === "number" && Number.isFinite(books) && books > 0
      ? Math.floor(books)
      : 0;

  if (pro) {
    return {
      action: "bookTools",
      used: counted,
      limit: null,
      left: null,
      blocked: false,
    };
  }

  return {
    action: "bookTools",
    used: counted,
    limit: FREE_TOOL_BOOKS,
    left: Math.max(0, FREE_TOOL_BOOKS - counted),
    blocked: !onThisBook && counted >= FREE_TOOL_BOOKS,
  };
}

/**
 * How much room is left on one book.
 *
 * Separate from `bookToolAllowance` rather than a case inside it, because the two
 * count different things and share only their shape: that one reads a list out of
 * `prefs`, this one is handed the *current* number of people on a book. Sharing
 * the `Allowance` type is what lets `LeftPill`, `LimitBanner` and `LimitNote`
 * render a seat limit with no changes at all.
 *
 * `people` includes the owner — see `seatsUsed` in `collab.ts`, which is what
 * produces it, and which also counts an unaccepted invitation as occupying a
 * seat so that a refusal cannot land on a co-writer days later.
 */
export function seatAllowance(people: number, pro: boolean): Allowance {
  const counted =
    typeof people === "number" && Number.isFinite(people) && people > 1
      ? Math.floor(people)
      : 1; // there is always an owner

  const limit = pro ? SEATS_PER_BOOK.pro : SEATS_PER_BOOK.free;
  return {
    action: "collaborators",
    used: counted,
    limit,
    left: Math.max(0, limit - counted),
    blocked: counted >= limit,
  };
}

/**
 * The one line a limited screen carries, and only when it has something to say.
 *
 * Null on Pro, null while there is plenty left, and null once there are none —
 * that last one is `spentLine`'s, and two sentences about the same limit stacked
 * on one screen is how a notice becomes wallpaper.
 *
 * **What is left, not what was spent.** "3 of 5 books used" asks the reader to do
 * the subtraction to reach the number they actually care about, and reads as a
 * tally being kept on them; "2 more books" is the same fact pointed at the
 * decision they might make. Written here rather than in the screens so the
 * sentence cannot drift into six of them.
 */
export function leftLine(allowance: Allowance): string | null {
  const { left } = allowance;
  if (left === null || left === 0 || left > WARN_WHEN_LEFT) return null;

  // Seats read the other way round. A spend is counted down, but nobody thinks
  // of a book as having spent people; the question an owner is actually asking
  // is how many more will fit. It says so only where a seat is being decided
  // (the share dialog, the Collaborators area), never on the shelf, or a free
  // writer would meet the sentence on every book they own.
  if (allowance.action === "collaborators") {
    return `Room for ${left} more ${label(allowance.action, left)} on this book.`;
  }

  // Named as what it is: the tools are unlimited, the books are not.
  return `The free plan covers ${left} more ${label(allowance.action, left)}.`;
}

/**
 * The same fact as a badge: two words, for a pill that sits on the control it
 * counts.
 *
 * The sentence version is what a screen reader is given — see `LeftPill` — so
 * this may be as terse as the eye needs without costing anybody the meaning.
 */
export function leftBadge(allowance: Allowance): string | null {
  const { left } = allowance;
  if (left === null || left === 0 || left > WARN_WHEN_LEFT) return null;
  const names = labelsFor(allowance.action);
  return `${left} ${left === 1 ? names.shortOne : names.short} left`;
}

/** The same fact once there are none. */
export function spentLine(allowance: Allowance): string | null {
  if (allowance.limit === null) return null;

  // A book is not "used up", and saying so would blame the owner for having
  // co-writers. It states the plan's number and the fact, and nothing else.
  //
  // Seats are the one limit here that Pro does not lift — it raises it, to ten —
  // so this is also the one place a *paying* writer can be told they have run
  // out. The word "free" has to go when that happens, and the caller has to know
  // not to draw the upgrade banner around it: `LimitBanner` links to /upgrade,
  // which is nothing but an insult to somebody who is already there.
  if (allowance.action === "collaborators") {
    return allowance.limit === SEATS_PER_BOOK.free
      ? `A free book holds ${allowance.limit} people, and this one is full.`
      : `This book holds ${allowance.limit} people, and it is full.`;
  }

  // It names the *other* books rather than this one, because what has run out is
  // elsewhere: nothing is wrong with the book on screen, and a line reading
  // "this book is out of searches" would be false as well as bleak.
  return `The free plan runs the tools on ${allowance.limit} books, and you are already using all ${allowance.limit}.`;
}
