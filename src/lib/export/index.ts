import type { JSONContent } from "@tiptap/react";
import {
  chapterMatterOf,
  chapterNumberOf,
  getBody,
  getCover,
  orderedChapters,
  type Book,
} from "@/lib/library-store";
import {
  storeReadiness,
  type ReadinessIssue,
} from "@/lib/publishing";
import {
  isDraftMatter,
  isUntouchedMatter,
  toBlocks,
  type LoadedChapter,
} from "./blocks";
import {
  extractImages,
  packageCover,
  undecodableImages,
} from "./epub-images";
import { getPrintCover } from "@/lib/cover-store";
import { blocksToMarkdown } from "./markdown";
import { DEFAULT_TYPESET, type TypesetOptions } from "./typeset";

export type Format = "markdown" | "docx" | "epub" | "pdf";

export type { LoadedChapter };

const EMPTY_DOC: JSONContent = { type: "doc", content: [] };

/**
 * Reads through library-store rather than localStorage directly, so the rule
 * that one module owns storage survives this feature.
 */
export function loadChapters(book: Book, chapterId?: string): LoadedChapter[] {
  // The whole book comes out in reading order — front matter, body, back matter
  // — so an exported title page or epilogue lands where it belongs. A single
  // chapter export is just that chapter.
  const wanted = chapterId
    ? book.chapters.filter((c) => c.id === chapterId)
    : orderedChapters(book);

  const loaded = wanted.map((chapter) => {
    const raw = getBody(chapter.id);
    let doc = EMPTY_DOC;
    if (raw) {
      try {
        doc = JSON.parse(raw) as JSONContent;
      } catch {
        // A corrupt body exports as an empty chapter. Losing one chapter's
        // text beats failing the whole export.
        doc = EMPTY_DOC;
      }
    }
    return {
      title: chapter.title,
      doc,
      number: chapterNumberOf(book, chapter.id),
      matter: chapterMatterOf(chapter),
    };
  });

  /*
   * **A front- or back-matter page nobody has filled in does not go in the
   * book.**
   *
   * Pressing Start on Front matter makes the eight standard pages, each seeded
   * with the shape of the thing and the writer's own details left as
   * `[placeholders]`. Left alone, those pages shipped: a reader opening the
   * finished EPUB met bare publishing terms, in the contents, between the cover
   * and Chapter One. It reads as a template somebody forgot to delete, and it
   * is. See `isUntouchedMatter` for what counts.
   *
   * Skipped only when the writer asked for the whole book. A single-chapter
   * export is a deliberate request for *that* page, and answering it with an
   * empty file would be worse than answering it with scaffolding.
   *
   * Body chapters are never dropped, however empty: a chapter with no prose is
   * a hole in the book, and hiding it from the export hides it from the writer.
   */
  return chapterId
    ? loaded
    : loaded.filter(
        (c) => c.matter === "body" || !isUntouchedMatter(toBlocks(c.doc)),
      );
}

/**
 * The matter pages an export of this book would leave out, by title.
 *
 * **The visible half of the filter above.** Dropping a page silently is the
 * same class of mistake as shipping one: either way the file does not match
 * the book the writer is looking at, and only one of the two is discoverable.
 * So the export screen lists these before the button, in the writer's own page
 * titles, with what to do about it.
 *
 * Reads the bodies, so it is called once by the screen rather than on a render.
 *
 * Walks the chapters itself rather than diffing `loadChapters` against them:
 * two pages can share a title — nothing stops a writer naming both "Note" —
 * and a diff by title would report the wrong one, or neither.
 */
export function skippedMatterPages(book: Book): string[] {
  const out: string[] = [];
  for (const chapter of orderedChapters(book)) {
    if (chapterMatterOf(chapter) === "body") continue;
    if (isDraftMatter(chapter.id)) out.push(chapter.title);
  }
  return out;
}

/**
 * Everything standing between this book and a shop.
 *
 * Lives here rather than in publishing.ts because answering it means reading the
 * manuscript — how many chapters have prose in them, how many pictures will
 * survive packaging, how many carry a description — and publishing.ts is meant
 * to stay a pure module that knows nothing about storage. It walks the whole
 * book, so call it for the EPUB screen and not on every render.
 */
export function checkStoreReadiness(
  book: Book,
  cover: string | null,
): ReadinessIssue[] {
  const chapters = loadChapters(book);
  const { blocks } = extractImages(chapters.map((c) => toBlocks(c.doc)));

  const undescribedImages = blocks
    .flat()
    .filter((b) => b.kind === "image" && !b.alt?.trim()).length;

  // A chapter that is only a title is not yet a chapter to publish.
  const written = blocks.filter((chapterBlocks) =>
    chapterBlocks.some(
      (b) => b.kind === "image" || b.runs.some((r) => r.text.trim()),
    ),
  ).length;

  return [
    ...storeReadiness({
      book,
      meta: book.publishing,
      hasCover: Boolean(packageCover(cover)),
      chapterCount: written,
      brokenImages: undecodableImages(blocks),
      undescribedImages,
    }),
    ...copyrightNames(book, chapters),
  ];
}

/**
 * A hand-written copyright page that never names the author.
 *
 * Front matter is the writer's own now, so a book can carry a copyright page
 * that contradicts its own fields — and *does*, most often because the page was
 * written under a different name, or because the writer changed the author
 * afterwards and never went back. A copyright notice naming the wrong party is
 * worse than one that is missing, which is why the generated page refuses to
 * print without an author at all (`frontSections`). This is the same rule
 * pointed at the page we did not write.
 *
 * **Deliberately the narrowest check that could work**, per the house rule
 * that a wrong pass is quieter than a wrong alarm — nobody goes looking for a
 * problem they have been told they do not have, but a false alarm here sends a
 * writer hunting through a page that is fine. So: exact substring, no
 * normalising beyond case, and only for a page titled "Copyright page", which
 * is the title this app's own template gives it. A writer who renamed the page
 * or wrote the name differently gets nothing, which is the right way to be
 * wrong.
 *
 * Advisory, never blocking: shops do not require a copyright page at all, and
 * this is about the book agreeing with itself.
 */
function copyrightNames(
  book: Book,
  chapters: readonly LoadedChapter[],
): ReadinessIssue[] {
  const author = book.author?.trim();
  if (!author) return [];

  const page = chapters.find(
    (c) =>
      c.matter === "front" && c.title.trim().toLowerCase() === "copyright page",
  );
  // No page, or one the export is leaving out anyway — `loadChapters` has
  // already dropped the untouched ones, so anything here is real prose.
  if (!page) return [];

  const text = toBlocks(page.doc)
    .flatMap((b) => b.runs.map((r) => r.text))
    .join(" ");
  if (text.toLowerCase().includes(author.toLowerCase())) return [];

  return [
    {
      level: "advisory",
      field: "copyright-name",
      message: `Your copyright page does not mention ${author}. A shop compares the name on the page with the name on the listing.`,
    },
  ];
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

export function buildMarkdownFile(
  book: Book,
  chapters: LoadedChapter[],
  { single = false }: { single?: boolean } = {},
): string {
  const parts: string[] = [];

  // A single chapter is its own document; a book needs its title on top.
  if (!single) parts.push(`# ${book.title}`);

  for (const chapter of chapters) {
    parts.push(`${single ? "#" : "##"} ${chapter.title}`);
    const body = blocksToMarkdown(toBlocks(chapter.doc));
    if (body) parts.push(body);
  }

  return parts.join("\n\n");
}

/** Hands a generated file to the browser. */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoking immediately can cancel the download in some browsers; a tick is
  // enough for the click to have been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface ExportRequest {
  book: Book;
  /** Omitted means the whole book. */
  chapterId?: string;
  format: Format;
  /** DOCX only. Standard manuscript layout rather than a clean document. */
  manuscript: boolean;
  /** EPUB and PDF only — the two outputs whose look is ours to decide. */
  typeset?: TypesetOptions;
}

export async function runExport({
  book,
  chapterId,
  format,
  manuscript,
  typeset = DEFAULT_TYPESET,
}: ExportRequest): Promise<void> {
  const chapters = loadChapters(book, chapterId);
  const single = Boolean(chapterId);
  const base = single
    ? `${slugify(book.title)}-${slugify(chapters[0]?.title ?? "chapter")}`
    : slugify(book.title);

  if (format === "markdown") {
    const text = buildMarkdownFile(book, chapters, { single });
    download(new Blob([text], { type: "text/markdown" }), `${base}.md`);
    return;
  }

  if (format === "docx") {
    // Dynamic import: ~1MB of library that a writer who never exports should
    // never download.
    const { buildDocx } = await import("./docx");
    download(await buildDocx(book, chapters, { manuscript }), `${base}.docx`);
    return;
  }

  if (format === "pdf") {
    const { printBook } = await import("./print");
    printBook(book, chapters, typeset);
    return;
  }

  const { buildEpub } = await import("./epub");
  /* Read here rather than inside the builder: covers live at their own storage
     key, and epub.ts is meant to stay a builder that touches no storage.

     **The full-size artwork first, and the thumbnail only as a fallback.** The
     copy in localStorage is 700px because that is what a shelf needs; packaging
     it shipped a 495×700 picture out of artwork the writer had supplied at
     1600×2560, which is below what every shop asks for — and below what this
     app's own cover check had just told them was required. See cover-store.ts.
     A browser that cannot hold the original still exports, with the smaller
     copy, exactly as it did before. */
  const print = await getPrintCover(book.id);
  download(
    await buildEpub(book, chapters, typeset, {
      cover: print?.dataUrl ?? getCover(book.id),
    }),
    `${base}.epub`,
  );
}
