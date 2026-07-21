# Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a writer export one chapter or a whole book to Markdown, DOCX or EPUB, entirely in the browser.

**Architecture:** One walk over the Tiptap document produces a format-neutral block list; three renderers consume it. Markdown and XHTML are pure string functions; DOCX maps blocks onto the `docx` object model; EPUB zips XHTML with JSZip. `docx` and `jszip` are dynamically imported so the editor bundle is unaffected. Design rationale lives in `docs/plans/2026-07-21-export-design.md`.

**Tech Stack:** Next.js 16.2.10, React 19, Tailwind CSS v4, Tiptap 3, Vitest + jsdom, `docx` 9.7.1, `jszip` 3.10.1.

**Scope note:** Tasks 1–5 deliver working Markdown export on their own. That is a sensible stopping point if the later formats need to wait — the app is strictly more useful at task 5 than at task 0.

**Plan location note:** this skill defaults to `docs/superpowers/plans/`; this project keeps plans in `docs/plans/`, matching the three already committed there.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `src/lib/export/blocks.ts` | The single document walk: `JSONContent → Block[]`. Format-neutral. |
| `src/lib/export/blocks.test.ts` | The walk under test — marks, nesting, escaping-sensitive content. |
| `src/lib/export/markdown.ts` | `Block[] → Markdown string`. |
| `src/lib/export/markdown.test.ts` | Markdown rendering and escaping. |
| `src/lib/export/xhtml.ts` | `Block[] → XHTML string`, including list grouping. |
| `src/lib/export/xhtml.test.ts` | XHTML rendering and entity escaping. |
| `src/lib/export/epub.ts` | EPUB 3 container. Pure string builders plus the zip step. |
| `src/lib/export/epub.test.ts` | `container.xml`, `content.opf`, `nav.xhtml`, chapter XHTML as strings. |
| `src/lib/export/docx.ts` | `Block[] → docx Paragraphs`, plus manuscript formatting. |
| `src/lib/export/index.ts` | Orchestration: load chapters, pick a builder, name the file, download. |
| `src/lib/export/index.test.ts` | Slugify and chapter loading. |
| `src/components/export/export-dialog.tsx` | Format and scope choice, author field. |

**Modified**

| File | Change |
| --- | --- |
| `src/lib/library-store.ts` | `author` on `Book`; `setBookAuthor`. |
| `src/lib/library-store.test.ts` | Tests for the above. |
| `src/components/shelf/bookshelf.tsx` | Per-book Export action. |
| `src/components/editor/chapter-editor.tsx` | Export action for the open chapter. |
| `package.json` | `docx`, `jszip`. |

---

## Task 1: Dependencies

`docx` and `jszip` were installed while confirming their APIs, so the working tree already has them. This task just records that in a commit of its own rather than letting it ride along with unrelated code.

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Confirm both are present at the expected versions**

Run:

```bash
node -e "console.log(require('./node_modules/docx/package.json').version, require('./node_modules/jszip/package.json').version)"
```

Expected: `9.7.1 3.10.1`. If either is missing, run `npm install docx jszip`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add docx and jszip for export"
```

---

## Task 2: An author on the book

Standard manuscript format needs a name, and EPUB's OPF needs a `dc:creator`. Optional — an export with no author omits the byline rather than blocking.

**Files:**
- Modify: `src/lib/library-store.ts`
- Modify: `src/lib/library-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/library-store.test.ts`, adding `setBookAuthor` to the import list at the top of the file:

```ts
it("starts a book with no author", () => {
  const { bookId } = createBook("The Salt Road");
  expect(findBook(getShelf(), bookId)!.author).toBeUndefined();
});

it("sets and updates a book's author", () => {
  const { bookId } = createBook("The Salt Road");

  setBookAuthor(bookId, "M. Reyes");
  expect(findBook(getShelf(), bookId)!.author).toBe("M. Reyes");

  setBookAuthor(bookId, "Mira Reyes");
  expect(findBook(getShelf(), bookId)!.author).toBe("Mira Reyes");
});

it("keeps the author separate per book", () => {
  const a = createBook("A");
  const b = createBook("B");

  setBookAuthor(a.bookId, "One Author");

  expect(findBook(getShelf(), a.bookId)!.author).toBe("One Author");
  expect(findBook(getShelf(), b.bookId)!.author).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: FAIL — `setBookAuthor` is not exported.

- [ ] **Step 3: Add the field**

In `src/lib/library-store.ts`, add to the `Book` interface, after `title`:

```ts
  /** Optional. Used for the DOCX byline and EPUB's dc:creator. */
  author?: string;
```

- [ ] **Step 4: Add the setter**

Append to `src/lib/library-store.ts`:

```ts
export function setBookAuthor(bookId: string, author: string) {
  commitBook(bookId, (book) => ({ ...book, author }));
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: PASS, 33 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/library-store.ts src/lib/library-store.test.ts
git commit -m "Give a book an optional author"
```

---

## Task 3: The document walk

One walk, three formats. A flat block list with a `depth` for list nesting, rather than a tree — novels are paragraphs and the occasional list, and a flat list is far easier to render correctly in three places.

**Files:**
- Create: `src/lib/export/blocks.ts`
- Create: `src/lib/export/blocks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/export/blocks.test.ts`:

```ts
import { expect, it } from "vitest";
import { toBlocks } from "@/lib/export/blocks";
import type { JSONContent } from "@tiptap/react";

const doc = (...content: JSONContent[]): JSONContent => ({
  type: "doc",
  content,
});
const para = (...content: JSONContent[]): JSONContent => ({
  type: "paragraph",
  content,
});
const text = (t: string, marks?: JSONContent["marks"]): JSONContent => ({
  type: "text",
  text: t,
  ...(marks ? { marks } : {}),
});

it("reads a plain paragraph", () => {
  expect(toBlocks(doc(para(text("The salt road ran west."))))).toEqual([
    { kind: "paragraph", depth: 0, runs: [{ text: "The salt road ran west." }] },
  ]);
});

it("reads headings with their level", () => {
  const blocks = toBlocks(
    doc({ type: "heading", attrs: { level: 2 }, content: [text("Chapter Two")] }),
  );
  expect(blocks).toEqual([
    { kind: "heading", depth: 0, level: 2, runs: [{ text: "Chapter Two" }] },
  ]);
});

it("carries marks onto runs", () => {
  const blocks = toBlocks(
    doc(
      para(
        text("She was "),
        text("late", [{ type: "italic" }]),
        text(" and "),
        text("angry", [{ type: "bold" }]),
      ),
    ),
  );
  expect(blocks[0].runs).toEqual([
    { text: "She was " },
    { text: "late", italic: true },
    { text: " and " },
    { text: "angry", bold: true },
  ]);
});

it("combines nested marks on one run", () => {
  const blocks = toBlocks(
    doc(para(text("both", [{ type: "bold" }, { type: "italic" }]))),
  );
  expect(blocks[0].runs).toEqual([{ text: "both", bold: true, italic: true }]);
});

it("carries a link href, including a link inside bold", () => {
  const blocks = toBlocks(
    doc(
      para(
        text("see it", [
          { type: "bold" },
          { type: "link", attrs: { href: "https://example.com" } },
        ]),
      ),
    ),
  );
  expect(blocks[0].runs).toEqual([
    { text: "see it", bold: true, href: "https://example.com" },
  ]);
});

it("turns a horizontal rule into a scene break", () => {
  expect(toBlocks(doc({ type: "horizontalRule" }))).toEqual([
    { kind: "sceneBreak", depth: 0, runs: [] },
  ]);
});

it("keeps an empty paragraph as an empty block", () => {
  expect(toBlocks(doc(para()))).toEqual([
    { kind: "paragraph", depth: 0, runs: [] },
  ]);
});

it("reads a blockquote", () => {
  const blocks = toBlocks(
    doc({ type: "blockquote", content: [para(text("She had not meant to."))] }),
  );
  expect(blocks).toEqual([
    { kind: "quote", depth: 0, runs: [{ text: "She had not meant to." }] },
  ]);
});

it("flattens a bullet list, one block per item", () => {
  const blocks = toBlocks(
    doc({
      type: "bulletList",
      content: [
        { type: "listItem", content: [para(text("salt"))] },
        { type: "listItem", content: [para(text("rope"))] },
      ],
    }),
  );
  expect(blocks).toEqual([
    { kind: "bullet", depth: 0, runs: [{ text: "salt" }] },
    { kind: "bullet", depth: 0, runs: [{ text: "rope" }] },
  ]);
});

it("records depth for a nested list", () => {
  const blocks = toBlocks(
    doc({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            para(text("supplies")),
            {
              type: "bulletList",
              content: [{ type: "listItem", content: [para(text("salt"))] }],
            },
          ],
        },
      ],
    }),
  );
  expect(blocks).toEqual([
    { kind: "bullet", depth: 0, runs: [{ text: "supplies" }] },
    { kind: "bullet", depth: 1, runs: [{ text: "salt" }] },
  ]);
});

it("numbers an ordered list", () => {
  const blocks = toBlocks(
    doc({
      type: "orderedList",
      content: [
        { type: "listItem", content: [para(text("first"))] },
        { type: "listItem", content: [para(text("second"))] },
      ],
    }),
  );
  expect(blocks).toEqual([
    { kind: "ordered", depth: 0, runs: [{ text: "first" }] },
    { kind: "ordered", depth: 0, runs: [{ text: "second" }] },
  ]);
});

it("reads a code block with its language", () => {
  const blocks = toBlocks(
    doc({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [text("const x = 1;")],
    }),
  );
  expect(blocks).toEqual([
    {
      kind: "code",
      depth: 0,
      language: "ts",
      runs: [{ text: "const x = 1;" }],
    },
  ]);
});

it("turns a hard break into a newline run", () => {
  const blocks = toBlocks(
    doc(para(text("one"), { type: "hardBreak" }, text("two"))),
  );
  expect(blocks[0].runs).toEqual([
    { text: "one" },
    { text: "\n", hardBreak: true },
    { text: "two" },
  ]);
});

it("returns nothing for an empty document", () => {
  expect(toBlocks({ type: "doc" })).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/export/blocks.test.ts`
Expected: FAIL — cannot resolve `@/lib/export/blocks`.

- [ ] **Step 3: Implement**

Create `src/lib/export/blocks.ts`:

```ts
import type { JSONContent } from "@tiptap/react";

/**
 * A format-neutral view of a Tiptap document.
 *
 * Every export format is the same walk over the same nodes, so the walk happens
 * once and three renderers consume the result. That keeps the tricky part —
 * marks, nesting, hard breaks — in one tested place instead of three.
 *
 * The list is flat, with `depth` recording list nesting, rather than a tree.
 * Novels are paragraphs and the occasional list; a flat list is far easier to
 * render correctly in three formats than a recursive structure is.
 */

export type BlockKind =
  | "paragraph"
  | "heading"
  | "quote"
  | "bullet"
  | "ordered"
  | "code"
  | "sceneBreak";

export interface Run {
  text: string;
  bold?: true;
  italic?: true;
  strike?: true;
  code?: true;
  underline?: true;
  /** Set on a run produced by a hardBreak, whose text is a bare newline. */
  hardBreak?: true;
  href?: string;
}

export interface Block {
  kind: BlockKind;
  /** List nesting, 0 for everything else. */
  depth: number;
  /** Heading level 1-3. Only set on headings. */
  level?: number;
  /** Only set on code blocks, when the editor recorded one. */
  language?: string;
  runs: Run[];
}

const MARK_FLAGS: Record<string, keyof Run> = {
  bold: "bold",
  italic: "italic",
  strike: "strike",
  code: "code",
  underline: "underline",
};

function runsFrom(content: JSONContent[] | undefined): Run[] {
  const runs: Run[] = [];

  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      runs.push({ text: "\n", hardBreak: true });
      continue;
    }
    if (node.type !== "text" || !node.text) continue;

    const run: Run = { text: node.text };
    for (const mark of node.marks ?? []) {
      const flag = MARK_FLAGS[mark.type];
      if (flag) {
        // Every flag but href is a literal true, which is what Run declares.
        (run as Record<string, unknown>)[flag] = true;
      } else if (mark.type === "link" && typeof mark.attrs?.href === "string") {
        run.href = mark.attrs.href;
      }
    }
    runs.push(run);
  }

  return runs;
}

function walk(nodes: JSONContent[], depth: number, out: Block[]) {
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        out.push({ kind: "paragraph", depth, runs: runsFrom(node.content) });
        break;

      case "heading":
        out.push({
          kind: "heading",
          depth,
          level: Number(node.attrs?.level ?? 1),
          runs: runsFrom(node.content),
        });
        break;

      case "blockquote":
        // A quote's paragraphs become quote blocks; the quoting is the block
        // kind, not a nesting level.
        for (const child of node.content ?? []) {
          out.push({ kind: "quote", depth, runs: runsFrom(child.content) });
        }
        break;

      case "bulletList":
      case "orderedList": {
        const kind = node.type === "bulletList" ? "bullet" : "ordered";
        for (const item of node.content ?? []) {
          let first = true;
          for (const child of item.content ?? []) {
            if (child.type === "bulletList" || child.type === "orderedList") {
              walk([child], depth + 1, out);
            } else if (first) {
              out.push({ kind, depth, runs: runsFrom(child.content) });
              first = false;
            } else {
              // A second paragraph inside one list item: keep the text rather
              // than drop it, as a continuation at the same depth.
              out.push({ kind, depth, runs: runsFrom(child.content) });
            }
          }
        }
        break;
      }

      case "codeBlock": {
        const language = node.attrs?.language;
        out.push({
          kind: "code",
          depth,
          ...(typeof language === "string" && language ? { language } : {}),
          runs: runsFrom(node.content),
        });
        break;
      }

      case "horizontalRule":
        // Rendered as a scene break rather than a rule, matching how the editor
        // styles it and how a printed book sets one.
        out.push({ kind: "sceneBreak", depth, runs: [] });
        break;

      default:
        // Unknown node: descend rather than drop, so its text still survives.
        if (node.content) walk(node.content, depth, out);
    }
  }
}

export function toBlocks(doc: JSONContent): Block[] {
  const out: Block[] = [];
  walk(doc.content ?? [], 0, out);
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/export/blocks.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/blocks.ts src/lib/export/blocks.test.ts
git commit -m "Add the document walk every export format shares"
```

---

## Task 4: Markdown

**Files:**
- Create: `src/lib/export/markdown.ts`
- Create: `src/lib/export/markdown.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/export/markdown.test.ts`:

```ts
import { expect, it } from "vitest";
import { blocksToMarkdown } from "@/lib/export/markdown";
import type { Block } from "@/lib/export/blocks";

const p = (...runs: Block["runs"]): Block => ({
  kind: "paragraph",
  depth: 0,
  runs,
});

it("renders paragraphs separated by a blank line", () => {
  expect(blocksToMarkdown([p({ text: "One." }), p({ text: "Two." })])).toBe(
    "One.\n\nTwo.",
  );
});

it("renders headings at their level", () => {
  expect(
    blocksToMarkdown([
      { kind: "heading", depth: 0, level: 2, runs: [{ text: "Chapter Two" }] },
    ]),
  ).toBe("## Chapter Two");
});

it("renders emphasis", () => {
  expect(
    blocksToMarkdown([
      p(
        { text: "a", bold: true },
        { text: "b", italic: true },
        { text: "c", strike: true },
        { text: "d", code: true },
      ),
    ]),
  ).toBe("**a**_b_~~c~~`d`");
});

it("renders a link, and a link inside bold", () => {
  expect(
    blocksToMarkdown([
      p({ text: "here", href: "https://example.com" }),
      p({ text: "here", bold: true, href: "https://example.com" }),
    ]),
  ).toBe("[here](https://example.com)\n\n**[here](https://example.com)**");
});

it("escapes markdown punctuation in prose", () => {
  // A novelist writing *emphasis* by hand, or a filename with underscores,
  // must not silently become formatting.
  expect(blocksToMarkdown([p({ text: "a*b_c[d]e" })])).toBe(
    "a\\*b\\_c\\[d\\]e",
  );
});

it("does not escape inside code", () => {
  expect(blocksToMarkdown([p({ text: "a*b", code: true })])).toBe("`a*b`");
});

it("renders a scene break as centred asterisks", () => {
  expect(blocksToMarkdown([{ kind: "sceneBreak", depth: 0, runs: [] }])).toBe(
    "* * *",
  );
});

it("renders a blockquote", () => {
  expect(
    blocksToMarkdown([
      { kind: "quote", depth: 0, runs: [{ text: "She had not meant to." }] },
    ]),
  ).toBe("> She had not meant to.");
});

it("renders lists, indenting by depth", () => {
  expect(
    blocksToMarkdown([
      { kind: "bullet", depth: 0, runs: [{ text: "supplies" }] },
      { kind: "bullet", depth: 1, runs: [{ text: "salt" }] },
      { kind: "ordered", depth: 0, runs: [{ text: "first" }] },
      { kind: "ordered", depth: 0, runs: [{ text: "second" }] },
    ]),
  ).toBe("- supplies\n  - salt\n\n1. first\n2. second");
});

it("renders a fenced code block with its language", () => {
  expect(
    blocksToMarkdown([
      {
        kind: "code",
        depth: 0,
        language: "ts",
        runs: [{ text: "const x = 1;" }],
      },
    ]),
  ).toBe("```ts\nconst x = 1;\n```");
});

it("renders a hard break as a trailing double space", () => {
  expect(
    blocksToMarkdown([
      p({ text: "one" }, { text: "\n", hardBreak: true }, { text: "two" }),
    ]),
  ).toBe("one  \ntwo");
});

it("renders an empty paragraph as nothing", () => {
  expect(blocksToMarkdown([p(), p({ text: "after" })])).toBe("after");
});

it("returns an empty string for no blocks", () => {
  expect(blocksToMarkdown([])).toBe("");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/export/markdown.test.ts`
Expected: FAIL — cannot resolve `@/lib/export/markdown`.

- [ ] **Step 3: Implement**

Create `src/lib/export/markdown.ts`:

```ts
import type { Block, Run } from "./blocks";

/**
 * Characters that would otherwise be read as formatting. Escaped in prose but
 * never inside code, where they are just characters.
 */
const ESCAPE = /([\\`*_[\]])/g;

function renderRun(run: Run): string {
  if (run.hardBreak) {
    // Two trailing spaces is Markdown's line break.
    return "  \n";
  }

  if (run.code) {
    // Code is exclusive: no emphasis inside it, and no escaping.
    const code = `\`${run.text}\``;
    return run.href ? `[${code}](${run.href})` : code;
  }

  let out = run.text.replace(ESCAPE, "\\$1");

  if (run.href) out = `[${out}](${run.href})`;
  // Innermost first, so bold wraps italic wraps the text.
  if (run.strike) out = `~~${out}~~`;
  if (run.italic) out = `_${out}_`;
  if (run.bold) out = `**${out}**`;
  // Markdown has no underline; inline HTML is the honest rendering.
  if (run.underline) out = `<u>${out}</u>`;

  return out;
}

const renderRuns = (runs: Run[]) => runs.map(renderRun).join("");

export function blocksToMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  // Ordered-list counters, one per depth, reset when a run of list items ends.
  let counters: number[] = [];

  for (const block of blocks) {
    const isList = block.kind === "bullet" || block.kind === "ordered";
    if (!isList) counters = [];

    const text = renderRuns(block.runs);
    const indent = "  ".repeat(block.depth);

    switch (block.kind) {
      case "heading":
        out.push(`${"#".repeat(block.level ?? 1)} ${text}`);
        break;

      case "quote":
        out.push(`> ${text}`);
        break;

      case "sceneBreak":
        out.push("* * *");
        break;

      case "code":
        out.push(`\`\`\`${block.language ?? ""}\n${text}\n\`\`\``);
        break;

      case "bullet":
        out.push(`${indent}- ${text}`);
        break;

      case "ordered":
        counters[block.depth] = (counters[block.depth] ?? 0) + 1;
        counters.length = block.depth + 1;
        out.push(`${indent}${counters[block.depth]}. ${text}`);
        break;

      default:
        // Empty paragraphs carry no information in Markdown; the blank line
        // between blocks already separates them.
        if (text) out.push(text);
    }
  }

  return joinBlocks(blocks, out);
}

/**
 * List items sit on consecutive lines; everything else is separated by a blank
 * line. Done as a second pass because it depends on both neighbours.
 */
function joinBlocks(blocks: Block[], rendered: string[]): string {
  // rendered can be shorter than blocks, since empty paragraphs are dropped.
  const kept = blocks.filter(
    (b) => !(b.kind === "paragraph" && b.runs.every((r) => !r.text)),
  );

  let out = "";
  for (let i = 0; i < rendered.length; i++) {
    if (i > 0) {
      const prev = kept[i - 1];
      const here = kept[i];
      const bothList =
        (prev?.kind === "bullet" || prev?.kind === "ordered") &&
        (here?.kind === "bullet" || here?.kind === "ordered") &&
        prev.kind === here.kind;
      out += bothList ? "\n" : "\n\n";
    }
    out += rendered[i];
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/export/markdown.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/markdown.ts src/lib/export/markdown.test.ts
git commit -m "Render blocks as Markdown"
```

---

## Task 5: Orchestration, download, and the dialog

At the end of this task Markdown export works end to end from both the shelf and the editor.

**Files:**
- Create: `src/lib/export/index.ts`
- Create: `src/lib/export/index.test.ts`
- Create: `src/components/export/export-dialog.tsx`
- Modify: `src/components/shelf/bookshelf.tsx`
- Modify: `src/components/editor/chapter-editor.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/export/index.test.ts`:

```ts
import { beforeEach, expect, it } from "vitest";
import { createBook, createChapter, saveBody, findBook, getShelf } from "@/lib/library-store";
import { loadChapters, slugify, buildMarkdownFile } from "@/lib/export";

beforeEach(() => {
  localStorage.clear();
});

it("slugifies a book title for a filename", () => {
  expect(slugify("The Salt Road")).toBe("the-salt-road");
  expect(slugify("  Mixed  CASE  ")).toBe("mixed-case");
  expect(slugify("A Book: Part Two!")).toBe("a-book-part-two");
  expect(slugify("—")).toBe("untitled");
});

it("loads every chapter of a book in order", () => {
  const { bookId, chapterId } = createBook("The Salt Road");
  const second = createChapter(bookId, "Chapter Two");
  saveBody(bookId, chapterId, { type: "doc" }, 0);
  saveBody(bookId, second, { type: "doc" }, 0);

  const book = findBook(getShelf(), bookId)!;
  expect(loadChapters(book).map((c) => c.title)).toEqual([
    "Chapter One",
    "Chapter Two",
  ]);
});

it("loads a single chapter when one is named", () => {
  const { bookId } = createBook("The Salt Road");
  const second = createChapter(bookId, "Chapter Two");

  const book = findBook(getShelf(), bookId)!;
  expect(loadChapters(book, second).map((c) => c.title)).toEqual([
    "Chapter Two",
  ]);
});

it("treats a never-saved chapter as empty rather than failing", () => {
  const { bookId } = createBook("The Salt Road");
  const book = findBook(getShelf(), bookId)!;

  const [chapter] = loadChapters(book);
  expect(chapter.doc.content ?? []).toEqual([]);
});

it("survives a corrupt body", () => {
  const { bookId, chapterId } = createBook("The Salt Road");
  localStorage.setItem(`openchapter:chapter:${chapterId}`, "{ not json");

  const book = findBook(getShelf(), bookId)!;
  expect(loadChapters(book)[0].doc.content ?? []).toEqual([]);
});

it("compiles a whole book with a title and chapter headings", () => {
  const { bookId, chapterId } = createBook("The Salt Road");
  saveBody(
    bookId,
    chapterId,
    {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "It began." }] },
      ],
    },
    2,
  );

  const book = findBook(getShelf(), bookId)!;
  expect(buildMarkdownFile(book, loadChapters(book))).toBe(
    "# The Salt Road\n\n## Chapter One\n\nIt began.",
  );
});

it("omits the book title when exporting a single chapter", () => {
  const { bookId, chapterId } = createBook("The Salt Road");
  saveBody(
    bookId,
    chapterId,
    {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "It began." }] },
      ],
    },
    2,
  );

  const book = findBook(getShelf(), bookId)!;
  const chapters = loadChapters(book, chapterId);
  expect(buildMarkdownFile(book, chapters, { single: true })).toBe(
    "# Chapter One\n\nIt began.",
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/export/index.test.ts`
Expected: FAIL — cannot resolve `@/lib/export`.

- [ ] **Step 3: Implement**

Create `src/lib/export/index.ts`:

```ts
import type { JSONContent } from "@tiptap/react";
import { getBody, type Book } from "@/lib/library-store";
import { toBlocks } from "./blocks";
import { blocksToMarkdown } from "./markdown";

export type Format = "markdown" | "docx" | "epub";

export interface LoadedChapter {
  title: string;
  doc: JSONContent;
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [] };

/**
 * Reads through library-store rather than localStorage directly, so the rule
 * that one module owns storage survives this feature.
 */
export function loadChapters(book: Book, chapterId?: string): LoadedChapter[] {
  const wanted = chapterId
    ? book.chapters.filter((c) => c.id === chapterId)
    : book.chapters;

  return wanted.map((chapter) => {
    const raw = getBody(chapter.id);
    let doc = EMPTY_DOC;
    if (raw) {
      try {
        doc = JSON.parse(raw) as JSONContent;
      } catch {
        // A corrupt body exports as an empty chapter. Losing one chapter's
        // text beats failing the whole export.
        doc = EMPTY_DOC;
      }
    }
    return { title: chapter.title, doc };
  });
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

export function buildMarkdownFile(
  book: Book,
  chapters: LoadedChapter[],
  { single = false }: { single?: boolean } = {},
): string {
  const parts: string[] = [];

  // A single chapter is its own document; a book needs its title on top.
  if (!single) parts.push(`# ${book.title}`);

  for (const chapter of chapters) {
    parts.push(`${single ? "#" : "##"} ${chapter.title}`);
    const body = blocksToMarkdown(toBlocks(chapter.doc));
    if (body) parts.push(body);
  }

  return parts.join("\n\n");
}

/** Hands a generated file to the browser. */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoking immediately can cancel the download in some browsers; a tick is
  // enough for the click to have been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface ExportRequest {
  book: Book;
  /** Omitted means the whole book. */
  chapterId?: string;
  format: Format;
  /** DOCX only. Standard manuscript layout rather than a clean document. */
  manuscript: boolean;
}

export async function runExport({
  book,
  chapterId,
  format,
  manuscript,
}: ExportRequest): Promise<void> {
  const chapters = loadChapters(book, chapterId);
  const single = Boolean(chapterId);
  const base = single
    ? `${slugify(book.title)}-${slugify(chapters[0]?.title ?? "chapter")}`
    : slugify(book.title);

  if (format === "markdown") {
    const text = buildMarkdownFile(book, chapters, { single });
    download(new Blob([text], { type: "text/markdown" }), `${base}.md`);
    return;
  }

  if (format === "docx") {
    // Dynamic import: ~1MB of library that a writer who never exports should
    // never download.
    const { buildDocx } = await import("./docx");
    download(await buildDocx(book, chapters, { manuscript }), `${base}.docx`);
    return;
  }

  const { buildEpub } = await import("./epub");
  download(await buildEpub(book, chapters), `${base}.epub`);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/export/index.test.ts`
Expected: PASS, 7 tests. The `docx` and `epub` imports are not reached by these tests, so the files not existing yet does not matter.

- [ ] **Step 5: Create the dialog**

Create `src/components/export/export-dialog.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { setBookAuthor, type Book } from "@/lib/library-store";
import { runExport, type Format } from "@/lib/export";

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "markdown", label: "Markdown", hint: "Plain text, reads anywhere" },
  { value: "docx", label: "Word (.docx)", hint: "What agents ask for" },
  { value: "epub", label: "EPUB", hint: "Whole book, for e-readers" },
];

export function ExportDialog({
  book,
  chapterId,
  onClose,
}: {
  book: Book;
  /** When set, the writer may choose this chapter or the whole book. */
  chapterId?: string;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<Format>("markdown");
  const [wholeBook, setWholeBook] = useState(!chapterId);
  const [manuscript, setManuscript] = useState(true);
  const [author, setAuthor] = useState(book.author ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // EPUB is whole-book only: a one-chapter e-book is not a thing anyone wants.
  const scope = format === "epub" ? true : wholeBook;

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      if (author.trim() && author.trim() !== book.author) {
        setBookAuthor(book.id, author.trim());
      }
      await runExport({
        book: { ...book, author: author.trim() || undefined },
        chapterId: scope ? undefined : chapterId,
        format,
        manuscript,
      });
      onClose();
    } catch (err) {
      console.error("[export] failed", err);
      setError("Something went wrong building the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop closes; clicking the panel must not.
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[26rem] max-w-[calc(100vw-2rem)] rounded-sm bg-offcream
                 p-0 text-ink backdrop:bg-ink/30"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">Export “{book.title}”</h2>

        <fieldset className="mt-6">
          <legend className="font-sans text-xs tracking-[0.18em] text-warmgray uppercase">
            Format
          </legend>
          <div className="mt-3 flex flex-col gap-2">
            {FORMATS.map((f) => (
              <label
                key={f.value}
                className="flex cursor-pointer items-baseline gap-3 font-sans text-sm"
              >
                <input
                  type="radio"
                  name="format"
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                  className="accent-burgundy"
                />
                <span>{f.label}</span>
                <span className="text-xs text-warmgray">{f.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {chapterId && format !== "epub" && (
          <fieldset className="mt-6">
            <legend className="font-sans text-xs tracking-[0.18em] text-warmgray uppercase">
              What
            </legend>
            <div className="mt-3 flex gap-6 font-sans text-sm">
              <label className="flex cursor-pointer items-baseline gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={!wholeBook}
                  onChange={() => setWholeBook(false)}
                  className="accent-burgundy"
                />
                This chapter
              </label>
              <label className="flex cursor-pointer items-baseline gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={wholeBook}
                  onChange={() => setWholeBook(true)}
                  className="accent-burgundy"
                />
                Whole book
              </label>
            </div>
          </fieldset>
        )}

        {format === "docx" && (
          <label className="mt-6 flex cursor-pointer items-baseline gap-2 font-sans text-sm">
            <input
              type="checkbox"
              checked={manuscript}
              onChange={(e) => setManuscript(e.target.checked)}
              className="accent-burgundy"
            />
            Standard manuscript format
          </label>
        )}

        {(format === "docx" || format === "epub") && (
          <label className="mt-6 block font-sans text-sm">
            <span className="font-sans text-xs tracking-[0.18em] text-warmgray uppercase">
              Author
            </span>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Optional"
              className="mt-2 w-full rounded-sm border-b border-ink/15 bg-transparent
                         py-1 outline-none focus-visible:border-gold"
            />
          </label>
        )}

        {error && (
          <p className="mt-4 font-sans text-sm text-burgundy">{error}</p>
        )}

        <div className="mt-8 flex justify-end gap-4 font-sans text-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm text-warmgray outline-none hover:text-ink
                       focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="rounded-sm text-burgundy outline-none disabled:opacity-50
                       focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            {busy ? "Building…" : "Export"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 6: Wire it into the shelf**

In `src/components/shelf/bookshelf.tsx`, add to the imports:

```tsx
import { useState } from "react";
import { ExportDialog } from "@/components/export/export-dialog";
```

(`useState` joins the existing `useEffect, useMemo, useRef` import from `react`.)

Add state inside `Bookshelf`, next to the other hooks:

```tsx
  const [exporting, setExporting] = useState<Book | null>(null);
```

Add an export button as a sibling of the delete button inside the `<li>`, immediately before it:

```tsx
                <button
                  type="button"
                  onClick={() => setExporting(book)}
                  aria-label={`Export ${book.title}`}
                  className="absolute top-4 right-7 rounded-sm px-1.5 py-0.5
                             font-sans text-xs leading-none text-warmgray
                             opacity-0 outline-none transition-opacity
                             group-hover:opacity-60 hover:!opacity-100
                             hover:text-burgundy focus-visible:opacity-100
                             focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  Export
                </button>
```

And render the dialog just before the closing `</div>` of the page container:

```tsx
        {exporting && (
          <ExportDialog book={exporting} onClose={() => setExporting(null)} />
        )}
```

- [ ] **Step 7: Wire it into the editor**

In `src/components/editor/chapter-editor.tsx`, add to the imports:

```tsx
import { useState } from "react";
import { ExportDialog } from "@/components/export/export-dialog";
```

(`useState` is already imported in this file; add only the dialog import.)

In `ChapterHeader`, change the signature to take the book and add the button. Replace the whole `ChapterHeader` function with:

```tsx
function ChapterHeader({
  book,
  title,
  bookId,
  chapterId,
}: {
  book: Book;
  title: string;
  bookId: string;
  chapterId: string;
}) {
  const [exporting, setExporting] = useState(false);

  return (
    <header className="pt-16 pb-10">
      <div className="mx-auto w-full max-w-(--measure-manuscript) px-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-sans text-xs tracking-[0.18em] text-warmgray uppercase">
            {book.title}
          </p>
          <button
            type="button"
            onClick={() => setExporting(true)}
            className="shrink-0 rounded-sm font-sans text-xs text-warmgray
                       opacity-0 outline-none transition-opacity
                       hover:text-burgundy focus-visible:opacity-100
                       focus-visible:ring-2 focus-visible:ring-gold/60
                       group-hover/header:opacity-100"
          >
            Export
          </button>
        </div>
        {/* An input rather than a heading with contenteditable: the title is a
            single line of plain text, and a plain input gets the caret, undo
            and screen-reader behaviour right for free. */}
        <input
          value={title}
          onChange={(e) => renameChapter(bookId, chapterId, e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) {
              renameChapter(bookId, chapterId, "Untitled chapter");
            }
          }}
          aria-label="Chapter title"
          spellCheck={false}
          className="mt-2 w-full rounded-sm bg-transparent font-serif text-3xl
                     text-ink outline-none focus-visible:ring-2
                     focus-visible:ring-gold/60"
        />
      </div>

      {exporting && (
        <ExportDialog
          book={book}
          chapterId={chapterId}
          onClose={() => setExporting(false)}
        />
      )}
    </header>
  );
}
```

Add `group/header` to the `<header>` element's className so the hover reveal works: change `className="pt-16 pb-10"` to `className="group/header pt-16 pb-10"`.

Update the call site in `ChapterEditor` — replace `bookTitle={book.title}` with `book={book}`:

```tsx
      <ChapterHeader
        book={book}
        title={chapter.title}
        bookId={bookId}
        chapterId={chapterId}
      />
```

And add `Book` to the store import in this file:

```tsx
import {
  findBook,
  renameChapter,
  saveBody,
  touchLastOpened,
  type Book,
} from "@/lib/library-store";
```

- [ ] **Step 8: Verify Markdown export end to end**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm test`
Expected: PASS, all tests.

Then in a browser at `/`: hover a book, click Export, choose Markdown, click Export. A `.md` file downloads containing the book title, each chapter heading, and the prose.

- [ ] **Step 9: Commit**

```bash
git add src/lib/export src/components/export src/components/shelf/bookshelf.tsx src/components/editor/chapter-editor.tsx
git commit -m "Export a chapter or a book as Markdown"
```

---

## Task 6: XHTML

Needed by EPUB. Same block list, different renderer — the one added complexity is that XHTML needs real `<ul>`/`<ol>` nesting rebuilt from the flat `depth`.

**Files:**
- Create: `src/lib/export/xhtml.ts`
- Create: `src/lib/export/xhtml.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/export/xhtml.test.ts`:

```ts
import { expect, it } from "vitest";
import { blocksToXhtml } from "@/lib/export/xhtml";
import type { Block } from "@/lib/export/blocks";

const p = (...runs: Block["runs"]): Block => ({
  kind: "paragraph",
  depth: 0,
  runs,
});

it("renders a paragraph", () => {
  expect(blocksToXhtml([p({ text: "One." })])).toBe("<p>One.</p>");
});

it("renders headings at their level", () => {
  expect(
    blocksToXhtml([
      { kind: "heading", depth: 0, level: 2, runs: [{ text: "Chapter Two" }] },
    ]),
  ).toBe("<h2>Chapter Two</h2>");
});

it("escapes XML entities", () => {
  // Ampersand must be escaped first or the others double-escape.
  expect(blocksToXhtml([p({ text: 'a & b < c > d "e"' })])).toBe(
    "<p>a &amp; b &lt; c &gt; d &quot;e&quot;</p>",
  );
});

it("escapes entities inside an href", () => {
  expect(
    blocksToXhtml([p({ text: "here", href: "https://x.test/?a=1&b=2" })]),
  ).toBe('<p><a href="https://x.test/?a=1&amp;b=2">here</a></p>');
});

it("renders emphasis", () => {
  expect(
    blocksToXhtml([
      p(
        { text: "a", bold: true },
        { text: "b", italic: true },
        { text: "c", strike: true },
        { text: "d", code: true },
        { text: "e", underline: true },
      ),
    ]),
  ).toBe(
    "<p><strong>a</strong><em>b</em><s>c</s><code>d</code><u>e</u></p>",
  );
});

it("renders a scene break as centred asterisks", () => {
  expect(blocksToXhtml([{ kind: "sceneBreak", depth: 0, runs: [] }])).toBe(
    '<p class="scene-break">* * *</p>',
  );
});

it("renders a blockquote", () => {
  expect(
    blocksToXhtml([{ kind: "quote", depth: 0, runs: [{ text: "Quiet." }] }]),
  ).toBe("<blockquote><p>Quiet.</p></blockquote>");
});

it("groups consecutive list items into one list", () => {
  expect(
    blocksToXhtml([
      { kind: "bullet", depth: 0, runs: [{ text: "salt" }] },
      { kind: "bullet", depth: 0, runs: [{ text: "rope" }] },
    ]),
  ).toBe("<ul><li>salt</li><li>rope</li></ul>");
});

it("nests a deeper list inside the item above it", () => {
  expect(
    blocksToXhtml([
      { kind: "bullet", depth: 0, runs: [{ text: "supplies" }] },
      { kind: "bullet", depth: 1, runs: [{ text: "salt" }] },
      { kind: "bullet", depth: 0, runs: [{ text: "rope" }] },
    ]),
  ).toBe("<ul><li>supplies<ul><li>salt</li></ul></li><li>rope</li></ul>");
});

it("renders an ordered list", () => {
  expect(
    blocksToXhtml([
      { kind: "ordered", depth: 0, runs: [{ text: "first" }] },
      { kind: "ordered", depth: 0, runs: [{ text: "second" }] },
    ]),
  ).toBe("<ol><li>first</li><li>second</li></ol>");
});

it("renders a code block", () => {
  expect(
    blocksToXhtml([
      { kind: "code", depth: 0, language: "ts", runs: [{ text: "a < b" }] },
    ]),
  ).toBe("<pre><code>a &lt; b</code></pre>");
});

it("renders a hard break", () => {
  expect(
    blocksToXhtml([
      p({ text: "one" }, { text: "\n", hardBreak: true }, { text: "two" }),
    ]),
  ).toBe("<p>one<br />two</p>");
});

it("renders an empty paragraph as a spacer", () => {
  // Unlike Markdown, an empty paragraph is meaningful vertical space in a book.
  expect(blocksToXhtml([p()])).toBe("<p></p>");
});

it("returns an empty string for no blocks", () => {
  expect(blocksToXhtml([])).toBe("");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/export/xhtml.test.ts`
Expected: FAIL — cannot resolve `@/lib/export/xhtml`.

- [ ] **Step 3: Implement**

Create `src/lib/export/xhtml.ts`:

```ts
import type { Block, Run } from "./blocks";

/** Ampersand first, or every subsequent replacement double-escapes. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRun(run: Run): string {
  if (run.hardBreak) return "<br />";

  let out = escapeXml(run.text);

  if (run.code) out = `<code>${out}</code>`;
  if (run.strike) out = `<s>${out}</s>`;
  if (run.underline) out = `<u>${out}</u>`;
  if (run.italic) out = `<em>${out}</em>`;
  if (run.bold) out = `<strong>${out}</strong>`;
  if (run.href) out = `<a href="${escapeXml(run.href)}">${out}</a>`;

  return out;
}

const renderRuns = (runs: Run[]) => runs.map(renderRun).join("");

const isList = (block: Block) =>
  block.kind === "bullet" || block.kind === "ordered";

/**
 * Rebuilds real list nesting from the flat block list.
 *
 * Consumes blocks from `start` while they are list items at `depth` or deeper,
 * and returns the rendered list plus the index it stopped at. A deeper item is
 * folded into the `<li>` above it, which is where XHTML requires a sublist to
 * live.
 */
function renderList(
  blocks: Block[],
  start: number,
  depth: number,
): { html: string; next: number } {
  const tag = blocks[start].kind === "bullet" ? "ul" : "ol";
  const items: string[] = [];
  let i = start;

  while (i < blocks.length && isList(blocks[i]) && blocks[i].depth >= depth) {
    const block = blocks[i];

    if (block.depth > depth) {
      const nested = renderList(blocks, i, block.depth);
      // Attach to the previous item; a list opening deeper than its parent has
      // no item to attach to, so it becomes one of its own.
      if (items.length > 0) {
        items[items.length - 1] += nested.html;
      } else {
        items.push(nested.html);
      }
      i = nested.next;
      continue;
    }

    // A different list type at the same depth ends this list.
    if ((block.kind === "bullet" ? "ul" : "ol") !== tag) break;

    items.push(renderRuns(block.runs));
    i++;
  }

  return {
    html: `<${tag}>${items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`,
    next: i,
  };
}

export function blocksToXhtml(blocks: Block[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (isList(block)) {
      const { html, next } = renderList(blocks, i, block.depth);
      out.push(html);
      i = next;
      continue;
    }

    const text = renderRuns(block.runs);

    switch (block.kind) {
      case "heading":
        out.push(`<h${block.level ?? 1}>${text}</h${block.level ?? 1}>`);
        break;
      case "quote":
        out.push(`<blockquote><p>${text}</p></blockquote>`);
        break;
      case "sceneBreak":
        out.push('<p class="scene-break">* * *</p>');
        break;
      case "code":
        out.push(`<pre><code>${text}</code></pre>`);
        break;
      default:
        // An empty paragraph is meaningful vertical space in a book, unlike in
        // Markdown where the blank line between blocks already separates them.
        out.push(`<p>${text}</p>`);
    }
    i++;
  }

  return out.join("");
}
```

Note the list items in `renderList` are wrapped in `<li>` after nesting is attached, so a nested list appended to `items[last]` ends up inside that item's `<li>`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/export/xhtml.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/xhtml.ts src/lib/export/xhtml.test.ts
git commit -m "Render blocks as XHTML"
```

---

## Task 7: EPUB

**Files:**
- Create: `src/lib/export/epub.ts`
- Create: `src/lib/export/epub.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/export/epub.test.ts`:

```ts
import { expect, it } from "vitest";
import {
  chapterXhtml,
  containerXml,
  contentOpf,
  navXhtml,
} from "@/lib/export/epub";

const chapters = [
  { title: "Chapter One", xhtml: "<p>It began.</p>" },
  { title: "Chapter & Two", xhtml: "<p>It continued.</p>" },
];

it("declares the rootfile in container.xml", () => {
  const xml = containerXml();
  expect(xml).toContain('full-path="OEBPS/content.opf"');
  expect(xml).toContain('media-type="application/oebps-package+xml"');
});

it("puts the title, author and identifier in the OPF", () => {
  const opf = contentOpf(
    { title: "The Salt Road", author: "M. Reyes" },
    chapters,
    "urn:uuid:abc",
  );
  expect(opf).toContain("<dc:title>The Salt Road</dc:title>");
  expect(opf).toContain("<dc:creator>M. Reyes</dc:creator>");
  expect(opf).toContain("urn:uuid:abc");
  expect(opf).toContain('version="3.0"');
});

it("omits the creator when there is no author", () => {
  const opf = contentOpf({ title: "Untitled" }, chapters, "urn:uuid:abc");
  expect(opf).not.toContain("dc:creator");
});

it("lists every chapter in the manifest and the spine, in order", () => {
  const opf = contentOpf({ title: "T" }, chapters, "urn:uuid:abc");
  expect(opf).toContain('href="chapter-01.xhtml"');
  expect(opf).toContain('href="chapter-02.xhtml"');
  expect(opf.indexOf("chapter-01.xhtml")).toBeLessThan(
    opf.indexOf("chapter-02.xhtml"),
  );
  expect(opf).toContain('<itemref idref="chapter-01" />');
});

it("declares the nav document with its required property", () => {
  const opf = contentOpf({ title: "T" }, chapters, "urn:uuid:abc");
  // EPUB 3 requires exactly one item carrying properties="nav".
  expect(opf).toContain('properties="nav"');
});

it("escapes metadata in the OPF", () => {
  const opf = contentOpf(
    { title: "Salt & Rope", author: "A <B>" },
    chapters,
    "urn:uuid:abc",
  );
  expect(opf).toContain("<dc:title>Salt &amp; Rope</dc:title>");
  expect(opf).toContain("<dc:creator>A &lt;B&gt;</dc:creator>");
});

it("lists chapters in the nav document, escaping titles", () => {
  const nav = navXhtml("The Salt Road", chapters);
  expect(nav).toContain('href="chapter-01.xhtml"');
  expect(nav).toContain("Chapter &amp; Two");
  expect(nav).toContain('epub:type="toc"');
});

it("wraps chapter content in a full XHTML document", () => {
  const html = chapterXhtml("Chapter & One", "<p>It began.</p>");
  expect(html).toContain("<?xml version=");
  expect(html).toContain("<title>Chapter &amp; One</title>");
  expect(html).toContain("<h1>Chapter &amp; One</h1>");
  expect(html).toContain("<p>It began.</p>");
  expect(html).toContain('xmlns="http://www.w3.org/1999/xhtml"');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/export/epub.test.ts`
Expected: FAIL — cannot resolve `@/lib/export/epub`.

- [ ] **Step 3: Implement**

Create `src/lib/export/epub.ts`:

```ts
import type { Book } from "@/lib/library-store";
import { toBlocks } from "./blocks";
import { blocksToXhtml, escapeXml } from "./xhtml";
import type { LoadedChapter } from "./index";

/**
 * EPUB 3. Two details produce most invalid files, and both are handled here
 * explicitly rather than left to the zip library's defaults:
 *
 *   1. `mimetype` must be the FIRST entry in the zip and stored UNCOMPRESSED.
 *   2. EPUB 3 requires a nav document declared with properties="nav";
 *      toc.ncx alone is the EPUB 2 shape.
 */

export interface EpubChapter {
  title: string;
  xhtml: string;
}

export interface EpubMeta {
  title: string;
  author?: string;
}

/** chapter-01, chapter-02 … zero-padded so the spine sorts readably. */
const chapterId = (index: number) => `chapter-${String(index + 1).padStart(2, "0")}`;

export function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

export function contentOpf(
  meta: EpubMeta,
  chapters: EpubChapter[],
  identifier: string,
): string {
  const manifest = chapters
    .map(
      (_, i) =>
        `    <item id="${chapterId(i)}" href="${chapterId(i)}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");

  const spine = chapters
    .map((_, i) => `    <itemref idref="${chapterId(i)}" />`)
    .join("\n");

  const creator = meta.author
    ? `\n    <dc:creator>${escapeXml(meta.author)}</dc:creator>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(meta.title)}</dc:title>${creator}
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
${manifest}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;
}

export function navXhtml(title: string, chapters: EpubChapter[]): string {
  const items = chapters
    .map(
      (chapter, i) =>
        `        <li><a href="${chapterId(i)}.xhtml">${escapeXml(chapter.title)}</a></li>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>${escapeXml(title)}</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>
${items}
      </ol>
    </nav>
  </body>
</html>`;
}

export function chapterXhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    <h1>${escapeXml(title)}</h1>
${body}
  </body>
</html>`;
}

/** Matches the editor: indented paragraphs, no indent after a break. */
const STYLESHEET = `body { margin: 1em; }
h1 { text-align: center; margin: 2em 0 1em; font-weight: normal; }
p { margin: 0; text-indent: 1.5em; }
h1 + p, blockquote + p, .scene-break + p { text-indent: 0; }
.scene-break { text-align: center; text-indent: 0; margin: 1.5em 0; }
blockquote { margin: 1.5em 1.5em; font-style: italic; }`;

export async function buildEpub(
  book: Book,
  chapters: LoadedChapter[],
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  // FIRST and uncompressed. Both are spec requirements, and JSZip does neither
  // by default.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file("META-INF/container.xml", containerXml());

  const rendered: EpubChapter[] = chapters.map((chapter) => ({
    title: chapter.title,
    xhtml: blocksToXhtml(toBlocks(chapter.doc)),
  }));

  const identifier = `urn:uuid:${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Date.now().toString(36)
  }`;

  zip.file("OEBPS/style.css", STYLESHEET);
  zip.file(
    "OEBPS/content.opf",
    contentOpf({ title: book.title, author: book.author }, rendered, identifier),
  );
  zip.file("OEBPS/nav.xhtml", navXhtml(book.title, rendered));

  rendered.forEach((chapter, i) => {
    zip.file(
      `OEBPS/${chapterId(i)}.xhtml`,
      chapterXhtml(chapter.title, chapter.xhtml),
    );
  });

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/export/epub.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/epub.ts src/lib/export/epub.test.ts
git commit -m "Export a book as EPUB 3"
```

---

## Task 8: DOCX

**Files:**
- Create: `src/lib/export/docx.ts`

No test file. The `docx` object model is opaque to assertions — a `Paragraph` exposes nothing meaningful to compare — so testing it would mean asserting on library internals. The valuable logic upstream of it, `toBlocks`, is already covered. This gets verified by opening the file.

- [ ] **Step 1: Implement**

Create `src/lib/export/docx.ts`:

```ts
import type { Book } from "@/lib/library-store";
import { toBlocks, type Block, type Run } from "./blocks";
import type { LoadedChapter } from "./index";

/**
 * DOCX in standard manuscript format — the Shunn conventions an agent or editor
 * expects: Times New Roman 12pt, double-spaced, 1" margins, 0.5" first-line
 * indent with no space between paragraphs, each chapter starting on a new page,
 * and a running header of Surname / Title / page.
 *
 * The `manuscript: false` path produces the same text without the furniture,
 * for sending a draft to a friend rather than to a submission pile.
 */

const FONT = "Times New Roman";
const SIZE_HALF_POINTS = 24; // docx measures font size in half-points: 24 = 12pt
const DOUBLE_SPACED = 480; // twips; 240 is single

/** Last whitespace-separated word of the author's name, per manuscript convention. */
function surname(author: string | undefined): string {
  const parts = (author ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

export async function buildDocx(
  book: Book,
  chapters: LoadedChapter[],
  { manuscript }: { manuscript: boolean },
): Promise<Blob> {
  const {
    AlignmentType,
    Document,
    Header,
    HeadingLevel,
    LevelFormat,
    Packer,
    PageBreak,
    PageNumber,
    Paragraph,
    TextRun,
    convertInchesToTwip,
  } = await import("docx");

  const runsFor = (runs: Run[]) =>
    runs.map(
      (run) =>
        new TextRun({
          text: run.hardBreak ? "" : run.text,
          break: run.hardBreak ? 1 : undefined,
          bold: run.bold,
          italics: run.italic,
          strike: run.strike,
          underline: run.underline ? {} : undefined,
        }),
    );

  const bodySpacing = manuscript
    ? { line: DOUBLE_SPACED }
    : { line: 276, after: 160 };

  const bodyIndent = manuscript
    ? { firstLine: convertInchesToTwip(0.5) }
    : undefined;

  const paragraphsFor = (blocks: Block[], firstOfChapter: boolean) => {
    const out: InstanceType<typeof Paragraph>[] = [];
    let isFirstBody = firstOfChapter;

    for (const block of blocks) {
      switch (block.kind) {
        case "heading":
          out.push(
            new Paragraph({
              heading:
                block.level === 1
                  ? HeadingLevel.HEADING_1
                  : block.level === 2
                    ? HeadingLevel.HEADING_2
                    : HeadingLevel.HEADING_3,
              children: runsFor(block.runs),
            }),
          );
          isFirstBody = true;
          break;

        case "sceneBreak":
          out.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: bodySpacing,
              children: [new TextRun({ text: "* * *" })],
            }),
          );
          // A paragraph opening a new scene is not indented, as in print.
          isFirstBody = true;
          break;

        case "quote":
          out.push(
            new Paragraph({
              indent: {
                left: convertInchesToTwip(0.5),
                right: convertInchesToTwip(0.5),
              },
              spacing: bodySpacing,
              // A quote is set in italic wholesale, so its runs are rebuilt
              // rather than reused. Bold inside a quote is lost; that is a
              // deliberate simplification.
              children: block.runs.map(
                (run) => new TextRun({ text: run.text, italics: true }),
              ),
            }),
          );
          isFirstBody = false;
          break;

        case "bullet":
          out.push(
            new Paragraph({
              bullet: { level: Math.min(block.depth, 2) },
              spacing: bodySpacing,
              children: runsFor(block.runs),
            }),
          );
          break;

        case "ordered":
          out.push(
            new Paragraph({
              numbering: {
                reference: "ordered",
                level: Math.min(block.depth, 2),
              },
              spacing: bodySpacing,
              children: runsFor(block.runs),
            }),
          );
          break;

        case "code":
          out.push(
            new Paragraph({
              spacing: { line: 240 },
              children: [
                new TextRun({ text: block.runs.map((r) => r.text).join(""), font: "Courier New" }),
              ],
            }),
          );
          break;

        default:
          out.push(
            new Paragraph({
              spacing: bodySpacing,
              // The first paragraph after a heading or scene break is flush
              // left; the rest are indented. This is how printed books set body
              // text, and manuscript format keeps it.
              indent: isFirstBody ? undefined : bodyIndent,
              children: runsFor(block.runs),
            }),
          );
          isFirstBody = false;
      }
    }

    return out;
  };

  const children: InstanceType<typeof Paragraph>[] = [];

  chapters.forEach((chapter, index) => {
    if (index > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: manuscript
          ? { before: convertInchesToTwip(1), after: DOUBLE_SPACED }
          : { before: 240, after: 240 },
        children: [new TextRun({ text: chapter.title, bold: !manuscript })],
      }),
    );
    children.push(...paragraphsFor(toBlocks(chapter.doc), true));
  });

  const name = surname(book.author);
  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            children: [
              `${name ? `${name} / ` : ""}${book.title} / `,
              PageNumber.CURRENT,
            ],
          }),
        ],
      }),
    ],
  });

  const document = new Document({
    creator: book.author || undefined,
    title: book.title,
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
          })),
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE_HALF_POINTS },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: manuscript
              ? {
                  top: convertInchesToTwip(1),
                  bottom: convertInchesToTwip(1),
                  left: convertInchesToTwip(1),
                  right: convertInchesToTwip(1),
                }
              : undefined,
          },
        },
        headers: manuscript ? { default: header } : undefined,
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. This is the real check for this task — the `docx` types are strict, and a wrong option name fails here.

- [ ] **Step 3: Commit**

```bash
git add src/lib/export/docx.ts
git commit -m "Export as DOCX in standard manuscript format"
```

---

## Task 9: Verify the whole thing

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS. 33 store + 14 blocks + 13 markdown + 7 index + 14 xhtml + 8 epub = 89 tests.

- [ ] **Step 2: Typecheck**

Run: `npx next typegen && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `npx eslint .`
Expected: no output.

- [ ] **Step 4: Build, and confirm the heavy libraries are not in the main bundle**

Run: `npx next build`
Expected: success.

The point of the dynamic imports is that `docx` and `jszip` land in their own chunks rather than the page bundle. Confirm:

```bash
grep -rl "JSZip\|jszip" .next/static/chunks 2>/dev/null | head -5
```

Expected: matches only in separately-named chunk files, not in the main page chunk. If `docx` or `jszip` appear in the entry chunk, the `await import(...)` has been hoisted to a static import somewhere.

- [ ] **Step 5: Manual check — the part no test covers**

In a browser:

1. On `/`, hover a book → **Export** → Markdown → Export. The `.md` opens with the book title, each chapter heading, and the prose.
2. Same book → EPUB. Open the `.epub` in a reader (Calibre, Apple Books). The table of contents lists every chapter; chapters are in order.
3. Same book → Word, manuscript format on. Open in Word or LibreOffice: Times New Roman 12pt, double-spaced, 1" margins, chapters starting on new pages, header reading `Surname / Title / page`.
4. Same, manuscript format off — the furniture is gone, the text is not.
5. In a chapter, click **Export** in the header → "This chapter" → Markdown. Only that chapter, with no book title above it.
6. Set an author in the dialog, export, reopen the dialog — the name is remembered.
7. Export a book with an empty chapter, and one containing a scene break, a blockquote and a list. Nothing is dropped and nothing crashes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Verify export end to end"
```

---

## Self-review notes

- **Spec coverage.** Serialization layer → Tasks 3, 4, 6. Lazy dependencies → Tasks 5, 7, 8 (`await import`), verified in Task 9 step 4. Client-side Blob download → Task 5. Author field → Task 2. Shunn manuscript format → Task 8. EPUB mimetype-first-and-stored and nav.xhtml → Task 7. Dialog in both places → Task 5 steps 5–7. Filename slugs → Task 5. Testing strategy → matches the design: strings asserted, zip bytes and DOCX binaries not.
- **Excluded, per the design.** Title page; per-chapter EPUB (the dialog forces whole-book when EPUB is selected); PDF.
- **Naming consistency.** `toBlocks` → `Block[]` feeds `blocksToMarkdown`, `blocksToXhtml`, and `buildDocx`/`buildEpub`. `LoadedChapter` is defined in `index.ts` and imported by `docx.ts` and `epub.ts`. `escapeXml` is exported from `xhtml.ts` and reused by `epub.ts` rather than duplicated.
- **One known circular-ish import.** `epub.ts` and `docx.ts` import the `LoadedChapter` *type* from `./index`, which imports them dynamically. This is type-only in one direction and a runtime dynamic import in the other, so no cycle exists at runtime. If TypeScript complains, move `LoadedChapter` into `blocks.ts`.
- **Blockquote runs in `docx.ts`** rebuild each run as italic rather than preserving marks, since a quote is set in italic wholesale. Bold inside a quote is lost; that is a deliberate simplification, not an oversight.
