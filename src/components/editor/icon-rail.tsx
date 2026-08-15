"use client";

import Link from "next/link";

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
  disabled,
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
  children?: React.ReactNode;
}) {
  // A large filled tile for the active rail item, as in the reference, rather
  // than a subtle tint — at this size the rail is the primary navigation.
  const className = `flex h-12 w-12 items-center justify-center rounded-xl
                     outline-none transition-colors focus-visible:ring-2
                     focus-visible:ring-accent/60 ${
                       active
                         ? "bg-accent text-accent-ink"
                         : "text-muted hover:bg-raised hover:text-fg"
                     } ${disabled ? "opacity-50" : ""}`;

  const icon = glyph ? (
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

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        {icon}
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
      title={label}
      className={className}
    >
      {icon}
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
  paper,
  className = "",
}: {
  side: "left" | "right";
  children: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Set to take the page's colours instead of the chrome's. The tools act on
   * the manuscript, so they sit with it; the left rail navigates the app and
   * stays with the app.
   */
  paper?: string;
  /** Extra classes — e.g. to hide the tool rail on small screens. */
  className?: string;
}) {
  return (
    <nav
      aria-label={side === "left" ? "Panels" : "Tools"}
      data-paper={paper}
      /* Marks both rails as "not outside the tool panel".
​
         The panel closes on a press anywhere else, and the controls that open
         and close it live here — on the left as tabs, on the right as the
         Assistant button. Without this the toggle eats itself: pressing the tab
         you are on would close the panel on `pointerdown` and the `click`
         behind it would find it shut and open it straight back up. */
      data-rail={side}
      // The left rail is app navigation, so it wears the nav chrome (see
      // .nav-chrome) to match the shelf's sidebar. The right rail takes the
      // paper's colours instead: its tools belong to the page, not the app.
      /* **The left rail sits above the tool panel, so the panel can come out
         from behind it.** Both surfaces are opaque, so with the rail underneath
         a drawer sliding in from `translateX(-100%)` would travel *across* it
         and the rail's icons would flicker under a moving sheet. Above it, the
         panel appears from the rail's own edge, which is where it comes from.
         45 rather than 50: under the app's dialogs, over the panel at 40. */
      className={`scroll-slim flex w-(--rail-width) shrink-0 flex-col
                  items-center gap-2 overflow-y-auto pt-4 pb-14 ${
                    paper ? "rail-paper" : "nav-chrome"
                  } ${
                    side === "left" ? "relative z-[45] border-r" : "border-l"
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
 * Icon paths, kept here so the rails read as a list of actions.
 *
 * Drawn to one system: a 20-unit box with the shape living between 2.5 and
 * 17.5, so every glyph carries the same optical weight and the column of them
 * lines up. Stroke width, caps and joins come from the wrapper — a path that
 * sets its own would break step with the rest.
 */
export const icons = {
  /** A clock turned back, for chapter history. */
  history: (
    <>
      <path d="M3.2 10a6.8 6.8 0 1 0 2-4.8" />
      <path d="M2.9 3.6v3.4h3.4" />
      <path d="M10 6.6V10l2.4 1.4" />
    </>
  ),
  /** An open book with a bookmark, for the story bible. */
  bible: (
    <>
      <path d="M3.2 4.6h4.4a2.4 2.4 0 0 1 2.4 2.4v9.2a1.8 1.8 0 0 0-1.8-1.8H3.2Z" />
      <path d="M16.8 4.6h-4.4A2.4 2.4 0 0 0 10 7v9.2a1.8 1.8 0 0 1 1.8-1.8h5Z" />
    </>
  ),
  /** A lamp, for the idea parking lot. One shape, one viewBox, round caps. */
  ideas: (
    <>
      <path d="M10 2.9a4.7 4.7 0 0 0-2.8 8.5c.5.4.8 1 .8 1.6v.6h4v-.6c0-.6.3-1.2.8-1.6A4.7 4.7 0 0 0 10 2.9Z" />
      <path d="M8.4 16.1h3.2M8.9 17.7h2.2" />
    </>
  ),
  home: (
    <>
      <path d="M2.8 8.4 10 2.8l7.2 5.6v7.1a1.4 1.4 0 0 1-1.4 1.4H4.2a1.4 1.4 0 0 1-1.4-1.4z" />
      <path d="M7.9 16.9v-4.4h4.2v4.4" />
    </>
  ),
  chapters: (
    <>
      <path d="M10 6.4c0-1.1-1.4-1.9-3.8-1.9h-3v9.6h3c2.4 0 3.8.9 3.8 2" />
      <path d="M10 6.4c0-1.1 1.4-1.9 3.8-1.9h3v9.6h-3c-2.4 0-3.8.9-3.8 2" />
    </>
  ),
  notes: (
    <>
      <path d="M11.6 2.8H6.2a1.5 1.5 0 0 0-1.5 1.5v11.4a1.5 1.5 0 0 0 1.5 1.5h7.6a1.5 1.5 0 0 0 1.5-1.5V6.4z" />
      <path d="M11.6 2.8v2.9a.9.9 0 0 0 .9.9h2.8" />
      <path d="M7.5 10.6h5M7.5 13.4h3.2" />
    </>
  ),
  bookmarks: (
    <path d="M5.6 4.1a1.4 1.4 0 0 1 1.4-1.3h6a1.4 1.4 0 0 1 1.4 1.3v13L10 13.7 5.6 17.1z" />
  ),
  add: <path d="M10 4.2v11.6M4.2 10h11.6" />,
  focus: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.2" />
      {/* Filled, so the centre reads as a point rather than a third ring. */}
      <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  typewriter: (
    <>
      <path d="M5.6 8V4.4a1 1 0 0 1 1-1h6.8a1 1 0 0 1 1 1V8" />
      <rect x="2.6" y="8" width="14.8" height="6.4" rx="1.6" />
      <path d="M6.6 11.2h6.8" />
    </>
  ),
  assistant: (
    <>
      {/* The four-pointed spark that has come to mean "a machine wrote this".
          Concave sides rather than a straight-edged star: it reads as light
          rather than as a rating. */}
      <path d="M9.6 2.6c.9 3.4 1.7 4.2 5.1 5.1-3.4.9-4.2 1.7-5.1 5.1-.9-3.4-1.7-4.2-5.1-5.1 3.4-.9 4.2-1.7 5.1-5.1z" />
      {/* A second, smaller one, so the mark reads as a sparkle and not as a
          single lopsided shape. */}
      <path d="M15 12.4c.45 1.7.85 2.1 2.55 2.55-1.7.45-2.1.85-2.55 2.55-.45-1.7-.85-2.1-2.55-2.55 1.7-.45 2.1-.85 2.55-2.55z" />
    </>
  ),
  export: (
    <>
      <path d="M10 2.9v8.7" />
      <path d="m6.4 8.2 3.6 3.6 3.6-3.6" />
      <path d="M3.4 13.6v1.9a1.6 1.6 0 0 0 1.6 1.6h10a1.6 1.6 0 0 0 1.6-1.6v-1.9" />
    </>
  ),
  /**
   * Two people, for sharing the book with a co-writer.
   *
   * **Not the three-nodes-and-two-lines "share" glyph**, which every product
   * that uses it means *send this somewhere else* by — a tweet, a link, a
   * system share sheet. Nothing is sent here: the owner adds somebody to the
   * book and the two of them work on it. Google Docs, Notion and Figma all put
   * a person on this control for that reason, and the second figure is what
   * separates "share with someone" from "my account".
   *
   * Drawn to the same 20-unit system as the rest — the shapes sit between 2.5
   * and 17.5 — with the second figure behind and to the right, so it reads as
   * two people rather than one person with a smudge.
   */
  share: (
    <>
      <path d="M8 9.4a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8Z" />
      <path d="M2.9 16.4a5.1 5.1 0 0 1 10.2 0" />
      <path d="M13.4 4.1a2.7 2.7 0 0 1 0 5.2" />
      <path d="M15.2 11.4a4.6 4.6 0 0 1 2 3.7" />
    </>
  ),
  panel: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M8 3.5v13" />
    </>
  ),
  trash: (
    <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10M8.4 8.4v5M11.6 8.4v5" />
  ),
  search: (
    <>
      <circle cx="8.8" cy="8.8" r="5.3" />
      <path d="m12.7 12.7 4 4" />
    </>
  ),
  // A stack of pages, with a down-arrow through it: the whole book on one
  // scrolling page. Deliberately unlike the open-book "chapters" glyph, so the
  // two rail buttons don't read as the same thing.
  read: (
    <>
      <rect x="4.6" y="2.8" width="10.8" height="14.4" rx="1.6" />
      <path d="M10 6.2v7.6" />
      <path d="M7.4 11.2 10 13.8l2.6-2.6" />
    </>
  ),
};
