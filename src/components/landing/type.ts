/**
 * The landing page's shared type scale — two entries, a title and the deck
 * under it, and the pairing is the point.
 *
 * In a module of its own for the same reason `sections.ts` is: it is read from
 * both `landing-page.tsx` and `cta-banner.tsx`, and the second of those is
 * imported *by* the first, so exporting it from there would be a cycle. **No
 * `"use client"`** either, so both sides of the boundary can read it — see the
 * long note in `sections.ts` for what happens when a Server Component imports
 * a value from a client module.
 */

/**
 * Every section title on the page, at one size.
 *
 * The headings used to sit a step under the hero — 44px at the top end — which
 * is the safe choice and read as a page of subheadings: a reader scrolling saw
 * nothing between the hero and the footer that stopped them. At this size each
 * section announces itself, which is what a landing page's headings are for.
 *
 * **It is a constant rather than a class on each heading because three of them
 * are hand-written.** Most go through `Head`, but the FAQ's column also
 * carries a marker dot and a description, the check's heading is centred over
 * a window, and the closing banner's is on a coloured ground — none of which
 * `Head` does. Two sizes of section title on one page is the thing that makes
 * a page look assembled rather than designed, and this is the only way to keep
 * the hand-written ones honest.
 *
 * Two consequences worth knowing. It pairs with **`oc-display` rather than
 * `oc-heading`**: the two tracking classes exist for exactly this decision —
 * at display sizes a grotesque set at heading tracking reads as a road sign —
 * and these are display sizes now. And **the top end sits a little above the
 * hero's own 56px**, so a section title is the largest type on the page. That
 * is a trade rather than an oversight: the hero holds its place by being three
 * lines against one, by the marker behind its last clause, and by being the
 * only thing on its screen. Re-check it if the hero is ever cut to one line.
 */
export const SECTION_TITLE =
  "text-[2.75rem] leading-[1.04] font-semibold sm:text-[3.25rem] lg:text-[3.75rem]";

/**
 * Every deck under those titles, at one size — and set the way the reference
 * sets its product copy: **large, semibold, and grey, with the claim inside it
 * in near-black.**
 *
 * The point of that arrangement is that it makes a paragraph skimmable without
 * cutting it into bullets. A reader taking only the dark words gets the claim;
 * a reader taking the whole sentence gets the qualification that makes the
 * claim true — which on this page is never decoration, since the qualifications
 * are what the whole thing is arguing. Bullets would drop them.
 *
 * Three things about it are deliberate.
 *
 * - **The grey is its own token, and the gap is the point.** `lp-deck` rather
 *   than `lp-body`: the mechanism here is the *distance* between the grey and
 *   the near-black inside it, and `lp-body` at 8.0:1 sits too close to the
 *   ink's 19:1 for the emphasis to read as anything but a slightly darker word.
 *   `lp-deck` is 4.6:1, which roughly doubles that gap — and it is as pale as
 *   the ramp allows, because the smallest step here is 21px and has to clear
 *   the full 4.5:1 rather than the large-text 3:1. The long note beside the
 *   token in `globals.css` has the working. It is a colour rather than
 *   `opacity-60` on ink because an opacity fades the emphasis with it, which is
 *   the one thing here that must not move.
 * - **The emphasis is a colour step, not a weight step.** Base and `LEAD_EM`
 *   are both semibold; only the ink changes. Bolding as well was tried and at
 *   this size reads as two typefaces in one sentence, which is the same fault
 *   the closing banner's heading was fixed for.
 * - **It is a constant for the reason `SECTION_TITLE` is.** Six of these go
 *   through `Head` and seven are hand-written paragraphs in the page, so the
 *   size has to live somewhere all thirteen can read it. Two deck sizes on one
 *   page is what makes a page look assembled rather than designed.
 */
export const SECTION_LEAD =
  "text-[1.3125rem] leading-[1.4] font-semibold text-lp-deck sm:text-[1.5rem] lg:text-[1.625rem]";

/**
 * The claim inside a deck — the words a skimming reader is meant to take.
 *
 * Same weight as the sentence around it, one step darker. Use `<strong>` rather
 * than a span: this is importance rather than styling, and a screen reader
 * should hear it the way the eye reads it. The explicit weight is there because
 * `<strong>` defaults to `bolder`, which would undo the rule above.
 */
export const LEAD_EM = "font-semibold text-lp-ink";
