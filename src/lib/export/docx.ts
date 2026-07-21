import type { Book } from "@/lib/library-store";
// Type-only, so it is erased at compile time and does not pull the library into
// the bundle — the runtime import below stays dynamic.
import type { Paragraph as DocxParagraph } from "docx";
import { toBlocks, type Block, type LoadedChapter, type Run } from "./blocks";

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
  { manuscript }: { manuscript: boolean },
): Promise<Blob> {
  const {
    AlignmentType,
    Document,
    Header,
    HeadingLevel,
    LevelFormat,
    Packer,
    PageBreak,
    PageNumber,
    Paragraph,
    TextRun,
    convertInchesToTwip,
  } = await import("docx");

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
              indent: opensSection ? undefined : bodyIndent,
              children: runsFor(block.runs),
            }),
          );
          opensSection = false;
      }
    }

    return out;
  };

  const children: DocxParagraph[] = [];

  chapters.forEach((chapter, index) => {
    if (index > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: manuscript
          ? { before: convertInchesToTwip(1), after: DOUBLE_SPACED }
          : { before: 240, after: 240 },
        children: [new TextRun({ text: chapter.title, bold: !manuscript })],
      }),
    );
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
