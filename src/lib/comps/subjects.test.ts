import { describe, expect, it } from "vitest";
import { COMMON_SUBJECTS } from "./common-subjects";
import { matchHeadings, mergeHeadings, parseSubjectIndex, rankHeadings, rankSubjects, subjectParts, worthSuggesting } from "./subjects";
import type { CompTitle } from "./comps";

const book = (subjects: string[], key = String(Math.random())): CompTitle => ({
  key,
  title: "A Book",
  authors: ["A Writer"],
  subjects,
  source: "google",
});

const names = (books: CompTitle[]) => rankSubjects(books).map((s) => s.name);

describe("subjectParts", () => {
  /**
   * The two shapes these services actually use. Google files as a path and
   * Open Library often as a reversed heading, and neither can have its useless
   * half dropped while it is still one string.
   */
  it("splits a Google path", () => {
    expect(subjectParts("Fiction / Fantasy / Epic")).toEqual([
      "Fantasy",
      "Epic",
    ]);
  });

  it("splits an Open Library heading", () => {
    expect(subjectParts("Fiction, fantasy, general")).toEqual(["Fantasy"]);
  });

  it("presents everything the same way, whatever case it arrived in", () => {
    expect(subjectParts("FANTASY")).toEqual(["Fantasy"]);
    expect(subjectParts("fantasy")).toEqual(["Fantasy"]);
  });

  // These are things a librarian recorded about a copy. They are true, and
  // they are not what a shop's category box is asking for.
  it("drops what catalogues record about a copy", () => {
    expect(subjectParts("Protected DAISY")).toEqual([]);
    expect(subjectParts("Accessible book")).toEqual([]);
    expect(subjectParts("In library")).toEqual([]);
    expect(subjectParts("Large type books")).toEqual([]);
  });

  // All three turned up in a live search rather than being guessed at.
  it("drops the collection markers Open Library groups scans under", () => {
    expect(subjectParts("Collection:dragonlance")).toEqual([]);
    expect(subjectParts("collection:opensource")).toEqual([]);
    expect(subjectParts("nyt:series_books=2011-01-01")).toEqual([]);
  });

  // True of every novel ever written, and so no use to anybody.
  it("drops the subjects that are true of everything", () => {
    expect(subjectParts("Fiction")).toEqual([]);
    expect(subjectParts("General")).toEqual([]);
  });

  it("keeps a genre that merely contains a broad word", () => {
    expect(subjectParts("Historical fiction")).toEqual(["Historical fiction"]);
    expect(subjectParts("Science fiction")).toEqual(["Science fiction"]);
  });

  it("drops shelf marks, dates and stray numbers", () => {
    expect(subjectParts("813")).toEqual([]);
    expect(subjectParts("1900-1950")).toEqual([]);
    expect(subjectParts("A")).toEqual([]);
  });

  it("does not repeat a subject that arrives twice in one string", () => {
    expect(subjectParts("Fantasy / Fantasy")).toEqual(["Fantasy"]);
  });
});

describe("rankSubjects", () => {
  it("orders by how many books carry each subject", () => {
    expect(
      names([
        book(["Fantasy", "Dragons"], "1"),
        book(["Fantasy"], "2"),
        book(["Fantasy", "Dragons"], "3"),
      ]),
    ).toEqual(["Fantasy", "Dragons"]);
  });

  /**
   * Counted per book. A catalogue that lists the same subject three times
   * against one title should not let that title outvote three other books.
   */
  it("counts a book once however often it repeats a subject", () => {
    const [top] = rankSubjects([book(["Fantasy", "Fantasy", "fantasy"], "1")]);
    expect(top).toEqual({ name: "Fantasy", count: 1 });
  });

  it("merges the same subject across different spellings and shapes", () => {
    const [top] = rankSubjects([
      book(["FANTASY"], "1"),
      book(["Fiction / Fantasy"], "2"),
      book(["Fiction, fantasy, general"], "3"),
    ]);
    expect(top).toEqual({ name: "Fantasy", count: 3 });
  });

  /**
   * Deliberately not merged. Every rule that would fold "Fantasy fiction" into
   * "Fantasy" also folds "Science fiction" into "Science", so both are shown
   * and the writer — who can read — picks.
   */
  it("leaves two genuinely different strings as two suggestions", () => {
    expect(names([book(["Fantasy", "Fantasy fiction"], "1")])).toEqual([
      "Fantasy",
      "Fantasy fiction",
    ]);
  });

  // A list that reshuffles between two searches returning the same books looks
  // like it is guessing.
  it("breaks ties alphabetically, so the order is stable", () => {
    expect(names([book(["Zebras", "Antelopes"], "1")])).toEqual([
      "Antelopes",
      "Zebras",
    ]);
  });

  it("has nothing to say about books with no usable subjects", () => {
    expect(names([book(["Fiction", "In library"], "1")])).toEqual([]);
  });
});

describe("worthSuggesting", () => {
  // One book out of twenty filed under something is not a pattern, it is that
  // book.
  it("drops a subject only one book carries", () => {
    const kept = worthSuggesting(
      [
        { name: "Fantasy", count: 8 },
        { name: "Beekeeping", count: 1 },
      ],
      20,
    );
    expect(kept.map((s) => s.name)).toEqual(["Fantasy"]);
  });

  it("scales the bar with how many books came back", () => {
    // Three of forty is under a tenth — that is one book's quirk at this size.
    expect(worthSuggesting([{ name: "Fantasy", count: 3 }], 40)).toEqual([]);
    // Three of six is half of them.
    expect(worthSuggesting([{ name: "Fantasy", count: 3 }], 6)).toHaveLength(1);
  });

  it("never lets the bar fall below two", () => {
    expect(worthSuggesting([{ name: "Fantasy", count: 1 }], 2)).toEqual([]);
  });
});

describe("parseSubjectIndex", () => {
  const doc = (over: Record<string, unknown> = {}) => ({
    key: "/subjects/x",
    name: "Mystery",
    subject_type: "subject",
    work_count: 4679,
    ...over,
  });

  it("reads the index's own headings", () => {
    const found = parseSubjectIndex({ docs: [doc()] });
    expect(found).toEqual([{ name: "Mystery", works: 4679 }]);
  });

  // Compound headings are shown whole here, unlike a per-book subject list:
  // that string *is* the shelf's name, and a writer copying a category wants
  // it as the catalogue writes it.
  it("keeps a compound heading intact rather than splitting it", () => {
    const found = parseSubjectIndex({
      docs: [doc({ name: "Fiction, mystery & detective, general" })],
    });
    expect(found[0].name).toBe("Fiction, mystery & detective, general");
  });

  it("puts the biggest shelf first", () => {
    const found = parseSubjectIndex({
      docs: [doc({ name: "Small", work_count: 12 }), doc({ name: "Big", work_count: 900 })],
    });
    expect(found.map((s) => s.name)).toEqual(["Big", "Small"]);
  });

  // The index carries people, places and periods. "Hercule Poirot" is a real
  // heading and a useless category — the same noise this screen already fights.
  it("drops anything that is not a subject", () => {
    const found = parseSubjectIndex({
      docs: [doc(), doc({ name: "Hercule Poirot", subject_type: "person" })],
    });
    expect(found.map((s) => s.name)).toEqual(["Mystery"]);
  });

  it("drops administrative headings, by the same rule as everywhere else", () => {
    const found = parseSubjectIndex({
      docs: [doc(), doc({ name: "Protected DAISY" }), doc({ name: "In library" })],
    });
    expect(found.map((s) => s.name)).toEqual(["Mystery"]);
  });

  it("names each shelf once", () => {
    const found = parseSubjectIndex({ docs: [doc(), doc({ name: "mystery" })] });
    expect(found).toHaveLength(1);
  });

  it("survives a payload of the wrong shape", () => {
    expect(parseSubjectIndex(null)).toEqual([]);
    expect(parseSubjectIndex({})).toEqual([]);
    expect(parseSubjectIndex({ docs: "nope" })).toEqual([]);
    expect(parseSubjectIndex({ docs: [null, 1, {}] })).toEqual([]);
  });

  it("treats a missing work count as none rather than guessing", () => {
    expect(parseSubjectIndex({ docs: [doc({ work_count: undefined })] })[0].works).toBe(0);
  });
});

describe("rankHeadings", () => {
  const h = (name: string, works: number) => ({ name, works });

  // The one that prompted this: typing "thri" put "Fiction, thrillers,
  // general" (38,368 works) on top and "Thriller" (2,075) fifth, because the
  // sort knew nothing about the query. Four letters typed is a name, not a
  // request for the biggest shelf containing them.
  it("puts what was typed above whatever is biggest", () => {
    const found = rankHeadings(
      [
        h("Fiction, thrillers, general", 38368),
        h("Fiction, thrillers, suspense", 37640),
        h("Thriller", 2075),
        h("Thrillers", 866),
      ],
      "thri",
    );
    expect(found[0].name).toBe("Thriller");
  });

  // The other half of the same rule, and the reason size is not merely a
  // tie-break: "Thrips" is an insect that happens to begin with those four
  // letters, and it must not sit above the shelf 38,000 thrillers are on.
  it("keeps a tiny literal match below a huge near-miss", () => {
    const found = rankHeadings(
      [h("Thrips", 118), h("Fiction, thrillers, general", 38368)],
      "thri",
    );
    expect(found.map((s) => s.name)).toEqual([
      "Fiction, thrillers, general",
      "Thrips",
    ]);
  });

  // Exact is the one thing size may not overturn: somebody who typed the whole
  // name has finished asking, and a bigger neighbour is not a better answer.
  it("puts an exact hit first however small the shelf", () => {
    const found = rankHeadings([h("Thrillers", 90000), h("Thriller", 5)], "thriller");
    expect(found[0].name).toBe("Thriller");
  });

  it("does not care about case", () => {
    const found = rankHeadings([h("Fiction, romance", 900), h("ROMANCE", 5)], "romance");
    expect(found[0].name).toBe("ROMANCE");
  });

  it("keeps the bigger shelf first inside one tier", () => {
    const found = rankHeadings([h("Mystery fiction", 10), h("Mystery", 4000)], "myst");
    expect(found.map((s) => s.name)).toEqual(["Mystery", "Mystery fiction"]);
  });

  // The index is stemmed, so a search for "cozy" legitimately returns headings
  // that match on a stem rather than on any prefix. Those must still appear.
  it("keeps a heading that matched on a stem rather than a prefix", () => {
    const found = rankHeadings([h("Cosy crime", 40)], "cozy");
    expect(found).toHaveLength(1);
  });

  it("falls back to size when nothing was typed", () => {
    const found = rankHeadings([h("Small", 5), h("Big", 900)], "  ");
    expect(found.map((s) => s.name)).toEqual(["Small", "Big"]);
  });

  it("does not modify the list it was given", () => {
    const list = [h("A", 1), h("B", 2)];
    rankHeadings(list, "b");
    expect(list.map((s) => s.name)).toEqual(["A", "B"]);
  });
});

const h2 = (name: string, works: number) => ({ name, works });

describe("matchHeadings", () => {
  const list = [
    h2("War stories", 5000),
    h2("Civil war", 4000),
    h2("Warehouse management", 300),
    h2("Steward", 100),
    h2("Fiction, small town & rural", 630),
  ];

  it("matches a word beginning with what was typed, anywhere in the heading", () => {
    expect(matchHeadings(list, "war").map((s) => s.name)).toEqual([
      "War stories",
      "Civil war",
      "Warehouse management",
    ]);
  });

  // The line between generous and broken: a reader typing "war" cannot see
  // why "Steward" would be offered, so it reads as a bug rather than a help.
  it("does not match inside a word", () => {
    expect(matchHeadings(list, "war").map((s) => s.name)).not.toContain("Steward");
  });

  it("matches a phrase still being typed", () => {
    expect(matchHeadings(list, "small tow").map((s) => s.name)).toEqual([
      "Fiction, small town & rural",
    ]);
  });

  it("answers a single letter, which is the whole reason it is local", () => {
    // "Civil war" is in there because its second word begins with w. That is
    // the rule working, not leaking: the reader can see why it was offered.
    expect(matchHeadings(list, "w").map((s) => s.name)).toEqual([
      "War stories",
      "Civil war",
      "Warehouse management",
    ]);
  });

  it("is empty for an empty query", () => {
    expect(matchHeadings(list, "  ")).toEqual([]);
  });
});

describe("mergeHeadings", () => {
  it("keeps the first of a repeated heading", () => {
    const merged = mergeHeadings([h2("Thriller", 2075)], [h2("Thriller", 2075)]);
    expect(merged).toHaveLength(1);
  });

  it("does not care about case when spotting a repeat", () => {
    expect(mergeHeadings([h2("Thriller", 1)], [h2("THRILLER", 9)])).toHaveLength(1);
  });

  it("keeps the local order, then appends what is new", () => {
    const merged = mergeHeadings([h2("A", 1)], [h2("B", 2), h2("A", 1)]);
    expect(merged.map((s) => s.name)).toEqual(["A", "B"]);
  });
});

describe("the shipped index", () => {
  it("is real catalogue data, not a list somebody typed", () => {
    // Every row carries a work count, which is the tell: an invented taxonomy
    // has no counts because nobody counted anything.
    expect(COMMON_SUBJECTS.length).toBeGreaterThan(500);
    expect(COMMON_SUBJECTS.every((s) => s.works > 0)).toBe(true);
    expect(COMMON_SUBJECTS.every((s) => s.name.trim() !== "")).toBe(true);
  });

  // The point of shipping it: a reader typing one character gets something,
  // where the live index answers a single letter with an HTTP 500 or with
  // middle initials. "x" is the honest exception — the catalogue has no book
  // subjects beginning with it, and inventing one to fill the gap would be
  // the invented vocabulary this whole screen refuses.
  it("answers every letter of the alphabet except x", () => {
    const missing = "abcdefghijklmnopqrstuvwyz"
      .split("")
      .filter((letter) => matchHeadings(COMMON_SUBJECTS, letter).length === 0);
    expect(missing).toEqual([]);
  });

  it("holds the shelves this app's own genres name", () => {
    for (const genre of ["mystery", "thriller", "romance", "fantasy", "horror"]) {
      expect(matchHeadings(COMMON_SUBJECTS, genre).length).toBeGreaterThan(0);
    }
  });

  it("carries none of the noise the cleaning drops", () => {
    const names = COMMON_SUBJECTS.map((s) => s.name.toLowerCase());
    expect(names).not.toContain("fiction");
    expect(names.some((n) => n.includes("protected daisy"))).toBe(false);
    expect(names.some((n) => n.includes("accessible book"))).toBe(false);
  });
});
