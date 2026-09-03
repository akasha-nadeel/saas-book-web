import { describe, expect, it } from "vitest";

import { breaksIn } from "./book-text";
import type { Block } from "./export/blocks";

const para = (text: string): Block => ({
  kind: "paragraph",
  depth: 0,
  runs: [{ text }],
});
const rule: Block = { kind: "sceneBreak", depth: 0, runs: [] };

/**
 * The half of the scene-break check that decides what a break *is*.
 *
 * Pure, and worth its own tests because it is the only thing standing between
 * "your book marks scene breaks two ways" and a finding on every paragraph
 * that happens to be short.
 */
describe("what counts as a scene break", () => {
  it("reads a real break as a real one", () => {
    expect(breaksIn([para("She waited."), rule, para("He left.")])).toEqual([null]);
  });

  it("reads asterisks typed into a paragraph as typed", () => {
    expect(breaksIn([para("She waited."), para("***")])).toEqual(["***"]);
  });

  it("keeps a spaced divider as it was written", () => {
    // `* * *` and `***` are different marks on the page, so they are different
    // answers to the question this check asks.
    expect(breaksIn([para("* * *")])).toEqual(["* * *"]);
  });

  it("reads the conventions a manuscript actually uses", () => {
    for (const mark of ["***", "---", "###", "~~~", "#", "§", "• • •", "◆"]) {
      expect(breaksIn([para(mark)]), mark).toEqual([mark]);
    }
  });

  /**
   * **The quiet half.** Every one of these is ordinary prose or an ordinary
   * beat, and reading one as a divider would put a finding on a book that has
   * no scene breaks in it at all.
   */
  it("says nothing about prose, an ellipsis or a lone dash", () => {
    for (const text of [
      "She waited.",
      "...",
      "…",
      "—",
      "-",
      "*emphasis*",
      "* a bullet someone typed",
      "**********************",
    ]) {
      expect(breaksIn([para(text)]), text).toEqual([]);
    }
  });

  it("keeps them in reading order, so the chapters line up", () => {
    expect(
      breaksIn([para("One."), rule, para("Two."), para("***"), para("Three.")]),
    ).toEqual([null, "***"]);
  });

  it("has nothing to say about a chapter with no breaks", () => {
    expect(breaksIn([para("She waited."), para("He left.")])).toEqual([]);
  });
});
