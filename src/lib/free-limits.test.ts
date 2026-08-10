import { describe, expect, it } from "vitest";
import {
  bookToolAllowance,
  FREE_TOOL_BOOKS,
  leftBadge,
  leftLine,
  seatAllowance,
  SEATS_PER_BOOK,
  spentLine,
  WARN_WHEN_LEFT,
} from "./free-limits";

describe("bookToolAllowance", () => {
  it("gives a new writer the whole allowance", () => {
    expect(bookToolAllowance(0, false, false)).toEqual({
      action: "bookTools",
      used: 0,
      limit: FREE_TOOL_BOOKS,
      left: FREE_TOOL_BOOKS,
      blocked: false,
    });
  });

  it("counts books down as they are opened", () => {
    expect(bookToolAllowance(3, false, false).left).toBe(FREE_TOOL_BOOKS - 3);
    expect(bookToolAllowance(3, false, false).blocked).toBe(false);
  });

  it("allows the last book and refuses the one after it", () => {
    expect(bookToolAllowance(FREE_TOOL_BOOKS - 1, false, false).blocked).toBe(false);
    expect(bookToolAllowance(FREE_TOOL_BOOKS, false, false).blocked).toBe(true);
  });

  /*
   * **The one not to "fix", and the whole point of counting books.** A writer
   * whose five are full is never stopped on a book already among them, however
   * many titles or comps they search there. If this goes red the limit has gone
   * back to charging for effort, which is what it was changed to stop.
   */
  it("never blocks a book already being worked on", () => {
    expect(bookToolAllowance(FREE_TOOL_BOOKS, true, false).blocked).toBe(false);
    expect(bookToolAllowance(FREE_TOOL_BOOKS + 3, true, false).blocked).toBe(false);
  });

  it("never reports a negative remainder", () => {
    // The list can overshoot: this is checked in the browser, and a writer whose
    // plan lapses keeps every book they had already opened a tool on.
    expect(bookToolAllowance(FREE_TOOL_BOOKS + 5, false, false).left).toBe(0);
  });

  it("has no limit at all on Pro", () => {
    const pro = bookToolAllowance(40, false, true);
    expect(pro.limit).toBeNull();
    expect(pro.left).toBeNull();
    expect(pro.blocked).toBe(false);
  });

  it("treats anything storage may hold as nought", () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(bookToolAllowance(value, false, false).used).toBe(0);
    }
    expect(bookToolAllowance("7" as unknown as number, false, false).used).toBe(0);
  });

  it("rounds a fractional count down rather than up", () => {
    expect(bookToolAllowance(2.7, false, false).used).toBe(2);
  });
});

describe("seats", () => {
  /*
   * The one not to "fix": the free cap counts the owner, so two means the writer
   * and one other. It is the number printed on the pricing page, and if this
   * goes red that page has started making a different promise.
   */
  it("counts the owner, so a lone writer has room for one more", () => {
    const alone = seatAllowance(1, false);
    expect(alone.limit).toBe(SEATS_PER_BOOK.free);
    expect(alone.left).toBe(SEATS_PER_BOOK.free - 1);
    expect(alone.blocked).toBe(false);
  });

  it("blocks the invite after the last seat, not the last one", () => {
    expect(seatAllowance(SEATS_PER_BOOK.free - 1, false).blocked).toBe(false);
    expect(seatAllowance(SEATS_PER_BOOK.free, false).blocked).toBe(true);
  });

  /*
   * Seats are the one limit Pro raises rather than lifts, so unlike the four
   * counted actions a paying writer *can* reach the end of them.
   */
  it("raises the cap on Pro rather than removing it", () => {
    expect(seatAllowance(1, true).limit).toBe(SEATS_PER_BOOK.pro);
    expect(seatAllowance(SEATS_PER_BOOK.pro, true).blocked).toBe(true);
  });

  it("never reports a negative remainder when a plan lapses", () => {
    // A Pro book with nine collaborators whose owner stops paying keeps them —
    // nobody is evicted — so the count legitimately overshoots the free cap.
    expect(seatAllowance(SEATS_PER_BOOK.pro, false).left).toBe(0);
    expect(seatAllowance(SEATS_PER_BOOK.pro, false).blocked).toBe(true);
  });

  it("treats a nonsense count as the owner alone", () => {
    for (const value of [0, -3, Number.NaN, "2" as unknown as number]) {
      expect(seatAllowance(value, false).used).toBe(1);
    }
  });

  it("asks how many more will fit rather than how many were spent", () => {
    expect(leftLine(seatAllowance(1, false))).toBe(
      "Room for 1 more person on this book.",
    );
    expect(leftLine(seatAllowance(SEATS_PER_BOOK.pro - 2, true))).toBe(
      "Room for 2 more people on this book.",
    );
  });

  it("drops the word free once the owner is paying", () => {
    expect(spentLine(seatAllowance(SEATS_PER_BOOK.free, false))).toBe(
      `A free book holds ${SEATS_PER_BOOK.free} people, and this one is full.`,
    );
    expect(spentLine(seatAllowance(SEATS_PER_BOOK.pro, true))).toBe(
      `This book holds ${SEATS_PER_BOOK.pro} people, and it is full.`,
    );
  });
});

describe("the badge", () => {
  /* It read "1 books left" before `shortOne` existed. */
  it("says one of a thing in the singular", () => {
    expect(leftBadge(bookToolAllowance(FREE_TOOL_BOOKS - 1, false, false))).toBe(
      "1 book left",
    );
    expect(leftBadge(bookToolAllowance(FREE_TOOL_BOOKS - 2, false, false))).toBe(
      "2 books left",
    );
    expect(leftBadge(seatAllowance(1, false))).toBe("1 seat left");
  });
});

describe("the lines", () => {
  /*
   * The one not to "fix": a fresh account is told nothing. "0 of 5 used" in
   * front of somebody who has used nothing teaches them this is a metered
   * product before they have had anything out of it, which is the freemium
   * pattern this audience has been burned by. The number is on the pricing page
   * and in Help; the screen speaks when it is nearly spent.
   */
  it("says nothing until the allowance is nearly gone", () => {
    for (let used = 0; used < FREE_TOOL_BOOKS - WARN_WHEN_LEFT; used += 1) {
      expect(leftLine(bookToolAllowance(used, false, false))).toBeNull();
    }
    expect(
      leftLine(bookToolAllowance(FREE_TOOL_BOOKS - WARN_WHEN_LEFT, false, false)),
    ).toBe(`The free plan covers ${WARN_WHEN_LEFT} more books.`);
  });

  it("counts what is left rather than what was spent", () => {
    expect(leftLine(bookToolAllowance(FREE_TOOL_BOOKS - 2, false, false))).toBe(
      "The free plan covers 2 more books.",
    );
  });

  it("says the last one in the singular", () => {
    expect(leftLine(bookToolAllowance(FREE_TOOL_BOOKS - 1, false, false))).toBe(
      "The free plan covers 1 more book.",
    );
  });

  /*
   * The words are about *books*, never about searches. A reader told "2 checks
   * left" would ration the one thing this plan does not ration.
   */
  it("never names the work, only the books", () => {
    const nearly = leftLine(bookToolAllowance(FREE_TOOL_BOOKS - 1, false, false)) ?? "";
    const spent = spentLine(bookToolAllowance(FREE_TOOL_BOOKS, false, false)) ?? "";
    for (const word of ["search", "check", "import"]) {
      expect(nearly).not.toContain(word);
      expect(spent).not.toContain(word);
    }
  });

  it("hands over to the spent line at nought", () => {
    const none = bookToolAllowance(FREE_TOOL_BOOKS, false, false);
    // Never both: two sentences about one limit is how a notice becomes
    // wallpaper.
    expect(leftLine(none)).toBeNull();
    expect(spentLine(none)).toBe(
      `The free plan runs the tools on ${FREE_TOOL_BOOKS} books, and you are already using all ${FREE_TOOL_BOOKS}.`,
    );
  });

  it("says nothing at all on a plan with no limit", () => {
    expect(leftLine(bookToolAllowance(9, false, true))).toBeNull();
    expect(spentLine(bookToolAllowance(9, false, true))).toBeNull();
  });
});
