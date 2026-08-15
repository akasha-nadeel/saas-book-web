import type { PrintCover } from "../cover-store";
import type { PublishingMeta } from "../publishing";
import {
  blockText,
  countWords,
  isBlank,
  toDoc,
  type Block,
} from "./blocks";

/**
 * Cutting a manuscript into chapters.
 *
 * This is the part of importing that is guesswork, so it guesses in a fixed
 * order and stops at the first thing that works:
 *
 *   1. Headings, if the document has them. A writer who used Heading 1 in Word
 *      or `##` in Markdown has already said where the chapters are.
 *   2. Failing that, lines that read like chapter openers — "Chapter Four",
 *      "Prologue" — on a line of their own.
 *   3. Failing that, one chapter. A single long chapter is honest; chopping a
 *      manuscript at arbitrary points is not, and the writer can split it
 *      themselves in an editor that shows them what they are doing.
 */

export interface ImportedChapter {
  title: string;
  doc: ReturnType<typeof toDoc>;
  words: number;
  /**
   * Which part of the book, when the file said so.
   *
   * Only an EPUB does — `epub:type` names the part on every document — and
   * only then is this set. Absent means the body, as everywhere else.
   */
  matter?: "front" | "back";
}

/**
 * A parsed file, ready to be checked or made into a book.
 *
 * `splitIntoChapters` fills in the first two. The rest are what the file said
 * about itself and are added by `importFile` on top — absent for the formats
 * that carry nothing (a .txt is prose and nothing else), and absent field by
 * field for the ones that carry some of it. See `metadata.ts` for why they are
 * kept rather than dropped at the door.
 */
export interface ImportedBook {
  title: string;
  chapters: ImportedChapter[];
  author?: string;
  /** A data URL inside the cover budget. */
  cover?: string;
  /** The same artwork at full size, for the export — see `cover-store.ts`. */
  printCover?: PrintCover;
  /** Whether the file has cover artwork, storable or not. */
  hasCover?: boolean;
  publishing?: PublishingMeta;
}

/**
 * A line like "Chapter 9", "PART TWO", "Prologue". Anchored and length-capped
 * so a sentence that merely begins with the word "Chapter" is not mistaken for
 * a heading.
 */
const CHAPTER_LINE =
  /^\s*(chapter|part|book|prologue|epilogue|interlude)\b[\s.:—–-]*(.{0,40})$/i;

export function looksLikeChapterLine(block: Block): boolean {
  if (block.type !== "paragraph") return false;
  const text = blockText(block).trim();
  if (!text || text.length > 60) return false;
  return CHAPTER_LINE.test(text);
}

/** Trims blank blocks from both ends without touching the middle. */
function trimBlanks(blocks: Block[]): Block[] {
  let start = 0;
  let end = blocks.length;
  while (start < end && isBlank(blocks[start])) start += 1;
  while (end > start && isBlank(blocks[end - 1])) end -= 1;
  return blocks.slice(start, end);
}

function makeChapter(title: string, blocks: Block[]): ImportedChapter | null {
  const trimmed = trimBlanks(blocks);
  const words = countWords(trimmed);
  // A heading with nothing under it is a contents entry, not a chapter.
  // Keeping them would import a table of contents as a run of empty chapters.
  if (!trimmed.length) return null;
  return { title: title.trim() || "Untitled chapter", doc: toDoc(trimmed), words };
}

/**
 * Which heading level marks a chapter.
 *
 * A manuscript titled with a lone H1 and chaptered in H2 is the common shape,
 * so the level that appears more than once wins. Returns null when headings
 * cannot be the answer.
 */
function chapterHeadingLevel(
  blocks: readonly Block[],
  /** See `declared` on `splitIntoChapters`. */
  declared = false,
): 1 | 2 | 3 | null {
  const countAt = (level: number) =>
    blocks.filter((b) => b.type === "heading" && (b.level ?? 2) === level)
      .length;

  for (const level of [1, 2, 3] as const) {
    if (countAt(level) >= 2) return level;
  }

  /*
   * One heading of a level is a title, not a divider — there is nothing for it
   * to divide. That holds for a file handed over whole, and is wrong for one
   * document out of an EPUB spine, where the file has *already* said this is
   * one chapter: its single heading is the chapter's name, not the book's.
   *
   * Tried second, never first. A spine document holding the whole book — one
   * H1 for the title above a run of H2 chapters — has to keep splitting on the
   * H2s, and checking `>= 1` from the top would have seized on the lone H1 and
   * returned the entire book as a single chapter.
   */
  if (declared) {
    for (const level of [1, 2, 3] as const) {
      if (countAt(level) >= 1) return level;
    }
  }

  return null;
}

function splitAt(
  blocks: readonly Block[],
  isDivider: (block: Block) => boolean,
  titleOf: (block: Block) => string,
): ImportedChapter[] {
  // Gather (title, blocks) sections first, then convert. Keeping the blocks
  // around lets any lead-in — text before the first divider — be folded into
  // the opening chapter rather than becoming a separate "Opening" one. A book
  // reads as clean Chapter 1, 2, 3, and no words are lost.
  const sections: { title: string; blocks: Block[] }[] = [];
  let lead: Block[] = [];
  let title = "";
  let current: Block[] = [];
  let seenDivider = false;

  for (const block of blocks) {
    if (isDivider(block)) {
      if (!seenDivider) {
        // Whatever came before the first heading is held aside to prepend.
        lead = current;
      } else {
        sections.push({ title, blocks: current });
      }
      title = titleOf(block);
      current = [];
      seenDivider = true;
      continue;
    }
    current.push(block);
  }

  sections.push({ title, blocks: current });

  // Fold the lead-in into the first chapter, above its own text.
  if (sections.length && lead.some((b) => !isBlank(b))) {
    sections[0].blocks = [...lead, ...sections[0].blocks];
  }

  const chapters: ImportedChapter[] = [];
  for (const section of sections) {
    const chapter = makeChapter(section.title, section.blocks);
    if (chapter) chapters.push(chapter);
  }
  return chapters;
}

/**
 * @param fallbackTitle usually the file name, used when the document does not
 * name itself.
 */
export function splitIntoChapters(
  blocks: readonly Block[],
  fallbackTitle: string,
  /**
   * Whether these blocks are one document the *file* declared, rather than a
   * whole manuscript to be carved up.
   *
   * Only an EPUB can say this, because only an EPUB ships one document per
   * spine entry. It changes exactly one thing — a lone heading is read as this
   * document's own name instead of being left in the text — and that is what
   * stops a one-chapter book coming back named after itself. See
   * `chapterHeadingLevel`.
   */
  declared = false,
): ImportedBook {
  const level = chapterHeadingLevel(blocks, declared);

  // A lone H1 above a document chaptered in H2 is the book's own title. It then
  // leaves the text, or it opens the book as a stray chapter containing nothing
  // but the title again.
  const leadHeading = blocks.find((b) => b.type === "heading");
  const leadIsTitle =
    leadHeading !== undefined &&
    level !== null &&
    (leadHeading.level ?? 2) < level &&
    blockText(leadHeading).trim() !== "";

  const title = leadIsTitle ? blockText(leadHeading).trim() : fallbackTitle;
  const body = leadIsTitle ? blocks.filter((b) => b !== leadHeading) : blocks;

  let chapters: ImportedChapter[];

  if (level !== null) {
    chapters = splitAt(
      body,
      (b) => b.type === "heading" && (b.level ?? 2) === level,
      (b) => blockText(b),
    );
  } else if (body.some(looksLikeChapterLine)) {
    chapters = splitAt(body, looksLikeChapterLine, (b) => blockText(b));
  } else {
    const only = makeChapter(fallbackTitle, [...body]);
    chapters = only ? [only] : [];
  }

  // Never hand back a book with nothing in it: the editor's routes assume a
  // chapter exists.
  if (!chapters.length) {
    chapters = [{ title: "Chapter One", doc: toDoc([]), words: 0 }];
  }

  return { title: title.trim() || "Untitled Book", chapters };
}
