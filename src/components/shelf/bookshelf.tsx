"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { useCover, useHydrated, usePrefs, useShelf } from "@/lib/use-library";

const VIEW_LABEL: Record<BookView, string> = {
  active: "All books",
  archived: "Archived books",
  trashed: "Trashed books",
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
  active: <MaskIcon src="/icon-books.png" className="h-7 w-7" />,
  archived: <MaskIcon src="/icon-archived.png" className="h-7 w-7" />,
  trashed: <MaskIcon src="/icon-trashed.png" className="h-7 w-7" />,
};

export function Bookshelf() {
  const hydrated = useHydrated();
  const shelf = useShelf();

  const [editing, setEditing] = useState<Book | null>(null);
  const [opening, setOpening] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
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

  // Most recently opened first — the book you were writing yesterday is the
  // one you want today.
  const books = useMemo(
    () => booksIn(shelf, view).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
    [shelf, view],
  );

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

  return (
    // The bar spans the full width and both the sidebar and the panel begin
    // below it — that stacking is what makes the panel's one rounded corner
    // sit where it does in the reference.
    <div className="flex h-full flex-col">
      <ShelfTopNav
        continueId={continueId}
        navOpen={navOpen}
        onImport={() => setDialog("import")}
        onTemplates={() => setDialog("templates")}
        onUpgrade={() => setDialog("upgrade")}
        onToggleNav={() => setNavOpen((open) => !open)}
      />

      <div className="flex min-h-0 flex-1">
        <ShelfNav
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
          onUpgrade={() => {
            setNavOpen(false);
            setDialog("upgrade");
          }}
        />

        {/* One rounded corner, top-left, and the panel runs off the right and
            bottom edges. The separation from the sidebar is the shade change and
            that single corner — no border, no floating gap on four sides. The
            green backs this area so the rounded corner nests into the chrome
            rather than cutting to the page behind it. */}
        <main className="min-w-0 flex-1 overflow-hidden bg-nav">
          <div className="scroll-slim flex h-full flex-col overflow-y-auto rounded-t-2xl bg-panel px-4 py-5 md:rounded-tr-none md:rounded-tl-2xl md:px-8 md:py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h1 className="font-serif text-2xl text-fg md:text-3xl">
                {VIEW_LABEL[view]}
              </h1>
              <p className="shrink-0 font-sans text-sm text-muted">
                {totalWords.toLocaleString()} words written
              </p>
            </div>

            <label className="relative mt-6 block">
              <span className="sr-only">Search books</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4
                           -translate-y-1/2 text-muted"
              >
                <circle cx="9" cy="9" r="6" />
                <path d="m13.5 13.5 3 3" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in all books…"
                className="w-full rounded-md border border-line bg-surface py-2.5
                           pr-3 pl-10 font-sans text-sm text-fg
                           placeholder:text-muted focus-visible:border-accent
                           focus-visible:outline-none"
              />
            </label>

            {books.length === 0 ? (
              view === "active" ? (
                <Empty />
              ) : (
                <p className="mt-10 font-sans text-sm text-muted">
                  {view === "archived"
                    ? "Nothing archived."
                    : "The trash is empty."}
                </p>
              )
            ) : visible.length === 0 ? (
              <p className="mt-10 font-sans text-sm text-muted">
                No book matches “{query.trim()}”.
              </p>
            ) : (
              <BookGrid
                books={visible}
                view={view}
                // Only the genuinely most-recent book, not merely the first row
                // after a search has reordered what you can see.
                continueId={
                  view === "active" && !query.trim()
                    ? (books[0]?.id ?? null)
                    : null
                }
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
      </div>

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
 * The bar across the top.
 *
 * Templates and Upgrade sit where the reference puts its product links.
 * Templates does real work — it builds a book with its chapters laid out.
 * Upgrade cannot: there are no accounts and no billing, so it opens a dialog
 * saying so rather than pretending to sell something.
 */
function ShelfTopNav({
  continueId,
  navOpen,
  onImport,
  onTemplates,
  onUpgrade,
  onToggleNav,
}: {
  continueId: string | null;
  navOpen: boolean;
  onImport: () => void;
  onTemplates: () => void;
  onUpgrade: () => void;
  onToggleNav: () => void;
}) {
  return (
    <header className="nav-chrome flex h-16 shrink-0 items-center gap-3 px-4 md:gap-6 md:px-6">
      {/* Opens the sidebar sheet on small screens, where the sidebar is off the
          page; becomes an ✕ to close while it's open. */}
      <button
        type="button"
        onClick={onToggleNav}
        aria-label={navOpen ? "Close menu" : "Open menu"}
        aria-expanded={navOpen}
        className="-ml-1 rounded-md p-2 text-muted outline-none transition-colors
                   hover:bg-raised hover:text-fg focus-visible:ring-2
                   focus-visible:ring-accent/60 md:hidden"
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
          {navOpen ? (
            <path d="M5 5l10 10M15 5L5 15" />
          ) : (
            <path d="M3 6h14M3 10h14M3 14h14" />
          )}
        </svg>
      </button>

      {/* Pure white wordmark. Hidden on phones — the brand moves into the menu
          sheet there, freeing the bar for New book and Import. */}
      <p className="hidden min-w-0 shrink-0 font-display text-xl font-medium tracking-tight text-white md:block md:text-2xl">
        OpenChapter
      </p>

      <nav className="ml-auto flex items-center gap-2 font-sans text-sm">
        {/* New book and Import ride in the top bar on phones, where the sheet no
            longer carries them; hidden at md, where the sidebar has them. */}
        <button
          type="button"
          onClick={onImport}
          className="rounded-md border border-white/25 px-3 py-2 font-medium
                     text-white outline-none transition-colors hover:bg-white/10
                     focus-visible:ring-2 focus-visible:ring-accent/60 md:hidden"
        >
          Import
        </button>
        <Link
          href="/book/new"
          className="rounded-md bg-accent px-3 py-2 font-semibold text-white
                     outline-none transition-colors hover:bg-accent-strong
                     focus-visible:ring-2 focus-visible:ring-accent/60 md:hidden"
        >
          New book
        </Link>

        {/* The two quiet links fold away on small screens. */}
        <button
          type="button"
          onClick={onTemplates}
          className="hidden rounded-md px-3 py-2 text-muted outline-none
                     transition-colors hover:bg-raised hover:text-fg
                     focus-visible:ring-2 focus-visible:ring-accent/60 md:block"
        >
          Templates
        </button>

        {continueId && (
          <Link
            href={`/book/${continueId}`}
            className="hidden rounded-md px-3 py-2 text-muted outline-none
                       transition-colors hover:bg-raised hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/60 md:block"
          >
            Continue writing
          </Link>
        )}

        <button
          type="button"
          onClick={onUpgrade}
          className="hidden rounded-md bg-accent px-4 py-2 font-semibold
                     text-white outline-none transition-colors
                     hover:bg-accent-strong focus-visible:ring-2
                     focus-visible:ring-accent/60 md:ml-2 md:block"
        >
          Upgrade
        </button>
      </nav>
    </header>
  );
}

function ShelfNav({
  view,
  counts,
  navOpen,
  onCloseNav,
  onView,
  onImport,
  onSounds,
  onHelp,
  onSupport,
  onUpgrade,
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
  onUpgrade: () => void;
}) {
  const { theme } = usePrefs();

  return (
    <>
      {/* Below md the sidebar is a drawer; this dims the page behind it and
          closes it on a tap outside. */}
      {navOpen && (
        <div
          aria-hidden="true"
          onClick={onCloseNav}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <aside
        // The nav chrome; see .nav-chrome. Its shade change against the white
        // content well, plus that panel's one rounded corner, is what separates
        // the two — no border needed. Below md it's a bottom sheet: it slides up
        // from the foot, full width with a rounded top and a drag handle. At md
        // and up it resets to the static side column it has always been.
        className={`nav-chrome fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh]
                    flex-col rounded-t-2xl px-4 pt-2 pb-3 shadow-2xl
                    transition-transform duration-300 ease-out
                    md:static md:z-auto md:max-h-none md:w-(--sidebar-width)
                    md:shrink-0 md:rounded-none md:shadow-none md:transition-none
                    ${navOpen ? "translate-y-0" : "translate-y-full"}
                    md:translate-y-0`}
        aria-label="Library"
      >
        {/* The grabber, at the top of the sheet — a bottom-sheet convention,
            and a second way to dismiss it. Sheet only. */}
        <button
          type="button"
          onClick={onCloseNav}
          aria-label="Close menu"
          className="mx-auto mb-1 flex h-5 w-full items-center justify-center md:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-current opacity-40" />
        </button>

      {/* The brand at the head of the sheet. Sheet only — on desktop the
          wordmark lives in the top bar, and New book/Import sit here instead. */}
      <div className="mb-2 flex items-center gap-2.5 px-1 md:hidden">
        <span
          aria-hidden="true"
          className="h-6 w-6 bg-white"
          style={{
            maskImage: "url(/logo.png?v=2)",
            WebkitMaskImage: "url(/logo.png?v=2)",
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
        />
        <span className="font-display text-lg font-medium tracking-tight text-white">
          OpenChapter
        </span>
      </div>

      {/* New book and Import live here on desktop; on the phone they move up to
          the top bar, so they are hidden in the sheet. A link, not a button:
          setting up a book is a place you go. */}
      <Link
        href="/book/new"
        className="hidden w-full rounded-md bg-accent py-2.5 text-center
                   font-sans text-base font-semibold text-white outline-none
                   transition-colors hover:bg-accent-strong
                   focus-visible:ring-2 focus-visible:ring-accent/60 md:block"
      >
        New book
      </Link>

      {/* Quieter than New book on purpose: most visits start something, and
          importing is the once-per-manuscript path. Opens the import modal
          rather than a page, so the shelf stays put behind it. */}
      <button
        type="button"
        onClick={onImport}
        className="mt-2 hidden w-full rounded-md border border-line py-2.5
                   text-center font-sans text-base font-medium text-muted
                   outline-none transition-colors hover:border-accent/60
                   hover:bg-raised hover:text-fg focus-visible:ring-2
                   focus-visible:ring-accent/60 md:block"
      >
        Import a book
      </button>

      <nav className="mt-2 flex flex-col gap-0.5 md:mt-4">
        {(["active", "archived", "trashed"] as BookView[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onView(value)}
            aria-current={view === value ? "page" : undefined}
            className={`flex items-center justify-between gap-2 rounded-md px-3
                        py-2.5 text-left font-sans text-base outline-none
                        transition-colors focus-visible:ring-2
                        focus-visible:ring-accent/60 ${
                          view === value
                            ? "bg-selected text-selected-fg"
                            : "text-muted hover:bg-raised hover:text-fg"
                        }`}
          >
            <span className="flex items-center gap-2.5">
              {VIEW_ICON[value]}
              {VIEW_LABEL[value]}
            </span>
            {counts[value] > 0 && (
              <span className="shrink-0 text-sm tabular-nums opacity-70">
                {counts[value]}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* A single line sets the views above apart from the tools below. */}
      <div aria-hidden="true" className="my-2 h-px bg-line" />

      {/* Sounds, help, support, and the theme toggle — the tools, under the
          line, with Theme last. */}
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onSounds}
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left
                     font-sans text-base text-muted outline-none transition-colors
                     hover:bg-raised hover:text-fg focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          <MaskIcon src="/icon-sounds.png" className="h-7 w-7" />
          Sounds
        </button>

        <button
          type="button"
          onClick={onHelp}
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left
                     font-sans text-base text-muted outline-none transition-colors
                     hover:bg-raised hover:text-fg focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-7 shrink-0"
          >
            <circle cx="10" cy="10" r="7.5" />
            <path
              d="M8 7.9a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.4"
              strokeLinecap="round"
            />
            <circle cx="10" cy="14.2" r="0.6" fill="currentColor" stroke="none" />
          </svg>
          Help
        </button>

        <button
          type="button"
          onClick={onSupport}
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left
                     font-sans text-base text-muted outline-none transition-colors
                     hover:bg-raised hover:text-fg focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-7 shrink-0"
          >
            <path
              d="M4 4.5h12A1.5 1.5 0 0 1 17.5 6v6a1.5 1.5 0 0 1-1.5 1.5H8.5L5 16.5v-3H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5z"
              strokeLinejoin="round"
            />
          </svg>
          Support
        </button>

        <button
          type="button"
          onClick={() => setPref("theme", theme === "dark" ? "light" : "dark")}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left
                     font-sans text-base text-muted outline-none transition-colors
                     hover:bg-raised hover:text-fg focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-7 shrink-0"
          >
            <circle cx="10" cy="10" r="7" />
            {/* The right half, filled — the contrast mark. */}
            <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
          </svg>
          Theme
        </button>

        {/* Upgrade lives in the top bar on desktop; on the phone the bar has no
            room for it, so it sits here in the menu instead. */}
        <button
          type="button"
          onClick={onUpgrade}
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left
                     font-sans text-base text-muted outline-none transition-colors
                     hover:bg-raised hover:text-fg focus-visible:ring-2
                     focus-visible:ring-accent/60 md:hidden"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-7 shrink-0"
          >
            <path d="M10 3.5 5 9h3v7.5h4V9h3z" />
          </svg>
          Upgrade
        </button>
      </div>

      {/* The account, at the foot of the shelf. There is no sign-in yet — auth
          has been left out on purpose — so this is a guest on the free tier
          rather than a person; clicking it opens the plan note, which says as
          much. Desktop only: the phone's sheet keeps to navigation. */}
      <div className="mt-auto hidden border-t border-line pt-3 md:block">
        <button
          type="button"
          onClick={onUpgrade}
          aria-label="Your account and plan"
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2
                     text-left outline-none transition-colors hover:bg-raised
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center
                       rounded-full bg-accent text-white"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5"
            >
              <circle cx="10" cy="7" r="3" />
              <path d="M4.5 16a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
            </svg>
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate font-sans text-sm font-medium text-fg">
              Guest
            </span>
            <span className="block truncate font-sans text-xs text-muted">
              Free plan
            </span>
          </span>

          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-4 w-4 shrink-0 text-muted"
          >
            <path
              d="m7 8 3-3 3 3M7 12l3 3 3-3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      </aside>
    </>
  );
}

function Empty() {
  return (
    <div className="mt-16 text-center">
      <p className="font-serif text-lg text-fg">Nothing on the shelf yet.</p>
      <Link
        href="/book/new"
        className="mt-4 inline-block rounded-md bg-accent px-4 py-2 font-sans
                   text-sm font-semibold text-white outline-none
                   transition-colors hover:bg-accent-strong
                   focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Start your first book
      </Link>
    </div>
  );
}

/**
 * The shelf itself.
 *
 * A grid of covers rather than a table of rows. A table is the better shape for
 * comparing many books on one column — which is not what anybody does here.
 * They are looking for the one they were writing, and a spine is what they
 * recognise it by.
 *
 * The figures the table carried are not lost, only demoted: chapters, words and
 * when it was last opened sit under each cover, where they read as description
 * rather than as data to be scanned.
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
      className="mt-8 grid gap-x-6 gap-y-8"
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
                   focus-visible:ring-offset-panel"
      >
        <BookCover
          title={book.title}
          subtitle={book.subtitle}
          author={book.author}
          words={bookWordCount(book)}
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
          <p className="min-w-0 flex-1 truncate font-sans text-sm font-medium text-fg">
            {book.title}
          </p>
          {book.id === continueId && (
            <span className="shrink-0 rounded-full bg-accent-deep px-2 py-0.5 font-sans text-[0.6rem] tracking-wide text-white uppercase">
              Continue
            </span>
          )}
        </div>
        {book.subtitle ? (
          <p className="mt-0.5 truncate font-sans text-xs text-muted">
            {book.subtitle}
          </p>
        ) : null}
      </div>
    </li>
  );
}
