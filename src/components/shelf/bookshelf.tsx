"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import { BookDetailsDialog } from "@/components/shelf/book-details-dialog";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import { RowMenu, menuIcons } from "@/components/sidebar/row-menu";
import { TemplatesDialog } from "@/components/shelf/templates-dialog";
import { UpgradeDialog } from "@/components/shelf/upgrade-dialog";
import { HelpDialog } from "@/components/shelf/help-dialog";
import { SupportDialog } from "@/components/shelf/support-dialog";
import { SoundsDialog } from "@/components/shelf/sounds-dialog";
import { ImportDialog } from "@/components/shelf/import-dialog";
import { LoadingScreen } from "@/components/loading-screen";
import {
  archiveBook,
  bookWordCount,
  booksIn,
  deleteBook,
  migrateLegacy,
  setBareCover,
  setPref,
  restoreBook,
  trashBook,
  type Book,
  type BookView,
} from "@/lib/library-store";
import { relativeTime } from "@/lib/relative-time";
import { useCover, useHydrated, usePrefs, useShelf } from "@/lib/use-library";

const VIEW_LABEL: Record<BookView, string> = {
  active: "All books",
  archived: "Archived books",
  trashed: "Trashed books",
};

/** The one-line lede under the section count, per view. */
const VIEW_LEDE: Record<BookView, string> = {
  active: "Sort or search to find the one you want faster.",
  archived: "Books set aside — restore one to bring it back to the shelf.",
  trashed: "Deleted books wait here until you empty the trash.",
};

/** How the shelf is ordered. All three do real work — see the comparator. */
type Sort = "recent" | "title" | "words";
const SORT_LABEL: Record<Sort, string> = {
  recent: "Recently opened",
  title: "Title A–Z",
  words: "Most words",
};

/**
 * A supplied icon shown through a mask, so it takes the button's own text colour
 * (currentColor) and follows the theme and hover. The source PNGs arrive in
 * mixed colours; masking them from their shape makes them one. See
 * public/icon-*.png.
 */
function MaskIcon({
  src,
  className = "h-6 w-6",
}: {
  src: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${className} shrink-0 bg-current`}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

// One icon apiece for the view tabs — books for the whole shelf, a case for
// what's set aside, a bin for what's on its way out.
const VIEW_ICON: Record<BookView, ReactNode> = {
  active: <MaskIcon src="/icon-books.png" className="h-6 w-6" />,
  archived: <MaskIcon src="/icon-archived.png" className="h-6 w-6" />,
  trashed: <MaskIcon src="/icon-trashed.png" className="h-6 w-6" />,
};

export function Bookshelf() {
  const hydrated = useHydrated();
  const shelf = useShelf();

  const [editing, setEditing] = useState<Book | null>(null);
  const [opening, setOpening] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [dialog, setDialog] = useState<
    "templates" | "upgrade" | "help" | "support" | "sounds" | "import" | null
  >(null);
  const [view, setView] = useState<BookView>("active");
  // The sidebar is a slide-in drawer below md; this is whether it's open.
  const [navOpen, setNavOpen] = useState(false);

  // migrateLegacy is idempotent, but running it twice is still wasted work and
  // React runs effects twice in development.
  const migrated = useRef(false);
  useEffect(() => {
    if (!hydrated || migrated.current) return;
    migrated.current = true;
    migrateLegacy();
  }, [hydrated]);

  // The chosen order. Recently opened is the default — the book you were writing
  // yesterday is the one you want today — but a big shelf is easier to scan by
  // title, and words answers "which is my real project".
  const books = useMemo(() => {
    const list = booksIn(shelf, view);
    const by: Record<Sort, (a: Book, b: Book) => number> = {
      recent: (a, b) => b.lastOpenedAt - a.lastOpenedAt,
      title: (a, b) => a.title.localeCompare(b.title),
      words: (a, b) => bookWordCount(b) - bookWordCount(a),
    };
    return [...list].sort(by[sort]);
  }, [shelf, view, sort]);

  const counts = useMemo(
    () => ({
      active: booksIn(shelf, "active").length,
      archived: booksIn(shelf, "archived").length,
      trashed: booksIn(shelf, "trashed").length,
    }),
    [shelf],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return books;
    return books.filter((b) => b.title.toLowerCase().includes(needle));
  }, [books, query]);

  // The library total, not the current view's — a number that shrank when you
  // opened the trash would be describing the wrong thing.
  const totalWords = useMemo(
    () =>
      booksIn(shelf, "active").reduce((sum, b) => sum + bookWordCount(b), 0),
    [shelf],
  );

  // Recoverable, but still a book vanishing off the shelf, and the action now
  // sits in a menu rather than behind a deliberate icon click. Cheap dialog.
  const handleTrash = (book: Book) => {
    if (window.confirm(`Move “${book.title}” to the trash?`)) trashBook(book.id);
  };

  const handleDeleteForever = (book: Book) => {
    const words = bookWordCount(book);
    const warning =
      words > 0
        ? `Permanently delete “${book.title}” and all ${words.toLocaleString()} words in it? This cannot be undone.`
        : `Permanently delete “${book.title}”? This cannot be undone.`;
    if (window.confirm(warning)) deleteBook(book.id);
  };

  if (!hydrated) return <LoadingScreen />;

  // Where "Continue writing" goes: the last book opened, or the most recent
  // active one. Never an archived or trashed book.
  const active = booksIn(shelf, "active");
  const continueId = active.some((b) => b.id === shelf.lastOpenedBookId)
    ? shelf.lastOpenedBookId
    : (active[0]?.id ?? null);

  // "Continue writing" skips the overview and reopens the last chapter itself —
  // it is the one action that means "keep writing", so it lands on the page, not
  // the guide. A book with no chapters falls back to its overview.
  const continueBook = continueId
    ? (active.find((b) => b.id === continueId) ?? null)
    : null;
  const continueChapterId = continueBook
    ? continueBook.chapters.some((c) => c.id === continueBook.lastOpenedId)
      ? continueBook.lastOpenedId
      : (continueBook.chapters[0]?.id ?? null)
    : null;
  const continueHref = continueChapterId
    ? `/book/${continueId}/chapter/${continueChapterId}`
    : continueId
      ? `/book/${continueId}`
      : null;

  return (
    // The light desk. The sidebar floats on it as a rounded card, the content
    // scrolls beside it — the "dailybook" arrangement.
    <div className="flex h-full bg-surface">
      <ShelfSidebar
        view={view}
        counts={counts}
        navOpen={navOpen}
        onCloseNav={() => setNavOpen(false)}
        onView={(v) => {
          setView(v);
          setNavOpen(false);
        }}
        onImport={() => {
          setNavOpen(false);
          setDialog("import");
        }}
        onSounds={() => {
          setNavOpen(false);
          setDialog("sounds");
        }}
        onHelp={() => {
          setNavOpen(false);
          setDialog("help");
        }}
        onSupport={() => {
          setNavOpen(false);
          setDialog("support");
        }}
      />

      <main className="scroll-slim min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-4 md:px-8 md:py-6">
          <ShelfTopBar
            query={query}
            onQuery={setQuery}
            onToggleNav={() => setNavOpen((open) => !open)}
            onTemplates={() => setDialog("templates")}
            onAccount={() => setDialog("upgrade")}
          />

          {view === "active" && (
            <Hero
              book={continueBook}
              href={continueHref}
              totalBooks={counts.active}
              totalWords={totalWords}
              onOpen={setOpening}
            />
          )}

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold text-fg md:text-2xl">
                {counts[view] === 1
                  ? "1 book"
                  : `${counts[view].toLocaleString()} books`}
                <span className="ml-2 align-middle font-sans text-sm font-normal text-muted">
                  {VIEW_LABEL[view].toLowerCase()}
                </span>
              </h2>
              <p className="mt-1 font-sans text-sm text-muted">
                {VIEW_LEDE[view]}
              </p>
            </div>
            {books.length > 1 && (
              <SortMenu value={sort} onChange={setSort} />
            )}
          </div>

          {books.length === 0 ? (
            view === "active" ? (
              <Empty />
            ) : (
              <p className="mt-4 font-sans text-sm text-muted">
                {view === "archived"
                  ? "Nothing archived."
                  : "The trash is empty."}
              </p>
            )
          ) : visible.length === 0 ? (
            <p className="mt-4 font-sans text-sm text-muted">
              No book matches “{query.trim()}”.
            </p>
          ) : (
            <BookGrid
              books={visible}
              view={view}
              // The genuine resume target, marked wherever it lands under the
              // current sort — not merely the first card in the row.
              continueId={view === "active" ? continueId : null}
              onEdit={setEditing}
              onOpen={setOpening}
              onArchive={(b) => archiveBook(b.id)}
              onRestore={(b) => restoreBook(b.id)}
              onTrash={handleTrash}
              onDeleteForever={handleDeleteForever}
            />
          )}
        </div>
      </main>

      {editing && (
        <CoverDialog book={editing} onClose={() => setEditing(null)} />
      )}
      {opening && (
        <BookDetailsDialog
          book={opening}
          onClose={() => setOpening(null)}
          onEditCover={() => {
            // Hand straight over rather than stacking a dialog on a dialog.
            setEditing(opening);
            setOpening(null);
          }}
        />
      )}
      {dialog === "templates" && (
        <TemplatesDialog onClose={() => setDialog(null)} />
      )}
      {dialog === "upgrade" && <UpgradeDialog onClose={() => setDialog(null)} />}
      {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === "support" && <SupportDialog onClose={() => setDialog(null)} />}
      {dialog === "sounds" && <SoundsDialog onClose={() => setDialog(null)} />}
      {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

/**
 * The floating sidebar — the dark navy card that carries the brand, the two
 * shelf actions, the library views and the tools.
 *
 * Reference-faithful in shape (a rounded dark column on a light desk, primary
 * nav up top and tools pinned to the foot) but every row does real work: the
 * views switch the shelf, the tools open their panels, and there is no fake
 * "log out" where the app has no accounts.
 *
 * Below md it slides in as a drawer; at md and up it is a static side column.
 */
function ShelfSidebar({
  view,
  counts,
  navOpen,
  onCloseNav,
  onView,
  onImport,
  onSounds,
  onHelp,
  onSupport,
}: {
  view: BookView;
  counts: Record<BookView, number>;
  navOpen: boolean;
  onCloseNav: () => void;
  onView: (view: BookView) => void;
  onImport: () => void;
  onSounds: () => void;
  onHelp: () => void;
  onSupport: () => void;
}) {
  const { theme } = usePrefs();

  return (
    <>
      {/* The scrim behind the drawer, below md only. */}
      {navOpen && (
        <div
          aria-hidden="true"
          onClick={onCloseNav}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <aside
        aria-label="Library"
        className={`shelf-sidebar scroll-slim fixed inset-y-0 left-0 z-40 flex
                    w-72 flex-col overflow-y-auto px-3 pt-4 pb-4 shadow-2xl
                    transition-transform duration-300 ease-out
                    md:static md:z-auto md:w-64 md:shrink-0
                    md:shadow-none md:transition-none
                    ${navOpen ? "translate-x-0" : "-translate-x-full"}
                    md:translate-x-0`}
      >
        {/* Brand, two-tone the way the reference sets its wordmark. */}
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-fg">
            Open<span style={{ color: "#3a86d4" }}>Chapter</span>
          </span>
          {/* Closes the drawer on the phone; absent on desktop. */}
          <button
            type="button"
            onClick={onCloseNav}
            aria-label="Close menu"
            className="-mr-1 rounded-md p-1.5 text-muted outline-none
                       transition-colors hover:bg-raised hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-white/40 md:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* The two shelf actions. New book leads; importing is the quieter,
            once-per-manuscript path. */}
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/book/new"
            className="flex items-center justify-center gap-2 rounded-xl bg-accent
                       py-2.5 font-sans text-sm font-semibold text-white
                       outline-none transition-colors hover:bg-accent-strong
                       focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="M10 4.5v11M4.5 10h11" />
            </svg>
            New book
          </Link>
          <button
            type="button"
            onClick={onImport}
            className="flex items-center justify-center gap-2 rounded-xl border
                       border-line py-2.5 font-sans text-sm font-medium text-muted
                       outline-none transition-colors hover:bg-raised hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Import a book
          </button>
        </div>

        {/* The library sections — the reference's primary nav, here switching the
            shelf's view. Active is a lifted row with a bright edge marker. */}
        <nav className="mt-6 flex flex-col gap-1">
          <p className="px-3 pb-1 font-sans text-[0.7rem] font-medium tracking-wider text-muted/70 uppercase">
            Library
          </p>
          {(["active", "archived", "trashed"] as BookView[]).map((value) => {
            const current = view === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onView(value)}
                aria-current={current ? "page" : undefined}
                className={`relative flex items-center justify-between gap-2
                            rounded-xl px-3 py-3 text-left font-sans text-sm
                            outline-none transition-colors focus-visible:ring-2
                            focus-visible:ring-white/40 ${
                              current
                                ? "bg-selected font-medium text-selected-fg"
                                : "text-muted hover:bg-raised hover:text-fg"
                            }`}
              >
                {/* The active marker: a bright bar flush at the rail's edge and a
                    brighter row, the way the reference marks Home — not a heavy
                    filled tile. */}
                {current && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-white"
                  />
                )}
                <span className="flex items-center gap-3">
                  {VIEW_ICON[value]}
                  {VIEW_LABEL[value]}
                </span>
                {counts[value] > 0 && (
                  <span className="shrink-0 text-xs tabular-nums opacity-70">
                    {counts[value]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* The tools, pinned to the foot the way the reference groups Settings /
            Help away from the primary nav. */}
        <div className="mt-auto flex flex-col gap-1 pt-6">
          <div aria-hidden="true" className="mb-3 h-px bg-line" />
          <ToolButton onClick={onSounds}>
            <MaskIcon src="/icon-sounds.png" className="h-6 w-6" />
            Sounds
          </ToolButton>
          <ToolButton onClick={onHelp}>
            <HelpIcon />
            Help
          </ToolButton>
          <ToolButton onClick={onSupport}>
            <SupportIcon />
            Support
          </ToolButton>
          <ToolButton
            onClick={() =>
              setPref("theme", theme === "dark" ? "light" : "dark")
            }
            label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <ThemeIcon />
            Theme
          </ToolButton>
        </div>
      </aside>
    </>
  );
}

/** A tool row in the sidebar foot — one shape, so the four read as a set. */
function ToolButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-left
                 font-sans text-sm text-muted outline-none transition-colors
                 hover:bg-raised hover:text-fg focus-visible:ring-2
                 focus-visible:ring-white/40"
    >
      {children}
    </button>
  );
}

function HelpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-6 w-6 shrink-0"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path
        d="M8 7.9a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-6 w-6 shrink-0"
    >
      <path
        d="M4 4.5h12A1.5 1.5 0 0 1 17.5 6v6a1.5 1.5 0 0 1-1.5 1.5H8.5L5 16.5v-3H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-6 w-6 shrink-0"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The search-and-account bar across the top of the content — the reference's
 * light header. The search filters the shelf; the account chip opens the plan
 * note (there is no sign-in yet, so it is a guest on the free tier, not a
 * person). A menu button appears on the phone to reach the drawer.
 */
function ShelfTopBar({
  query,
  onQuery,
  onToggleNav,
  onTemplates,
  onAccount,
}: {
  query: string;
  onQuery: (value: string) => void;
  onToggleNav: () => void;
  onTemplates: () => void;
  onAccount: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggleNav}
        aria-label="Open menu"
        className="shrink-0 rounded-lg border border-line bg-panel p-2.5 text-muted
                   outline-none transition-colors hover:bg-raised hover:text-fg
                   focus-visible:ring-2 focus-visible:ring-accent/50 md:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="h-5 w-5"
        >
          <path d="M3 6h14M3 10h14M3 14h14" />
        </svg>
      </button>

      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search books</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="pointer-events-none absolute top-1/2 left-4 h-4 w-4
                     -translate-y-1/2 text-muted"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m13.5 13.5 3 3" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search a book"
          className="w-full rounded-full border border-line bg-panel py-3 pr-4
                     pl-11 font-sans text-sm text-fg placeholder:text-muted
                     focus-visible:border-accent focus-visible:outline-none"
        />
      </label>

      {/* Templates builds a book with its chapters laid out — a real "start a
          book" path, kept reachable from the header where the old top nav had
          it. Folds away on small screens, where the drawer carries creation. */}
      <button
        type="button"
        onClick={onTemplates}
        className="hidden shrink-0 rounded-full px-4 py-2.5 font-sans text-sm
                   font-medium text-muted outline-none transition-colors
                   hover:bg-raised hover:text-fg focus-visible:ring-2
                   focus-visible:ring-accent/50 md:block"
      >
        Templates
      </button>

      <button
        type="button"
        onClick={onAccount}
        aria-label="Your account and plan"
        className="flex shrink-0 items-center gap-2.5 rounded-full py-1 pr-2 pl-1
                   text-left outline-none transition-colors hover:bg-raised
                   focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center
                     rounded-full bg-accent text-sm font-semibold text-white"
        >
          G
        </span>
        <span className="hidden truncate font-sans text-sm font-medium text-fg sm:block">
          Guest
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mr-1 h-4 w-4 shrink-0 text-muted"
        >
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * The hero band — the reference's "most popular book this week" slot, turned to
 * the one thing a writer actually wants on opening the app: the book they were
 * writing, ready to resume, with the library's real figures beside it. No reader
 * leaderboard and no invented chart — there are no readers and no such data.
 */
function Hero({
  book,
  href,
  totalBooks,
  totalWords,
  onOpen,
}: {
  book: Book | null;
  href: string | null;
  totalBooks: number;
  totalWords: number;
  onOpen: (book: Book) => void;
}) {
  const cover = useCover(book?.id ?? "");

  // Empty shelf: the hero becomes the welcome, not a blank frame.
  if (!book || !href) {
    return (
      <section className="shelf-hero overflow-hidden rounded-3xl px-6 py-10 md:px-10 md:py-12">
        <p className="font-sans text-xs font-medium tracking-widest text-accent uppercase">
          Welcome
        </p>
        <h1 className="mt-3 max-w-xl font-display text-3xl leading-tight font-semibold text-fg md:text-4xl">
          Start the book <span className="text-accent">only you</span> can write
        </h1>
        <p className="mt-3 max-w-md font-sans text-sm text-muted">
          A calm, focused place to write your novel — chapter by chapter.
        </p>
        <Link
          href="/book/new"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent
                     px-5 py-2.5 font-sans text-sm font-semibold text-white
                     outline-none transition-colors hover:bg-accent-strong
                     focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          Start your first book
        </Link>
      </section>
    );
  }

  const words = bookWordCount(book);
  const chapters = book.chapters.length;

  return (
    <section className="shelf-hero overflow-hidden rounded-3xl px-6 py-7 md:px-10 md:py-9">
      <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
        {/* The heading and the running total — the reference's left column. */}
        <div className="min-w-0 flex-1">
          <p className="font-sans text-xs font-medium tracking-widest text-accent uppercase">
            Pick up where you left off
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight font-semibold text-fg md:text-4xl">
            Keep writing
            <br />
            <span className="text-accent">your book</span>
          </h1>
          <p className="mt-4 inline-flex items-center gap-2 font-sans text-sm text-muted">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/12 text-accent"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-3.5 w-3.5"
              >
                <path
                  d="M4 4.5h9A1.5 1.5 0 0 1 14.5 6v10l-3-2-3 2V6A1.5 1.5 0 0 1 10 4.5"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="font-medium text-fg">
              {totalWords.toLocaleString()}
            </span>
            words written across {totalBooks}{" "}
            {totalBooks === 1 ? "book" : "books"}
          </p>
        </div>

        {/* The featured cover — the reference's centre. */}
        <Link
          href={`/book/${book.id}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            onOpen(book);
          }}
          className="group block w-28 shrink-0 rounded-md outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/60
                     focus-visible:ring-offset-4 focus-visible:ring-offset-panel
                     md:w-32"
        >
          <BookCover
            title={book.title}
            subtitle={book.subtitle}
            author={book.author}
            words={words}
            image={cover}
            bare={book.bareCover}
            seed={book.id}
          />
        </Link>

        {/* The resume panel — real figures where the reference charts fake ones. */}
        <div className="w-full rounded-2xl bg-panel/70 p-5 shadow-sm ring-1 ring-line/60 backdrop-blur-sm lg:w-72">
          <p className="truncate font-display text-base font-semibold text-fg">
            {book.title}
          </p>
          <p className="mt-0.5 truncate font-sans text-sm text-muted">
            {book.subtitle || book.author || "Your manuscript"}
          </p>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <HeroStat label="Chapters" value={chapters.toLocaleString()} />
            <HeroStat label="Words" value={words.toLocaleString()} />
            <HeroStat label="Edited" value={relativeTimeShort(book.lastOpenedAt)} />
          </dl>

          <Link
            href={href}
            className="mt-4 flex items-center justify-center gap-2 rounded-full
                       bg-accent py-2.5 font-sans text-sm font-semibold text-white
                       outline-none transition-colors hover:bg-accent-strong
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Continue writing
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M4 10h11M11 6l4 4-4 4" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface/70 py-2">
      <dd className="font-display text-sm font-semibold text-fg">{value}</dd>
      <dt className="mt-0.5 font-sans text-[0.7rem] tracking-wide text-muted uppercase">
        {label}
      </dt>
    </div>
  );
}

/** relativeTime, trimmed to fit a stat cell ("3 days ago" → "3d"). The numeric
 *  formatter also speaks in words at the edges ("yesterday", "last month"),
 *  which are mapped here so the cell never carries a long phrase. */
function relativeTimeShort(then: number): string {
  const full = relativeTime(then);
  const worded: Record<string, string> = {
    "just now": "now",
    yesterday: "1d",
    "last week": "1w",
    "last month": "1mo",
    "last year": "1y",
  };
  if (worded[full]) return worded[full];
  const m = full.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/);
  if (!m) return full;
  const unit = m[2] === "month" ? "mo" : m[2][0];
  return `${m[1]}${unit}`;
}

/**
 * The sort control — the reference's "Filter" affordance, doing real work: it
 * reorders the shelf by recency, title or length. A small popover rather than a
 * native select, so it can carry the check on the chosen row and match the bar.
 */
function SortMenu({
  value,
  onChange,
}: {
  value: Sort;
  onChange: (sort: Sort) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line
                   bg-panel py-2 pr-3 pl-4 font-sans text-sm text-muted
                   outline-none transition-colors hover:bg-raised hover:text-fg
                   focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="h-4 w-4"
        >
          <path d="M4 6h12M6 10h8M8 14h4" />
        </svg>
        <span className="text-fg">{SORT_LABEL[value]}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-4 w-4"
        >
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl
                     border border-line bg-panel py-1 shadow-xl"
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((key) => (
            <button
              key={key}
              type="button"
              role="menuitemradio"
              aria-checked={value === key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-4 py-2.5
                          text-left font-sans text-sm outline-none transition-colors
                          hover:bg-raised focus-visible:bg-raised ${
                            value === key ? "text-fg" : "text-muted"
                          }`}
            >
              {SORT_LABEL[key]}
              {value === key && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-accent"
                >
                  <path d="m5 10 3.5 3.5L15 6" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-line bg-panel/50 py-16 text-center">
      <p className="font-display text-lg font-medium text-fg">
        Nothing on the shelf yet.
      </p>
      <Link
        href="/book/new"
        className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 font-sans
                   text-sm font-semibold text-white outline-none
                   transition-colors hover:bg-accent-strong
                   focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        Start your first book
      </Link>
    </div>
  );
}

/**
 * The shelf itself — a grid of covers, the way the reference lays out its
 * catalogue. Under each cover the figures read as description rather than as a
 * table to scan: title, its byline, and the one number that means most here,
 * the word count (where the reference prints a star rating it has and we do not).
 */
function BookGrid({
  books,
  view,
  continueId,
  onEdit,
  onOpen,
  onArchive,
  onRestore,
  onTrash,
  onDeleteForever,
}: {
  books: Book[];
  view: BookView;
  continueId: string | null;
  onEdit: (book: Book) => void;
  onOpen: (book: Book) => void;
  onArchive: (book: Book) => void;
  onRestore: (book: Book) => void;
  onTrash: (book: Book) => void;
  onDeleteForever: (book: Book) => void;
}) {
  return (
    <ul
      className="grid gap-x-5 gap-y-8"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(9.5rem, 1fr))",
      }}
    >
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          view={view}
          continueId={continueId}
          onEdit={onEdit}
          onOpen={onOpen}
          onArchive={onArchive}
          onRestore={onRestore}
          onTrash={onTrash}
          onDeleteForever={onDeleteForever}
        />
      ))}
    </ul>
  );
}

/**
 * One book on the shelf.
 *
 * Its own component so the cover is read once per book and shared: the card and
 * its menu both need to know whether there is artwork, and a hook cannot be
 * called from inside the map that lays the shelf out.
 */
function BookCard({
  book,
  view,
  continueId,
  onEdit,
  onOpen,
  onArchive,
  onRestore,
  onTrash,
  onDeleteForever,
}: {
  book: Book;
  view: BookView;
  continueId: string | null;
  onEdit: (book: Book) => void;
  onOpen: (book: Book) => void;
  onArchive: (book: Book) => void;
  onRestore: (book: Book) => void;
  onTrash: (book: Book) => void;
  onDeleteForever: (book: Book) => void;
}) {
  const router = useRouter();
  const cover = useCover(book.id);
  const words = bookWordCount(book);
  const byline = book.subtitle || book.author;

  return (
    <li className="group relative">
      {/* Still a real link: a plain click opens the details, but the href
          keeps middle-click, ctrl-click and "open in new tab" going
          straight to the manuscript, which is what those mean. */}
      <Link
        href={`/book/${book.id}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          onOpen(book);
        }}
        className="block rounded-md outline-none focus-visible:ring-2
                   focus-visible:ring-accent/60 focus-visible:ring-offset-4
                   focus-visible:ring-offset-surface"
      >
        <BookCover
          title={book.title}
          subtitle={book.subtitle}
          author={book.author}
          words={words}
          image={cover}
          bare={book.bareCover}
          seed={book.id}
        />
      </Link>

      {/* Over the cover's top corner, revealed on hover. Actions on a shelf
          are the exception; finding the book is the rule. */}
      <div className="absolute top-2 right-2">
        <RowMenu
          label={book.title}
          tone={cover ? "art" : "paper"}
          items={
            view === "trashed"
              ? [
                  {
                    label: "Restore",
                    icon: menuIcons.restore,
                    onSelect: () => onRestore(book),
                  },
                  {
                    label: "Delete forever",
                    icon: menuIcons.trash,
                    onSelect: () => onDeleteForever(book),
                    danger: true,
                  },
                ]
              : [
                  {
                    label: "Edit cover",
                    icon: menuIcons.rename,
                    onSelect: () => onEdit(book),
                  },
                  // Only where it can do anything: hiding the words on a
                  // typeset cover would leave a blank rectangle.
                  ...(cover
                    ? [
                        {
                          label: book.bareCover
                            ? "Show title on cover"
                            : "Hide title on cover",
                          icon: book.bareCover
                            ? menuIcons.show
                            : menuIcons.hide,
                          onSelect: () => setBareCover(book.id, !book.bareCover),
                        },
                      ]
                    : []),
                  {
                    label: "Export",
                    icon: menuIcons.export,
                    onSelect: () => router.push(`/book/${book.id}/export`),
                  },
                  view === "archived"
                    ? {
                        label: "Unarchive",
                        icon: menuIcons.restore,
                        onSelect: () => onRestore(book),
                      }
                    : {
                        label: "Archive",
                        icon: menuIcons.archive,
                        onSelect: () => onArchive(book),
                      },
                  {
                    label: "Move to trash",
                    icon: menuIcons.trash,
                    onSelect: () => onTrash(book),
                    danger: true,
                  },
                ]
          }
        />
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate font-sans text-sm font-semibold text-fg">
            {book.title}
          </p>
          {book.id === continueId && (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-sans text-[0.6rem] font-medium tracking-wide text-white uppercase">
              Continue
            </span>
          )}
        </div>
        {byline ? (
          <p className="mt-0.5 truncate font-sans text-xs text-muted">
            {byline}
          </p>
        ) : null}
        <p className="mt-1 font-sans text-xs text-muted/80">
          {words > 0 ? `${words.toLocaleString()} words` : "No words yet"}
        </p>
      </div>
    </li>
  );
}
