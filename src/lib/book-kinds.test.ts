import { expect, it } from "vitest";
import {
  BOOK_KINDS,
  GENRES,
  kindLabel,
  suggestTarget,
  targetHint,
  type Genre,
} from "@/lib/book-kinds";

it("suggests a target for every genre a novel can be", () => {
  // A missing entry would fall through to the unknown-genre default and put a
  // plausible-looking wrong number in the field.
  for (const genre of GENRES) {
    expect(suggestTarget("novel", genre)).toBeGreaterThan(0);
  }
});

it("varies the novel target by genre", () => {
  expect(suggestTarget("novel", "Fantasy")).toBe(110_000);
  expect(suggestTarget("novel", "Young adult")).toBe(70_000);
});

it("ignores genre for the length-defined forms", () => {
  // A novella is a novella whatever it is about.
  expect(suggestTarget("novella", "Fantasy")).toBe(
    suggestTarget("novella", "Young adult"),
  );
  expect(suggestTarget("short-story", "Fantasy")).toBe(
    suggestTarget("short-story", "Memoir"),
  );
});

it("orders the three forms by length", () => {
  expect(suggestTarget("short-story", "Fantasy")).toBeLessThan(
    suggestTarget("novella", "Fantasy"),
  );
  expect(suggestTarget("novella", "Fantasy")).toBeLessThan(
    suggestTarget("novel", "Fantasy"),
  );
});

it("falls back rather than returning NaN for an unrecognised genre", () => {
  // Genres are stored as plain strings, so a book written by an older build —
  // or hand-edited storage — can carry one we no longer list.
  expect(suggestTarget("novel", "Westerns" as Genre)).toBe(90_000);
});

it("names the genre in the hint only where genre changed the number", () => {
  expect(targetHint("novel", "Fantasy")).toBe("Suggested for fantasy novels.");
  expect(targetHint("novella", "Fantasy")).not.toContain("fantasy");
  expect(targetHint("short-story", "Fantasy")).not.toContain("fantasy");
});

it("labels every kind", () => {
  for (const kind of BOOK_KINDS) {
    expect(kindLabel(kind.value)).toBe(kind.label);
  }
});
