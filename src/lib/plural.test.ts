import { describe, expect, it } from "vitest";
import { nounFor, plural } from "./plural";

/**
 * The bug this module exists to stop: the money screen printed "1 copies" the
 * first time a writer recorded a single sale, and the dashboard printed
 * "1 words". A count of one is the only case worth testing hard, because it is
 * the only one the old code got wrong.
 */
describe("plural", () => {
  it("agrees at one", () => {
    expect(plural(1, "word")).toBe("1 word");
    expect(plural(1, "chapter")).toBe("1 chapter");
    expect(plural(1, "day")).toBe("1 day");
  });

  it("agrees at nought and above one", () => {
    expect(plural(0, "word")).toBe("0 words");
    expect(plural(2, "word")).toBe("2 words");
  });

  // "copys" is what suffixing gives, which is why the irregular is a parameter.
  it("takes an irregular plural", () => {
    expect(plural(1, "copy", "copies")).toBe("1 copy");
    expect(plural(4, "copy", "copies")).toBe("4 copies");
  });

  // These are figures a reader compares against each other.
  it("localises the count", () => {
    expect(plural(6236, "word")).toBe("6,236 words");
  });
});

describe("nounFor", () => {
  // The stat cards set the figure and the label as separate props, so the noun
  // has to agree with a number it is not beside in the source.
  it("gives the noun alone, for a value rendered apart from it", () => {
    expect(nounFor(1, "day")).toBe("day");
    expect(nounFor(3, "day")).toBe("days");
    expect(nounFor(1, "copy", "copies")).toBe("copy");
  });
});
