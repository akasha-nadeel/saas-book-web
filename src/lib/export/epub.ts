import type { Book } from "@/lib/library-store";
import { toBlocks, type LoadedChapter } from "./blocks";
import { blocksToXhtml, escapeXml } from "./xhtml";

/**
 * EPUB 3. Two details produce most invalid files, and both are handled here
 * explicitly rather than left to the zip library's defaults:
 *
 *   1. `mimetype` must be the FIRST entry in the zip and stored UNCOMPRESSED.
 *   2. EPUB 3 requires a nav document declared with properties="nav";
 *      toc.ncx alone is the EPUB 2 shape.
 */

export interface EpubChapter {
  title: string;
  xhtml: string;
}

export interface EpubMeta {
  title: string;
  author?: string;
}

/** chapter-01, chapter-02 … zero-padded so the spine sorts readably. */
const chapterId = (index: number) =>
  `chapter-${String(index + 1).padStart(2, "0")}`;

export function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

export function contentOpf(
  meta: EpubMeta,
  chapters: EpubChapter[],
  identifier: string,
): string {
  const manifest = chapters
    .map(
      (_, i) =>
        `    <item id="${chapterId(i)}" href="${chapterId(i)}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");

  const spine = chapters
    .map((_, i) => `    <itemref idref="${chapterId(i)}" />`)
    .join("\n");

  const creator = meta.author
    ? `\n    <dc:creator>${escapeXml(meta.author)}</dc:creator>`
    : "";

  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(meta.title)}</dc:title>${creator}
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
${manifest}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;
}

export function navXhtml(title: string, chapters: EpubChapter[]): string {
  const items = chapters
    .map(
      (chapter, i) =>
        `        <li><a href="${chapterId(i)}.xhtml">${escapeXml(chapter.title)}</a></li>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>${escapeXml(title)}</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>
${items}
      </ol>
    </nav>
  </body>
</html>`;
}

export function chapterXhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    <h1>${escapeXml(title)}</h1>
${body}
  </body>
</html>`;
}

/** Matches the editor: indented paragraphs, no indent opening a scene. */
const STYLESHEET = `body { margin: 1em; }
h1 { text-align: center; margin: 2em 0 1em; font-weight: normal; }
p { margin: 0; text-indent: 1.5em; }
h1 + p, blockquote + p, .scene-break + p { text-indent: 0; }
.scene-break { text-align: center; text-indent: 0; margin: 1.5em 0; }
blockquote { margin: 1.5em; font-style: italic; }`;

export async function buildEpub(
  book: Book,
  chapters: LoadedChapter[],
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  // FIRST and uncompressed. Both are spec requirements, and JSZip does neither
  // by default.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file("META-INF/container.xml", containerXml());

  const rendered: EpubChapter[] = chapters.map((chapter) => ({
    title: chapter.title,
    xhtml: blocksToXhtml(toBlocks(chapter.doc)),
  }));

  const identifier = `urn:uuid:${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Date.now().toString(36)
  }`;

  zip.file("OEBPS/style.css", STYLESHEET);
  zip.file(
    "OEBPS/content.opf",
    contentOpf({ title: book.title, author: book.author }, rendered, identifier),
  );
  zip.file("OEBPS/nav.xhtml", navXhtml(book.title, rendered));

  rendered.forEach((chapter, i) => {
    zip.file(
      `OEBPS/${chapterId(i)}.xhtml`,
      chapterXhtml(chapter.title, chapter.xhtml),
    );
  });

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
  });
}
