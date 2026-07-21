"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExportDialog } from "@/components/export/export-dialog";
import { NewBookDialog } from "@/components/shelf/new-book-dialog";
import { TemplatesDialog } from "@/components/shelf/templates-dialog";
import { UpgradeDialog } from "@/components/shelf/upgrade-dialog";
import {
  archiveBook,
  bookWordCount,
  booksIn,
  deleteBook,
  migrateLegacy,
  restoreBook,
  trashBook,
  type Book,
  type BookView,
} from "@/lib/library-store";
import { relativeTime } from "@/lib/relative-time";
import { useHydrated, useShelf } from "@/lib/use-library";

const VIEW_LABEL: Record<BookView, string> = {
  active: "All books",
  archived: "Archived books",
  trashed: "Trashed books",
};

export function Bookshelf() {
  const hydrated = useHydrated();
  const shelf = useShelf();

  const [exporting, setExporting] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<
    "new" | "templates" | "upgrade" | null
  >(null);
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

  // Setup comes first now. The dialog does the creating and the navigating,
  // so there is one path into a new book rather than two that can drift.
  const handleCreate = () => setDialog("new");

  // From the active or archived shelf, deleting means the trash — recoverable,
  // so no dialog. Only the permanent one asks.
  const handleTrash = (book: Book) => trashBook(book.id);

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
          onCreate={handleCreate}
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
                <Empty onCreate={handleCreate} />
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
              <BookTable
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
      {dialog === "new" && <NewBookDialog onClose={() => setDialog(null)} />}

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
  onCreate,
}: {
  view: BookView;
  counts: Record<BookView, number>;
  totalWords: number;
  onView: (view: BookView) => void;
  onCreate: () => void;
}) {
  return (
    <aside
      // No right border: the panel's lighter shade and its rounded corner are
      // what separate the two, as in the reference.
      className="flex w-(--sidebar-width) shrink-0 flex-col bg-surface px-4 pt-2 pb-6"
      aria-label="Library"
    >
      <button
        type="button"
        onClick={onCreate}
        className="w-full rounded-md bg-accent py-2.5 font-sans text-sm
                   font-semibold text-white outline-none transition-colors
                   hover:bg-accent-strong focus-visible:ring-2
                   focus-visible:ring-accent/60"
      >
        New book
      </button>

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

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-16 text-center">
      <p className="font-serif text-lg text-fg">Nothing on the shelf yet.</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 rounded-md bg-accent px-4 py-2 font-sans text-sm
                   font-semibold text-white outline-none transition-colors
                   hover:bg-accent-strong focus-visible:ring-2
                   focus-visible:ring-accent/60"
      >
        Start your first book
      </button>
    </div>
  );
}

/** A row action. Icons are inline paths so there is no icon dependency. */
function RowAction({
  onClick,
  label,
  danger,
  alwaysVisible,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  alwaysVisible?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 text-muted outline-none transition-all
                  hover:bg-line focus-visible:opacity-100 focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    danger ? "hover:text-red-400" : "hover:text-fg"
                  } ${alwaysVisible ? "" : "opacity-0 group-hover:opacity-100"}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        {children}
      </svg>
    </button>
  );
}

function BookTable({
  books,
  view,
  continueId,
  onExport,
  onArchive,
  onRestore,
  onTrash,
  onDeleteForever,
}: {
  books: Book[];
  view: BookView;
  continueId: string | null;
  onExport: (book: Book) => void;
  onArchive: (book: Book) => void;
  onRestore: (book: Book) => void;
  onTrash: (book: Book) => void;
  onDeleteForever: (book: Book) => void;
}) {
  return (
    <table className="mt-6 w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-line font-sans text-xs tracking-wide text-muted uppercase">
          <th scope="col" className="py-3 pr-4 font-medium">
            Title
          </th>
          <th scope="col" className="py-3 pr-4 font-medium">
            Chapters
          </th>
          <th scope="col" className="py-3 pr-4 font-medium">
            Words
          </th>
          <th scope="col" className="py-3 pr-4 font-medium">
            Last opened
          </th>
          <th scope="col" className="py-3 text-right font-medium">
            Actions
          </th>
        </tr>
      </thead>

      <tbody>
        {books.map((book) => (
          <tr
            key={book.id}
            className="group border-b border-line/60 transition-colors
                       last:border-0 hover:bg-raised"
          >
            <td className="py-3.5 pr-4">
              <Link
                href={`/book/${book.id}`}
                // Underline rather than recolour. This was going text-fg →
                // accent, so hovering a row made its title darker and harder
                // to read than the rows either side of it.
                className="rounded-sm font-sans text-sm text-fg underline-offset-4
                           outline-none group-hover:underline
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {book.title}
              </Link>
              {book.id === continueId && (
                <span className="ml-3 rounded-full bg-accent-deep px-2 py-0.5 font-sans text-[0.65rem] tracking-wide text-white uppercase">
                  Continue
                </span>
              )}
            </td>

            <td className="py-3.5 pr-4 font-sans text-sm tabular-nums text-muted">
              {book.chapters.length}
            </td>

            <td className="py-3.5 pr-4 font-sans text-sm tabular-nums text-muted">
              {bookWordCount(book).toLocaleString()}
            </td>

            <td className="py-3.5 pr-4 font-sans text-sm text-muted">
              {relativeTime(book.lastOpenedAt)}
            </td>

            <td className="py-3.5">
              <div className="flex items-center justify-end gap-1">
                {view === "trashed" ? (
                  <>
                    <RowAction
                      alwaysVisible
                      onClick={() => onRestore(book)}
                      label={`Restore ${book.title}`}
                    >
                      <path d="M4 10a6 6 0 1 1 1.8 4.2" />
                      <path d="M4 6v4h4" />
                    </RowAction>
                    <RowAction
                      danger
                      alwaysVisible
                      onClick={() => onDeleteForever(book)}
                      label={`Delete ${book.title} permanently`}
                    >
                      <path d="M4 6h12M8 6V4.5h4V6M6.5 6l.5 9.5h6l.5-9.5" />
                    </RowAction>
                  </>
                ) : (
                  <>
                    <RowAction
                      alwaysVisible
                      onClick={() => onExport(book)}
                      label={`Export ${book.title}`}
                    >
                      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5" />
                      <path d="M4 14v2.5h12V14" />
                    </RowAction>

                    {view === "archived" ? (
                      <RowAction
                        onClick={() => onRestore(book)}
                        label={`Unarchive ${book.title}`}
                      >
                        <path d="M4 10a6 6 0 1 1 1.8 4.2" />
                        <path d="M4 6v4h4" />
                      </RowAction>
                    ) : (
                      <RowAction
                        onClick={() => onArchive(book)}
                        label={`Archive ${book.title}`}
                      >
                        <path d="M3 5.5h14v3H3z" />
                        <path d="M4.5 8.5v7h11v-7M8 11.5h4" />
                      </RowAction>
                    )}

                    <RowAction
                      danger
                      onClick={() => onTrash(book)}
                      label={`Move ${book.title} to trash`}
                    >
                      <path d="M4 6h12M8 6V4.5h4V6M6.5 6l.5 9.5h6l.5-9.5" />
                    </RowAction>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
