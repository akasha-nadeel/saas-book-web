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
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  // A large filled tile for the active rail item, as in the reference, rather
  // than a subtle tint — at this size the rail is the primary navigation.
  const className = `flex h-12 w-12 items-center justify-center rounded-xl
                     outline-none transition-colors focus-visible:ring-2
                     focus-visible:ring-accent/60 ${
                       active
                         ? "bg-accent text-white"
                         : "text-muted hover:bg-raised hover:text-fg"
                     }`;

  const icon = (
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
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={className}
    >
      {icon}
    </button>
  );
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
      // The left rail is app navigation, so it wears the nav chrome (see
      // .nav-chrome) to match the shelf's sidebar — and reverts to neutral in
      // dark, like the rest of the chrome. The right rail takes the paper's
      // colours instead: its tools belong to the page, not the app.
      className={`scroll-slim flex w-(--rail-width) shrink-0 flex-col
                  items-center gap-2 overflow-y-auto py-4 ${
                    paper ? "rail-paper" : "nav-chrome"
                  } ${side === "left" ? "border-r" : "border-l"} border-line ${className}`}
    >
      {children}
      {footer && <div className="mt-auto flex flex-col gap-1">{footer}</div>}
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
  panel: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M8 3.5v13" />
    </>
  ),
  // The contrast mark: a ring with one half inked. It shows the choice rather
  // than a single side of it, the way a bare sun or moon would.
  theme: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
    </>
  ),
  trash: (
    <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10M8.4 8.4v5M11.6 8.4v5" />
  ),
};
