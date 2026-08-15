"use client";

import { useEffect, useRef, useState } from "react";
import { TOOL_MARK_HUES, TOOL_MARKS } from "@/components/shelf/tool-marks";
import { ALL_TOOLS } from "@/lib/book-tools";

/**
 * The sixteen tools, as a cloud of marks around what they add up to.
 *
 * **It replaced four cards of pills on 2026-08-15**, to the owner's reference —
 * the Mobbin "growing library" hero, where a product's logos burst out from
 * the middle and idle in place around a centred count. What went with the
 * cards was the grouping, the four group notes and sixteen named pills; what
 * stayed is the heading and the one line under it. The names are not lost:
 * every tool is still listed in the footer, and the marks are the same ones the
 * dashboard's Tools grid uses, so a reader meets the same sixteen objects here
 * that they will meet inside.
 *
 * **The marks are read from `ALL_TOOLS`, not listed here**, so this cannot
 * drift from the product: add a seventeenth tool and a seventeenth mark
 * appears, in the same order `book-tools.ts` declares them. The scatter
 * positions are a fixed ring, so the *arrangement* is stable while the
 * *contents* follow the source.
 *
 * **No framer-motion, and the reason is structural rather than taste.** The
 * pattern this is copied from is built on a pinned `sticky` stage driven by
 * `useScroll`, and both halves of that fight this app: `<body>` is
 * `overflow-hidden` for the editor's sake, so the landing page scrolls inside
 * its own `h-dvh overflow-y-auto` container and the *window* never scrolls at
 * all — which is the thing `useScroll` measures by default. What is left after
 * removing the scroll-scrubbing is one entrance and an idle, and those are two
 * CSS animations and an `IntersectionObserver`. A dependency for that would be
 * a dependency to keep patched for an effect the platform already has.
 *
 * The entrance fires **once**. Scrolling back must not re-cluster them: the
 * burst is how the section introduces itself, and a section that re-performs
 * every time it passes the viewport is the reason people describe scroll
 * animation as noise.
 */

/**
 * Where each mark comes to rest, as a percentage of the stage.
 *
 * A ring rather than random placement, and hand-placed rather than computed:
 * an even circle reads as a clock face, and true randomness clumps.
 *
 * **The one rule that is not taste: nothing sits in the middle band.** Through
 * the vertical middle — roughly 35% to 75%, where the heading and its lead
 * are — every mark is held past 40% from the centre line, so `x` there is
 * single digits or nineties and never anything between. The first arrangement
 * ignored that at two spots and both landed on the paragraph, which is a
 * collision no amount of `z-index` fixes: the words have to win, and the way
 * they win is by nothing being there. Marks *do* sit centrally at the very top
 * and bottom, where there is no text to hit.
 *
 * Sixteen entries for sixteen tools. A seventeenth tool would wrap round to
 * the first position, which is deliberately survivable rather than a crash:
 * the list is the product's, this is only its arrangement.
 */
const SPOTS = [
  // Left
  { x: 8, y: 14 },
  { x: 24, y: 28 },
  { x: 6, y: 44 },
  { x: 8, y: 66 },
  { x: 20, y: 84 },
  { x: 36, y: 93 },
  { x: 34, y: 8 },
  { x: 48, y: 97 },
  // Right
  { x: 92, y: 14 },
  { x: 76, y: 26 },
  { x: 94, y: 44 },
  { x: 92, y: 66 },
  { x: 80, y: 84 },
  { x: 64, y: 93 },
  { x: 66, y: 7 },
  { x: 52, y: 3 },
] as const;

export function ToolCloud({ children }: { children: React.ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    /* Reduced motion needs no branch here, and the version that had one was a
       lint error for a real reason: it called `setState` straight from the
       effect body, which cascades a render. The CSS already answers it —
       `motion-reduce:transition-none` on each mark — so somebody who has asked
       for less movement gets the same observer, the same flip, and the marks
       simply *appear* in their places instead of travelling to them. Placed,
       not thrown, with no second code path to keep in step. */
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setOut(true);
        io.disconnect(); // once, and never again — see the note above.
      },
      { threshold: 0.25 },
    );
    io.observe(stage);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={stageRef}
      className="relative mt-14 min-h-[26rem] sm:min-h-[32rem] lg:min-h-[38rem]"
    >
      {/* The marks.
          **No longer `aria-hidden`, and that is the point of the change.**
          They were decorative while they said nothing: the count was in the
          heading, the names were in the footer, and sixteen unlabelled images
          announced one after another would have been the worst version of this
          section for anyone listening. Now each one *carries* a name and a
          description, so hiding them would be hiding the only place on this
          page that says what a given tool is for.

          It follows that hover cannot be the only way in. Each mark is a
          `<button>` — focusable, reachable by keyboard, and announced with its
          name — and the card shows on `group-hover` *and* `group-focus-visible`
          from the same rule. A tooltip that exists only under a pointer is a
          tooltip that does not exist on a phone or under a screen reader. */}
      <div className="absolute inset-0">
        {ALL_TOOLS.map((tool, i) => {
          const spot = SPOTS[i % SPOTS.length]!;
          /* Which way the card opens. The section clips its overflow, so a card
             hanging off a mark at 6% or 94% would be cut in half — they open
             toward the middle, where there is always room. */
          const left = spot.x < 50;
          /* Every tile is dressed in its own mark's colour — see
             `TOOL_MARK_HUES`. `color-mix` rather than sixteen hand-mixed
             tints: the pale ground and the border are *derived* from the one
             hue, so a mark whose fill changes takes its plate with it and the
             two can never drift apart. Percentages are low on purpose — the
             mark has to stay the most saturated thing on its own tile, or the
             plate starts competing with the logo it is holding. */
          const hue = TOOL_MARK_HUES[tool.icon] ?? "#146ef5";
          return (
            <span
              key={tool.path}
              /* Raised while it is the one being read, so its card paints over
                 the marks around it rather than under the next one along. */
              className="absolute z-0 -translate-x-1/2 -translate-y-1/2 transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:z-20 hover:z-20 motion-reduce:transition-none"
              style={{
                left: `${out ? spot.x : 50}%`,
                top: `${out ? spot.y : 50}%`,
                opacity: out ? 1 : 0,
                // Staggered so it reads as a burst rather than one object
                // moving sixteen ways at once.
                transitionDelay: `${i * 45}ms`,
              }}
            >
              <span className="group relative block">
                {/* The float is on an inner element so it composes with the
                    entrance rather than fighting it: the outer span owns
                    `left`/`top`, this one owns a small looping `translate`.
                    The card is *outside* it — a description that bobs while
                    somebody is trying to read it is the one thing this
                    animation must not do. */}
                {/* **The float stops while it is being read.** A mark that
                    keeps drifting under the pointer is a target that has to be
                    chased, and the card beside it is a paragraph somebody is
                    trying to read off a moving object. Paused on hover and on
                    focus, so the moment it has something to say it holds
                    still. (It also makes the mark a stable hit target, which a
                    perpetually animating element is not — Playwright refuses
                    to hover one at all, which is how this was noticed.) */}
                <span
                  className="oc-tool-float block group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]"
                  style={{ animationDelay: `${(i % 7) * 0.9}s` }}
                >
                  {/* The tile is drawn here rather than by `ToolMark`, which
                      fixes its own size at 56px for the dashboard's grid. The
                      marks themselves are the app's — `TOOL_MARKS` keyed by
                      the tool's `icon` — so the sixteen objects a reader meets
                      here are the sixteen they will meet inside.

                      White with a hairline and a soft shadow, not the app's
                      dark `raised` tile: this sits on the landing page's white,
                      and the reference's logos are all light plates carrying
                      their own colour. */}
                  <button
                    type="button"
                    aria-label={tool.name}
                    className="flex h-14 w-14 cursor-default items-center justify-center rounded-2xl border outline-none transition-transform duration-200 group-hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-lp-accent sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${hue} 10%, #ffffff)`,
                      borderColor: `color-mix(in srgb, ${hue} 38%, #ffffff)`,
                      /* **A dark drop, not a tinted one.** A shadow mixed
                         from the tile's own hue was tried and reads as a glow
                         — the plate looks lit from within rather than lifted
                         off the page, and sixteen of them at once turn the
                         section into a light show. Near-black at low alpha is
                         what actually says "this object is above the paper",
                         and it is the same shadow every tile carries, so the
                         colour stays where it belongs: inside the mark. */
                      boxShadow:
                        "0 10px 24px -10px rgba(15,15,16,0.45), 0 2px 6px -2px rgba(15,15,16,0.25)",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10"
                    >
                      {TOOL_MARKS[tool.icon]}
                    </svg>
                  </button>
                </span>

                {/* The card. `pointer-events-none` so it can never sit between
                    the pointer and the mark that summoned it — which would make
                    it flicker as the two fought over the hover. */}
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute top-1/2 z-20 w-60 -translate-y-1/2 rounded-2xl border border-lp-edge bg-lp-ground p-4 opacity-0 shadow-[0_18px_44px_-16px_rgba(15,15,16,0.35)] transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 ${
                    left
                      ? "left-[calc(100%+0.75rem)]"
                      : "right-[calc(100%+0.75rem)]"
                  }`}
                >
                  {/* The two ornaments from the reference: an opening quote at
                      the top left and a spark at the foot. Both decorative, so
                      both hidden — the sentence between them is the content. */}
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4 text-lp-faint"
                    fill="currentColor"
                  >
                    <path d="M9.6 5.4c-3 1.5-4.8 4-4.8 7.2v5.9h5.9v-5.9H7.9c0-1.9.9-3.3 2.7-4.3zm8.4 0c-3 1.5-4.8 4-4.8 7.2v5.9h5.9v-5.9h-2.8c0-1.9.9-3.3 2.7-4.3z" />
                  </svg>

                  <span className="mt-2 block font-serif text-[0.9375rem] leading-[1.55] text-lp-ink italic">
                    {tool.what}
                  </span>

                  <span className="mt-2 flex justify-end">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-lp-accent"
                      fill="currentColor"
                    >
                      <path d="M12 2.6c.9 3.9 2.9 5.9 6.8 6.8-3.9.9-5.9 2.9-6.8 6.8-.9-3.9-2.9-5.9-6.8-6.8 3.9-.9 5.9-2.9 6.8-6.8zm6.3 12.1c.4 1.7 1.3 2.6 3 3-1.7.4-2.6 1.3-3 3-.4-1.7-1.3-2.6-3-3 1.7-.4 2.6-1.3 3-3z" />
                    </svg>
                  </span>
                </span>
              </span>
            </span>
          );
        })}
      </div>

      {/* The words, over the top. `relative` so they win the stacking order
          without a z-index to keep in step with anything.

          **`pointer-events-none`, and it is not a nicety.** This block is
          centred by stretching to the full height and width of the stage, so
          as a solid layer it sits over every mark and eats the hover — the
          cards simply never appeared, for anybody, not only for the test
          runner that caught it. The wrapper is transparent to the pointer and
          the text inside it takes `pointer-events-auto` back, so the words are
          still selectable while the empty space around them is not a lid. */}
      <div className="pointer-events-none relative flex min-h-[inherit] items-center justify-center px-6">
        <div className="pointer-events-auto max-w-2xl text-center">
          {children}
        </div>
      </div>
    </div>
  );
}
