# What is tested, and which tests must not be "fixed"

Read before writing or changing tests, and before touching a suite that goes red.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

Tests live beside their subjects as `*.test.ts` and concentrate on the pure
logic: the import/export pipelines (including the XHTML and front-matter
renderers), the store — twice over, once on `localStorage` and once on
IndexedDB, see `store-db.test.ts` —
page setup, typography, search, book kinds, the custom
Tiptap marks, pagination, click-to-type and image-resize arithmetic (the last
of these being where the zoom correction a drag needs is held still), the reading view's bound
page list (`reader/bound-pages.ts`, which is how the export wizard's Preview and
the file are held to one answer), caret scrolling,
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
`export/consistency.test.ts` is the same idea across files rather than inside
one — it asserts that all four renderers bind the same pages in the same order
with the same chapter openers, and it is the suite that would have caught the
drift nothing else was shaped to see.

`docs/plans/` holds the design and implementation notes for the bigger pieces
(the bookshelf, export, and the Supabase persistence design). They record what
was decided and why, and are worth reading before reworking any of them.


