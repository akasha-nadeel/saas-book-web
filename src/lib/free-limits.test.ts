import { describe, expect, it } from "vitest";
import {
  bookAllowance,
  dailyAllowance,
  FREE_LIMITS,
  itemAllowance,
  leftBadge,
  leftLine,
  localDay,
  reachedHeadline,
  seatAllowance,
  SEATS_PER_BOOK,
  spentLine,
  totalAllowance,
  warnAt,
  type Limited,
} from "./free-limits";

const TODAY = "2026-08-10";
const YESTERDAY = "2026-08-09";

describe("localDay", () => {
  it("is the local date, zero-padded", () => {
    // Built from the local parts on purpose: `toISOString` is UTC, and would
    // turn a writer's allowance over in the middle of their evening.
    expect(localDay(new Date(2026, 0, 5, 23, 30).getTime())).toBe("2026-01-05");
  });

  it("never returns the empty day a fresh library carries", () => {
    expect(localDay()).not.toBe("");
  });
});

describe("dailyAllowance", () => {
  const fresh = { day: TODAY, counts: {} };

  it("gives a new writer the whole allowance", () => {
    expect(dailyAllowance("comps", fresh, false, TODAY)).toEqual({
      action: "comps",
      used: 0,
      limit: FREE_LIMITS.comps.free,
      left: FREE_LIMITS.comps.free,
      blocked: false,
    });
  });

  it("allows the last one and refuses the one after it", () => {
    const limit = FREE_LIMITS.titleCheck.free;
    const at = (n: number) => ({ day: TODAY, counts: { titleCheck: n } });
    expect(dailyAllowance("titleCheck", at(limit - 1), false, TODAY).blocked).toBe(false);
    expect(dailyAllowance("titleCheck", at(limit), false, TODAY).blocked).toBe(true);
  });

  /*
   * **The one not to "fix".** Yesterday's record reads as nought without
   * anything having swept it — that is what makes these the only limits here
   * that come back, and a writer stopped last night is not stopped this morning.
   */
  it("reads a record from another day as nought", () => {
    const yesterday = { day: YESTERDAY, counts: { comps: 99 } };
    expect(dailyAllowance("comps", yesterday, false, TODAY).used).toBe(0);
    expect(dailyAllowance("comps", yesterday, false, TODAY).blocked).toBe(false);
  });

  it("keeps each tool's count to itself", () => {
    const record = { day: TODAY, counts: { comps: FREE_LIMITS.comps.free } };
    expect(dailyAllowance("comps", record, false, TODAY).blocked).toBe(true);
    expect(dailyAllowance("covers", record, false, TODAY).blocked).toBe(false);
    expect(dailyAllowance("titleCheck", record, false, TODAY).used).toBe(0);
  });

  it("treats anything storage may hold as nought", () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, "7"]) {
      const record = { day: TODAY, counts: { comps: value as number } };
      expect(dailyAllowance("comps", record, false, TODAY).used).toBe(0);
    }
    expect(dailyAllowance("comps", undefined, false, TODAY).used).toBe(0);
  });

  it("rounds a fractional count down rather than up", () => {
    const record = { day: TODAY, counts: { comps: 1.7 } };
    expect(dailyAllowance("comps", record, false, TODAY).used).toBe(1);
  });

  it("has no limit at all on Pro", () => {
    const spent = { day: TODAY, counts: { comps: 40 } };
    const pro = dailyAllowance("comps", spent, true, TODAY);
    expect(pro.limit).toBeNull();
    expect(pro.left).toBeNull();
    expect(pro.blocked).toBe(false);
  });
});

describe("bookAllowance", () => {
  it("counts books down as they are used", () => {
    expect(bookAllowance("blurb", 3, false, false).left).toBe(
      FREE_LIMITS.blurb.free - 3,
    );
  });

  it("allows the last book and refuses the one after it", () => {
    const limit = FREE_LIMITS.prose.free;
    expect(bookAllowance("prose", limit - 1, false, false).blocked).toBe(false);
    expect(bookAllowance("prose", limit, false, false).blocked).toBe(true);
  });

  /*
   * **The one not to "fix", and the whole reason this shape takes two
   * arguments.** A writer whose books are full is never stopped on one they are
   * already working on, however much work happens there. If this goes red the
   * limit has gone back to charging for effort.
   */
  it("never blocks a book already being worked on", () => {
    const full = FREE_LIMITS.blurb.free;
    expect(bookAllowance("blurb", full, true, false).blocked).toBe(false);
    expect(bookAllowance("blurb", full + 3, true, false).blocked).toBe(false);
  });

  it("gives each tool its own books", () => {
    // Five is the blurb's whole allowance and one short of the prose report's.
    expect(bookAllowance("blurb", 5, false, false).blocked).toBe(true);
    expect(bookAllowance("prose", 5, false, false).blocked).toBe(false);
  });

  it("never reports a negative remainder", () => {
    expect(bookAllowance("track", FREE_LIMITS.track.free + 5, false, false).left).toBe(0);
  });

  it("has no limit at all on Pro", () => {
    expect(bookAllowance("prose", 40, false, true).limit).toBeNull();
  });
});

describe("itemAllowance", () => {
  it("refuses the one after the last", () => {
    const limit = FREE_LIMITS.arcReaders.free;
    expect(itemAllowance("arcReaders", limit - 1, false).blocked).toBe(false);
    expect(itemAllowance("arcReaders", limit, false).blocked).toBe(true);
  });

  /*
   * Occupancy rather than a spend, exactly as seats are: taking a reader off the
   * list gives the place back. A tally could not do that.
   */
  it("gives the place back when a reader is removed", () => {
    expect(itemAllowance("arcReaders", FREE_LIMITS.arcReaders.free - 1, false).left).toBe(1);
  });

  it("never reports a negative remainder when a plan lapses", () => {
    // A Pro list of thirty whose owner stops paying keeps all thirty — nobody is
    // evicted — so the count legitimately overshoots the free ceiling.
    expect(itemAllowance("arcReaders", 30, false).left).toBe(0);
    expect(itemAllowance("arcReaders", 30, false).blocked).toBe(true);
  });
});

describe("warnAt", () => {
  /*
   * Three of these limits are 2 or 3. At a flat `WARN_WHEN_LEFT` a writer who
   * had used nothing would be told they had two left — a meter in front of
   * somebody who has not started, which is the failure the constant exists to
   * prevent.
   */
  it("never lets a small limit announce itself on arrival", () => {
    for (const action of Object.keys(FREE_LIMITS) as Limited[]) {
      expect(warnAt(FREE_LIMITS[action].free)).toBeLessThan(
        FREE_LIMITS[action].free,
      );
    }
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
   * Seats are the one limit Pro raises rather than lifts, so unlike every other
   * limit here a paying writer *can* reach the end of them.
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
  it("says one of a thing in the singular", () => {
    const one = { day: TODAY, counts: { covers: FREE_LIMITS.covers.free - 1 } };
    expect(leftBadge(dailyAllowance("covers", one, false, TODAY))).toBe(
      "1 search left today",
    );
    expect(
      leftBadge(bookAllowance("blurb", FREE_LIMITS.blurb.free - 1, false, false)),
    ).toBe("1 book left");
    expect(leftBadge(seatAllowance(1, false))).toBe("1 seat left");
  });

  /* Without "today" a pause reads as a wall. */
  it("says today on a daily limit and not on the others", () => {
    const two = { day: TODAY, counts: { covers: FREE_LIMITS.covers.free - 2 } };
    expect(leftBadge(dailyAllowance("covers", two, false, TODAY))).toContain("today");
    expect(
      leftBadge(bookAllowance("prose", FREE_LIMITS.prose.free - 1, false, false)),
    ).not.toContain("today");
  });
});

describe("the lines", () => {
  /*
   * The one not to "fix": a fresh account is told nothing. A meter in front of
   * somebody who has used nothing teaches them this is a metered product before
   * they have had anything out of it, which is the freemium pattern this
   * audience has been burned by.
   */
  it("says nothing to anybody who has used nothing, on any limit", () => {
    const fresh = [
      dailyAllowance("comps", { day: TODAY, counts: {} }, false, TODAY),
      dailyAllowance("covers", { day: TODAY, counts: {} }, false, TODAY),
      dailyAllowance("titleCheck", { day: TODAY, counts: {} }, false, TODAY),
      bookAllowance("blurb", 0, false, false),
      bookAllowance("prose", 0, false, false),
      bookAllowance("track", 0, false, false),
      itemAllowance("arcReaders", 0, false),
    ];
    for (const allowance of fresh) expect(leftLine(allowance)).toBeNull();
  });

  it("counts what is left rather than what was spent", () => {
    const record = { day: TODAY, counts: { comps: FREE_LIMITS.comps.free - 1 } };
    expect(leftLine(dailyAllowance("comps", record, false, TODAY))).toBe(
      "1 more search today on the free plan.",
    );
  });

  /*
   * Blurb and the prose report would otherwise both say "1 more book" and mean
   * different things, so a book sentence has to name its tool.
   */
  it("names the tool on a book limit", () => {
    expect(
      leftLine(bookAllowance("blurb", FREE_LIMITS.blurb.free - 1, false, false)),
    ).toContain("the blurb");
    expect(
      leftLine(bookAllowance("prose", FREE_LIMITS.prose.free - 1, false, false)),
    ).toContain("the prose report");
  });

  it("asks how many more will fit on an occupancy limit", () => {
    expect(
      leftLine(itemAllowance("arcReaders", FREE_LIMITS.arcReaders.free - 2, false)),
    ).toBe("Room for 2 more readers on this book.");
  });

  /*
   * **A daily limit has to say it comes back.** It is the only kind here that
   * does, and a sentence stopping at "today's are used" reads as the end of the
   * road on a screen the writer could simply revisit tomorrow.
   */
  it("promises tomorrow on a daily limit", () => {
    const spent = {
      day: TODAY,
      counts: { titleCheck: FREE_LIMITS.titleCheck.free },
    };
    const line = spentLine(dailyAllowance("titleCheck", spent, false, TODAY)) ?? "";
    expect(line).toContain("a day");
    expect(line).toContain("tomorrow");
  });

  /* And a limit that does *not* come back must not imply that it does. */
  it("promises nothing of the kind on the others", () => {
    const lines = [
      spentLine(bookAllowance("blurb", FREE_LIMITS.blurb.free, false, false)) ?? "",
      spentLine(itemAllowance("arcReaders", FREE_LIMITS.arcReaders.free, false)) ?? "",
    ];
    for (const line of lines) {
      expect(line).not.toContain("tomorrow");
      expect(line).not.toContain("today");
    }
  });

  it("hands over to the spent line at nought", () => {
    const none = bookAllowance("blurb", FREE_LIMITS.blurb.free, false, false);
    // Never both: two sentences about one limit is how a notice becomes
    // wallpaper.
    expect(leftLine(none)).toBeNull();
    expect(spentLine(none)).toBe(
      `The free plan covers the blurb on ${FREE_LIMITS.blurb.free} books, and you are already using all ${FREE_LIMITS.blurb.free}.`,
    );
  });

  it("says nothing at all on a plan with no limit", () => {
    const pro = bookAllowance("blurb", 9, false, true);
    expect(leftLine(pro)).toBeNull();
    expect(spentLine(pro)).toBeNull();
  });
});

describe("the dialog headline", () => {
  /*
   * Six limits of three shapes is more than a reader can hold, so the headline
   * has to name the wall actually hit — "you have reached a limit" would leave
   * somebody guessing which, on the screen that just refused them.
   */
  it("names the limit that was reached, in its own units", () => {
    expect(reachedHeadline("comps")).toBe(
      `The free plan runs ${FREE_LIMITS.comps.free} comp searches a day`,
    );
    expect(reachedHeadline("prose")).toBe(
      `The free plan covers the prose report on ${FREE_LIMITS.prose.free} books`,
    );
    expect(reachedHeadline("arcReaders")).toBe(
      `A free book holds ${FREE_LIMITS.arcReaders.free} readers`,
    );
    expect(reachedHeadline("collaborators")).toBe(
      `A free book holds ${SEATS_PER_BOOK.free} people`,
    );
    expect(reachedHeadline("keywordsAi")).toBe(
      `The free plan includes ${FREE_LIMITS.keywordsAi.free} keyword suggestions`,
    );
  });
});

describe("a lifetime total", () => {
  const LIMIT = FREE_LIMITS.keywordsAi.free;

  it("counts down and refuses the one after the last", () => {
    expect(totalAllowance("keywordsAi", 0, false).left).toBe(LIMIT);
    expect(totalAllowance("keywordsAi", LIMIT - 1, false).blocked).toBe(false);
    expect(totalAllowance("keywordsAi", LIMIT, false).blocked).toBe(true);
  });

  it("never reports a negative remainder", () => {
    expect(totalAllowance("keywordsAi", LIMIT + 4, false).left).toBe(0);
  });

  it("treats anything storage may hold as nought", () => {
    for (const junk of [undefined, null, "3", -2, NaN]) {
      expect(
        totalAllowance("keywordsAi", junk as unknown as number, false).used,
      ).toBe(0);
    }
  });

  it("has no limit at all on Pro", () => {
    const pro = totalAllowance("keywordsAi", 99, true);
    expect(pro.limit).toBeNull();
    expect(pro.blocked).toBe(false);
  });

  /*
   * **The one not to "fix".** Every other limit in this file comes back, and
   * every other sentence says so; this one does not, so borrowing that
   * vocabulary would be a small lie told at the moment somebody is refused.
   * A writer who reads "today" on a wall that never opens comes back tomorrow
   * to find it shut.
   */
  it("never promises a return it cannot make", () => {
    const lines = [
      leftLine(totalAllowance("keywordsAi", LIMIT - 1, false)),
      leftBadge(totalAllowance("keywordsAi", LIMIT - 1, false)),
      spentLine(totalAllowance("keywordsAi", LIMIT, false)),
      reachedHeadline("keywordsAi"),
    ];

    for (const line of lines) {
      expect(line).not.toBeNull();
      expect(line).not.toMatch(/today|tomorrow|a day/i);
    }
  });

  it("says nothing to somebody who has used nothing", () => {
    expect(leftLine(totalAllowance("keywordsAi", 0, false))).toBeNull();
  });

  it("says what is left rather than what was spent", () => {
    expect(leftLine(totalAllowance("keywordsAi", LIMIT - 1, false))).toBe(
      "1 free suggestion left.",
    );
    expect(leftBadge(totalAllowance("keywordsAi", LIMIT - 2, false))).toBe(
      "2 suggestions left",
    );
  });

  it("states plainly that they are gone", () => {
    expect(spentLine(totalAllowance("keywordsAi", LIMIT, false))).toBe(
      `The free plan includes ${LIMIT} keyword suggestions, and you have used them.`,
    );
  });

  /*
   * **Every member of the shape, not just the first.** A new `TotalLimit` that
   * was added to the type and forgotten in `SHAPE` or `WORDS` would fall
   * through to the seat wording — which says "a free book holds N people" —
   * and nothing else in the suite would catch it.
   */
  it("holds for every lifetime-counted tool, not only the first", () => {
    for (const action of ["keywordsAi", "blurbChat"] as const) {
      const limit = FREE_LIMITS[action].free;
      const lines = [
        leftLine(totalAllowance(action, limit - 1, false)),
        leftBadge(totalAllowance(action, limit - 1, false)),
        spentLine(totalAllowance(action, limit, false)),
        reachedHeadline(action),
      ];
      for (const line of lines) {
        expect(line).not.toBeNull();
        expect(line).not.toMatch(/today|tomorrow|a day/i);
        expect(line).not.toMatch(/book holds/i);
      }
    }
  });

  /*
   * A chat counted in *conversations* must not be described in a word a reader
   * would take for a message. "3 chats left" beside a chat box is honest; "3
   * messages left" would be a different and much smaller promise.
   */
  it("counts blurb chats in conversations", () => {
    const limit = FREE_LIMITS.blurbChat.free;
    expect(leftLine(totalAllowance("blurbChat", limit - 1, false))).toBe(
      "1 free conversation left.",
    );
    expect(spentLine(totalAllowance("blurbChat", limit, false))).toContain(
      "blurb conversations",
    );
  });
});
