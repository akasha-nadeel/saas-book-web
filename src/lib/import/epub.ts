import type { Block } from "./blocks";
import { parseHtml } from "./html";
import {
  clean,
  isbnFrom,
  personName,
  publishingFrom,
  subjectsFrom,
  type FileMetadata,
} from "./metadata";

/**
 * .epub into blocks.
 *
 * An EPUB is a zip whose chapters are XHTML, so the work is finding them in the
 * right order and handing each to the HTML parser. The order is the spine, not
 * the file listing: a zip has no meaningful order of its own, and reading the
 * entries as they happen to be stored would shuffle the book.
 */

/** Resolves an OPF-relative href against the directory the OPF sits in. */
function resolve(base: string, href: string): string {
  const clean = href.split("#")[0];
  const dir = base.includes("/") ? base.slice(0, base.lastIndexOf("/") + 1) : "";

  const parts = (dir + clean).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function parseXml(xml: string, what: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error(`This EPUB could not be read — its ${what} is damaged.`);
  }
  return doc;
}

/** Namespace-agnostic: EPUB 2 and 3 differ, and some files declare neither. */
function byLocalName(root: Document | Element, local: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter(
    (el) => el.localName === local,
  );
}

export async function parseEpub(data: ArrayBuffer): Promise<Block[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(data);

  const containerEntry = zip.file("META-INF/container.xml");
  if (!containerEntry) {
    throw new Error("This EPUB is missing its container file.");
  }

  const container = parseXml(await containerEntry.async("string"), "container");
  const opfPath = byLocalName(container, "rootfile")[0]?.getAttribute(
    "full-path",
  );
  if (!opfPath) throw new Error("This EPUB does not say where its content is.");

  const opfEntry = zip.file(opfPath);
  if (!opfEntry) throw new Error("This EPUB's content file is missing.");

  const opf = parseXml(await opfEntry.async("string"), "content file");

  // id -> href, so the spine's idrefs can be turned into paths.
  const hrefById = new Map<string, string>();
  for (const item of byLocalName(opf, "item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) hrefById.set(id, resolve(opfPath, href));
  }

  const blocks: Block[] = [];

  for (const ref of byLocalName(opf, "itemref")) {
    // linear="no" marks matter a reader skips — covers, adverts.
    if (ref.getAttribute("linear") === "no") continue;

    const idref = ref.getAttribute("idref");
    const path = idref ? hrefById.get(idref) : null;
    if (!path) continue;

    const entry = zip.file(path);
    if (!entry) continue;

    blocks.push(...parseHtml(await entry.async("string")));
  }

  if (!blocks.length) {
    throw new Error("This EPUB has no readable text in it.");
  }

  return blocks;
}

/**
 * Every `dc:*` value of one name, in document order.
 *
 * By local name, like everything else here: EPUB 2 and 3 declare the Dublin
 * Core namespace differently and a handful of files declare it not at all.
 * Filtered to the metadata block, or `dc:title` would also match the `<title>`
 * of any XHTML that happened to be in the same document.
 */
function dcValues(opf: Document, local: string): string[] {
  const meta = byLocalName(opf, "metadata")[0];
  if (!meta) return [];
  return byLocalName(meta, local)
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean);
}

/**
 * The path of the cover image, by the two mechanisms a shop actually reads.
 *
 * Pure, and separate from the unzipping for exactly that reason — which item
 * is the cover is the part with rules in it, and the part worth a test.
 *
 * Both are checked because which one a given file uses is not knowable in
 * advance: `properties="cover-image"` is the EPUB 3 way, `<meta name="cover">`
 * pointing at a manifest id is the EPUB 2 way, and our own writer emits both
 * for the same reason. Nothing is guessed from a file name — a manifest entry
 * called `cover.jpg` that no shop is told about is not a cover, and reporting
 * one that a validator will not find is worse than reporting none.
 */
export function coverHrefFrom(opf: Document, opfPath: string): string | null {
  const items = byLocalName(opf, "item");

  const declared = items.find((item) =>
    (item.getAttribute("properties") ?? "").split(/\s+/).includes("cover-image"),
  );
  if (declared?.getAttribute("href")) {
    return resolve(opfPath, declared.getAttribute("href")!);
  }

  const pointer = byLocalName(opf, "meta").find(
    (meta) => meta.getAttribute("name") === "cover",
  );
  const id = pointer?.getAttribute("content");
  if (!id) return null;

  const item = items.find((candidate) => candidate.getAttribute("id") === id);
  const href = item?.getAttribute("href");
  // The pointer is only believed when it lands on an image. Some files aim it
  // at the cover *page* — an XHTML document — and packaging that as artwork
  // would produce a broken picture rather than a missing one.
  if (!href || !(item?.getAttribute("media-type") ?? "").startsWith("image/")) {
    return null;
  }
  return resolve(opfPath, href);
}

/**
 * A publication date a shop will accept, or nothing.
 *
 * `dc:date` is legitimately a full timestamp — `2019-03-04T00:00:00Z` is a
 * normal thing to find in a real book — while the listing field is a plain
 * `YYYY-MM-DD` and `storeReadiness` refuses anything else. Passing the
 * timestamp through would have imported a valid EPUB and then reported a
 * *blocking* problem with it, which is our bug wearing the writer's name.
 */
function dateFrom(values: readonly string[]): string | undefined {
  for (const value of values) {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (match) return match[1];
  }
  return undefined;
}

/** Blurbs are often written as HTML. The listing field is text. */
function textOf(html: string | undefined): string | undefined {
  if (!html) return undefined;
  if (!html.includes("<")) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return clean(doc.body.textContent);
}

/**
 * Everything the EPUB says about itself, including its cover.
 *
 * The cover is turned into a stored-cover-sized data URL here rather than
 * handed back as bytes, so that one answer serves both callers: the check that
 * reports whether the file has one, and the import that keeps it. `hasCover`
 * is reported from the *manifest* rather than from that conversion succeeding
 * — see the note on `FileMetadata`.
 */
export async function epubMetadata(data: ArrayBuffer): Promise<FileMetadata> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(data);

  const containerEntry = zip.file("META-INF/container.xml");
  if (!containerEntry) return {};

  const container = parseXml(await containerEntry.async("string"), "container");
  const opfPath = byLocalName(container, "rootfile")[0]?.getAttribute(
    "full-path",
  );
  if (!opfPath) return {};

  const opfEntry = zip.file(opfPath);
  if (!opfEntry) return {};

  const opf = parseXml(await opfEntry.async("string"), "content file");

  const coverPath = coverHrefFrom(opf, opfPath);
  let cover: string | undefined;
  if (coverPath) {
    const { epubCover } = await import("./cover");
    cover = (await epubCover(zip, coverPath)) ?? undefined;
  }

  return {
    title: clean(dcValues(opf, "title")[0]),
    // "Unknown" is what a converter writes when the source had no author, and
    // it reaches a shop as a pen name if nobody notices.
    author: personName(dcValues(opf, "creator")[0]),
    ...(cover ? { cover } : {}),
    ...(coverPath ? { hasCover: true } : {}),
    publishing: publishingFrom({
      isbn: isbnFrom(dcValues(opf, "identifier")),
      language: clean(dcValues(opf, "language")[0]),
      publisher: clean(dcValues(opf, "publisher")[0]),
      description: textOf(clean(dcValues(opf, "description")[0])),
      rights: clean(dcValues(opf, "rights")[0]),
      subjects: subjectsFrom(dcValues(opf, "subject")),
      published: dateFrom(dcValues(opf, "date")),
    }),
  };
}
