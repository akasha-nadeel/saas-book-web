"use client";

import { useMemo, type CSSProperties } from "react";
import {
  chapterLabel,
  chapterMatterOf,
  chapterNumberOf,
  getBody,
  isGenericChapterTitle,
  orderedChapters,
  pageSetupOf,
  typographyOf,
  type Book,
} from "@/lib/library-store";
import { pageMetrics } from "@/lib/page-setup";
import { typographyVars } from "@/lib/typography";
import { isDraftMatter, toBlocks } from "@/lib/export/blocks";
import { blocksToXhtml } from "@/lib/export/xhtml";
import { usePrefs } from "@/lib/use-library";
import { type ReaderChapter } from "@/lib/reader/page-flow";
import { ReaderFlipbook } from "@/components/reader/reader-flipbook";

/**
 * The book as a book — the flip-book and everything it needs to be set.
 *
 * Pulled out of `book-reader.tsx` when the export wizard grew a Preview step,
 * because that step shows the same thing and the setting is the part that is
 * easy to get subtly wrong: the `.manuscript` class and `data-paper` that
 * re-point the page palette, the `--ms-*` variables that carry the book's own
 * face and leading, and the trim the sheets are cut to. Two copies of that
 * would be two books, and the whole point of a preview is that it is not a
 * second rendering of anything.
 *
 * The caller supplies the frame: the reader route gives it the window, the
 * export step gives it a box on a scrolling page.
 */

function loadForReading(book: Book): ReaderChapter[] {
  return (
    orderedChapters(book)
      /*
       * **The same pages the export takes, so the read-through matches the file.**
       *
       * Front and back matter are lists of pages now, each seeded with the shape
       * of the thing and the writer's own details left in `[brackets]`. A book
       * that has pressed Start and filled in two of them would otherwise read
       * with fourteen sheets of `[Term] — [what it means]` bound into it, which
       * is not what this view is for: it exists to show the book as it will be,
       * and the exporters leave those pages out. See `isUntouchedMatter`.
       *
       * Body chapters are never dropped, however empty — an unwritten chapter is
       * a hole in the book, and this is exactly the view for seeing one.
       */
      .filter(
        (chapter) =>
          chapterMatterOf(chapter) === "body" || !isDraftMatter(chapter.id),
      )
      .map((chapter) => {
        const raw = getBody(chapter.id);
        let html = "";
        if (raw) {
          try {
            html = blocksToXhtml(toBlocks(JSON.parse(raw)));
          } catch {
            // A corrupt body reads as an empty chapter rather than breaking the
            // whole book — the same call the exporters make.
            html = "";
          }
        }
        // A spelled "Chapter Five" label sits above the title, but only when the
        // title is a real name — a chapter still called "Chapter 5" is its own label.
        const number = chapterNumberOf(book, chapter.id);
        const label =
          number !== null && !isGenericChapterTitle(chapter.title)
            ? chapterLabel(number)
            : null;
        return {
          id: chapter.id,
          title: chapter.title,
          label,
          html,
          empty: html.trim() === "",
        };
      })
  );
}

export function BookPages({
  book,
  cover,
  zoom = 1,
  className = "",
}: {
  book: Book;
  cover: string | null;
  zoom?: number;
  /** The frame. Whatever it is, it has to have a height — the flip-book centres
   *  itself in `h-full`, which collapses inside a box that is sized by its
   *  content. */
  className?: string;
}) {
  const prefs = usePrefs();

  // Parsing every body is the expensive part, so it is memoised on the book
  // snapshot — a rename repaints without re-reading forty documents.
  const chapters = useMemo(() => loadForReading(book), [book]);

  const dark = prefs.paper === "slate" || prefs.paper === "black";

  // The book's own face, size and spacing — the same variables the editor sets,
  // so the read-through matches the writing surface exactly.
  const typoVars = typographyVars(typographyOf(book));

  // Each chapter is set on real pages at the book's own trim size, and flows
  // onto further pages when it runs long — the pagination lives in page-flow.
  // The `fit` setting (which fills the editor column) is ignored here, exactly
  // as export ignores it.
  const metrics = pageMetrics(pageSetupOf(book));

  return (
    /* `data-paper` re-points the palette so the sheets and their prose take the
       writer's chosen page colour, light or dark, independent of the app theme
       — exactly as the editor's surface does. */
    <div
      data-paper={prefs.paper}
      style={
        {
          colorScheme: dark ? "dark" : "light",
          ...typoVars,
        } as CSSProperties
      }
      className={`manuscript ${className}`}
    >
      <ReaderFlipbook
        chapters={chapters}
        book={book}
        cover={cover}
        metrics={metrics}
        paper={prefs.paper}
        zoom={zoom}
        bookId={book.id}
        typographyKey={JSON.stringify(typoVars)}
      />
    </div>
  );
}
