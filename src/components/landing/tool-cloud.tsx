"use client";

import { useEffect, useRef, useState } from "react";
import { TOOL_MARKS } from "@/components/shelf/tool-marks";
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
      {/* The marks. `aria-hidden` as a set: they carry no information a reader
          needs — the count is in the heading and the names are in the footer —
          and sixteen unlabelled decorative images announced one after another
          is the worst version of this section for anyone listening to it. */}
      <div aria-hidden="true" className="absolute inset-0">
        {ALL_TOOLS.map((tool, i) => {
          const spot = SPOTS[i % SPOTS.length]!;
          return (
            <span
              key={tool.path}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{
                left: `${out ? spot.x : 50}%`,
                top: `${out ? spot.y : 50}%`,
                opacity: out ? 1 : 0,
                // Staggered so it reads as a burst rather than one object
                // moving sixteen ways at once.
                transitionDelay: `${i * 45}ms`,
              }}
            >
              {/* The float is on an inner element so it composes with the
                  entrance rather than fighting it: the outer span owns
                  `left`/`top`, this one owns a small looping `translate`. */}
              <span
                className="oc-tool-float block"
                style={{ animationDelay: `${(i % 7) * 0.9}s` }}
              >
                {/* The tile is drawn here rather than by `ToolMark`, which
                    fixes its own size at 56px for the dashboard's grid. The
                    marks themselves are the app's — `TOOL_MARKS` keyed by the
                    tool's `icon` — so the sixteen objects a reader meets here
                    are the sixteen they will meet inside.

                    White with a hairline and a soft shadow, not the app's dark
                    `raised` tile: this sits on the landing page's white, and
                    the reference's logos are all light plates carrying their
                    own colour. The mark keeps its colours either way, which is
                    the one thing `tool-marks.tsx` insists on. */}
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-lp-edge bg-lp-ground shadow-[0_6px_20px_-8px_rgba(15,15,16,0.25)] sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10"
                  >
                    {TOOL_MARKS[tool.icon]}
                  </svg>
                </span>
              </span>
            </span>
          );
        })}
      </div>

      {/* The words, over the top. `relative` so they win the stacking order
          without a z-index to keep in step with anything. */}
      <div className="relative flex min-h-[inherit] items-center justify-center px-6">
        <div className="max-w-2xl text-center">{children}</div>
      </div>
    </div>
  );
}
