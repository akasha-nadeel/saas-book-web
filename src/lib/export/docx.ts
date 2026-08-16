import type { Book } from "@/lib/library-store";
// Type-only, so it is erased at compile time and does not pull the library into
// the bundle — the runtime import below stays dynamic.
import type {
  Paragraph as DocxParagraph,
  ParagraphChild as DocxRun,
} from "docx";
import {
  chapterNumeral,
  printsHeading,
  toBlocks,
  type Block,
  type LoadedChapter,
  type Run,
} from "./blocks";
import { fitImage, resolveImages } from "./docx-images";
import {
  bindBook,
  copyrightLines,
  writtenPages,
  type FrontSection,
} from "./front-matter";
import { stripInvalidXml } from "./xhtml";
import { DEFAULT_TYPESET, type TypesetOptions } from "./typeset";

/**
 * DOCX in standard manuscript format — the Shunn conventions an agent or editor
 * expects: Times New Roman 12pt, double-spaced, 1" margins, 0.5" first-line
 * indent with no space between paragraphs, each chapter starting on a new page,
 * and a running header of Surname / Title / page.
 *
 * The `manuscript: false` path produces the same text without the furniture,
 * for sending a draft to a friend rather than to a submission pile.
 *
 * There is no unit test here on purpose: a docx Paragraph exposes nothing
 * meaningful to assert against, so a test would be checking library internals.
 * The logic worth testing — toBlocks — is covered upstream, and this file is
 * verified by the typechecker and by opening the file.
 */

const FONT = "Times New Roman";
const SIZE_HALF_POINTS = 24; // docx measures font size in half-points: 24 = 12pt
const DOUBLE_SPACED = 480; // twips; 240 is single

/** Last word of the author's name, per manuscript convention. */
function surname(author: string | undefined): string {
  const parts = (author ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

export async function buildDocx(
  book: Book,
  chapters: LoadedChapter[],
  {
    manuscript,
    typeset = DEFAULT_TYPESET,
  }: { manuscript: boolean; typeset?: TypesetOptions },
): Promise<Blob> {
  const {
    AlignmentType,
    Document,
    ExternalHyperlink,
    Header,
    HeadingLevel,
    HorizontalPositionAlign,
    HorizontalPositionRelativeFrom,
    ImageRun,
    LevelFormat,
    Packer,
    PageBreak,
    PageNumber,
    Paragraph,
    TextRun,
    TextWrappingSide,
    TextWrappingType,
    VerticalPositionRelativeFrom,
    convertInchesToTwip,
  } = await import("docx");

  /* Every picture in the book, decoded once, before a paragraph is built.
     `docx` takes bytes rather than a URL, and decoding is asynchronous while
     the paragraph walk is not — so it happens here, up front, and the walk
     below only ever does a lookup. */
  const pictures = await resolveImages(
    chapters.flatMap((chapter) =>
      toBlocks(chapter.doc)
        .filter((block) => block.kind === "image" && block.src)
        .map((block) => block.src as string),
    ),
  );

  /**
   * A run of prose, with everything the writer marked on it.
   *
   * **A link keeps its destination**, which it did not: the mark was dropped
   * on the way in, so the words survived and the URL did not — a manuscript
   * full of live references arrived at the editor as plain text, and nothing
   * on screen said so. The EPUB and the Markdown had always carried it. Word's
   * own shape for one is a hyperlink wrapping its runs rather than a property
   * on a run, which is why this branches instead of adding a field.
   *
   * Inline code takes a monospace face for the same reason — it is a mark the
   * writer applied, and a formatting mark that survives in three formats and
   * vanishes in the fourth is the drift this pass exists to end.
   */
  const runsFor = (runs: Run[]): DocxRun[] =>
    runs.map((run) => {
      const text = new TextRun({
        text: run.hardBreak ? "" : run.text,
        break: run.hardBreak ? 1 : undefined,
        bold: run.bold,
        italics: run.italic,
        strike: run.strike,
        underline: run.underline ? {} : undefined,
        ...(run.code ? { font: "Courier New" } : {}),
      });
      if (!run.href) return text;
      return new ExternalHyperlink({ children: [text], link: run.href });
    });

  const bodySpacing = manuscript
    ? { line: DOUBLE_SPACED }
    : { line: 276, after: 160 };

  const bodyIndent = manuscript
    ? { firstLine: convertInchesToTwip(0.5) }
    : undefined;

  const paragraphsFor = (blocks: Block[]) => {
    const out: DocxParagraph[] = [];
    // The first paragraph of a chapter, and the first after a heading or scene
    // break, is flush left; the rest are indented. This is how printed books
    // set body text, and manuscript format keeps it.
    let opensSection = true;

    /**
     * A wrapped picture waiting for the prose it wraps.
     *
     * **A floating picture has to be anchored to the paragraph the text flows
     * around**, which is what Word itself does when you insert one with square
     * wrapping — not to a paragraph of its own, where the words would start
     * again underneath it and the wrap would be a picture with a gap beside
     * it. So a wrapped image is held back and becomes the first run of the
     * next paragraph. If a chapter ends on one, it is flushed into a paragraph
     * of its own rather than dropped.
     */
    let floatingPicture: DocxRun | null = null;

    const withFloat = (children: DocxRun[]) => {
      if (!floatingPicture) return children;
      const joined = [floatingPicture, ...children];
      floatingPicture = null;
      return joined;
    };

    for (const block of blocks) {
      switch (block.kind) {
        case "heading":
          out.push(
            new Paragraph({
              heading:
                block.level === 1
                  ? HeadingLevel.HEADING_1
                  : block.level === 2
                    ? HeadingLevel.HEADING_2
                    : HeadingLevel.HEADING_3,
              children: runsFor(block.runs),
            }),
          );
          opensSection = true;
          break;

        case "sceneBreak":
          out.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: bodySpacing,
              children: [new TextRun({ text: "* * *" })],
            }),
          );
          opensSection = true;
          break;

        case "quote":
          out.push(
            new Paragraph({
              indent: {
                left: convertInchesToTwip(0.5),
                right: convertInchesToTwip(0.5),
              },
              spacing: bodySpacing,
              // A quote is set in italic wholesale, so its runs are rebuilt
              // rather than reused. Bold inside a quote is lost; that is a
              // deliberate simplification.
              children: block.runs.map(
                (run) => new TextRun({ text: run.text, italics: true }),
              ),
            }),
          );
          opensSection = false;
          break;

        case "bullet":
          out.push(
            new Paragraph({
              bullet: { level: Math.min(block.depth, 2) },
              spacing: bodySpacing,
              children: runsFor(block.runs),
            }),
          );
          break;

        case "ordered":
          out.push(
            new Paragraph({
              numbering: {
                reference: "ordered",
                level: Math.min(block.depth, 2),
              },
              spacing: bodySpacing,
              children: runsFor(block.runs),
            }),
          );
          break;

        case "image": {
          const picture = block.src ? pictures.get(block.src) : undefined;
          if (!picture) {
            // Only when it could not be decoded. A visible marker beats a
            // silent hole where a picture was.
            out.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: bodySpacing,
                children: withFloat([
                  new TextRun({
                    text: block.alt ? `[image: ${block.alt}]` : "[image]",
                    italics: true,
                  }),
                ]),
              }),
            );
            opensSection = true;
            break;
          }

          const alt = block.alt
            ? { name: block.alt, description: block.alt, title: block.alt }
            : undefined;

          /* **The writer set the picture against the words, and the file has
             to keep that.** In the editor a wrapped picture takes one side of
             the column and the prose runs down the other — Word's own "Square"
             wrapping, which is where the feature's name came from. Centring it
             on a line of its own, which is what this did, is a different
             layout: the same picture at the same size, saying something else
             about how the page reads.

             `side` is the side the *text* takes, so it is the opposite of the
             picture's. The margins are a tenth of an inch in EMU, which is
             Word's own default gutter — without them the prose touches the
             artwork. */
          if (block.wrap) {
            floatingPicture = new ImageRun({
              type: picture.type,
              data: picture.data,
              transformation: fitImage(picture, block.imgWidth),
              altText: alt,
              floating: {
                horizontalPosition: {
                  relative: HorizontalPositionRelativeFrom.COLUMN,
                  align:
                    block.align === "right"
                      ? HorizontalPositionAlign.RIGHT
                      : HorizontalPositionAlign.LEFT,
                },
                verticalPosition: {
                  relative: VerticalPositionRelativeFrom.PARAGRAPH,
                  offset: 0,
                },
                wrap: {
                  type: TextWrappingType.SQUARE,
                  side:
                    block.align === "right"
                      ? TextWrappingSide.LEFT
                      : TextWrappingSide.RIGHT,
                  margins: { distL: 91440, distR: 91440 },
                },
                allowOverlap: false,
              },
            });
            break;
          }

          out.push(
            new Paragraph({
              // A picture the writer pushed to one side keeps that side; the
              // rest sit in the middle, which is where a plate goes in a book.
              alignment:
                block.align === "left"
                  ? AlignmentType.START
                  : block.align === "right"
                    ? AlignmentType.END
                    : AlignmentType.CENTER,
              spacing: bodySpacing,
              children: withFloat([
                new ImageRun({
                  type: picture.type,
                  data: picture.data,
                  transformation: fitImage(picture, block.imgWidth),
                  // Word reads this out and shows it while the picture loads;
                  // a described image is also the accessibility claim the EPUB
                  // already makes honestly.
                  altText: alt,
                }),
              ]),
            }),
          );
          opensSection = true;
          break;
        }

        case "code":
          out.push(
            new Paragraph({
              spacing: { line: 240 },
              children: [
                new TextRun({
                  text: block.runs.map((run) => run.text).join(""),
                  font: "Courier New",
                }),
              ],
            }),
          );
          break;

        default:
          out.push(
            new Paragraph({
              spacing: bodySpacing,
              // A line placed flush at the margin keeps no first-line indent,
              // the same as one opening a section — see lib/editor/no-indent.ts.
              indent:
                opensSection || block.noIndent ? undefined : bodyIndent,
              children: withFloat(runsFor(block.runs)),
            }),
          );
          opensSection = false;
      }
    }

    // A chapter that ends on a wrapped picture: it goes in a paragraph of its
    // own rather than being dropped with the words it was waiting for.
    if (floatingPicture) {
      out.push(new Paragraph({ spacing: bodySpacing, children: withFloat([]) }));
    }

    return out;
  };

  /**
   * The pages the export builds, in the order a book is bound.
   *
   * **Word had none of these and the other two formats did**, so one book
   * exported with a title page as an EPUB and opened straight onto chapter one
   * as a `.docx` — an agent's copy with nothing at the front saying whose book
   * it is. They are built natively rather than through `frontSections`, which
   * answers in HTML; what is *not* duplicated is the wording, which comes from
   * `copyrightLines` so the notice cannot drift between the formats.
   *
   * The same three rules apply as everywhere else: a page the writer wrote
   * themselves wins (`writtenPages`), a book with no author gets no copyright
   * notice rather than one naming the wrong party, and each switch is the
   * writer's.
   *
   * **The contents list carries no page numbers**, unlike the PDF's. Word
   * paginates when it opens the file, so any number written here would be one
   * this app invented — and the EPUB's contents carries none either, for the
   * same reason pointed at a different medium.
   */
  const written = writtenPages(chapters);
  const holder = book.author?.trim();
  /* Titles come from the shelf rather than from the block walk, so they miss
     the cleaning `toBlocks` does — and a `.docx` is XML in a zip, so a control
     character corrupts one exactly as it corrupts an EPUB. See
     `stripInvalidXml`. */
  const safe = stripInvalidXml;

  const centred = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: safe(text), bold: opts.bold, size: opts.size }),
      ],
    });

  /** The chapters a contents list names — the EPUB's rule, `printsHeading`. */
  const listed = chapters.filter((c) => printsHeading(c));

  /** Each generated page this Word file builds, by the id `bindBook` sorts on. */
  const generated: Record<string, DocxParagraph[]> = {
    title: [
      new Paragraph({
        spacing: { before: convertInchesToTwip(2) },
        children: [],
      }),
      centred(book.title, { bold: true, size: 40 }),
      ...(book.subtitle ? [centred(book.subtitle, { size: 28 })] : []),
      ...(book.author ? [centred(book.author)] : []),
    ],
    copyright: holder
      ? copyrightLines(book, holder).map(
          (line) =>
            new Paragraph({
              spacing: { after: 160 },
              children: [new TextRun(safe(line))],
            }),
        )
      : [],
    contents: [
      centred("Contents", { bold: true, size: 32 }),
      /* Numbered by the same rule the EPUB's and the PDF's contents use, so
         one book does not list "3. The Fourth Lamp" in two files and "The
         Fourth Lamp" in the third. See `chapterNumeral`. */
      ...listed.map((chapter) => {
        const numeral = chapterNumeral(chapter);
        return new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun(
              `${numeral === null ? "" : `${numeral}. `}${safe(chapter.title)}`,
            ),
          ],
        });
      }),
    ],
  };

  /* The three switches, under the same conditions `frontSections` applies:
     the writer's own page wins, and a book with nobody to name gets no
     copyright notice rather than one naming the wrong party. Empty lists are
     dropped, so a contents page for a book with nothing to list never opens a
     sheet of its own. */
  const built: FrontSection[] = (
    [
      [typeset.titlePage, "title"],
      [Boolean(typeset.copyright && holder), "copyright"],
      [typeset.contents, "contents"],
    ] as const
  )
    .filter(([on, id]) => on && !written.has(id) && generated[id].length > 0)
    .map(([, id]) => ({ id, html: "" }));

  /* **One bound order, the EPUB's** — see `bindBook`. This was a block of
     generated pages followed by every chapter in load order, which opened a
     book on a generated title page and left its own half-title stranded behind
     the contents. A page break before every page but the first, so each one
     starts its own sheet without the conditional arithmetic that shape needed. */
  const children: DocxParagraph[] = [];

  bindBook(chapters, built).forEach((page, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));

    if (page.kind === "generated") {
      children.push(...generated[page.section.id]);
      return;
    }

    const { chapter } = page;
    /* The standing numeral, by the shared rule. Word had none at all, so a
       chapter the writer had named lost which chapter of the book it was —
       the one thing its title no longer says. `hideChapterNumbers` is honoured
       here rather than in a stylesheet, because a `.docx` carries no
       stylesheet of ours to hide it with. */
    const numeral = typeset.hideChapterNumbers ? null : chapterNumeral(chapter);
    if (numeral !== null) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: manuscript
            ? { before: convertInchesToTwip(1) }
            : { before: 240 },
          children: [new TextRun({ text: String(numeral) })],
        }),
      );
    }
    // Apparatus — a title page, a copyright page, a contents list — prints no
    // heading, the same rule the EPUB has always followed. See `printsHeading`.
    if (printsHeading(chapter)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:
            manuscript
              ? {
                  // The inch of space above belongs to whichever of the two
                  // comes first, or a numbered chapter opens two inches down.
                  ...(numeral === null
                    ? { before: convertInchesToTwip(1) }
                    : {}),
                  after: DOUBLE_SPACED,
                }
              : { ...(numeral === null ? { before: 240 } : {}), after: 240 },
          children: [
            new TextRun({ text: safe(chapter.title), bold: !manuscript }),
          ],
        }),
      );
    }
    children.push(...paragraphsFor(toBlocks(chapter.doc)));
  });

  const name = surname(book.author);
  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            children: [
              `${name ? `${safe(name)} / ` : ""}${safe(book.title)} / `,
              PageNumber.CURRENT,
            ],
          }),
        ],
      }),
    ],
  });

  const document = new Document({
    creator: book.author ? safe(book.author) : undefined,
    title: safe(book.title),
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
          })),
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE_HALF_POINTS },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: manuscript
              ? {
                  top: convertInchesToTwip(1),
                  bottom: convertInchesToTwip(1),
                  left: convertInchesToTwip(1),
                  right: convertInchesToTwip(1),
                }
              : undefined,
          },
        },
        headers: manuscript ? { default: header } : undefined,
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}
