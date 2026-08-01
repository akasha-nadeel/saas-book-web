import { describe, expect, it } from "vitest";
import {
  daysBetween,
  digestInput,
  formatRecord,
  IMPORT_LIKELY,
  importDays,
  toHex,
  writingRecord,
} from "./provenance";

describe("writingRecord", () => {
  it("answers the empty log without crashing", () => {
    expect(writingRecord({})).toEqual({
      firstDay: null,
      lastDay: null,
      daysWritten: 0,
      spanDays: 0,
      netWords: 0,
      days: [],
    });
  });

  it("orders days oldest first whatever order storage held them in", () => {
    const record = writingRecord({
      "2026-03-04": 900,
      "2026-01-02": 1200,
      "2026-02-11": 300,
    });
    expect(record.days.map((d) => d.day)).toEqual([
      "2026-01-02",
      "2026-02-11",
      "2026-03-04",
    ]);
    expect(record.firstDay).toBe("2026-01-02");
    expect(record.lastDay).toBe("2026-03-04");
  });

  it("counts days written against the span they happened over", () => {
    // The gap is the point: three days of work spread over two months reads
    // very differently from three consecutive days.
    const record = writingRecord({
      "2026-01-01": 500,
      "2026-01-02": 500,
      "2026-03-01": 500,
    });
    expect(record.daysWritten).toBe(3);
    expect(record.spanDays).toBe(60);
  });

  it("counts one day as a span of one, not of zero", () => {
    expect(writingRecord({ "2026-01-01": 500 }).spanDays).toBe(1);
  });

  it("keeps days of cutting and nets them off", () => {
    // A day spent removing 800 words is a day of writing. Dropping it would
    // make the record show fewer working days than there were.
    const record = writingRecord({ "2026-01-01": 1000, "2026-01-02": -800 });
    expect(record.daysWritten).toBe(2);
    expect(record.netWords).toBe(200);
  });

  it("ignores days that netted out to nothing", () => {
    // A day whose additions and cuts cancelled leaves a zero in storage. It is
    // not a day of no work, but nothing can be said about it, and listing it
    // beside real days invites the reader to draw a conclusion.
    const record = writingRecord({ "2026-01-01": 0, "2026-01-02": 700 });
    expect(record.daysWritten).toBe(1);
    expect(record.firstDay).toBe("2026-01-02");
  });
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("crosses a month and a year", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("survives a daylight-saving change", () => {
    // Anchored at midday for this reason: from midnight, a 23- or 25-hour day
    // rounds to the wrong number and the span quietly drifts.
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("importDays", () => {
  it("finds the days too large to have been typed", () => {
    const record = writingRecord({
      "2026-01-01": 82_000,
      "2026-01-02": 1_400,
    });
    expect(importDays(record).map((d) => d.day)).toEqual(["2026-01-01"]);
  });

  it("leaves a very good human day alone", () => {
    // The "10k day" is a real thing writers celebrate. The threshold sits well
    // clear of it so the page never says this about a day somebody wrote.
    const record = writingRecord({ "2026-01-01": 10_000 });
    expect(importDays(record)).toEqual([]);
    expect(IMPORT_LIKELY).toBeGreaterThan(10_000);
  });

  it("does not treat a large day of cutting as an import", () => {
    // Deleting a 30,000-word act is a decision, not a file arriving.
    const record = writingRecord({ "2026-01-01": -30_000 });
    expect(importDays(record)).toEqual([]);
  });
});

describe("digestInput", () => {
  it("is the same for the same manuscript", () => {
    const chapters = [{ title: "One", body: "{}" }];
    expect(digestInput(chapters)).toBe(digestInput([{ title: "One", body: "{}" }]));
  });

  it("changes when any word of the text changes", () => {
    const before = digestInput([{ title: "One", body: "a" }]);
    expect(digestInput([{ title: "One", body: "b" }])).not.toBe(before);
    expect(digestInput([{ title: "Two", body: "a" }])).not.toBe(before);
  });

  it("changes when chapters are reordered", () => {
    const a = { title: "One", body: "x" };
    const b = { title: "Two", body: "y" };
    expect(digestInput([a, b])).not.toBe(digestInput([b, a]));
  });

  it("cannot be forged by moving text across the separator", () => {
    // Two different manuscripts must not collide by butting together into one
    // string — the separators are the whole defence, so they are checked.
    const one = digestInput([
      { title: "A", body: "x" },
      { title: "B", body: "y" },
    ]);
    const two = digestInput([{ title: "A", body: "x chapter  title B body y" }]);
    expect(one).not.toBe(two);
  });

  it("says nothing about when it was taken", () => {
    // The digest has to be a fact about the text that anyone holding the same
    // text can reproduce. Folding in a timestamp or an id would make it a
    // number this app invented, which proves nothing to anybody.
    const input = digestInput([{ title: "One", body: "prose" }]);
    expect(input).toContain("prose");
    expect(input).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("toHex", () => {
  it("pads every byte to two characters", () => {
    const bytes = new Uint8Array([0, 15, 16, 255]).buffer;
    expect(toHex(bytes)).toBe("000f10ff");
  });

  it("is empty for empty bytes", () => {
    expect(toHex(new Uint8Array([]).buffer)).toBe("");
  });
});

describe("formatRecord", () => {
  const record = writingRecord({ "2026-01-01": 1200, "2026-01-05": -300 });

  function report(over: Partial<Parameters<typeof formatRecord>[0]> = {}) {
    return formatRecord({
      title: "The Crossing",
      record,
      chapters: [],
      fingerprint: null,
      at: Date.UTC(2026, 0, 6, 12),
      ...over,
    });
  }

  it("leads with the book and when it was generated", () => {
    const text = report({ author: "A. Writer" });
    expect(text).toContain("WRITING RECORD — The Crossing");
    expect(text).toContain("A. Writer");
    expect(text).toContain("2026-01-06");
  });

  it("states the limits in the document, not only on the screen", () => {
    // The screen is not what gets forwarded. Somebody reading this in an email
    // has to be told what it does and does not establish.
    const text = report();
    expect(text).toContain("WHAT THIS IS NOT");
    expect(text).toContain("not tamper-evident");
    expect(text).toContain("evidence, not proof");
  });

  it("warns that an import shows up as one large day", () => {
    // Otherwise the writer is surprised by their own record in somebody
    // else's hands, which is the failure this page exists to prevent.
    expect(report()).toContain("appears as a single large day");
  });

  it("says the day figures cover every book, not just this one", () => {
    expect(report()).toMatch(/not only this book/);
  });

  it("shows a day of cutting as a cut rather than as a loss of words", () => {
    const text = report();
    expect(text).toContain("2026-01-01  +1,200");
    expect(text).toContain("2026-01-05  −300");
  });

  it("prints the fingerprint with what to do about it", () => {
    const text = report({ fingerprint: "abc123" });
    expect(text).toContain("abc123");
    // The instruction is the point: a hash nobody timestamped is worthless,
    // and we must not be the one holding the timestamp.
    expect(text).toContain("outside your own control");
  });

  it("leaves the fingerprint section out entirely when there is none", () => {
    // Rather than printing an empty heading, which reads as a failure the
    // reader has to interpret.
    expect(report()).not.toContain("FINGERPRINT");
  });

  it("lists saved drafts oldest first under their chapter", () => {
    const text = report({
      chapters: [
        {
          title: "Chapter 1",
          versions: [
            { at: Date.UTC(2026, 0, 1), words: 900 },
            { at: Date.UTC(2026, 0, 3), words: 1400 },
          ],
        },
      ],
    });
    expect(text).toContain("SAVED DRAFTS");
    expect(text.indexOf("900 words")).toBeLessThan(text.indexOf("1,400 words"));
  });

  it("omits the drafts section when no chapter has any", () => {
    const text = report({ chapters: [{ title: "Chapter 1", versions: [] }] });
    expect(text).not.toContain("SAVED DRAFTS");
  });

  it("says so plainly when there is no record at all", () => {
    const text = formatRecord({
      title: "Empty",
      record: writingRecord({}),
      chapters: [],
      fingerprint: null,
      at: Date.UTC(2026, 0, 6),
    });
    expect(text).toContain("No writing days recorded.");
    expect(text).not.toContain("DAY BY DAY");
  });

  it("never claims a detector or a test could settle it", () => {
    // The research was specific that detectors misfire on plain prose and on
    // writers whose first language is not English. A document that leaned on
    // one would be repeating the harm it exists to answer.
    expect(report()).toContain("no test that establishes who wrote");
  });
});
