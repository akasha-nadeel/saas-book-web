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
