import { expect, it } from "vitest";
import { buildDocx, docxFontName } from "@/lib/export/docx";
import type { LoadedChapter } from "@/lib/export/blocks";
import type { Book } from "@/lib/library-store";

/**
 * Not an assertion on the docx object model — a Paragraph exposes nothing
 * meaningful to compare. This is a smoke test for the two failures the
 * typechecker cannot catch: a wrong option *value* throwing at pack time, and
 * text being silently dropped on the way through.
 */

const book: Book = {
  id: "b",
  title: "The Salt Road",
  author: "Mira Reyes",
  chapters: [{ id: "c1", title: "Chapter One", words: 5 }],
  lastOpenedId: "c1",
  lastOpenedAt: 0,
};

/* Typed, so the fixture cannot drift away from the shape the exporters take.
   It had: `number` became required on `LoadedChapter` and these were never
   updated, which typechecked nowhere because vitest does not typecheck. */
const chapters: LoadedChapter[] = [
  {
    title: "Chapter One",
    number: 1,
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The salt road ran " },
            { type: "text", text: "west", marks: [{ type: "italic" }] },
            { type: "text", text: "." },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "She had not meant to leave." }],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "salt" }] },
              ],
            },
          ],
        },
      ],
    },
  },
];

async function textOf(blob: Blob): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file("word/document.xml")!.async("string");
}

it("packs a valid document in manuscript format", async () => {
  const blob = await buildDocx(book, chapters, { manuscript: true });
  const xml = await textOf(blob);

  expect(xml).toContain("The salt road ran ");
  expect(xml).toContain("west");
  expect(xml).toContain("She had not meant to leave.");
  expect(xml).toContain("* * *");
  expect(xml).toContain("Chapter One");
});

it("packs a valid document without manuscript furniture", async () => {
  const blob = await buildDocx(book, chapters, { manuscript: false });
  expect(await textOf(blob)).toContain("The salt road ran ");
});

it("survives a book with no author", async () => {
  // surname() has to cope with undefined, and the running header omits the
  // byline rather than printing "undefined /".
  const blob = await buildDocx({ ...book, author: undefined }, chapters, {
    manuscript: true,
  });
  expect(await textOf(blob)).toContain("The salt road ran ");
});

it("survives an empty chapter", async () => {
  const blob = await buildDocx(
    book,
    [{ title: "Empty", number: 1, doc: { type: "doc", content: [] } }],
    { manuscript: true },
  );
  expect(await textOf(blob)).toContain("Empty");
});

/* --- inline size and face -------------------------------------------------
 *
 * Both reached the reading view, the EPUB and the PDF and neither reached the
 * Word file, so a passage a writer had set larger or in another face came back
 * looking like every other paragraph — in the one format an agent asks for.
 * ------------------------------------------------------------------------- */

const marked: LoadedChapter[] = [
  {
    title: "Chapter One",
    number: 1,
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "louder",
              marks: [{ type: "fontSize", attrs: { size: 1.5 } }],
            },
            {
              type: "text",
              text: "elsewhere",
              marks: [{ type: "fontFamily", attrs: { font: "garamond" } }],
            },
          ],
        },
      ],
    },
  },
];

it("carries an inline size into the Word file", async () => {
  const xml = await textOf(await buildDocx(book, marked, { manuscript: false }));
  // Half-points against this document's own 12pt body, not the editor's — a
  // .docx carries none of our typography, so 1.5x of 24 half-points is 36.
  expect(xml).toContain('w:sz w:val="36"');
  expect(xml).toContain("louder");
});

it("carries an inline face into the Word file", async () => {
  const xml = await textOf(await buildDocx(book, marked, { manuscript: false }));
  // One name, not the CSS stack — see docxFontName.
  expect(xml).toContain('w:ascii="Garamond"');
  expect(xml).not.toContain("EB Garamond");
});

it("reduces a font stack to the one name Word can use", () => {
  expect(docxFontName('Georgia, Cambria, "Times New Roman", serif')).toBe(
    "Georgia",
  );
  // Quoted first entries lose their quotes.
  expect(docxFontName('"Times New Roman", Times, serif')).toBe(
    "Times New Roman",
  );
  // A webfont Word cannot fetch is stepped over for the fallback the stack's
  // author already chose, and a generic family is not a font at all.
  expect(docxFontName("var(--font-fraunces), ui-serif, Georgia, serif")).toBe(
    "Georgia",
  );
  // Nothing usable leaves the run on the document's own face rather than on a
  // name Word would silently substitute.
  expect(docxFontName("serif")).toBeUndefined();
  expect(docxFontName("")).toBeUndefined();
});
