import { GENRES } from "../book-kinds";

/**
 * The writer's own words, turned into a query the catalogues can answer.
 *
 * **This is the third place a model earns its cost here, and it is upstream of
 * the other two.** `rank.ts` reorders what was fetched, which cannot rescue a
 * fetch that brought back the wrong books: asked for "funnny people smile
 * every time", Google matched those words through the full text of unrelated
 * books and returned a comedian's memoir, a devotional about dessert and a
 * manual for police instructors. Ranking nine wrong books yields nine wrong
 * books in a better order. The leverage is in the query.
 *
 * **What a model is actually for here** is a translation a writer cannot be
 * expected to do: they describe a *story*, and a catalogue indexes *subjects*.
 * "A girl finds a door in her grandmother's attic" is not a phrase any book
 * contains, but `subject:"Young adult" subject:"Portal fantasy"` is a shelf. It
 * absorbs the typo too, which the catalogue will not.
 *
 * **Nothing here invents a book, and that is what makes it allowed.** The model
 * writes a *search*; the catalogues still supply every record. So the failure
 * `rank.ts` is built to prevent — a plausible title that does not exist, about
 * to be pasted into a query letter — is structurally impossible in this
 * direction. The worst a bad query can do is find nothing, which the screen
 * already knows how to say.
 *
 * **The query goes back into the box.** What was searched is on screen, in the
 * field the writer typed in, editable and undoable. A model quietly rewriting
 * somebody's search and presenting the results as theirs is the invisible hand
 * this app refuses everywhere else.
 */

/** Long enough for a few field terms, short enough to stay a query. */
export const MAX_QUERY = 200;

/**
 * The field prefixes both catalogues take, and nothing else.
 *
 * `openLibraryQuery()` translates Google's dialect into Open Library's
 * downstream, so a query written in Google's is safe. Anything else a model
 * might reach for — `isbn:`, `lccn:`, a Solr clause — is dropped rather than
 * passed on, because Open Library answers an unknown prefix with **zero
 * results rather than an error**. One stray term would empty the shelf and
 * nothing on screen would explain why.
 */
const ALLOWED = /^(subject|intitle|title|inauthor|author):/i;

/**
 * Wrappers a model puts round a one-line answer.
 *
 * Deliberately a fixed list of preamble words rather than "anything before a
 * colon" — the first draft used the loose rule and ate the query itself, since
 * `subject:"Fantasy"` is also text before a colon.
 */
const PREAMBLE =
  /^(?:here(?:'s| is)?(?: the)?(?: search| query)?|the (?:query|search)|query|search|answer|result)\s*:\s*/i;

export const SYSTEM = `You turn a writer's description of their unpublished
book into a search query for two book catalogues: Google Books and Open
Library.

The writer wants comparable titles — published books like theirs, of the kind a
listing form or a letter to an agent asks them to name. Your query has to find
books of that *kind*, not books containing their words.

Write ONE query line. Rules:

- Prefer subject terms. "subject:" is the strongest tool you have, because it
  searches how a book is shelved rather than what is printed in it.
- Use at most three subject terms, quoted: subject:"Young adult"
- Add a very few plain words only when they name a real subgenre or setting a
  catalogue would hold — boarding school, small town, second chance.
- Never quote a phrase from the writer's own sentence. Their words describe a
  book that has not been published; no catalogue holds them.
- Fix obvious misspellings silently.
- Never use any prefix other than subject:, intitle:, inauthor:.
- If the writer named a genre, keep it as a subject term.

Answer with the query line and nothing else — no explanation, no code fence.

Known genres: ${GENRES.join(", ")}.`;

/** What the writer gave us, and what we already know about their book. */
export interface QuerySeed {
  words: string;
  genre?: string;
}

export function buildPrompt({ words, genre }: QuerySeed): string {
  return [
    `The writer describes their book as: ${words}`,
    genre && genre !== "Other" ? `Their genre is: ${genre}` : null,
    "Write the query line.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The query out of whatever the model said.
 *
 * Generated text, so hostile input — the standing rule shared with `rank.ts`
 * and `shelves.ts`. The **term filter is the load-bearing half**: a dropped
 * term costs a slightly looser search, while a term carrying an unknown prefix
 * costs the entire result set, silently.
 */
export function parseQuery(reply: string): string | null {
  if (typeof reply !== "string") return null;

  let text = reply.trim();
  if (!text) return null;

  const fenced = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();

  const line =
    text
      .split("\n")
      .map((one) => one.trim())
      .filter(Boolean)
      // A line that is nothing but a label ("Here is the query:") is a
      // preamble on its own row; the answer is the row under it.
      .find((one) => !/^[a-z'’ ]{0,30}:$/i.test(one))
      ?.replace(PREAMBLE, "")
      .trim() ?? "";

  if (!line) return null;

  const kept = split(line).filter(
    (term) => !term.includes(":") || ALLOWED.test(term),
  );
  if (kept.length === 0) return null;

  return kept.join(" ").slice(0, MAX_QUERY).trim() || null;
}

/**
 * Split on spaces, but never inside quotes.
 *
 * `subject:"Historical fiction"` is one term; splitting it on the space makes
 * two, the second a bare `fiction"` that matches most books ever written.
 */
function split(query: string): string[] {
  return query.match(/(?:[^\s"]+"[^"]*"|[^\s"]+|"[^"]*")+/g) ?? [];
}

/**
 * Whether this is a writer's sentence rather than a query already.
 *
 * The shelf chips and the seeded search send `subject:"…"`, which is the thing
 * a model would be asked to produce — so sending it to be rewritten spends
 * money to change nothing. Only plain words are worth translating.
 */
export function looksPlain(query: string): boolean {
  return !split(query).some((term) => term.includes(":"));
}
