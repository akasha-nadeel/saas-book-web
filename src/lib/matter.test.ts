import { expect, it } from "vitest";
import {
  MATTER_SECTIONS,
  hasPlaceholder,
  isGeneratedPage,
  matterSection,
  matterSectionIndex,
  matterTitles,
  missingSections,
} from "./matter";

it("gives every section a title, a hint and something to write on", () => {
  for (const part of ["front", "back"] as const) {
    for (const section of MATTER_SECTIONS[part]) {
      expect(section.title.trim()).not.toBe("");
      expect(section.hint.trim()).not.toBe("");
      expect(section.lines.length).toBeGreaterThan(0);
    }
  }
});

/**
 * The rule the export depends on, asserted at the source.
 *
 * A seeded page is recognised as unfinished by its `[brackets]` and nothing
 * else — no stored flag, no comparison against this table. So a section whose
 * lines carry no bracket at all would ship straight into somebody's book the
 * moment they pressed Start, and would look deliberate when it did.
 */
it("leaves a placeholder on at least one line of every section", () => {
  for (const part of ["front", "back"] as const) {
    for (const section of MATTER_SECTIONS[part]) {
      expect(
        section.lines.some(hasPlaceholder),
        `${section.title} has no [placeholder] to replace`,
      ).toBe(true);
    }
  }
});

it("names no section twice within a part", () => {
  for (const part of ["front", "back"] as const) {
    const titles = matterTitles(part).map((t) => t.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  }
});

it("finds a section by name, ignoring case and spacing", () => {
  expect(matterSection("front", "  dedication ")?.title).toBe("Dedication");
  expect(matterSection("front", "Epilogue")).toBeNull();
  expect(matterSection("back", "Epilogue")?.title).toBe("Epilogue");
});

it("sorts a page the writer named after every standard one", () => {
  expect(matterSectionIndex("front", "Dedication")).toBe(3);
  expect(matterSectionIndex("front", "A note on the maps")).toBe(Infinity);
  // Infinity beats every real index, so an unknown page lands last rather than
  // at the front of the book — which -1 would have done.
  expect(matterSectionIndex("front", "A note on the maps")).toBeGreaterThan(
    matterSectionIndex("front", "Prologue"),
  );
});

it("offers only the sections a book does not have yet", () => {
  const { usual, rest } = missingSections("front", ["Dedication", "prologue"]);
  const titles = [...usual, ...rest].map((s) => s.title);
  expect(titles).not.toContain("Dedication");
  expect(titles).not.toContain("Prologue");
  expect(titles).toContain("Epigraph");
  expect(titles.length).toBe(MATTER_SECTIONS.front.length - 2);
});

/**
 * The split is the honest half: a menu heading reading "the usual pages" over
 * a list containing "Glossary" is a small lie, and it is the lie that makes a
 * writer think a complete book has all sixteen.
 */
it("keeps the few usual pages apart from the rest", () => {
  const front = missingSections("front", []);
  expect(front.usual.map((s) => s.title)).toEqual(["Dedication"]);
  expect(front.rest.map((s) => s.title)).toContain("Epigraph");

  const back = missingSections("back", []);
  expect(back.usual.map((s) => s.title)).toEqual([
    "Acknowledgements",
    "About the author",
  ]);
  expect(back.rest.map((s) => s.title)).toContain("Glossary");
});

it("offers nothing once every standard page exists", () => {
  expect(missingSections("back", matterTitles("back"))).toEqual({
    usual: [],
    rest: [],
  });
});

/**
 * The three the export builds. Not ticking these costs nothing, which is the
 * one thing a writer meeting the list cannot know by looking.
 */
it("knows which pages the export generates", () => {
  expect(isGeneratedPage("front", "Title page")).toBe(true);
  expect(isGeneratedPage("front", "  copyright page ")).toBe(true);
  expect(isGeneratedPage("front", "Table of contents")).toBe(true);
  expect(isGeneratedPage("front", "Dedication")).toBe(false);
  // A back-matter page of the same name is still not the book's title page.
  expect(isGeneratedPage("back", "Title page")).toBe(false);
});

it("spots a placeholder, and is not fooled by ordinary prose", () => {
  expect(hasPlaceholder("For [name].")).toBe(true);
  expect(hasPlaceholder("Copyright © [year] [author name]")).toBe(true);
  expect(hasPlaceholder("For Marguerite, who read it first.")).toBe(false);
  expect(hasPlaceholder("")).toBe(false);
  // Too short to be a placeholder — an empty pair is punctuation, not a slot.
  expect(hasPlaceholder("[]")).toBe(false);
  // An unclosed bracket must not swallow the rest of the page.
  expect(hasPlaceholder("He wrote [ and then stopped\nand carried on")).toBe(
    false,
  );
});
