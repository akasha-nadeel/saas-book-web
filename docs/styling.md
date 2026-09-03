# Styling: the palette, the two themes, and the shared primitives

Read before adding a colour, a token, a theme rule, or a component to `src/components/ui/`.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.


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

**One palette in two values: greyscale by day, indigo by night.** The light set
is the `:root[data-theme="light"]` block and is neutral, with no hue anywhere
except the status family below. The dark set is the `@theme` block and the
default, and **it stopped being greyscale on 2026-09-01** — `surface` #141b34 →
`panel` and `nav` #080e26 → `raised` #212c4f, `line` #29335a, `fg` #f1f2fa,
`muted` #bcc5de. Both blocks state the same names.

**The two themes stack in opposite directions, and neither is arbitrary.** On
white the desk is grey, cards are white on it, and a hover *deepens*. On the
indigo the page is the **lightest** surface and every card, rail and panel is a
darker well cut into it — which is why a *selected* row sinks into the chrome
(`--color-selected` is a dark pill there) rather than lifting off it. This
reverses what this file said while the ground was black, where a surface had to
be lighter to be seen at all because a shadow on black is invisible. `raised`
crosses over between the blocks in both readings: a hover comes towards the
pointer whichever way the rest of the stack runs.

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
  indigo, the fill under "Start free" — and `#8ab4ff` in the dark one. The
  asymmetry is deliberate and documented at both ends. **One accent has to serve
  as both a link and a fill**, and on the indigo ground those two pull apart: a
  link needs a relative luminance near 0.30 to clear 4.5:1 against `surface`,
  white ink on a fill needs that fill below 0.18, and no value is in both
  ranges. Only a ground near #0d0d0d lets one colour do both — which is exactly
  what the black set exploited when this token was plain white. So at night the
  fill is bright and `--color-accent-ink` is near-black navy; by day it is the
  other way round. One hue is reserved for *"this is the way forward"*, which is
  what lets a writer find the way on without reading the screen. Past that the
  chrome spends colour in one more place: the nav glyphs take the accent under
  `dark:` (see `SideItem`), because on the indigo rail every row is white type
  on one ground and the glyph is the only thing that separates them.
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

## Panel design — the grouped-list language

Written down 2026-09-01, while taking the editor's panels through an Apple pass.
The rules below are what `ui/list.tsx`, `ui/segmented.tsx`, `ui/field.tsx` and
`ui/empty-state.tsx` encode, and the reason they are a system rather than four
components is that the alternative — styling thirty-six files by hand — produces
thirty-six slightly different Apples.

**The problem being solved is the pile.** Every panel had grown the same way: a
column of separately-bordered cards, each with its own hairline, its own tint of
`bg-surface` and its own shadow. Find & Replace was four of them on one tab and
five on the other; Versions was one card per snapshot; the consistency page
nested cards two deep. On a 240px rail that reads as a pile of boxes rather than
as a screen, and the thing the writer came for is the third or fourth box down.

- **One container per group of related rows, never one per row.** `ListGroup`
  draws the border and the radius; `divide-y` draws the separators. A border on
  each row double-draws at every join and leaves a stray rule under the last.
- **The label sits outside the group.** `SectionHeader` is 11px, uppercase,
  muted, above the rows it names — not a filled header bar welded to the top of
  a card, which is what makes every group read as a panel of its own.
- **Explanatory text goes below the list, not above it.** `ListFooter`. A
  paragraph above a list is read once and then read past forever; the same words
  underneath are found by the person who went looking for them. Two panels
  opened on two paragraphs of explanation before the writer reached anything.
- **Empty states are not boxed.** A bordered card around "no results" makes an
  absence look like a result — the same shape a finding arrives in. `EmptyState`
  centres a quiet glyph, a line and the room around them in the space the
  content would have filled.
- **Fields are filled, not outlined**, with the glyph inset and a hairline
  accent ring on focus. An outlined field is one more box; a filled one is a
  well in the surface. The clear control appears only when there is something to
  clear.
- **A segmented control's active segment is a raised neutral pill**, not a
  saturated fill. A two-up control filled with the accent is the loudest thing
  on a panel beside a manuscript, and it says "press me" about a tab that is
  already selected. **`theme-toggle.tsx` is the exception and keeps its fill**:
  three 28px icon-only targets, where a pale pill on a pale track is not
  visibly selected.
- **One grey and one border.** `bg-raised` and `border-line`, flat.
  `search-panel.tsx` had reached nine near-identical values —
  `bg-surface/50 /40 /30 /20`, `border-line/70 /60 /50 /40` — which is not a
  palette, it is a series of guesses.
- **Two radii.** `10px` for fields, rows and small controls; `12px`
  (`rounded-xl`) for groups.
- **A type ramp, not a size per component.** 11px semibold uppercase for section
  headers and footnotes, 13px for rows and body, and `tabular-nums` on anything
  counted so a column of figures does not shift as it changes.
- **Colour that carries information keeps carrying it, but moves to a glyph.**
  The consistency panel washed each finding card with a hue per check; six
  competing card backgrounds is the pile again. The hue moved to a leading glyph
  on a neutral row, which is how Settings tells one category from another.

### Amendment, 2026-09-03: the consistency check is a card again

The two paragraphs above name that screen twice — as the offender that "nested
cards two deep", and as the place a per-check hue was taken off a card and put
on a dot. **Both were undone on purpose**, and the reasoning is here rather than
only in `finding-card.tsx` so this section is not read as still describing it.

- **A finding is not a peer of the finding under it.** The pile rule is about
  boxes that are peers and look identical — six grey bordered cards down a rail,
  where the border is spent drawing a separation the eye already had. A finding
  is a small document about one word, and its nesting *is* the thing: a spelling
  contains its chapters, a chapter contains its sentence. So it gets a card and
  one box per spelling. **Two levels, and the chapters inside a box are divided
  by a hairline rather than boxed again** — three levels is the pile arriving by
  another door, and was drawn once before being cut.
- **The grouped list is unchanged everywhere it was written for**: chapters,
  versions, search results, settings rows — lists of genuine peers. Nothing in
  `ui/list.tsx` moved.
- **The hue came back as the card's ground**, where the dot had been. Six of
  them are legible rather than a pile precisely because the card is a document
  and not a row: the ground says which check without spending a glyph, and the
  eyebrow says it again in words for anyone who cannot use the colour.
  `consistency-checks.ts` holds the six.
- **The ink is set by the palest hue, not by each.** One mix for all six is what
  keeps them a family, so amber — the weakest against a white ground — decides
  the numbers, with teal and emerald just behind it. `finding-card.tsx` carries
  the two percentages and the measurements; a hue changed there or here means
  re-measuring, in daylight, which is the half that fails.
- **The card's colour is `color-mix` into theme tokens, not a token of its own**,
  so it is a pale card by day and a deep one at night with no second table, and
  it adds no seventh entry to the closed list of exceptions above. Same trick as
  the tool marks.
- **Three tokens are not what they seem inside the editor's panel.**
  `--color-surface`, `--color-raised` and `--color-line` are re-pointed there to
  translucent washes of `fg` so a panel layers over whatever it is dropped onto.
  That is right for panels and quietly wrong for anything supplying its own
  ground: the finding card's white boxes came out as a 5% black veil over the
  tint, correct on the full screen and wrong in the rail. **`--color-panel`,
  `--color-fg` and the status family are the same in both places**; build on
  those, or on a translucent hue that needs no token at all.

## The editor's rail icons

`src/components/icons/` is [itshover](https://itshover.com) (Apache-2.0),
vendored file by file rather than pulled with `shadcn add`: this repo has no
`components.json`, and `shadcn init` would rewrite `globals.css` with shadcn's
own token set over the `@theme` block the whole app is coloured from. They are
ordinary stroked SVG on a 24-unit grid taking `currentColor`, with their motion
in the component (`motion`, their one dependency) rather than in a sprite. Each
carries a `"use client"` directive added here, since they use hooks and ship
none of their own.

`editor/rail-mark.tsx` is the wrapper both rails, the phone dock and the More
sheet draw through. Two rules hold it together, and both were paid for:

- **The icons take `currentColor` and spend no hue of their own.** They
  replaced PNGs that each carried a coloured disc baked in, which put a column
  of eleven hues down the edge of a manuscript — the loudest thing on a screen
  whose subject is a page of prose, and the exact thing the closed list above
  exists to prevent. There is no `--color-mark-*` family; there was one for an
  afternoon and it is gone.
- **Selected is the dashboard's own wash**, `bg-blue-500/15
  dark:bg-blue-500/25`, taken verbatim from `SideItem` in `bookshelf.tsx`. Two
  navigations in one product must not disagree about what selected looks like.
  It replaced a filled `bg-accent` tile that inverted its icon and shouted.
- The animation is started from the **button**, through each icon's imperative
  handle, because the glyph is 24px inside a 48px target and most of a hover
  never touches it — and it is skipped outright under
  `prefers-reduced-motion`, which a media query cannot do for a scripted
  animation.

Two marks have no itshover equivalent — the microphone and the Ideas lamp — and
keep the app's own paths in `DRAWN`. They do not animate. A wrong metaphor that
happened to move would be worse than a right one that sits still.

The writer-facing looks stored in `prefs` are each applied their own way:
`theme` as `[data-theme]` on `<html>` (above), `paper` as `[data-paper]` on the
writing surface, and `focusMode` / `typewriter` as behaviour.

`<body>` is `overflow-hidden` (for the editor shell). A standalone scrolling page
therefore needs `h-dvh overflow-y-auto` — `min-h-dvh` puts content out of reach.


