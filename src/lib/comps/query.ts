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

- EVERY TERM NARROWS THE SEARCH. The catalogue ANDs them, so each one you add
  throws away books. Four terms usually finds nothing at all. Fewer is better.
- Use ONE subject term, quoted, naming the shelf the book belongs on:
  subject:"Cozy mystery". Two only when the book genuinely needs both, and
  never three.
- Add at most one plain word, and only when it names something a catalogue
  would actually hold — a real subgenre or setting. When in doubt, leave it
  out: the subject term alone finds books, and a book too many is easier to
  ignore than none at all.
- Prefer the most specific shelf that is still a real one. "Cozy mystery" beats
  "Mystery" plus three describing words.
- Never quote a phrase from the writer's own sentence. Their words describe a
  book that has not been published; no catalogue holds them.
- Fix obvious misspellings silently.
- Never use any prefix other than subject:, intitle:, inauthor:.
- The writer's genre is context, not a term to add. Use it to choose the right
  shelf; do not put it in the query beside another subject, which would ask the
  catalogue for books on both shelves at once and find neither.

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
export function parseQuery(
  reply: string,
  /**
   * Real subject headings, lowercased. A `subject:` term naming anything else
   * is dropped.
   *
   * **Models invent shelves, and an invented shelf is the worst possible
   * output here.** Measured: asked for "cozy village mystery with a nosy
   * librarian" on a book whose genre is Fantasy, the reply was
   * `subject:"Fantasy mystery" librarian`. No catalogue has a Fantasy mystery
   * shelf, so that term matched nothing at all — which left "librarian" to
   * carry the search alone, and the screen filled with the catalogues of
   * actual libraries, several of them from the 1890s.
   *
   * That failure is invisible from the outside: the query looks expert, the
   * search succeeds, and fifteen real books come back. Only a reader who knows
   * the genre can tell they are the wrong fifteen — which is precisely the
   * reader this feature is for.
   *
   * So the shelf is checked against the catalogue's own vocabulary rather than
   * trusted. Unknown means dropped, not corrected: the plain words survive and
   * the search degrades to what it would have been without the model, which is
   * the floor this whole feature promised never to go below.
   */
  known?: ReadonlySet<string>,
): string | null {
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

  /*
   * **Prose anywhere means the whole reply is refused, not trimmed.**
   *
   * Salvaging the good half was tried and is what let this through:
   * `subject:"Haunted houses"? Or haunted` kept a real shelf and searched the
   * rest as words. The parser cannot tell a query with a stray word in it from
   * a sentence with a query in it, and guessing wrong sends somebody a shelf
   * of the wrong books that looks like it worked.
   *
   * Sentence punctuation outside quotes is the tell — no catalogue query needs
   * `?`, `!`, `;` or a full stop. Refusing outright costs a translation the
   * caller can do without; accepting costs a search nobody can tell is wrong.
   */
  if (/[?!;](?=(?:[^"]*"[^"]*")*[^"]*$)/.test(line)) return null;

  const kept = split(line)
    /* Backticks are never part of a catalogue query, and a model asked for one
       line of syntax reaches for inline code. Observed:
       `` `subject:"Portal fantasy"` `` came back with the closing backtick
       still attached, which Google then searched for literally — one book
       returned where the clean term finds a shelf. The fence rule above only
       catches triple backticks; this catches the single ones. */
    .map((term) => term.replace(/`/g, "").trim())
    .filter(Boolean)
    .filter((term) => {
    if (!term.includes(":")) return true;
    if (!ALLOWED.test(term)) return false;
    if (!known) return true;

    // Only `subject:` is checked. A title or author is the writer's own words
    // rather than a shelf, and there is no list to check those against.
    const subject = term.match(/^subject:"?([^"]+)"?$/i);
    return subject ? known.has(subject[1].trim().toLowerCase()) : true;
  });
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
