# Export: front matter, the block IR, EPUB, PDF, Word, the wizard, and covers

Read before touching `src/lib/export/`, `/api/export/pdf`, `export-page.tsx`, `front-matter.ts`, `typeset.ts`, `epub.ts`, `cover-save.ts`, or `publishing.ts`.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

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

**The contents page is the one exception, and it goes the other way**
(`REPLACED_BY_DEFAULT`, since 2026-08-18). The rule above rests on ours being a
*fallback assembled from fields* — true of a title page and a copyright page,
and false here: our contents is built from the book's own chapter list, carries
an `<a href>` to every one of them, and in print carries a folio
`target-counter` resolves against the page the chapter really lands on. A
written one carries text, and is stale the moment a chapter is renamed or
moved — silently. It was found in a real export: a manuscript imported from
Word brought its own "Table of contents", ours stood down, and the file shipped
with a contents nobody could tap, which is the one thing a shop's navigation
guidance asks for by name. So `DEFAULT_TYPESET.replaceWritten` seeds
`contents`, which means the switch below shows it as replaced and turning that
switch off hands the writer their own page back. Nothing is deleted either way.

**The writer can overrule that default, and `withoutReplaced` is the whole of
it.** The switch on the export's front-matter step means *generate this* while
there is no page of their own and **replace mine with yours** once there is — a
different question, so it is stored in a different place
(`typeset.replaceWritten`) and reads **off** to begin with for the two pages
above, since theirs is what the file uses. Three things hold it. **Only the surprising direction asks**:
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

**The same bug survived one floor down until 2026-08-18: the file navigated in
a different order from the one it read in.** `spineOrder` bound the book;
`listedChapters` — which is the whole of `nav.xhtml` and `toc.ncx` — walked the
*loaded* array and never bound it. Two functions, one question, two answers, so
an exported book's contents pointed through it in an order the spine does not
go: measured on a real export, a spine of `01, 05, 12, 02, 03…` against a nav
of `04, 07, 08, 10, 11…`. Amazon's navigation guidance names that one by
itself. It needs no duplicates — any book whose front matter is not *already*
in binding order gets two answers, because binding is what puts it in that
order. `listedChapters` takes the generated ids and binds first now, and a test
asserts the nav is the spine's own subsequence.

**EPUBCheck had been saying so all along, and the note below saying "0 errors
and 0 warnings" had gone stale.** Run on the export that turned this up, 5.3.0
reports three of `WARNING(NAV-011): "toc" nav must be in reading order; link
target … is before the previous link's target in spine order` — and none on the
same book after the fix. The claim was true when it was written and stopped
being true when front matter became a list of pages a writer can hold several
of. Re-run it rather than trusting the sentence.

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


**Import, export and the reading view share a format-neutral block IR**
(`Block`/`Run` in `src/lib/export/blocks.ts`). A Tiptap doc is walked once into
blocks, then each renderer consumes them — the tricky parts (marks, nesting, hard
breaks) live in one tested place. Heavy libraries (`docx`, `jszip`) are
dynamically imported so a writer who never exports never downloads them.
- Export: `src/lib/export/` — markdown, docx, epub, and PDF rendered by a real
  browser on the server (`/api/export/pdf`, driven from `print.ts`, whose
  standalone document is the pure, tested `pdf-html.ts`). `index.ts`
  orchestrates; `xhtml.ts` is the shared XHTML renderer behind epub, PDF and the
  reader; `typeset.ts` controls the look of the outputs that are ours;
  `front-matter.ts` generates the title/copyright/contents pages and holds
  `bindBook`, the binding order all four read; `epub-images.ts` and
  `docx-images.ts` are each format's answer to a picture — the Word file
  packaged the italic words `[image]` until 2026-08-17, which is a manuscript
  reaching an agent without its illustrations.

  **Inline size and face were the same drift and were fixed on 2026-08-18.**
  Both reached the reading view, the EPUB and the PDF; neither reached the Word
  file, because `runsFor` read bold/italic/strike/underline and nothing else. So
  a passage a writer had set larger, or in another face, came back from Word
  looking like every other paragraph — silently, in the one format an agent asks
  for, and `font-family.ts` had recorded the gap in its own header for months.
  Two details are load-bearing. `Run` carries **both forms** of the size, the
  CSS string for the renderers that have a stylesheet and `sizeMultiple` for the
  one that does not, because re-parsing the string a line after building it is
  reading back your own output. And the multiple is taken against **the
  document's** 12pt body (`SIZE_HALF_POINTS`) rather than the book's editor
  setting: a `.docx` carries none of our typography, so a run set at one and a
  half times the body must be one and a half times *that* or it disagrees with
  the paragraph around it. `docxFontName` is the other join — CSS takes a whole
  stack and Word names one font per run, so it takes the first real name,
  stepping over generic families and over a `var()` that resolves to a webfont
  no word processor can fetch.

  **`consistency.test.ts` is the suite that holds the four to one answer**, and
  it belongs on the list of tests not to "fix": every renderer had its own
  passing tests and each was right about *itself*, while nothing asked whether
  they agreed — and they did not, about binding order and about chapter
  openers. It compares the formats against each other rather than against a
  fixed string, so a change is welcome to move the order and may not move it in
  one place only. Nothing in it asserts a *look*, because a PDF has pages and an
  EPUB reflows.

  **Markdown is built, tested and reachable from nothing** — `soon: true` on its
  card in `export-page.tsx`, which opens `ComingSoonDialog` instead of
  exporting, since **2026-08-16**. The text half is right; what is not done is a
  book with a picture in it, which `blocksToMarkdown` writes as a base64 `data:`
  URL that GitHub and many parsers refuse outright. It comes back as a plain
  `.md` for a book with no pictures and a zip of `book.md` plus `images/` for
  one with them — `epub-images.ts` already does the hard half. **Every "four
  formats" claim comes back in the same commit**; the pricing page says "All
  three exports" today, and TODO.md records the rest.

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

  **That rule covered one declaration out of five until 2026-08-18, and the
  other four were doing the same harm.** `size()` moved the *size* off an
  EPUB's body and stopped there, leaving `font-family`, `line-height` and
  `margin: 1em` stated on the root of a reflowable book — each overriding a
  control the reader has in their own menu, which is precisely what the KDP
  sentence quoted above forbids. An exported book arrived in Times New Roman,
  double-spaced, with a margin of its own, whatever the device was set to. All
  three are print-only now; the EPUB's body states `font-size: 100%`,
  `text-align: justify` and `hyphens: auto` and nothing else. **Headings keep
  everything** — a heading is the book's own voice rather than body text, so
  its face, its `em` size and its centring take no reader setting away. The
  test that used to *require* a `line-height` here now forbids one: it rested
  on Apple's "set the value to a unit-less multiple of the font-size", which is
  a rule about how to express a leading if you state one, not an instruction to
  state one.

  **The Manuscript template is not offered for an EPUB** (`templatesFor`), and
  that is what actually produced the double-spaced file above. Standard
  manuscript format is a specification an agent asks for — Times, double
  spaced, wide margins so a reader with a pencil has room — and a reflowable
  book has no paper and no margin to write in. `bookSetting` already refused to
  *resize* that template for the same reason; this says where it applies at
  all. Hiding a radio does not change the value behind it, so `templateFor`
  resolves the choice as well: a writer who sets Manuscript for a PDF and
  switches to EPUB gets the default back rather than a template the list no
  longer shows.

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
    pick; the book does not, and every format binds the same pages in the same
    order.
  - **It shows the book this export will build, and for its first day it showed
    the manuscript instead.** It was mounted as `<BookPages book cover />` —
    neither the wizard's `typeset` nor `setting="export"` — so the three
    front-matter switches, the "ours, not yours" toggles, the trim and the
    template all changed nothing on it, and it printed a heading over apparatus
    that no exporter writes. Its deck meanwhile read *"at the trim and
    typography you have set"*, which was a claim the code could not back: the
    sheets came from the book's page setup and the prose from the book's own
    face. Both props are passed now and the deck names the front matter too. See
    the reading-view note above for the mechanism, and `bound-pages.ts` for the
    rule that the order is never worked out twice. What it still cannot claim is
    the packaged file — the EPUB's manifest, a `.docx`'s styles, the PDF's
    running heads — which is exactly what the panes were for.
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

**`image/webp` was in that core list for most of this app's life, and it does
not belong there.** EPUB 3 names four image types a reading system must
understand — GIF, JPEG, PNG, SVG — and the editor stores every inline picture
as WebP, so every illustration in every exported book was packaged as a foreign
resource with no fallback. It was found by opening a real export in a real
reader on **2026-08-17**: the JPEG cover drew and all four illustrations were
blank, and the manifest read `media-type="image/webp"` four times. Nothing was
missing from the zip — the reader was simply entitled to ignore what was in it.

`src/lib/export/image-recode.ts` is the fix, and three things about it are
load-bearing:

- **It converts at export, not at import.** Changing what the editor stores
  would only help pictures added afterwards; every manuscript written before
  today would go on exporting blank illustrations. The manuscript keeps WebP,
  because a third off every picture matters inside a shared browser origin and
  does not matter inside a zip downloaded once.
- **PNG when the source has any alpha, JPEG otherwise**, decided by reading the
  pixels rather than guessing: JPEG has no alpha channel, so a logo on a
  transparent ground would come out on a black box, and PNG multiplies a
  photograph's size for nothing. Any failure to read them answers "has alpha",
  since a larger file beats a ruined picture. Re-encoded at 0.92 rather than
  the editor's 0.82 — this is already lossy once, and twice at the same setting
  is where it shows.
- **Every failure returns the picture untouched, and `loadDataUrl` has a
  timeout.** Untouched means `packageable` refuses it and the readiness check
  counts it, which is the path this app already takes. The timeout is not about
  patience — a data URL is bytes in hand — but about an `Image` that fires
  neither `load` nor `error` leaving `buildEpub` pending for ever, which is the
  writer losing the book rather than one picture.

**That split `packageable` in two, and the difference is a step in time.**
`packageable` asks what can be zipped *as it stands* — the packager's question,
once recoding has run. **`carriable`** asks what will reach the reader after
conversion, which is the pre-upload check's question, since it runs before it.
Ask the strict one there and every picture in every book is reported as lost.
`RECODABLE_TYPES` holds one entry on purpose: the recoder *attempts* anything
the browser can decode, but the check promises only WebP, because that is a
fact about our own code rather than a hope about the browser's. The check
under-promises and the export over-delivers; the other way round is a writer
told their pictures are fine and finding gaps in the file.

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
breaking the export. **Covers are JPEG, inline images are stored as WebP and
converted on the way out** — the size saving matters inside a manuscript and
not inside a zip downloaded once, while a cover is the one image a shop's
converter meets first and KDP is not a safe bet for WebP; `importImage` takes
an `encode` option, and `originalImage` keeps the writer's own bytes untouched
when they are already JPEG or PNG. That sentence read "inline images stay
WebP … and no shop has objected" until **2026-08-17**, and the second half was
wrong in a way nobody had checked: see the EPUB note below, where a real
reader drew the JPEG cover and left all four illustrations blank. And **it does
not sync** — `sync.ts` carries the thumbnail and knows nothing about this
store, so a writer on a second machine exports at thumbnail quality until they
upload the artwork again. The covers tool says so; don't quietly drop that line.
`clearLocalLibrary` clears it too, or the second writer on a shared browser
exports the first one's picture.


