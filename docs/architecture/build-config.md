# next.config.ts — why each of its four entries exists

Read before editing `next.config.ts`. Every entry was paid for; none of it is boilerplate.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

**`next.config.ts` is load-bearing, not boilerplate**, and every one of its four
entries was paid for. Read the comments in the file before touching it; the
short version:

- **`turbopack.resolveAlias.pagedjs`** points at `dist/paged.esm.js`, found via
  the package's own entry rather than by path (its `exports` map refuses a deep
  import). Without it Paged.js pulls in `es5-ext` shims that die under bundling
  with `TypeError: contains.call is not a function`, thrown at the first
  `preview()` — a PDF export that produces nothing, and nothing the compiler
  could have caught. It throws at boot if the file moves, rather than aliasing
  quietly to nothing.
- **`env.OC_PAGEDJS_DIST` + `outputFileTracingIncludes`** are the *server* half:
  `/api/export/pdf` reads the polyfill off disk as text, so a tracer that only
  packs what it can see would leave it absent in production and drop every PDF
  export onto the print-dialog fallback.
- **There is no `webpack` hook and one must not be added.** Next 16 builds with
  Turbopack, and a webpack config changes how the whole graph resolves rather
  than adding an alias to a second bundler — with one present, `/read`,
  `/chapter/[chapterId]` and `/roadmap` all began answering 404 while every
  other route was fine.
- **`images.qualities` is required in Next 16.** It defaults to `[75]` and
  anything else is *refused rather than honoured* — silently, with no error and
  no warning, the optimizer falling back to the nearest allowed value. A
  `quality={95}` on a component simply did nothing. Add a value here only with a
  call site that needs it.


