import { expect, it } from "vitest";
import { buildDocx } from "@/lib/export/docx";
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

const chapters = [
  {
    title: "Chapter One",
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
    [{ title: "Empty", doc: { type: "doc", content: [] } }],
    { manuscript: true },
  );
  expect(await textOf(blob)).toContain("Empty");
});
