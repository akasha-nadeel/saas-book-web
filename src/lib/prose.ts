/**
 * A report on the prose. Never an edit of it.
 *
 * From the research, the craft complaint: *"Grammar, punctuation, language
 * registers, paragraphing, dialogue tags/action beats, plot holes."* And beside
 * it, the exhaustion: *"When you're a writer, every YouTube ad is Grammarly"*,
 * and *"Microsoft Word AI made 150 corrections but almost every change caused
 * the writing to be more bland."*
 *
 * So this counts and never corrects. It is the `storeReadiness()` pattern
 * pointed at prose instead of metadata: here is what is in your chapter, in
 * numbers, and the decision is yours. That is not modesty — it is the only
 * version of this feature that does not contradict the assistant having no
 * write access to the manuscript.
 *
 * **There is no score.** No number out of a hundred, no grade, no "readability
 * rating". Every one of those is invented to look like an answer, and prose is
 * the last place a made-up number belongs. What is here is countable: how many
 * dialogue tags are something other than "said", how many sentences begin the
 * same way in a row, how far apart a distinctive word repeats.
 *
 * **Every convention below is named as a convention.** Adverbs are not a fault.
 * Filter words are not a fault. Long sentences are not a fault. They are things
 * writers are widely advised about, and the useful service is telling somebody
 * where theirs are — not deciding for them whether it matters.
 */

/** Tags that are not "said". A convention, and a contested one. */
const SAID_ALTERNATIVES = [
  "exclaimed", "retorted", "opined", "chuckled", "laughed", "smiled",
  "grinned", "hissed", "spat", "growled", "barked", "quipped", "mused",
  "declared", "proclaimed", "interjected", "queried", "responded",
  "articulated", "voiced", "uttered", "remarked", "commented", "stated",
];

/**
 * Words that put a camera between the reader and the scene.
 *
 * "She saw the door open" against "the door opened". Both are correct English;
 * one has a narrator in it. Widely taught, widely argued about, and exactly the
 * kind of thing a writer wants pointed at rather than changed.
 */
const FILTER_WORDS = [
  "saw", "heard", "felt", "noticed", "realised", "realized", "thought",
  "wondered", "watched", "seemed", "decided", "knew", "observed",
];

/** One sentence, with its length — the unit of everything below. */
export interface Passage {
  text: string;
  words: number;
  /**
   * The word this sentence was pulled out for, so the screen can mark it.
   *
   * **A word on its own is not a finding.** "You used 'felt' twice" cannot be
   * acted on: the decision is "She felt the cold" against "the cold got in",
   * and that is a judgement about a *sentence*. A writer handed the bare word
   * has to go and search their own chapter for it, which is the work the report
   * was supposed to have done.
   */
  mark?: string;
}

/**
 * The sentences a word appears in, at most `limit` of them.
 *
 * Whole-word and case-insensitive, matching how the counts above are taken, so
 * the sentences shown are the same occurrences that were counted rather than a
 * second, looser search that could disagree with its own total.
 */
function passagesFor(
  rhythm: readonly Passage[],
  terms: readonly string[],
  limit: number,
): Passage[] {
  const out: Passage[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const pattern = new RegExp(`\\b${term}\\b`, "i");
    for (const sentence of rhythm) {
      if (out.length >= limit) return out;
      if (seen.has(sentence.text) || !pattern.test(sentence.text)) continue;
      seen.add(sentence.text);
      out.push({ ...sentence, mark: term });
    }
  }
  return out;
}

/** How many sentences a word-counting finding shows. Enough to judge by. */
const PASSAGE_LIMIT = 6;

/**
 * Words that repeat because English repeats them.
 *
 * Not a judgement about writing — "the" appearing nine times in a paragraph is
 * the language working. The echo check is looking for the *distinctive* word a
 * writer reached for twice without noticing, and every function word left in
 * would bury it.
 *
 * Deliberately short. A long list starts excluding real echoes — a character
 * name repeated eleven times in a page is worth seeing, and so is "salt" in a
 * book called The Salt Ledger — and the writer is the one who decides whether
 * a repetition is deliberate. This only removes the words nobody chooses.
 */
const COMMON = new Set([
  "about", "after", "again", "against", "all", "also", "and", "any", "are",
  "back", "because", "been", "before", "being", "both", "but", "came", "can",
  "come", "could", "did", "does", "down", "each", "even", "ever", "every",
  "for", "from", "get", "going", "gone", "got", "had", "has", "have", "her",
  "here", "hers", "him", "his", "how", "into", "its", "itself", "just",
  "like", "made", "make", "many", "may", "might", "more", "most", "much",
  "must", "not", "now", "off", "once", "one", "only", "onto", "other", "our",
  "out", "over", "own", "put", "said", "same", "she", "should", "since",
  "some", "still", "such", "take", "than", "that", "the", "their", "them",
  "then", "there", "these", "they", "thing", "think", "this", "those",
  "though", "through", "time", "too", "took", "under", "until", "upon",
  "very", "want", "was", "way", "well", "went", "were", "what", "when",
  "where", "which", "while", "who", "why", "will", "with", "would", "you",
  "your",
]);

/**
 * How close two uses have to be to be heard as an echo, in words.
 *
 * About a paragraph. Further apart than this and a repeated word is a motif or
 * a coincidence rather than the thing a reader trips over; closer, and it is
 * the sort of repetition that is inaudible while writing and obvious the moment
 * anybody reads the page aloud.
 */
export const ECHO_WINDOW = 60;

/** A word this writer used twice without noticing, and where. */
export interface Echo {
  word: string;
  count: number;
}

/**
 * Words repeated close enough together to be heard.
 *
 * **The pain this answers is the one every source names and no count of adverbs
 * touches.** Writers unconsciously repeat their favourite words; the repetition
 * is invisible on the screen and unmistakable when the page is read aloud,
 * because the ear catches what the eye scans straight past. It is the flagship
 * of the two editing tools built for novelists — ProWritingAid calls it echo
 * detection, AutoCrit calls it the repetition report — and it is the clearest
 * case there is of a machine seeing something a writer structurally cannot.
 *
 * It is also exactly the shape this app is allowed to work in: a measurement,
 * not an opinion. Repetition is a real device, and a writer repeating a word
 * for effect is doing their job. So this says *what* and *where*, and nothing
 * about whether it should stay.
 */
export function echoes(text: string, window = ECHO_WINDOW): Echo[] {
  const tokens = text
    .toLocaleLowerCase()
    .split(/[^\p{L}']+/u)
    .filter(Boolean);

  const seen = new Map<string, number[]>();
  tokens.forEach((token, i) => {
    // Under four letters is almost entirely pronouns and articles, and the
    // ones that are not are rarely distinctive enough to hear.
    if (token.length < 4 || COMMON.has(token)) return;
    const at = seen.get(token);
    if (at) at.push(i);
    else seen.set(token, [i]);
  });

  const found: Echo[] = [];
  for (const [word, positions] of seen) {
    if (positions.length < 2) continue;
    // Only the uses that are near another use count — a word appearing on page
    // one and again on page nine is not an echo, and counting all nine would
    // overstate what the writer is being shown.
    const close = positions.filter(
      (at, i) =>
        (i > 0 && at - positions[i - 1] <= window) ||
        (i < positions.length - 1 && positions[i + 1] - at <= window),
    );
    if (close.length >= 2) found.push({ word, count: close.length });
  }

  // Most repeated first, then alphabetically so the order is stable between
  // runs on the same chapter.
  return found.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export interface Finding {
  id: string;
  label: string;
  /** How many times. */
  count: number;
  /** Per 1,000 words, where a rate is more use than a total. */
  per1000?: number;
  /** What it is, and why anybody mentions it. Never what to do about it. */
  note: string;
  /** A few real occurrences, so the writer can go and look. */
  examples: string[];
  /**
   * The bare words behind `examples`, where the two differ.
   *
   * An echo reads as "grey ×3", which is the useful thing to show and the wrong
   * thing to search for. Parallel to `examples` by index; absent means the two
   * are the same, which is true of every other finding.
   */
  terms?: string[];
  /**
   * The sentences themselves, where a *sentence* is the unit rather than a word.
   *
   * **A count the writer cannot act on is trivia**, and "sentences over 45
   * words" shipped with an empty `examples` for its whole life: it said three
   * existed and showed none of them, which is the one finding here where seeing
   * the instance is the entire point. Every tool this screen is measured
   * against — Hemingway, ProWritingAid, and the audit reports outside writing
   * software — pairs the count with the thing counted.
   *
   * Only where it earns its place. Twelve adverbs are twelve *words*, and
   * twelve sentences to carry them is a wall rather than a finding, so those
   * stay in `examples` and are drawn as chips.
   */
  passages?: Passage[];
}

export interface ProseReport {
  words: number;
  sentences: number;
  paragraphs: number;
  /** Words per sentence, averaged. */
  averageSentence: number;
  longestSentence: number;
  /**
   * Every sentence, in reading order.
   *
   * **The order is the information.** A distribution would say how long the
   * sentences are; this says where they fall, which is the thing a writer
   * cannot see from inside the draft — three long ones together read as a wall
   * no matter how ordinary the average is. `sentences` and `longestSentence`
   * are both derivable from it and both keep their old meaning, so nothing that
   * already reads this report has to change.
   */
  rhythm: Passage[];
  findings: Finding[];
}

/** Above this a sentence is long enough to be worth pointing at. */
export const LONG_SENTENCE = 45;

/**
 * Whether a finding is worth a writer's attention, or merely true.
 *
 * **A count of one is not a finding.** Every one of these fired the moment it
 * saw a single occurrence, so a chapter with one adverb in six hundred words
 * got a full card, a heading, a rate and a paragraph explaining that one adverb
 * is not a problem — the app taking up a row of the page to say nothing. Worse,
 * it said it at exactly the volume of the finding beside it that *did* matter.
 * When everything is raised, nothing is.
 *
 * The honest test is the one the comparison already makes possible: **is this
 * chapter unlike the rest of this book?** A rate at or under the writer's own
 * average is the writer writing normally, which is not news. Above it, they are
 * doing something here they do not do elsewhere — and whether that is right is
 * theirs to say, which is why this decides what gets a *card* and never what
 * gets a verdict.
 *
 * Two things stay notable whatever the rate. A finding with no rate at all —
 * repeated openers, sentences over the line — is structural rather than
 * statistical: three sentences opening the same way is worth seeing once, and
 * there is no per-thousand figure to compare. And with nothing to compare
 * against — one chapter, or no book average — everything is shown, because
 * quieting a finding on the strength of a comparison that was not made would be
 * hiding it.
 */
export function isNotable(finding: Finding, bookRate?: number): boolean {
  if (finding.per1000 === undefined) return true;
  if (bookRate === undefined) return true;
  return finding.per1000 > bookRate;
}

/**
 * The same rates across a whole book, so a chapter can be read against it.
 *
 * **The only comparison this app is able to make honestly.** "1.5 per 1,000
 * words" on its own is a number nobody can place — the note under it has to
 * spend three lines saying the count means nothing by itself, which is true and
 * is also an admission that the figure was not much use. A benchmark against
 * *good prose* would be invented, and inventing benchmarks is the thing this
 * screen exists in opposition to.
 *
 * A writer's own average across their own chapters is measured, carries its
 * provenance, and answers the question they actually have: is this chapter
 * unusual **for me**? Which is the only version of the question that has an
 * answer.
 *
 * Summed rather than run over the joined text: chapter boundaries are real, and
 * concatenating them would invent sentences that straddle two chapters.
 */
export function combinedRates(
  reports: readonly ProseReport[],
): Record<string, number> {
  const words = reports.reduce((sum, r) => sum + r.words, 0);
  if (words === 0) return {};

  const counts = new Map<string, number>();
  for (const report of reports) {
    for (const finding of report.findings) {
      counts.set(finding.id, (counts.get(finding.id) ?? 0) + finding.count);
    }
  }

  const rates: Record<string, number> = {};
  for (const [id, count] of counts) {
    rates[id] = Math.round((count / words) * 1000 * 10) / 10;
  }
  return rates;
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/** Sentences, roughly — see the note on the same job in `blurb.ts`. */
export function sentencesIn(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The first word of a sentence, lower-cased and stripped of dialogue marks.
 *
 * Openings are compared to find runs of sentences that start the same way,
 * which is the commonest invisible tic in a draft — five paragraphs beginning
 * "She" is obvious on a page and impossible to notice while writing.
 */
function opener(sentence: string): string {
  const first = sentence.replace(/^[“"'‘(\s]+/, "").split(/\s+/)[0] ?? "";
  return first.toLocaleLowerCase().replace(/[^\p{L}']/gu, "");
}

export function proseReport(text: string): ProseReport {
  const clean = text.trim();
  const allWords = words(clean);
  const sentences = sentencesIn(clean);
  const paragraphs = clean.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const per = (n: number) =>
    allWords.length > 0
      ? Math.round((n / allWords.length) * 1000 * 10) / 10
      : 0;

  const findings: Finding[] = [];
  const lower = clean.toLocaleLowerCase();

  // Measured once, in reading order, and reused by the long-sentence finding
  // below as well as by the rhythm the screen draws.
  const rhythm: Passage[] = sentences.map((text) => ({
    text,
    words: words(text).length,
  }));

  // ---- Dialogue tags ------------------------------------------------------
  const saidCount = (lower.match(/\bsaid\b/g) ?? []).length;
  const alternatives: string[] = [];
  for (const tag of SAID_ALTERNATIVES) {
    const hits = lower.match(new RegExp(`\\b${tag}\\b`, "g")) ?? [];
    for (let i = 0; i < hits.length; i++) alternatives.push(tag);
  }
  if (alternatives.length > 0) {
    findings.push({
      id: "tags",
      label: "Dialogue tags other than “said”",
      count: alternatives.length,
      note: `“Said” disappears when read; the alternatives do not, which is either the effect you want or one you did not notice. You used “said” ${saidCount} time${saidCount === 1 ? "" : "s"}.`,
      examples: [...new Set(alternatives)].slice(0, 6),
      passages: passagesFor(rhythm, [...new Set(alternatives)], PASSAGE_LIMIT),
    });
  }

  // ---- Adverbs ------------------------------------------------------------
  const adverbs = clean.match(/\b\p{L}+ly\b/gu) ?? [];
  if (adverbs.length > 0) {
    findings.push({
      id: "adverbs",
      label: "Words ending in “-ly”",
      count: adverbs.length,
      per1000: per(adverbs.length),
      note: "Not a fault, and the count says nothing on its own. It is here because a draft can carry far more than its writer thinks, and this is the cheapest way to find out.",
      examples: [...new Set(adverbs.map((a) => a.toLocaleLowerCase()))].slice(0, 8),
      passages: passagesFor(
        rhythm,
        [...new Set(adverbs.map((a) => a.toLocaleLowerCase()))],
        PASSAGE_LIMIT,
      ),
    });
  }

  // ---- Filter words -------------------------------------------------------
  const filters: string[] = [];
  for (const word of FILTER_WORDS) {
    const hits = lower.match(new RegExp(`\\b${word}\\b`, "g")) ?? [];
    for (let i = 0; i < hits.length; i++) filters.push(word);
  }
  if (filters.length > 0) {
    findings.push({
      id: "filters",
      label: "Filter words",
      count: filters.length,
      per1000: per(filters.length),
      note: "“She saw the door open” against “the door opened”. Both are correct; one has a narrator standing in front of the scene. Sometimes that is the point.",
      examples: [...new Set(filters)].slice(0, 8),
      passages: passagesFor(rhythm, [...new Set(filters)], PASSAGE_LIMIT),
    });
  }

  // ---- Repeated openers ---------------------------------------------------
  const runs: string[] = [];
  /* The sentences of the first such run, so "where" is answerable rather than
     merely promised — the note says "it just says where", and until now the
     only thing it said was which word. */
  const runPassages: Passage[] = [];
  let run = 1;
  for (let i = 1; i < sentences.length; i++) {
    const here = opener(sentences[i]);
    if (here && here === opener(sentences[i - 1])) {
      run++;
      if (run === 3) {
        runs.push(here);
        if (runPassages.length === 0) {
          runPassages.push(rhythm[i - 2], rhythm[i - 1], rhythm[i]);
        }
      }
    } else {
      run = 1;
    }
  }
  if (runs.length > 0) {
    findings.push({
      id: "openers",
      label: "Three or more sentences starting the same way",
      count: runs.length,
      note: "Obvious on a printed page and nearly impossible to notice while writing. Deliberate repetition is a real device — this cannot tell the difference, so it just says where.",
      examples: [...new Set(runs)].slice(0, 6),
      passages: runPassages,
    });
  }

  // ---- Echoes -------------------------------------------------------------
  const heard = echoes(clean);
  if (heard.length > 0) {
    findings.push({
      id: "echoes",
      label: "Words repeated close together",
      count: heard.length,
      note: "Every writer has words they reach for twice without noticing. They are invisible on the screen and unmistakable when the page is read aloud, which is the one thing a machine can do here that you cannot do for your own draft. Repetition is also a real device — this cannot tell which is which, so it only says where.",
      examples: heard.slice(0, 8).map((e) => `${e.word} ×${e.count}`),
      terms: heard.slice(0, 8).map((e) => e.word),
      passages: passagesFor(
        rhythm,
        heard.slice(0, 4).map((e) => e.word),
        PASSAGE_LIMIT,
      ),
    });
  }

  // ---- Long sentences -----------------------------------------------------
  const longest = rhythm.reduce((max, s) => Math.max(max, s.words), 0);
  /* Longest first: a writer reading three of these wants the worst offender at
     the top, not whichever happened to come first in the chapter. */
  const veryLong = rhythm
    .filter((s) => s.words > LONG_SENTENCE)
    .sort((a, b) => b.words - a.words);
  if (veryLong.length > 0) {
    findings.push({
      id: "long",
      label: `Sentences over ${LONG_SENTENCE} words`,
      count: veryLong.length,
      note: "Long sentences are a style, not a mistake. They are worth knowing about because a reader's patience for them is not evenly spread through a chapter.",
      examples: [],
      passages: veryLong,
    });
  }

  return {
    words: allWords.length,
    sentences: sentences.length,
    paragraphs,
    averageSentence:
      sentences.length > 0
        ? Math.round((allWords.length / sentences.length) * 10) / 10
        : 0,
    longestSentence: longest,
    rhythm,
    findings,
  };
}
