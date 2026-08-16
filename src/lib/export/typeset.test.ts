import { describe, expect, it } from "vitest";
import {
  DEFAULT_TYPESET,
  TEMPLATES,
  TRIMS,
  bookSetting,
  measureIn,
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
    const options = { ...DEFAULT_TYPESET, template: template.id };
    // The face belongs to both formats.
    expect(typesetCss(options, false)).toContain(template.stack);
    /* The *size* is asserted against the print stylesheet, because that is the
       only one entitled to state one — see the two tests below. */
    expect(typesetCss(options, true)).toContain(`${template.bodyPt}pt`);
    seen.add(`${template.stack}|${template.bodyPt}`);
  }
  // Three templates that produced the same CSS would be three names for one
  // thing.
  expect(seen.size).toBe(TEMPLATES.length);
});

/*
 * **A reflowable book does not state how big its type is, and this is a test
 * not to "fix".**
 *
 * A PDF has a real page, so a real measurement is the only honest thing to put
 * on it. An EPUB has no page: the *reader* chooses the size, on a control every
 * e-reader puts in its menu, and a stylesheet saying `font-size: 11pt` takes
 * that control away. It is an accessibility failure before it is a typographic
 * one, and both shops say so outright — Apple's asset guide, "font sizes should
 * be defined in em or %, not by point or pixel units… the main text of a book
 * should either not have a defined font-size or should have a font-size of
 * 1em"; KDP's reflowable text guidelines, "the body text… must be all defaults…
 * any styling on body text in the HTML will override the user's preferred
 * default reading settings".
 *
 * It also ends a second oddity for free: `bookSetting` takes its size from the
 * *trim*, which is a fact about a sheet of paper, so the same book shipped 10pt
 * as an EPUB at 5×8 and 11pt at A4. Hence walking every trim here — the answer
 * has to be the same on all of them.
 */
describe("what the EPUB's stylesheet may state", () => {
  it("names no absolute size, on any template or trim", () => {
    for (const template of TEMPLATES) {
      for (const trim of TRIMS) {
        const css = typesetCss(
          { ...DEFAULT_TYPESET, template: template.id, trim: trim.id },
          false,
        );
        const absolute = css.match(/font-size:[^;]*\b\d[\d.]*(pt|px)\b/g);
        expect(
          absolute,
          `${template.id} at ${trim.id} states an absolute size`,
        ).toBeNull();
      }
    }
  });

  it("sets the body at 100%, which is the reader's own size", () => {
    expect(typesetCss(DEFAULT_TYPESET, false)).toMatch(
      /body\s*\{[^}]*font-size:\s*100%/,
    );
  });

  /* The leading is a multiple rather than a measurement for the same reason,
     and Apple's guide asks for it by name: "set the value to a unit-less
     multiple of the font-size". A leading in points would not grow with the
     type when the reader turns it up, and the lines would collide. */
  it("leaves the leading unitless so it grows with the type", () => {
    expect(typesetCss(DEFAULT_TYPESET, false)).toMatch(
      /line-height:\s*[\d.]+\s*;/,
    );
  });

  /* The other half, so the guard above cannot be satisfied by breaking the PDF:
     a printed page still gets real points. */
  it("leaves the print stylesheet in points", () => {
    const css = typesetCss(DEFAULT_TYPESET, true);
    expect(css).toMatch(/body\s*\{[^}]*font-size:\s*[\d.]+pt/);
  });
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

/**
 * The running head and the folio live in `@page` margin boxes now, not in a
 * `position: fixed` element floated over the prose.
 *
 * That was the only way to repeat something per page without paged-media CSS,
 * and it is why this used to be a `.running-head` div: the browser does not
 * implement margin boxes, and Paged.js — which paginates the print export —
 * does. The head names the chapter rather than the book, which is what a
 * running head is for.
 */
it("prints the running head and folio from @page margin boxes", () => {
  const print = typesetCss(DEFAULT_TYPESET, true);
  expect(print).toContain("@top-center");
  expect(print).toContain("string(chaptertitle)");
  expect(print).toContain("@bottom-center");
  expect(print).toContain("counter(page)");
  // Fed from the heading, so it follows the manuscript.
  expect(print).toMatch(/string-set:\s*chaptertitle content\(text\)/);
  // The old float is gone.
  expect(print).not.toContain(".running-head");
});

/** None of the paged-media machinery reaches the EPUB, which has no pages. */
it("leaves page furniture out of the EPUB", () => {
  const epub = typesetCss(DEFAULT_TYPESET, false);
  expect(epub).not.toContain("@top-center");
  expect(epub).not.toContain("@bottom-center");
  expect(epub).not.toContain("target-counter");
  expect(epub).not.toContain("string-set");
  expect(epub).not.toContain(".running-head");
});

/**
 * The contents folio, which is the whole reason the print export is paginated
 * by Paged.js rather than by the browser.
 *
 * `target-counter` asks what page the anchor actually landed on. A number
 * arrived at any other way would be a guess, and a guessed folio sends a reader
 * to the wrong page — the invented-number rule in the one place a reader would
 * trust it most.
 */
it("takes the contents page numbers from the pages themselves", () => {
  const print = typesetCss(DEFAULT_TYPESET, true);
  expect(print).toMatch(/content:\s*target-counter\(attr\(href\), page\)/);
  expect(print).toContain(".toc-dots");
});

/*
 * **The stylesheet may not depend on somebody else's defaults**, and it did.
 *
 * Lists and code blocks were left entirely to the user agent, which is a bet on
 * the reading environment placed once and lost twice: Tailwind's preflight
 * resets `ol, ul { list-style: none }` and the export wizard's PDF review
 * renders inside the app, so a bulleted chapter previewed as bare sentences
 * while the PDF printed bullets — and an e-reader is under no obligation to
 * supply markers either. These are the tests not to "fix" by deleting: what
 * they assert is that the sheet states its own appearance.
 */
describe("what the stylesheet refuses to leave to the reader", () => {
  const css = typesetCss(DEFAULT_TYPESET, false);

  it("gives bulleted and numbered lists their markers", () => {
    expect(css).toMatch(/\bul\s*\{[^}]*list-style:\s*disc/);
    expect(css).toMatch(/\bol\s*\{[^}]*list-style:\s*decimal/);
  });

  it("gives a list room to hang its markers in", () => {
    expect(css).toMatch(/ul,\s*ol\s*\{[^}]*padding-left/);
  });

  it("keeps the body's first-line indent out of list items", () => {
    // `text-indent` inherits, so without this the first line of every item is
    // pushed away from its own bullet.
    expect(css).toMatch(/\bli\s*\{[^}]*text-indent:\s*0/);
  });

  it("sets code in a monospace face and wraps it", () => {
    // A book has no horizontal scrollbar, so a long line has to break.
    expect(css).toMatch(/pre\s*\{[^}]*white-space:\s*pre-wrap/);
    expect(css).toMatch(/monospace/);
  });

  it("still lets the contents page drop its markers", () => {
    // More specific, so it wins over the plain `ol` rule above.
    expect(css).toMatch(/\.contents ol\s*\{[^}]*list-style:\s*none/);
  });

  it("states them for the EPUB as well as the PDF", () => {
    // The EPUB is where a foreign default sheet is most likely to differ.
    expect(typesetCss(DEFAULT_TYPESET, true)).toMatch(/list-style:\s*disc/);
  });
});

/*
 * **Scoping is what keeps the wizard's PDF review from restyling the app**, and
 * the two exceptions are what keep the review working. Paged.js lays pages out
 * against the styles in the document the script is running in, so the preview
 * has to inject this sheet into the app — and this sheet styles bare `body`,
 * `h1` and `p`, because it is written for a document that is nothing but a
 * book. These are the tests not to "fix" by scoping the last two rules as well.
 */
describe("confining the book's styles to the book", () => {
  const scoped = typesetCss(DEFAULT_TYPESET, true, ".oc-review-pages");

  it("leaves both real exports exactly as they were", () => {
    // The EPUB and the print path pass no scope, and their bytes are the ones
    // EPUBCheck has passed. Nothing about this feature may reach them.
    expect(typesetCss(DEFAULT_TYPESET, false, "")).toBe(
      typesetCss(DEFAULT_TYPESET, false),
    );
    expect(typesetCss(DEFAULT_TYPESET, true, "")).toBe(
      typesetCss(DEFAULT_TYPESET, true),
    );
  });

  it("puts the book's inherited typography on the host, not on the document", () => {
    // Scoped, `body` would style the app; `.oc-review-pages body` would match
    // nothing at all and the pages would lose their face entirely.
    expect(scoped).toMatch(/\.oc-review-pages \{[^}]*font-family/);
    expect(scoped).not.toMatch(/^body \{/m);
  });

  it("scopes every bare element rule that could match the app", () => {
    /* The exceptions, both deliberate and both tested below: Paged.js reads
       these two rather than applying them, and neither has any effect on
       screen. Every other bare element selector is a leak. */
    const global = [
      /^h1 \{ string-set/,
      /^section \{ page-break/,
      /^body > section/,
      // `page:` names the page so Paged.js can mark the one that *starts* a
      // section — which is how the running head is kept off a chapter opening.
      // Read, not applied, like the two above, and invisible on screen.
      /^section \{ page: chapter/,
    ];
    const bare = scoped
      .split("\n")
      .filter((line) =>
        /^(body|h1|h2|p|blockquote|ul|ol|li|pre|code|section|div|span)[ ,{[]/.test(
          line,
        ),
      )
      .filter((line) => !global.some((allowed) => allowed.test(line)));

    expect(bare).toEqual([]);
  });

  it("leaves string-set global, because Paged.js reads it", () => {
    // It is matched against Paged.js's own source document, which the host
    // element does not contain — scoped, the running heads stop appearing. It
    // has no effect on screen, so global costs the app nothing.
    expect(scoped).toMatch(/^h1 \{ string-set: chaptertitle/m);
  });

  it("leaves the page breaks global, for the same reason", () => {
    // Scoped, every chapter goes back onto one sheet and the book opens on a
    // blank page. A page-break has no effect on screen either.
    expect(scoped).toMatch(/^section \{ page-break-before: always/m);
    expect(scoped).toMatch(/^body > section:first-of-type/m);
  });

  it("keeps the folio's target-counter reachable", () => {
    // The contents entries are named by our own class, so they cannot leak —
    // and this is the rule the PDF's real page numbers come out of.
    expect(scoped).toMatch(/\.contents a::after \{[^}]*target-counter/);
  });
});

/*
 * **The chapter opening page must not print the chapter title twice.** The
 * running head is set from `string-set` on the h1, so on the very page that h1
 * appears it repeated the words directly above themselves — measured on a real
 * export: CHAPTER ONE as a running head over CHAPTER ONE as the title. The
 * folio deliberately stays: a drop folio on a chapter opening is what a printed
 * book does, and it is the number the contents page points at.
 */
describe("the chapter opener", () => {
  const css = typesetCss(DEFAULT_TYPESET, true);

  it("names the page so Paged.js can tell an opening from a continuation", () => {
    expect(css).toMatch(/^section \{ page: chapter; \}/m);
  });

  it("drops the running head on a chapter's first page", () => {
    expect(css).toMatch(
      /@page chapter:first \{ @top-center \{ content: none; \} \}/,
    );
  });

  it("keeps the folio there", () => {
    // Only the head is silenced — the bottom-center box is untouched, unlike
    // the title page's rule which silences both.
    expect(css).not.toMatch(/@page chapter:first \{[^}]*@bottom-center/);
    expect(css).toMatch(/@page :first \{ @top-center[^\n]*@bottom-center/);
  });

  it("says none of it to the EPUB, which has no pages", () => {
    const epub = typesetCss(DEFAULT_TYPESET, false);

    expect(epub).not.toMatch(/page: chapter/);
    expect(epub).not.toMatch(/@page/);
  });
});

/*
 * **The type follows the page, and these are the tests that keep it there.**
 *
 * Every template used to carry one fixed size while the margins were a flat 14%
 * of the width, so the measure — the length of a line — was whatever fell out:
 * 48 characters on a 5×8 and 84 on A4, against a target of 66. Only one trim in
 * six was readable. The band asserted below is the typographic one (45–75,
 * ideal 66), and the character width behind it is a measurement of the app's
 * own font stack rather than a rule of thumb — see `measureIn`.
 *
 * A row of `TRIM_SETTING` that drifts out of the band fails here rather than in
 * somebody's paperback.
 */
describe("setting the type to the page", () => {
  const classic = templateById("classic");

  it("lands every trim inside a readable measure", () => {
    for (const trim of TRIMS) {
      const measure = measureIn(bookSetting(classic, trim), trim);

      expect(measure).toBeGreaterThanOrEqual(45);
      expect(measure).toBeLessThanOrEqual(75);
    }
  });

  it("puts the commonest trim on the ideal measure", () => {
    const sixByNine = trimById("6x9");

    expect(measureIn(bookSetting(classic, sixByNine), sixByNine)).toBe(66);
  });

  it("uses smaller type on a smaller page, as a printed book does", () => {
    // The old behaviour was one size everywhere, which is what made a 5×8 run
    // at 48 characters — and a short line means more lines, more pages, and a
    // paperback priced by the page.
    const small = bookSetting(classic, trimById("5x8")).sizePt;
    const large = bookSetting(classic, trimById("6x9")).sizePt;

    expect(small).toBeLessThan(large);
  });

  it("keeps the margins inside the page they sit on", () => {
    for (const trim of TRIMS) {
      const { side, ends } = bookSetting(classic, trim);

      expect(side * 2).toBeLessThan(trim.width * 0.6);
      expect(ends * 2).toBeLessThan(trim.height * 0.4);
    }
  });

  it("sets the leading in the range print uses, not the screen's", () => {
    // 120–140% of the size. 1.5 was a web value doing double duty as
    // compensation for a line that ran too long.
    for (const template of TEMPLATES) {
      if (template.id === "manuscript") continue;

      expect(template.leading).toBeGreaterThanOrEqual(1.2);
      expect(template.leading).toBeLessThanOrEqual(1.45);
    }
  });
});

/*
 * **Standard manuscript format is a specification, not a design.** An agent
 * asks for 12pt double-spaced on one-inch margins; resizing it to suit a 5×8
 * page would break the one thing the template exists to do, and the writer
 * would find out from the agent. This is a test not to "fix" by making it
 * consistent with the two above.
 */
describe("the manuscript template", () => {
  it("keeps its specification whatever page it is put on", () => {
    const manuscript = templateById("manuscript");

    for (const trim of TRIMS) {
      expect(bookSetting(manuscript, trim)).toEqual({
        sizePt: 12,
        leading: 2,
        side: 1,
        ends: 1,
      });
    }
  });
});

it("defaults to a trim a book is actually printed at", () => {
  /* A4 was the default because the browser's *print dialog* would otherwise
     centre a small page on a big sheet. The PDF is rendered server-side at an
     exact page size now, so that reason is spent — and office paper is not a
     shape any published book takes. */
  const trim = trimById(DEFAULT_TYPESET.trim);

  expect(trim.id).toBe("6x9");
  expect(["letter", "a4"]).not.toContain(trim.id);
});
