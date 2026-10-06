import { describe, it, expect } from "vitest";
import { parseAppleList } from "./apple-list";

/** One entry in the shape Apple's feed really sends (recorded 2026-10-05). */
const entry = (over: Record<string, unknown> = {}) => ({
  "im:name": { label: "Murder at the Mill" },
  "im:artist": { label: "Jane Doe" },
  "im:publisher": { label: "Jane Doe Books LLC" },
  "im:price": { label: "$3.99", attributes: { amount: "3.99", currency: "USD" } },
  "im:releaseDate": { label: "2026-09-15T00:00:00-07:00" },
  "im:image": [
    { label: "https://is1-ssl.mzstatic.com/a/9781.jpg/0x55bb.png" },
    { label: "https://is1-ssl.mzstatic.com/a/9781.jpg/0x170bb.png" },
  ],
  link: { attributes: { rel: "alternate", href: "https://books.apple.com/us/book/x/id1?uo=2" } },
  id: { label: "https://books.apple.com/us/book/x/id1", attributes: { "im:id": "1" } },
  ...over,
});

const feed = (entries: unknown) => ({
  feed: { updated: { label: "2026-10-05T10:45:38-07:00" }, entry: entries },
});

describe("parseAppleList", () => {
  it("reads each book, in the list's own order", () => {
    const { books, updated } = parseAppleList(
      feed([entry(), entry({ id: { attributes: { "im:id": "2" } } })]),
    );

    expect(updated).toBe("2026-10-05T10:45:38-07:00");
    expect(books).toHaveLength(2);
    expect(books[0]).toEqual({
      id: "1",
      position: 1,
      title: "Murder at the Mill",
      author: "Jane Doe",
      price: 3.99,
      currency: "USD",
      publisher: "Jane Doe Books LLC",
      released: "2026-09-15",
      // The feed's `0x170bb.png` answers 400; a real bounding box answers 200.
      cover: "https://is1-ssl.mzstatic.com/a/9781.jpg/400x400bb.jpg",
      url: "https://books.apple.com/us/book/x/id1?uo=2",
    });
    expect(books[1].position).toBe(2);
  });

  it("reads a list of one, which the feed sends as an object", () => {
    expect(parseAppleList(feed(entry())).books).toHaveLength(1);
  });

  it("skips an entry with no usable price or title, and keeps counting positions", () => {
    const { books } = parseAppleList(
      feed([
        entry({ "im:price": { attributes: { amount: "abc", currency: "USD" } } }),
        entry({ "im:name": {} }),
        entry(),
      ]),
    );
    expect(books).toHaveLength(1);
    expect(books[0].position).toBe(3);
  });

  it("returns nothing, rather than throwing, for a payload it does not recognise", () => {
    expect(parseAppleList(null)).toEqual({ books: [], updated: null });
    expect(parseAppleList({ feed: {} })).toEqual({ books: [], updated: null });
  });
});
