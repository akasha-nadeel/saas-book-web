import { describe, expect, it } from "vitest";
import { BEATS, GENRE_NOTES, placeBeats, whereYouAre } from "./beats";
import { GENRES } from "./book-kinds";

describe("the beats themselves", () => {
  it("gives every beat a unique id", () => {
    expect(new Set(BEATS.map((b) => b.id)).size).toBe(BEATS.length);
  });

  it("covers the whole book with no gaps and no overlaps", () => {
    expect(BEATS[0].from).toBe(0);
    expect(BEATS[BEATS.length - 1].to).toBe(1);
    for (let i = 1; i < BEATS.length; i++) {
      expect(BEATS[i].from).toBe(BEATS[i - 1].to);
    }
  });

  it("runs forwards", () => {
    for (const beat of BEATS) expect(beat.to).toBeGreaterThan(beat.from);
  });

  /**
   * The beat the whole feature exists for. Three research batches name the
   * midpoint as where books stall, so if it stops sitting in the middle the
   * thing this was built to say has gone.
   */
  it("puts the middle turn in the middle", () => {
    const mid = BEATS.find((b) => b.id === "midpoint")!;
    expect(mid.from).toBeLessThanOrEqual(0.5);
    expect(mid.to).toBeGreaterThanOrEqual(0.5);
  });

  /**
   * A genre note that names a genre the app does not offer would never be
   * shown, which makes it a lie by omission about what this covers.
   */
  it("only writes notes for genres the app actually offers", () => {
    for (const genre of Object.keys(GENRE_NOTES)) {
      expect(GENRES as readonly string[]).toContain(genre);
    }
  });
});

describe("placeBeats", () => {
  it("turns shares into words", () => {
    const placed = placeBeats(0, 100_000)!;
    const mid = placed.find((b) => b.id === "midpoint")!;
    expect(mid.fromWords).toBe(45_000);
    expect(mid.toWords).toBe(55_000);
  });

  it("finds the beat the writer is inside", () => {
    const placed = placeBeats(50_000, 100_000)!;
    expect(placed.find((b) => b.current)?.id).toBe("midpoint");
  });

  it("marks everything behind as passed", () => {
    const placed = placeBeats(50_000, 100_000)!;
    expect(placed.find((b) => b.id === "before")?.passed).toBe(true);
    expect(placed.find((b) => b.id === "low")?.passed).toBe(false);
  });

  it("puts a writer at zero words at the very start", () => {
    expect(placeBeats(0, 100_000)!.find((b) => b.current)?.id).toBe("before");
  });

  /**
   * A book that overran its target is in its ending, not nowhere. Without
   * this the screen would go blank for exactly the writer who most wants to
   * know how much is left.
   */
  it("keeps a writer past the target inside the last beat", () => {
    const placed = placeBeats(140_000, 100_000)!;
    expect(placed.find((b) => b.current)?.id).toBe("after");
  });

  /**
   * Guessing a target from the genre would put a plausible number on screen
   * that the writer never agreed to, and then measure them against it.
   */
  it("refuses to place anything without a target", () => {
    expect(placeBeats(30_000, undefined)).toBeNull();
    expect(placeBeats(30_000, 0)).toBeNull();
  });

  it("marks exactly one beat as current", () => {
    for (const words of [0, 1_000, 30_000, 50_000, 99_000, 200_000]) {
      const placed = placeBeats(words, 100_000)!;
      expect(placed.filter((b) => b.current)).toHaveLength(1);
    }
  });
});

describe("whereYouAre", () => {
  it("names the beat and the share", () => {
    const line = whereYouAre(placeBeats(50_000, 100_000), 50_000)!;
    expect(line).toContain("50,000 words");
    expect(line).toContain("50%");
    expect(line).toContain("The middle turn");
  });

  it("says nothing without a target", () => {
    expect(whereYouAre(null, 30_000)).toBeNull();
  });
});
