/**
 * What the free plan limits, and how much of it is left.
 *
 * **Each tool is metered in the unit its own work comes in.** There is no single
 * global number here, and there was: the version before this gave the free plan
 * "every tool, unlimited, on five books". That is a *container* limit, and it
 * cannot hold a container whose contents are arbitrary — the comps box and the
 * title-check box take any words a writer types, so one book slot was a
 * general-purpose research desk for any number of manuscripts. A container limit
 * only ever bound the tools that read the manuscript.
 *
 * So there are three shapes, and which one a tool takes follows from what it
 * does:
 *
 * - **Per day** — the three that send a query to a catalogue. This is what every
 *   serious research tool does (Semrush's free plan is ten queries a day,
 *   Ahrefs the same shape) and the reason is the same here: a search box takes
 *   arbitrary input, so the honest unit is the query. **They come back
 *   tomorrow**, which is the half that matters — a writer stopped mid-session
 *   returns rather than churning, and no writer is ever permanently walled out
 *   of a book they own.
 * - **Per book** — the tools that read one manuscript and produce something
 *   attached to it. Counting books charges for *scale*, which is the honest
 *   description of who ought to be paying: somebody with a backlist and several
 *   listings to build is running a business.
 * - **Per book, by occupancy** — advance readers and collaborator seats. Both
 *   count what is *currently* there, so removing one gives the place back.
 * - **Held, by occupancy across the library** — parked ideas (2026-09-16).
 *   The same arithmetic as advance readers, but an idea belongs to the writer
 *   rather than to a book, so its sentences cannot say "on this book".
 *   Forgetting one, or starting a book from one, makes room.
 * - **Part of a feature** — since 2026-09-15, two screens give Free one half
 *   and Pro the other: the writing record's window (`FREE_RECORD_DAYS`) and six
 *   of the eleven consistency checks (`FREE_CHECKS` in `consistency-ids.ts`).
 *   Nothing a writer typed is ever hidden by these; the log goes on recording,
 *   so upgrading unlocks what already exists. (The story bible's series view
 *   was a third for a day, until the bible itself went back behind the gate.)
 *
 * Everything else stays unbounded on both plans: words, chapters, **imports**,
 * every export format, sync, the pre-upload check and the roadmap, structure,
 * progress and typing in the keyword boxes yourself. Paperback setup is not a
 * limit at all since 2026-09-16 — it is a Pro screen behind `ProGate`.
 *
 * **There was a fourth shape — "in total, for the life of the account" — and
 * it went with the AI on 2026-09-14.** It existed for work that cost a model
 * call every press (keyword suggestions, the blurb and keyword conversations);
 * with no model calls left there is nothing that needs a wall that never comes
 * back.
 *
 * **These are browser gates and cannot be otherwise.** The work they guard runs
 * in the browser or through a route that is deliberately free and keyless, so no
 * server check is possible without taking that away. It follows that the daily
 * ones are resettable by anybody willing to move their machine's clock — worth
 * writing down rather than leaving to be discovered, and worth accepting: none
 * of this work costs anything to run, and the one limit that does bind — the
 * book count — is a Postgres trigger. What this file is for is telling a writer
 * the truth about the plan they are on.
 *
 * With no payment gateway configured the subscription route answers `pro: true`
 * for everyone, so a self-hosted copy has no limits at all — the same shape as
 * every other gate here.
 */

/** The four that ask a catalogue something, counted per day. */
export type DailyLimit = "comps" | "covers" | "titleCheck" | "priceCheck";

/** The ones that work on one manuscript, counted in distinct books. */
export type BookLimit = "blurb" | "prose" | "track";

/**
 * Counted by what is there right now, like seats: advance readers on one book,
 * parked ideas across the library.
 */
export type ItemLimit = "arcReaders" | "ideas";

export type Limited =
  | DailyLimit
  | BookLimit
  | ItemLimit
  | "collaborators";

/**
 * Every free-plan number, in one table.
 *
 * `pro: null` means no ceiling at all. Seats are the one row where Pro *raises*
 * the number rather than removing it, which is why the type allows a number
 * there — printing "Unlimited" for seats would be the one false cell on the
 * pricing page.
 *
 * Quoted by the pricing page, the Help dialog and the terms rather than restated
 * in any of them: the same rule the prices follow, one number in one place.
 */
export const FREE_LIMITS: Record<Limited, { free: number; pro: number | null }> = {
  /*
   * **Three each, raised from two on 2026-09-02**, when these two screens
   * came back out from behind the launch gate and became the first tools a
   * writer meets that are not the editor.
   *
   * The number follows the cost, which here is nothing: both run on two
   * keyless catalogues behind a day-long shared cache, so a free writer
   * spending their three costs us no more than a writer spending none. What
   * the ceiling is actually for is the shape of the thing — a daily pause
   * that says the tool is real and there is more of it — and two was one
   * search short of that: the seeded search runs on arrival, so a writer who
   * then edited the query and ran it once had spent the day.
   *
   * Three is one arrival, one correction and one second thought. Pro is
   * `null`, which is no ceiling at all rather than a larger one.
   */
  comps: { free: 3, pro: null },
  covers: { free: 3, pro: null },
  /*
   * **Three, set by the owner on 2026-09-16**, back in line with the two
   * above. It is one of the things Pro buys, so its free allowance is a
   * pricing decision rather than a cost — the same keyless catalogues, the
   * same free cache. It was two, then one (2026-09-14); one turned out to be a
   * check with no room for a second thought, and three is one arrival, one
   * correction and one second thought, as above. The pricing page says so
   * because `plan-rows.ts` and `plan-highlights.ts` read this number.
   * `workOne` stays, so a daily limit of one would still read in the singular.
   */
  titleCheck: { free: 3, pro: null },
  /*
   * **Three, matching the title check**, because it is the same shape of work:
   * a keyless catalogue search on a free cache, metered as a pricing decision
   * rather than because it costs anything to run. The two tools sit in the
   * same group and a writer moving between them should not have to learn two
   * different allowances.
   *
   * Worth knowing when this number is next argued about: roughly four searches
   * in ten come back with too few prices to summarise — measured across ten
   * genre queries on 2026-09-26, see `MIN_PRICES` in `comps/price-check.ts`.
   * A search that reports nothing still spends one, because it really did ask
   * both catalogues; but that is the reason three is not obviously generous.
   */
  priceCheck: { free: 3, pro: null },
  blurb: { free: 5, pro: null },
  prose: { free: 6, pro: null },
  track: { free: 2, pro: null },
  arcReaders: { free: 10, pro: null },
  /*
   * **Five parked at a time, set by the owner on 2026-09-16.** Occupancy, not a
   * spend: it is handed the length of the list, so forgetting an idea or
   * starting a book from one makes room. A writer already holding more keeps
   * every one of them and simply cannot park another — nothing typed is hidden.
   * Ideas live in this browser and do not sync, so each browser counts its
   * own five — a browser gate in the plainest sense, like every other here.
   */
  ideas: { free: 5, pro: null },
  collaborators: { free: 2, pro: 10 },
};

/**
 * How many days of the writing record a free copy covers, today included.
 *
 * **Thirty, set 2026-09-15**, and a window rather than a count: the day log
 * records every day for everybody, and this cuts the free *copy* to the last
 * thirty. A novel takes months, so a writer who actually has to answer an
 * accusation wants the whole trail, which is what Pro reads. Thirty days still
 * shows a writer the record exists and what it is worth. Reedsy Studio draws
 * its free history at the same line.
 *
 * Read by the writing record screen and the pricing rows; stated nowhere else.
 */
export const FREE_RECORD_DAYS = 30;

/**
 * Seats, under the name the rest of the app already calls them by.
 *
 * **Two on free means the writer and one other**; ten on Pro means the writer and
 * nine. The number on the pricing page is the number of faces on the book, which
 * is what a reader of that page expects it to mean.
 *
 * Counted **per book**, not per account, and **the owner's plan governs the
 * book** — Figma and Notion both do it this way, and the alternative (Dabble's,
 * where each side needs their own subscription) turns every invitation into a
 * sales pitch the owner has to make on our behalf.
 */
export const SEATS_PER_BOOK = {
  free: FREE_LIMITS.collaborators.free,
  pro: FREE_LIMITS.collaborators.pro as number,
} as const;

/**
 * How few have to be left before a screen mentions it.
 *
 * **A limit nobody has approached is not news, and saying it anyway is the
 * commonest mistake in freemium software.** "0 of 5 used" on a first visit
 * teaches a writer that this is a metered product before they have had a single
 * thing out of it, and it is the line every reader of a pricing page has been
 * burned by. So a limit is silent until nearly spent, speaks once with enough
 * room to act on it, and is explicit when it is gone.
 */
export const WARN_WHEN_LEFT = 2;

/**
 * The same rule, capped so a small limit cannot announce itself on arrival.
 *
 * Three of these limits are 2 or 3. At a flat `WARN_WHEN_LEFT` of two, a writer
 * who has used *nothing* would be told they have two left — a meter in front of
 * somebody who has not started, which is the exact failure the constant above
 * exists to prevent. Capping at `limit - 1` means the first thing anybody hears
 * about a limit is always after they have used it at least once.
 */
export function warnAt(limit: number): number {
  return Math.min(WARN_WHEN_LEFT, Math.max(0, limit - 1));
}

/**
 * Today, as the daily counters key themselves on.
 *
 * Built from the local parts and **never `toISOString`**, which is UTC: a writer
 * in Colombo searching at nine in the evening would otherwise have their
 * allowance turn over mid-evening, and one in Los Angeles would get a second
 * helping before lunch. `arc.ts`'s own date helpers document the same trap.
 *
 * `at` is a parameter so tests can ask about a particular day without touching
 * the clock.
 */
export function localDay(at: number = Date.now()): string {
  const d = new Date(at);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** What a day's counters look like in `prefs`. */
export interface DailyUse {
  /** The local day these counts belong to. `""` on a library that has none. */
  day: string;
  counts: Partial<Record<DailyLimit, number>>;
}

export interface Allowance {
  action: Limited;
  /** How many have been used. */
  used: number;
  /** What is allowed, or null when there is no limit. */
  limit: number | null;
  /** What remains, or null when there is no limit. Never negative. */
  left: number | null;
  /** True when the next one would be one too many. */
  blocked: boolean;
}

/**
 * The arithmetic, once.
 *
 * Every shape below is a way of *arriving at a number used*; what happens after
 * that is identical, so it lives here rather than in four near-copies that could
 * drift. `exempt` is how the book shape says "this one is already counted".
 */
function make(
  action: Limited,
  used: number,
  pro: boolean,
  exempt = false,
): Allowance {
  const ceiling = pro ? FREE_LIMITS[action].pro : FREE_LIMITS[action].free;

  if (ceiling === null) {
    return { action, used, limit: null, left: null, blocked: false };
  }

  return {
    action,
    used,
    limit: ceiling,
    left: Math.max(0, ceiling - used),
    blocked: !exempt && used >= ceiling,
  };
}

/**
 * Anything storage may hold, as a count.
 *
 * A missing key, a string left by an older version, a negative or a fraction all
 * mean nought or the floor here rather than throwing the arithmetic off by an
 * unknown amount. No compiler has ever checked what is in `localStorage`.
 */
function whole(value: unknown, floor = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value > floor
    ? Math.floor(value)
    : floor;
}

/**
 * How much of today's allowance is left.
 *
 * **The reset lives here**, and that is deliberate: a stored record carrying
 * yesterday's date reads as nought without anybody having to remember to clear
 * it. Putting it in the parser instead would have been wrong twice over —
 * `getPrefs` caches on the raw string, so a value derived from the clock there
 * goes stale the moment midnight passes with nothing to invalidate it, and a
 * reset that only happens on a *read* would depend on somebody having opened the
 * app.
 *
 * `day` is a parameter so a test can ask about a particular day without faking
 * the clock.
 */
export function dailyAllowance(
  action: DailyLimit,
  record: DailyUse | undefined,
  pro: boolean,
  day: string = localDay(),
): Allowance {
  const fresh = !record || record.day !== day;
  return make(action, fresh ? 0 : whole(record.counts?.[action]), pro);
}

/**
 * How many more books this tool may be used on, and whether this is one of them.
 *
 * **`onThisBook` is the whole of the "unlimited within a book" rule**, and it is
 * why this takes two arguments rather than one. A book already counted is never
 * blocked, whatever is left and however much work happens there — so the wall
 * lands on the *next* book and never in the middle of the one being written.
 * Without it the limit would be back to charging for effort.
 */
export function bookAllowance(
  action: BookLimit,
  books: number,
  onThisBook: boolean,
  pro: boolean,
): Allowance {
  return make(action, whole(books), pro, onThisBook);
}

/**
 * How much room is left on one book, by what is on it now.
 *
 * Sibling of `seatAllowance`, and the same argument: it is handed the *current*
 * count rather than reading a tally, so taking an advance reader off the list
 * gives the place back. A spend cannot do that, which is why neither of these
 * is one.
 */
export function itemAllowance(
  action: ItemLimit,
  items: number,
  pro: boolean,
): Allowance {
  return make(action, whole(items), pro);
}

/**
 * How many more people will fit on one book.
 *
 * `people` includes the owner — see `seatsUsed` in `collab.ts`, which is what
 * produces it, and which also counts an unaccepted invitation as occupying a
 * seat so that a refusal cannot land on a co-writer days later.
 */
export function seatAllowance(people: number, pro: boolean): Allowance {
  // There is always an owner, so this floors at one rather than nought.
  return make("collaborators", whole(people, 1), pro);
}

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

/**
 * `item` is occupancy on one book (advance readers); `held` is occupancy across
 * the whole library (parked ideas), which is why it has its own sentences — an
 * idea is not on any book.
 */
type Shape = "daily" | "book" | "item" | "held" | "seat";

/**
 * Whether this limit comes back tomorrow.
 *
 * **Read by `LimitBanner` to decide when it may appear**, which is the one
 * place the shape changes what a writer sees rather than only how it is
 * worded. A daily allowance spent is not a refusal — the writer had three and
 * used three, which is the plan working; the standing purple block belongs to
 * the shapes that do not reset, where being full is a fact about the account
 * rather than about today.
 *
 * Over `SHAPE` rather than a second list, so a new limit cannot be daily in
 * the words and not-daily in the banner.
 */
export function resetsDaily(action: Limited): boolean {
  return SHAPE[action] === "daily";
}

const SHAPE: Record<Limited, Shape> = {
  comps: "daily",
  covers: "daily",
  titleCheck: "daily",
  priceCheck: "daily",
  blurb: "book",
  prose: "book",
  track: "book",
  arcReaders: "item",
  ideas: "held",
  collaborators: "seat",
};

/**
 * What each limit is called on screen.
 *
 * `one`/`many` are what is being counted; `short`/`shortOne` are the terser pair
 * the badge uses, because a pill has room for two words and the sentence version
 * is what a screen reader is given anyway. `work` names the *tool*, and the book
 * shape cannot do without it: blurb (5) and the prose report (6) would otherwise
 * both say "1 more book" and mean two different things.
 *
 * Lower case, and *a thing the writer does* rather than a feature name — "2
 * searches left today" reads as a count of their own work, where "2 of 3 Cover
 * Searches" reads as a meter bolted to a product.
 *
 * `workOne` is `work` for a daily limit of exactly one, which the title check
 * is: "runs 1 title checks a day" is the sentence it exists to prevent. Only the
 * daily shape carries it, because only a daily sentence puts the limit in front
 * of `work`.
 */
const WORDS: Record<
  Limited,
  {
    one: string;
    many: string;
    short: string;
    shortOne: string;
    work: string;
    workOne?: string;
  }
> = {
  comps: { one: "search", many: "searches", short: "searches", shortOne: "search", work: "comp searches", workOne: "comp search" },
  covers: { one: "search", many: "searches", short: "searches", shortOne: "search", work: "cover searches", workOne: "cover search" },
  titleCheck: { one: "check", many: "checks", short: "checks", shortOne: "check", work: "title checks", workOne: "title check" },
  priceCheck: { one: "check", many: "checks", short: "checks", shortOne: "check", work: "price checks", workOne: "price check" },
  blurb: { one: "book", many: "books", short: "books", shortOne: "book", work: "the blurb" },
  prose: { one: "book", many: "books", short: "books", shortOne: "book", work: "the prose report" },
  track: { one: "book", many: "books", short: "books", shortOne: "book", work: "money tracking" },
  arcReaders: { one: "reader", many: "readers", short: "readers", shortOne: "reader", work: "advance readers" },
  ideas: { one: "idea", many: "ideas", short: "ideas", shortOne: "idea", work: "parked ideas" },
  collaborators: { one: "person", many: "people", short: "seats", shortOne: "seat", work: "people" },
};

/** The name for this many of them. */
function label(action: Limited, count: number): string {
  const names = WORDS[action];
  return count === 1 ? names.one : names.many;
}

/** The tool's work, agreeing with a daily limit of this size. */
function workFor(action: Limited, limit: number): string {
  const names = WORDS[action];
  return limit === 1 ? (names.workOne ?? names.work) : names.work;
}

/**
 * The one line a limited screen carries, and only when it has something to say.
 *
 * Null on Pro, null while there is plenty left, and null once there are none —
 * that last one is `spentLine`'s, and two sentences about the same limit stacked
 * on one screen is how a notice becomes wallpaper.
 *
 * **What is left, not what was spent.** "3 of 5 used" asks the reader to do the
 * subtraction to reach the number they actually care about, and reads as a tally
 * being kept on them. Written here rather than in the screens so the sentence
 * cannot drift into six of them.
 */
export function leftLine(allowance: Allowance): string | null {
  const { action, left, limit } = allowance;
  if (left === null || limit === null || left === 0) return null;
  if (left > warnAt(limit)) return null;

  const words = WORDS[action];

  switch (SHAPE[action]) {
    case "daily":
      // "today" is load-bearing in every daily sentence: without it a pause
      // reads as a wall, and this is the only kind of limit here that comes back.
      return `${left} more ${label(action, left)} today on the free plan.`;
    case "book":
      return `The free plan covers ${words.work} on ${left} more ${label(action, left)}.`;
    case "held":
      // Across the library, so "on this book" would be false.
      return `Room for ${left} more ${label(action, left)} on the free plan.`;
    default:
      // Occupancy reads the other way round. Nobody thinks of a book as having
      // spent people or readers; the question being asked is how many more fit.
      return `Room for ${left} more ${label(action, left)} on this book.`;
  }
}

/**
 * The same fact as a badge: two or three words, for a pill on the control it
 * counts.
 *
 * The sentence version is what a screen reader is given — see `LeftPill` — so
 * this may be as terse as the eye needs without costing anybody the meaning.
 */
export function leftBadge(allowance: Allowance): string | null {
  const { action, left, limit } = allowance;
  if (left === null || limit === null || left === 0) return null;
  if (left > warnAt(limit)) return null;

  const words = WORDS[action];
  const noun = left === 1 ? words.shortOne : words.short;
  // Only the daily shape says when it comes back, because only the daily shape
  // does. A test asserts both halves of that.
  return SHAPE[action] === "daily"
    ? `${left} ${noun} left today`
    : `${left} ${noun} left`;
}

/** The same fact once there are none. */
export function spentLine(allowance: Allowance): string | null {
  const { action, limit } = allowance;
  if (limit === null) return null;

  const words = WORDS[action];

  switch (SHAPE[action]) {
    case "daily":
      // **It says that it comes back**, which no other limit in this app has
      // ever had to. A sentence that stopped at "today's are used" would read as
      // the end of the road on a screen a writer could simply revisit tomorrow.
      return `The free plan runs ${limit} ${workFor(action, limit)} a day, and today's ${limit === 1 ? "is" : "are"} used. It starts again tomorrow.`;
    case "book":
      // It names the *other* books rather than this one: nothing is wrong with
      // the book on screen, and "this book is out of searches" would be false as
      // well as bleak.
      return `The free plan covers ${words.work} on ${limit} books, and you are already using all ${limit}.`;
    case "item":
      return `A free book holds ${limit} ${words.many}, and this list is full.`;
    case "held":
      // **It says how to make room**, the way a daily line says it comes back:
      // occupancy is the one other shape that returns, and it returns on the
      // writer's own press rather than on a date.
      return `The free plan holds ${limit} ${words.work} at a time, and all ${limit} are taken. Forget one, or start a book from one, to make room.`;
    default:
      // A book is not "used up", and saying so would blame the owner for having
      // co-writers. Seats are also the one limit Pro raises rather than lifts, so
      // this is the one place a *paying* writer can be told they have run out —
      // the word "free" has to go when that happens, and `LimitBanner` must not
      // draw an upgrade block around it.
      return limit === SEATS_PER_BOOK.free
        ? `A free book holds ${limit} people, and this one is full.`
        : `This book holds ${limit} people, and it is full.`;
  }
}

/**
 * The headline on the dialog, naming the wall that was actually hit.
 *
 * Several limits of four shapes is more than a reader can hold in their head, so
 * this must be specific: "you have reached a limit" would leave somebody
 * guessing which of them, on a screen that just refused them.
 */
export function reachedHeadline(action: Limited): string {
  const limit = FREE_LIMITS[action].free;
  const words = WORDS[action];

  switch (SHAPE[action]) {
    case "daily":
      return `The free plan runs ${limit} ${workFor(action, limit)} a day`;
    case "book":
      return `The free plan covers ${words.work} on ${limit} books`;
    case "item":
      return `A free book holds ${limit} ${words.many}`;
    case "held":
      return `The free plan holds ${limit} ${words.work} at a time`;
    default:
      return `A free book holds ${limit} people`;
  }
}
