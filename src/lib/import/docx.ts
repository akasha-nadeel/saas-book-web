import { paragraph, type Block, type Inline } from "./blocks";

/**
 * .docx into blocks.
 *
 * A .docx is a zip, and the prose lives in one entry of it as WordprocessingML.
 * Reading it directly costs a walk over `w:p` elements and saves adding a
 * converter dependency for the one file we need out of the archive.
 *
 * Only what the editor can show is read: paragraphs, three heading levels, bold
 * and italic. Styles, tables, images and comments are left behind on purpose —
 * see the note the import screen shows.
 */

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** Attributes are namespaced, and getAttribute("w:val") misses them in XML. */
function wAttr(el: Element | null, name: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(W, name) ?? el.getAttribute(`w:${name}`);
}

function firstChild(parent: Element, local: string): Element | null {
  const found = parent.getElementsByTagNameNS(W, local);
  return found.length ? found[0] : null;
}

/**
 * Word writes heading styles as "Heading1" or "heading 1" depending on version
 * and locale, so the digit is what is trusted rather than the whole name.
 */
function headingLevel(p: Element): 1 | 2 | 3 | null {
  const props = firstChild(p, "pPr");
  if (!props) return null;

  const style = wAttr(firstChild(props, "pStyle"), "val");
  if (!style) return null;

  if (/^title$/i.test(style)) return 1;

  const match = /heading\s*([1-9])/i.exec(style);
  if (!match) return null;
  return Math.min(Number(match[1]), 3) as 1 | 2 | 3;
}

function runInline(run: Element): Inline | null {
  // w:t holds the text; w:tab and w:br are spacing we flatten to a space.
  const texts = Array.from(run.getElementsByTagNameNS(W, "t"))
    .map((t) => t.textContent ?? "")
    .join("");

  const breaks = run.getElementsByTagNameNS(W, "br").length;
  const tabs = run.getElementsByTagNameNS(W, "tab").length;
  const text = texts + (breaks || tabs ? " " : "");
  if (!text) return null;

  const props = firstChild(run, "rPr");
  // <w:b/> means on; <w:b w:val="0"/> means off, and Word emits both.
  const on = (el: Element | null) => {
    if (!el) return false;
    const val = wAttr(el, "val");
    return val === null || !/^(0|false|off)$/i.test(val);
  };

  const bold = on(props ? firstChild(props, "b") : null);
  const italic = on(props ? firstChild(props, "i") : null);

  return {
    text,
    ...(bold ? { bold: true as const } : {}),
    ...(italic ? { italic: true as const } : {}),
  };
}

export async function parseDocx(data: ArrayBuffer): Promise<Block[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(data);

  const entry = zip.file("word/document.xml");
  if (!entry) {
    throw new Error(
      "This .docx has no document body — it may be corrupt, or saved as a template.",
    );
  }

  const xml = await entry.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("This .docx could not be read — the file looks damaged.");
  }

  const blocks: Block[] = [];

  for (const p of Array.from(doc.getElementsByTagNameNS(W, "p"))) {
    const inline: Inline[] = [];
    for (const run of Array.from(p.getElementsByTagNameNS(W, "r"))) {
      const piece = runInline(run);
      if (piece) inline.push(piece);
    }

    const text = inline.map((i) => i.text).join("").trim();
    const level = headingLevel(p);

    if (level && text) {
      blocks.push({ type: "heading", level, inline });
    } else if (text) {
      blocks.push({ type: "paragraph", inline });
    } else {
      // An empty w:p is a blank line, which in a manuscript is a scene break.
      blocks.push(paragraph(""));
    }
  }

  return blocks;
}
