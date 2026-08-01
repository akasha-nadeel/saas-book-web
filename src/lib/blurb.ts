import { BLURB_MAX } from "@/lib/publishing";

/**
 * The blurb workshop.
 *
 * A blurb is the two hundred words that decide whether anybody opens the book,
 * and writers say repeatedly that it is the part they are worst at. What they
 * reach for is a chatbot, and they then report that the AI-written blurb hurt
 * their sales — so this deliberately does not write one.
 *
 * **It measures, and it compares against real books.** The distinction runs
 * through the whole product: `storeReadiness()` reports and never vetoes, the
 * prose report will report and never rewrite, and this counts and never
 * composes.
 *
 * **Only two things here are called problems, and both are facts rather than
 * opinions:** an empty blurb, and one over `BLURB_MAX`, which is KDP's limit
 * and the smallest of the big shops'. Everything else is an *observation* — a
 * number, with the same number from published books beside it where we have
 * them. Nobody knows whether a writer's three-paragraph blurb is better than a
 * two-paragraph one, and a tool that claims to is doing the thing this product
 * exists not to do.
 */

export type BlurbLevel = "problem" | "note";

export interface BlurbIssue {
  level: BlurbLevel;
  /** What it is about, in the writer's words rather than a field name. */
  field: string;
  message: string;
}

export interface BlurbStats {
  characters: number;
  words: number;
  paragraphs: number;
  /** The longest paragraph, in characters. */
  longestParagraph: number;
  /** The longest sentence, in words. */
  longestSentence: number;
  /** How much of `BLURB_MAX` is used, 0–1. Over 1 is over the limit. */
  ofLimit: number;
}

export interface BlurbReport {
  stats: BlurbStats;
  issues: BlurbIssue[];
}

/**
 * A paragraph is a run of text between blank lines.
 *
 * Single newlines are *not* breaks: writers paste blurbs out of word
 * processors that hard-wrap, and treating every wrapped line as a paragraph
 * reports a four-paragraph blurb as twenty-six.
 */
export function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Titles that end in a full stop and are followed by a name.
 *
 * A list rather than a heuristic. "Do not split when the previous word is
 * short and capitalised" would also refuse to split after "It." or "He.",
 * which are how a great many sentences legitimately end. These are the ones
 * that actually turn up in blurbs.
 */
const ABBREVIATIONS = ["mr", "mrs", "ms", "dr", "prof", "st", "jr", "sr"];

/**
 * Sentences, roughly.
 *
 * Split on terminal punctuation followed by a space and a capital, minus the
 * two cases that would otherwise split mid-sentence: an honorific ("Mr. Kelly")
 * and a decimal ("3.5 million") — the second falls out for free, since a digit
 * is not an upper-case letter.
 *
 * It is not linguistics and does not need to be. The figure it feeds is "your
 * longest sentence is 41 words", which is useful when it is approximately right
 * and misleading only if it is wildly wrong.
 */
export function sentencesOf(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+(?=[“"'(\p{Lu}])/u)
    .map((s) => s.trim())
    .filter(Boolean);

  // Re-join anything the split broke off an honorific.
  const out: string[] = [];
  for (const part of parts) {
    const previous = out[out.length - 1];
    const lastWord = previous?.match(/(\p{L}+)\.$/u)?.[1]?.toLowerCase();
    if (previous && lastWord && ABBREVIATIONS.includes(lastWord)) {
      out[out.length - 1] = `${previous} ${part}`;
    } else {
      out.push(part);
    }
  }
  return out;
}

export function wordsOf(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function statsOf(blurb: string): BlurbStats {
  const text = blurb.trim();
  const paragraphs = paragraphsOf(text);
  const sentences = sentencesOf(text);

  return {
    characters: text.length,
    words: wordsOf(text),
    paragraphs: paragraphs.length,
    longestParagraph: paragraphs.reduce((max, p) => Math.max(max, p.length), 0),
    longestSentence: sentences.reduce((max, s) => Math.max(max, wordsOf(s)), 0),
    ofLimit: text.length / BLURB_MAX,
  };
}

/**
 * The report.
 *
 * `benchmark` is the median blurb length of comparable titles, from the comps
 * search. It is optional and the report is useful without it — but with it the
 * length observation stops being a bare number and becomes a comparison with
 * books that actually sold, which is the only honest way to say anything about
 * how long a blurb should be.
 *
 * `title` is the book's own title, for the one structural check worth making:
 * a blurb that opens by repeating the title spends its first and most-read line
 * on a word already printed above it.
 */
export function blurbReport(
  blurb: string,
  options: { benchmark?: number; title?: string } = {},
): BlurbReport {
  const text = blurb.trim();
  const stats = statsOf(text);
  const issues: BlurbIssue[] = [];

  // ---- The two facts ------------------------------------------------------

  if (text.length === 0) {
    issues.push({
      level: "problem",
      field: "Blurb",
      message:
        "Nothing written yet. Every shop asks for one, and it is the only part of the book most people will read.",
    });
    return { stats, issues };
  }

  if (text.length > BLURB_MAX) {
    issues.push({
      level: "problem",
      field: "Length",
      message: `${text.length.toLocaleString()} characters. The limit is ${BLURB_MAX.toLocaleString()}, so cut ${(
        text.length - BLURB_MAX
      ).toLocaleString()} and it will go through.`,
    });
  }

  // ---- Observations -------------------------------------------------------
  //
  // Notes, never problems. Each is a measurement with something to measure it
  // against, and the writer decides what it means. A blurb is a piece of
  // persuasion, and nobody — including us — knows the rule.

  if (options.benchmark && options.benchmark > 0) {
    const ratio = text.length / options.benchmark;
    if (ratio < 0.5) {
      issues.push({
        level: "note",
        field: "Length",
        message: `${text.length} characters, against ${options.benchmark} for books like yours. Shorter is not wrong, but it is unusual.`,
      });
    } else if (ratio > 1.6) {
      issues.push({
        level: "note",
        field: "Length",
        message: `${text.length} characters, against ${options.benchmark} for books like yours. Long blurbs get skimmed rather than read.`,
      });
    } else {
      issues.push({
        level: "note",
        field: "Length",
        message: `${text.length} characters, and books like yours run to about ${options.benchmark}. You are in the usual range.`,
      });
    }
  }

  if (options.title?.trim()) {
    const title = options.title.trim().toLowerCase();
    if (text.toLowerCase().startsWith(title)) {
      issues.push({
        level: "note",
        field: "Opening",
        message:
          "It opens with the title, which is already printed above it on every shop page. The first line is the one people actually read.",
      });
    }
  }

  if (stats.paragraphs === 1 && text.length > ONE_BLOCK) {
    issues.push({
      level: "note",
      field: "Shape",
      message: `One paragraph of ${text.length} characters. On a phone that is a wall of text before anyone has decided to care.`,
    });
  }

  if (stats.longestSentence > LONG_SENTENCE) {
    issues.push({
      level: "note",
      field: "Sentences",
      message: `The longest sentence runs to ${stats.longestSentence} words. A blurb is read standing up.`,
    });
  }

  const shouted = shoutedRuns(text);
  if (shouted.length > 0) {
    issues.push({
      level: "note",
      field: "Capitals",
      message: `“${shouted[0]}”${
        shouted.length > 1 ? " and others" : ""
      } in capitals. Shops render blurbs in their own type, and shouting reads as a sales page rather than as a book.`,
    });
  }

  return { stats, issues };
}

/**
 * Thresholds, and they are conventions rather than rules.
 *
 * Named and gathered here so it is obvious they were chosen rather than
 * discovered, and so anyone who disagrees can see exactly what they are
 * disagreeing with. Each only ever produces a note.
 */
const ONE_BLOCK = 600;
const LONG_SENTENCE = 45;

/**
 * Runs of shouting — two or more capitalised words in a row.
 *
 * **A single upper-case word cannot be told from shouting, so it is not
 * flagged.** NASA, FBI, USA and NOVEL have exactly the same shape, and a check
 * that calls an acronym a mistake is noise; a check that is noise gets ignored
 * along with the ones that matter.
 *
 * A *run* is unambiguous. "THE DROWNED COAST is a THRILLING new novel" is the
 * thing writers actually do to blurbs, and no acronym is three words long.
 */
function shoutedRuns(text: string): string[] {
  const runs = text.match(/\b\p{Lu}{2,}(?:[\s'-]+\p{Lu}{2,})+\b/gu) ?? [];
  return [...new Set(runs.map((r) => r.trim()))];
}
