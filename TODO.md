# OpenChapter — what's next

Last updated 2026-08-01. Ordered roughly by value, not by effort.

## The direction changed

**OpenChapter is no longer primarily a writing-and-export app.** As of
2026-08-01 it is meant to solve the problems book writers actually have, and
the writing app is one part of that rather than the whole of it.

The list below comes from four batches of Reddit research (r/selfpublish,
r/writing), sorted by one rule: **what can be built in code, what needs people
recruited, and what no tool fixes at all.** Everything in the first group is
here. The other two groups are at the end of this section, written down so they
are not re-proposed every quarter.

Everything already shipped — the editor, the shelf, import, export, the
pre-upload check, billing — stays. Most of the list below extends it rather
than replacing it.

### Start here — days each, and mostly assembly

- [ ] **"Where you left off" card.** On opening a chapter, show the last
      paragraph written, the note about what happens next, and who is in the
      scene. This answers the top-voted pain in the whole research — *"I have
      about 17 free minutes with no interruptions a day"* against *"it takes
      forever to get back in the groove"*. Assembly from `lastOpened`, the notes
      panel and word counts; almost nothing new to invent.
- [ ] **Idea parking lot.** Capture a new idea in ten seconds *without leaving
      the current book*. Writers repeatedly describe a shiny new idea stalling
      book two of a trilogy. Tiny, and it protects the thing they already
      started.
- [ ] **Publishing roadmap.** Every step from blank page to published, in
      order, with progress saved. Confirmed by three separate batches — the
      clearest case being a writer who found out ARCs were essential *after*
      publishing. Content and checkboxes; no new infrastructure.
- [ ] **Backups and version history.** Snapshots and "restore an earlier
      draft". Extends `library-store.ts` and `sync.ts`, which already do most of
      the work.
- [ ] **Revision tracker.** Mark a chapter done; count and show the passes.
      *"My first chapter has had about twenty rounds of editing."* Making the
      loop visible is what breaks it — nobody can see themselves circling.
- [ ] **Surface what is already built.** Dictation (`use-dictation.ts` — free,
      no key, Chrome/Edge) answers *"the process of typing drains my
      discipline"*, raised in two separate batches. Pen names already work,
      because `author` in `publishing.ts` is per-book. Neither appears anywhere
      on the landing page. This costs nothing to ship.

### Then — the differentiators

- [ ] **KDP sales import and book P&L.** KDP exports sales as a spreadsheet;
      parsing one is a file import, which this codebase is already good at.
      Unlocks spend against earnings per book, break-even, and the "no traction
      until book three" curve across a backlist. It answers the loudest money
      pain in the research — *"I look at the massive amount of money I
      wasted"* — and it is arithmetic, not AI. Fold the ad break-even sum into
      the same screen.
- [ ] **Genre beat sheets.** Structure, word targets, and the midpoint. Three
      batches name the same wall: *"First 20,000 words fly by. Then I realize I
      have enough content to get to 30,000."* Builds on `book-kinds.ts` and the
      already-written, currently-unused `book-templates.ts`.
- [ ] **Story bible.** Characters, places, timeline — and **across a series**,
      not one book, which is how it was asked for. Extends the notes panel.
- [x] **Blurb workshop.** Done 2026-08-01. `/book/[bookId]/blurb`, backed by
      `src/lib/blurb.ts` (pure, 25 tests). Explicitly *not* "AI writes your
      blurb": writers in this research describe an AI-written blurb as the thing
      that hurt their sales. It writes nothing — it counts, and it shows five
      real blurbs from comparable books beside the box.

      **Only two things in it are called problems, and both are facts:** an
      empty blurb, and one over `BLURB_MAX`. Everything else is a *note* — a
      measurement, with the same measurement from published books beside it
      where the comps search found any. Nobody knows whether a writer's
      three-paragraph blurb beats a two-paragraph one, and the screen says so
      out loud so the notes are not mistaken for rules.

      Two checks are deliberately weaker than they look. Sentence splitting
      re-joins honorifics, because "Mr. Kelly" otherwise reads as two sentences
      and the longest-sentence figure goes wrong. And **shouting is only flagged
      as a run of two or more capitalised words** — a lone upper-case word
      cannot be told from an acronym, NASA and NOVEL being the same shape, and a
      check that calls an acronym a mistake is noise that gets ignored along
      with the checks that matter.

      Blurbs come from Google Books only; Open Library's search results carry
      none. When Google is rate-limited that half of the screen is empty and
      says why, rather than implying the genre has no blurbs in it.
- [ ] **Paperback setup.** Spine width (page count × paper thickness), margins,
      gutter, bleed. *"I'm just cursed when it comes to setting up paperbacks —
      it always takes ten times as long as it should."* Extends `page-setup.ts`,
      and it is the kind of arithmetic nobody else bothers to do properly.
- [ ] **Categories and comp titles.** A real BISAC picker, replacing today's
      free-text field in `publishing.ts` — which is already noted further down
      this file as a gap.
- [ ] **Honest numbers.** The real medians — 97% of books sell under 5,000
      copies, most under 100 — shown *before* somebody spends a thousand pounds
      on a cover. Content only, and it is the most on-brand thing on this list:
      everyone else in this market sells hope.
- [ ] **Before-you-pay checklist.** What to verify before hiring a publisher,
      a cover designer or a promotion service. Content only. **Do not name
      specific companies as scams**, however often they come up by name in the
      research — that is a legal problem, not a feature.

### Later

- [ ] **Prose report — and never a prose editor.** Dialogue tags, filter words,
      adverb density, plot-hole notes. Report it; never rewrite it. This is the
      `storeReadiness()` pattern pointed at prose instead of metadata, and the
      distinction is load-bearing: writers in this research are sick of
      Grammarly, and the product's strongest claim is that the assistant has no
      write access to the manuscript. A report keeps both promises. An AI
      rewrite breaks both.
- [ ] **"Why isn't it selling" diagnostic.** A structured self-audit — cover,
      blurb, categories, price, sample. Extends `storeReadiness()`.
- [ ] **Cover checker.** Not a designer: is the title legible at thumbnail
      size, is the resolution enough, does it match the trim ratio. Honest,
      useful, and nobody offers it.
- [ ] **Sprints, streaks and session history.** Supports finishing; does not
      promise it.
- [ ] **ARC tracker.** Who holds the ARC, who reviewed, when it is due. A
      tracker, not a marketplace — the distinction is the whole point.
- [ ] **Writing provenance.** Evidence a human wrote the book, over time, built
      from the keystroke-level autosave history the app already keeps. In a
      market where legitimate authors are being *accused* of using AI, no
      competitor can offer this, because none of them has the history. Needs
      care around privacy and around what it does and does not prove; the claim
      has to stay narrower than "this proves you wrote it".

### Built on two free APIs

**Google Books** (`googleapis.com/books/v1/volumes`) and **Open Library**
(`openlibrary.org`, plus `covers.openlibrary.org`) are both free, need no key
for basic use, and between them answer most of what a writer cannot look up
today. Cache everything — both are rate-limited, and Open Library is
crowd-sourced, so records vary from complete to nearly empty. Present anything
from them as *what is out there*, never as *the answer*.

- [x] **Comp titles.** Done 2026-08-01. `/book/[bookId]/comps`, backed by
      `src/lib/comps/comps.ts` (pure, 24 tests) and `/api/comps`. The search is
      seeded from the book's genre and blurb and then handed to the writer to
      edit, because they know what their book is like and we do not.

      What the merge is for: Google Books has the blurbs and page counts, Open
      Library has the subjects and a cover for almost everything, and the gaps
      are in different places — so records are matched on ISBN, or on
      title-plus-author when neither has one, and then merged **field by
      field**. Preferring a source wholesale throws away exactly the field the
      other was fetched for. Records with no author are dropped: both services
      return catalogue entries and anthologies with an empty author list, and
      none of them is a comparable title.

      `summarise()` is the reason this unlocks the others — median pages,
      median blurb length, and subject counts, each reported *with how many of
      the results carried the field*. "The median is 320 pages" from three of
      twenty books is a different statement from the same figure from eighteen.
      Median rather than mean throughout: one 1,200-page omnibus drags an
      average somewhere no real book sits.

      **`GOOGLE_BOOKS_API_KEY` is optional and newly documented in
      `.env.local.example`.** Google Books works without a key and rate-limits
      hard without one — the anonymous quota is per IP, and a server is one IP
      for every writer, so it answers 429 under any real traffic. It did during
      development. Without the key the feature still works: Open Library carries
      it, and the panel says plainly that Google did not answer rather than
      leaving a writer to conclude their genre is empty.

      *Left:* the ranking step below.

- [ ] **Rank the comps with a model.**

      **This is the one place in the cluster where AI earns its cost:
      *deciding which books are actually like yours*.** Everything else here is
      a plain request and some arithmetic — no key, no model, no bill. But a
      keyword search returns forty books of which five are genuinely
      comparable, and sorting those five out is a fuzzy judgement, which is
      what a model is for. Three jobs and no more: turn the writer's blurb and
      opening chapter into a good search, rank and filter what comes back, and
      name the pattern across them ("blurbs in this genre usually open with a
      question").

      Use it for the judgement, never the fetching. The APIs are free and every
      model call is not, and a feature that calls a model to read a page count
      is one that gets switched off when the invoice arrives. All three jobs
      stay inside the standing position — the assistant reads and reports, and
      never writes into the book.
- [ ] **Blurb benchmarking.** Google Books returns the real blurb of every
      published book, so the blurb tool can show five actual blurbs from books
      like yours and the average length, instead of giving advice. This is what
      makes the blurb workshop teach rather than lecture.
- [ ] **Category suggestions without licensing BISAC.** Read the subjects and
      categories the comp titles sit in and suggest those. It answers the
      question from real books rather than from a code list we would have to
      pay BISG for. See the note under *Ruled out* about Thema.
- [ ] **A cover wall for the genre.** The covers of the top books in a genre,
      shown together. Answers "I do not know what a thriller cover looks like",
      and it is the reference the cover checker has to check *against* — without
      it, that checker can only judge resolution and legibility, not convention.
- [ ] **Is this title already taken?** One search. Cheap, and writers ask it
      constantly.
- [ ] **Real length targets.** Page counts of actual books in the genre,
      replacing the folklore numbers currently hard-coded in `book-kinds.ts`.

### Two standards worth using rather than inventing

- **C2PA / Content Credentials** for the provenance feature. It is the open
  standard Adobe and the camera makers are backing for "a human made this", and
  `c2pa-js` exists. A homegrown format proves the same thing and convinces
  nobody; the point of that feature is being *believed*.
- **Thema** (EDItEUR) instead of BISAC for subject codes, if a code list is
  needed at all. BISAC is owned by BISG and licensed; Thema is open.

### Ruled out, and why

Written down so they stop being re-proposed.

**Needs people recruited, not code.** Cover design, editing, beta readers, ARC
readers, community, coaching, running anyone's marketing. Each is a two-sided
marketplace with a chicken-and-egg problem — readers will not come before
writers, writers will not come before readers — and running one is a different
company from shipping software.

**Do not solve either of these with AI.** Covers and editing are the two
most-wanted items in the research, and the cheap way to build both is
generative. Doing so would contradict, in one release, the assistant's lack of
write access, the roadmap's promise that covers will not come from a stock site
full of AI, and the FAQ's statement that manuscripts are not training data — in
front of the one audience that checks. If they are ever built, they come from
real designers and real editors.

**No API exists for these, whatever anyone sells you.** Amazon has no public API
for KDP sales *or* for keywords — which is why the money feature reads the
spreadsheet KDP already lets you download, and why keyword research is not on
this list at all. Publisher Rocket and its kind scrape; building on that
inherits their terms-of-service problem. NetGalley, BookSirens and BookSprout
have no public APIs either, so the ARC tracker is manual entry — which is fine,
because the pain was "six sites and a spreadsheet", not "no API".

**No tool fixes these.** Finishing the book. Judging whether your own writing is
good. Self-doubt, loneliness, negativity from family, nobody reading it, health,
ADHD, day jobs, unwanted advice. Some of the list above *supports* these;
nothing on it solves them, and the people selling that fix are the ones this
audience has already been burned by.

**Community is the open question.** It was asked for more times than anything
else across all four batches and it is the strongest thing that cannot be a
feature. It deserves a real decision at some point rather than another shrug.

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
