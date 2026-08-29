import type { JSONContent } from "@tiptap/react";

import { proseFrom } from "@/lib/comps/rank";
import type { BookText } from "@/lib/consistency";
import { toBlocks } from "@/lib/export/blocks";
import {
  chapterMatterOf,
  chapterNumberOf,
  getBody,
  orderedChapters,
  type Book,
  type ChapterMeta,
} from "@/lib/library-store";

/**
 * A whole book's prose, read once, for the checks that need all of it.
 *
 * Its own module because two screens ask for it — the consistency tool's full
 * page and the editor's panel — and a second copy of these four decisions is a
 * second answer to the question "what counts as the book". Same reasoning as
 * `boundReaderPages` calling the export's own functions rather than restating
 * the binding order.
 *
 * Four choices, each of which was the wrong way round first:
 *
 * **Not `loadChapters()`.** It reads the whole book and would nearly fit, but
 * `LoadedChapter` carries no chapter id — and the id is what every location in
 * every finding is keyed on, and what each chapter link is built from. Pairing
 * ids back on by position, against a list `loadChapters` has already filtered,
 * is the kind of thing that goes quietly wrong a release later.
 *
 * **`proseFrom`, not `chapterText`.** `chapterText` collapses all whitespace,
 * which is right for a search index and would blind any check that is about a
 * paragraph.
 *
 * **Body chapters only.** Front and back matter are templates carrying the
 * writer's legal name, a copyright line and whatever quotation marks the
 * scaffolding was written with. Reading them turns "your name is spelled two
 * ways" into a finding that never goes away, on every book that has a title
 * page. The cost is drift inside a page filed as back matter, and that is the
 * cheaper of the two mistakes.
 *
 * **Pictures and code blocks are dropped.** A `data:` URL is a megabyte of
 * base64 that spells nothing, and a code block's quotation marks are not the
 * book's.
 *
 * Reads through `library-store`, so the rule that one module owns storage
 * survives this too. **Call it only once storage has settled** — `getBody`
 * answers `null` for every chapter until `loadFromDisk()` resolves, so an
 * ungated call reports on a book of empty chapters.
 */
export function bookTextOf(book: Book): BookText[] {
  return readable(book).map((chapter) => {
    const raw = getBody(chapter.id);
    let doc: JSONContent = EMPTY_DOC;
    if (raw) {
      try {
        doc = JSON.parse(raw) as JSONContent;
      } catch {
        // A corrupt body reads as an empty chapter, exactly as the export does.
      }
    }
    const blocks = toBlocks(doc).filter(
      (block) => block.kind !== "image" && block.kind !== "code",
    );
    return {
      chapterId: chapter.id,
      title: chapter.title,
      number: chapterNumberOf(book, chapter.id),
      text: proseFrom(blocks),
    };
  }).filter((chapter) => chapter.text.trim() !== "");
}

/**
 * The chapters a whole-book read would look at.
 *
 * Exported so a screen can say how many it is about to read *before* it reads
 * them — a button that names the work is the difference between a slow answer
 * and a broken-looking one.
 */
export function readable(book: Book): readonly ChapterMeta[] {
  return orderedChapters(book).filter(
    (chapter) => chapterMatterOf(chapter) === "body" && chapter.words > 0,
  );
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [] };
