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

- [x] **Auth.** Supabase email/password, done as its own step ahead of the
      storage move. `src/proxy.ts` refreshes the session and holds the sign-in
      wall; `src/lib/supabase/` has the three clients; sign-in, sign-up and
      sign-out are Server Actions in `src/app/auth/actions.ts`, so the cookie
      and the redirect arrive in one response. Both env vars unset means no
      accounts at all and no wall — the app runs local-only as it always has,
      the same shape as the assistant's missing API key.
- [ ] **Supabase persistence.** The half that is left, and the one that matters:
      a signed-in writer still reads and writes `localStorage`, so the account
      identifies them but does not carry their books. Two people signing in on
      one browser see the same shelf. Everything touching storage is in
      `src/lib/library-store.ts`, so the swap is that one module plus its React
      bindings — and rows now have an owner to hang RLS on.
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
- [x] **Search across a book.** The editor's Search tab (⌘K) reads every
      chapter's text — walked out of the Tiptap JSON in `src/lib/search.ts` —
      matches title and prose, and shows a snippet that jumps to the chapter.
      *Left, if wanted:* a whole-library search, and jumping to the exact match
      inside the chapter (it opens the chapter, not the line).
- [ ] **Per-chapter status and synopsis.** Offered early, never chosen.

## Known rough edges

- [ ] Chapter row numbers are positions, so a row can read "2" beside a chapter
      titled "Chapter 3" after a delete. Deliberate — the number is a position
      and the title is a name — but worth revisiting if it confuses anyone.
- [ ] Import cannot read `.doc`, `.pdf` or `.rtf`. The first two are refused by
      name with what to do instead; `.rtf` is just absent.
- [ ] The assistant needs `ANTHROPIC_API_KEY`. Without it `/api/chat` returns 501
      with a message saying so. With accounts configured it also needs a
      session — the route checks for itself and returns 401, because the proxy
      skips `/api` (redirecting a fetch to an HTML page is not a 401).
- [ ] Sign-out is only reachable from the shelf's account chip. A writer deep in
      a chapter goes back to the shelf first. Fine while the shelf is one click
      away; revisit if the rail grows an account row.

## House rules

- A control either works or says plainly that it is not built. No copied chrome.
- Verify Tailwind v4 output against the built CSS in `.next/static/chunks/*.css`
  — it silently drops utilities it cannot parse.
- Standalone pages need `h-dvh overflow-y-auto`; `<body>` is `overflow-hidden`
  for the editor shell, so `min-h-dvh` puts content out of reach.
