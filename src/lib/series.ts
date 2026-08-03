import { mentionedIn, type BibleEntry, type EntryKind } from "./bible";
import type { Book } from "./library-store";

/**
 * A series, and the story bible read across the whole of one.
 *
 * The complaint this answers is the first line of the bible's own research —
 * *"keeping track of details across multiple books must be tricky"* — and it is
 * the half `bible.ts` left on the table. Book three's bible is empty of book
 * one's cast, so the lookup that made the feature worth having ("who is in the
 * chapter you have open") answers "none of them" for every character the writer
 * introduced two books ago. That is precisely the moment they needed it.
 *
 * **A series is derived, never declared.** There is no series object, no
 * "create a series" screen and no migration: a book is in a series when its
 * *listing* says so, because a shop asks for that field anyway and a writer
 * with a series has already filled it in. A second place to record the same
 * fact is a second place to keep in step, and this store has learned that
 * lesson once already — book and chapter totals are summed on read for the
 * same reason.
 *
 * **Entries stay at their own book's key.** Nothing here writes anything; the
 * series bible is a *read across* the sibling books' bibles, merged on the
 * way through. A shared `bible:series:<name>` key was the obvious other
 * answer and is worse in three ways: renaming the series orphans it, a book
 * leaving the series takes nothing with it, and an entry loses the one fact
 * that makes the merged view worth reading — which book it was written in.
 *
 * The sync caveat from `bible.ts` carries over unchanged and gets worse, not
 * better: none of these keys sync, so a series read on a second machine is a
 * series of whichever books that machine has. The panel says so.
 */

// ---------------------------------------------------------------------------
// What counts as a series
// ---------------------------------------------------------------------------

/**
 * A series title, normalised for comparison only — never for display.
 *
 * Case and stray whitespace are typos between one book's listing form and the
 * next; nothing else is touched. In particular **articles are left alone**: a
 * rule that folded "The Ash Cycle" into "Ash Cycle" is the same rule that folds
 * "A Study in Scarlet" into "Study in Scarlet", and this is the merge that
 * decides whether two books share a cast. Conservative is the only safe
 * direction — two series shown apart is a shrug, two unrelated books merged is
 * a bible full of strangers.
 */
export function seriesKey(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const key = name.trim().replace(/\s+/g, " ").toLowerCase();
  return key === "" ? null : key;
}

/** The series a book says it is in, as the writer typed it. */
export function seriesNameOf(book: Book): string | null {
  const name = book.publishing?.series?.trim();
  return name ? name : null;
}

/** One book's place in a series. `index` is absent when nobody numbered it. */
export interface SeriesBook {
  id: string;
  title: string;
  /** `publishing.seriesIndex` — 1-based, as a reader would count. */
  index?: number;
}

/**
 * The books in the same series as this one, in reading order — including the
 * book asked about, which is a member of its own series.
 *
 * **Numbered books come first, ascending; unnumbered ones follow in shelf
 * order.** A series index is the only statement of reading order anyone has
 * made, so where it exists it wins and where it does not we decline to invent
 * one. Sorting the unnumbered by date written was tried on paper and is a
 * guess dressed as an answer: a prequel is written last and read first.
 *
 * Trashed and archived books are left out. A series is what the writer is
 * working on, and a book they threw away should not put a stranger in the
 * lookup.
 */
export function seriesOf(
  books: readonly Book[],
  bookId: string,
): SeriesBook[] {
  const self = books.find((b) => b.id === bookId);
  if (!self) return [];

  const key = seriesKey(seriesNameOf(self));
  if (!key) return [];

  const members = books.filter(
    (b) =>
      !b.trashedAt &&
      !b.archivedAt &&
      seriesKey(seriesNameOf(b)) === key,
  );

  const numbered: SeriesBook[] = [];
  const rest: SeriesBook[] = [];
  for (const book of members) {
    const index = book.publishing?.seriesIndex;
    const entry: SeriesBook = { id: book.id, title: book.title };
    if (typeof index === "number" && Number.isFinite(index)) {
      entry.index = index;
      numbered.push(entry);
    } else {
      rest.push(entry);
    }
  }

  numbered.sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0) || a.title.localeCompare(b.title),
  );
  return [...numbered, ...rest];
}

/**
 * Whether there is a series here worth reading across.
 *
 * A series of one is a book with a series field filled in, which is a normal
 * thing for a first book in a planned trilogy to be — and showing it a "series"
 * view of its own bible would be the same list twice under a grander name.
 */
export function isSeries(books: readonly SeriesBook[]): boolean {
  return books.length > 1;
}

// ---------------------------------------------------------------------------
// The bible, merged
// ---------------------------------------------------------------------------

/** One book's bible, ready to be merged with its siblings'. */
export interface BookBible {
  book: SeriesBook;
  entries: readonly BibleEntry[];
}

/** An entry as one book wrote it. */
export interface EntryInBook {
  book: SeriesBook;
  entry: BibleEntry;
}

/**
 * One person, place or thing, as the whole series knows them.
 *
 * `in` is every book that has written them down, in reading order — which is
 * what makes this different from a longer list. The writer opening book three
 * does not want a merged paragraph about Elizabeth; they want to see what book
 * one said about her, in book one's words, beside what they have written since.
 */
export interface SeriesEntry {
  /**
   * The earliest book's entry id. Stable across renders, unique per merged
   * entry, and therefore usable as a React key and as the handle
   * `seriesMentions` maps its results back through.
   */
  id: string;
  kind: EntryKind;
  /** As the earliest book that carries them spells it. */
  name: string;
  /** Every alias any book has recorded, minus the display name itself. */
  aka: string[];
  in: EntryInBook[];
}

/**
 * Merge the bibles of a series into one cast.
 *
 * **Two entries are the same thing when they share a name, exactly.** Name to
 * name, name to alias, alias to alias, compared case-insensitively with
 * whitespace collapsed — and nothing fuzzier. This is the same refusal
 * `subjects.ts` makes about "Fantasy" and "Fantasy fiction": every rule clever
 * enough to spot that "Beth" is "Elizabeth" is also clever enough to merge two
 * different Toms, and a bible that has quietly welded two characters together
 * is worse than one that lists them twice — the writer can see a duplicate, and
 * cannot see a merge.
 *
 * Matching *is* transitive, which is the whole reason aliases are worth
 * recording: Elizabeth-also-Lizzie in book one and Lizzie-also-Beth in book two
 * make one person across three names, and the writer never has to state the
 * pair that closes the chain.
 *
 * **Kind is part of identity.** A character called Ash and a place called Ash
 * stay two entries, because a town named after its founder is ordinary in
 * fiction and reading their details as one thing would be a genuine confusion
 * rather than a tidy list.
 */
export function mergeSeriesBible(
  bibles: readonly BookBible[],
): SeriesEntry[] {
  // Union-find over "kind + normalised name", so a chain of aliases closes
  // without anyone having to state its ends.
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = parent.get(key) ?? key;
    while (root !== (parent.get(root) ?? root)) root = parent.get(root) ?? root;
    parent.set(key, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(rb, ra);
  };

  const flat: EntryInBook[] = [];
  for (const { book, entries } of bibles) {
    for (const entry of entries) flat.push({ book, entry });
  }

  for (const { entry } of flat) {
    const keys = namesFor(entry);
    for (const key of keys) find(key);
    for (let i = 1; i < keys.length; i++) union(keys[0], keys[i]);
  }

  // Group by root, keeping the order books were handed to us — which is
  // reading order, which is what `in` has to be.
  const groups = new Map<string, EntryInBook[]>();
  for (const row of flat) {
    const root = find(namesFor(row.entry)[0]);
    const group = groups.get(root);
    if (group) group.push(row);
    else groups.set(root, [row]);
  }

  const merged: SeriesEntry[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    const aka = new Set<string>();
    for (const { entry } of group) {
      for (const name of [entry.name, ...entry.aka]) {
        const clean = name.trim();
        if (clean && !same(clean, first.entry.name)) aka.add(clean);
      }
    }
    merged.push({
      id: first.entry.id,
      kind: first.entry.kind,
      name: first.entry.name,
      aka: [...aka].sort((a, b) => a.localeCompare(b)),
      in: group,
    });
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

/** The book that wrote this one down first — where the reader met them. */
export function introducedIn(entry: SeriesEntry): SeriesBook {
  return entry.in[0].book;
}

/**
 * Whether more than one book has written a detail for this entry.
 *
 * Not called a conflict, and deliberately not flagged as one: details
 * accumulate across a series far more often than they contradict, so a warning
 * badge would fire on almost every character and mean nothing by the second
 * book. The honest version is to put both books' words on screen, attributed,
 * and let the person who wrote them see it — which is the one thing they have
 * never been able to do.
 */
export function writtenAboutTwice(entry: SeriesEntry): boolean {
  return entry.in.filter(({ entry: e }) => e.detail.trim() !== "").length > 1;
}

// ---------------------------------------------------------------------------
// The lookup
// ---------------------------------------------------------------------------

export interface SeriesMention {
  entry: SeriesEntry;
  count: number;
}

/**
 * Which of the series' cast appear in a piece of prose, most-mentioned first.
 *
 * The whole-word matching, the phrase handling and the
 * don't-count-an-alias-twice arithmetic all live in `mentionedIn` and are not
 * repeated here: a merged entry is flattened into one synthetic entry carrying
 * every name the series knows it by, run through the tested function, and
 * mapped back. Two copies of that regex would be two answers to "does Ash match
 * ashes", and one of them would be wrong.
 */
export function seriesMentions(
  text: string,
  entries: readonly SeriesEntry[],
): SeriesMention[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const flattened: BibleEntry[] = entries.map((e) => ({
    id: e.id,
    kind: e.kind,
    name: e.name,
    aka: e.aka,
    detail: "",
    at: 0,
  }));

  const out: SeriesMention[] = [];
  for (const { entry, count } of mentionedIn(text, flattened)) {
    const merged = byId.get(entry.id);
    if (merged) out.push({ entry: merged, count });
  }
  return out;
}

// ---------------------------------------------------------------------------

/** Every name an entry answers to, normalised and prefixed by kind. */
function namesFor(entry: BibleEntry): string[] {
  const keys = [entry.name, ...entry.aka]
    .map((n) => normalise(n))
    .filter(Boolean)
    .map((n) => `${entry.kind}\u0000${n}`);
  return keys.length > 0 ? [...new Set(keys)] : [`${entry.kind}\u0000${entry.id}`];
}

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function same(a: string, b: string): boolean {
  return normalise(a) === normalise(b);
}
