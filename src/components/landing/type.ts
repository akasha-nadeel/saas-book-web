/**
 * The landing page's shared type scale — currently one entry, and one is the
 * point.
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
