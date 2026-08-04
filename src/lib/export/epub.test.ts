import { describe, expect, it } from "vitest";
import {
  buildEpub,
  chapterXhtml,
  containerXml,
  contentOpf,
  coverXhtml,
  navXhtml,
  pageXhtml,
  tocNcx,
} from "@/lib/export/epub";
import type { PackagedImage } from "@/lib/export/epub-images";

const chapters = [
  { title: "Chapter One", xhtml: "<p>It began.</p>" },
  { title: "Chapter & Two", xhtml: "<p>It continued.</p>" },
];

const COVER: PackagedImage = {
  id: "cover-image",
  href: "images/cover.jpeg",
  mediaType: "image/jpeg",
  bytes: new Uint8Array([1, 2, 3]),
};

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
  // The id is load-bearing: the role and file-as metas refine it by reference.
  expect(opf).toContain('<dc:creator id="creator">M. Reyes</dc:creator>');
  expect(opf).toContain("urn:uuid:abc");
  expect(opf).toContain('version="3.0"');
});

it("marks the creator as the author and gives a sort form", () => {
  const opf = contentOpf(
    { title: "The Salt Road", author: "M. Reyes" },
    chapters,
    "urn:uuid:abc",
  );
  expect(opf).toContain(
    '<meta refines="#creator" property="role" scheme="marc:relators">aut</meta>',
  );
  expect(opf).toContain(
    '<meta refines="#creator" property="file-as">Reyes, M.</meta>',
  );
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
  expect(opf).toContain('<dc:creator id="creator">A &lt;B&gt;</dc:creator>');
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

// ---------------------------------------------------------------------------
// The parts a shop checks
// ---------------------------------------------------------------------------

it("declares the cover under both the modern and the legacy hook", () => {
  // Shops read one or the other, and which one is not knowable in advance.
  const opf = contentOpf({ title: "T" }, chapters, "urn:uuid:abc", [], {
    cover: COVER,
  });
  expect(opf).toContain(
    '<item id="cover-image" href="images/cover.jpeg" media-type="image/jpeg" properties="cover-image"/>',
  );
  expect(opf).toContain('<meta name="cover" content="cover-image"/>');
});

it("puts the cover page first in the spine", () => {
  const opf = contentOpf({ title: "T" }, chapters, "urn:uuid:abc", ["title"], {
    cover: COVER,
  });
  const spine = opf.slice(opf.indexOf("<spine"));
  expect(spine.indexOf('idref="cover"')).toBeLessThan(
    spine.indexOf('idref="title"'),
  );
});

it("leaves the cover out entirely when there is none", () => {
  const opf = contentOpf({ title: "T" }, chapters, "urn:uuid:abc");
  expect(opf).not.toContain("cover");
});

it("lists packaged images in the manifest with their media types", () => {
  const opf = contentOpf({ title: "T" }, chapters, "urn:uuid:abc", [], {
    images: [
      {
        id: "img-01",
        href: "images/img-01.png",
        mediaType: "image/png",
        bytes: new Uint8Array(),
      },
    ],
  });
  expect(opf).toContain(
    '<item id="img-01" href="images/img-01.png" media-type="image/png"/>',
  );
});

it("writes the publishing metadata a listing is built from", () => {
  const opf = contentOpf(
    {
      title: "T",
      publishing: {
        language: "en-GB",
        publisher: "Salt Press",
        description: "A caravan crosses a desert.",
        published: "2026-03-01",
        rights: "Copyright 2026 M. Reyes",
        subjects: ["Fiction / Literary", "Fiction / Sagas"],
      },
    },
    chapters,
    "urn:isbn:9780306406157",
  );
  expect(opf).toContain("<dc:language>en-GB</dc:language>");
  expect(opf).toContain("<dc:publisher>Salt Press</dc:publisher>");
  expect(opf).toContain("<dc:description>A caravan crosses a desert.</dc:description>");
  expect(opf).toContain("<dc:date>2026-03-01</dc:date>");
  expect(opf).toContain("<dc:rights>Copyright 2026 M. Reyes</dc:rights>");
  expect(opf).toContain("<dc:subject>Fiction / Literary</dc:subject>");
  expect(opf).toContain("<dc:subject>Fiction / Sagas</dc:subject>");
  // The package language tag has to agree with dc:language or readers disagree
  // about which one wins.
  expect(opf).toContain('xml:lang="en-GB"');
});

it("omits metadata elements that have nothing in them", () => {
  // An empty <dc:publisher/> is not the same as no publisher; some ingestion
  // pipelines take it as an empty imprint name and reject the file.
  const opf = contentOpf(
    { title: "T", publishing: { publisher: "   ", description: "" } },
    chapters,
    "urn:uuid:abc",
  );
  expect(opf).not.toContain("dc:publisher");
  expect(opf).not.toContain("dc:description");
});

it("expresses a series as a refined collection", () => {
  const opf = contentOpf(
    { title: "T", publishing: { series: "The Salt Cycle", seriesIndex: 2 } },
    chapters,
    "urn:uuid:abc",
  );
  expect(opf).toContain(
    '<meta property="belongs-to-collection" id="series">The Salt Cycle</meta>',
  );
  expect(opf).toContain(
    '<meta refines="#series" property="collection-type">series</meta>',
  );
  expect(opf).toContain(
    '<meta refines="#series" property="group-position">2</meta>',
  );
});

it("claims alternative text only when every image has some", () => {
  const withImages = {
    images: [
      {
        id: "img-01",
        href: "images/img-01.png",
        mediaType: "image/png",
        bytes: new Uint8Array(),
      },
    ],
  };

  const described = contentOpf({ title: "T" }, chapters, "u", [], {
    ...withImages,
    allImagesDescribed: true,
  });
  expect(described).toContain(
    '<meta property="schema:accessibilityFeature">alternativeText</meta>',
  );
  expect(described).toContain(
    '<meta property="schema:accessModeSufficient">textual</meta>',
  );

  const undescribed = contentOpf({ title: "T" }, chapters, "u", [], {
    ...withImages,
    allImagesDescribed: false,
  });
  // Claiming alt text that is not there tells a reader who needs it that the
  // book is usable when it is not.
  expect(undescribed).not.toContain("alternativeText");
  expect(undescribed).toContain(
    '<meta property="schema:accessModeSufficient">textual,visual</meta>',
  );
});

it("writes the ncx fallback and points the spine at it", () => {
  const opf = contentOpf({ title: "T" }, chapters, "urn:uuid:abc");
  expect(opf).toContain(
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
  );
  expect(opf).toContain('<spine toc="ncx">');

  const ncx = tocNcx("The Salt Road", chapters, "urn:uuid:abc");
  expect(ncx).toContain('<meta name="dtb:uid" content="urn:uuid:abc"/>');
  expect(ncx).toContain('<content src="chapter-01.xhtml"/>');
  expect(ncx).toContain("Chapter &amp; Two");
  expect(ncx).toContain('playOrder="2"');
});

it("gives the nav landmarks so a reader knows where the book starts", () => {
  const nav = navXhtml("T", chapters, "en", true);
  expect(nav).toContain('epub:type="landmarks"');
  expect(nav).toContain('<a epub:type="cover" href="cover.xhtml">Cover</a>');
  expect(nav).toContain(
    '<a epub:type="bodymatter" href="chapter-01.xhtml">Start of content</a>',
  );
});

it("omits the cover landmark when there is no cover page to point at", () => {
  const nav = navXhtml("T", chapters, "en", false);
  expect(nav).toContain('epub:type="landmarks"');
  expect(nav).not.toContain('epub:type="cover"');
});

it("carries the language on every content document, both spellings", () => {
  // xml:lang is what the spec reads; lang is what reading systems read.
  for (const doc of [
    chapterXhtml("C", "<p>x</p>", 1, "fr"),
    navXhtml("T", chapters, "fr"),
    coverXhtml("T", "images/cover.jpeg", "fr"),
  ]) {
    expect(doc).toContain('lang="fr"');
    expect(doc).toContain('xml:lang="fr"');
  }
});

it("gives the cover page a described image", () => {
  const page = coverXhtml("The Salt Road", "images/cover.jpeg");
  expect(page).toContain('src="images/cover.jpeg"');
  expect(page).toContain('alt="Cover of The Salt Road"');
  expect(page).toContain('epub:type="cover"');
});

it("packages the cover and the inline images as real files", async () => {
  // The end-to-end version of the point: no data: URL survives into the
  // package, and everything the OPF references is actually in the zip.
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  const blob = await buildEpub(
    {
      id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      title: "The Salt Road",
      author: "M. Reyes",
      chapters: [{ id: "c1", title: "Chapter One", words: 2 }],
      lastOpenedId: "c1",
      lastOpenedAt: 0,
    },
    [
      {
        title: "Chapter One",
        number: 1,
        doc: {
          type: "doc",
          content: [
            { type: "image", attrs: { src: PNG, alt: "A salt flat" } },
          ],
        },
      },
    ],
    undefined,
    { cover: PNG },
  );

  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const names = Object.keys(zip.files);

  expect(names).toContain("OEBPS/images/cover.png");
  expect(names).toContain("OEBPS/images/img-01.png");
  expect(names).toContain("OEBPS/cover.xhtml");
  expect(names).toContain("OEBPS/toc.ncx");

  const chapter = await zip.file("OEBPS/chapter-01.xhtml")!.async("string");
  expect(chapter).toContain('src="images/img-01.png"');
  expect(chapter).not.toContain("data:image");

  const opf = await zip.file("OEBPS/content.opf")!.async("string");
  // Stable across exports: derived from the book id, not minted afresh.
  expect(opf).toContain("urn:uuid:3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  // The image has alt text, so the accessibility claim is allowed to say so.
  expect(opf).toContain("alternativeText");
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

describe("structural semantics", () => {
  // A reading system cannot tell a copyright page from a chapter by looking at
  // it. Without `epub:type` every generated page is an anonymous body of text
  // that happens to come first.
  it("names each generated front page in EPUB's own vocabulary", () => {
    expect(pageXhtml("T", "<p/>", "en", "titlepage")).toContain(
      'epub:type="titlepage"',
    );
    expect(pageXhtml("T", "<p/>", "en", "toc")).toContain('epub:type="toc"');
  });

  it("declares the epub namespace, or the attribute is not legal", () => {
    expect(pageXhtml("T", "<p/>", "en", "titlepage")).toContain(
      'xmlns:epub="http://www.idpf.org/2007/ops"',
    );
  });

  it("adds no type when there is nothing true to say", () => {
    expect(pageXhtml("T", "<p/>")).not.toContain("epub:type");
  });

  it("marks a chapter as body matter", () => {
    const html = chapterXhtml("Chapter One", "<p>x</p>", 1);
    expect(html).toContain('epub:type="bodymatter chapter"');
    expect(html).toContain('xmlns:epub="http://www.idpf.org/2007/ops"');
  });

  // The summary is read by shops and by readers deciding whether a book is
  // usable, so it may not claim something the book does not do. A novel is
  // sequential; "any order of presentation" was simply untrue.
  it("does not tell a reader a novel can be read in any order", () => {
    // No images, so the text-only summary is the one written.
    const opf = contentOpf(
      { title: "T", author: "A" },
      [{ id: "chapter-01", title: "One" }],
      "urn:uuid:x",
    );
    expect(opf).not.toMatch(/any order of presentation/i);
    expect(opf).toMatch(/sequential chapter navigation/i);
  });
});
