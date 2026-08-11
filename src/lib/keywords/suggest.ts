import { keywordReport, SLOTS, SLOT_MAX, type Listing } from "@/lib/keywords";

/**
 * Candidate keywords for the seven boxes, written from what the writer already
 * typed into the listing form.
 *
 * **What this is for, and the framing is the whole design.** A shop's seven
 * keyword fields used to be matched word for word, and the tools that grew up
 * around that sell a *search volume* figure. That number is not published by
 * any shop, is bought from resellers whose figures disagree with each other,
 * and `keywords.ts` refuses to print one — a made-up volume beside a real
 * keyword would be the most believable invented number in the app.
 *
 * What changed is that the matching stopped being literal. Amazon's search now
 * carries a semantic layer that reads a listing the way a person would — who
 * this book is for, what it is like, when somebody would want it — and rewards
 * *coverage of the right ideas* rather than repetition of the right strings.
 * That is a judgement, and judgement is the one thing a model is worth paying
 * for here, exactly as it is for ranking comps.
 *
 * So this suggests **phrases that do not waste a slot**. It does not, and must
 * not, claim to suggest phrases that will sell the book. No score, no volume,
 * no rank, no ordering that implies one — a test asserts the returned shape has
 * nowhere to put such a number, which is the sibling of the test in
 * `keywords.ts` and exists for the same reason.
 *
 * **Nothing here invents a book**, which is what makes it allowed at all — the
 * failure `rank.ts` guards against cannot arise, because the output is words
 * about the writer's own description rather than a claim about somebody else's
 * title. The worst a bad suggestion can do is be unhelpful, and the parser
 * below drops most of those before anybody sees them.
 *
 * **The manuscript never goes.** What is sent is the blurb, the genre, the
 * categories and the listing's own names — all of it text the writer typed into
 * a form. That keeps this route off the short list of places prose can travel,
 * so the privacy page needs no new entry and the screen needs no "what leaves"
 * list above the button. Add a field to `buildPrompt` and that stops being
 * true; add it to the privacy page in the same commit.
 */

/** What the model is told about the book. All of it typed into form fields. */
export interface SuggestInput {
  /** The description, which is where nearly all of the signal is. */
  blurb?: string;
  genre?: string;
  /** Shelves already chosen on this screen, so it does not repeat them. */
  categories?: readonly string[];
  /** So it can avoid what the listing already indexes. */
  listing: Listing;
}

/**
 * The instructions.
 *
 * Written against what the shops' own guidance says rather than against
 * folklore, and the negative half is longer than the positive half on purpose:
 * a model asked for keywords will reach for the marketing vocabulary this
 * feature exists to keep out of the boxes.
 */
export const SYSTEM = `You write backend keyword phrases for a book's listing on Amazon (KDP).

A listing has ${SLOTS} keyword fields of ${SLOT_MAX} characters each. They are never shown to a reader; the shop indexes them, and its search reads them for meaning rather than matching them word for word. That shape is Amazon's rather than a standard, but phrases that fit it carry over to the shops that ask differently, so write to it.

Write phrases a real reader might type or say when looking for a book like this one. Prefer specific, multi-word phrases naming what the book IS: its subgenre, its setting, its tone, who it is for, what it is comparable to in kind.

Rules:
- Never repeat words the listing already carries. You are told the title, subtitle, author and series; those are already indexed and a keyword repeating them buys nothing.
- Never write a claim about the book's success or quality. No "bestselling", "award winning", "gripping", "must read".
- Never write anything that goes stale: no "new", "coming soon", "on sale", "free".
- Never name the format or the shop: no "ebook", "kindle", "paperback", "audiobook".
- Never invent something the description does not support. Everything you write has to be true of this book.
- Keep every phrase under ${SLOT_MAX} characters.
- Do not repeat a word across two phrases; each field should earn its place.

Answer with JSON only: {"keywords":["phrase","phrase",...]}. At most ${SLOTS} phrases, best first. No prose, no explanation, no code fences.`;

/** Enough for seven short phrases. Generous for Gemini, whose thinking counts. */
export const MAX_TOKENS = 700;

/** A blurb, not a manuscript. Anything longer is a paste. */
const MAX_BLURB = 2000;

export function buildPrompt(input: SuggestInput): string {
  const { blurb, genre, categories, listing } = input;
  const parts: string[] = [];

  if (genre) parts.push(`Genre: ${genre}`);
  if (categories?.length) {
    parts.push(`Shelved under: ${categories.slice(0, 6).join(", ")}`);
  }

  // The listing's own names, given so the model can avoid them. It is told what
  // these are *for*, because a list of words with no explanation reads as
  // material to work from rather than as a list to steer around.
  const owned = [listing.title, listing.subtitle, listing.author, listing.series]
    .filter((v): v is string => Boolean(v?.trim()))
    .join(" · ");
  if (owned) {
    parts.push(`Already indexed, so do not repeat these words: ${owned}`);
  }

  if (blurb?.trim()) {
    parts.push(`Description:\n${blurb.trim().slice(0, MAX_BLURB)}`);
  }

  parts.push(`Write up to ${SLOTS} keyword phrases for this book.`);
  return parts.join("\n\n");
}

/**
 * Pull the phrases out of whatever came back.
 *
 * **Generated text is hostile input**, the rule `rank.ts` was written under and
 * the reason its parser has a test per failure. The same list applies here:
 * preambles, code fences, a bare array rather than the object asked for, and
 * duplicates. The clean parse is tried first — scanning a bare array for `{`
 * finds the first *element's* brace and silently parses one item as the whole
 * reply.
 */
function phrasesIn(reply: string): string[] {
  const text = reply
    .trim()
    // Fences, with or without a language tag.
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const read = (raw: string): string[] | null => {
    try {
      const value: unknown = JSON.parse(raw);
      if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === "string");
      }
      if (value && typeof value === "object") {
        const list = (value as { keywords?: unknown }).keywords;
        if (Array.isArray(list)) {
          return list.filter((v): v is string => typeof v === "string");
        }
      }
    } catch {
      /* fall through to the scan */
    }
    return null;
  };

  const clean = read(text);
  if (clean) return clean;

  // A preamble, then the JSON. The object is tried before the array for the
  // reason above: an array's first `{` belongs to an element.
  const object = text.match(/\{[\s\S]*\}/);
  if (object) {
    const found = read(object[0]);
    if (found) return found;
  }

  const array = text.match(/\[[\s\S]*\]/);
  if (array) {
    const found = read(array[0]);
    if (found) return found;
  }

  return [];
}

/** Tidy a phrase without changing what it says. */
function tidy(phrase: string): string {
  return phrase
    .trim()
    // Numbered or bulleted, when the model has ignored the format.
    .replace(/^[-*\d.)\s]+/, "")
    // Quotes it wrapped itself in.
    .replace(/^["']|["']$/g, "")
    // Collapse whitespace, including the newlines a wrapped phrase carries.
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every phrase worth putting in a box, in the order the model ranked them.
 *
 * **The checker is the filter, and that is the point.** Each candidate is run
 * through `keywordReport` as though it were already in a box; anything that
 * raises an issue is dropped. So a suggestion can never be too long, never
 * repeat a word the title already owns and never carry a phrase the shops
 * publish a rule against — not because the prompt asked nicely, but because
 * the same function that would have flagged it on screen has already refused
 * it. A prompt is a request; this is a guarantee, and it means the two halves
 * of this feature cannot drift into disagreeing about what a good keyword is.
 *
 * **Dropped, never truncated or repaired.** A phrase cut at fifty characters
 * is a different phrase, and one with its offending word removed is a phrase
 * nobody wrote. Losing a suggestion costs a writer nothing; showing them a
 * mangled one costs them the trust the whole screen runs on.
 */
export function suggestKeywords(reply: string, listing: Listing): string[] {
  return keepUsable(phrasesIn(reply), listing);
}

/**
 * The filter itself, over phrases somebody has already pulled out of a reply.
 *
 * Split from the parser so the workshop chat can share it: that route's
 * candidates arrive inside a `<keywords>` tag rather than as JSON, and the one
 * thing that must not fork is *what counts as a usable keyword*. Two screens
 * disagreeing about that is the drift the comment above is written against.
 */
export function keepUsable(
  phrases: readonly string[],
  listing: Listing,
): string[] {
  const kept: string[] = [];
  // Case-insensitive, because "Cozy Mystery" and "cozy mystery" are one
  // suggestion and Amazon indexes them as one.
  const seen = new Set<string>();

  for (const raw of phrases) {
    const phrase = tidy(raw);
    if (!phrase) continue;

    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;

    // One candidate, checked as though it were in the first box. Words already
    // kept go in the other slots, so the report's own repeated-word rule does
    // the cross-suggestion deduplication too — there is no second notion of
    // "already said" to keep in step with the first.
    const boxes = [phrase, ...kept];
    if (keywordReport(boxes, listing).issues.length > 0) continue;

    seen.add(key);
    kept.push(phrase);
    if (kept.length === SLOTS) break;
  }

  return kept;
}
