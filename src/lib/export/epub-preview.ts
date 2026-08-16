/**
 * Reading a finished EPUB back, so the preview can show the file rather than a
 * second rendering of the book.
 *
 * **The wizard's EPUB pane used to stop one step short.** It rendered the XHTML
 * `buildEpub` *would* write, under the stylesheet `buildEpub` *would* write,
 * in the order `bindBook` gives — all correct, and all of it computed a second
 * time rather than read out of the file. Three things the packager does were
 * therefore invisible to it: `extractImages` lifting data URLs into real
 * `OEBPS/images/` entries, the manifest and spine that decide what a reading
 * system actually opens and in what order, and `container.xml` pointing at the
 * package document at all. A preview cannot check the half of the build it
 * skips.
 *
 * So the pane builds the real `.epub`, opens the zip, and renders what is
 * inside it. This module is the part of that with no browser in it: given the
 * container, the package document and a spine document's markup, it answers
 * which files to show, in what order, and what is inside each one.
 *
 * **A parse failure is a finding, not a nuisance.** These documents come out of
 * our own builder and `stripInvalidXml` exists to guarantee they are
 * well-formed XML, so anything that will not parse here is a book EPUBCheck
 * would refuse and every shop would reject. The functions return null rather
 * than throwing, and the pane says so — which makes this the one place in the
 * app where opening the preview is also a check that the file is valid XML.
 */

/**
 * Where the package document is, read from the container.
 *
 * Ours is always `OEBPS/content.opf`, and it is read rather than assumed for
 * the reason the whole module exists: a hard-coded path would make the preview
 * agree with the builder even if `container.xml` pointed somewhere else, which
 * is precisely the class of mistake this is meant to catch.
 */
export function opfPath(containerXml: string): string | null {
  const doc = parseXml(containerXml);
  if (!doc) return null;
  const rootfile = doc.getElementsByTagName("rootfile")[0];
  const path = rootfile?.getAttribute("full-path")?.trim();
  return path || null;
}

/**
 * The spine's documents, in reading order, as paths inside the zip.
 *
 * The manifest maps an id to an href and the spine lists ids, so the two have
 * to be read together — which is the point: an `itemref` naming an id the
 * manifest does not carry is a book that opens to nothing, and it comes back
 * here as a gap rather than as a plausible-looking list.
 *
 * Hrefs in the package document are relative to the package document, so they
 * are resolved against its own directory before being handed back.
 */
export function spineHrefs(opfXml: string, opfHref: string): string[] {
  const doc = parseXml(opfXml);
  if (!doc) return [];

  const hrefs = new Map<string, string>();
  for (const item of Array.from(doc.getElementsByTagName("item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) hrefs.set(id, href);
  }

  const base = dirOf(opfHref);
  return Array.from(doc.getElementsByTagName("itemref"))
    .map((ref) => ref.getAttribute("idref"))
    .map((id) => (id ? hrefs.get(id) : undefined))
    .filter((href): href is string => Boolean(href))
    .map((href) => joinPath(base, href));
}

/**
 * What is inside a spine document's `<body>`, with its pictures repointed.
 *
 * The pane shows every document in one frame, one sheet each, so each has to
 * give up its body and lose its own `<html>` and `<head>`. Its stylesheet link
 * goes with them — there is one stylesheet in an EPUB and the frame carries it
 * once.
 *
 * `resolveImage` is handed each `src` exactly as the file states it — relative
 * to the document — and answers with something a browser can load, which in
 * practice is a blob URL made from the zip entry. Answering null leaves the
 * `src` alone: a remote image is the one kind the packager does not rewrite,
 * and a preview of a book containing one should show what the file contains.
 */
export function documentBody(
  xhtml: string,
  resolveImage: (src: string) => string | null,
): string | null {
  const doc = parseXml(xhtml);
  if (!doc) return null;

  const body = doc.getElementsByTagName("body")[0];
  if (!body) return null;

  for (const img of Array.from(body.getElementsByTagName("img"))) {
    const src = img.getAttribute("src");
    if (!src) continue;
    const resolved = resolveImage(src);
    if (resolved) img.setAttribute("src", resolved);
  }

  const serializer = new XMLSerializer();
  return Array.from(body.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join("");
}

/**
 * A relative href resolved against the directory it was written in.
 *
 * Enough of a URL resolver for what an EPUB contains, and deliberately not
 * more: package paths are zip entry names, so `new URL()` would need a base
 * origin invented for it and would percent-encode names that are keys in a zip
 * rather than parts of a URL.
 */
export function joinPath(dir: string, href: string): string {
  // An absolute-looking path in a package is relative to the package root.
  const parts = (dir ? `${dir}/${href}` : href).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/** The directory part of a path, or "" at the root. */
export function dirOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
}

/**
 * The language a spine document declares, so a frame can inherit it.
 *
 * **Not cosmetic: `hyphens: auto` does nothing without it.** A browser needs to
 * know the language before it can pick a hyphenation dictionary, so a document
 * with no `lang` is set justified and *unhyphenated* — which on a narrow column
 * means the spaces stretch instead of the words breaking, and the preview grows
 * rivers of white the real file does not have. Measured in Chrome on one
 * paragraph at 180px: 108px tall with no language, 90px with `lang="en"`.
 *
 * The EPUB's own documents all carry it — `pageXhtml` and `chapterXhtml` write
 * `lang` and `xml:lang` on `<html>` — and the preview takes each document's
 * *body* and leaves its `<html>` behind, which is where the attribute was.
 */
export function documentLang(xhtml: string): string | null {
  const doc = parseXml(xhtml);
  const html = doc?.documentElement;
  const lang = html?.getAttribute("lang") ?? html?.getAttribute("xml:lang");
  return lang?.trim() || null;
}

/**
 * XML, or null.
 *
 * `DOMParser` reports a failure by *returning a document* whose root is
 * `parsererror` rather than by throwing, and a caller that does not check gets
 * a document full of the browser's own error prose where the book should be.
 * Namespaced, because Firefox puts that element in a namespace of its own and
 * a plain tag-name check misses it there.
 */
function parseXml(text: string): Document | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(text, "application/xhtml+xml");
  const failed =
    doc.getElementsByTagName("parsererror").length > 0 ||
    doc.getElementsByTagNameNS(
      "http://www.mozilla.org/newlayout/xml/parsererror.xml",
      "parsererror",
    ).length > 0;
  return failed ? null : doc;
}
