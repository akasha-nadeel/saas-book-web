# The editor, its rails and panels, and front/back matter pages

Read before touching `src/components/editor/`, `src/lib/editor/`, the workspace rail, the tool panel, the book panel, `matter.ts`, `matter-picks.ts`, `series.ts`, `ideas.ts`, `bible.ts` or `history.ts`.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

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

**Pressing a control on the selection bar collapses the selection, and the bar
now puts it back.** `preventDefault` keeps *focus* in the prose but not the
range, and ProseMirror syncs the collapse into its own state a tick after the
click handler has run. For most of this bar's life only the font picker knew:
it took two clicks, so it met the problem first and was given a `range` ref, a
`guarding` ref and a restore inside `selectionUpdate` — while a comment beside
it recorded that "every other control has finished its work by then".

**That was true of the first press and false of every one after it, which is
the bug the writer actually met.** Bold landed; the Italic after it ran against
`from === to` and set a *stored mark* for the next character typed instead of
touching the words still highlighted under the bar. Nothing said so, because
`pointerOnBar` holds `shouldShow` true, so the bar went on floating over a
caret, and the active pills — read from that same collapsed selection — could
be wrong too. So the range is now **the bar's**, not the picker's: captured on
every non-empty `TextSelection`, put back the moment a collapse arrives while
the pointer is on the bar or a list is open, and put back again inside `apply()`
— which every control routes through, and which is what covers the keyboard and
a touchscreen, where nothing hovers and the pointer guard never fires. It
cannot recurse (what it restores is not collapsed) and it is inert on a browser
that does not collapse at all.

Three things still hold the picker together, each fixing a different symptom of
that one cause. It **remembers the range when it opens** and puts it back with
`setTextSelection` before applying, so the command lands. It also **puts that range back from
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

**All of that lives in `BarMenu` now, because there are two lists.** The
placement, the portal, the upwards-only rule and the four ways out are one
component that both pickers mount; a second copy would have been the first
one's bugs again a year later. It keeps its own `openedOn` snapshot for the
close-on-new-selection test, distinct from the bar's shared `range` — that one
follows the writer by design, so comparing against it would mean nothing had
ever changed.

**The size control is the second list, and it reads and writes points while
storing a multiple.** It replaced an A− / A+ pair that walked
`FONT_SIZE_STEPS` a notch a press with nothing on screen saying what size the
selection was or what the next press would give. What is stored is unchanged
and must stay so — a ratio against `--ms-size`, so a run keeps its proportion
when the book's own type size moves — and `fontSizeOptions(bodyPt)` in
`font-size.ts` is the join, resolving one into the other at the moment of
drawing so a label cannot go stale: the same 1.5× run reads 18 pt in a 12 pt
book and 21 pt in a 14 pt one, and both are true. The trigger prints the size
the selection **really is** rather than the nearest row, since a chapter can
carry an off-scale multiple from an import and rounding it on the control that
reports it would be the screen misreporting the document. No hover preview
here, where the face has one: Live Preview earns its keep on a typeface because
nobody can pick one from a name, and "14 pt" is not a name.

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
can't be read falls back to moving whole, which is how this worked before.

**Inline images are a resizable node** (`resizable-image.ts` +
`image-node-view.tsx`) that stores width as a **percentage of the column**, so a
picture keeps its proportion whatever the trim size; `src/lib/image-import.ts`
re-encodes on the way in, capped at 1400px on the longest edge and 900KB. (That
last sentence said it "handles paste/drop" until 2026-08-18 and there is no
paste or drop path in the tree at all — no `handlePaste`, no `handleDrop`. The
file picker in the right rail is the only way in. Worth building; it is not
built.)

**Three things about handling one were wrong together**, all found 2026-08-18
and all with different causes:

- **The resize ignored the page zoom.** The manuscript is drawn inside a CSS
  `zoom` whose "100%" is really 1.3 (`PAGE_SCALE`), and `startResize` added
  `clientX` deltas (viewport pixels) to `clientWidth` (layout pixels). So the
  edge ran a third ahead of the pointer and hit full width three quarters of the
  way across; at the 200% setting, two and a half times. The editor already
  knows this rule in both of its other measuring sites — `pagination.ts`
  normalises every rect by the same scale and click-to-type divides by it — and
  this was the one calculation that never got it, because the zoom landed four
  days after the resize did and nothing failed when it arrived. The arithmetic
  is now the pure, tested `src/lib/editor/image-resize.ts`.
- **A picture could not be moved.** ProseMirror drags a node view by an element
  marked `data-drag-handle`, Tiptap cancels every `dragstart` without one, and
  there was none anywhere in the view. Cut and paste was the only way and
  nothing said so. The frame carries it now — not the `<img>`, which keeps
  `draggable={false}` so the browser's own image drag cannot race the handles.
- **A picture arrived filling the column.** `setImage({ src })` set no width,
  and no width means no width *style* — which sounds like "its own size" and is
  not, since the stylesheet caps every picture at `max-width: 100%` and an
  imported one is 1400px against a column nearer 430. `insertWidthPercent` gives
  one a starting size and **leaves a picture that already fits alone**, because
  half a column would *enlarge* a small logo past its own pixels. The fraction
  is 50%, which is the number the node view had already been using as its
  wrapped-picture fallback for the same reason.

**The image toolbar had none of the text bar's protections** and has them now:
its buttons refuse `mousedown` (without it, every press blurred the editor,
Tiptap re-focused on the next frame *and* scrolled the caret into view, so the
page jumped under the picture being worked on), and `shouldShow` tests focus
behind a `pointerOnBar` ref, which the text bar's own comment had already
explained after that bar was seen floating through three panel switches.

One thing checked and found **not** to be a problem, so nobody re-fixes it: the
two `BubbleMenu`s do not collide despite only one naming a `pluginKey`. Tiptap
v3's `getAutoPluginKey` mints a fresh `PluginKey` and ProseMirror de-duplicates
the name, so the un-keyed one is `bubbleMenu$`. It *would* have collided in v2,
where both defaulted to the literal string.

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


