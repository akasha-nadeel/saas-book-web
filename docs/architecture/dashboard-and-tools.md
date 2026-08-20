# The dashboard, the checkup, the roadmap, and the sixteen tool screens

Read before working on `bookshelf.tsx`, `checkup.ts`, `roadmap.ts`, `book-tools.ts`, `tool-header.tsx`, `tool-page.ts`, `tool-steps.ts`, `use-tool-save.ts`, `unsaved.ts`, or any screen under `src/components/<tool>/`.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

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
- **One finding per *errand*, not per fault, and the cover is where those two
  came apart.** `findingsFrom` is the one way readiness issues become findings
  — Overview, Prepare and the landing page's hero check all go through it, so
  none of them can word or group a finding differently from the screen it sends
  people to. What it adds to `fromReadiness` is that the cover *file's* faults
  fold into a single row. All twelve of `checkCover`'s findings map to the same
  `covers?check=1` report, so a cover that was both squarer than Amazon asks for
  and smaller than recommended produced two rows and two buttons to one screen,
  and the writer went twice — for a file that screen fixes in one visit, since
  it re-reads and re-checks the result of each fix in place. Three rules hold
  the fold: **two or more fold and exactly one is left alone** (a single fault
  keeps its `fix=shape` intent, which is what opens the crop window already
  loaded); **the row names every fault it counts**, because every other row here
  opens by naming the problem; and it **counts only faults that have a
  destination**, so the count cannot promise a row the list then drops. The
  folded row stands where the first of its members stood, so the severity order
  the three screens sort on is untouched — and `checkup` filters its advisories
  *before* folding, or a book shown one of two faults would announce two and
  list one. `ReadinessIssue.label` exists for this and nothing else: the cover
  checks arrive as a label and a detail, and the row needs the short halves back
  to say several in one breath. `publishing.ts` still reports them one by one,
  which is right for a list that is read rather than pressed.

  **The covers screen keys its arrival on `check`, not on `fix`, and folding is
  what forced the distinction.** Landing there from a finding loads the cover
  already on the book, so a writer who was just told what is wrong with it sees
  it rather than an empty drop zone. That was hung off the `fix=` intent, which
  was the same thing while every cover row carried one — the folded row carries
  none, so the commonest arrival lost the picture. Two halves now: the **picture
  and its note** on any `?check=1` arrival, and **`setFacts` only for the two
  errands that exist to work on the stored copy** (`fix=shape`, `fix=enlarge`).
  That split is load-bearing rather than tidy: what is stored is a 700px
  compressed copy, so making it the file under examination rewrites the report —
  a cover the dashboard called "smaller than recommended" would greet the writer
  with "Too small to upload", a harder verdict about a file they did not ask
  about. So a plain arrival keeps the original's numbers, read back from
  `coverfacts:`, and the note beside the picture says which of the two is on
  screen.

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


