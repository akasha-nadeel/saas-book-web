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
 * does Amazon pay me" — the sum a writer would otherwise do on KDP's own
 * calculator — and nothing else.
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
  if (
    !Number.isFinite(pages) ||
    pages < PRINT.minPages ||
    pages > PRINT.maxPages
  ) {
    return null;
  }
  if (pages <= PRINT.flatUpTo) return PRINT.flat;
  return cents(PRINT.fixed + PRINT.perPage * pages);
}

export function paperbackRate(price: number): number {
  return price >= PAPERBACK_RATE.highFrom
    ? PAPERBACK_RATE.high
    : PAPERBACK_RATE.low;
}

/**
 * The lowest list price Amazon accepts: the one at which it pays nothing.
 *
 * Two steps, because the rate changes at $9.99. If printing ÷ 50% lands under
 * $9.99, that is the floor. Otherwise no 50% price can cover the printing, and
 * the floor is printing ÷ 60% — but never under $9.99, since that is where 60%
 * begins.
 */
export function paperbackLowest(printing: number): number {
  const atLow = ceilCents(printing / PAPERBACK_RATE.low);
  if (atLow < PAPERBACK_RATE.highFrom) return atLow;
  return Math.max(
    PAPERBACK_RATE.highFrom,
    ceilCents(printing / PAPERBACK_RATE.high),
  );
}

export interface PaperbackPay {
  printing: number;
  rate: number;
  /** Rate × price − printing. Below zero means Amazon would refuse the price. */
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
