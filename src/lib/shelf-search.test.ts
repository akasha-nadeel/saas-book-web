import { beforeEach, describe, expect, it } from "vitest";
import {
  createBook,
  createChapter,
  deleteChapter,
  getShelf,
  renameChapter,
} from "@/lib/library-store";
import {
  hasResults,
  recentBooks,
  searchShelf,
  type ShelfResults,
} from "@/lib/shelf-search";

beforeEach(() => {
  localStorage.clear();
});

/** A book with named chapters, through the real store. */
function book(title: string, chapters: string[] = []) {
  const { bookId } = createBook(title);
  for (const name of chapters) {
    const id = createChapter(bookId);
    renameChapter(bookId, id, name);
  }
  return bookId;
}

const shelf = () => getShelf().books;

const titles = (r: ShelfResults) => r.books.map((b) => b.title);
const chapterTitles = (r: ShelfResults) => r.chapters.map((c) => c.chapter.title);

describe("searchShelf", () => {
  /**
   * The one that matters. An empty query returning the whole shelf would make
   * "typed nothing" and "matched everything" the same answer, and the caller
   * shows a different list — recent books — in that state.
   */
  it("finds nothing for an empty query, rather than everything", () => {
    book("The Salt Road", ["Salt"]);
    expect(searchShelf(shelf(), "")).toEqual({ books: [], chapters: [] });
    expect(searchShelf(shelf(), "   ")).toEqual({ books: [], chapters: [] });
  });

  it("matches a book by title, ignoring case", () => {
    book("The Salt Road");
    expect(titles(searchShelf(shelf(), "salt"))).toEqual(["The Salt Road"]);
    expect(titles(searchShelf(shelf(), "SALT"))).toEqual(["The Salt Road"]);
  });

  it("matches on any part of the title, not just the start", () => {
    book("The Salt Road");
    expect(titles(searchShelf(shelf(), "road"))).toEqual(["The Salt Road"]);
  });

  it("matches a chapter by title and carries its book", () => {
    book("Northlight", ["The Crossing"]);
    const hit = searchShelf(shelf(), "crossing").chapters[0];
    expect(hit.chapter.title).toBe("The Crossing");
    expect(hit.book.title).toBe("Northlight");
  });

  it("finds a book and a chapter at once and keeps them apart", () => {
    book("Salt", ["Salt Flats"]);
    const found = searchShelf(shelf(), "salt");
    expect(titles(found)).toEqual(["Salt"]);
    expect(chapterTitles(found)).toEqual(["Salt Flats"]);
  });

  // A soft-deleted chapter has left `book.chapters` for `book.trash`, and a
  // search that offered one would open a chapter the writer had thrown away.
  it("does not offer a chapter that has been deleted", () => {
    const id = book("Northlight");
    const chapterId = createChapter(id);
    renameChapter(id, chapterId, "Cut Scene");
    expect(chapterTitles(searchShelf(shelf(), "cut"))).toEqual(["Cut Scene"]);

    deleteChapter(id, chapterId);
    expect(chapterTitles(searchShelf(shelf(), "cut"))).toEqual([]);
  });

  it("finds nothing when nothing matches", () => {
    book("The Salt Road", ["Salt"]);
    const found = searchShelf(shelf(), "zeppelin");
    expect(hasResults(found)).toBe(false);
  });

  it("caps each group so one query cannot render the library", () => {
    for (let i = 0; i < 8; i++) {
      book(`Salt Book ${i}`, [`Salt Chapter ${i}`, `Salt Scene ${i}`]);
    }
    const found = searchShelf(shelf(), "salt", { books: 3, chapters: 5 });
    expect(found.books).toHaveLength(3);
    expect(found.chapters).toHaveLength(5);
  });
});

describe("recentBooks", () => {
  it("puts the most recently opened first", () => {
    const list = [
      { id: "a", title: "A", lastOpenedAt: 10 },
      { id: "b", title: "B", lastOpenedAt: 30 },
      { id: "c", title: "C", lastOpenedAt: 20 },
    ] as unknown as Parameters<typeof recentBooks>[0];
    expect(recentBooks(list).map((b) => b.title)).toEqual(["B", "C", "A"]);
  });

  it("keeps a book that has never been opened rather than dropping it", () => {
    // A new shelf would otherwise offer an empty panel.
    const list = [
      { id: "a", title: "A" },
      { id: "b", title: "B", lastOpenedAt: 5 },
    ] as unknown as Parameters<typeof recentBooks>[0];
    expect(recentBooks(list).map((b) => b.title)).toEqual(["B", "A"]);
  });

  it("holds to the limit", () => {
    const list = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      title: `B${i}`,
      lastOpenedAt: i,
    })) as unknown as Parameters<typeof recentBooks>[0];
    expect(recentBooks(list, 6)).toHaveLength(6);
  });
});
