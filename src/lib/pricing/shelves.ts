/**
 * The genres the price check offers, and where each one's list comes from.
 *
 * **Every shelf was fetched before it went in**: each Apple genre below
 * returned 100 books in the US store, every one with a price — the first
 * sixteen on 2026-10-05, the eleven after them on 2026-10-06, which were chosen
 * because their lists hold plenty of self-published books (33 to 86 of the
 * hundred). Adding a shelf is the same measurement: fetch `appleListUrl`, count
 * the entries and the self-published ones, and only add the row if the list
 * is full.
 *
 * **Measured and left out on 2026-10-06**:
 * - religious fiction and light novels, whose Christian and light-novel houses
 *   `publishers.ts` does not know yet, so their sides came out backwards
 * - inspirational and multicultural romance, whose lists hold 41 and 50 books,
 *   not 100
 * - wholesome romance, family fiction and detective novels, with too few
 *   self-published books to add anything
 *
 * **Nothing from Amazon is ever fetched here.** `amazonBestsellers` names
 * Amazon's own Kindle top-100 page for the same genre, found by search and
 * recorded with Amazon's own name for it. Where no page matched cleanly the
 * field is left out and the link falls back to a Kindle-store search, saying
 * that it is one.
 */

export const SHELF_FAMILIES = [
  "Romance",
  "Mystery & thriller",
  "Fantasy & sci-fi",
  "More fiction & memoir",
] as const;

export type ShelfFamily = (typeof SHELF_FAMILIES)[number];

export interface BestsellerShelf {
  id: string;
  label: string;
  family: ShelfFamily;
  /**
   * Apple Books genre id. The tree is at
   * itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres?id=38.
   */
  appleGenre: number;
  /** The words a Kindle-store search uses when there is no checked list page. */
  amazonWords: string;
  /** Amazon's own Kindle best-seller list for the genre, and Amazon's name for it. */
  amazonBestsellers?: { node: string; name: string };
}

export const SHELVES_MEASURED = "2026-10-06";

export const BESTSELLER_SHELVES: readonly BestsellerShelf[] = [
  // Romance
  { id: "contemporary-romance", label: "Contemporary romance", family: "Romance", appleGenre: 10057, amazonWords: "contemporary romance", amazonBestsellers: { node: "158568011", name: "Contemporary Romance" } },
  { id: "romantic-comedy", label: "Romantic comedy", family: "Romance", appleGenre: 11042, amazonWords: "romantic comedy", amazonBestsellers: { node: "6487841011", name: "Romantic Comedy" } },
  { id: "romantic-suspense", label: "Romantic suspense", family: "Romance", appleGenre: 10061, amazonWords: "romantic suspense", amazonBestsellers: { node: "158574011", name: "Romantic Suspense" } },
  { id: "paranormal-romance", label: "Paranormal romance", family: "Romance", appleGenre: 10058, amazonWords: "paranormal romance" },
  { id: "historical-romance", label: "Historical romance", family: "Romance", appleGenre: 10059, amazonWords: "historical romance" },
  { id: "military-romance", label: "Military romance", family: "Romance", appleGenre: 11233, amazonWords: "military romance", amazonBestsellers: { node: "6487836011", name: "Military Romance" } },
  { id: "western-romance", label: "Western romance", family: "Romance", appleGenre: 10062, amazonWords: "western romance", amazonBestsellers: { node: "6190489011", name: "Western & Frontier Romance" } },
  { id: "holiday-romance", label: "Holiday romance", family: "Romance", appleGenre: 11231, amazonWords: "holiday romance", amazonBestsellers: { node: "6487831011", name: "Holiday Romance" } },
  { id: "lgbtq-romance", label: "LGBTQIA+ romance", family: "Romance", appleGenre: 11043, amazonWords: "lgbtq romance" },
  { id: "new-adult-romance", label: "New adult romance", family: "Romance", appleGenre: 11040, amazonWords: "new adult romance", amazonBestsellers: { node: "6487838011", name: "New Adult & College Romance" } },
  { id: "erotic-romance", label: "Erotic romance", family: "Romance", appleGenre: 10056, amazonWords: "erotic romance", amazonBestsellers: { node: "7620225011", name: "Romantic Erotica" } },
  // Mystery & thriller
  { id: "cozy-mystery", label: "Cozy mystery", family: "Mystery & thriller", appleGenre: 11259, amazonWords: "cozy mystery", amazonBestsellers: { node: "6190476011", name: "Cozy Mystery" } },
  /* "All", because it is Apple's whole parent genre, and a tile that read
     "Mystery & thriller" under a heading reading the same looked like a slip. */
  { id: "mystery-thriller", label: "All mysteries & thrillers", family: "Mystery & thriller", appleGenre: 9032, amazonWords: "mystery thriller", amazonBestsellers: { node: "157305011", name: "Mystery, Thriller & Suspense" } },
  { id: "police-procedural", label: "Police procedural", family: "Mystery & thriller", appleGenre: 10052, amazonWords: "police procedural", amazonBestsellers: { node: "157318011", name: "Police Procedurals" } },
  { id: "women-sleuths", label: "Women sleuths", family: "Mystery & thriller", appleGenre: 10055, amazonWords: "women sleuths mystery", amazonBestsellers: { node: "157317011", name: "Women Sleuths" } },
  { id: "hard-boiled", label: "Hard-boiled mysteries", family: "Mystery & thriller", appleGenre: 10050, amazonWords: "hard boiled mystery", amazonBestsellers: { node: "157312011", name: "Hard-Boiled Mysteries" } },
  // Fantasy & sci-fi
  { id: "epic-fantasy", label: "Epic fantasy", family: "Fantasy & sci-fi", appleGenre: 11002, amazonWords: "epic fantasy", amazonBestsellers: { node: "158580011", name: "Epic Fantasy" } },
  { id: "urban-fantasy", label: "Urban fantasy", family: "Fantasy & sci-fi", appleGenre: 11275, amazonWords: "urban fantasy", amazonBestsellers: { node: "6157854011", name: "Urban Fantasy" } },
  { id: "paranormal-fantasy", label: "Paranormal fantasy", family: "Fantasy & sci-fi", appleGenre: 11004, amazonWords: "paranormal fantasy", amazonBestsellers: { node: "6157853011", name: "Paranormal & Urban Fantasy" } },
  { id: "historical-fantasy", label: "Historical fantasy", family: "Fantasy & sci-fi", appleGenre: 11003, amazonWords: "historical fantasy", amazonBestsellers: { node: "158582011", name: "Historical Fantasy" } },
  { id: "science-fiction", label: "Science fiction", family: "Fantasy & sci-fi", appleGenre: 10064, amazonWords: "science fiction", amazonBestsellers: { node: "158591011", name: "Science Fiction" } },
  // More fiction & memoir
  { id: "action-adventure", label: "Action & adventure", family: "More fiction & memoir", appleGenre: 10039, amazonWords: "action adventure fiction" },
  { id: "horror", label: "Horror", family: "More fiction & memoir", appleGenre: 10048, amazonWords: "horror" },
  { id: "historical-fiction", label: "Historical fiction", family: "More fiction & memoir", appleGenre: 10047, amazonWords: "historical fiction" },
  { id: "literary-fiction", label: "Literary fiction", family: "More fiction & memoir", appleGenre: 10049, amazonWords: "literary fiction" },
  { id: "young-adult", label: "Young adult fiction", family: "More fiction & memoir", appleGenre: 11177, amazonWords: "young adult fiction", amazonBestsellers: { node: "3511261011", name: "Teen & Young Adult eBooks" } },
  { id: "memoir", label: "Biography & memoir", family: "More fiction & memoir", appleGenre: 9008, amazonWords: "memoir" },
];

export function shelfById(id: string): BestsellerShelf | null {
  return BESTSELLER_SHELVES.find((shelf) => shelf.id === id) ?? null;
}

/**
 * A deliberate table rather than a fuzzy match: `GENRES` in `book-kinds.ts` is
 * what a book may call itself, and these are what a store files books under.
 * Other has no entry, which leaves nothing suggested — honest, not a gap.
 */
const SHELF_FOR_GENRE: Record<string, string> = {
  Fantasy: "epic-fantasy",
  "Science fiction": "science-fiction",
  Romance: "contemporary-romance",
  Mystery: "cozy-mystery",
  Thriller: "mystery-thriller",
  "Historical fiction": "historical-fiction",
  "Literary fiction": "literary-fiction",
  "Young adult": "young-adult",
  Horror: "horror",
  Memoir: "memoir",
};

export function shelfForBookGenre(
  genre: string | undefined,
): BestsellerShelf | null {
  if (!genre) return null;
  const id = SHELF_FOR_GENRE[genre];
  return id ? shelfById(id) : null;
}

export function appleListUrl(shelf: BestsellerShelf): string {
  return `https://itunes.apple.com/us/rss/toppaidebooks/limit=100/genre=${shelf.appleGenre}/json`;
}

export function amazonSearchUrl(shelf: BestsellerShelf): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(shelf.amazonWords)}&i=digital-text&s=exact-aware-popularity-rank`;
}

/**
 * Where to send a writer to see this genre on Amazon, and what to call it.
 *
 * **The label never claims more than the link is**: Amazon's own top-100
 * list, under Amazon's own name for it, when one was found for the genre; a
 * search of the Kindle store, called a search, when not.
 */
export function amazonLink(shelf: BestsellerShelf): { url: string; label: string } {
  if (shelf.amazonBestsellers) {
    return {
      url: `https://www.amazon.com/gp/bestsellers/digital-text/${shelf.amazonBestsellers.node}`,
      label: `Amazon’s top 100 in ${shelf.amazonBestsellers.name}`,
    };
  }
  return {
    url: amazonSearchUrl(shelf),
    label: "Search this genre in Amazon’s Kindle store",
  };
}
