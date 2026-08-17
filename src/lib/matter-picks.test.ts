import { expect, it } from "vitest";
import { MATTER_SECTIONS } from "@/lib/matter";
import {
  SUGGESTED,
  countPicked,
  defaultPicked,
  matterKey,
  pagesLabel,
  picksFrom,
} from "@/lib/matter-picks";

it("suggests only pages that are on the offered list", () => {
  // A typo here would tick nothing and look like a deliberately empty default.
  for (const part of ["front", "back"] as const) {
    const titles = MATTER_SECTIONS[part].map((s) => s.title);
    for (const suggested of SUGGESTED[part]) {
      expect(titles).toContain(suggested);
    }
  }
});

/**
 * **Nothing is ticked until the writer ticks it**, and this is the test not to
 * "fix" by putting a sensible default back.
 *
 * The screen asks what you will *write*. A tick that arrives already made is
 * not an answer to that — it seeds a page of `[placeholders]`, which the export
 * then has to leave out and explain in its "not going in" note. Advice belongs
 * in the `usual` marker, which is shown rather than acted on.
 */
it("ticks nothing until the writer does", () => {
  expect(defaultPicked().size).toBe(0);
  for (const part of ["front", "back"] as const) {
    expect(SUGGESTED[part]).toEqual([]);
  }
});

it("never suggests a page the export already builds", () => {
  // Ticking one of these makes a written page that replaces the generated one,
  // which is a choice rather than a default — see `isGeneratedPage`. They carry
  // the `usual` marker (a book does have a title page) *and* a line saying the
  // export builds one, which is the pair of facts a writer needs; neither is a
  // reason to tick the row for them.
  for (const generated of [
    "Title page",
    "Copyright page",
    "Table of contents",
  ]) {
    expect(SUGGESTED.front).not.toContain(generated);
  }
});

/**
 * The two parts are keyed apart, which is not academic: both ends of the book
 * could hold a page called "Glossary", and a set of bare titles would tick
 * both at once.
 */
it("keys the two parts apart", () => {
  expect(matterKey("front", "Glossary")).not.toBe(
    matterKey("back", "Glossary"),
  );

  const picked = new Set([matterKey("back", "Glossary")]);
  expect(picksFrom(picked, ["front"])).toEqual([]);
  expect(picksFrom(picked, ["back"])).toEqual([
    { part: "back", title: "Glossary" },
  ]);
});

/**
 * Binding order, not tick order. A writer who ticks the prologue and then goes
 * back for the dedication still gets the dedication in front of it, because
 * that is where a dedication goes.
 */
it("returns picks in binding order whatever order they were ticked in", () => {
  const picked = new Set([
    matterKey("front", "Prologue"),
    matterKey("front", "Dedication"),
    matterKey("front", "Half-title page"),
  ]);

  expect(picksFrom(picked, ["front"]).map((p) => p.title)).toEqual([
    "Half-title page",
    "Dedication",
    "Prologue",
  ]);
});

it("puts every front page before every back page", () => {
  const picked = new Set([
    matterKey("back", "Epilogue"),
    matterKey("front", "Dedication"),
  ]);

  expect(picksFrom(picked)).toEqual([
    { part: "front", title: "Dedication" },
    { part: "back", title: "Epilogue" },
  ]);
});

it("ignores a tick for a page that is not offered", () => {
  // Storage and older builds are not type-checked, and a stale key must not
  // become a page nobody can explain.
  const picked = new Set([matterKey("front", "Colophon")]);
  expect(picksFrom(picked)).toEqual([]);
});

it("counts one end of the book without the other", () => {
  const picked = defaultPicked();

  expect(countPicked(picked, "front")).toBe(SUGGESTED.front.length);
  expect(countPicked(picked, "back")).toBe(SUGGESTED.back.length);
});

it("says pages in the plural except for one", () => {
  // "1 pages" on a button is the kind of small wrongness a reader reads as
  // carelessness about everything else on the screen.
  expect(pagesLabel(0)).toBe("0 pages");
  expect(pagesLabel(1)).toBe("1 page");
  expect(pagesLabel(2)).toBe("2 pages");
});
