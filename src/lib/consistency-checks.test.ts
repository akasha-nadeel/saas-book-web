import { describe, expect, it } from "vitest";

import { ALL_CHECKS, consistencyReport } from "./consistency";
import {
  CHECK_GROUPS,
  CHECK_LOOK,
  CHECK_ORDER,
  CHECKS,
  checksIn,
} from "./consistency-checks";

describe("the catalogue of checks", () => {
  it("names every check the engine can run, exactly once", () => {
    // `Record<CheckId, …>` already refuses a missing key at compile time. What
    // it cannot see is the order list going out of step with it — a duplicate
    // there is a card that draws twice, a gap is one that never draws at all.
    expect([...CHECK_ORDER].sort()).toEqual(Object.keys(CHECK_LOOK).sort());
    expect(new Set(CHECK_ORDER).size).toBe(CHECK_ORDER.length);
  });

  it("reads its order from the engine, so the cards match the findings", () => {
    expect(CHECK_ORDER).toEqual(ALL_CHECKS);
  });

  it("is the same set the report says it ran", () => {
    // The one thing that would make the picker lie: a card for a check the
    // engine does not run, or a check that runs with no card to switch it off.
    //
    // `words` has to be supplied, or the near-miss check drops out of `ran` —
    // it needs a word list the browser fetches, and a check that could not run
    // is deliberately not counted as one that found nothing.
    const report = consistencyReport(
      [{ chapterId: "a", title: "One", number: 1, text: "A sentence." }],
      { words: new Set(["sentence"]) },
    );
    expect([...report.ran].sort()).toEqual([...CHECK_ORDER].sort());
  });

  it("gives every check words of its own", () => {
    for (const check of CHECKS) {
      expect(check.name.length).toBeGreaterThan(0);
      expect(check.hint.length).toBeGreaterThan(0);
    }
    for (const check of CHECKS) {
      expect(check.hue).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // Two checks sharing a hue is two cards that look like one finding.
    expect(new Set(CHECKS.map((c) => c.hue)).size).toBe(CHECKS.length);
    expect(new Set(CHECKS.map((c) => c.name)).size).toBe(CHECKS.length);
    expect(new Set(CHECKS.map((c) => c.hint)).size).toBe(CHECKS.length);
  });

  it("suggests nothing and grades nothing", () => {
    // The same refusal the engine is held to. A hint is an example of the
    // thing, never an instruction about what to do with it.
    const words = CHECKS.map((c) => `${c.name} ${c.hint}`).join(" ").toLowerCase();
    for (const banned of ["should", "must", "fix", "error", "wrong", "score"]) {
      expect(words).not.toContain(banned);
    }
  });
});

describe("the groups", () => {
  it("puts every check under exactly one heading", () => {
    const grouped = CHECK_GROUPS.flatMap((group) => checksIn(group.id));
    expect(grouped.map((c) => c.id).sort()).toEqual([...CHECK_ORDER].sort());
    expect(new Set(grouped.map((c) => c.id)).size).toBe(CHECK_ORDER.length);
  });

  it("leaves no heading empty", () => {
    // A heading over nothing is the shape the tool catalogue test guards
    // against too: a group that shipped before the thing under it did.
    for (const group of CHECK_GROUPS) {
      expect(checksIn(group.id).length, group.id).toBeGreaterThan(0);
    }
  });

  it("keeps each group in the order the report emits", () => {
    // The cards and the findings are read in one order; a group that sorted
    // its own way would put the flagship check third on the screen and first
    // in the results.
    for (const group of CHECK_GROUPS) {
      const inside = checksIn(group.id).map((c) => CHECK_ORDER.indexOf(c.id));
      expect(inside).toEqual([...inside].sort((a, b) => a - b));
    }
  });
});
