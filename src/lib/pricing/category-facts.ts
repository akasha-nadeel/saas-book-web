import type { ListedBook } from "./apple-list";

/**
 * What a genre's Amazon top 100 says about its categories, and nothing it
 * does not (the Market check's Categories tab, Pro Plus, 2026-10-12).
 *
 * **The pain this answers** is the category question writers ask most: which
 * of Amazon's categories are real, how hard #1 is in one, and which three to
 * choose. Writers report "ghost" categories — offered when a book is set up,
 * with no page a reader can reach — and tools that sell a guess at how many
 * sales a rank takes.
 *
 * **Every figure here is a rank Amazon printed** on a book's own page — its
 * "Best Sellers Rank" line (`parseBestSellersRank`). Nothing is converted into
 * sales, nothing is called easy or hard, and a category nobody on the list
 * ranks in is not mentioned rather than guessed at. A category with books
 * ranking in it has a page; that much the list can say.
 */

/** The list positions whose store-wide rank the ladder shows. */
export const LADDER_POSITIONS = [1, 10, 25, 50, 100] as const;

export interface LadderStep {
  /** Where the book sits on this genre's list. */
  position: number;
  title: string;
  /** Its rank in the whole Kindle Store, or null when its page gave none. */
  storeRank: number | null;
}

/**
 * The whole store's rank at a few points down the genre's list — how far down
 * the Kindle Store the #1, the #10 … the #100 of this genre sit.
 *
 * Only positions the list actually reaches are returned, so a list of 60
 * books has no #100 rather than an empty one.
 */
export function storeLadder(books: readonly ListedBook[]): LadderStep[] {
  const at = new Map(books.map((b) => [b.position, b]));
  return LADDER_POSITIONS.flatMap((position) => {
    const book = at.get(position);
    return book
      ? [{ position, title: book.title, storeRank: book.storeRank ?? null }]
      : [];
  });
}

export interface CategorySeen {
  /** Amazon's own name for the category, store qualifier and all. */
  name: string;
  /** How many books on this list rank in it. */
  books: number;
  /** The highest rank any of them holds there (1 is the top). */
  topRank: number;
  /** That book's title and its rank in the whole store. */
  topTitle: string;
  topStoreRank: number | null;
}

export interface CategoriesSeen {
  categories: CategorySeen[];
  /** Books whose page gave a rank line at all. */
  known: number;
  /** Books on the list. */
  of: number;
}

/**
 * Every category the list's books also rank in, most-shared first.
 *
 * Named exactly as Amazon names them, so "Cozy Animal Mystery" and "Cozy
 * Animal Mysteries" stay two rows when Amazon keeps them as two categories.
 */
export function categoriesSeen(books: readonly ListedBook[]): CategoriesSeen {
  const seen = new Map<string, CategorySeen>();
  let known = 0;

  for (const book of books) {
    const ranks = book.categoryRanks ?? [];
    if (ranks.length > 0 || typeof book.storeRank === "number") known += 1;
    // A page naming one category twice counts the book once there.
    const once = new Map<string, number>();
    for (const r of ranks) once.set(r.name, Math.min(r.rank, once.get(r.name) ?? Infinity));

    for (const [name, rank] of once) {
      const row = seen.get(name);
      if (!row) {
        seen.set(name, {
          name,
          books: 1,
          topRank: rank,
          topTitle: book.title,
          topStoreRank: book.storeRank ?? null,
        });
        continue;
      }
      row.books += 1;
      if (rank < row.topRank) {
        row.topRank = rank;
        row.topTitle = book.title;
        row.topStoreRank = book.storeRank ?? null;
      }
    }
  }

  const categories = [...seen.values()].sort(
    (a, b) => b.books - a.books || a.topRank - b.topRank || a.name.localeCompare(b.name),
  );
  return { categories, known, of: books.length };
}
