import type { CompTitle } from "./comps";

/**
 * Turning what two catalogues call a subject into something a writer could put
 * in a shop's category box.
 *
 * **This is the whole of the categories feature, and it is not a code list.**
 * BISAC — the scheme every shop's category box is really asking for — is owned
 * by BISG and licensed, so shipping the codes is not free and not ours to do.
 * The way round it is better anyway: read what books *like yours are actually
 * filed under* and rank that. The answer comes from the shelf rather than from
 * a taxonomy, which is also how a writer would answer it if they had the time.
 *
 * The work is cleaning. A live search for dragons came back with
 * `Fiction (20), Dragons (14), Fantasy (11), Juvenile fiction (9)` — where
 * "Fiction" is true of every novel ever written and no use to anyone, and the
 * list also carries `Protected DAISY`, `In library` and `Accessible book`,
 * which are things librarians record about a copy rather than anything about a
 * book.
 *
 * **What this deliberately does not do is decide that two subjects mean the
 * same thing.** "Fantasy" and "Fantasy fiction" stay separate. Merging them
 * needs a rule, and every rule that would merge those two also merges "Science
 * fiction" into "Science" — so the honest thing is to show both and let the
 * writer, who can read, pick.
 */

/**
 * Things catalogues record about a *copy*, not about a book.
 *
 * Matched as substrings, lower-cased, because these arrive in a dozen shapes
 * ("Protected DAISY", "protected daisy for print-disabled").
 */
const ADMIN = [
  "accessible book",
  "protected daisy",
  "in library",
  "overdrive",
  "internet archive",
  "large type",
  "reading level",
  "lending library",
  "print disabled",
  "open library",
  "ebook",
  "e-book",
  "electronic book",
  "audiobook",
  "translations into",
  "bestsellers",
  "bestseller",
  // Open Library groups scanned sets this way — `Collection:dragonlance`,
  // `collection:opensource`. Found in live results, not guessed at.
  "collection:",
  "nyt:",
  "new york times bestseller",
];

/**
 * True of nearly every novel, and therefore no use as a category.
 *
 * Matched exactly rather than as substrings: "Fiction" goes, "Fiction, fantasy,
 * general" is a real filing string and its parts are worth keeping, and
 * "Historical fiction" is a genre.
 */
const TOO_BROAD = new Set([
  "fiction",
  "nonfiction",
  "non-fiction",
  "general",
  "literature",
  "books",
  "novel",
  "novels",
  "english fiction",
  "american fiction",
  "literary collections",
  "miscellanea",
]);

/**
 * The pieces of one subject string.
 *
 * Both services hand over compound strings, in two different shapes: Google
 * files things as a path, `Fiction / Fantasy / Epic`, and Open Library often as
 * a reversed heading, `Fiction, fantasy, general`. Splitting on both leaves the
 * useful words and lets `Fiction` and `general` be dropped by the rules above,
 * which is exactly what neither shape lets you do while it is one string.
 */
function pieces(raw: string): string[] {
  return raw
    .split(/[/,;|]/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Sentence case, so `FANTASY` and `fantasy` present as one thing. */
function present(text: string): string {
  const lower = text.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

/**
 * One subject string in, the usable parts out. Often none.
 *
 * Exported because it is the part worth testing directly — the ranking below is
 * a counter, and this is where every judgement about what counts as a category
 * actually lives.
 */
export function subjectParts(raw: string): string[] {
  if (typeof raw !== "string") return [];
  const out: string[] = [];

  for (const piece of pieces(raw)) {
    const lower = piece.toLocaleLowerCase();

    if (ADMIN.some((term) => lower.includes(term))) continue;
    if (TOO_BROAD.has(lower)) continue;
    // A single letter or a bare number is a shelf mark, not a subject.
    if (piece.length < 3) continue;
    if (/^\d+$/.test(piece)) continue;
    // Dates and place-of-publication headings: "Fiction 1900-1950", "20th
    // century". Real, and not what a shop's category box is asking for.
    if (/^\d{3,4}(-\d{2,4})?$/.test(piece)) continue;

    out.push(present(piece));
  }

  return [...new Set(out)];
}

export interface SubjectCount {
  name: string;
  /** How many of the comparable books are filed under it. */
  count: number;
}

/**
 * The subjects comparable books are filed under, commonest first.
 *
 * Counted per *book*, not per occurrence: a catalogue that lists "Fantasy"
 * three times against one title should not make that title count three times,
 * or one over-described book decides the ranking.
 *
 * Ties break alphabetically so the list is stable between two searches that
 * return the same books in a different order — a suggestion list that reshuffles
 * on a refresh looks like it is guessing.
 */
export function rankSubjects(books: CompTitle[]): SubjectCount[] {
  const counts = new Map<string, number>();

  for (const book of books) {
    const forThisBook = new Set(book.subjects.flatMap(subjectParts));
    for (const subject of forThisBook) {
      counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Whether a suggestion is worth showing at all.
 *
 * One book out of twenty filed under something is not a pattern, it is that
 * book. Two is the smallest number that can be one, and the threshold is
 * relative so a search that returned five results does not get held to the same
 * bar as one that returned forty.
 */
export function worthSuggesting(
  subjects: SubjectCount[],
  bookCount: number,
): SubjectCount[] {
  const floor = Math.max(2, Math.round(bookCount * 0.15));
  return subjects.filter((s) => s.count >= floor);
}
