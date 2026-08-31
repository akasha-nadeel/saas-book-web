"use client";

import Link from "next/link";
import {
  RailMark,
  useMarkHandle,
  type MarkName,
} from "@/components/editor/rail-mark";

/**
 * The narrow icon columns down each edge.
 *
 * Every button here does something. The reference carries a dozen tools per
 * rail — goals, revisions, spell check, collaborators — and most of those are
 * features this app does not have, so the rails are shorter rather than padded
 * with icons that lead nowhere.
 */

export function RailButton({
  label,
  active,
  onClick,
  href,
  glyph,
  mark,
  disabled,
  side = "left",
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  /**
   * Off while the button's own work is in flight — a file being read, so far.
   * Never for "you may not do this": a control that is permanently dead is the
   * thing the house rules forbid, and the rails hide those instead.
   */
  disabled?: boolean;
  /**
   * A typographic mark instead of a drawn icon — ¶ and nothing else so far.
   *
   * **This exists because the alternative silently drew nothing.** `children`
   * is placed inside the `<svg>` below, which is right for the paths every
   * other button passes and wrong for anything else: an HTML element inside an
   * SVG is in the SVG namespace, where the browser does not know it and simply
   * does not paint it. The paragraph-marks button was passing a `<span>` and
   * had been rendering as an empty 48px hole in the rail — a control that is
   * there, is clickable, is announced to a screen reader, and cannot be seen.
   *
   * Set at the icons' own size and weight so the mark sits in the column with
   * them rather than reading as a piece of text that fell into the rail.
   */
  glyph?: string;
  /**
   * A drawn icon that moves on hover — see `RailMark`.
   *
   * **This replaced `imgSrc`, which took a PNG out of `public/icons/`.** A
   * bitmap is the one thing on this rail that cannot follow the theme, cannot
   * take a size and goes soft on a retina screen; the marks are ordinary SVG
   * and their motion is driven from this button, since the glyph is 24px
   * inside a 48px target and most of a hover never touches it.
   */
  mark?: MarkName;
  side?: "left" | "right";
  children?: React.ReactNode;
}) {
  const handle = useMarkHandle();

  /* **The selected button is the dashboard's own pale blue, not a filled
     accent tile.** It was `bg-accent text-accent-ink` — a solid slab, white at
     night and indigo by day — which made whichever tab was open the loudest
     thing beside the manuscript, and inverted its icon on top of that. The
     dashboard's rail had already answered this question for the same kind of
     control: a wash at 15% that says *you are here* without shouting it, with
     the icon staying in the app's own ink either way. Two navigations in one
     product should not disagree about what selected looks like, so this is
     `SideItem`'s string in `bookshelf.tsx` — change one and change both.

     The icons themselves are `fg`, near-black by day and near-white at night,
     rather than `muted`: they are the controls, not their captions. */
  const className = `group relative flex h-12 w-12 items-center justify-center rounded-xl
                     outline-none transition-colors focus-visible:ring-2
                     focus-visible:ring-accent/60 ${
                       active
                         ? "bg-blue-500/15 text-fg dark:bg-blue-500/25"
                         : "text-fg/80 hover:bg-raised/70 hover:text-fg"
                     } ${disabled ? "opacity-50" : ""}`;

  const icon = mark ? (
    <RailMark mark={mark} markRef={handle.ref} />
  ) : glyph ? (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 items-center justify-center font-sans text-lg
                 leading-none font-medium"
    >
      {glyph}
    </span>
  ) : (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {children}
    </svg>
  );

  const tooltipPosition =
    side === "left"
      ? "left-full ml-3.5 top-1/2 -translate-y-1/2"
      : "right-full mr-3.5 top-1/2 -translate-y-1/2";

  const tooltip = (
    <span
      role="tooltip"
      className={`pointer-events-none absolute ${tooltipPosition} z-50 whitespace-nowrap rounded-xl border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-900 shadow-[0_4px_20px_rgba(0,0,0,0.12)] opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 dark:border-white/10 dark:bg-[#212121] dark:text-white dark:shadow-[0_4px_20px_rgba(0,0,0,0.45)]`}
    >
      {label}
    </span>
  );

  // The mark's motion is the button's to start: an icon left to its own
  // `onHoverStart` sits still through most of a hover, because it is 20px in
  // the middle of a 48px target. Focus counts too — a keyboard is a way to be
  // on a control, and the tooltip already answers to it.
  const moves = {
    onMouseEnter: handle.onEnter,
    onMouseLeave: handle.onLeave,
    onFocus: handle.onEnter,
    onBlur: handle.onLeave,
  };

  if (href) {
    return (
      <Link href={href} aria-label={label} className={className} {...moves}>
        {icon}
        {tooltip}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={className}
      {...moves}
    >
      {icon}
      {tooltip}
    </button>
  );
}

/**
 * The hairline between two groups of rail buttons.
 *
 * **It carries no margin of its own, and that is the whole of it.** This was
 * `my-1` in four places across the two rails, which *added* to the `gap-2` the
 * rail already puts between its children: 8px of gap plus 4px of margin on
 * each side, so a rule that separates two groups sat in 24px of air where
 * every other gap in the column is 8. Three different spacings in one narrow
 * strip — 8 within a group, 24 around a rule, and `mt-auto` before the footer
 * — read as a rail that had been assembled rather than spaced.
 *
 * With the margin gone the rule takes an ordinary slot in the flex column, so
 * a group boundary is 8 + 1 + 8 against a within-group 8: still plainly a
 * bigger gap, still obviously a division, and now a multiple of the one number
 * the rail is built on. Change the spacing here and both rails move together,
 * which is why this is a component rather than a string copied twice more.
 */
export function RailDivider() {
  return <span aria-hidden="true" className="h-px w-6 bg-line" />;
}

export function Rail({
  side,
  children,
  footer,
  className = "",
}: {
  side: "left" | "right";
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra classes — e.g. to hide the tool rail on small screens. */
  className?: string;
}) {
  return (
    <nav
      aria-label={side === "left" ? "Panels" : "Tools"}
      /* Marks both rails as "not outside the tool panel".

         The panel closes on a press anywhere else, and the controls that open
         and close it live here — on the left as tabs, on the right as the
         Assistant button. Without this the toggle eats itself: pressing the tab
         you are on would close the panel on `pointerdown` and the `click`
         behind it would find it shut and open it straight back up. */
      data-rail={side}
      /* **Both rails wear the app's chrome.** The right one used to take the
         *page's* colours, on the reasoning that its tools act on the manuscript
         and so belong with it. That reads well on paper and badly on a screen:
         with a white sheet on a dark app — the commonest pairing — it put a
         white strip down the side of a black window, brighter than anything
         else on it, for a column of buttons that open dialogs and panels. A
         control that navigates the app is chrome wherever it points, and the
         page is the thing between the two rails rather than a thing they are
         part of. */
      /* **The left rail sits above the tool panel, so the panel can come out
         from behind it.** Both surfaces are opaque, so with the rail underneath
         a drawer sliding in from `translateX(-100%)` would travel *across* it
         and the rail's icons would flicker under a moving sheet. Above it, the
         panel appears from the rail's own edge, which is where it comes from.
         45 rather than 50: under the app's dialogs, over the panel at 40. */
      className={`scroll-slim flex shrink-0 flex-col
                  items-center gap-2 overflow-visible pt-4 pb-14 nav-chrome ${
                    side === "left"
                      ? "relative z-[45] border-r w-(--rail-width)"
                      : "relative z-[45] border-l w-(--rail-width)"
                  } border-line ${className}`}
    >
      {children}
      {/* Pinned to the foot, and at the rail's own spacing rather than a
          tighter one — a group that sits closer together than the rest reads
          as a sub-list of whatever is above it, which is the opposite of what
          being down here says. */}
      {footer && (
        <div className="mt-auto flex flex-col items-center gap-2">{footer}</div>
      )}
    </nav>
  );
}

/*
 * The one icon path this module still owns.
 *
 * The rails' own glyphs moved to `rail-mark.tsx` when they became coloured
 * discs over the itshover set. This is not one of them: it is the tool panel's
 * own close control, drawn in the panel's ink at the panel's weight, and a
 * coloured disc on the chrome *inside* a panel is exactly the second design
 * the mark palette is scoped to avoid.
 */
export const icons = {
  panel: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M8 3.5v13" />
    </>
  ),
};
