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
 * The other names a standard division goes by.
 *
 * **A table, not a rule**, and that is the whole of the design. The temptation
 * here is a clever matcher — strip "page", allow a plural, take a prefix — and
 * it is the same temptation `series.ts` refuses for merging characters, for the
 * same reason: a rule loose enough to see that "Preface" is "Preface or
 * introduction" is also loose enough to decide somebody's chapter called
 * "Prologue to a Murder" is apparatus and move it out of their book. A table
 * can be read, argued with and added to; a heuristic can only be discovered
 * after it has done something.
 *
 * The right-hand side is always an exact `MATTER_SECTIONS` title, so nothing
 * here can name a page that does not exist.
 *
 * Every entry earns its place. **Preface** and **Introduction** are what a
 * manuscript actually calls that page — "Preface or introduction" is a name for
 * a *slot*, not a heading anybody types. **Foreword** is a different thing
 * strictly (somebody else writes it) and shares the slot because there is no
 * other. **Contents** is what a printed book says where our slot says "Table of
 * contents". **Acknowledgments** is the American spelling of the one page most
 * likely to carry it. And **half title** without the hyphen is how it is
 * written about as often as not.
 */
const MATTER_ALIASES: Record<string, string> = {
  preface: "Preface or introduction",
  introduction: "Preface or introduction",
  foreword: "Preface or introduction",
  contents: "Table of contents",
  "table of contents": "Table of contents",
  acknowledgments: "Acknowledgements",
  "half title": "Half-title page",
  "half title page": "Half-title page",
  "half-title": "Half-title page",
  "about the authors": "About the author",
  /* Measured rather than guessed: of 36 headings a real book carries, the
     catalogue recognised six. **"Copyright" is the one that mattered** — the
     slot is called "Copyright page" and a manuscript simply writes the word, so
     the commonest apparatus page in publishing was arriving as chapter one.
     The rest are the same shape: a spelling of a page that already exists. */
  copyright: "Copyright page",
  "copyright notice": "Copyright page",
  // Singular, in both spellings. The plural was here; the page most likely to
  // carry either was not.
  acknowledgment: "Acknowledgements",
  acknowledgement: "Acknowledgements",
  "dedication page": "Dedication",
  "contents page": "Table of contents",
  toc: "Table of contents",
  "author bio": "About the author",
  "author biography": "About the author",
  "glossary of terms": "Glossary",
  "also by": "Also by the author",
  "also by the same author": "Also by the author",
};

/**
 * Names a manuscript uses that are not chapters — and are not pages we offer.
 *
 * **`MATTER_SECTIONS` was doing two jobs, and they had come apart.** That list
 * is both the table the importer matches against *and* the offer in the panel's
 * Add-page menu, so the only way to teach the importer about a heading was to
 * start offering it as a page to create. "The End" is the case that made it
 * plain: it is the commonest closing line in a manuscript, and nobody has ever
 * wanted it in a menu of pages to add.
 *
 * The cost of not knowing it was not cosmetic. An unrecognised heading is a
 * *chapter* — which is the right default and the reason `matterDivisionOf`
 * answers null so often — so a bare `END` became the last chapter of the book
 * and took a chapter number with it. Every chapter after a stray like that
 * counts one too high, and the writer sees it as chapter nine printing
 * "Chapter Ten": the opener and the title disagreeing with nothing to say why.
 *
 * **A name here is recognised, not offered.** It is deliberately *not* a
 * `MatterSection`, so `matterSection()` still answers null for it and
 * `matterSectionIndex` sorts it after the standard pages — the path a page the
 * writer named themselves already takes. Nothing downstream learns a new idea.
 *
 * Same discipline as `MATTER_ALIASES`: exact matches, a table rather than a
 * rule. Each entry is a phrase that is a heading and cannot be a chapter title.
 * "The End" and "Fin" close a book; an author's note, a content warning, a cast
 * list and a set of discussion questions are apparatus a reader skips past.
 * When in doubt the entry stays out — leaving a heading as a chapter is a
 * mistake the writer can see and fix, while taking one out of their book is a
 * mistake they have to notice first.
 */
const IMPORT_ONLY: Record<string, { part: MatterPart; title: string }> = {
  "the end": { part: "back", title: "The End" },
  end: { part: "back", title: "The End" },
  fin: { part: "back", title: "The End" },
  "author's note": { part: "back", title: "Author's note" },
  "authors note": { part: "back", title: "Author's note" },
  "a note from the author": { part: "back", title: "Author's note" },
  "note from the author": { part: "back", title: "Author's note" },
  "content warning": { part: "front", title: "Content warning" },
  "content warnings": { part: "front", title: "Content warning" },
  "trigger warning": { part: "front", title: "Content warning" },
  "trigger warnings": { part: "front", title: "Content warning" },
  "cast of characters": { part: "front", title: "Cast of characters" },
  "dramatis personae": { part: "front", title: "Cast of characters" },
  "discussion questions": { part: "back", title: "Discussion questions" },
  "book club questions": { part: "back", title: "Discussion questions" },
  "reading group guide": { part: "back", title: "Discussion questions" },
  /* The apparatus at the far end of a book. Every one of these is a printer's
     term for a division and none of them is a sentence anybody would head a
     chapter with — which is the whole test for being on this list. */
  colophon: { part: "back", title: "Colophon" },
  bibliography: { part: "back", title: "Bibliography" },
  index: { part: "back", title: "Index" },
  appendix: { part: "back", title: "Appendix" },
  appendices: { part: "back", title: "Appendix" },
  endnotes: { part: "back", title: "Endnotes" },
  postscript: { part: "back", title: "Postscript" },
  "about the publisher": { part: "back", title: "About the publisher" },
  "translator's note": { part: "back", title: "Translator's note" },
  "translators note": { part: "back", title: "Translator's note" },
  "a note on the text": { part: "front", title: "A note on the text" },
  "note on the text": { part: "front", title: "A note on the text" },
  "pronunciation guide": { part: "front", title: "Pronunciation guide" },
  "family tree": { part: "front", title: "Family tree" },
  /* **Deliberately not here**, and worth writing down so it is not "fixed"
     later: Map, Notes, Preview, Praise, Reviews, Timeline, Interlude, Coda.
     Each is a plausible chapter heading — a thriller opening on "The Map", a
     literary novel with an "Interlude" — and taking a chapter out of somebody's
     book is a worse failure than leaving a stray page in it. Those are what the
     import banner and `unnumbered` are for. */
};

/**
 * The division a heading names — which part of the book it belongs to, and what
 * that page is properly called — or null for a name we know nothing about.
 *
 * **This is how a manuscript that does not declare its own structure gets one.**
 * An EPUB says which page is which — every spine document carries an
 * `epub:type` — and the importer believes it. A Word file, a Markdown file and
 * a plain text file say nothing at all, so every heading in them used to arrive
 * as a body chapter: a manuscript opening with a half-title, a title page, a
 * copyright page and a dedication produced four chapters of a novel that has
 * none, and the glossary at the far end became chapter twenty-one.
 *
 * **It answers with the catalogue's own spelling, not the manuscript's**, and
 * that is not tidiness. A Word file shouts its headings, so `HALF-TITLE PAGE`
 * came in under exactly that name and sat in the list beside the app's own
 * `Half-title page` looking like a second, unrelated page — two rows for one
 * division, in two different cases, and no way for anything matching on name to
 * see they were the same. The EPUB importer has always canonicalised
 * (`DIVISION_TITLES` in `import/epub.ts` maps `halftitlepage` to the catalogue
 * spelling), so without this the same book imported as a `.docx` and as an
 * `.epub` produced differently-named pages.
 *
 * Null is the important answer and the common one. It means *this is a chapter*
 * — which is what nearly every heading in a book is — and a name this does not
 * recognise keeps its own spelling and its own place.
 */
export function matterDivisionOf(
  title: string,
): { part: MatterPart; title: string } | null {
  const wanted = title.trim().toLowerCase();
  if (!wanted) return null;
  /* **`hasOwn`, not a bare lookup, and it is not a nicety.** The key is a
     heading out of somebody's manuscript, and a plain object answers
     `toString`, `constructor` and `valueOf` with an inherited *function*. That
     function then arrived here as `canonical` and went into `matterSection`,
     which called `.trim()` on it — so a chapter headed with any of those words
     did not import as a chapter, or as a matter page: it threw a TypeError and
     took the whole import down with it. */
  const canonical = Object.hasOwn(MATTER_ALIASES, wanted)
    ? MATTER_ALIASES[wanted]
    : title;
  for (const part of ["front", "back"] as const) {
    const section = matterSection(part, canonical);
    if (section) return { part, title: section.title };
  }
  /* The pages we recognise but do not offer, asked *after* the standard ones so
     a name that is both is answered by the section it has — the offer is the
     stronger claim, and this table can never shadow it.

     Guarded with `hasOwn` for the same reason the alias lookup above is — a
     heading of "toString" or "constructor" is otherwise answered with something
     inherited from `Object.prototype` rather than with undefined. */
  return Object.hasOwn(IMPORT_ONLY, wanted) ? IMPORT_ONLY[wanted] : null;
}

/** Just the part, for a caller that has no use for the name. */
export function matterPartOf(title: string): MatterPart | null {
  return matterDivisionOf(title)?.part ?? null;
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
