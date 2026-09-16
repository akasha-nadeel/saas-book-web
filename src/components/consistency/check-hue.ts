/**
 * One hue per check, mixed into theme tokens.
 *
 * **Lifted out of `finding-card.tsx` on the second caller**, not the third: the
 * numbers below were *measured*, in daylight, on the palest of the eleven hues,
 * and the note on `hueDisplay` ends "change a hue in `consistency-checks.ts` and
 * these two numbers are what to re-measure." A second copy would be a second
 * answer to that instruction, and the copy nobody re-measures is the one that
 * goes quietly wrong.
 *
 * Plain `.ts` with no directive, so a server component could read it too — there
 * is nothing here but string building.
 */

/**
 * **Mixed, never painted flat**, which is what makes one value work in both
 * themes with no second table: by day the tokens are white and near-white, so
 * 14% of a hue is a pastel; at night they are near-black, so the same 14% is a
 * deep tint. `tool-marks.tsx` does exactly this for its sixteen tiles, and it
 * is why this adds no seventh entry to the closed list of colour exceptions.
 *
 * These go through `style`, not a class. Tailwind v4 finds utilities by
 * scanning source for complete strings, and a hue only known at runtime is a
 * class nothing generates.
 */
export const mix = (hue: string, percent: number, into: string) =>
  `color-mix(in srgb, ${hue} ${percent}%, var(${into}))`;

/**
 * The hue at a given strength, over whatever is behind it.
 *
 * **Used wherever a token would have been, because three of them are not what
 * they are at the top of the document.** Inside the editor's panel
 * `--color-surface`, `--color-raised` and `--color-line` are re-pointed to
 * translucent washes of `fg` — `#17171a0d` and friends — so that a panel layers
 * over whatever ground it is dropped onto. That is right for the panel and
 * quietly wrong for a card which supplies its own ground: every box built on
 * `--color-surface` came out as a 5% black veil over the tint instead of the
 * white box the design is made of, and the same card looked correct on the full
 * screen and wrong in the rail.
 *
 * `--color-panel`, `--color-fg` and the status family are the same in both
 * places, so those are still read directly. Everything else is a translucent
 * hue, which needs no token at all.
 */
export const tint = (hue: string, percent: number) =>
  `color-mix(in srgb, ${hue} ${percent}%, transparent)`;

/**
 * The hue as ink: mixed against `fg`, which darkens it by day and lightens it at
 * night, so one number carries both. A flat hue would be a pale wash on white in
 * daylight and legible only at night.
 *
 * **Two of them, because the thresholds are two**, and both were measured rather
 * than guessed — in daylight, on the palest of the hues, which is amber:
 *
 * - `hueDisplay` is the finding card's title. 24px bold is **large text**, so
 *   its bar is 3:1; 72% gives amber 3.30:1 by day and 6.2:1 at night. It is
 *   also what a mark's leading shape is drawn in — artwork rather than text, so
 *   the 3:1 bar is the right one.
 * - `hueText` is everything else the hue writes — chapter links, chips, the
 *   lopsided line. Normal text, so the bar is 4.5:1, and 56% is what amber needs
 *   to reach it — 4.55:1. Sixty per cent is 4.17:1 and fails.
 *
 * **Set by the palest hue, not by each**, which is what keeps them a family
 * rather than eleven separate decisions. One mix at 72% for *everything* was the
 * first attempt and it failed on amber, teal and emerald in daylight — amber
 * worst at 3.28:1 — while the same values were 5.4:1 and better at night, which
 * is exactly the half that gets looked at while a dark theme is being built.
 *
 * **A card's ground is not the lever it looks like.** Paling it from 14% to 8%
 * moves the title from 3.02:1 to only 3.16:1, because a 14% tint of a light hue
 * is already close to white; the ink percentage is what carries this. Change a
 * hue in `consistency-checks.ts` and these two numbers are what to re-measure.
 */
export const hueDisplay = (hue: string) => mix(hue, 72, "--color-fg");
export const hueText = (hue: string) => mix(hue, 56, "--color-fg");

/** The finding card itself: the most saturated thing in the finding. */
export const cardGround = (hue: string) => mix(hue, 14, "--color-panel");
export const cardEdge = (hue: string) => tint(hue, 45);
