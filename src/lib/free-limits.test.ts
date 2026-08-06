import { describe, expect, it } from "vitest";
import {
  allowanceOf,
  COUNTED,
  COUNTED_LABELS,
  FREE_LIMITS,
  leftBadge,
  leftLine,
  seatAllowance,
  SEATS_PER_BOOK,
  spentLine,
  WARN_WHEN_LEFT,
} from "./free-limits";

describe("allowanceOf", () => {
  it("gives a new writer the whole allowance", () => {
    expect(allowanceOf("imports", 0, false)).toEqual({
      action: "imports",
      used: 0,
      limit: FREE_LIMITS.imports,
      left: FREE_LIMITS.imports,
      blocked: false,
    });
  });

  it("counts down as they are spent", () => {
    expect(allowanceOf("comps", 3, false).left).toBe(FREE_LIMITS.comps - 3);
    expect(allowanceOf("comps", 3, false).blocked).toBe(false);
  });

  it("allows the last one and refuses the one after it", () => {
    const limit = FREE_LIMITS.titleChecks;
    expect(allowanceOf("titleChecks", limit - 1, false).blocked).toBe(false);
    expect(allowanceOf("titleChecks", limit, false).blocked).toBe(true);
  });

  it("never reports a negative remainder", () => {
    // A tally can overshoot: these are checked in the browser, and a writer
    // whose plan lapses keeps whatever they already spent.
    expect(allowanceOf("covers", FREE_LIMITS.covers + 5, false).left).toBe(0);
  });

  it("has no limit at all on Pro", () => {
    for (const action of COUNTED) {
      const pro = allowanceOf(action, 40, true);
      expect(pro.limit).toBeNull();
      expect(pro.left).toBeNull();
      expect(pro.blocked).toBe(false);
    }
  });

  it("treats anything storage may hold as nought", () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(allowanceOf("imports", value, false).used).toBe(0);
    }
    expect(allowanceOf("imports", "7" as unknown as number, false).used).toBe(0);
  });

  it("rounds a fractional tally down rather than up", () => {
    expect(allowanceOf("imports", 2.7, false).used).toBe(2);
  });
});

describe("the table", () => {
  /*
   * A limit with no name on screen is a number a writer meets without a word
   * for it; a label with no limit is a row on the pricing page that counts
   * nothing. Both halves have to cover the same four.
   */
  it("names and numbers every counted action", () => {
    for (const action of COUNTED) {
      expect(typeof FREE_LIMITS[action]).toBe("number");
      expect(COUNTED_LABELS[action].one).toBeTruthy();
      expect(COUNTED_LABELS[action].many).toBeTruthy();
      expect(COUNTED_LABELS[action].shortOne).toBeTruthy();
    }
    expect(Object.keys(FREE_LIMITS).sort()).toEqual([...COUNTED].sort());
    expect(Object.keys(COUNTED_LABELS).sort()).toEqual([...COUNTED].sort());
  });

  /*
   * Seats are deliberately *not* one of the counted four — they are current
   * occupancy rather than a spend, and joining `Counted` would put them in the
   * `prefs.usage` tally, where removing a collaborator could not give the seat
   * back. This is the assertion that keeps them out of it.
   */
  it("keeps seats out of the spend tally", () => {
    expect([...COUNTED]).not.toContain("collaborators");
    expect(Object.keys(FREE_LIMITS)).not.toContain("collaborators");
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
  /* It read "1 searches left" before `shortOne` existed. */
  it("says one of a thing in the singular", () => {
    expect(leftBadge(allowanceOf("comps", FREE_LIMITS.comps - 1, false))).toBe(
      "1 search left",
    );
    expect(leftBadge(allowanceOf("comps", FREE_LIMITS.comps - 2, false))).toBe(
      "2 searches left",
    );
    expect(leftBadge(seatAllowance(1, false))).toBe("1 seat left");
  });
});

describe("the lines", () => {
  /*
   * The one not to "fix": a fresh account is told nothing. "0 of 10 used" in
   * front of somebody who has used nothing teaches them this is a metered
   * product before they have had anything out of it, which is the freemium
   * pattern this audience has been burned by. The number is on the pricing page
   * and in Help; the screen speaks when it is nearly spent.
   */
  it("says nothing until the allowance is nearly gone", () => {
    for (let used = 0; used < FREE_LIMITS.comps - WARN_WHEN_LEFT; used += 1) {
      expect(leftLine(allowanceOf("comps", used, false))).toBeNull();
    }
    expect(
      leftLine(allowanceOf("comps", FREE_LIMITS.comps - WARN_WHEN_LEFT, false)),
    ).toBe(`${WARN_WHEN_LEFT} free comp searches left.`);
  });

  it("counts what is left rather than what was spent", () => {
    expect(leftLine(allowanceOf("comps", FREE_LIMITS.comps - 2, false))).toBe(
      "2 free comp searches left.",
    );
  });

  it("says the last one in the singular", () => {
    expect(leftLine(allowanceOf("imports", FREE_LIMITS.imports - 1, false))).toBe(
      "1 free import left.",
    );
  });

  it("hands over to the spent line at nought", () => {
    const none = allowanceOf("comps", FREE_LIMITS.comps, false);
    // Never both: two sentences about one limit is how a notice becomes
    // wallpaper.
    expect(leftLine(none)).toBeNull();
    expect(spentLine(none)).toBe(
      `All ${FREE_LIMITS.comps} free comp searches are used.`,
    );
  });

  it("says nothing at all on a plan with no limit", () => {
    expect(leftLine(allowanceOf("comps", 9, true))).toBeNull();
    expect(spentLine(allowanceOf("comps", 9, true))).toBeNull();
  });
});
