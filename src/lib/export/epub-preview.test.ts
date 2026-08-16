import { describe, expect, it } from "vitest";
import {
  dirOf,
  documentBody,
  documentLang,
  joinPath,
  opfPath,
  spineHrefs,
} from "./epub-preview";
import { containerXml } from "./epub";

describe("opfPath", () => {
  it("reads the package document out of our own container", () => {
    expect(opfPath(containerXml())).toBe("OEBPS/content.opf");
  });

  it("answers null rather than a guess when the container will not parse", () => {
    expect(opfPath("<container><rootfile></container>")).toBeNull();
  });

  it("answers null when there is no rootfile at all", () => {
    expect(opfPath('<?xml version="1.0"?><container/>')).toBeNull();
  });
});

const OPF = (manifest: string, spine: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>${manifest}</manifest>
  <spine>${spine}</spine>
</package>`;

describe("spineHrefs", () => {
  it("returns the spine's order, not the manifest's", () => {
    const opf = OPF(
      `<item id="a" href="a.xhtml" media-type="application/xhtml+xml"/>
       <item id="b" href="b.xhtml" media-type="application/xhtml+xml"/>`,
      `<itemref idref="b"/><itemref idref="a"/>`,
    );
    expect(spineHrefs(opf, "OEBPS/content.opf")).toEqual([
      "OEBPS/b.xhtml",
      "OEBPS/a.xhtml",
    ]);
  });

  it("resolves hrefs against the package document's own directory", () => {
    const opf = OPF(
      `<item id="a" href="text/one.xhtml" media-type="application/xhtml+xml"/>`,
      `<itemref idref="a"/>`,
    );
    expect(spineHrefs(opf, "EPUB/package.opf")).toEqual(["EPUB/text/one.xhtml"]);
  });

  /* The failure this exists to catch: an `itemref` naming an id the manifest
     does not carry is a book that opens on nothing. It comes back as a gap
     rather than as a plausible list one entry short of the truth. */
  it("drops an itemref the manifest cannot name", () => {
    const opf = OPF(
      `<item id="a" href="a.xhtml" media-type="application/xhtml+xml"/>`,
      `<itemref idref="a"/><itemref idref="ghost"/>`,
    );
    expect(spineHrefs(opf, "OEBPS/content.opf")).toEqual(["OEBPS/a.xhtml"]);
  });

  /* A manifest item with no itemref is a resource rather than a page — the
     stylesheet, the images, and nav.xhtml, which EPUB 3 keeps out of the
     spine. None of them is something a reader opens. */
  it("leaves out manifest items the spine does not reference", () => {
    const opf = OPF(
      `<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
       <item id="style" href="style.css" media-type="text/css"/>
       <item id="a" href="a.xhtml" media-type="application/xhtml+xml"/>`,
      `<itemref idref="a"/>`,
    );
    expect(spineHrefs(opf, "OEBPS/content.opf")).toEqual(["OEBPS/a.xhtml"]);
  });

  it("answers with nothing when the package document will not parse", () => {
    expect(spineHrefs("<package><manifest>", "OEBPS/content.opf")).toEqual([]);
  });
});

const XHTML = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
  <head><title>A page</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
  <body epub:type="bodymatter chapter">${body}</body>
</html>`;

describe("documentBody", () => {
  it("keeps what is in the body and drops the head with it", () => {
    const html = documentBody(XHTML("<h1>Chapter One</h1><p>She ran.</p>"), () => null);
    expect(html).toContain("Chapter One");
    expect(html).toContain("She ran.");
    expect(html).not.toContain("stylesheet");
    expect(html).not.toContain("<title>");
  });

  it("repoints a picture at whatever the caller can load", () => {
    const html = documentBody(
      XHTML('<p><img src="images/img-01.webp" alt="A map"/></p>'),
      (src) => (src === "images/img-01.webp" ? "blob:local/1" : null),
    );
    expect(html).toContain('src="blob:local/1"');
    expect(html).toContain('alt="A map"');
    expect(html).not.toContain("images/img-01.webp");
  });

  /* A remote `src` is the one kind the packager leaves alone, and a preview of
     a book containing one has to show what the file contains rather than
     quietly mending it. */
  it("leaves a src the caller cannot resolve exactly as the file states it", () => {
    const html = documentBody(
      XHTML('<img src="https://example.com/far.png"/>'),
      () => null,
    );
    expect(html).toContain("https://example.com/far.png");
  });

  /* The finding worth having. Our own builder runs everything through
     `stripInvalidXml`, so a document that will not parse here is one EPUBCheck
     would refuse — a null is how the pane gets to say so. */
  it("answers null for markup that is not well-formed", () => {
    expect(documentBody("<html><body><p>unclosed</body></html>", () => null)).toBeNull();
  });

  it("answers null for a document with no body", () => {
    expect(
      documentBody('<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"/>', () => null),
    ).toBeNull();
  });
});

/*
 * **The attribute this reads is load-bearing, and it does not look it.**
 * `typesetCss` sets `text-align: justify` and `hyphens: auto` together, and a
 * browser will not hyphenate text whose language it does not know — so a frame
 * with no `lang` sets the book justified and unhyphenated, and the spaces
 * stretch instead of the words breaking. Measured in Chrome, one paragraph in a
 * 180px column: 108px tall with no language, 90px with `lang="en"`. Five lines
 * against six, and the rivers of white gone. Anyone tempted to drop the
 * attribute as decoration should re-run that measurement first.
 */
describe("documentLang", () => {
  it("reads the language off the document's root", () => {
    expect(documentLang(XHTML("<p>She ran.</p>"))).toBe("en");
  });

  it("falls back to xml:lang, which is the one an EPUB must carry", () => {
    const xml =
      '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr"><body/></html>';
    expect(documentLang(xml)).toBe("fr");
  });

  /* Omitted rather than guessed at: hyphenating a Finnish novel by English
     rules is worse than not hyphenating it. */
  it("answers null when the document declares none", () => {
    const xml =
      '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body/></html>';
    expect(documentLang(xml)).toBeNull();
  });

  it("answers null for markup that will not parse", () => {
    expect(documentLang("<html lang=en><body>")).toBeNull();
  });
});

describe("joinPath", () => {
  it("joins an href to the directory it was written in", () => {
    expect(joinPath("OEBPS", "chapter-01.xhtml")).toBe("OEBPS/chapter-01.xhtml");
    expect(joinPath("OEBPS", "images/img-01.webp")).toBe("OEBPS/images/img-01.webp");
  });

  it("walks up out of a subdirectory", () => {
    expect(joinPath("OEBPS/text", "../images/a.png")).toBe("OEBPS/images/a.png");
  });

  it("takes an href at the package root", () => {
    expect(joinPath("", "content.opf")).toBe("content.opf");
  });
});

describe("dirOf", () => {
  it("answers the directory, and nothing at the root", () => {
    expect(dirOf("OEBPS/content.opf")).toBe("OEBPS");
    expect(dirOf("content.opf")).toBe("");
  });
});
