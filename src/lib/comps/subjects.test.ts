import { describe, expect, it } from "vitest";
import { rankSubjects, subjectParts, worthSuggesting } from "./subjects";
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
