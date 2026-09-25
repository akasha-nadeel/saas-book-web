/**
 * The arithmetic of setting a paperback up.
 *
 * From the research: *"I'm just cursed when it comes to setting up paperbacks —
 * it always takes ten times as long as it should."* It takes ten times as long
 * because four separate numbers depend on the page count, and the page count is
 * the last thing a writer learns. Spine width, inside margin, cover width,
 * cover height. None of it is hard; all of it is fiddly, and getting one wrong
 * means a rejected upload or a spine with the title printed off the edge.
 *
 * **Every constant here is a published figure, not a guess, and every one is
 * named so it can be checked.** The numbers are Amazon KDP's, which are also
 * the strictest of the print-on-demand services in common use — a cover built
 * to these passes elsewhere. They are recorded as constants rather than baked
 * into the formulas precisely so that when a shop changes one, there is a
 * single line to change and a test that fails.
 *
 * **This does not replace the shop's own template**, and everything built on it
 * says so. A printer's file is the one place where being approximately right is
 * worth nothing, and KDP will generate an exact template for a given page count
 * — this is for knowing the numbers *before* you get there, and for checking
 * that the template you were sent is the one you asked for.
 */

/**
 * Paper stocks, and how thick one page of each is, in inches. KDP's figures.
 *
 * Checked against KDP's "Create a Paperback Cover" page on 2026-09-15. There
 * are two colour stocks and they are not the same thickness: standard colour
 * is printed on the white paper's weight, premium colour on a heavier one. This
 * held a single "Colour" at the premium figure, which gave a standard-colour
 * book a spine too wide by about a twentieth of an inch at 300 pages.
 */
export const PAPER = {
  white: { label: "White", perPage: 0.002252, minPages: 24, maxPages: 828 },
  cream: { label: "Cream", perPage: 0.0025, minPages: 24, maxPages: 776 },
  standardColour: {
    label: "Standard colour",
    perPage: 0.002252,
    minPages: 72,
    maxPages: 600,
  },
  premiumColour: {
    label: "Premium colour",
    perPage: 0.002347,
    minPages: 24,
    maxPages: 828,
  },
} as const;

export type PaperStock = keyof typeof PAPER;

/**
 * The inside margin, which has to grow with the page count.
 *
 * A thick book does not open flat, so text near the spine curves out of sight.
 * This is the one number writers most often leave at a default and most often
 * regret — it is invisible on screen and obvious in the hand.
 *
 * KDP's published table, in inches, as [maxPages, gutter].
 */
const GUTTER_TABLE: [number, number][] = [
  [150, 0.375],
  [300, 0.5],
  [500, 0.625],
  [700, 0.75],
  [828, 0.875],
];

/** Bleed, on each edge that runs off the page. */
export const BLEED = 0.125;

/** The least KDP accepts on the outside edges of an interior page with no bleed. */
export const OUTSIDE_MARGIN_MIN = 0.25;

/** The same edges when the interior has bleed. KDP's table, checked 2026-09-15. */
export const OUTSIDE_MARGIN_BLEED_MIN = 0.375;

/**
 * The fewest and most pages KDP will bind on any paper.
 *
 * Each stock narrows it (`minPages`/`maxPages` on `PAPER`, from KDP's "Set
 * Trim Size, Bleed, and Margins" page, checked 2026-09-25): cream stops at
 * 776, and standard colour runs only 72 to 600. The problems below read the
 * stock's own range, not these.
 */
export const MIN_PAGES = 24;
export const MAX_PAGES = 828;

/**
 * The fewest pages a spine may carry text on.
 *
 * KDP: "We only print spine text on books with more than 79 pages" — so 80.
 * This read 79 until 2026-09-25, which let the one odd count on the line
 * through. It replaces a guess drawn from how wide the spine looked on screen.
 */
export const SPINE_TEXT_MIN_PAGES = 80;

/**
 * The trim sizes KDP will print a paperback at, in inches. Anything between
 * these is accepted as a custom trim; the app's page setup also offers office
 * sizes (Legal, Tabloid, A3, B4) that fall outside them.
 */
export const TRIM_MIN = { width: 4, height: 6 } as const;
export const TRIM_MAX = { width: 8.5, height: 11.69 } as const;

export interface PaperbackSpec {
  pages: number;
  stock: PaperStock;
  /** Inches. */
  spine: number;
  gutter: number;
  outsideMargin: number;
  /** Whether KDP allows text on the spine at this page count. */
  spineText: boolean;
  /** The full wrap: back cover, spine and front, plus bleed all round. */
  coverWidth: number;
  coverHeight: number;
  /** What a printer will refuse, in the writer's words. Empty when nothing. */
  problems: string[];
}

/**
 * Every number a paperback needs, from the page count and the trim size.
 *
 * Returns the spec even when the page count is out of range, with the problem
 * named — a writer at 18 pages wants to be told that 24 is the minimum, not
 * handed nothing and left to work out why.
 */
export function paperbackSpec(
  pages: number,
  trimWidth: number,
  trimHeight: number,
  stock: PaperStock = "white",
): PaperbackSpec {
  const problems: string[] = [];
  const paper = PAPER[stock];
  if (!Number.isFinite(pages) || pages <= 0) {
    problems.push("No page count yet, so none of these numbers can be worked out.");
  } else if (pages < paper.minPages) {
    problems.push(
      `${pages} pages. A paperback on ${paper.label.toLowerCase()} paper needs at least ${paper.minPages}, so this would be refused as it stands.`,
    );
  } else if (pages > paper.maxPages) {
    problems.push(
      `${pages} pages. KDP binds at most ${paper.maxPages} on ${paper.label.toLowerCase()} paper; past that a book has to become two volumes${
        paper.maxPages < MAX_PAGES ? ` or move to a paper that takes up to ${MAX_PAGES}` : ""
      }.`,
    );
  }
  if (
    trimWidth < TRIM_MIN.width ||
    trimHeight < TRIM_MIN.height ||
    trimWidth > TRIM_MAX.width ||
    trimHeight > TRIM_MAX.height
  ) {
    problems.push(
      `A ${trimWidth}″ × ${trimHeight}″ page is not a size KDP prints a paperback at — it takes ${TRIM_MIN.width}–${TRIM_MAX.width}″ wide and ${TRIM_MIN.height}–${TRIM_MAX.height}″ tall. Change the trim in page setup; these numbers are for the size you have now.`,
    );
  }

  const safePages = Math.max(0, Math.round(pages) || 0);
  const spine = safePages * paper.perPage;
  const gutter = gutterFor(safePages);

  return {
    pages: safePages,
    stock,
    spine,
    gutter,
    outsideMargin: OUTSIDE_MARGIN_MIN,
    spineText: safePages >= SPINE_TEXT_MIN_PAGES,
    // Back and front side by side with the spine between, and bleed on all
    // four outer edges — so the width gains two bleeds and so does the height.
    coverWidth: trimWidth * 2 + spine + BLEED * 2,
    coverHeight: trimHeight + BLEED * 2,
    problems,
  };
}

/** The inside margin for a page count. Above the table's top, the largest. */
export function gutterFor(pages: number): number {
  for (const [max, gutter] of GUTTER_TABLE) {
    if (pages <= max) return gutter;
  }
  return GUTTER_TABLE[GUTTER_TABLE.length - 1][1];
}

/**
 * Pages a manuscript is likely to run to, from its word count.
 *
 * **An estimate, and the screen has to say so.** Real page count comes from the
 * exported PDF, because it depends on trim size, type size, leading and where
 * every chapter happens to break. This is for the writer who has not exported
 * yet and wants to know roughly how thick the book will be.
 *
 * Rounded up to an even number: a printed book has two sides to every leaf, so
 * an odd count is not a thing that can be bound.
 */
export function estimatePages(words: number, wordsPerPage = 275): number {
  if (words <= 0) return 0;
  const pages = Math.ceil(words / wordsPerPage);
  return pages % 2 === 0 ? pages : pages + 1;
}

/** Inches to millimetres, for everyone who does not think in inches. */
export function mm(inches: number): number {
  return Math.round(inches * 25.4 * 10) / 10;
}

/** Inches, to two places — the precision printers' templates are given in. */
export function inches(value: number): number {
  return Math.round(value * 100) / 100;
}
