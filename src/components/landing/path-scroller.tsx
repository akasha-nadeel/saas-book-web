"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckFigure,
  DraftFigure,
  FilesFigure,
  ImportFigure,
} from "./path-figures";

/**
 * The path section's large layout: the four stages scroll past on the left,
 * and the figure beside them is pinned and changes to match whichever stage the
 * reader is level with.
 *
 * Two earlier versions are worth knowing about, because the current one is what
 * is left after both were taken out.
 *
 * The first pinned *both* columns. Nothing there actually moved — the reader
 * scrolled and the content swapped underneath them — so the scroll position had
 * to be inferred from four invisible bands laid down an empty runway. Letting
 * the left column simply be tall and scroll the way a page scrolls removed the
 * runway, the bands and their arithmetic: the observer now watches the stages
 * themselves, which are the things whose position the answer depends on.
 *
 * The second drew a numbered rail down the left, with the stages as cards
 * hanging off it and the current one filled. That is a good picture of four
 * steps seen *at once*, which is not the shape of this section any more —
 * only one stage is on screen at a time, so the rail spent most of its length
 * as an empty line between a node above the fold and a node below it, and the
 * fill it was drawing was a progress bar nobody could see the ends of. The
 * sequence is now carried where it costs nothing: a step number over each
 * stage's own heading.
 *
 * Small screens keep the plain numbered column in `landing-page.tsx`. Pinning
 * anything on a phone spends the whole viewport on one of the two halves.
 *
 * The hexes are written literally here for the same reason as everywhere else
 * on this page: it is drawn to the design's palette rather than to the app's
 * `@theme` tokens, which describe a product that has to work in light and dark.
 * See the header of `landing-page.tsx`.
 */

const INK = "#0E1116";
/**
 * The section runs on a navy ground, so the blue that labels every other
 * section on this page is too dark to sit on it. `#7FA8FF` is the lifted blue
 * the page's other dark bands already use — `Eyebrow`'s `dark` tone.
 */
const LIFT = "#7FA8FF";
/** Body copy on the navy. White at seven tenths, not a grey: a fixed grey goes
 *  muddy against a coloured ground, and this one is blue. */
const BODY = "rgba(255,255,255,0.72)";
/**
 * The raised supporting card.
 *
 * A mint rather than a deeper green, and carrying dark text, because the
 * alternative is the mistake this page has already made twice: a saturated fill
 * with the words reversed out of it, which is how the lit stage card and the
 * open FAQ row both started and why both were changed. White on a mid green is
 * around 3:1 — under the line for text this size, and this card is where the
 * specifics live.
 */
const GREEN = "#3ECF8E";
const GREEN_INK = "#0C3A2A";

/**
 * A picture per stage, in the stages' own order. Indexed by position rather
 * than keyed by title, because the titles are copy and copy gets rewritten;
 * the order of the path does not.
 */
const FIGURES = [DraftFigure, ImportFigure, CheckFigure, FilesFigure];

/**
 * The step label over each heading — the one thing the rail was carrying that
 * the section would miss. Words rather than digits because it is read as part
 * of the sentence above the title, not as a list marker; the `<ol>` is already
 * the list marker, for anything that reads markup.
 */
const ORDINALS = ["Step one", "Step two", "Step three", "Step four"];

/**
 * Two supporting points under each stage, in the stages' own order.
 *
 * They are here because the column was a heading and a paragraph against a
 * full-height picture, and read as a caption that had floated loose. They are
 * also the specifics the stage's own sentence has no room for.
 *
 * **Every one of them is a thing the code does, and the file that does it is
 * named.** This is the section that walks a visitor through the product, one
 * screen at a time, with nothing else on the page competing — the easiest place
 * to slip in a line that sounds true. So:
 *
 * - Focus mode and typewriter are `focusMode` / `typewriter` in `prefs`
 *   (library-store.ts) and `use-typewriter.ts`.
 * - Autosave is `use-autosave.ts`; the second device is `sync.ts`, which needs
 *   an account — hence the qualifier, which is not decoration.
 * - Five extensions, because `IMPORT_ACCEPT` in `import/index.ts` lists five.
 *   Not six: the audiobook import is a different button and a paid route.
 * - Trim size, typography and the listing details are `page-setup.ts`,
 *   `typography.ts` and `publishing.ts`.
 * - Blocking against advisory is `storeReadiness()`'s two levels, and "never
 *   stops the export" is the promise written at the head of `publishing.ts`:
 *   it reports, it does not veto.
 * - EPUBCheck 5.3 with no errors is a run that happened, recorded in TODO.md.
 * - The generated pages are `front-matter.ts`, which `epub.ts` and `print.ts`
 *   import and the DOCX and Markdown writers do not — hence naming the two.
 */
const POINTS: { title: string; note: string }[][] = [
  [
    {
      title: "Focus mode and typewriter scrolling",
      note: "Dim everything but the paragraph you are in, or keep the line you are typing at the middle of the screen.",
    },
    {
      title: "Saves as you type",
      note: "And, with an account, opens on your next machine where you left it.",
    },
  ],
  [
    {
      title: "Five file types in",
      note: ".docx, .epub, .md, .txt and .html. Your headings become the chapter list.",
    },
    {
      title: "The book's details live with the book",
      note: "Trim size, body typography, blurb, ISBN and series, kept per book rather than per export.",
    },
  ],
  [
    {
      title: "It separates what blocks from what costs you",
      note: "A shop refusing the file and a choice that only loses you readers are different sentences, and it says which is which.",
    },
    {
      title: "It never stops the export",
      note: "You are allowed to want the file for your own reader. The check reports; it does not veto.",
    },
  ],
  [
    {
      title: "The EPUB is built to be sold",
      note: "Checked against EPUBCheck 5.3 for EPUB 3.3, with no errors and no warnings.",
    },
    {
      title: "Title, copyright and contents pages",
      note: "Generated for the EPUB and the PDF from the details you already filled in.",
    },
  ],
];

export function PathScroller({
  stages,
}: {
  stages: readonly (readonly [string, string])[];
}) {
  const [active, setActive] = useState(0);
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    /**
     * A root with no height at all, lying across the middle of the viewport:
     * whichever stage that line is currently inside is the stage.
     *
     * An observer rather than a scroll listener because the page does not
     * scroll the window — `<body>` is `overflow-hidden` and the landing page
     * scrolls inside its own container, so a `window` listener never fires
     * (the same trap `landing-nav.tsx` documents). An observer needs no
     * scrolling ancestor at all: it watches where the elements actually are,
     * and the container's clipping is already part of that answer.
     */
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.stage);
          if (Number.isInteger(i)) setActive(i);
        }
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );

    for (const el of rows.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [stages.length]);

  return (
    <div
      className="hidden grid-cols-[minmax(0,1fr)_minmax(0,600px)] items-start
                 gap-x-14 lg:grid xl:gap-x-20"
    >
      <ol className="col-start-1">
        {stages.map(([title, body], i) => (
          <li
            key={title}
            data-stage={i}
            ref={(el) => {
              rows.current[i] = el;
            }}
            /**
             * Each stage is most of a screen tall, and that height is the whole
             * mechanism: it is what gives the reader something to scroll
             * through and the figure beside it a turn long enough to be looked
             * at. Clamped rather than a bare `vh` so a tall monitor does not
             * make the section interminable and a short one does not flick
             * through four figures in a flick of the wheel.
             *
             * The height is *exactly the box the figure is pinned in* —
             * `100dvh` less the `4rem` header, the same expression the sticky
             * column uses — and that is what makes the two sides line up.
             * Centring the words in a box of some other height centres them on
             * a different point from the picture, which is why an arbitrary
             * `66vh` had the left column reading high or low against the figure
             * depending on the window. One measurement, used twice.
             *
             * The two can only be exactly level at the moment a stage's box is
             * flush with the viewport; that is inherent to one side scrolling
             * while the other is pinned. Matching the boxes makes that moment
             * the resting position rather than an accident.
             *
             * The padding is the guard for when the content is taller than the
             * box — it insets rather than adds, so it costs nothing in the
             * usual case and keeps two stages off each other in the awkward
             * one.
             */
            className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center
                       py-[clamp(24px,4vh,56px)]"
          >
            <p
              className="font-brand text-[16px] font-extrabold tracking-[0.14em] uppercase"
              style={{ color: LIFT }}
            >
              {ORDINALS[i] ?? `Step ${i + 1}`}
            </p>
            {/* Sized against the viewport's height, like everything else in
                this section: the figure opposite is bound the same way, and a
                heading that ignored it would tower over the picture it is
                describing on a short window.

                58px is now above the section's own h2, which is deliberate at
                this size rather than an oversight. That h2 is read once on the
                way in; these are the four things the section is actually about,
                each alone on the screen with a picture beside it, and at the
                width this column has they are still comfortably inside their
                own measure. */}
            {/* `h2`, not `h3`: the section's own heading is gone, so these four
                are the headings of this section rather than subheadings under
                one. An `h3` with no `h2` above it is a hole in the outline. */}
            <h2
              className="mt-[22px] font-brand text-[clamp(34px,6vh,58px)] leading-[1.08]
                         font-extrabold tracking-[-0.03em] text-white"
            >
              {title}
            </h2>
            <p
              className="mt-[22px] max-w-[40ch] font-brand text-[clamp(18px,2.9vh,23px)]
                         leading-[1.6] font-medium text-pretty"
              style={{ color: BODY }}
            >
              {body}
            </p>

            {/* Two tiers, as the reference has them: the first point raised on
                white, the second sitting back into the page. Which one is
                which is not arbitrary — the first is what the stage *gives*
                you and the second is the qualifier or the guarantee, and the
                second reading quieter is the right order to meet them in. */}
            <ul className="mt-[clamp(20px,3.4vh,34px)] flex max-w-[46ch] flex-col gap-3">
              {(POINTS[i] ?? []).map((point, p) => (
                <li
                  key={point.title}
                  className={`rounded-2xl px-6 py-[clamp(12px,2vh,18px)] ${
                    p === 0 ? "shadow-[0_10px_30px_rgba(0,0,0,0.28)]" : ""
                  }`}
                  style={{
                    background: p === 0 ? GREEN : "rgba(255,255,255,0.07)",
                  }}
                >
                  <p
                    className="font-brand text-[clamp(15px,2.1vh,17.5px)] leading-[1.35] font-bold
                               tracking-[-0.012em]"
                    style={{ color: p === 0 ? INK : "#FFFFFF" }}
                  >
                    {point.title}
                  </p>
                  <p
                    className="mt-1.5 font-brand text-[clamp(13.5px,1.8vh,15px)] leading-[1.55]
                               font-medium text-pretty"
                    style={{ color: p === 0 ? GREEN_INK : BODY }}
                  >
                    {point.note}
                  </p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {/* The figure, held on screen while the stages go past. `top-16` clears
          the sticky header, which is `h-16` and sits above this at `z-50`; the
          height and `items-center` between them keep the picture on the middle
          of the screen rather than pinned under the bar, so it sits level with
          whichever stage the observer is reading.

          All four are stacked in one grid cell: the slot is as tall as the
          tallest and never resizes as they swap, and nobody has to guess that
          height in pixels. */}
      <div className="sticky top-16 col-start-2 flex h-[calc(100dvh-4rem)] items-center">
        <div className="grid w-full max-w-[min(600px,104vh)]">
          {stages.map(([title], i) => {
            const Figure = FIGURES[i];
            return (
              <div
                key={title}
                className={`col-start-1 row-start-1 transition-[opacity,transform]
                            duration-500 ease-out motion-reduce:transition-none ${
                              i === active
                                ? "translate-y-0 opacity-100"
                                : "pointer-events-none translate-y-3 opacity-0"
                            }`}
              >
                {Figure ? <Figure /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
