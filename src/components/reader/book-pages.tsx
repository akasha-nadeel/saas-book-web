"use client";

import { useMemo, type CSSProperties } from "react";
import {
  darkPaper,
  chapterMatterOf,
  chapterNumberOf,
  getBody,
  orderedChapters,
  pageSetupOf,
  typographyOf,
  type Book,
} from "@/lib/library-store";
import { pageMetrics } from "@/lib/page-setup";
import { typographyVars } from "@/lib/typography";
import { isDraftMatter, toBlocks, chapterNumeral } from "@/lib/export/blocks";
import { blocksToXhtml } from "@/lib/export/xhtml";
import {
  DEFAULT_TYPESET,
  typesetMetrics,
  typesetVars,
  type TypesetOptions,
} from "@/lib/export/typeset";
import { usePrefs } from "@/lib/use-library";
import { boundReaderPages, type LoadedPage } from "@/lib/reader/bound-pages";
import { ReaderFlipbook } from "@/components/reader/reader-flipbook";

/**
 * The book as a book — the flip-book and everything it needs to be set.
 *
 * Pulled out of `book-reader.tsx` when the export wizard grew a Preview step,
 * because that step shows the same thing and the setting is the part that is
 * easy to get subtly wrong: the `.manuscript` class and `data-paper` that
 * re-point the page palette, the `--ms-*` variables that carry the face and
 * leading, and the trim the sheets are cut to. Two copies of that would be two
 * books, and the whole point of a preview is that it is not a second rendering
 * of anything.
 *
 * The caller supplies the frame: the reader route gives it the window, the
 * export step gives it a box on a scrolling page.
 *
 * **It shows the book the export would produce, and for a while it did not.**
 * It walked `orderedChapters(book)` and stopped there, so four things the file
 * does were invisible on the one screen that exists to show the file: the
 * generated title page, copyright page and contents were never built, the
 * "ours, not yours" switches were never applied, `bindBook`'s order was never
 * used, and apparatus was headed with its own name — a sheet reading "Copyright
 * page", which no published book has and no exporter here writes. A writer who
 * pressed *ours* on the contents step walked to Preview and found their own
 * page still there. See `boundReaderPages`, which is the whole of the fix and
 * calls the export's own functions rather than restating them.
 *
 * **The sheets carry page numbers and so does the contents**, drawn from this
 * view's own measured layout — see `withFolios`, and the `.reader-folio` rule
 * in globals.css. The one thing not claimed: the reading view and Paged.js are
 * two engines measuring the same book, so a long one can differ by a page.
 * Both are measured rather than invented, and neither is presented as the
 * other.
 */

function loadForReading(book: Book): LoadedPage[] {
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
        /* **The numeral the *file* prints, not a spelled label.**
           This read `chapterLabel(number)` — "Chapter Three" — while the EPUB,
           the PDF and the Word file all print a bare numeral above the title.
           Same rule, two renderings, so a writer met one opener on the screen
           that claims to show their file and a different one in the file.
           `chapterNumeral` is the rule those renderers already share, so
           asking it is what keeps the two from drifting again. */
        const number = chapterNumberOf(book, chapter.id);
        const numeral = chapterNumeral({ title: chapter.title, number });
        const label = numeral === null ? null : String(numeral);
        return {
          id: chapter.id,
          title: chapter.title,
          label,
          html,
          number,
          /* Carried because the export's own filters turn on it: which part a
             page is in decides whether it can be replaced by a generated one,
             where it binds, and whether it prints a heading. */
          matter: chapterMatterOf(chapter),
        };
      })
  );
}

export function BookPages({
  book,
  cover,
  zoom = 1,
  className = "",
  typeset = DEFAULT_TYPESET,
  setting = "book",
}: {
  book: Book;
  cover: string | null;
  zoom?: number;
  /** The frame. Whatever it is, it has to have a height — the flip-book centres
   *  itself in `h-full`, which collapses inside a box that is sized by its
   *  content. */
  className?: string;
  /**
   * Which pages the export would build, so this shows the same book.
   *
   * The three switches decide whether a title page, a copyright page and a
   * contents list are bound in, and `replaceWritten` decides whether the
   * writer's own page or ours is used where both exist. Defaulted rather than
   * required, because the read-through has no wizard behind it and the default
   * is what an export nobody has configured produces — see `DEFAULT_TYPESET`.
   */
  typeset?: TypesetOptions;
  /**
   * Where the page and the type come from. **The second knob, and it is a
   * second knob on purpose.**
   *
   * `"book"` sets the sheets at the writer's own page setup in their own face,
   * which is what pairs the read-through with the writing surface — one setting
   * styles both, and a reader who chose Garamond should not be shown Georgia.
   * `"export"` sets them at the trim, margins, size and template face the file
   * will use, which is what the export wizard's Preview is for.
   *
   * Folding this into `typeset` would force `/read` onto 6×9 in Classic for
   * every book, which is a claim about a file rather than a view of the
   * manuscript.
   */
  setting?: "book" | "export";
}) {
  const prefs = usePrefs();

  /* Parsing every body is the expensive part, so it is memoised on the book
     snapshot — a rename repaints without re-reading forty documents. The
     typeset is in here too: turning off the contents, or asking for ours
     instead of theirs, changes which pages exist. */
  const chapters = useMemo(
    () => boundReaderPages(book, loadForReading(book), typeset),
    [book, typeset],
  );

  const dark = darkPaper(prefs.paper, prefs.theme);

  /* Either the book's own face, size and spacing — the same variables the
     editor sets, so the read-through matches the writing surface exactly — or
     the template's, when this is standing in for the file. Same for the sheet
     below. See `typesetVars`.
     The `fit` setting (which fills the editor column) is ignored either way,
     exactly as export ignores it. */
  const asExport = setting === "export";
  const typoVars = asExport
    ? typesetVars(typeset)
    : typographyVars(typographyOf(book));
  const metrics = asExport
    ? typesetMetrics(typeset)
    : pageMetrics(pageSetupOf(book));

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
        darkSheet={dark}
        zoom={zoom}
        bookId={book.id}
        typographyKey={JSON.stringify(typoVars)}
      />
    </div>
  );
}
