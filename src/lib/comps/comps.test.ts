import { describe, expect, it } from "vitest";
import { GENRES } from "../book-kinds";
import {
  BROWSE_SHELVES,
  buildQuery,
  keywords,
  mergeComps,
  openLibraryQuery,
  parseGoogle,
  parseOpenLibrary,
  coversOf,
  summarise,
  yearOf,
  type CompTitle,
} from "./comps";

/**
 * These test the walk over two public APIs whose records are contributed and
 * therefore ragged. Every case below is a shape one of them really returns —
 * a volume with no author, a date that is only a year, a thumbnail still on
 * http — because the failure mode of a parser like this is not crashing, it is
 * quietly producing a shorter list.
 */

const comp = (over: Partial<CompTitle> = {}): CompTitle => ({
  key: "k",
  title: "A Book",
  authors: ["A Writer"],
  subjects: [],
  source: "google",
  ...over,
});

describe("keywords", () => {
  it("keeps the words that name what a book is about", () => {
    const words = keywords(
      "When the lighthouse keeper vanishes, a cartographer must chart the drowned coast.",
    );
    expect(words).toContain("cartographer");
    expect(words).toContain("lighthouse");
  });

  it("drops stop words and anything too short to narrow a search", () => {
    expect(keywords("the a of and it was")).toEqual([]);
  });

  it("does not repeat a word that appears twice", () => {
    expect(keywords("shadow shadow shadow")).toEqual(["shadow"]);
  });
});

describe("buildQuery", () => {
  it("puts the genre in as a subject, not a loose word", () => {
    expect(buildQuery({ genre: "Fantasy" })).toBe('subject:"Fantasy"');
  });

  it("leaves 'Other' out — it is not a subject anyone files under", () => {
    expect(buildQuery({ genre: "Other", extra: "sailing" })).toBe("sailing");
  });

  // Comps are books *like* yours. Searching your own title finds yours, or
  // somebody else's with the same name, which is a different feature.
  it("never searches for the writer's own title", () => {
    const q = buildQuery({ title: "The Drowned Coast", genre: "Horror" });
    expect(q).not.toContain("Drowned");
  });

  it("draws search terms from the blurb", () => {
    const q = buildQuery({ blurb: "A cartographer charts a drowned coastline." });
    expect(q).toContain("cartographer");
  });
});

describe("yearOf", () => {
  it("reads a year out of every date shape these two return", () => {
    expect(yearOf("2014")).toBe(2014);
    expect(yearOf("2014-03")).toBe(2014);
    expect(yearOf("2014-03-19")).toBe(2014);
  });

  it("refuses what is not a year", () => {
    expect(yearOf("n.d.")).toBeUndefined();
    expect(yearOf(undefined)).toBeUndefined();
    expect(yearOf("0042")).toBeUndefined();
  });
});

describe("parseGoogle", () => {
  it("reads a full volume", () => {
    const [book] = parseGoogle({
      items: [
        {
          id: "abc",
          volumeInfo: {
            title: "The Drowned Coast",
            authors: ["A Writer"],
            publishedDate: "2019-06-01",
            publisher: "A Press",
            description: "A cartographer charts a coast that will not hold still.",
            pageCount: 384,
            categories: ["Fiction / Fantasy"],
            industryIdentifiers: [
              { type: "ISBN_10", identifier: "1234567890" },
              { type: "ISBN_13", identifier: "9781234567897" },
            ],
            imageLinks: { thumbnail: "http://books.google.com/x.jpg" },
            infoLink: "https://books.google.com/x",
          },
        },
      ],
    });

    expect(book.title).toBe("The Drowned Coast");
    expect(book.year).toBe(2019);
    expect(book.pageCount).toBe(384);
    expect(book.isbn13).toBe("9781234567897");
    // The ISBN is the key when there is one, so the same book from the other
    // service lands on top of this one rather than beside it.
    expect(book.key).toBe("9781234567897");
  });

  // A page served over https drops an http image without a word.
  it("lifts thumbnails onto https", () => {
    const [book] = parseGoogle({
      items: [
        {
          id: "a",
          volumeInfo: {
            title: "T",
            imageLinks: { smallThumbnail: "http://books.google.com/y.jpg" },
          },
        },
      ],
    });
    expect(book.coverUrl?.startsWith("https:")).toBe(true);
  });

  it("skips an item with no volumeInfo rather than failing the request", () => {
    const books = parseGoogle({
      items: [{ id: "a" }, { id: "b", volumeInfo: { title: "Kept" } }],
    });
    expect(books.map((b) => b.title)).toEqual(["Kept"]);
  });

  it("returns nothing for a response with no items", () => {
    expect(parseGoogle({ totalItems: 0 })).toEqual([]);
    expect(parseGoogle(null)).toEqual([]);
  });
});

describe("parseOpenLibrary", () => {
  it("reads a search doc, and builds the cover URL from the cover id", () => {
    const [book] = parseOpenLibrary({
      docs: [
        {
          key: "/works/OL1W",
          title: "The Drowned Coast",
          author_name: ["A Writer"],
          first_publish_year: 2019,
          publisher: ["A Press", "Another Press"],
          number_of_pages_median: 380,
          subject: ["Fantasy", "Cartography"],
          isbn: ["1234567890", "9781234567897"],
          cover_i: 42,
        },
      ],
    });

    expect(book.year).toBe(2019);
    expect(book.publisher).toBe("A Press");
    expect(book.isbn13).toBe("9781234567897");
    expect(book.coverUrl).toBe("https://covers.openlibrary.org/b/id/42-M.jpg");
    expect(book.infoUrl).toBe("https://openlibrary.org/works/OL1W");
  });

  it("has no blurb — search results do not carry one", () => {
    const [book] = parseOpenLibrary({ docs: [{ title: "T" }] });
    expect(book.description).toBeUndefined();
  });
});

describe("mergeComps", () => {
  it("matches the same book across the two services on its ISBN", () => {
    const merged = mergeComps(
      [comp({ key: "978", isbn13: "978", description: "A blurb" })],
      [
        comp({
          key: "978",
          isbn13: "978",
          source: "openlibrary",
          subjects: ["Fantasy"],
          coverUrl: "https://c/1.jpg",
        }),
      ],
    );
    expect(merged).toHaveLength(1);
  });

  // The case that actually matters: Open Library search results frequently
  // carry no ISBN at all, so a merge keyed only on ISBN would double every row.
  it("matches on title and author when neither has an ISBN", () => {
    const merged = mergeComps(
      [comp({ key: "g:1", title: "The Drowned Coast!" })],
      [comp({ key: "o:1", title: "the drowned coast", source: "openlibrary" })],
    );
    expect(merged).toHaveLength(1);
  });

  /**
   * The point of asking both. Google has the blurb, Open Library has the
   * subjects and the cover — preferring one source wholesale throws away
   * exactly the field the other was fetched for.
   */
  it("takes each field from whichever source has it", () => {
    const [book] = mergeComps(
      [comp({ isbn13: "978", description: "A blurb", pageCount: 384 })],
      [
        comp({
          isbn13: "978",
          source: "openlibrary",
          subjects: ["Fantasy"],
          coverUrl: "https://c/1.jpg",
        }),
      ],
    );
    expect(book.description).toBe("A blurb");
    expect(book.pageCount).toBe(384);
    expect(book.subjects).toEqual(["Fantasy"]);
    expect(book.coverUrl).toBe("https://c/1.jpg");
  });

  it("drops records with no author — those are catalogue entries, not comps", () => {
    expect(mergeComps([comp({ authors: [] })])).toEqual([]);
  });
});

describe("coversOf", () => {
  /**
   * A wall of covers is a wall or it is nothing. A grid half full of grey
   * boxes teaches a writer that their genre has no visual convention, which is
   * the opposite of what the page is for.
   */
  it("drops books with no cover rather than leaving a gap", () => {
    const kept = coversOf([
      comp({ key: "1", coverUrl: "https://c/1.jpg" }),
      comp({ key: "2" }),
    ]);
    expect(kept).toHaveLength(1);
  });

  // The two services carry different editions of one book and often point at
  // the same scan. The same JPEG twice makes a convention look stronger than
  // it is.
  it("shows the same artwork once", () => {
    const kept = coversOf([
      comp({ key: "1", coverUrl: "https://c/1.jpg" }),
      comp({ key: "2", coverUrl: "https://c/1.jpg" }),
    ]);
    expect(kept).toHaveLength(1);
  });

  it("keeps two editions that really do look different", () => {
    const kept = coversOf([
      comp({ key: "1", coverUrl: "https://c/1.jpg" }),
      comp({ key: "2", coverUrl: "https://c/2.jpg" }),
    ]);
    expect(kept).toHaveLength(2);
  });
});

describe("summarise", () => {
  it("reports the median, not the mean", () => {
    // The 1,200-page omnibus is why. The mean here is 460; no real book in the
    // list is anywhere near it.
    const summary = summarise([
      comp({ key: "1", pageCount: 300 }),
      comp({ key: "2", pageCount: 320 }),
      comp({ key: "3", pageCount: 340 }),
      comp({ key: "4", pageCount: 1200 }),
    ]);
    expect(summary.medianPages).toBe(330);
  });

  it("says how many books each figure was drawn from", () => {
    const summary = summarise([
      comp({ key: "1", pageCount: 300, description: "x".repeat(500) }),
      comp({ key: "2" }),
      comp({ key: "3" }),
    ]);
    expect(summary.pagesFrom).toBe(1);
    expect(summary.blurbsFrom).toBe(1);
    expect(summary.medianBlurbChars).toBe(500);
  });

  it("leaves the figure out entirely when nothing carried the field", () => {
    const summary = summarise([comp({ key: "1" })]);
    expect(summary.medianPages).toBeUndefined();
    expect(summary.pagesFrom).toBe(0);
  });

  it("counts subjects across books, commonest first", () => {
    const summary = summarise([
      comp({ key: "1", subjects: ["Fantasy", "Magic"] }),
      comp({ key: "2", subjects: ["Fantasy"] }),
      comp({ key: "3", subjects: ["Fantasy", "Magic"] }),
    ]);
    expect(summary.subjects[0]).toEqual({ name: "Fantasy", count: 3 });
    expect(summary.subjects[1]).toEqual({ name: "Magic", count: 2 });
  });

  it("counts a book once for a subject it repeats", () => {
    const summary = summarise([
      comp({ key: "1", subjects: ["Fantasy", "Fantasy"] }),
    ]);
    expect(summary.subjects[0].count).toBe(1);
  });
});

describe("openLibraryQuery", () => {
  // The bug this exists for: the title check sent Google's `intitle:` to both
  // catalogues, and Open Library answers a prefix it does not know with zero
  // results rather than an error. So every result that screen ever showed came
  // from Google alone, while the page said it read both.
  it("translates the field prefixes Open Library spells differently", () => {
    expect(openLibraryQuery('intitle:"The Silent Patient"')).toBe(
      'title:"The Silent Patient"',
    );
    expect(openLibraryQuery('inauthor:"Ruth Ware"')).toBe('author:"Ruth Ware"');
    expect(openLibraryQuery("inpublisher:Penguin")).toBe("publisher:Penguin");
  });

  it("leaves an ordinary search alone", () => {
    expect(openLibraryQuery('subject:"Mystery" haunted house')).toBe(
      'subject:"Mystery" haunted house',
    );
    expect(openLibraryQuery("")).toBe("");
  });

  // A prefix is a word, not a substring: a book about painting should not have
  // its query rewritten because "intitle" appears inside something else.
  it("only translates a prefix at a word boundary", () => {
    expect(openLibraryQuery("printitle:x")).toBe("printitle:x");
  });
});

describe("BROWSE_SHELVES", () => {
  // Not a style preference: the caption and the lit chip are both matched
  // against this list, so a genre missing from it means a writer whose book is
  // that genre arrives with the seeded search running and no chip lit — the
  // screen silently disagreeing with itself about what it is showing.
  it("contains every genre a book can be, so the book's own chip lights", () => {
    for (const genre of GENRES) {
      if (genre === "Other") continue;
      expect(BROWSE_SHELVES).toContain(genre);
    }
  });

  it("does not offer Other, which is not a shelf anybody files under", () => {
    expect(BROWSE_SHELVES).not.toContain("Other");
  });

  it("has no duplicates, which would draw two identical chips", () => {
    expect(new Set(BROWSE_SHELVES).size).toBe(BROWSE_SHELVES.length);
  });
});
