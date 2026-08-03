import type { Entry } from "./ledger";
import type { Book } from "./library-store";

/**
 * Whether each book did better than the last — the book-three curve.
 *
 * The folklore is everywhere in the research and nobody can check it: *writers
 * report no traction until their third book.* A writer two books in cannot
 * tell whether they are on that curve or whether the whole thing is a story
 * people tell each other, and the difference decides whether they write a
 * third. It should not be a feeling, and for anyone who has imported a sales
 * report it does not have to be.
 *
 * **The comparison is like-for-like or it is nothing.** A first book that has
 * been out three years has earned more than a second one out three months, and
 * saying so proves only that time passes. So every book is measured over *the
 * same number of days from its own publication date* — the window is the age
 * of the youngest book that qualifies, and the older books are cut back to it.
 * That is the whole of the arithmetic, and it is the only version of this
 * question worth answering.
 *
 * **It refuses far more often than it answers**, which is the point of the
 * feature rather than a limitation of it:
 *
 * - fewer than two books that can be placed and it returns null, because one
 *   point is not a curve and two is barely one;
 * - a book with no publication date cannot be placed at all, since there is no
 *   day nought to count from;
 * - a book published last week is left out rather than compared over six days,
 *   which would say only that it is new;
 * - a book with no sales rows is a gap in the record, not a zero. On a money
 *   screen those read identically and mean opposite things.
 *
 * Every book left out is named, with why. A quiet exclusion on this screen
 * would be a curve drawn through whichever books happened to qualify.
 */

/**
 * The shortest window worth comparing over.
 *
 * A month is short enough that a second book qualifies within a reasonable
 * time and long enough to be past the launch spike, which is the part of a
 * book's life least like the rest of it. Below this the figure would be
 * measuring how recently something came out.
 */
export const MIN_WINDOW_DAYS = 30;

const DAY = 86_400_000;

export type LeftOut = "no-date" | "too-new" | "no-sales";

export interface CurveBook {
  bookId: string;
  title: string;
  /** Epoch ms, from `publishing.published`. */
  published: number;
  /** Earned inside the window. Rounded like every other ledger figure. */
  earned: number;
  /** Copies inside the window, where rows carried a count. */
  units: number;
  /** How many income rows that figure came from — the provenance. */
  rows: number;
}

/**
 * Not enough to draw anything, and exactly what is short.
 *
 * Returned rather than null so the screen can say "one book is on this so far,
 * and a second one published with sales recorded makes it a comparison" —
 * which is a useful thing to be told, where a blank space is not. `left` is the
 * same list the drawn curve carries, so the reasons read identically either
 * side of the threshold.
 */
export interface Pending {
  ready: false;
  /** How many books qualified. Zero or one, or this would be a curve. */
  placed: number;
  left: { title: string; why: LeftOut }[];
}

export interface Curve {
  ready: true;
  /**
   * Days from publication that every book here is measured over. The age of
   * the youngest book on the curve, so the oldest is cut back to match.
   */
  windowDays: number;
  /** Oldest first, which is the order they were published in. */
  books: CurveBook[];
  /** Named rather than silently dropped. */
  left: { title: string; why: LeftOut }[];
  /**
   * Whether each book earned more than the one before it, in its own window.
   *
   * A fact about four numbers, and deliberately not a verdict: the screen says
   * "each earned more than the last", never "you are on the curve" — which
   * would be a prediction, and a prediction is what this product does not sell.
   */
  eachAboveTheLast: boolean;
}

/**
 * Place every book that can be placed, and say what happened to the rest.
 *
 * Answers `ready: false` far more often than it draws anything — which is most
 * of the time, and for most writers permanently. That is not a failure state;
 * it is the honest answer to a question about a shelf that does not exist yet.
 */
export function curveOf(
  books: readonly Book[],
  entries: readonly Entry[],
  now = Date.now(),
): Curve | Pending {
  const left: { title: string; why: LeftOut }[] = [];
  const dated: { book: Book; published: number }[] = [];

  for (const book of books) {
    if (book.trashedAt || book.archivedAt) continue;

    const published = publishedAt(book);
    if (published === null || published > now) {
      left.push({ title: book.title, why: "no-date" });
      continue;
    }
    if (now - published < MIN_WINDOW_DAYS * DAY) {
      left.push({ title: book.title, why: "too-new" });
      continue;
    }
    dated.push({ book, published });
  }

  // Income only. A cost is money the writer chose to spend and says nothing
  // about whether readers turned up, which is the question here.
  const income = entries.filter((e) => e.kind === "income");
  const withSales = dated.filter(({ book }) =>
    income.some((e) => e.bookId === book.id),
  );
  for (const { book } of dated) {
    if (!withSales.some((row) => row.book.id === book.id)) {
      left.push({ title: book.title, why: "no-sales" });
    }
  }

  if (withSales.length < 2) {
    return { ready: false, placed: withSales.length, left };
  }

  // The window is set by the youngest book that qualified, so every book is
  // measured over a stretch all of them have actually lived through.
  const windowDays = Math.floor(
    Math.min(...withSales.map(({ published }) => now - published)) / DAY,
  );

  const placed = withSales
    .map(({ book, published }) => {
      const inWindow = income.filter(
        (e) =>
          e.bookId === book.id &&
          e.at >= published &&
          e.at < published + windowDays * DAY,
      );
      return {
        bookId: book.id,
        title: book.title,
        published,
        earned: round(inWindow.reduce((sum, e) => sum + e.amount, 0)),
        units: inWindow.reduce((sum, e) => sum + (e.units ?? 0), 0),
        rows: inWindow.length,
      };
    })
    .sort((a, b) => a.published - b.published);

  return {
    ready: true,
    windowDays,
    books: placed,
    left,
    eachAboveTheLast: placed.every(
      (book, i) => i === 0 || book.earned > placed[i - 1].earned,
    ),
  };
}

/** A publication date as epoch ms, or null when there isn't a usable one. */
function publishedAt(book: Book): number | null {
  const date = book.publishing?.published?.trim();
  if (!date) return null;
  // Anchored to UTC noon: a bare `YYYY-MM-DD` parses as midnight UTC, and in
  // a western timezone that is the previous evening — which moves a book
  // published on the 1st into the previous month for anyone west of London.
  const parsed = Date.parse(`${date}T12:00:00Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
