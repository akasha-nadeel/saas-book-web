# OpenChapter — what's next

Last updated 2026-07-29. Ordered roughly by value, not by effort.

## Built, but held back on purpose

Two of the shelf header's buttons open an "Available soon" dialog. **Neither
feature was deleted** — both are complete and still in the repo. Do not tidy
them away: pointing the button at its own dialog again in `bookshelf.tsx` is the
whole of switching either back on.

- **Templates** — `templates-dialog.tsx` + `book-templates.ts` (tested). Starts
  a book from a chapter skeleton. Held back pending a rethink of what the
  templates should be.
- **Background sound** — `ambience.ts` (tested), `use-ambience.ts`,
  `sounds-dialog.tsx`. Four scenes, a volume slider, keeps playing while the
  writer moves around the app.
  Held back for one reason: every scene is *synthesised* — filtered noise, not a
  recording. Rain, surf, wind and a flat hush are honest that way, but they are
  an impression of weather rather than the thing itself, and a café or a lo-fi
  bed cannot be made from noise at all.
  *What it needs:* real recordings. CC0 from Freesound is the clean licence for
  a commercial product — public domain, no attribution, and redistribution
  allowed, which matters because the files get served from a URL. Pixabay is
  free for commercial use but forbids redistributing sounds as-is, which is
  awkward when a CDN is doing exactly that; the BBC library is
  personal/educational only and cannot be used here at all.
  *Then:* host them in Supabase Storage rather than `public/` (a dozen loops is
  ~20MB on every deploy otherwise), crossfade two overlapping sources so files
  that were not cut as loops do not click at the seam, fetch on first play, and
  keep the synthesised scenes as the offline fallback.

## Announced but not built

These have UI on screen that says "Coming soon". They are promises now, so they
should either ship or lose the card.

- [x] **Audiobook: text → audio.** Done, and with it the last "Coming soon" card
      in the app. The export page's Audiobook card reads the book aloud and
      downloads a zip, one MP3 per chapter — that shape rather than one file
      because it is how audiobooks are listened to, and because it keeps the
      audio joins inside a chapter where the voice is unchanged.
      The work is the chunking (`narrate.ts`, tested): a speech model takes a
      few thousand characters, so the text is cut at the largest boundary that
      fits — paragraph, then sentence, then word, never mid-word, because a
      break mid-clause is audible. Markdown is stripped first or the narrator
      reads the syntax aloud.
      *Needs `AI_GATEWAY_API_KEY`*, same key as the transcriber; 501 without it.
      *Left:* one voice (`onyx`) with no way to choose another, and no way to
      stop a run once it has started.
- [x] **Audiobook: audio → text.** Done. The Audiobook button in the shelf
      header opens a picker; `/api/transcribe` sends the file to a transcription
      model through the Vercel AI Gateway, and the transcript then takes the
      *existing* import path — `parseText` → `splitIntoChapters` →
      `createBookFromImport` — so it lands as an ordinary book. A spoken
      "Chapter Four" is just a paragraph to the splitter, which already
      recognises those lines.
      *Needs `AI_GATEWAY_API_KEY`;* without it the route answers 501 with a
      message, as `/api/chat` does. Billed per minute of audio. Capped at 25MB,
      which is the transcriber's limit rather than ours.
      *Left:* recordings longer than 25MB have to be split by hand first —
      chunking on the client and stitching the transcripts would lift that.

## Export

- [x] **Store-ready EPUB.** Done 2026-07-30, and **verified with EPUBCheck 5.3
      (EPUB 3.3): 0 errors, 0 warnings**, on both a fully-specified book (cover,
      ISBN, series, images with and without alt text, marks, lists, blockquote,
      generated front matter) and a bare one with nothing filled in. Worth
      re-running after any change to `epub.ts`; the unit tests check our strings,
      not the spec. Grab it from the w3c/epubcheck releases and
      `java -jar epubcheck.jar book.epub`.
      What was actually missing: the cover was never embedded at all, metadata
      was three fields, and the identifier was re-randomised on every export — so
      a corrected upload read as a second, unrelated title rather than a new
      edition. Now: the cover is embedded and declared under both the
      EPUB 3 and the legacy hook with a cover page first in the spine; the
      identifier is derived from the book id instead of being minted fresh each
      export (a random one made a corrected file read as a different title);
      full `dc:` metadata, `marc:relators` role and file-as sort form, a
      `belongs-to-collection` series, `schema:access*` accessibility metadata
      written from what the book actually contains, `lang`/`xml:lang` on every
      document, nav landmarks, and a `toc.ncx` fallback for the older ingestion
      paths some shops still run.
      `src/lib/publishing.ts` holds the listing details as `Book.publishing`
      (jsonb column, migration `20260730000000`), and `storeReadiness()` reports
      what would stop a shop taking the file — it never disables the export.
      `epub-images.ts` moves inline images out of their `data:` URLs into real
      package entries. This is a *size* fix, not a validity one — a `data:` src
      passes EPUBCheck; it was checked. base64 is a third larger than the bytes,
      compresses badly inside XHTML, and is copied in full at every use, so a
      repeated scene-break ornament was one copy per chapter.
      *Left:* the EPUBCheck run is manual — in CI it would catch a regression the
      unit tests cannot; the categories field takes free text rather than a real
      BISAC picker; and the readiness check walks the whole book on the export
      screen, fine at 40 chapters and wanting memoising past that.
      *Unverified:* whether KDP's or Apple's own converters are stricter than
      EPUBCheck anywhere. Nothing here assumes they are.

- [ ] **Test the store-ready EPUB by hand.** Written down 2026-07-30 because it
      has not been done: everything above was verified against generated books
      and a validator, never against a real manuscript in a real shop. In rough
      order of what would hurt most if it were wrong:

  - [ ] **Apply the migration.** `supabase/migrations/20260730000000_book_publishing.sql`
        adds the `publishing` jsonb column and has *not* been run. Until it is,
        listing details save locally and silently fail to sync — the push
        rejects the unknown column. Do this one first or the rest tests nothing.
  - [ ] **Round-trip the metadata.** Fill in the Store listing card, reload, and
        confirm it survives. Then check it on a second device, which is what
        proves the column is really there.
  - [ ] **Export a real book with a real cover.** Not a generated one — a
        250KB-ish JPEG in the actual trim ratio. Confirm the cover appears as
        the first page, not just as a thumbnail.
  - [ ] **Run EPUBCheck on that file.** `java -jar epubcheck.jar yourbook.epub`,
        from the w3c/epubcheck releases. Generated books passing is not the same
        as a book with forty chapters and real punctuation passing.
  - [ ] **Open it in two readers.** Calibre and Apple Books, or Kindle
        Previewer — they disagree about cover handling more than about anything
        else, which is exactly why the cover is declared twice.
  - [ ] **Try one real upload.** Draft2Digital or KDP, as a draft that is never
        published. This is the only step that answers the open question above:
        whether a shop's own converter is fussier than EPUBCheck.
  - [ ] **Check the readiness panel tells the truth.** Against a real book:
        remove the cover and confirm it says so, mistype an ISBN digit and
        confirm it catches it.

- [ ] **Direct upload to the shops.** Asked for, and only partly possible —
      worth writing down so it is not re-investigated from scratch.
      **Amazon KDP has no public API**, and automating the dashboard breaks
      their terms with the writer's publishing account, not ours, carrying the
      risk. Apple, Kobo and Google all run *publisher* ingestion programmes
      rather than per-user APIs: using them means becoming the publisher of
      record for every book on the site, taking the royalties, paying writers
      out, and carrying the liability — a different company than this one.
      The only realistic route is **one aggregator** with a partner API
      (Draft2Digital, PublishDrive, Lulu), where the writer keeps their own
      account and their own money and we just hand the file across.
      Note the tension to resolve first: the landing page and the FAQ both
      promise the manuscript never leaves the machine, and an upload means it
      does. The wording has to change before the feature does.

- [ ] **Previous exports.** The reference has a history tab. Would need export
      records in storage: format, options, timestamp. Cheap and genuinely
      useful — a writer wants to know what they last sent an agent.
- [ ] **Endnotes.** The reference offers "at end of page / end of book". We have
      no endnote feature at all, so this is two jobs: notes in the editor, then
      placement at export.
- [ ] **Real print-ready PDF.** Current PDF is the browser's print engine: no
      bleed, no crop marks, no CMYK, and the page says so. A true printer's file
      needs a real PDF library and is a project of its own.

## Billing

- [x] **PayHere.** Done 2026-07-31. Recurring checkout, the notification
      webhook, cancelling, and the plan gate in front of the three metered
      routes. Optional like everything else: with `PAYHERE_MERCHANT_ID` and
      `PAYHERE_MERCHANT_SECRET` unset there are no plans **and nothing is held
      back**, so a self-hosted copy on its owner's own API keys is unchanged.
      Pure and tested: `plans.ts` (prices, cycle arithmetic), `signature.ts`
      (the two MD5s), `subscription.ts` (`isPro()`).
      The design decision worth knowing: only `/api/billing/notify` grants Pro.
      PayHere's return_url is a URL a writer can type, so `/upgrade/done` polls
      instead of trusting it — and `authenticated` has no write grant on
      `subscriptions` at all.

      **Tested end-to-end against PayHere's sandbox, 2026-07-31.** A real USD
      5.00 recurring authorisation, PayHere's own signed notifications, and the
      database rows they produced. What was verified:
      - The checkout hash — PayHere refuses a wrongly-signed checkout outright,
        so its payment page rendering at all is the proof.
      - A forged notification → 403. A correctly-signed one naming an order we
        never started → 200 and **no grant**, which is the forged-`custom_1`
        case: PayHere's md5sig covers only merchant/order/amount/currency/
        status, so the echoed writer id is attacker-shaped and ownership comes
        from our own order row instead.
      - First payment → order `paid`, `payment_events` row, `subscriptions`
        active, `/upgrade/done` flipping to "You're on Pro", the pricing page
        turning into "You're on Pro" and the account dialog naming the date.
      - The same `payment_id` replayed → period **unchanged**, still one event
        row. That is the `payment_id` primary key doing its job.
      - PayHere's second installment (`RECURRING_INSTALLMENT_SUCCESS`) →
        extended from the *old* period end, not from now, and left the order's
        own status alone.

      One bug found and fixed by that test, worth remembering because it fails
      silently: the migration granted table privileges to `authenticated` but
      not to **`service_role`**. The secret key bypasses row-level *security*,
      not privileges — so the webhook verified PayHere's signature, read back
      nothing, concluded the order did not exist, and answered 200. A payment
      taken and not granted, with nothing in the response to say so.

      Still unverified: **cancelling.** It needs `PAYHERE_APP_ID` /
      `PAYHERE_APP_SECRET` for the Subscription Manager API, which are not set,
      so the account dialog correctly shows no Cancel button. Set them, cancel,
      then confirm PayHere's Subscriptions page shows it cancelled *and* Pro
      still runs to the paid-up date.

- [ ] **A root domain, before any of this can take real money.** PayHere's
      Domains & Credentials refuses subdomains outright — "Sub Domains not
      allowed or Invalid Domain name". That rules out every ngrok URL and, more
      importantly, `openchapter.vercel.app` too. Sandbox testing works because
      PayHere accepts the literal `localhost`, which production obviously
      cannot. So a root domain is not a launch nicety here, it is a hard
      dependency of taking a single payment.

- [ ] **The two rows the pricing page still promises.** "Books 50" and
      "Imports 10 files" on the Starter card are not enforced anywhere —
      nothing counts a shelf or an import. Every other row on that page is now
      real. Either wire the counters (they need a home: the shelf count is
      local and cheap, the import count needs somewhere durable to live) or
      change the two rows to what the app actually does. Leaving them is the
      one bit of that page still ahead of the code.

- [ ] **A receipt of their own.** PayHere emails one, and that is what a writer
      is told to trust. A payments list in the account dialog — read straight
      off `payment_events`, which already holds every charge — would mean not
      having to go and find that email.

- [ ] **Changing cycle.** Monthly to annual means cancelling and starting
      again, and the checkout says so rather than quietly making a second
      authorisation. One writer, one live PayHere subscription, one row. A
      proper switch would cancel the old one and pro-rate the new; PayHere has
      no upgrade call, so it is genuinely two steps and wants designing before
      it is built.

## Storage — the ceiling is close

- [x] **Auth.** Supabase email/password, done as its own step ahead of the
      storage move. `src/proxy.ts` refreshes the session and holds the sign-in
      wall; `src/lib/supabase/` has the three clients; sign-in, sign-up and
      sign-out are Server Actions in `src/app/auth/actions.ts`, so the cookie
      and the redirect arrive in one response. Both env vars unset means no
      accounts at all and no wall — the app runs local-only as it always has,
      the same shape as the assistant's missing API key.
- [x] **Supabase persistence.** Done, and verified against a real library:
      10 books, 56 chapters, 23 bodies and 9 covers uploaded, and no chapter
      with a word count left without its prose. Supabase sits *behind*
      localStorage rather than replacing it, so reads stay synchronous and
      offline still works — see the design note for why that decision shapes
      everything else. `sync.ts` pushes on write and reconciles once per load.
      *Left:* pull is once per load, so a second machine's edits arrive on
      refresh rather than live; and two machines editing one chapter resolve
      last-write-wins by the server clock, which is honest for one author and
      wrong for two.
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
