"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The landing page's header: invisible over the hero, and there once you move.
 *
 * A bar drawn over the hero is a bar competing with the headline, which is the
 * one thing on the page that has to land. So it carries no ground of its own
 * until the page has scrolled — at which point it *does* need one, or the
 * wordmark sits on top of whatever section is passing underneath.
 *
 * **The trap is where the scrolling happens, and it has caught this page
 * before.** `<body>` is `overflow-hidden` for the editor shell, so the landing
 * page scrolls inside its own `h-dvh overflow-y-auto` container rather than the
 * window. `position: sticky` copes with that — it sticks to the nearest
 * scrolling ancestor — but `window.scrollY` does not: it stays at 0 forever and
 * the bar never gains its background. So the listener goes on the container,
 * which is this element's own parent.
 *
 * A Client Component for the sake of one boolean, which is why it is this small
 * and why the page around it stays a Server Component.
 */
export function LandingHeader({ ink }: { ink: string }) {
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // The scroll container is this header's parent — the one `LandingPage` puts
    // `h-dvh overflow-y-auto` on. Listening to `window` would never fire.
    const scroller = ref.current?.parentElement;
    if (!scroller) return;

    const onScroll = () => setScrolled(scroller.scrollTop > 8);

    // Read on the next frame rather than in the effect body: a browser
    // restoring a scroll position on reload lands mid-page with the bar still
    // drawn transparent. Deferring keeps the read out of the render pass.
    const first = requestAnimationFrame(onScroll);
    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(first);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      ref={ref}
      className={`sticky top-0 z-50 transition-colors duration-200 ${
        scrolled
          ? "border-b border-lp-edge bg-lp-ground/85 backdrop-blur"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
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
