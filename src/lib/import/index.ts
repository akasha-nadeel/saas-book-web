import type { BookSetup } from "../library-store";
import type { Block } from "./blocks";
import type { FileMetadata } from "./metadata";
import { countWords, toDoc } from "./blocks";
import {
  splitIntoChapters,
  type ImportedBook,
  type ImportedChapter,
} from "./split";
import type { EpubSection } from "./epub";

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

/**
 * What a parsed file contributes to the book made from it.
 *
 * Here, and used by all three callers, because "keep the author" is the kind
 * of line that gets added to one import screen and forgotten on the other two
 * — and the failure is silent, since a book with no author looks exactly like
 * a book whose file never had one. The screens differ in what *they* add on
 * top (the dialog offers a kind and a genre); none of them differ in this.
 */
export function setupFromImport(book: ImportedBook): BookSetup {
  return {
    ...(book.author ? { author: book.author } : {}),
    ...(book.cover ? { cover: book.cover } : {}),
    ...(book.publishing ? { publishing: book.publishing } : {}),
  };
}

export async function importFile(file: File): Promise<ImportedBook> {
  const extension = extensionOf(file.name);

  if (file.size > MAX_IMPORT_BYTES) {
    throw new ImportError(
      `That file is ${(file.size / 1_000_000).toFixed(1)} MB. Books are stored in this browser, which cannot hold one that large.`,
    );
  }

  const fallbackTitle = titleFromFileName(file.name) || "Untitled Book";
  let blocks: Block[];
  /** Only an EPUB fills this in — see the `.epub` case. */
  let sections: EpubSection[] = [];
  let title = fallbackTitle;
  /*
   * What the file said about itself, for the formats that say anything.
   *
   * Read here rather than inside each parser because it is not part of turning
   * a file into prose — it is the answer to a different question, and the one
   * the readiness check asks. See `metadata.ts`: an EPUB that carries a cover,
   * an author and an ISBN must not be told it has none of them.
   */
  let metadata: FileMetadata = {};

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
      const data = await file.arrayBuffer();
      const { parseDocx, docxMetadata } = await import("./docx");
      blocks = await parseDocx(data);
      metadata = await docxMetadata(data);
      // Word's Properties title is filled in about as often as it is left at
      // the file name, so it is only believed when the document has one.
      title = metadata.title ?? fallbackTitle;
      break;
    }
    case ".epub": {
      const data = await file.arrayBuffer();
      const { parseEpub, epubMetadata } = await import("./epub");
      /* **The one format that says which page is which**, so it is the one
         format whose structure is kept rather than re-derived from headings.
         See `matterPages` below. */
      sections = await parseEpub(data);
      blocks = sections.flatMap((s) => s.blocks);
      metadata = await epubMetadata(data);
      title = metadata.title ?? fallbackTitle;
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

  /*
   * **Front and back matter come out as pages, not as chapters.**
   *
   * Everything used to be flattened into one block stream and re-split on
   * headings, which threw away the only thing an EPUB is reliably good at
   * saying: `epub:type` on each document names the part and often the
   * division. The cost was visible the moment this app could read a book it
   * had just written — the half-title, title page and copyright merged into a
   * body chapter called "Chapter 1 – Dedication", because apparatus pages
   * print no heading to split on and a dedication does.
   *
   * **The body is split per declared document, not as one pile.** It used to
   * be flattened here too, and that threw away the same information twice: a
   * book of one chapter has one heading, `chapterHeadingLevel` needs two of a
   * level before it will divide on them, so the whole thing fell through to
   * "one chapter named after the file" — and the chapter's own `<h1>` stayed
   * sitting in the prose. Exporting a one-chapter book and reading it back
   * gave a chapter called *The Salt Ledger* whose body opened with a heading
   * saying *Chapter One*; export that again and both print, one under the
   * other. Splitting each spine document on its own believes what the file
   * already said, and `splitAt` consumes the heading it divides on, so the
   * duplicate goes with it.
   *
   * Every other format — and an EPUB that says nothing about itself — has no
   * sections and takes the same path it always did.
   */
  const matter = sections.filter((s) => s.matter && s.blocks.length);
  const bodySections = sections.filter((s) => !s.matter && s.blocks.length);

  const book = bodySections.length
    ? {
        title,
        chapters: bodySections.flatMap(
          (section) =>
            splitIntoChapters(section.blocks, section.title || title, true)
              .chapters,
        ),
      }
    : splitIntoChapters(blocks, title);
  const pages: ImportedChapter[] = matter.map((section, i) => ({
    title: section.title || `Page ${i + 1}`,
    doc: toDoc(section.blocks),
    words: countWords(section.blocks),
    matter: section.matter,
  }));

  return {
    ...book,
    ...(pages.length ? { chapters: [...pages, ...book.chapters] } : {}),
    // A title the file *declared* beats one guessed out of its own text. The
    // guess is good — a lone H1 above H2 chapters really is the book's title —
    // but it is still a guess, and `dc:title` is not.
    ...(metadata.title ? { title: metadata.title } : {}),
    ...(metadata.author ? { author: metadata.author } : {}),
    ...(metadata.cover ? { cover: metadata.cover } : {}),
    ...(metadata.printCover ? { printCover: metadata.printCover } : {}),
    ...(metadata.hasCover ? { hasCover: true } : {}),
    ...(metadata.publishing ? { publishing: metadata.publishing } : {}),
  };
}
