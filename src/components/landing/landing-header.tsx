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

/**
 * One entry in the bar's middle group.
 *
 * A union rather than a plain `{ href, label }[]` because **Tools is a menu
 * rather than a link** and it has to keep its *place* in the row — a boolean
 * prop beside the array could say whether it is drawn but not where, and the
 * order of these entries is the page's own order, which is the whole of what
 * they are for.
 *
 * An `href` beginning with `#` is an in-page anchor and is rooted through `at`
 * below; anything else is an ordinary route.
 */
export type HeaderNavItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "tools" };

/**
 * The bar for the full sixteen-tool page.
 *
 * **Every entry here points at something that exists, and that rule has already
 * cost one of them.** "What it does" pointed at `#does`, the three-phase
 * section, and that section came off the page — so the link went with it in the
 * same commit. A nav entry whose target is not on the page is worse than a
 * missing one: it scrolls nowhere, says nothing, and is the one kind of broken
 * a visitor blames on the product rather than on the page.
 *
 * **The order is the page's own order**, which is what these are for — the
 * road, then what the app looks like, then the sixteen tools, then the answers,
 * then what it costs.
 *
 * Pricing is the one item that leaves the page, and it belongs with the anchors
 * anyway — a price is information, the same kind of thing as Tools, rather than
 * an account action. It is not optional furniture either: Paddle reviews this
 * domain before it will let anybody take a card, and "pricing details or a
 * pricing page" is on the list it checks.
 */
export const FULL_NAV: HeaderNavItem[] = [
  { kind: "link", href: "#order", label: "The order" },
  { kind: "link", href: "#inside", label: "Inside the app" },
  { kind: "tools" },
  { kind: "link", href: "#faq", label: "FAQ" },
  { kind: "link", href: "/upgrade", label: "Pricing" },
];

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
  /**
   * What sits in the bar's middle group.
   *
   * A prop rather than a constant because there are two products on this
   * domain: the full sixteen-tool page and the launch MVP, whose sections are
   * different ones and whose Tools menu would link to a `/tools` the proxy
   * redirects home. Defaulting to `FULL_NAV` keeps the two existing callers
   * unchanged.
   */
  items = FULL_NAV,
  /**
   * Whether the section *behind the un-scrolled bar* is dark.
   *
   * The bar is transparent until the page scrolls, so at the top its type is
   * really sitting on whatever the first section paints.
   */
  overDark = false,
  /**
   * Whether the page's own ground is dark — which is what the bar sits on
   * once it has scrolled and faded its `lp-ground` backdrop in.
   *
   * **Two booleans rather than one, because the two states are genuinely
   * independent and the launch MVP proved it.** That page is a *light*
   * gradient hero on a *dark* page: near-black type at the top, near-white
   * type the moment the bar has a ground of its own. One flag cannot say that,
   * and every arrangement so far has needed a different pair — a dark hero on
   * a light page (white, then near-black), a dark hero on a dark page (white
   * throughout), and now the inverse of the first. Each time the condition was
   * a single flag it was right for one page and silently wrong for the other.
   *
   * Props rather than a measurement of what is underneath, for the reason
   * `home` is one: the caller knows both answers statically, and sampling the
   * section below a sticky element on every frame is a great deal of machinery
   * for two booleans that never change.
   */
  darkPage = false,
  /**
   * Whether the bar is a floating capsule rather than a full-width strip.
   *
   * The reference the launch MVP follows sets its bar as a white pill inset
   * from the edges and laid *on* the hero, rather than as a strip the hero
   * runs under. It is a prop rather than the default because the two shapes
   * want opposite things from the scroll behaviour: a strip has to grow a
   * ground when the page moves under it, and a capsule already has one — so
   * `floating` also turns the fading backdrop off, and there is nothing to
   * fade.
   */
  floating = false,
}: {
  ink: string;
  home?: boolean;
  items?: HeaderNavItem[];
  overDark?: boolean;
  darkPage?: boolean;
  floating?: boolean;
}) {
  /* Rooted once, used for every anchor. `#order` from `/tools` is a link to
     nothing, so away from home the anchors navigate there and *then* scroll. */
  const at = (hash: string) => (home ? hash : `/${hash}`);

  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  /* Which ground the bar is actually on, which is the only question its six
     colours care about: the first section while the bar is transparent, the
     page's own ground once it is not. */
  const onDark = scrolled ? darkPage : overDark;
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
      /* **The bar pins light whenever it is not on a dark ground**, and that
         is what makes `onDark`'s *false* branch mean anything on a dark page.
         Those branches ask for `lp-ink`, `lp-body` and `lp-wordmark` — the
         right names, but on the launch MVP they resolve near-*white*, because
         the page they belong to is dark. The bar is a sibling of the hero
         rather than a child, so it never inherits the light re-points the
         gradient section makes for itself.

         One attribute settles it: the same subtree pin the landing pages use,
         documented beside the light block in `globals.css`. When the bar *is*
         on dark the attribute is absent, so the tokens fall through to the
         page's own — and the `onDark` branches state their whites literally
         anyway, for the one case where the ground is a photograph rather than
         a theme. */
      data-theme={onDark ? undefined : "light"}
      className={`sticky top-0 z-50 transition-transform duration-[420ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform ${
        floating ? "px-4 sm:px-6" : ""
      } ${
        hidden && !menuOpen
          ? "pointer-events-none -translate-y-full"
          : "translate-y-0"
      }`}
    >
      {/* The strip's ground, which fades in once the page has moved under it.
          A capsule brings its own, so this is not rendered for one at all —
          see the note on `floating`. */}
      {!floating && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 border-b transition-opacity duration-200 ${
            scrolled
              ? "border-lp-edge bg-lp-ground/85 opacity-100 backdrop-blur"
              : "border-transparent opacity-0"
          }`}
        />
      )}
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
      <div
        className={`relative mx-auto flex items-center justify-between gap-3 transition-[background-color,box-shadow,border-color] duration-200 sm:gap-6 ${
          floating
            ? `max-w-6xl rounded-full px-5 py-2.5 sm:px-7 sm:py-3 ${
                scrolled
                  ? "border border-lp-line bg-white shadow-[0_8px_32px_-8px_rgba(15,15,16,0.18)]"
                  : "border border-transparent bg-transparent shadow-none"
              }`
            : "max-w-[88rem] px-6 py-1.5 sm:px-8 sm:py-2 lg:px-10"
        }`}
      >
        {/* Logo — always far left */}
        <Link
          href="/"
          className={`shrink-0 text-2xl font-bold tracking-tight transition-colors sm:text-3xl ${
            onDark ? "text-white" : "text-lp-ink"
          }`}
        >
          Open
          <span className={onDark ? "text-lp-stage-accent" : "text-lp-wordmark"}>
            Chapter
          </span>
        </Link>

        {/* Nav — centered absolutely so it doesn't depend on button widths */}
        <nav
          className={`hidden flex-1 items-center justify-center gap-7 font-sans text-[1rem] font-semibold transition-colors md:flex ${
            onDark ? "text-white" : "text-lp-ink"
          }`}
        >
          {items.map((item, i) =>
            item.kind === "tools" ? (
              <ToolsMenu key="tools" onOpenChange={setMenuOpen} />
            ) : item.href.startsWith("#") ? (
              <a
                key={`${item.label}-${i}`}
                href={at(item.href)}
                className="hover:underline hover:underline-offset-4"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={`${item.label}-${i}`}
                href={item.href}
                className="hover:underline hover:underline-offset-4"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        {/* Buttons — always far right */}
        <span className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/signin"
            style={
              onDark
                ? { borderColor: "#ffffff", color: "#ffffff" }
                : { borderColor: ink, color: ink }
            }
            className={`rounded-full border px-5 py-1.5 text-[0.9375rem] font-semibold transition-colors sm:px-6 sm:py-2 ${
              onDark ? "hover:bg-white/15" : "hover:bg-lp-tint"
            }`}
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
