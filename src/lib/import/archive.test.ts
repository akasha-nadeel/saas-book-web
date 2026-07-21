import { expect, it } from "vitest";
import JSZip from "jszip";
import { parseDocx } from "@/lib/import/docx";
import { epubTitle, parseEpub } from "@/lib/import/epub";

/**
 * The two zip formats, exercised against archives built here.
 *
 * Both parsers walk real XML from real word processors, which is exactly the
 * kind of code that looks right and reads nothing. Building the archives means
 * these tests fail if the walk breaks, rather than passing on a fixture that
 * happens to be shaped the way the parser expects.
 */

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

async function docxWith(body: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
     <w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

const para = (text: string, style?: string) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t>${text}</w:t></w:r></w:p>`;

it("reads paragraphs and Word heading styles", async () => {
  const blocks = await parseDocx(
    await docxWith(para("Chapter One", "Heading1") + para("She left at dawn.")),
  );

  expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
  expect(blocks[1]).toMatchObject({ type: "paragraph" });
  expect(blocks[1].inline[0].text).toBe("She left at dawn.");
});

it("accepts the heading style names Word actually writes", async () => {
  // "heading 2" with a space and lower case is what some versions emit.
  const blocks = await parseDocx(await docxWith(para("Two", "heading 2")));
  expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
});

it("reads bold and italic runs", async () => {
  const blocks = await parseDocx(
    await docxWith(
      `<w:p>
         <w:r><w:rPr><w:b/></w:rPr><w:t>bold </w:t></w:r>
         <w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r>
       </w:p>`,
    ),
  );

  expect(blocks[0].inline).toEqual([
    { text: "bold ", bold: true },
    { text: "italic", italic: true },
  ]);
});

it("treats w:val=\"0\" as off, not on", async () => {
  // Word writes the attribute both ways; reading it as a flag makes every run
  // in a document bold.
  const blocks = await parseDocx(
    await docxWith(
      `<w:p><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>plain</w:t></w:r></w:p>`,
    ),
  );
  expect(blocks[0].inline[0].bold).toBeUndefined();
});

it("keeps empty paragraphs, which are scene breaks", async () => {
  const blocks = await parseDocx(
    await docxWith(para("One.") + "<w:p/>" + para("Two.")),
  );
  expect(blocks).toHaveLength(3);
  expect(blocks[1].inline).toEqual([]);
});

it("refuses a docx with no document body", async () => {
  const zip = new JSZip();
  zip.file("meaningless.txt", "nothing here");
  await expect(
    parseDocx(await zip.generateAsync({ type: "arraybuffer" })),
  ).rejects.toThrow(/no document body/i);
});

// --- epub ------------------------------------------------------------------

async function epubWith(options?: { reverseSpine?: boolean }) {
  const zip = new JSZip();

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
     <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
       <rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles>
     </container>`,
  );

  const spine = options?.reverseSpine
    ? `<itemref idref="c2"/><itemref idref="c1"/>`
    : `<itemref idref="c1"/><itemref idref="c2"/>`;

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?>
     <package xmlns="http://www.idpf.org/2007/opf">
       <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
         <dc:title>The Salt Road</dc:title>
       </metadata>
       <manifest>
         <item id="c1" href="one.xhtml"/>
         <item id="c2" href="two.xhtml"/>
         <item id="cover" href="cover.xhtml"/>
       </manifest>
       <spine>${spine}<itemref idref="cover" linear="no"/></spine>
     </package>`,
  );

  zip.file("OEBPS/one.xhtml", "<html><body><h1>One</h1><p>First.</p></body></html>");
  zip.file("OEBPS/two.xhtml", "<html><body><h1>Two</h1><p>Second.</p></body></html>");
  zip.file("OEBPS/cover.xhtml", "<html><body><p>COVER ART</p></body></html>");

  return zip.generateAsync({ type: "arraybuffer" });
}

it("reads epub chapters in spine order, not zip order", async () => {
  const blocks = await parseEpub(await epubWith({ reverseSpine: true }));
  const text = blocks.map((b) => b.inline.map((i) => i.text).join(""));

  // The spine says two-then-one, and the spine is the book's real order.
  expect(text).toEqual(["Two", "Second.", "One", "First."]);
});

it("skips non-linear spine items like covers", async () => {
  const blocks = await parseEpub(await epubWith());
  const text = blocks.map((b) => b.inline.map((i) => i.text).join(""));
  expect(text).not.toContain("COVER ART");
});

it("resolves hrefs relative to the opf, not the zip root", async () => {
  // The chapters live in OEBPS/ but the opf refers to them as "one.xhtml".
  // Reading those paths literally finds nothing at all.
  const blocks = await parseEpub(await epubWith());
  expect(blocks.length).toBeGreaterThan(0);
});

it("prefers the epub's own title over the file name", async () => {
  expect(await epubTitle(await epubWith())).toBe("The Salt Road");
});

it("refuses an epub with no container", async () => {
  const zip = new JSZip();
  zip.file("random.txt", "x");
  await expect(
    parseEpub(await zip.generateAsync({ type: "arraybuffer" })),
  ).rejects.toThrow(/container/i);
});
