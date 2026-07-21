import type { Block } from "./blocks";
import { splitIntoChapters, type ImportedBook } from "./split";

/**
 * Turning a file the writer already has into a book.
 *
 * The formats below are the ones that can be read honestly in a browser with no
 * server. Everything else is refused by name rather than half-read: a manuscript
 * that imports as mojibake is worse than one that does not import, because the
 * writer has to notice before they can do anything about it.
 *
 * Deliberately absent:
 *   .doc   — the pre-2007 binary format. Not readable without a converter.
 *   .pdf   — a description of ink on pages. Text can be scraped out, but
 *            paragraphs, italics and chapter breaks do not survive, and a
 *            mangled novel is not a favour.
 *   .rtf   — readable in principle, rare enough in practice to be dead weight.
 */

export interface ImportFormat {
  /** Lower-case, with the dot. */
  extension: string;
  label: string;
}

export const IMPORT_FORMATS: readonly ImportFormat[] = [
  { extension: ".docx", label: "Word" },
  { extension: ".epub", label: "EPUB" },
  { extension: ".md", label: "Markdown" },
  { extension: ".txt", label: "Plain text" },
  { extension: ".html", label: "HTML" },
];

/** For the file picker's accept attribute. */
export const IMPORT_ACCEPT = ".docx,.epub,.md,.markdown,.txt,.html,.htm";

/** Beyond this a book cannot be stored, so it is refused before it is parsed. */
export const MAX_IMPORT_BYTES = 8_000_000;

export class ImportError extends Error {}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

/** The file name without its extension, tidied into something book-shaped. */
export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

const SUPPORTED = "Supported: .docx, .epub, .md, .txt, .html";

export async function importFile(file: File): Promise<ImportedBook> {
  const extension = extensionOf(file.name);

  if (file.size > MAX_IMPORT_BYTES) {
    throw new ImportError(
      `That file is ${(file.size / 1_000_000).toFixed(1)} MB. Books are stored in this browser, which cannot hold one that large.`,
    );
  }

  const fallbackTitle = titleFromFileName(file.name) || "Untitled Book";
  let blocks: Block[];
  let title = fallbackTitle;

  switch (extension) {
    case ".txt": {
      const { parseText } = await import("./plain-text");
      blocks = parseText(await file.text(), false);
      break;
    }
    case ".md":
    case ".markdown": {
      const { parseText } = await import("./plain-text");
      blocks = parseText(await file.text(), true);
      break;
    }
    case ".html":
    case ".htm": {
      const { parseHtml } = await import("./html");
      blocks = parseHtml(await file.text());
      break;
    }
    case ".docx": {
      const { parseDocx } = await import("./docx");
      blocks = await parseDocx(await file.arrayBuffer());
      break;
    }
    case ".epub": {
      const data = await file.arrayBuffer();
      const { parseEpub, epubTitle } = await import("./epub");
      blocks = await parseEpub(data);
      title = (await epubTitle(data)) ?? fallbackTitle;
      break;
    }
    case ".doc":
      throw new ImportError(
        `.doc is Word's old format and cannot be read here. Open it in Word and “Save As” .docx first. ${SUPPORTED}`,
      );
    case ".pdf":
      throw new ImportError(
        `PDF describes pages rather than text, so chapters, italics and paragraph breaks do not survive the trip. Export your manuscript as .docx instead. ${SUPPORTED}`,
      );
    case "":
      throw new ImportError(
        `That file has no extension, so its format cannot be told. ${SUPPORTED}`,
      );
    default:
      throw new ImportError(`${extension} files cannot be read. ${SUPPORTED}`);
  }

  const hasText = blocks.some((b) => b.inline.some((i) => i.text.trim()));
  if (!hasText) {
    throw new ImportError(
      "There is no text in that file. If the words are inside images, they cannot be read.",
    );
  }

  const book = splitIntoChapters(blocks, title);
  // The EPUB's own metadata title beats a heading guessed from the text.
  return extension === ".epub" ? { ...book, title } : book;
}
