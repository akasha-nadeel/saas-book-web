import { expect, it } from "vitest";
import { opensHere } from "./smart-quotes";

/**
 * Which way a quote turns.
 *
 * The rest of the extension is Tiptap plumbing — a regex per rule and an
 * `insertContentAt` — and there is no editor here to drive it through. This is
 * the piece that holds the judgement, and the piece that would be wrong in a
 * way a reader would notice: an apostrophe pointing the wrong way in the middle
 * of `don’t` is the mark of a file nobody set.
 */

it("opens a quotation at the start of a line", () => {
  expect(opensHere("")).toBe(true);
});

it("opens after a space or an opening bracket", () => {
  for (const before of [" ", "\n", "(", "[", "{"]) {
    expect(opensHere(before), JSON.stringify(before)).toBe(true);
  }
});

it("opens after a dash, which is how dialogue breaks and resumes", () => {
  // “I told him—” “Told him what?”
  expect(opensHere("—")).toBe(true);
  expect(opensHere("–")).toBe(true);
});

it("closes after a letter, which is what makes don’t an apostrophe", () => {
  // The case that matters most: `n` precedes, so this is not an opening quote.
  expect(opensHere("n")).toBe(false);
  expect(opensHere("s")).toBe(false);
  expect(opensHere("A")).toBe(false);
});

it("closes after a digit and after closing punctuation", () => {
  for (const before of ["1", ".", ",", "!", "?", ")", "”"]) {
    expect(opensHere(before), JSON.stringify(before)).toBe(false);
  }
});
