import { describe, expect, it } from "vitest";
import { MAX_PATHS, parseShelves, seedSubjects } from "./shelves";
import type { SubjectCount } from "./subjects";

const counts: SubjectCount[] = [
  { name: "Mystery", count: 14 },
  { name: "Detective and mystery stories", count: 8 },
  { name: "Cozy mystery", count: 3 },
  { name: "Older women", count: 1 },
];

const paths = (raw: string) => parseShelves(raw, counts).shelves.map((s) => s.path);

describe("seedSubjects", () => {
  it("keeps only what more than one book shares", () => {
    // One book filed under something is that book, not a pattern — the same
    // rule the categories screen already applies.
    expect(seedSubjects(counts).map((s) => s.name)).not.toContain("Older women");
  });

  it("caps how much is sent", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `s${i}`, count: 5 }));
    expect(seedSubjects(many)).toHaveLength(14);
  });
});

describe("parseShelves", () => {
  it("reads the ordinary answer", () => {
    const raw = JSON.stringify({
      shelves: [
        { path: "Mystery, Thriller & Suspense > Mystery > Cozy", reason: "Most of them are cozies.", from: ["Cozy mystery"] },
      ],
      note: "These are candidates.",
    });
    const { shelves, note } = parseShelves(raw, counts);
    expect(shelves).toHaveLength(1);
    expect(shelves[0].reason).toBe("Most of them are cozies.");
    expect(note).toBe("These are candidates.");
  });

  it("keeps the model's order", () => {
    const raw = JSON.stringify({
      shelves: [
        { path: "B", reason: "b" },
        { path: "A", reason: "a" },
      ],
    });
    expect(paths(raw)).toEqual(["B", "A"]);
  });

  it("digs the JSON out of a preamble or a fence", () => {
    expect(paths('Here you go:\n{"shelves":[{"path":"A","reason":"r"}]}')).toEqual(["A"]);
    expect(paths('```json\n{"shelves":[{"path":"A","reason":"r"}]}\n```')).toEqual(["A"]);
  });

  it("accepts a bare array", () => {
    expect(paths('[{"path":"A","reason":"r"},{"path":"B","reason":"r"}]')).toEqual(["A", "B"]);
  });

  it("normalises the separators a model writes a path with", () => {
    const raw = JSON.stringify({
      shelves: [
        { path: "Fiction / Mystery  ›  Cozy", reason: "r" },
      ],
    });
    expect(paths(raw)).toEqual(["Fiction > Mystery > Cozy"]);
  });

  it("collapses the same shelf written two ways", () => {
    const raw = JSON.stringify({
      shelves: [
        { path: "Fiction > Mystery", reason: "r" },
        { path: "fiction / mystery", reason: "again" },
      ],
    });
    expect(paths(raw)).toHaveLength(1);
  });

  it("drops a shelf with no reason, rather than showing a bare assertion", () => {
    const raw = '[{"path":"A","reason":"  "},{"path":"B","reason":"because"}]';
    expect(paths(raw)).toEqual(["B"]);
  });

  it("drops a shelf with no path", () => {
    expect(paths('[{"path":"","reason":"r"},{"path":"   ","reason":"r"}]')).toEqual([]);
  });

  it("never returns more than KDP could use a few times over", () => {
    const raw = JSON.stringify({
      shelves: Array.from({ length: 20 }, (_, i) => ({ path: `p${i}`, reason: "r" })),
    });
    expect(parseShelves(raw, counts).shelves).toHaveLength(MAX_PATHS);
  });

  it("cuts a runaway reason instead of letting it own the page", () => {
    const raw = JSON.stringify({ shelves: [{ path: "A", reason: "word ".repeat(200) }] });
    expect(parseShelves(raw, counts).shelves[0].reason.length).toBeLessThanOrEqual(241);
  });

  it("survives an answer that is not JSON, or is JSON of the wrong shape", () => {
    expect(parseShelves("I could not decide.", counts)).toEqual({ shelves: [], note: null });
    expect(parseShelves("", counts)).toEqual({ shelves: [], note: null });
    expect(parseShelves('{"answer":"none"}', counts).shelves).toEqual([]);
    expect(parseShelves("[1,2,3]", counts).shelves).toEqual([]);
  });

  it("reads a note when there is one, and null when there is not", () => {
    expect(parseShelves('{"shelves":[],"note":"  "}', counts).note).toBeNull();
    expect(parseShelves('{"shelves":[]}', counts).note).toBeNull();
  });
});

describe("the counts are ours", () => {
  it("attaches our own count to a subject the model named", () => {
    const raw = JSON.stringify({
      shelves: [{ path: "A", reason: "r", from: ["Mystery", "Cozy mystery"] }],
    });
    expect(parseShelves(raw, counts).shelves[0].from).toEqual([
      { name: "Mystery", count: 14 },
      { name: "Cozy mystery", count: 3 },
    ]);
  });

  // The one that matters. Asked for a number a model will produce a plausible
  // one, and a plausible count is indistinguishable from a real one.
  it("ignores a count the model supplied and uses ours", () => {
    const raw = JSON.stringify({
      shelves: [{ path: "A", reason: "r", from: ["Mystery"], count: 999 }],
    });
    const shelf = parseShelves(raw, counts).shelves[0];
    expect(shelf.from[0].count).toBe(14);
    expect(Object.keys(shelf).sort()).toEqual(["from", "path", "reason"]);
  });

  it("drops a subject we never counted rather than showing it bare", () => {
    const raw = JSON.stringify({
      shelves: [{ path: "A", reason: "r", from: ["Mystery", "Invented subject"] }],
    });
    expect(parseShelves(raw, counts).shelves[0].from.map((c) => c.name)).toEqual(["Mystery"]);
  });

  it("does not care about case when matching a subject back", () => {
    const raw = JSON.stringify({ shelves: [{ path: "A", reason: "r", from: ["mystery"] }] });
    expect(parseShelves(raw, counts).shelves[0].from[0].count).toBe(14);
  });
});

// A position rather than a behaviour. Search volume is what a writer wants and
// what cannot be had honestly — Amazon publishes none. If a figure like that
// ever appears in this shape the feature has lost what it was built to say.
describe("what it refuses to invent", () => {
  it("carries no volume, no competition and no score", () => {
    const raw = JSON.stringify({
      shelves: [
        { path: "A", reason: "r", volume: 4000, competition: "low", score: 87 },
      ],
    });
    expect(Object.keys(parseShelves(raw, counts).shelves[0]).sort()).toEqual([
      "from",
      "path",
      "reason",
    ]);
  });
});
