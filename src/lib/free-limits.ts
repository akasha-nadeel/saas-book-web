/**
 * What the free plan counts, and how much of it is left.
 *
 * **Four actions, ten each, and one table so they cannot drift.** Everything
 * else in the free tier is unbounded — books, words, chapters, all four
 * exports, sync, the check and the roadmap, the blurb and category screens —
 * because writing a book and getting it out is the wedge this product is built
 * on. What is counted here is the *other* half of the job: bringing in a shelf
 * of finished manuscripts, and asking the catalogues the same question over and
 * over while a listing is put together. Both are things somebody with a
 * business does, and neither is how a first draft gets written.
 *
 * The four:
 *
 * - **imports** — a manuscript brought in from a file. Counted at the store's
 *   two funnels, so a file that lands in a book the writer made a moment ago
 *   counts like one that makes its own book; "new book, then import into it"
 *   would otherwise be one click round it.
 * - **comps** — a comp-title search the writer asked for.
 * - **covers** — a search of the cover shelf.
 * - **titleChecks** — a title checked against the catalogues.
 *
 * **A search the app ran is never counted, only one the writer asked for.**
 * Two of these screens open by searching for the book already on screen — its
 * genre's shelf, its own title — and charging for arriving would spend the ten
 * on ten page loads, which is a limit on *visiting* rather than on searching.
 * So the seed is free, every press is counted, and the screens say so.
 *
 * The tallies live in `prefs.usage` and travel with the rest of the prefs blob,
 * so a second machine does not hand out ten more. These are **browser gates**,
 * like the prose report and the money screens: the counted work happens in the
 * browser or through a route that is deliberately free and keyless, and no
 * server check is possible without taking that away. What they are for is
 * telling a writer the truth about the plan they are on.
 *
 * With no payment gateway configured the subscription route answers `pro: true`
 * for everyone, so a self-hosted copy has no limits at all — the same shape as
 * every other gate here.
 *
 * **Seats are the one number here that is not one of those four**, and they are
 * kept apart from them for a reason — see `SEATS_PER_BOOK` below. They live in
 * this file anyway because the rule about plan numbers is one number in one
 * place, and the pricing page reads them all from here.
 */

/** The actions the free plan puts a number on. */
export type Counted = "imports" | "comps" | "covers" | "titleChecks";

/** Every one of them, for anything that has to walk the list. */
export const COUNTED: readonly Counted[] = [
  "imports",
  "comps",
  "covers",
  "titleChecks",
];

/**
 * Ten of each. Quoted by the pricing page rather than restated there, the same
 * rule the prices follow: one number, one place.
 */
export const FREE_LIMITS: Record<Counted, number> = {
  imports: 10,
  comps: 10,
  covers: 10,
  titleChecks: 10,
};

/**
 * What each one is called on screen, in both numbers.
 *
 * Lower case, and *a thing the writer does* rather than a feature name — "3
 * comp searches left" reads as a count of their own work, where "3 of 10 Comp
 * Titles" reads as a meter bolted to a product. The singular is here because
 * the line that matters most is the one that says **one**.
 *
 * `shortOne` earns its place for the same reason: the badge is the line that
 * most often says *one*, and without a singular short form it read "1 searches
 * left".
 */
export const COUNTED_LABELS: Record<
  Counted,
  { one: string; many: string; short: string; shortOne: string }
> = {
  imports: { one: "import", many: "imports", short: "imports", shortOne: "import" },
  comps: { one: "comp search", many: "comp searches", short: "searches", shortOne: "search" },
  covers: { one: "cover search", many: "cover searches", short: "searches", shortOne: "search" },
  titleChecks: { one: "title check", many: "title checks", short: "checks", shortOne: "check" },
};

/**
 * How few have to be left before the screen mentions it.
 *
 * **A limit nobody has approached is not news, and saying it anyway is the
 * commonest mistake in freemium software.** "0 of 10 used" on a first visit
 * teaches a writer that this is a metered product before they have had a single
 * thing out of it, and it is the line every reader of a pricing page has been
 * burned by. So the count is silent until it is nearly spent, speaks once with
 * enough room to act on it, and is explicit when it is gone. Three warnings,
 * roughly the last quarter, which is where the rest of the trade puts it.
 *
 * Nothing is hidden by this: the four numbers are on the pricing page and in
 * the Help dialog, where somebody deciding what to pay for goes looking.
 */
export const WARN_WHEN_LEFT = 3;

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
 * Anything with a free-plan number attached, which is the four counted actions
 * plus seats.
 *
 * **Seats are not `Counted` and must never join it.** `Counted` is the monotonic
 * tally in `prefs.usage` — a spend, gone once spent. A seat is *current
 * occupancy*: removing somebody gives it back, and letting an invitation lapse
 * gives it back. Putting seats in that tally would mean a book could be shared
 * with two people over its life rather than by two people at a time, which is
 * not the same rule and not the one on the pricing page.
 *
 * The other difference is where it is enforced. The four are browser gates and
 * say so; seats are checked in a Server Action holding the secret key, because
 * the member list is in Postgres and nothing a reader can edit decides it.
 */
export type Limited = Counted | "collaborators";

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

function labelsFor(action: Limited) {
  return action === "collaborators" ? SEAT_LABELS : COUNTED_LABELS[action];
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
 * `used` comes out of storage, which no compiler has ever checked — a missing
 * key, a string left by an older version or a negative all mean nought here
 * rather than throwing the arithmetic off by an unknown amount.
 */
export function allowanceOf(
  action: Counted,
  used: number,
  pro: boolean,
): Allowance {
  const counted =
    typeof used === "number" && Number.isFinite(used) && used > 0
      ? Math.floor(used)
      : 0;

  if (pro) {
    return { action, used: counted, limit: null, left: null, blocked: false };
  }

  const limit = FREE_LIMITS[action];
  return {
    action,
    used: counted,
    limit,
    left: Math.max(0, limit - counted),
    blocked: counted >= limit,
  };
}

/**
 * The one line a counted screen carries, and only when it has something to say.
 *
 * Null on Pro, null while there is plenty left, and null once there are none —
 * that last one is `spentLine`'s, and two sentences about the same limit
 * stacked on one screen is how a notice becomes wallpaper.
 *
 * **What is left, not what was spent.** "7 of 10 used" asks the reader to do
 * the subtraction to find the number they actually care about, and reads as a
 * tally being kept on them; "3 comp searches left" is the same fact pointed at
 * the decision they might make. Written here rather than in the six screens so
 * the sentence cannot drift into six.
 */
export function leftLine(allowance: Allowance): string | null {
  const { left } = allowance;
  if (left === null || left === 0 || left > WARN_WHEN_LEFT) return null;

  // Seats read the other way round. A spend is counted down — "3 comp searches
  // left" — but nobody thinks of a book as having spent people; the question an
  // owner is actually asking is how many more will fit. It says so only where a
  // seat is being decided (the share dialog, the Collaborators area), never on
  // the shelf, or a free writer would meet the sentence on every book they own.
  if (allowance.action === "collaborators") {
    return `Room for ${left} more ${label(allowance.action, left)} on this book.`;
  }

  return `${left} free ${label(allowance.action, left)} left.`;
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

  return `All ${allowance.limit} free ${
    labelsFor(allowance.action).many
  } are used.`;
}

/**
 * How much room is left on one book.
 *
 * Separate from `allowanceOf` rather than a case inside it, because the two count
 * different things and share only their shape: that one reads a monotonic tally
 * out of `prefs.usage`, this one is handed the *current* number of people on a
 * book. Sharing the `Allowance` type is what lets `LeftPill`, `LimitBanner` and
 * `LimitNote` render a seat limit with no changes at all.
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
