"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ToolsMenu } from "@/components/landing/tools-menu";

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

export function LandingHeader({
  ink,
  /**
   * Whether this bar is on the landing page itself.
   *
   * The two nav entries are in-page anchors, and the note beside them says
   * exactly what goes wrong when one points at a section that is not there: it
   * scrolls nowhere and reads as the product being broken. `/tools` mounts this
   * same header, so off the landing page both are rooted to `/#order` and
   * `/#tools` — they navigate home and then scroll.
   *
   * A prop rather than `usePathname()`, matching `LandingFooter`: this
   * component is already a client one, but the two callers each know the
   * answer statically and a hook here would be one more thing to reason about
   * on first paint.
   */
  home = true,
}: {
  ink: string;
  home?: boolean;
}) {
  /* Rooted once, used twice. `#order` from `/tools` is a link to nothing. */
  const at = (hash: string) => (home ? hash : `/${hash}`);

  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  /**
   * Whether the Tools menu is open.
   *
   * The bar hides itself on a downward scroll, and the menu hangs off it — so
   * without this the panel would ride off the top of the screen mid-read,
   * taking the pointer's target with it. `shouldHide` below is where it is
   * spent; the scroll listener goes on recording direction either way, so the
   * bar behaves correctly the moment the menu closes rather than having to be
   * scrolled again to catch up.
   */
  const [menuOpen, setMenuOpen] = useState(false);

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
        hidden && !menuOpen
          ? "pointer-events-none -translate-y-full"
          : "translate-y-0"
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
      {/* `max-w-[88rem] px-6`, which is the page's one measure — the wordmark has
          to start on the same line as every heading below it. It was `px-4` up
          to `sm`, which put the bar's left edge 8px inside every section's on
          a phone: small, and exactly the kind of small that reads as the
          header belonging to a different page. */}
      {/* The bar's height is the button height plus this, and the button is
          the part that may not shrink — it is the offer. So the trimming
          happens here. Note that nothing downstream has to be adjusted with
          it: the hero is pulled up by a fixed `-mt-16` and its wall of cards
          is pushed down by the same `top-16`, which lands the wall on the
          header's bottom edge whatever height the header settles at. */}
      <div className="relative mx-auto flex max-w-[88rem] items-center justify-between gap-3 px-6 py-1.5 sm:gap-6 sm:px-8 sm:py-2 lg:px-10">
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
          className="text-xl font-bold tracking-tight text-lp-ink sm:text-2xl"
        >
          Open<span className="text-lp-wordmark">Chapter</span>
        </Link>
        {/* **Three groups across the bar, not two.** The links used to sit in
            the same flex row as the buttons, hard against the right edge, so
            the bar read as a wordmark and then a crowd. Held in the middle
            with the actions at the far end, each group is one kind of thing:
            *where you are on the page*, then *what you can do about it*. The
            seam between them is the whole layout.

            `text-[0.9375rem]`, a shade under the buttons: the links are
            navigation and the pair at the end is the offer, and a row where
            all six things are the same size has no offer in it. */}
        <nav className="hidden items-center gap-8 font-sans text-[0.9375rem] font-medium text-lp-body md:flex">
          {/* **Every entry here points at something that exists, and that rule
              has already cost one of them.** "What it does" pointed at
              `#does`, the three-phase section, and that section came off the
              page — so the link went with it in the same commit. A nav entry
              whose target is not on the page is worse than a missing one: it
              scrolls nowhere, says nothing, and is the one kind of broken a
              visitor blames on the product rather than on the page.

              **The order is the page's own order**, which is what these are
              for — the road, then what the app looks like, then the sixteen
              tools, then the answers, then what it costs. Rebuilt on
              2026-08-15 against the current page: two of these sections are
              new since the last time this bar was looked at, and the page had
              grown three screens that the nav did not admit existed. */}
          <a href={at("#order")} className="hover:text-lp-ink">
            The order
          </a>
          <a href={at("#inside")} className="hover:text-lp-ink">
            Inside the app
          </a>
          {/* **Tools is a menu rather than an anchor, and it is the one entry
              that earns the extra machinery.** The section it used to point at
              is a cloud of marks around a count — right as a section and
              useless as a destination, since it names none of the sixteen. The
              menu names all of them and goes to each one's own row on
              `/tools`. See `tools-menu.tsx`; the bar is told when it is open so
              it does not slide away underneath it. */}
          <ToolsMenu onOpenChange={setMenuOpen} />
          <a href={at("#faq")} className="hover:text-lp-ink">
            FAQ
          </a>
          {/* **The one item here that leaves the page, and it belongs with the
              anchors anyway** — a price is information, the same kind of thing
              as Tools, rather than an account action.

              It is not optional furniture: Paddle reviews this domain before
              it will let anybody take a card, and "pricing details or a
              pricing page" is on the list it checks. This page states no
              figure of its own by design — every number is read from the
              modules that enforce it — so without this link the prices live at
              a URL a visitor is never told about. */}
          <Link href="/upgrade" className="hover:text-lp-ink">
            Pricing
          </Link>
        </nav>

        {/* ---- The pair -------------------------------------------------

            **Outline, then fill — one shape at two volumes.** Both are the
            same pill at the same height in the same ink, and the only thing
            separating them is whether the ink is the ground or the border.
            That is what makes them read as one control with two answers
            rather than as two unrelated buttons.

            `border`, one pixel. A previous pair here used `border-2`, on the
            finding that a hairline outline read as a box drawn round a word —
            true at the padding it had then. These are wider and taller, and at
            this size a heavy outline is the thing that looks unresolved.

            **"Log in" is back, and "Check your book" has gone.** The check was
            a `<label>` bound to the hero's own file input, which is a genuinely
            nice trick and cost nothing to keep; what it cost to *lose* is the
            only route from this bar to the check, which now lives in a band of
            its own below the mosaic under the hero and has to be scrolled to. What it
            buys is the pairing every visitor already knows how to read: the
            way in for somebody who has an account, beside the way in for
            somebody who does not. A returning writer had no way back to their
            books from this bar at all, which was the older complaint. */}
        <span className="flex items-center gap-2.5">
          <Link
            href="/signin"
            style={{ borderColor: ink, color: ink }}
            className="rounded-full border px-5 py-1.5 text-[0.9375rem] font-semibold transition-colors hover:bg-lp-tint sm:px-6 sm:py-2"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            style={{ backgroundColor: ink }}
            className="rounded-full px-5 py-1.5 text-[0.9375rem] font-semibold text-lp-accent-ink hover:opacity-90 sm:px-6 sm:py-2"
          >
            Start free
          </Link>
        </span>
      </div>
    </header>
  );
}
