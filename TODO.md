# OpenChapter — what's next

Last updated 2026-07-22. Ordered roughly by value, not by effort.

## Announced but not built

These have UI on screen that says "Coming soon". They are promises now, so they
should either ship or lose the card.

- [ ] **Audiobook: text → audio.** Card on `/book/[bookId]/export`. Needs a TTS
      service — a server and a running bill. Decide hosted vs. browser
      `speechSynthesis` (free, robotic, cannot be exported to a file).
- [ ] **Audiobook: audio → text.** Card on `/book/import`. Needs a speech model;
      same server/bill question. Transcription then has to be split into
      chapters, which the existing `src/lib/import/split.ts` can do.

## Export

- [ ] **Previous exports.** The reference has a history tab. Would need export
      records in storage: format, options, timestamp. Cheap and genuinely
      useful — a writer wants to know what they last sent an agent.
- [ ] **Endnotes.** The reference offers "at end of page / end of book". We have
      no endnote feature at all, so this is two jobs: notes in the editor, then
      placement at export.
- [ ] **Real print-ready PDF.** Current PDF is the browser's print engine: no
      bleed, no crop marks, no CMYK, and the page says so. A true printer's file
      needs a real PDF library and is a project of its own.

## Storage — the ceiling is close

- [ ] **Supabase persistence + auth.** Deferred three times. Everything touching
      storage is in `src/lib/library-store.ts`, so the swap is one module plus
      its React bindings. Auth has to land with it (rows need an owner for RLS).
- [ ] **Storage pressure.** localStorage is ~5MB per origin. Covers are capped at
      250KB each and inline images at 900KB, but a library of illustrated books
      will hit the wall. There is no usage indicator and no warning before a
      write fails. `createBookFromImport` and `setCover` already fail cleanly;
      nothing tells the writer they are running out.

## Editor

- [x] **Front/back matter.** Back, as a flat tag rather than the old drill-down.
      A chapter's ⋯ menu moves it to front matter, the body, or back matter; the
      list stays one sequence with a quiet label per part, only body chapters are
      numbered, and export lays out front → body → back. The old sectioned
      version (drill-down, per-part drop strips) stays cut — see `207f805`.
      *Phase 2 (done):* the export dialog generates a title page, copyright page,
      and contents list for EPUB and PDF, and front/back matter is set unnumbered
      (only body chapters carry a numeral). *Left:* the same generated pages for
      DOCX/Markdown if wanted, and real page numbers in the print contents (the
      browser print engine cannot produce them).
- [ ] **Search across a book.** Nothing searches chapter text; the shelf search
      only matches titles.
- [ ] **Per-chapter status and synopsis.** Offered early, never chosen.

## Known rough edges

- [ ] Chapter row numbers are positions, so a row can read "2" beside a chapter
      titled "Chapter 3" after a delete. Deliberate — the number is a position
      and the title is a name — but worth revisiting if it confuses anyone.
- [ ] Import cannot read `.doc`, `.pdf` or `.rtf`. The first two are refused by
      name with what to do instead; `.rtf` is just absent.
- [ ] The assistant needs `ANTHROPIC_API_KEY`. Without it `/api/chat` returns 501
      with a message saying so.

## House rules

- A control either works or says plainly that it is not built. No copied chrome.
- Verify Tailwind v4 output against the built CSS in `.next/static/chunks/*.css`
  — it silently drops utilities it cannot parse.
- Standalone pages need `h-dvh overflow-y-auto`; `<body>` is `overflow-hidden`
  for the editor shell, so `min-h-dvh` puts content out of reach.
