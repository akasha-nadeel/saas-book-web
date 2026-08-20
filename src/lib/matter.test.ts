import { expect, it } from "vitest";
import {
  MATTER_SECTIONS,
  hasPlaceholder,
  isGeneratedPage,
  matterDivisionOf,
  matterPartOf,
  matterSection,
  matterSectionIndex,
  matterTitles,
  missingSections,
} from "./matter";

it("gives every section a title, a hint and something to write on", () => {
  for (const part of ["front", "back"] as const) {
    for (const section of MATTER_SECTIONS[part]) {
      expect(section.title.trim()).not.toBe("");
      expect(section.hint.trim()).not.toBe("");
      expect(section.lines.length).toBeGreaterThan(0);
    }
  }
});

/**
 * The rule the export depends on, asserted at the source.
 *
 * A seeded page is recognised as unfinished by its `[brackets]` and nothing
 * else — no stored flag, no comparison against this table. So a section whose
 * lines carry no bracket at all would ship straight into somebody's book the
 * moment they pressed Start, and would look deliberate when it did.
 */
it("leaves a placeholder on at least one line of every section", () => {
  for (const part of ["front", "back"] as const) {
    for (const section of MATTER_SECTIONS[part]) {
      expect(
        section.lines.some(hasPlaceholder),
        `${section.title} has no [placeholder] to replace`,
      ).toBe(true);
    }
  }
});

it("names no section twice within a part", () => {
  for (const part of ["front", "back"] as const) {
    const titles = matterTitles(part).map((t) => t.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  }
});

it("finds a section by name, ignoring case and spacing", () => {
  expect(matterSection("front", "  dedication ")?.title).toBe("Dedication");
  expect(matterSection("front", "Epilogue")).toBeNull();
  expect(matterSection("back", "Epilogue")?.title).toBe("Epilogue");
});

it("sorts a page the writer named after every standard one", () => {
  expect(matterSectionIndex("front", "Dedication")).toBe(3);
  expect(matterSectionIndex("front", "A note on the maps")).toBe(Infinity);
  // Infinity beats every real index, so an unknown page lands last rather than
  // at the front of the book — which -1 would have done.
  expect(matterSectionIndex("front", "A note on the maps")).toBeGreaterThan(
    matterSectionIndex("front", "Prologue"),
  );
});

it("offers only the sections a book does not have yet", () => {
  const { usual, rest } = missingSections("front", ["Dedication", "prologue"]);
  const titles = [...usual, ...rest].map((s) => s.title);
  expect(titles).not.toContain("Dedication");
  expect(titles).not.toContain("Prologue");
  expect(titles).toContain("Epigraph");
  expect(titles.length).toBe(MATTER_SECTIONS.front.length - 2);
});

/**
 * The split is the honest half: a menu heading reading "the usual pages" over
 * a list containing "Glossary" is a small lie, and it is the lie that makes a
 * writer think a complete book has all sixteen.
 */
it("keeps the few usual pages apart from the rest", () => {
  const front = missingSections("front", []);
  // The title and copyright pages are the two Chicago calls compulsory, and a
  // dedication is standard in a novel. They are usual *pages* whether or not
  // the writer should tick the row — the export builds two of them. See the
  // note on `usual` and `isGeneratedPage`.
  expect(front.usual.map((s) => s.title)).toEqual([
    "Title page",
    "Copyright page",
    "Dedication",
  ]);
  expect(front.rest.map((s) => s.title)).toContain("Epigraph");

  const back = missingSections("back", []);
  expect(back.usual.map((s) => s.title)).toEqual([
    "Acknowledgements",
    "About the author",
    "A word about reviews",
  ]);
  expect(back.rest.map((s) => s.title)).toContain("Glossary");
});

/**
 * **A contents page is not marked, and this is the one to leave alone.**
 *
 * It looks like the most standard page on the list and is the exception in
 * fiction: most printed novels omit it, most fiction ebooks show no visible
 * one, and what a shop asks for is working navigation, which the EPUB's nav
 * and ncx carry regardless. Marking it would also contradict its own hint.
 */
it("does not call a contents page usual", () => {
  const contents = MATTER_SECTIONS.front.find(
    (s) => s.title === "Table of contents",
  );
  expect(contents?.usual).toBeUndefined();
});

it("offers nothing once every standard page exists", () => {
  expect(missingSections("back", matterTitles("back"))).toEqual({
    usual: [],
    rest: [],
  });
});

/**
 * The three the export builds. Not ticking these costs nothing, which is the
 * one thing a writer meeting the list cannot know by looking.
 */
it("knows which pages the export generates", () => {
  expect(isGeneratedPage("front", "Title page")).toBe(true);
  expect(isGeneratedPage("front", "  copyright page ")).toBe(true);
  expect(isGeneratedPage("front", "Table of contents")).toBe(true);
  expect(isGeneratedPage("front", "Dedication")).toBe(false);
  // A back-matter page of the same name is still not the book's title page.
  expect(isGeneratedPage("back", "Title page")).toBe(false);
});

it("spots a placeholder, and is not fooled by ordinary prose", () => {
  expect(hasPlaceholder("For [name].")).toBe(true);
  expect(hasPlaceholder("Copyright © [year] [author name]")).toBe(true);
  expect(hasPlaceholder("For Marguerite, who read it first.")).toBe(false);
  expect(hasPlaceholder("")).toBe(false);
  // Too short to be a placeholder — an empty pair is punctuation, not a slot.
  expect(hasPlaceholder("[]")).toBe(false);
  // An unclosed bracket must not swallow the rest of the page.
  expect(hasPlaceholder("He wrote [ and then stopped\nand carried on")).toBe(
    false,
  );
});

/* --- reading a heading for its part ---------------------------------------
 *
 * How a manuscript that declares nothing about itself gets a structure. An
 * EPUB says which page is which; a Word file, a Markdown file and a plain text
 * file carry headings and nothing else, so these names are all there is to go
 * on. See `matterPartOf`.
 * ------------------------------------------------------------------------- */

it("places every standard division in its own part", () => {
  // Walks the catalogue rather than a list written out here, so a section added
  // to `MATTER_SECTIONS` without a thought for import fails this.
  for (const part of ["front", "back"] as const) {
    for (const section of MATTER_SECTIONS[part]) {
      expect(matterPartOf(section.title)).toBe(part);
    }
  }
});

it("reads a heading in the case a manuscript actually writes it", () => {
  // Word files shout their headings; nobody types "Half-title page".
  expect(matterPartOf("HALF-TITLE PAGE")).toBe("front");
  expect(matterPartOf("Copyright Page")).toBe("front");
  expect(matterPartOf("  glossary  ")).toBe("back");
});

it("knows the other names for a division", () => {
  // "Preface or introduction" is the name of a slot, not a heading anybody
  // writes. Without these the commonest front-matter page in a manuscript is
  // the one that lands in the body.
  expect(matterPartOf("Preface")).toBe("front");
  expect(matterPartOf("Introduction")).toBe("front");
  expect(matterPartOf("Foreword")).toBe("front");
  expect(matterPartOf("Contents")).toBe("front");
  // The American spelling of the page most likely to carry it.
  expect(matterPartOf("Acknowledgments")).toBe("back");
});

it("every alias names a page that exists", () => {
  // A table entry pointing at a title `MATTER_SECTIONS` does not have would
  // answer null and look like a name nobody had thought of.
  for (const alias of ["Preface", "Contents", "Acknowledgments", "Half title"]) {
    expect(matterPartOf(alias)).not.toBeNull();
  }
});

it("leaves a chapter alone, which is nearly every heading in a book", () => {
  // Null is the important answer here: it means the writer's own page stays
  // exactly where they put it. A rule loose enough to catch the third of these
  // would take somebody's chapter out of their novel.
  expect(matterPartOf("Chapter One")).toBeNull();
  expect(matterPartOf("Returning to Mirissa")).toBeNull();
  expect(matterPartOf("Prologue to a Murder")).toBeNull();
  /* "The End" used to be asserted null here and is now recognised — see the
     import-only tests below. The principle this test protects is unchanged: no
     *rule* may reach into a manuscript and take a chapter. An exact-match table
     entry is not that rule, and the heading it catches was costing a real book
     a chapter number. */
  expect(matterPartOf("")).toBeNull();
  expect(matterPartOf("   ")).toBeNull();
});

it("recognises the closing lines a manuscript ends on", () => {
  /* The case this was built for: a bare "END" is not in `MATTER_SECTIONS`, so
     it arrived as the last *chapter* of the book and spent a chapter number.
     Every chapter after a stray like that counts one too high, which is how a
     writer's chapter nine came to print "Chapter Ten". */
  expect(matterPartOf("END")).toBe("back");
  expect(matterPartOf("The End")).toBe("back");
  expect(matterPartOf("the end")).toBe("back");
  expect(matterPartOf("Fin")).toBe("back");
});

it("recognises the apparatus a novel carries but we do not offer", () => {
  expect(matterPartOf("Author's Note")).toBe("back");
  expect(matterPartOf("Discussion Questions")).toBe("back");
  expect(matterPartOf("Content Warning")).toBe("front");
  expect(matterPartOf("Dramatis Personae")).toBe("front");
});

it("gives an import-only page the catalogue's spelling, not the manuscript's", () => {
  // Same rule the standard divisions follow: a Word file shouts its headings,
  // and `THE END` sitting beside `The End` is one page showing as two rows.
  expect(matterDivisionOf("THE END")?.title).toBe("The End");
  expect(matterDivisionOf("fin")?.title).toBe("The End");
  expect(matterDivisionOf("A NOTE FROM THE AUTHOR")?.title).toBe("Author's note");
});

it("never offers an import-only page in the Add-page menu", () => {
  /* The whole reason the table is separate. A name here is recognised on the
     way in and is *not* a `MatterSection`, so it takes the path a page the
     writer named themselves already takes — and nobody is offered "The End" as
     a page to create. */
  for (const name of ["The End", "Author's note", "Content warning"]) {
    for (const part of ["front", "back"] as const) {
      expect(matterSection(part, name)).toBeNull();
      expect(matterTitles(part)).not.toContain(name);
    }
  }
});

it("lets a standard section win over an import-only name", () => {
  // The offer is the stronger claim: the second table is asked last, so it can
  // never shadow a page the panel can actually create.
  for (const part of ["front", "back"] as const) {
    for (const section of MATTER_SECTIONS[part]) {
      expect(matterDivisionOf(section.title)).toEqual({
        part,
        title: section.title,
      });
    }
  }
});

it("does not mistake an inherited property for a division", () => {
  /* The key is a heading out of somebody's manuscript, and a plain object
     answers these with something inherited rather than undefined. A chapter
     called "Constructor" being filed as back matter is the writer losing a
     chapter to a JavaScript detail. */
  for (const name of ["toString", "constructor", "__proto__", "valueOf"]) {
    expect(matterPartOf(name)).toBeNull();
    expect(matterDivisionOf(name)).toBeNull();
  }
});

it("recognises the spellings a manuscript actually writes", () => {
  /* Measured, not guessed: of 36 headings a real book carries, six were
     recognised before this. "Copyright" is the one that mattered — the slot is
     "Copyright page" and a manuscript writes the word, so the commonest
     apparatus page in publishing was arriving as chapter one. */
  expect(matterDivisionOf("Copyright")).toEqual({
    part: "front",
    title: "Copyright page",
  });
  expect(matterDivisionOf("Acknowledgment")?.title).toBe("Acknowledgements");
  expect(matterDivisionOf("Acknowledgement")?.title).toBe("Acknowledgements");
  expect(matterDivisionOf("Dedication page")?.title).toBe("Dedication");
  expect(matterDivisionOf("Author Bio")?.title).toBe("About the author");
  expect(matterDivisionOf("TOC")?.title).toBe("Table of contents");
});

it("recognises the apparatus at the far end of a book", () => {
  for (const name of [
    "Colophon", "Bibliography", "Index", "Appendix", "Appendices",
    "Endnotes", "Postscript", "About the Publisher", "Translator's Note",
  ]) {
    expect(matterPartOf(name)).toBe("back");
  }
  for (const name of ["A Note on the Text", "Pronunciation Guide", "Family Tree"]) {
    expect(matterPartOf(name)).toBe("front");
  }
});

it("still leaves the headings that could be a chapter alone", () => {
  /* The other half of the same decision, and the one that protects the writer.
     Each of these is a plausible chapter heading — a thriller opening on "The
     Map", a literary novel with an "Interlude" — so none of them is in either
     table. Taking a chapter out of somebody's book is worse than leaving a
     stray page in it. If one of these is ever added, this test should be the
     argument against it. */
  for (const name of [
    "Map", "Maps", "Notes", "Preview", "Praise", "Reviews",
    "Timeline", "Interlude", "Coda", "Part One", "Part I",
  ]) {
    expect(matterPartOf(name)).toBeNull();
  }
});

it("every alias and import-only name lands on a real page", () => {
  /* Walks the answers rather than the tables, which are private: whatever a
     name resolves to has to be a title something can actually show — a
     standard section, or a page carrying its own name in the right part. */
  const names = [
    "Copyright", "Acknowledgment", "Dedication page", "TOC", "Author Bio",
    "The End", "Fin", "Colophon", "Index", "Family Tree", "Content Warning",
  ];
  for (const name of names) {
    const division = matterDivisionOf(name);
    expect(division).not.toBeNull();
    expect(division!.title.trim()).not.toBe("");
    // Idempotent: feeding a division's own title back in returns the same
    // answer, or the panel and a re-import would disagree about one page.
    expect(matterDivisionOf(division!.title)).toEqual(division);
  }
});
