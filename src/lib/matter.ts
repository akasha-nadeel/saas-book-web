/**
 * The pages that go before and after the story.
 *
 * **These used to be two pages, and that was the whole problem.** A book had
 * one "Front matter" page whose body was every standard division as a heading
 * with a blank line under it, and one "Back matter" page the same — so the
 * writer met eight printer's terms stacked on a single sheet, with no way to
 * open one, no way to delete the ones they did not want, and nothing at all
 * saying what belongs under any of them. Left alone, that sheet exported into
 * the finished EPUB as a bare list of terms sitting between the cover and
 * Chapter One, which is what a template looks like when somebody forgets to
 * delete it.
 *
 * Now each division is a **page of its own**, listed in the panel exactly the
 * way the body's chapters are: click one to open it, add the ones you want,
 * delete the ones you do not. The list below is the offer, not the contents —
 * a book has whichever of these its writer asked for.
 *
 * **Every line a writer has to replace carries a `[bracket]`,** and that is
 * load-bearing rather than a house style. It is the only mark the export needs
 * to tell a page somebody wrote from a page nobody has touched yet, and it
 * survives everything a stored field would not: renaming the page, syncing to
 * another machine, importing the book somewhere else and back. See
 * `hasPlaceholder`.
 */

export type MatterPart = "front" | "back";

export interface MatterSection {
  /** The page's title — in the panel, and as the heading on the page. */
  title: string;
  /** What belongs on it, said in one line. Shown in the Add menu. */
  hint: string;
  /**
   * Apparatus rather than a division of the book.
   *
   * **Four of these pages are furniture**: a half-title, a title page, a
   * copyright page and a contents list. Nobody has ever opened a novel to a
   * sheet headed "Copyright page", and no printed contents lists itself — so
   * these are the pages that print *no heading* in an export and are *left out
   * of the contents*, while a dedication, an epigraph, a prologue and an
   * acknowledgements page are named divisions and get both.
   *
   * The flag lives here rather than in the exporter because it is a fact about
   * the kind of page, and three renderers ask it.
   */
  apparatus?: true;
  /**
   * One of the few pages a fiction book usually has.
   *
   * **No shop requires any of these**, and that is the point of the flag. What
   * they require is a cover, a title page, working navigation, honest metadata
   * and content the writer owns; Amazon names "About the author" as an
   * *example* of back matter rather than a rule, and Kobo refuses listings that
   * look unfinished. So a book carrying an empty epigraph and an invented
   * also-by list is worse off than one carrying neither — and a setup screen
   * offering sixteen identical checkboxes reads as a list to complete.
   *
   * Marked here rather than in the dialog because the panel's Add-page menu
   * makes the same distinction, and two lists of "the usual ones" would drift.
   *
   * **It answers "does a book have this", not "should you tick it".** The
   * title page, the copyright page and the contents list are marked and are
   * also the three the export builds for itself — nearly every printed book
   * carries them, and on this screen that is a reason to *skip* the row rather
   * than tick it. The badge says the first half and the hint says the second.
   * Nothing is pre-ticked from this flag, which is what keeps the two from
   * being read as one instruction.
   */
  usual?: true;
  /**
   * The seeded body, one paragraph per line.
   *
   * Written as a real page with the writer's own details missing, rather than
   * as instructions about a page. A dedication reading `For [name].` shows the
   * shape of the thing and leaves one word to change; "Write your dedication
   * here" shows nothing and leaves the whole line to write.
   */
  lines: readonly string[];
}

/**
 * The standard divisions, in the order a printed book binds them.
 *
 * Order is not decoration: `matterSectionIndex` uses it to drop a page added
 * later into its proper place, so a dedication written after the prologue still
 * lands in front of it.
 */
export const MATTER_SECTIONS: Record<MatterPart, readonly MatterSection[]> = {
  front: [
    {
      title: "Half-title page",
      apparatus: true,
      hint: "The title alone, on a page of its own.",
      lines: ["[Book title]"],
    },
    {
      title: "Title page",
      apparatus: true,
      usual: true,
      hint: "Title, subtitle, author, publisher. We build this if you skip it.",
      lines: [
        "[Book title]",
        "[Subtitle — delete this line if the book has none]",
        "[Author name]",
        "[Publisher or imprint — delete this line if you are self-publishing]",
      ],
    },
    {
      title: "Copyright page",
      apparatus: true,
      usual: true,
      hint: "Who holds the rights, and the year. We build this if you skip it.",
      lines: [
        "[Book title]",
        "Copyright © [year] [author name]",
        "All rights reserved.",
        "No part of this book may be reproduced in any form without written permission from the author, except brief quotations in a review.",
        "[ISBN — delete this line if you do not have one]",
        "[Publisher and city — delete this line if you are self-publishing]",
      ],
    },
    {
      title: "Dedication",
      usual: true,
      hint: "Who the book is for.",
      lines: ["For [name]."],
    },
    {
      title: "Epigraph",
      hint: "A quotation to open on.",
      lines: [
        "“[The quotation you want to open the book with.]”",
        "— [Who said it], [where it is from]",
      ],
    },
    {
      // Kept on the list because a writer looking for it will look for it, and
      // an absence explains nothing. The page says what the export already
      // does, so nobody writes a contents list by hand for no reason — and
      // because the line is bracketed, an untouched one never ships.
      /* **Not marked `usual`, and it is the one that looks like it should be.**
         A contents page is universal in non-fiction and the exception in a
         novel: most printed novels omit it, and most fiction ebooks show no
         visible one either, because numbered chapters list nothing a reader
         wants. What a shop actually asks for is working *navigation*, and the
         EPUB's nav and ncx carry that whatever is on this list. Marking it
         would also have contradicted the hint beside it. */
      title: "Table of contents",
      apparatus: true,
      hint: "Only if you want to write your own — we build this if you skip it.",
      lines: [
        "[OpenChapter builds the contents for you when you export, from your chapter titles. You only need this page if you want to write your own — otherwise delete it.]",
      ],
    },
    {
      title: "Preface or introduction",
      hint: "What a reader should know before they start.",
      lines: [
        "[Why you wrote this book, or what a reader needs to know before Chapter One.]",
      ],
    },
    {
      title: "Prologue",
      hint: "The scene before Chapter One.",
      lines: ["[The scene that happens before the story proper begins.]"],
    },
  ],
  back: [
    {
      title: "Epilogue",
      hint: "The scene after the last chapter.",
      lines: ["[The scene that happens after the story has ended.]"],
    },
    {
      title: "Afterword",
      hint: "What you want to say now the story is over.",
      lines: [
        "[How the book came about, what in it is true, what you changed — whatever you want to say now the reader has finished.]",
      ],
    },
    {
      title: "Acknowledgements",
      usual: true,
      hint: "The people who helped.",
      lines: [
        "[The readers, editors, friends and family who helped. Name them.]",
      ],
    },
    {
      title: "About the author",
      usual: true,
      hint: "A short paragraph about you.",
      lines: [
        "[A short paragraph in the third person: who you are, what else you have written, where you live.]",
        "[Your website or social handle]",
      ],
    },
    {
      title: "Also by the author",
      hint: "Your other books.",
      lines: ["[Title], [year]", "[Title], [year]"],
    },
    {
      /* A self-publishing convention rather than a printer's one, and the
         single most-repeated piece of advice given to first-time authors: the
         ask has to be in the book, at the end, where a reader who has just
         finished it is.

         **Marked `usual` for that reason and not because Chicago says so** —
         it does not, and no printed trade novel carries one. The flag answers
         "do books like yours have this", and the books this app is for are
         self-published, where the review ask sits in the standard back-matter
         set beside the bio. "Also by the author" is the near miss: the advice
         is just as emphatic, and it is empty in a first novel, which is the
         book most people here are publishing. */
      title: "A word about reviews",
      usual: true,
      hint: "Ask readers to leave one, and say where.",
      lines: [
        "[Ask your reader to leave a review, and say where — the shop they bought it from is usually the right answer.]",
      ],
    },
    {
      title: "An excerpt from the next book",
      hint: "The opening pages of what comes next.",
      lines: [
        "[The first page or two of your next book, so a reader who has just finished this one has somewhere to go.]",
      ],
    },
    {
      title: "Glossary",
      hint: "Terms a reader may need.",
      lines: ["[Term] — [what it means]", "[Term] — [what it means]"],
    },
  ],
};

/** The part's page titles, for a caller that only needs the names. */
export function matterTitles(part: MatterPart): string[] {
  return MATTER_SECTIONS[part].map((s) => s.title);
}

/** The standard section of that name, or null for a page a writer named. */
export function matterSection(
  part: MatterPart,
  title: string,
): MatterSection | null {
  const wanted = title.trim().toLowerCase();
  return (
    MATTER_SECTIONS[part].find((s) => s.title.toLowerCase() === wanted) ?? null
  );
}

/**
 * Where a page belongs among the part's pages.
 *
 * A page the writer named themselves is not in the list and sorts to the end —
 * `Infinity` rather than -1, so an unknown page lands after every standard one
 * instead of jumping to the front of the book.
 */
export function matterSectionIndex(part: MatterPart, title: string): number {
  const wanted = title.trim().toLowerCase();
  const at = MATTER_SECTIONS[part].findIndex(
    (s) => s.title.toLowerCase() === wanted,
  );
  return at === -1 ? Number.POSITIVE_INFINITY : at;
}

/**
 * The standard sections this book does not have a page for yet, split into the
 * few most books have and the rest.
 *
 * **One flat list under a heading reading "the usual pages" was a small lie** —
 * true of a dedication, not of a glossary. The split is the same one
 * `MatterSection.usual` makes for the setup dialog, so the two cannot come to
 * different views about what is usual.
 *
 * A part with every page already made offers nothing but a blank one, which
 * the menu says rather than opening empty.
 */
export function missingSections(
  part: MatterPart,
  existing: readonly string[],
): { usual: MatterSection[]; rest: MatterSection[] } {
  const have = new Set(existing.map((t) => t.trim().toLowerCase()));
  const missing = MATTER_SECTIONS[part].filter(
    (s) => !have.has(s.title.toLowerCase()),
  );
  return {
    usual: missing.filter((s) => s.usual),
    rest: missing.filter((s) => !s.usual),
  };
}

/**
 * The pages the export generates when the writer has not written their own —
 * a title page, a copyright page and a contents list.
 *
 * Named here so the setup dialog can say so: those three rows are the only
 * ones on that screen where *not* ticking costs nothing at all, and a writer
 * who does not know that is being asked to make a decision they cannot make.
 * `front-matter.ts` holds the same three in `GENERATED_BY_TITLE` and is the
 * side that acts on them; this is the side that explains them.
 */
export function isGeneratedPage(part: MatterPart, title: string): boolean {
  if (part !== "front") return false;
  const wanted = title.trim().toLowerCase();
  return (
    wanted === "title page" ||
    wanted === "copyright page" ||
    wanted === "table of contents"
  );
}

/**
 * Whether this page is furniture rather than a division of the book.
 *
 * Body chapters are never apparatus. A page the writer named themselves is not
 * either — it is not on the list, so nothing is known about it, and printing
 * its heading and listing it is the answer that loses nothing if wrong.
 */
export function isApparatusPage(
  matter: "front" | "body" | "back",
  title: string,
): boolean {
  if (matter === "body") return false;
  return matterSection(matter, title)?.apparatus === true;
}

/**
 * A `[bracketed]` placeholder — a line the writer has not filled in.
 *
 * Two or more characters inside, so a stray `[]` in prose is not a placeholder,
 * and no newline inside, so an unclosed bracket cannot swallow the rest of a
 * page.
 */
const PLACEHOLDER = /\[[^\]\n]{2,}\]/;

/**
 * Whether this text still carries a placeholder.
 *
 * **This is how the export tells a written page from a seeded one**, and it is
 * a text rule rather than a stored flag on purpose. A flag would have to be a
 * new field on the chapter, which means a new column in Postgres, which means
 * an older copy of the app or a round trip through an EPUB import drops it —
 * and a page that has lost its flag either ships as scaffolding or vanishes
 * with somebody's dedication in it. The bracket travels with the words.
 *
 * It is deliberately unforgiving: *any* placeholder left anywhere on the page
 * means the page is unfinished, so a copyright page with the year filled in and
 * `[author name]` still sitting in it is caught too. The cost is a writer who
 * genuinely wants square brackets in their front matter, which is why the
 * export screen names every page it left out rather than dropping them
 * silently.
 */
export function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER.test(text);
}
