import { expect, it } from "vitest";
import {
  buildEpub,
  chapterXhtml,
  containerXml,
  contentOpf,
  navXhtml,
} from "@/lib/export/epub";

const chapters = [
  { title: "Chapter One", xhtml: "<p>It began.</p>" },
  { title: "Chapter & Two", xhtml: "<p>It continued.</p>" },
];

it("declares the rootfile in container.xml", () => {
  const xml = containerXml();
  expect(xml).toContain('full-path="OEBPS/content.opf"');
  expect(xml).toContain('media-type="application/oebps-package+xml"');
});

it("puts the title, author and identifier in the OPF", () => {
  const opf = contentOpf(
    { title: "The Salt Road", author: "M. Reyes" },
    chapters,
    "urn:uuid:abc",
  );
  expect(opf).toContain("<dc:title>The Salt Road</dc:title>");
  expect(opf).toContain("<dc:creator>M. Reyes</dc:creator>");
  expect(opf).toContain("urn:uuid:abc");
  expect(opf).toContain('version="3.0"');
});

it("omits the creator when there is no author", () => {
  const opf = contentOpf({ title: "Untitled" }, chapters, "urn:uuid:abc");
  expect(opf).not.toContain("dc:creator");
});

it("lists every chapter in the manifest and the spine, in order", () => {
  const opf = contentOpf({ title: "T" }, chapters, "urn:uuid:abc");
  expect(opf).toContain('href="chapter-01.xhtml"');
  expect(opf).toContain('href="chapter-02.xhtml"');
  expect(opf.indexOf("chapter-01.xhtml")).toBeLessThan(
    opf.indexOf("chapter-02.xhtml"),
  );
  expect(opf).toContain('<itemref idref="chapter-01" />');
});

it("declares the nav document with its required property", () => {
  const opf = contentOpf({ title: "T" }, chapters, "urn:uuid:abc");
  // EPUB 3 requires exactly one item carrying properties="nav".
  expect(opf).toContain('properties="nav"');
});

it("escapes metadata in the OPF", () => {
  const opf = contentOpf(
    { title: "Salt & Rope", author: "A <B>" },
    chapters,
    "urn:uuid:abc",
  );
  expect(opf).toContain("<dc:title>Salt &amp; Rope</dc:title>");
  expect(opf).toContain("<dc:creator>A &lt;B&gt;</dc:creator>");
});

it("lists chapters in the nav document, escaping titles", () => {
  const nav = navXhtml("The Salt Road", chapters);
  expect(nav).toContain('href="chapter-01.xhtml"');
  expect(nav).toContain("Chapter &amp; Two");
  expect(nav).toContain('epub:type="toc"');
});

it("wraps chapter content in a full XHTML document", () => {
  const html = chapterXhtml("Chapter & One", "<p>It began.</p>");
  expect(html).toContain("<?xml version=");
  expect(html).toContain("<title>Chapter &amp; One</title>");
  expect(html).toContain("<h1>Chapter &amp; One</h1>");
  expect(html).toContain("<p>It began.</p>");
  expect(html).toContain('xmlns="http://www.w3.org/1999/xhtml"');
});

it("writes mimetype as the first entry, uncompressed", async () => {
  // The single most common way an EPUB comes out invalid. Reading the raw zip
  // bytes is not testing JSZip — it is testing our compliance with the spec,
  // which JSZip will happily let us violate.
  const blob = await buildEpub(
    {
      id: "b",
      title: "The Salt Road",
      chapters: [{ id: "c1", title: "Chapter One", words: 2 }],
      lastOpenedId: "c1",
      lastOpenedAt: 0,
    },
    [{ title: "Chapter One", doc: { type: "doc", content: [] } }],
  );

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const ascii = (from: number, length: number) =>
    String.fromCharCode(...bytes.slice(from, from + length));

  // Local file header signature at offset 0.
  expect(ascii(0, 4)).toBe("PK\x03\x04");
  // Compression method, bytes 8-9: 0 is STORE, 8 would be DEFLATE.
  expect(bytes[8] | (bytes[9] << 8)).toBe(0);
  // Filename follows the 30-byte header.
  const nameLength = bytes[26] | (bytes[27] << 8);
  expect(ascii(30, nameLength)).toBe("mimetype");
  expect(ascii(30 + nameLength, 20)).toBe("application/epub+zip");
});
