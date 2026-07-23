import { expect, it } from "vitest";
import {
  DEFAULT_TYPESET,
  TEMPLATES,
  TRIMS,
  templateById,
  trimById,
  typesetCss,
} from "@/lib/export/typeset";

it("falls back rather than returning undefined for an unknown template", () => {
  // Options are persisted, so a build that drops a template must not leave a
  // stored book pointing at nothing.
  expect(templateById("nope" as never).id).toBe(TEMPLATES[0].id);
  expect(trimById("nope").id).toBe(TRIMS[0].id);
});

it("fixes the page size for print and leaves it alone for EPUB", () => {
  const print = typesetCss({ ...DEFAULT_TYPESET, trim: "6x9" }, true);
  expect(print).toContain("@page");
  expect(print).toContain("6in 9in");

  // A reader's device decides an EPUB's page. Declaring paper there would be a
  // statement nothing can honour.
  expect(typesetCss(DEFAULT_TYPESET, false)).not.toContain("@page");
});

it("hides chapter numbers by rule, not by omitting them", () => {
  // The number stays in the markup either way, so a reader that restyles the
  // book still has it.
  expect(typesetCss({ ...DEFAULT_TYPESET, hideChapterNumbers: true }, false))
    .toMatch(/\.chapter-number\s*\{[^}]*display:\s*none/);
  expect(typesetCss({ ...DEFAULT_TYPESET, hideChapterNumbers: false }, false))
    .toMatch(/\.chapter-number\s*\{[^}]*display:\s*block/);
});

it("emits a drop cap only when asked", () => {
  expect(typesetCss({ ...DEFAULT_TYPESET, dropCaps: true }, false)).toContain(
    "::first-letter",
  );
  expect(
    typesetCss({ ...DEFAULT_TYPESET, dropCaps: false }, false),
  ).not.toContain("::first-letter");
});

it("sets each template in its own face and size", () => {
  const seen = new Set<string>();
  for (const template of TEMPLATES) {
    const css = typesetCss({ ...DEFAULT_TYPESET, template: template.id }, false);
    expect(css).toContain(template.stack);
    expect(css).toContain(`${template.bodyPt}pt`);
    seen.add(`${template.stack}|${template.bodyPt}`);
  }
  // Three templates that produced the same CSS would be three names for one
  // thing.
  expect(seen.size).toBe(TEMPLATES.length);
});

it("keeps margins inside the trim they sit on", () => {
  // A 5-inch page cannot carry an inch of white each side and still hold a
  // line of text.
  for (const trim of TRIMS) {
    const css = typesetCss({ ...DEFAULT_TYPESET, trim: trim.id }, true);
    const match = /margin:\s*([\d.]+)in\s+([\d.]+)in/.exec(css);
    expect(match).not.toBeNull();

    const [, ends, side] = match!;
    expect(Number(side) * 2).toBeLessThan(trim.width * 0.6);
    expect(Number(ends) * 2).toBeLessThan(trim.height * 0.4);
  }
});

it("breaks each chapter onto a new page in print, but not the first", () => {
  const css = typesetCss(DEFAULT_TYPESET, true);
  // The break is on the section, so every chapter (and front-matter page) opens
  // a new page — the h1-only rule broke none of them, since each is the only h1
  // in its section.
  expect(css).toContain("section { page-break-before: always;");
  expect(css).toContain("body > section:first-of-type { page-break-before: avoid;");
  expect(css).not.toContain("h1:first-of-type");
});

it("adds no page rules to an EPUB, whose reader paginates", () => {
  const css = typesetCss(DEFAULT_TYPESET, false);
  expect(css).not.toContain("page-break-before: always");
});

it("puts a running head in the print stylesheet, on the right, not in the EPUB", () => {
  const print = typesetCss(DEFAULT_TYPESET, true);
  expect(print).toContain(".running-head");
  expect(print).toContain("position: fixed");
  // Set to the outer (right) edge of the page.
  expect(print).toMatch(/\.running-head[^}]*right:/);

  const epub = typesetCss(DEFAULT_TYPESET, false);
  expect(epub).not.toContain(".running-head");
});
