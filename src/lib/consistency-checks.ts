/**
 * What each consistency check is called, and what colour it wears.
 *
 * `consistency.ts` is the judgement and this is the presentation of it, kept
 * apart for the reason `panel-tabs.ts` is kept apart from `library-store.ts`:
 * two components need these words, neither may import the other, and the
 * engine has no business holding a hex value.
 *
 * **Both halves used to be duplicated.** An identical `LABELS` map sat at the
 * foot of `consistency-page.tsx` and again at the head of
 * `consistency-panel.tsx`, and `HUES` lived privately in the panel where the
 * page could not see it — so the two screens could disagree about what a check
 * is called, and the full page could not draw a check's colour at all.
 *
 * `Record<CheckId, …>` rather than an array of objects, so a seventh check
 * added to the engine and forgotten here is a **compile error** rather than a
 * card that silently never draws. `ALL_CHECKS` supplies the order, and comes
 * from the engine because the engine is what emits in it.
 */

import { ALL_CHECKS, type CheckId } from "./consistency-ids";

/** The three headings the choice cards sit under. */
export type CheckGroup = "spelling" | "punctuation" | "format";

/**
 * The groups, in the order they are read, with the words for each.
 *
 * Ten cards in one flat grid is four rows on the full page and a long scroll in
 * the panel before the writer reaches the Run button. Three short groups is the
 * same ten cards with somewhere to look.
 */
export const CHECK_GROUPS: readonly { id: CheckGroup; name: string }[] = [
  { id: "spelling", name: "Spelling" },
  { id: "punctuation", name: "Punctuation" },
  { id: "format", name: "Format" },
];

export interface CheckLook {
  /** The card's title, and the eyebrow over a finding. */
  name: string;
  /** One line under it on the choice card. An example, never an instruction. */
  hint: string;
  /**
   * What this check is looking for, shown when it comes back with nothing.
   *
   * **Every check already had an explanation and none of it was reachable.**
   * `NAME_NOTE`, `QUOTE_NOTE` and the rest in `consistency.ts` are attached to a
   * *finding*, so they appear only when something was found — invisible in the
   * one case where the writer is actually asking a question. A writer who typed
   * `kamal` three times and `camal` once got "Nothing came back" and no way to
   * learn that the check reads capitals only.
   *
   * It is also the house rule pointed at this screen: an empty result carries
   * its provenance, and naming what was looked for is that provenance.
   *
   * **Thresholds are written as words here rather than imported.** This module
   * imports nothing but `consistency-ids` on purpose — the pricing rows and the
   * picker must not pull in the engine's three word lists — so
   * `consistency-checks.test.ts` pins the numbers against the constants
   * instead, the way `launch.test.ts` pins the book limit against its migration.
   */
  looksFor: string;
  /**
   * What it deliberately leaves alone.
   *
   * The half that surprises people, and the half that makes a silent check
   * legible: every refusal here is a decision taken in `consistency.ts` with its
   * reasoning beside it, and a writer who does not know about it reads the
   * silence as a broken tool.
   */
  ignores: string;
  /** Which heading its card sits under. */
  group: CheckGroup;
  /**
   * The check's hue.
   *
   * **Mixed into theme tokens at the call site, never painted flat** — see
   * `finding-card.tsx`. That is what lets one value be a pale card by day and a
   * deep one at night without a second table, and it is the same trick
   * `tool-marks.tsx` uses for its sixteen tiles.
   */
  hue: string;
}

/**
 * The six, in the order they are read in.
 *
 * The hues are the ones the panel has carried since it was written; what
 * changed is that the page can see them too. They spend colour, which the house
 * rule normally reserves for the accent — the precedent is the tool marks, and
 * the argument is the same: this is a screen where the *kind* of thing is what a
 * reader sorts by first, and six greys sort into nothing.
 *
 * **The ink mixed from these is set by the weakest of the six, not by each.**
 * Amber is the palest against a white ground and teal and emerald are close
 * behind, so the percentages in `finding-card.tsx` are the ones that keep *that*
 * hue legible. Adding a seventh, or changing one of these, means re-measuring
 * there rather than only here.
 */
export const CHECK_LOOK: Record<CheckId, CheckLook> = {
  names: {
    name: "A name spelled two ways",
    hint: "Katherine in chapter one, Catherine in chapter thirty.",
    looksFor:
      "Two capitalised spellings of one name, a letter apart, where the " +
      "common one is used at least 8 times and at least 4 times as often as " +
      "the rare one.",
    ignores:
      "Lower-case words. Two spellings that share a sentence. A first letter " +
      "English does not swap — Katherine and Catherine, but not Ben and Ken.",
    group: "spelling",
    hue: "#10b981",
  },
  spelling: {
    name: "British and American",
    hint: "colour and color, both in one book.",
    looksFor:
      "Both halves of a known pair in one book — colour and color, realise " +
      "and realize, travelled and traveled.",
    ignores:
      "A book that uses one side only. Pairs where the two spellings mean " +
      "different things in their own right.",
    group: "spelling",
    hue: "#8b5cf6",
  },
  style: {
    name: "A word written two ways",
    hint: "email and e-mail, alright and all right.",
    looksFor:
      "Both forms of a house-style pair — email and e-mail, alright and all " +
      "right, toward and towards.",
    ignores: "Anything outside its table. A book settled on one form.",
    group: "spelling",
    hue: "#ea580c",
  },
  typos: {
    name: "A near-miss of a word you use",
    hint: "aetherius once, aetherium forty times.",
    looksFor:
      "A word used once or twice, one letter from a word this book uses " +
      "often, and in no dictionary.",
    ignores:
      "Ordinary English, however unusual. A near-miss used often, which reads " +
      "as a second word of its own.",
    group: "spelling",
    hue: "#65a30d",
  },
  quotes: {
    name: "Quotation marks",
    hint: "Typewriter marks among typographic ones.",
    looksFor:
      "Typewriter marks and typographic ones both in one book. Apostrophes " +
      "are counted as a separate question.",
    ignores: "A book that prints one kind throughout.",
    group: "punctuation",
    hue: "#3b82f6",
  },
  unclosed: {
    name: "A quotation mark left open",
    hint: "A paragraph of speech that never closes.",
    looksFor:
      "A paragraph with an odd number of double quotation marks that does " +
      "not itself open a run of speech.",
    ignores:
      "Speech running over several paragraphs, which opens each and closes " +
      "only the last. Books that set dialogue in single quotes or with " +
      "dashes are not read at all.",
    group: "punctuation",
    hue: "#14b8a6",
  },
  doubled: {
    name: "A word typed twice",
    hint: "The same word, twice in a row.",
    looksFor: "The same word twice in a row, with a single space between them.",
    ignores:
      "Pairs that are meant, like had had. A capital on the second — New New " +
      "York. Anything with punctuation between, like No, no.",
    group: "punctuation",
    hue: "#ec4899",
  },
  hyphens: {
    name: "Hyphenation",
    hint: "A compound that gains and loses its hyphen.",
    looksFor:
      "One compound written more than one way — well-known beside well known.",
    ignores: "A compound written one way throughout.",
    group: "format",
    hue: "#f59e0b",
  },
  numbers: {
    name: "A number written two ways",
    hint: "twenty in one chapter, 20 in another.",
    looksFor:
      "The same number written as a word in one place and in digits in " +
      "another — twenty and 20.",
    ignores:
      "Digits that read as a code rather than a count: years, clock times, " +
      "prices, percentages, anything with a leading zero.",
    group: "format",
    hue: "#d946ef",
  },
  capitals: {
    name: "A term capitalised two ways",
    hint: "the Council and the council.",
    looksFor:
      "The same word written with a capital and without it, mid-sentence, at " +
      "least 3 times each way.",
    ignores:
      "A capital that only ever opens a sentence. Words English writes both " +
      "ways — a mother beside Mother, a king beside King Robert. Ordinary " +
      "words that are also somebody's name.",
    group: "format",
    hue: "#6366f1",
  },
  breaks: {
    name: "Scene breaks",
    hint: "Some a real break, some asterisks typed in.",
    looksFor:
      "A book marking scene breaks more than one way — a real break the file " +
      "carries, and asterisks typed into a paragraph.",
    ignores: "A book that marks every break the same way, or has none.",
    group: "format",
    hue: "#0891b2",
  },
};

/** The checks in one group, in reading order. */
export const checksIn = (group: CheckGroup) =>
  CHECKS.filter((check) => check.group === group);

/** The order the choice cards and the findings are both read in. */
export const CHECK_ORDER = ALL_CHECKS;

/** Every check. Handy where a screen wants the pair rather than the id. */
export const CHECKS: readonly (CheckLook & { id: CheckId })[] = CHECK_ORDER.map(
  (id) => ({ id, ...CHECK_LOOK[id] }),
);
