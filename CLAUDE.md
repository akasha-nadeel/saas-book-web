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
server-rendered PDF, and the title check sends only words the writer typed.

**As of 2026-09-14 OpenChapter has no AI, and that is a product promise, not a
gap.** The writing assistant, every model route (blurb, keywords, categories,
comps ranking and query translation, narration, transcription), the credit
ledger and the Starter Pass were deleted, and the site says "No AI" out loud.
Nothing in `src/` calls a language model; `@anthropic-ai/sdk` and `ai` are no
longer dependencies. **Do not add a model call, an AI SDK or an "assistant"
back** — that is a reversal of the pitch, not a feature, and it needs the owner's
decision first. Voice typing stays: it is the browser's own `SpeechRecognition`,
and `/privacy` says Chrome sends its audio to Google. The decision and the
competitor pricing behind it are in
`docs/plans/2026-09-14-ai-free-pro-plan-design.md`.

**`TODO.md` is the canonical statement of that direction** — what shipped and
why, what each feature deliberately refuses to do, and what was ruled out
(marketplaces, AI of any kind) so it is not re-proposed. Read it before
proposing a feature or rebuilding something that looks missing.

## The launch MVP is smaller than this file — read `src/lib/launch.ts` first

**As of 2026-08-22 the shipped product is a gate over the codebase this file
describes.** Most of what follows is built, tested and *currently unreachable*.
Nothing below is stale as a description of the code; it is stale as a
description of what a writer can open. Check `src/lib/launch.ts` before
assuming a screen or a route is live.

- **`src/lib/launch.ts` is the one statement of what the MVP sells** — prices,
  free/Pro limits, and `HIDDEN_BOOK_TOOL_PATHS`, the thirteen segments the proxy
  redirects home. `/tools` and `/invite/*` go home with them. Its sibling
  `launch-server.ts` is the API half: `launchFeatureEnabled()` gates a route and
  `hiddenLaunchApiResponse()` answers **404** rather than 501 or 402.
- **The flag is off by default and inverted.** `launchFeatureEnabled()` is
  `process.env.OPENCHAPTER_LAUNCH_MVP === "0"` — unset means the full product is
  hidden. It is in `.env.local.example` (commented out) with the same warning
  as the next point.
- **The flag governs the API half only — the page half has no flag.**
  `src/proxy.ts` calls `hiddenLaunchRoute()` *unconditionally*, before it looks
  at anything else; `launch.ts` reads no environment at all. So setting
  `OPENCHAPTER_LAUNCH_MVP=0` un-404s the gated API routes (only
  `/api/comps/subjects` since the model routes went) and leaves every hidden
  screen still redirecting home. **To work on a gated tool locally, take its
  segment out of `HIDDEN_BOOK_TOOL_PATHS`** — the env var will not do it.
- **What is live**: the shelf, `/book/new`, `/book/import`, the editor,
  `/book/[bookId]/export`, `/book/[bookId]/consistency`,
  `/book/[bookId]/title-check`, and since 2026-09-15
  `/book/[bookId]/paperback` and `/book/[bookId]/provenance` (the writing
  record), plus Ideas in the dashboard's side panel, upgrade/billing and the
  legal pages — and `/api/comps`, which was un-gated on 2026-09-02 because it is
  the route the title check runs on.
  **What is gated**: `/api/comps/subjects` and the twelve other tool screens.
  Advance copies, the Story bible panel and the editor's Ideas tab were live
  for a day on 2026-09-15 and the owner took them back out.
- **`launch.ts` holds three more decisions this file used not to name.**
  `onFreePlan(plan)` is the one
  three-part test for *known to be metered* — `!loading && billing && !pro` —
  written once so it cannot go missing a part in a fourth call site.
  `trashedBookClosed()` reads the **book**, never the
  shelf view, so a pasted editor URL and a card press answer the same question.
  **`PLANS_ON_SALE` is false since 2026-09-07**: Paddle is configured with live
  prices, but no checkout has been proven end to end, so every paid button
  opens "Available Soon" and the press is recorded (see Billing).
  **Never take the plans off sale by unsetting the Paddle variables** — with
  `billingConfigured()` false there are no plans and nothing is held back, so
  every writer gets Pro for nothing, which is the state production sat
  in from 2026-08-23 to 2026-09-07 while six renamed price ids went unset. The
  gate goes over the buttons; the billing config stays intact underneath.
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
| Why there is no AI, and the Free/Pro decision | `docs/plans/2026-09-14-ai-free-pro-plan-design.md` |
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

`docs/plans/` holds the original design notes for the bookshelf, export, the
Supabase persistence design and the mobile editor's chapter icon
(`2026-08-22-mobile-editor-chapter-icon-design.md`, with the implementation note
under `docs/superpowers/plans/`). `docs/checks/` holds the SQL that verifies the
RLS policies. Read the relevant one before reworking any of them.

**`README.md` is not one of these.** It is still the untouched `create-next-app`
boilerplate and describes nothing about this app — do not read it for facts, and
do not treat its absence of a subject as a gap to fill unless somebody asks.

## Commands

- `npm run dev` — dev server (http://localhost:3000). The script is
  `set NODE_OPTIONS=--max-old-space-size=4096 && next dev`, which is **cmd
  syntax and fails in a POSIX shell** — from bash run `npx next dev` instead.
  The heap bump is what the `set` is there for; keep it on Windows.
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
- `node scripts/cut-illustration.cjs <source> <out.webp> [width]` — lifts the
  two dashboard illustrations off their background (`public/upgrade-card.webp`,
  `public/write-band.webp`). Also one-shot, also reads sources from outside the
  tree, and it needs `sharp`, which is **not a dependency** — install it by hand
  to run this.
- `assets/social/*.html` — social-post generators (e.g. an eight-slide
  1080×1350 carousel) drawn on canvas and saved as PNGs. Open the file in a
  browser; no dependencies, no network, not part of the build. Its palette is
  copied from `globals.css`, so it goes stale when the tokens move.

The suite is 107 files / 2,048 tests and takes about a minute and a half
(measured 2026-09-15 after the Free/Pro redraw, all green, run on its own); jsdom prints `HTMLCanvasElement's getContext()` warnings
from the image recoder and `Not implemented: navigation to another Document`
from the routing tests — both are expected, not failures.

**A green exit code is not a green suite.** Under load — running `npx tsc
--noEmit` alongside it is enough — Vitest's forks pool times out starting
workers, prints `Failed to start forks worker`, **skips those files, and still
exits 0**. One run here reported 97 of 104 files that way. Read the
`Test Files N passed` line rather than `$?`, and don't run the suite and a
typecheck at once. Tests live beside
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
thousands of bundled files, and `npm run lint` reports thousands of problems.
`.gitignore` and `eslint.config.mjs` now both exclude `/.shot-app/` and
`/.reference/` (local upstream checkouts, reference only), so a four-figure
count is still noise rather than news.

**`src/` no longer lints clean, and the doc used to say it did.** As of
2026-09-01, re-measured 2026-09-02 and 2026-09-14 with no change, `npm run lint`
reports **7 errors and 11 warnings**, all in four files: `components/ui/tremor.tsx` (six `no-explicit-any`),
`components/editor/search-panel.tsx` (one `set-state-in-effect` error plus three
warnings, all in its head), `components/shelf/bookshelf.tsx` (four unused-var
warnings — the banner sections `95386a2` removed and left behind) and
`components/editor/book-panel.tsx` (four unused imports and props left by the
Book View deletion). `npx tsc --noEmit` **is** clean. Treat that count as a debt
to clear, not as the normal state.

**The count moves, so re-measure before blaming a change for it.** This said
7 errors and 14 warnings across a different four files on 2026-08-31;
`mobile-editor-header.tsx` has since gone clean, `bookshelf.tsx` dropped six,
and `book-panel.tsx` gained four that nobody recorded. The errors have not
moved.

Every environment variable is optional and documented, with its failure mode,
in `.env.local.example`. That file is the canonical list — read it rather than
grepping for `process.env`, and add a variable to it in the same commit that
first reads it. Two have gone missing before: the six renamed
`PADDLE_PRICE_<TIER>_<CYCLE>` ids sat unset in production for fifteen days, and
`PADDLE_PRICE_STARTER_PASS` is a switch that turns on a live buy button (see
Billing). **Some variables are switches, not settings** — read the entry before
filling one in.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Tiptap 3 editor · `docx` + `jszip` for exports. No AI SDK of any kind. Path alias
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
is not finished does not go in it. **It holds five entries in three groups** —
the Title check (`LOOK_OUTWARD`), the Consistency check (`READ_IT_BACK`), and
Export, Paperback setup and the Writing record (`GET_IT_OUT`) — because the
list is what the dashboard, the book card's
⋯ sheet and the landing page all read, and the MVP may only name what is
reachable. (`1daca70` cut it to Export alone; the consistency check was added
on 2026-08-27 as the second live tool, and is the only one of the seventeen
written *for* the MVP rather than un-gated into it; the title check was
un-gated on 2026-09-02 as the third; paperback setup and the writing record on
2026-09-15, ranked first by that day's research into what writers complain
about — advance copies came in with them and went back behind the gate the
same day.) **`GET_IT_OUT` is exported by name as
well as through `TOOL_GROUPS`**, because Overview shows that one group on its
own and a lookup by title would have made the block vanish silently the day
somebody renamed it. `src/lib/tool-guide.ts` carries one guide per entry. The
twelve older tool *screens* still hidden are all in the tree under
`src/app/book/[bookId]/` and `src/components/`; bringing one back is an entry
here, an entry there, and a line off `HIDDEN_BOOK_TOOL_PATHS`.

**The dashboard's side panel, in the owner's order** (2026-09-15): Overview,
Write, Favourites, Archived, a rule, Title check, Ideas, Paperback, a rule,
Trash. No group heading — the rules separate the book lists from the tools, and
Trash stays last. `RAIL` holds `{ divider: true }` rows for them. Paperback
uses the shared frame `BookToolArea` and book picker `WorkingOn` (out of
`Tools`, where it was first written), mounting `PaperbackPage` with `embedded`
as a `dynamic` chunk inside the same child override `TitleCheckArea` uses;
Ideas mounts the editor's `IdeasPanel`. The writing record is reached from the
Export screen's Format step and the export-done dialog rather than from the
rail. **How it works, Support, Send feedback and Pricing sit at the foot of the
side panel**, under a rule; they were tried in the top bar beside New book for
part of 2026-09-15 and the owner moved them back.
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

### The catalogue search, and no model routes

**There are no model routes.** `docs/architecture/ai-and-model-routes.md` was
deleted with them on 2026-09-14; what survives of that cluster is the free,
keyless catalogue search.

**Two free catalogues sit behind `/api/comps`** (Google Books and Open Library),
server-side for a shared cache and to keep a reader's browser off two third
parties. Records merge **field by field** on ISBN, or title-plus-author.
**The manuscript never goes** — what leaves is a query. `/api/comps` is live
because the title check runs on it; `/api/comps/subjects` is behind the launch
flag and answers 404.

- `openLibraryQuery()` translates dialects: Google wants `intitle:`, Open
  Library wants `title:`, and **Open Library answers an unknown prefix with zero
  results rather than an error** — which is how the title check silently read
  one catalogue for its whole life while the page claimed two.
- **No search volume, no competition score, no rank — anywhere in this
  cluster.** It cannot be had honestly; the modules have tests asserting their
  shape carries no such number, and those tests are not to be "fixed".
- **The comps screen searches and does not judge.** Its "Rank these" button and
  the translation of plain words into a catalogue query were model calls and
  are gone; the words in the box are the search.
- `src/lib/keywords/guide.ts` is the keyword knowledge with no model behind it,
  free and offline, and is what the (hidden) categories screen opens.
- **Voice typing is browser `SpeechRecognition`** (`use-dictation.ts`) — free,
  no key, Chrome/Edge only, and it is the one thing that sends audio anywhere.

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
- **A paragraph breaks between its lines; a list and a blockquote break between
  their children** (`SPLITTABLE` / `BY_CHILDREN`, and `itemsOf` beside
  `linesOf`). Everything else stays whole. Only `P` split until 2026-09-01, and
  a pasted document is mostly bullets: a list longer than a page could neither
  move nor break, so it overflowed its sheet — and that took the rest of the
  chapter with it, because the page origin stayed behind on the sheet the list
  began on and every later gap then worked out negative and was dropped. Prose
  ran straight over the seams and out through the margins for the whole
  remainder of the chapter. **`overflowPast` in `page-breaks.ts` is the other
  half**: a block that overhangs moves the origin on by whole pages, so a
  negative gap is impossible. `pageBreaks` therefore returns
  `{ spacers, pages }` — the sheet count is **reported, not `spacers.length +
  1`**, which is only right while every sheet is opened by a gap.
- **The selection bar owns the selection range** and puts it back inside
  `apply()`; `BarMenu` holds the placement, the portal, the upwards-only rule
  and the four ways out for both pickers. Font preview is a **decoration, never
  the mark**.
- **Inline images** store width as a percentage of the column; the resize
  arithmetic is the pure `image-resize.ts` and **must divide by the page zoom**
  (`PAGE_SCALE`) — the editor's other two measuring sites already do.
- **There is one bar across the top and one rail down the side** (2026-09-05).
  `editor-top-bar.tsx` is the application bar the editor never had: home, a
  File menu, undo/redo, the word count and the save state, the book and chapter,
  and Import/Export at the right. **The right-hand rail and the desk strip under
  the bar are both deleted** — `ToolRail` and `Flyout` with them, leaving
  `editor-toolbar.tsx` holding only `ALIGN_OPTIONS` and `useEditorState`, which
  four other components borrow. The pill and the dictation bar moved into the
  manuscript column *above* the scroller; inside it, the pill scrolls away with
  the page. The rail is wider and carries a word under each icon.
- **Manuscript is an ordinary tab of that panel** (2026-09-05), not a second
  panel in a slot of its own — `prefs.chapterSectionOpen` and the rail's whole
  chapter special case went with it. Choosing a page does not close the panel
  unless the panel is a modal, and the header's dismiss appears only in
  continuous layout, where the edge handle is off-screen at `100vw`; both are
  scoped by the **layout classifier**, never by a width breakpoint, because
  continuous is reached by height as well.
- **The rail lights the icon, not the button**, and selected is the accent on
  the mark rather than a deeper ground. **Only ever one tab at a time** — the
  Page card stands in the panel's slot, so a panel open behind it is open and
  not visible.
- **`prefs.focusMode` hides the chrome** — bar, rail, panel and the phone's own
  header and dock — leaving the page, the pill, the selection bar and one
  `fixed` button top-left. It **closes nothing**, so leaving it gives the panel
  back; it is stored, because a chapter change remounts the editor; and the way
  out is always drawn. The key is repurposed: it used to mean *dim every
  paragraph but the current one* and was written and read by nothing.
- **The two rules to the page sit between the panel and the paper** — panel 40,
  rules 41, `.pageflow` 42, rail 45 — and `.pageflow` gives its z-index back in
  continuous layout, where the panel is a full-screen overlay. They also **stop
  transitioning once they have arrived**: the 700ms ease is the entrance, and
  left on it made them trail two-thirds of a second behind a zoom gesture and
  float off the paper.
- **Tools is the one tab that is not the panel** (`editor/tools-popover.tsx`,
  key `page`). It opens as a strip of tools at the rail’s edge, because a dozen
  short settings rows in a 25rem full-height column is a panel three-quarters
  empty that pushes the manuscript sideways to be it. Portalled
  and `fixed` (the rail scrolls, and would clip it), ceilinged at the **rail’s**
  top rather than the window’s, and its Escape test runs in the **capture**
  phase — the pickers’ own menus listen on `document`, React flushes their
  close before a bubble-phase listener here runs, so asked on the way up
  “is a menu open” always answered no and one press shut both.
- **The strip is five tools and every one acts on the manuscript**
  (2026-09-16): Type, a picture, dictation, typewriter scrolling, paragraph
  marks. **Paper and theme went to the top bar** (`editor/paper-theme.tsx`) —
  it was the one tool there that changes how the *app* looks, three presses
  down, and the bar’s right-hand group already held the focus control under the
  same argument. It arrives as a `paperControl` slot, because that bar takes no
  editor and no prefs. Its popover is a settings card and not `ui/menu.tsx`
  (`role="menu"` over a swatch row is a lie), and its Escape is **ordinary** —
  nothing in it opens a portalled menu, which was checked; add a picker there
  and the capture-phase rule comes with it. **The link went to the selection
  bar**, where `bab1c3d` had already put one and left this copy behind.
  `PAPERS` is now one list, in `paper-theme.tsx`, imported by the phone’s
  `format-controls.tsx`, which keeps its own 44px touch swatches.
- **The left chrome is one slot, `--sidebar-width` wide, and the page stands
  beside it.** At most one thing in it is visible: the book navigator, a tool
  panel, or a tool panel over the navigator. `BookPanel` takes that width
  outright; `LeftPanel` stays `fixed` (it wants the window's full height, its
  slide from the rail's edge and the phone's scrim) and the `.oc-panel-slot`
  spacer in `chapter-editor.tsx` holds its place in the flex row — **only when
  the navigator is not already holding it**, or the page is pushed twice. The
  slot stands down below `md` and in continuous layout, where the panel is a
  modal over the page rather than a neighbour.

  **This reverses a rule that stood here for a long time** — *the tool panel
  floats over the manuscript; it does not push it* — and the reason is what a
  25rem sheet over a 6×9 page actually does: it covers the left margin and the
  first character of every line, so searching your book hides the book. The
  navigator **stays open behind an open tool panel**, so closing the panel puts
  the writer back where they were; the rail lights whichever is *visible*, and
  pressing Manuscript while something covers it closes the cover rather than
  the navigator (`toolPanelOpen` in `workspace-rail.tsx`). The connector rules
  go with it: `connectToPage` is false while a panel is over the navigator, or
  they run out from behind it pointing at a card nobody can see.
- One header for all the tabs, four ways out that are one toggle, and
  `LeftPanel` owns its own mounting so it can animate out. **The tabs are named
  once, in `src/lib/panel-tabs.ts`** — chapters, search, consistency, notes,
  ideas, bible, bookmarks, page, history, trash, of which `page` is
  the card and the other nine are the panel — and not in the panel,
  because which tab is open is a stored preference and `library-store.ts` needs
  the type without importing a `"use client"` component. The rail owns the
  order; that module owns the words.
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
- The matter question is put once, in `/book/new`'s front and back steps; Skip
  is a real answer and nothing is created until a press. **The editor's own
  popup asking it (`matter-setup-dialog.tsx`) was deleted on 2026-09-15** —
  the Front matter and Back matter cards already hold a switch for every page,
  so it asked a second time over the manuscript. `shouldAskMatter` and
  `rememberMatterAsked` stay in the store, tested; nothing in the editor reads
  the first any more.
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
- **There is no screen of a book without a page on it, and there must not be
  one.** `/book/[bookId]` is a redirect into the last chapter opened
  (`lastOpenedId`, else the first chapter with words, else the first chapter,
  else home — `659c706`), and the editor's own **Book View was removed on
  2026-09-01**: a panel face that showed the cover, two page steppers and a
  guide where the manuscript had been. It went because the panel and the middle
  of the window were then describing two different things — the book as an
  object on one side, nothing at all on the other — and the only way in was a
  chevron in the panel's header that nobody was looking for. `book-guide.tsx`,
  `book-overview.tsx` and `page-preview.tsx` were deleted with it, along with
  the `bookPanel` pref, `BackToBooks`, and the `[data-matter="book"]` sheet
  edge. **The panes live in the pages rather than in
  `book/[bookId]/layout.tsx`**, because the left panel needs the chapter id and
  the tools need the editor instance; the import banner is the one
  exception and does live in that layout.
- `book-panel.tsx` is the navigator and has **one face** (front/body/back as
  cards, each opening into a list — chapters in the body, the sixteen divisions
  with their switches in the other two). **Which card is open lives in
  `useOpenPart`, called by the *screen*** — the page sheet's edge takes the
  colour of the selected part, and two copies of that state would be two
  answers to one question.
- **The two rules from the selected card to the paper are portalled and
  `fixed`** (`PageConnector`). They were `absolute; left: 100%` inside the card
  and were cut off at the panel's edge, a third of the way to the page. The
  panel sits between two scroll containers and an animating rail, and any one
  of them can clip a box that leaves it; fixed and portalled, nothing between
  the card and the paper can. `sidebar/row-menu.tsx` is out of the same drawer.
  The distance is measured every animation frame from the card's own right edge
  to the first `.pageflow-sheet` — a `ResizeObserver` sees a box change *size*
  and most of what moves the page changes only its *position*.

### The reading view — `docs/architecture/reader.md`

`book-pages.tsx` is the setting and `book-reader.tsx` is the window; the export
wizard's Preview mounts the same setting, so two copies would be two books.
**Prose is not re-laid out** — each chapter goes through the export path
(`toBlocks` → `blocksToXhtml`), so the read-through, the PDF and the EPUB match.

- **`paginate()` in `reader/page-flow.ts` backs the reading view and the
  flip-book alike.** Keep them on the one function. It measures outside any
  `zoom` wrapper and re-runs once the manuscript font **and the pictures** have
  settled. **A list is opened out into its items before it is measured**, so a
  pasted thirty-bullet list breaks between entries instead of being one block
  taller than a sheet that `.reader-page`'s `overflow: hidden` then cut off;
  the editor splits lists the same way, and the two must not answer differently
  about one manuscript.
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
  which trusts the cookie. It skips `/api` on purpose, so each route checks for
  itself (`/api/export/pdf` through `requireLaunchExport`).
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
- **A hard delete leaves a tombstone, because that rule drops one.** `flush()`
  clears the whole queue when it finds no session, so a `book:<id>` delete made
  in that window was lost and the next download handed the book back — the
  writer deletes it, it returns, and deleting it again repeats the cycle. So
  `pushShelfDiff` records the id at **`openchapter:deleted`** (local-only, never
  synced, own books only) and `reconcile` settles the list against every
  download: still on the server → delete it again now there is a session; gone
  from the server → forget it; older than **90 days** → give up either way.
  `keepLocalOnly` filters the download while a tombstone stands, which is the
  half that keeps the book off the shelf in between. `push-deletes.test.ts`
  covers it, and three of its four cases fail without the readers.
- **The mapping narrows values on the way out** — `localStorage` holds whatever
  older versions left there and the database has CHECK constraints and NOT
  NULLs; one stale field would otherwise abort a whole library upload.
- **A browser is shared, so the cache is owned**: `clearLocalLibrary()` wipes
  every `openchapter:` key when a different account signs in.
- **A new column `fetchLibrary` selects must degrade when its migration is
  absent** — PostgREST refuses the whole select for one unknown column, so the
  entire library download would fail for everybody.
- **Schema changes belong in `supabase/migrations/`**, not only in the
  dashboard. There are **sixteen**. The first seven were confirmed applied live
  on 2026-08-20; the eighth through the sixteenth
  (`20260822071735_launch_mvp_entitlements.sql` through
  `20260915000000_free_three_books.sql`) have not been confirmed here, so check
  before blaming a route. **The fifteenth must be applied before the code that
  ships with it**: the app reads `subscriptions.plan` as `free | pro` only, so a
  row still saying `writer` reads as Free. **So must the sixteenth**: the app
  offers a second and third free book as soon as it ships, and the old trigger
  refuses them. It has happened:
  `20260801000000_feedback.sql` sat unapplied from the day it was written, and
  the feedback dialog failed for every writer until it went in. Check rather
  than assume: `select to_regclass('public.<table>')`.
- **A table written by nothing but the server still needs a grant to
  `service_role`.** This schema never leans on Supabase's default privileges;
  every server-written table names the role (`book_members`,
  `plan_interest`). The first `plan_interest` migration granted nothing, and
  every press failed with `42501 permission denied for table` — which reads
  nothing like an RLS refusal, so log the error code in full.

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
- **`/billing` is the account seen from the money side** — plan, card,
  invoices, and cancellation last so nobody lands on it by accident. It
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
- **There are two plans, Free and Pro, and `src/lib/billing/tiers.ts` is where
  they are named** (2026-09-14). `PlanTier` is `free | pro` — `tierAtLeast`
  compares positions in `TIER_ORDER`, so a tier inserted in the wrong place opens
  or shuts every gate above it. `TIER_LIMITS` is the one TypeScript statement of
  what each plan gives, and it now holds one field, `books`; `TIER_NAMES` is the
  one place the words are written. The module is pure and imports nothing, so a
  Server Component, a client component and `library-store.ts` can all read it.
  There were four (Free, Draft, Writer, Studio) and the paid three differed only
  by assistant credits, so removing the AI left three identical products; the
  migration folds every retired row into `pro`, and `asTier` refuses the old
  names rather than mapping them.
- **Pro buys six things since 2026-09-16**, and `plan-rows.test.ts` pins the
  list: unlimited books (Free holds **three**); unlimited title checks (Free
  runs **three a day**, `FREE_LIMITS.titleCheck`); unlimited parked ideas (Free
  parks **five at a time**, `FREE_LIMITS.ideas` — occupancy, so forgetting one
  makes room); all **11** consistency checks (Free runs **5**, `FREE_CHECKS` in
  `consistency-ids.ts`, and is told how many things the other six found); the
  writing record's **twelve months** with its fingerprint (Free reads the last
  **30 days**, `FREE_RECORD_DAYS`, and the file says so); and **paperback
  setup, which Free does not get at all** — `PaperbackPage` opens `GatedTool`
  and the dashboard's Paperback area draws `ProCard`, and it is the one row
  allowed to say "Not included". **Only the book count is enforced by the
  server**; the rest are
  browser gates through `onFreePlan` / `useLimitGate` / `useEntitled`, which the
  owner chose knowingly. Nothing a writer typed is hidden by any of them — the
  log keeps recording, parked ideas past five stay — so upgrading opens what
  already exists. (The story bible's series view and unlimited advance readers
  were Pro rows for a day, until both tools went back behind the gate.)
  **A Pro row says so before the press.** `components/upgrade/pro-badge.tsx` is
  the one badge — the upgrade gradient, 10px uppercase, no plan logic inside it
  because six render at once in the check picker — worn by the rail's Paperback
  row (`AREAS` carries `pro`, both rails read it) and by a locked consistency
  check. Every caller decides with `onFreePlan`, so it is absent for Pro, absent
  while the plan is unknown, and absent where no gateway is configured.
  **Both pricing cards list every row of the comparison table their plan
  includes**, in table order (`plan-highlights.ts`); `plan-highlights.test.ts`
  fails if a row reaches the table and not the cards.
  Everything else — imports, sync, all three export formats, unlimited words and
  chapters, voice typing — is on both plans.
- **The pricing cards are drawn to a reference design** (2026-09-16):
  `plan-card.tsx`, `plan-button.ts` and `period-toggle.tsx` wear their own
  `price-*` palette (day and night) and Roboto (`font-pricing`, loaded with
  `preload: false`), the seventh entry on the closed list in `docs/styling.md`.
  The struck price is the real monthly price, shown only on the annual cycle;
  the tab says "Recommended", not "Popular"; the subtitle keeps the reference's
  pale grey by the owner's choice, and the feature lines were raised.
- **Prices live once in `plans.ts`: Pro is $5.99 a month or $49.99 a year** —
  30% off, the top of the band `plans.test.ts` allows, with the per-month figure
  divided from the total rather than typed. Priced backwards from a floor of $5
  kept per monthly sale after Paddle's 5% + 50¢ ($5.99 keeps $5.19) and under
  the AI-free apps that give more (WriteO $9.49/mo, Novlr Starter $8/mo yearly,
  Plottr $9.99/mo); the design note has the research. **USD only.**
  `uniformAnnualSaving()` still guards the one "Save" badge. **A price change is
  three edits**: this table, *new* prices in Paddle's catalog (never an edit of a
  live one), and the resulting env ids — **two of them**,
  `PADDLE_PRICE_PRO_MONTHLY` and `PADDLE_PRICE_PRO_ANNUAL`, both required by
  `isPaddleConfigured()`.
- **Export is free on both plans, and *export must never move behind the plan*
  is the rule.** The launch MVP sold EPUB and PDF as the two things Pro
  bought; that was undone on 2026-08-27, because a writer has to be able to take
  the book and go and a tool that holds the finished file back is the thing this
  trade's writers check for first. `freeExports` and `proExports` carry the
  same three formats, and the pair stays as a pair so the decision has somewhere
  to live and narrowing it is still one edit. **`launch.test.ts` pins it** —
  nothing else would notice the array changing, and `exportAllowed(format, pro)`
  keeps its **boolean** signature deliberately — teaching it what a tier is would
  make narrowing it a plausible edit again.
- **While `PLANS_ON_SALE` is false, every press on a paid button is recorded**
  rather than lost. `notePlanInterest()` (`src/lib/plan-interest.ts`) is the
  one caller-side function, and it sends with `sendBeacon` first because the
  landing page's buttons are `<Link>`s that navigate on the same press and
  would cancel a `fetch`. `/api/plan-interest` is public on purpose (the
  signed-out press is the interesting one), so it guards itself by shape:
  **three enums and no free text** (`pro`, the cycle, the source), always `{ ok:
  true }`, and the row written through `createAdminClient()` so `anon` still
  has no grant. One alert mail per plan per cycle per hour goes to
  `PLAN_INTEREST_ALERT_EMAIL`, falling back to `CONTACT_EMAIL`. **The cap
  counts rows with `alerted_at` set**, which is written only after the mail
  provider accepts the message. Two earlier caps failed because they counted
  something next to the fact: Resend's idempotency key (a 24-hour window, and
  a 409 when the body differs) and plain row counts (presses, not alerts,
  which silenced the one plan never mailed about). `/privacy` names the record.
  The table's CHECK still admits the retired tiers and the Starter Pass so rows
  recorded before 2026-09-14 stay valid; the route writes only `pro`.
- **A plan change says what it will charge before it charges.** With one paid
  plan, a change is a switch of cycle.
  `/api/billing/paddle/change-plan/preview` returns Paddle's own
  `previewUpdate` figure — never a difference worked out from `plans.ts`,
  because an annual switch charges the whole prorated year — $68.61 under a
  $7.98 heading, when the plans had other prices — and "roughly right" is an
  invented number. The button is two
  presses. A preview that fails does not block the change and says so in its
  own `failed` field, since "nothing to pay today" and "we could not find out"
  are opposite things to tell somebody about to spend money.
- **A declined card is a 402, not a 502.** `isPaddleDecline` sits beside
  `isPaddleSetupFault` in `billing/paddle.ts` because they point at different
  people — a decline is the cardholder's to fix, a setup fault the owner's —
  and `change-plan-button.tsx` reads the **status**, not the wording, to decide
  whether to draw the link to `/billing`. Codes go into either set once they
  have been seen.
- **The one limit enforced on the server is the book count.**
  `requireLaunchExport()` (`billing/launch-entitlements.ts`, all that file holds
  now) only checks for a session — free is not anonymous, since
  `/api/export/pdf` launches a browser on markup a caller sent — and the free
  book limit is a **Postgres trigger** (`enforce_launch_book_limit`) rather than
  a browser count. `new-book-form.tsx` mirrors it in the UI; the trigger is what
  enforces it. **The number is stated three times and they must move together**:
  `LAUNCH_LIMITS.freeBooks`, `TIER_LIMITS.free.books`, and the trigger body,
  whose current value (**three**) is set by the sixteenth migration.
  `launch.test.ts` reads that migration and fails if the SQL and the TypeScript
  disagree. `requirePro`, `requireTier`, the credit ledger (`ai_credits`,
  `claim_credits`, `refund_credits`), `ai_usage` and the assistant reply
  functions are all gone — the migration drops the SQL half.
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
  restores Postgres then refuses. **A book shared *with* this writer counts on
  neither side**, which the browser got wrong until 2026-09-01: the trigger
  counts `where b.owner = new.owner`, so a shared row has never spent one of
  the owner's slots, while `booksAgainstPlan` counted every book on the shelf —
  so accepting two editor invitations appeared to eat two slots, and a writer
  with three of their own was refused a fourth the server would have taken.
  **An edit to a book already counted is never refused**, so a writer over the
  limit (a lapsed Pro subscriber) keeps writing in every book they have; they
  only cannot start or restore another.
- **A limit gate must never fire while the plan is still unknown.** `usePlan()`
  starts at `UNKNOWN` (`loading: true`, `pro: false`) and asks the server on
  mount, so for the width of one request a Pro account looks exactly like a free
  one. Both gates read `(plan.loading || plan.billing) && !plan.pro && …`, which
  *gated during that window*: landing on `/?area=write` and pressing Restore
  before the answer arrived told a writer with unlimited books there was no
  room. It is `!plan.loading && plan.billing && …` in both places now. Not
  knowing yet is not a reason to refuse, and the server is the real enforcement.
- **A whole Pro *screen* draws neither answer while the plan is unknown**
  (2026-09-16), which is the rule above pointed at a screen rather than a
  press. `useEntitled()` answers true while the fetch is in flight, so
  `PaperbackArea` and `PaperbackPage` drew the tool and then replaced it with
  the offer a moment later — the flash a free writer actually sees. Both now
  take the three answers `onFreePlan` distinguishes: loading draws a quiet
  placeholder the size of what follows, metered draws the offer, anything else
  draws the tool. **Waiting is the only state that flashes nothing at
  anybody** — drawing the gate instead would show a paywall to somebody already
  paying. `useEntitled()` itself is unchanged and right where it is used, on a
  card inside a screen the writer already has (`BookCurve`).
- **`free-limits.ts` is the earlier metering policy and much of it is asleep** —
  most tools it gates are ones the launch MVP hides. The seats row is on a live
  path (`ShareDialog` still opens from the editor and the
  Collaborators area, while **`/invite/[token]` redirects home**, which is worth
  knowing before debugging an invite that cannot be accepted). It stays because
  it is the design to return to, and its shapes are still the house rule for
  anything metered in the browser. **The title check row is live**, and it is
  one of the things Pro sells; `FREE_RECORD_DAYS` sits beside it:

  | Shape | Tools | Free |
  |---|---|---|
  | **Per day** | comps, covers, title check | 3 / 3 / 3 a day |
  | **Per book** | blurb, prose report, track | 5 / 6 / 2 books |
  | **By occupancy** | ARC readers, seats | 10 a book / 2 a book |
  | **Held, across the library** | parked ideas | 5 at a time |

  There was a fourth, **in total, for good**, for work that cost a model call
  per press; it went with the AI. `onThisBook` means a book already counted is
  never blocked; the daily
  reset lives in `dailyAllowance` and not in the parser; **every limit is spent
  on a press, never on arrival**; the counters live in `prefs`; `warnAt` caps the
  warning at `limit - 1`. The words must match the shape, and tests enforce it —
  a limit that does not come back may not say "today" or "tomorrow".
- **`LimitDialog` fires on the press that is refused, never from an effect**, and
  the controls stay live so there is a press to refuse. `useLimitGate(ask)` is
  the one path, and `ask` is a discriminated union so the compiler refuses a book
  limit with no book.
- **These are browser gates and are honest about it** — nothing they guard
  costs money to run, and the book count is the one limit Postgres holds. Do
  not add a Pro row whose value depends on a browser gate being unbreakable.
- **Four legal pages exist because a gateway reviews the site signed out** — they
  are in `PUBLIC_EXACT` in `src/proxy.ts`, and `src/lib/legal.ts` states each
  fact once. **The privacy page names every route that sends anything**, so
  adding such a route is an obligation to add it there.

### The landing page — `docs/architecture/landing.md`

**`mvp-landing-page.tsx` is what a signed-out visitor actually gets**, and as
of 2026-08-24 it is a whole page rather than a placeholder: hero, the programs
a finished file opens in, three feature rows, the export, what leaves the
browser, the two plans, a FAQ, the closing ask and the footer. **It says "No
AI" in the hero, as the first FAQ and on both pricing cards**, and the FAQ names
voice typing as the one thing that sends audio anywhere — keep that sentence, or
the claim is no longer true. It sells the
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
- **Its figures are four drawn screens** in `mvp-screens.tsx` — shelf, editor,
  versions, import — plus the export wizard's own `ExportScreen`. All
  five are markup at a fixed design mapped onto `cqw`, so no figure on the page
  ships a line of script. **The page itself ships two islands** —
  `landing-header.tsx` and `pricing-cards.tsx`, which holds the cycle toggle and
  the Free and Pro cards. **The drawn design is ~770px wide, not the 1000px
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
typed user), `auth-redirect.ts` (`safeNext()`), `panel-tabs.ts` (the eleven left-rail
tabs and their titles) and `areas.ts` (the six dashboard areas by id and by
name). The last of those exists because a tool screen fills the window with none
of the dashboard around it, so a link in may carry `?from=<area>` and the tool
offers a way back to *that list* rather than to the launcher — and it is its own
module because both ends need the labels and the dashboard is one enormous
client component nobody wants pulled into every tool header. Reading a `?from=`
is a lookup against the fixed set, never a cast; anyone can put anything in a
query string.

`src/components/sidebar/` is the third place the navigator appears —
`chapter-sidebar.tsx` mounts the same `BookPanel` rather than a second copy, and
`row-menu.tsx` is the ⋯ menu on a row, **portalled** because the chapter list
scrolls and an ancestor with `overflow` would clip it, and **opened by click**
because a hover menu is unreachable from a keyboard, absent on a touch screen,
and puts a destructive action one stray mouse movement away.

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
plan, payment method and invoice list (signed in only; display
only — the subscription row is written by the webhook and nothing else) ·
`/privacy` ·
`/terms` · `/refunds` · `/contact` (public, and public is the point) ·
`/book/new` · `/book/import` · `/book/[bookId]` **a redirect into the last
chapter opened**, not a screen · `/book/[bookId]/chapter/[chapterId]` editor ·
`/book/[bookId]/read` reading view · `/invite/[token]` (gated, which is what
makes the link a pointer rather than a credential).

The seventeen tools all hang off `/book/[bookId]/`: `export`, `roadmap`,
`paperback`, `listing` · `comps`, `blurb`, `categories`, `covers`,
`title-check` · `structure`, `prose`, `progress`, `provenance` · `money`,
`track`, `arc` · and `consistency`, the seventeenth, written for the MVP rather
than un-gated into it — grouped the way `book-tools.ts` groups them. **Under the
launch flag the proxy redirects all of them home but `export`, `consistency`,
`title-check`, `paperback` and `provenance`**, along with
`/book/[bookId]/read`, `/tools` and `/invite/[token]`; `HIDDEN_BOOK_TOOL_PATHS`
in `launch.ts` is the list, and it holds **thirteen** entries — the twelve
hidden tools plus `read`. **Read the set rather than this sentence**: `comps`
came off it on 2026-09-02 and went back on 2026-09-03, and `arc` came off and
went back on the same day, 2026-09-15, so the count is the thing that moves
most often here.

**API routes:** `/api/comps` · `/api/comps/subjects` · `/api/export/pdf` ·
`/api/plan-interest` ·
`/api/billing/*` (`subscription`, `cancel`, `resume`, `history`, `notify`,
`invoice/[id]`, `paddle/checkout`, `paddle/notify`, `paddle/change-plan`,
`paddle/change-plan/preview`, `paddle/update-payment-method`). **There are no
model routes** — `/api/chat`, `/api/narrate`, `/api/transcribe`,
`/api/comps/{query,rank,categories,keywords,keywords/chat}` and
`/api/blurb/{critique,workshop}` were deleted on 2026-09-14. `/api/comps` is
live and free because the title check runs on it; `/api/comps/subjects` answers
404 under the launch flag; `/api/export/pdf` is free **on purpose and for good**
— export must never move behind the plan — but not anonymous, since it launches
a browser on markup a caller supplied; `/api/plan-interest` is public on purpose.

## Styling — `docs/styling.md`

Tailwind v4 with the palette declared in `@theme` in `src/app/globals.css`.
Colours are named for their *job* (`surface`, `panel`, `raised`, `line`, `fg`,
`muted`, `accent`) so a hue change doesn't make class names lie. The writing
surface has its own layer — a `[data-paper]` attribute re-points `--paper-*` —
and `page-setup.ts` / `typography.ts` turn a book's settings into `--ms-*`
custom properties the editor and the reading view both read.

- **One palette in two values — greyscale by day, indigo by night.** The dark
  set is the `@theme` block and the default; `:root[data-theme="light"]`
  re-points the same names. **The dark set stopped being greyscale on
  2026-09-01**: `surface` #141b34 → `panel`/`nav` #080e26 → `raised` #212c4f,
  `line` #29335a, `fg` #f1f2fa, `muted` #bcc5de. The light set is untouched and
  still neutral.
- **Since 2026-09-06 there are eight palettes, not two, and the extra six are
  the same two ideas tinted.** `TINTS` in `library-store.ts` is the table —
  Parchment, Tawny Leather and Dusty Olive are `light`; Copper Ink, Aubergine
  Page and Charcoal Ink are `dark` — and `themeParts(theme)` is the one place a
  stored theme is split into the two things the DOM carries. **`data-theme` is
  the *scheme* and only the scheme; `data-tint` is the palette**, so every rule
  written against light or dark keeps working and a tint re-points the tokens
  on top. `prefs.theme` is therefore `system | light | dark | <tint>` — nine
  values behind one key, and `Theme` is that union.
- **A tint is two blocks in `globals.css`, and both are required.**
  `[data-tint="…"]` re-points the palette; `[data-tint="…"] [data-paper="theme"]`
  re-points the paper, because **the page follows the theme by deferral rather
  than by being told**. `PaperColor` gained `"theme"` and it is the default:
  `darkPaper(paper, theme)` answers what the surface should be, so choosing
  Tawny does not have to reach in and set a paper — and a writer who wants a
  pale page under a dark theme still picks one of the five literal papers and
  keeps it.
- **`theme-tints.test.ts` is what holds the six together**, and it is the only
  thing that would notice them drifting. It reads `globals.css` itself: every
  tint has a block, every block states **exactly the same token names** as the
  others, each ground is far enough from its own panels (`src/lib/contrast.ts`,
  with `AA_TEXT` 4.5 and `RULE_MIN` 1.2), and the inline `THEME_BOOTSTRAP` map
  in `layout.tsx` — which cannot import `TINTS`, since it runs before React —
  still agrees with `TINTS` about which tint is light and which is dark.
- **The chrome is the part that gets missed.** `.nav-chrome` and
  `.shelf-sidebar` re-point tokens rather than styling controls, which is what
  makes them follow a tint at all — but the light-theme rule used to hardcode
  `#ffffff` as its ground, so the bar and the rail stayed white under a tinted
  page. The fix is the shape to copy: **the background defers to
  `var(--color-nav)` and the ink stays literal.** Scoping the old rule with
  `:not([data-tint])` instead is the wrong repair and was tried — the base
  `.nav-chrome` mixes its ink from white for the dark set, so a tinted light
  theme got near-white labels on cream.
- **At night the page is the *lightest* surface and every panel sinks into it**,
  which reverses the rule that stood here while the ground was black — where
  everything above it had to be lighter, lifted by a hairline, since a shadow on
  black is invisible. On a coloured ground the opposite reads better: cards,
  rails and the sidebar are darker wells cut into the page, and a *selected* row
  sinks rather than lifts (`--color-selected` is a dark pill on the chrome, an
  accent wash by day). `raised` still lifts, because a hover has to come towards
  the pointer whichever way the rest of the stack runs.
- **Every token stated in one block must be stated in all of them.** A name in
  only one keeps its dark value in daylight, and it will be a hairline nobody
  notices for a month. With the tints that is eight blocks rather than two, so
  the rule is enforced by test rather than by care — see `theme-tints.test.ts`
  above.
- **The theme decides colour, never layout.** No
  `[data-theme="light"] .thing { padding: … }`, or the two become two designs.
- **`prefs.theme` is `system` | `light` | `dark` | one of the six tints**,
  resolved onto `<html data-theme>` (and `data-tint`, when there is one) by the
  bootstrap script before first paint; `ThemeSync` carries every change after
  that and listens to the media query while the pref is "system".
- **`dark:` is safe now, and this file used to forbid it.** The rule was right
  while the variant meant `prefers-color-scheme`, which ignores a writer who
  chose against their system. `globals.css` line 3 re-points it —
  `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))` — so
  `dark:` and the token blocks now answer to the same attribute and cannot
  disagree (`b9639b9`). A dozen files rely on it. **Tokens are still the first
  choice**: `dark:` states a colour twice in a class list, where a token states
  it once in `globals.css`, so reach for it only where a token would have to be
  invented for one call site — and never as a way to sneak in a sixth exception
  to the closed list below.
- **A filled action carries `text-accent-ink`**, never a literal `text-white`:
  the fill is a bright periwinkle at night and the brand indigo by day, so the
  ink on it is near-black navy at night and white by day. `bg-danger` and the
  matter fills each carry their own `-ink` token for the same reason.
- **The accent is the brand indigo by day and #8ab4ff by night**, and **one
  accent has to be both a link and a fill** — `text-accent` on 158 call sites,
  `bg-accent` under `text-accent-ink` on 184. On the indigo ground that pairing
  is *forced*, and the arithmetic is written down so it is not re-litigated: a
  link needs a relative luminance around 0.30 to clear 4.5:1 against `surface`,
  and white ink needs the fill *below* 0.18 to clear 4.5:1 the other way. No
  value is in both ranges — only a ground near #0d0d0d lets one colour do both,
  which is why the greyscale set could use plain white. **So the fill is bright
  and the ink on it is dark.** A reference design showing white on a deep blue
  button is 3.7:1 and is not copied.
- **One hue is reserved for *"this is the way forward"***, and past that the
  chrome spends colour in exactly two more places: the nav glyphs, which take
  the accent under `dark:` only (`SideItem`), and the status family below.
- **The status family keeps its colour on purpose** — `ok` / `note` / `stop`,
  each a `-bg`, `-line` and `-fg` token, because there the colour *is* the
  information. The dashboard's ladder is four wide: red is blocked, amber is
  worth doing, green has passed, indigo is the road — and the button inside a red
  card stays indigo, because it is the way out.
- **A surface that *floats* runs the ladder the other way** (2026-09-05), and
  it is three tokens: `float` for the card's own ground, `lifted` for a group
  of rows on it, `lifted-line` for that group's hairlines. The rule above is
  about surfaces cut *into* the page; a sheet standing over the middle of one
  is the opposite case, and drawn dark it reads as a hole punched in the page.
  Two steps, never three — a third is a gradient rather than a hierarchy — and
  the light set inverts, the card being the grey and the groups the white.
  **`float` is its own token rather than `raised`** even though they sit at the
  same sort of height: `raised` is the app's hover and pressed state on a
  hundred call sites, and a card wanting to be a shade darker must not move
  every hover in the product with it. `ListGroup` takes `tone="lifted"` for
  this and drops its outline, since the step in tone is the edge. The Page &
  type card is the only thing wearing it today.
- **The documented exceptions are a closed list**, each with its reasoning in
  `docs/styling.md`: `--color-upgrade-*` (the one gradient), the pricing table's
  value badges, `--color-wordmark`, the sixteen tool marks, `--color-sheet`
  (paper, stated identically in both blocks because a picture of paper stays
  literal), and the landing page's `lp-*` set.
- **`--color-tremor-*` is the sixth, added 2026-08-31, and it is the last.** It
  is Tremor's *structure* — its names, its ladder — adopted deliberately for the
  dialog system after the trade-off was put and accepted: a second palette
  beside the app's, which is the thing this list exists to prevent. **Its values
  are no longer Tremor's.** They were the library's blue-grey until 2026-09-01,
  and once the app itself went indigo that stopped being *a* different ground
  and became a stale one — near enough to the navy to read as a mistake rather
  than as a modal. They are now the app's own navy, one step darker than the
  page. **What keeps it from
  becoming two designs is that it is scoped to dialogs and nothing else.** A
  modal sits on a scrim, so a different ground inside it reads as a surface of
  its own; on an ordinary screen it would read as another product. `ui/button.tsx`,
  `ui/text-input.tsx` and `ui/dialog.tsx` wear it, and nothing on a page may.
  Stated in all three blocks under one name each — **not** Tremor's own
  `tremor-*`/`dark-tremor-*` pair, because this app flips token values by theme
  rather than selecting with `dark:`. `free-limit.tsx`'s `LimitDialog` is
  exempt: it is a photograph with a literal `#050a18` frame matched to the
  artwork, and a photograph does not follow the theme.
- **The editor's panels speak one grouped-list language**, in `ui/list.tsx`,
  `ui/segmented.tsx`, `ui/field.tsx` and `ui/empty-state.tsx` — one container per
  group of related rows rather than one per row, the label outside it, explanatory
  text below rather than above, unboxed empty states, filled fields, and a
  segmented control whose active segment is a raised neutral pill. The rules and
  what each was written against are in `docs/styling.md` under "Panel design".
  **A new panel is built from these**, not hand-classed.
- **`src/components/ui/` is deliberately narrow** and things land there on the
  third copy, not the first. Primitives take `currentColor` — except the three
  dialog primitives above, which carry the dialog palette by design.
- **`ui/button.tsx` is the button, and there are still ~250 that predate it.**
  It arrived on 2026-08-31 against 299 hand-classed `<button>`s across 98
  files, in which the primary action alone was spelled eight ways. The dialogs
  are converted; the rest still carry their own classes and work. **A new
  button inside a dialog uses the primitive**; one on an ordinary screen is
  still hand-classed against the app's own tokens, because the primitive wears
  the dialog palette.

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
- **No AI.** Nothing in the app writes, rewrites, summarises or generates, and no
  part of a book is sent to a language model. This outlived three versions of a
  narrower rule — *the assistant never changes somebody's prose without them
  seeing it* — and on 2026-09-14 the assistant itself went. **"No AI" is now a
  public claim the code has to back**, so the no-claim rule applies to it in
  both directions: adding a model call breaks a promise on the landing page, the
  pricing cards, the FAQ, the Help dialog, `/terms` and `/privacy` at once. The
  prose report, the consistency check and the title check report facts and
  change nothing; that is the shape every checking tool here takes.
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
  - **The book overview is not on this list any more — it was deleted.**
    `editor/book-overview.tsx`, `editor/book-guide.tsx` and
    `editor/page-preview.tsx` went on 2026-09-01 with the editor's Book View;
    see the editor section above for why. Do not put them back without the
    argument that answers it.
    **`editor/resume-card.tsx` came off the same screen and is live again** —
    Overview mounts it through `ResumeSlot` since 2026-09-01, in the slot the
    target dial left when it moved onto the book card in Write. So
    `lastParagraph`, `noteHint`, `tail` and the bible's `mentionedIn` are on a
    reachable path again rather than tested against a callerless file.
  - **`ChapterMeta.matterKey`**, left over from the one-page matter design and
    read by nothing — books written before the change still carry a combined page.
- Storage limits are real: covers 250KB, inline images 900KB, import 8MB.
  `setCover` and `createBookFromImport` fail cleanly and return a signal;
  honour it. **The caps stayed after the manuscript moved to IndexedDB** and are
  no longer about the origin's five megabytes — they are about what belongs in a
  manuscript. A cover is re-encoded to 700px for the shelf whatever the source,
  so a bigger upload buys nothing there (the full-size copy has its own store);
  a 900KB picture inline is a picture that makes the file slow to open in a
  reader; and an 8MB import is well past any real novel and is the line between
  a manuscript and a mistake.
- **The two picture caps are budgets that get met, not sizes that get
  refused** (2026-09-01). `importImage` walks a ladder — **quality first, then
  pixels** (`encodeAttempts`, pure and tested) — until the file is under its
  budget, so no upload is turned away for being large; the refusal survives at
  the bottom of both ladders, where no real photograph reaches it. It decodes
  through `createImageBitmap` with `imageOrientation: "from-image"`, which is
  what keeps a phone photograph upright and lets a fifty-megapixel file be
  closed the moment it has been drawn. The **export** copy has its own pair,
  `PRINT_MAX_EDGE` / `PRINT_MAX_BYTES` (2560px / 4MB) in `cover-save.ts`: a
  writer's own JPEG or PNG inside both is kept byte-for-byte, and the ladder
  only ever meets the 25MB master that would otherwise sit inside somebody's
  EPUB.
- **A book with no cover wears a default jacket, and a jacket is not a cover.**
  Seven pictures in `public/default-covers/`, chosen by book id in
  `src/lib/default-covers.ts` and drawn by `BookCover` with the title over
  them. Nothing is stored, nothing syncs, and `hasCover()` still answers false —
  so the dashboard keeps its "No cover" finding, `storeReadiness()` keeps
  reporting it, and the EPUB has no cover page. **Do not "fix" that finding**;
  `TODO.md` records why the roadmap's "get a cover made" step must never be
  ticked by a picture nobody chose.
- `TODO.md` tracks pending work and records *why* things were cut (e.g. front/back
  matter, per-chapter status). Read it before rebuilding something that looks
  missing — it may have been removed on purpose.
