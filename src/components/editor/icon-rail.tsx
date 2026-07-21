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
}) {
  return (
    <nav
      aria-label={side === "left" ? "Panels" : "Tools"}
      data-paper={paper}
      className={`flex w-(--rail-width) shrink-0 flex-col items-center gap-2
                  overflow-y-auto py-4 ${
                    paper ? "rail-paper" : "bg-surface"
                  } ${side === "left" ? "border-r" : "border-l"} border-line`}
    >
      {children}
      {footer && <div className="mt-auto flex flex-col gap-1">{footer}</div>}
    </nav>
  );
}

/* Icon paths, kept here so the rails read as a list of actions. */
export const icons = {
  home: <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  chapters: (
    <>
      <path d="M3 4.5h5.5A1.5 1.5 0 0 1 10 6v10a1.2 1.2 0 0 0-1.2-1.2H3z" />
      <path d="M17 4.5h-5.5A1.5 1.5 0 0 0 10 6v10a1.2 1.2 0 0 1 1.2-1.2H17z" />
    </>
  ),
  notes: (
    <>
      <rect x="4.5" y="3" width="11" height="14" rx="1.5" />
      <path d="M7.5 7h5M7.5 10h5M7.5 13h3" />
    </>
  ),
  bookmarks: <path d="M6 3h8v14l-4-3.2L6 17z" />,
  add: <path d="M10 4.5v11M4.5 10h11" />,
  focus: (
    <>
      <circle cx="10" cy="10" r="6" />
      <circle cx="10" cy="10" r="2" />
    </>
  ),
  typewriter: (
    <>
      <path d="M3.5 9h13v6.5h-13z" />
      <path d="M6 9V4.5h8V9M7 12h6" />
    </>
  ),
  assistant: (
    <>
      <path d="M4 4.5h12v9H8.5L5 16.5V13.5H4z" />
      <path d="M8 8h4" />
    </>
  ),
  export: (
    <>
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5" />
      <path d="M4 14v2.5h12V14" />
    </>
  ),
  panel: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M8 3.5v13" />
    </>
  ),
};
