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
  printsHeading,
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
import { withoutReplaced } from "./front-matter";
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
  const source = chapters.map((c) => toBlocks(c.doc));
  const { blocks } = extractImages(source);

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
      // Asked of the blocks as the writer has them: after extraction every
      // surviving picture is a package path and the question is already
      // answered.
      brokenImages: undecodableImages(source),
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

  const isCopyright = (title: string, matter: string | undefined) =>
    matter === "front" && title.trim().toLowerCase() === "copyright page";

  const page = chapters.find((c) => isCopyright(c.title, c.matter));
  // No page, or one the export is leaving out anyway — `loadChapters` has
  // already dropped the untouched ones, so anything here is real prose.
  if (!page) return [];

  const text = toBlocks(page.doc)
    .flatMap((b) => b.runs.map((r) => r.text))
    .join(" ");
  if (text.toLowerCase().includes(author.toLowerCase())) return [];

  /* The page's own id, so the finding can carry the way to it.
     `LoadedChapter` has no id — it is what a *renderer* needs — so the meta is
     matched again on the same rule. It is the shelf that holds ids, and this
     is the one place that needs both halves. */
  const meta = book.chapters.find((c) =>
    isCopyright(c.title, chapterMatterOf(c)),
  );

  return [
    {
      level: "advisory",
      field: "copyright-name",
      message: `Your copyright page does not mention ${author}. A shop compares the name on the page with the name on the listing.`,
      ...(meta
        ? {
            link: {
              href: `/book/${book.id}/chapter/${meta.id}`,
              label: "Open the copyright page",
            },
          }
        : {}),
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
    // Apparatus prints no heading, the rule the EPUB has always followed and
    // the other three now do. See `printsHeading`. A title or copyright page
    // sits under the book's own title, which is where it belongs.
    if (printsHeading(chapter)) {
      parts.push(`${single ? "#" : "##"} ${chapter.title}`);
    }
    const body = blocksToMarkdown(toBlocks(chapter.doc));
    if (body) parts.push(body);
  }

  return parts.join("\n\n");
}

/**
 * A file this app produced and handed over.
 *
 * Returned rather than swallowed so the screen can confirm what happened. A
 * download is the one action in the app with no visible result — the browser
 * takes the file to a folder we cannot name and, depending on its settings,
 * says nothing at all. The blob is kept because the commonest failure here is
 * a download that was blocked or missed, and offering it again costs nothing
 * once it is in hand.
 */
export interface ExportResult {
  filename: string;
  blob: Blob;
}

/** Bytes as a person reads them. Binary units, which is what a file manager shows. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  // One decimal up to 10MB and none above it: "1.4 MB" is a size somebody
  // weighs against an upload limit, "23.7 MB" is precision nobody asked for.
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
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

/**
 * An export this app refused, with a reason the writer can act on.
 *
 * Its own class so the screen can tell the two kinds of failure apart. A
 * `TypeError` out of a renderer is ours and means nothing to a writer, so it
 * gets the general apology; this one is a statement about *their book* and is
 * shown word for word. Without the distinction the screen would either print
 * stack-trace prose at somebody or bury a message that says exactly what to do.
 */
export class ExportRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportRefused";
  }
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

/**
 * Answers with the file it handed over, or **null for PDF**.
 *
 * Null is not an omission. Every other format here is a file this app built and
 * gave to the browser, which is a thing that can be confirmed. A PDF is made by
 * the browser's own print engine: what leaves is a print dialog, and whether
 * anything was saved — or the writer pressed Cancel, or chose a real printer —
 * is not knowable from here. Saying "your PDF is ready" over a cancelled print
 * dialog is a claim the code cannot back.
 */
export async function runExport({
  book,
  chapterId,
  format,
  manuscript,
  typeset = DEFAULT_TYPESET,
}: ExportRequest): Promise<ExportResult | null> {
  /* The writer's own pages they have asked us to replace come out here, before
     any renderer sees the book — see `withoutReplaced` for why it is one filter
     rather than a flag threaded through each format. */
  const chapters = withoutReplaced(
    loadChapters(book, chapterId),
    typeset.replaceWritten,
  );

  /*
   * **Nothing to export is refused, not exported.**
   *
   * Two filters stand between the shelf and this list — untouched matter pages
   * come out in `loadChapters`, replaced ones in `withoutReplaced` — and a
   * book can reach zero through either: press Start on front matter, delete
   * the one seeded chapter, and every page left is scaffolding. The formats
   * did not agree about what to do with that and none of them did anything
   * good. The EPUB wrote an empty spine with an empty nav document and an
   * empty `navMap`, which is two hard EPUBCheck errors and a file no shop
   * takes; the Markdown was the book's title and nothing else. All of it
   * downloaded, and the wizard said it had worked.
   *
   * So it stops here, in front of every format at once, with a sentence the
   * export screen shows as it is. The house rule is that a failure is reported
   * rather than shipped — an empty file that claims to be a book is the worst
   * version of a silent one, because the writer finds out from the shop.
   */
  if (chapters.length === 0) {
    throw new ExportRefused(
      "There are no pages in this book to export yet. Write a chapter, or fill in one of the front-matter pages — a page still holding its [example text] is left out.",
    );
  }

  const single = Boolean(chapterId);
  const base = single
    ? `${slugify(book.title)}-${slugify(chapters[0]?.title ?? "chapter")}`
    : slugify(book.title);

  if (format === "markdown") {
    /* **No cover here, and it is not an oversight.** Markdown generates no
       title, copyright or contents page either — it is one text file with no
       sidecar to keep an image in, so a cover could only be an enormous base64
       blob pasted into the prose, which is the same fault that took the format
       off the list in the first place. See TODO.md under "Taken out on
       purpose". */
    const text = buildMarkdownFile(book, chapters, { single });
    return handed(new Blob([text], { type: "text/markdown" }), `${base}.md`);
  }

  /* **The artwork, resolved once for whichever renderer wants it.**
​
     This sat inside the EPUB branch until the cover became a page in every
     format, and it is read here rather than inside a builder because covers
     live at their own storage key and the builders are meant to touch no
     storage at all.

     **The full-size artwork first, and the thumbnail only as a fallback.** The
     copy in localStorage is 700px because that is what a shelf needs; packaging
     it shipped a 495×700 picture out of artwork the writer had supplied at
     1600×2560, which is below what every shop asks for — and below what this
     app's own cover check had just told them was required. See cover-store.ts.
     A browser that cannot hold the original still exports, with the smaller
     copy, exactly as it did before.

     Fetched even when `typeset.cover` is off, because the read is cheap against
     a book that has no cover at all and each renderer applies the switch
     itself — one rule, three readers, rather than a condition duplicated here
     and there. */
  const print = await getPrintCover(book.id);
  const cover = print?.dataUrl ?? getCover(book.id);

  if (format === "docx") {
    // Dynamic import: ~1MB of library that a writer who never exports should
    // never download.
    const { buildDocx } = await import("./docx");
    return handed(
      await buildDocx(book, chapters, { manuscript, typeset, cover }),
      `${base}.docx`,
    );
  }

  if (format === "pdf") {
    const { printBook } = await import("./print");
    /* Awaited, unlike before: pagination now happens in here, and a long book
       takes a few seconds of it. Without the await the caller would clear its
       "working" state while Paged.js was still laying out pages, and the print
       dialog would arrive after the screen had said it was finished. */
    const pdf = await printBook(book, chapters, typeset, cover);
    /* **A blob means a file; null means a dialog.** The PDF is rendered by a
       browser on the server now, so most of the time there is a real file to
       hand over and name — and the writer gets the same confirmation every
       other format gives. An installation with no browser behind the route
       falls back to the print dialog, and on that path the outcome genuinely is
       not knowable from here, so nothing is claimed. See `printBook`. */
    return pdf ? handed(pdf, `${base}.pdf`) : null;
  }

  const { buildEpub } = await import("./epub");
  return handed(
    await buildEpub(book, chapters, typeset, { cover }),
    `${base}.epub`,
  );
}

/** Downloads it and says what it was, so the two cannot describe different files. */
function handed(blob: Blob, filename: string): ExportResult {
  download(blob, filename);
  return { blob, filename };
}
