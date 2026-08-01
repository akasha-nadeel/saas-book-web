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
 * Which book you are in, on a screen that is not the book.
 *
 * Every tool opens at `/book/<uuid>/<tool>` and fills the window — no rail, no
 * header, nothing of the dashboard. The only thing naming the book was a small
 * grey back link, which reads as *where this goes* rather than as *where you
 * are*; and the Tools area lets a writer switch books before opening one, so
 * arriving at the wrong manuscript's export screen is a real way to spend ten
 * minutes.
 *
 * So the book gets a face: its cover, its title, and what it weighs. The cover
 * is the part that does the work — a writer knows their own covers on sight and
 * has to read a title.
 *
 * The trail is `Books › <title> › <tool>` with the first two links, so the way
 * out is the same shape as the way in. The tool's own name is the last crumb
 * rather than a heading repeated below, which is why pages using this drop
 * their `<h1>`.
 */
export function ToolHeader({
  book,
  /** This screen's name — the last crumb. */
  tool,
  /** One line under the title, if the tool has something to say up front. */
  children,
}: {
  book: Book;
  tool: string;
  children?: React.ReactNode;
}) {
  const cover = useCover(book.id);

  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto max-w-3xl px-6 py-4">
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

        <div className="mt-3 flex items-center gap-3.5">
          {/* Linked, so the cover is also the way back into the book — the
              thing a writer reaches for once they have seen it is the wrong
              one. */}
          <Link href={`/book/${book.id}`} className="w-10 shrink-0">
            <BookCover
              title={book.title}
              words={bookWordCount(book)}
              seed={book.id}
              image={cover}
              {...(book.subtitle ? { subtitle: book.subtitle } : {})}
              {...(book.author ? { author: book.author } : {})}
              {...(book.bareCover ? { bare: true } : {})}
            />
          </Link>

          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-fg">{book.title}</p>
            <p className="text-xs text-muted">
              {bookChapterCount(book).toLocaleString()}{" "}
              {bookChapterCount(book) === 1 ? "chapter" : "chapters"} ·{" "}
              {bookWordCount(book).toLocaleString()}{" "}
              {bookWordCount(book) === 1 ? "word" : "words"}
            </p>
          </div>
        </div>

        {children && <div className="mt-3 text-muted">{children}</div>}
      </div>
    </header>
  );
}
