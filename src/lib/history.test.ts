import { describe, expect, it } from "vitest";
import {
  addSnapshot,
  MAX_HISTORY_BYTES,
  MAX_SNAPSHOTS,
  parseHistory,
  passesOf,
  shouldSnapshot,
  SNAPSHOT_EVERY_MS,
  type Snapshot,
} from "./history";

const snap = (at: number, body = "x", words = 1): Snapshot => ({
  at,
  body,
  words,
});

describe("shouldSnapshot", () => {
  it("always takes the first one", () => {
    expect(shouldSnapshot([], "text", 0)).toBe(true);
  });

  it("waits for the interval", () => {
    const history = [snap(1000, "old")];
    expect(shouldSnapshot(history, "new", 1000 + SNAPSHOT_EVERY_MS - 1)).toBe(
      false,
    );
    expect(shouldSnapshot(history, "new", 1000 + SNAPSHOT_EVERY_MS)).toBe(true);
  });

  /**
   * A chapter left open with an autosave ticking over would otherwise push out
   * the eight versions that mattered with eight identical ones.
   */
  it("refuses when nothing has actually changed", () => {
    const history = [snap(0, "same")];
    expect(shouldSnapshot(history, "same", SNAPSHOT_EVERY_MS * 10)).toBe(false);
  });
});

describe("addSnapshot", () => {
  it("puts the newest first", () => {
    const next = addSnapshot([snap(1, "old")], snap(2, "new"));
    expect(next.map((s) => s.body)).toEqual(["new", "old"]);
  });

  it("keeps no more than the count budget", () => {
    let history: Snapshot[] = [];
    for (let i = 0; i < MAX_SNAPSHOTS + 5; i++) {
      history = addSnapshot(history, snap(i, `body-${i}`));
    }
    expect(history).toHaveLength(MAX_SNAPSHOTS);
    // The oldest went, not the newest.
    expect(history[0].body).toBe(`body-${MAX_SNAPSHOTS + 4}`);
  });

  it("drops old versions once they are too heavy together", () => {
    const heavy = "x".repeat(MAX_HISTORY_BYTES / 2 + 10);
    let history = addSnapshot([], snap(1, heavy));
    history = addSnapshot(history, snap(2, heavy));
    history = addSnapshot(history, snap(3, heavy));
    expect(history).toHaveLength(1);
    expect(history[0].at).toBe(3);
  });

  /**
   * A snapshot that evicted itself would be a feature that silently does
   * nothing, which is worse than one that is honestly absent.
   */
  it("always keeps the newest, even alone over the byte budget", () => {
    const huge = "x".repeat(MAX_HISTORY_BYTES * 2);
    expect(addSnapshot([], snap(1, huge))).toHaveLength(1);
  });
});

describe("parseHistory", () => {
  it("reads a stored list, newest first", () => {
    const stored = JSON.stringify([
      { at: 1, body: "old", words: 10 },
      { at: 9, body: "new", words: 20 },
    ]);
    expect(parseHistory(stored).map((s) => s.body)).toEqual(["new", "old"]);
  });

  it("drops a row with no body and keeps the rest", () => {
    const stored = JSON.stringify([
      { at: 1, body: "kept", words: 1 },
      { at: 2 },
      { at: 3, body: "" },
      null,
    ]);
    expect(parseHistory(stored).map((s) => s.body)).toEqual(["kept"]);
  });

  it("survives storage that is not JSON, or not a list", () => {
    expect(parseHistory("not json")).toEqual([]);
    expect(parseHistory('{"nope":1}')).toEqual([]);
    expect(parseHistory(null)).toEqual([]);
  });
});

describe("passesOf", () => {
  it("counts nothing for a chapter with no history", () => {
    expect(passesOf([])).toBe(0);
  });

  it("counts one sitting as one pass", () => {
    const start = 1_000_000;
    expect(
      passesOf([
        snap(start),
        snap(start + SNAPSHOT_EVERY_MS),
        snap(start + SNAPSHOT_EVERY_MS * 2),
      ]),
    ).toBe(1);
  });

  /**
   * Sessions, not saves. "My first chapter has had about twenty rounds of
   * editing" is about sittings, and a save is a keystroke settling.
   */
  it("counts a long gap as a new pass", () => {
    const day = 24 * 60 * 60 * 1000;
    expect(passesOf([snap(0), snap(day), snap(day * 2)])).toBe(3);
  });

  it("does not care what order it is given them in", () => {
    const day = 24 * 60 * 60 * 1000;
    expect(passesOf([snap(day * 2), snap(0), snap(day)])).toBe(3);
  });
});
