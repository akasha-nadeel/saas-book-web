import type { Book } from "@/lib/library-store";
import { chapterNumeral, toBlocks, type LoadedChapter } from "./blocks";
import {
  extractImages,
  packageCover,
  packageable,
  type PackagedImage,
} from "./epub-images";
import { recodeBlocks, recodeDataUrl } from "./image-recode";
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
import { bindBook, frontSections } from "./front-matter";
import { isApparatusPage } from "@/lib/matter";

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
  /** Which part of the book it belongs to. Absent means the body. */
  matter?: "front" | "body" | "back";
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

/**
 * The reading order of the whole book, as ids.
 *
 * The arithmetic is `bindBook`'s — see the long note there for why the
 * generated pages sit *among* the writer's own rather than in front of them,
 * and why that answer had to stop living in this file. This is the thin part:
 * turning the bound order into the ids the manifest and spine use, which are
 * positional and must never be renumbered by a reordering.
 */
export function spineOrder(
  chapters: readonly EpubChapter[],
  frontIds: readonly string[],
): string[] {
  /* `bindBook` asks for a title and a `matter` and nothing else — which is all
     `EpubChapter` and `LoadedChapter` have in common, and is now what its
     parameter says (`MatterPage`). It took a `LoadedChapter[]` and this had to
     write `as unknown as` past it; the cast is gone because the signature stopped
     claiming more than the function reads. */
  const bound = bindBook(
    chapters,
    frontIds.map((id) => ({ id, html: "" })),
  );
  return bound.map((page) =>
    page.kind === "generated" ? page.section.id : chapterId(page.index),
  );
}

export function contentOpf(
  meta: EpubMeta,
  chapters: EpubChapter[],
  identifier: string,
  /** Generated front-matter ids (title, copyright, contents). Placed in the
   *  spine by `spineOrder`, which binds them among the writer's own pages. */
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
    spineOrder(chapters, frontIds)
      .map((id) => `    <itemref idref="${id}" />`)
      .join("\n"),
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
/**
 * The pages a contents list should carry, with the index each one keeps.
 *
 * **Apparatus is left out.** A reader's contents menu offering "Half-title
 * page / Copyright page" before Chapter One is not what a published book does,
 * and a printed contents page listing itself is a small absurdity — the shops'
 * own ingestion guidance says the same. What stays is every division a reader
 * would actually navigate to: a dedication, an epigraph, a prologue, the
 * chapters, an epilogue, the acknowledgements.
 *
 * The index travels with each entry because the *file* names are positional
 * (`chapter-03.xhtml` is the fourth loaded chapter, listed or not), so a
 * filtered list must not be renumbered.
 */
export function listedChapters(
  chapters: readonly EpubChapter[],
): { chapter: EpubChapter; index: number }[] {
  const all = chapters.map((chapter, index) => ({ chapter, index }));
  const listed = all.filter(
    ({ chapter }) => !isApparatusPage(chapter.matter ?? "body", chapter.title),
  );

  /*
   * **A filter that removes everything has to give it back, and this one could.**
   *
   * Both places this feeds require at least one entry — a nav document's `<ol>`
   * must hold an `<li>` and an ncx `<navMap>` must hold a `navPoint` — so a
   * book whose every page is apparatus produced an empty one of each and two
   * hard EPUBCheck errors:
   *
   *     ERROR(RSC-005) element "ol" incomplete; missing required element "li"
   *     ERROR(RSC-005) element "navMap" incomplete; missing required "navPoint"
   *
   * It is reachable without doing anything strange: press Start on front
   * matter, fill in the half-title, and export before the first chapter is
   * written. The export reported success and produced a file no shop takes.
   *
   * Listing the apparatus is the lesser wrong. A contents menu offering
   * "Half-title page" is untidy; a book with no navigation at all is invalid,
   * and a reader who cannot reach any page of it is worse served than one who
   * is offered a page nobody usually lists. Nothing changes for an ordinary
   * book, where the filter keeps something.
   */
  return listed.length > 0 ? listed : all;
}

export function tocNcx(
  title: string,
  chapters: EpubChapter[],
  identifier: string,
): string {
  const points = listedChapters(chapters)
    .map(
      ({ chapter, index }, n) => `    <navPoint id="${chapterId(index)}" playOrder="${n + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="${chapterId(index)}.xhtml"/>
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
  const items = listedChapters(chapters)
    .map(
      ({ chapter, index }) =>
        `        <li><a href="${chapterId(index)}.xhtml">${escapeXml(chapter.title)}</a></li>`,
    )
    .join("\n");

  // Landmarks are how a reading system finds the cover and the start of the
  // text. Apple in particular uses them to decide where "begin reading" lands.
  const coverLandmark = hasCover
    ? `\n        <li><a epub:type="cover" href="${COVER_PAGE}.xhtml">Cover</a></li>`
    : "";

  /*
   * **"Start of content" is the first *body* chapter, not the first file.**
   *
   * This pointed at `chapter-01.xhtml` whatever that turned out to be. Front
   * matter used to be a single page a writer rarely made, so it was usually
   * right; now that a book can carry a half-title, a dedication and an epigraph
   * as pages of their own, it was reliably wrong — and this is the landmark
   * Apple Books uses to decide where "begin reading" lands, so a reader opening
   * the book was put on the dedication with the novel behind them.
   *
   * Falls back to the first file when a book is nothing but front matter, and
   * to the nav when there are no files at all. Both are somewhere real, which
   * is all a landmark has to be.
   */
  const bodyAt = chapters.findIndex((c) => (c.matter ?? "body") === "body");
  const first =
    chapters.length === 0
      ? "nav.xhtml"
      : `${chapterId(bodyAt === -1 ? 0 : bodyAt)}.xhtml`;

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

/**
 * EPUB's own words for each generated front page: the part, then the division.
 *
 * **The part was missing**, and these three pages were the only ones in the
 * book without it — `chapterSemantics` has always written `frontmatter
 * dedication` for a page the writer made. A bare `titlepage` is still legal,
 * but it says what the page *is* without saying where it sits, and a reading
 * system that only understands the part learns nothing at all. It showed on
 * the round trip: importing a book this app had just written put its own
 * generated title page and contents into the *body*, because the importer
 * reads the part and there was none to read.
 */
const FRONT_SEMANTICS: Record<string, string> = {
  title: "frontmatter titlepage",
  copyright: "frontmatter copyright-page",
  contents: "frontmatter toc",
};

/**
 * The EPUB structural semantics for a page the *writer* wrote, by its title.
 *
 * The generated front matter above is ours and its type is known. These are
 * the writer's own front- and back-matter pages, and every one of them used to
 * be labelled `bodymatter chapter` — so a dedication, an epigraph and an
 * acknowledgements page each announced themselves to a reading system as a
 * chapter of the novel. What that costs is real rather than pedantic: "go to
 * the beginning of the book" lands on the dedication, and a shop's automated
 * check reads a book that opens on one.
 *
 * Matched on the title because that is what the writer chose, and the standard
 * pages are offered by name (see `src/lib/matter.ts`) so the common ones match
 * without anyone being asked. A page named something else falls back to the
 * part's own type alone — `frontmatter` with no second word is correct and
 * complete; guessing at the division would be neither.
 *
 * Every value here is from the EPUB 3 Structural Semantics Vocabulary. A word
 * that is not in it is worse than none: EPUBCheck reports it, and a reading
 * system that does not recognise it treats the page as untyped anyway.
 */
const MATTER_SEMANTICS: Record<string, string> = {
  "half-title page": "halftitlepage",
  "title page": "titlepage",
  "copyright page": "copyright-page",
  dedication: "dedication",
  epigraph: "epigraph",
  "table of contents": "toc",
  "preface or introduction": "preface",
  preface: "preface",
  introduction: "introduction",
  foreword: "foreword",
  prologue: "prologue",
  epilogue: "epilogue",
  afterword: "afterword",
  acknowledgements: "acknowledgments",
  acknowledgments: "acknowledgments",
  glossary: "glossary",
  appendix: "appendix",
  bibliography: "bibliography",
  index: "index",
  colophon: "colophon",
};

/** What a page announces itself as: its part, then its division when known. */
export function chapterSemantics(
  matter: "front" | "body" | "back",
  title: string,
): string {
  /* `bodymatter chapter`: the first says this is the book proper rather than
     front or back matter, the second says what kind of division it is. Both
     are standard EPUB structural semantics and both are what a reading system
     looks for when it offers "go to the start of the book". */
  if (matter === "body") return "bodymatter chapter";
  const part = matter === "front" ? "frontmatter" : "backmatter";
  const division = MATTER_SEMANTICS[title.trim().toLowerCase()];
  return division ? `${part} ${division}` : part;
}

export function chapterXhtml(
  title: string,
  body: string,
  /** 1-based. Written into the markup and hidden by CSS when not wanted, so one
      file serves both settings and a reader that restyles keeps the number. */
  number?: number,
  language = DEFAULT_LANGUAGE,
  /** Which part of the book this page belongs to. Body unless said otherwise,
   *  which keeps every existing caller and every test on the old behaviour. */
  matter: "front" | "body" | "back" = "body",
): string {
  /* The numeral is dropped when the heading already is the number — see
     `chapterNumeral`, which is where that rule lives now so that the PDF, the
     Word file and the wizard's own preview answer it the same way. */
  const numeral = chapterNumeral({ title, number: number ?? null });

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
  <head>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body epub:type="${chapterSemantics(matter, title)}">
    ${numeral ? `<p class="chapter-number">${numeral}</p>` : ""}${
      /* **Apparatus prints no heading.** These pages are named in the app so a
         writer can find them in a list; putting that name on the page itself
         gives a finished book a sheet headed "Copyright page", which no
         published book has. A dedication or a prologue is a real division and
         keeps its heading. */
      isApparatusPage(matter, title) ? "" : `
    <h1>${escapeXml(title)}</h1>`
    }
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

  /*
   * **A picture the package cannot legally carry is left out of the file.**
   *
   * Left in, it is not a missing picture, it is a rejected book — measured,
   * three hard EPUBCheck errors from one chapter, for a remote `src` and for a
   * media type EPUB has no core support for. None of them is fixable by
   * declaring something. So the choice is a valid book short of a picture or
   * an invalid book nobody can sell, and it is not close.
   *
   * Dropped **and named**: `undecodableImages` counts exactly these and
   * `storeReadiness` reports them in the pre-upload check, so the writer is
   * told before the upload rather than by the shop. A filter nobody can see is
   * worse than the problem it solves. The wizard's preview drops them too,
   * through the same `packageable`.
   *
   * Filtered before extraction rather than after, so `extractImages` only ever
   * meets pictures it can package and no surviving `<img>` can point at a file
   * nothing wrote.
   */
  /* **Converted before it is judged**, or the filter below throws away the
     pictures this is meant to save. The editor stores an inline illustration as
     WebP, which EPUB does not name as a core media type, so every one of them
     used to be packaged as a foreign resource with no fallback and drawn by
     nothing. `recodeBlocks` re-encodes them to PNG or JPEG; one it cannot
     convert stays as it was and is dropped by `packageable` on the next line,
     which is the behaviour that was always intended for a picture the package
     cannot carry. See image-recode.ts. */
  const recoded = await recodeBlocks(chapters.map((c) => toBlocks(c.doc)));

  const written = recoded.map((blocks) =>
    blocks.filter((block) => block.kind !== "image" || packageable(block)),
  );

  // Every chapter's blocks in one pass, so an image repeated across chapters is
  // packaged once — and so the data URLs are gone before any XHTML is rendered.
  const { blocks, images } = extractImages(written);

  const rendered: EpubChapter[] = chapters.map((chapter, i) => ({
    title: chapter.title,
    xhtml: blocksToXhtml(blocks[i]),
    ...(chapter.matter ? { matter: chapter.matter } : {}),
  }));

  /* Asked of what actually went in the file. A picture that was dropped is not
     an undescribed picture — it is not there at all — and claiming
     `alternativeText` on the strength of the ones that survived would be the
     false accessibility claim `accessibility()` exists to avoid. */
  const allImagesDescribed = blocks
    .flat()
    .every((block) => block.kind !== "image" || Boolean(block.alt?.trim()));

  const publishing = book.publishing;
  const language = publishing?.language?.trim() || DEFAULT_LANGUAGE;
  const identifier = bookIdentifier(book, publishing);
  /* Through the recoder as well. `cover-save.ts` writes JPEG, so today this
     changes nothing — but a book covered before that rule existed still holds a
     WebP, and the cover is the one picture a shop's converter meets first. */
  const cover = packageCover(
    options.cover ? await recodeDataUrl(options.cover) : null,
  );

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
    // Body chapters carry their number; front and back matter do not — they
    // carry their part instead, so a dedication is not announced as a chapter.
    zip.file(
      `OEBPS/${chapterId(i)}.xhtml`,
      chapterXhtml(
        chapter.title,
        chapter.xhtml,
        chapters[i].number ?? undefined,
        language,
        chapter.matter ?? "body",
      ),
    );
  });

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
  });
}
