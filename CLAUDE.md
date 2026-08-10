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
check digit, the billing price/cycle arithmetic, PayHere's two MD5s and
Paddle's status mapping, the
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
Both shapes are in the tree — the older routes use the helpers, the sixteen tool
routes write `props: { params: Promise<{ bookId: string }> }` by hand. Either is
fine; awaiting `params` is not optional.

## Architecture

**Persistence is one module.** `src/lib/library-store.ts` is the *only* file that
touches `localStorage`; everything else goes through it. (There is one *other*
storage backend, `cover-store.ts` on IndexedDB, and it is scoped so tightly it
does not weaken this rule — see the cover note below.) That boundary is what
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
`src/components/shelf/bookshelf.tsx` is six areas — Overview, Write, Prepare,
Track, Tools, Collaborators — and **Write is one of them**; the arrangement is the argument
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

**A roadmap tick is local-only, and `keepLocalOnly` is why it survives.**
`roadmapDone` has no column and no mapping in `sync.ts`, and `applyRemote`
writes the downloaded shelf straight over the local one — so every hand-ticked
step came back absent on the next load. Thirteen of the nineteen steps are
ticked by hand, so that was most of the road, silently, for anyone signed in.
The download is merged rather than replaced now: the server wins on every field
it has an answer for, and a field it cannot store survives. Any future
local-only field is covered by the same merge. The cost is that ticks stay on
the machine that made them, like the tool stores.

**The marker on a step is a control, and for a while it did not look like
one.** An unticked one was drawn in `line` — the same hairline as the rail
behind it — holding a `text-transparent` tick, so it was pixel-identical to the
non-interactive marker on a step that ticks itself. Now an unticked
*hand-tickable* marker carries a faint tick and a `muted` border, and the
*next* step also carries the words **Already done** on the row, matching the
dashboard's card. An unticked **automatic** marker stays empty, which is the
half that matters: the first attempt filled it grey with a faint tick to say
"not yours to press", and a filled circle with a tick in it is what *done*
looks like — "Write the blurb · ticks itself" read as finished on a book with
no blurb. A marker with no affordance merely fails to invite; one that reads as
ticked states something untrue about the book. One control per action: the row button
is `aria-hidden` because the marker beside it already announces the same toggle.

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
(which phase is expanded, which step's tool is open over the road), and
`?from=` on any link *into* a tool. That last one is why `src/lib/areas.ts`
exists — `areaLabel()` turns the id back into the words the back control says.
A tool is reached from the book cards, from Prepare and from the roadmap, so a
back link that always said "All tools" returned a writer working through a list
to the launcher instead of to the list. Link to a tool without `?from=` and it
falls back to that launcher, which is the wrong answer more often than not. The
`useSearchParams` rule above applies to all four.

**Sixteen per-book tools, described in one place.** `src/lib/book-tools.ts`
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
  `comps.ts`, `length.ts`, `subjects.ts`, `common-subjects.ts` and
  `shelves.ts` (categories), `rank.ts` and `title-check.ts`, with
  `keywords.ts` beside them in `src/lib/` rather than in `comps/`. Two more sit beside them without a tool screen of their
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
the tool's own name as the `h1` — **in a card, like everything under it.** It
was a full-bleed band with a hairline beneath, which is the shape a page header
takes when it is the only thing on screen that is not a card; now that the tool
screens work in boxes, a band above a column of them read as chrome the page
sat in rather than as the page's first thing. The band survives as the ground
the card sits on, which keeps the top distinct without a rule. The cover is load-bearing — the Tools area lets
a writer pick a book before opening a tool, so landing on the wrong manuscript
is a real way to lose ten minutes — and the heading is the tool rather than the
book, or every screen looks like the same screen with different contents. The
`width` prop must match the page's own container or the two left edges disagree
— it defaults to **`7xl`**, and **every tool now takes that same width**. It
was `5xl` with three screens opting wider, which meant walking from the blurb
to the comps moved both edges of the page; one measure is what keeps the
margins still. It is a page width rather than a reading measure — these screens
hold forms, stat rows and card grids — and where a screen really is a column of
prose the *content* caps itself inside the shared container, as the listing
form does at `3xl`. The header's
deck is capped separately at `2xl`, and the tool pages cap their own prose at
`max-w-prose`, so widening the page never widens a line of text. **`deckWidth`
is the one way out of that cap** and comps is the one screen that takes it: a
deck of two short sentences reads better across the page than stacked in a
narrow column beside an empty half-header. Widen it and shorten the words in
the same commit, or the cap comes straight back as a hundred-and-sixty-character
line. The export screen is the one that never took
this header; TODO.md records the decision as open.

**A tool screen has two frames, and `src/lib/tool-page.ts` is the contract.**
The roadmap opens six of them **over** the road rather than instead of it, so a
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

**That frame is a sheet over the road, and it is the second answer rather than
the first.** A two-column split kept the road on screen by reflowing it to 55%
— every card re-wrapped, the phase controls stacked, and the row being read
moved under them, so "where you were" survived in the sense that the page had
not navigated and not in the sense that anybody could find it again. It also
gave a `7xl` tool 45% of the window and left two scroll contexts fighting for
the wheel. The sheet is `fixed` rather than absolute (the road scrolls, and a
sheet that scrolled with it would leave the window on the way down),
right-anchored and inset from the left so the order stays visible with nothing
underneath moving, and sits at **`z-40`** — under the app's dialogs at 50, so a
tool's own dialog still opens over it. The backdrop is a real `<button>` rather
than a div with an `onClick`, and Escape closes it through `confirmLeave` like
every other exit.

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

**A tool that holds something the writer typed saves it on a press, and the
press ticks the road behind it.** Three modules and two controls:
`src/lib/tool-steps.ts` works out which roadmap steps a tool finishes —
**derived from the step's own `href`**, the same thing `step-panel.tsx` keys on,
so this cannot become a second roadmap that disagrees with the first;
`src/lib/use-tool-save.ts` holds what both controls need, taking the screen's
own `dirty`/`commit`/`discard` because a draft blurb is a string and a draft
listing is six fields; and `src/lib/unsaved.ts` is a one-slot module-level
guard, not context — the roadmap page is the *parent* of the tool holding the
draft, so context would have to be provided above the thing that fills it in.

Four things in there are load-bearing.

- **`ticksForTool` writes only the steps with no detector**, because
  `roadmapFor` ignores a stored tick on a detected step by design. That is not
  a gap: the detected ones are detected *from the very thing the screen saves*,
  so saving a blurb ticks "Write the blurb" without anything being written
  down. A tick stored there would change nothing and read as if it did work.
- **The bar appears only once there is something to lose**, and lives at the
  *foot of the window*. A Save that is always on screen is furniture and stops
  being read; one that arrives when you change something is impossible to walk
  past. It is at the bottom because these screens scroll — the keyword boxes,
  the category list and the ARC form are below the fold on an ordinary laptop,
  and a control anchored to the top of the document is not on screen at the
  moment it becomes relevant.
- **Four ways out, three mechanisms, and none of them covers the fourth.**
  Links are caught by one capture-phase listener on `document` (a `<Link>` is
  an anchor, so the breadcrumb, the back control and every link a tool draws
  are covered at once); the tab closing is `beforeunload`; the browser's back
  button has no cancellable event, so a spare history entry is pushed **once
  per mount** and a `popstate` lands on it. Anything that leaves without
  navigating — the roadmap panel's Close, and swapping the panel to another
  step — calls `confirmLeave`, which falls straight through when nothing is
  pending. A `leaving` ref short-circuits all of them once the writer has
  chosen to go, or "leave without saving" walks back onto the sentinel, fires
  `popstate`, and asks the question again forever.
- **`ToolStepDone` is the other control, for the four tools with no draft** —
  covers, comps, the title check, export. Nothing on those can be unsaved, so
  a Save bar would never be true; what they have is a step no detector can
  tick, and it says "Mark step done" rather than "Save", because a Save button
  with nothing to save is the dead UI the house rules forbid.

Two consequences worth knowing. A screen holding a draft must **fall back to
the store rather than seed itself in an effect** (`draft ?? stored`, with
`null` meaning untouched) — the seeding version needed a `seeded` ref read
during render, which is a lint error for a real reason, and cost a second
render for something the first one already knew. And a draft compared against
`book.publishing` goes through `tidyPublishing`, because `setPublishing` drops
every empty field on the way in: a box the writer cleared is `""` on screen
and *absent* in the store, so a plain `JSON.stringify` comparison leaves the
form permanently unsaved.

**These screens share a house style, and tests enforce it.** No score, no grade,
no number invented to look like an answer. Facts rather than verdicts ("you
wrote on 12 of the last 30 days", never "you should write more"). **Detected
beats ticked** — a roadmap step worked out from the book cannot be lied to, and
the two that cannot be detected honestly (finishing a draft, commissioning a
cover) are hand-ticked and say so. Every figure carries its provenance. And a
measurement is reported *with how many records carried the field*, because a
median from three books and the same median from eighteen are different claims.
And **an empty result is never rendered as a good one** unless the search that
produced it actually ran: the title check draws "nothing published under this
name" from zero records, so it must carry which catalogues answered, or Open
Library returning 503 for a few minutes tells a writer their title is free when
it is on the shelf below. A failure and a clean result look identical in the
data; only the source flags tell them apart.

**The title check is one box too, and its finding arrives in the corner.**
The shelf's own name sits at the top of that box with the search *under* it —
while nothing has been checked the covers are the page, and the field is the
thing you use on them. The paragraph explaining what the button would do is
gone: it described the button to somebody looking at the button. And the
verdict — the coloured card with the count, the reason and the provenance — is
a **toast** (`TitleToast` + `Verdict`), top right, dismissible, *never* on a
timer: it is the answer rather than a save confirmation, it takes longer to
read than any timeout, and the shelves it describes stay on the page, so
closing it loses the summary and none of the evidence. Dismissal is remembered
against the title it was about, so the next check brings its own.

**The comps screen is one box: shelves, then the search, then the covers.**
The three were loose on the page with nothing saying where the controls ended
and the answer began, and the covers — which *are* the answer — read as a
separate page underneath. The shelves are *inside* the search box — `SearchBox` is a combobox, and
opening it shows all twenty-six at once in columns rather than a scrolling
eighth of them. They were a section of their own for a while and that was one
section too many: a heading, a caption and twenty-six chips doing the job the
box does. Picking one **fills the field and does not search** — browsing the
list is not a decision to spend one of the ten — and the field shows the
shelf's *name* rather than the `subject:"…"` query it stands for, which is our
syntax leaking into somebody's text field. The box sits directly above the
covers it produces, which is where every shop that sells books puts its
search. What stays outside the box is the
arithmetic below it — median pages, the subjects, the length reading — because
those are readings *of* the shelf and keep their own cards, or the box is the
whole page and stops meaning anything.

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

**The two catalogues take the same question in different dialects**, and
`openLibraryQuery()` translates it. Google wants `intitle:`, Open Library wants
`title:` — and Open Library answers a prefix it does not know with **zero
results rather than an error**, which is the failure mode worth naming: the
title check sent `intitle:` to both for its whole life, so every result it ever
showed came from Google alone while the page said it read both. It looked like
it worked because Google carries the popular titles. Anything with no prefix —
every ordinary comps search — passes through untouched. `reportedTotal()` is
the other half of honesty here: Google's `totalItems` says how many the
catalogue claims exist against the handful it handed over, because a screen
counting what it fetched reads as counting the world. It is an estimate, wobbles
between identical requests, and so is shown as an approximation and never used
in arithmetic.

**A fourth route feeds the category box as it is typed into.**
`/api/comps/subjects` (GET, **free and keyless**, like `/api/comps` and for the
same reasons — it is a lookup rather than a judgement) queries Open Library's
subject index so the suggestions are real shelves with real sizes. It is not a
hard-coded list on purpose: BISAC is licensed, and inventing our own list of
"all book categories" is the exact failure the categories screen exists to
avoid. Two measured details drive its shape. Nothing is fetched below **two
characters** — `m*` is an HTTP 500 on their side and plain `m` matches middle
initials, returning Nixon and Kennedy — so the first keystroke is answered
locally from `common-subjects.ts`, 900 of Open Library's own headings with
Open Library's own counts, harvested once and shipped (CC0; caching their
answers is not inventing them). And the query goes as **both the plain word and
a wildcard, joined by OR**: the index is stemmed, so `cozy*` matches nothing
against terms stored as "cozi", while a bare `myst` finds the computer game and
no mystery shelf. A failed lookup returns an empty list, never an error — a
dropdown that cannot suggest is just the text box it was before.

**A fifth route writes the query itself, before the search rather than after
it.** `/api/comps/query` (POST, `requirePro()`, a model via `ai.ts`) over the
pure `src/lib/comps/query.ts` sits *upstream* of the ranking, which is where
the leverage is: `rank.ts` reorders what was fetched and cannot rescue a fetch
that brought back the wrong books, and a writer describes a *story* while a
catalogue indexes *subjects*. What is sent is the words in the box and the
genre already chosen — not the manuscript, not the blurb — so it is the
cheapest of the model routes by a wide margin. Five things hold it:

- **Nothing here invents a book**, which is what makes it allowed. The model
  writes a *search*; the catalogues still supply every record, so the failure
  `rank.ts` exists to prevent — a plausible title that does not exist, about to
  be pasted into a query letter — is structurally impossible in this direction.
  The worst a bad query can do is find nothing.
- **A prefix neither catalogue takes is dropped**, not passed on (`ALLOWED`),
  because Open Library answers an unknown prefix with zero results rather than
  an error — one stray `isbn:` would empty the shelf with nothing on screen to
  explain why.
- **The query goes back into the box**, editable and undoable. A model quietly
  rewriting somebody's search and presenting the results as theirs is the
  invisible hand this app refuses everywhere else.
- **A translation that finds nothing loses to the words it replaced.** Measured,
  and not a rare edge: a stacked four-term query is ANDed by the catalogue and
  returns 0 where the raw words returned 6. The prompt was tightened, but a
  prompt is a request rather than a guarantee — so the client re-runs the
  writer's own words on an empty result and the box goes back to showing what
  was actually searched.
- **Only plain words are translated at all.** `looksPlain()` skips anything
  already carrying a field prefix, since the shelf chips and the seeded search
  send `subject:"…"` — the very thing a model would be asked to produce.

**Ranking those comps is a separate route, and the split is the design.**
`/api/comps/rank` (POST, `requirePro()`, a model via `ai.ts`) over the
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

**A third route answers the shop’s form rather than the librarian’s.**
`/api/comps/categories` (POST, `requirePro()`, a model via `ai.ts`) over the pure
`src/lib/comps/shelves.ts` translates the librarian subjects `subjects.ts`
ranks into the category paths a shop’s own selector uses — a translation no
table can do, since Amazon dropped BISAC for its own tree in 2023. It sends
**subject names and counts only**, never the book. Two rules hold it: the
counts are *ours*, re-attached after parsing, because a model asked for a
number produces a plausible one and a plausible count cannot be told from a
real one; and a path is a **candidate**, not a fact, because only the shop
knows its own tree — the screen says to confirm each in the selector.

**Those two routes ask a model through `src/lib/ai.ts`, and which model is a
deployment decision.** Both want the same shape — a system prompt, one user
message, JSON back — and neither cares who answers, so `askModel()` is the one
way to ask: `ANTHROPIC_API_KEY` makes it Claude, `GOOGLE_GENERATIVE_AI_API_KEY`
makes it Gemini, both set and Claude wins, `OPENCHAPTER_MODEL` overrides the
model name without a deploy. `modelProvider()` returning null is how a route
answers 501 with a message saying so, the same shape as everything else here.
Three things about it are deliberate. **The assistant is not routed through
it** — `/api/chat` streams, caches the chapter in a system block across turns,
and stays on the Anthropic SDK directly; this is for short, bounded, one-shot
calls. **Nor is the gateway used**, though narration and transcription go
through it on `AI_GATEWAY_API_KEY` and it would have been the tidier home: it
was tried, and the gateway refuses every request without a card on file. And
**Gemini is written out over its REST API** rather than pulled in via
`@ai-sdk/google`, because the whole of what it does is one POST and one field
lookup, and it keeps the dependency list honest about a provider expected to be
temporary. Its key rides in a header, not the query string, so it stays out of
anything that logs a URL. Budget generously on Gemini 3 — thinking tokens count
against `maxOutputTokens`, so a ceiling that comfortably fits the answer still
truncates it.

**No search volume, no competition score, no rank — anywhere in this
cluster.** That is the figure a writer wants and it cannot be had honestly:
Amazon’s Product Advertising API shut down in May 2026, its replacement needs
ten affiliate sales a month, and the tools quoting a figure buy scraped data
from a vendor. Scraping is forbidden by Amazon’s own terms and would put the
risk on us. `keywords.ts` and `shelves.ts` each have a test asserting their
shape carries no such number, and both are tests not to "fix". What is offered
instead is `keywordReport()`: the seven backend keyword boxes counted — over
the 50-character limit, words the title already owns so the shop indexes them
anyway, the same word spent twice, and phrases shops publish a rule against.

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

**The selection bar's font picker is the one control on it that takes two
clicks, and that is what made it the one control that did not work.** Every
other button acts on the first press, while the selection is still there.
Opening a menu and then choosing does not: the press collapses the browser's
selection — `preventDefault` keeps *focus* in the prose but not the range — and
ProseMirror syncs that collapse into its own state a tick later. So the command
landed on an empty cursor and the face never changed. Three things hold it
together now, and each fixes a different symptom of that one cause. The picker
**remembers the range when it opens** and puts it back with `setTextSelection`
before applying, so the command lands. It also **puts that range back from
inside the `selectionUpdate` event itself** — the bubble is anchored to the
selection, and a caret sits at the *start* of what was highlighted, so opening
the list threw the whole toolbar leftwards away from the words it was about.
Restoring it on the next animation frame fixed where the bar ended up and not
the lurch: that is a frame with the bar drawn in the wrong place, and a frame is
plenty to see. Handled in the event, the second transaction lands in the same
task as the first and the wrong position is never laid out — measured at one
distinct x across forty frames. For the same reason the trigger's name has a
**fixed** width: sized to its content, "Book" to "Baskerville" changed the bar's
width, and a bar centred on the selection slides when it resizes. And
`menuOpen` joins `pointerOnBar` in `shouldShow`, so the bar cannot vanish out
from under a list that is still open.

**It shuts three ways, and all three were missing**: Escape, a press anywhere
but the list, and *a new selection*. That last one is the one to keep: `open` is
component state and this toolbar is not remounted between selections, so a list
asked for once reappeared over every phrase highlighted afterwards. Word gets
this right by having no state to leak — its mini toolbar is rebuilt per
selection. The press-outside rule matters more than it looks, too: while the
list is open the bar is *told* to stay put, so without it a writer who clicked
away was followed around the page by a toolbar and a font menu for a selection
they had abandoned.

**The list only ever opens upwards, and it is allowed over the chrome.** The bar
floats above the selected words, so a list dropping downwards lands on the very
sentence being previewed — and looking at their own prose in each face is the
whole reason it was opened. Flipping to whichever side had more room was worse
than useless: near the top of the page it chose down, covering the text. So it
goes up, capped to the window and scrolling, and where the page runs out it goes
over the manuscript's desk bar rather than turning round. That is why it is
**portalled to the body and fixed** — it has to paint above that bar, and a
`z-index` on a descendant of the editor cannot escape the stacking contexts
between it and the top, which is what put its first rows behind the bar. Same
reason the Aa flyout in the rail is portalled; same consequence, that it shuts
on an outside scroll or a resize, since a fixed position from a rect goes stale
the moment the page moves.

Around that sit the two behaviours the tools writers already use have taught
them to expect. **The trigger names the face** rather than showing "Aa" in it,
which is what Google Docs and Word do: two letters cannot tell Garamond from
Palatino at 12px, and the *list* is where a face is shown in itself. And
**hovering an option sets the words in it** — Word's Live Preview, which has
survived twenty years because a typeface is the one choice nobody can make from
a name. That preview is a **decoration, never the mark**
(`src/lib/editor/font-preview.ts`): applying and unapplying the real thing would
put six entries in undo for a decision nobody has made, mark the chapter dirty
for autosave, and strand a face on the page if the pointer left on the wrong
frame. The transaction carries no steps, so Tiptap's `update` never fires, and
it paints no background of its own — the real selection is still there and the
browser is still drawing it, so a second band would be the same colour twice.

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
open, and clicking the active tab closes it — one control, never two.

**The tool panel floats over the manuscript; it does not push it.** It was a
static column at `md` and up, so opening Search slid the panel, the sheet and
the right rail 15rem across and closing it slid them back — the sentence being
read moved under the eye and the paragraph re-wrapped at a new measure. These
panels are *consulted* and dismissed, and a surface you glance at may not reflow
the one you are working in. It is `fixed` at every width now, with a shadow,
because a layer over another layer has to say so.

Four things follow. **One header for all nine tabs**, written by `LeftPanel`:
four of them drew their own and five drew none, so the panel's top edge moved
with the tab and only some of them said what you were looking at. The names live
in `PANEL_TITLES` and the rail reads them for its tooltips, so the button and
the panel it opens cannot end up with two names for one thing. Two tabs also
carry a **scope** (`panelScope`) — Notes is per *chapter* and the parking lot is
per *library*, they sit next to each other in the rail, and both were a plain
box under a one-word heading, so a note about Chapter 3 was one debounced save
from a place nobody would look for it. The chapter's name is set in the writer's
own casing, not uppercased with the heading beside it.

**Four ways out and they are one toggle** — the rail's tab, the header's control
at the top right, Escape from inside the panel only (it is a layer, not a modal,
so Escape in the manuscript must not close it), and **a press anywhere else**.
That last one is what a floating panel owes the page under it: it is consulted
and dismissed, and the dismissal should be the gesture you were making anyway.
Both rails are excluded from "anywhere else" (`data-rail`) and that is not a
nicety — they hold the controls that open and close it, so pressing the tab you
are on would close the panel on `pointerdown` and have it opened straight back
up by the `click` behind it.

**The panel-toggle button is in exactly one place at a time**: in the rail while
shut, in the panel's header while open, never both. Its divider goes with it, so
the tabs close up to the top of the rail — a divider at the top of a list
separates it from nothing. Holding the slot open instead was tried, to stop the
icons below shifting by one position as the button leaves; it was worse to look
at than the shift it prevented, since an invisible 48px box plus a hairline is
sixty-odd pixels of nothing at the top of a narrow column and reads as a rail
that failed to load.

**It animates both ways, so `LeftPanel` owns its own mounting.** The caller
passes `open` rather than writing `{open && …}`: a panel removed from the tree
cannot animate its exit, so it stays mounted for `EXIT_MS` (in step with
`.oc-drawer-out`) and then takes itself down; nothing mounts at all before the
first open, so a writer who never opens a panel never pays for the bible, the
assistant or the history reading storage. The travel is a whole drawer's width
from behind the rail — which is why the left rail is `z-[45]`, above the panel's
40 and under the app's dialogs — rather than a nudge, because a nudge reads as a
layer that was always there. In decelerating, out accelerating and quicker.

**The rail is grouped, and the groups are the argument** (`GROUPS` / `FOOTER` in
`workspace-rail.tsx`): finding a place in the book (search, bookmarks), then
what is kept beside the book (notes, ideas, bible, assistant), then the two
safety nets — versions and the trash — pinned to the foot, where Material's own
rail guidance puts this class of item and for the reason that matters here: the
trash is the one button in the column nobody wants to press by accident, so it
must never sit where the eye has learned to find something else. The right rail
is the same idea read top to bottom: **write · view · leave** — type, image and
dictation as one undivided group, the two view toggles, then the assistant and
Export together at the foot, since neither acts on the page.

Three of those tabs are writer-pain features, each a panel over a pure module:
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
(front/body/back), each in its own colour, and **each opening into a list of
pages** — chapters in the body, named pages in the other two. Its face is the
stored `bookPanel` pref rather than component state, so a reload does not put
the writer back on the cover; *which* card is open lives in `useOpenPart`,
exported from that file and called by the *screen* rather than the panel,
because the manuscript needs the same answer — the page sheet's edge takes the
colour of whichever part the panel has selected (`data-matter`, and the
`--paper-edge-*` tokens in `globals.css`). Two copies of that state would be two
answers to one question. It returns a part rather than a boolean, and one part
is open at a time: an open list takes the height the other two cards give up, so
two at once would be three rows and a scrollbar each.

**Front and back matter are lists of pages, and `src/lib/matter.ts` is the
whole of what they offer.** They used to be *one page each*, whose template
carried every standard division as a heading — so a writer met eight printer's
terms stacked on one sheet, could not open one, could not delete the six they
did not want, and was told nothing about what belongs under any of them. Worse,
left alone that sheet exported: a reader opening the finished EPUB found a bare
list of terms between the cover and Chapter One. Now each division is a page:
`startMatter` makes the standard set, `createMatterPage` adds one, and
`deleteChapter`/`renameChapter` already did the rest. Three things in there are
load-bearing:

- **Every template line a writer must replace carries a `[bracket]`**, and that
  is the mechanism rather than a house style. It is the only mark the export has
  to tell a page somebody wrote from a page nobody has touched, and it survives
  what a stored flag would not — a rename, a sync to another machine, a round
  trip out through an EPUB and back. A stored flag would mean a new column in
  Postgres, and a page that lost it would either ship as scaffolding or vanish
  with somebody's dedication in it.
- **`isUntouchedMatter` in `export/blocks.ts` is the one rule, and the panel
  calls it too.** A page with a placeholder left anywhere on it, or with no
  prose at all, does not go in the file — and the row in the panel says *Draft*
  from the same call, because a mark that agrees most of the time is worse than
  no mark. The export screen then **names every page it left out**: a filter
  nobody can see is worse than the problem it solves.
- **A page added later lands where it is bound**, not at the end
  (`matterSectionIndex`), and a page the writer named themselves sorts last —
  `Infinity` rather than -1, or an unknown page jumps to the front of the book.
- **None of the sixteen is required by any shop, and the app says so.** What a
  shop wants is a cover, a title page, working navigation, honest metadata and
  content the writer owns; Amazon names "About the author" as an *example* of
  back matter, and Kobo refuses listings that look unfinished — so a book
  carrying an empty epigraph and an invented also-by list is worse off than one
  carrying neither. Sixteen identical checkboxes read as a list to complete, so
  three things counter that, all at the moment of choice rather than in a popup
  afterwards: the dialog states that a page left empty is left out of the
  export, the front column says the export *already builds* a title page, a
  copyright page and a contents list (`isGeneratedPage`), and the few pages
  most books have are marked `usual` — which is also what splits the panel's
  Add-page menu into "Most books have" and "If your book needs one". The marker
  is deliberately a label rather than two groups behind a disclosure: hiding
  thirteen real choices behind a click to fix a problem of *framing* is the
  wrong trade on a list this short.

**The question is put once per book, on the way in.**
`matter-setup-dialog.tsx`, mounted by the panel because both screens that draw
those cards mount it, shown when `shouldAskMatter(book)` — no matter pages at
all, and not asked before. It exists because the cards have nowhere to explain
themselves: Start makes all sixteen, which is right for somebody who does not
know what any of them are and wrong for everybody else, and "Epigraph" on a
button teaches nothing. Four things about it are deliberate. **Skip is a real
answer**, a button rather than a cross, and Escape means the same thing — asking
again next Tuesday would make it a nag. **Nothing is created until they press**,
so skipping leaves the book exactly as it was and Start still works later.
Whether the question was put is a **note in `prefs.matterAsked`, not a field on
the book**: it records nothing a reader of the manuscript would want, and a
field on the book would need a Postgres column to survive `sync.ts` at all.
And `createMatterPages` takes the whole list in **one commit** — a dozen pages
through a single-page function would be a dozen shelf writes, fan-outs and
pushes for one gesture.

**Where the generated pages and the written ones meet.** Three of the front
sections — title, copyright, contents — can now come from either side, and a
book carrying both got two title pages on consecutive sheets. `writtenPages()`
in `front-matter.ts` matches by title and the *written* page wins: ours is the
fallback, assembled from fields so that a book which said nothing still opens
properly, and there is nothing left for it to add once somebody has set their
own words there. Renaming the page hands the job back to us, which is the safe
direction to be wrong in.

**Four pages are apparatus, and the flag is in `matter.ts`.** A half-title, a
title page, a copyright page and a contents list are furniture rather than
divisions of the book, and three renderers ask the same question about them
(`isApparatusPage`): they print **no heading** — no published book has a sheet
headed "Copyright page"; the name exists so a writer can find the page in a
list — and they are **left out of the contents**, both the generated page and
the EPUB's nav and ncx, which is what the shops' own ingestion guidance asks
for. A dedication, an epigraph, a prologue and an acknowledgements page are
real divisions and get both. A page the writer named themselves is not
apparatus: nothing is known about it, so it keeps its heading and is listed,
which is the answer that loses nothing if wrong.

**`spineOrder` binds the generated pages among the writer's own.** They used to
be emitted first and the chapters after — right while front matter was a single
page nobody made, and wrong the moment a book could carry its own half-title:
the file opened on a generated title page, then the contents, and *then* the
half-title that should have led the book. Each generated section now takes its
slot in `MATTER_SECTIONS.front` and merges in by rank. Note that the *files*
are named positionally (`chapter-03.xhtml` is the fourth loaded chapter), so
neither the spine order nor the contents filter may renumber them — every
filtered list carries the original index.

**The chapter opener prints one thing, not two.** `chapterXhtml` emitted a
standing numeral *and* the heading, and this app's own default titles **are**
the number — so most exported books said "1" over "Chapter 1" on the opening
line of every chapter. Both it and the contents page now ask
`isGenericChapterTitle`, the store's own answer, which knows the digit and the
spelled form; `front-matter.ts` used to carry a private near-duplicate that
missed the spelled one.

Two things fall out of this that are easy to get wrong. The seeded body carries
**no heading**: the page's title is printed above it by the editor and by every
exporter, so a seeded `h2` of the same words arrived in the EPUB twice, one
under the other. And a matter page's `epub:type` is **its part and its
division** (`chapterSemantics`) — every page used to be `bodymatter chapter`, so
a dedication announced itself as a chapter of the novel and the `bodymatter`
landmark, which is what Apple Books uses for "begin reading", pointed at it.

`ChapterMeta.matterKey` is left over from the one-page design and is read by
nothing. It is not tidied away: books written before the change still carry a
combined page with the writer's prose in it, and it lists, opens, renames and
exports like any other matter page.

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

  **A finished export says so, and PDF is the one that cannot.** `runExport`
  answers with an `ExportResult` — the filename and the blob — and
  `ExportDoneDialog` (`components/export/export-done.tsx`) is what a writer sees
  after the press: a download is the only action in the app with no visible
  result, since the browser takes the file to a folder we cannot name and,
  depending on its settings, says nothing at all. It carries the name to look
  for, the size, the *same bytes* offered again (a blocked or missed download is
  the commonest failure here and is invisible from this side), where the format
  opens — from `DESTINATIONS`, so it cannot name a shop the export does not
  reach — and the next step on the road, searched from *after* the export step
  since that one is hand-ticked and un-ticked by definition at that moment. It
  is opened by the press and never by an effect, the `LimitDialog` rule: an
  effect would fire again on a remount and congratulate somebody for a file they
  downloaded yesterday. **`runExport` returns null for PDF** and no dialog
  shows — the print engine is the browser's, so whether anything was saved, or
  the writer pressed Cancel, is not knowable from here, and "your PDF is ready"
  over a cancelled print dialog is a claim the code cannot back.

  **The copyright page is on by default and left out when there is no author.**
  It was off for a while, on the reasoning that it needs a name the writer may
  not have set — the right worry and the wrong lever, since it meant every book
  exported by somebody who never opened that step shipped with no copyright page
  at all. The name is handled where it can be handled honestly: `frontSections`
  drops the page rather than printing the *title* as the rights holder, which is
  what the fallback used to do, and the toggle's hint says which field is
  missing. The fiction disclaimer is printed only for a book that is fiction —
  "the product of the author's imagination" at the front of somebody's memoir is
  a statement that their life did not happen, so `Memoir` and `Other` get the
  page without it.

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

  **An EPUB says which page is which, and the importer believes it.**
  `parseEpub` returns a section per spine document carrying the `epub:type` on
  its body, and `importFile` lifts the ones typed `frontmatter`/`backmatter`
  out as matter pages while the rest go through `splitIntoChapters` exactly as
  before — so every other format, and an EPUB that types nothing, takes the
  path it always did. It used to concatenate the whole spine into one block
  stream and re-derive chapters from headings, which threw away the only thing
  an EPUB is reliably good at saying. The cost showed the moment the app could
  read a book it had just written: the half-title, title page and copyright
  merged into a body chapter called *"Chapter 1 – Dedication"*, because
  apparatus prints no heading to split on and a dedication does. Two details
  are load-bearing. The **part can be inferred from the division** — plenty of
  files write a bare `toc` with no `frontmatter` beside it, and our own
  generated pages did until `FRONT_SEMANTICS` was fixed to name both. And an
  apparatus page takes **the division's name over its `<title>`**, because a
  generated title page's `<title>` is the *book's* title and importing a page
  called "The Salt Ledger" is a page nobody can find in a list.

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

**A cover is three things, written together.** `cover-save.ts` is the one place
that sets one, and `saveCover(bookId, file)` writes all three: a **700px JPEG
thumbnail** to `localStorage` (what the shelf renders, and the only one small
enough for `sync.ts`), the **original artwork** to IndexedDB via
`cover-store.ts` (what the EPUB packages), and the **measurements** to
`coverfacts:<bookId>` (what `cover-check.ts` reports, taken from the file the
writer picked rather than from what survived the resize).

This exists because the app was **checking a standard and then breaking it
itself**: the check told a writer their cover had to be 1000px on the long edge
and ideally 1600×2560, `image-import.ts` stored it at 700px as WebP, and the
export packaged that — so perfect artwork shipped as a 495×700 picture with
nothing on any screen saying so. `runExport` now reads `getPrintCover` first
and falls back to `getCover`.

Four things about it are load-bearing. **IndexedDB is forced, not preferred** —
a 1600×2560 JPEG is a few hundred kilobytes and base64 in `localStorage`
inflates it by a third against a budget the whole library shares; eight books
would fill it and start failing autosaves on unrelated chapters. **Every
failure resolves rather than throwing**, so Firefox in private browsing (which
refuses IndexedDB outright) degrades to exactly the old behaviour instead of
breaking the export. **Covers are JPEG, inline images stay WebP** — the size
saving matters inside a manuscript and no shop has objected, while a cover is
the one image a shop's converter meets first and KDP is not a safe bet for
WebP; `importImage` takes an `encode` option, and `originalImage` keeps the
writer's own bytes untouched when they are already JPEG or PNG. And **it does
not sync** — `sync.ts` carries the thumbnail and knows nothing about this
store, so a writer on a second machine exports at thumbnail quality until they
upload the artwork again. The covers tool says so; don't quietly drop that line.
`clearLocalLibrary` clears it too, or the second writer on a shared browser
exports the first one's picture.

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
book publishing, billing, feedback, collaboration, Paddle). Schema changes
belong there, not only in the dashboard. **All six are applied to the live
project** — the first five as of 2026-08-07 and `20260808000000_paddle.sql` on
2026-08-09, proved by the sandbox checkout writing `provider`,
`paddle_subscription_id` and a period end into real rows rather than by the SQL
editor saying "Success". `20260730000000_book_publishing.sql` had been outstanding for a
week, which meant every book push silently dropped its listing details, and
`pushBook` carries the self-healing retry that made that survivable rather than
fatal. Keep that retry: it is the pattern any future column should follow.

**Some books have two writers, and `src/lib/collab.ts` is the pure half.**
Two roles — **editor** writes the manuscript, **viewer** reads and exports it —
and no third. The standard third rung is a *commenter*, absent because there are
no comments here: a role that cannot do the one thing its name promises is worse
than one that does not exist. Reedsy is the cautionary case, advertising three
permission levels while every invitee gets full edit rights.

**The line is drawn at the book, not at the prose**, which is where Atticus draws
it too. An editor writes chapters, bodies and notes; the `books` row, the cover,
the page setup and the listing details stay the owner's. That is not caution —
`last_opened_id`, `last_opened_at` and `position` live on that shared row and are
*per-writer*, so an editor allowed to write it would overwrite the owner's place
in the manuscript every few minutes. One sentence holds it: **an editor writes the
book, the owner owns the book.** `keepLocalOnly` therefore carries `archivedAt`
and `trashedAt` across a download for a shared book, and `rowsToBook` prefers the
*local* `lastOpened*` — without both, the owner's values arrive as the reader's on
every load.

**Three rules live in SQL because the client cannot be trusted with them**, and
`supabase/migrations/20260806000000_collaboration.sql` **drops and rebuilds** the
library's policies rather than adding to them:

- **`owner` on every child row is derived by trigger, never accepted.** Those
  columns cascade to `auth.users`, so a row stamped with an editor's uuid means
  that editor closing their account silently deletes the owner's chapters and
  prose — through the one path nobody tests.
- **Write permission is decided by the *book*, never by the row's own `owner`.**
  `with check (auth.uid() = owner)` is satisfied by any stranger claiming the row.
  That was already true of `chapters` before this feature and invisible only
  because reads were owner-filtered too; making reads book-scoped would have
  turned it into injected chapters in a stranger's sidebar.
- **A chapter cannot change books, and prose cannot change chapters.** RLS
  compares USING against the old row and WITH CHECK against the new, and an editor
  moving a chapter into their own book satisfies both. Only a trigger sees a key
  move.

`chapter_bodies` and `chapter_notes` gained a **`book_id`** so a policy on them
need not reach through `chapters` — through a definer helper that bypasses
`chapters`' own RLS, inline it makes one table's security depend on another's.
`book_role()`, `shared_book_ids()` and `writable_book_ids()` are `security
definer` with `search_path = ''`, which is also what stops `books`' policies and
`book_members`' policies recursing into each other; do not `force row level
security` on either, and do not write either ownership test inline.

**`book_members` is written by nothing but the server.** `select` is granted to
`authenticated` **by column** — `token` and `invited_by` are withheld, so every
read must name its columns or PostgREST refuses the whole query — and there is no
insert, update or delete grant at all. Mutations go through Server Actions in
`src/app/collab/actions.ts` holding `createAdminClient()`, the posture billing
already takes with `subscriptions`, because the seat cap needs `isPro()` and
`isBillingConfigured()`. The *counting* is done in SQL under `select … for update`
(`invite_book_member`, `accept_book_invite`): two invitations racing each other
each see the other's absence and both get in.

**Seats are per book and count the owner** — `SEATS_PER_BOOK` in `free-limits.ts`,
2 free and 10 on Pro. Deliberately **not** the same kind of number as the
tooled-book list: a seat is current *occupancy* and comes back when
somebody is removed or an invitation lapses. It is the one limit Pro *raises*
rather than lifts, so `spentLine` drops the word "free" for a paying owner and
`LimitBanner` says what Pro actually does — printing "Unlimited" there would be
the one false cell on the pricing page. A lapsed plan **evicts nobody**; it only
refuses new invitations.

**No email is sent, and nothing may say one was.** The owner copies a link; the
invitation also appears in the invitee's own Collaborators area. The link is a
*pointer, not a credential* — `/invite/[token]` sits behind the sign-in wall, and
`acceptInvite` refuses anyone whose **confirmed** address is not the invited one,
checked with `auth.admin.getUserById` because Supabase puts `email` in the access
token whether or not it has been confirmed. Invitations expire after
`INVITE_DAYS` (14), derived from the stamp rather than stored — nothing sweeps
the table — and cancelling is silent.

**Every push in `sync.ts` is owner-aware, and two filters are load-bearing.**
`pushBook` skips the `books` upsert for a book somebody else owns and sends only
the **changed** chapter rows (`changedChapterIds`) — it used to upsert the whole
list on any change to the book, including a word count bumped by autosave
elsewhere, which silently reverted a co-writer's renames. `uploadLibrary` and the
strays filter in `syncWithServer` both exclude books with a foreign `ownerId`:
without that, revoking access makes the book local-but-not-remote, so the
ex-collaborator's next load takes it for unsaved work and re-uploads somebody
else's manuscript under their own account. A book that stops arriving is marked
`access: "lost"` rather than deleted, because a half-failed fetch and a revocation
look identical.

**A new column `fetchLibrary` selects must degrade when its migration is absent.**
`chapter_bodies.rev` is asked for, and a 42703 falls back to the shape that worked
before (`hasRevColumn`, `missingColumn`) — PostgREST refuses the *whole* select
for one unknown column, so without that the entire library download fails for
everybody, over a feature they may not use. Same lesson as `pushBook`'s
`publishing` retry. Errors here are printed field by field via `describe()`: a
PostgrestError is a plain object and `console.error` renders one as `{}`.

**Read-only has to be true, not merely claimed.** `canWriteBook` gates the
editor's `editable`, the title input, the chapter sidebar's and book panel's
controls, and — through `useToolSave` returning `dirty: false` — every tool
screen's Save bar at once. `saveBody` refuses to write localStorage for a book
this writer may not write, so a viewer's copy cannot silently diverge from the one
everybody else sees.

**`docs/checks/collaboration-rls-check.sql` is how this was verified**, and it is
kept because reading a migration back proves nothing. Two things about running it
are the trap: the SQL editor connects as `postgres`, which **bypasses RLS** — so a
policy test means nothing there unless it first does `set local role
authenticated` and sets `request.jwt.claims`, while trigger tests need no such
thing because triggers fire for everyone. And a check for surviving old policies
must be **scoped to the five manuscript tables**: `prefs`, `library_claims` and
the billing tables keep their `*_owner_*` policies on purpose, so a schema-wide
scan reports the design as a failure. All of it passed against the live project on
2026-08-07, injection probe included.

*Not built:* presence, the resolve-a-conflict control, and ownership transfer. The
conflict guard's *data* half is done (`rev`, a conditional update, and a conflict
set that stops `applyRemote` overwriting the text it preserved) but nothing yet
asks the writer which version to keep. See TODO.md, which also records the
account-deletion hazard: `books.owner` cascades, so deleting an owner deletes the
book out from under its collaborators.

**Payments are Paddle *or* PayHere, one at a time, and optional in the same way
everything else is.** Configure either gateway and the app grows plans; leave
both unset and there are no plans *and nothing is held back* — every paid
screen works, and the Upgrade button says why there is nothing to buy. That
falls out of the subscription route answering `pro: true` when there is no
gateway, which `ProGate` and `requirePro()` both read. `billingConfigured()` is
checked first everywhere, and `requirePro()` passes everyone when it is false,
so a self-hosted copy running on its owner's API keys behaves exactly as it did
before billing existed.

**`provider.ts` is the whole of which gateway sells, and there will not be a
third.** PayHere came first and is verified against its sandbox end to end;
Paddle arrived on 2026-08-09 because **PayHere cannot sell a subscription to an
unregistered business** — its free Lite tier is one-time payments only and pays
out no USD, and recurring starts at Plus, which wants LKR 3,990 a month and a
business registration. Paddle costs nothing until it is paid and is the
**merchant of record**, so worldwide sales tax is its problem rather than ours.
Three things follow, and they are the reason PayHere is kept whole beside it
rather than deleted:

- **Paddle wins when both are configured.** Two live gateways would mean two
  ways to be on Pro, two webhooks writing one `subscriptions` row and two
  answers to "cancel this".
- **The row records which provider sold it** (`asProvider`, and a row written
  before the Paddle migration reads as PayHere, which is what it is). So a
  switch leaves the writers already paying exactly where they are: their cancel
  button keeps calling PayHere, and only new checkouts go the new way. A writer
  told they are cancelled while their card goes on being charged is the one
  outcome here that costs somebody real money.
- **Merchant-of-record fees stop winning at scale.** PayHere's 2.99% beats
  Paddle's 5% plus the fixed fee at around **eighteen subscribers**, which is
  why `payhere.ts` is not to be tidied away — deleting it means building it
  again.

`src/lib/billing/` is the pure half — `plans.ts` (the price table, the cycle
arithmetic), `signature.ts` (PayHere's two MD5s), `paddle.ts` (`paddleStatus()`,
below), `provider.ts` (`activeProvider()`, `billingConfigured()`),
`subscription.ts` (`isPro()`, the status codes) — all tested. `payhere.ts` and
`paddle.ts` hold the credentials and are server-only by naming: none of it
carries a `NEXT_PUBLIC_` prefix **except Paddle's client token**, which is
designed to be public — Paddle.js authenticates with it in the browser and it
can do nothing but open a checkout. An accidental client import of the rest
reads empty strings, so `isPaddleConfigured()` answers false rather than leaking
a secret. `server.ts` is `requirePro()`, the
gate in front of `/api/chat`, `/api/narrate`, `/api/transcribe`,
`/api/comps/query`, `/api/comps/rank` and `/api/comps/categories` — 401 when
signed out, **402** when signed in and unpaid,
and the three are different messages because "sign in" shown to someone already
signed in is a loop.

**Two cycles, and both renew.** $10.99 monthly, $99 a year — 25% off, and the
annual total is exactly twelve times the per-month figure the card prints,
which is a rule with a test on it rather than a coincidence. **The annual was
$87 until 2026-08-09**, which was 34% off: roughly double what this trade does.
The convention is "two months free" (16.7%), the usual band is 15–20%, and 20–25%
is the aggressive end — so the old figure was not cheap for the market, it was
discounted past it by arithmetic rather than by a decision. $99 keeps a visible
saving, lands on Plottr Pro's annual, and divides by twelve into $8.25 exactly,
which the rule above requires. It was changed while there were no subscribers.
The LKR table is priced for its own market and is not the USD one converted. A lifetime tier was
built on 2026-08-03 and removed the same day — worth knowing only because the
removal is a decision rather than an omission: selling outright is what this
market mostly does, and it trades recurring revenue for a support obligation
with no end date. If it ever returns, the expensive parts in code are that
PayHere must be sent **no `recurrence` and no `duration`** or it bills the
one-off price every month, that there is no period end to store, and that
`isPro` has to answer without a date.

**What is free is what a book needs to exist and leave.** Unlimited books, all
four exports, sync, the pre-upload check and the roadmap, comps search, blurb,
categories, covers, structure, progress, **`money`** ("Before you spend", which
is the planning tool and not the tracking one) and one book's story bible — with
the per-book tools among them running on **five books**, unmetered inside each
(see `FREE_TOOL_BOOKS` below). Pro
is the metered routes plus the business layer — **`track`** (costs against
earnings) and the book-three curve, advance readers, **`provenance`** (the
writing record), the prose report, and the *series* read of the bible. Note the
two names that read backwards: the tool called `money` is free and the tool
called `track` is not, and the pricing row that covers the paid one is "Money
tracking & the curve". Four screens mount `GatedTool` — arc, prose,
provenance, track — and that list is the check. Every competitor charges for
formatting, which is why export is the one thing that must never move.

**One thing is limited on the free plan, and `src/lib/free-limits.ts` is the
whole of the policy.** The free plan runs the per-book tools on
**`FREE_TOOL_BOOKS` (5) books**, and inside those five nothing is metered at
all — searches, imports, cover research, title checks, as often as the work
takes. Pro lifts the number of books. Everything else stays unbounded as it
always was: books, words, all four exports, sync, the check, the roadmap, the
blurb and category screens. **A book you never open a tool on costs nothing** —
the shelf is not the limit, the tooling is.

**It replaced four meters of ten** (imports, comp searches, cover searches,
title checks), and the reason is what those charged for. Each counted an
*attempt*, and every one of those screens is a screen you use badly on purpose:
naming is iterative, so ten searches is perhaps three real candidates, and the
meter ran out in the middle of the one activity the tool exists for. The writer
who felt it first was the writer using it properly. Counting books charges for
*scale* instead, which is also the honest description of who should be paying —
and it is a limit a reader can hold in their head, which "ten of each of four
different things" never was. Figma's free tier is the same shape and nearly the
same sentence: three files, unlimited work inside them.

Five things in there are load-bearing.

- **`onThisBook` is the whole of "unlimited within a book".** `bookToolAllowance`
  takes it as a second argument and a book already on the list is never blocked,
  whatever is left — so the gate refuses the *sixth book* and never the sixth
  search. A test asserts it, and it is the one not to "fix": without it the
  limit is back to charging for effort.
- **Importing marks the book rather than counting the file.** Both funnels —
  `createBookFromImport` and `importIntoBook` — call `markToolUse`, because
  "make an empty book, then import into it" would otherwise be one click round
  it. `undoChapterImport` gives **nothing** back now: the book is still there
  and still being worked on, and releasing the slot would make five books mean
  five *at a time*.
- **The list lives in `prefs.toolBooks`**, not on a book — it is a fact about
  the account, prefs sync as one blob so a second machine does not hand out five
  more, and a field on the book would have needed a Postgres column to survive
  `sync.ts` at all. `markToolUse` is the only writer and is **idempotent**, so
  every tool can call it on every action without working out whether this press
  is the first. `parseToolBooks` narrows and de-duplicates on the way in, and
  **migrates nothing**: the old `prefs.usage` counts say nothing about *which*
  books the work happened on, so a library from that version starts with an
  empty list and five books in hand. Erring generous is the only defensible
  direction when the alternative is charging for work there is no evidence of.
- **The number is quoted, never restated.** `FREE_TOOL_BOOKS` is read by the
  pricing row, the terms, the Help dialog and every sentence on screen, the same
  rule the prices follow.
- **The landing page's hero check never refuses one.** A stranger with no
  account is the worst place in the app to meet a plan limit, and the argument
  of that page is that a manuscript can be checked before paying.

**The words are about books, and a test enforces it.** `leftLine` and
`spentLine` may not contain "search", "check" or "import": a reader told "2
checks left" would ration the one thing this plan does not ration. What runs out
is manuscripts, and every sentence says so.

`src/components/upgrade/free-limit.tsx` is the six screens' shared voice, for
the reason `ProGate` is one component — and it **escalates in three steps**,
which is the shape the rest of the trade uses and the part worth keeping:

- **Silence** while there is room. `WARN_WHEN_LEFT` is the rule: a limit nobody
  has approached is not news, and "0 of 10 used" on a first visit teaches a
  writer that this is a metered product before they have had a thing out of it.
  Nothing is hidden by it — the number is on the pricing page and in the Help
  dialog. A test walks the whole allowance and fails if the line speaks early.
  `WARN_WHEN_LEFT` is **2** rather than 3 now that the allowance is five: three
  of five would speak on a writer's third book, which is well inside ordinary
  use.
- **`LeftLine`** in the last three, stating **what is left** rather than what
  was spent, because the remainder is the number they would otherwise have to
  work out.
- **`LimitBanner` and `LimitDialog` on the press that is *refused*** — the
  first press on a **sixth book**, never a press on one of the five.
  `useLimitGate(bookId)` is the whole of that rule and every screen goes through
  it: work on a book already counted looks exactly as it always did, and only a
  press on a book the plan has no room for puts anything on screen. Telling
  somebody at the moment they are refused is information; telling them at the
  moment they stop needing it is an advertisement — and the research on this is
  unambiguous, prompts shown at the blocked action converting far better than
  ambient ones. **It follows that the controls stay live**: a disabled button
  cannot be pressed, so there would be no moment to answer. A refused press
  costs nothing. The gate has two doors because the marking happens in two
  places: `spend()` for the searches, which marks there, and `check()` for the
  imports, which the store marks at the funnel every import screen shares.
- The banner is **filled**: purple-into-indigo gradient, white type, one white
  button. It
  was a grey pill first (muted ink at footnote size, so the sentence explaining
  why the button beside it had gone dark *read* as a footnote), then an
  accent-tinted card (legible, but at the same volume as the panel it sat on,
  on a screen made of panels). `LimitNote` is the same fill stacked for the two
  ~300px editor rails, and `ImportLimitReached` is the panel the two import
  screens get instead, since there the missing thing is the whole screen.

  **That gradient is a documented exception to the palette's hue rule, and it
  is three tokens wide.** (The pricing table's badges are the palette's other
  hue exception, and they work the opposite way — see the styling section.) `--color-upgrade-from` / `-to` / `-ink`, stated
  **identically in both theme blocks** — unlike everything else in the file,
  because a saturated mid-tone fill carries white type on either ground and a
  value that need not change should not. It does *not* follow `--color-accent`,
  for the reason `lp-accent` does not: the accent is #ffffff at night, and this
  is a fill, so it would put a white slab across a black screen. The text on it
  is literal `text-white` rather than `accent-ink` for the same reason — ink
  that inverted on a ground that does not is the one way to get this wrong. The
  dialog's figure panel and its CTA take the same fill, so the two surfaces
  read as one thing; nothing else in the chrome may.

**`LimitDialog` fires once, on the press that spends the last one**, and never
from an effect — an effect watching `blocked` would also fire on arrival for
somebody who ran out yesterday, which is a paywall shown to a writer who
pressed nothing. The screens test `allowance.left === 1` at the moment they
count, which is true only of that press. Inside it: what was reached without
blaming anybody, four lines of what Pro lifts rather than a table, the price
read from `plans.ts` so nobody has to leave to find it, a real way out ("Not
now", Escape, the backdrop, the ×), and a closing line saying what is *not*
affected — the fear at that moment is that work has been taken away. Its figure
is a wall of book covers **drawn in markup**, twelve of them so the grid is
cropped by the panel rather than being a countable nine; spines were tried
twice and read as a bar chart.

These are browser gates and are honest about it: `/api/comps` stays free and
keyless, which is the thing that must not change to enforce this server-side.

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

**Only the webhook grants Pro.** `/api/billing/notify` (PayHere) and
`/api/billing/paddle/notify` are POSTs from the gateway's *servers*, with no
session and no cookies, and they are the only callers that write
`subscriptions` — which is why `authenticated` has no insert or update grant on
that table at all and both routes use the secret key
(`src/lib/supabase/admin.ts`). A return_url is not proof of anything: a writer
can type it, and an overlay closing proves only that it closed. `/upgrade/done`
therefore polls rather than assumes, and Paddle's button has **no success
handler**, because the browser's redirect and the gateway's notification race
and are not ordered.

**The notification is verified before it is believed.** The URL is public and
the body is entirely attacker-shaped; PayHere's `verifyNotification()` against
the merchant secret, and Paddle's `unmarshal` against the endpoint secret
(`pdl_ntfset_…`, which also refuses a replayed timestamp), are the only things
standing between that and a stranger writing "paid" into the table. A bad
signature is refused with 403 and never retried. Paddle's check reads the **raw
text, not the parsed body** — the signature covers the bytes Paddle sent, and
re-serialising a parsed object changes them.

**Idempotency is PayHere's problem and comes free at Paddle.** PayHere sends
"extend by one cycle", so a retry had to be refused by primary key — that key is
`payment_id` on `payment_events`, never the order, because a subscription
charges again on the *same* order id every cycle and a retry that re-ran would
extend the period twice. Paddle sends the **absolute period end**, so writing
the same event twice writes the same dates twice. Its transaction row still
keys on the transaction id, since a duplicate charge in the ledger would be a
lie about how much somebody paid. Anything a route cannot act on answers 200 and
logs; only a storage failure answers 500, because that one *should* come back.

**A cancel goes to the gateway first and our table second.** The other order
leaves a writer who has been told they are cancelled with a card still being
charged. `/api/billing/cancel` branches on the row's own provider: PayHere takes
a second credential pair (`PAYHERE_APP_ID` / `_APP_SECRET`) for the Subscription
Manager API, and without it the account dialog shows no Cancel button rather
than one that cannot work; Paddle is one authenticated call, because it *is* the
merchant of record, and it is sent `effectiveFrom: "next_billing_period"` —
`"immediately"` would end the period the writer bought, which is the one thing
cancelling here has never done. Cancelled is not gone: `isPro()` runs a
cancelled plan to its paid-up date with no grace, and an active or past_due one
three days past it, because a renewal that needs one retry is a normal Tuesday
and a gateway's queue is not instant.

**A cancelled Paddle subscription says `active` until the period ends**, and
announces the cancellation in `scheduled_change` instead. That is correct of
Paddle — the writer has paid to the 9th and is entitled to it — and it cost a
bug the first time round, which is the reason to *test* a gateway rather than
reason about one: our cancel wrote `cancelled`, Paddle's `subscription.updated`
landed a second later saying `active`, and the webhook faithfully undid it. The
account menu then offered Cancel for a subscription already cancelled and
promised a renewal that was never coming. So `paddleStatus()` reads the
scheduled change **first** and everything else is the plain status; it is pure
and tested for exactly that. `paused` maps to cancelled — the table has no
fourth word, and that is the safe direction, since `isPro()` then runs it to the
paid-up date and stops rather than serving Pro indefinitely for nothing.

**Two checkout shapes, and neither lets the browser say what it is buying.**
PayHere is a form POST out to a payment page after `/upgrade/checkout/[orderId]`
collects billing details. Paddle is an **overlay** opened over the pricing page
— but the transaction is created by `/api/billing/paddle/checkout` first, so the
price comes from `plans.ts` and the buyer's id from their own session. Handed a
bare price id and a `customData` object, Paddle's overlay would let the person
paying choose both the price and the name on the receipt; the route is what
stops that, the same reasoning `payment_orders` was built on. `periodFrom()`
in the webhook decides the cycle from **the price id we sent**, not the billing
interval Paddle reports, because `period` is a CHECK constraint of two values
and a quarterly price would otherwise abort the write for a payment already
taken. Paddle.js loads on the **first press, not on mount** — a pricing page is
read far more often than it is bought from, and a payment network's script on
every visit is a third party watching people who are only looking.

`use-plan.ts` is the client's view of all that, and it **fetches rather than
derives**: the plan lives in Postgres and changes when the gateway says so — a
webhook away, months later, with no page open — so there is nothing local to
read it from, and it is deliberately not part of `library-store.ts`. Nothing it
returns gates anything that costs money; the billed routes check server-side,
which is the only check a reader with devtools cannot edit. It exists to tell a
writer the truth about their own account.

**Four legal pages exist because a gateway reviews the site before it lets
anybody take a card**, and a missing privacy or refund policy is a standard
rejection. `/privacy`, `/terms`, `/refunds` and `/contact`, sharing
`components/legal/legal-shell.tsx`, linked from the landing footer, from each
other and from the checkout. Three things about them are load-bearing:

- **They are in `PUBLIC_EXACT` in `src/proxy.ts`.** A reviewer reads the site
  *signed out*, so a policy behind the sign-in wall does not exist as far as the
  review is concerned — nor as far as a customer hunting for the refund terms
  does.
- **`src/lib/legal.ts` states each fact once** — the operator's legal name, the
  trading name, the country whose law governs, the one contact address,
  `REFUND_DAYS`, `REPLY_DAYS`, `UPDATED` and the `LEGAL_PAGES` array the footer
  and every page's see-also strip read from. Same rule the prices and the free
  limits follow: an address right on three pages and stale on the fourth is the
  exact failure a reviewer looks for. `UPDATED` is written out by hand — a date
  from `new Date()` would say the policy changed today, every day.
- **The privacy page names every route that sends anything, feature by
  feature.** That makes adding such a route an obligation to add it there too.

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
an answer to a question the reader has not been asked yet. **Sharing a book is
on the page but after the tools, never in the hero**, for that same reason — a
co-writer feature is exactly the kind of thing a competitor can answer by
shipping one. Its figure is drawn in markup and its seat numbers come from
`SEATS_PER_BOOK`, so it can only go wrong if the product does, and an FAQ entry
answers the question the section invites: this is not Google Docs, and you will
not see each other type.

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
writer (six areas, `?area=`), decided on the server off `getClaims()` so
neither sees the other's screen first; with no Supabase configured everyone gets
the dashboard · `/signin` · `/signup` · `/forgot-password` ·
`/reset-password` · `/auth/confirm` (the far end of any emailed link) ·
`/upgrade` plans (public — a price is read before an account exists; Paddle's
overlay opens from here) ·
`/upgrade/checkout/[orderId]` billing details, then a form POST straight to
PayHere · `/upgrade/done` PayHere's return_url, which polls ·
`/privacy` · `/terms` · `/refunds` · `/contact` — public, and public is the
point ·
`/book/new` setup · `/book/import` · `/book/[bookId]` book
overview (lands here, not on a chapter) ·
`/book/[bookId]/chapter/[chapterId]` editor · `/book/[bookId]/read` reading view ·
`/invite/[token]` the far end of a share link — gated, so by the time anybody is
there they are signed in, which is what makes the link a pointer rather than a
credential.

The sixteen tools all hang off `/book/[bookId]/`: `export`, `roadmap`,
`paperback`, `listing` · `comps`, `blurb`, `categories`, `covers`, `title-check` ·
`structure`, `prose`, `progress`, `provenance` · `money`, `track`, `arc` —
grouped there the way `book-tools.ts` groups them.

**API routes:** `/api/chat` (assistant) · `/api/narrate` · `/api/transcribe` ·
`/api/comps` · `/api/comps/subjects` · `/api/comps/query` · `/api/comps/rank` ·
`/api/comps/categories` · `/api/billing/*`. All of those except
`/api/comps` and `/api/comps/subjects` are metered and gated by `requirePro()`;
those two are free, keyless and stay that way — which is the whole reason the
three model steps around the comps search (query, rank, categories) are routes
of their own rather than flags on it.

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

**`src/components/ui/` is the shared-primitive shelf, and it is deliberately
two files wide** — `menu.tsx` and `spinner.tsx`. Things land there on the third
copy, not the first: `Spinner` was extracted once a tool screen needed the ring
the checkout result already drew, because that is how one product ends up with
two loading states spinning at different weights. Both take `currentColor` and
inherit whatever they sit on; a fixed colour is invisible in exactly one theme.
The spinner also carries the standing Tailwind v4 warning in miniature — its
first draft used `border-current/25`, which v4 silently drops, so it would have
shipped as a plain circle. Check the built CSS, per the build note above.

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
- **The three parts of a book were a three-step ladder, and are not any more.**
  Front strongest, back palest, in binding order: it dressed every surface on
  the card — the button, the shrunk strip, the open row, the focus ring — which
  put three fills down a panel whose job is to list a book, so all of those took
  the app's own chrome (`CARD_BUTTON`, `CARD_OUTLINE`, `CARD_STRIP`,
  `ROW_ACTIVE` in `book-panel.tsx`: a hairline and the raised value, the same as
  the controls at the top of the panel). What was left of the ladder was the
  card's border and the two rules that run from it to the page — and **that last
  step has gone too, because the border was doing two jobs and failing at the
  one that mattered.** It said *which part this card is* and *whether you are
  in it*, and the palest step is a few percent off the ground it sits on, so the
  back card looked identical selected and unselected. A writer sees one card at
  a time and cannot compare three to work out which is "the dark one"; what they
  need from it is whether it is the part they are in. So there is **one edge**
  now — `CARD_EDGE` / `CARD_EDGE_ACTIVE`, `border-line` against `border-fg` —
  the two rules take the same value, and so does the sheet's own edge
  (`--paper-edge-on`, one token per paper, replacing the three per-part ones).
  The parts are told apart by their names, which was always going to be the
  thing that told them apart. `book-guide.tsx` explained the ladder in prose and
  was rewritten with it; so was its account of front matter, which still
  described the one-page design.
  **`ROW_ACTIVE` carries three signals, not one**, because the hairline that
  separates it from a hover is `line` against `raised` — a few percent apart in
  daylight. The title also takes medium weight and the number comes up out of
  muted into full ink.
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
  faded sticker. The other is the sixteen tool marks (`tool-marks.tsx`), which
  are product marks rather than chrome — sixteen grey marks are sixteen grey
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

- **The pricing table's value badges are the fourth, and they are a tint rather
  than a fill.** `--color-badge-{gold,blue,pro}-{bg,line,ink}` in
  `globals.css`: a tinted ground, a hairline of the same hue, ink of that hue.
  The **blue** set is the one that has since left that table: the shared-book
  badge (`components/collab/shared-badge.tsx`) takes it, because a book somebody
  else owns needs a label that is a *state* rather than a warning, and inventing
  a second blue three shades off this one is how a palette starts lying. Gold
  and pro have not moved, and gold especially must not — see below. They were saturated gradient pills with halos and a
  shine, and the lesson in the change is general — twenty-odd filled lozenges
  down two columns all shout at one volume, so the hue meant to *separate* them
  had nothing quiet to separate them from, and the gold that meant "no ceiling"
  was one glint among two dozen. A value in a table is a label; a fill is what
  you spend on the thing being sold.

  Which pattern the exception follows changed with it, and that is the part to
  get right. `--color-upgrade-*` is stated identically in both theme blocks
  because a saturated fill carries its own ink on any ground. A **tint is a
  ground**, so these belong to their theme and follow the status family
  (`ok`/`note`/`stop`) instead: pale ground with dark ink by day, near-black
  ground with light ink at night — a pale blue slab on #000 is a hole in the
  page. The ink is what had to pass, and it picked the values: #1d4ed8 clears
  6.4:1 on its own tint where blue-500 would be 3.4:1, which is the same
  constraint that ruled blue-500 out when this was a fill, arriving at the same
  answer from the other direction.

  The meanings are unchanged. Gold is *unbounded* and is spent on the word
  "Unlimited" and nothing else — the moment a second kind of thing wears it, it
  stops meaning "this has no ceiling" and becomes decoration. Blue is every
  other value on Starter, purple is Pro's (and is the purple that card already
  wears), because the *card* is the context: a reader comparing columns can tell
  which side they are on without reading a heading. None of the three follows
  `--color-accent`, for the reason the upgrade fill does not. And the radius is
  `rounded-lg` rather than a capsule — a full pill is a *control* in this app,
  and a value you cannot press should not borrow the shape of one.

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
