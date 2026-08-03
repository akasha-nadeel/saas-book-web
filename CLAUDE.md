# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

OpenChapter is a book-writing *and* self-publishing app. It began as a shelf of
books, a distraction-light chapter editor, and import/export to the formats a
writer actually hands off; **as of 2026-08-01 it is aimed at the whole job** —
fifteen per-book tools around the manuscript (comps, blurb, categories, covers,
paperback setup, structure, prose, progress, money, ARC readers, a publishing
roadmap) with the editor as one part rather than the whole. It runs almost
entirely in the browser: the manuscript never leaves the machine except for the
assistant, the two audio routes, and a comp search that sends only words the
writer typed for a shop to read.

**`TODO.md` is the canonical statement of that direction** — what shipped and
why, what each feature deliberately refuses to do, and what was ruled out
(marketplaces, AI covers, AI editing) so it is not re-proposed. Read it before
proposing a feature or rebuilding something that looks missing.

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
- `java -jar epubcheck.jar book.epub` — the EPUB check the unit tests can't do
  (see below). Not in CI; run it by hand after touching `epub.ts`.

Every environment variable is optional and every one of them is documented, with
its failure mode, in `.env.local.example`. That file is the canonical list —
read it rather than grepping for `process.env`.

Tests live beside their subjects as `*.test.ts` and concentrate on the pure
logic: the import/export pipelines (including the XHTML and front-matter
renderers), the store, page setup, typography, search, book kinds, the custom
Tiptap marks, pagination and click-to-type arithmetic, caret scrolling,
narration chunking, transcript paragraphing, publishing details and the ISBN
check digit, the billing price/cycle arithmetic and PayHere's two MD5s, the
account fallbacks and the `?next=` redirect guard, ambience, relative time —
and one module per tool screen (see the tools section below). Components are
not tested — jsdom is there for `localStorage`, not for a DOM.

Several tests assert *positions* rather than behaviour, and they are the ones
not to "fix" when they fail: that the ARC step sorts before publishing, that
the middle beat straddles 50%, that the prose report has no score, that a
ranked comp carries nothing but the book and the reason, that the curve leaves
out a book with no sales rows instead of drawing it at zero, that the series
bible refuses to merge on anything fuzzier than an exact name, and that the
money page names no company and every figure carries its provenance. If one of
those goes red the feature has lost the thing it was built to say.

`docs/plans/` holds the design and implementation notes for the bigger pieces
(the bookshelf, export, and the Supabase persistence design). They record what
was decided and why, and are worth reading before reworking any of them.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Tiptap 3 editor · `@anthropic-ai/sdk` (the assistant) · `ai` v7 through Vercel AI
Gateway (speech and transcription) · `docx` + `jszip` for exports. Path alias
`@/*` → `src/*`.

This is a newer Next.js than your training data (see AGENTS.md). Two things that
bite: `params` is a `Promise` and must be awaited, and route components can be
typed with the generated helpers `PageProps<"/route">` / `LayoutProps<"/route">`.
Both shapes are in the tree — the older routes use the helpers, the fifteen tool
routes write `props: { params: Promise<{ bookId: string }> }` by hand. Either is
fine; awaiting `params` is not optional.

## Architecture

**Persistence is one module.** `src/lib/library-store.ts` is the *only* file that
touches `localStorage`; everything else goes through it. That boundary is what
let Supabase arrive *behind* the store (`sync.ts`) without any of the sixty-odd
files that read it changing a line — and it is what any future storage change
will need again. Keep it intact: a screen reaching for `localStorage` directly
is a bug even when it works.

There is **exactly one exception, and grepping will find it**: the
`THEME_BOOTSTRAP` string in `src/app/layout.tsx` reads `openchapter:prefs` by
hand. It has to — it is an inline `<script>` that runs before React, before any
module loads, because resolving the theme *after* hydration is the flash it
exists to prevent. Nothing else may follow it. (Other files mention
`localStorage` in prose comments; those are not accesses.)

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
- **the tool stores** — `bible:<bookId>`, `arc:<bookId>`, `history:<chapterId>`,
  and the library-wide `ledger`, `activity` (one net word count per day) and
  `ideas` — same reasoning, plus one shared caveat: **none of them sync.**
  `sync.ts` maps a book's *columns* by name and these are not columns, so a
  writer on two machines keeps two ledgers. Every screen with one says so on the
  page; don't quietly drop that line. The two features that read *across* these
  keys make it worse rather than better and say so for themselves: a series
  bible is a merge of whichever books this machine holds, and the book-three
  curve is drawn from whichever sales reports were imported here.

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
stable (see the frozen `EMPTY_SHELF`) or the store loops. There is one hook per
store and they are all the same shape — `useShelf`, `useChapterBody`,
`useBodyReload`, `useCover`, `useNotes`, `usePrefs`, and one each for the tool
stores (`useBible`, `useArc`, `useLedger`, `useActivity`, `useHistory`,
`useIdeas`); a new store gets a new hook here rather than an effect in a screen.

**The front door is a dashboard, not a shelf.**
`src/components/shelf/bookshelf.tsx` is five areas — Overview, Write, Prepare,
Track, Tools — and **Write is one of them**; the arrangement is the argument
that the manuscript is one part of the job.

**Overview is a diagnosis, and `src/lib/checkup.ts` is the whole of it.** The
person arriving usually has a book already — often finished, often imported —
and came because they do not know what stands between it and a shop; a word
count and a "continue writing" button answer a question they did not ask. So
`checkup()` returns **findings**: what is wrong with this book, worst first,
each carrying the control that fixes it. The component chooses only how they
look. Three things in that module are load-bearing:

- **Every finding carries its own `Fix`**, and it is a typed union rather than a
  URL because the three commonest problems — no title, no author, no cover —
  are all put right in a *dialog* the shelf owns, not on a page. A URL-shaped
  destination would have left exactly those three with nothing to press.
- **A test walks every field `storeReadiness()` can emit** and fails if
  `DESTINATIONS` has no entry for it. Add a check to `publishing.ts` and forget
  that map, and the finding lands on the dashboard as a dead end.
- **Nothing is invented** — no score, no grade, no percentage. Two counts and
  real problems say more and claim less, and the first screen a writer sees is
  the worst possible place to print a made-up number.

**Advice is raised only once a book has asked.** `checkup` gates its advisory
findings on the roadmap's own phase: a shop's *refusals* travel at any stage,
but "no ISBN", "no categories" and "nobody has an advance copy" wait until the
book has reached prepare/launch/publish. Keeping all of it off the dashboard
was the earlier answer, and it was right about chapter three and wrong as a
blanket ban — a writer standing in Prepare came here to be told. The fix was
the trigger, not the rule.

Under the findings sit the five phase dials and the roadmap's next step, in
that order: the findings are what is wrong with the *book*, the step is where
you are on the *road*, and stacked they read as one thought where side by side
they competed. The step also carries **Already done** for the two steps nobody
can detect ("Finish the first draft", "Revise") — without it an imported
finished manuscript sits at Drafting forever and never reaches the phases where
the publishing help lives.
Which area is open lives in **`?area=`** rather than in state: a tool screen is
a whole window with none of the dashboard on it, so coming back has to land
where the writer left, and `/?area=tools` is the link the tool header uses. Read
it with `useSearchParams` — a lazy initialiser reading `window.location` sees
the *previous* URL during a client navigation, which was tried and is why the
area kept arriving as Overview.

**Place a writer can be sent back to lives in the query string**, and there are
four of them: `?area=` on the dashboard, `?phase=` and `?open=` on the roadmap
(which phase is expanded, which step's tool is open beside the road), and
`?from=` on any link *into* a tool. That last one is why `src/lib/areas.ts`
exists — `areaLabel()` turns the id back into the words the back control says.
A tool is reached from the book cards, from Prepare and from the roadmap, so a
back link that always said "All tools" returned a writer working through a list
to the launcher instead of to the list. Link to a tool without `?from=` and it
falls back to that launcher, which is the wrong answer more often than not. The
`useSearchParams` rule above applies to all four.

**Fifteen per-book tools, described in one place.** `src/lib/book-tools.ts`
holds every tool's path, name and one-line description, in four groups with a
colour each. The dashboard's Tools grid (`tool-grid.tsx`, glyphs in
`tool-marks.tsx`) and the sheet behind a book card's ⋯ (`book-tools-dialog.tsx`)
both render from it, so the descriptions — which are product claims, held to the
same rule as the landing page — exist once. Nothing in that list is a preview:
a tool that is not finished does not go in it.

Each tool is the same three pieces, and the split is the convention:

- a **pure, tested module** in `src/lib/` holding the whole of the thinking —
  `roadmap.ts`, `paperback.ts`, `blurb.ts`, `beats.ts` (structure), `prose.ts`,
  `activity.ts` (progress), `provenance.ts`, `money.ts`, `ledger.ts` (track),
  `arc.ts`, `cover-check.ts` (covers), and `comps/` —
  `comps.ts`, `length.ts`, `subjects.ts` (categories), `rank.ts`,
  `title-check.ts`. Two more sit beside them without a tool screen of their
  own, because neither question belongs to one book: `series.ts` (the bible
  across a series, read in the editor's rail) and `curve.ts` (the book-three
  curve, drawn in the dashboard's Track area beside the strip that adds the
  library up).
  Export is the exception and predates the pattern: it is the whole of
  `src/lib/export/`;
- a thin `src/app/book/[bookId]/<tool>/page.tsx` that awaits `params`;
- a client component in `src/components/<tool>/`.

Every one of them mounts **`ToolHeader`** (`src/components/tool-header.tsx`)
when it owns the window: breadcrumb, the book as a chip *with its cover*, and
the tool's own name as the `h1`. The cover is load-bearing — the Tools area lets
a writer pick a book before opening a tool, so landing on the wrong manuscript
is a real way to lose ten minutes — and the heading is the tool rather than the
book, or every screen looks like the same screen with different contents. The
`width` prop must match the page's own container or the two left edges disagree
— it defaults to **`5xl`**, which is a page width rather than a reading measure:
these screens hold forms, stat rows and card grids, and the `3xl` it used to be
left a third of an ordinary laptop window empty down each side. The header's
deck is capped separately at `2xl`, and the tool pages cap their own prose at
`max-w-prose`, so widening the page never widens a line of text. Comps is the
one screen wider still (`6xl`), because it is a five-column grid of covers.
The export screen is the one that never took this header; TODO.md records the
decision as open.

**A tool screen has two frames, and `src/lib/tool-page.ts` is the contract.**
The roadmap opens six of them *beside* the road rather than instead of it, so a
writer can do a step without losing their place — which a component assuming it
owns the viewport cannot do. So every tool component takes `ToolPageProps`
(`bookId`, `embedded`, `heading`) rather than a bare `bookId`, and `embedded`
says exactly two things, both about the frame: **no `ToolHeader`** (a second
heading under the panel's own title bar, and a breadcrumb pointing out of a
panel with a Close button beside it), and **`h-full` rather than `h-dvh`** (a
child claiming the viewport inside a flex panel overflows by the height of the
title bar). `toolShell()` writes that class pair so the six cannot drift.
Nothing else may hang off the flag: the moment `embedded` starts hiding
*features* there are two products in one file and the panel is the lesser one,
which is what makes a writer navigate away to "the real screen".

`src/components/roadmap/step-panel.tsx` is the registry — comps, title-check,
blurb, categories, covers, export — keyed by **URL segment**, so it is checked
against the step's own `href` rather than a second list of names that could
disagree with it. Each is a `dynamic` import with `ssr: false`: they read the
library out of `localStorage`, and one of them reaches for `docx` and `jszip`,
which a writer only reading the road should never download. Anything absent
(the editor, the reading view) is absent on purpose and keeps navigating away —
the reading view measures its own column, so in a panel it would faithfully
typeset the book at half the width somebody wanted to read it at. `panelToolFor`
returning null is how the roadmap knows to draw an ordinary link.

**These screens share a house style, and tests enforce it.** No score, no grade,
no number invented to look like an answer. Facts rather than verdicts ("you
wrote on 12 of the last 30 days", never "you should write more"). **Detected
beats ticked** — a roadmap step worked out from the book cannot be lied to, and
the two that cannot be detected honestly (finishing a draft, commissioning a
cover) are hand-ticked and say so. Every figure carries its provenance. And a
measurement is reported *with how many records carried the field*, because a
median from three books and the same median from eighteen are different claims.

**Two free catalogues sit behind `/api/comps`** — Google Books and Open Library.
Server-side not for secrecy (neither needs a key) but for a shared cache, so one
service being down costs half the results rather than the panel, and so a
reader's browser is not handed to two third parties for a request they did not
make. Records are merged **field by field** on ISBN, or title-plus-author when
neither has one: Google carries blurbs and page counts, Open Library carries
subjects and a cover for almost everything, and the gaps are in different
places, so preferring one source wholesale throws away the field the other was
fetched for. `GOOGLE_BOOKS_API_KEY` is optional — without it Google answers 429
under any real traffic (the anonymous quota is per IP and a server is one IP for
every writer), the feature degrades to Open Library alone, and the screen says
Google did not answer rather than implying the genre is empty. **The manuscript
never goes**: what leaves is a query built from the book's genre and blurb.

**Ranking those comps is a separate route, and the split is the design.**
`/api/comps/rank` (POST, `requirePro()`, `ANTHROPIC_API_KEY`, Sonnet) over the
pure `src/lib/comps/rank.ts` is the one place in the cluster where a model
earns its cost — a keyword search returns forty books of which five are really
comparable, and sorting those out is a judgement rather than a query. Folding
it into `/api/comps` would make the *whole* feature need a key and a plan for a
step most searches do not want; kept apart, everything above the button works
free and keyless. Three rules hold it: **there is no score and no field to put
one in** (a number here would be invented and would be the most believable
invented number in the app, sitting in a list of real books — a test asserts
the parsed pick carries nothing but the book and the reason); **the model may
only choose from books that were fetched**, by numbered id, with anything out
of range dropped rather than guessed at and the parser enforcing it
*server-side*, because a model asked about books will produce a plausible title
that does not exist and a made-up comp is about to be pasted into a query
letter; and **generated text is treated as hostile input** — preambles, code
fences, bare arrays, duplicate ids and missing reasons each have a test. The
clean parse is tried before any bracket scan, since scanning a bare array for
`{` finds the first *element's* brace and silently parses one pick as the whole
reply.

**This is the second route that sends prose**, after the assistant: the opening
of the manuscript goes, because whether a book *sounds* like another is what a
keyword search cannot answer. Capped at a couple of pages, cut at a paragraph
(a severed clause is a false signal about how the writer ends sentences),
images dropped, sent only on a press — and the card lists exactly what leaves
*before* the button, the same shape the feedback dialog uses. Add a field to
what is sent and add it to that list.

**The editor** (`src/components/editor/chapter-editor.tsx`) is Tiptap. The surface
is keyed on `${chapterId}:${storedText}` so a save from another tab reloads it
instead of leaving it stale. Autosave is `src/lib/use-autosave.ts`; body is
written before word count (a stale count is cosmetic, lost prose is not). Custom
Tiptap extensions live in `src/lib/editor/`: font size, font family, text align,
blockquote, resizable images, and `no-indent.ts`. That last one is a mark, not a
setting, and it pairs with `click-to-type.ts` — double-clicking blank page below
the prose puts the caret *there* (Word's click-and-type), and a paragraph the
writer placed must begin where the caret was shown rather than take the book's
first-line indent. Aligning a body paragraph left is a different question and
must leave the indent alone, which is why the two aren't one attribute.
`caret-scroll.ts` is the other pure one: move the view only when the caret would
leave it, and then only as far as the edge.

The one to understand is `pagination.ts`: it sets the manuscript on real page
sheets by *measuring* the rendered text and inserting
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

**The editor shell is a rail, a tool panel, and the book panel.**
`workspace-rail.tsx` selects which tool panel (`PanelTab` in `left-panel.tsx`:
chapters, search, notes, ideas, bible, bookmarks, assistant, history, trash) is
open, and clicking the active tab closes it — one control, never two. Three of
those tabs are writer-pain features, each a panel over a pure module:
**ideas** (`ideas.ts`) is a parking lot for the shiny idea that would otherwise
stall book two — being *in the rail* is the feature, since leaving the book to
write it down is itself the interruption; **bible** (`bible.ts`) is people and
places with the aliases they answer to, and its opening question is "who is in
this chapter", answered by whole-word search over what is written rather than
by the list being maintained; **history** (`history.ts`) is eight snapshots a
chapter under a 400KB budget, taken at most every ten minutes and only when the
text really changed — a safety net, not an archive, and the panel says so.
`rememberVersion` runs after the body is written and swallows every error: a
full origin means no history, never a failed save.

**The bible reads across a series, and `src/lib/series.ts` is that half.**
Three things in it are load-bearing. **A series is derived, never declared** —
books are in one when their `publishing.series` fields match, because a shop
asks for that field anyway; there is no series object and no migration, and a
second place to record it would be a second place to keep in step. **Entries
stay at their own book's key and nothing new is written**: the series bible is
a *read across* the sibling books' bibles (`useSeriesBible`, over
`getBiblesRaw`, whose snapshot is one JSON string carrying ids *and* payload so
`useSyncExternalStore` settles and the hook never re-reads storage). A shared
`bible:series:<name>` key loses on three counts — renaming the series orphans
it, a book leaving takes nothing with it, and an entry loses which book wrote
it down. And **merging is exact**: same name or same alias, case-insensitively,
nothing fuzzier, with kind part of identity — the same refusal `subjects.ts`
makes, because a rule clever enough to see that Beth is Elizabeth also welds
two different Toms together, and a writer can see a duplicate but not a merge.
Matching is transitive, so an alias chain closes without anyone stating its
ends. The panel **opens on the series when there is one**, which is the
argument rather than a preference: a writer on book three told "none of them,
by name at least" about a chapter full of book one's cast has been failed by
the reliable half of the feature. Differing details are *shown, attributed and
never flagged* — details accumulate far more often than they conflict, so a
badge would fire on every character by book two.

The chapter editor and the book overview mount the *same three parts* — rail,
tool panel, book panel — so a change lands on both screens at once:
both pass `chapters={false}` and keep the tool panel closed until a tab is
picked, because `book-panel.tsx` on the right is already the chapter list. The
overview used to carry its own list on the left instead; two navigators for one
book meant two things to keep in step, so the older one is gone. The overview
differs only in having no manuscript — it shows `book-guide.tsx` where the page
would be, and passes no `dictation`, so the panel's microphone hides rather than
appearing with nowhere to put the words.

`book-panel.tsx` is the navigator proper: the book's three parts as cards
(front/body/back), each in its own colour, the chapter list inside the body one.
Its face is the stored `bookPanel` pref rather than component state, so a reload
does not put the writer back on the cover; the list's own open/shut lives in
`useBodyOpen`, exported from that file and called by the *screen* rather than the
panel, because the manuscript needs the same answer — the page sheet's edge takes
the colour of whichever part the panel has selected (`data-matter`, and the
`--paper-edge-*` tokens in `globals.css`), and pressing Chapters selects the body.
Two copies of that state would be two answers to one question.

The panes live in the *pages* rather than in `book/[bookId]/layout.tsx`, because
the left panel needs the chapter id and the assistant needs the editor instance,
neither of which a layout can see. The import banner is the exception and does
live in that layout — it has to survive the writer clicking chapter to chapter.

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

**The EPUB is built to be sold, not just opened**, and it is **verified against
EPUBCheck 5.3 (EPUB 3.3): 0 errors, 0 warnings**, for both a fully-specified book
and a bare one with no cover and nothing filled in. Re-check after changing
anything in `epub.ts` — the suite tests the strings, not the spec.

Three things in there are load-bearing and none of them are visible in a working
file. The cover is declared *twice*, under `properties="cover-image"` and the
legacy `<meta name="cover">`, because which one a given shop reads is not
knowable in advance. The identifier comes from `bookIdentifier()` and is derived
from the book's id, never minted fresh: a random UUID per export makes a
corrected file read as a second, unrelated title, which is how one book becomes
two listings. And the `schema:access*` metadata is written from what the book
actually contains — claiming `alternativeText` for undescribed pictures is a
false accessibility claim, which is worse than an absent one.

`epub-images.ts` lifts inline images out of their `data:` URLs into real
`OEBPS/images/` entries, de-duplicated across the book. Note what this is *not*
for: a `data:` src passes EPUBCheck fine (checked, not assumed). It is for size —
base64 is a third larger than the bytes and compresses badly inside XHTML, and a
repeated ornament is one file instead of one copy per use.

`src/lib/publishing.ts` holds the listing details (ISBN with a checked digit,
language, publisher, blurb, categories, series) as `Book.publishing`, and
`storeReadiness()` is the honest half of a Publish button: it reports what a shop
would refuse and never vetoes the export, because a writer is allowed to want the
file for their own reader. `checkStoreReadiness()` in `export/index.ts` is the
half that has to read the manuscript, which is why it is not in the pure module.
- Import: `src/lib/import/` — docx, epub, md, txt, html, plus audio via the
  transcriber. `index.ts` dispatches by extension and refuses `.doc`/`.pdf` *by
  name* with what to do instead; `split.ts` breaks a flat block stream into
  chapters.

  **A file's own metadata is read and kept** (`metadata.ts`, `epubMetadata()`,
  `docxMetadata()`, `cover.ts`): an EPUB carries an author, an ISBN, a blurb,
  categories and usually cover artwork, and all of it used to be dropped at the
  door. That was survivable while import only fed an editor and stopped being
  survivable the moment the app started *reporting* on a book — a check that
  tells a writer their complete file has no author, no cover and no ISBN is not
  a strict check, it is a wrong one. `setupFromImport()` is what carries it into
  `createBookFromImport`, used by all three import screens so one of them cannot
  quietly forget. Three details are load-bearing: the ISBN is picked out of
  `dc:identifier` by **check digit** rather than by a `urn:isbn:` prefix, since
  a UUID sits in that same field; `dc:date` is cut to `YYYY-MM-DD` or a valid
  EPUB would import and then report a *blocking* date problem of our own making;
  and Word's machine account names ("Windows User") are refused as authors,
  because a wrong pass is quieter than a wrong alarm and nobody goes looking for
  a problem the check said they did not have.

**The small pure modules** are where the conventions of the trade live, kept out
of components so they can be tested and changed in one place: `book-kinds.ts`
(novel/novella/short story, genre word-count targets), `book-templates.ts`
(chapter skeletons only — never boilerplate prose), `search.ts` (walks plain text
out of stored Tiptap JSON for the ⌘K panel), `page-setup.ts`, `typography.ts`,
`relative-time.ts`, `use-typewriter.ts`.

`resume.ts` belongs to that set and is the one to understand, because it stores
nothing: the "where you left off" card on the book overview
(`resume-card.tsx`) is the tail of the last paragraph written plus the first
line of the chapter note, both read back out of what already exists. The
chapter is `lastOpenedId` *when it has prose*, falling back to the last chapter
with any — quoting an empty chapter back at a returning writer is worse than
saying nothing — and the excerpt is the paragraph's tail rather than its head,
cut at a word, because what a writer needs is the sentence they stopped in the
middle of.

Two of them are about accounts and both are tested. `account.ts` resolves the
name, face and email the chrome shows — a chain of fallbacks rather than a field
lookup, because Google hands over a real name and a photo and an email signup
hands over neither, and the shelf header and the account dialog have to agree on
the answer. It takes whatever is in the JWT rather than a typed user, since
`user_metadata` is written by identity providers and has never been
type-checked. `auth-redirect.ts` is `safeNext()`, the open-redirect guard on the
`?next=` parameter: rooted same-site paths only, which means rejecting `//evil`
(protocol-relative, and reads as a path if you only check the leading slash) and
anything with a backslash. Anyone can put anything in that query string.

**The assistant** is `src/app/api/chat/route.ts` — Anthropic streaming. Needs
`ANTHROPIC_API_KEY` in `.env.local`; without it the route returns 501 with a
message saying so. Chapter text is sent only when the writer opens the panel and
asks, and rides in the (cached) system prompt.

**Audio is three separate things, and they are not interchangeable.** All three
degrade the way the assistant does — no key, 501 with a message saying so — and
the two paid ones need `AI_GATEWAY_API_KEY` (not the Anthropic one) and check
auth themselves, because the proxy skips `/api` and a minute of speech is
somebody else's invoice.
- **Text → audio** (`/api/narrate` + `src/lib/export/narrate.ts`,
  `export/audiobook.ts`): the export page's Audiobook card, one MP3 per chapter
  in a zip. The route does *one chunk per request* and is stateless; the loop is
  driven from the client so a 40-chapter book is 40 visible steps rather than one
  request that fails having produced nothing. The tested part is `speechChunks()`
  — cut at the largest boundary that fits (paragraph, then sentence, then word,
  never mid-word), because a break mid-clause is audible.
- **Audio → text** (`/api/transcribe` + `src/lib/import/transcript.ts`):
  importing an audiobook. Only the transcript is made server-side; chaptering and
  book creation go through the same `parseText → splitIntoChapters →
  createBookFromImport` path as a `.docx`. `transcriptToProse()` rebuilds
  paragraphs from the *segment timings* — a narrator's pause between paragraphs
  is longer than between sentences — because otherwise the whole book arrives as
  one paragraph and `splitIntoChapters` finds nothing to split on.
- **Dictation** (`src/lib/editor/use-dictation.ts`) is the browser's own
  `SpeechRecognition`: live, free, no key, Chrome/Edge only. `supported` is false
  elsewhere and the button hides. Don't "unify" it with the transcriber — that
  one bills per minute and takes finished files.

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

**Everything funnels through `/auth/confirm`.** Password reset, email
confirmation and Google all end there: `/forgot-password` mails a link pointed
at `/auth/confirm?next=/reset-password`, and `signInWithGoogle` (a Server
Action, so the PKCE verifier lands in an httpOnly cookie) sends Google → Supabase
→ the same route. One place creates sessions, whatever started them. So
`/reset-password` needs no token of its own and is *gated* rather than public —
by the time a writer arrives they are signed in, and `updateUser()` knows who
they are, which also makes it a plain change-password screen for anyone already
in. Google's redirect URI is registered as *Supabase's* callback, never ours;
our domains live in Supabase's Redirect URLs allowlist.

**Supabase reports auth failures in the URL fragment**, which browsers never
send to a server. `useFragmentError` in `auth-shell.tsx` reads it after
hydration — through `useSyncExternalStore`, like `useHydrated`, with the capture
cached at module scope so the snapshot stays stable and survives the effect that
wipes the hash. Without it every failure reads as "that link expired", including
a rejected OAuth secret, which is a genuinely misleading place to start
debugging. The four auth screens share `auth-shell.tsx` so the chrome cannot
drift between them.

**Persistence is Supabase behind localStorage, not instead of it.**
`library-store.ts` still reads and writes `localStorage` synchronously — that is
what lets `useSyncExternalStore` read a snapshot during render, and why none of
the sixty-odd files that read the store changed. `src/lib/sync.ts` is the async
half:
`commit()` diffs the shelf and pushes what moved, and `syncWithServer()`
reconciles once per load. Reading through Supabase directly would make
`getShelf()` async, which unpicks all of it — and would cost offline, which for a
drafting tool is not a nice-to-have. The price is last-write-wins per chapter
between two machines. See `docs/plans/2026-07-29-supabase-persistence-design.md`.

Two things in there are load-bearing. **Pushes are diffed in `commit()`**, not
added at each of the twenty-odd mutation sites: every shelf write funnels
through it and the writes are immutable, so reference inequality is an exact
test for "this book changed" — and a new mutation cannot forget to push.
Deletions are found by comparing chapter id sets before and after, because
`pushBook` upserts a book's chapters but cannot know one was removed.

**The mapping narrows values on the way out** (`matterOrNull`, `count`, `text`,
the guard in `toIso`). The types describe today's code; `localStorage` holds
whatever older versions left there, unchecked by any compiler, and the database
has CHECK constraints and NOT NULLs that will refuse the difference — one stale
field in one chapter is otherwise enough to abort a whole library upload.
`uploadLibrary` also drops bodies and covers whose chapter or book is not going
up: after enough versions some keys belong to nothing, and a dangling foreign
key takes the batch with it.

**A browser is shared, so the cache is owned.** `openchapter:owner` records
whose library is sitting in this browser, and `clearLocalLibrary()` wipes every
`openchapter:` key when a different account signs in. Without it the second
writer on a machine inherits the first one's shelf — and now, with a server
behind it, pushes those books up under their own account.

The SQL behind all that is checked in: `supabase/migrations/` (library,
book publishing, billing, feedback). Schema changes belong there, not only in
the dashboard. `20260730000000_book_publishing.sql` has **not been applied** to
the live project — see TODO.md; until it is, listing details save locally and
the push silently rejects the unknown column.

**Payments are PayHere, and optional in the same way everything else is.** Set
`PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` and the app grows plans;
leave them unset and there are no plans *and nothing is held back* — every
paid screen works, and the Upgrade button says why there is nothing to buy.
That falls out of the subscription route answering `pro: true` when there is no
gateway, which `ProGate` and `requirePro()` both read. `isBillingConfigured()` is checked
first everywhere, and `requirePro()` passes everyone when it is false, so a
self-hosted copy running on its owner's API keys behaves exactly as it did
before billing existed.

`src/lib/billing/` is the pure half — `plans.ts` (the price table, the cycle
arithmetic), `signature.ts` (PayHere's two MD5s), `subscription.ts` (`isPro()`,
the status codes) — all tested. `payhere.ts` holds the credentials and is
server-only by naming: none of it carries a `NEXT_PUBLIC_` prefix, so an
accidental client import reads empty strings and `isBillingConfigured()`
answers false rather than leaking a secret. `server.ts` is `requirePro()`, the
gate in front of `/api/chat`, `/api/narrate`, `/api/transcribe` and
`/api/comps/rank` — 401 when signed out, **402** when signed in and unpaid,
and the three are different messages because "sign in" shown to someone already
signed in is a loop.

**There are three ways to buy and the third is not a cycle.** $9 monthly, $72 a
year, $199 once. The lifetime tier is there because this market buys software
outright — Scrivener, Atticus, Vellum and Publisher Rocket are all one-time
purchases — so a subscription-only page argues with the reader before it
describes anything. Four things about it are load-bearing and each is a real
failure if missed:

- **PayHere is sent no `recurrence` and no `duration`.** Those two fields are
  the whole of what makes a charge repeat, so shipping them against a one-off
  order bills $199 a month. `recurrenceOf`/`durationOf` return null for it and
  the checkout spreads the keys in conditionally — an empty string is still
  a field.
- **`periodEnd` returns null for it.** A far-future sentinel was the easy wrong
  answer: every screen rendering `currentPeriodEnd` would tell the writer their
  outright purchase renews in 2999.
- **`isPro` checks the period *before* the missing-date guard**, because that
  guard reads a null end as "the first payment has not landed yet". Ordered the
  other way round, every writer who paid is refused.
- **`canCancel` is already false for it**, because PayHere issues no
  subscription id for a one-off. Do not loosen that — offering to cancel
  something bought outright is offering to take it away for nothing.

**What is free is what a book needs to exist and leave.** Unlimited books and
imports, all four exports, sync, the pre-upload check and the roadmap, comps
search, blurb, categories, covers, structure, progress, and one book's story
bible. Pro is the metered routes plus the business layer — money, advance
readers, the book-three curve, the writing record, the prose report, and the
*series* read of the bible. Every competitor charges for formatting, which is
why export is the one thing that must never move.

**The gates are of two kinds and the pricing page's own comment says which.**
The four metered rows are `requirePro()` on the server, which is the only check
a reader with devtools cannot edit. The rest are computed in the browser and
gated there by `ProGate` / `useEntitled` (`src/components/upgrade/pro-gate.tsx`)
— one component so six screens cannot drift into six tones of upsell, and it
renders children untouched while the plan is still loading, because half a
second of a paywall shown to a paying writer is the screenshot nobody wants.
Do not add a Pro row whose value depends on a browser gate being unbreakable;
the honest lever for those is syncing their data, which is server-side.

Four more things in there are load-bearing.

**Only the webhook grants Pro.** `/api/billing/notify` is a POST from PayHere's
*servers*, with no session and no cookies, and it is the one caller that writes
`subscriptions` — which is why `authenticated` has no insert or update grant on
that table at all and the route uses the secret key
(`src/lib/supabase/admin.ts`). The return_url is not proof of anything: a writer
can type it. `/upgrade/done` therefore polls rather than assumes, because the
browser's redirect and PayHere's notification race and are not ordered.

**The notification is verified before it is believed.** The URL is public and
the body is entirely attacker-shaped; `verifyNotification()` against the
merchant secret is the only thing standing between that and a stranger writing
"paid" into the table. A bad signature is refused with 403 and never retried.

**It is idempotent on `payment_id`,** which is the primary key of
`payment_events`. PayHere retries anything it did not get a 200 for, and a
subscription charges again on the *same* order id every cycle — so an order
cannot be the key, and a retry that re-ran would extend the period twice.
Anything the route cannot act on answers 200 and logs; only a storage failure
answers 500, because that one *should* come back.

**A cancel goes to PayHere first and our table second.** The other order leaves
a writer who has been told they are cancelled with a card still being charged.
Cancelling takes a second credential pair (`PAYHERE_APP_ID` / `_APP_SECRET`) for
the Subscription Manager API; without it the account dialog shows no Cancel
button rather than one that cannot work. Cancelled is not gone — `isPro()` runs
a cancelled plan to its paid-up date with no grace, and an active or past_due
one three days past it, because a renewal that needs one retry is a normal
Tuesday and PayHere's queue is not instant.

`use-plan.ts` is the client's view of all that, and it **fetches rather than
derives**: the plan lives in Postgres and changes when PayHere says so — a
webhook away, months later, with no page open — so there is nothing local to
read it from, and it is deliberately not part of `library-store.ts`. Nothing it
returns gates anything that costs money; the billed routes check server-side,
which is the only check a reader with devtools cannot edit. It exists to tell a
writer the truth about their own account.

**Feedback is a private channel, and what it may carry is the whole design.**
`src/lib/feedback.ts` (the topics and the four faces) plus `feedback-dialog.tsx`,
which inserts straight into Supabase. The migration grants `authenticated` an
insert and **no select at all**, so a signed-in reader with devtools cannot read
anybody's notes including their own — it is a suggestion box, not a forum.
Nothing about the book is sent: no title, no word count, and deliberately not
the URL, because a URL in this app carries book and chapter ids. What goes is
the message, a topic from a fixed list, one face, and the account id the server
already knows. The dialog lists exactly that above the send button; if you add a
field, add it there too.

**The root layout carries three things no screen owns.** `ThemeSync` — which
applies `[data-theme]`, listens to `prefers-color-scheme` while the pref is
"system", and runs the one-time theme migration — `LibrarySync` — which runs `syncWithServer()` once per mount, enough because
every way of signing in ends in a redirect or full navigation, and flushes
queued pushes on `visibilitychange` so a closed tab doesn't take the last save
with it — and `AppLoader`, the held splash. `AppLoader` skips `/` deliberately
and is *seeded* to "gone" there rather than switched off in an effect, or it
paints and is taken away, which is the flash it exists to prevent.

**The landing page is one Server Component** —
`src/components/landing/landing-page.tsx`, what a signed-out visitor sees at
`/` — **plus four client pieces it cannot hold itself**: `landing-header.tsx`,
and the three things that go in a window (below).

**There is one window, and `app-window.tsx` is it.** The page had a tablet slab
under the check demo, another under the listing form and a bare card in the
hero; three frames on one page read as three products. So one frame takes all
three, and its `label` prop is the load-bearing part — the two demos are
*pictures* (they pass a label, take `role="img"`, and hide their contents behind
that one description), while the hero passes none, because what is inside it is
a real file input and a screen reader has to meet the control rather than a
sentence about a picture of one. Get that backwards and the only working thing
on the page goes invisible to the people who most need it announced.

The two pictures are `check-demo.tsx` (the dashboard working: Overview →
Prepare → a book's findings, each with its fix beside it) and
`store-listing-demo.tsx` (the listing form filling itself in beside "Every
field a shop asks for"). Both quote the real screens' strings, so they can only
go wrong if the product does. Two rules govern anything that animates there. It
runs only while on screen and stops with the tab, because a landing page is a
page somebody leaves open. And **it measures with the camera parked** — the
pointer aims at real rects, `getBoundingClientRect` reports the *transformed*
rect, and the fonts land a second in, so measuring through a live push records
where a field currently appears rather than where it sits and the pointer clicks
air. Same rule as `pagination.ts`.

**The hero carries the real check, not a picture of one.**
`book-check.tsx` over the pure `file-check.ts`: a signed-out visitor drops the
manuscript they already have, it is parsed *in their browser* by the ordinary
`importFile` path, and `storeReadiness()` reports what a shop would refuse —
the same findings, in the same order, in the same words as the dashboard. Four
rules hold it together.

`checkFile()` **invents no rules**; it goes through `fromReadiness()` like every
other screen, so there is no second, louder list of shop rules written for
marketing. It **raises the advisories** that `checkup()` gates by phase, on the
same reasoning as the Prepare screen: somebody who has dropped a finished
manuscript on a page about uploading has asked the publishing question. Findings
are **never held back for an email** — the whole list shows whether or not
anybody signs up, because gating them is the pattern this reader has been burned
by; what needs an account is *fixing* something, and the buttons say so before
they are pressed. And **the book comes with them**: pressing a fix writes it to
`localStorage` and sends them to `/signup?next=` the tool that mends it, which
works because `syncWithServer` already handles a library that existed before the
account did. Nothing is written until they press, so a visitor who only wanted
the check leaves no trace either.

This is why the file's metadata had to be read (see the import note above): the
landing page and the dashboard must not say different things about one file.

**Its positioning is "nobody tells you the order"** — the sharpest thing in the
writer research and the one claim a competitor cannot answer by shipping a
feature, because it is the shape of the problem rather than a part of it. So the
page leads with the order, proves it by naming where the ARC step sits, and only
then says what the software does. It opened on a feature for a while, which is
an answer to a question the reader has not been asked yet.

**It follows the theme, through its own token set.** It used to be always light
and state every colour literally, on the argument that a shop front should not
change because of a setting made inside the product. That was right about brand
consistency and wrong about whose setting it is: a reader on a dark machine has
not expressed a view about our marketing, and the one page ignoring them was the
first one they ever saw. So the page reads `data-theme` like the app does, off
the `--color-lp-*` block in `globals.css` — stated in both theme blocks, with
the light values it shipped with, so daylight is unchanged to the pixel. The
`prefers-color-scheme` bootstrap in `layout.tsx` already runs on `/`, so a
signed-out visitor gets the right page with no flash.

Four things about that palette are worth knowing:

- **It reuses the app's tokens wherever the two mean the same thing** — `fg`,
  `muted`, `line`, `raised`, and the whole `ok`/`note`/`stop` family, whose
  light values already *were* the landing page's reds and ambers. The `lp-*`
  names exist only for what the chrome has no word for: two tinted grounds,
  the drawn tablet's shell, and the accent shades below.
- **`lp-accent` is the fill and `lp-accent-text` is the same colour as type**,
  and at night they must be two values: white has to sit on the fill and a link
  has to sit on near-black, and no single indigo clears 4.5:1 in both
  directions. In daylight they are identical. Use the fill for anything filled
  and the text one for anything read.
- **The accent keeps its hue at night**, where the chrome's accent goes white.
  The chrome's reason does not transfer: this page's largest element is a
  full-bleed block *of* the accent, so following `--color-accent` would have
  put a white slab across a dark page.
- **The drawn artwork stays literal in both themes** — the book covers in the
  figures, and the brand marks in `works-with.tsx`. A cover is a picture of an
  object and a trademark is a trademark. Only the drawn *interface* inside
  those figures follows the theme, because it is a picture of this app.

Three things in it are load-bearing:

- **The figures are drawn in markup, never screenshotted** — the phase list,
  the pre-upload check, the money panel. A screenshot is an asset that goes
  stale silently while the app moves, on the one page whose whole pitch is
  being checkable. The hero is the exception and goes further: it carries the
  **real check**, not a drawing of one — see `book-check.tsx`. The one bitmap
  on the page is the hero *backdrop* (`public/hero-{dark,light}.webp`, per
  theme, behind `--lp-hero`), which is abstract artwork rather than a picture
  of the product, so it cannot go stale. Its framing is *measured*, not
  eyeballed: the long comment above it in `globals.css` records the contrast
  ratio each anchor and size buys against the headline, and there is a separate
  phone framing because the text block ends higher there. Re-measure before
  swapping either image — the numbers are fitted to these two pictures.
- **Everything countable is imported and counted**: `STEPS`, `PHASES`,
  `ALL_TOOLS`, `TOOL_GROUPS`, the price from `plans.ts`. The ARC step's title,
  its number and its phase are all derived, because the page quotes them.
- **The stat band is where a SaaS page puts "trusted by 5,000 brands".** There
  are no customers to count and none may be invented, so it carries four figures
  counted out of the source instead. Never put a user count, a rating or a
  testimonial in that row until there is a real one.

**Every claim on it has to be true of the code, in both directions.** Nothing
claims what the app cannot do — the print PDF is the browser's print engine and
says so — and **nothing stays under the "Not built yet" badge once it ships.**
That second half fails in the safe direction and so fails silently: Track
carried "none of it exists today" for a while after Track shipped, which is
still a page saying something untrue. Walk the badges whenever a feature lands.
The page reads `SELF_TICKING` / `YOURS_TO_TICK` out of `roadmap.ts` and prices
out of `billing/plans.ts` rather than restating either, which is the shape to
prefer for any new figure on it.

**`works-with.tsx` is half-live, and the half that lives is the data.** The
current page imports `DESTINATIONS` from it — the shops and readers our exports
open in, each with the format named beside it so the claim stays checkable —
while the `WorksWith()` component that used to draw them is left over from the
previous design and has no caller. Do not delete the file when tidying that
design away, and do not add a destination there without an export that actually
opens in it.

The **previous** design — `landing-nav.tsx`, `publishing-check.tsx`,
`sections.ts`, `path-scroller.tsx` and the drawn figures (`landing-figures`,
`toolkit-figures`, `laptop-mockup`, `book-fan`, `formats-flow`,
`path-figures`) — is still in that folder and **nothing imports any of it
now**; the rewrite left it behind, and `font-brand` and the
"OpenChapter Landing v2" palette live only in those files. It is the finished
visual design of the *old* positioning, so treat it as reference rather than as
something to wire back up unchanged. One lesson in there is general and worth
keeping whatever happens to the rest: `sections.ts` has no `"use client"` and
exists only so both sides of the boundary can read one array — Next replaces a
client module's exports with client *references*, so a Server Component
importing an array from a `"use client"` file gets `.map` of a reference object
and the page 500s.

**Routes:** `/` — landing page for a signed-out visitor, the **dashboard** for a
writer (five areas, `?area=`), decided on the server off `getClaims()` so
neither sees the other's screen first; with no Supabase configured everyone gets
the dashboard · `/signin` · `/signup` · `/forgot-password` ·
`/reset-password` · `/auth/confirm` (the far end of any emailed link) ·
`/upgrade` plans (public — a price is read before an account exists) ·
`/upgrade/checkout/[orderId]` billing details, then a form POST straight to
PayHere · `/upgrade/done` PayHere's return_url, which polls ·
`/book/new` setup · `/book/import` · `/book/[bookId]` book
overview (lands here, not on a chapter) ·
`/book/[bookId]/chapter/[chapterId]` editor · `/book/[bookId]/read` reading view.

The fifteen tools all hang off `/book/[bookId]/`: `export`, `roadmap`,
`paperback` · `comps`, `blurb`, `categories`, `covers`, `title-check` ·
`structure`, `prose`, `progress`, `provenance` · `money`, `track`, `arc` —
grouped there the way `book-tools.ts` groups them.

**API routes:** `/api/chat` (assistant) · `/api/narrate` · `/api/transcribe` ·
`/api/comps` · `/api/comps/rank` · `/api/billing/*`. All of those except
`/api/comps` are metered and gated by `requirePro()`; `/api/comps` itself is
free, keyless and stays that way — which is the whole reason the ranking is a
route of its own rather than a flag on it.

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

**One greyscale palette in two values.** No hue anywhere except the status
family below. The dark set is the `@theme` block and the default — `surface`
#000 → `panel` #0a0a0a → `raised` #1c1c1c, `line` #262626, `fg` #ededed, `muted`
#8f8f8f — and the light set is the `:root[data-theme="light"]` block right under
it, which re-points those same names. Dark inverts light's elevation logic: on
black every surface above the ground is *lighter* and lifted by a hairline
(a shadow on black is invisible), while on white the desk is grey, cards are
white on it, and a hover *deepens*. That is why `raised` crosses over between
the two blocks rather than swapping ends.

Two rules keep the pair honest, and both are in the file:

- **Every token stated in one block must be stated in the other.** A name that
  exists in only one keeps its dark value in daylight, and it will be a hairline
  or a hover that nobody notices for a month.
- **The theme decides colour, never layout.** No `[data-theme="light"] .thing {
  padding: … }`, or the two become two designs.

**The writer's choice is `prefs.theme`: `system` | `light` | `dark`.** "system"
is a real answer and the default — a machine that turns dark at sunset has
already said what its owner wants. It is resolved *before CSS sees it*: the
bootstrap script in `layout.tsx` reads the pref, resolves "system" against
`prefers-color-scheme`, and writes `light` or `dark` onto `<html data-theme>`
before the first paint (hence `suppressHydrationWarning` on `<html>`).
`ThemeSync` at the root carries every change after that, and **listens to the
media query while the pref is "system"** — without that, a laptop turning dark
at sunset would only reach the app on the next reload. `theme-toggle.tsx` is the
control, and it lives in two places: inside the account menu (the row at the
foot of the dashboard sidebar) and in the editor's Text & type flyout, beside
the page colour. Both are "how bright is this", asked where the writer is.

Two consequences worth knowing. **Do not use Tailwind's `dark:` variant**: it
keys off `prefers-color-scheme`, so it would ignore a writer who chose against
their system — the whole point of the setting. And a library stored before the
theme existed has no `theme` recorded; `themeUnset()` spots that and `ThemeSync`
calls `setTheme("system")` once, which is the entire migration.

Three more things follow from the palette, and each has bitten already:

- **A filled action carries `text-accent-ink`.** The fill is white at night and
  near-black by day, so a fixed `text-white` on `bg-accent` is invisible in
  exactly one theme — the half nobody tests. `bg-danger` and the matter fills
  each carry their own `-ink` token for the same reason.
- **The three parts of a book are three values, not three hues** — front
  strongest, back palest, in binding order — and the five papers are five greys.
  **The unpicked paper follows the theme** (`setTheme` in `library-store.ts`):
  a black page in a white app is something the writer would have to go and fix,
  having chosen nothing. `paperPicked`, stamped by `setPref("paper", …)`, is
  what stops that touching anyone who has actually been to the Paper menu.
  Deriving it at read time instead was tried and is wrong: `getPrefs` is cached
  on the raw string, so anything derived from outside that string goes stale the
  moment the theme moves and nothing invalidates it.
- **In daylight the action colour is the brand ink, not near-black.**
  `--color-accent` is `#312e81` in the light block — the landing page's own
  indigo, the fill under "Start free" — and stays white in the dark block. The
  asymmetry is deliberate and documented at both ends: on black a hue has
  nowhere to stand (dark enough to carry white text and it sinks, light enough
  to read and it glows), so contrast is the only currency there. On white there
  is room for both, so one hue is reserved for *"this is the way forward"* and
  everything else stays grey. That is what lets a writer find the way on
  without reading the screen. Nothing else in the chrome may spend a hue.
- **The dashboard's colour ladder is four wide, and each one is a meaning.**
  Red is blocked (a shop would refuse this), amber is worth doing, green has
  passed or been earned, indigo is the road. So the Overview findings are toned
  by the severity `checkup()` already computed — drawing them all grey threw
  that answer away — while the *button* inside a red card stays indigo, because
  it is the way out of the problem and a red button would say pressing it is
  the dangerous part. `--color-step-*` is the fourth member of the status
  family, for the roadmap strip: it keeps its hue in both themes, since a
  ground carries nothing but its own ink and so never hits the legibility wall
  that forces the accent to white at night.
- **Two things keep their colour, on purpose.** The status family — the
  readiness badges (`Flag` in `bookshelf.tsx`), warnings, `danger`, the
  roadmap's completed ticks — because there the colour *is* the information and
  red/amber/green need no teaching. They are **tokens, not literal shades**
  (`ok`/`note`/`stop`, each a `-bg`, a `-line` and a `-fg`), precisely because a
  shade tuned for black is a dark blob on white: near-black ground with
  saturated ink at night, pale ground with dark ink by day, squared rather than
  a capsule. A translucent wash with pale ink was tried first and reads as a
  faded sticker. The other is the fifteen tool marks (`tool-marks.tsx`), which
  are product marks rather than chrome — fifteen grey marks are fifteen grey
  squares — and whose tile is a theme token, so the colour stays inside the mark.
- **The wordmark is the third exception, and it is one token wide.**
  `--color-wordmark` colours the "Chapter" in OpenChapter and nothing else —
  white in the dark set, and in the light set the indigo the landing page's
  closing banner is filled with (`#312e81`) at a higher lightness and the same
  hue and saturation (`#423ead`), so the mark a visitor reads on the way in is
  the mark they see once inside. The lift is only of lightness: a fill value
  set as type beside a near-black "Open" reads as more near-black, and a
  brighter indigo off the shelf would be a second brand colour pretending to
  be the first. The landing header draws the
  same wordmark at the same size, off its own `--color-lp-wordmark`, and the
  two are kept in step by hand. They agree in daylight and part at night on
  purpose: the app's token goes plain white because it sits in a black sidebar
  with nothing else near it, while the landing mark sits beside a page whose
  every link and button is indigo, where a white "Chapter" would read as a
  third colour rather than as the brand. So that one stays the accent's hue,
  lifted — the same relationship, at a different brightness.

The writer-facing looks stored in `prefs` are each applied their own way:
`theme` as `[data-theme]` on `<html>` (above), `paper` as `[data-paper]` on the
writing surface, and `focusMode` / `typewriter` as behaviour.

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
- **Templates and Background sound are built, tested, and have no way in.**
  `templates-dialog.tsx` + `book-templates.ts`, and `ambience.ts` +
  `use-ambience.ts` + `sounds-dialog.tsx`. They were shelf buttons pointed at an
  "Available soon" dialog; the buttons are now gone too, so the code is
  unreachable. It is not dead — do not tidy it away. `TODO.md` says what each is
  waiting on, and adding a rail item that opens the real dialog is the whole of
  switching either on. Two more things are kept callerless on purpose:
  `coming-soon-dialog.tsx` and `Badge` in `bookshelf.tsx`, which are what the
  next half-finished feature announces itself with. (The old landing components
  are a different case — see the landing note above.)
- Storage limits are real: covers capped at 250KB, inline images at 900KB, import
  at 8MB — localStorage is ~5MB per origin. `setCover` and `createBookFromImport`
  fail cleanly and return a signal; honour it.
- `TODO.md` tracks pending work and records *why* things were cut (e.g. front/back
  matter, per-chapter status). Read it before rebuilding something that looks
  missing — it may have been removed on purpose.
