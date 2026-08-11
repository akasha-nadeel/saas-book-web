/**
 * The seven boxes at the bottom of the KDP form.
 *
 * Amazon gives a book **three categories and seven keyword fields of fifty
 * characters each**, and the seven are the half nobody explains. They are not
 * tags and not a search — they are extra text Amazon indexes the book under, so
 * the whole game is spending fifty characters on words the listing does not
 * already carry.
 *
 * **Which is why most of them are wasted.** Amazon already indexes the title,
 * the subtitle, the author and the series name; a keyword field repeating any
 * of those buys nothing at all. A writer who puts their own title in slot one
 * has spent a seventh of their discoverability on a word they already own, and
 * nothing anywhere tells them.
 *
 * Everything here is **counted, never scored**. No "keyword strength", no
 * percentage, no traffic-light. Search volume is the number a writer actually
 * wants and it cannot be had honestly — Amazon publishes no such figure, its
 * ad API is gone, and the tools that quote one buy scraped data. A made-up
 * volume beside a real book would be the most believable invented number in
 * the app. So this reports what is in the boxes and what Amazon has said it
 * ignores, and stops there.
 *
 * Pure and store-free on purpose, like `comps.ts`: it takes the few strings it
 * needs rather than a `Book`, so it can be tested without a library.
 */

/** Amazon's own shape: seven fields, fifty characters each. */
export const SLOTS = 7;
export const SLOT_MAX = 50;

/**
 * What the listing already indexes, so a keyword repeating it is spent twice.
 *
 * Deliberately not the blurb. Amazon indexes the description too, but a blurb
 * runs to four thousand characters and half the language in it is ordinary
 * English — flagging every keyword that appears somewhere in it would flag all
 * of them, which is noise rather than advice.
 */
export interface Listing {
  title?: string;
  subtitle?: string;
  author?: string;
  series?: string;
  /**
   * The shelves chosen on this book, matched **as whole names rather than word
   * by word** — see `categorySegments`.
   */
  categories?: readonly string[];
}

/**
 * The shelf names in a chosen category, for matching against a keyword.
 *
 * **Segments, not words, and this is the decision the whole check rests on.**
 * Amazon says to avoid what the categories already carry, and its own example
 * is the category *name* repeated: a history book shelved under "19th Century
 * History" should not spend a box on "19th century history". Taken word by
 * word instead, a path like `Fiction / Mystery & Detective / Women Sleuths`
 * would flag "fiction", "mystery", "detective", "women" and "sleuths" — which
 * would condemn "cozy mystery with cats", the single best keyword a cozy
 * writer could spend a box on, and the tool would be arguing with itself.
 *
 * So a whole segment has to appear as a phrase. A shop's selector writes these
 * paths with a slash and a librarian's index with a chevron; both are split,
 * and each part is trimmed of the ampersands and commas that would break a
 * word-boundary match.
 */
function categorySegments(categories: readonly string[]): string[] {
  const parts: string[] = [];
  for (const path of categories) {
    for (const raw of path.split(/[/>›»]/)) {
      const name = raw.trim();
      /*
       * **Two words at least.** A one-word segment is "Fiction", "Mystery",
       * "Romance" — the top of every path, true of half the shop, and also an
       * ordinary word inside a keyword somebody should be allowed to write.
       * Amazon's own example of the rule is a whole shelf name, and every
       * shelf name worth flagging has more than one word in it.
       */
      if (wordsIn(name).length > 1) parts.push(name);
    }
  }
  return parts;
}

/**
 * Words Amazon states it does not want in a keyword field.
 *
 * From KDP's own guidance rather than folklore: subjective claims, statements
 * that go stale, and words about the format rather than the book. Each is
 * matched as a whole phrase, so "sale" does not fire on "salesman".
 *
 * The list is deliberately short. Every entry is something Amazon publishes a
 * rule about; a longer list guessing at what "probably hurts ranking" would be
 * the invented-number problem wearing a different hat.
 */
const REFUSED: { term: string; why: string }[] = [
  { term: "best seller", why: "a subjective claim" },
  { term: "bestseller", why: "a subjective claim" },
  { term: "best selling", why: "a subjective claim" },
  { term: "bestselling", why: "a subjective claim" },
  { term: "award winning", why: "a subjective claim" },
  { term: "new", why: "goes stale" },
  { term: "on sale", why: "goes stale" },
  { term: "free", why: "goes stale, and Amazon reads it as a price" },
  { term: "coming soon", why: "goes stale" },
  { term: "book", why: "true of everything in the shop" },
  { term: "ebook", why: "the format, not the book" },
  { term: "kindle", why: "the shop, not the book" },
  { term: "audiobook", why: "the format, not the book" },
];

export interface Slot {
  /** 0-based, as stored. The screen counts from one. */
  index: number;
  text: string;
  chars: number;
  /** Past Amazon's fifty. The field is refused, not truncated. */
  over: boolean;
}

export type Issue =
  /** Longer than the field allows. */
  | { kind: "over"; slot: number; chars: number }
  /** Quotation marks, which Amazon bans in these fields outright. */
  | { kind: "quoted"; slot: number }
  /** Words the listing already carries, so indexing them again buys nothing. */
  | { kind: "wasted"; slot: number; words: string[]; where: string }
  /** The same word spent in more than one field. */
  | { kind: "repeated"; word: string; slots: number[] }
  /** Something Amazon says it does not want. */
  | { kind: "refused"; slot: number; term: string; why: string };

export interface KeywordReport {
  slots: Slot[];
  /** How many of the seven carry anything. */
  filled: number;
  /** Worst first: a refused field costs the slot, a wasted word costs less. */
  issues: Issue[];
}

/**
 * Read the seven boxes.
 *
 * Every issue names the slot it is about, because a writer looking at seven
 * near-identical fields cannot act on "one of these repeats your title".
 */
export function keywordReport(
  keywords: readonly string[],
  listing: Listing = {},
): KeywordReport {
  const slots: Slot[] = Array.from({ length: SLOTS }, (_, index) => {
    const text = (keywords[index] ?? "").trim();
    return { index, text, chars: text.length, over: text.length > SLOT_MAX };
  });

  const issues: Issue[] = [];

  // What the listing already indexes, as a set of bare words.
  const already = new Map<string, string>();
  for (const [where, value] of [
    ["your title", listing.title],
    ["your subtitle", listing.subtitle],
    ["your author name", listing.author],
    ["your series name", listing.series],
  ] as const) {
    for (const word of wordsIn(value ?? "")) {
      if (!already.has(word)) already.set(word, where);
    }
  }

  // The shelves, kept apart from the words above because they are matched
  // whole rather than word by word.
  const shelves = categorySegments(listing.categories ?? []);

  const seen = new Map<string, number[]>();

  for (const slot of slots) {
    if (!slot.text) continue;

    if (slot.over) {
      issues.push({ kind: "over", slot: slot.index, chars: slot.chars });
    }

    if (isQuoted(slot.text)) {
      issues.push({ kind: "quoted", slot: slot.index });
    }

    const lower = slot.text.toLowerCase();
    for (const { term, why } of REFUSED) {
      if (hasPhrase(lower, term)) {
        issues.push({ kind: "refused", slot: slot.index, term, why });
      }
    }

    // Wasted words, grouped so one field reports one issue rather than four.
    const words = wordsIn(slot.text);
    const wasted: string[] = [];
    const wheres = new Set<string>();
    for (const word of words) {
      const where = already.get(word);
      if (where) {
        wasted.push(word);
        wheres.add(where);
      }
      const at = seen.get(word);
      if (at) at.push(slot.index);
      else seen.set(word, [slot.index]);
    }

    // A shelf name repeated whole. Reported through the same issue as the
    // title, because it is the same fact — this is already indexed — and the
    // screen has one sentence for it.
    const onShelf = shelves.filter((name) => hasRun(words, wordsIn(name)));
    if (onShelf.length > 0) {
      wasted.push(...onShelf.map((name) => name.toLowerCase()));
      wheres.add("your categories");
    }

    if (wasted.length > 0) {
      issues.push({
        kind: "wasted",
        slot: slot.index,
        words: [...new Set(wasted)],
        where: [...wheres].join(" and "),
      });
    }
  }

  for (const [word, at] of seen) {
    // Counted per field rather than per occurrence: a word twice in one box is
    // clumsy, a word in two boxes is a slot spent twice.
    const fields = [...new Set(at)];
    if (fields.length > 1) {
      issues.push({ kind: "repeated", word, slots: fields });
    }
  }

  return {
    slots,
    filled: slots.filter((s) => s.text !== "").length,
    // A field Amazon refuses outright costs the whole slot, so it sorts above
    // a word that merely buys nothing.
    issues: issues.sort((a, b) => rank(a) - rank(b)),
  };
}

const ORDER: Record<Issue["kind"], number> = {
  over: 0,
  // A published rule, like `refused`: the field is spoiled rather than merely
  // spent badly, so both sort above a word that only buys nothing.
  quoted: 1,
  refused: 1,
  wasted: 2,
  repeated: 3,
};

function rank(issue: Issue): number {
  return ORDER[issue.kind];
}

/**
 * Words in everybody's title, which carry no information either way.
 *
 * A list rather than a length rule, and that is the point: raising the cutoff
 * to four letters would silently drop "spy", "war", "sea" and "inn", which are
 * exactly the words a keyword field is for. Short and closed — articles,
 * conjunctions and the commonest prepositions, nothing that could ever be the
 * subject of a book.
 */
const COMMON = new Set([
  "the", "and", "for", "with", "from", "into", "onto", "out", "off",
  "her", "his", "its", "our", "their", "you", "your", "who", "what",
  "when", "where", "how", "why", "all", "any", "but", "not", "are",
  "was", "were", "been", "has", "had", "have", "that", "this", "these",
  "those", "than", "then", "there", "here",
]);

/**
 * The bare words in a string, lowercased.
 *
 * One- and two-letter words go, and so does the closed list above.
 * Apostrophes are kept inside a word so "reader's" stays one.
 */
function wordsIn(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 2 && !COMMON.has(w));
}

/** Whole-phrase match, so "sale" does not fire inside "salesman". */
function hasPhrase(haystack: string, phrase: string): boolean {
  return new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(
    haystack,
  );
}

/**
 * Does one run of words appear inside another, in order and unbroken?
 *
 * Used for shelf names, where a plain string match is too brittle: a shop
 * writes "Mystery & Detective" and a writer types "mystery detective", which
 * is the same shelf named the same way. Comparing the *word runs* both sides
 * have been reduced to lets the punctuation and the filler differ while the
 * name still has to be there whole and in order.
 */
function hasRun(words: readonly string[], run: readonly string[]): boolean {
  if (run.length === 0 || run.length > words.length) return false;
  return words.some((_, i) => run.every((word, j) => words[i + j] === word));
}

/**
 * Quotation marks, which Amazon bans in a keyword field outright.
 *
 * **Double quotes anywhere, single quotes only around the whole phrase.** An
 * apostrophe inside a word is ordinary English — "reader's choice" is a
 * keyword somebody should be allowed to write — so only a pair wrapping the
 * field counts, which is the shape somebody quoting a search term produces.
 */
function isQuoted(text: string): boolean {
  if (/["“”]/.test(text)) return true;
  const trimmed = text.trim();
  return (
    trimmed.length > 1 &&
    /^['’]/.test(trimmed) &&
    /['’]$/.test(trimmed)
  );
}
