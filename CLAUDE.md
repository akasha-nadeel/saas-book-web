# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

OpenChapter is a novel-writing app: a shelf of books, a distraction-light chapter
editor, and import/export to the formats a writer actually hands off. It runs
almost entirely in the browser — the manuscript never leaves the machine except
for the one assistant feature.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build. Also the way to check Tailwind output: v4
  silently drops utilities it cannot parse, so verify against `.next/static/chunks/*.css`.
- `npm run lint` — ESLint (next/core-web-vitals + next/typescript)
- `npm run test` — Vitest, single run (jsdom env)
- `npm run test:watch` — Vitest watch
- One test file: `npx vitest run src/lib/export/epub.test.ts`
- One test by name: `npx vitest run -t "scene break"`

Tests live beside their subjects as `*.test.ts` and concentrate on the pure
logic: the import/export pipelines, the store, page setup, relative time.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Tiptap 3 editor · `@anthropic-ai/sdk` · `docx` + `jszip` for exports. Path alias
`@/*` → `src/*`.

This is a newer Next.js than your training data (see AGENTS.md). Two things that
bite: `params` is a `Promise` and must be awaited, and route components are typed
with the generated helpers `PageProps<"/route">` / `LayoutProps<"/route">` rather
than hand-written prop types.

## Architecture

**Persistence is one module.** `src/lib/library-store.ts` is the *only* file that
touches `localStorage`; everything else goes through it. This is deliberate — the
planned Supabase migration is meant to be a rewrite of that one module plus its
React bindings, with nothing else changing. Keep that boundary intact.

**The store is split by write-cost, not by type:**
- **shelf** (`openchapter:shelf`) — one document holding every book with its
  chapter list (ids, titles, order, denormalised word counts) plus each book's
  per-book settings: page setup, body typography, the front/back-matter tag and
  bookmark flag per chapter, and the trash list. One doc so a reorder commits
  atomically. Parsed on every read by every screen.
- **bodies** (`openchapter:chapter:<id>`) — one Tiptap JSON document per chapter,
  each at its own key, so opening a 40-chapter book parses no prose.
- **covers**, **notes**, **prefs** — likewise at their own keys, for the same
  reason: unbounded data that must not ride along in every shelf write.

Book/chapter totals are summed on read, never stored, so they can't drift.
Deleting a chapter is a soft delete: its meta moves to the book's `trash` list in
the shelf, but its body and notes stay at their own keys until the trash is
emptied, so a restore is lossless.

**React binds via `src/lib/use-library.ts`** — kept apart from the store so the
store stays React-free. It uses `useSyncExternalStore` with empty server
snapshots (SSR renders nothing, the client swaps in real data after hydration).
`useHydrated()` distinguishes "no books yet" from "storage not read yet"; guard
on it before rendering not-found states. Server snapshots must be referentially
stable (see the frozen `EMPTY_SHELF`) or the store loops.

**The editor** (`src/components/editor/chapter-editor.tsx`) is Tiptap. The surface
is keyed on `${chapterId}:${storedText}` so a save from another tab reloads it
instead of leaving it stale. Autosave is `src/lib/use-autosave.ts`; body is
written before word count (a stale count is cosmetic, lost prose is not). Custom
Tiptap extensions live in `src/lib/editor/` (font size, text align, blockquote,
resizable images). The one to understand is `pagination.ts`: it sets the
manuscript on real page sheets by *measuring* the rendered blocks and inserting
spacer **decorations** at each page break — never document content, so undo,
autosave and export see the same text. Inline images are a resizable node
(`resizable-image.ts` + `image-node-view.tsx`) that stores width as a percentage
of the column; `src/lib/image-import.ts` handles paste/drop, capped at 900KB.

**The reading view** (`/book/[bookId]/read`, `src/components/reader/`) renders the
whole book on one scrolling page. It does not re-implement layout: it walks each
chapter through the export path (`toBlocks` → `blocksToXhtml`) and sets it with
the book's typography, so the read-through, the print PDF and the EPUB match.

**Import, export and the reading view share a format-neutral block IR**
(`Block`/`Run` in `src/lib/export/blocks.ts`). A Tiptap doc is walked once into
blocks, then each renderer consumes them — the tricky parts (marks, nesting, hard
breaks) live in one tested place. Heavy libraries (`docx`, `jszip`) are
dynamically imported so a writer who never exports never downloads them.
- Export: `src/lib/export/` — markdown, docx, epub, and PDF via the browser's
  print engine (`print.ts`, rendered into a hidden iframe). `index.ts`
  orchestrates; `xhtml.ts` is the shared XHTML renderer behind epub, PDF and the
  reader; `typeset.ts` controls the look of the outputs that are ours;
  `front-matter.ts` generates the title/copyright/contents pages.
- Import: `src/lib/import/` — docx, epub, md, txt, html. `index.ts` dispatches by
  extension and refuses `.doc`/`.pdf` *by name* with what to do instead; `split.ts`
  breaks a flat block stream into chapters.

**The one server surface** is `src/app/api/chat/route.ts` — the editor's assistant,
Anthropic streaming. Needs `ANTHROPIC_API_KEY` in `.env.local`; without it the
route returns 501 with a message saying so. Chapter text is sent only when the
writer opens the panel and asks, and rides in the (cached) system prompt.

**Routes:** `/` shelf · `/book/new` setup · `/book/import` · `/book/[bookId]`
book overview (lands here, not on a chapter) ·
`/book/[bookId]/chapter/[chapterId]` editor · `/book/[bookId]/read` reading view ·
`/book/[bookId]/export`.

## Styling

Tailwind v4 with the palette declared in `@theme` in `src/app/globals.css`. Colors
are named for their *job* (`surface`, `panel`, `raised`, `line`, `fg`, `muted`,
`accent`) so a hue change doesn't make class names lie. The writing surface has
its own palette layer: a `[data-paper]` attribute re-points `--paper-*` CSS vars,
and anything that should sit with the page rather than the chrome opts in via that
attribute. Body type is the same shape: `src/lib/page-setup.ts` and
`src/lib/typography.ts` turn a book's page-and-type settings into `--ms-*` custom
properties on the manuscript container, which the editor and the reading view
both read — so one setting styles the writing surface and the read-through alike.

`<body>` is `overflow-hidden` (for the editor shell). A standalone scrolling page
therefore needs `h-dvh overflow-y-auto` — `min-h-dvh` puts content out of reach.

## House rules

- **No dead UI.** A control either works or plainly says it isn't built. Don't
  copy chrome from a reference and leave it inert.
- Storage limits are real: covers capped at 250KB, inline images at 900KB, import
  at 8MB — localStorage is ~5MB per origin. `setCover` and `createBookFromImport`
  fail cleanly and return a signal; honour it.
- `TODO.md` tracks pending work and records *why* things were cut (e.g. front/back
  matter, per-chapter status). Read it before rebuilding something that looks
  missing — it may have been removed on purpose.
