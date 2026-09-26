import type { CompTitle } from "./comps";

/**
 * What comparable ebooks actually charge.
 *
 * Pricing is the one pre-publication decision a writer makes with real money
 * on it, and every guide in the trade gives the same advice: go and look at
 * what books like yours cost. Almost nobody does, because it is twenty browser
 * tabs. This is the looking.
 *
 * **It reports and does not advise.** There is no recommended price here, no
 * suggested price, no optimal price and no sweet spot — the figures are a
 * median, a spread and a list of real books, each of which the writer can go
 * and open. The tool this product is measured against answers the same
 * question with one "average price" beside an invented competition score, and
 * that is precisely the number this module exists not to print.
 *
 * **The median rather than the mean, and the reason is in the data.** A live
 * search for `thriller detective serial killer` on 2026-09-26 returned, in
 * dollars: 0.50, 4.99, 4.99, 5.99, 8.99, 11.99, 11.99, 11.99, 11.99, 11.99,
 * 14.99, 75.95, 119. The last two are reference books about criminology that a
 * keyword search cannot tell from novels. Their mean is $22; their median is
 * $11.99, and only one of those two numbers describes a thriller.
 *
 * **The distribution is usually bimodal and the screen must show that.** In
 * that same list there is an indie cluster around $5 and a trade-published
 * cluster around $12. One figure standing alone hides it, which is why
 * `prices` comes back whole and sorted rather than only summarised: the plot
 * draws every one of them.
 *
 * **Prices come from Google Books, in the US store, for ebooks.** Open Library
 * carries none. Neither catalogue carries a paperback price, so nothing here
 * says anything about print — the paperback tool is where that lives.
 */

/** One book that had a price on it. */
export interface PricedBook {
  book: CompTitle;
  amount: number;
}

/**
 * The figures, once there are enough of them to be figures.
 *
 * Every field is a count or an order statistic of prices that were really
 * returned. Nothing here is modelled, fitted or projected.
 */
export interface PriceSummary {
  /** How many paid prices the figures below are drawn from. */
  from: number;
  median: number;
  /** The cheapest and dearest paid price. */
  low: number;
  high: number;
  /** The middle half sits between these two. Nearest-rank quartiles. */
  middleLow: number;
  middleHigh: number;
}

/** Everything a price search found, summarised only if that is honest. */
export interface PriceLook {
  /** `null` when nothing carried a price, so there is no currency to name. */
  currency: string | null;
  /** How many books the search returned. The denominator. */
  of: number;
  /** How many carried a price, free ones included. */
  from: number;
  /** How many were listed at nothing. */
  free: number;
  /** Every priced book, cheapest first, free ones at the front. */
  prices: PricedBook[];
  /**
   * The figures, or `null` when too few books carried a paid price.
   *
   * Null is not an error and the screen does not render it as one: the books
   * in `prices` are still real and still worth looking at. What is withheld is
   * the claim that they describe a shelf.
   */
  summary: PriceSummary | null;
}

/**
 * The fewest paid prices worth drawing a median from.
 *
 * **Six, and it is a judgement rather than a finding** — named here so it is
 * plainly a choice, the way `MIN_BOOKS` is in `length.ts`, and so anyone who
 * disagrees can see what they are disagreeing with.
 *
 * What it is set against is measured, though. **Swept** — which is what the
 * screen does, five pages of Google, see `SWEEP_PAGES` in the route — ten
 * genre searches on 2026-09-26 returned these counts of priced books: 2, 7, 9,
 * 9, 12, 14, 16, 19, 35, 62. Six refuses exactly one of those ten and nothing
 * else, which is the shape a threshold should have.
 *
 * The one it refuses is `historical fiction world war two`, which found two
 * prices in a hundred records and would otherwise have reported a median of
 * $85.50 off a pair of academic histories. A median of $85 for historical
 * fiction is the confident wrong answer this whole product is written against,
 * so that case is the test to keep: if it ever starts reporting a figure,
 * something has gone wrong here.
 *
 * **Raising it to eight was considered and rejected**: that would refuse
 * `literary fiction family secrets` at seven prices, which is a real answer
 * drawn from real books.
 *
 * **An earlier version of this note said depth could not help, and it was
 * wrong.** That was measured on *two* pages, where the priced count barely
 * moves. At five it roughly doubles to triples, and unswept the same ten
 * queries returned 1, 4, 5, 5, 5, 7, 8, 10, 13, 13 — four of them thin. The
 * lesson is about the measurement rather than about Google: two pages was too
 * shallow to see the effect, and the conclusion drawn from it survived into a
 * comment that then argued against the fix.
 */
export const MIN_PRICES = 6;

/** One shelf the dropdown offers. */
export interface PriceShelf {
  /** What the dropdown shows. Writer-facing, capitalised. */
  label: string;
  /**
   * The genre words a typed box attaches to.
   *
   * Kept separate from `words` because they do different jobs: `words` is the
   * measured phrase that runs when the writer adds nothing, and `stem` is what
   * their own words are joined to. On a narrow shelf the two are the same.
   */
  stem: string;
  /** What runs with both boxes empty. The phrase `measured` counted. */
  words: string;
  /** Priced books out of about a hundred records, swept. See the doc below. */
  measured: number;
  /**
   * A greyed example of the *kind* of word each box takes.
   *
   * Illustrative rather than measured, and never searched unless the writer
   * types it — the measured thing is `words`. Said plainly here because
   * everything else in this module is a measurement and this is not.
   */
  setting?: string;
  event?: string;
}

/**
 * The shelves the price check offers, and the words each one searches.
 *
 * **Every `words` phrase was run against the live catalogue before it went
 * in**, which is the rule `BROWSE_SHELVES` follows in `comps.ts` and for the
 * same reason: a suggestion that leads to an empty screen teaches a writer
 * that their genre is empty, when what is wrong is our vocabulary. `measured`
 * is priced records out of about a hundred, swept, on 2026-09-26 — there to be
 * re-run rather than trusted, and quoted nowhere on screen.
 *
 * **Why a shelf sometimes carries more words than its own name.** A broad
 * genre word matches everything Google ever scanned; a narrow one matches a
 * commercial shelf. Measured alone: `cozy mystery` found 37 prices,
 * `young adult dystopian` 20, `paranormal romance` 18, `space opera` 11 — but
 * `thriller` found **4**, `contemporary romance` **3** and `literary fiction`
 * **1**. So the broad shelves carry a qualifier and the narrow ones do not,
 * and that is the whole reason this is a table rather than a list of names.
 *
 * **Three candidates were measured and refused**, which is the list doing its
 * job rather than a gap in it: `historical fiction world war two` (2 prices,
 * median $85 off academic histories), `historical fiction victorian london`
 * (3, median $54.99) and `horror supernatural small town` (1). The
 * literary-historical shelf therefore has no row — nothing found one — and a
 * writer in it types their own words and sees what they find.
 *
 * **Adding a shelf is a measurement, not a typing job.** Run the candidate
 * against `/api/comps?sweep=1&only=google`, count the records carrying a
 * price, and only then add the row.
 */
export const PRICE_SHELVES: readonly PriceShelf[] = [
  {
    label: "Cozy mystery",
    stem: "cozy mystery",
    words: "cozy mystery",
    measured: 37,
    setting: "village",
    event: "murder",
  },
  {
    label: "Thriller",
    stem: "thriller",
    // Alone this shelf found 4. The qualifier is what makes it usable.
    words: "thriller detective serial killer",
    measured: 19,
    setting: "city",
    event: "a kidnapping",
  },
  {
    label: "Contemporary romance",
    stem: "contemporary romance",
    // Alone, 3.
    words: "small town contemporary romance",
    measured: 12,
    setting: "small town",
    event: "second chances",
  },
  {
    label: "Historical romance",
    stem: "historical romance",
    words: "historical romance regency duke",
    measured: 30,
    setting: "regency London",
    event: "a forced marriage",
  },
  {
    label: "Paranormal romance",
    stem: "paranormal romance",
    words: "paranormal romance",
    measured: 18,
    setting: "a shifter pack",
    event: "fated mates",
  },
  {
    label: "Epic fantasy",
    stem: "epic fantasy",
    words: "epic fantasy",
    measured: 6,
    setting: "a kingdom",
    event: "a war",
  },
  {
    label: "Space opera",
    stem: "space opera",
    words: "space opera",
    measured: 11,
    setting: "a starship",
    event: "an empire falling",
  },
  {
    label: "Psychological suspense",
    stem: "psychological suspense",
    words: "psychological suspense",
    measured: 8,
    setting: "a marriage",
    event: "an unreliable narrator",
  },
  {
    label: "Young adult dystopian",
    stem: "young adult dystopian",
    words: "young adult dystopian",
    measured: 20,
    setting: "a walled city",
    event: "a rebellion",
  },
  {
    label: "Horror",
    stem: "horror",
    words: "horror haunted house",
    measured: 12,
    setting: "a haunted house",
    event: "a possession",
  },
  {
    label: "Literary fiction",
    stem: "literary fiction",
    // Alone, 1 — the worst measured, and the clearest case for a qualifier.
    words: "literary fiction family secrets",
    measured: 7,
    setting: "a family home",
    event: "a secret coming out",
  },
  {
    label: "Memoir",
    stem: "memoir",
    words: "memoir addiction recovery",
    measured: 8,
    setting: "a childhood",
    event: "recovery",
  },
];

/** What the form was filled in with. */
export interface PriceQueryInput {
  /** The chosen shelf, or null when the writer is typing their own genre. */
  shelf: PriceShelf | null;
  /** The writer's own genre words. Read only when `shelf` is null. */
  genre?: string;
  setting?: string;
  event?: string;
}

/**
 * The words the search will actually run.
 *
 * **What this returns is what the screen shows, and the rule is that they are
 * the same string.** The measured phrase is longer than the genre name on
 * three shelves, so applying it without showing it would mean searching for
 * words the writer never saw. The line under the form prints this and the
 * fetch sends it.
 *
 * **A typed box replaces the shelf's extra words rather than adding to them**,
 * and that is a measurement rather than a preference:
 * `epic fantasy dragon kingdom war` found 99 records, and the same phrase with
 * four more words on it found **16**. A query that grows with every field is a
 * query that eventually finds nothing, so the shape is held to the one that
 * was measured — a genre, plus at most two concrete words.
 *
 * **No `subject:` prefix, ever.** Google answers a field-prefixed query out of
 * its catalogue rather than its store: `subject:"cozy mystery"` returned 0
 * priced records of 20, every one `NOT_FOR_SALE`. That is why this exists at
 * all instead of `buildQuery` in `comps.ts`, which appends one.
 */
export function priceQuery({
  shelf,
  genre,
  setting,
  event,
}: PriceQueryInput): string {
  const extras = [setting, event]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const stem = (shelf ? shelf.stem : (genre ?? "")).trim();

  // Nothing typed: the shelf's own measured phrase, or just the writer's words.
  if (extras.length === 0) return (shelf ? shelf.words : stem).trim();

  return [stem, ...extras].filter(Boolean).join(" ").trim();
}

/**
 * The shelf to start a book's own genre on.
 *
 * **A deliberate table rather than a fuzzy match**, because the two
 * vocabularies were written for different jobs: `GENRES` in `book-kinds.ts` is
 * what a *book* may call itself, and `PRICE_SHELVES` is what finds priced
 * books. Science fiction points at Space opera, which is the part of it that
 * sells. Historical fiction and Other have no entry — for Historical fiction
 * that is a measurement, not an oversight, since no candidate phrase for it
 * found prices. An unmapped genre leaves the dropdown unset, which is honest.
 */
const SHELF_FOR_GENRE: Record<string, string> = {
  Fantasy: "Epic fantasy",
  "Science fiction": "Space opera",
  Romance: "Contemporary romance",
  Mystery: "Cozy mystery",
  Thriller: "Thriller",
  "Literary fiction": "Literary fiction",
  "Young adult": "Young adult dystopian",
  Horror: "Horror",
  Memoir: "Memoir",
};

export function shelfForGenre(genre: string | undefined): PriceShelf | null {
  if (!genre) return null;
  const label = SHELF_FOR_GENRE[genre];
  return PRICE_SHELVES.find((shelf) => shelf.label === label) ?? null;
}

/** Nearest-rank order statistic, on a list already sorted ascending. */
function rank(sorted: number[], fraction: number): number {
  const at = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[at];
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Gather the prices out of a comp search, and summarise them if there are
 * enough.
 *
 * **Free books are counted and listed but kept out of the figures.** A book at
 * 0.00 is a real catalogue record — usually a public-domain reprint or a
 * permanently-free first-in-series — and it is genuinely useful to a writer to
 * know how many of those are sitting on the shelf they are pricing into. It is
 * not useful inside a median of what books cost. So `free` is reported, the
 * books stay in `prices`, and the median is of the paid ones.
 *
 * **Mixed currencies refuse rather than average.** Pinning the store to one
 * country should make this impossible; if the day comes that it is not,
 * reporting a median of dollars and pounds together is worse than reporting
 * nothing. The first currency seen wins and anything else is dropped from the
 * figures, with `from` counting only what was kept — so the screen's "N of M"
 * stays true to what it drew.
 *
 * **Outliers are not filtered, and that is deliberate.** Deciding a book is
 * too expensive to count is deciding it is not comparable, which is a
 * judgement about somebody's genre that this module has no business making.
 * The median absorbs them and the plot shows them where they are.
 */
export function priceFacts(books: CompTitle[]): PriceLook {
  const of = books.length;

  const currency =
    books.find((b) => b.price !== undefined)?.price?.currency ?? null;

  const priced: PricedBook[] =
    currency === null
      ? []
      : books
          .filter((b) => b.price?.currency === currency)
          .map((b) => ({ book: b, amount: b.price!.amount }))
          .sort((a, b) => a.amount - b.amount);

  const free = priced.filter((p) => p.amount === 0).length;
  const paid = priced.filter((p) => p.amount > 0).map((p) => p.amount);

  const summary: PriceSummary | null =
    paid.length < MIN_PRICES
      ? null
      : {
          from: paid.length,
          median: median(paid),
          low: paid[0],
          high: paid[paid.length - 1],
          middleLow: rank(paid, 0.25),
          middleHigh: rank(paid, 0.75),
        };

  return { currency, of, from: priced.length, free, prices: priced, summary };
}

/**
 * Where to stop the price axis.
 *
 * **Called by `price-strip.tsx` alone, which is mounted by nothing since
 * 2026-09-26.** Kept and tested with it rather than deleted; the note in that
 * file says what would have to be answered to bring the chart back.
 *
 * Two failures to avoid and they pull in opposite directions, which is why
 * this is a rule rather than a constant.
 *
 * A handful of reference books at $75 or $119 would, on an axis scaled to the
 * dearest record, squeeze every real novel into the leftmost eighth and teach
 * a writer nothing. But a fixed ceiling has the mirror problem: a cozy mystery
 * shelf priced between $2.99 and $5.99 — which is most of them — drawn on a
 * fixed $20 axis sits in the left third with two-thirds of the plot empty.
 * Both were seen on real searches before this was written this way.
 *
 * **So the data decides, and only a genuine outlier is held back.** If the
 * dearest book is within twice the top of the middle half, everything fits and
 * the axis simply covers it. If it is not, the axis stops at that twice-the-
 * middle-half mark, and the books past it are drawn on the edge and **counted
 * in a line of type** — never dropped, and never allowed to flatten the rest.
 *
 * Rounded up to the next five dollars either way, so the ticks land on round
 * numbers rather than on somebody's price.
 */
export function axisCeiling(summary: PriceSummary): number {
  const roomFor = summary.middleHigh * 2;
  const top = summary.high <= roomFor ? summary.high : roomFor;
  return Math.max(5, Math.ceil(top / 5) * 5);
}

/** How many priced books sit above the axis ceiling. Same standing as
    `axisCeiling` above: the chart is its only caller. */
export function aboveCeiling(prices: PricedBook[], ceiling: number): number {
  return prices.filter((p) => p.amount > ceiling).length;
}
