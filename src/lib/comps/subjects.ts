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

/* -------------------------------------------------------------------------- */
/* The subject index, for typing into                                          */
/* -------------------------------------------------------------------------- */

/**
 * One heading out of Open Library's subject index, with how many works carry it.
 *
 * Different from `SubjectCount` above, and the difference matters on screen:
 * that one counts *the comparable books we fetched* ("17 of 56"), this one is
 * how big the shelf is in the whole catalogue ("61,392 works"). Naming them
 * apart keeps a component from printing one and captioning it as the other.
 */
export interface SubjectHeading {
  name: string;
  /** Works catalogued under it. Open Library's figure, not ours. */
  works: number;
}

/**
 * Read Open Library's `/search/subjects.json`.
 *
 * **Headings are shown whole, not split.** `subjectParts` exists to break a
 * per-book subject list into usable pieces, because a *book* is filed under
 * "Fiction, mystery & detective, general" alongside "Protected DAISY". These
 * are the index's own headings — that compound string *is* the shelf's name,
 * and a writer copying a category wants it as the catalogue writes it.
 *
 * The cleaning is still applied as a *filter*: a heading with nothing usable
 * left after `subjectParts` is administrative noise, so it goes. That keeps
 * one definition of what counts as a category rather than two.
 *
 * Only `subject_type: "subject"` survives. The index also carries people,
 * places and periods — "Hercule Poirot" is a real heading and a useless
 * category, and it is exactly the noise the categories screen already fights.
 */
export function parseSubjectIndex(payload: unknown): SubjectHeading[] {
  const docs = (payload as { docs?: unknown })?.docs;
  if (!Array.isArray(docs)) return [];

  const out: SubjectHeading[] = [];
  const seen = new Set<string>();

  for (const row of docs) {
    const r = row as Record<string, unknown>;
    if (r?.subject_type !== "subject") continue;

    const name = typeof r.name === "string" ? r.name.replace(/\s+/g, " ").trim() : "";
    if (!name) continue;
    if (subjectParts(name).length === 0) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const works = typeof r.work_count === "number" && Number.isFinite(r.work_count)
      ? r.work_count
      : 0;
    out.push({ name, works });
  }

  // Commonest shelf first: a writer typing "myst" wants the mystery shelf
  // before a heading three books are filed under.
  return out.sort((a, b) => b.works - a.works);
}

/**
 * Order headings by how well they answer what was typed, blended with size.
 *
 * **Two wrong answers sit either side of this, and both were built before the
 * right one.** Sorting by size alone put "Fiction, thrillers, general" (38,368
 * works) above "Thriller" (2,075) for `thri`, because the order knew nothing
 * about the query. Sorting by match *first* and size second put **"Thrips"** —
 * an insect, 118 works — above both, because it happens to begin with those
 * four letters. A reader typing four letters wants neither the biggest shelf
 * that merely contains them nor the most literal match in the catalogue.
 *
 * So the two are added rather than nested. Match quality is worth a fixed step
 * per tier; size is worth its **logarithm**, so ten times the works is a
 * bounded nudge rather than a landslide. A near-miss on an enormous shelf can
 * outrank a literal hit on a tiny one — "Fiction, thrillers, general" above
 * "Thrips" — while a literal hit on a decent shelf still beats a bigger
 * near-miss, which is "Thriller" above both.
 *
 * The lowest tier is not empty and cannot be dropped: the index is stemmed, so
 * a search for "cozy" legitimately returns headings matching on a stem rather
 * than on any prefix of the string.
 */
export function rankHeadings(
  headings: readonly SubjectHeading[],
  query: string,
): SubjectHeading[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...headings];

  /** Typed in full, so it was meant. Never outranked, whatever the sizes. */
  const exact = (name: string) => name.toLowerCase() === q;

  /** 1 begins with what was typed; 4 matched only through the stemmer. */
  const tierOf = (name: string): number => {
    const lower = name.toLowerCase();
    if (lower === q) return 0;
    if (lower.startsWith(q)) return 1;
    // A word inside the heading: "Fiction, thrillers, general" for "thri".
    if (lower.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(q))) return 2;
    if (lower.includes(q)) return 3;
    return 4;
  };

  /**
   * What one tier is worth in size. At 1.5 a step is a shade over thirty times
   * the works: enough that a literal hit beats a near-miss of ordinary size,
   * not so much that it beats one of a different order of magnitude.
   */
  const TIER = 1.5;

  const scoreOf = (h: SubjectHeading) =>
    (4 - tierOf(h.name)) * TIER + Math.log10(Math.max(h.works, 1));

  return [...headings].sort((a, b) => {
    // The one thing the blend may not overturn. Somebody who typed the whole
    // name wants that shelf, and a bigger neighbour is not a better answer to
    // a question they have already finished asking.
    if (exact(a.name) !== exact(b.name)) return exact(a.name) ? -1 : 1;
    return scoreOf(b) - scoreOf(a);
  });
}


/**
 * Which of a set of headings answer what has been typed.
 *
 * **Word-prefix, not substring.** Typing "war" should offer "War stories" and
 * "Civil war", not "Warehouse management" — well, it offers that too, since
 * the word begins with it — but it must not offer "Steward". Matching anywhere
 * inside a word is how an autocomplete starts returning things the reader
 * cannot see the reason for, which reads as broken rather than generous.
 *
 * A multi-word query matches when the heading contains the earlier words
 * somewhere and a word beginning with the last one, so "small tow" finds
 * "Fiction, small town & rural" while the reader is still typing.
 */
export function matchHeadings(
  headings: readonly SubjectHeading[],
  query: string,
): SubjectHeading[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const words = q.split(/\s+/).filter(Boolean);
  const last = words[words.length - 1];
  const earlier = words.slice(0, -1);

  return headings.filter((h) => {
    const lower = h.name.toLowerCase();
    if (!earlier.every((w) => lower.includes(w))) return false;
    return lower.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(last));
  });
}

/**
 * One list from two, without saying the same shelf twice.
 *
 * The local index and the live one overlap heavily by design — the local one
 * was harvested from the live one — so a naive concatenation shows "Thriller"
 * twice the moment the network answers. First writer wins, which is the local
 * copy, and its count is the same figure anyway.
 */
export function mergeHeadings(
  ...lists: readonly SubjectHeading[][]
): SubjectHeading[] {
  const by = new Map<string, SubjectHeading>();
  for (const heading of lists.flat()) {
    const key = heading.name.toLowerCase();
    if (!by.has(key)) by.set(key, heading);
  }
  return [...by.values()];
}
