import type { Book } from "@/lib/library-store";
// Type-only, so it is erased at compile time and does not pull the library into
// the bundle — the runtime import below stays dynamic.
import type { Paragraph as DocxParagraph } from "docx";
import {
  printsHeading,
  toBlocks,
  type Block,
  type LoadedChapter,
  type Run,
} from "./blocks";
import { fitImage, resolveImages } from "./docx-images";
import { copyrightLines, writtenPages } from "./front-matter";
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
    Header,
    HeadingLevel,
    ImageRun,
    LevelFormat,
    Packer,
    PageBreak,
    PageNumber,
    Paragraph,
    TextRun,
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

  const runsFor = (runs: Run[]) =>
    runs.map(
      (run) =>
        new TextRun({
          text: run.hardBreak ? "" : run.text,
          break: run.hardBreak ? 1 : undefined,
          bold: run.bold,
          italics: run.italic,
          strike: run.strike,
          underline: run.underline ? {} : undefined,
        }),
    );

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
          out.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: bodySpacing,
              children: [
                picture
                  ? new ImageRun({
                      type: picture.type,
                      data: picture.data,
                      transformation: fitImage(picture, block.imgWidth),
                      // Word reads this out and shows it while the picture
                      // loads; a described image is also the accessibility
                      // claim the EPUB already makes honestly.
                      altText: block.alt
                        ? {
                            name: block.alt,
                            description: block.alt,
                            title: block.alt,
                          }
                        : undefined,
                    })
                  : // Only when the picture could not be decoded. A visible
                    // marker beats a silent hole where a picture was.
                    new TextRun({
                      text: block.alt ? `[image: ${block.alt}]` : "[image]",
                      italics: true,
                    }),
              ],
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
              children: runsFor(block.runs),
            }),
          );
          opensSection = false;
      }
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
  const front: DocxParagraph[] = [];
  const written = writtenPages(chapters);
  const holder = book.author?.trim();

  const centred = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text, bold: opts.bold, size: opts.size }),
      ],
    });

  if (typeset.titlePage && !written.has("title")) {
    front.push(
      new Paragraph({ spacing: { before: convertInchesToTwip(2) }, children: [] }),
      centred(book.title, { bold: true, size: 40 }),
    );
    if (book.subtitle) front.push(centred(book.subtitle, { size: 28 }));
    if (book.author) front.push(centred(book.author));
  }

  if (typeset.copyright && holder && !written.has("copyright")) {
    if (front.length) front.push(new Paragraph({ children: [new PageBreak()] }));
    for (const line of copyrightLines(book, holder)) {
      front.push(
        new Paragraph({ spacing: { after: 160 }, children: [new TextRun(line)] }),
      );
    }
  }

  if (typeset.contents && !written.has("contents")) {
    const listed = chapters.filter((c) => printsHeading(c));
    if (listed.length) {
      if (front.length)
        front.push(new Paragraph({ children: [new PageBreak()] }));
      front.push(centred("Contents", { bold: true, size: 32 }));
      for (const chapter of listed) {
        front.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun(chapter.title)],
          }),
        );
      }
    }
  }

  const children: DocxParagraph[] = [...front];

  chapters.forEach((chapter, index) => {
    if (index > 0 || front.length) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    // Apparatus — a title page, a copyright page, a contents list — prints no
    // heading, the same rule the EPUB has always followed. See `printsHeading`.
    if (printsHeading(chapter)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: manuscript
            ? { before: convertInchesToTwip(1), after: DOUBLE_SPACED }
            : { before: 240, after: 240 },
          children: [new TextRun({ text: chapter.title, bold: !manuscript })],
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
              `${name ? `${name} / ` : ""}${book.title} / `,
              PageNumber.CURRENT,
            ],
          }),
        ],
      }),
    ],
  });

  const document = new Document({
    creator: book.author || undefined,
    title: book.title,
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
