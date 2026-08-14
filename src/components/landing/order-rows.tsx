import type { ReactNode } from "react";
import { LEAD_EM } from "@/components/landing/type";

/**
 * The order, as a column of alternating feature rows.
 *
 * **This replaced the road on 2026-08-13**, at the owner's request and to the
 * reference's layout: a large drawn screen on one side, the words on the
 * other, sides swapping down the page, with a small caption under each screen
 * naming what it is. `order-path.tsx` and the tested `landing-path.ts` behind
 * it are left in the tree unused, the way the previous landing design was —
 * see TODO.md for what went and why, because the road was making an argument
 * this layout has to keep making by other means.
 *
 * **What the road did that a list does not.** Its claim was that a writer is
 * short of the *sequence* rather than of five names, so the phases were
 * stations on one line with a marker riding it as you scrolled. Three things
 * carry that here instead: the phases are numbered in the eyebrow, each one
 * says how many steps it holds, and the ARC callout still names its step's
 * real number and phase. A reader who takes only the numbers still gets an
 * order rather than a set.
 *
 * **There is no marker and no scroll listener, which is the other half of the
 * change.** The road dimmed every station but the one being read, and that
 * dimming needed measurement, a scroll handler and a reduced-motion path. None
 * of it exists now: this file has no `"use client"`, ships no JavaScript, and
 * renders the same on a phone with a dead battery as on a desktop. A layout
 * that needs no script to say what it means is the better version of the same
 * argument.
 */

export interface Station {
  /** `01`, `02` — the phase's number, printed in the eyebrow. */
  n: string;
  title: string;
  /** Carries `<Em>` on the phrase that is the phase's point. */
  note: ReactNode;
  /** The drawn screen. Three of the five are computed — see `phase-screens`. */
  screen: ReactNode;
  /**
   * The small line under the screen, naming what it is.
   *
   * The reference puts one under every mockup and it does real work: a drawing
   * of an interface with no label is a reader guessing which part of the
   * product they are looking at. Every one of these names a screen that
   * exists.
   */
  caption: string;
  /** The one row that carries the section's argument outright. */
  callout?: string;
}

export function OrderRows({ stations }: { stations: Station[] }) {
  return (
    <ol className="space-y-20 sm:space-y-28">
      {stations.map((station, i) => (
        <li
          key={station.title}
          /* `items-center` rather than top-aligned: the screens are different
             heights and a row aligned to the top leaves the shorter ones
             hanging off the words beside them.

             **The columns are uneven, and which one is wide alternates with
             the row.** Two equal halves gave a photograph of a laptop the same
             width as three short paragraphs, and the app's own type inside it
             came out below the size anybody could read — which is the whole
             job of these pictures. `grid-template-columns` applies to
             *positions* rather than to items, so a single asymmetric template
             would have widened the words on every odd row, where `lg:order-2`
             sends the figure to the second column. Hence one template per
             side.

             **1.85fr since 2026-08-14, by way of 1.3, 1.5 and 1.7.** Same
             argument several steps on. The early takes bought their width
             *from* the words, and that has a price with a history: the phase
             heading came down from 72px to 52 and then to 40 as this column
             narrowed, and a heading setting to as many lines as its own
             paragraph has stopped being a heading.

             So the last take was made with two other levers rather than on its
             own — a wider container (`100rem`, up from `7xl`; see the note
             there) and a tighter gap below. That matters because the ratio is
             the *only* one of the three that costs the words anything, and on
             a wide window the container now does most of the work: at 1600 the
             figure lands near 955px against 730 before, with the text column
             ending up *wider* than it started. On a 1280 window, where the
             section's padding binds and the container cannot grow, the ratio
             and the gap between them still move about 66px across and the text
             holds at ~404px.

             That last figure is the constraint to check before touching this
             number again: the four titles are held to the same line count as
             each other, and the ceiling at 40px is somewhere near thirty
             characters. 404px still sets a 21-character title as two lines.

             **`minmax(0, …)` rather than a bare `1.3fr`, and it is not
             optional.** A grid item's automatic minimum size is its
             *content*, and for an image that means its intrinsic width — so a
             1296px photograph held the column open at 1296px and the row ran
             off the right of the window at any viewport narrower than about
             1500px. Tailwind's own `grid-cols-2` is `repeat(2, minmax(0,
             1fr))` for exactly this reason; writing the template by hand is
             what dropped the floor. */
          /* The gap is the third lever on the screens' width and the cheapest
             of the three — 16px off it at `lg` is 16px onto the picture, taken
             from air rather than from the words. It does not go below 3rem:
             the alternation means the words' hard edge faces the screen, and
             a column of type set right up against a framed picture reads as
             one crowded object rather than as a spread. */
          className={`grid items-center gap-10 lg:gap-12 ${
            i % 2 === 1
              ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.85fr)]"
              : "lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]"
          }`}
        >
          {/* ---- The screen -------------------------------------------
              `lg:order-2` on the odd rows is the whole of the alternation,
              and it is a *visual* swap only — the words stay first in the
              DOM, so a screen reader hears the phase and then the picture of
              it, in that order, on every row. Reordering the markup instead
              would have made the reading order zig-zag. */}
          <figure
            className={`m-0 ${i % 2 === 1 ? "lg:order-2" : ""}`}
          >
            {station.screen}
            <figcaption className="mt-5 text-center font-code text-[0.625rem] tracking-[0.18em] text-lp-faint uppercase">
              {station.caption}
            </figcaption>
          </figure>

          {/* ---- The words --------------------------------------------

              **The odd rows set to the right, and only from `lg`.** Those are
              the rows where the words sit in the *left* column with the screen
              beside them, so ragging the text to the right puts its hard edge
              against the picture it is about and leaves the soft edge on the
              page's outside margin — the arrangement every alternating layout
              of this shape uses, and the reason it reads as one spread rather
              than as two columns that happen to be next to each other. It is a
              `lg:` variant because below that the columns stack: a right-set
              paragraph under a full-width screen has nothing to align to and
              simply reads as a mistake. */}
          <div className={i % 2 === 1 ? "lg:order-1 lg:text-right" : ""}>
            <p className="font-code text-[0.875rem] font-semibold tracking-[0.18em] text-lp-faint uppercase">
              Phase {station.n}
            </p>

            {/* Large, but sized to a column rather than to a road. It ran at
                72px when the stations sat beside a lane and had a 30rem
                measure; in half of a `6xl` grid, next to a drawn screen that
                has to hold its own half of the row, that size stops being a
                heading and starts competing with the picture.

                **40px from `sm`, down from 52 on 2026-08-14.** The words
                column narrowed twice in one day — once when the figures took
                more of the grid, once when the section took a margin — and at
                52px a four-word phase title was setting as three lines against
                a note that had just grown. A heading that takes as many lines
                as its own paragraph stops being a heading. */}
            <h3 className="oc-heading mt-3.5 font-serif text-[2rem] leading-[1.08] font-bold text-lp-ink sm:text-[2.5rem]">
              {station.title}
            </h3>

            {/* `lp-deck` — but read the note on the section in
                `landing-page.tsx` before trusting the name. These rows sit on
                a tint again, where the deck grey measures 3.95:1 and misses
                AA, so the *token* is re-pointed to `lp-body` for that whole
                subtree. The class here is the right one either way: on white
                it is the deck grey, on the tint it is the step up, and neither
                this file nor any other row has to know which. */}
            <p className="mt-5 text-[1.25rem] leading-[1.5] font-semibold text-lp-deck sm:text-[1.375rem]">
              {station.note}
            </p>

            {station.callout && (
              <p className="mt-7 rounded-xl bg-lp-accent px-5 py-4 text-[1rem] leading-relaxed font-medium text-lp-accent-ink">
                {station.callout}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The emphasis inside a station's note — see `LEAD_EM`. */
export function StationEm({ children }: { children: ReactNode }) {
  return <strong className={LEAD_EM}>{children}</strong>;
}
