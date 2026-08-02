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
          ? "border-b border-[#e4e4ef] bg-white/85 backdrop-blur"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
        {/* The same wordmark the dashboard sidebar carries, at the same size:
            a visitor who signs up should not have to learn a second mark on
            the other side of the door.

            Its colour is stated literally rather than taken from the
            `--color-wordmark` token the app uses, because this page is always
            light whatever theme the reader has chosen inside the product — and
            that token turns white in the dark set, which here would be white
            on white. Keep the two in step by hand.

            It is `ink` with its lightness lifted and nothing else changed —
            same hue, same saturation. That value is a fill colour, and set as
            type beside a near-black "Open" it reads as more near-black instead
            of as the second half of a mark. */}
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight text-[#0f0f10]"
        >
          Open<span className="text-[#423ead]">Chapter</span>
        </Link>
        <nav className="flex items-center gap-6 font-sans text-sm text-[#5b5b63]">
          <a href="#order" className="hidden sm:inline hover:text-[#0f0f10]">
            The order
          </a>
          <a href="#does" className="hidden sm:inline hover:text-[#0f0f10]">
            What it does
          </a>
          <a href="#tools" className="hidden sm:inline hover:text-[#0f0f10]">
            Tools
          </a>
          <Link href="/signin" className="hover:text-[#0f0f10]">
            Log in
          </Link>
          <Link
            href="/signup"
            style={{ backgroundColor: ink }}
            className="rounded-full px-4 py-2 font-semibold text-white hover:opacity-90"
          >
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}
