import { expect, it } from "vitest";
import {
  GENRES,
  suggestTarget,
  targetHint,
  type Genre,
} from "@/lib/book-kinds";

it("suggests a target for every genre", () => {
  // A missing entry would fall through to the unknown-genre default and put a
  // plausible-looking wrong number in the field.
  for (const genre of GENRES) {
    expect(suggestTarget(genre)).toBeGreaterThan(0);
  }
});

it("varies the target by genre", () => {
  expect(suggestTarget("Fantasy")).toBe(110_000);
  expect(suggestTarget("Young adult")).toBe(70_000);
});

it("falls back rather than returning NaN for an unrecognised genre", () => {
  // Genres are stored as plain strings, so a book written by an older build —
  // or hand-edited storage — can carry one we no longer list.
  expect(suggestTarget("Westerns" as Genre)).toBe(90_000);
});

it("names the genre in the hint", () => {
  expect(targetHint("Fantasy")).toBe("Suggested for fantasy books.");
});
