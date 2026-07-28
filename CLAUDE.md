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
logic: the import/export pipelines, the store, page setup, search, book kinds,
the custom Tiptap marks, relative time. Components are not tested — jsdom is
there for `localStorage`, not for a DOM.

`docs/plans/` holds the design and implementation notes for the bigger pieces
(the bookshelf, export). They record what was decided and why, and are worth
reading before reworking either.

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
emptied, so a restore is lossless. A *book* is soft-deleted differently — it
stays in `shelf.books` and gains an `archivedAt` or `trashedAt` stamp, and
`booksIn(shelf, view)` filters the three shelf views out of the one list.

**Two subscription audiences, opposite needs.** Shelf listeners want every write
including our own (renaming a chapter must repaint the sidebar now), so local
fan-out is manual and shelf-only. Body listeners want *only* other tabs — echoing
our own save back would remount the surface the writer is typing into. The
`storage` event covers cross-tab for both, since browsers fire it only in other
tabs. Get this backwards and you eat the caret.

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
manuscript on real page sheets by *measuring* the rendered text and inserting
spacer **decorations** at each page break — never document content, so undo,
autosave and export see the same text. It measures in **lines**, not blocks, so a
long paragraph fills the page and continues over the seam the way Word's does;
the break arithmetic is the pure, tested `pageBreaks()`. Two things hold it
together: every measure runs with the existing spacers `display:none`, so breaks
are always computed from the document's natural flow and can never drift pass by
pass; and a mid-paragraph gap is a full-width **inline-block**, because a block
box there would make the browser split the paragraph into anonymous blocks and
the continuation would take the book's first-line indent. A paragraph whose lines
can't be read falls back to moving whole, which is how this worked before. Inline images are a resizable node
(`resizable-image.ts` + `image-node-view.tsx`) that stores width as a percentage
of the column; `src/lib/image-import.ts` handles paste/drop, capped at 900KB.

**The editor shell is a rail plus one panel.** `workspace-rail.tsx` selects which
panel (`PanelTab` in `left-panel.tsx`: chapters, search, notes, bookmarks,
assistant, trash) is open, and clicking the active tab closes it — one control,
never two. Both the chapter editor and the book overview mount the same rail, so
a change to the tabs lands on both screens at once. They differ in one thing: the
editor passes `chapters={false}` and keeps its panel closed until a tab is picked,
because the book panel beside the manuscript is already the chapter list, whereas
the overview has no book panel and its chapter tab is the only way to pick one.
Panel visibility follows from that — the overview uses the stored `leftPanel`
pref, the editor its own state. The panes live in
the *pages* rather than in `book/[bookId]/layout.tsx`, because the left panel
needs the chapter id and the assistant needs the editor instance, neither of
which a layout can see. The import banner is the exception and does live in that
layout — it has to survive the writer clicking chapter to chapter.

**The reading view** (`/book/[bookId]/read`, `src/components/reader/`) sets the
whole book on real page sheets at the book's trim size. Prose is not re-laid out:
each chapter is walked through the export path (`toBlocks` → `blocksToXhtml`) and
styled with the book's typography, so the read-through, the print PDF and the
EPUB match. Pagination *is* ours — the browser has none on screen — so
`paginate()` in `reader-pages.tsx` measures the rendered blocks in a hidden
column at the page's true content width (outside any `zoom` wrapper, which would
distort the numbers) and packs them into page-height groups, re-running once the
manuscript font loads. **That same `paginate()` backs the editor's Book View
preview** (`page-preview.tsx`), so both break pages identically; keep them on the
one function. `reader-flipbook.tsx` is the same flowed pages presented as a book
you open and turn.

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

**The small pure modules** are where the conventions of the trade live, kept out
of components so they can be tested and changed in one place: `book-kinds.ts`
(novel/novella/short story, genre word-count targets), `book-templates.ts`
(chapter skeletons only — never boilerplate prose), `search.ts` (walks plain text
out of stored Tiptap JSON for the ⌘K panel), `page-setup.ts`, `typography.ts`,
`relative-time.ts`, `use-typewriter.ts`.

**The assistant** is `src/app/api/chat/route.ts` — Anthropic streaming. Needs
`ANTHROPIC_API_KEY` in `.env.local`; without it the route returns 501 with a
message saying so. Chapter text is sent only when the writer opens the panel and
asks, and rides in the (cached) system prompt.

**Auth is Supabase, and optional.** Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the app grows accounts and a sign-in
wall; leave both unset and it runs exactly as it always did, local-only, with the
account menu saying why — the same shape as the missing API key. Every entry
point checks `isSupabaseConfigured()` first, because the clients throw on an
empty URL.

`src/proxy.ts` is the load-bearing file (Next 16 renamed Middleware to Proxy). A
Server Component cannot write cookies, so something ahead of the render must
refresh an expired token and store it — without that file, sessions die
mid-session and writers get logged out at random. Two details are easy to get
wrong: `setAll` must rebuild the response *after* putting the new cookies on the
request, and it must copy the `headers` argument onto the response, or a CDN
caches one writer's `Set-Cookie` and serves it to the next reader. A redirect out
of the proxy has to carry those cookies too. The gate reads `getClaims()`, which
verifies the JWT signature — never `getSession()`, which trusts the cookie.

`src/lib/supabase/` holds the three clients (browser, server, and the one the
proxy builds inline); sign-in/up/out are Server Actions in
`src/app/auth/actions.ts`, so the session cookie and the redirect land in the
same response and there is no sign-in flash. The proxy skips `/api` on purpose —
redirecting a `fetch` to an HTML page yields a parse error, not a 401 — so the
chat route checks for itself.

**Auth is not persistence.** A signed-in writer still reads and writes
`localStorage`; the account identifies them but does not yet carry their books.
The UI says so rather than letting it be discovered. See `TODO.md`.

**Routes:** `/` shelf · `/signin` · `/signup` · `/auth/confirm` (the far end of a
confirmation email) · `/book/new` setup · `/book/import` · `/book/[bookId]` book
overview (lands here, not on a chapter) ·
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

Three writer-facing looks are stored in `prefs` and each is applied its own way:
`theme` (light/dark) as `data-theme` on `<html>`, `paper` as `[data-paper]` on the
writing surface, and `focusMode` / `typewriter` as behaviour. The theme is set
before first paint by an inline script in `src/app/layout.tsx` so a dark-mode
writer never sees a white flash; it runs before React, so it *cannot* import
`library-store` and instead reads the `openchapter:prefs` key literally — change
that key or the shape of `theme` and the bootstrap goes stale silently. `<html>`
carries `suppressHydrationWarning` for the same reason, and `ThemeSync` takes
over every change after hydration.

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
