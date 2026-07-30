import type { JSONContent } from "@tiptap/react";
import {
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
import { toBlocks, type LoadedChapter } from "./blocks";
import {
  extractImages,
  packageCover,
  undecodableImages,
} from "./epub-images";
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

  return wanted.map((chapter) => {
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
    return { title: chapter.title, doc, number: chapterNumberOf(book, chapter.id) };
  });
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

  return storeReadiness({
    book,
    meta: book.publishing,
    hasCover: Boolean(packageCover(cover)),
    chapterCount: written,
    brokenImages: undecodableImages(blocks),
    undescribedImages,
  });
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
  // Read here rather than inside the builder: covers live at their own storage
  // key, and epub.ts is meant to stay a builder that touches no storage.
  download(
    await buildEpub(book, chapters, typeset, { cover: getCover(book.id) }),
    `${base}.epub`,
  );
}
