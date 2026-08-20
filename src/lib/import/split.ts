import type { PrintCover } from "../cover-store";
import { isGenericChapterTitle } from "../library-store";
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

/**
 * The chapter's real name, when the import is about to leave it in the prose.
 *
 * **The commonest manuscript shape puts the number and the name on two
 * different lines**, and only the first of them is the divider:
 *
 *     <h1>Chapter Two</h1>
 *     <h2>The House by the Sea</h2>
 *
 * `splitAt` consumes the `h1` as the title and has no reason to touch the `h2`,
 * which is not the divider level — so the chapter arrives titled "Chapter Two"
 * with its actual name sitting as the first block of its own body. Measured on
 * a real library: 23 chapters across three books, and the cost is not cosmetic.
 * The generated contents page, the EPUB nav and the PDF running heads all read
 * the *title*, so such a book exports a table of contents that says "CHAPTER
 * TWO" nine times instead of naming anything.
 *
 * Three guards, and each is load-bearing:
 *
 * - **Only when the title is generic.** `isGenericChapterTitle` is the store's
 *   own answer and is reused rather than re-expressed, for the reason
 *   `chapterNumeral` gives: a rule two places apply cannot be two expressions
 *   that might disagree. A chapter with a real name keeps its heading, because
 *   there that heading is the author's own subhead — 21 of the 44 chapters that
 *   open with one are exactly that, and taking those would be losing text.
 * - **Only the first block, and only a heading.** Anything else is prose.
 * - **Never the last block standing.** A lone heading with nothing under it
 *   would leave a titled chapter with an empty body; left alone it stays what
 *   it was.
 */
function nameFromLeadingHeading(title: string, blocks: Block[]): string | null {
  if (!isGenericChapterTitle(title)) return null;
  if (blocks.length < 2) return null;
  if (blocks[0].type !== "heading") return null;
  return blockText(blocks[0]).trim() || null;
}

function makeChapter(title: string, blocks: Block[]): ImportedChapter | null {
  const trimmed = trimBlanks(blocks);
  // A heading with nothing under it is a contents entry, not a chapter.
  // Keeping them would import a table of contents as a run of empty chapters.
  if (!trimmed.length) return null;

  // Lifted before the word count and before `toDoc`, which is the whole reason
  // this lives here: `makeChapter` is the one funnel every body chapter passes
  // through from every format, and the last place the body is still `Block[]`.
  const lifted = nameFromLeadingHeading(title, trimmed);
  const body = lifted ? trimmed.slice(1) : trimmed;

  return {
    title: (lifted ?? title).trim() || "Untitled chapter",
    doc: toDoc(body),
    words: countWords(body),
  };
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

/** What an import decided, counted by part. */
export interface ImportSummary {
  front: number;
  /** Numbered chapters — the body, which is what the writer counts in. */
  body: number;
  back: number;
}

/**
 * What the import made of the file, in three numbers.
 *
 * **Structure detection is a guess, and until now it was a silent one.** The
 * importer reads each heading against the table of standard divisions and calls
 * everything it does not recognise a chapter — the right default, and the reason
 * `matterDivisionOf` answers null so often. But an unrecognised heading is also
 * how a book quietly gains a chapter it does not have: a bare "END" became the
 * last chapter of somebody's novel and took a chapter number with it, so every
 * chapter after it counted one too high and chapter nine printed "Chapter Ten".
 *
 * Nothing on screen said what had been decided, so there was nothing to
 * disagree with. Three numbers in the banner is the smallest honest answer: a
 * writer who knows their book has no front matter can see eight pages of it and
 * look, and one whose novel has twelve chapters can see thirteen.
 *
 * Counted here rather than at each call site because there are three of them —
 * the two chapter-import paths and the new-book one — and three tallies of the
 * same thing is how they come to disagree. Pure, and tested.
 */
export function importSummary(
  chapters: readonly { matter?: "front" | "back" }[],
): ImportSummary {
  const summary: ImportSummary = { front: 0, body: 0, back: 0 };
  for (const chapter of chapters) {
    // Absent is the body, exactly as `chapterMatterOf` reads it in the store.
    summary[chapter.matter ?? "body"] += 1;
  }
  return summary;
}
