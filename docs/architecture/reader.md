# The reading view and page flow

Read before touching `src/components/reader/`, `src/lib/reader/`, `page-flow.ts`, `bound-pages.ts`, `page-breaks.ts`, or the export wizard's Preview step.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

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

**It shows the book the *export* would build, and `boundReaderPages`
(`src/lib/reader/bound-pages.ts`) is the whole of that.** Until **2026-08-17**
it walked `orderedChapters(book)` and stopped, so four things every exporter
does were invisible on the one screen that exists to show the file: the
generated title page, copyright page and contents were never built, the "ours,
not yours" switches were never applied, `bindBook`'s order was never used, and
apparatus was headed with its own name — a sheet reading "Copyright page",
which no published book has. A writer who pressed *ours* on the contents step
walked one station to Preview and found their own page still on the sheet. That
module calls `withoutReplaced → frontSections → bindBook`, the export's own
functions in the export's own order; **anything that looks like a rule about
which pages go in, or in what order, belongs in `front-matter.ts` with the other
four renderers and not here.** Three consequences worth knowing:

- **The export's filters take the fields rather than the type** (`MatterPage`,
  `ListedPage`), which is what lets the reading view put pages that still carry
  a chapter **id** through the very same functions — `LoadedChapter`
  deliberately has none. `epub.ts` had already needed this and was writing
  `as unknown as readonly LoadedChapter[]` past it; that cast is gone. A second,
  reader-side copy of `withoutReplaced` is the thing this avoids, and it is the
  thing that module's own note exists to forbid.
- **`ReaderChapter` carries `heading` and `generated`, and nothing else may hang
  off them.** `heading` is `printsHeading`'s answer, so apparatus opens with no
  title; `generated` says only that the markup is a `<section>` taking the
  front-matter setting (`reader-front`, not `tiptap`) and that there is no
  chapter behind it to click into. The cost, accepted: a writer's own copyright
  page no longer has a heading to press in the read-through.
- **A generated page is laid out as its section's *children*, and a list among
  them is opened out into its items.** One element is one block and a block
  cannot be broken inside, so a contents page — which is one `<ol>` and nothing
  else — went on a single sheet however long it was, and `overflow: hidden` cut
  it off: the very defect `page-breaks.ts` was extracted to fix, reappearing on
  the pages this app writes itself. Measured on a 66-chapter book: the heading
  alone on one sheet, twenty-five entries on the next, forty absent. Splitting
  the `<ol>` by *line* was tried first and does not work — `.toc-line` is a flex
  row, so the line measuring returns nothing usable and the block moves whole
  again. Between entries is also the only place a contents page may break, since
  cutting one leaves a chapter's name on one sheet and its folio on the next.
  Each sheet is reassembled: runs of items into a clone of their list, the whole
  into a clone of the section, which is what keeps `front-page contents` on it.

**Two knobs on `BookPages`, and they are separate on purpose.** `typeset` says
which pages are bound in; `setting` says what the sheets are cut to.
`/book/[bookId]/read` takes `DEFAULT_TYPESET` and `setting="book"` — the
generated front matter, at the writer's own page setup in their own face, which
is what pairs the read-through with the writing surface. The export wizard's
Preview takes the wizard's state and `setting="export"`, so the trim, margins,
size and template face are the file's (`typesetMetrics` / `typesetVars` in
`typeset.ts`, derived from `bookSetting` so a preview cannot compute its own
page). Folding the two together would put `/read` on 6×9 in Classic for every
book, which is a claim about a file rather than a view of a manuscript.

**The sheets carry folios, and the contents lists real ones.** The number at the
foot of a page is `typesetCss`'s `@bottom-center` rule drawn in markup — same
count, since the PDF's first page is the first bound page too, and page one
takes none, matching `@page :first`. It sits in the sheet's own bottom margin
rather than in the text block, so a wider margin moves the number and not the
prose. The contents is the harder half and **`withFolios` is the whole of it**:
a printed contents gets its folios from `target-counter`, which Paged.js
resolves against real pages and no browser implements on screen, so the numbers
cannot be known until the book has been measured and cut — which is after the
contents page itself has been written. So `contentsPage` given no `href` emits
the leader with an **empty folio slot** carrying the chapter's *loaded* index
(`data-page-of`, the same index the print anchors use, because a bound order
must never renumber), the book is flattened, and the slots are filled. It does
not iterate: a folio sits on the line its leader already occupies, so filling
one changes no height and the layout that produced the number still stands. A
slot whose page cannot be resolved is **left empty rather than guessed at** — an
entry with no number reads as a gap, where a wrong number reads as a fact. The
two engines are not the same, so a long book's preview can differ from the PDF
by a page; both are measured rather than invented, and neither is claimed to be
the other. The generated pages are set by
the `.reader-front` block in `globals.css`, which is the reading view's half of
`typesetCss`'s front-matter block and is paired with it by comment at both ends:
it cannot simply import that sheet, because it must draw these pages in the
book's face on one screen and the template's on the other, so it sizes
everything off `--ms-size`.

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


