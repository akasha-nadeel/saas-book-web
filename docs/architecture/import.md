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


