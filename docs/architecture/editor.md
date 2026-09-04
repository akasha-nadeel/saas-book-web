# The editor, its rails and panels, and front/back matter pages

Read before touching `src/components/editor/`, `src/lib/editor/`, the workspace rail, the tool panel, the book panel, `matter.ts`, `matter-picks.ts`, `series.ts`, `ideas.ts`, `bible.ts` or `history.ts`.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

## One bar, one rail, one panel (2026-09-05)

**The editor now has an application bar, and it used to have none.**
`editor-top-bar.tsx` carries what a word processor puts along the top — the way
out to the shelf, a File menu, undo and redo, how much has been written and
whether it is saved, the book and chapter you are in, and Import and Export at
the right. All of that used to be spread between two icon rails and a thin strip
of desk above the page. Three things went in the same change, and each was
paying for the bar’s absence:

- **The right-hand rail is deleted.** Its controls opened portalled flyouts that
  positioned themselves *leftwards*, for no reason except that the trigger sat
  on the right edge of the window; `ToolRail` and `Flyout` are gone with it and
  `editor-toolbar.tsx` is down to the two things other screens borrow,
  `ALIGN_OPTIONS` and `useEditorState`. Its tools are now **Page & type**, one
  tab on the left rail.
- **The desk strip is deleted.** By the end it held a word count and a save
  status, and both are in the bar; a full-width band drawn to hold two readings
  is a second bar under the first. The formatting pill and the dictation bar
  moved into the manuscript column, in the wrapper *above* the scroller — inside
  it, the pill slides away with the page.
- **The rail carries a word under each icon** and scrolls, with a bar that shows
  on hover (`oc-rail-scroll`). A column of unlabelled glyphs was readable while
  it held eight; it does not survive being the only rail. **The ground is on the
  icon, not on the button**: a rounded tile behind the mark takes the hover and
  the selection, with the word standing outside it, because at this width
  lighting the whole control is a card-sized block of colour for something the
  pointer is passing over. **And selected is the accent on the mark** rather
  than a deeper ground — hover and selected then differ by what they mean
  instead of by how deep they sit, which is a comparison you can only make with
  both in front of you.
- **Home is the bar's, and only the bar's.** The rail carried one too, which is
  a question about whether the two differ rather than a way home. The survivor
  wears the rail's own animated mark (`RailMark` + `useMarkHandle`, the same
  four events `RailButton` wires), so the button that left and the button that
  stayed are one drawing. The first rail group draws no divider now, because a
  rule at the top of a list separates it from nothing.
- **Import is Export's shape, outlined.** It wore the phone More sheet's row
  style for a day — icon, label, trailing arrow — beside a filled button. They
  are the two ends of one errand and belong in one family; which of them is
  filled says which the product is finally for.

**Every other tab is the panel, Manuscript included** (2026-09-05). The
navigator used to be a second panel in a slot of its own on a stored flag of
its own, so the one button that opened it did not select a tab at all — it
toggled that flag, and had to know that a tool panel *covering* the navigator
meant a press should close the cover rather than the thing beneath it. All of
that existed to make one button behave like the other nine. `LeftPanel` already
knew how to draw it (`ChapterSidebar` mounts the same `BookPanel`); the editor
simply was not going through it, and `prefs.chapterSectionOpen` is gone with the
special case. Two rules follow it into the panel:

- **Choosing a page does not close the panel** unless the panel is a modal.
  Beside the page it is a neighbour, and a contents list that shuts itself the
  moment you use it is one you reopen after every chapter. Scoped by the layout
  classifier, like the outside press and Escape before it.
- **One dismiss, and it moves.** The handle straddling the panel's outer edge is
  the control; the header's button appears only in continuous layout, where the
  panel is `100vw` and that handle's `-right-3` is off the screen. It follows
  the *layout* and not a width breakpoint, because continuous is reached by
  height too — a 900×500 window is continuous, and `md:hidden` left a writer
  with neither control and no way out of the panel.

**Page & type opens as a card at the rail’s edge, not as the panel**
(`tools-popover.tsx`), and it is the one exception in the column. Every other
tab answers a question *about the manuscript* — where is this word, what did
this chapter say last week — and the answer is a list long enough to read down,
which is what the full-height sheet is for. These are a dozen short settings
rows: in a 25rem column they opened three-quarters empty and pushed the page
sideways to do it. So the rail keeps one promise — press a tab, get an answer at
its edge — while the shape of the answer follows the question. Three details are
load-bearing:

- **It is portalled and `fixed`, measured from the rail’s own right edge.** The
  rail scrolls now, and a card rendered inside it would be clipped at that edge.
- **Its ceiling is the rail’s top, not the window’s.** Clamped to the viewport,
  the round close button above the card rode up over the undo controls.
- **Only one tab is ever lit.** The card stands in the panel's own slot at
  near enough its width, so a panel open behind it is open and *not visible*.
  Left to their flags, Page and Manuscript light together and the rail claims
  the writer is in two places. The panel is deliberately not closed — putting
  the card away gives it back — so what changes is which of the two the rail
  says is on screen.
- **Escape is tested in the capture phase.** Every picker in the card opens a
  portalled menu with its own Escape handler on `document`, and neither stops
  the event — so in the bubble phase one press closed the menu *and* the card.
  React flushes a discrete event’s update at the end of the document handler,
  so by then the menu is already out of the DOM and “is a menu open” always
  answered no. Asked on the way down, it is still true.

## Focus mode, and the two rules to the page (2026-09-05)

**`prefs.focusMode` puts the chrome away** — no bar, no rail, no panel, no phone
header or dock; the page, the formatting pill, the selection bar, and one
`fixed` button at the top left to come back. The key already existed and meant
*dim every paragraph but the one being written*, to nobody: it was written by
nothing and read by nothing, an orphan of the deleted right-hand rail. Three
things are load-bearing:

- **Nothing is closed.** `panelOpen` and `tab` are left alone, so leaving puts
  the writer in front of the panel they left.
- **It is stored, not component state.** Moving between chapters remounts the
  editor, and a mode that fell out every time you turned a page would not be
  one.
- **The way out is always drawn**, never on a hover or a timer. A hidden way out
  of a mode that hid everything else is the trap the mode is worth avoiding.

**The two rules from the open chapter's card run *between* the panel and the
paper**, and the stack is exact: the panel at 40, the rules at 41, the sheet at
42, the rail at 45. At the panel's own 40 they lay across the writing — a body
portal beats a static manuscript column on document order whatever the number
says. Dropped below the page they went under the panel too, hiding the first
inch of the run, so they appeared to come out from under the panel rather than
out of the card. `.pageflow` takes `z-index: auto` back in continuous layout,
where the panel is a full-screen overlay and paper above it would show through,
and the rules are not drawn there at all — a pair pointing at a sheet nobody can
see is the diagram of nothing `connectToPage` exists to prevent.

**They stop easing once they have arrived**, and that is the fast-zoom fix. The
700ms travel is the entrance; left on, it applied to every later width too, so
while a gesture moved the page the measurement followed frame by frame and the
drawing trailed two-thirds of a second behind — the pair stretched off the
paper's edge and floated. A rule that has arrived is not animating anywhere; it
is stuck to the page.

**The editor** (`src/components/editor/chapter-editor.tsx`) is Tiptap. **The
surface is keyed on `${chapterId}:${reload}`, a counter rather than the stored
text**, and that counter moves only for a write from *another* tab — so a save
elsewhere reloads the surface while this tab's own autosaves never remount it
mid-keystroke. Keying it on the text, which this once said, remounts on every
save and takes the caret with it. Autosave is `src/lib/use-autosave.ts`; body is
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
over the bar at the top of the window rather than turning round. That is why it
is **portalled to the body and fixed** — it has to paint above that bar, and a
`z-index` on a descendant of the editor cannot escape the stacking contexts
between it and the top, which is what put its first rows behind the bar. Same
reason the tools card is portalled; same consequence, that it shuts
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
file picker in the Page & type card is the only way in. Worth building; it is not
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

**The left chrome is one slot, `--sidebar-width` wide, and the page stands
beside it.** At most one thing in the slot is visible at a time: the book
navigator, a tool panel, or a tool panel over the navigator. `BookPanel` takes
that width outright. `LeftPanel` stays `fixed` — it wants the window's full
height, its slide from the rail's own edge, and the phone's scrim, none of
which survive being a flex item — so `.oc-panel-slot` in `chapter-editor.tsx`
stands in for it in the row, and **only when the navigator is not already
holding that width**, or the page would be pushed twice. The slot stands down
below `md` and in continuous layout, where the panel is a modal over the page
rather than a neighbour, and a 25rem gap would push the writing off a phone.

**This reverses the rule that stood here before**, which was worth its keep for
a while and then stopped being: *the tool panel floats over the manuscript; it
does not push it.* The panel had been a static column at `md` and up, so
opening Search slid the panel, the sheet and the right rail 15rem across and
back — the sentence being read moved under the eye and the paragraph re-wrapped
at a new measure. Going `fixed` fixed that and bought a worse problem as the
panel grew: at 25rem a floating panel does not sit *beside* a 6×9 page, it lies
across it, covering the left margin and the first character of every line. A
writer searching their book could not see the book. The slot is the third
answer and keeps both halves — the page moves once, by exactly the panel's own
width, and the measure is whatever is left rather than whatever is not covered.

**The navigator stays open behind an open tool panel**, so dismissing the panel
puts the writer back where they were rather than on a bare page. Two things
follow from its being open but not visible. The rail lights whichever is on
screen (`toolPanelOpen` in `workspace-rail.tsx`) — a rail lighting Manuscript
*and* Find & replace is a rail claiming the writer is in two places — and
pressing Manuscript while something covers it closes the cover rather than the
navigator, because a plain toggle on a flag that is already true shuts the one
thing the press was asking to see. The connector rules go the same way:
`connectToPage` is false while a panel is over the navigator, or they carry on
running out from behind it, past the panel, pointing at a card nobody can see.

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
That last one is what a panel owes the page beside it: it is consulted and
dismissed, and the dismissal should be the gesture you were making anyway.
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
must never sit where the eye has learned to find something else. **Page & type
is its own group between those two**, because it is the one tab that changes the
*book* rather than reporting on it: everything above reads the manuscript back
to the writer, and this sets the type it is read in.

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
`createMatterPage` makes one and `deleteChapter`/`renameChapter` already did
the rest. Three things in there are load-bearing:

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
  `src/lib/matter-list.ts` reads the same arithmetic back out for the panel, so
  an off row sits exactly where its page would appear if it were switched on.
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
  most books have are marked `usual`. The marker is deliberately a label
  rather than two groups behind a disclosure: hiding thirteen real choices
  behind a click to fix a problem of *framing* is the wrong trade on a list
  this short. `usual` used to split the panel's Add-page menu the same way; the
  panel lists all sixteen now and has no menu to split.

**The panel is a list of divisions with a switch on each, not a list of
pages.** It listed only the pages a book *had* until 2026-08-26, and reached
the other fourteen through an **Add page** dropdown split by `usual` — so the
card could not answer the question it exists to answer: a writer looking at
three rows had no way to tell whether their book was missing a copyright page
or had never been offered one. Every division is a row now, on when the page
exists. Three things about it:

- **Switching on is `createMatterPage` and switching off is `deleteChapter`**,
  which is a soft delete into the book's trash. There is no stored "included"
  flag and there must not be one — `matter.ts` sets out why a field on the
  chapter is the wrong mechanism for this family of question, and a flag here
  would need a Postgres column, a `sync.ts` fallback, and a filter threaded
  through all four renderers to disagree about. A page either exists or it
  does not, which is a thing the panel could already say.
- **Switching off asks only when there is something to lose.** A page
  `isDraftMatter` calls scaffolding goes without a dialog — the export leaves
  it out for the same reason and the trash has it either way — and a page the
  writer has written on gets the row menu's own confirmation. The rule a
  writer can see on the row (the *Draft* mark) is the rule that decides.
- **Switching on does not navigate**, where Add page did. A writer sets up the
  front of a book four or five switches at a time, and opening each new page
  would remount the editor under them four or five times.

`src/lib/matter-list.ts` is the merge, and it is pure because the ordering is
the part that is easy to get wrong: **a page the book has is never reordered**.
Sorting the whole card into catalogue order reads beautifully and is a lie for
half the book, since `bindBook` sorts the *front* matter by `matterSectionIndex`
and leaves the back in the writer's stored sequence — so a back-matter page
that arrived out of order would sit in one place on this card and in another in
the finished file. Only the off rows are placed, and they are placed by the
arithmetic `createMatterPages` uses, so a row does not move when it is pressed.

**"Add your own page" survives as the last row.** Nothing on a catalogue can
express a page nobody has named yet, and it was the Add-page menu's
"Something else…"; a row rather than a header button, because it is the end of
the list it adds to rather than a peer of "Hide pages".

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


