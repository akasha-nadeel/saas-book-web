/**
 * How far a book is through the target its writer set, said honestly.
 *
 * Three judgements live here, and all three were paid for on the shelf's own
 * progress bar before they were worth extracting.
 *
 * **The share is floored, never rounded.** `Math.round` is wrong at both ends.
 * At the bottom it turned every early session into "0% of target" — 215 words
 * into a 110,000-word novel is 0.195%, and a writer who has just written a page
 * being told they are at nought is the app failing to count the thing it asked
 * them to do. At the top it is worse: 99.6% rounds to 100, so a book *short* of
 * its target printed "100%" in the green kept for having arrived. A number that
 * rounds up into a claim is the one kind this screen must not print.
 *
 * **Under one per cent is said in words.** Flooring is honest and "0%" is not:
 * it reads as *nothing counted*, which is a different fact from *a little
 * counted*, and the writer it is shown to has just written the little.
 *
 * **`met` is read from the words, not the percentage.** Asking the question
 * directly is what stops a rounded figure deciding whether somebody has
 * finished.
 *
 * Pure and tested because two screens now draw it — the bar and the gauge — and
 * two copies of this arithmetic is two answers to "am I there yet".
 */

export interface TargetShare {
  /** 0–100, floored, clamped. Safe to use as a bar width or an arc length. */
  share: number;
  /** What to print: `"under 1%"`, or `"6%"`. */
  label: string;
  /** Whether the target is actually reached — asked of the words themselves. */
  met: boolean;
}

export function targetShare(words: number, target: number): TargetShare {
  // Guarded against a target of nought, which would divide to Infinity.
  const exact = target > 0 ? (words / target) * 100 : 0;
  const share = Math.max(0, Math.min(100, Math.floor(exact)));
  const met = target > 0 && words >= target;

  return {
    share,
    label: words > 0 && share === 0 ? "under 1%" : `${share}%`,
    met,
  };
}
