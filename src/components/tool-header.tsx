"use client";

import Link from "next/link";
import { BookCover } from "@/components/shelf/book-cover";
import {
  bookChapterCount,
  bookWordCount,
  type Book,
} from "@/lib/library-store";
import { useCover } from "@/lib/use-library";

/**
 * The head of a tool screen: what this page is, and which book it is about.
 *
 * Every tool opens at `/book/<uuid>/<tool>` and fills the window — no rail, no
 * dashboard, nothing but itself. So it has to answer two questions on its own,
 * and the order they go in matters.
 *
 * **The tool's name is the heading.** It was briefly only the last breadcrumb,
 * with the book's title set large underneath, on the reasoning that a heading
 * would repeat the crumb. That was wrong: it left the biggest words on the page
 * naming the *context* rather than the page, so every screen looked like the
 * same screen with different contents. A page is what it does.
 *
 * **The book is a chip above it**, small but with its cover. The cover is the
 * part that does the work — a writer knows their own covers on sight and has to
 * read a title — and it matters because the Tools area lets them switch books
 * before opening one, so landing on the wrong manuscript's export screen is a
 * real way to lose ten minutes.
 */

/**
 * The column widths the tool pages use.
 *
 * Passed in rather than fixed, because the header's contents have to line up
 * with the page's — the bar spans the window but what is written on it must
 * start at the same left edge as the first card below it. Written out rather
 * than interpolated: Tailwind reads class names as literals and would ship no
 * rule for a name built at runtime.
 */
const WIDTHS = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
} as const;

export function ToolHeader({
  book,
  /** Short name for the trail — the word a writer looked for in the launcher. */
  tool,
  /**
   * The heading, where the page calls itself something longer than its tile
   * does. Defaults to `tool`, which is right for most of them.
   */
  title,
  /** Must match the page's own container, or the two edges disagree. */
  width = "3xl",
  /** One line under the heading, if the tool has something to say up front. */
  children,
}: {
  book: Book;
  tool: string;
  title?: string;
  width?: keyof typeof WIDTHS;
  children?: React.ReactNode;
}) {
  const cover = useCover(book.id);

  return (
    <header className="border-b border-line bg-panel">
      <div className={`mx-auto ${WIDTHS[width]} px-6 py-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1.5 text-xs text-muted"
          >
            <Link href="/" className="hover:text-fg">
              Books
            </Link>
            <span aria-hidden="true">›</span>
            <Link href={`/book/${book.id}`} className="truncate hover:text-fg">
              {book.title}
            </Link>
            <span aria-hidden="true">›</span>
            <span className="font-semibold text-fg">{tool}</span>
          </nav>

          {/* Beside the trail rather than in it. The breadcrumb describes where
              this page sits — a tool belongs to a book — and the launcher is
              not its parent: the same screen is reached from the book cards,
              from Prepare and from the roadmap. This is a shortcut back to the
              wall of them, which is a different claim and belongs in a
              different control. */}
          <Link
            href="/?area=tools"
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs
                       font-semibold text-fg hover:border-accent/40"
          >
            ← All tools
          </Link>
        </div>

        {/* The book, as a chip. Linked on both halves, so the cover is also the
            way back into it — that is what a writer reaches for the moment they
            see it is the wrong one. */}
        <Link
          href={`/book/${book.id}`}
          className="mt-3 inline-flex max-w-full items-center gap-2.5 rounded-full
                     border border-line bg-surface py-1 pr-3.5 pl-1 transition-colors
                     hover:border-accent/40"
        >
          <span className="w-6 shrink-0">
            <BookCover
              title={book.title}
              words={bookWordCount(book)}
              seed={book.id}
              image={cover}
              {...(book.subtitle ? { subtitle: book.subtitle } : {})}
              {...(book.author ? { author: book.author } : {})}
              {...(book.bareCover ? { bare: true } : {})}
            />
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-fg">
            {book.title}
          </span>
          <span className="shrink-0 text-xs whitespace-nowrap text-muted">
            {bookChapterCount(book).toLocaleString()}{" "}
            {bookChapterCount(book) === 1 ? "chapter" : "chapters"} ·{" "}
            {bookWordCount(book).toLocaleString()}{" "}
            {bookWordCount(book) === 1 ? "word" : "words"}
          </span>
        </Link>

        <h1 className="mt-3 text-2xl font-extrabold text-fg">
          {title ?? tool}
        </h1>

        {children && <p className="mt-1.5 text-muted">{children}</p>}
      </div>
    </header>
  );
}
