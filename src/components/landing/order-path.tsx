"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  curveThrough,
  litness,
  progressOf,
  type Point,
} from "@/lib/landing-path";

/**
 * The five phases as stations on one winding road, with a marker that rides it
 * as the reader scrolls.
 *
 * **The section's argument is a sequence, so the figure is a sequence.** "The
 * order" was a two-column split — a paragraph beside a boxed list of five rows
 * — which is a picture of a *list*, and a list is precisely the thing this page
 * says nobody's problem is. What a writer is missing is not five names, it is
 * the road between them and where on it they currently stand. A line you travel
 * down says that in a way a stack of rows cannot.
 *
 * **What lights is what the reader is reading.** The station the marker has
 * reached is at full strength; the others sit at a floor. That is scroll as
 * *attention* rather than as decoration, and this is the one section on the
 * page entitled to it: the content really is ordered, and the reader really is
 * somewhere in it.
 *
 * ---
 *
 * **The technique, and why this one.** Three approaches are in use for this
 * effect and only one survives the constraints here.
 *
 * - **`getPointAtLength` on a real path, driven from a scroll handler.** What
 *   this uses, and the long-standing scrollytelling technique. The browser
 *   solves the curve, so the marker sits on the line *by construction* rather
 *   than by two sets of coordinates being kept in step by hand.
 * - **CSS `offset-path` with a scroll-driven timeline.** No JavaScript at all,
 *   and the right answer one day. Not yet: still behind a flag in Firefox, and
 *   it would only place the marker — the dimming is a function of the same
 *   progress, so the scroll handler would be needed anyway and there would be
 *   two sources of truth for one number.
 * - **`IntersectionObserver` per station.** The usual shortcut, and it answers
 *   a different question: *is this station in view*, where three can be in view
 *   at once and a marker cannot be in three places.
 *
 * Five things about the implementation are load-bearing.
 *
 * **The curve is drawn through where the stations really are.** Nothing here
 * holds a coordinate: CSS lays the stations out at whatever the viewport, the
 * font and the wrapping make them, their centres are measured, and
 * `curveThrough` joins them. That is what lets one code path serve the phone —
 * where they stack down a rail and the road is nearly straight — and the
 * desktop, where they swing side to side. A hand-drawn `d` would have been two
 * of everything, kept in step by hand, wrong at the third breakpoint.
 *
 * **The scroll container is not the window.** `<body>` is `overflow-hidden` for
 * the editor shell, so this page owns its own scrolling and the thing that
 * moves under the reader is a `div`. `window.scrollY` would be nought forever.
 *
 * **Nothing here re-renders.** The marker's position, the trail and the five
 * opacities are written straight to the DOM inside one animation frame.
 * Routing them through state would re-render the section on every frame of
 * every scroll, for values React has no reason to know.
 *
 * **It runs only while it is on screen** — an `IntersectionObserver` adds and
 * removes the scroll listener, and the pending frame is cancelled on the way
 * out. A landing page is a page people leave open.
 *
 * **Every default is the readable one.** The words render at full strength and
 * JavaScript dims them, never the other way about, so a reader whose scripts
 * failed gets a plain legible list rather than a section faded to nothing
 * waiting for an event that will not arrive. Under `prefers-reduced-motion` the
 * whole mechanism is skipped and the CSS hides the marker and the trail: the
 * choreography goes, not one word of the content.
 */

/** How far either side of a station its light reaches, as a fraction of the
 *  window. Wide enough that the space between two stations is never dark, so
 *  the reader is always being handed something rather than crossing a gap. */
const REACH = 0.42;

/** What a station that is not the one being read fades to. A floor, not a
 *  fade-out — see the note on `litness`. */
const DIM = 0.45;

export interface Station {
  /** `01`, `02` — the phase's number. */
  n: string;
  title: string;
  note: string;
  /** Which side of the road the words sit on, from `md` up. */
  side: "left" | "right";
  /** Where the station sits across the width, 0 to 1, from `md` up. Below that
   *  they line up on a rail at the left and this is unused. */
  at: number;
  /** The one station carrying the section's argument, drawn as a card. */
  callout?: string;
  /** A drawn screen from the product, shown in the column the words are not
   *  in — see `phase-screens.tsx`. The road on its own says what the order is
   *  and never shows what any of it looks like. */
  screen?: ReactNode;
}

export function OrderPath({ stations }: { stations: Station[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<SVGPathElement>(null);
  const doneRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  /** Written by ref callbacks rather than queried, so a re-order cannot leave
   *  the road, the dots and the words disagreeing about which station is which. */
  const anchorRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dotRefs = useRef<(SVGSVGElement | null)[]>([]);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);

  /** The road, and how far down the host each station sits — both in the host's
   *  own pixels, which is also the SVG's coordinate space: it carries no
   *  `viewBox`, so one user unit is one CSS pixel and nothing is converted. */
  const [road, setRoad] = useState<{ d: string; ys: number[] }>({
    d: "",
    ys: [],
  });

  /**
   * Read where the stations actually landed.
   *
   * **Measured, never assumed**, and re-measured whenever anything that moves
   * them moves: the window resizing, a face arriving a beat after first paint,
   * a sentence re-wrapping because of either. Same rule as the rest of this
   * page's figures — one that measures once measures the wrong thing.
   */
  const measure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;

    const box = host.getBoundingClientRect();
    const points: Point[] = [];
    const ys: number[] = [];

    for (const anchor of anchorRefs.current) {
      if (!anchor) continue;
      const r = anchor.getBoundingClientRect();
      points.push({
        x: r.left - box.left + r.width / 2,
        y: r.top - box.top + r.height / 2,
      });
      ys.push(r.top - box.top + r.height / 2);
    }

    const d = curveThrough(points);
    // Only when it has actually changed: a `ResizeObserver` that sets state on
    // every callback with a fresh object re-runs the effect below for nothing.
    setRoad((was) => (was.d === d ? was : { d, ys }));
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    measure();

    // Reduced motion needs the measurement — the road is still drawn — but
    // nothing that watches for changes to it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const resize = new ResizeObserver(measure);
    resize.observe(host);
    // The page's faces land after first paint and re-wrap the sentences under
    // them, which moves every station below the first.
    void document.fonts?.ready.then(measure);

    return () => resize.disconnect();
  }, [measure]);

  useEffect(() => {
    const host = hostRef.current;
    const road_ = roadRef.current;
    if (!host || !road_ || !road.d) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const total = road_.getTotalLength();
    if (!Number.isFinite(total) || total <= 0) return;

    let frame = 0;

    /**
     * The point on the road at a given height down it.
     *
     * Binary search by `y` rather than arithmetic on arc length, because the
     * two are different questions: the marker's *vertical* position is the
     * reading line and has to be exactly linear in the scroll, while its
     * horizontal position is whatever the curve is doing at that height.
     * Searching by `y` answers both at once — sound here because the road only
     * ever descends, which holds by construction since the stations are laid
     * out top to bottom.
     */
    const seek = (y: number) => {
      let lo = 0;
      let hi = total;
      // Twelve halvings of a road a few thousand pixels long lands well inside
      // one pixel, which is smaller than anything anybody can see.
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (road_.getPointAtLength(mid).y < y) lo = mid;
        else hi = mid;
      }
      const length = (lo + hi) / 2;
      return { point: road_.getPointAtLength(length), length };
    };

    const draw = () => {
      frame = 0;
      const box = host.getBoundingClientRect();
      const viewport = window.innerHeight;
      const y = progressOf(box.top, box.height, viewport) * box.height;
      const { point, length } = seek(y);

      const marker = markerRef.current;
      if (marker) {
        marker.setAttribute("transform", `translate(${point.x}, ${point.y})`);
        marker.setAttribute("data-ready", "yes");
      }
      // The trail carries `pathLength="1"`, so this is a fraction rather than a
      // length — which is also what lets CSS hide it before any of this runs,
      // with no flash of a road already travelled.
      if (doneRef.current)
        doneRef.current.style.strokeDashoffset = `${1 - length / total}`;

      const reach = viewport * REACH;
      road.ys.forEach((stationY, i) => {
        const lit = litness(y - stationY, reach, DIM);
        const block = blockRefs.current[i];
        if (block) block.style.opacity = `${lit}`;
        // The station's own dot fills as the marker arrives, so the road shows
        // where the reader has got to without the words having to say it.
        dotRefs.current[i]?.setAttribute("data-lit", lit > 0.9 ? "yes" : "no");
      });
    };

    // One draw per frame however many scroll events land in it: a handler that
    // measures on every event measures the same thing six times and pays
    // layout for each.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const scroller = scrollParent(host) ?? window;
    let listening = false;

    const watch = new IntersectionObserver(
      ([entry]) => {
        const now = entry?.isIntersecting ?? false;
        if (now === listening) return;
        listening = now;
        if (now) {
          scroller.addEventListener("scroll", onScroll, { passive: true });
          window.addEventListener("resize", onScroll, { passive: true });
          draw();
        } else {
          scroller.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
        }
      },
      { rootMargin: "150px" },
    );
    watch.observe(host);

    return () => {
      watch.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [road]);

  return (
    <div className="oc-road-field">
      <div ref={hostRef} className="relative">
        {/* The road, under the words.

          No `viewBox`, deliberately: without one an SVG's user units are the
          CSS pixels of its own box, so the measurements above are written
          straight in with nothing to scale and no letterboxing to reason
          about. `aria-hidden` because it is a line — everything it says is
          said by the words it runs past. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <path
            ref={roadRef}
            d={road.d}
            fill="none"
            stroke="var(--color-lp-edge-strong)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* The road already travelled, laid over the pale one — the same path
            drawn twice rather than one path changing colour, since a dash can
            only hide a stroke and not repaint half of it. */}
          <path
            ref={doneRef}
            className="oc-road-done"
            d={road.d}
            pathLength={1}
            fill="none"
            stroke="var(--color-lp-accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* The marker: a filled ring, drawn in the page's own ground with the
            brand colour as both the outline and the pip.

            **The ground fill is what keeps it *on* the line rather than
            threaded onto it** — it masks the road behind it, so the marker
            reads as an object travelling along the road rather than as a bead
            the road passes through. It is also the station dot's own shape
            with the middle filled in, which is what says *this is one of
            those, and it is here now*.

            Hidden until it has somewhere real to be, or it paints one frame in
            the top left corner on the way past. */}
          <g ref={markerRef} className="oc-road-marker" data-ready="no">
            <circle
              r="11"
              fill="var(--oc-road-ground, var(--color-lp-ground))"
              stroke="var(--color-lp-accent)"
              strokeWidth="2"
            />
            <circle r="4.5" fill="var(--color-lp-accent)" />
          </g>
        </svg>

        {/* **The road has a lane of its own, and the lane is why it never
          crosses a word.** The row is three columns — words, empty lane,
          words — and the middle one is empty by construction, so the curve
          always has somewhere to wander that nothing is written in. The first
          pass put the stations at any fraction of the width with the words in
          a plain two-column grid, and the road went straight through the
          middle of a sentence.

          All of that layout is in `globals.css` rather than in classes here,
          and the reason is worth keeping: written as arbitrary-value
          utilities, **three of them produced no CSS at all** — the standing
          Tailwind v4 hazard — which collapsed the row to one column and put
          the words under the road. A layout whose correctness depends on a
          rule existing does not belong somewhere the rule can go missing
          quietly. */}
        <ol className="relative">
          {stations.map((station, i) => (
            <li
              key={station.title}
              className="oc-road-row"
              data-side={station.side}
            >
              {/* The station — an empty mark, and the anchor the road is drawn
                through. `--at` is set here, per station, and read only by the
                `md` rule that positions it. */}
              <span
                ref={(el) => {
                  anchorRefs.current[i] = el;
                }}
                style={{ "--at": `${station.at * 100}%` } as CSSProperties}
                className="oc-road-stop"
              >
                <svg
                  ref={(el) => {
                    dotRefs.current[i] = el;
                  }}
                  data-lit="no"
                  width="30"
                  height="30"
                  viewBox="-15 -15 30 30"
                  aria-hidden="true"
                  className="oc-road-dot block overflow-visible"
                >
                  <circle r="9" className="ring" />
                  <circle r="4" className="pip" />
                </svg>
              </span>

              <div
                ref={(el) => {
                  blockRefs.current[i] = el;
                }}
                className="oc-road-words"
              >
                {/* **Set larger than anything else on the page below the
                  hero**, and the reason is the same one that gives the rows
                  their height: this is read while scrolling past, one station
                  at a time, with nothing else on the screen competing for the
                  eye. Type sized for a column somebody has stopped to read is
                  too small for a station somebody is travelling through. The
                  cap that keeps the description to two lines moves with it,
                  in `globals.css` beside the rest of the layout. */}
                <p className="font-code text-[0.875rem] font-semibold tracking-[0.18em] text-lp-faint uppercase">
                  Phase {station.n}
                </p>
                <h3 className="oc-heading mt-3.5 font-serif text-[2.25rem] leading-[1.08] font-semibold text-lp-ink sm:text-[3rem]">
                  {station.title}
                </h3>
                <p className="mt-5 text-[1.25rem] leading-relaxed sm:text-[1.375rem]">
                  {station.note}
                </p>
                {station.callout && (
                  <p className="mt-6 inline-block rounded-xl bg-lp-accent px-4.5 py-4 text-left text-[1.0625rem] leading-relaxed font-medium text-lp-accent-ink">
                    {station.callout}
                  </p>
                )}
              </div>

              {/* The screen, in the column the words are not in. It follows
                  them in the DOM whichever side it is drawn on, so a screen
                  reader gets the phase and then the picture of it — and since
                  it is a picture, `AppWindow`'s own label is all it says. */}
              {station.screen && (
                <div className="oc-road-screen">{station.screen}</div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * The nearest scrolling ancestor, or the window.
 *
 * Same reason as in `check-demo.tsx` and `store-listing-demo.tsx`: `<body>` is
 * `overflow-hidden` for the editor shell, so this page owns its own scrolling
 * and the element that moves under the reader is a `div`.
 */
function scrollParent(el: Element | null): Element | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return null;
}
