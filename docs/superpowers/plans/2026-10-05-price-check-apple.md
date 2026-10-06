# Price check on best-seller lists — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the price check on Apple Books' free top-100-per-genre lists. It keeps
self-published and traditional prices apart, and shows what Amazon would pay the writer at any
price, for Kindle and paperback.

**Architecture:**
- **The data.** One server route fetches Apple's public list for a genre, caches it for a day,
  and returns parsed books.
- **The logic.** Pure, tested modules in `src/lib/pricing/` do every figure:
  - grouping by publisher
  - medians and middle halves
  - chart bins
  - Amazon's published KDP rules
- **The screen.** The client screen is rebuilt as one page, answer first, from small components
  in `src/components/price-check/`.
- **Later.** Amazon data replaces Apple as a second source behind the same `ListedBook` shape.

**Tech stack:** Next.js 16 route handler (`next: { revalidate }` fetch cache), React 19,
Tailwind v4, Vitest.

**Design note:** `docs/plans/2026-10-05-price-check-amazon-design.md`.

**Measured before writing (2026-10-05):**
- All 16 shelves below returned 100 books, every one priced.
- Only 125 of 1,800 listings name a series number, which is about 7 per list. **The series
  section is therefore dropped** for the Apple version; the screen says the list cannot tell.
- Apple gives no page counts, so the length section is dropped too.

**Working tree warning:** the tree holds uncommitted admin-dashboard work, including
`noteActivity` in `price-check-page.tsx`, `bookshelf.tsx` and `privacy/page.tsx`.
- Keep `noteActivity("price_check_run")`.
- Edit with exact-string edits, never by overwriting those shared files.
- **Do not commit without the owner's go-ahead.** `activity-log.ts` is untracked, so committing
  only this work would break the build.

---

### Task 1: Shared order statistics

**Files:**
- Create: `src/lib/pricing/stats.ts`
- Create: `src/lib/pricing/stats.test.ts`
- Modify: `src/lib/comps/price-check.ts` (delete the private `rank` and `median`, import them)

- [ ] **Step 1: Write the failing test** — `src/lib/pricing/stats.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { median, nearestRank } from "./stats";

describe("median", () => {
  it("takes the middle of an odd list", () => {
    expect(median([1, 2, 9])).toBe(2);
  });

  it("averages the two middle values of an even list", () => {
    expect(median([1, 2, 4, 9])).toBe(3);
  });
});

describe("nearestRank", () => {
  it("reads the quarter and three-quarter marks of a sorted list", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(nearestRank(sorted, 0.25)).toBe(3);
    expect(nearestRank(sorted, 0.75)).toBe(7);
  });

  it("never reads past the end", () => {
    expect(nearestRank([5], 0.75)).toBe(5);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/pricing/stats.test.ts`. Expected: FAIL, because
  the module does not exist.

- [ ] **Step 3: Implement** — `src/lib/pricing/stats.ts`

```ts
/**
 * The two order statistics every price figure in OpenChapter is built from.
 *
 * Shared by the old Google price search (`comps/price-check.ts`) and the
 * best-seller shelves (`pricing/shelf-facts.ts`), so the two can never disagree
 * about what "the middle price" of the same numbers is.
 */

/** The median of a list already sorted ascending. An even list averages its two middle values. */
export function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Nearest-rank order statistic, on a list already sorted ascending. */
export function nearestRank(sorted: readonly number[], fraction: number): number {
  const at = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[at];
}
```

- [ ] **Step 4:** In `src/lib/comps/price-check.ts`:
  - delete the two private functions `rank` and `median` (the `/** Nearest-rank … */` block and
    `function median`)
  - add `import { median, nearestRank as rank } from "../pricing/stats";` under the existing
    import

- [ ] **Step 5:** Run `npx vitest run src/lib/pricing/stats.test.ts src/lib/comps/price-check.test.ts`.
  Expected: PASS.

---

### Task 2: Amazon's published KDP rules

**Files:**
- Create: `src/lib/pricing/kdp-terms.ts`
- Create: `src/lib/pricing/kdp-terms.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/pricing/kdp-terms.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { ebookPay, paperbackPay, printCost } from "./kdp-terms";

describe("ebookPay", () => {
  it("pays 70% after delivery between $2.99 and $12.99", () => {
    expect(ebookPay(4.99)).toEqual({ allowed: true, rate: 0.7, delivery: 0.15, pay: 3.39 });
    expect(ebookPay(2.99).pay).toBe(1.99);
    expect(ebookPay(9.99).pay).toBe(6.89);
    expect(ebookPay(12.99).pay).toBe(8.99);
  });

  it("uses the $12.99 ceiling of 2026-07-07, not the old $9.99", () => {
    expect(ebookPay(11.99).rate).toBe(0.7);
    expect(ebookPay(13.99)).toEqual({ allowed: true, rate: 0.35, delivery: 0, pay: 4.9 });
  });

  it("pays 35% below $2.99 with no delivery charge", () => {
    expect(ebookPay(0.99)).toEqual({ allowed: true, rate: 0.35, delivery: 0, pay: 0.35 });
    expect(ebookPay(1.99).pay).toBe(0.7);
  });

  it("refuses a price Amazon does not accept", () => {
    expect(ebookPay(0.5)).toEqual({ allowed: false, rate: 0.35, delivery: 0, pay: 0 });
    expect(ebookPay(250).allowed).toBe(false);
  });

  it("charges delivery by the megabyte, with a one-cent floor", () => {
    expect(ebookPay(4.99, 3).delivery).toBe(0.45);
    expect(ebookPay(4.99, 0.01).delivery).toBe(0.01);
  });
});

describe("printCost", () => {
  it("charges a flat $2.30 from 24 to 108 pages", () => {
    expect(printCost(24)).toBe(2.3);
    expect(printCost(108)).toBe(2.3);
  });

  it("charges $1.00 plus 1.2 cents a page from 110", () => {
    expect(printCost(110)).toBe(2.32);
    expect(printCost(300)).toBe(4.6);
  });

  it("has no price outside 24 to 828 pages", () => {
    expect(printCost(20)).toBe(null);
    expect(printCost(900)).toBe(null);
  });
});

describe("paperbackPay", () => {
  it("reproduces KDP's own worked example", () => {
    // KDP help A1OYGQ0E1L4WBS: $15, 333 pages, black ink — (0.60 × $15) − $5.00 = $4.00.
    const pay = paperbackPay(15, 333);
    expect(pay?.printing).toBe(5);
    expect(pay?.rate).toBe(0.6);
    expect(pay?.pay).toBe(4);
  });

  it("pays 50% at $9.98 and under, 60% from $9.99", () => {
    expect(paperbackPay(9.98, 300)?.rate).toBe(0.5);
    expect(paperbackPay(9.99, 300)?.rate).toBe(0.6);
  });

  it("names the lowest list price Amazon accepts", () => {
    expect(paperbackPay(12, 300)?.lowest).toBe(9.2); // $4.60 ÷ 50%
    expect(paperbackPay(15, 333)?.lowest).toBe(9.99); // $5.00 ÷ 50% is $10, a 60% price
    expect(paperbackPay(20, 500)?.lowest).toBe(11.67); // $7.00 ÷ 60%
  });

  it("has nothing to say about a page count Amazon will not print", () => {
    expect(paperbackPay(10, 10)).toBe(null);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/pricing/kdp-terms.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/pricing/kdp-terms.ts`

```ts
/**
 * What Amazon pays a KDP author on Amazon.com, as Amazon publishes it.
 *
 * **Every constant is a published rule, not an estimate**, read off the KDP
 * help page named beside it on 2026-10-05. They move rarely but they do move:
 * the 70% ceiling went from $9.99 to $12.99 on 2026-07-07, the first change
 * since 2007, and print royalties under $9.99 fell from 60% to 50% on
 * 2025-06-10. Re-read the pages before trusting these past a year.
 *
 * **Nothing here says what to charge.** It answers "if I charge this, what
 * does Amazon pay me", which is the sum a writer would otherwise do on KDP's
 * own calculator, and nothing else.
 */

/** https://kdp.amazon.com/en_US/help/topic/G200634560 — Amazon.com, USD. */
export const EBOOK_70 = { min: 2.99, max: 12.99, rate: 0.7 } as const;
/** Same page: the 35% option's range for a file under 3 MB. */
export const EBOOK_35 = { min: 0.99, max: 200, rate: 0.35 } as const;
/** https://kdp.amazon.com/en_US/help/topic/G200634500 — taken on 70% sales only. */
export const DELIVERY_PER_MB = 0.15;
export const DELIVERY_MIN = 0.01;
/**
 * The file size the screen assumes, and says it assumes. A novel with no
 * pictures converts to well under a megabyte.
 */
export const ASSUMED_MB = 1;

/** https://kdp.amazon.com/en_US/help/topic/G201834340 — black ink, Amazon.com. */
export const PRINT = {
  minPages: 24,
  maxPages: 828,
  /** Up to this many pages, one flat charge. */
  flatUpTo: 108,
  flat: 2.3,
  /** From 110 pages, a fixed charge plus a charge per page. */
  fixed: 1.0,
  perPage: 0.012,
} as const;

/** https://kdp.amazon.com/en_US/help/topic/A1OYGQ0E1L4WBS — Amazon.com marketplace. */
export const PAPERBACK_RATE = { low: 0.5, high: 0.6, highFrom: 9.99 } as const;

const cents = (n: number) => Math.round(n * 100) / 100;
/** Up to the next cent, with a hair of slack so 9.2000000001 stays 9.20. */
const ceilCents = (n: number) => Math.ceil(n * 100 - 1e-6) / 100;

export interface EbookPay {
  /** Whether Amazon accepts this list price at all. */
  allowed: boolean;
  rate: number;
  /** The delivery charge taken before the 70% is worked out. Zero on 35%. */
  delivery: number;
  /** What the author is paid for one sale. */
  pay: number;
}

export function ebookPay(price: number, mb: number = ASSUMED_MB): EbookPay {
  if (price >= EBOOK_70.min && price <= EBOOK_70.max) {
    const delivery = Math.max(DELIVERY_MIN, cents(DELIVERY_PER_MB * mb));
    return {
      allowed: true,
      rate: EBOOK_70.rate,
      delivery,
      pay: cents((price - delivery) * EBOOK_70.rate),
    };
  }
  const allowed = price >= EBOOK_35.min && price <= EBOOK_35.max;
  return {
    allowed,
    rate: EBOOK_35.rate,
    delivery: 0,
    pay: allowed ? cents(price * EBOOK_35.rate) : 0,
  };
}

/** What one copy costs Amazon to print, or null outside the page range it prints. */
export function printCost(pages: number): number | null {
  if (!Number.isFinite(pages) || pages < PRINT.minPages || pages > PRINT.maxPages) {
    return null;
  }
  if (pages <= PRINT.flatUpTo) return PRINT.flat;
  return cents(PRINT.fixed + PRINT.perPage * pages);
}

export function paperbackRate(price: number): number {
  return price >= PAPERBACK_RATE.highFrom ? PAPERBACK_RATE.high : PAPERBACK_RATE.low;
}

/**
 * The lowest list price Amazon accepts: the one at which it pays nothing.
 *
 * Two steps, because the rate changes at $9.99. If printing ÷ 50% lands
 * under $9.99, that is the floor. Otherwise no 50% price can cover the
 * printing, and the floor is printing ÷ 60% — but never under $9.99, since
 * that is where 60% begins.
 */
export function paperbackLowest(printing: number): number {
  const atLow = ceilCents(printing / PAPERBACK_RATE.low);
  if (atLow < PAPERBACK_RATE.highFrom) return atLow;
  return Math.max(PAPERBACK_RATE.highFrom, ceilCents(printing / PAPERBACK_RATE.high));
}

export interface PaperbackPay {
  printing: number;
  rate: number;
  /** Rate × price − printing. Negative means Amazon would refuse the price. */
  pay: number;
  lowest: number;
}

export function paperbackPay(price: number, pages: number): PaperbackPay | null {
  const printing = printCost(pages);
  if (printing === null) return null;
  const rate = paperbackRate(price);
  return {
    printing,
    rate,
    pay: cents(rate * price - printing),
    lowest: paperbackLowest(printing),
  };
}
```

- [ ] **Step 4:** Run `npx vitest run src/lib/pricing/kdp-terms.test.ts`. Expected: PASS.

---

### Task 3: Which side of the trade a publisher is on

**Files:**
- Create: `src/lib/pricing/publishers.ts`
- Create: `src/lib/pricing/publishers.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/pricing/publishers.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { publisherGroup } from "./publishers";

/* Every name here is one Apple's lists really carried on 2026-10-05. */

describe("publisherGroup", () => {
  it("puts the big houses and their imprints on the traditional side", () => {
    for (const name of [
      "Penguin Publishing Group",
      "Random House Worlds",
      "Tor Publishing Group",
      "Little, Brown and Company",
      "Grand Central Publishing",
      "Knopf Doubleday Publishing Group",
      "Orbit",
      "St. Martin's Publishing Group",
      "St. Martin’s Press",
      "Avon",
      "Harper Voyager",
      "William Morrow",
      "Harper",
      "HarperCollins e-books",
      "Scribner",
      "Gallery Books",
      "S&S/Saga Press",
      "Atria/Emily Bestler Books",
      "MIRA Books",
      "Harlequin",
      "Bookouture",
      "Kensington Books",
      "Sourcebooks",
      "Bloomsbury Publishing",
      "Disney Hyperion Digital",
      "W. W. Norton & Company",
    ]) {
      expect(publisherGroup(name), name).toBe("traditional");
    }
  });

  it("leaves writers' own imprints and small presses on the other side", () => {
    for (const name of [
      "Mari Carr Books LLC",
      "Juliette Banks",
      "Fiona Grace",
      "Entangled Publishing, LLC",
      "Boldwood Books",
      "Indie House Publishing",
      "Stoker Aces Production, LLC",
      "Mira Lyn Kelly",
      "Harper Sloan",
      "Toni Anderson Inc.",
      "PublishDrive",
      "Tule Publishing",
    ]) {
      expect(publisherGroup(name), name).toBe("independent");
    }
  });

  it("treats a missing publisher as independent rather than as a house", () => {
    expect(publisherGroup(null)).toBe("independent");
    expect(publisherGroup("")).toBe("independent");
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/pricing/publishers.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/pricing/publishers.ts`

```ts
/**
 * Which side of the trade a listing's publisher is on.
 *
 * **Sorted by the publisher's name and nothing else, and the screen says so.**
 * The table is the Big Five (Penguin Random House, HarperCollins, Simon &
 * Schuster, Macmillan, Hachette) with the imprints Apple's lists actually
 * name, plus the established houses that are not Big Five but are plainly not
 * self-publishing either (Kensington, Sourcebooks, Bloomsbury, Scholastic…).
 * Everything else is "self-published & small presses" — a writer's own LLC, a
 * distributor's name, a two-person press. A small press can therefore sit
 * with the self-published, which is the right side of the line for a writer
 * asking what books like theirs charge.
 *
 * **Every pattern is anchored to the start of the name**, because the
 * imprints are short words that turn up inside authors' names: `Harper`
 * matches "Harper" and "Harper Voyager" but not "Harper Sloan", and `MIRA`
 * matches "MIRA Books" but not "Mira Lyn Kelly". The test walks both lists.
 */

export type PublisherGroup = "traditional" | "independent";

export const GROUP_LABEL: Record<PublisherGroup, string> = {
  independent: "Self-published & small presses",
  traditional: "Traditional publishers",
};

const TRADITIONAL: readonly RegExp[] = [
  // Penguin Random House
  /^penguin\b/, /^random house\b/, /^knopf\b/, /^doubleday\b/, /^crown\b/,
  /^ballantine\b/, /^bantam\b/, /^del rey\b/, /^berkley\b/, /^putnam\b/,
  /^dutton\b/, /^viking\b/, /^riverhead\b/, /^ace\b/, /^daw\b/, /^delacorte\b/,
  /^transworld\b/, /^hogarth\b/, /^anchor\b/, /^vintage\b/, /^pantheon\b/,
  // HarperCollins, Harlequin included
  /^harper$/, /^harpercollins\b/,
  /^harper (voyager|perennial|paperbacks|teen|muse|design|business|one|wave|select|horizon|via|360)\b/,
  /^william morrow\b/, /^avon\b/, /^ecco\b/, /^mariner\b/, /^mira( books)?$/,
  /^harlequin\b/, /^hqn\b/, /^carina press\b/, /^hanover square\b/, /^park row\b/,
  /^graydon house\b/, /^one more chapter\b/, /^clarion\b/, /^zondervan\b/,
  /^thomas nelson\b/,
  // Simon & Schuster
  /^simon & schuster\b/, /^s&s\b/, /^scribner\b/, /^gallery books\b/, /^atria\b/,
  /^pocket books\b/, /^saga press\b/, /^mtv books\b/, /^avid reader\b/,
  // Macmillan
  /^st\.? martin/, /^tor\b/, /^minotaur\b/, /^flatiron\b/, /^celadon\b/,
  /^henry holt\b/, /^farrar\b/, /^macmillan\b/, /^pan macmillan\b/, /^picador\b/,
  /^wednesday books\b/, /^feiwel\b/, /^roaring brook\b/,
  // Hachette
  /^little, brown\b/, /^grand central\b/, /^orbit\b/, /^hachette\b/, /^redhook\b/,
  /^mulholland\b/, /^bookouture\b/, /^hodder\b/, /^quercus\b/, /^orion\b/,
  /^headline\b/, /^sphere\b/, /^piatkus\b/, /^gollancz\b/, /^algonquin\b/,
  // Established houses outside the Big Five
  /^kensington\b/, /^sourcebooks\b/, /^bloomsbury\b/, /^scholastic\b/,
  /^disney\b/, /^hyperion\b/, /^w\. ?w\. norton\b/, /^liveright\b/,
  /^grove (atlantic|press)\b/, /^atlantic monthly\b/, /^blackstone\b/,
  /^titan\b/, /^baen\b/, /^seven seas\b/, /^j-novel club\b/, /^open road media\b/,
  /^wizards of the coast\b/, /^spiegel & grau\b/, /^union square\b/, /^zando\b/,
];

export function publisherGroup(publisher: string | null | undefined): PublisherGroup {
  if (!publisher) return "independent";
  const name = publisher.trim().toLowerCase().replace(/[’‘]/g, "'");
  return TRADITIONAL.some((pattern) => pattern.test(name)) ? "traditional" : "independent";
}
```

- [ ] **Step 4:** Run `npx vitest run src/lib/pricing/publishers.test.ts`. Expected: PASS. If a
  name lands on the wrong side, fix the pattern rather than the test.

---

### Task 4: The shelves

**Files:**
- Create: `src/lib/pricing/shelves.ts`
- Create: `src/lib/pricing/shelves.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/pricing/shelves.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { GENRES } from "../book-kinds";
import {
  BESTSELLER_SHELVES,
  amazonSearchUrl,
  appleListUrl,
  shelfById,
  shelfForBookGenre,
} from "./shelves";

describe("BESTSELLER_SHELVES", () => {
  it("holds no duplicate ids, labels or Apple genres", () => {
    for (const key of ["id", "label", "appleGenre"] as const) {
      const values = BESTSELLER_SHELVES.map((shelf) => shelf[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("asks Apple for the top 100 paid ebooks in the US store", () => {
    expect(appleListUrl(shelfById("cozy-mystery")!)).toBe(
      "https://itunes.apple.com/us/rss/toppaidebooks/limit=100/genre=11259/json",
    );
  });

  it("only links to Amazon's Kindle store, never reads it", () => {
    const url = amazonSearchUrl(shelfById("cozy-mystery")!);
    expect(url.startsWith("https://www.amazon.com/s?")).toBe(true);
    expect(url).toContain("i=digital-text");
    expect(url).toContain("k=cozy%20mystery");
  });

  it("answers null for an id it does not know", () => {
    expect(shelfById("nope")).toBe(null);
  });
});

describe("shelfForBookGenre", () => {
  it("maps every book genre but Other to a shelf that exists", () => {
    for (const genre of GENRES.filter((g) => g !== "Other")) {
      const shelf = shelfForBookGenre(genre);
      expect(shelf, genre).not.toBe(null);
      expect(BESTSELLER_SHELVES).toContain(shelf);
    }
  });

  it("leaves Other and unknown genres unset rather than guessing", () => {
    expect(shelfForBookGenre("Other")).toBe(null);
    expect(shelfForBookGenre(undefined)).toBe(null);
    expect(shelfForBookGenre("Westerns")).toBe(null);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/pricing/shelves.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/pricing/shelves.ts`

```ts
/**
 * The genres the price check offers, and where each one's list comes from.
 *
 * **Every shelf was fetched before it went in** (2026-10-05): each Apple genre
 * below returned 100 books in the US store, every one with a price. Adding a
 * shelf is the same measurement — fetch `appleListUrl`, count the entries,
 * and only add the row if the list is full.
 *
 * `amazonWords` is never fetched. It builds a link that opens the same genre
 * in Amazon's Kindle store, because the books Apple cannot list — Kindle
 * Unlimited's, which are sold only on Amazon — are there.
 */

export interface BestsellerShelf {
  id: string;
  label: string;
  /** Apple Books genre id. The tree is at itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres?id=38. */
  appleGenre: number;
  amazonWords: string;
}

export const SHELVES_MEASURED = "2026-10-05";

export const BESTSELLER_SHELVES: readonly BestsellerShelf[] = [
  { id: "cozy-mystery", label: "Cozy mystery", appleGenre: 11259, amazonWords: "cozy mystery" },
  { id: "mystery-thriller", label: "Mystery & thriller", appleGenre: 9032, amazonWords: "mystery thriller" },
  { id: "police-procedural", label: "Police procedural", appleGenre: 10052, amazonWords: "police procedural" },
  { id: "contemporary-romance", label: "Contemporary romance", appleGenre: 10057, amazonWords: "contemporary romance" },
  { id: "romantic-comedy", label: "Romantic comedy", appleGenre: 11042, amazonWords: "romantic comedy" },
  { id: "romantic-suspense", label: "Romantic suspense", appleGenre: 10061, amazonWords: "romantic suspense" },
  { id: "paranormal-romance", label: "Paranormal romance", appleGenre: 10058, amazonWords: "paranormal romance" },
  { id: "historical-romance", label: "Historical romance", appleGenre: 10059, amazonWords: "historical romance" },
  { id: "epic-fantasy", label: "Epic fantasy", appleGenre: 11002, amazonWords: "epic fantasy" },
  { id: "urban-fantasy", label: "Urban fantasy", appleGenre: 11275, amazonWords: "urban fantasy" },
  { id: "science-fiction", label: "Science fiction", appleGenre: 10064, amazonWords: "science fiction" },
  { id: "horror", label: "Horror", appleGenre: 10048, amazonWords: "horror" },
  { id: "historical-fiction", label: "Historical fiction", appleGenre: 10047, amazonWords: "historical fiction" },
  { id: "literary-fiction", label: "Literary fiction", appleGenre: 10049, amazonWords: "literary fiction" },
  { id: "young-adult", label: "Young adult fiction", appleGenre: 11177, amazonWords: "young adult fiction" },
  { id: "memoir", label: "Biography & memoir", appleGenre: 9008, amazonWords: "memoir" },
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

export function shelfForBookGenre(genre: string | undefined): BestsellerShelf | null {
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
```

- [ ] **Step 4:** Run `npx vitest run src/lib/pricing/shelves.test.ts`. Expected: PASS.

---

### Task 5: Reading Apple's list

**Files:**
- Create: `src/lib/pricing/apple-list.ts`
- Create: `src/lib/pricing/apple-list.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/pricing/apple-list.test.ts`

```ts
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
      cover: "https://is1-ssl.mzstatic.com/a/9781.jpg/0x400bb.png",
      url: "https://books.apple.com/us/book/x/id1?uo=2",
    });
    expect(books[1].position).toBe(2);
  });

  it("reads a list of one, which the feed sends as an object", () => {
    expect(parseAppleList(feed(entry())).books).toHaveLength(1);
  });

  it("skips an entry with no usable price or title", () => {
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
```

- [ ] **Step 2:** Run `npx vitest run src/lib/pricing/apple-list.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/pricing/apple-list.ts`

```ts
/**
 * One book on a store's best-seller list, in the shape every source hands the
 * screen.
 *
 * **This shape is the boundary a second source plugs into.** Apple's feed is
 * the first; Amazon data, when there is money for it, is a second parser that
 * returns the same `ListedBook` and nothing on the screen changes.
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
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;

const label = (value: unknown): string | null => {
  const text = obj(value)?.label;
  return typeof text === "string" && text.trim() ? text.trim() : null;
};

const attrs = (value: unknown): Json => obj(obj(value)?.attributes) ?? {};

/** Apple's largest thumbnail is 170px; the same URL serves any size asked for. */
function coverOf(images: unknown): string | null {
  const list = Array.isArray(images) ? images : [images];
  const last = [...list].reverse().map(label).find(Boolean);
  return last ? last.replace(/\/\d+x\d+bb(\.\w+)$/, "/0x400bb$1") : null;
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
 * returns no books, and the route reports no list. It never reports an empty
 * one as a cheap one. An entry without a title or a real price is skipped,
 * and positions keep counting so a skipped entry leaves its gap.
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
    if (!title || !Number.isFinite(price) || price < 0 || typeof currency !== "string") return;

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
```

- [ ] **Step 4:** Run `npx vitest run src/lib/pricing/apple-list.test.ts`. Expected: PASS.

---

### Task 6: The figures off a list

**Files:**
- Create: `src/lib/pricing/shelf-facts.ts`
- Create: `src/lib/pricing/shelf-facts.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/pricing/shelf-facts.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { MIN_PRICES } from "../comps/price-check";
import type { ListedBook } from "./apple-list";
import { priceBins, shelfFacts, standing } from "./shelf-facts";

let n = 0;
const listed = (price: number, publisher: string | null = "Jane Doe", currency = "USD"): ListedBook => {
  n += 1;
  return {
    id: `b${n}`, position: n, title: `Book ${n}`, author: "A Writer", price, currency,
    publisher, released: null, cover: null, url: null,
  };
};
const many = (count: number, price: number, publisher?: string) =>
  Array.from({ length: count }, () => listed(price, publisher));

describe("shelfFacts", () => {
  it("keeps self-published and traditional prices apart", () => {
    const facts = shelfFacts([
      ...many(3, 2.99), ...many(3, 4.99),
      ...many(MIN_PRICES, 11.99, "Penguin Publishing Group"),
    ]);

    expect(facts.of).toBe(6 + MIN_PRICES);
    expect(facts.groups.independent.count).toBe(6);
    expect(facts.groups.independent.summary?.median).toBe(3.99);
    expect(facts.groups.traditional.summary?.median).toBe(11.99);
  });

  it("gives no middle price to a group with too few books", () => {
    const facts = shelfFacts([...many(MIN_PRICES, 3.99), ...many(2, 12.99, "Orbit")]);
    expect(facts.groups.traditional.count).toBe(2);
    expect(facts.groups.traditional.summary).toBe(null);
  });

  it("keeps one currency and drops the rest from every figure", () => {
    const facts = shelfFacts([...many(MIN_PRICES, 3.99), listed(9.99, "Jane Doe", "GBP")]);
    expect(facts.currency).toBe("USD");
    expect(facts.of).toBe(MIN_PRICES);
  });

  it("counts free books and keeps them out of the middle price", () => {
    const facts = shelfFacts([...many(MIN_PRICES, 4.99), listed(0)]);
    expect(facts.free).toBe(1);
    expect(facts.groups.independent.summary?.low).toBe(4.99);
  });
});

describe("priceBins", () => {
  it("counts each whole dollar's books by side, and gathers the dear ones in the last bin", () => {
    const bins = priceBins([listed(4.99), listed(4.49, "Orbit"), listed(31)], 20);
    expect(bins).toHaveLength(21);
    expect(bins[4]).toEqual({ from: 4, independent: 1, traditional: 1 });
    expect(bins[20]).toEqual({ from: 20, independent: 1, traditional: 0 });
  });
});

describe("standing", () => {
  it("counts the books cheaper than, level with and dearer than a price", () => {
    const books = [listed(2.99), listed(4.99), listed(4.99), listed(9.99)];
    expect(standing(books, 4.99)).toEqual({ cheaper: 1, same: 2, dearer: 1 });
  });
});

describe("what it refuses to invent", () => {
  it("carries no score, rating or recommendation of any kind", () => {
    const facts = shelfFacts(many(MIN_PRICES, 4.99));
    const keys = [
      ...Object.keys(facts),
      ...Object.keys(facts.groups.independent),
      ...Object.keys(facts.groups.independent.summary ?? {}),
    ];
    for (const banned of [
      "score", "rating", "grade", "recommended", "suggested",
      "optimal", "best", "competition", "sales", "earnings",
    ]) {
      expect(keys).not.toContain(banned);
    }
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/pricing/shelf-facts.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/pricing/shelf-facts.ts`

```ts
import { MIN_PRICES, type PriceSummary } from "../comps/price-check";
import type { ListedBook } from "./apple-list";
import { publisherGroup, type PublisherGroup } from "./publishers";
import { median, nearestRank } from "./stats";

/**
 * What a best-seller list says about prices, and nothing it does not.
 *
 * **Two middle prices, never one.** A genre's list usually holds two
 * clusters: self-published books near $3–5 and traditional ones near $10–13.
 * A single figure sits in the gap between them describing neither, which was
 * the old Google screen's failing. So every figure is per side.
 *
 * **The same threshold as the Google search** (`MIN_PRICES`, six). A side with
 * fewer books than that is counted and listed but given no middle price.
 */

export interface GroupFacts {
  /** Paid books on this side of the list. */
  count: number;
  summary: PriceSummary | null;
}

export interface ShelfFacts {
  currency: string | null;
  /** Books on the list in that currency. The denominator for every "N of M". */
  of: number;
  /** Listed at nothing. Kept out of every figure. */
  free: number;
  groups: Record<PublisherGroup, GroupFacts>;
}

function summarise(paid: number[]): PriceSummary | null {
  if (paid.length < MIN_PRICES) return null;
  const sorted = [...paid].sort((a, b) => a - b);
  return {
    from: sorted.length,
    median: median(sorted),
    low: sorted[0],
    high: sorted[sorted.length - 1],
    middleLow: nearestRank(sorted, 0.25),
    middleHigh: nearestRank(sorted, 0.75),
  };
}

function inCurrency(books: readonly ListedBook[]): ListedBook[] {
  const currency = books[0]?.currency;
  return currency ? books.filter((b) => b.currency === currency) : [];
}

export function shelfFacts(books: readonly ListedBook[]): ShelfFacts {
  const kept = inCurrency(books);
  const paid = kept.filter((b) => b.price > 0);
  const side = (group: PublisherGroup): GroupFacts => {
    const prices = paid.filter((b) => publisherGroup(b.publisher) === group).map((b) => b.price);
    return { count: prices.length, summary: summarise(prices) };
  };
  return {
    currency: kept[0]?.currency ?? null,
    of: kept.length,
    free: kept.length - paid.length,
    groups: { independent: side("independent"), traditional: side("traditional") },
  };
}

/** One whole dollar of the chart: books priced from `from` to `from + 0.99`. */
export interface PriceBin {
  from: number;
  independent: number;
  traditional: number;
}

/** Where the chart stops. The last bin holds everything at this price and over. */
export const CHART_CEILING = 20;

export function priceBins(books: readonly ListedBook[], ceiling = CHART_CEILING): PriceBin[] {
  const bins: PriceBin[] = Array.from({ length: ceiling + 1 }, (_, from) => ({
    from,
    independent: 0,
    traditional: 0,
  }));
  for (const book of inCurrency(books)) {
    const at = Math.min(ceiling, Math.floor(book.price));
    bins[at][publisherGroup(book.publisher)] += 1;
  }
  return bins;
}

export interface Standing {
  cheaper: number;
  same: number;
  dearer: number;
}

/** How many books on the list cost less than, the same as and more than a price. */
export function standing(books: readonly ListedBook[], price: number): Standing {
  const kept = inCurrency(books);
  const same = kept.filter((b) => Math.abs(b.price - price) < 0.005).length;
  const cheaper = kept.filter((b) => b.price < price - 0.005).length;
  return { cheaper, same, dearer: kept.length - cheaper - same };
}
```

- [ ] **Step 4:** Run `npx vitest run src/lib/pricing`. Expected: PASS, all six files.

---

### Task 7: The route

**Files:**
- Create: `src/app/api/price-shelf/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from "next/server";
import { parseAppleList } from "@/lib/pricing/apple-list";
import { appleListUrl, shelfById } from "@/lib/pricing/shelves";

/**
 * One genre's best-seller list, from Apple Books' public US feed.
 *
 * **Cached for a day on both sides**: the fetch through Next's data cache and
 * the response through the CDN. So Apple is asked at most about once a day
 * per genre, whatever the traffic, and a failed refresh serves yesterday's
 * copy while it retries (`stale-while-revalidate`).
 *
 * **What leaves our server is a genre id**: nothing about the writer, their
 * book or their browser. `/privacy` says so.
 *
 * **An empty list is a failure, never an answer.** A feed that comes back
 * with no priced books is reported as Apple not answering. It is never shown
 * as a genre where nothing costs anything.
 */

const CACHE_SECONDS = 86400;
const ATTEMPTS = 2;
const TIMEOUT_MS = 6000;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("shelf") ?? "";
  const shelf = shelfById(id);
  if (!shelf) {
    return NextResponse.json({ error: "Choose a genre from the list." }, { status: 400 });
  }

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const response = await fetch(appleListUrl(shelf), {
        headers: {
          Accept: "application/json",
          "User-Agent": "OpenChapter (price check; contact via openchapter)",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: CACHE_SECONDS },
      });
      if (response.ok) {
        const { books, updated } = parseAppleList(await response.json());
        if (books.length > 0) {
          return NextResponse.json(
            { shelf: shelf.id, source: "apple", store: "us", updated, books },
            {
              headers: {
                "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
              },
            },
          );
        }
      }
    } catch {
      // Timeout or network. One more attempt, then say so.
    }
  }

  return NextResponse.json(
    {
      error:
        "Apple Books did not answer just now, so there is no list to show. Try again in a moment.",
    },
    { status: 502 },
  );
}
```

- [ ] **Step 2: Check it against the live feed.** Start `npx next dev` in the background, then:
  - `curl -s "http://localhost:3000/api/price-shelf?shelf=cozy-mystery" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.books.length,j.updated,j.books[0])})"`
    Expected: `100`, a date, and a first book with every field.
  - `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/price-shelf?shelf=nope"`
    Expected: `400`.

---

### Task 8: The chart

**Files:**
- Create: `src/components/price-check/money.ts`
- Create: `src/components/price-check/price-histogram.tsx`

- [ ] **Step 1:** `src/components/price-check/money.ts`

```ts
/** "$5" for a whole dollar, "$4.99" otherwise: prices are read, not added up. */
export const money = (n: number) =>
  n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;

/** Prices typed by a writer: "$4.99", "4.99", " 4,99 " is not a price. */
export function parsePrice(text: string): number | null {
  const n = Number(text.replace(/[$\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
```

- [ ] **Step 2:** `src/components/price-check/price-histogram.tsx`

```tsx
"use client";

import { useState } from "react";
import { EBOOK_70 } from "@/lib/pricing/kdp-terms";
import type { PriceBin } from "@/lib/pricing/shelf-facts";

/**
 * Every book on the list, by price, with the two kinds of publisher on either
 * side of one line.
 *
 * **Position does the separating, not colour.** Self-published books stand
 * above the line and traditional ones hang below it. So the two clusters a
 * genre usually has are visible without telling hues apart, in either theme
 * and for any eye, and neither side needs a palette outside the app's tokens.
 *
 * Amazon's 70% band is drawn behind the bars, and the writer's own price is a
 * line through both halves: one picture of the three facts the screen is
 * about. The book list underneath is the table view of the same data.
 */

const W = 600;
const HALF = 64;
const H = HALF * 2 + 2;

const binLabel = (bin: PriceBin, ceiling: number) =>
  bin.from >= ceiling ? `$${ceiling} and over` : `$${bin.from}–$${bin.from}.99`;

export function PriceHistogram({
  bins,
  price,
  ceiling,
  description,
}: {
  bins: PriceBin[];
  price: number | null;
  ceiling: number;
  /** What the chart shows, said in words for a screen reader. */
  description: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = Math.max(1, ...bins.map((b) => Math.max(b.independent, b.traditional)));
  const slot = W / bins.length;
  const x = (dollars: number) => (Math.min(dollars, ceiling + 1) / (ceiling + 1)) * W;
  const pct = (dollars: number) => (x(dollars) / W) * 100;
  const shown = hover === null ? null : bins[hover];

  return (
    <figure className="mt-5">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-36 w-full"
          role="img"
          aria-label={description}
        >
          <rect
            x={x(EBOOK_70.min)}
            y={0}
            width={x(EBOOK_70.max) - x(EBOOK_70.min)}
            height={H}
            className="fill-raised"
          />
          {bins.map((bin, i) => {
            const up = (bin.independent / peak) * HALF;
            const down = (bin.traditional / peak) * HALF;
            return (
              <g
                key={bin.from}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              >
                <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
                {up > 0 && (
                  <rect x={i * slot + 1} y={HALF - up} width={slot - 2} height={up} rx={1.5} className="fill-fg" />
                )}
                {down > 0 && (
                  <rect x={i * slot + 1} y={HALF + 2} width={slot - 2} height={down} rx={1.5} className="fill-muted" opacity={0.6} />
                )}
              </g>
            );
          })}
          <line x1={0} x2={W} y1={HALF + 1} y2={HALF + 1} className="stroke-line" vectorEffect="non-scaling-stroke" />
          {price !== null && (
            <line
              x1={x(price)}
              x2={x(price)}
              y1={0}
              y2={H}
              className="stroke-accent"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {shown && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap
                       rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs text-fg tabular-nums shadow-sm"
            style={{ left: `${((hover + 0.5) / bins.length) * 100}%` }}
          >
            <span className="font-semibold">{binLabel(shown, ceiling)}</span>
            {" · "}
            {shown.independent} self-published · {shown.traditional} traditional
          </div>
        )}
      </div>

      <div className="relative mt-1 h-4 text-[11px] text-muted tabular-nums" aria-hidden="true">
        {[0, 5, 10, 15].map((tick) => (
          <span
            key={tick}
            className={`absolute ${tick === 0 ? "" : "-translate-x-1/2"}`}
            style={{ left: `${pct(tick)}%` }}
          >
            ${tick}
          </span>
        ))}
        <span className="absolute right-0">${ceiling}+</span>
      </div>

      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-fg" /> Self-published &amp; small presses, above the line
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-muted/60" /> Traditional publishers, below it
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-line bg-raised" /> Where Amazon pays 70%
        </span>
        {price !== null && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-accent" /> Your price
          </span>
        )}
      </figcaption>
    </figure>
  );
}
```

---

### Task 9: The answer, the price you try, the books, the paperback

**Files:**
- Create: `src/components/price-check/genre-tiles.tsx`
- Create: `src/components/price-check/shelf-answer.tsx`
- Create: `src/components/price-check/your-price.tsx`
- Create: `src/components/price-check/shelf-books.tsx`
- Create: `src/components/price-check/paperback-pay.tsx`
- Create: `src/components/price-check/disclosure.tsx`

The full source for each is written in the session from the layout in the design note. These
are the contracts the page relies on, and the house rules each file holds:

- **`GenreTiles({ suggested, onOpen, children })`**
  - A card with the heading "What do books like yours sell for?" and one sentence.
  - A container-query grid of `BESTSELLER_SHELVES` buttons: at least 44px tall, `rounded-[10px]`,
    `border-line`, `bg-surface`, and `hover:border-accent/50`.
  - The suggested shelf carries "Your book's genre".
  - `children` is the allowance pill and banner.
- **`ShelfAnswer({ facts, amazonUrl })`**
  - Two tiles in the order independent, then traditional.
  - Each tile holds the `GROUP_LABEL`, then either a `text-4xl` median with "The middle price of
    N of the M books. Half cost between A and B." (the last sentence only when the two ends
    differ), or "—" with the too-few sentence naming `MIN_PRICES`.
  - Under the tiles, the Kindle Unlimited sentence and the Amazon search link (`target="_blank"`,
    `rel="noreferrer"`).
- **`YourPrice({ books })`**
  - A − / + stepper over the ladder `0.99 … 14.99` plus `19.99`, and a `$` field.
  - `PriceHistogram` with `CHART_CEILING`.
  - Then, if there is a price:
    - "Amazon pays you $X a sale", with the sum shown in words. The 70% case names the 15¢/MB
      delivery charge and the 1 MB assumption; the 35% case names the $2.99–$12.99 band.
    - Or "Amazon does not accept a Kindle price under $0.99 / over $200".
    - "Of the N books here, A cost less, B the same and C more", from `standing`.
  - It always closes with the Kindle Unlimited per-page line, with no figure in it.
- **`ShelfBooks({ books, layout, onLayout })`**
  - Two `Segmented` controls: All / Self-published / Traditional, and Best-selling first /
    Cheapest first. Plus `ViewMenu`.
  - List rows show the position, a `BookCover`, the title linked to `url`, "author · publisher ·
    year" with "· Traditional" after a traditional publisher, and the price right-aligned with
    `tabular-nums`.
  - Grid modes use `resultsGridClass`.
  - An empty filter says which side has no books.
- **`PaperbackPay({ books, initialPages })`**
  - A pages field and an optional "Use my book's length…" `Picker`, which fills the field from
    `estimatePages(bookWordCount(book))` and says so.
  - A price field.
  - Results:
    - "Printing costs $P a copy."
    - "The lowest price Amazon accepts at this length is $L."
    - Then either "At $X Amazon pays R% of the price, minus printing: you would get $Y a sale" or
      "Amazon would refuse $X: printing costs more than it would pay you".
  - Out-of-range pages name the 24–828 range.
- **`Disclosure({ title, summary, children })`**
  - A `<details>` card with a `<summary>` row (title, one-line summary, a chevron that turns on
    `group-open`) and a `border-t` body.
  - The page uses two:
    - "Paperback", wrapping `PaperbackPay`.
    - "What this list can't tell you": which books are in Kindle Unlimited, in a series, how long
      they are, or what their paperbacks cost.

- [ ] **Step 1:** Write the six files to those contracts.
- [ ] **Step 2:** Run `npx tsc --noEmit`. Expected: clean.

---

### Task 10: The page

**Files:**
- Modify (rewrite in place, keeping `noteActivity`): `src/components/price-check/price-check-page.tsx`

- [ ] **Step 1: Rewrite `PriceCheckPage`.** Same export and props
  (`Omit<ToolPageProps, "bookId"> & { bookId?: string }`).
  - **State:**
    - `list`: `{ shelf, updated, books } | null`
    - `shelfId`
    - `state`: idle / loading / done / error
    - `error`
    - all restored from `recall("price-check")`
  - **The opened set.** `recall<string[]>("price-check:opened")` holds the shelves opened in this
    tab; reopening one of them spends nothing.
  - **`open(id)`:**
    - for a new shelf: `gate.spend()` (refused → return), `noteActivity("price_check_run")`,
      remember it as opened
    - then fetch `/api/price-shelf?shelf=id`, guarded by a request counter so a late answer
      cannot overwrite a newer one
    - `remember` the list
  - **Render:**
    - `ToolHeader`: title "What do books like yours sell for?" and the premise.
    - With no shelf: `GenreTiles`, suggesting `shelfForBookGenre(book?.genre)`.
    - Otherwise:
      - a card holding the genre `Picker` (all shelves; changing it calls `open`), the source
        line "Apple Books, US store · top 100 best-selling ebooks · {date}", the loading
        skeleton, the error and `ShelfAnswer`
      - then `YourPrice`, `ShelfBooks` and the two `Disclosure`s
    - `LeftPill`, `LimitBanner` and `LimitDialog` as before.
- [ ] **Step 2:** Run `npx tsc --noEmit && npm run lint`. Expected: tsc clean; lint no worse than
  7 errors and 11 warnings.

---

### Task 11: Every claim made true again

**Files (exact-string edits):**
- `src/components/shelf/bookshelf.tsx` — `PriceCheckArea`'s `subtitle`: "Real prices from real
  best-seller lists — and no recommended price, because that is yours to decide."
- `src/components/landing/mvp-landing-page.tsx` — the price-check `lead`: "Pick your genre and
  see what its top 100 best-selling ebooks cost — self-published and traditional publishers kept
  apart, every book listed — and what Amazon would pay you at any price you try. It never tells
  you what to charge. Free runs ${FREE_LIMITS.priceCheck.free} a day."
  - The alt text describes the image as it is and stays until the shot is retaken.
- `src/components/shelf/help-dialog.tsx` — the price check `desc`:
  - "What the top 100 best-selling ebooks in your genre cost, from Apple Books' US store: a middle
    price for self-published books and one for traditional publishers, and every book listed.
  - Try a price to see where it sits and what Amazon would pay you for a Kindle sale or a
    paperback.
  - Kindle Unlimited books are sold only on Amazon, so they are not on the list.
  - There is no recommended price and there will not be one.
  - ${TIER_NAMES.free} runs ${plural(…)} a day."
- `src/lib/book-tools.ts` — `what`: "What the top 100 best-selling ebooks in your genre cost,
  self-published and traditional kept apart, and what Amazon would pay you at any price you try.
  Never a recommended price."
- `src/lib/tool-guide.ts`:
  - headline: "What the best sellers in your genre actually charge"
  - claim: "What best-selling ebooks cost"
  - point: "Self-published and traditional, kept apart"
  - point: "What Amazon would pay you"
  - point: "Where the list comes from"
- `src/lib/free-limits.ts` — the `priceCheck` comment: opening a genre spends one; reopening it
  in the same tab does not.
- `src/app/privacy/page.tsx` — a new item after the title check:
  - "The price check — the genre you pick is sent to our server, which reads Apple Books' public
    list of best-selling ebooks for it.
  - Nothing about you or your book is sent to Apple.
  - The covers in the list load straight from Apple's servers, so Apple sees that your browser
    asked for them."
- `TODO.md` — a "Shipped 2026-10-05 — the price check moves to best-seller lists" section, with
  "Amazon data when funded (Apify free test first)" and "UK and India stores" as next steps.
- `CLAUDE.md`:
  - the catalogue-search section: the price check now runs on `/api/price-shelf`; `/api/comps`
    serves the title check only
  - the API route list
  - the price check's dashboard sentence
- `docs/architecture/dashboard-and-tools.md` — the price check paragraph.
- `docs/plans/2026-10-05-price-check-amazon-design.md` — series and length were dropped on
  measurement.

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** Run `npx vitest run src/lib/tool-guide.test.ts src/lib/billing src/lib/book-tools.test.ts`.
  Expected: PASS. Fix the wording, never the tests, if a claim test trips.

---

### Task 12: Verify end to end

- [ ] Run `npx vitest run`, on its own. Read the `Test Files N passed` line.
- [ ] Then run `npx tsc --noEmit`, separately.
- [ ] `npm run lint` must report 7 errors / 11 warnings at most.
- [ ] Run `npx next dev`, then in Chrome at desktop width and at 375px:
  - [ ] tiles
  - [ ] open a genre
  - [ ] the answer tiles
  - [ ] the stepper at $0.99, $2.99, $4.99, $12.99 and $13.99 (must read $0.35, $1.99, $3.39,
    $8.99 and $4.90)
  - [ ] chart hover
  - [ ] the filters
  - [ ] paperback: 300 pages at $12 reads printing $4.60, lowest $9.20, and you get $2.60 at 50%
  - [ ] the fourth new genre on a free plan opens the limit dialog
- [ ] `npm run build`, then check `.next/static/chunks/*.css` for `fill-raised` and `stroke-accent`.
