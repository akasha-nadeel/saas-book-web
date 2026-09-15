/**
 * The consistency checks by id, and which of them are on the free plan.
 *
 * **Its own module, importing nothing**, because three kinds of reader need
 * these names and only one needs the checks themselves. `consistency.ts` pulls
 * in three word lists to do its work; the pricing rows (read by Server
 * Components), the upgrade dialog and the check picker only need to know what
 * the checks are called and how many there are. `consistency.ts` re-exports
 * everything here, so existing imports are unchanged.
 */

export type CheckId =
  | "names"
  | "spelling"
  | "style"
  | "hyphens"
  | "quotes"
  | "doubled"
  | "unclosed"
  | "numbers"
  | "capitals"
  | "breaks"
  | "typos";

/**
 * Every check, in the order `consistencyReport` emits them.
 *
 * The emit order is the sequence of calls at the foot of `consistency.ts`, and
 * this is its one statement. The words and the hue for each live in
 * `consistency-checks.ts`, which reads this.
 */
export const ALL_CHECKS: readonly CheckId[] = [
  "names",
  "spelling",
  "style",
  "quotes",
  "unclosed",
  "doubled",
  "hyphens",
  "numbers",
  "capitals",
  "breaks",
  "typos",
];

/**
 * The checks on the free plan. Every other check is Pro.
 *
 * **Five, set 2026-09-15, split the way the trade splits them.** Grammarly
 * keeps spelling, grammar and punctuation free and sells its consistency
 * checks; PerfectIt sells nothing but consistency, at $70 a year. So the plain
 * mistakes are free here — a quotation mark of the wrong kind or left open, a
 * word typed twice, scene breaks marked two ways — and the copy editor's
 * house-style work is Pro: British and American, a word written two ways,
 * hyphenation, numbers, capitals, and the near-miss check.
 *
 * **A name spelled two ways stays free** although it is the most copy-editor
 * of them all, because it is the demonstration: it is the example in Help and
 * in the tool guide, and the thing only a whole-book read can do.
 */
export const FREE_CHECKS: readonly CheckId[] = [
  "names",
  "quotes",
  "unclosed",
  "doubled",
  "breaks",
];

/** Whether a check is on Pro only. */
export function isProCheck(id: CheckId): boolean {
  return !FREE_CHECKS.includes(id);
}

/** The Pro-only checks, in emit order. */
export const PRO_CHECKS: readonly CheckId[] = ALL_CHECKS.filter(isProCheck);
