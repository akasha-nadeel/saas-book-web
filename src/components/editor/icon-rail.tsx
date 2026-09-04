"use client";

import Link from "next/link";
import {
  RailMark,
  useMarkHandle,
  type MarkName,
} from "@/components/editor/rail-mark";
import { Tooltip } from "@/components/ui/tooltip";

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
  name,
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
  /**
   * The short word drawn under the icon. Omitted leaves the button uncaptioned.
   *
   * Separate from `label`, which stays the full name and is what a screen
   * reader and the tooltip both use — see `PANEL_RAIL_NAMES`.
   */
  name?: string;
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

     **It is `accent/10` since 2026-09-01, and both were changed together.**
     It was a literal `blue-500/15`, which by then was the app's *third* answer
     to "what does selected look like": the panels beside this rail had moved
     to the accent, the navigator with them, and a hard-coded blue left the
     rail disagreeing with the panel it opens. The accent is the brand indigo
     by day and white at night, so unlike the literal it follows the theme.

     The icons themselves are `fg`, near-black by day and near-white at night,
     rather than `muted`: they are the controls, not their captions. */
  /**
   * **The tile is the button now, and the name sits under it.**
   *
   * The rail carried icons alone with the name in a tooltip, which works while
   * a rail holds one kind of thing and a writer can learn eight shapes. It
   * holds fifteen since the right-hand rail was folded into it, half of them
   * tools rather than panels, and a column of unlabelled glyphs at that length
   * is a memory test. Every application that got here first — Canva, Figma,
   * VS Code — put the word under the icon, and the reason is the same in all
   * of them: the icon is how you find it again, the word is how you find it
   * the first time.
   *
   * The tooltip stays. It carries the *full* name where the label is a short
   * form, so "Check" can still say Consistency check on hover.
   */
  /**
   * **The ground is on the icon, not on the button.**
   *
   * The whole control used to light up — icon, word and the padding round
   * both — which at this width is a block of colour the size of a small card
   * for something the pointer is only passing over. What the eye is aiming at
   * is the glyph, so that is what gets the plate: a rounded square behind the
   * mark, with the word standing outside it.
   *
   * **And selected is a colour rather than a deeper ground.** This carried
   * `dark:bg-selected` on the reasoning that on the navy set a selected row
   * *sinks* into the chrome instead of lifting off it — true of a row in a
   * list, and the wrong shape here: hover and selected then differed by how
   * deep they sat, which is a comparison you can only make by having both in
   * front of you. One plate for both, and the accent on the mark says which.
   * That is the hue’s one job in this app, and a rail tab is exactly “this is
   * where you are”.
   */
  const className = `group relative flex w-full flex-col items-center gap-1
                     rounded-xl px-1 py-1.5 outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/60 ${
                       active ? "text-accent" : "text-fg/80 hover:text-fg"
                     } ${disabled ? "opacity-50" : ""}`;

  /* The plate. `bg-raised` for both states, so the tile is the *target* and
     never the answer to which tab is open. */
  const tile = `flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl
                transition-colors ${
                  active ? "bg-raised" : "group-hover:bg-raised/70"
                }`;

  const drawing = mark ? (
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

  /* The mark in its plate. Every one of the three drawings above goes in the
     same tile, so a rail of marks, glyphs and raw paths still lights the same
     shape whichever it happens to be. */
  const icon = (
    <span aria-hidden="true" className={tile}>
      {drawing}
    </span>
  );

  /* **`ui/tooltip.tsx` draws this now**, and the card there was lifted from
     the one that used to live here — so nothing changed on screen. It went to
     the shelf because eight files had hand-rolled the same `role="tooltip"`
     card with eight sets of classes; this was the best of them and became the
     one. `nowrap` is the prop that exists for these labels: a rail label is a
     word or two with the whole window to spill into, where a tooltip in a
     240px panel has to wrap. */
  const tooltip = (
    <Tooltip label={label} side={side === "left" ? "right" : "left"} nowrap />
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

  /**
   * The word under the icon.
   *
   * `aria-hidden`, because the button already carries `aria-label` with the
   * full name — a screen reader hearing "Check, Consistency check" is being
   * read the same control twice, once badly.
   *
   * Given `name`, drawn; without it, nothing, so the handful of rail buttons
   * that are genuinely self-evident (the book's own cover) are not forced to
   * caption themselves.
   */
  const caption = name ? (
    <span
      aria-hidden="true"
      /* **The word keeps its own ink**, and does not take the accent with the
         mark. Colouring both would make the whole button the signal again,
         which is what moving the ground onto the tile was for; the glyph is
         the thing being pointed at and the word is what it is called. */
      className={`w-full truncate text-center font-sans text-[0.625rem]
                  leading-tight font-medium ${
                    active ? "text-fg" : "text-inherit"
                  }`}
    >
      {name}
    </span>
  ) : null;

  if (href) {
    return (
      <Link href={href} aria-label={label} className={className} {...moves}>
        {icon}
        {caption}
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
      {caption}
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
      /* **It scrolls, and it shows the bar only on hover.**

         `overflow-visible` was right while the rail was eight icons that
         always fitted; it now carries the tools the right-hand rail used to,
         with a word under each, and on a laptop that column is taller than the
         window. Left visible, the overflow simply ran off the bottom of the
         screen with no way to reach it.

         `oc-rail-scroll` is the hover reveal — the bar is transparent until the
         pointer is in the rail, so a column of buttons is not permanently wearing
         a scrollbar it needs twice a session. `scroll-slim` is the app's own
         thin bar underneath it, the one the panels and the composer use.

         **Both axes clip, and that is unavoidable**: a box that scrolls on one
         axis cannot be `visible` on the other — the browser promotes it to
         `auto`. What made `overflow-visible` necessary before was the tooltips
         and the flyouts that open sideways out of this rail, and both are
         portalled to `document.body` now (`ui/tooltip.tsx`, `Flyout`), so
         neither is inside the box to be cut. Anything added here that opens
         sideways must portal too. */
      className={`oc-rail-scroll scroll-slim flex shrink-0 flex-col
                  items-center gap-1 overflow-y-auto pt-4 pb-14 nav-chrome ${
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
