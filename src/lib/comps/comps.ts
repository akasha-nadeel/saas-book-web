/**
 * Comparable titles — the published books a writer's own book sits beside.
 *
 * Every listing form and every query letter asks for these, and writers
 * overwhelmingly guess, because the only way to answer honestly is to go and
 * read a shelf. This module is the reading.
 *
 * **Two sources, both free and neither needing a key.** Google Books has the
 * blurbs and the page counts; Open Library has the subjects and a cover for
 * almost everything. Asking both and merging beats asking either, because the
 * gaps are in different places — Google frequently returns a book with no
 * description, and Open Library frequently returns one with no page count.
 *
 * Everything here is pure: queries in, parsed records out. The fetching lives
 * in the route, so this can be tested without a network and so a change to the
 * shape either service returns fails a test rather than a page.
 *
 * **What this deliberately does not do is judge.** A keyword search returns
 * forty books of which perhaps five are genuinely comparable, and picking those
 * five is a fuzzy judgement rather than a query. That is the one place a model
 * earns its cost, and it lives in `rank.ts` reading what this produces —
 * a separate module behind a separate button behind a separate route. Nothing
 * here calls one, so everything in this file works, for free, with the model
 * switched off.
 */

// Not a runtime cycle: subjects.ts imports only the *type* from here, and a
// type import is erased at compile time.
import { rankSubjects } from "./subjects";

/** One published book, normalised across the two services. */
export interface CompTitle {
  /** Stable within a result set. ISBN-13 when we have one, else source + id. */
  key: string;
  title: string;
  authors: string[];
  /** Four-digit year, when the source gave a parseable date. */
  year?: number;
  publisher?: string;
  /** The published blurb. What the blurb tool learns from. */
  description?: string;
  pageCount?: number;
  /** Subjects or categories, as the source files it. */
  subjects: string[];
  isbn13?: string;
  /** A cover to show. Both services hand these over as plain URLs. */
  coverUrl?: string;
  source: "google" | "openlibrary";
  /** Where a reader can go and look at it themselves. */
  infoUrl?: string;
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What we know about the writer's book, as far as a search can use it.
 *
 * Deliberately not the `Book` type: this module has no business importing the
 * store, and a search only ever needs these four things.
 */
export interface CompSeed {
  title?: string;
  genre?: string;
  /** The writer's own blurb, when they have written one. */
  blurb?: string;
  /** Extra words the writer typed into the search box. */
  extra?: string;
}

/**
 * Words too common to narrow anything, plus the ones every blurb contains.
 *
 * **There is no stemmer behind this, so the inflections have to be listed.**
 * The first version held `can`, `not`, `will`, `would` and `must` but not
 * `cannot`; `be` and `been` but not `being`. Measured over four blurbs,
 * "cannot" came out as one of the six most distinctive words in *all four* —
 * it is six letters long, it is in almost every blurb ever written, and
 * nothing here was stopping it. The second and third groups below are the
 * auxiliaries and the colourless verbs that were walking through with it.
 */
const STOP = new Set([
  // Articles, pronouns, prepositions, conjunctions.
  "the","a","an","and","or","but","of","in","on","at","to","for","with","from",
  "by","as","is","are","was","were","be","been","it","its","this","that","these",
  "those","he","she","they","her","his","their","them","when","where","what",
  "who","how","why","all","one","two","new","book","novel","story","stories",
  "first","after","before","into","out","up","down","over","about","against",
  "than","then","there","here","not","no","yes","can","will","would","must",
  "you","your","him","our","ours","hers","which","whose","whom","itself",
  "himself","herself","themselves","other","others","another","both","each",
  "such","some","any","every","only","just","still","even","more","most",
  "much","many","never","always","own","very","too","back","away","off",
  "onto","upon","under","through","again","without","within","around",
  "between","because","since","while","until","though","although","whether",
  // Auxiliaries and modals, including the compounds the first list missed.
  "cannot","could","should","might","may","shall","being","having","has",
  "had","have","does","did","done","doing",
  // Verbs that carry no subject: every book has somebody coming and going.
  "come","comes","coming","came","goes","going","went","gone","get","gets",
  "getting","got","make","makes","making","made","take","takes","taking",
  "took","hold","holds","holding","held","carry","carries","carrying",
  "carried","call","calls","calling","called","say","says","said","tell",
  "tells","told","know","knows","knew","find","finds","finding","found",
  "leave","leaves","leaving","give","gives","giving","gave",
]);

/**
 * The most distinctive words in a piece of prose, in the order they were
 * written.
 *
 * A blurb is the best short description of a book that exists, so it is the
 * best thing to search with — but handed over whole it matches nothing, because
 * these services search titles and subjects rather than doing anything
 * semantic. So it is reduced to the words that carry meaning.
 *
 * **This used to rank by word length, on the reasoning that "the long words are
 * the nouns that name what the book is about". Measured, that is false**, and
 * it was doing real damage: this seed runs by itself when the comps and covers
 * screens open, so its results are the first thing a writer sees on both, and
 * what it produced was
 *
 *     ["inherits","coming","cannot","ledger","father","called"]
 *
 * — a query that returns nothing. Length selects *for* Latinate function words
 * (`cannot`, `because`, `carrying`) and *against* exactly the short concrete
 * nouns a book is usually about: `salt`, `tide`, `war`, `spy`, `dog`. Two
 * changes follow from that. The sort is gone, leaving the writer's own order,
 * which front-loads the subject because that is how anybody writes a first
 * sentence. And the length floor drops to three, because `spy` and `war` are
 * the whole subject of the books they appear in; the words that floor was
 * really aimed at are in `STOP`, which is where they belong.
 */
export function keywords(text: string, limit = 6): string[] {
  const seen = new Set<string>();
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .filter((w) => {
      if (seen.has(w)) return false;
      seen.add(w);
      return true;
    })
    .slice(0, limit);
}

/**
 * The search string, from whatever the writer has given us.
 *
 * The genre goes in as a `subject:` term because both services index subjects,
 * and a bare genre word otherwise matches every book with it in the title. The
 * writer's own title is never searched for — comps are books *like* yours, and
 * searching your title finds yours (or worse, somebody else's with the same
 * name, which is a different feature).
 */
export function buildQuery(seed: CompSeed): string {
  const parts: string[] = [];
  if (seed.extra?.trim()) parts.push(seed.extra.trim());
  if (seed.blurb?.trim()) parts.push(...keywords(seed.blurb, 5));
  if (seed.genre && seed.genre !== "Other") {
    parts.push(`subject:"${seed.genre}"`);
  }
  return parts.join(" ").trim();
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

/** A year out of the many date shapes these two return. */
export function yearOf(date: unknown): number | undefined {
  if (typeof date !== "string") return undefined;
  const match = date.match(/\d{4}/);
  if (!match) return undefined;
  const year = Number(match[0]);
  // Gutenberg-era records and obvious typos both land outside this.
  return year >= 1400 && year <= 2200 ? year : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
    : [];
}

/**
 * Google Books' `volumes` response.
 *
 * Typed as `unknown` and narrowed here rather than trusted: this is a public
 * API whose records are contributed, and a missing `volumeInfo` on one item
 * should cost that item, not the request.
 */
export function parseGoogle(payload: unknown): CompTitle[] {
  const items = (payload as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];

  const out: CompTitle[] = [];
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    const info = item.volumeInfo as Record<string, unknown> | undefined;
    const title = str(info?.title);
    if (!info || !title) continue;

    const ids = Array.isArray(info.industryIdentifiers)
      ? (info.industryIdentifiers as { type?: string; identifier?: string }[])
      : [];
    const isbn13 = ids.find((i) => i.type === "ISBN_13")?.identifier;

    const links = info.imageLinks as Record<string, string> | undefined;
    // https, always: the API still hands out http thumbnails, and a page served
    // over https drops them without a word.
    const cover = (links?.thumbnail ?? links?.smallThumbnail)?.replace(
      /^http:/,
      "https:",
    );

    out.push({
      key: isbn13 ?? `google:${String(item.id ?? title)}`,
      title,
      authors: strings(info.authors),
      year: yearOf(info.publishedDate),
      publisher: str(info.publisher),
      description: str(info.description),
      pageCount:
        typeof info.pageCount === "number" && info.pageCount > 0
          ? info.pageCount
          : undefined,
      subjects: strings(info.categories),
      isbn13,
      coverUrl: cover,
      source: "google",
      infoUrl: str(info.infoLink),
    });
  }
  return out;
}

/** Open Library's `/search.json` response. */
export function parseOpenLibrary(payload: unknown): CompTitle[] {
  const docs = (payload as { docs?: unknown })?.docs;
  if (!Array.isArray(docs)) return [];

  const out: CompTitle[] = [];
  for (const raw of docs) {
    const doc = raw as Record<string, unknown>;
    const title = str(doc.title);
    if (!title) continue;

    const isbn13 = strings(doc.isbn).find((i) => i.length === 13);
    const coverId = doc.cover_i;

    out.push({
      key: isbn13 ?? `openlibrary:${String(doc.key ?? title)}`,
      title,
      authors: strings(doc.author_name),
      year:
        typeof doc.first_publish_year === "number"
          ? doc.first_publish_year
          : undefined,
      publisher: strings(doc.publisher)[0],
      // Search results carry no blurb. Only the work endpoint has one, and
      // fetching it per result would be one request per row.
      description: undefined,
      pageCount:
        typeof doc.number_of_pages_median === "number"
          ? doc.number_of_pages_median
          : undefined,
      subjects: strings(doc.subject).slice(0, 8),
      isbn13,
      coverUrl:
        typeof coverId === "number"
          ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
          : undefined,
      source: "openlibrary",
      infoUrl: str(doc.key) ? `https://openlibrary.org${String(doc.key)}` : undefined,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Merging                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The names one record answers to.
 *
 * **Two of them, not one, and that is the whole of this fix.** This module's
 * own documentation has always said the merge matches "on ISBN where both have
 * one and on title-plus-author where they do not" — and `identity()` returned
 * only the second. So two records for one book whose titles differ by a
 * subtitle ("The Salt Ledger" and "The Salt Ledger: A Novel") survived the
 * merge under the same ISBN, and the screens that key a list on `isbn13` were
 * handed two children with the same key.
 *
 * It looked correct because the ISBN half was never exercised: the test that
 * claims to match on ISBN passes fixtures that share a title as well.
 *
 * Title and first author are flattened enough that punctuation cannot split a
 * pair — "The Drowned Coast!" and "the drowned coast" are one book.
 */
function names(book: CompTitle): string[] {
  const author = (book.authors[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const title = book.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const out = [`ta:${title}|${author}`];
  if (book.isbn13) out.unshift(`isbn:${book.isbn13}`);
  return out;
}

function fuse(seen: CompTitle, book: CompTitle): CompTitle {
  return {
    ...seen,
    description: seen.description ?? book.description,
    pageCount: seen.pageCount ?? book.pageCount,
    coverUrl: seen.coverUrl ?? book.coverUrl,
    isbn13: seen.isbn13 ?? book.isbn13,
    publisher: seen.publisher ?? book.publisher,
    year: seen.year ?? book.year,
    infoUrl: seen.infoUrl ?? book.infoUrl,
    subjects: [...new Set([...seen.subjects, ...book.subjects])],
  };
}

/**
 * One list from both services, with the same book appearing once.
 *
 * Matched on ISBN where both have one **and** on title-plus-author where they
 * do not. Both halves are needed and neither subsumes the other: Open Library
 * search results often carry no ISBN at all, so title-plus-author is the only
 * thing that can join those — while two records that *do* both carry an ISBN
 * frequently disagree about the title, because one of them has the subtitle on
 * it and the other does not.
 *
 * Which means a record can be reached by either name, and a third record can
 * turn out to bridge two that were already apart — Google's "Salt Ledger"
 * under ISBN X, Open Library's "Salt Ledger: A Novel" under no ISBN, and then
 * a second Google edition carrying ISBN X *and* the subtitle, which is the
 * same book as both. So the map is from name to a *slot*, several names may
 * point at one slot, and a book that lands on two slots fuses them. Anything
 * less is a merge that depends on which service answered first.
 *
 * **Merged field by field rather than by preferring a source**, because neither
 * source is better: Google has the blurb and Open Library has the subjects and
 * a cover for almost everything. Taking whichever record arrived first would
 * throw away exactly the field the other one was fetched for.
 *
 * Books with no author are dropped. Both services return collections,
 * anthologies and catalogue entries with an empty author list, and none of them
 * is a comparable title.
 */
export function mergeComps(...lists: CompTitle[][]): CompTitle[] {
  /** Slot per book. A fused-away slot becomes null and is dropped at the end. */
  const slots: (CompTitle | null)[] = [];
  const at = new Map<string, number>();

  for (const book of lists.flat()) {
    if (book.authors.length === 0) continue;

    const keys = names(book);
    /* Every slot this book can already be reached by. Usually none or one;
       two means it has just proved that two slots are the same book. */
    const hit = [...new Set(keys.map((k) => at.get(k)).filter((i) => i !== undefined))];

    if (hit.length === 0) {
      const index = slots.push({ ...book }) - 1;
      for (const key of keys) at.set(key, index);
      continue;
    }

    /* The lowest wins, so the record keeps the position — and therefore the
       `key` — of the first search result that mentioned it. */
    const [keep, ...rest] = hit.sort((a, b) => a - b);
    let merged = slots[keep]!;
    for (const other of rest) {
      merged = fuse(merged, slots[other]!);
      slots[other] = null;
    }
    slots[keep] = fuse(merged, book);

    /* Repoint every name that led anywhere that has just been folded in,
       including the incoming book's own. A stale index would leave a later
       record merging into a hole. */
    for (const [key, index] of at) {
      if (rest.includes(index)) at.set(key, keep);
    }
    for (const key of keys) at.set(key, keep);
  }

  return slots.filter((book): book is CompTitle => book !== null);
}

/* -------------------------------------------------------------------------- */
/* What the comps tell you                                                     */
/* -------------------------------------------------------------------------- */

export interface CompSummary {
  /** How many of the results carried the field the figure is drawn from. */
  pagesFrom: number;
  medianPages?: number;
  blurbsFrom: number;
  medianBlurbChars?: number;
  /** Subjects, commonest first, with how many books carry each. */
  subjects: { name: string; count: number }[];
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * The three answers that fall out of having comps: how long these books are,
 * how long their blurbs run, and what they are filed under.
 *
 * The median rather than the mean, because one 1,200-page omnibus in a list of
 * twenty drags an average somewhere no real book sits.
 *
 * `pagesFrom` and `blurbsFrom` are reported alongside the figures because both
 * services leave fields empty, and "the median is 320 pages" drawn from three
 * of twenty books is a different statement from the same figure drawn from
 * eighteen. The screen has to be able to say which.
 */
/**
 * The comps that can actually be looked at, for the cover wall.
 *
 * Two filters and both earn their place. A book with no cover is not a row with
 * a gap in it — a wall of covers is a wall or it is nothing, and a grid half
 * full of grey boxes teaches a writer that their genre has no visual
 * convention, which is the opposite of true.
 *
 * And the same artwork often arrives twice, because the two services carry
 * different editions of one book and both point at the same scan. Deduping on
 * the image URL rather than on the book is the right test: two genuinely
 * different editions with different covers are two useful data points, and the
 * same JPEG twice is a repetition that makes a convention look stronger than it
 * is.
 */
export function coversOf(books: CompTitle[]): CompTitle[] {
  const seen = new Set<string>();
  return books.filter((book) => {
    if (!book.coverUrl) return false;
    if (seen.has(book.coverUrl)) return false;
    seen.add(book.coverUrl);
    return true;
  });
}

export function summarise(books: CompTitle[]): CompSummary {
  const pages = books
    .map((b) => b.pageCount)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const blurbs = books
    .map((b) => b.description?.length)
    .filter((n): n is number => typeof n === "number" && n > 0);

  return {
    pagesFrom: pages.length,
    medianPages: median(pages),
    blurbsFrom: blurbs.length,
    medianBlurbChars: median(blurbs),
    // Through `rankSubjects` rather than counted raw. Raw, a live search for
    // dragons answers "Fiction (20)" — true of every novel ever written — and
    // carries "Protected DAISY" and "In library", which are things a librarian
    // recorded about a copy. See subjects.ts.
    subjects: rankSubjects(books).slice(0, 12),
  };
}

/**
 * The shelves a writer can browse from the comps screen.
 *
 * **Separate from `GENRES` on purpose.** That list is what a *book* can be —
 * it feeds the new-book form, the word-count targets and the checkup — so
 * adding "Cozy mystery" to it would offer a word-count target for a shelf and
 * change what every book in the library can call itself. These are only search
 * seeds: pressing one runs `subject:"…"`, which is a query rather than a claim
 * about anybody's manuscript.
 *
 * **Every entry was run against the live catalogues before it was added**, and
 * one candidate was cut for failing: `subject:"Middle grade"` returns nothing,
 * because the trade's word for that age band is not the shelf a librarian
 * files it under. A chip that leads to an empty screen is worse than a missing
 * chip — the writer reads it as their genre being empty rather than as our
 * vocabulary being wrong. Re-run a new one before adding it.
 *
 * `GENRES` leads, minus "Other", so the book's own genre is always present and
 * its chip can light up.
 */
export const BROWSE_SHELVES: readonly string[] = [
  "Fantasy",
  "Science fiction",
  "Romance",
  "Mystery",
  "Thriller",
  "Historical fiction",
  "Literary fiction",
  "Young adult",
  "Horror",
  "Memoir",
  // Verified above, in the order a writer is likeliest to recognise them.
  "Adventure",
  "Crime",
  "Suspense",
  "Cozy mystery",
  "Epic fantasy",
  "Urban fantasy",
  "Paranormal",
  "Magical realism",
  "Dystopian",
  "Coming of age",
  "Espionage",
  "Westerns",
  "Short stories",
  "Humor",
  "Poetry",
  "Biography",
  "Self-help",
];

/**
 * The same question in Open Library's dialect.
 *
 * The two catalogues take different field prefixes for the same idea, and
 * nothing said so until the title check went looking: Google wants
 * `intitle:"…"`, Open Library wants `title:"…"`, and Open Library answers a
 * query it does not understand with **zero results rather than an error**.
 *
 * That is the failure worth naming. The title-check screen was sending
 * `intitle:` to both, so every result it has ever shown came from Google
 * alone — while the page said, in its own words, "From Google Books and Open
 * Library". It looked like it worked, because Google carries the popular
 * titles and Google was answering. Measured: `intitle:"The Silent Patient"`
 * finds nothing on Open Library, `title:"The Silent Patient"` finds thirteen.
 *
 * Only the prefixes actually used are translated. A query with none — which is
 * every ordinary comps search — passes through untouched.
 */
export function openLibraryQuery(query: string): string {
  return query
    .replace(/\bintitle:/g, "title:")
    .replace(/\binauthor:/g, "author:")
    .replace(/\binpublisher:/g, "publisher:");
}


/**
 * How many the source says exist, as against how many it handed over.
 *
 * Worth carrying because the difference is enormous and invisible: a search
 * for `intitle:"spider man"` yields seventeen records here and Google reports
 * about three hundred. A screen that counts what it fetched and prints the
 * figure plainly reads as a count of the world, which is the invented-number
 * problem arriving by accident rather than by choice.
 *
 * Google's `totalItems` is an estimate and wobbles between identical requests
 * — so it is reported as an approximation and never used in arithmetic.
 *
 * **Both catalogues, under their own field names.** It read `totalItems` only,
 * which is Google's; Open Library says `numFound` and was therefore reported as
 * "no figure at all" — on the source that carries the deep sweep, and so on the
 * one screen that has to say what fraction of the shelf it read. One function
 * because the two are the same fact, and a caller holding a payload should not
 * have to know which service handed it over.
 */
export function reportedTotal(payload: unknown): number | null {
  const record = payload as { totalItems?: unknown; numFound?: unknown };
  const total = record?.totalItems ?? record?.numFound;
  return typeof total === "number" && Number.isFinite(total) && total >= 0
    ? total
    : null;
}
