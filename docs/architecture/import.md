# Import: formats, structure detection, and file metadata

Read before touching `src/lib/import/`, `split.ts`, `metadata.ts`, `cover.ts`, or the three import screens.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

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

  **Every other format is read for its structure instead, as of 2026-08-18.**
  A `.docx`, a `.md`, a `.txt` and an HTML file declare nothing, so until then
  every heading in them became a body chapter: a manuscript opening with a
  half-title, a title page, a copyright page, a dedication and an epigraph
  arrived as five chapters of a novel that has none, with the acknowledgements
  and the glossary at the far end as two more. `taggedByName` in
  `import/index.ts` reads each chapter's title through **`matterPartOf`** in
  `matter.ts`, which matches against the catalogue's own titles plus a short
  `MATTER_ALIASES` table — "Preface" and "Contents" and the American
  "Acknowledgments" are what a manuscript actually writes where the catalogue
  names a slot. Four things about it:

  - **A table, never a heuristic**, the posture `series.ts` takes for merging
    characters and for the same reason: a rule loose enough to catch every way
    of writing "Preface" is loose enough to decide somebody's chapter called
    "Prologue to a Murder" is apparatus and take it out of their book. Null —
    *this is a chapter* — is the important answer and the common one.
  - **The page takes the catalogue's spelling, not the manuscript's.** A Word
    file shouts its headings, so `HALF-TITLE PAGE` first came in under exactly
    that name and sat in the panel beside the app's own `Half-title page` as a
    second, unrelated row — one division showing as two, in two different
    cases, with nothing matching on name able to see they were the same. The
    EPUB path had always canonicalised (`DIVISION_TITLES`), so the same book
    imported as a `.docx` and as an `.epub` produced differently-named pages.
    `matterDivisionOf` returns the part *and* the name; `matterPartOf` is the
    thin wrapper for callers with no use for the second.
  - **Position is deliberately not consulted.** Every name in that table belongs
    at one end of a book by the convention of the trade, which is why it is in
    the table. Requiring an unbroken run from each end was considered and is
    worse: one stray heading after the last real page (a bare "The End") would
    silently strand every back-matter page before it in the body.
  - **It runs only on the branch that has no declaration.** Applying it to the
    EPUB path would be second-guessing a file that has already said.
  - **Nothing below it changed** in `createBookFromImport`, which has carried
    `ImportedChapter.matter` since the EPUB importer was written and already
    groups the chapters front → body → back. **`importIntoBook` did need
    changing**, and it is the one consequence worth knowing: a division the
    book already has is now dropped from an import rather than added. Front and
    back matter are a set of *named* pages — a book has one dedication, and two
    rows called "Epilogue" say nothing an exporter could act on — where a body
    chapter may legitimately repeat and is renumbered instead. Both modes need
    it: `add` appends everything, and `replace` deliberately *keeps* the
    writer's existing matter while clearing the body, so incoming pages would
    have landed on top of the ones it had just spared. Before the importer read
    headings this could not arise, because only an EPUB declared matter pages,
    so re-importing a `.docx` duplicated chapters and nothing else.

    **That rule is `newInImport` in `library-store.ts`, and it is exported
    because a screen has to ask it before the writer chooses.** It answers the
    same for `add` and for `replace` — replace spares every matter page, so the
    set being compared against is identical either way — and *that* is what
    makes it askable in advance. Three things read it now: the import itself,
    the add-or-replace dialog, and the banner, so all three describe one set of
    pages. Inlined, it produced two faults at once. A file whose every page the
    book already had left `importIntoBook` with nothing to add, fell through its
    single `null` return beside a real storage failure, and was reported as
    *"the book may be too large for this browser's storage"* — the wrong cause,
    blaming the browser, sending a writer to free space they did not need. And
    the banner counted the pages the writer had handed over rather than the ones
    that landed, so a re-import of eight duplicate back pages announced all
    eight.

  **The add-or-replace question counts in the two units the book is made of, and
  is not always asked.** `ImportModeDialog` took one number per side and called
  both "chapters": the book's was body chapters — right, but silently so, beside
  a panel showing eight back-matter pages it did not count — and the file's was
  everything in the file, matter included. So a file of eight back-matter pages
  was announced as *"8 chapters"* and offered to be numbered on from Chapter 11,
  for pages that are named and never numbered. Both sides are an `ImportSummary`
  now, phrased by `summaryPhrase` in `split.ts` — the same function the banner
  prints — so the two screens cannot describe one file differently.
  `importAsksFirst` is the other half: the question needs writing worth
  protecting **and** body chapters in the file, because Replace can only act on
  the body. A file carrying no chapters used to raise it anyway and both answers
  were nonsense. Nothing is lost by not asking — duplicate pages are dropped on
  the way in and the banner still offers Undo.

  **And "Replace everything" never replaced everything.** It spares all front
  and back matter by design; the heading was frightening in a way the behaviour
  was not, which is its own kind of untrue. It reads "Replace my chapters" and
  says what it keeps.

  **A file can now say which part of the book it is**, because a finished book
  is often three files rather than one. Each of the panel's three cards carries
  its own import (`section-import.tsx`, one component mounted three times — the
  whole flow in one place, because three copies of a decision that must agree is
  the lesson the two whole-book doors already taught). Four things follow from
  the writer naming a part, and the fourth is the one worth arguing about:

  - **`importIntoBook` takes `replacing`**, so `replace` clears that part rather
    than always the body. `startNumber` resets only when the body is what is
    going, or a back-matter import would renumber the chapters from one.
  - **`newInImport` takes it too, and its old claim had to be withdrawn.** It
    used to state that the answer does not depend on add-or-replace — true while
    replace always spared every matter page, and that is what let
    `ImportModeDialog` say what would happen before the writer chose. A scoped
    replace breaks it: the pages of the part being cleared are not duplicates.
    Only a `replace` passes it through; passing it in `add` would let a section
    import double every page it was asked to leave alone.
  - **`partOfImport` decides what is used**, and everything else is *named*
    rather than dropped. A manuscript aimed at the Back matter card lands
    nothing and says why — the same rule as the export screen naming the pages
    it leaves out.
  - **The divider vocabulary widens, and only for a named part.**
    `CHAPTER_LINE` is closed — chapter, part, book, prologue, epilogue,
    interlude — and has to be, because it runs on files nobody has said anything
    about. The cost shows the moment somebody has: a back-matter document with
    no heading styles splits *once*, at "Epilogue", and the other seven
    divisions arrive buried inside it. `looksLikeMatterLine` adds that part's own
    page names, and `matterDivisionInPart` takes two liberties `matterDivisionOf`
    must never take — it strips a trailing `: subtitle`, and it answers for one
    part only. Both are earned by the declaration and neither is safe without
    it: the subtitle tolerance applied generally is what takes a chapter called
    "Prologue: the night before" out of somebody's novel, and there is a test
    asserting `matterDivisionOf` still answers null for exactly that.

  The repair for a book imported *before* this is the page ⋯ menu's **Move to
  front matter / the body / back matter**, wired in `book-panel.tsx` on the same
  day over `setChapterMatter` — which had been written and tested with no caller
  anywhere, so a page in the wrong part could previously only be deleted and
  typed again.

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


