import { expect, it } from "vitest";
import { diffCounts, diffWords } from "@/lib/editor/text-diff";

/** The diff, rebuilt as the two sides it describes. */
const before = (parts: ReturnType<typeof diffWords>) =>
  parts
    .filter((p) => p.kind !== "in")
    .map((p) => p.text)
    .join("");

const after = (parts: ReturnType<typeof diffWords>) =>
  parts
    .filter((p) => p.kind !== "out")
    .map((p) => p.text)
    .join("");

it("says nothing changed when nothing changed", () => {
  expect(diffWords("The rain came.", "The rain came.")).toEqual([
    { text: "The rain came.", kind: "same" },
  ]);
});

it("is empty for two empty passages", () => {
  expect(diffWords("", "")).toEqual([]);
});

it("marks a swapped word and keeps the rest whole", () => {
  const parts = diffWords("The rain came hard.", "The rain came sideways.");
  expect(parts).toEqual([
    { text: "The rain came ", kind: "same" },
    { text: "hard.", kind: "out" },
    { text: "sideways.", kind: "in" },
  ]);
});

/** **The rebuild is the real test.** A diff that cannot be read back as its own
    two sides is a picture of a change nobody made. */
it("rebuilds both sides of every change it describes", () => {
  const pairs: Array<[string, string]> = [
    ["The rain came down hard and it was cold.", "Rain came sideways. Cold went through the coat."],
    ["one two three four five", "one three five"],
    ["", "a whole new paragraph"],
    ["a paragraph being deleted", ""],
    ["same start, different end", "same start, another ending entirely"],
    ["a\n\nb", "a\n\nc"],
  ];

  for (const [from, to] of pairs) {
    const parts = diffWords(from, to);
    expect(before(parts)).toBe(from);
    expect(after(parts)).toBe(to);
  }
});

it("keeps the untouched ends in one run each", () => {
  const parts = diffWords(
    "She opened the door and stepped out.",
    "She opened the hatch and stepped out.",
  );
  expect(parts[0]).toEqual({ text: "She opened the ", kind: "same" });
  expect(parts[parts.length - 1]).toEqual({
    text: " and stepped out.",
    kind: "same",
  });
});

it("keeps line breaks, so paragraphs are not run together", () => {
  const parts = diffWords("First line.\n\nSecond line.", "First line.\n\nThird line.");
  expect(before(parts)).toContain("\n\n");
  expect(after(parts)).toContain("\n\n");
});

/** Past the cap the answer is one swap — still correct, just not itemised. */
it("falls back to a whole-passage swap when too much moved", () => {
  const from = Array.from({ length: 2_000 }, (_, i) => `alpha${i}`).join(" ");
  const to = Array.from({ length: 2_000 }, (_, i) => `beta${i}`).join(" ");
  const parts = diffWords(from, to);

  expect(parts).toHaveLength(2);
  expect(parts[0].kind).toBe("out");
  expect(parts[1].kind).toBe("in");
  expect(before(parts)).toBe(from);
  expect(after(parts)).toBe(to);
});

/** A long passage with a small edit is still itemised — the cap measures what
    moved, not how much was selected. */
it("still itemises a small edit inside a long passage", () => {
  const filler = Array.from({ length: 2_000 }, (_, i) => `word${i}`).join(" ");
  const parts = diffWords(`${filler} hard.`, `${filler} sideways.`);

  expect(parts).toEqual([
    { text: `${filler} `, kind: "same" },
    { text: "hard.", kind: "out" },
    { text: "sideways.", kind: "in" },
  ]);
});

it("counts the words each way for a one-line summary", () => {
  const parts = diffWords("one two three", "one four five six");
  expect(diffCounts(parts)).toEqual({ added: 3, removed: 2 });
});
