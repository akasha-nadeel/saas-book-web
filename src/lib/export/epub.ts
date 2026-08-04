import type { Book } from "@/lib/library-store";
import { toBlocks, type LoadedChapter } from "./blocks";
import {
  extractImages,
  packageCover,
  type PackagedImage,
} from "./epub-images";
import {
  bookIdentifier,
  DEFAULT_LANGUAGE,
  fileAs,
  type PublishingMeta,
} from "@/lib/publishing";
import {
  DEFAULT_TYPESET,
  typesetCss,
  type TypesetOptions,
} from "./typeset";
import { blocksToXhtml, escapeXml } from "./xhtml";
import { frontSections } from "./front-matter";

/**
 * EPUB 3, built to be accepted by a shop rather than merely opened by a reader.
 *
 * The details that produce most invalid files are handled here explicitly
 * rather than left to the zip library's defaults or to a reader's forgiveness:
 *
 *   1. `mimetype` must be the FIRST entry in the zip and stored UNCOMPRESSED.
 *   2. EPUB 3 requires a nav document declared with properties="nav";
 *      toc.ncx alone is the EPUB 2 shape — but the ncx is written *as well*,
 *      because several shops still run the older ingestion path.
 *   3. `data:` URLs are not permissible resources. The editor stores inline
 *      images as data URLs, so they are lifted into real files first — see
 *      epub-images.ts. This is the one that silently ruins a whole book.
 *   4. The cover is declared twice, under `properties="cover-image"` and the
 *      legacy `<meta name="cover">`, because different shops read different one.
 *   5. Every content document carries `xml:lang` *and* `lang`, and the package
 *      declares accessibility metadata. Since the European Accessibility Act
 *      came into force these are not politeness; a file without them is refused.
 */

export interface EpubChapter {
  title: string;
  xhtml: string;
}

export interface EpubMeta {
  title: string;
  author?: string;
  /** The listing details. Absent means an export for the writer's own reader. */
  publishing?: PublishingMeta;
}

/** What the manifest and spine need to know about the packaged resources. */
export interface EpubResources {
  cover?: PackagedImage | null;
  images?: readonly PackagedImage[];
  /** Whether every packaged image carries alt text — an accessibility claim. */
  allImagesDescribed?: boolean;
}

/** chapter-01, chapter-02 … zero-padded so the spine sorts readably. */
const chapterId = (index: number) =>
  `chapter-${String(index + 1).padStart(2, "0")}`;

/** The id of the generated cover page, when there is a cover to show. */
const COVER_PAGE = "cover";

export function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

/** `<dc:x>` when there is something to put in it, and nothing at all when not. */
function dc(tag: string, value: string | undefined | null): string {
  const text = value?.trim();
  return text ? `\n    <dc:${tag}>${escapeXml(text)}</dc:${tag}>` : "";
}

/**
 * The accessibility metadata every major shop now checks for.
 *
 * Written from what the book actually contains rather than copied in as a
 * boilerplate block: claiming `alternativeText` for a book whose pictures have
 * no alt text is a false accessibility claim, which is worse than an absent one
 * — a reader who needs it has been told it is there.
 */
function accessibility(
  hasImages: boolean,
  allImagesDescribed: boolean,
): string {
  const modes = hasImages ? ["textual", "visual"] : ["textual"];
  // What a reader needs to get the whole book. Undescribed pictures mean sight
  // is genuinely required for part of it, and saying so is the honest answer.
  const sufficient =
    hasImages && !allImagesDescribed ? "textual,visual" : "textual";

  const features = ["structuralNavigation", "tableOfContents", "readingOrder"];
  if (hasImages && allImagesDescribed) features.push("alternativeText");

  /* **"any order of presentation" was wrong, and it was a claim.**

     `schema:accessibilitySummary` is read by shops and by readers deciding
     whether a book is usable, so it is held to the same rule as everything
     else here: it may not say something the book does not do. A novel is
     sequential — its chapters are an order, not a menu — and telling an
     accessibility reader they may start anywhere is a straightforwardly
     unhelpful thing to tell them. What is true and worth saying is that the
     text is all text, that there is a real table of contents, and that the
     chapters can be moved between. */
  const summary = !hasImages
    ? "This publication is entirely textual, with a structured table of contents and sequential chapter navigation."
    : allImagesDescribed
      ? "This publication is textual with described illustrations, and has a structured table of contents and sequential chapter navigation."
      : "This publication is text with illustrations that have no text alternative; those images are not available to a reader who cannot see them.";

  return [
    ...modes.map((m) => `    <meta property="schema:accessMode">${m}</meta>`),
    `    <meta property="schema:accessModeSufficient">${sufficient}</meta>`,
    ...features.map(
      (f) => `    <meta property="schema:accessibilityFeature">${f}</meta>`,
    ),
    `    <meta property="schema:accessibilityHazard">none</meta>`,
    `    <meta property="schema:accessibilitySummary">${escapeXml(summary)}</meta>`,
  ].join("\n");
}

export function contentOpf(
  meta: EpubMeta,
  chapters: EpubChapter[],
  identifier: string,
  /** Generated front-matter ids (title, copyright, contents), which come before
   *  the chapters in the manifest and the spine. */
  frontIds: readonly string[] = [],
  resources: EpubResources = {},
): string {
  const pub = meta.publishing;
  const language = pub?.language?.trim() || DEFAULT_LANGUAGE;
  const cover = resources.cover ?? null;
  const images = resources.images ?? [];

  const frontManifest = frontIds
    .map(
      (id) =>
        `    <item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");
  const frontSpine = frontIds
    .map((id) => `    <itemref idref="${id}" />`)
    .join("\n");

  const manifest = [
    // The cover page leads the book, so it leads the manifest too.
    cover
      ? `    <item id="${COVER_PAGE}" href="${COVER_PAGE}.xhtml" media-type="application/xhtml+xml"/>\n` +
        `    <item id="${cover.id}" href="${cover.href}" media-type="${cover.mediaType}" properties="cover-image"/>`
      : "",
    images
      .map(
        (image) =>
          `    <item id="${image.id}" href="${image.href}" media-type="${image.mediaType}"/>`,
      )
      .join("\n"),
    frontManifest,
    chapters
      .map(
        (_, i) =>
          `    <item id="${chapterId(i)}" href="${chapterId(i)}.xhtml" media-type="application/xhtml+xml"/>`,
      )
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const spine = [
    cover ? `    <itemref idref="${COVER_PAGE}" />` : "",
    frontSpine,
    chapters.map((_, i) => `    <itemref idref="${chapterId(i)}" />`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  // `marc:` and `schema:` are reserved prefixes in EPUB 3 — no declaration
  // needed, and declaring them again is itself a validator warning.
  const creator = meta.author?.trim()
    ? `\n    <dc:creator id="creator">${escapeXml(meta.author.trim())}</dc:creator>` +
      `\n    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>` +
      `\n    <meta refines="#creator" property="file-as">${escapeXml(fileAs(meta.author))}</meta>`
    : "";

  const subjects = (pub?.subjects ?? [])
    .map((s) => dc("subject", s))
    .join("");

  // A series is a collection the book belongs to, not a field on the book —
  // which is why it is three refined metas rather than one.
  const series = pub?.series?.trim()
    ? `\n    <meta property="belongs-to-collection" id="series">${escapeXml(pub.series.trim())}</meta>` +
      `\n    <meta refines="#series" property="collection-type">series</meta>` +
      (typeof pub.seriesIndex === "number" && Number.isFinite(pub.seriesIndex)
        ? `\n    <meta refines="#series" property="group-position">${pub.seriesIndex}</meta>`
        : "")
    : "";

  // The legacy hook. EPUB 3 reads properties="cover-image"; a good deal of
  // shop-side software still reads this instead, and it costs one line.
  const legacyCover = cover
    ? `\n    <meta name="cover" content="${cover.id}"/>`
    : "";

  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(meta.title)}</dc:title>${creator}
    <dc:language>${escapeXml(language)}</dc:language>${dc("publisher", pub?.publisher)}${dc("description", pub?.description)}${dc("date", pub?.published)}${dc("rights", pub?.rights)}${subjects}${series}
    <meta property="dcterms:modified">${modified}</meta>${legacyCover}
${accessibility(images.length > 0, resources.allImagesDescribed ?? true)}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
${manifest}
  </manifest>
  <spine toc="ncx">
${spine}
  </spine>
</package>`;
}

/**
 * The EPUB 2 table of contents.
 *
 * Superseded by nav.xhtml and deprecated in EPUB 3, and written anyway: several
 * shops still run an older ingestion path that reads this and nothing else, and
 * a book whose chapters are unreachable is rejected without much explanation.
 */
export function tocNcx(
  title: string,
  chapters: EpubChapter[],
  identifier: string,
): string {
  const points = chapters
    .map(
      (chapter, i) => `    <navPoint id="${chapterId(i)}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="${chapterId(i)}.xhtml"/>
    </navPoint>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${points}
  </navMap>
</ncx>`;
}

export function navXhtml(
  title: string,
  chapters: EpubChapter[],
  language = DEFAULT_LANGUAGE,
  /** Whether a cover page exists to point the landmarks at. */
  hasCover = false,
): string {
  const items = chapters
    .map(
      (chapter, i) =>
        `        <li><a href="${chapterId(i)}.xhtml">${escapeXml(chapter.title)}</a></li>`,
    )
    .join("\n");

  // Landmarks are how a reading system finds the cover and the start of the
  // text. Apple in particular uses them to decide where "begin reading" lands.
  const coverLandmark = hasCover
    ? `\n        <li><a epub:type="cover" href="${COVER_PAGE}.xhtml">Cover</a></li>`
    : "";
  const first = chapters.length > 0 ? `${chapterId(0)}.xhtml` : "nav.xhtml";

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
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
    <nav epub:type="landmarks" id="landmarks" hidden="hidden">
      <h1>Landmarks</h1>
      <ol>${coverLandmark}
        <li><a epub:type="bodymatter" href="${first}">Start of content</a></li>
      </ol>
    </nav>
  </body>
</html>`;
}

/**
 * The cover page.
 *
 * Its own document rather than a bare image resource, because a shop's preview
 * and most readers open the spine, not the manifest — a cover declared only in
 * the metadata is a thumbnail, not a first page. Sized in viewport units so the
 * artwork fits whatever it is opened on without ever being cropped.
 */
export function coverXhtml(
  title: string,
  href: string,
  language = DEFAULT_LANGUAGE,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
  <head>
    <title>Cover</title>
    <style type="text/css">
      body { margin: 0; padding: 0; text-align: center; }
      img { max-width: 100%; max-height: 100vh; }
    </style>
  </head>
  <body epub:type="cover">
    <img src="${escapeXml(href)}" alt="Cover of ${escapeXml(title)}"/>
  </body>
</html>`;
}

/** A plain XHTML page — used for the generated front matter, which has no
 *  chapter number or heading of its own; its section carries its own markup. */
export function pageXhtml(
  title: string,
  inner: string,
  language = DEFAULT_LANGUAGE,
  /**
   * What this page *is*, in EPUB's own vocabulary — `titlepage`, `copyright-page`,
   * `toc`.
   *
   * **A reading system cannot tell a copyright page from a chapter by looking
   * at it.** `epub:type` is how it knows: it is what lets a reader jump to the
   * table of contents from a menu, what keeps front matter out of the page
   * count on devices that offer one, and what a screen reader announces when
   * it enters the section. Without it every generated page is an anonymous
   * body of text that happens to come first.
   *
   * The `epub` namespace has to be declared on `<html>` for the attribute to
   * be legal, which is why it is added alongside rather than on its own.
   */
  semantics?: string,
): string {
  const typed = semantics ? ` epub:type="${escapeXml(semantics)}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
  <head>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body${typed}>
    ${inner}
  </body>
</html>`;
}

/** EPUB's own word for each generated front page. */
const FRONT_SEMANTICS: Record<string, string> = {
  title: "titlepage",
  copyright: "copyright-page",
  contents: "toc",
};

export function chapterXhtml(
  title: string,
  body: string,
  /** 1-based. Written into the markup and hidden by CSS when not wanted, so one
      file serves both settings and a reader that restyles keeps the number. */
  number?: number,
  language = DEFAULT_LANGUAGE,
): string {
  /* `bodymatter chapter`: the first says this is the book proper rather than
     front or back matter, the second says what kind of division it is. Both
     are standard EPUB structural semantics and both are what a reading system
     looks for when it offers "go to the start of the book". */
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
  <head>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body epub:type="bodymatter chapter">
    ${number ? `<p class="chapter-number">${number}</p>` : ""}
    <h1>${escapeXml(title)}</h1>
${body}
  </body>
</html>`;
}

export interface EpubOptions {
  /**
   * The cover as a data URL. Read by the caller rather than here, because
   * library-store owns storage and this module is meant to stay a pure builder.
   */
  cover?: string | null;
}

export async function buildEpub(
  book: Book,
  chapters: LoadedChapter[],
  typeset: TypesetOptions = DEFAULT_TYPESET,
  options: EpubOptions = {},
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  // FIRST and uncompressed. Both are spec requirements, and JSZip does neither
  // by default.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file("META-INF/container.xml", containerXml());

  // Every chapter's blocks in one pass, so an image repeated across chapters is
  // packaged once — and so the data URLs are gone before any XHTML is rendered.
  const { blocks, images } = extractImages(
    chapters.map((chapter) => toBlocks(chapter.doc)),
  );

  const rendered: EpubChapter[] = chapters.map((chapter, i) => ({
    title: chapter.title,
    xhtml: blocksToXhtml(blocks[i]),
  }));

  const allImagesDescribed = blocks
    .flat()
    .every((block) => block.kind !== "image" || Boolean(block.alt?.trim()));

  const publishing = book.publishing;
  const language = publishing?.language?.trim() || DEFAULT_LANGUAGE;
  const identifier = bookIdentifier(book, publishing);
  const cover = packageCover(options.cover ?? null);

  // Generated title / copyright / contents pages, before the chapters.
  // The contents page links to the chapter files this builder writes.
  const front = frontSections(book, chapters, typeset, (i) => `${chapterId(i)}.xhtml`);

  zip.file("OEBPS/style.css", typesetCss(typeset, false));
  zip.file(
    "OEBPS/content.opf",
    contentOpf(
      { title: book.title, author: book.author, publishing },
      rendered,
      identifier,
      front.map((s) => s.id),
      { cover, images, allImagesDescribed },
    ),
  );
  zip.file(
    "OEBPS/nav.xhtml",
    navXhtml(book.title, rendered, language, Boolean(cover)),
  );
  zip.file("OEBPS/toc.ncx", tocNcx(book.title, rendered, identifier));

  if (cover) {
    zip.file(`OEBPS/${COVER_PAGE}.xhtml`, coverXhtml(book.title, cover.href, language));
    zip.file(`OEBPS/${cover.href}`, cover.bytes);
  }

  for (const image of images) {
    zip.file(`OEBPS/${image.href}`, image.bytes);
  }

  for (const section of front) {
    zip.file(
      `OEBPS/${section.id}.xhtml`,
      pageXhtml(book.title, section.html, language, FRONT_SEMANTICS[section.id]),
    );
  }

  rendered.forEach((chapter, i) => {
    // Body chapters carry their number; front and back matter do not.
    zip.file(
      `OEBPS/${chapterId(i)}.xhtml`,
      chapterXhtml(
        chapter.title,
        chapter.xhtml,
        chapters[i].number ?? undefined,
        language,
      ),
    );
  });

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
  });
}
