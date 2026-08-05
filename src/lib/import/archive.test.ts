import { expect, it } from "vitest";
import JSZip from "jszip";
import { parseDocx } from "@/lib/import/docx";
import { coverHrefFrom, epubMetadata, parseEpub } from "@/lib/import/epub";
import { docxMetadata } from "@/lib/import/docx";

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
  const blocks = (await parseEpub(await epubWith({ reverseSpine: true }))).flatMap((s) => s.blocks);
  const text = blocks.map((b) => b.inline.map((i) => i.text).join(""));

  // The spine says two-then-one, and the spine is the book's real order.
  expect(text).toEqual(["Two", "Second.", "One", "First."]);
});

it("skips non-linear spine items like covers", async () => {
  const blocks = (await parseEpub(await epubWith())).flatMap((s) => s.blocks);
  const text = blocks.map((b) => b.inline.map((i) => i.text).join(""));
  expect(text).not.toContain("COVER ART");
});

it("resolves hrefs relative to the opf, not the zip root", async () => {
  // The chapters live in OEBPS/ but the opf refers to them as "one.xhtml".
  // Reading those paths literally finds nothing at all.
  const blocks = (await parseEpub(await epubWith())).flatMap((s) => s.blocks);
  expect(blocks.length).toBeGreaterThan(0);
});

it("prefers the epub's own title over the file name", async () => {
  expect((await epubMetadata(await epubWith())).title).toBe("The Salt Road");
});

// --- what a file says about itself -----------------------------------------

/*
 * The listing fields, which the check on the landing page reports on.
 *
 * These matter more than they look: a finding is only worth printing if it is
 * true, and an EPUB out of Vellum or Atticus carries an author, a blurb, an
 * ISBN and a cover. Reading none of them would have the landing page telling
 * a writer with a complete file that they have none of it — the one kind of
 * mistake this product cannot afford to make on the first screen.
 */

async function richEpub() {
  const zip = new JSZip();
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
     <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
       <rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles>
     </container>`,
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?>
     <package xmlns="http://www.idpf.org/2007/opf">
       <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
         <dc:title>The Salt Road</dc:title>
         <dc:creator>Ada Vane</dc:creator>
         <dc:identifier id="uid">urn:uuid:9f1c8a2e-0000-4000-8000-000000000000</dc:identifier>
         <dc:identifier>urn:isbn:978-0-306-40615-7</dc:identifier>
         <dc:publisher>Long Shore</dc:publisher>
         <dc:description>&lt;p&gt;A road made of &lt;i&gt;salt&lt;/i&gt;.&lt;/p&gt;</dc:description>
         <dc:subject>Fantasy</dc:subject>
         <dc:subject>fantasy</dc:subject>
         <dc:subject>Epic</dc:subject>
         <dc:date>2019-03-04T00:00:00Z</dc:date>
         <dc:language>en-GB</dc:language>
       </metadata>
       <manifest>
         <item id="c1" href="one.xhtml"/>
       </manifest>
       <spine><itemref idref="c1"/></spine>
     </package>`,
  );
  zip.file("OEBPS/one.xhtml", "<html><body><p>First.</p></body></html>");
  return zip.generateAsync({ type: "arraybuffer" });
}

it("reads the listing details an epub carries", async () => {
  const meta = await epubMetadata(await richEpub());

  expect(meta.author).toBe("Ada Vane");
  expect(meta.publishing).toMatchObject({
    publisher: "Long Shore",
    language: "en-GB",
  });
});

it("takes the identifier that is a real ISBN, not the file's uuid", async () => {
  const meta = await epubMetadata(await richEpub());
  // The uuid comes first in the manifest, and only the check digit can tell
  // the two apart — a `urn:isbn:` prefix is a label, not a proof.
  expect(meta.publishing?.isbn).toBe("9780306406157");
});

it("cuts a dc:date down to the date a shop will accept", async () => {
  // A full timestamp is legal in an EPUB and refused by storeReadiness, so
  // passing it through would import a good file and then report a *blocking*
  // problem of our own making.
  expect((await epubMetadata(await richEpub())).publishing?.published).toBe(
    "2019-03-04",
  );
});

it("takes the blurb as text, and de-duplicates the subjects", async () => {
  const meta = await epubMetadata(await richEpub());
  expect(meta.publishing?.description).toBe("A road made of salt.");
  expect(meta.publishing?.subjects).toEqual(["Fantasy", "Epic"]);
});

it("reports no cover when the manifest declares none", async () => {
  // The fixture has a cover *page* in the spine but no cover image, which is
  // exactly what a shop's validator concludes too.
  expect((await epubMetadata(await epubWith())).hasCover).toBeUndefined();
});

// `coverHrefFrom` is pure, so the rules about which item is the cover can be
// exercised without building a zip around them.
function opf(manifest: string, meta = ""): Document {
  return new DOMParser().parseFromString(
    `<package xmlns="http://www.idpf.org/2007/opf">
       <metadata>${meta}</metadata>
       <manifest>${manifest}</manifest>
     </package>`,
    "application/xml",
  );
}

it("finds an epub 3 cover by its properties", () => {
  const doc = opf(
    `<item id="c" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`,
  );
  expect(coverHrefFrom(doc, "OEBPS/content.opf")).toBe("OEBPS/images/cover.jpg");
});

it("finds an epub 2 cover through the legacy meta pointer", () => {
  const doc = opf(
    `<item id="cov" href="cover.png" media-type="image/png"/>`,
    `<meta name="cover" content="cov"/>`,
  );
  expect(coverHrefFrom(doc, "OEBPS/content.opf")).toBe("OEBPS/cover.png");
});

it("refuses a cover pointer aimed at the cover page rather than the art", () => {
  // Plenty of files point `meta name="cover"` at the XHTML that *shows* the
  // cover. Packaging that as artwork gives a broken picture rather than none.
  const doc = opf(
    `<item id="cov" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
    `<meta name="cover" content="cov"/>`,
  );
  expect(coverHrefFrom(doc, "OEBPS/content.opf")).toBeNull();
});

it("reads what Word recorded about a document", async () => {
  const zip = new JSZip();
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0"?>
     <cp:coreProperties
        xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
        xmlns:dc="http://purl.org/dc/elements/1.1/">
       <dc:title>The Drowned Coast</dc:title>
       <dc:creator>Ada Vane</dc:creator>
       <cp:keywords>fantasy; epic</cp:keywords>
     </cp:coreProperties>`,
  );

  const meta = await docxMetadata(await zip.generateAsync({ type: "arraybuffer" }));
  expect(meta.title).toBe("The Drowned Coast");
  expect(meta.author).toBe("Ada Vane");
  expect(meta.publishing?.subjects).toEqual(["fantasy", "epic"]);
});

it("does not take Word's machine account as the author", async () => {
  // A wrong author is worse than none: it would settle the one question every
  // shop refuses a book over, and nobody goes looking for a problem the check
  // said they did not have.
  const zip = new JSZip();
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0"?>
     <cp:coreProperties
        xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
        xmlns:dc="http://purl.org/dc/elements/1.1/">
       <dc:creator>Windows User</dc:creator>
     </cp:coreProperties>`,
  );

  const meta = await docxMetadata(await zip.generateAsync({ type: "arraybuffer" }));
  expect(meta.author).toBeUndefined();
});

it("survives a docx with no properties at all", async () => {
  const zip = new JSZip();
  zip.file("word/document.xml", "<x/>");
  expect(
    await docxMetadata(await zip.generateAsync({ type: "arraybuffer" })),
  ).toEqual({});
});

it("refuses an epub with no container", async () => {
  const zip = new JSZip();
  zip.file("random.txt", "x");
  await expect(
    parseEpub(await zip.generateAsync({ type: "arraybuffer" })),
  ).rejects.toThrow(/container/i);
});

/**
 * A book this app exported, read back in.
 *
 * The round trip is the sharpest test there is of the importer, because the
 * export writes `epub:type` on every page and the import is the side that has
 * to believe it. It used to not: every spine document was concatenated into
 * one block stream and re-split on headings, so a half-title, a title page and
 * a copyright page — none of which print a heading, because no published book
 * has a sheet headed "Copyright page" — merged into the dedication that
 * followed them and arrived as a body chapter called "Chapter 1 – Dedication".
 */
async function typedEpub(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><manifest>
      <item id="c1" href="chapter-01.xhtml"/><item id="c2" href="chapter-02.xhtml"/>
      <item id="c3" href="chapter-03.xhtml"/><item id="c4" href="chapter-04.xhtml"/>
    </manifest><spine>
      <itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3"/><itemref idref="c4"/>
    </spine></package>`,
  );
  const page = (type: string, title: string, body: string) =>
    `<html xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title></head><body epub:type="${type}">${body}</body></html>`;

  zip.file(
    "OEBPS/chapter-01.xhtml",
    // Apparatus: a title in the head and no heading on the page.
    page("frontmatter halftitlepage", "Half-title page", "<p>The Salt Ledger</p>"),
  );
  zip.file(
    "OEBPS/chapter-02.xhtml",
    page("frontmatter dedication", "Dedication", "<h1>Dedication</h1><p>For Ines.</p>"),
  );
  zip.file(
    "OEBPS/chapter-03.xhtml",
    page("bodymatter chapter", "Chapter One", "<h1>Chapter One</h1><p>The pans lay white.</p>"),
  );
  zip.file(
    "OEBPS/chapter-04.xhtml",
    page("backmatter acknowledgments", "Acknowledgements", "<h1>Acknowledgements</h1><p>To Ana.</p>"),
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

it("keeps front and back matter out of the chapters", async () => {
  const sections = await parseEpub(await typedEpub());
  expect(sections.map((s) => [s.matter ?? "body", s.title ?? "—"])).toEqual([
    ["front", "Half-title page"],
    ["front", "Dedication"],
    ["body", "—"],
    ["back", "Acknowledgements"],
  ]);
});

/**
 * An apparatus page has no heading, so its `<title>` is the only name it has —
 * which is exactly the case that used to make it merge into the next page.
 */
it("names an apparatus page from its head title", async () => {
  const sections = await parseEpub(await typedEpub());
  expect(sections[0].title).toBe("Half-title page");
  expect(sections[0].blocks.length).toBeGreaterThan(0);
});

it("leaves an EPUB that types nothing on the old path", async () => {
  // No epub:type anywhere — every section is untyped, so the body keeps the
  // whole book and `splitIntoChapters` derives the chapters as it always did.
  const sections = await parseEpub(await epubWith());
  expect(sections.every((s) => s.matter === undefined)).toBe(true);
});

/**
 * A bare division with no part beside it.
 *
 * Plenty of EPUBs in the wild write `epub:type="toc"` and nothing else, and
 * our own generated pages did too until the export was fixed to name the part.
 * A division we recognise is a page whose part we know.
 */
it("infers the part from a division when the file gives none", async () => {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><manifest>
      <item id="a" href="a.xhtml"/><item id="b" href="b.xhtml"/><item id="c" href="c.xhtml"/>
    </manifest><spine><itemref idref="a"/><itemref idref="b"/><itemref idref="c"/></spine></package>`,
  );
  const page = (type: string, title: string, body: string) =>
    `<html xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title></head><body epub:type="${type}">${body}</body></html>`;
  // A generated title page carries the *book's* name in its head, which is why
  // the division's own name is preferred for apparatus.
  zip.file("OEBPS/a.xhtml", page("titlepage", "The Salt Ledger", "<p>The Salt Ledger</p>"));
  zip.file("OEBPS/b.xhtml", page("epilogue", "Epilogue", "<h1>Epilogue</h1><p>After.</p>"));
  zip.file("OEBPS/c.xhtml", page("bodymatter chapter", "One", "<h1>One</h1><p>x</p>"));

  const sections = await parseEpub(await zip.generateAsync({ type: "arraybuffer" }));
  expect(sections.map((s) => [s.matter ?? "body", s.title ?? "—"])).toEqual([
    ["front", "Title page"],
    ["back", "Epilogue"],
    ["body", "—"],
  ]);
});
