import { seedIndex } from "./default-covers";

/**
 * The idea parking lot.
 *
 * For the idea that is *not* the book you are writing. From the research:
 *
 *   "I set out to write a trilogy. Completed the first book and about 80% of
 *    the second. Then a new idea, completely different, popped into my head."
 *   "I get new shiny ideas when I'm trying to write."
 *   "I usually forget some of my ideas… I started writing notes on my phone."
 *
 * Two failures in one. The idea nags until it is written down, so it costs the
 * current book its attention; and if the only way to write it down is to leave
 * the current book, leaving *is* the interruption. So the whole design goal is
 * ten seconds without going anywhere.
 *
 * **Parked, not started.** An idea here is explicitly not a book — it does not
 * appear on the shelf, it has no chapters, and it costs nothing to keep. Making
 * every stray thought into a book is how a shelf fills with eleven abandoned
 * first chapters, which is its own pain further down the research.
 *
 * The parsing lives here and is pure; the reading and writing is in
 * `library-store.ts`, which stays the only module that touches `localStorage`.
 */

export interface Idea {
  id: string;
  text: string;
  /** Epoch ms. */
  at: number;
  /** The book being written when it struck, if any. Never navigated to — it is
   *  there so a writer can see that four of their ideas arrived during one
   *  book, which is usually a fact about that book. */
  from?: string;
}

/** Long enough for a premise, short enough that this stays a parking lot. */
export const IDEA_MAX = 500;

/**
 * Ideas out of stored JSON, newest first.
 *
 * Every field is checked rather than trusted. This is `localStorage`, which
 * holds whatever older versions of the app left there and is checked by no
 * compiler — one malformed row should cost that row, not the whole list.
 */
export function parseIdeas(raw: string | null): Idea[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: Idea[] = [];
  for (const row of parsed) {
    const record = row as Record<string, unknown>;
    const text = typeof record?.text === "string" ? record.text.trim() : "";
    const id = typeof record?.id === "string" ? record.id : "";
    if (!text || !id) continue;
    out.push({
      id,
      text,
      at: typeof record.at === "number" ? record.at : 0,
      ...(typeof record.from === "string" ? { from: record.from } : {}),
    });
  }

  return out.sort((a, b) => b.at - a.at);
}

/**
 * One more idea on the pile, newest first.
 *
 * Trimmed and capped rather than rejected: a writer pasting three paragraphs
 * into a ten-second capture box should get their idea kept, not an error
 * message about a limit they did not know existed.
 *
 * Blank goes in as nothing at all. An empty idea is a mis-click.
 */
export function addIdea(
  ideas: readonly Idea[],
  text: string,
  options: { id: string; at: number; from?: string },
): Idea[] {
  const clean = text.trim().slice(0, IDEA_MAX);
  if (!clean) return [...ideas];
  return [
    {
      id: options.id,
      text: clean,
      at: options.at,
      ...(options.from ? { from: options.from } : {}),
    },
    ...ideas,
  ];
}

/**
 * One idea's words replaced, in place.
 *
 * **`at` is carried through untouched, and that is the whole design.** The time
 * on a card means *parked then*, and the board is ordered newest first — so
 * bumping it would send a card a writer had only fixed a typo on to the front
 * of the board and make it read "just now". Nothing moves while you tidy up
 * wording. There is no `editedAt` either: this is a parking lot, not a record
 * of anything, and a second date on every card would be a field to validate in
 * `parseIdeas` for a line nobody needs.
 *
 * Trimmed and capped exactly as `addIdea` does, so pasting three paragraphs
 * into an edit is treated the same as pasting them into the capture box.
 *
 * **Blank leaves the idea alone.** Clearing the box and pressing save is a
 * mis-press; forgetting an idea is what the bin is for, and it would be a poor
 * app that deleted somebody's idea because they selected all and hit a key.
 */
export function editIdea(
  ideas: readonly Idea[],
  id: string,
  text: string,
): Idea[] {
  const clean = text.trim().slice(0, IDEA_MAX);
  if (!clean) return [...ideas];
  return ideas.map((idea) =>
    idea.id === id ? { ...idea, text: clean } : idea,
  );
}

export function removeIdea(ideas: readonly Idea[], id: string): Idea[] {
  return ideas.filter((idea) => idea.id !== id);
}

/**
 * The first line, for a title when an idea becomes a book.
 *
 * Ideas get typed as "a lighthouse keeper vanishes — the cartographer sent to
 * find him is his daughter", which is a premise rather than a title. The first
 * few words are a better working title than the whole thing, and the writer
 * renames it in about a second anyway.
 */
export function titleFromIdea(text: string, words = 6): string {
  const first = text.split(/[\n.;—–-]/)[0]?.trim() ?? "";
  const source = first || text.trim();
  const parts = source.split(/\s+/).slice(0, words);
  return parts.join(" ") || "Untitled Book";
}

/**
 * How many grounds the board has.
 *
 * The count `--idea-1` … `--idea-6` in `globals.css` declares, stated here so
 * the picker below cannot reach past the last one. `idea-colours.test.ts`
 * fails if the CSS and this number disagree, which is the only way the two
 * would ever be found out of step — a seventh hue nobody reaches is invisible,
 * and a sixth that does not exist is a card with no ground at all.
 */
export const IDEA_COLOURS = 6;

/**
 * Which of the six grounds this idea wears, from `1`.
 *
 * **Folded from the id, not stored.** Nothing is written, so there is no field
 * on `Idea`, nothing for `parseIdeas` to validate and nothing to migrate — and
 * an idea keeps its colour for as long as it keeps its id, which is for as
 * long as it exists. `seedIndex` is the same fold that picks a book's default
 * jacket; using it twice rather than writing a second hash is the point of it
 * being exported.
 *
 * A colour the writer chose would be a better feature and a much more
 * expensive one: a stored field, a picker on every card, and a choice that
 * does not travel, because the ideas store is one of the ones that does not
 * sync.
 */
export function ideaColour(id: string): number {
  return seedIndex(id, IDEA_COLOURS) + 1;
}

/**
 * The parked ideas matching what was typed in the search box.
 *
 * Plain substring, case-folded, and normalised to NFC on both sides — an idea
 * typed on a Mac and a query typed on Windows can be the same word in two
 * encodings, which is the same trap `canonicalText` in `provenance.ts`
 * normalises for.
 *
 * **An empty query is not a filter.** It returns the list as it stands rather
 * than nothing, so clearing the box gives the board back.
 */
export function matchIdeas(
  ideas: readonly Idea[],
  query: string,
): Idea[] {
  const needle = query.trim().toLowerCase().normalize("NFC");
  if (!needle) return [...ideas];
  return ideas.filter((idea) =>
    idea.text.toLowerCase().normalize("NFC").includes(needle),
  );
}
