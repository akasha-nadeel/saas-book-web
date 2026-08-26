import type { PrintCover } from "../cover-store";
import { isGenericChapterTitle } from "../library-store";
import { matterDivisionInPart, type MatterPart } from "../matter";
import { nounFor, plural } from "../plural";
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

/**
 * A line that opens a page **of a part the writer has named**.
 *
 * `CHAPTER_LINE` above is a closed vocabulary — chapter, part, book, prologue,
 * epilogue, interlude — and it has to be, because it runs on files nobody has
 * said anything about. The cost shows up the moment somebody has: a back-matter
 * document with no heading styles, whose divisions read "Epilogue",
 * "Afterword", "Acknowledgements", "About the Author", "Glossary", splits
 * exactly *once*. Only "Epilogue" is in the vocabulary, so all eight sections
 * arrive as one page called Epilogue with the other seven buried in it, and the
 * feature looks broken when the file was fine.
 *
 * Importing into one card is the writer saying which part the file is, and that
 * is what makes this safe: the names being added to the vocabulary are the
 * names of *that part's own pages*, and a file the writer has declared to be
 * back matter is not a file whose chapters can be stolen. See
 * `matterDivisionInPart` for the two liberties it takes and why neither belongs
 * in the general rule.
 *
 * Same shape and same guards as `looksLikeChapterLine`: a short paragraph
 * standing on its own, never a sentence that merely begins with the word.
 */
export function looksLikeMatterLine(block: Block, part: MatterPart): boolean {
  if (block.type !== "paragraph") return false;
  const text = blockText(block).trim();
  if (!text || text.length > 60) return false;
  return matterDivisionInPart(text, part) !== null;
}

/**
 * The divider test the no-headings path uses: the standing vocabulary, plus
 * the named part's own pages when the writer has named one.
 */
function opensAPage(block: Block, part: MatterPart | undefined): boolean {
  if (looksLikeChapterLine(block)) return true;
  return part !== undefined && looksLikeMatterLine(block, part);
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
  /**
   * The part of the book this whole file is, when the writer has said.
   *
   * Set only by an import aimed at one of the panel's cards. It widens the
   * divider vocabulary to that part's own page names (`looksLikeMatterLine`)
   * and nothing else — **the heading path above is untouched**, because a file
   * that already says where its divisions are is still believed first.
   */
  part?: MatterPart,
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
  } else if (body.some((b) => opensAPage(b, part))) {
    chapters = splitAt(body, (b) => opensAPage(b, part), (b) => blockText(b));
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

/**
 * The same three numbers as English: `["8 front pages", "12 chapters"]`.
 *
 * **A part with nothing in it is left out rather than printed as a zero** —
 * most imports are chapters and nothing else, and "0 front pages" is noise on
 * the common case.
 *
 * `plural` carries the number and `nounFor` does not, because the two matter
 * parts read "8 front pages" with the word between the figure and the noun.
 */
export function summaryParts(summary: ImportSummary): string[] {
  return [
    summary.front > 0 &&
      `${summary.front} front ${nounFor(summary.front, "page")}`,
    summary.body > 0 && plural(summary.body, "chapter"),
    summary.back > 0 && `${summary.back} back ${nounFor(summary.back, "page")}`,
  ].filter((part): part is string => typeof part === "string");
}

/** What a section import found in a file: what belongs there, and what does not. */
export interface PartOfImport {
  /** Tagged with the part and given the catalogue's spelling. */
  kept: ImportedChapter[];
  /** The titles of everything else, in the file's own words, to name on screen. */
  leftOut: string[];
}

/**
 * The pieces of a file that belong to one part of the book.
 *
 * **Only what the file says belongs there is used.** Importing into the Back
 * matter card does not force a manuscript into the back of the book: each piece
 * is read against that part's own page names, what matches goes in, and what
 * does not is *named* rather than dropped in silence. A whole novel aimed at
 * the Back matter card therefore lands nothing and says so, which is the right
 * answer to a mis-drop and the reason `leftOut` carries titles rather than a
 * count.
 *
 * The kept pages take the **catalogue's** spelling — `About the Author` becomes
 * `About the author` — for the reason `taggedByName` does the same on the
 * whole-book path: one division showing as two rows is what a book gets
 * otherwise, and here it would also defeat the duplicate check that decides
 * whether Add has anything to do.
 *
 * Pure, and read by all three of the screens that have an opinion about a
 * section import — the dialog that asks, the store call that acts, and the
 * banner that reports — so none of them can describe one file differently.
 */
export function partOfImport(
  chapters: readonly ImportedChapter[],
  part: MatterPart | "body",
): PartOfImport {
  const kept: ImportedChapter[] = [];
  const leftOut: string[] = [];

  for (const chapter of chapters) {
    /* The body is everything the catalogue did not claim, which is what
       `taggedByName` has already decided by the time this runs — so the body's
       question is the plain inverse rather than a lookup of its own. A chapter
       keeps its own name here: only the standard divisions are renamed, and a
       chapter is not one. */
    if (part === "body") {
      if (chapter.matter) leftOut.push(chapter.title);
      else kept.push(chapter);
      continue;
    }

    const title = matterDivisionInPart(chapter.title, part);
    if (title === null) leftOut.push(chapter.title);
    else kept.push({ ...chapter, title, matter: part });
  }

  return { kept, leftOut };
}

/**
 * Whether an import has to stop and ask before it lands.
 *
 * Two things have to be true. The book has to hold writing worth protecting —
 * an empty book, or one carrying nothing but blank placeholder chapters, simply
 * takes the file in. And **the file has to bring body chapters**, because those
 * are the only thing Replace can act on: it clears the body and spares every
 * front- and back-matter page (`importIntoBook`). A file of eight back-matter
 * pages used to raise the question anyway, and both answers were nonsense —
 * Add offered to number named pages on from Chapter 11, and Replace offered to
 * delete ten chapters in exchange for pages that were never going to fill them.
 *
 * Nothing is lost by not asking. Matter pages the book already has are dropped
 * on the way in rather than doubled (`newInImport`), and the banner still puts
 * Undo on screen for the whole import.
 *
 * Both import screens read this rather than each testing it, because a question
 * asked on one and skipped on the other is two products.
 */
export function importAsksFirst(
  bookHasWriting: boolean,
  incoming: ImportSummary,
): boolean {
  return bookHasWriting && incoming.body > 0;
}

/**
 * Said when a file holds nothing the book has not already got.
 *
 * Only reachable for a file that is all front or back matter, since body
 * chapters are never treated as duplicates — a book may genuinely have two
 * chapters of the same name. Until this existed the case fell through
 * `importIntoBook`'s single `null` return and was reported as "the book may be
 * too large for this browser's storage", which named the wrong cause, blamed
 * the browser, and told the writer to go and free up space they did not need.
 */
export const NOTHING_NEW =
  "This book already has every page in that file. Front and back matter pages " +
  "are matched by name — a book has one dedication, not two — so there was " +
  "nothing new to bring in.";

/**
 * The same, as one phrase that can sit inside a sentence.
 *
 * **Two screens say what an import holds and they must not say it
 * differently.** The banner reports what landed; the add-or-replace dialog says
 * what is about to. Until this existed the dialog counted the file's front and
 * back pages and called all of them "chapters" — so a file of eight back-matter
 * pages was announced as "8 chapters", offered to be numbered on from Chapter
 * 11, and then reported by the banner, correctly, as eight back pages. One of
 * those two screens was always going to be wrong.
 *
 * "nothing" rather than an empty string, so a caller can drop it into a
 * sentence without checking first.
 */
export function summaryPhrase(summary: ImportSummary): string {
  const parts = summaryParts(summary);
  if (parts.length === 0) return "nothing";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
