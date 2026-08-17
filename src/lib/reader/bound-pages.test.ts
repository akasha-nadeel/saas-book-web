import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/library-store";
import { DEFAULT_TYPESET } from "@/lib/export/typeset";
import { boundReaderPages, type LoadedPage } from "@/lib/reader/bound-pages";

/**
 * The reading view's list, against the file's.
 *
 * **These are the tests for a screen that used to be wrong quietly.** The
 * export wizard's Preview is the last thing a writer looks at before the file
 * exists, and it was built by a different route from the file — so it showed a
 * book with no title page, no copyright page, the writer's own contents where
 * they had asked for ours, and a sheet headed "Copyright page". Every case
 * below is one of those four, and each one is really an assertion that this
 * module calls `front-matter.ts` rather than restating it.
 */

const book: Book = {
  id: "b",
  title: "The Salt Ledger",
  author: "Ada Vance",
  chapters: [],
  lastOpenedId: null,
  lastOpenedAt: 0,
};

const page = (
  id: string,
  title: string,
  matter: "front" | "body" | "back",
  number: number | null = null,
): LoadedPage => ({
  id,
  title,
  matter,
  number,
  label: null,
  html: `<p>${title}</p>`,
});

const chapter = page("c1", "The Fourth Lamp", "body", 1);

describe("what the export builds, the reading view shows", () => {
  it("binds in the title, copyright and contents pages", () => {
    const pages = boundReaderPages(book, [chapter], DEFAULT_TYPESET);

    expect(pages.map((p) => p.id)).toEqual([
      "generated:title",
      "generated:copyright",
      "generated:contents",
      "c1",
    ]);
    expect(pages[0].html).toContain("The Salt Ledger");
    expect(pages[1].html).toContain("Ada Vance");
    expect(pages[2].html).toContain("The Fourth Lamp");
  });

  it("leaves out a page whose switch is off", () => {
    const pages = boundReaderPages(book, [chapter], {
      ...DEFAULT_TYPESET,
      copyright: false,
    });

    expect(pages.map((p) => p.id)).not.toContain("generated:copyright");
  });

  it("stands ours down for a page the writer wrote", () => {
    /* The default for the two pages assembled from fields: theirs wins,
       because ours is the fallback for a book that said nothing. */
    const own = page("rights", "Copyright page", "front");
    const pages = boundReaderPages(book, [own, chapter], DEFAULT_TYPESET);

    expect(pages.map((p) => p.id)).toContain("rights");
    expect(pages.map((p) => p.id)).not.toContain("generated:copyright");
  });

  /*
   * **The contents page is the exception, and it is the one that is navigated
   * rather than read.** Ours is built from the book's own chapter list and
   * carries a link to every one of them; a written one carries text, and is
   * stale the moment a chapter moves. See `REPLACED_BY_DEFAULT`.
   */
  it("prefers ours for the contents, even when the writer wrote one", () => {
    const own = page("toc", "Table of contents", "front");
    const pages = boundReaderPages(book, [own, chapter], DEFAULT_TYPESET);

    expect(pages.map((p) => p.id)).toContain("generated:contents");
    expect(pages.map((p) => p.id)).not.toContain("toc");
  });

  it("gives the writer their contents back when the switch is turned off", () => {
    // Reversible by the control that already exists — nothing is deleted.
    const own = page("toc", "Table of contents", "front");
    const pages = boundReaderPages(book, [own, chapter], {
      ...DEFAULT_TYPESET,
      replaceWritten: [],
    });

    expect(pages.map((p) => p.id)).toContain("toc");
    expect(pages.map((p) => p.id)).not.toContain("generated:contents");
  });

  it("swaps in ours when the writer asked us to replace theirs", () => {
    /* The defect this module was written for: pressing "ours, not yours" on the
       front-matter step changed nothing one station later. */
    const own = page("toc", "Table of contents", "front");
    const pages = boundReaderPages(book, [own, chapter], {
      ...DEFAULT_TYPESET,
      replaceWritten: ["contents"],
    });

    expect(pages.map((p) => p.id)).not.toContain("toc");
    expect(pages.map((p) => p.id)).toContain("generated:contents");
  });

  it("binds the generated pages among the writer's own, not in front of them", () => {
    // A half-title leads the book; ours take their own slots after it. The
    // arithmetic is bindBook's — this is the check that it is being used.
    const half = page("h", "Half-title page", "front");
    const pages = boundReaderPages(book, [half, chapter], DEFAULT_TYPESET);

    expect(pages.map((p) => p.id)).toEqual([
      "h",
      "generated:title",
      "generated:copyright",
      "generated:contents",
      "c1",
    ]);
  });

  it("keeps back matter after the body", () => {
    const back = page("ack", "Acknowledgements", "back");
    const pages = boundReaderPages(book, [chapter, back], DEFAULT_TYPESET);

    expect(pages.map((p) => p.id).slice(-2)).toEqual(["c1", "ack"]);
  });
});

describe("which pages open with a title", () => {
  it("heads a real division of the book", () => {
    const dedication = page("d", "Dedication", "front");
    const pages = boundReaderPages(book, [dedication, chapter], DEFAULT_TYPESET);

    expect(pages.find((p) => p.id === "d")?.heading).toBe(true);
    expect(pages.find((p) => p.id === "c1")?.heading).toBe(true);
  });

  it("heads no page of apparatus, written or generated", () => {
    /* No published book has a sheet headed "Copyright page" — the name exists
       so the writer can find the page in a list. Every exporter has known that;
       this view printed it. */
    const own = page("cp", "Copyright page", "front");
    const pages = boundReaderPages(book, [own, chapter], DEFAULT_TYPESET);

    expect(pages.find((p) => p.id === "cp")?.heading).toBe(false);
    expect(pages.every((p) => !p.generated || !p.heading)).toBe(true);
  });
});

it("marks a generated page as having no chapter behind it", () => {
  // The flip-book makes a chapter opener a link into the editor. There is
  // nothing to open for a page this app assembled from the book's own fields.
  const pages = boundReaderPages(book, [chapter], DEFAULT_TYPESET);

  expect(pages.filter((p) => p.generated).map((p) => p.id)).toEqual([
    "generated:title",
    "generated:copyright",
    "generated:contents",
  ]);
  expect(pages.find((p) => p.id === "c1")?.generated).toBe(false);
});

it("says a chapter with no prose is empty and a generated page never is", () => {
  const blank: LoadedPage = { ...page("c2", "Chapter Two", "body", 2), html: "" };
  const pages = boundReaderPages(book, [chapter, blank], DEFAULT_TYPESET);

  expect(pages.find((p) => p.id === "c2")?.empty).toBe(true);
  expect(pages.filter((p) => p.generated).every((p) => !p.empty)).toBe(true);
});
