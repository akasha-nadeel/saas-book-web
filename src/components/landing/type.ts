/**
 * The landing page's shared type scale.
 *
 * In a module of its own for the same reason `sections.ts` is: it is read from
 * both `landing-page.tsx` and `cta-banner.tsx`, and the second of those is
 * imported *by* the first, so exporting it from there would be a cycle. **No
 * `"use client"`** either, so both sides of the boundary can read it — see the
 * long note in `sections.ts` for what happens when a Server Component imports
 * a value from a client module.
 *
 * ---
 *
 * **The whole scale came down a step, and the weights came down with it.**
 * Section titles were 44/52/60px semibold and the deck under them was 21/26px
 * semibold in a mid grey — a scale built for a light page that wanted each
 * section to announce itself. The page is dark now and set in the quieter
 * idiom the owner asked for, where the heading is the *only* loud thing in a
 * band and everything under it is small, grey and regular-weight. Two changes
 * carry almost all of that:
 *
 * - **Titles are `medium`, not `semibold`.** At 40px on near-black, semibold
 *   reads as a shout; Inter's 500 at these sizes is what the reference sets
 *   and it is the difference between a headline and a banner.
 * - **The deck is body copy again.** 15/16px regular in `lp-body` rather than
 *   21/26px semibold in `lp-deck`. A deck set that large *is* a second
 *   heading, which is why the old page read as a stack of announcements.
 *
 * The face and the tracking did not change and did not need to: `.lp-type`
 * already re-points `--font-serif` to Inter for this subtree, and
 * `oc-display` / `oc-heading` / `oc-lead` already carry the negative tracking
 * this idiom is built on. See the block beside `.lp-type` in `globals.css`.
 */

/**
 * The hero's own title, and the only type on the page above 40px.
 *
 * A step above `SECTION_TITLE` in size and level with it in weight. It was a
 * step *below* — `normal` — on the argument that at 64px the letterforms carry
 * the emphasis on their own, which is true on flat ground and stopped being
 * true when the hero became a picture: over a gradient, 400 reads as thin
 * rather than as restrained. `medium` is the smallest step that fixes it, and
 * the closing ask made the same move for the same reason — see the note on its
 * own heading in `cta-banner.tsx`.
 *
 * It is also why `oc-display` matters more here than anywhere else on the
 * page; at 64px Inter needs the -0.035em or it falls apart into separate
 * words.
 */
export const HERO_TITLE =
  "text-[2.25rem] leading-[1.05] font-semibold sm:text-[3rem] lg:text-[3.5rem]";

/**
 * Every section title on the page, at one size.
 *
 * **It is a constant rather than a class on each heading because several are
 * hand-written.** Most go through `Head`, but the FAQ's column also carries a
 * marker dot and a description, the check's heading is centred over a window,
 * and the closing banner's sits on artwork — none of which `Head` does. Two
 * sizes of section title on one page is the thing that makes a page look
 * assembled rather than designed, and this is the only way to keep the
 * hand-written ones honest.
 */
export const SECTION_TITLE =
  "text-[2rem] leading-[1.15] font-medium sm:text-[2.25rem] lg:text-[2.5rem]";

/**
 * Hero subtitle / deck under the hero title.
 *
 * Stepped up from 15/16px normal to 17/18px medium so it reads clearly as a
 * companion to the larger title above it without competing with it.
 * `max-w-*` belongs at the call site.
 */
export const SECTION_LEAD =
  "text-[1.0625rem] leading-[1.6] font-medium text-lp-body sm:text-[1.125rem]";

/**
 * A feature row's own heading — the second level, under a section title.
 *
 * `medium` like the titles, so the page has one heading weight rather than a
 * ladder of them; the levels are told apart by size alone.
 */
export const ROW_TITLE =
  "text-[1.25rem] leading-[1.25] font-medium sm:text-[1.375rem]";

/** The paragraph under a row heading. Smaller than a section deck on purpose. */
export const ROW_BODY = "text-[0.875rem] leading-[1.65] text-lp-body";

/**
 * The emphatic clause inside the hero deck.
 *
 * Stepped up to `semibold` so the second sentence ("It writes to your own
 * browser…") reads as a distinct highlight against the `medium` opening
 * sentence. `lp-ink` keeps it lighter than the title above.
 */
export const LEAD_EM = "font-semibold text-lp-ink";
