import { describe, expect, it } from "vitest";
import type { Block } from "./export/blocks";
import {
  bookTimeline,
  canonicalText,
  chapterCanonicalText,
  daysBetween,
  formatRecord,
  IMPORT_LIKELY,
  importDays,
  RECORD_FORMAT,
  toHex,
  utcOffset,
  writingRecord,
  type RecordChapter,
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

describe("canonicalText", () => {
  function para(text: string): Block {
    return { kind: "paragraph", depth: 0, runs: [{ text }] };
  }

  it("is the prose, not the document format it happens to be stored in", () => {
    // The whole point of the rewrite. The old digest hashed the stored Tiptap
    // JSON, so the number moved whenever the editor changed how it serialised
    // — with the writing untouched.
    const text = canonicalText([
      { title: "One", blocks: [para("It began at the salt pans.")] },
    ]);
    expect(text).toBe("One\n\nIt began at the salt pans.");
    expect(text).not.toContain("type");
    expect(text).not.toContain("{");
  });

  it("does not move when only the formatting does", () => {
    // A fingerprint that changed when somebody italicised a word would be
    // reporting an edit nobody made.
    const plain: Block = { kind: "paragraph", depth: 0, runs: [{ text: "a b" }] };
    const marked: Block = {
      kind: "paragraph",
      depth: 0,
      runs: [
        { text: "a ", bold: true },
        { text: "b", italic: true, fontSize: "1.3em" },
      ],
    };
    expect(canonicalText([{ title: "T", blocks: [plain] }])).toBe(
      canonicalText([{ title: "T", blocks: [marked] }]),
    );
  });

  it("does not move when invisible whitespace does", () => {
    expect(canonicalText([{ title: "T", blocks: [para("a  b")] }])).toBe(
      canonicalText([{ title: "T", blocks: [para(" a\tb ")] }]),
    );
  });

  it("moves when a word does", () => {
    const before = canonicalText([{ title: "T", blocks: [para("cold")] }]);
    expect(canonicalText([{ title: "T", blocks: [para("bold")] }])).not.toBe(
      before,
    );
    expect(canonicalText([{ title: "U", blocks: [para("cold")] }])).not.toBe(
      before,
    );
  });

  it("moves when chapters are reordered", () => {
    const a = { title: "One", blocks: [para("x")] };
    const b = { title: "Two", blocks: [para("y")] };
    expect(canonicalText([a, b])).not.toBe(canonicalText([b, a]));
  });

  it("treats the same accented letter written two ways as one letter", () => {
    // A manuscript through a Mac, an import and an export can hold both forms
    // in one book; unnormalised, two files that read identically hash apart.
    const composed = canonicalText([
      { title: "T", blocks: [para("café")] },
    ]);
    const decomposed = canonicalText([
      { title: "T", blocks: [para("café")] },
    ]);
    // They are two different strings until they are normalised, which is
    // the whole reason this is worth a test.
    expect("café").not.toBe("café");
    expect(decomposed).toBe(composed);
  });

  it("leaves out a block with no text rather than an empty line", () => {
    const image: Block = { kind: "image", depth: 0, src: "data:x", runs: [] };
    const brk: Block = { kind: "sceneBreak", depth: 0, runs: [] };
    expect(
      canonicalText([{ title: "T", blocks: [para("a"), image, brk, para("b")] }]),
    ).toBe("T\n\na\n\nb");
  });

  it("keeps a line break the writer put inside a paragraph", () => {
    const verse: Block = {
      kind: "paragraph",
      depth: 0,
      runs: [{ text: "one" }, { text: "\n", hardBreak: true }, { text: "two" }],
    };
    expect(canonicalText([{ title: "T", blocks: [verse] }])).toBe(
      "T\n\none\ntwo",
    );
  });

  it("ends without a trailing newline, as the printed recipe says", () => {
    expect(canonicalText([{ title: "T", blocks: [para("a")] }])).not.toMatch(
      /\n$/,
    );
  });

  it("says nothing about when it was taken", () => {
    // It has to be a fact about the text that anyone holding the same text can
    // reproduce. Folding in a timestamp or an id would make it a number this
    // app invented, which proves nothing to anybody.
    const text = canonicalText([{ title: "One", blocks: [para("prose")] }]);
    expect(text).toContain("prose");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("hashes a chapter on its own by the same recipe", () => {
    // What lets a reader find *which* chapter differs rather than only that
    // something does.
    const one = { title: "One", blocks: [para("x")] };
    expect(chapterCanonicalText(one)).toBe(canonicalText([one]));
  });
});

describe("bookTimeline", () => {
  it("answers an empty history without inventing a date", () => {
    expect(bookTimeline([{ versions: [] }])).toEqual({
      firstAt: null,
      lastAt: null,
      days: 0,
      snapshots: 0,
    });
  });

  it("spans every chapter's drafts, not just one chapter's", () => {
    const timeline = bookTimeline([
      { versions: [{ at: Date.UTC(2026, 0, 3) }] },
      { versions: [{ at: Date.UTC(2026, 0, 1) }, { at: Date.UTC(2026, 0, 9) }] },
    ]);
    expect(timeline.firstAt).toBe(Date.UTC(2026, 0, 1));
    expect(timeline.lastAt).toBe(Date.UTC(2026, 0, 9));
    expect(timeline.snapshots).toBe(3);
  });

  it("counts a day once however many drafts landed on it", () => {
    const day = Date.UTC(2026, 0, 3, 6);
    const timeline = bookTimeline([
      { versions: [{ at: day }, { at: day + 3_600_000 }] },
    ]);
    expect(timeline.snapshots).toBe(2);
    expect(timeline.days).toBe(1);
  });
});

describe("utcOffset", () => {
  it("is written the way a reader expects to see one", () => {
    expect(utcOffset()).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
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
  const noDrafts = bookTimeline([]);

  function report(over: Partial<Parameters<typeof formatRecord>[0]> = {}) {
    return formatRecord({
      title: "The Crossing",
      record,
      timeline: noDrafts,
      chapters: [],
      fingerprint: null,
      imports: [],
      at: Date.UTC(2026, 0, 6, 12),
      zone: "UTC+05:30",
      ...over,
    });
  }

  function chapter(over: Partial<RecordChapter> = {}): RecordChapter {
    return {
      title: "Chapter 1",
      words: 900,
      fingerprint: null,
      versions: [],
      ...over,
    };
  }

  it("leads with the book and when it was generated", () => {
    const text = report({ author: "A. Writer" });
    expect(text).toContain("WRITING RECORD — The Crossing");
    expect(text).toContain("A. Writer");
    expect(text).toContain("2026-01-06");
  });

  it("names the recipe its numbers were taken with", () => {
    // A hash is only checkable against a stated method, and this one is
    // allowed to change. A reader holding an older record has to be able to
    // tell it was made under different rules.
    expect(report()).toContain(`Record format ${RECORD_FORMAT}`);
  });

  it("says which clock the day keys belong to", () => {
    // The days are local and every instant is UTC. Without the offset a reader
    // cannot tell whether "2026-01-06" and "2026-01-06T12:00:00Z" are the same
    // day, and far enough east they often are not.
    expect(report()).toContain("UTC+05:30");
  });

  it("answers this book before it answers the whole library", () => {
    // The reader came with a question about this manuscript. The day log is
    // about a different one, and led with it for a long time.
    const text = report();
    expect(text.indexOf("THIS BOOK")).toBeLessThan(text.indexOf("THE DAY LOG"));
  });

  it("says why no drafts are kept, rather than implying none exist", () => {
    // Seen on a second machine: the same book, the same fingerprint, and
    // "none kept" — which reads as a manuscript with no history at all when
    // what it means is that history does not sync.
    const text = report();
    expect(text).toContain("none kept on this machine");
    expect(text).toContain("do not travel");
  });

  it("calls the draft count a floor rather than a total", () => {
    // Eight a chapter, oldest swept away. Printing it as a total would be a
    // number this app cannot stand behind.
    const text = report({
      timeline: bookTimeline([{ versions: [{ at: Date.UTC(2026, 0, 1) }] }]),
    });
    expect(text).toContain("at least 1");
    expect(text).toContain("a floor, not a total");
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

  it("names the import days in the file, not only on the screen", () => {
    // The one part of the record an accuser would seize on was the one part
    // the accuser never got handed.
    const text = report({ imports: [{ day: "2026-01-01", words: 42_000 }] });
    expect(text).toContain("DAYS THAT LOOK LIKE IMPORTS");
    expect(text).toContain("2026-01-01  +42,000");
  });

  it("leaves the import section out when there are none", () => {
    expect(report()).not.toContain("DAYS THAT LOOK LIKE IMPORTS");
  });

  it("says the day figures cover every book, not just this one", () => {
    expect(report()).toMatch(/not this one alone/);
  });

  it("counts one day as a day", () => {
    // Caught in the browser on a book written in a single sitting, which is
    // every book on its first day: "Across: 1 calendar days".
    const text = report({ record: writingRecord({ "2026-01-01": 16 }) });
    expect(text).toContain("1 calendar day");
    expect(text).not.toContain("1 calendar days");
  });

  it("shows a day of cutting as a cut rather than as a loss of words", () => {
    const text = report();
    expect(text).toContain("2026-01-01  +1,200");
    expect(text).toContain("2026-01-05  −300");
  });

  it("lists what was fingerprinted, chapter by chapter", () => {
    // Without the list the number at the bottom is a hash of an unnamed thing.
    const text = report({
      chapters: [chapter({ title: "The salt pans", fingerprint: "ab12" })],
    });
    expect(text).toContain("The salt pans");
    expect(text).toContain("sha256 ab12");
  });

  it("names a chapter it could not read, beside the fingerprint", () => {
    // The old code hashed an unreadable body as "", producing a valid-looking
    // number for a manuscript with a hole in it.
    const text = report({
      chapters: [chapter({ unreadable: true })],
      fingerprint: "abc123",
    });
    expect(text).toContain("COULD NOT BE READ");
    expect(text).toContain("could not be read and is not in it");
  });

  it("prints the fingerprint with what to do about it", () => {
    const text = report({ fingerprint: "abc123" });
    expect(text).toContain("abc123");
    // The instruction is the point: a hash nobody timestamped is worthless,
    // and we must not be the one holding the timestamp.
    expect(text).toContain("outside the author's control");
  });

  it("prints the recipe, so the number can be checked rather than believed", () => {
    // The document used to tell a reader that anyone with the same text could
    // recompute this, while publishing no method by which anyone could.
    const text = report({ fingerprint: "abc123" });
    expect(text).toContain("HOW TO CHECK IT");
    expect(text).toContain("NFC");
    expect(text).toContain("UTF-8");
    expect(text).toContain("SHA-256");
  });

  it("leaves the fingerprint section out entirely when there is none", () => {
    // Rather than printing an empty heading, which reads as a failure the
    // reader has to interpret.
    expect(report()).not.toContain("FINGERPRINT");
    expect(report()).not.toContain("HOW TO CHECK IT");
  });

  it("lists saved drafts oldest first under their chapter", () => {
    const text = report({
      chapters: [
        chapter({
          versions: [
            { at: Date.UTC(2026, 0, 1), words: 900 },
            { at: Date.UTC(2026, 0, 3), words: 1400 },
          ],
        }),
      ],
    });
    expect(text).toContain("SAVED DRAFTS");
    expect(text.indexOf("900 words")).toBeLessThan(text.indexOf("1,400 words"));
  });

  it("omits the drafts section when no chapter has any", () => {
    expect(report({ chapters: [chapter()] })).not.toContain("SAVED DRAFTS");
  });

  it("says so plainly when there is no record at all", () => {
    const text = report({ record: writingRecord({}) });
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
