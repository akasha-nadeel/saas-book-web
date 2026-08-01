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
}

export interface ProseReport {
  words: number;
  sentences: number;
  paragraphs: number;
  /** Words per sentence, averaged. */
  averageSentence: number;
  longestSentence: number;
  findings: Finding[];
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
    });
  }

  // ---- Repeated openers ---------------------------------------------------
  const runs: string[] = [];
  let run = 1;
  for (let i = 1; i < sentences.length; i++) {
    const here = opener(sentences[i]);
    if (here && here === opener(sentences[i - 1])) {
      run++;
      if (run === 3) runs.push(here);
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
    });
  }

  // ---- Long sentences -----------------------------------------------------
  const lengths = sentences.map((s) => words(s).length);
  const longest = lengths.reduce((max, n) => Math.max(max, n), 0);
  const veryLong = lengths.filter((n) => n > 45).length;
  if (veryLong > 0) {
    findings.push({
      id: "long",
      label: "Sentences over 45 words",
      count: veryLong,
      note: "Long sentences are a style, not a mistake. They are worth knowing about because a reader's patience for them is not evenly spread through a chapter.",
      examples: [],
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
    findings,
  };
}
