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
account fallbacks and the `?next=` redirect guard, ambience, relative time,
the landing road's curve and scroll arithmetic (`landing-path.ts`) —
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
form does at `3xl`. **The deck runs that same full width on every tool**, and
the obligation that comes with it is on the words: it was capped at `2xl` with
a `deckWidth` prop to escape the cap, five of the sixteen screens had already
taken the escape, and at that point the default was the exception and walking
between two tools moved where the sentence under the heading stopped. So the
prop is gone and a deck is held to a sentence or two — a cap forgives a long
deck by wrapping it and the full width does not. Anything longer belongs on the
page below, where the tool's own prose caps itself at `max-w-prose`; widening
the container still never widens a line of body text. The export screen is the
one that never took this header; TODO.md records the decision as open.

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
a **banner** (`VerdictBanner` + `VerdictActions`), full width, directly under
the field, carrying *Try another* and *Keep it*. It is *never* on a timer: it
is the answer rather than a save confirmation, it takes longer to read than any
timeout, and the shelves it describes stay on the page, so dismissing it loses
the summary and none of the evidence. (This passage described a top-right toast
called `TitleToast` until 2026-08-15; there has never been a component by that
name in `src`, so anyone looking for one was hunting something that does not
exist.)

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

**A fourth route feeds the category box as it is typed into** — and **nothing
calls it at the moment**, because that box came off the categories screen on
2026-08-11 to be rebuilt. The picker it feeds is kept whole and callerless in
`categories/subject-combobox.tsx`, the same standing `templates-dialog.tsx`
has; the route is what it will reach for. Do not tidy either away, and see
TODO.md under "Taken out on purpose" for what went and what is owed.
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

**Ranking is the second of three routes that send prose** — the assistant, this,
and the blurb workshop — and the opening of the manuscript goes, because
whether a book *sounds* like another is what a keyword search cannot answer.
Capped at a couple of pages by `openingFrom()`, cut at a paragraph
(a severed clause is a false signal about how the writer ends sentences),
images dropped, sent only on a press — and the card lists exactly what leaves
*before* the button, the same shape the feedback dialog uses. Add a field to
what is sent and add it to that list, and to `/privacy`.

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
Three things about it are deliberate. **The assistant now goes through it too,
as of 2026-08-15, and `streamModel` is the second half of the file.** It did
not: `/api/chat` streams, caches the chapter across turns and reasons about
prose, so it stayed on the Anthropic SDK and this note said `ai.ts` was for
short, bounded, one-shot calls — while naming, correctly, where streaming
belonged if it were ever wanted for both providers. It was: a deployment with
only a Google key had every other model route working and a dead assistant
telling it to go and fetch an Anthropic key. `askModel` is untouched; the two
paths share only the provider choice, which is the point — an installation has
one answer to "is there a model" rather than two. Three things inside it are
load-bearing:

- **`splitSse` is pure and tested because a network chunk is not a message.**
  One `read()` can carry half an event, and a splitter that parsed whatever it
  was handed would drop that half silently — the JSON fails, the piece is
  skipped, and a long reply loses about a token in ten in a way that reads as
  the model writing badly. CRLF gets the same treatment for a louder reason: a
  stray `\r` makes every payload a parse error, so the reply arrives empty.
- **The first chunk is pulled before the response is returned.** That is what
  keeps a rejected key a 401 instead of a 200 with an apology in the prose. Once
  the first byte is out the status is spent, so a failure after that can only be
  a note in the stream — the two paths are the two halves of one failure, told
  apart by whether the writer has seen anything yet.
- **There are two model tiers now** (`DEFAULTS.task` / `.chat`, and
  `OPENCHAPTER_CHAT_MODEL` beside `OPENCHAPTER_MODEL`). Not tidiness: the route
  named `claude-opus-4-8` itself and `ai.ts` defaulted to `claude-sonnet-5`, so
  folding one into the other would have quietly downgraded the assistant.
  Google is the same id in both tiers on purpose — a wrong model name fails as a
  404 behind a screen that says the assistant is unavailable, so it stays on the
  id the six working routes already prove.

**Nor is the gateway used**, though narration and transcription go
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
risk on us. `keywords.ts`, `keywords/suggest.ts` and `shelves.ts` each have a
test asserting their shape carries no such number, and all three are tests not
to "fix". What is offered instead is `keywordReport()`: the seven backend
keyword boxes counted — over the 50-character limit, words the title already
owns so the shop indexes them anyway, the same word spent twice, and phrases
shops publish a rule against.

**A sixth route writes candidates for those boxes**, and the reason it is
allowed is that the ground moved. `/api/comps/keywords` (POST, `requirePro()`,
a model via `ai.ts`) over the pure `src/lib/keywords/suggest.ts` suggests
phrases for the seven fields. Amazon's search stopped being literal — since
2024 it carries a semantic layer that reads a listing the way a person would,
so *coverage of the right ideas* is what earns a book its place and keyword
stuffing is explicitly less effective than it was. That is a judgement, which
is the only thing a model is worth paying for here. It also means the figure
the competitors sell is becoming less decisive while the thing that matters can
be produced honestly, so the refusal above stops being a limitation.

Four things hold it, and the first is the interesting one:

- **The checker is the filter.** Every candidate is run through
  `keywordReport()` as though it were already in a box, and anything raising an
  issue is dropped — too long, a word the title already owns, a phrase the
  shops publish a rule against, a word already spent in an earlier suggestion.
  A prompt is a request; this is a guarantee, and it is what stops the two
  halves of the screen disagreeing about what a good keyword is.
- **Dropped, never truncated or repaired.** A phrase cut at fifty characters is
  a different phrase and one with its offending word removed is a phrase nobody
  wrote. Losing a suggestion costs a writer nothing; showing them a mangled one
  costs the trust the screen runs on.
- **Empty slots only, and Undo.** Words a writer typed are never overwritten,
  and suggestions land in the *draft* so nothing reaches the book until Save.
- **The manuscript does not go** — the blurb, genre, categories and the
  listing's own names, all of it typed into form fields. That keeps this off
  the short list of routes that send prose. Add a field and it needs a line on
  the privacy page in the same commit. KDP requires no AI disclosure for
  metadata, so the screen carries no warning; what it does carry is *check each
  one is true of your book*, because a shop requires the keywords, title and
  description to describe the same book — a suggested trope the book lacks is a
  rule broken rather than bad advice.

**A seventh route is the conversation about those same boxes**, and it is a
sibling of the press rather than a replacement for it.
`/api/comps/keywords/chat` (POST, `requirePro()`, a model via `ai.ts`) over the
pure `src/lib/keywords/workshop.ts` answers "which seven, and why" where the
press answers "give me seven from the blurb"; the two sit under one parent so
the whole feature is found in one place, and they **share `keepUsable`**, so
neither can offer a phrase the other's checker would flag. It is the blurb
workshop's four rules pointed at a different form field — candidates are
**tagged** (`<keywords>`, so a turn that answers a question has no button under
it), the **checker is still the filter**, nothing reaches the book without a
press (empty slots only, into the draft), and **no prose leaves**: the
conversation, blurb, genre, categories, listing names and the seven boxes as
they stand, all form fields. Two things are its own. The **rules are given, not
recalled** — the system prompt states the shop's own numbers and prohibitions,
including that seven boxes of fifty characters is Amazon's shape and not a
standard, so an answer about Kobo or IngramSpark does not quietly assume KDP.
And the refusal of a search volume is repeated *to the model* as a hard rule,
because a plausible number beside a real keyword would be the most believable
invented thing in the app.

**`src/lib/keywords/guide.ts` is the same knowledge with no model behind it,
and that is the point.** A self-hosted copy has no key, a free account runs out
of conversations, a gateway has a bad afternoon — and in every one of those the
writer still has seven empty boxes and a book to publish. So the whole of what
the chat knows is also written down, free, offline and readable signed out
(`keyword-guide.tsx`, dynamically imported by the categories screen). Every
fact in it was checked against the shop's own help pages rather than the
folklore, `SOURCES` records which, and a test asserts it offers no invented
number — a guide is exactly where one would be most believable, because it
reads as documentation rather than as a guess.

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
the break arithmetic is the pure, tested `pageBreaks()`, which lives in
**`page-breaks.ts`** and is shared with the reading view — see the reader note
below for what being private to this file used to cost. Two things hold it
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

**Two screens ask it now, and `src/lib/matter-picks.ts` is what keeps them
saying the same thing.** `/book/new` grew the same question as two steps of its
own on 2026-08-15 (`new-book-form.tsx`: details → front → back), so the dialog
is for a book that arrived some other way — an import, or one made before the
wizard existed. The three things the two must agree about live in that module
rather than in either of them: what is ticked to begin with (`SUGGESTED` — a
dedication at the front, two pages at the back, and *not* everything that looks
standard, which is how a setup screen turns back into the Start button it
replaced), how a tick is keyed (`matterKey`, `"part:title"`, because both parts
could hold a Glossary and a set of bare titles would tick both), and the order
the pages come out in (`picksFrom`). Two copies of `SUGGESTED` would be two
answers to "what does a first novel usually have", which is the drift `usual`
in `matter.ts` exists to avoid.

**Where the generated pages and the written ones meet.** Three of the front
sections — title, copyright, contents — can now come from either side, and a
book carrying both got two title pages on consecutive sheets. `writtenPages()`
in `front-matter.ts` matches by title and the *written* page wins: ours is the
fallback, assembled from fields so that a book which said nothing still opens
properly, and there is nothing left for it to add once somebody has set their
own words there. Renaming the page hands the job back to us, which is the safe
direction to be wrong in — matching is on the exact title (`GENERATED_BY_TITLE`:
"title page", "copyright page", "table of contents"), front matter only, and a
page still full of `[placeholders]` has already been filtered out by
`loadChapters` so it does not count as written.

**The writer can overrule that default, and `withoutReplaced` is the whole of
it.** The switch on the export's front-matter step means *generate this* while
there is no page of their own and **replace mine with yours** once there is — a
different question, so it is stored in a different place
(`typeset.replaceWritten`) and reads **off** to begin with, since theirs is what
the file uses. Three things hold it. **Only the surprising direction asks**:
turning it *on* opens `ReplacePageDialog`, because "Contents" on a switch does
not obviously mean *leave my contents page out*, and the thing at the other end
is the writer's own words; turning it back off restores their page with no
dialog, which is a state nobody is stuck in. **The dialog's job is to say
nothing is deleted** — that is the only question anybody has at that moment —
and its primary button is the verb ("Use ours in this file"), not "OK". And the
override is **one filter over the chapter list, applied before anything reads
the book**: drop their page and `writtenPages` no longer sees it, so
`frontSections` generates ours without being told to, and the EPUB spine, the
PDF flow, the Word file and the review all agree because all four are built from
that one list. Threading a second flag through each renderer is how they end up
disagreeing about which pages are in the book.

**A card has three things to say, not two, and the third was missing.** A page
of one of these kinds that is still all `[placeholders]` never reaches
`loadChapters`, so `writtenPages` cannot see it and ours is generated — correct,
and silent: the card read "© this year, in the author's name" while a copyright
page the writer had started sat in their book, and the only mention of it was
one title among five in the note at the foot of the step. A writer looking at
three cards concluded the app could not see their pages at all. So a card now
reads *yours is winning* (ribbon "You have your own"), *yours is unfinished*
(ribbon "Yours is blank", hint "Yours is still the example text, so ours goes
in") or *you have no page of this kind*. The third state is derived from
`skipped` — the note's own list — so the card and the note cannot disagree. The
switch keeps its plain meaning on an unfinished page and asks nothing: there is
nothing of the writer's to prefer, so there is no surprising direction.

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

**`bindBook` in `front-matter.ts` binds the generated pages among the writer's
own, and every renderer reads it.** They used to be emitted first and the
chapters after — right while front matter was a single page nobody made, and
wrong the moment a book could carry its own half-title: the file opened on a
generated title page, then the contents, and *then* the half-title that should
have led the book. Each generated section takes its slot in
`MATTER_SECTIONS.front` and merges in by rank.

**It lived in `epub.ts` as `spineOrder` until 2026-08-16, and being private to
one renderer was the bug.** The other three answered the same question for
themselves and all three answered it the old way, so one manuscript came out as
three different books — the EPUB correct, the PDF and the Word file opening on
a generated title page, and the wizard's own EPUB *preview* agreeing with the
wrong two. `spineOrder` survives as a thin wrapper that turns the bound order
into manifest ids. Note that the *files* are named positionally
(`chapter-03.xhtml` is the fourth loaded chapter), so neither the spine order
nor the contents filter may renumber them — `BoundPage.index` carries the
original index for exactly this reason, and every filtered list carries it too.

**The chapter opener prints one thing, not two, and `chapterNumeral` in
`blocks.ts` is the whole of that rule.** `chapterXhtml` emitted a standing
numeral *and* the heading, and this app's own default titles **are** the number
— so most exported books said "1" over "Chapter 1" on the opening line of every
chapter. It asks `isGenericChapterTitle`, the store's own answer, which knows
the digit and the spelled form; `front-matter.ts` used to carry a private
near-duplicate that missed the spelled one.

**The rule sits beside `printsHeading` because it drifted the same way that one
did.** Fixing it in `epub.ts` alone left the PDF printing a numeral over every
chapter, the Word file printing none at all ever, and the export wizard's
specimen sheet drawing a standing "1" over whatever title it was handed. Four
renderers and two previews now call the one function. Two consequences worth
knowing: the Word file gained numerals it never had, and it honours
`hideChapterNumbers` in the paragraph loop rather than in a stylesheet, since a
`.docx` carries none of ours; and the wizard's Chapter-numbers switch says so
when a book's titles are *all* generic, because on that book it has nothing to
take away and a control that quietly does nothing is the dead UI this app
refuses.

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
whole book on real page sheets at the book's trim size. **`book-pages.tsx` is
the setting and `book-reader.tsx` is the window around it** — the split exists
because the export wizard's Preview step shows the same thing, and the setting
is the part that is easy to get subtly wrong: the `.manuscript` class and
`data-paper` that re-point the page palette, the `--ms-*` variables carrying the
book's own face and leading, and the trim the sheets are cut to. Two copies of
that would be two books, which is the one thing a preview may not be. The caller
supplies the frame and it must have a height — the flip-book centres itself in
`h-full`, which collapses in a box sized by its content. Prose is not re-laid out:
each chapter is walked through the export path (`toBlocks` → `blocksToXhtml`) and
styled with the book's typography, so the read-through, the print PDF and the
EPUB match. Pagination *is* ours — the browser has none on screen — so
`paginate()` in `src/lib/reader/page-flow.ts` measures the rendered blocks in a
hidden column at the page's true content width (outside any `zoom` wrapper,
which would distort the numbers) and cuts them into sheets, re-running once the
manuscript font loads. **That same `paginate()` backs the editor's Book View
preview** (`page-preview.tsx`) and the flip-book (`reader-flipbook.tsx`), so all
three break pages identically; keep them on the one function.
`reader-pages.tsx` re-exports it, since that is where the other two already look
for it.

**It breaks the pages with the editor's own `pageBreaks`, and until 2026-08-17
it did not.** This view packed whole *blocks*: a paragraph that did not fit went
to the next sheet entire, and a paragraph longer than a page went on anyway and
ran off the bottom — where `.reader-page`'s `overflow: hidden` clipped it. So a
dozen lines of somebody's novel were simply **absent** from the read-through,
the flip-book and the Book View preview, with a half-empty sheet after them,
while the editor — measuring the same manuscript in lines — broke it correctly.
One book, two answers, and the wrong one was the one that claims to show the
finished thing. Hence `page-breaks.ts`: the arithmetic is pure and `pos` is an
opaque handle the caller chooses, a document position in the editor and a block
index here, so neither side needs to know about the other.

Cutting rather than pushing is the reader's half, and three things hold it:

- **A cut lands on a word, found by binary search on the character tops.** A
  soft wrap happens at a space, so cutting anywhere else re-wraps both halves
  into lines that are not the ones that were measured. One rectangle read per
  probe, since counting the rows of every prefix would be O(text) per probe on
  a paragraph of a thousand characters.
- **The two halves are made with a Range and `cloneContents`**, so an emphasis
  spanning the seam comes out as an `<em>` on both sheets rather than an
  unclosed tag on one. The tail is marked `data-cont`, which is what stops it
  taking a first-line indent — it is the rest of a sentence, not a new
  paragraph, and on the page it *is* the first child of its sheet's prose.
- **The chapter opener is laid out in the measuring column, not measured on its
  own and subtracted.** Measured apart, the title's bottom margin collapses out
  of the box being measured, so it went uncounted and every chapter's first
  sheet over-filled by about two lines — 52px of the 715 a 6×9 page has. The
  column is `display: flow-root` for the matching reason: `.reader-page` is
  `overflow: hidden`, so a first child's top margin stays inside the sheet, and
  a column that let it collapse out would disagree by that margin.
- **The second measuring pass waits on the pictures as well as the font**
  (`picturesSettled`, `needsSecondPass`, called by all three screens). A
  picture with no intrinsic size yet measures nothing, and a *wrapped* one
  contributes no height at all — so the prose beside it never shortens its
  lines and the page fills past its own foot. Measured on a real book: three
  chapter openings 70px over, three lines clipped. A `data:` URL is no
  exception; it decodes asynchronously like any other. What made it look
  intermittent is that it only bites on a **first** measure — leave the screen
  and come back and the pictures are decoded, so the second pass is right and
  the one the writer saw was the wrong one. `document.fonts.ready` was already
  waited on for glyph metrics; this is the other half of the same rule, and
  anything else that changes an element's size after layout belongs beside it.

**A wrapped picture carries no margin of its own, and that is a page count
rather than a nicety.** A bare `p > img` takes `1.5em auto`; unfloated those
margins collapse with the paragraph's and cost nothing, but a float is a block
formatting context, so inside one they stop collapsing and the picture's box
grows by 3em. The editor's node view zeroes them and so does `typesetCss`, so
the reading view was the only one of the three adding the space — the prose
beside a picture wrapped one line further down and a chapter came out a whole
sheet longer than the editor said it was.

One difference is left and is correct: the editor's surface is `pre-wrap`, so a
run of typed spaces holds its width there and collapses here. The reading view
agrees with the exported file, which is what it is for.

**Import, export and the reading view share a format-neutral block IR**
(`Block`/`Run` in `src/lib/export/blocks.ts`). A Tiptap doc is walked once into
blocks, then each renderer consumes them — the tricky parts (marks, nesting, hard
breaks) live in one tested place. Heavy libraries (`docx`, `jszip`) are
dynamically imported so a writer who never exports never downloads them.
- Export: `src/lib/export/` — markdown, docx, epub, and PDF rendered by a real
  browser on the server (`/api/export/pdf`, driven from `print.ts`). `index.ts`
  orchestrates; `xhtml.ts` is the shared XHTML renderer behind epub, PDF and the
  reader; `typeset.ts` controls the look of the outputs that are ours;
  `front-matter.ts` generates the title/copyright/contents pages and holds
  `bindBook`, the binding order all four read.

  **An export with nothing in it is refused rather than produced.**
  `runExport` throws `ExportRefused` — its own class, so the wizard prints its
  message word for word where anything else gets the general apology. Two
  filters stand in front of that list (untouched matter pages, and pages the
  writer asked us to replace), so a book reaches nothing without doing anything
  strange: press Start on front matter, delete the seeded chapter, export. The
  EPUB used to answer with an empty spine and an empty nav document — two hard
  EPUBCheck errors — and the Markdown with the title and nothing else. Both
  downloaded, and the wizard said it had worked.

  **The PDF is rendered on the server, and it is the one route the manuscript
  travels on.** `/api/export/pdf` loads the book into headless Chrome, injects
  Paged.js and returns the bytes; `printBook` posts to it and falls back to the
  old hidden-iframe print dialog on any failure at all, so an installation with
  no browser configured exports exactly as it did before. `CHROME_PATH` names
  the binary, `@sparticuz/chromium` supplies one on a deployment, and neither
  set means 501 and the fallback.

  **It moved because two defects could not be fixed on the writer's machine,
  and a third went with them.** Paged.js resolves a contents folio by asking
  `window.getComputedStyle(page)` which page a chapter landed on — the *top*
  window — while the pages sat in the export's hidden iframe. One document
  cannot answer for another's elements, so it counted from zero: **every folio
  in a printed contents page read `0`**, and the same wrong measurements made
  its chunker give up mid-list, so a 45-chapter contents printed five entries
  and a 9-chapter one printed two. Both are gone in a document of its own —
  verified on a real export, all nine entries with the pages they land on. It
  also ends the print dialog, which was never an export: nothing about it was
  knowable, which is why `runExport` used to answer `null` for PDF. It answers
  with a file now, and `ExportDoneDialog` names it like the other three. The
  fallback path still answers `null`, because there it still is not knowable.

  **The claims moved with it, in the same commit.** `/privacy` names the route
  and says it carries the whole book; the landing page's proof tile counted
  "None of your book is uploaded anywhere" and now counts the three formats
  that are still built in the browser; the export screen says what leaves
  before the button, the rule the prose-sending routes already follow. The
  polyfill is read off disk — the package's `exports` map has no path entries,
  so `pagedjs/dist/…` is not a resolvable specifier — via a path
  `next.config.ts` resolves at build time and names in
  `outputFileTracingIncludes`, since nothing imports it and a tracer packs only
  what it can see.

  **A chapter opening page carries no running head.** The head is `string-set`
  from the h1, so on the page that h1 appears it printed the chapter title
  directly above itself. Every section takes a named page (`page: chapter`) so
  Paged.js marks the page that *starts* one, and `@page chapter:first` drops
  the head there — the folio stays, as a drop folio does in a printed book.
  Verified both ways: no head on an opener, head present on a continuation.

  **The wizard's PDF review shows the finished file, not a second pagination
  of it.** It re-ran Paged.js in the app's own document, and that re-run was
  wrong in one specific way: a long *generated* contents list came out
  truncated — measured on a 45-chapter book, five entries against the file's
  forty-five, and a page count one short because the contents never overflowed
  onto its second sheet. Everything else agreed. The cause is in Paged.js's
  chunker reacting to this document; `display: flex` on the leader,
  `target-counter`, the anchors, the list markup, `list-item` display, the
  contents' own CSS, break-avoid, page size, the title page's flex layout,
  Tailwind's `box-sizing` reset and the stylesheet scoping were each removed
  and re-measured, and none of them is it. So the pane stopped guessing and
  started fetching `/api/export/pdf` — the same call the export makes, the same
  bytes — and Chrome draws it. That is what the module's own note always
  claimed for the other three panes, and it removes the second code path that
  could drift. The cost is a server render per visit to the step, which is
  stated plainly in the component. Its caption no longer prints a page count:
  the viewer's toolbar carries the file's own, and the count this pane used to
  print was the wrong one.

  **The page decides the type size — `bookSetting` is that decision.** Every
  template used to carry one fixed size while margins were a flat 14% of the
  page width, so the *measure* was whatever fell out. Measured against the app's
  own stack (Georgia averages 0.447em a character in prose), 12pt gave 48
  characters a line on a 5×8 and 84 on A4, against a target of 66 and a
  tolerable band of 45–75 — one trim in six was right. A real book does the
  opposite of scaling everything together: a smaller page takes *smaller* type
  and *smaller* margins. So `TRIM_SETTING` is a table of typographic judgements
  rather than a formula, each row landing its page near 66; `measureIn` is the
  check, and a test walks every trim and fails outside the band. Too narrow is
  not merely ugly — shorter lines mean more pages, and a paperback is priced by
  the page. `trimMargins` is gone into this, so the sheet on screen and the file
  cannot hold different numbers.

  **Two carve-outs.** `manuscript` ignores the table entirely and always returns
  12pt / double-spaced / 1″ margins: standard manuscript format is a
  specification an agent asks for, not a design, and resizing it would break the
  one thing that template exists to do. And the default trim is **6×9**, not A4
  — A4 was chosen so the browser's *print dialog* would not centre a small page
  on a big sheet, and there is no print dialog any more.

  **All of that is the *PDF's* arithmetic, and the EPUB takes none of it.**
  `typesetCss` emitted `font-size: 11pt` on an EPUB's body and every derived
  size in points too, which is the one unit a reflowable book may not use: an
  e-reader has no page, the **reader** picks the size on a control in its own
  menu, and an absolute size in the stylesheet takes that control away. Both
  shops say so outright — Apple's asset guide ("font sizes should be defined in
  `em` or `%`, not by point or pixel units… the main text of a book should
  either not have a defined `font-size` or should have a `font-size` of `1em`")
  and KDP's reflowable text guidelines ("the body text… must be all defaults…
  any styling on body text in the HTML will override the user's preferred
  default reading settings"). So `size()` inside `typesetCss` answers points
  for print and `em` for everything else, the root is `100%`, and the two sizes
  *inside* `@page` stay in points because a running head and a folio are print
  furniture with no reader to obey. Nothing about the design moved: these were
  written as multiples of the body size already, so a heading is 1.6 times the
  prose either way — what changed is who decides how big the prose is. It also
  ends a second oddity, that the **trim** was reaching the EPUB at all: the same
  book shipped 10pt at 5×8 and 11pt at A4, a difference meaningless to a device
  with no trim. A test walks every template × trim and fails on any `pt` or `px`
  in an EPUB stylesheet, with a companion asserting the print one still has
  them — one of those without the other could be satisfied by breaking the PDF.
  Verified after the change: EPUBCheck 5.3 on a full and a bare book, 0 errors
  and 0 warnings each.

  **`text-align: justify` stays, and the reason is worth not re-litigating.**
  It looked like the cause of some very gappy word spacing; it was not — the
  cause was hyphenation silently not running (see the EPUB-preview note below).
  Justification is Kindle's default anyway, so declaring it changes nothing
  there, and Apple Books "offers user preferences for justification that can
  override author-specified alignment in flowing books", so a reader who wants
  ragged-right gets it. `hyphens: auto` is the correct partner and is already
  beside it.

  **The route is told the page size; it may not infer it.** `page.pdf()` ran on
  `preferCSSPageSize`, which reads the `@page` rule off the document — and
  Paged.js rewrites that rule. Once chapters took a named page (`@page
  chapter:first`, which keeps the running head off a chapter opening) Chrome
  stopped recognising a size and fell back to its own default, so a book set at
  6×9 came out on A4: `/MediaBox 0 0 594.96 841.92` from a stylesheet that
  plainly said `size: 6in 9in`. It fails silently, and towards a page size that
  looks deliberate. The client sends the trim; `pageSize` in the route is the
  only thing that decides.

  **`typesetCss` states its own list and code styling rather than inheriting
  the user agent's.** It used to leave `ul`, `ol`, `li` and `pre` alone, which
  is a bet on the reading environment, and it lost twice: Tailwind's preflight
  resets `ol, ul { list-style: none }` and the wizard's PDF review renders
  inside the app to be measured, so a bulleted chapter previewed as bare
  sentences while the PDF — laid out in a clean frame — printed bullets; and an
  e-reader supplies its own default sheet with no obligation to draw markers at
  all. The measurements match the writing surface's (`.manuscript .tiptap` in
  globals.css) so a list is the same shape in the editor, the read-through and
  the file. The contents page keeps its own `list-style: none`, which is more
  specific and still wins.

  **`typesetCss` takes a `scope`, and that is what keeps the wizard's PDF
  review from setting the app like a book.** Paged.js writes the stylesheet it
  is given into the document the script is running in — it has to, since that
  is where it measures — and the review renders into the app's own document.
  Unscoped, the wizard's headings came out centred in Georgia small-caps with a
  first-line indent on every paragraph of the interface. Both real exports pass
  no scope and their bytes are unchanged, which has a test on it.

  **Two rules stay global even when scoped, and that is the load-bearing
  half.** Paged.js *reads* `string-set` on `h1` and the `page-break` rules on
  `section` and matches them against its own source document, which the host
  element does not contain — scoped, the running heads silently stop appearing
  and the book opens on a blank sheet. Neither has any effect on screen, so
  global costs the app nothing. That is why `string-set` is split out of the
  `h1` block. Everything named by one of our own classes is left alone: it
  cannot match anything outside a page this app generated, and two of those
  rules carry paged-media properties as well.

  **An iframe was the first answer and is the wrong one**, measured: moving the
  pages out of the document leaves every rect at zero and Paged.js throws
  `Cannot read properties of null (reading 'getBoundingClientRect')` out of its
  own `Layout` constructor before the second page. `printBook` gets away with a
  frame because it is not measuring for the screen; `paginate` now *moves*
  rather than copies the stylesheets into that frame, so a finished PDF export
  no longer leaves the book's typography in the app for the sixty seconds it
  waits on the print dialog.

  **The wizard that drives it is `export-page.tsx`, and four things in it are
  load-bearing.** *The action bar stands still* — Back and the primary sit at
  the foot of the window on every step including the last, where the primary
  *is* the export; Continue used to sit at the end of the form, which put the
  only way forward below the fold on the two steps that carry a page of
  typesetting. *A switch looks like a switch* — these were `role="switch"` on
  cards whose only state was a tinted border, the same tint the format cards
  use for *chosen*, so the front-matter step was three identical white boxes
  for three settings that were all on. *The sheet is measured in the page's own
  width*: `Sheet` sets everything on it in `cqw` against a container query, so
  at its natural width (72px to the inch) one point is one pixel and the type
  is the size the template really sets, and a narrow window scales the whole
  setting rather than reflowing a page that is not the page. Its margins come
  from **`trimMargins`**, which `typesetCss` also asks — a preview computing
  its own would drift from the file. And *the fifth format is gone but not
  deleted*: see the audio note above and TODO.md.

  **Preview is a step again, and it holds the reading view.** As of
  **2026-08-17**, at the owner's request: the four panes have problems to be
  fixed later rather than shipped around, so the way in came off and
  `preview-sheet.tsx` and `review-pane.tsx` stand whole and callerless, like
  `templates-dialog.tsx`. **Do not tidy either away**, and read TODO.md under
  "Taken out on purpose" before putting them back — it records what that means
  and the two checks nothing else performs now. What stands in their place is
  `BookPages` (see the reading-view note above), mounted in the step, one
  station before Export. Three things about the new shape:

  - **It is a step rather than a link out, and the reason is state.**
    Everything the wizard knows — `output`, `typeset`, `manuscript`, `stepId` —
    is component state persisted nowhere, so for part of that same day Preview
    was a `<Link>` to `/book/<id>/read` and leaving threw the format, the
    template, the trim and the front-matter switches away and landed the writer
    back on step one. A step keeps them inside the flow. Do not make it a link
    again without persisting the wizard first.
  - **It exists for every format and names none.** The panes depended on the
    pick; the book does not. And the deck says *your book on its pages* rather
    than anything about the file, because "Preview EPUB" over a page of the
    manuscript would be a claim the code cannot back — what a reading view
    cannot show is exactly what the packagers do.
  - **It pays back the cost the layer version recorded** — "nobody is walked
    past the book any more". The last moment a mistake is cheap wants to be
    passed through rather than found. Still not a gate: Continue is live and
    nothing here has to be looked at.

  **The rest of this passage describes the panes as they stand, unreachable.**
  `components/export/review-pane.tsx` holds the four and `preview-sheet.tsx` is
  the frame; a Preview button beside Back opened it. That it builds the true thing
  rather than a likeness is the whole design: a preview assembled from its own
  code path agrees on the day it is written and quietly stops agreeing
  afterwards, which is the one failure a "check before you export" cannot have,
  because a writer who has checked stops looking. So PDF is the finished file
  out of `/api/export/pdf` — the same call the export makes — Word is the real
  `.docx` built and read back through `docx-preview`, EPUB is the built
  `.epub` **opened as a zip**, and Markdown is the text that will be written. **The EPUB pane carries no page count**: an e-reader picks
  its own page, so a number there would be a fact about this screen dressed as
  a fact about the file; the PDF's count is real because a PDF has real pages,
  and it comes from the viewer's own toolbar rather than from us.

  **It was the fourth of five steps until 2026-08-17, and the shape was the
  problem rather than the contents.** A review is *one thing* — the finished
  file — and a step in a flow carries the flow around it: a stepper band, a
  heading, a deck, a reading measure and the action bar all competed with a
  page of a novel for the same laptop screen, leaving the page about half of
  it. The heading and the deck came off first and bought back a fifth; the rest
  could not be bought, because the rest is the wizard. `KeywordGuide` is the
  shape the sheet copies — `z-40` so the app's dialogs at 50 still open over it
  (a pane can raise one), Escape — with three departures, all because this
  covers the window rather than sitting beside a page: `inset-0` with no width
  cap, **no backdrop** (one under a full-bleed panel is a dismiss target with
  no pressable pixel, which is the dead UI the house rules forbid, and a scrim
  over a page nobody can see says nothing about the page), and `oc-step-in`
  rather than `oc-panel-in`, since a layer over everything is not arriving from
  a side.
  Two things the change costs, and they are the step's own reasons: **nobody is
  walked past the book any more**, which is why the button is on every step
  including the last, beside the one that exports; and the stepper loses a
  station. What it wins beyond the room is that the PDF pane's server render is
  spent when somebody asks to see the book rather than on the way through.
  Mounting it only while open is what keeps that true. (That reasoning about
  the button's *place* survives the panes coming off — it is still on every
  step, and still not a gate.)

  Three things in it are load-bearing, and the first is the one that bites:

  - **The pages are parked off-screen, never hidden.** `display: none` is not a
    slower layout here, it is a failed one — Paged.js decides every break with
    `getBoundingClientRect`, and inside a hidden box every rect is zero, so it
    lays two pages and then throws `Cannot read properties of null` out of its
    own `Layout` constructor. Exactly why `printBook`'s iframe is 1200×900 at
    `left:-10000px` rather than 0×0.
  - **Each run renders into a box of its own inside the host.** React runs the
    effect twice in development, so two Previewers can be in flight at once;
    sharing one container means the second wipes the first's tree mid-layout
    and neither finishes.
  - **`useFitToStage` scales the pages to the column, and neither measurement
    is taken through the zoom.** A page box is its real printed size and the
    column is narrower, so at true size the writer gets a horizontal scrollbar
    and a screenful of one page's margin. `zoom` rather than a transform, since
    a transform leaves the original height behind and the stage would scroll
    through a book's worth of empty space. The subtlety is that `zoom` scales
    the coordinate system *inside* the element it is on, so a page's rect and
    the box holding it both come back in scaled units and their ratio no longer
    says what fraction of the room the page needs — measure through it and
    every pass shrinks the page again. Hence two elements: the *room* is an
    outer one that is never scaled, and the page's true width is recorded by
    the pane at the one moment it is known, after the pages exist and before
    anything scales them. A `ResizeObserver`, so the scale survives the window
    moving.

  **The review also says when a generated page has stood down for one of the
  writer's own** (`YoursInstead`, over `writtenPages`, and only for the two
  formats that generate front matter at all — `docx` and `markdown` build
  none). The front-matter step already says this beside the *switch*; this says
  it beside the *result*, which is where the question actually gets asked. A
  writer who wrote their own contents page is looking at page numbers they
  typed by hand, wrong the moment a chapter grew, where ours would have carried
  the folios `target-counter` works out — and without the note that reads as
  the feature failing rather than as their own page winning. It is a note
  rather than a warning: nothing is wrong, and a writer who wrote their own
  meant it.

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

**The wizard's EPUB preview opens the finished file rather than rendering the
book again**, and `src/lib/export/epub-preview.ts` is the pure half — the
container, the spine and a document's body, read out of the zip. It rendered
the XHTML `buildEpub` *would* write, under the stylesheet it *would* write, in
the order `bindBook` gives: all correct, and all of it the same arithmetic run
a second time, so three things the packager does were invisible to it.
`extractImages` was never exercised, the manifest and spine that decide what a
reading system opens were never read, and `container.xml` was never followed —
which is why the cover page, a document that exists only in the package, never
appeared in the preview at all. A preview cannot check the half of the build it
skips, and those are the parts a shop's ingestion breaks on. It costs a build
per visit — arithmetic in the browser, no network — and it buys a **check**:
every document goes through `DOMParser`, so a file that is not well-formed XML
says so here rather than at the shop, which is `stripInvalidXml`'s guarantee
tested from the outside for the first time. Two details are load-bearing.
`spineHrefs` reads the manifest and the spine *together*, so an `itemref`
naming an id the manifest lacks comes back as a gap rather than as a plausible
list. And a picture becomes a blob URL made once per zip entry and revoked in
the effect's cleanup — the packager's own de-duplication showing through, and
a leak of a book's artwork per settings change if it were not.

**`documentLang` exists because the frame was slandering the file, and it is
the first thing the rebuilt pane caught.** The stylesheet sets
`text-align: justify` and `hyphens: auto` together, and a browser will not
hyphenate text whose language it does not know — so the preview, which takes
each document's *body* and leaves its `<html lang="en">` behind, set the book
justified and **unhyphenated** and grew rivers of white the real file does not
have. Measured in Chrome, one paragraph in a 180px column: 108px tall with no
language against 90px with `lang="en"`, five lines instead of six. The
attribute is carried across by hand now, and **omitted rather than guessed at**
when a document declares none, since hyphenating a Finnish novel by English
rules is worse than not hyphenating it. Anyone tempted to drop it as decoration
should re-run that measurement; the test says how.

`epub-images.ts` lifts inline images out of their `data:` URLs into real
`OEBPS/images/` entries, de-duplicated across the book. Note what this is *not*
for: a `data:` src passes EPUBCheck fine (checked, not assumed). It is for size —
base64 is a third larger than the bytes and compresses badly inside XHTML, and a
repeated ornament is one file instead of one copy per use.

**A picture the package cannot carry is left out of the file, and `packageable`
is the one place that decides.** Three pictures fail and only the first used to
be noticed: a data URL that will not decode, a data URL of a media type EPUB
has no core support for (`RSC-032`, a foreign resource with no fallback), and a
`src` on the open internet (`RSC-006`) — measured, three hard EPUBCheck errors
out of one chapter. None is fixable by declaring anything; EPUB 3.3 permits a
remote audio, video or font and never a remote `<img>`. So the choice is a
valid book short of a picture or an invalid book nobody can sell. It is dropped
**and named**: `undecodableImages` counts exactly these, `storeReadiness`
reports them before the upload, and the wizard's EPUB preview drops them
through the same predicate so it is not showing a picture the file will not
have. A remote `src` is not hypothetical — the importers take whatever an HTML
or EPUB file refers to.

**Nothing reaches an XHTML document that XML cannot carry.** `stripInvalidXml`
in `xhtml.ts` takes out the characters outside XML 1.0's `Char` production —
the control characters that have no escape, and lone surrogates — and
`escapeXml` strips before it escapes, so every string in the EPUB, the print
document and the reading view goes through it; `toBlocks` applies it too, since
the Word file and the Markdown never meet `escapeXml` and a `.docx` is XML in a
zip as well. One form feed anywhere in a manuscript used to make every file in
the EPUB a *fatal* parse error (`RSC-016`), refused whole by every shop. The
editor never types one; a plain-text book marks its page breaks with them, so
the manuscript imported cleanly, read correctly and was rejected at the shop.

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
itself**: the check told a writer their cover had to be 1000px tall and 625
wide and ideally 1600×2560, `image-import.ts` stored it at 700px as WebP, and the
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
(genre word-count targets — it asked novel/novella/short story too until
2026-08-15, and the note at the top of the file says why the picker went),
`book-templates.ts`
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

**The assistant** is `src/app/api/chat/route.ts`, streaming through
`streamModel` in `ai.ts` — so it runs on **either** `ANTHROPIC_API_KEY` or
`GOOGLE_GENERATIVE_AI_API_KEY`, whichever is set, with Anthropic winning when
both are. Without either the route returns 501 with a message naming both, the
same shape every other model route uses. Chapter text is sent only when the
writer opens the panel and asks, and rides in the system prompt as `context` —
its own cached block on Anthropic, joined to the instruction on Gemini, which
caches a repeated prefix implicitly and has nothing to declare. The Help and
support dialogs name both keys; they said only Anthropic for a while after this
changed, which is the documentation-goes-stale rule catching the app itself.

**Audio is three separate things, and they are not interchangeable.** All three
degrade the way the assistant does — no key, 501 with a message saying so — and
the two paid ones need `AI_GATEWAY_API_KEY` (not the Anthropic one) and check
auth themselves, because the proxy skips `/api` and a minute of speech is
somebody else's invoice.
- **Text → audio** (`/api/narrate` + `src/lib/export/narrate.ts`,
  `export/audiobook.ts`) — **and it has no way in as of 2026-08-14.** The
  export page's Audiobook card came off at the owner's request, to be switched
  back on later; all of this is whole, still tested, and callerless, the
  standing `templates-dialog.tsx` and `ambience.ts` have. Do not tidy it away,
  and read TODO.md under "Taken out on purpose" before putting it back — four
  pages had claims about it reworded and the privacy page lost its Narration
  entry, which has to return in the same commit. What it does: one MP3 per
  chapter in a zip, the route doing *one chunk per request* and stateless, with
  the loop driven from the client so a 40-chapter book is 40 visible steps
  rather than one request that fails having produced nothing. The tested part
  is `speechChunks()` — cut at the largest boundary that fits (paragraph, then
  sentence, then word, never mid-word), because a break mid-clause is audible.
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

**Nothing is pushed while nobody is signed in**, checked once in `flush()`
rather than per job, and the queue is dropped rather than held — signing in
ends in a redirect, so an in-memory queue never survives to see it, and
`syncWithServer()` uploads whatever the browser holds on the next load anyway.
The reason it needs stating: a book keeps the `ownerId` of the session that
made it, so after a sign-out that field is still there and still looks like an
answer. `book.ownerId ?? currentOwner()` handed it over, and the resulting push
was well-formed, attributed to a real person and sent with no credentials — so
only Postgres could tell it was wrong, with **42501 and a hint recommending
`GRANT ... ON public.books TO anon`**. Do not take that advice: it would let any
stranger write to any writer's shelf. The decision is now the pure, tested
`pushOwner(book, me)`, whose whole content is that the *session* decides
whether to push and the book only decides who to attribute it to.

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
belong there, not only in the dashboard. **Five of the six are applied to the
live project, and `20260801000000_feedback.sql` is not** — verified in the
browser on 2026-08-15, when pressing Send in the feedback dialog came back
`404 PGRST205, "Could not find the table 'public.feedback' in the schema
cache"`. That is the whole of the feedback feature failing silently for every
writer, and it went unnoticed because the dialog's own "the migration has not
been applied" branch tested for `42P01`, which PostgREST never returns for a
table it cannot find at all. The branch is fixed; the migration still has to be
applied by hand. Read the rest of this paragraph as a description of the other
five — the first four as of 2026-08-07 and `20260808000000_paddle.sql` on
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

**An invitation is emailed *and* a link is offered, and nothing may claim a
send that did not happen.** For most of this feature's life no mail existed:
the owner copied a link and the invitation also appeared in the invitee's own
Collaborators area. That second half never worked for the person it was aimed
at — somebody without an account has no dashboard to find it in — so the owner
was the delivery mechanism. Mail arrived on **2026-08-14** (`src/lib/email/`),
and the honesty rule survived the change intact rather than being dropped with
it.

Five things hold it:

- **The mail is best-effort; the row is the feature.** `inviteMember` sends
  *after* the `invite_book_member` RPC and nothing the send does can change its
  outcome. A provider having a bad minute must not turn a successful invitation
  into a reported failure — the co-writer would be on the book, the seat spent,
  and the owner told it had not worked.
- **`emailed` comes back from the server**, and `InviteSentDialog` says "sent"
  only when it is true. All three failures — no key, refused, unreachable —
  read the same to the writer, because the only useful next step is the same
  one. It is `note`'s amber rather than `stop`'s red: nothing failed that costs
  anybody access.
- **The link is offered either way.** Every product this is measured against
  does both, because the two fail in different places: mail is filtered and
  delayed, a link needs a channel to travel down.
- **`send.ts` never throws and `invite.ts` never sends.** The composing half is
  pure and tested — 17 tests, including that every interpolation is escaped,
  since the book title, the owner's `user_metadata` display name and the
  owner's note are all free text arriving in a stranger's inbox under our own
  DKIM signature.
- **We send from our verified domain, never as the owner.** Their name rides in
  the display name (`Ada Vance (via OpenChapter)`) and their address in
  `Reply-To`; a `From:` of somebody's gmail fails DKIM and DMARC and is how a
  sending domain gets flagged for spoofing. `RESEND_API_KEY` and `RESEND_FROM`
  are optional like every other key here — unset, the feature degrades exactly
  to what it was before mail existed.

Resend is the provider because Vercel's marketplace lists exactly one messaging
integration; it is reached over its REST API rather than its SDK, for the reason
`ai.ts` writes Gemini out by hand.

Emailing the link is only safe because the link is a *pointer, not a credential*
— `/invite/[token]` sits behind the sign-in wall, and `acceptInvite` refuses
anyone whose **confirmed** address is not the invited one, checked with
`auth.admin.getUserById` because Supabase puts `email` in the access token
whether or not it has been confirmed. Were it a bearer token this feature could
not exist in an inbox at all. Invitations expire after `INVITE_DAYS` (14),
derived from the stamp rather than stored — nothing sweeps the table — and
cancelling is silent.

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

**A collaborator may take themselves off a book**, and until the invite links
started auto-accepting they could not: only the owner could remove anybody, so a
stray link was a book on your shelf permanently and a message to the owner to
get it off again. `leaveBook` in `src/app/collab/actions.ts` is the invitee's
side of `removeMember`, and the two are kept apart rather than sharing one
function precisely because they authorise differently: **`leaveBook` takes a
book id and never a member id**, finding the row by the caller's own user id, so
there is no argument anybody can pass that reaches somebody else's membership.
`removeMember` may take a member id because it checks book ownership first; this
one has no such check to make, so it must not accept the id at all. The row is
revoked rather than deleted, like a removal — the seat comes back either way,
and a deleted row would lose the record that this address was ever on the book,
which the invitation's unique index needs to let them be invited again cleanly.
The client follows with `deleteBook`, which is safe on a shared book because it
refuses to push a deletion for a book somebody else owns: without it the shelf
would keep the book until the next sync marked it "No longer shared", which is
the wording for *being removed* and reads as a fault rather than as the thing
just done.

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
`/api/comps/query`, `/api/comps/rank`, `/api/comps/categories`,
`/api/comps/keywords`, `/api/comps/keywords/chat`, `/api/blurb/critique` and
`/api/blurb/workshop` — 401 when
signed out, **402** when signed in and unpaid,
and the three are different messages because "sign in" shown to someone already
signed in is a loop.

**Two cycles, and both renew.** $9.99 monthly, $89.99 a year — 25% off, and the
annual total is exactly twelve times the per-month figure the card prints,
which is a rule with a test on it rather than a coincidence. **The USD pair has
moved twice and the discount is what set the annual each time.** It was $10.99 /
$87 — 34% off, roughly double what this trade does. The convention is "two
months free" (16.7%), the usual band is 15–20%, and 20–25% is the aggressive
end, so $87 was not cheap for the market, it was discounted past it by
arithmetic rather than by a decision. On 2026-08-09 it became $10.99 / $99, 25%
off and divisible by twelve into $8.25. On **2026-08-10 monthly became $9.99 and
the annual followed it to $89.99** rather than standing still: holding $99
against the lower monthly would have cut the saving to 17% by leaving a number
alone, where $89.99 keeps the 25% that was decided on and matches the monthly's
charm-priced shape. Both changes were made while there were no subscribers;
after that a price change is an announcement rather than an edit, and Paddle
leaves an existing subscription on the price it was bought at regardless.
**$89.99 does not divide by twelve**, so `perMonth` on that row is written as
`89.99 / 12` rather than typed: the stored pair stays exact and the rounding
happens once, in `displayPrice`, which shows $7.50. That per-month figure is an
approximation and is only honest with the real total printed beneath it — a card
showing the rate alone would be a claim the table cannot back. **A price change is three edits, not one:** this table, two *new*
prices in Paddle's catalog (never an edit of the live ones), and the resulting
`PADDLE_PRICE_MONTHLY` / `PADDLE_PRICE_ANNUAL` ids in the environment — and
Paddle checks that the site's prices match the live catalog, so the two must
not sit out of step across a review.
The LKR table is priced for its own market and is not the USD one converted. A lifetime tier was
built on 2026-08-03 and removed the same day — worth knowing only because the
removal is a decision rather than an omission: selling outright is what this
market mostly does, and it trades recurring revenue for a support obligation
with no end date. If it ever returns, the expensive parts in code are that
PayHere must be sent **no `recurrence` and no `duration`** or it bills the
one-off price every month, that there is no period end to store, and that
`isPro` has to answer without a date.

**What is free is what a book needs to exist and leave.** Unlimited books,
words, chapters and **imports**, all four exports, sync, the pre-upload check and
the roadmap, structure, progress, categories and typing in its keyword boxes
yourself — having those boxes *suggested* is the one part of that screen with a
number on it, five for the life of the account — the writing
record, and the story bible **across a whole series**. Pro is the metered routes
plus two things a writer only wants once there are real sales: reading a shop's
sales export into the ledger, and the book-three curve. Note the two names that
read backwards: the tool called `money` is free and unmetered ("Before you
spend", the planning tool) while the tool called `track` is limited to two books.
**One screen still mounts `GatedTool` — `track` — and one section mounts
`ProGate`: the sales-report import inside it.** That list is the check. Every
competitor charges for formatting, which is why export is the one thing that must
never move.

**Writing a blurb is free; having one *read* is not.** `/api/blurb/critique` is
the newest metered route and the one that most needed the refusal spelled out,
because this is where a paid generator would obviously sell — see
`src/lib/blurb-critique.ts` for the whole argument. Three things about it. **It
reports and never writes**, like everything else here: the parsed shape has no
field for a rewritten sentence, a "note" long enough to be replacement copy is
dropped server-side, and a test asserts both. **The stores are not the reason**
— Amazon's AI disclosure covers the manuscript, a description is *metadata* and
needs no declaration at all, so a generator would be permitted and is refused on
product grounds: generated blurbs are generic exactly where a blurb cannot
afford to be, and generating one honestly would mean sending the whole book,
which yields a synopsis with the ending in it. And **no prose leaves** — what
goes is the description, the title and the genre, all typed into form fields, so
this route is not on the short list of places the manuscript can travel.

**Its sibling writes, and the shape is what makes that allowed.**
`/api/blurb/workshop` over the pure `src/lib/blurb-workshop.ts` is a
*conversation*: it asks who the book is about, what they want, what is in the
way and what failure costs, and assembles a draft **from the writer's own
answers**. The specifics are theirs; the model does the shaping. That is a
different thing from the generator refused above, and the two failures that
refusal names are avoided by construction rather than by prompting — the
prompt forbids stating any fact the writer did not give it, and only the
*opening* is sent, so there is no ending to leak onto the back cover. The
public promise is untouched either way: the landing page refuses covers and
*prose*, and a blurb is metadata.

Five things hold it, and the first is the interesting one:

- **The draft is tagged, not guessed at.** An earlier shape asked for prose and
  tried to work out which paragraph was the blurb; every heuristic for that is
  wrong somewhere, because a long answer to "why does that opening not work"
  looks exactly like a draft. `<blurb>` is a signal the model either sends or
  does not, so a turn that is a question simply has no button — and a draft
  over `BLURB_MAX` is **refused rather than truncated**, since a paragraph cut
  mid-sentence would be offered as though somebody had written it.
- **It sends prose, which is the third such route**, so it carries the
  obligations: `/privacy` names it, and the panel lists what leaves *above the
  input, before the press*. The opening is capped **shorter than `rank.ts`'s**
  — everything past the opening is where the ending lives — and cut again
  server-side, because a browser is not where that promise is kept.
- **Nothing reaches the book without a press.** A draft lands in the *draft*,
  so the save bar appears and the writer commits it; the box is never
  overwritten silently.
- **Nothing is persisted**, exactly as the assistant's chat is not — a
  conversation about a draft is scaffolding.
- **It is not streamed, and that is now a choice rather than a constraint.**
  The reasoning was that this has to run on whichever provider is configured
  while the assistant could afford to be Anthropic-only, and that an SSE reader
  for Gemini was the complication `ai.ts` was scoped to avoid. Both halves have
  since gone: the assistant cannot afford it either, and `streamModel` is that
  SSE reader, written and tested. So switching this to stream is now swapping
  `askModel` for `streamModel` and reading the pieces — worth doing if a draft
  arriving all at once ever feels slow, and deliberately not done on spec.

Send a chapter from the *critique* route and it needs a line on the privacy
page and a sentence above the button, as the prose report and the workshop
have.

**Everything else is metered in the unit its own work comes in, and
`src/lib/free-limits.ts` is the whole of the policy.** There is no single global
number, and there was: a version of this gave the free plan "every tool,
unlimited, on five books". A *container* limit cannot hold a container whose
contents are arbitrary — the comps box and the title-check box take any words a
writer types, so one book slot was a general-purpose research desk for any number
of manuscripts. Four shapes replaced it:

| Shape | Tools | Free |
|---|---|---|
| **Per day** | comps, covers, title check | 2 / 3 / 2 a day |
| **Per book** | blurb, prose report, track | 5 / 6 / 2 books |
| **By occupancy** | ARC readers, seats | 10 a book / 2 a book |
| **In total, for good** | keyword suggestions, blurb chat, keyword chat | 5 / 3 / 3 ever |

**The fourth shape follows the cost, not the work, and it is the only one that
never comes back.** The three daily limits guard things that are free to us —
two keyless catalogues and arithmetic in a browser — so a writer who resets the
counter costs nothing and gets more of something that was free anyway. Keyword
suggestions ask a model on every press. Counted per day, one free account could
spend seven hundred model calls a year; counted five in total, it costs at most
five, ever. Five is what it takes to do one book properly (two or three runs
before the seven boxes look right), which covers the listing somebody came here
for and does not cover a backlist.

**The members of that shape carry different numbers, and the ratio is the
bill.** A keyword press is one short model call; a conversation — about a blurb
or about the seven boxes — is five to fifteen, so one of those costs roughly
fifty times one of these, hence three rather than five. The two chats are
counted **separately** (`blurbChat` and `keywordChat`, three each) rather than
out of one pot, because they belong to different screens and a writer who used
their allowance on the blurb should not find the keyword box already shut. **A
conversation is the unit, not a message**: counting messages would stop a
writer mid-brainstorm, and the blurb interview asks four questions before it
offers anything. It is spent on the *first message* of a chat, so opening the
panel and reading it costs nothing, and a reload with nothing said costs
nothing either. `WORDS` says "conversations" for both for that reason — "3
chats left" beside a chat box would otherwise be read as three messages, which
is a different and much smaller promise.

**Its sentences may not borrow the daily vocabulary**, and a test enforces that:
no "today", no "tomorrow", no "a day", because all three would be untrue of a
wall that stays shut. `leftLine` says "2 free suggestions left."; `spentLine`
says the plan includes five and they are used, and stops — the dialog beside it
is where Pro is offered, and a spent line that also sold something would be
doing two jobs at the moment of refusal.

**It is also the first counter here in front of a route that bills**, which is
worth stating plainly: clearing storage really does hand somebody another five,
and the damage is five short prompts, which is not worth a table in Postgres to
prevent. What is *not* left to the browser is the wall — `/api/comps/keywords`
carries `requirePro()` like every other model route, so the sixth press is
refused by the server whatever the client believes. And **`useLimitGate` does
not record for this shape**: the screen calls `spendTotalUse` when a reply
actually lands, because a gateway 502 must not cost one of five.

Which shape a tool takes follows from what it does. The three that send a query
to a catalogue are counted **per day**, which is what every serious research tool
does (Semrush's free plan is ten queries a day) and for the same reason: a search
box takes arbitrary input, so the honest unit is the query. **They come back
tomorrow**, and that half is what makes them humane — a writer stopped
mid-session returns rather than churning, and nobody is permanently walled out of
a book they own. The ones that read one manuscript are counted in **books**,
which charges for scale rather than effort. Occupancy counts what is *currently*
there, so removing an advance reader gives the place back.

Six things in there are load-bearing.

- **`onThisBook` is the whole of "unlimited within a book".** `bookAllowance`
  takes it as a second argument, and a book already counted is never blocked
  whatever is left — so the wall lands on the *next* book and never in the middle
  of the one being written. A test asserts it, and it is the one not to "fix".
- **The daily reset lives in `dailyAllowance`, not in the parser.** A stored
  record carrying yesterday's date reads as nought without anybody having to
  clear it. In `parsePrefs` it would have been wrong twice: `getPrefs` caches on
  the raw string, so a value derived from the clock there goes stale the moment
  midnight passes with nothing to invalidate it, and a reset that only happened
  on a read would depend on somebody having opened the app.
- **Every limit is spent on a press, never on arrival** — the standing rule that
  a search the app ran is never counted. Two screens had no press and were given
  one rather than an exception: the prose report gained a **Run the report**
  button, and `track` marks its book on the first figure recorded. Marking on
  arrival would have made these limits on *visiting*, and would have had to open
  `LimitDialog` from an effect, which that component forbids for the reason an
  effect fires again on every remount.
- **The counters live in `prefs`** — `usedToday` (a day plus per-tool counts) and
  `usedOn` (a set of books per tool) — not on a book, because they are facts
  about the account and prefs sync as one blob so a second machine does not hand
  out a second allowance. `spendDailyUse` and `markToolBook` are the only
  writers; the latter is **idempotent**, so any screen may call it on any action
  without working out whether this press is the first.
- **Nothing migrates, and that is deliberate.** The old `toolBooks` said only
  "some tool ran here" — it cannot be split into blurb-versus-prose after the
  fact, and there was no daily history at all. Every writer starts clean. Erring
  generous is the only defensible direction when the alternative is charging for
  work there is no evidence of.
- **`warnAt(limit)` caps `WARN_WHEN_LEFT` at `limit - 1`.** Three of these limits
  are 2 or 3, and at a flat two a writer who had used *nothing* would be told
  they had two left — a meter in front of somebody who has not started, which is
  the exact failure the constant exists to prevent. A test walks every limit.

**The words match the shape, and tests enforce it.** A daily sentence must say
"today" and its spent line must promise **tomorrow** — these are the only limits
here that come back, and a line stopping at "today's are used" reads as the end
of the road on a screen the writer could simply revisit. A book sentence must
**name its tool**, or blurb (5) and the prose report (6) both say "1 more book"
and mean different things. And the lines that do *not* come back may not say
"today" or "tomorrow" at all.

**These are browser gates and cannot be otherwise**, which the file header says
outright: the daily ones are resettable by anybody willing to move their
machine's clock. That is accepted rather than papered over, because the routes
that actually cost money are gated by `requirePro()` on the server and none of
this touches them.

`src/components/upgrade/free-limit.tsx` is every limited screen's shared voice,
for the reason `ProGate` is one component — and it **escalates in three steps**,
which is the shape the rest of the trade uses and the part worth keeping:

- **Silence** while there is room. `WARN_WHEN_LEFT` is the rule: a limit nobody
  has approached is not news, and "0 of 5 used" on a first visit teaches a
  writer that this is a metered product before they have had a thing out of it.
  Nothing is hidden by it — the numbers are on the pricing page and in the Help
  dialog. `WARN_WHEN_LEFT` is **2**, capped by `warnAt` at `limit - 1` so the
  three small limits cannot announce themselves to somebody who has used
  nothing; a test walks every limit and fails if a line speaks early.
- **`LeftPill`** in the last two, stating **what is left** rather than what was
  spent, because the remainder is the number they would otherwise have to work
  out.
- **`LimitBanner` and `LimitDialog` on the press that is *refused*** — never on
  the last one that worked. `useLimitGate(ask)` is the whole of that rule and
  every screen goes through it, `ask` being a **discriminated union** so the
  compiler refuses a book limit with no book: the version before this took a
  bare `bookId` and four screens were quietly passing the literal `"imports"`.
  Work inside a limit looks exactly as it always did, and only a press the plan
  has no room for puts anything on screen. Telling somebody at the moment they
  are refused is information; telling them at the moment they stop needing it is
  an advertisement — and the research is unambiguous, prompts shown at the
  blocked action converting far better than ambient ones. **It follows that the
  controls stay live**: a disabled button cannot be pressed, so there would be no
  moment to answer. A refused press costs nothing, and on ARC it does not even
  clear the typed fields.
- The banner is **filled**: purple-into-indigo gradient, white type, one white
  button. It
  was a grey pill first (muted ink at footnote size, so the sentence explaining
  why the button beside it had gone dark *read* as a footnote), then an
  accent-tinted card (legible, but at the same volume as the panel it sat on,
  on a screen made of panels). `LimitNote` is the same fill stacked for the two
  ~300px editor rails — which is what the blurb uses when the roadmap's panel
  mounts it, since the wide banner does not fit a narrow column.

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
The metered routes are `requirePro()` on the server, which is the only check a
reader with devtools cannot edit. Everything else is computed in the browser: the
per-tool allowances through `useLimitGate`, and the two remaining all-or-nothing
Pro pieces through `ProGate` / `useEntitled` (`src/components/upgrade/pro-gate.tsx`)
— one component so the gated screens cannot drift into six tones of upsell, and it
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

**There is a second marketing page, and it exists to buy back what the tool
cloud gave up.** `/tools` (`tools-page.tsx` over the pure `tool-guide.ts`) is
every tool explained one at a time, grouped the way `book-tools.ts` groups them.
The cloud that replaced the four cards of pills says *how many* tools there are
and nothing about what any of them does — its own note calls that a real loss —
so the names, the grouping and the explanations live here, one page along, with
a button under the cloud as the way in. Four things hold it:

- **`book-tools.ts` still declares a tool; this only describes one.** The path,
  name, mark and one-liner stay there and are read by the two screens *inside*
  the app; `tool-guide.ts` holds the headline, the claim and the three folded
  points a *visitor* needs. **A test walks `ALL_TOOLS` and fails if either side
  lacks the other**, so a seventeenth tool cannot ship as a heading over an
  empty column — the same shape as the `DESTINATIONS` check behind the
  dashboard's findings.
- **The row is `feature-row.tsx`, shared rather than copied.** It came out of
  `feature-shots.tsx` when this page needed the same layout sixteen more times.
  Every measurement in it is an argument (the uneven columns, the alternation,
  the `<details>` disclosures that keep both sections free of JavaScript), and
  two copies is how two sections meant to look identical end up a step apart.
- **The screenshots are not in yet and the space is reserved, not collapsed.**
  `ToolShot` draws the tool's mark on a stage at `aspect-[2/1]` — the
  proportion the existing captures take — so filling `guide.shot` in later
  moves nothing on the page. The stand-in claims nothing about the screen it
  stands for, because a mocked-up interface is the one thing this site refuses.
- **No plan claims in `tool-guide.ts`, and a test enforces that too.** What is
  metered is `free-limits.ts`'s answer and it moves; a sentence here repeating
  it goes quietly wrong on the page a reader uses to decide. The line *"None is
  behind the paid plan"* came off the cloud in the same commit for that reason.

`LandingHeader` and `LandingFooter` both take a `home` flag because of this
page: three footer columns and the nav's anchors are in-page links, which scroll
nowhere off `/`, so away from home they are rooted to `/#order`. It is a prop
rather than `usePathname()` so neither has to become a client component.

**The bar's Tools entry is a menu, and it is the only nav item that earns the
machinery.** `tools-menu.tsx`: four columns from `TOOL_GROUPS`, a small grey
label over a column of names, each name linking to **that tool's own row** —
`/tools#comps`, matched by an `id` on every `FeatureRow` there. The section it
used to point at is a cloud of marks around a count, which is right as a section
and useless as a destination since it names none of the sixteen. Five things
hold it:

- **Hover opens it; hover is not the only thing that does.** A menu that exists
  only under a pointer does not exist on a touchscreen, under a keyboard, or by
  voice — and this one holds the only links to two thirds of the product. The
  trigger is a real `<button>` with `aria-expanded`: pointer, press, and focus
  all open it, Escape closes it and returns focus to the trigger.
- **`CLOSE_MS` is a grace period on the way out**, because the panel hangs below
  the bar with a gap, and a menu that closes the instant the pointer leaves the
  word closes while the pointer is crossing to the thing it was aimed at. A
  delay rather than an invisible bridging element, which would swallow clicks on
  whatever is under it.
- **The bar must not slide away while it is open.** The header hides on a
  downward scroll and is this panel's ancestor, so it would take the open menu
  off the top of the screen mid-read. The menu reports upward through
  `onOpenChange` and `hidden && !menuOpen` is where that is spent — the scroll
  listener goes on recording direction either way, so the bar is correct the
  moment the menu closes rather than needing another scroll to catch up.
- **The panel stays mounted and hides with `invisible`.** An unmounted panel
  cannot animate out, and — the one that bites — the `onBlur` that closes it
  needs the element focus is leaving to still exist when the event fires.
- **Every nav entry points at something that exists**, and that rule has already
  cost one: "What it does" pointed at `#does`, whose section came off the page on
  2026-08-14. The header's copy went in the same commit and **the footer's did
  not**, so it offered a scroll to nowhere until 2026-08-15. Both are `#inside`
  now. Anchored sections carry `scroll-mt-20` and linked rows `scroll-mt-28`, or
  the jump lands with the heading under the bar.

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

**It is always light, and it is the only screen that is.** It followed
`data-theme` for a while, on the argument that a reader on a dark machine has
not expressed a view about our marketing — they have told their whole screen
how bright to be, and the one page ignoring them was the first one they ever
saw. That holds for *the app*, a room somebody works in for hours, and is the
wrong trade for a shop front: this page is one composition whose grounds,
marker and closing banner were drawn and measured against white, and the dark
set was a second design of it nobody could hold in their head at once.

**The mechanism is one attribute, and it is why the light block's selector is
`[data-theme="light"]` rather than `:root[data-theme="light"]`.** These tokens
are inherited variable re-points, so the page's root `<div>` carries the
attribute and everything under it resolves to daylight whatever `<html>` says —
covering the `lp-*` set *and* the app tokens the page borrows in one place,
which a per-token override could not. `color-scheme` rides along, so that div's
scrollbar comes out light too. Nothing else may write that attribute below the
root: it is the app's own theme everywhere else.

**The dark `lp-*` values are still live** — the four legal pages share this
palette through `legal-shell.tsx`, are opened by writers from inside the app,
and do follow the theme. So every `lp-*` token goes on being stated in both
blocks, like every other token in the file.

Four things about that palette are worth knowing:

- **It reuses the app's tokens wherever the two mean the same thing** — `fg`,
  `muted`, `line`, `raised`, and the whole `ok`/`note`/`stop` family, whose
  light values already *were* the landing page's reds and ambers. The `lp-*`
  names exist only for what the chrome has no word for: two tinted grounds,
  the drawn tablet's shell, and the accent shades below. That borrowing is the
  reason pinning the theme had to be done by scope rather than by re-pointing
  the `lp-*` names: half the page's colour does not come from them.
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
- **`--color-lp-card-1/2/3` and `--color-lp-road` are the page's one
  decorative hue, and the only one.** Indigo, peach and violet hold the three
  refusal cards; the green holds the order road's field. Everywhere else here a
  colour carries a fact — indigo is the way forward, the status family is a
  verdict — and these carry none: they exist so cards in a column are told
  apart by the floor under them. Two rules keep that from leaking, and both are
  in the long note beside them in `globals.css`: they are **grounds only**,
  never ink and never a control or a badge, and they stay at about 4%
  saturation, because a stronger middle card reads as amber, which on this page
  means *this costs you readers*. `--color-lp-road` is the one to watch — green
  is the `ok` end of the status family, so a saturated version of it would say
  the road is *finished* to somebody who has not started.

Three things in it are load-bearing:

- **The figures are drawn in markup, never screenshotted** — the phase list,
  the pre-upload check, the money panel. A screenshot is an asset that goes
  stale silently while the app moves, on the one page whose whole pitch is
  being checkable. **Three of them go further and are *computed*
  (`refusal-figures.tsx`)**: the three refusal bands each carry a picture of
  the screen that catches them, and the covers one runs `coverReport()` over a
  fixed set of measurements while the export one filters `DESTINATIONS` the way
  the real dialog does — so every row, label and count in them is the app's own
  answer and there is nothing left to drift. Prefer that shape for any new
  figure whose subject is a pure module. **"The whole point" is five
  alternating rows** (`order-rows.tsx`): a drawn screen on one side, the phase
  on the other, sides swapping down the page, each screen captioned with the
  name of the screen it draws. It has no `"use client"` and ships no script.

  It **replaced an order road on 2026-08-13** — the five phases as stations on
  a measured curve with a marker riding it as the reader scrolled. That road is
  still in the tree, imported by nothing, along with the pure and still-tested
  `landing-path.ts`; TODO.md records why it went and what the rows owe it. The
  short version is the part to keep: the road's argument was that a writer is
  short of the *sequence* rather than of five names, so the rows carry the
  phase numbers, the per-phase step counts and the ARC callout. Strip those and
  this is the boxed list the road existed to replace. Each row carries a screen
  in the column its words are not in — and **two of the four are photographs of
  the real app, which is this section's standing exception to the rule above.**
  They were all drawn by `phase-screens.tsx` and computed: `proseReport()` over
  a fixed passage for the writing and revising ones, `STATUSES`/`LEAD_DAYS` for
  advance copies, `DESTINATIONS` for the export. Three were swapped for bitmaps
  on 2026-08-13 and the fourth on 2026-08-14, at the owner's request. The cost
  is the same one every time and worth restating: **when the screen it
  photographs moves, nothing fails and nothing warns; the picture simply starts
  lying.** `WriteShot` and `ArcShot` in `landing-page.tsx` still carry it, each
  with the cost written above it — re-shoot them when the editor's chrome or
  the ARC statuses change. The drawn components are all still there and
  callerless, so putting one back is a line in `ORDER_SCREENS`.

  **Two rows have come back off bitmaps, and the publishing one is the case to
  learn from.** Prepare took `CheckDemo` on 2026-08-14, which draws the screen
  and then works it. Publishing took a new drawing the same day —
  `ExportScreen` in `export-screen.tsx`, a full-width recreation of the export
  wizard's last step, replacing `/export-tablet.webp`. That picture was the one
  of the four that **could not be fixed by re-encoding**: composed by a script
  from a screenshot no longer on disk, so there was nothing to re-encode
  *from*, and at 1984×1326 in 49KB — about 0.15 bits a pixel, on flat grounds
  and small type — webp's ringing sat on the letters. Its own note said the
  real fix was to render it again. Two of the new drawing's values are read out
  of the app (the export's own `FormatMark`, and "Classic" from
  `templateById(DEFAULT_TYPESET.template)`); the rest is quoted by hand,
  because the strings live in `export-page.tsx`, which is `"use client"` — a
  Server Component importing a *value* from a client module gets a client
  reference, which is the `sections.ts` lesson. It sizes itself in `cqw`
  against a container query on `AppWindow`'s glass, so it needs no script and
  holds its proportions at any column width. The hero is the
  other exception and goes further still: it carries the **real check**, not a
  drawing of one — see `book-check.tsx`. Two more bitmaps are *scenery* rather
  than pictures of the product, so neither can go stale: the hero *backdrop*
  (`public/hero-{dark,light}.webp`, per theme, behind `--lp-hero`) and the
  **closing landscape** (`public/closing-field.webp`, behind
  `.oc-closing-field`). **Both framings
  are *measured*, not eyeballed**, and the long comments above them in
  `globals.css` record the numbers: the hero's records the contrast ratio each
  anchor and size buys against the headline, with a separate phone framing
  because the text block ends higher there.

  **The closing landscape is one picture under the last ask *and* the footer**,
  and it replaced two separate endings — an indigo CTA gradient with a drawn app
  window cropped by its bottom edge, and a paler landscape band
  (`footer-field.webp`) inside a white footer under it. The ask sits on the
  page's own ground and **the picture is the `<footer>`'s own background**
  (`.oc-closing`), with its `padding-top` as the reveal — the scene with nothing
  on it before the card starts. That placement is the load-bearing part. It was
  a fixed-height band above the footer with the card lifted onto it by a
  negative margin, and landscape then ran down either side of the card for
  exactly the height of that lift and stopped, leaving the lower two thirds of
  a tall card on plain white. Painted here it covers however tall the footer
  turns out to be, so the strips reach the last line of small print whatever
  gets added.

  **`cover` cannot do it and the arithmetic is why.** The footer is ~1120px tall
  against a 3:1 panorama, so height-driven scaling put the ridge level with the
  card's top edge and left the reveal as bare sky; buying the scene back needs a
  ~1000px reveal, which means upscaling a 2172px image 2.4× and showing its
  middle quarter. So from `48rem` up the picture is laid at its **natural
  aspect** (`100% auto`) and its last scanline is extended downward by
  `--lp-closing-floor`, a thirteen-stop horizontal gradient *sampled from that
  scanline* — which is why the join is invisible rather than close. Re-sample it
  whenever the image changes. Below `48rem` it falls back to `cover`, because at
  390px the natural-aspect scene is a 130px ribbon and a centre crop is the
  better picture. The reveal is a percentage of the width, so it holds at **89%
  of the scene at every width from 1024 to 2560** — and therefore at any browser
  zoom.

  **Nothing is written on this picture, and that is the finding worth not
  re-deriving.** Two landscapes were tried with the ask centred on the sky.
  Both were measured band by band against `lp-ink`, and the second is genuinely
  good — **13.6:1 to 15.7:1 through the top 36%** — but its dark ridge starts at
  that 36% line and runs 1.9:1 to 4.5:1 below it, and white type fails on all of
  it (1.2:1 on the sky). The killer is not the short safe zone: the ask is a
  *fixed stack of pixels* while the frame scales with the width, so probing four
  widths in an iframe put the caveat line at 41% of the frame at 1280 and **58%
  at 390**, out over open water. No padding lever fixes that — they are all
  proportions of the width and the text is not. So the words went onto the white
  above, which is what the reference does, and the band below carries nothing.
  **Anything placed on it must bring its own ground**; bare type does not go back
  without re-running that probe, at 390 first. The frame is `cover` anchored
  `top` so the sky survives at every width. Re-measure before swapping any of the
  three images.
- **Everything countable is imported and counted**: `STEPS`, `PHASES`,
  `ALL_TOOLS`, `TOOL_GROUPS`, the price from `plans.ts`. The ARC step's title,
  its number and its phase are all derived, because the page quotes them.
- **Every section title is one scale, and it is a constant** —
  `SECTION_TITLE` in `components/landing/type.ts`, paired with `oc-display`.
  Most headings go through `Head`, but three are hand-written (the FAQ's
  column carries a marker dot and a description, the check's is centred over a
  window, the closing banner's is centred on the landscape), so the size has to
  live somewhere all four can read it — `type.ts` has no `"use client"` for
  the same reason `sections.ts` does not, and it avoids a cycle with
  `cta-banner.tsx`. The scale tops out a little **above** the hero's own 56px:
  a deliberate trade, since the hero holds its place by being three lines
  against one and by the marker behind its last clause. Re-check that if the
  hero is ever cut to a single line. The footer's column labels are not
  section titles and stay small.
- **Nothing on this page may be a number a SaaS page would invent.** There is
  where "trusted by 5,000 brands" goes, and there are no customers to count —
  so no user count, no rating, no testimonial goes anywhere on the page until
  there is a real one. That rule outlived the row it was written for: a band of
  four counted figures (steps, tools, formats, EPUBCheck errors) sat under the
  refusals and was **removed on 2026-08-12**, because four numerals on a band
  of their own ask a reader to be impressed by an arithmetic nobody has given
  them a reason to care about. All four figures are still on the page, each
  where it means something — the steps in "The order", the tool count in the
  tools heading, the formats in the mosaic under the hero and in the footer,
  the zero in "The export is verified, not asserted".
- **There is no testimonial slot on the page, and the empty space is owed a
  replacement.** It held the *research* rather than customers — things writers
  said about the *problem*, quoted from the module each one caused, nobody
  named, nothing invented, under a heading saying outright they were not our
  customers — and it was **removed on 2026-08-13** to be rebuilt. `VOICES` went
  with it. Read TODO.md under "Taken out on purpose" before rebuilding it: the
  four rules that kept it honest are recorded there, and they are what stop the
  replacement becoming the invented quotes this page refuses. Until it returns
  the slot stays empty, which claims nothing.
- **A refusal card's title is two lines and only the second takes a hue** —
  the problem in ink, the answer in the page's own indigo. That is what a
  reader gets at skimming speed, and it is why the accent is indigo rather
  than the card's tint: indigo means *this is the way forward* everywhere on
  this page, the card grounds mean nothing at all, and peach on a problem
  would read as amber, which means *this costs you readers*. Its badge is the
  status family for the same reason, and the line above its button carries the
  rule's **provenance** where the reference puts a customer's logo and result.
- **The "trusted by" slot under the hero holds `TILES`**, and it is the third
  answer to the same problem. A panel lifted over the hero, one sentence
  across it, then a bento of small tiles — the arrangement every reader has
  been trained to read as proof — filled with the only proof this page can
  honestly offer: the **seven programs a finished file opens in**, each with
  the format that opens it, read from `DESTINATIONS` so it cannot name one the
  export does not reach, and **three facts a reader can settle today** (zero
  EPUBCheck errors, four formats, nothing uploaded). No company logo appears
  under any claim of endorsement, because none of them endorse us. The grid
  has **no edge fade**: the reference crops its own to say there is more than
  fits, and all seven destinations are shown, so a fade would imply an eighth.

**Every claim on it has to be true of the code.** Nothing claims what the app
cannot do — the print PDF is the browser's print engine and says so. The page
reads `SELF_TICKING` / `YOURS_TO_TICK` out of `roadmap.ts` and prices out of
`billing/plans.ts` rather than restating either, which is the shape to prefer
for any new figure on it.

**There is no "Not built yet" section any more, and the rule it carried is
worth knowing anyway.** "What comes after that" — three dashed cards naming
what is genuinely unbuilt — was **removed on 2026-08-14** at the owner's
request; TODO.md keeps its three entries verbatim. Its rule was that *nothing
stays under that badge once it ships*, which failed in the safe direction and
so failed silently: Track carried "none of it exists today" for a while after
Track shipped, which is still a page saying something untrue. Nothing needs
walking now — but the mirror of that rule binds harder than it did, because
**an unbuilt feature named anywhere on this page is now a promise with no
section admitting it is one.** Do not name one; if the page ever has to, the
section comes back.

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
`/tools` the tool guide (public, and public is the point — it is what a visitor
reads to decide whether to sign up) ·
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
`/api/comps/categories` · `/api/comps/keywords` · `/api/comps/keywords/chat` ·
`/api/blurb/critique` · `/api/blurb/workshop` ·
`/api/billing/*`. All of those except
`/api/comps` and `/api/comps/subjects` are metered and gated by `requirePro()`;
those two are free, keyless and stay that way — which is the whole reason the
model steps around the comps search (query, rank, categories, keywords and the
keyword chat) are routes of their own rather than flags on it.

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
narrow** — `menu.tsx`, `spinner.tsx`, `book-cover.tsx`, `copy-button.tsx`,
`tool-save.tsx` and `assistant-reply.tsx`. Things land there on the third copy,
not the first: `Spinner` was extracted once a tool screen needed the ring the
checkout result already drew, because that is how one product ends up with two
loading states spinning at different weights. Both it and `Menu` take
`currentColor` and inherit whatever they sit on; a fixed colour is invisible in
exactly one theme. The spinner also carries the standing Tailwind v4 warning in
miniature — its first draft used `border-current/25`, which v4 silently drops,
so it would have shipped as a plain circle. Check the built CSS, per the build
note above.

**`assistant-reply.tsx` over the pure `markdown.ts` is what the three assistant
panels print with**, and it arrived on 2026-08-15 by the third-copy rule
exactly. The editor's assistant, the blurb workshop and the keyword workshop
each rendered the model's answer with `whitespace-pre-wrap` — so all three put
`* **Tightening:** Cut fluff` on screen with the asterisks in it. Every model
answers in Markdown unprompted; nobody was parsing it. Four things hold it:

- **The parser is written, not installed**, for the reason `ai.ts` writes Gemini
  out by hand. A CommonMark library is mostly syntax no model emits into a chat
  panel — reference links, HTML blocks, tables nobody can read in a 300px rail.
  What is there is the subset that turns up, tested.
- **Generated text is hostile input, so the output is data and never HTML.**
  `markdown.ts` returns blocks and runs of plain strings; the component makes
  React elements. Nothing downstream may reach for `dangerouslySetInnerHTML`.
  Raw HTML in the source renders as characters, and **a link keeps its words and
  loses its destination** — a model-supplied URL is attacker-shaped, and the
  assistant has no reason to send a writer off-site.
- **Underscores do not emphasise inside a word.** `snake_case_name` had its
  middle set in italic until a test caught it; CommonMark forbids intraword `_`
  for this reason, and these replies are full of `ANTHROPIC_API_KEY`. Asterisks
  are deliberately left loose, because `**Label:**text` is commoner than
  intraword `*`.
- **An unclosed code fence renders anyway.** A streaming reply has one on almost
  every frame, and waiting for the closing fence would make offered prose appear
  only once the model had finished — the moment a reader is watching hardest.

**What is copyable is what is *offered*, not everything.** `isOffered` says a
fenced block and a blockquote are where a model puts prose it is handing over;
those get a button, a paragraph explaining a suggestion does not, or every reply
becomes a column of buttons and the one that matters stops standing out. The
editor's assistant adds one for the whole reply, which appears only once the
reply has finished. And **the clipboard gets the words without the notation** —
`blockText` drops the marks, because the destination is somebody's novel and
pasting `**bold**` into a manuscript puts asterisks in a book. The two workshops
pass `copyable={false}` on the conversation itself: what is worth taking there
is the draft or the candidate list, which already have their own controls, and a
second button beside them would be two ways to take the same words, one of which
does less.

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

- **`--color-sheet` / `-ink` / `-edge` are paper, and they are the fifth
  exception.** Every picture of an exported page — the format cards' previews
  and the page sheet on the two formatting steps — is drawn on them, and they
  are **stated identically in both theme blocks**, like `--color-upgrade-*`.
  The rule they follow is the landing page's, not the chrome's: *drawn artwork
  of an object stays literal.* What leaves this app is black ink on white paper
  for every reader, so a preview that turned charcoal after sunset would be a
  picture of a file nobody will open. It was learned expensively — those
  previews had `#ededed` typed in at forty call sites, which is a dark-set
  near-white, so in daylight the whole system rendered white-on-white and the
  cards a *format* is chosen from were blank rectangles. Paper is a shade off
  #ffffff on purpose: `--color-panel` is white in daylight, and a pure white
  sheet on a white card is a sheet nobody can see.

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
