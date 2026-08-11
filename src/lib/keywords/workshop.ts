import { SLOTS, SLOT_MAX, type Listing } from "@/lib/keywords";

/**
 * A conversation about the seven keyword boxes.
 *
 * **Two jobs in one box, and the second is why the first is allowed.** Half of
 * what a writer needs here is *explanation* — what these boxes are, where they
 * go, what a shop refuses — and explanation is documentation, which this app
 * gives away in the Help dialog and in the sentences on the screen. A model
 * charging by the turn to restate a fixed paragraph would be the worst deal in
 * the product. The other half is *judgement*: which seven, for this book,
 * given what is already in the title and on the shelves — and that cannot be
 * written down in advance, because it depends on the manuscript's own subject.
 * So the chat answers questions freely, and the value it is actually paid for
 * is the deciding.
 *
 * Four things hold it, and they are the blurb workshop's four, pointed at a
 * different form field:
 *
 * - **Candidates are tagged, not guessed at.** `<keywords>` is a signal the
 *   model either sends or does not, so a turn that answers a question simply
 *   has no button under it. Every heuristic for "was that a suggestion?" is
 *   wrong somewhere: a good answer to "why is box 3 wasted?" looks exactly
 *   like a list of replacements.
 * - **The checker is still the filter.** Everything the tag carries goes
 *   through `keepUsable`, which runs each phrase through `keywordReport` as
 *   though it were already in a box. A prompt is a request; that is a
 *   guarantee, and it is what stops the chat offering a phrase the seven boxes
 *   underneath it would immediately flag.
 * - **Nothing reaches the book without a press.** Candidates land in the
 *   *draft*, in empty boxes only, and the save bar is what commits them.
 * - **The rules are given, not recalled.** The system prompt states Amazon's
 *   own numbers and prohibitions, so an answer about them is grounded in what
 *   was checked rather than in whatever the model remembers about a form that
 *   has changed several times.
 *
 * **The manuscript does not go.** What leaves is the conversation, the blurb,
 * the genre, the categories, the listing's own names and the seven boxes as
 * they stand — all of it typed into form fields. That keeps this off the short
 * list of routes that carry prose. Add a field and `/privacy` needs a line in
 * the same commit.
 */

/** One turn. The same shape the assistant and the blurb workshop keep. */
export interface KeywordMessage {
  role: "user" | "assistant";
  content: string;
}

export interface KeywordWorkshopInput {
  messages: readonly KeywordMessage[];
  /** The description, which is where nearly all of the signal is. */
  blurb?: string;
  genre?: string;
  /** Shelves already chosen on the screen. */
  categories?: readonly string[];
  /** The names a shop indexes anyway. */
  listing: Listing;
  /** The seven as they stand, so "help me fill the last two" can be answered. */
  keywords?: readonly string[];
}

/** Room for an answer and seven phrases, with Gemini's thinking on top. */
export const MAX_TOKENS = 1200;

/** A blurb, not a manuscript. Anything longer is a paste. */
const MAX_BLURB = 2000;

/**
 * The instructions.
 *
 * The facts in here were checked against KDP's own help pages rather than
 * against the folklore that surrounds this subject, and they are stated to the
 * model because it will otherwise answer from a version of the form that no
 * longer exists. The prohibitions are longer than the guidance, as in
 * `suggest.ts`, for the same reason: asked about keywords, a model reaches
 * first for the marketing vocabulary this whole screen exists to keep out.
 *
 * **The refusal of a search volume is the load-bearing one.** It is the figure
 * a writer wants, no shop publishes it, and a plausible number beside a real
 * keyword would be the most believable invented thing in the app.
 */
export const WORKSHOP_SYSTEM = `You are helping a writer decide the seven backend keyword fields on their book's listing at Amazon (KDP). You are in a conversation with them.

What is true of these fields, so you answer from this rather than from memory:
- There are ${SLOTS} of them, ${SLOT_MAX} characters each. They are filled in on Amazon's own listing form, not in the book file, and can be changed later without re-uploading anything.
- ${SLOTS} boxes of ${SLOT_MAX} characters is Amazon's shape and not a standard. Kobo has a single keywords field, Apple Books has no keyword field at all, Draft2Digital takes one longer list, and IngramSpark works from BISAC subject codes instead. Categories differ too: most of the trade uses BISAC, and Amazon left BISAC for a tree of its own in 2023. If you are asked about a shop that is not Amazon, say what little is certain and say you are not sure of the rest — do NOT assume Amazon's rules apply to it.
- Readers never see them. Only the shop's search reads them.
- A field holds a phrase, not a single tag. Two or three words is what the shop itself recommends.
- The order of the fields does not matter, and the words inside a field are matched in combinations, so there is no point spending two fields on rearrangements of the same words.
- Commas are not needed inside a field, and quotation marks are refused outright.
- The title, subtitle, author name, series and description are already indexed. A keyword repeating any of them buys nothing.
- The shop refuses: claims about quality ("bestselling", "award winning"), anything that goes stale ("new", "on sale", "free"), the format or the shop itself ("ebook", "kindle", "paperback"), words already in the chosen categories, other authors' names, brands the writer does not own, misspellings, and HTML.
- Search on these shops is no longer literal string matching; it reads a listing for meaning. Covering the right ideas is worth more than repeating the right strings, and stuffing is less effective than it used to be.
- A few subcategories can only be reached through these fields rather than through the category selector. The shop publishes which words those are, genre by genre, and changes them.

Hard rules:
- NEVER give a search volume, a competition score, a difficulty rating, a rank, or any number describing how much traffic a keyword gets. No shop publishes those figures and you do not have them. If asked, say so plainly and say what can be checked instead.
- NEVER list the specific words that unlock a gated subcategory. Those lists change and are published per genre; point the writer at the shop's own keyword help page instead.
- NEVER state a fact about this book the writer has not given you. If you need to know something, ask.
- Do not claim to know what any book is ranking for, selling, or earning.

Offering candidates:
- When you have enough to suggest phrases, put them on their own, wrapped in <keywords> and </keywords>, one phrase per line, nothing else inside those tags. No numbering, no quotes, no commentary in there.
- Suggest at most ${SLOTS}, best first, each under ${SLOT_MAX} characters.
- Everything you suggest has to be true of this book as described. A suggested subject the book does not contain is a rule broken, not merely bad advice: the shop asks that the keywords, title and description describe the same book.
- If the writer is asking a question rather than asking for phrases, just answer it. No tags.

Talk like a person who has filled this form in many times. Short replies, plain words. No headings, no bullet lists unless the writer asks for a list.`;

/**
 * The conversation, flattened into one prompt.
 *
 * A single string rather than a message array, because `askModel` takes a
 * system prompt and one user message and is the only path that works on both
 * providers — the same trade `blurb-workshop.ts` documents.
 */
export function buildWorkshopPrompt(input: KeywordWorkshopInput): string {
  const { blurb, genre, categories, listing, keywords, messages } = input;
  const parts: string[] = [];

  const owned = [listing.title, listing.subtitle, listing.author, listing.series]
    .filter((v): v is string => Boolean(v?.trim()))
    .join(" · ");
  parts.push(
    owned
      ? `Already indexed, so keywords must not repeat these words: ${owned}`
      : "The book has no title or author set yet.",
  );

  if (genre) parts.push(`Genre: ${genre}`);
  if (categories?.length) {
    parts.push(`Shelved under: ${categories.slice(0, 8).join(", ")}`);
  }

  if (blurb?.trim()) {
    parts.push(`Description:\n${blurb.trim().slice(0, MAX_BLURB)}`);
  } else {
    parts.push("There is no description written yet.");
  }

  // The boxes as they stand, numbered, so "the last two" and "box 4" mean
  // something. An empty set is said in words rather than as seven blank lines.
  const filled = (keywords ?? [])
    .map((text, i) => ({ n: i + 1, text: (text ?? "").trim() }))
    .filter((k) => k.text);
  parts.push(
    filled.length > 0
      ? `The seven boxes so far:\n${filled.map((k) => `${k.n}. ${k.text}`).join("\n")}`
      : "All seven boxes are empty.",
  );

  parts.push(
    "The conversation so far:\n\n" +
      messages
        .map((m) => `${m.role === "user" ? "Writer" : "You"}: ${m.content.trim()}`)
        .join("\n\n"),
  );

  parts.push("Reply as yourself, continuing the conversation.");

  return parts.join("\n\n");
}

/**
 * The phrases a reply is offering, if it is offering any.
 *
 * Generated text is hostile input, so the tag is not trusted to be well formed:
 * unclosed, duplicated, fenced, numbered and quoted all have tests. Null when
 * there is no tag at all, which is what makes the **Use these** button absent
 * rather than empty — the same distinction `extractDraft` draws.
 *
 * Splitting on commas as well as newlines is deliberate. The prompt asks for
 * one per line and mostly gets it; a comma inside a keyword is nothing anybody
 * needs, since the shop wants the words on their own.
 */
export function extractKeywords(reply: string): string[] | null {
  const match = reply.match(/<keywords>([\s\S]*?)<\/keywords>/i);
  if (!match) return null;

  const inside = match[1]
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const phrases = inside
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return phrases.length > 0 ? phrases : null;
}

/**
 * The reply with the tag taken out, for the bubble.
 *
 * The candidates are drawn as their own list with a button under them, so
 * leaving the raw tag in would show them twice — once as markup a reader has
 * to decode, once properly. An unclosed tag would otherwise strand the whole
 * tail of the message in the bubble, hence the second pass.
 */
export function replyWithoutKeywords(reply: string): string {
  return reply
    .replace(/<keywords>[\s\S]*?<\/keywords>/gi, "")
    .replace(/<\/?keywords>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * What the chat opens with.
 *
 * **Two of each job, in the order somebody meets them.** An empty chat box
 * teaches nothing; these four say in one glance that the thing will explain
 * the form *and* help fill it, which is the whole reason it replaced a button
 * that only did the second.
 */
export const STARTERS = [
  "What are these seven boxes for?",
  "Suggest seven from my blurb.",
  "What will Amazon refuse?",
  "Help me fill the empty ones.",
] as const;
