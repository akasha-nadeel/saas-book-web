import type { Book } from "@/lib/library-store";
import { printsHeading } from "@/lib/export/blocks";
import {
  bindBook,
  frontSections,
  withoutReplaced,
  type ListedPage,
} from "@/lib/export/front-matter";
import type { TypesetOptions } from "@/lib/export/typeset";
import type { ReaderChapter } from "@/lib/reader/page-flow";

/**
 * The book the reading view sets, bound the way the export binds it.
 *
 * **This exists because the two were built by different routes, and the screen
 * that claims to show the file was the one taking the shorter one.** `runExport`
 * runs `withoutReplaced → frontSections → bindBook`; the reading view walked
 * `orderedChapters(book)` and stopped. So the export wizard's Preview showed a
 * book with no title page and no copyright page, still carrying the writer's own
 * contents page on a book where they had pressed "ours, not yours" — under a
 * heading the file does not print either. Four decisions the file makes, none of
 * them visible on the step before the file is made.
 *
 * So the order is not worked out here. It is `bindBook`'s, called with the same
 * arguments in the same sequence, and the whole content of this module is
 * turning what comes back into the shape the sheets are drawn from. Anything
 * that looks like a rule about which pages go in or what order they take belongs
 * in `front-matter.ts` with the other four renderers, not here.
 *
 * Pure and testable: the caller reads storage and hands the prose over already
 * rendered.
 */

/**
 * A page as the reading view loads it.
 *
 * The export's filters read `title`, `number` and `matter` — that is `ListedPage`
 * — and a screen needs two things more: the **id**, which is what a chapter
 * opener links back into the editor with, and the prose already turned into
 * XHTML. `LoadedChapter` deliberately carries no id (see the note in
 * `export/index.ts`), which is exactly why those filters take the fields rather
 * than the type.
 */
export interface LoadedPage extends ListedPage {
  id: string;
  /** The spelled "Chapter Five" label, or null — see `ReaderChapter`. */
  label: string | null;
  /** The chapter's prose, through `toBlocks → blocksToXhtml`. */
  html: string;
}

export function boundReaderPages(
  book: Book,
  pages: LoadedPage[],
  typeset: TypesetOptions,
): ReaderChapter[] {
  /* The writer's own pages they asked us to replace come out first, before
     anything reads the book — one filter rather than a flag threaded through
     each renderer, which is the whole of the override. Take the page out here
     and `writtenPages` no longer sees it, so `frontSections` generates ours
     without being told to. See `withoutReplaced`. */
  const kept = withoutReplaced(pages, typeset.replaceWritten);

  /* No `href`: an anchor is the format's business, and the two formats that
     have one are the EPUB (a file per chapter) and the print PDF (a
     `target-counter` folio Paged.js resolves against a real page). A screen has
     neither — so `contentsPage` answers a missing `href` with the leader and an
     empty folio slot, which `withFolios` fills once this view has measured and
     cut its own pages. See the note there for why that cannot be done here. */
  const sections = frontSections(book, kept, typeset);

  return bindBook(kept, sections).map((page) =>
    page.kind === "generated"
      ? {
          /* Namespaced, because `layout` in the flip-book is keyed on this and a
             chapter is free to be called "title". */
          id: `generated:${page.section.id}`,
          /* No title of its own: a generated page is apparatus, so it prints no
             heading, and there is nothing for one to say. */
          title: "",
          label: null,
          html: page.section.html,
          // Assembled from the book's own fields, so there is always something
          // on it — `frontSections` drops a page it cannot fill rather than
          // emitting a blank one.
          empty: false,
          heading: false,
          generated: true,
          source: null,
        }
      : {
          id: page.chapter.id,
          title: page.chapter.title,
          label: page.chapter.label,
          html: page.chapter.html,
          empty: page.chapter.html.trim() === "",
          heading: printsHeading(page.chapter),
          generated: false,
          /* Its place in the list the contents was built from — never its bound
             position, which is the rule `BoundPage.index` exists for. This is
             the handle the contents page's folio slots name. */
          source: page.index,
        },
  );
}
