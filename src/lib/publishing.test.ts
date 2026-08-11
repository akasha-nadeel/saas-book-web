import { describe, expect, it } from "vitest";
import { checkCover } from "@/lib/cover-check";
import type { Book } from "@/lib/library-store";
import {
  BLURB_MAX,
  bookIdentifier,
  fileAs,
  hasBlockingIssues,
  isValidIsbn13,
  normaliseIsbn,
  storeReadiness,
  type PublishingMeta,
} from "@/lib/publishing";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function makeBook(over: Partial<Book> = {}): Book {
  return {
    id: UUID,
    title: "The Salt Road",
    author: "Ursula K. Le Guin",
    chapters: [],
    lastOpenedId: null,
    lastOpenedAt: 0,
    ...over,
  };
}

/** A book with nothing standing in its way, so each test breaks one thing. */
const READY = {
  book: makeBook(),
  meta: {
    isbn: "9780306406157",
    description: "A caravan crosses a desert that is no longer there.",
    subjects: ["Fiction / Literary"],
    publisher: "Salt Press",
  } satisfies PublishingMeta,
  hasCover: true,
  chapterCount: 12,
  brokenImages: 0,
};

describe("isbn", () => {
  it("strips the hyphens and spaces people type", () => {
    expect(normaliseIsbn("978-0-306-40615-7")).toBe("9780306406157");
    expect(normaliseIsbn(" 978 0 306 40615 7 ")).toBe("9780306406157");
  });

  it("accepts a valid ISBN-13, hyphenated or not", () => {
    expect(isValidIsbn13("9780306406157")).toBe(true);
    expect(isValidIsbn13("978-0-306-40615-7")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidIsbn13("9780306406158")).toBe(false);
  });

  it("rejects a transposed pair, which is the mistake it exists to catch", () => {
    expect(isValidIsbn13("9780306404615")).toBe(false);
  });

  it("rejects ISBN-10 and anything the wrong length", () => {
    expect(isValidIsbn13("0306406152")).toBe(false);
    expect(isValidIsbn13("97803064061")).toBe(false);
    expect(isValidIsbn13("")).toBe(false);
  });

  it("rejects letters, including the X of an ISBN-10 check digit", () => {
    expect(isValidIsbn13("978030640615X")).toBe(false);
  });
});

describe("bookIdentifier", () => {
  it("is the same across exports of the same book", () => {
    const book = makeBook();
    expect(bookIdentifier(book)).toBe(bookIdentifier(book));
  });

  it("prefers a valid ISBN", () => {
    expect(bookIdentifier(makeBook(), { isbn: "978-0-306-40615-7" })).toBe(
      "urn:isbn:9780306406157",
    );
  });

  it("falls back to the book id when the ISBN does not check out", () => {
    // Publishing under a mistyped ISBN is worse than publishing under none.
    expect(bookIdentifier(makeBook(), { isbn: "9780306406158" })).toBe(
      `urn:uuid:${UUID}`,
    );
  });

  it("only claims urn:uuid for something that is a UUID", () => {
    // library-store falls back to this shape outside a secure context.
    const book = makeBook({ id: "m3k2x1-a8f2b1c9" });
    expect(bookIdentifier(book)).toBe("openchapter:book:m3k2x1-a8f2b1c9");
  });

  it("distinguishes two books", () => {
    expect(bookIdentifier(makeBook())).not.toBe(
      bookIdentifier(makeBook({ id: "8b1e77c2-0000-4000-8000-000000000000" })),
    );
  });
});

describe("fileAs", () => {
  it("moves the last name to the front for shelving", () => {
    expect(fileAs("Ursula K. Le Guin")).toBe("Guin, Ursula K. Le");
    expect(fileAs("Toni Morrison")).toBe("Morrison, Toni");
  });

  it("leaves a single-word name alone", () => {
    expect(fileAs("Homer")).toBe("Homer");
  });

  it("tidies the spacing it was given", () => {
    expect(fileAs("  Toni   Morrison ")).toBe("Morrison, Toni");
  });
});

describe("storeReadiness", () => {
  const fields = (input: Parameters<typeof storeReadiness>[0]) =>
    storeReadiness(input).map((i) => `${i.level}:${i.field}`);

  it("passes a book with everything filled in", () => {
    expect(storeReadiness(READY)).toEqual([]);
    expect(hasBlockingIssues(storeReadiness(READY))).toBe(false);
  });

  it("blocks on a missing cover", () => {
    expect(fields({ ...READY, hasCover: false })).toContain("blocking:cover");
  });

  it("blocks on a missing author", () => {
    expect(
      fields({ ...READY, book: makeBook({ author: undefined }) }),
    ).toContain("blocking:author");
  });

  it("blocks on a book still called Untitled book", () => {
    expect(
      fields({ ...READY, book: makeBook({ title: "Untitled book" }) }),
    ).toContain("blocking:title");
  });

  it("blocks on the placeholder however it is capitalised", () => {
    // The one the app actually creates is "Untitled Book" with a capital B —
    // `createBook` and five other sites in library-store.ts write it that way,
    // while `sync.ts` falls back to the lowercase spelling. This check was
    // written against the lowercase one and so never fired on a real book.
    for (const title of [
      "Untitled Book",
      "untitled book",
      "  Untitled Book ",
    ]) {
      expect(fields({ ...READY, book: makeBook({ title }) })).toContain(
        "blocking:title",
      );
    }
  });

  it("leaves a real title alone even when it starts with the word", () => {
    expect(
      fields({ ...READY, book: makeBook({ title: "Untitled Book Two" }) }),
    ).not.toContain("blocking:title");
  });

  it("blocks on an empty book", () => {
    expect(fields({ ...READY, chapterCount: 0 })).toContain(
      "blocking:chapters",
    );
  });

  it("advises on images that could not be read, and counts them", () => {
    // Advisory rather than blocking: EPUBCheck accepts the data URL such an
    // image falls back to, so this is "look at that picture", not "you cannot
    // sell this".
    const issues = storeReadiness({ ...READY, brokenImages: 3 });
    const images = issues.find((i) => i.field === "images");
    expect(images?.level).toBe("advisory");
    expect(images?.message).toContain("3 images");
  });

  it("advises on images with no description", () => {
    const issues = storeReadiness({ ...READY, undescribedImages: 2 });
    const alt = issues.find((i) => i.field === "alt");
    expect(alt?.level).toBe("advisory");
    expect(alt?.message).toContain("2 images");
  });

  it("blocks on a bad ISBN but only advises on a missing one", () => {
    expect(
      fields({ ...READY, meta: { ...READY.meta, isbn: "9780306406158" } }),
    ).toContain("blocking:isbn");
    expect(
      fields({ ...READY, meta: { ...READY.meta, isbn: undefined } }),
    ).toContain("advisory:isbn");
  });

  it("blocks on a blurb over the limit", () => {
    expect(
      fields({
        ...READY,
        meta: { ...READY.meta, description: "x".repeat(BLURB_MAX + 1) },
      }),
    ).toContain("blocking:description");
  });

  it("advises on a missing blurb, categories and publisher", () => {
    const found = fields({ ...READY, meta: {} });
    expect(found).toContain("advisory:description");
    expect(found).toContain("advisory:subjects");
    expect(found).toContain("advisory:publisher");
  });

  it("blocks on a publication date that is not a date", () => {
    expect(
      fields({ ...READY, meta: { ...READY.meta, published: "March 2026" } }),
    ).toContain("blocking:published");
    expect(
      fields({ ...READY, meta: { ...READY.meta, published: "2026-03-01" } }),
    ).not.toContain("blocking:published");
  });

  it("reports every problem at once rather than the first", () => {
    // A writer fixing these one export at a time would run the export six
    // times to learn six things.
    const issues = storeReadiness({
      book: makeBook({ title: "Untitled book", author: undefined }),
      meta: {},
      hasCover: false,
      chapterCount: 0,
      brokenImages: 1,
    });
    expect(issues.filter((i) => i.level === "blocking").length).toBe(4);
  });
});

describe("cover findings on the readiness list", () => {
  const facts = { width: 1672, height: 941, bytes: 200_000 };

  // Sending only the detail produced "This is 0.56:1; shops set…" — a sentence
  // with no subject, in a column where every neighbour names its problem first.
  //
  // Asserted against `checkCover`'s own label rather than a copy of the words,
  // so rewording a finding does not fail a test about *sentence shape*. This
  // one did exactly that when the shape label was corrected to say what Amazon
  // actually asks for.
  it("opens with the label, like every other line", () => {
    const issues = storeReadiness({ ...READY, coverFacts: facts });
    const shape = issues.find((i) => i.field === "cover-shape");
    const finding = checkCover(facts).find((f) => f.id === "shape")!;
    expect(shape?.message.startsWith(`${finding.label}.`)).toBe(true);
    expect(shape?.message).toContain(finding.detail);
  });

  it("says nothing about the cover file when it has not been measured", () => {
    const issues = storeReadiness(READY);
    expect(issues.some((i) => i.field.startsWith("cover-"))).toBe(false);
  });
});
