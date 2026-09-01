import { expect, it } from "vitest";
import {
  DEFAULT_JACKETS,
  defaultJacketFor,
  seedIndex,
} from "@/lib/default-covers";

it("gives one book the same jacket every time", () => {
  const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  expect(defaultJacketFor(id)).toBe(defaultJacketFor(id));
  expect(defaultJacketFor(id)).toBe("/default-covers/jacket-3.jpg");
});

it("gives different books different jackets", () => {
  expect(defaultJacketFor("book-1")).not.toBe(defaultJacketFor("book-2"));
});

/*
 * The arithmetic, pinned by its answers rather than by a second copy of itself.
 *
 * `coverPalette` in `book-cover.tsx` used this fold to pick a book's cloth
 * colour long before there were jackets, and lifting it out here must not move
 * anybody's shelf. These are the indices that function returned; if this test
 * goes red, every existing book has just changed colour.
 */
it("keeps the fold that already chose every book's ground", () => {
  expect(seedIndex("3f2504e0-4f89-41d3-9a0c-0305e82c3301", 8)).toBe(0);
  expect(seedIndex("book-1", 8)).toBe(3);
  expect(seedIndex("book-2", 8)).toBe(2);
  expect(seedIndex("The Long Winter", 8)).toBe(2);
  expect(seedIndex("a", 8)).toBe(1);
});

it("spreads a shelf across all seven", () => {
  const seen = new Set(
    Array.from({ length: 200 }, (_, i) => defaultJacketFor(`book-${i}`)),
  );
  expect(seen.size).toBe(DEFAULT_JACKETS.length);
});

it("answers for a book with no id yet", () => {
  // `BookCover` falls back to the title, and a new book's title can be empty
  // for as long as it takes to type one.
  expect(DEFAULT_JACKETS).toContain(defaultJacketFor(""));
});

it("never indexes an empty list", () => {
  // Nothing calls it this way today; it is here because a zero-length modulo
  // is NaN, and NaN as an array index is `undefined` rendered as a broken img.
  expect(seedIndex("anything", 0)).toBe(0);
});
