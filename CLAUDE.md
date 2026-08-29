# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

OpenChapter is a book-writing *and* self-publishing app. It began as a shelf of
books, a distraction-light chapter editor, and import/export to the formats a
writer actually hands off; **as of 2026-08-01 it is aimed at the whole job** —
sixteen per-book tools around the manuscript (comps, blurb, categories, covers,
paperback setup, structure, prose, progress, money, ARC readers, a publishing
roadmap) with the editor as one part rather than the whole. It runs almost
entirely in the browser: the manuscript never leaves the machine except for the
assistant, the two audio routes, the server-rendered PDF, and a comp search that
sends only words the writer typed for a shop to read.

**`TODO.md` is the canonical statement of that direction** — what shipped and
why, what each feature deliberately refuses to do, and what was ruled out
(marketplaces, AI covers, AI editing) so it is not re-proposed. Read it before
proposing a feature or rebuilding something that looks missing.

## The launch MVP is smaller than this file — read `src/lib/launch.ts` first

**As of 2026-08-22 the shipped product is a gate over the codebase this file
describes.** Most of what follows is built, tested and *currently unreachable*.
Nothing below is stale as a description of the code; it is stale as a
description of what a writer can open. Check `src/lib/launch.ts` before
assuming a screen or a route is live.

- **`src/lib/launch.ts` is the one statement of what the MVP sells** — prices,
  free/Pro limits, and `HIDDEN_BOOK_TOOL_PATHS`, the sixteen segments the proxy
  redirects home. `/tools` and `/invite/*` go home with them. Its sibling
  `launch-server.ts` is the API half: `launchFeatureEnabled()` gates a route and
  `hiddenLaunchApiResponse()` answers **404** rather than 501 or 402.
- **The flag is off by default and inverted.** `launchFeatureEnabled()` is
  `process.env.OPENCHAPTER_LAUNCH_MVP === "0"` — unset means the full product is
  hidden. It is **not in `.env.local.example`**, which is the one exception to
  that file being the canonical env list.
- **The flag governs the API half only — the page half has no flag.**
  `src/proxy.ts` calls `hiddenLaunchRoute()` *unconditionally*, before it looks
  at anything else; `launch.ts` reads no environment at all. So setting
  `OPENCHAPTER_LAUNCH_MVP=0` un-404s the model routes and leaves every hidden
  screen still redirecting home. **To work on a gated tool locally, take its
  segment out of `HIDDEN_BOOK_TOOL_PATHS`** — the env var will not do it.
- **What is live**: the shelf, `/book/new`, `/book/import`, the editor,
  `/book/[bookId]/export`, the assistant, upgrade/billing and the legal pages.
  **What is gated**: every model route including the two comps routes this file
  calls free and keyless, `/api/narrate`, `/api/transcribe`, and the fifteen
  other tool screens.
- **`LAUNCH_POST_BACKLOG` is the list of what comes back**, in the order it is
  meant to. Adding a feature to the MVP means taking it off both that list and
  `HIDDEN_BOOK_TOOL_PATHS`, not deleting the gate.

## Where the detail lives

This file is the map and the rules. The reasoning behind each area — what was
tried, what it cost, and why it is shaped the way it is — lives in `docs/` and
is the thing to read **before changing that area**, not after.

| Working on | Read first |
|---|---|
| The store, IndexedDB, cross-tab notes, storage limits, React hooks | `docs/architecture/storage.md` |
| Dashboard, checkup findings, roadmap, the sixteen tool screens, save bars | `docs/architecture/dashboard-and-tools.md` |
| Comps, keywords, title check, blurb routes, `ai.ts`, the assistant, audio | `docs/architecture/ai-and-model-routes.md` |
| Tiptap editor, rails, panels, front/back matter pages, series bible | `docs/architecture/editor.md` |
| Reading view, pagination, the export wizard's Preview | `docs/architecture/reader.md` |
| Export (EPUB, PDF, Word, Markdown), typesetting, front matter, covers | `docs/architecture/export.md` |
| Import of any format, structure detection, file metadata | `docs/architecture/import.md` |
| Root layout, `resume.ts`/`account.ts`/`plural.ts`, feedback | `docs/architecture/app-shell-and-modules.md` |
| Supabase auth, `src/proxy.ts`, `sync.ts`, migrations | `docs/architecture/auth-and-sync.md` |
| Sharing a book, roles, RLS, seats, invitations, email | `docs/architecture/collaboration.md` |
| Paddle/PayHere, plans, free limits, upgrade UI, legal pages | `docs/architecture/billing.md` |
| Landing page, `/tools` guide, any public claim | `docs/architecture/landing.md` |
| Phone/tablet layout, the writing dock, visual-viewport variables | `docs/plans/2026-08-22-responsive-application-design.md` |
| Colours, themes, tokens, `src/components/ui/` | `docs/styling.md` |
| Tests — what is covered, and which ones must not be "fixed" | `docs/testing.md` |
| `next.config.ts` | `docs/architecture/build-config.md` |

`docs/plans/` holds the original design notes for the bookshelf, export and the
Supabase persistence design. `docs/checks/` holds the SQL that verifies the RLS
policies. Read the relevant one before reworking any of them.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build. Also the way to check Tailwind output: v4
  silently drops utilities it cannot parse, so verify against `.next/static/chunks/*.css`.
- `npm run lint` — ESLint (next/core-web-vitals + next/typescript). It does *not*
  typecheck; for that, `npx tsc --noEmit` — there is no script for it.
- `npm run test` — Vitest, single run (jsdom env)
- `npm run test:watch` — Vitest watch
- One test file: `npx vitest run src/lib/export/epub.test.ts`
- One test by name: `npx vitest run -t "scene break"`
- `java -jar epubcheck.jar book.epub` — the EPUB check the unit tests can't do.
  Not in CI, and **the jar is not in the repo** — download EPUBCheck 5.3 first.
  Run it by hand after touching `epub.ts`.
- `node scripts/feature-shots.cjs` — regenerates the landing page's bitmap
  product shots from raw captures kept outside the repo. A one-shot tool, not
  part of the build.

The suite is 101 files / 1,904 tests and takes about ninety seconds (measured
2026-08-25, all green); jsdom prints `HTMLCanvasElement's getContext()` warnings
from the image recoder and `Not implemented: navigation to another Document`
from the routing tests — both are expected, not failures. Tests live beside
their subjects as `*.test.ts` and
cover the pure logic only — components are not tested, and jsdom is there for
`localStorage` rather than for a DOM. **Several tests assert *positions* rather
than behaviour and must not be "fixed" when they go red** — see
`docs/testing.md` for the list and for what each one is protecting.

**A scratch copy of the app must not live inside the repo, and one did.**
`/.shot-app/` — a second copy of `src/` with its own `.next/` and a
`node_modules` symlink — sat in the project root until 2026-08-20 and broke
Turbopack: every HMR recompile died with `Next.js package not found`, on both
`/page` and `/_not-found/page`, while the dev server went on serving the last
good build. A clean cache did not fix it and the panic log named no path, so it
reads as an upstream bug until the directory is moved out. It now lives beside
the repo instead. Nothing referenced it — `scripts/feature-shots.cjs` reads
captures from outside the tree — so moving it cost nothing.

If a copy is ever put back, put it **outside** the project root. Two other
things it used to cost, worth knowing if one reappears: `git add .` commits
thousands of bundled files, and `npm run lint` reports thousands of problems —
`src/` lints clean, so a large number is noise rather than news.

Every environment variable is optional and all but one are documented, with
their failure modes, in `.env.local.example`. That file is the canonical list —
read it rather than grepping for `process.env`. The exception is
`OPENCHAPTER_LAUNCH_MVP`, which is missing from it and should be added.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Tiptap 3 editor · `@anthropic-ai/sdk` (the assistant) · `ai` v7 through Vercel AI
Gateway (speech and transcription) · `docx` + `jszip` for exports. Path alias
`@/*` → `src/*`.

This is a newer Next.js than your training data (see AGENTS.md). Two things that
bite: `params` is a `Promise` and must be awaited, and route components can be
typed with the generated helpers `PageProps<"/route">` / `LayoutProps<"/route">`.
Both shapes are in the tree — the older routes use the helpers, the sixteen tool
routes write `props: { params: Promise<{ bookId: string }> }` by hand. Either is
fine; awaiting `params` is not optional.

**`next.config.ts` is load-bearing, not boilerplate**, and every one of its four
entries was paid for — read `docs/architecture/build-config.md` before touching
it. The rules in short:

- `turbopack.resolveAlias.pagedjs` must stay, or every PDF export dies at the
  first `preview()` with `TypeError: contains.call is not a function`.
- `env.OC_PAGEDJS_DIST` + `outputFileTracingIncludes` are the server half; drop
  them and production PDF exports fall to the print-dialog fallback.
- **There is no `webpack` hook and one must not be added.** With one present,
  `/read`, `/chapter/[chapterId]` and `/roadmap` answer 404.
- `images.qualities` is required in Next 16 — anything not listed is silently
  refused rather than honoured.

## Architecture

### Persistence — `docs/architecture/storage.md`

**Persistence is one module.** `src/lib/library-store.ts` is the *only* file
that touches storage; everything else goes through it. That boundary is what let
Supabase arrive *behind* the store (`sync.ts`) and the manuscript move onto
IndexedDB, both without any of the sixty-odd files that read it changing a line.
**A screen reaching for `localStorage` directly is a bug even when it works.**
There are **exactly two exceptions**, both of which have to reach past the
store by their nature: the `THEME_BOOTSTRAP` inline `<script>` in
`src/app/layout.tsx`, which runs before React, and `storage-space.ts`, which
walks `localStorage.key(i)` to *measure* the origin rather than to read a
value. Nothing else may follow them.

- **The manuscript is on IndexedDB; the index is in `localStorage`.** Bodies,
  notes, history and cover thumbnails moved to the disk (`store-db.ts`) on
  2026-08-17. **Three things stayed and must not follow**: `prefs` (read by the
  bootstrap script before React), `owner` (read around the wipe), and the
  **shelf** (~50KB, the index every screen paints from, kept synchronous so
  first paint is instant).
- **Memory is the read path, IndexedDB is the disk.** Each moved store keeps a
  `Map` mirror so `getBody` stays synchronous and returns the same string
  reference until it is replaced — which is what `useSyncExternalStore` needs.
- **`mirror.get(key) ?? readRaw(legacyKey)`** is what makes it safe: an
  interrupted migration is harmless and a browser without IndexedDB behaves as
  before. `localStorage` stays a fallback **read** path for good — so **every
  delete must clear the legacy key**, or an erased chapter comes back.
- **`loadFromDisk` has no timeout, deliberately** — giving up shows an empty
  book and the next autosave writes it over the real one. A spinner is the safe
  failure. `saveBody` **rejects** while loading (rejects, not `false`, which is
  the viewer refusal and means *do not retry*).
- **One module-level `BroadcastChannel`** in `store-channel.ts` for cross-tab
  notes; it carries the **key, never the value**. A channel per subscription
  would echo a tab's own saves back at its own body listeners and remount Tiptap
  mid-keystroke.
- **The store is split by write-cost**: one `shelf` doc (books, chapter lists,
  per-book settings, trash — one doc so a reorder commits atomically), one key
  per body/cover/note, and the tool stores (`bible:`, `arc:`, `history:`,
  `ledger`, `activity`, `ideas`). **None of the tool stores sync**, and every
  screen with one says so on the page — don't quietly drop that line.
- **Two subscription audiences, opposite needs.** Shelf listeners want every
  write including our own; body listeners want *only* other tabs. Get this
  backwards and you eat the caret.
- **Two gates, not one.** `useHydrated()` is storage-read; `useLibrarySettled()`
  is reconcile-finished. **Guard empty states on `useLibrarySettled` and never
  the loaded ones.** Both are decided synchronously, or first paint shows the
  loaded state.
- **Room can still run out and it is said out loud.** `storage-space.ts` +
  `StorageAlert` in the root layout: the store raises trouble (`reportStorage`),
  never an effect on mount; `history-dropped` is a note and `full` stops the
  screen; it is only ever raised louder, never quieter.
- Book/chapter totals are summed on read, never stored. Deleting a chapter is a
  soft delete into the book's `trash`; a book gains `archivedAt`/`trashedAt` and
  stays in `shelf.books`.
- **One hook per store** in `use-library.ts` (`useShelf`, `useChapterBody`,
  `useCover`, `useNotes`, `usePrefs`, `useBible`, `useArc`, …). A new store gets
  a new hook there, never an effect in a screen. Server snapshots must be
  referentially stable or the store loops.

### The dashboard and the tools — `docs/architecture/dashboard-and-tools.md`

**The front door is a dashboard, not a shelf** (`shelf/bookshelf.tsx`): six
areas — Overview, Write, Prepare, Track, Tools, Collaborators — and Write is one
of them. **Overview is a diagnosis**: `checkup.ts` returns **findings** (what is
wrong with this book, worst first, each carrying the control that fixes it).

- **Every finding carries its own typed `Fix`**, not a URL — the three commonest
  problems are fixed in a dialog the shelf owns.
- **Nothing is invented**: no score, no grade, no percentage.
- **`findingsFrom` is the one way readiness issues become findings**, so the
  dashboard, Prepare and the landing check cannot word them differently. It
  folds a cover file's several faults into **one errand** (two or more fold, one
  is left alone, the row names every fault it counts, and it counts only faults
  that have a destination).
- **A test walks every field `storeReadiness()` can emit** and fails if
  `DESTINATIONS` has no entry — add a check to `publishing.ts` and forget that
  map and the finding lands as a dead end.
- Advisory findings wait until the roadmap has reached prepare/launch/publish; a
  shop's *refusals* travel at any stage.
- A roadmap tick is **local-only** and survives the download because `applyRemote`
  merges via `keepLocalOnly` rather than replacing. Any future local-only field
  is covered by the same merge.
- Which area is open lives in **`?area=`**; the roadmap's `?phase=`/`?open=` and
  a tool's `?from=` are the other three. Read them with `useSearchParams` — a
  lazy initialiser reading `window.location` sees the *previous* URL.

**The tool catalogue is declared once** in `src/lib/book-tools.ts` (path, name,
one-line description, grouped). Nothing in that list is a preview: a tool that
is not finished does not go in it. **It holds two entries in two groups** —
the Consistency check and Export — because the list is what the dashboard, the
book card's ⋯ sheet and the landing page all read, and the MVP may only name
what is reachable. (`1daca70` cut it to Export alone; the consistency check was
added on 2026-08-27 as the second live tool, and is the only one of the
seventeen that was written *for* the MVP rather than un-gated into it.)
`src/lib/tool-guide.ts` carries one guide per entry. The sixteen older tool *screens*
are all still in the tree under `src/app/book/[bookId]/` and
`src/components/`; bringing one back is an entry here, an entry there, and a
line off `HIDDEN_BOOK_TOOL_PATHS`. Its file comment still says sixteen.
**Each tool is the same three pieces** — a pure, tested module in `src/lib/`;
a thin
`src/app/book/[bookId]/<tool>/page.tsx` that awaits `params`; a client component
in `src/components/<tool>/`.

- Every tool mounts **`ToolHeader`** when it owns the window, and **every tool
  takes `width="7xl"`** — one measure is what keeps the margins still. The deck
  runs that full width and is held to a sentence or two.
- **`ToolPageProps` (`bookId`, `embedded`, `heading`) is the contract**;
  `embedded` says exactly two things — no `ToolHeader`, and `h-full` rather than
  `h-dvh` (`toolShell()` writes that pair). **Nothing else may hang off the
  flag**: the moment it hides *features* there are two products in one file.
- The roadmap opens six tools in a sheet over the road; `roadmap/step-panel.tsx`
  is the registry, keyed by **URL segment** so it cannot disagree with the step's
  own `href`. Each is `dynamic` with `ssr: false`.
- **A tool holding a draft saves on a press, and the press ticks the road.**
  `tool-steps.ts` (`ticksForTool` writes **only** steps with no detector),
  `use-tool-save.ts`, and `unsaved.ts` (a one-slot module-level guard, not
  context). The bar appears only once there is something to lose and sits at the
  foot of the window. Four ways out, three mechanisms; anything that leaves
  without navigating calls `confirmLeave`.
- **`ToolStepDone` is for the four tools with no draft** (covers, comps, title
  check, export) — "Mark step done", never a Save with nothing to save.
- A screen holding a draft **falls back to the store rather than seeding itself
  in an effect** (`draft ?? stored`), and compares against `tidyPublishing`,
  since `setPublishing` drops empty fields on the way in.

**House style for these screens, enforced by tests**: no score, no grade, no
invented number; facts rather than verdicts; **detected beats ticked**; every
figure carries its provenance and *how many records carried the field*; and **an
empty result is never rendered as a good one** unless the search actually ran.

### Model routes — `docs/architecture/ai-and-model-routes.md`

**Two free catalogues sit behind `/api/comps`** (Google Books and Open Library),
server-side for a shared cache and to keep a reader's browser off two third
parties. Records merge **field by field** on ISBN, or title-plus-author.
**The manuscript never goes** — what leaves is a query. `/api/comps` and
`/api/comps/subjects` are **free, keyless, and stay that way** by design; that
is the whole reason the model steps are separate routes rather than flags on
them. (Both are behind the launch flag today and answer 404 — a temporary gate
over the design, not a change to it.)

- `openLibraryQuery()` translates dialects: Google wants `intitle:`, Open
  Library wants `title:`, and **Open Library answers an unknown prefix with zero
  results rather than an error** — which is how the title check silently read
  one catalogue for its whole life while the page claimed two.
- **No search volume, no competition score, no rank — anywhere in this
  cluster.** It cannot be had honestly; three modules have tests asserting their
  shape carries no such number, and those tests are not to be "fixed".
- Every model route goes through **`src/lib/ai.ts`** — `askModel()` for one-shot
  JSON, `streamModel()` for the assistant and anything streaming.
  `ANTHROPIC_API_KEY` makes it Claude, `GOOGLE_GENERATIVE_AI_API_KEY` makes it
  Gemini, both set and Claude wins; `modelProvider()` returning null is how a
  route answers **501** with a message saying so. Two model tiers
  (`DEFAULTS.task` / `.chat`); the first chunk is pulled before the response is
  returned so a rejected key is a 401 rather than an apology in the prose;
  `splitSse` is pure and tested because a network chunk is not a message.
- **Nothing here invents a book.** `/api/comps/rank` may only choose from books
  that were fetched, by numbered id, enforced **server-side**; there is no score
  field; generated text is treated as hostile input.
- **Three routes send prose** — the assistant, `/api/comps/rank`, and the blurb
  workshop. Each caps and cuts the opening, lists exactly what leaves *before*
  the button, and is named on `/privacy`. **Add a field to what is sent and add
  it to that list and to `/privacy` in the same commit.**
- Suggested keywords, category paths and blurb critiques **report or suggest;
  they never write into the book** without a press, and the keyword checker
  (`keywordReport`) is the *filter* on suggestions — anything it flags is
  **dropped, never truncated or repaired**.
- `src/lib/keywords/guide.ts` is the same knowledge with no model behind it,
  free and offline, because a self-hosted copy has no key.
- **Audio is three separate things and they are not interchangeable**:
  `/api/narrate` (text → audio, currently with no way in), `/api/transcribe`
  (audio → text, feeding the ordinary import path), and browser `SpeechRecognition`
  dictation (free, no key, Chrome/Edge only). Don't "unify" the last two.

### The editor — `docs/architecture/editor.md`

`src/components/editor/chapter-editor.tsx` is Tiptap. **The surface is keyed on
`${chapterId}:${reload}` — a counter, never the stored text** — and the counter
is bumped only by a write from *another* tab. That is what lets a save from
elsewhere reload the surface while this tab's own autosaves never remount it
mid-keystroke; keying on the text would remount on every save and eat the
caret. Autosave is
`use-autosave.ts`; **the body is written before the word count** (a stale count
is cosmetic, lost prose is not). Custom extensions live in `src/lib/editor/`.

- **`pagination.ts` inserts spacer *decorations*, never document content**, so
  undo, autosave and export see the same text. It measures in **lines** with the
  existing spacers hidden, and the arithmetic is the pure `page-breaks.ts`,
  shared with the reading view.
- **The selection bar owns the selection range** and puts it back inside
  `apply()`; `BarMenu` holds the placement, the portal, the upwards-only rule
  and the four ways out for both pickers. Font preview is a **decoration, never
  the mark**.
- **Inline images** store width as a percentage of the column; the resize
  arithmetic is the pure `image-resize.ts` and **must divide by the page zoom**
  (`PAGE_SCALE`) — the editor's other two measuring sites already do.
- **The tool panel floats over the manuscript; it does not push it.** One header
  for all nine tabs, four ways out that are one toggle, and `LeftPanel` owns its
  own mounting so it can animate out.
- **Front and back matter are lists of pages** (`matter.ts`). **Every template
  line a writer must replace carries a `[bracket]`** — that is the only mark the
  export has to tell a written page from scaffolding, and it survives a rename
  and a round trip. `isUntouchedMatter` in `export/blocks.ts` is the one rule
  and the panel calls it too; the export screen **names every page it left out**.
- **The panel lists the sixteen divisions with a switch on each**, not the
  pages the book happens to have — on creates the page (`createMatterPage`),
  off deletes it into the book's trash. **There is no stored "included" flag
  and there must not be one**: a page either exists or it does not, so nothing
  is threaded through the exporters and no column is added. Switching off a
  page `isDraftMatter` calls scaffolding skips the confirmation; a page with
  the writer's prose on it does not. `matter-list.ts` is the merge and is pure
  — **it never reorders a page the book has**, because `bindBook` sorts front
  matter by `matterSectionIndex` and leaves the back in stored order, so a
  sorted card would disagree with the file.
- The matter question is put once per book (`shouldAskMatter`), Skip is a real
  answer, nothing is created until a press, and `matter-picks.ts` keeps the
  dialog and `/book/new` saying the same thing.
- The bible reads across a **derived** series (matching `publishing.series`);
  merging is **exact** — same name or alias, case-insensitively, nothing fuzzier.
- **`no-indent.ts` is a mark, not a setting**, and pairs with `click-to-type.ts`:
  a paragraph the writer placed by double-clicking blank page must begin where
  the caret was shown, while aligning a body paragraph left is a different
  question and must leave the book's first-line indent alone. `caret-scroll.ts`
  is the other pure one — move the view only when the caret would leave it, and
  then only as far as the edge.
- **One editor, two presentations, and the surface never remounts between
  them.** `lib/editor/editor-layout.ts` is the pure classifier: `continuous`
  below 768px wide *or* below 560px high while narrower than 1024px, `paged`
  everywhere else; the tool rail is persistent from 1024px and the book
  navigator from 1280px. **The mode is never part of the surface key** — it
  classifies the space, not the device, and a resize must not cost a keystroke.
  `mobile-editor-header.tsx`, `mobile-writing-dock.tsx` and
  `mobile-more-controls.tsx` are the continuous chrome, and they reuse the same
  Tiptap command components as the desktop rail rather than a second copy.
- **`use-visual-viewport.ts` publishes the keyboard, `ViewportController`
  mounts it.** It watches `window.visualViewport`, falls back to the layout
  viewport, and writes visual height/offset/keyboard-inset CSS variables in one
  animation-frame DOM write — **no React state per keyboard frame**. It sits in
  the root layout with `ThemeSync` and `LibrarySync` for the same reason they
  do. `ui/responsive-panel.tsx` is the one overlay primitive over native
  `<dialog>` (sheet or full-screen when continuous, right drawer when paged),
  so focus trap, Escape and focus restoration are the platform's job.
- **The editor and the book overview mount the *same three parts*** — rail, tool
  panel, book panel — so a change lands on both screens at once. The overview
  differs only in having no manuscript. **The panes live in the pages rather
  than in `book/[bookId]/layout.tsx`**, because the left panel needs the chapter
  id and the assistant needs the editor instance; the import banner is the one
  exception and does live in that layout.
- `book-panel.tsx` is the navigator (front/body/back as cards, each opening into
  a list — chapters in the body, the sixteen divisions with their switches in
  the other two). Its face is the stored `bookPanel` pref rather than component
  state, and **which card is open lives in `useOpenPart`, called by the *screen***
  — the page sheet's edge takes the colour of the selected part, and two copies
  of that state would be two answers to one question.

### The reading view — `docs/architecture/reader.md`

`book-pages.tsx` is the setting and `book-reader.tsx` is the window; the export
wizard's Preview mounts the same setting, so two copies would be two books.
**Prose is not re-laid out** — each chapter goes through the export path
(`toBlocks` → `blocksToXhtml`), so the read-through, the PDF and the EPUB match.

- **`paginate()` in `reader/page-flow.ts` backs all three screens** (the reading
  view, the flip-book, and the editor's Book View). Keep them on the one
  function. It measures outside any `zoom` wrapper and re-runs once the
  manuscript font **and the pictures** have settled.
- **`boundReaderPages` (`reader/bound-pages.ts`) shows the book the *export*
  would build** — it calls `withoutReplaced → frontSections → bindBook`, the
  export's own functions in the export's own order. **Anything that looks like a
  rule about which pages go in, or in what order, belongs in `front-matter.ts`
  with the other four renderers and not here.**
- **Two knobs on `BookPages`, separate on purpose**: `typeset` says which pages
  are bound in, `setting` says what the sheets are cut to. `/read` is the
  writer's own page setup; the wizard's Preview is the file's.

### Export — `docs/architecture/export.md`

**Import, export and the reading view share a format-neutral block IR**
(`Block`/`Run` in `export/blocks.ts`). Heavy libraries (`docx`, `jszip`) are
dynamically imported. `index.ts` orchestrates; `xhtml.ts` is the shared XHTML
renderer; `typeset.ts` is the look; `front-matter.ts` generates the
title/copyright/contents pages and holds **`bindBook`, the binding order all
four renderers read**.

- **`export/consistency.test.ts` holds the four renderers to one answer** and is
  on the list of tests not to "fix": every renderer had its own passing tests
  and they still disagreed about binding order and chapter openers.
- **`chapterNumeral`, `printsHeading` and `isApparatusPage` are one rule each,
  called by all four renderers and both previews.** Apparatus prints no heading
  and is left out of the contents — the generated page and the EPUB's nav and
  ncx alike. `listedChapters` binds before listing, so the nav is the spine's own
  subsequence.
- The **contents page is generated over a written one** (`REPLACED_BY_DEFAULT`),
  because ours carries working links and real folios; the writer can overrule it
  and `withoutReplaced` is **one filter applied before anything reads the book**.
  Threading a second flag through each renderer is how they end up disagreeing.
- **An export with nothing in it is refused** — `runExport` throws
  `ExportRefused`, its own class, so the wizard prints its message verbatim.
- **EPUB: verified against EPUBCheck 5.3 (EPUB 3.3), 0 errors and 0 warnings**
  for a full and a bare book. Re-run it by hand after changing `epub.ts` — the
  suite tests the strings, not the spec. The cover is declared **twice**; the
  identifier is **derived from the book's id**, never minted fresh (a fresh UUID
  makes a corrected file read as a second listing); the `schema:access*` metadata
  is written from what the book actually contains.
- **A reflowable book states no `pt` or `px`, and no body `font-family`,
  `line-height` or `margin`** — the reader picks those, and both Apple's and
  KDP's guidance say so. Headings keep everything. Tests walk every template ×
  trim in both directions. The Manuscript template is not offered for an EPUB.
- **Nothing reaches an XHTML document that XML cannot carry** — `stripInvalidXml`
  runs inside `escapeXml` and in `toBlocks`. One form feed used to make every
  file in the EPUB a fatal `RSC-016`.
- **Pictures**: `image-recode.ts` converts WebP at export (PNG when there is any
  alpha, JPEG otherwise) because EPUB 3 mandates only GIF/JPEG/PNG/SVG.
  `packageable` is the packager's question and `carriable` the pre-upload
  check's; a picture that cannot travel is **dropped and named**.
- **The PDF is rendered on the server** (`/api/export/pdf` + Paged.js) and is the
  one route the whole manuscript travels on — `/privacy` says so. It falls back
  to the print dialog on any failure, and **the route is told the page size; it
  may not infer it** (`preferCSSPageSize` reads a rule Paged.js rewrites, so a
  6×9 book silently came out A4). `runExport` returns null on the fallback, so
  no "done" dialog claims a file that may not exist.
- **`bookSetting` decides the type size from the trim** — a table of typographic
  judgements landing each page near 66 characters, with a test that fails
  outside 45–75. `manuscript` ignores it (an agent's specification, not a
  design). The default trim is 6×9.
- **`typesetCss` takes a `scope`**, or the wizard's PDF review sets the *app*
  like a book; **two rules stay global even when scoped** (`string-set` on `h1`,
  the `section` page-break rules) or the running heads silently stop appearing.
- **A finished export says so** — `ExportDoneDialog`, opened by the press and
  never by an effect.
- **Markdown is built, tested and reachable from nothing** (`soon: true`), over
  base64 images. **Every "four formats" claim comes back in the same commit** it
  does.
- **The cover is page one of every format but Markdown**, behind
  `typeset.cover` (on by default). `runExport` resolves the artwork once above
  the dispatch; `coverSection` writes the PDF's and Word's, the EPUB keeps its
  own `cover.xhtml` in the spine, and `bindBook` needed no change because an id
  it does not know ranks `-1`. **It is the artwork alone** — no title composited
  over it, which is what a shop expects and the only thing Word can do. The PDF
  is a print interior, so the switch is what a writer sends a print shop.
- **A cover is three things written together** (`cover-save.ts`): a 700px JPEG
  thumbnail in `localStorage`, the original artwork in IndexedDB, and the
  measurements in `coverfacts:`. The export reads `getPrintCover` first. The
  artwork **does not sync**; the covers tool says so.
- `publishing.ts` holds the listing details and `storeReadiness()` **reports what
  a shop would refuse and never vetoes the export** — a writer is allowed to want
  the file for their own reader.

### Import — `docs/architecture/import.md`

`src/lib/import/` handles docx, epub, md, txt, html and audio. `index.ts`
dispatches by extension and refuses `.doc`/`.pdf` **by name** with what to do
instead; `split.ts` breaks a flat block stream into chapters.

- **An EPUB says which page is which and the importer believes it** — spine
  documents typed `frontmatter`/`backmatter` become matter pages; everything
  else takes the path it always did.
- **Every other format is read for its structure by table, never heuristic**
  (`matterPartOf` + `MATTER_ALIASES`). Null — *this is a chapter* — is the
  important answer and the common one. The page takes the **catalogue's**
  spelling rather than the manuscript's, and position is deliberately not
  consulted.
- **A division the book already has is dropped from an import** rather than
  added; body chapters may legitimately repeat and are renumbered.
- **A file's own metadata is read and kept** (`metadata.ts`, `cover.ts`): ISBN
  found by **check digit** rather than by prefix, `dc:date` cut to `YYYY-MM-DD`,
  Word's machine account names refused as authors.

### Auth, sync and collaboration — `docs/architecture/auth-and-sync.md` · `docs/architecture/collaboration.md`

**Auth is Supabase and optional** — unset both public env vars and the app runs
local-only, with the account menu saying why. Every entry point checks
`isSupabaseConfigured()` first, because the clients throw on an empty URL.

- **`src/proxy.ts` is the load-bearing file** (Next 16 renamed Middleware to
  Proxy). `setAll` must rebuild the response *after* putting the new cookies on
  the request, and must copy the `headers` argument onto the response, or a CDN
  serves one writer's `Set-Cookie` to the next reader. The gate reads
  **`getClaims()`**, which verifies the JWT signature — never `getSession()`,
  which trusts the cookie. It skips `/api` on purpose, so `/api/chat` checks for
  itself.
- **Everything funnels through `/auth/confirm`** — password reset, email
  confirmation and Google alike; `/reset-password` is therefore gated rather
  than public. `safeNext()` is the open-redirect guard on `?next=`.
- **Persistence is Supabase behind localStorage, not instead of it.** `commit()`
  diffs the shelf and pushes what moved — every shelf write funnels through it
  and the writes are immutable, so a new mutation cannot forget to push, and
  deletions are found by comparing chapter id sets.
- **Nothing is pushed while nobody is signed in.** `pushOwner(book, me)` is the
  rule: the *session* decides whether to push, the book only decides
  attribution. Postgres's 42501 hint recommending `GRANT … TO anon` must not be
  taken — it would let any stranger write to any writer's shelf.
- **The mapping narrows values on the way out** — `localStorage` holds whatever
  older versions left there and the database has CHECK constraints and NOT
  NULLs; one stale field would otherwise abort a whole library upload.
- **A browser is shared, so the cache is owned**: `clearLocalLibrary()` wipes
  every `openchapter:` key when a different account signs in.
- **A new column `fetchLibrary` selects must degrade when its migration is
  absent** — PostgREST refuses the whole select for one unknown column, so the
  entire library download would fail for everybody.
- **Schema changes belong in `supabase/migrations/`**, not only in the
  dashboard. There are **eight**; the first seven were applied live as of
  2026-08-20 and the eighth
  (`20260822071735_launch_mvp_entitlements.sql` — `ai_usage`, the assistant
  claim/refund RPCs and the free-book trigger) has not been confirmed here, so
  check before blaming a 502 from the assistant on the route —
  `20260801000000_feedback.sql` had been outstanding since it was written and
  the feedback dialog failed for every writer until it went in, and
  `20260820000000_chapter_unnumbered.sql` landed the same day. Check rather than
  assume before blaming a route: `select to_regclass('public.<table>')`.

**Sharing: two roles, editor and viewer, and no third.** *An editor writes the
book, the owner owns the book* — chapters, bodies and notes are the editor's;
the `books` row, the cover, the page setup and the listing details stay the
owner's, because per-writer fields live on that row.

- **Three rules live in SQL because the client cannot be trusted with them**:
  `owner` on every child row is derived by trigger and never accepted; write
  permission is decided by the **book**, never by the row's own `owner`; and a
  chapter cannot change books (only a trigger sees a key move). The helpers are
  `security definer` with `search_path = ''`; do not `force row level security`
  on `books` or `book_members`, and do not write either ownership test inline.
- **`book_members` is written by nothing but the server** — column-level select
  (no `token`, no `invited_by`), no insert/update/delete grant, mutations
  through Server Actions holding `createAdminClient()`, counting done in SQL
  under `select … for update`.
- **The invite link is a pointer, not a credential** — `/invite/[token]` is
  gated, and `acceptInvite` refuses anyone whose **confirmed** address is not the
  invited one.
- **Mail is best-effort; the row is the feature.** `emailed` comes back from the
  server and nothing may claim a send that did not happen. We send from our own
  verified domain, never as the owner (`From:` of somebody's gmail fails DKIM).
- **Every push is owner-aware** — `pushBook` skips the `books` upsert for a book
  somebody else owns and sends only changed chapter rows; `uploadLibrary` and
  the strays filter exclude foreign-owned books, or a revoked collaborator
  re-uploads somebody else's manuscript under their own account. A book that
  stops arriving is marked `access: "lost"`, never deleted.
- **Read-only has to be true, not merely claimed** — `canWriteBook` gates the
  editor, the inputs, the panels and (through `useToolSave`) every Save bar, and
  `saveBody` refuses to write.
- `docs/checks/collaboration-rls-check.sql` is how this was verified; the SQL
  editor connects as `postgres` and **bypasses RLS**, so a policy test there
  means nothing without `set local role authenticated`.

### Billing and free limits — `docs/architecture/billing.md`

**Payments are Paddle *or* PayHere, one at a time, and optional.** Configure
neither and there are no plans *and nothing is held back*. `provider.ts` decides;
Paddle wins when both are set, and the row records which provider sold it so a
switch leaves existing subscribers exactly where they are. PayHere is kept whole
beside it: its 2.99% beats Paddle at around eighteen subscribers.

- **Only the webhook grants Pro.** `authenticated` has no insert or update grant
  on `subscriptions`; both notify routes use the secret key. A return_url proves
  nothing, so `/upgrade/done` polls and Paddle's button has no success handler.
- **`/billing` is the account seen from the money side** — plan, card, assistant
  usage, invoices, and cancellation last so nobody lands on it by accident. It
  is display only. Two rules hold it together: the **status column is read from
  the gateway's own words** (`billing/history.ts`, pure and tested — an
  unrecognised status is shown as itself and **never as "Paid"**), and the
  **View link is a redirect** (`/api/billing/invoice/[id]` checks the row is the
  caller's, then 302s to Paddle's short-lived PDF) so no signed document URL is
  ever in the page source.
- **Paddle's client config is read on the server and passed down**, on `/billing`
  as on `/upgrade`. Read inside a client component `PADDLE_ENV` is `undefined` —
  it carries no NEXT_PUBLIC_ prefix — so the config there always answered
  `sandbox`, and Paddle.js will not start with a live token against the sandbox:
  the Update button opened nothing, in production as much as locally. The second
  half of that fix is `paddleSandboxFrom()`, which falls back to what the
  credentials say about themselves (`pdl_live_…`, `live_…`) when `PADDLE_ENV`
  says nothing. **An explicit `PADDLE_ENV` still decides**, so a machine that
  wants sandbox against live keys sets it.
- **The notification is verified before it is believed**, and Paddle's check
  reads the **raw text, not the parsed body**.
- **A cancel goes to the gateway first and our table second**, and Paddle is sent
  `effectiveFrom: "next_billing_period"`. `paddleStatus()` reads
  `scheduled_change` first, because a cancelled Paddle subscription reports
  `active` until the period ends.
- **Neither checkout lets the browser say what it is buying** — the transaction
  is created server-side, so the price comes from `plans.ts` and the buyer's id
  from their own session.
- Prices live once in `plans.ts` (**$5.98 monthly, $53.99 a year** at the launch
  MVP — 25% off, displayed as about $4.50/month, and the per-month figure is
  divided from the total rather than typed, with a test on it). `launch.ts`
  carries the same two figures for the marketing copy. **A price change is three
  edits**: this table, two *new* prices in Paddle's catalog (never an edit of a
  live one), and the resulting env ids.
- **Export is free on both plans, and *export must never move behind the plan*
  is the rule again.** The launch MVP sold EPUB and PDF as the two things Pro
  bought; that was undone on 2026-08-27, because a writer has to be able to take
  the book and go and a tool that holds the finished file back is the thing this
  trade's writers check for first. `freeExports` and `proExports` now carry the
  same three formats, and the pair stays as a pair so the decision has somewhere
  to live and narrowing it is still one edit. **`launch.test.ts` pins it** —
  nothing else would notice the array changing. What is free is **five books**,
  unlimited words and chapters, imports, sync and every export format; **Pro
  buys two things**: unlimited books, and sixty assistant replies a month
  against five.
- **What the launch MVP meters, it meters on the server**, because it costs
  model time: `billing/launch-entitlements.ts` claims an assistant reply through
  the `claim_assistant_reply` RPC against the `ai_usage` table (UTC calendar
  month, **402** unpaid / **429** Pro, and a `refund()` if the reply never
  lands), `requireLaunchExport()` now only checks for a session — free is not
  anonymous, since `/api/export/pdf` launches a browser on markup a caller sent —
  and the free book limit is
  a **Postgres trigger** (`enforce_launch_book_limit`) rather than a browser
  count. `new-book-form.tsx` mirrors it in the UI; the trigger is what enforces
  it. **The count is stated twice and both have to move** — `freeBooks` in
  `launch.ts` and the trigger body, whose current value is set by the ninth
  migration (`20260824000000_free_book_limit_five.sql`) rather than by the
  eighth, because the eighth may already have been applied. The tenth
  (`20260826000000_free_book_limit_counts_archived.sql`) changes *what* is
  counted, not how many.
- **The book limit counts everything but the trash**, so the archive is not a
  way round it and **unarchiving is never gated**. It was the active shelf alone
  until 2026-08-26, on the Trello/Figma convention where archiving opens a slot
  and coming back out is gated instead — a fair rule for tools whose archive
  holds *finished* things, and the wrong one here, where a writer archives a
  book they mean to return to and was met with a paywall at their own
  manuscript. **The trash still does not count**, which is not an inconsistency
  but the bug the rule was written for: counting deleted books made a shelf of
  three refuse a fourth because two sat in a forgotten trash. So restoring *from
  the trash* is still gated and the trigger still fires on **update as well as
  insert**; unarchiving is no longer a crossing at all. `booksAgainstPlan` in
  `library-store.ts` is the browser's copy and the trigger is the real one —
  they are two statements of one rule and must agree, or the browser offers
  restores Postgres then refuses.
- **A limit gate must never fire while the plan is still unknown.** `usePlan()`
  starts at `UNKNOWN` (`loading: true`, `pro: false`) and asks the server on
  mount, so for the width of one request a Pro account looks exactly like a free
  one. Both gates read `(plan.loading || plan.billing) && !plan.pro && …`, which
  *gated during that window*: landing on `/?area=write` and pressing Restore
  before the answer arrived told a writer with unlimited books there was no
  room. It is `!plan.loading && plan.billing && …` in both places now. Not
  knowing yet is not a reason to refuse, and the server is the real enforcement.
- **`free-limits.ts` is the earlier metering policy and most of it is asleep** —
  every tool it gates is one the launch MVP hides, so the seats row is the only
  one on a live path (`ShareDialog` still opens from the editor and the
  Collaborators area, while **`/invite/[token]` redirects home**, which is worth
  knowing before debugging an invite that cannot be accepted). It stays because
  it is the design to return to, and its four shapes are still the house rule
  for anything metered in the browser:

  | Shape | Tools | Free |
  |---|---|---|
  | **Per day** | comps, covers, title check | 2 / 3 / 2 a day |
  | **Per book** | blurb, prose report, track | 5 / 6 / 2 books |
  | **By occupancy** | ARC readers, seats | 10 a book / 2 a book |
  | **In total, for good** | keyword suggestions, blurb chat, keyword chat | 5 / 3 / 3 ever |

  The fourth shape follows the cost rather than the work and never comes back.
  `onThisBook` means a book already counted is never blocked; the daily
  reset lives in `dailyAllowance` and not in the parser; **every limit is spent
  on a press, never on arrival**; the counters live in `prefs`; `warnAt` caps the
  warning at `limit - 1`. The words must match the shape, and tests enforce it —
  a limit that never comes back may not say "today" or "tomorrow".
- **`LimitDialog` fires on the press that is refused, never from an effect**, and
  the controls stay live so there is a press to refuse. `useLimitGate(ask)` is
  the one path, and `ask` is a discriminated union so the compiler refuses a book
  limit with no book.
- **These are browser gates and are honest about it** — the routes that cost
  money are gated by `requirePro()` on the server (401 signed out, **402** signed
  in and unpaid, three different messages), and under the launch MVP by
  `launchFeatureEnabled()` ahead of it. Do not add a Pro row whose value depends
  on a browser gate being unbreakable.
- **Four legal pages exist because a gateway reviews the site signed out** — they
  are in `PUBLIC_EXACT` in `src/proxy.ts`, and `src/lib/legal.ts` states each
  fact once. **The privacy page names every route that sends anything**, so
  adding such a route is an obligation to add it there.

### The landing page — `docs/architecture/landing.md`

**`mvp-landing-page.tsx` is what a signed-out visitor actually gets**, and as
of 2026-08-24 it is a whole page rather than a placeholder: hero, the programs
a finished file opens in, four feature rows, the export, what leaves the
browser, the two plans, a FAQ, the closing ask and the footer. It sells the
smaller product and reads `LAUNCH_LIMITS`, `plans.ts`, `IMPORT_FORMATS`,
`MAX_SNAPSHOTS`, `DESTINATIONS` and `legal.ts` so no figure on it can drift
from the thing that enforces it. `landing-page.tsx` is the fuller sixteen-tool
page beside it, still built and tested and currently mounted by nothing — the
same standing as the other finished-but-unreachable code below. Both are Server
Components. `/tools` is the second marketing page, over the pure
`tool-guide.ts`, and a test walks `ALL_TOOLS` so a tool cannot ship as a heading
over an empty column — **the proxy redirects it home under the launch flag**.

- **The MVP page may only name what the launch flag leaves reachable**, which is
  a harder rule than it sounds: three claims had to come off it while it was
  being written. Collaboration is gated (`/invite/[token]` goes home, so an
  invitation cannot be accepted), the reading view is gated, and the sixteen
  tools are gated. **`HIDDEN_BOOK_TOOL_PATHS` is the list to check before adding
  a sentence to this page.**
- **Its figures are five drawn screens** in `mvp-screens.tsx` — shelf, editor,
  versions, import, assistant — plus the export wizard's own `ExportScreen`. All
  six are markup at a fixed design mapped onto `cqw`, so the page ships no
  script beyond the header. **The drawn design is ~770px wide, not the 1000px
  `export-screen.tsx` uses**, and the note on `W` in that file records why: a
  1000px design in this page's figure column renders its body text at 8.5px.
  The hero is capped at `max-w-4xl` and the export at `max-w-5xl` for the same
  reason — the slot's measure *is* the zoom.

- **Every claim has to be true of the code**, and everything countable is
  imported and counted (`STEPS`, `PHASES`, `ALL_TOOLS`, `DESTINATIONS`, prices
  from `plans.ts`). Two long-standing claims failed that test and were fixed on
  2026-08-24: the footer's last line said *"Your manuscript stays in your
  browser"*, which signing in makes false, and `export-screen.tsx` drew "Step 7
  of 7" over five groups after the Preview step was added to every format.
- **No number a SaaS page would invent** — no user count, no rating, no
  testimonial, until there is a real one.
- **The figures are drawn in markup, never screenshotted**, and three are
  *computed* from the pure modules. The handful of bitmaps that remain are the
  standing exception and **start lying silently when the screen moves** —
  re-shoot them when the editor chrome or the ARC statuses change.
- **The hero carries the real check**, not a picture of one: the visitor's file
  is parsed in their own browser through the ordinary `importFile` path, findings
  go through `fromReadiness()` like every other screen, they are never held back
  for an email, and nothing is written until a press.
- **Each landing page pins its own ground on its root div**, and the two now
  differ: the MVP page is `[data-theme="dark"]` and `landing-page.tsx` is still
  `[data-theme="light"]`. **Neither may be removed rather than swapped** — with
  no attribute a page inherits whatever the bootstrap wrote on `<html>` from
  the visitor's `prefers-color-scheme`, so a visitor in daylight would get the
  light token set under the MVP's dark gradient hero. Both token sets stay live
  (the four legal pages read the dark one). Nothing else below either root may
  write that attribute.
- **`[data-theme="dark"]` exists only because of that**, and it is the mirror of
  the light block rather than a new idea: dark is `@theme`'s default on `:root`,
  which a subtree inside a light tree has no way to get back to. It is generated
  from `@theme`, states every property the light block states, and if you add a
  token to one of the three blocks you add it to all three.
- **An unbuilt feature must not be named on this page** — the section that used
  to admit them is gone.
- A `"use client"` module's exports become client *references*, so a Server
  Component importing an array from one gets `.map` of a reference object and the
  page 500s. That is why `sections.ts` and `type.ts` carry no directive.

### The app shell and the small pure modules — `docs/architecture/app-shell-and-modules.md`

**The root layout carries four things no screen owns**, because all of them are
facts about the app rather than about whichever screen noticed them:
`ViewportController` (the visual-viewport CSS variables, see the editor
section), `ThemeSync`
(applies `[data-theme]`, listens to `prefers-color-scheme` while the pref is
"system", runs the one-time theme migration), `LibrarySync` (runs
`syncWithServer()` once per mount, flushes queued pushes on `visibilitychange`,
and calls `askToPersist()`), and `StorageAlert`. **There is no splash screen and
one must not be reintroduced** to cover a load that is already instant —
`AppLoader` held every route but `/` for a second so a logo animation could
play, and it is gone. `loading-screen.tsx` survives it and is a plain spinner:
fine where a screen genuinely has nothing yet, never on a timer.

**The small pure modules are where the conventions of the trade live**, kept out
of components so they can be tested and changed in one place: `book-kinds.ts`,
`book-templates.ts` (chapter skeletons only — never boilerplate prose),
`search.ts`, `page-setup.ts`, `typography.ts`, `relative-time.ts`,
`use-typewriter.ts`, `plural.ts` (the third-copy rule — its irregular form is a
*parameter*, since English plurals are not derivable), `resume.ts` (which stores
nothing: the "where you left off" card is read back out of what already exists),
`account.ts` (a chain of fallbacks, taking whatever is in the JWT rather than a
typed user) and `auth-redirect.ts` (`safeNext()`).

**Feedback is a private channel**, and what it may carry is the whole design:
`authenticated` gets an insert and **no select at all**, so it is a suggestion
box rather than a forum. Nothing about the book is sent — no title, no word
count, and deliberately not the URL, because a URL here carries book and chapter
ids. The dialog lists exactly what goes above the send button; **add a field and
add it there too.**

### Routes

`/` — landing page for a signed-out visitor, the **dashboard** for a writer (six
areas, `?area=`), decided on the server off `getClaims()` so neither sees the
other's screen first; with no Supabase configured everyone gets the dashboard ·
`/signin` · `/signup` · `/forgot-password` · `/reset-password` ·
`/auth/confirm` (the far end of any emailed link) · `/tools` the tool guide
(public, and public is the point) · `/upgrade` plans (public — a price is read
before an account exists) · `/upgrade/checkout/[orderId]` → a form POST straight
to PayHere · `/upgrade/done` PayHere's return_url, which polls · `/billing` the
plan, payment method, assistant usage and invoice list (signed in only; display
only — the subscription row is written by the webhook and nothing else) ·
`/privacy` ·
`/terms` · `/refunds` · `/contact` (public, and public is the point) ·
`/book/new` · `/book/import` · `/book/[bookId]` book overview (lands here, not
on a chapter) · `/book/[bookId]/chapter/[chapterId]` editor ·
`/book/[bookId]/read` reading view · `/invite/[token]` (gated, which is what
makes the link a pointer rather than a credential).

The sixteen tools all hang off `/book/[bookId]/`: `export`, `roadmap`,
`paperback`, `listing` · `comps`, `blurb`, `categories`, `covers`,
`title-check` · `structure`, `prose`, `progress`, `provenance` · `money`,
`track`, `arc` — grouped there the way `book-tools.ts` groups them. **Under the
launch flag the proxy redirects all of them home but `export`**, along with
`/book/[bookId]/read`, `/tools` and `/invite/[token]`; `HIDDEN_BOOK_TOOL_PATHS`
in `launch.ts` is the list.

**API routes:** `/api/chat` · `/api/narrate` · `/api/transcribe` · `/api/comps` ·
`/api/comps/subjects` · `/api/comps/query` · `/api/comps/rank` ·
`/api/comps/categories` · `/api/comps/keywords` · `/api/comps/keywords/chat` ·
`/api/blurb/critique` · `/api/blurb/workshop` · `/api/export/pdf` ·
`/api/billing/*` (`subscription`, `cancel`, `resume`, `history`, `notify`,
`paddle/checkout`, `paddle/notify`, `paddle/update-payment-method`). All except
`/api/comps`, `/api/comps/subjects` and `/api/export/pdf` are metered and gated
by `requirePro()`. **Under the launch flag every model route answers 404
first**, the two free comps routes included — the paragraph below describes the
design, not what is currently reachable. The first two are
free, keyless and stay that way; the third is free **on purpose and for good** —
export must never move behind the plan — but it is not anonymous, since it
launches a browser on markup a caller supplied: it takes `requireSignedIn`
instead. The two comps routes are free, keyless and stay that way —
which is the whole reason the model steps around the comps search (query, rank,
categories, keywords and the keyword chat) are routes of their own rather than
flags on it.

## Styling — `docs/styling.md`

Tailwind v4 with the palette declared in `@theme` in `src/app/globals.css`.
Colours are named for their *job* (`surface`, `panel`, `raised`, `line`, `fg`,
`muted`, `accent`) so a hue change doesn't make class names lie. The writing
surface has its own layer — a `[data-paper]` attribute re-points `--paper-*` —
and `page-setup.ts` / `typography.ts` turn a book's settings into `--ms-*`
custom properties the editor and the reading view both read.

- **One greyscale palette in two values.** The dark set is the `@theme` block and
  the default; `:root[data-theme="light"]` re-points the same names. Dark inverts
  light's elevation logic (lifted by a hairline, since a shadow on black is
  invisible), which is why `raised` crosses over between the blocks.
- **Every token stated in one block must be stated in the other.** A name in only
  one keeps its dark value in daylight, and it will be a hairline nobody notices
  for a month.
- **The theme decides colour, never layout.** No
  `[data-theme="light"] .thing { padding: … }`, or the two become two designs.
- **`prefs.theme` is `system` | `light` | `dark`**, resolved onto
  `<html data-theme>` by the bootstrap script before first paint; `ThemeSync`
  carries every change after that and listens to the media query while the pref
  is "system". **Do not use Tailwind's `dark:` variant** — it keys off
  `prefers-color-scheme` and would ignore a writer who chose against their system.
- **A filled action carries `text-accent-ink`**, never a literal `text-white`:
  the fill is white at night and near-black by day. `bg-danger` and the matter
  fills each carry their own `-ink` token for the same reason.
- **In daylight the accent is the brand indigo; at night it is white.** One hue
  is reserved for *"this is the way forward"* and **nothing else in the chrome
  may spend a hue.**
- **The status family keeps its colour on purpose** — `ok` / `note` / `stop`,
  each a `-bg`, `-line` and `-fg` token, because there the colour *is* the
  information. The dashboard's ladder is four wide: red is blocked, amber is
  worth doing, green has passed, indigo is the road — and the button inside a red
  card stays indigo, because it is the way out.
- **The documented exceptions are a closed list**, each with its reasoning in
  `docs/styling.md`: `--color-upgrade-*` (the one gradient), the pricing table's
  value badges, `--color-wordmark`, the sixteen tool marks, `--color-sheet`
  (paper, stated identically in both blocks because a picture of paper stays
  literal), and the landing page's `lp-*` set. Do not add a sixth.
- **`src/components/ui/` is deliberately narrow** and things land there on the
  third copy, not the first. Primitives take `currentColor`.
- **`assistant-reply.tsx` over the pure `markdown.ts` is what every assistant
  panel prints with.** The parser returns **data, never HTML** — nothing
  downstream may reach for `dangerouslySetInnerHTML` — a link keeps its words and
  loses its destination, and the clipboard gets the words without the notation.

`<body>` is `overflow-hidden` (for the editor shell). A standalone scrolling page
therefore needs `h-dvh overflow-y-auto` — `min-h-dvh` puts content out of reach.

## House rules

- **No dead UI.** A control either works or plainly says it isn't built. Don't
  copy chrome from a reference and leave it inert.
- **No claim the code can't back**, which is the same rule pointed at words
  instead of controls. The landing page, the pricing rows, the FAQ and the tool
  descriptions in `book-tools.ts` are held to what ships — the print PDF is the
  browser's print engine and is *not* print-ready in the trade sense, and every
  page that mentions it says so. When a design or a reference promises something
  we don't do, cut the promise rather than reword it.
- **No invented number.** No score, no grade, no rating out of a hundred, and no
  figure derived to look like a measurement. Where a figure is directional it
  says where it came from; where it cannot be known honestly (a break-even count
  with no royalty rate, a finish date off a shrinking manuscript) the screen
  says nothing rather than something plausible. Report facts, never verdicts —
  the people selling verdicts to this audience are the ones it has been burned
  by.
- **The assistant reads and reports; it never writes into the book.** Same rule
  behind the prose report having no rewrite button. Two features are ruled out
  on this ground and stay ruled out: AI-generated covers and AI editing. See
  TODO.md.
- **The Help dialog is documentation and goes stale like documentation.** When a
  feature ships, add it to the `SECTIONS` list in `shelf/help-dialog.tsx` — it's
  the only place in the app that explains what exists.
- **Some code is finished, tested and reachable from nothing, on purpose. Do not
  tidy any of it away**, and read `TODO.md` under "Taken out on purpose" before
  putting any of it back — several entries record claims on other pages that
  have to return in the same commit.
  - **Templates** (`templates-dialog.tsx` + `book-templates.ts`) and **background
    sound** (`ambience.ts` + `use-ambience.ts` + `sounds-dialog.tsx`) — their
    shelf buttons are gone, so adding a rail item that opens the real dialog is
    the whole of switching either on.
  - **The audiobook export** (`/api/narrate`, `export/narrate.ts`,
    `export/audiobook.ts`) — the card came off the export page on 2026-08-14.
    Four pages had claims reworded and `/privacy` lost its Narration entry;
    those return with it.
  - **The export wizard's four review panes** (`review-pane.tsx`,
    `preview-sheet.tsx`) — unhooked 2026-08-17; a Preview step showing the
    reading view stands in their place, and it cannot check the packaged file.
  - **The categories screen's subject picker** (`categories/subject-combobox.tsx`),
    kept whole for the rebuild it is owed; `/api/comps/subjects` is the route it
    will reach for.
  - **`coming-soon-dialog.tsx` and `Badge`** in `bookshelf.tsx` — what the next
    half-finished feature announces itself with.
  - **The previous landing design and the order road** (`landing-nav.tsx`,
    `publishing-check.tsx`, `sections.ts`, `path-scroller.tsx`, the drawn figure
    modules, `landing-path.ts`, the drawn `phase-screens.tsx`, and `WorksWith()`
    in `works-with.tsx`, whose `DESTINATIONS` export *is* still live). Treat the
    old design as reference rather than as something to wire back up unchanged.
  - **`ChapterMeta.matterKey`**, left over from the one-page matter design and
    read by nothing — books written before the change still carry a combined page.
- Storage limits are real: covers capped at 250KB, inline images at 900KB,
  import at 8MB. `setCover` and `createBookFromImport` fail cleanly and return a
  signal; honour it. **The caps stayed after the manuscript moved to IndexedDB**
  and are no longer about the origin's five megabytes — they are about what
  belongs in a manuscript. A cover is re-encoded to 700px for the shelf whatever
  the source, so a bigger upload buys nothing there (the full-size copy has its
  own store); a 900KB picture inline is a picture that makes the file slow to
  open in a reader; and an 8MB import is well past any real novel and is the
  line between a manuscript and a mistake.
- `TODO.md` tracks pending work and records *why* things were cut (e.g. front/back
  matter, per-chapter status). Read it before rebuilding something that looks
  missing — it may have been removed on purpose.
