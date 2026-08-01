/**
 * The dashboard's icons.
 *
 * Drawn here rather than pulled from a set, for the same reason the landing
 * page's figures are: one dependency fewer, and every glyph is on the same
 * 24-grid with the same 1.75 stroke, so the sidebar reads as one alphabet
 * instead of six borrowed ones.
 *
 * They are **paired with their labels, never used alone** in the nav. An
 * icon-only rail is faster to scan once you know it and unreadable until then,
 * and this is a product whose whole argument is that a writer can see at a
 * glance what it does.
 */

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
    >
      {children}
    </svg>
  );
}

export const shelfIcons = {
  overview: (
    <Svg>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Svg>
  ),
  write: (
    <Svg>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  ),
  prepare: (
    <Svg>
      <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
      <rect x="2" y="3" width="20" height="5" rx="1.5" />
      <path d="M10 12h4" />
    </Svg>
  ),
  track: (
    <Svg>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 15l3.5-4 3 2.5L20 7" />
    </Svg>
  ),
  learn: (
    <Svg>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 19.5Z" />
    </Svg>
  ),
  tools: (
    <Svg>
      <path d="M14.7 6.3a4 4 0 0 0 5.3 5.3L21 21H10.6l-5.3-5.3a4 4 0 0 0-1.9-6.5" />
      <path d="M3.4 9.2 9 3.6l3.5 3.5-5.6 5.6Z" />
    </Svg>
  ),
  search: (
    <Svg>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  ),
  plus: (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  chevron: (
    <Svg>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  ),
  more: (
    <Svg>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  ),
  read: (
    <Svg>
      <path d="M12 6.5C10.5 5 8.5 4.5 6 4.5H3v13h3c2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2h3v-13h-3c-2.5 0-4.5.5-6 2Z" />
      <path d="M12 6.5v13" />
    </Svg>
  ),
  upload: (
    <Svg>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M12 3v13M7.5 7.5 12 3l4.5 4.5" />
    </Svg>
  ),
  compass: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </Svg>
  ),
  image: (
    <Svg>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-5-5-5.5 5.5L8 14l-5 5" />
    </Svg>
  ),
  info: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8v.2" />
    </Svg>
  ),
  help: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.8-.9 1.4v.4M12 16.8v.2" />
    </Svg>
  ),
  support: (
    <Svg>
      <path d="M21 11.5a8 8 0 0 1-11.6 7.1L3 20.5l1.9-6.3A8 8 0 1 1 21 11.5Z" />
    </Svg>
  ),
  template: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </Svg>
  ),
  sound: (
    <Svg>
      <path d="M11 5 6.5 9H3v6h3.5L11 19Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </Svg>
  ),
  pricing: (
    <Svg>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4.5a1.5 1.5 0 0 1 1.5-1.5H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" />
      <path d="M7.5 7.5v.01" />
    </Svg>
  ),
  target: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  ),
  flame: (
    <Svg>
      <path d="M12 3c.5 3-2 4-2 7a2 2 0 0 0 4 0c0-1 .5-1.5 1-2 1.5 1.5 2.5 3.5 2.5 5.5a7.5 7.5 0 0 1-15 0C2.5 9 7 6.5 12 3Z" />
    </Svg>
  ),
  check: (
    <Svg>
      <path d="m4 12.5 5 5L20 6.5" />
    </Svg>
  ),
} as const;
