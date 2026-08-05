import { expect, it } from "vitest";
import {
  BOOK_KINDS,
  GENRES,
  formShortfall,
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

/**
 * A book sold as one form and written as another.
 *
 * The threshold sits well below the boundary on purpose — see `formShortfall`.
 * A 38,000-word novel is a novel; a 4,000-word one is a short story with a
 * novel's description on it, which is the case a shop may refuse.
 */
it("says nothing about a novel that is merely on the short side", () => {
  expect(formShortfall("novel", 38_000)).toBeNull();
  expect(formShortfall("novel", 25_000)).toBeNull();
});

it("names the gap when a novel is a short story", () => {
  const gap = formShortfall("novel", 4_200);
  expect(gap).toEqual({ label: "Novel", floor: 40_000 });
});

it("says nothing about a book still being drafted", () => {
  // Under the floor, but nobody has mislabelled anything yet — they have
  // written two pages.
  expect(formShortfall("novel", 900)).toBeNull();
  expect(formShortfall("novel", 0)).toBeNull();
});

it("holds a novella to its own floor and a short story to none", () => {
  expect(formShortfall("novella", 5_000)).toEqual({
    label: "Novella",
    floor: 17_500,
  });
  expect(formShortfall("novella", 12_000)).toBeNull();
  // A short story has no floor to fall below.
  expect(formShortfall("short-story", 2_100)).toBeNull();
});
