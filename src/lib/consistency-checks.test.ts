import { describe, expect, it } from "vitest";

import {
  ALL_CHECKS,
  consistencyReport,
  DOMINANCE,
  MIN_DOMINANT,
  MIN_EITHER_CASE,
} from "./consistency";
import {
  CHECK_GROUPS,
  CHECK_LOOK,
  CHECK_ORDER,
  CHECKS,
  checksIn,
} from "./consistency-checks";
import { CHECK_MARKS } from "@/components/consistency/check-marks";

/** Any three fills; the marks are compared for shape, not for colour. */
const INK = { strong: "#000", soft: "#888", page: "#fff" };

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
      // The two a silent check is explained with. `Record<CheckId, …>` refuses
      // a missing key; only this refuses an empty string, which would draw as a
      // row that names a check and then says nothing about it.
      expect(check.looksFor.length, check.id).toBeGreaterThan(0);
      expect(check.ignores.length, check.id).toBeGreaterThan(0);
    }
    for (const check of CHECKS) {
      expect(check.hue).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // Two checks sharing a hue is two cards that look like one finding.
    expect(new Set(CHECKS.map((c) => c.hue)).size).toBe(CHECKS.length);
    expect(new Set(CHECKS.map((c) => c.name)).size).toBe(CHECKS.length);
    expect(new Set(CHECKS.map((c) => c.hint)).size).toBe(CHECKS.length);
    // Two checks explained with one sentence is a copy-paste that reads as a
    // bug to the one writer who opens both rows.
    expect(new Set(CHECKS.map((c) => c.looksFor)).size).toBe(CHECKS.length);
    expect(new Set(CHECKS.map((c) => c.ignores)).size).toBe(CHECKS.length);
  });

  it("suggests nothing and grades nothing", () => {
    // The same refusal the engine is held to. A hint is an example of the
    // thing, never an instruction about what to do with it — and the two lines
    // a silent check is explained with are held to it too, since they are the
    // longest prose on the screen and the easiest place to slip a verdict in.
    const words = CHECKS.map(
      (c) => `${c.name} ${c.hint} ${c.looksFor} ${c.ignores}`,
    )
      .join(" ")
      .toLowerCase();
    for (const banned of ["should", "must", "fix", "error", "wrong", "score"]) {
      expect(words).not.toContain(banned);
    }
  });

  it("draws a mark of its own for every check", () => {
    // The tile is keyed by `CheckId` in the component layer rather than carried
    // on `CHECK_LOOK`, because that module is read by Server Components and JSX
    // there would pull artwork into the pricing rows and the landing page. So
    // `Record<CheckId, …>` is still the guard — this is what would notice the
    // records drifting apart, and a mark used twice, which is the same failure
    // as two checks sharing a hue: two rows that look like one.
    expect(Object.keys(CHECK_MARKS).sort()).toEqual([...CHECK_ORDER].sort());
    const drawn = CHECK_ORDER.map((id) =>
      JSON.stringify(CHECK_MARKS[id](INK)),
    );
    expect(new Set(drawn).size).toBe(CHECK_ORDER.length);
  });

  it("states the engine's own thresholds, not a rounded memory of them", () => {
    /*
     * **The numbers a writer is told have to be the numbers that decide.**
     * `consistency-checks.ts` imports nothing but `consistency-ids` on purpose
     * — the pricing rows and the picker must not pull in the engine's three
     * word lists — so the thresholds are written there as words. This is what
     * keeps them true, the way `launch.test.ts` holds the free book limit to
     * the migration that enforces it.
     *
     * A threshold changed in the engine and not in the copy is the exact
     * failure this whole block exists to prevent: a screen that explains a
     * refusal with a number that is no longer the reason.
     */
    expect(CHECK_LOOK.names.looksFor).toContain(String(MIN_DOMINANT));
    expect(CHECK_LOOK.names.looksFor).toContain(String(DOMINANCE));
    expect(CHECK_LOOK.capitals.looksFor).toContain(String(MIN_EITHER_CASE));
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
