"use client";

import { BookCover } from "@/components/shelf/book-cover";
import { bookWordCount, type Book } from "@/lib/library-store";
import { useCover } from "@/lib/use-library";

/**
 * A book's own cover, small enough to sit in a row.
 *
 * **The same `BookCover` the shelf draws, not a miniature of it.** A book with
 * artwork shows its artwork; one without shows the same typeset cloth face it
 * wears everywhere else, in the same colour, because the palette is seeded from
 * the book id. Lists that used a single generic glyph made every book look like
 * a copy of the same thing — which is the opposite of what a shelf is for, and
 * the reason a writer can find a book by its spine across a room.
 *
 * **Its own component because of `useCover`.** A hook cannot run in a loop, so
 * each row needs its own subscription to its own book's artwork; that is also
 * what makes a cover appear here the moment it is changed elsewhere.
 *
 * `pageBlock={false}` — the block down the right edge gives a book thickness on
 * a shelf, and at this size it is a grey smear taking a fifth of the width.
 */
export function BookThumb({
  book,
  /** Tailwind width class. The cover is 2:3, so height follows from it. */
  width = "w-8",
}: {
  book: Book;
  width?: string;
}) {
  const cover = useCover(book.id);
  return (
    <span className={`block shrink-0 ${width}`}>
      <BookCover
        title={book.title}
        subtitle={book.subtitle}
        author={book.author}
        words={bookWordCount(book)}
        image={cover}
        bare={book.bareCover}
        seed={book.id}
        pageBlock={false}
      />
    </span>
  );
}
