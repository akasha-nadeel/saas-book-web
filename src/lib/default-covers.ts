/**
 * The jacket a book wears before anybody has made it a cover.
 *
 * **This is decoration, not a cover, and the difference is load-bearing.**
 * Nothing here is ever written to the store, nothing syncs, and `hasCover()`
 * goes on answering false for a book wearing one — so the dashboard keeps its
 * "No cover" finding, `storeReadiness()` goes on reporting what a shop would
 * refuse, and an exported EPUB has no cover page until the writer supplies real
 * artwork. `TODO.md` says why, in the roadmap entry for "get a cover made":
 * that step is deliberately not auto-detected *because* a placeholder attached
 * like any other cover would tick off the most expensive step in the list on
 * the strength of a picture nobody chose.
 *
 * What it replaces is the flat grey cloth face an image-less book used to wear.
 * A shelf of those was eight shades of one idea; these are seven pictures, and
 * a writer finds a book by its face.
 *
 * Three things decided the set. They are **portrait**, so they crop into a 2:3
 * face without a subject to behead. They are **abstract**, because a jacket
 * suggesting a genre nobody chose is a claim about somebody's book. And they
 * carry **no words**, which is why the title always prints over them where a
 * writer's own artwork may ask not to — see `bare` in `book-cover.tsx`.
 *
 * They are static files rather than bytes in the library: one request each,
 * cached by the browser, shared by every book on the shelf and by every writer.
 */

/** The seven, in `public/default-covers/`. */
export const DEFAULT_JACKETS = [
  "/default-covers/jacket-1.jpg",
  "/default-covers/jacket-2.jpg",
  "/default-covers/jacket-3.jpg",
  "/default-covers/jacket-4.jpg",
  "/default-covers/jacket-5.jpg",
  "/default-covers/jacket-6.jpg",
  "/default-covers/jacket-7.jpg",
] as const;

/**
 * A stable index into a list of `length`, folded from a book's id.
 *
 * The fold `coverPalette` has always used, lifted out of it so the cloth colour
 * and the jacket are chosen by one function rather than by two copies of one.
 * The arithmetic is unchanged, which is the point: a book keeps the ground it
 * already had.
 *
 * `| 0` after each step keeps the multiply inside 32 bits — without it the
 * hash drifts into the float range and stops being a hash.
 */
export function seedIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

/**
 * Which jacket this book wears.
 *
 * Fixed by whatever stable string the caller has — the book id, or its title
 * before it has one — so a jacket never shifts under a writer between renders,
 * reloads or machines.
 */
export function defaultJacketFor(seed: string): string {
  return DEFAULT_JACKETS[seedIndex(seed, DEFAULT_JACKETS.length)];
}
