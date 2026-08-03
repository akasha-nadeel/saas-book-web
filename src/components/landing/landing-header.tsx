"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The landing page's header: invisible over the hero, and it gets out of the
 * way going down.
 *
 * A bar drawn over the hero is a bar competing with the headline, which is the
 * one thing on the page that has to land. So it carries no ground of its own
 * until the page has scrolled — at which point it *does* need one, or the
 * wordmark sits on top of whatever section is passing underneath.
 *
 * **It hides going down and comes back coming up.** Reading is downward, so a
 * bar that is always there is spending a strip of screen on somebody who is
 * not looking at it — and this page's figures are wide drawn screens whose top
 * edge it was sitting on. Coming *up* is the gesture that means "take me
 * back", which is the only moment navigation is actually wanted. At the top it
 * is always out: there it costs nothing, and a header that appeared only after
 * you had scrolled down and reversed would look broken on arrival.
 *
 * **The trap is where the scrolling happens, and it has caught this page
 * before.** `<body>` is `overflow-hidden` for the editor shell, so the landing
 * page scrolls inside its own `h-dvh overflow-y-auto` container rather than the
 * window. `position: sticky` copes with that — it sticks to the nearest
 * scrolling ancestor — but `window.scrollY` does not: it stays at 0 forever, so
 * the bar would never gain its background and never know which way it is going.
 * So the listener goes on the container, which is this element's own parent.
 *
 * Sticky rather than fixed, so hiding it moves it without moving the page: the
 * strip keeps its place in the layout and only the paint slides away.
 */

/**
 * How far the page must move before the bar believes a direction.
 *
 * Without it the sub-pixel jitter of a trackpad — and the rubber-band at the
 * end of a fling — flips the direction every frame and the bar strobes. Twelve
 * pixels is under a line of text, so a deliberate flick up still answers at
 * once while a wobble does not.
 */
const TURN = 12;

/** Above this the bar has left the hero and needs a ground of its own. */
const LIFT = 8;

/**
 * How far down the page has to be before the bar will hide at all.
 *
 * This is most of what "smoothly" means. Without it the first nudge of the
 * wheel does two things in the same frame — the bar paints its background on
 * (it has just crossed `LIFT`) and immediately slides away carrying it — and
 * what a reader sees is a white strip flashing in and out at the top of the
 * hero. Holding it out for the first screenful means by the time it is allowed
 * to leave, it has been sitting there with its ground on for a while and the
 * exit is the only thing that moves.
 */
const SETTLE = 240;

export function LandingHeader({ ink }: { ink: string }) {
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // The scroll container is this header's parent — the one `LandingPage` puts
    // `h-dvh overflow-y-auto` on. Listening to `window` would never fire.
    const scroller = ref.current?.parentElement;
    if (!scroller) return;

    // Where the last committed direction change happened, not where the last
    // frame was. Tracking every frame would make one long scroll a run of tiny
    // reversals, and the threshold above would never be crossed.
    let mark = scroller.scrollTop;
    // Scroll fires faster than the screen repaints — on a trackpad several
    // times per frame. Coalescing to one read per frame is what keeps the
    // slide on the compositor instead of behind a queue of state updates.
    let queued = false;

    const read = () => {
      queued = false;
      const y = scroller.scrollTop;
      setScrolled(y > LIFT);

      if (y <= SETTLE) {
        // The first screenful always keeps its bar, whichever way it is going.
        setHidden(false);
        mark = y;
      } else if (y > mark + TURN) {
        setHidden(true);
        mark = y;
      } else if (y < mark - TURN) {
        setHidden(false);
        mark = y;
      }
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    };

    // Read on the next frame rather than in the effect body: a browser
    // restoring a scroll position on reload lands mid-page with the bar still
    // drawn transparent. Deferring keeps the read out of the render pass.
    const first = requestAnimationFrame(read);
    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(first);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    /*
     * Two animations, and keeping them apart is the whole of the smoothness.
     *
     * The element itself only ever moves: one property, `transform`, which the
     * compositor can run without laying anything out or repainting a pixel.
     * `will-change` says so in advance, so the layer is promoted before the
     * first frame rather than during it — a slide that begins with the layer
     * being created is the one that stutters.
     *
     * The ground is a separate layer underneath that only ever fades. It has
     * to be separate: it carries `backdrop-blur`, and a blur re-sampling what
     * is behind it *while the thing above it is sliding* is expensive on every
     * frame of the slide. Fading it on its own — quickly, and only when the
     * bar has left the hero — costs nothing during the move.
     *
     * `pointer-events-none` while hidden, or a bar nobody can see still
     * swallows clicks along the top of whatever is under it. `aria-hidden` on
     * the ground because it is paint.
     */
    <header
      ref={ref}
      className={`sticky top-0 z-50 transition-transform duration-[420ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform ${
        hidden ? "pointer-events-none -translate-y-full" : "translate-y-0"
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 border-b transition-opacity duration-200 ${
          scrolled
            ? "border-lp-edge bg-lp-ground/85 opacity-100 backdrop-blur"
            : "border-transparent opacity-0"
        }`}
      />
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
        {/* The same wordmark the dashboard sidebar carries, at the same size:
            a visitor who signs up should not have to learn a second mark on
            the other side of the door.

            It takes `lp-wordmark` rather than the app's `--color-wordmark`,
            which is the one place the two marks are allowed to differ. The
            app's token goes plain white at night because it sits in a black
            sidebar with nothing else near it; here the mark sits beside the
            page's own indigo — every link and every button on the page — and a
            white "Chapter" next to those would read as a third colour rather
            than as the brand. So it stays the accent's hue in both, lifted.

            In daylight it is the fill colour with its lightness lifted and
            nothing else changed: same hue, same saturation. A fill value set
            as type beside a near-black "Open" reads as more near-black instead
            of as the second half of a mark. */}
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight text-lp-ink"
        >
          Open<span className="text-lp-wordmark">Chapter</span>
        </Link>
        <nav className="flex items-center gap-6 font-sans text-sm text-lp-body">
          <a href="#order" className="hidden sm:inline hover:text-lp-ink">
            The order
          </a>
          <a href="#does" className="hidden sm:inline hover:text-lp-ink">
            What it does
          </a>
          <a href="#tools" className="hidden sm:inline hover:text-lp-ink">
            Tools
          </a>
          <Link href="/signin" className="hover:text-lp-ink">
            Log in
          </Link>
          <Link
            href="/signup"
            style={{ backgroundColor: ink }}
            className="rounded-full px-4 py-2 font-semibold text-lp-accent-ink hover:opacity-90"
          >
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}
