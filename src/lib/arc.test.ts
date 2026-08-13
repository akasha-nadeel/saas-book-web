import { describe, expect, it } from "vitest";
import {
  fromDay,
  isOverdue,
  LEAD_DAYS,
  parseArc,
  sendBy,
  sortReaders,
  STATUSES,
  summarise,
  type ArcReader,
  type ArcStatus,
} from "./arc";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 1);

function reader(over: Partial<ArcReader> = {}): ArcReader {
  return {
    id: over.id ?? "r1",
    name: over.name ?? "Someone",
    from: over.from ?? "",
    reads: over.reads ?? "",
    status: over.status ?? "sent",
    sentAt: over.sentAt ?? NOW - 7 * DAY,
    notes: over.notes ?? "",
    ...(over.dueAt !== undefined ? { dueAt: over.dueAt } : {}),
    ...(over.link !== undefined ? { link: over.link } : {}),
  };
}

describe("parseArc", () => {
  it("returns nothing for absent, broken or non-list storage", () => {
    expect(parseArc(null)).toEqual([]);
    expect(parseArc("{oh dear")).toEqual([]);
    expect(parseArc('{"name":"Someone"}')).toEqual([]);
  });

  it("keeps a whole row", () => {
    const raw = JSON.stringify([
      {
        id: "a",
        name: "Priya",
        from: "NetGalley",
        reads: "epic fantasy",
        status: "reading",
        sentAt: 1000,
        dueAt: 2000,
        link: "https://example.com/review",
        notes: "Asked for epub.",
      },
    ]);
    expect(parseArc(raw)).toEqual([
      {
        id: "a",
        name: "Priya",
        from: "NetGalley",
        reads: "epic fantasy",
        status: "reading",
        sentAt: 1000,
        dueAt: 2000,
        link: "https://example.com/review",
        notes: "Asked for epub.",
      },
    ]);
  });

  it("drops rows with no name or no id", () => {
    const raw = JSON.stringify([
      { id: "a", name: "   " },
      { name: "No id" },
      { id: "c", name: "Kept" },
    ]);
    expect(parseArc(raw).map((r) => r.name)).toEqual(["Kept"]);
  });

  it("falls back to sent for a status it does not know", () => {
    // Storage holds whatever an older version left there. An unknown status
    // must not become a row the screen cannot render or filter.
    const raw = JSON.stringify([{ id: "a", name: "Someone", status: "posted" }]);
    expect(parseArc(raw)[0].status).toBe("sent");
  });

  it("leaves an absent due date absent rather than zero", () => {
    // Zero is a real epoch date in 1970, so a coerced default would make every
    // reader without a deadline permanently overdue.
    const raw = JSON.stringify([{ id: "a", name: "Someone" }]);
    const [row] = parseArc(raw);
    expect(row.dueAt).toBeUndefined();
    expect(isOverdue(row, NOW)).toBe(false);
  });

  it("survives a row that is not an object", () => {
    expect(parseArc(JSON.stringify([null, 5, "x"]))).toEqual([]);
  });
});

/*
 * **Kept although nothing calls `isOverdue` any more.** The chasing half of
 * this tool came out on 2026-08-13 to be rebuilt, and these are the decisions
 * it was built on — that a reviewed or declined reader is never late, and that
 * silence is. Deleting them would mean the rebuild re-deciding both from
 * scratch, which is how a feature comes back subtly different from the one
 * that was taken out. See TODO.md under "Taken out on purpose".
 */
describe("isOverdue", () => {
  it("is late once the date has passed and nobody has answered", () => {
    expect(isOverdue(reader({ dueAt: NOW - DAY }), NOW)).toBe(true);
    expect(isOverdue(reader({ dueAt: NOW + DAY }), NOW)).toBe(false);
  });

  it("never calls a finished reader late", () => {
    // A list that flagged people who already reviewed would train the writer
    // to ignore the column that exists to be acted on.
    for (const status of ["reviewed", "declined"] as ArcStatus[]) {
      expect(isOverdue(reader({ status, dueAt: NOW - 30 * DAY }), NOW)).toBe(
        false,
      );
    }
  });

  it("counts silence as late, because that is the one to chase", () => {
    expect(isOverdue(reader({ status: "silent", dueAt: NOW - DAY }), NOW)).toBe(
      true,
    );
  });
});

describe("summarise", () => {
  it("counts nothing without falling over", () => {
    expect(summarise([])).toEqual({
      total: 0,
      out: 0,
      reviewed: 0,
      reviewRate: null,
    });
  });

  // No `overdue` field and no clock to work one out from — see the note above
  // `isOverdue`. A summary that still counted what nothing draws would be the
  // first place the removed feature grew back by accident.
  it("counts copies still out and reviews in", () => {
    const readers = [
      reader({ id: "1", status: "sent" }),
      reader({ id: "2", status: "reading" }),
      reader({ id: "3", status: "reviewed" }),
      reader({ id: "4", status: "declined" }),
      reader({ id: "5", status: "silent", dueAt: NOW - DAY }),
    ];
    const s = summarise(readers);
    expect(s.total).toBe(5);
    // Three: sent, reading, *and* the silent one. Somebody who was chased and
    // said nothing still has the copy, and this used to answer 2 — so a writer
    // counting five rows against the boxes could not find the fifth anywhere.
    expect(s.out).toBe(3);
    expect(s.reviewed).toBe(1);
    expect(s).not.toHaveProperty("overdue");
  });

  // The one to keep: out, reviewed and declined are the whole list between
  // them, so the row of figures can always be reconciled against the rows
  // under it.
  it("accounts for every reader between out, reviewed and declined", () => {
    const readers = [
      reader({ id: "1", status: "sent" }),
      reader({ id: "2", status: "reading", dueAt: NOW - DAY }),
      reader({ id: "3", status: "reviewed" }),
      reader({ id: "4", status: "reviewed" }),
      reader({ id: "5", status: "declined" }),
      reader({ id: "6", status: "silent", dueAt: NOW - DAY }),
    ];
    const s = summarise(readers);
    const declined = readers.filter((r) => r.status === "declined").length;
    expect(s.out + s.reviewed + declined).toBe(s.total);
  });

  it("rates reviews against those who answered, not against everyone", () => {
    // Three reviewed, one declined, and six who never replied. Counting the
    // silent as failures would report 30%; leaving them out reports 75%, and
    // the screen shows the six beside it.
    const readers = [
      ...[1, 2, 3].map((n) => reader({ id: `r${n}`, status: "reviewed" })),
      reader({ id: "d", status: "declined" }),
      ...[1, 2, 3, 4, 5, 6].map((n) =>
        reader({ id: `s${n}`, status: "silent" }),
      ),
    ];
    expect(summarise(readers).reviewRate).toBe(75);
  });

  it("has no rate at all until somebody answers", () => {
    // Not zero — zero reads as "everyone refused you", which is a claim about
    // a campaign that has simply not resolved yet.
    const readers = [reader({ status: "sent" }), reader({ status: "silent" })];
    expect(summarise(readers).reviewRate).toBeNull();
  });
});

describe("sortReaders", () => {
  it("puts whoever is due soonest first, and no date last", () => {
    // A date that has gone is simply the earliest date, so the one that used
    // to be picked out as "late" still arrives at the top — without anything
    // here knowing what late means.
    const readers = [
      reader({ id: "a", name: "No date" }),
      reader({ id: "b", name: "Due later", dueAt: NOW + 10 * DAY }),
      reader({ id: "c", name: "Gone by", dueAt: NOW - DAY }),
      reader({ id: "d", name: "Due soon", dueAt: NOW + DAY }),
    ];
    expect(sortReaders(readers).map((r) => r.name)).toEqual([
      "Gone by",
      "Due soon",
      "Due later",
      "No date",
    ]);
  });

  it("sorts a finished reader by its date like any other", () => {
    // It used to drop somebody who had already reviewed below a genuinely
    // overdue reader. With no overdue there is one rule, and the badge on the
    // row is what says which of the two is finished.
    const readers = [
      reader({ id: "a", name: "Reviewed", status: "reviewed", dueAt: NOW - 5 * DAY }),
      reader({ id: "b", name: "Waiting", dueAt: NOW - DAY }),
    ];
    expect(sortReaders(readers).map((r) => r.name)).toEqual([
      "Reviewed",
      "Waiting",
    ]);
  });

  it("does not disturb the caller's list", () => {
    const readers = [reader({ id: "b", name: "B" }), reader({ id: "a", name: "A" })];
    sortReaders(readers);
    expect(readers.map((r) => r.name)).toEqual(["B", "A"]);
  });
});

describe("sendBy", () => {
  it("is six weeks before the day the book goes on sale", () => {
    const publish = Date.UTC(2026, 8, 1);
    expect(sendBy(publish)).toBe(publish - LEAD_DAYS * DAY);
    expect(LEAD_DAYS).toBe(42);
  });

  it("clears the lead time the ARC services actually ask for", () => {
    // This is the assertion worth keeping. The number was 28 for months,
    // described in the source as the convention the review sites work to —
    // and BookSirens, which distributes them, asks for 40 days minimum while
    // the general indie guidance is four to eight weeks. A figure under that
    // floor is not a conservative default, it is advice that arrives too late
    // to be worth taking, on the one step this product is best known for.
    expect(LEAD_DAYS).toBeGreaterThanOrEqual(40);
    expect(LEAD_DAYS).toBeLessThanOrEqual(56);
    // Whole weeks: a writer counts back on a calendar, not in days.
    expect(LEAD_DAYS % 7).toBe(0);
  });
});

describe("fromDay", () => {
  it("refuses anything that is not a plain YYYY-MM-DD", () => {
    for (const bad of ["", "tomorrow", "2026-9-1", "2026/09/01", "not a date"]) {
      expect(fromDay(bad)).toBeNull();
    }
  });

  it("refuses a date that does not exist", () => {
    // The local Date constructor rolls these over rather than refusing them,
    // so a typo would silently become a real deadline months away.
    expect(fromDay("2026-13-01")).toBeNull();
    expect(fromDay("2026-02-30")).toBeNull();
    expect(fromDay("2026-00-10")).toBeNull();
  });

  it("lands on the day the writer picked, in their own timezone", () => {
    // Not UTC: parsing "2026-09-01" as an ISO instant puts a writer west of
    // Greenwich on the 31st of August.
    const at = fromDay("2026-09-01");
    expect(at).not.toBeNull();
    const date = new Date(at as number);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(1);
  });

  it("is the end of that day, so a review due today is not yet late", () => {
    const due = fromDay("2026-09-01") as number;
    const middayOnTheDay = new Date(2026, 8, 1, 12).getTime();
    expect(isOverdue(reader({ dueAt: due }), middayOnTheDay)).toBe(false);

    const nextMorning = new Date(2026, 8, 2, 9).getTime();
    expect(isOverdue(reader({ dueAt: due }), nextMorning)).toBe(true);
  });

  it("reads a publication date into a send-by six weeks earlier", () => {
    // publishing.published is the same YYYY-MM-DD shape, so the two compose.
    // 1 September back six weeks is 21 July.
    const publish = fromDay("2026-09-01") as number;
    expect(new Date(sendBy(publish)).getDate()).toBe(21);
    expect(new Date(sendBy(publish)).getMonth()).toBe(6);
  });
});

describe("STATUSES", () => {
  it("covers every status the type allows, once each", () => {
    // The screen renders this list; a status in the union but not here would
    // be a row a writer could load and never set back.
    const ids = STATUSES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([
      "declined",
      "reading",
      "reviewed",
      "sent",
      "silent",
    ]);
  });
});
