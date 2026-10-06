/**
 * One book on a store's best-seller list, in the shape every source hands the
 * screen.
 *
 * **This shape is the boundary a second source plugs into.** Apple's feed is
 * the first; Amazon data, when there is money for it, is a second parser that
 * returns the same `ListedBook`, and nothing on the screen changes.
 */
export interface ListedBook {
  /** The store's own id for the book. */
  id: string;
  /** Where it sits on the list, 1 being the best seller. */
  position: number;
  title: string;
  author: string;
  price: number;
  currency: string;
  publisher: string | null;
  /** YYYY-MM-DD. */
  released: string | null;
  cover: string | null;
  /** The book's page in the store. */
  url: string | null;
}

type Json = Record<string, unknown>;

const obj = (value: unknown): Json | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;

const label = (value: unknown): string | null => {
  const text = obj(value)?.label;
  return typeof text === "string" && text.trim() ? text.trim() : null;
};

const attrs = (value: unknown): Json => obj(obj(value)?.attributes) ?? {};

/**
 * The cover, as a URL that actually loads.
 *
 * **The feed's own thumbnail URLs do not**: every `…/0x170bb.png` it listed on
 * 2026-10-05 answered 400 from Apple's image server. The same path with a
 * real bounding box — `400x400bb.jpg` — answers 200 with the cover fitted
 * inside it (265×400 for a 2:3 jacket), so the size is rewritten rather than
 * trusted.
 */
function coverOf(images: unknown): string | null {
  const list = Array.isArray(images) ? images : [images];
  const last = [...list].reverse().map(label).find(Boolean);
  return last ? last.replace(/\/\d+x\d+bb\.\w+$/, "/400x400bb.jpg") : null;
}

function linkOf(link: unknown): string | null {
  const list = Array.isArray(link) ? link : [link];
  for (const item of list) {
    const href = attrs(item).href;
    if (typeof href === "string" && attrs(item).rel !== "enclosure") return href;
  }
  return null;
}

/**
 * Apple's top-paid ebooks feed (`/us/rss/toppaidebooks/limit=100/genre=…/json`).
 *
 * **Defensive throughout, and it never throws.** A feed that changes shape
 * returns no books, and the route then reports no list rather than an empty
 * one. An entry without a title or a real price is skipped, and positions keep
 * counting, so a skipped entry leaves its gap.
 */
export function parseAppleList(payload: unknown): {
  books: ListedBook[];
  updated: string | null;
} {
  const feed = obj(obj(payload)?.feed);
  if (!feed) return { books: [], updated: null };

  const raw = feed.entry;
  const entries: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const books: ListedBook[] = [];

  entries.forEach((item, index) => {
    const e = obj(item);
    if (!e) return;
    const title = label(e["im:name"]);
    const price = Number(attrs(e["im:price"]).amount);
    const currency = attrs(e["im:price"]).currency;
    if (
      !title ||
      !Number.isFinite(price) ||
      price < 0 ||
      typeof currency !== "string"
    ) {
      return;
    }

    const id = attrs(e.id)["im:id"];
    const released = label(e["im:releaseDate"]);

    books.push({
      id: typeof id === "string" ? id : `${index}`,
      position: index + 1,
      title,
      author: label(e["im:artist"]) ?? "Unknown author",
      price,
      currency,
      publisher: label(e["im:publisher"]),
      released: released ? released.slice(0, 10) : null,
      cover: coverOf(e["im:image"]),
      url: linkOf(e.link),
    });
  });

  return { books, updated: books.length > 0 ? label(feed.updated) : null };
}
