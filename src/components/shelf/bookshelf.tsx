"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExportDialog } from "@/components/export/export-dialog";
import { BookCover } from "@/components/shelf/book-cover";
import { BookDetailsDialog } from "@/components/shelf/book-details-dialog";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import { RowMenu, menuIcons } from "@/components/sidebar/row-menu";
import { TemplatesDialog } from "@/components/shelf/templates-dialog";
import { UpgradeDialog } from "@/components/shelf/upgrade-dialog";
import {
  archiveBook,
  bookWordCount,
  booksIn,
  deleteBook,
  migrateLegacy,
  setBareCover,
  restoreBook,
  trashBook,
  type Book,
  type BookView,
} from "@/lib/library-store";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";

const VIEW_LABEL: Record<BookView, string> = {
  active: "All books",
  archived: "Archived books",
  trashed: "Trashed books",
};

export function Bookshelf() {
  const hydrated = useHydrated();
  const shelf = useShelf();

  const [exporting, setExporting] = useState<Book | null>(null);
  const [editing, setEditing] = useState<Book | null>(null);
  const [opening, setOpening] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"templates" | "upgrade" | null>(null);
  const [view, setView] = useState<BookView>("active");

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

  if (!hydrated) return null;

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
        onTemplates={() => setDialog("templates")}
        onUpgrade={() => setDialog("upgrade")}
      />

      <div className="flex min-h-0 flex-1">
        <ShelfNav
          view={view}
          counts={counts}
          totalWords={totalWords}
          onView={setView}
        />

        {/* One rounded corner, top-left, and the panel runs off the right and
            bottom edges. The separation from the sidebar is the shade change and
            that single corner — no border, no floating gap on four sides. */}
        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="flex h-full flex-col overflow-y-auto rounded-tl-2xl bg-panel px-8 py-7">
            <div className="flex items-baseline justify-between gap-6">
              <h1 className="font-serif text-2xl text-fg">
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
                onExport={setExporting}
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

      {exporting && (
        <ExportDialog book={exporting} onClose={() => setExporting(null)} />
      )}
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
  onTemplates,
  onUpgrade,
}: {
  continueId: string | null;
  onTemplates: () => void;
  onUpgrade: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-6 bg-surface px-6">
      <p className="min-w-0 shrink-0 font-display text-2xl font-medium tracking-tight text-fg">
        OpenChapter
      </p>

      <nav className="ml-auto flex items-center gap-2 font-sans text-sm">
        <button
          type="button"
          onClick={onTemplates}
          className="rounded-md px-3 py-2 text-muted outline-none
                     transition-colors hover:bg-raised hover:text-fg
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Templates
        </button>

        {continueId && (
          <Link
            href={`/book/${continueId}`}
            className="rounded-md px-3 py-2 text-muted outline-none
                       transition-colors hover:bg-raised hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Continue writing
          </Link>
        )}

        <button
          type="button"
          onClick={onUpgrade}
          className="ml-2 rounded-md bg-accent px-4 py-2 font-semibold
                     text-white outline-none transition-colors
                     hover:bg-accent-strong focus-visible:ring-2
                     focus-visible:ring-accent/60"
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
  totalWords,
  onView,
}: {
  view: BookView;
  counts: Record<BookView, number>;
  totalWords: number;
  onView: (view: BookView) => void;
}) {
  return (
    <aside
      // No right border: the panel's lighter shade and its rounded corner are
      // what separate the two, as in the reference.
      className="flex w-(--sidebar-width) shrink-0 flex-col bg-surface px-4 pt-2 pb-6"
      aria-label="Library"
    >
      {/* A link, not a button: setting up a book is a place you go, and a
          link is what lets it be opened in a new tab or middle-clicked. */}
      <Link
        href="/book/new"
        className="block w-full rounded-md bg-accent py-2.5 text-center
                   font-sans text-sm font-semibold text-white outline-none
                   transition-colors hover:bg-accent-strong
                   focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        New book
      </Link>

      {/* Quieter than New book on purpose: most visits start something, and
          importing is the once-per-manuscript path. */}
      <Link
        href="/book/import"
        className="mt-2 block w-full rounded-md border border-line py-2.5
                   text-center font-sans text-sm font-medium text-muted
                   outline-none transition-colors hover:border-accent/60
                   hover:bg-raised hover:text-fg focus-visible:ring-2
                   focus-visible:ring-accent/60"
      >
        Import a book
      </Link>

      <nav className="mt-4 flex flex-col gap-0.5">
        {(["active", "archived", "trashed"] as BookView[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onView(value)}
            aria-current={view === value ? "page" : undefined}
            className={`flex items-baseline justify-between gap-2 rounded-md px-3
                        py-2 text-left font-sans text-sm outline-none
                        transition-colors focus-visible:ring-2
                        focus-visible:ring-accent/60 ${
                          view === value
                            ? "bg-accent-deep text-white"
                            : "text-muted hover:bg-raised hover:text-fg"
                        }`}
          >
            <span>{VIEW_LABEL[value]}</span>
            {counts[value] > 0 && (
              <span className="shrink-0 text-xs tabular-nums opacity-70">
                {counts[value]}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-line px-3 pt-4 font-sans text-xs text-muted">
        {counts.active} {counts.active === 1 ? "book" : "books"}
        {" · "}
        {totalWords.toLocaleString()} words
      </div>
    </aside>
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
  onExport,
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
  onExport: (book: Book) => void;
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
          onExport={onExport}
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
  onExport,
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
  onExport: (book: Book) => void;
  onEdit: (book: Book) => void;
  onOpen: (book: Book) => void;
  onArchive: (book: Book) => void;
  onRestore: (book: Book) => void;
  onTrash: (book: Book) => void;
  onDeleteForever: (book: Book) => void;
}) {
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
                    onSelect: () => onExport(book),
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
