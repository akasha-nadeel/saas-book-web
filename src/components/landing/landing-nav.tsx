"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SECTIONS } from "./sections";

/**
 * The landing page's header: sticky, and transparent until the page moves.
 *
 * Two details make this work, and both are about *where the scrolling happens*.
 *
 * `<body>` is `overflow-hidden` for the editor shell, so the landing page
 * scrolls inside its own `h-dvh overflow-y-auto` container rather than the
 * window. `position: sticky` is fine with that — it sticks to the nearest
 * scrolling ancestor — but `window.scrollY` is not: it stays at 0 forever and
 * the bar never gains its background. So the listener goes on the container,
 * which is this element's own parent (see `LandingPage`).
 *
 * And the hero is pulled up underneath by the height of this bar, so its pale
 * blue runs behind a transparent header instead of leaving a white strip above
 * it. That means **the height here and the hero's compensating padding are one
 * measurement in two places**: change `h-16` and the hero's `-mt-16 pt-32` has
 * to move with it, or the first heading slides under the bar.
 */

const INK = "#0E1116";
const BLUE = "#1B63F5";

export function LandingNav() {
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // The scroll container is this header's parent — the one `LandingPage`
    // puts `h-dvh overflow-y-auto` on. Listening to `window` here would never
    // fire, because the window itself does not scroll on this page.
    const scroller = ref.current?.parentElement;
    if (!scroller) return;

    const onScroll = () => setScrolled(scroller.scrollTop > 8);

    // Read once on the next frame rather than in the effect body: a browser
    // restoring a scroll position on reload lands us mid-page with the bar
    // still drawn transparent. Deferring keeps it out of the render pass, which
    // a direct call here would not.
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
          ? "border-b border-[#EDEFF4] bg-white/90 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-8 px-5 sm:px-10">
        <Link
          href="/"
          className="shrink-0 font-display text-[21px] font-bold tracking-[-0.02em]
                     outline-none focus-visible:ring-2 focus-visible:ring-[#1B63F5]/50"
          style={{ color: INK }}
        >
          Open<span style={{ color: BLUE }}>Chapter</span>
        </Link>

        <nav className="hidden items-center gap-6 xl:flex xl:gap-8">
          {SECTIONS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="font-brand text-[15px] font-medium text-[#5A6170] outline-none
                         transition-colors hover:text-[#1B63F5]
                         focus-visible:ring-2 focus-visible:ring-[#1B63F5]/50"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          {/* Ink as a class, not an inline style: inline wins over any class,
              so `style={{ color: INK }}` here meant the hover never fired. */}
          <Link
            href="/signin"
            className="font-brand text-[15px] font-medium text-[#0E1116] outline-none
                       transition-colors hover:text-[#1B63F5] focus-visible:ring-2
                       focus-visible:ring-[#1B63F5]/50"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[#1B63F5] px-5 py-2.5 font-brand text-[15px]
                       font-semibold whitespace-nowrap text-white outline-none
                       transition-colors hover:bg-[#1147C9] focus-visible:ring-2
                       focus-visible:ring-[#1B63F5]/60"
          >
            Start writing free
          </Link>
        </div>
      </div>
    </header>
  );
}
