import type { JSONContent } from "@tiptap/react";
import { getBody, type Book } from "@/lib/library-store";
import { toBlocks, type LoadedChapter } from "./blocks";
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
  const wanted = chapterId
    ? book.chapters.filter((c) => c.id === chapterId)
    : book.chapters;

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
    return { title: chapter.title, doc };
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
  download(await buildEpub(book, chapters, typeset), `${base}.epub`);
}
