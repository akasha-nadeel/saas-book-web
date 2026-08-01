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
 * earns its cost, and it is a later step that reads what this produces — see
 * TODO.md. Nothing here calls one, so the whole feature works, for free, with
 * the model switched off.
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

/** Words too common to narrow anything, plus the ones every blurb contains. */
const STOP = new Set([
  "the","a","an","and","or","but","of","in","on","at","to","for","with","from",
  "by","as","is","are","was","were","be","been","it","its","this","that","these",
  "those","he","she","they","her","his","their","them","when","where","what",
  "who","how","why","all","one","two","new","book","novel","story","stories",
  "first","after","before","into","out","up","down","over","about","against",
  "than","then","there","here","not","no","yes","can","will","would","must",
]);

/**
 * The most distinctive words in a piece of prose, longest first.
 *
 * A blurb is the best short description of a book that exists, so it is the
 * best thing to search with — but handed over whole it matches nothing, because
 * these services search titles and subjects rather than doing anything
 * semantic. So it is reduced to the words that carry meaning.
 *
 * Longest-first rather than most-frequent: in a paragraph this short, frequency
 * is noise, and the long words are the nouns that name what the book is about.
 */
export function keywords(text: string, limit = 6): string[] {
  const seen = new Set<string>();
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .filter((w) => {
      if (seen.has(w)) return false;
      seen.add(w);
      return true;
    });
  return words.sort((a, b) => b.length - a.length).slice(0, limit);
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

/** Title and first author, flattened enough that punctuation cannot split a pair. */
function identity(book: CompTitle): string {
  const author = (book.authors[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const title = book.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${title}|${author}`;
}

/**
 * One list from both services, with the same book appearing once.
 *
 * Matched on ISBN where both have one and on title-plus-author where they do
 * not — the second is the case that matters, because Open Library search
 * results often carry no ISBN at all.
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
  const byId = new Map<string, CompTitle>();

  for (const book of lists.flat()) {
    if (book.authors.length === 0) continue;
    const id = identity(book);
    const seen = byId.get(id);
    if (!seen) {
      byId.set(id, { ...book });
      continue;
    }
    byId.set(id, {
      ...seen,
      description: seen.description ?? book.description,
      pageCount: seen.pageCount ?? book.pageCount,
      coverUrl: seen.coverUrl ?? book.coverUrl,
      isbn13: seen.isbn13 ?? book.isbn13,
      publisher: seen.publisher ?? book.publisher,
      year: seen.year ?? book.year,
      infoUrl: seen.infoUrl ?? book.infoUrl,
      subjects: [...new Set([...seen.subjects, ...book.subjects])],
    });
  }

  return [...byId.values()];
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
