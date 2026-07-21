import { beforeEach, expect, it, vi } from "vitest";
import {
  archiveBook,
  bookWordCount,
  bookmarks,
  booksIn,
  createBook,
  createBookFromTemplate,
  createChapter,
  deleteBook,
  deleteChapter,
  ensureChapter,
  findBook,
  getNotes,
  getPrefs,
  getShelf,
  migrateLegacy,
  moveChapter,
  pageSetupOf,
  renameBook,
  restoreBook,
  renameChapter,
  saveBody,
  saveNotes,
  setBookAuthor,
  setPageSetup,
  setPref,
  touchLastOpened,
  trashBook,
  toggleBookmark,
  touchLastOpenedBook,
  type Book,
} from "@/lib/library-store";

beforeEach(() => {
  localStorage.clear();
});

it("starts with an empty shelf", () => {
  expect(getShelf().books).toEqual([]);
  expect(getShelf().lastOpenedBookId).toBeNull();
});

it("returns an identical reference on repeat reads", () => {
  // useSyncExternalStore compares snapshots by identity; a fresh object each
  // call is an infinite render loop.
  expect(getShelf()).toBe(getShelf());
});

it("returns a new reference after a write", () => {
  const before = getShelf();
  createBook("The Salt Road");
  expect(getShelf()).not.toBe(before);
});

it("degrades to an empty shelf when storage is corrupt", () => {
  localStorage.setItem("openchapter:shelf", "{ not json");
  expect(getShelf().books).toEqual([]);
});

it("stores the setup a new book was created with", () => {
  const { bookId } = createBook("The Salt Road", {
    kind: "novella",
    genre: "Historical fiction",
    targetWords: 30_000,
  });

  const book = findBook(getShelf(), bookId);
  expect(book?.kind).toBe("novella");
  expect(book?.genre).toBe("Historical fiction");
  expect(book?.targetWords).toBe(30_000);
});

it("leaves setup fields off a book created without them", () => {
  // Absent rather than undefined: the sidebar treats a missing target as "no
  // goal" and must not render a progress bar against one.
  const { bookId } = createBook("The Salt Road");
  const book = findBook(getShelf(), bookId)!;

  expect("kind" in book).toBe(false);
  expect("genre" in book).toBe(false);
  expect("targetWords" in book).toBe(false);
});

it("writes setup through to storage, not just the in-memory cache", () => {
  const { bookId } = createBook("The Salt Road", {
    kind: "novel",
    genre: "Fantasy",
    targetWords: 110_000,
  });

  // Read the serialized form directly. Going back through getShelf would hit
  // the raw-string cache and prove nothing about what was persisted.
  const stored = JSON.parse(localStorage.getItem("openchapter:shelf")!) as {
    books: Book[];
  };
  const book = stored.books.find((b) => b.id === bookId);

  expect(book?.kind).toBe("novel");
  expect(book?.genre).toBe("Fantasy");
  expect(book?.targetWords).toBe(110_000);
});

it("finds a book by id and reports null for an unknown one", () => {
  const { bookId } = createBook("The Salt Road");
  expect(findBook(getShelf(), bookId)?.title).toBe("The Salt Road");
  expect(findBook(getShelf(), "nope")).toBeNull();
});

it("sums word counts across a book's chapters", () => {
  const book: Book = {
    id: "b",
    title: "T",
    chapters: [
      { id: "1", title: "One", words: 1200 },
      { id: "2", title: "Two", words: 812 },
    ],
    lastOpenedId: null,
    lastOpenedAt: 0,
  };
  expect(bookWordCount(book)).toBe(2012);
});

it("renames a book without disturbing its chapters", () => {
  const { bookId, chapterId } = createBook("Untitled Book");
  renameBook(bookId, "The Salt Road");

  const book = findBook(getShelf(), bookId)!;
  expect(book.title).toBe("The Salt Road");
  expect(book.chapters.map((c) => c.id)).toEqual([chapterId]);
});

it("gives a new book an opening chapter", () => {
  const { bookId, chapterId } = createBook();
  const book = findBook(getShelf(), bookId)!;
  expect(book.chapters).toHaveLength(1);
  expect(book.lastOpenedId).toBe(chapterId);
});

it("deletes a book and every body it owns", () => {
  const { bookId, chapterId } = createBook("Doomed");
  // Written directly rather than through saveBody, which does not exist until
  // the next task — this one should stand on its own.
  localStorage.setItem(`openchapter:chapter:${chapterId}`, '{"type":"doc"}');

  deleteBook(bookId);

  expect(findBook(getShelf(), bookId)).toBeNull();
  // The bodies are the whole point: an orphan here is unreachable bytes that
  // never get collected.
  expect(localStorage.getItem(`openchapter:chapter:${chapterId}`)).toBeNull();
});

it("moves lastOpenedBookId off a deleted book", () => {
  const keep = createBook("Keep");
  const doomed = createBook("Doomed");
  touchLastOpenedBook(doomed.bookId);

  deleteBook(doomed.bookId);

  expect(getShelf().lastOpenedBookId).toBe(keep.bookId);
});

it("clears lastOpenedBookId when the last book goes", () => {
  const { bookId } = createBook("Only");
  deleteBook(bookId);
  expect(getShelf().lastOpenedBookId).toBeNull();
});

it("records when a book was last opened, for shelf ordering", () => {
  const { bookId } = createBook("The Salt Road");
  const before = findBook(getShelf(), bookId)!.lastOpenedAt;

  vi.setSystemTime(new Date(before + 60_000));
  touchLastOpenedBook(bookId);

  expect(findBook(getShelf(), bookId)!.lastOpenedAt).toBe(before + 60_000);
  vi.useRealTimers();
});

const titlesOf = (bookId: string) =>
  findBook(getShelf(), bookId)!.chapters.map((c) => c.title);

it("appends chapters in order", () => {
  const { bookId } = createBook();
  createChapter(bookId, "Chapter Two");
  createChapter(bookId, "Chapter Three");
  expect(titlesOf(bookId)).toEqual([
    "Chapter One",
    "Chapter Two",
    "Chapter Three",
  ]);
});

it("numbers an unnamed chapter by its position", () => {
  const { bookId } = createBook();
  createChapter(bookId);
  expect(titlesOf(bookId)).toEqual(["Chapter One", "Chapter 2"]);
});

it("renames a chapter", () => {
  const { bookId, chapterId } = createBook();
  renameChapter(bookId, chapterId, "The Salt Flats");
  expect(titlesOf(bookId)).toEqual(["The Salt Flats"]);
});

it("reorders chapters in both directions", () => {
  const { bookId } = createBook();
  createChapter(bookId, "Chapter Two");
  createChapter(bookId, "Chapter Three");

  moveChapter(bookId, 2, 0);
  expect(titlesOf(bookId)).toEqual([
    "Chapter Three",
    "Chapter One",
    "Chapter Two",
  ]);

  moveChapter(bookId, 0, 2);
  expect(titlesOf(bookId)).toEqual([
    "Chapter One",
    "Chapter Two",
    "Chapter Three",
  ]);
});

it("ignores out-of-range and no-op moves", () => {
  const { bookId } = createBook();
  createChapter(bookId, "Chapter Two");
  const before = titlesOf(bookId);

  moveChapter(bookId, 0, -1);
  moveChapter(bookId, 0, 99);
  moveChapter(bookId, 1, 1);

  expect(titlesOf(bookId)).toEqual(before);
});

it("writes the body and denormalises the word count", () => {
  const { bookId, chapterId } = createBook();
  saveBody(bookId, chapterId, { type: "doc" }, 1204);

  expect(
    localStorage.getItem(`openchapter:chapter:${chapterId}`),
  ).not.toBeNull();
  expect(findBook(getShelf(), bookId)!.chapters[0].words).toBe(1204);
});

it("deletes a chapter, its body, and fixes lastOpenedId", () => {
  const { bookId, chapterId } = createBook();
  const second = createChapter(bookId, "Chapter Two");
  saveBody(bookId, second, { type: "doc" }, 5);
  touchLastOpened(bookId, second);

  deleteChapter(bookId, second);

  expect(titlesOf(bookId)).toEqual(["Chapter One"]);
  expect(localStorage.getItem(`openchapter:chapter:${second}`)).toBeNull();
  expect(findBook(getShelf(), bookId)!.lastOpenedId).toBe(chapterId);
});

it("never names two chapters the same after a delete", () => {
  const { bookId } = createBook();
  const two = createChapter(bookId); // Chapter 2
  createChapter(bookId); // Chapter 3

  deleteChapter(bookId, two);
  createChapter(bookId);

  // Numbering off the count would say "Chapter 3" here, which already exists.
  const titles = titlesOf(bookId);
  expect(titles).toEqual(["Chapter One", "Chapter 3", "Chapter 4"]);
  expect(new Set(titles).size).toBe(titles.length);
});

it("numbers past a chapter the writer numbered by hand", () => {
  const { bookId } = createBook();
  renameChapter(bookId, findBook(getShelf(), bookId)!.chapters[0].id, "Chapter 12");

  createChapter(bookId);
  expect(titlesOf(bookId)).toEqual(["Chapter 12", "Chapter 13"]);
});

it("leaves a named chapter out of the numbering", () => {
  const { bookId } = createBook();
  createChapter(bookId, "The Salt Flats");

  // Titles that are not "Chapter N" say nothing about which numbers are free.
  createChapter(bookId);
  expect(titlesOf(bookId)).toEqual([
    "Chapter One",
    "The Salt Flats",
    "Chapter 3",
  ]);
});

it("lands on the neighbour after deleting the open chapter", () => {
  const { bookId } = createBook();
  createChapter(bookId, "Two");
  const three = createChapter(bookId, "Three");
  createChapter(bookId, "Four");
  touchLastOpened(bookId, three);

  deleteChapter(bookId, three);

  // Not the first chapter of the book: deleting chapter twenty should not throw
  // the writer back to chapter one.
  const book = findBook(getShelf(), bookId)!;
  expect(book.chapters.find((c) => c.id === book.lastOpenedId)?.title).toBe(
    "Four",
  );
});

it("falls back to the previous chapter when the last one goes", () => {
  const { bookId } = createBook();
  createChapter(bookId, "Two");
  const three = createChapter(bookId, "Three");
  touchLastOpened(bookId, three);

  deleteChapter(bookId, three);

  const book = findBook(getShelf(), bookId)!;
  expect(book.chapters.find((c) => c.id === book.lastOpenedId)?.title).toBe(
    "Two",
  );
});

it("keeps chapter ids unique across books", () => {
  const a = createBook("A");
  const b = createBook("B");
  expect(a.chapterId).not.toBe(b.chapterId);
});

it("does not touch another book's chapters", () => {
  const a = createBook("A");
  const b = createBook("B");
  createChapter(a.bookId, "Only in A");

  expect(titlesOf(a.bookId)).toHaveLength(2);
  expect(titlesOf(b.bookId)).toHaveLength(1);
});

it("ensureChapter opens the last-opened chapter", () => {
  const { bookId } = createBook();
  const second = createChapter(bookId, "Chapter Two");
  touchLastOpened(bookId, second);
  expect(ensureChapter(bookId)).toBe(second);
});

it("ensureChapter falls back to the first chapter when the memory is stale", () => {
  const { bookId, chapterId } = createBook();
  const second = createChapter(bookId, "Chapter Two");
  touchLastOpened(bookId, second);
  deleteChapter(bookId, second);
  expect(ensureChapter(bookId)).toBe(chapterId);
});

it("ensureChapter creates a chapter for an empty book", () => {
  const { bookId, chapterId } = createBook();
  deleteChapter(bookId, chapterId);
  expect(findBook(getShelf(), bookId)!.chapters).toHaveLength(0);

  const created = ensureChapter(bookId);
  expect(created).not.toBeNull();
  expect(findBook(getShelf(), bookId)!.chapters).toHaveLength(1);
});

it("ensureChapter reports null for an unknown book", () => {
  expect(ensureChapter("nope")).toBeNull();
});

it("migrates a single-book manifest onto the shelf", () => {
  localStorage.setItem(
    "openchapter:manifest",
    JSON.stringify({
      bookTitle: "The Salt Road",
      chapters: [
        { id: "c1", title: "Chapter One", words: 1204 },
        { id: "c2", title: "Chapter Two", words: 847 },
      ],
      lastOpenedId: "c2",
    }),
  );
  localStorage.setItem("openchapter:chapter:c1", '{"type":"doc"}');

  migrateLegacy();

  const [book] = getShelf().books;
  expect(book.title).toBe("The Salt Road");
  expect(book.chapters.map((c) => c.id)).toEqual(["c1", "c2"]);
  expect(book.lastOpenedId).toBe("c2");
  expect(bookWordCount(book)).toBe(2051);
  // Bodies keep their keys — the ids are already unique.
  expect(localStorage.getItem("openchapter:chapter:c1")).toBe('{"type":"doc"}');
  expect(localStorage.getItem("openchapter:manifest")).toBeNull();
});

it("migrates the original spike chapter", () => {
  localStorage.setItem("openchapter:spike:chapter-1", '{"type":"doc"}');

  migrateLegacy();

  const [book] = getShelf().books;
  expect(book.chapters).toHaveLength(1);
  const body = localStorage.getItem(
    `openchapter:chapter:${book.chapters[0].id}`,
  );
  expect(body).toBe('{"type":"doc"}');
  expect(localStorage.getItem("openchapter:spike:chapter-1")).toBeNull();
});

it("is idempotent — React runs effects twice in development", () => {
  localStorage.setItem(
    "openchapter:manifest",
    JSON.stringify({ bookTitle: "Once", chapters: [], lastOpenedId: null }),
  );

  migrateLegacy();
  migrateLegacy();

  expect(getShelf().books).toHaveLength(1);
});

it("does nothing when there is nothing to migrate", () => {
  migrateLegacy();
  expect(getShelf().books).toEqual([]);
});

it("leaves existing books alone", () => {
  const { bookId } = createBook("Already Here");
  localStorage.setItem(
    "openchapter:manifest",
    JSON.stringify({ bookTitle: "Old", chapters: [], lastOpenedId: null }),
  );

  migrateLegacy();

  expect(getShelf().books).toHaveLength(2);
  expect(findBook(getShelf(), bookId)?.title).toBe("Already Here");
});

it("starts a book with no author", () => {
  const { bookId } = createBook("The Salt Road");
  expect(findBook(getShelf(), bookId)!.author).toBeUndefined();
});

it("sets and updates a book's author", () => {
  const { bookId } = createBook("The Salt Road");

  setBookAuthor(bookId, "M. Reyes");
  expect(findBook(getShelf(), bookId)!.author).toBe("M. Reyes");

  setBookAuthor(bookId, "Mira Reyes");
  expect(findBook(getShelf(), bookId)!.author).toBe("Mira Reyes");
});

it("keeps the author separate per book", () => {
  const a = createBook("A");
  const b = createBook("B");

  setBookAuthor(a.bookId, "One Author");

  expect(findBook(getShelf(), a.bookId)!.author).toBe("One Author");
  expect(findBook(getShelf(), b.bookId)!.author).toBeUndefined();
});

it("starts with both writing modes off", () => {
  expect(getPrefs()).toEqual({
    focusMode: false,
    typewriter: false,
    leftPanel: true,
    rightPanel: false,
    paper: "white",
  });
});

it("returns an identical prefs reference on repeat reads", () => {
  // Same useSyncExternalStore constraint as the shelf.
  expect(getPrefs()).toBe(getPrefs());
});

it("sets one preference without disturbing the others", () => {
  setPref("focusMode", true);
  expect(getPrefs()).toMatchObject({ focusMode: true, typewriter: false });

  setPref("typewriter", true);
  expect(getPrefs()).toMatchObject({ focusMode: true, typewriter: true });

  setPref("focusMode", false);
  expect(getPrefs()).toMatchObject({ focusMode: false, typewriter: true });
});

it("degrades to defaults when prefs are corrupt", () => {
  localStorage.setItem("openchapter:prefs", "{ not json");
  expect(getPrefs()).toEqual({
    focusMode: false,
    typewriter: false,
    leftPanel: true,
    rightPanel: false,
    paper: "white",
  });
});

it("keeps prefs out of the shelf document", () => {
  // Preferences are not book data; a shelf write must not carry them.
  setPref("focusMode", true);
  expect(localStorage.getItem("openchapter:shelf")).toBeNull();
});

it("starts a chapter with no notes", () => {
  const { chapterId } = createBook();
  expect(getNotes(chapterId)).toBeNull();
});

it("saves and reads chapter notes", () => {
  const { chapterId } = createBook();
  saveNotes(chapterId, "Cut the market scene.");
  expect(getNotes(chapterId)).toBe("Cut the market scene.");
});

it("keeps notes out of the shelf document", () => {
  // Notes are unbounded text, like a chapter body. Putting them in the shelf
  // would make every keystroke rewrite the document the sidebar reads.
  const { chapterId } = createBook();
  saveNotes(chapterId, "a long note");
  expect(localStorage.getItem("openchapter:shelf")).not.toContain("a long note");
  expect(localStorage.getItem(`openchapter:notes:${chapterId}`)).toBe(
    "a long note",
  );
});

it("deletes notes along with the chapter", () => {
  const { bookId, chapterId } = createBook();
  saveNotes(chapterId, "gone soon");
  deleteChapter(bookId, chapterId);
  expect(getNotes(chapterId)).toBeNull();
});

it("deletes notes for every chapter of a deleted book", () => {
  const { bookId, chapterId } = createBook();
  saveNotes(chapterId, "gone soon");
  deleteBook(bookId);
  expect(getNotes(chapterId)).toBeNull();
});

it("remembers which panels are open", () => {
  expect(getPrefs().leftPanel).toBe(true);
  expect(getPrefs().rightPanel).toBe(false);

  setPref("rightPanel", true);
  expect(getPrefs().rightPanel).toBe(true);
  expect(getPrefs().leftPanel).toBe(true);
});

it("defaults the page to white paper", () => {
  expect(getPrefs().paper).toBe("white");
});

it("changes the paper colour", () => {
  setPref("paper", "sepia");
  expect(getPrefs().paper).toBe("sepia");
});

it("falls back to white for an unknown paper colour", () => {
  // Prefs come from localStorage, which anything can write to. A bogus value
  // must not leave the manuscript with no background at all.
  localStorage.setItem(
    "openchapter:prefs",
    JSON.stringify({ paper: "chartreuse" }),
  );
  expect(getPrefs().paper).toBe("white");
});

it("gives a book a default page setup without storing one", () => {
  const { bookId } = createBook();
  const book = findBook(getShelf(), bookId)!;
  // Not written on create: an absent field reads as the default, so existing
  // books need no migration.
  expect(book.page).toBeUndefined();
  expect(pageSetupOf(book)).toEqual({
    size: "letter",
    orientation: "portrait",
    margins: "normal",
    columns: 1,
    fit: true,
  });
});

it("patches one page setting without disturbing the rest", () => {
  const { bookId } = createBook();

  setPageSetup(bookId, { size: "a4" });
  setPageSetup(bookId, { orientation: "landscape" });

  const book = findBook(getShelf(), bookId)!;
  expect(pageSetupOf(book)).toEqual({
    size: "a4",
    orientation: "landscape",
    margins: "normal",
    columns: 1,
    fit: true,
  });
});

it("keeps page setup per book", () => {
  const a = createBook("A");
  const b = createBook("B");

  setPageSetup(a.bookId, { size: "a5", columns: 2 });

  expect(pageSetupOf(findBook(getShelf(), a.bookId)!).size).toBe("a5");
  expect(pageSetupOf(findBook(getShelf(), b.bookId)!).size).toBe("letter");
});

it("creates a book from a template's chapter list", () => {
  const { bookId } = createBookFromTemplate("The Salt Road", [
    "Act One",
    "Act Two",
    "Act Three",
  ]);

  const book = findBook(getShelf(), bookId)!;
  expect(book.title).toBe("The Salt Road");
  expect(book.chapters.map((c) => c.title)).toEqual([
    "Act One",
    "Act Two",
    "Act Three",
  ]);
});

it("returns the first chapter so the caller can open it", () => {
  const { bookId, chapterId } = createBookFromTemplate("T", ["Opening", "Next"]);
  const book = findBook(getShelf(), bookId)!;
  expect(book.chapters[0].id).toBe(chapterId);
});

it("still makes one chapter for an empty template", () => {
  // A book with no chapters is a dead end for the route that opens it.
  const { bookId } = createBookFromTemplate("Bare", []);
  expect(findBook(getShelf(), bookId)!.chapters).toHaveLength(1);
});

it("starts a book active, in neither archive nor trash", () => {
  const { bookId } = createBook("A");
  const shelf = getShelf();
  expect(booksIn(shelf, "active").map((b) => b.id)).toEqual([bookId]);
  expect(booksIn(shelf, "archived")).toEqual([]);
  expect(booksIn(shelf, "trashed")).toEqual([]);
});

it("archives and unarchives a book", () => {
  const { bookId } = createBook("A");

  archiveBook(bookId);
  expect(booksIn(getShelf(), "active")).toEqual([]);
  expect(booksIn(getShelf(), "archived").map((b) => b.id)).toEqual([bookId]);

  restoreBook(bookId);
  expect(booksIn(getShelf(), "active").map((b) => b.id)).toEqual([bookId]);
});

it("trashes a book without touching its chapters", () => {
  const { bookId, chapterId } = createBook("A");
  saveBody(bookId, chapterId, { type: "doc" }, 12);

  trashBook(bookId);

  expect(booksIn(getShelf(), "trashed").map((b) => b.id)).toEqual([bookId]);
  // The whole point of a trash: the words are still there.
  expect(localStorage.getItem(`openchapter:chapter:${chapterId}`)).not.toBeNull();
  expect(findBook(getShelf(), bookId)!.chapters[0].words).toBe(12);
});

it("shows a trashed book only in trash, even if it was archived", () => {
  const { bookId } = createBook("A");
  archiveBook(bookId);
  trashBook(bookId);

  expect(booksIn(getShelf(), "archived")).toEqual([]);
  expect(booksIn(getShelf(), "trashed").map((b) => b.id)).toEqual([bookId]);
});

it("restores a trashed book all the way back to active", () => {
  const { bookId } = createBook("A");
  archiveBook(bookId);
  trashBook(bookId);

  restoreBook(bookId);

  expect(booksIn(getShelf(), "active").map((b) => b.id)).toEqual([bookId]);
  expect(booksIn(getShelf(), "archived")).toEqual([]);
});

it("still deletes permanently, chapters and all", () => {
  const { bookId, chapterId } = createBook("A");
  saveBody(bookId, chapterId, { type: "doc" }, 3);
  trashBook(bookId);

  deleteBook(bookId);

  expect(findBook(getShelf(), bookId)).toBeNull();
  expect(localStorage.getItem(`openchapter:chapter:${chapterId}`)).toBeNull();
});

it("moves lastOpenedBookId off a book that leaves the active list", () => {
  const keep = createBook("Keep");
  const gone = createBook("Gone");
  touchLastOpenedBook(gone.bookId);

  archiveBook(gone.bookId);

  // Otherwise "Continue writing" points at a book no longer on the shelf.
  expect(getShelf().lastOpenedBookId).toBe(keep.bookId);
});

it("starts a chapter unbookmarked", () => {
  const { bookId } = createBook("A");
  expect(bookmarks(getShelf())).toEqual([]);
  expect(findBook(getShelf(), bookId)!.chapters[0].bookmarked).toBeUndefined();
});

it("toggles a bookmark on and off", () => {
  const { bookId, chapterId } = createBook("A");

  toggleBookmark(bookId, chapterId);
  expect(bookmarks(getShelf()).map((m) => m.chapter.id)).toEqual([chapterId]);

  toggleBookmark(bookId, chapterId);
  expect(bookmarks(getShelf())).toEqual([]);
});

it("collects bookmarks across every book", () => {
  const a = createBook("A");
  const b = createBook("B");
  toggleBookmark(a.bookId, a.chapterId);
  toggleBookmark(b.bookId, b.chapterId);

  const found = bookmarks(getShelf());
  expect(found).toHaveLength(2);
  // Each carries its book, so the panel can say where a chapter lives.
  expect(found.map((m) => m.book.title).sort()).toEqual(["A", "B"]);
});

it("hides bookmarks belonging to a trashed book", () => {
  const { bookId, chapterId } = createBook("A");
  toggleBookmark(bookId, chapterId);

  trashBook(bookId);

  expect(bookmarks(getShelf())).toEqual([]);
});

it("brings bookmarks back when the book is restored", () => {
  const { bookId, chapterId } = createBook("A");
  toggleBookmark(bookId, chapterId);
  trashBook(bookId);

  restoreBook(bookId);

  expect(bookmarks(getShelf()).map((m) => m.chapter.id)).toEqual([chapterId]);
});

it("drops a bookmark with the chapter it marked", () => {
  const { bookId, chapterId } = createBook("A");
  const second = createChapter(bookId, "Two");
  toggleBookmark(bookId, second);

  deleteChapter(bookId, second);

  expect(bookmarks(getShelf())).toEqual([]);
  expect(findBook(getShelf(), bookId)!.chapters.map((c) => c.id)).toEqual([
    chapterId,
  ]);
});

it("counts words across every chapter in the book", () => {
  const { bookId, chapterId } = createBook("A");
  const two = createChapter(bookId, "Two");
  saveBody(bookId, chapterId, { type: "doc" }, 500);
  saveBody(bookId, two, { type: "doc" }, 204);

  expect(bookWordCount(findBook(getShelf(), bookId)!)).toBe(704);
});
