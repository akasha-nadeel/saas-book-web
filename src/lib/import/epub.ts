import type { Block } from "./blocks";
import { parseHtml } from "./html";

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

/** The book's own title, which beats the file name when it is there. */
export async function epubTitle(data: ArrayBuffer): Promise<string | null> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(data);

  const containerEntry = zip.file("META-INF/container.xml");
  if (!containerEntry) return null;

  const container = parseXml(await containerEntry.async("string"), "container");
  const opfPath = byLocalName(container, "rootfile")[0]?.getAttribute(
    "full-path",
  );
  if (!opfPath) return null;

  const opfEntry = zip.file(opfPath);
  if (!opfEntry) return null;

  const opf = parseXml(await opfEntry.async("string"), "content file");
  return byLocalName(opf, "title")[0]?.textContent?.trim() || null;
}
