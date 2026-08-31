import { orderedChapters, type Book, type ChapterMeta } from "./library-store";

/**
 * Finding a book or a chapter by name.
 *
 * **Names only, and never the prose.** Book titles and chapter titles both live
 * in the shelf index, which is the one store kept in `localStorage` and read
 * synchronously — so this walks memory the writer already has and answers
 * between keystrokes. Searching the writing itself means loading every chapter
 * body out of IndexedDB, which for an ordinary shelf is a hundred-odd reads
 * before the first result; that is a different feature with a different shape
 * (see `searchChapters` in `search.ts`, which does it for **one** book at a
 * time and is right to).
 *
 * Pure, so the matching can be tested without a DOM — the component around it
 * is not tested, and this is the part that can be wrong.
 */

export interface ChapterHit {
  book: Book;
  chapter: ChapterMeta;
}

export interface ShelfResults {
  books: Book[];
  chapters: ChapterHit[];
}

/**
 * Caps, so one letter cannot render the whole library.
 *
 * A list nobody scrolls to the end of is a list that has stopped answering the
 * question; typing another letter is faster than reading two hundred rows.
 */
export const BOOK_LIMIT = 10;
export const CHAPTER_LIMIT = 20;

export const EMPTY_RESULTS: ShelfResults = { books: [], chapters: [] };

/**
 * Books and chapters whose titles contain the query.
 *
 * **An empty query finds nothing rather than everything.** The caller shows
 * recent books in that state, which is a different list with a different
 * heading — returning the whole shelf here would make "no query" and "matched
 * every book" indistinguishable to anything reading this.
 */
export function searchShelf(
  books: readonly Book[],
  query: string,
  limits: { books?: number; chapters?: number } = {},
): ShelfResults {
  const needle = query.trim().toLowerCase();
  if (!needle) return EMPTY_RESULTS;

  const bookLimit = limits.books ?? BOOK_LIMIT;
  const chapterLimit = limits.chapters ?? CHAPTER_LIMIT;

  const matchedBooks: Book[] = [];
  const matchedChapters: ChapterHit[] = [];

  for (const book of books) {
    if (
      matchedBooks.length < bookLimit &&
      book.title.toLowerCase().includes(needle)
    ) {
      matchedBooks.push(book);
    }

    if (matchedChapters.length >= chapterLimit) continue;

    /* `orderedChapters` rather than `book.chapters`, so front matter, body and
       back matter come back in the order the book is bound in — the same order
       the navigator lists them. A search that returns them shuffled is a search
       whose results do not match the screen behind it.

       It reads `book.chapters`, which a soft-deleted chapter has already left
       for `book.trash`, so nothing extra is needed to exclude one. */
    for (const chapter of orderedChapters(book)) {
      if (matchedChapters.length >= chapterLimit) break;
      if (chapter.title.toLowerCase().includes(needle)) {
        matchedChapters.push({ book, chapter });
      }
    }
  }

  return { books: matchedBooks, chapters: matchedChapters };
}

/** Whether anything at all came back. */
export function hasResults(results: ShelfResults): boolean {
  return results.books.length > 0 || results.chapters.length > 0;
}

/**
 * The books to offer before a query is typed.
 *
 * Most recently opened first, because the commonest reason to open this is to
 * get back to what you were just writing. A book never opened has no
 * `lastOpenedAt` and sorts last rather than being left out — a new shelf would
 * otherwise show an empty panel.
 */
export function recentBooks(books: readonly Book[], limit = 6): Book[] {
  return [...books]
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
    .slice(0, limit);
}
