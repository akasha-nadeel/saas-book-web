import Link from "next/link";
import { TOOL_GROUPS, type ToolTone } from "@/lib/book-tools";

/**
 * The fifteen per-book tools, grouped and explained, pointed at one book.
 *
 * Shared by the sheet a book card opens and the dashboard's Tools area, which
 * show the same list from two entry points — one where the book is already
 * chosen, one where it has just been picked. Keeping it in a single component
 * means the two cannot drift apart in layout the way they were about to drift
 * apart in wording.
 *
 * **Every card carries a mark, and the colour is the group.** Fifteen cards of
 * grey text set in the same weight is a page a writer reads top to bottom every
 * time, because nothing on it tells them where to look. A tinted glyph gives
 * each tool a shape to remember it by, and the hue says which part of the job
 * it belongs to before a heading has been read.
 *
 * The marks are drawn here rather than borrowed. This is our own product's
 * feature list, so there are no third-party logos to use — `works-with.tsx` on
 * the landing page is the place real brand marks belong, and it says why
 * inventing a lookalike is worse than drawing something honest instead.
 */

/**
 * Four hues, and each one is a *tint* behind a saturated glyph.
 *
 * Not a filled block: fifteen saturated tiles would fight the covers, the
 * primary buttons and each other. The tint carries the grouping at a glance and
 * the ink carries the shape.
 */
const TONES: Record<ToolTone, { badge: string; icon: string; head: string }> = {
  blue: {
    badge: "bg-blue-500/10",
    icon: "text-blue-600",
    head: "text-blue-700",
  },
  violet: {
    badge: "bg-violet-500/10",
    icon: "text-violet-600",
    head: "text-violet-700",
  },
  emerald: {
    badge: "bg-emerald-500/10",
    icon: "text-emerald-600",
    head: "text-emerald-700",
  },
  amber: {
    badge: "bg-amber-500/10",
    icon: "text-amber-700",
    head: "text-amber-700",
  },
};

/**
 * One glyph per tool, on a 24 grid with a 1.75 stroke — the same system as
 * `shelf-icons.tsx`, so the dashboard reads as one alphabet.
 */
const MARKS: Record<string, React.ReactNode> = {
  // Get it out
  package: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5Z" />
      <path d="m3 7.5 9 4.5 9-4.5M12 12v9" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </>
  ),
  ruler: (
    <>
      <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
      <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
    </>
  ),

  // Find your shelf
  shelf: (
    <>
      <path d="M4 4v13M8.5 4v13M13 4.5l3.5-.8 3 12.6-3.5.8Z" />
      <path d="M2.5 17.5h19" />
    </>
  ),
  quote: (
    <>
      <path d="M9 7.5C6.5 8 5 9.8 5 12.2V16h4.5v-4.5H7.2c0-1.6.7-2.7 1.8-3Z" />
      <path d="M18 7.5c-2.5.5-4 2.3-4 4.7V16h4.5v-4.5h-2.3c0-1.6.7-2.7 1.8-3Z" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4.5a1.5 1.5 0 0 1 1.5-1.5H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" />
      <path d="M7.5 7.5v.01" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-5-5-5.5 5.5L8 14l-5 5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),

  // The writing
  arc: (
    <>
      <path d="M3 18c3-9 6-13 9-13s6 4 9 13" />
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  lines: (
    <>
      <path d="M4 6h16M4 10.5h16M4 15h11M4 19.5h7" />
    </>
  ),
  trend: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 15.5 11 10l3.5 3L20 6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5 4.5 5.5v6c0 4.6 3 8.3 7.5 10 4.5-1.7 7.5-5.4 7.5-10v-6Z" />
      <path d="m8.8 11.8 2.3 2.3 4.1-4.4" />
    </>
  ),

  // Money and reviews
  wallet: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
      <rect x="3" y="7.5" width="18" height="11.5" rx="2" />
      <path d="M16.5 13.2v.01" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6.5" rx="7.5" ry="3" />
      <path d="M4.5 6.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" />
      <path d="M4.5 11.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" />
    </>
  ),
  send: (
    <>
      <path d="M21.5 2.5 2.5 9.5l7 3 3 7Z" />
      <path d="m9.5 12.5 5-5" />
    </>
  ),
};

function Mark({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      {MARKS[name]}
    </svg>
  );
}

export function ToolGrid({
  bookId,
  onPick,
}: {
  bookId: string;
  /** Called on navigation, so a sheet can shut itself. */
  onPick?: () => void;
}) {
  return (
    <>
      {TOOL_GROUPS.map((group) => {
        const tone = TONES[group.tone];
        return (
          <section key={group.title} className="mb-7 last:mb-0">
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${tone.head}`}
            >
              {group.title}
            </h3>
            <p className="mt-1 text-xs text-muted">{group.note}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <Link
                  key={tool.path}
                  href={`/book/${bookId}/${tool.path}`}
                  onClick={onPick}
                  className="flex gap-3 rounded-xl border border-line bg-surface p-3
                             transition-colors hover:border-accent/40"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center
                                rounded-lg ${tone.badge} ${tone.icon}`}
                  >
                    <Mark name={tool.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-fg">
                      {tool.name}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {tool.what}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
