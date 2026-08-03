# OpenChapter — what's next

Last updated 2026-08-02. Ordered roughly by value, not by effort.

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

- [x] **"Where you left off" card.** Done 2026-08-01. On the book overview,
      which is the screen a writer lands on. Backed by `src/lib/resume.ts`
      (pure, 13 tests): the last paragraph of the chapter they were in, and the
      first line of the note they left themselves.

      This answers the top-voted pain in the whole research — *"I have about 17
      free minutes with no interruptions a day"* against *"it takes forever to
      get back in the groove"*. Those are the same complaint: most of a short
      session goes on remembering rather than writing, and nothing on the
      market addresses it because every writing app is built for somebody with
      two clear hours.

      **Nothing new is stored.** The paragraph is read back out of the
      manuscript and the note is the chapter notes panel that already exists;
      the whole feature is putting the two where the writer arrives. The
      chapter is `lastOpenedId` when it has prose, falling back to the last
      chapter with any — somebody who opened chapter twelve, wrote nothing and
      shut the laptop is not resuming there, and quoting an empty chapter back
      at them is worse than saying nothing. The excerpt is the paragraph's
      *tail* rather than its head, cut at a word: what a returning writer needs
      is the sentence they stopped in the middle of.

      *Left:* "who is in the scene" wants the story bible, which is not built.
- [x] **Idea parking lot.** Done 2026-08-01. A tab in the editor's own rail,
      beside Notes, backed by `src/lib/ideas.ts` (pure, 17 tests) and a new
      `openchapter:ideas` key.

      **Being in the rail is the feature.** Writers describe the shiny idea
      arriving mid-draft and stalling book two, and describe writing ideas down
      on their phone because there is nowhere else. Both are one problem: the
      idea nags until it is captured, and if capturing it means leaving the
      book then leaving *is* the interruption. Enter commits, so it costs no
      mouse either.

      **Parked, not started.** An idea has no shelf entry and costs nothing to
      keep. Turning every stray thought into a book is how a shelf fills with
      eleven abandoned first chapters, which is its own pain further down this
      research — so "Start a book" is a button pressed for the one that turns
      out to be real, and `titleFromIdea()` takes only the first clause, since
      ideas get typed as premises rather than titles.

      A long paste is capped rather than refused: somebody pasting three
      paragraphs into a ten-second box should get their idea kept, not an error
      about a limit they did not know existed. Each idea records which book was
      open when it struck — never navigated to, but four ideas from one book is
      usually a fact about that book.

      *Left:* not synced, like the roadmap ticks. It is at its own key rather
      than on a book, so `sync.ts` would need a table rather than a column.
- [x] **Publishing roadmap.** Done 2026-08-01. `/book/[bookId]/roadmap`, backed
      by `src/lib/roadmap.ts` (pure, 14 tests). Eighteen steps in five phases,
      each linking to the screen that does it where one exists.

      **The load-bearing part is where "Line up ARC readers" sits: before
      publishing, not after.** Three separate research batches describe the same
      injury — not a missing tool, a missing *order* — most sharply the writer
      who realised advance copies were essential only after publishing, then
      spent months chasing reviews for a book already out. There is a test
      asserting that step comes before "Upload to the shop", because if it ever
      moves the list has lost the thing it was built to say.

      **Most steps work themselves out from the book** rather than waiting to be
      ticked, and **detected beats ticked**: a writer who ticks "write the blurb"
      and then deletes the blurb sees the step come back. A checklist that can be
      lied to will be, usually by accident, and then it is worse than not
      existing. Two steps are deliberately *not* detected — "finish the first
      draft", because finishing is a decision rather than a word count, and
      "get a cover made", because a generated placeholder is attached like any
      other and ticking off the most expensive step in the list on the strength
      of a gradient would be the worst kind of wrong.

      *Left:* hand ticks live in `Book.roadmapDone` and are **not synced** —
      `sync.ts` maps a book's columns by name and this is not one of them, so a
      writer on two machines ticks twice. The page says so at its foot.
- [x] **Backups and version history**, with the revision tracker on the same
      panel. Done 2026-08-01. A Versions tab in the editor rail, backed by
      `src/lib/history.ts` (pure, 14 tests) and one `openchapter:history:<id>`
      key per chapter.

      **Two features on one surface because they are one question asked twice.**
      Writers name backups as a pain, and separately describe circling — *"my
      first chapter has had about twenty rounds of editing"*. The versions
      answer the first; counting them answers the second, because nobody can see
      themselves circling from the inside.

      **It is a safety net, not an archive, and the panel says so.** The ceiling
      is what shapes it: `localStorage` is ~5MB an origin and this app already
      lives near it, so history is bounded twice — eight versions a chapter, and
      a 400KB budget behind that, oldest evicted first. A snapshot is taken at
      most every ten minutes *and* only when the text really changed, or a
      chapter left open with autosave ticking would push out the eight versions
      that mattered with eight identical ones. What it can promise is "this
      chapter as it was before lunch"; what it cannot promise is last March.

      **A snapshot must never cost the manuscript.** `rememberVersion` runs
      after the body is written and swallows every error: a full origin means no
      history, not a failed save. Restoring goes back through `saveBody`, which
      is what makes "this can be undone" true — the current text was snapshotted
      on its own last autosave and is still in the list.

      *Left:* not synced, like the roadmap ticks and the ideas. And there is no
      *global* sweep yet — the byte cap keeps one chapter honest, but forty
      chapters each holding their budget would not fit. See "Storage pressure"
      below; this made that item more urgent rather than less.
- [ ] **Revision tracker.** Mark a chapter done; count and show the passes.
      *"My first chapter has had about twenty rounds of editing."* Making the
      loop visible is what breaks it — nobody can see themselves circling.
- [ ] **Surface what is already built.** Dictation (`use-dictation.ts` — free,
      no key, Chrome/Edge) answers *"the process of typing drains my
      discipline"*, raised in two separate batches. Pen names already work,
      because `author` in `publishing.ts` is per-book. Neither appears anywhere
      on the landing page. This costs nothing to ship.

### Then — the differentiators

- [x] **Sales import and book P&L.** Done 2026-08-01. `/book/[bookId]/track`,
      backed by `src/lib/ledger.ts` (pure, 23 tests) and an
      `openchapter:ledger` key. Costs and royalties by hand, a CSV import for a
      sales report, spend against earnings, and how many more copies get level.
      **Track was the last of the six dashboard areas to become real**, and the
      largest — every other area reads data the app already had.

      **The import maps columns rather than assuming them.** A parser tied to
      KDP's current column names is one that breaks silently the week Amazon
      renames one, on a screen about money. Reading the header row and having
      the writer confirm works with any shop's report, an aggregator's, or a
      spreadsheet somebody keeps by hand. The guess is offered for correction,
      never applied.

      **It never invents a royalty rate.** Per-copy comes from rows that
      actually recorded copies, and the break-even count refuses to appear
      without one — a plausible figure there is worse than none, because it is
      exactly what a writer would plan a year around.

      Two details worth keeping. `cellNumber` insists on a digit after
      cleaning, because "Total" strips to an empty string and `Number("")` is
      zero — without that, every subtotal row in a report counts as a
      zero-royalty sale, which a test caught. And `saveLedgerRaw` **does not**
      swallow a failed write, unlike chapter history and the writing log: those
      are derived, this is what the writer typed, and losing it silently on a
      money screen is the worst kind of failure.

      *Left:* `.xlsx` — KDP's default download — still has to be saved as CSV
      by hand; reading the zip is a later job.
- [x] **The book-three curve.** Done 2026-08-03. `src/lib/curve.ts` (pure, 17
      tests) and a section in the dashboard's Track area, under the strip that
      adds the library up — the same class of question as "am I down overall",
      which no per-book page can answer.

      The folklore is everywhere in the research and nobody can check it:
      *no traction until your third book*. A writer two books in cannot tell
      whether they are on that curve or whether it is a story people tell each
      other, and the answer decides whether they write a third.

      **The comparison is like-for-like or it is nothing.** Every book is
      measured over the same number of days *from its own publication date*,
      and the window is the age of the youngest book that qualifies, so the
      older ones are cut back to match. A first book out three years has earned
      more than a second out three months, and saying so proves only that time
      passes.

      **It refuses far more often than it answers, and that is the feature.**
      Fewer than two placeable books and it draws nothing; a book with no
      publication date has no day nought to count from; a book out less than 30
      days is left off rather than compared over six; and a book with no sales
      rows is a gap in the record, not a zero — those two read identically on a
      money screen and mean opposite things. Every book left off is named with
      why, because a quiet exclusion here would be a curve drawn through
      whichever books happened to qualify. `curveOf` returns the accounting
      rather than null for the same reason: "one book is on this so far" is
      worth being told where a blank space is not.

      **The folklore is quoted, never applied.** "Each earned more than the one
      before" is a fact about four figures; "you are on the curve" is a
      forecast off three points, and forecasts are what this product refuses to
      sell. Costs are ignored — money the writer chose to spend says nothing
      about whether readers turned up.

      *Left:* it can only see what has been imported, so it is as good as the
      writer's sales reports and no better. And it shares the sync hole: the
      ledger is local, so a second machine has a different curve.
- [x] **Genre beat sheets.** Done 2026-08-01. `/book/[bookId]/structure`,
      backed by `src/lib/beats.ts` (pure, 14 tests). Eleven beats as shares of
      the finished length, with the writer's own word count placed on them.

      For the wall three batches name at the same spot — *"First 20,000 words
      fly by. Then I realize I have enough content to get to 30,000."*, *"I
      always get writer's block at the midpoint."* A writer stuck there does not
      need a theory of narrative; they need telling that they are at the middle
      and what the middle usually is. A test asserts the middle turn still
      straddles 50%, because if it drifts the feature has lost its point.

      **The names are ours and deliberately plain.** The famous beat sheets are
      somebody's copyrighted framework, and their vocabulary is a second barrier
      — this research complains directly that structure terminology is bad and
      hard to learn. "The middle turn" says what it is; "the Dark Night of the
      Soul" needs a book explaining it first.

      **It refuses to work without a target, and offers to set one rather than
      guessing.** Inventing a length from the genre would put a number on screen
      the writer never agreed to and then measure them against it. Genre notes
      exist only where a difference is real and widely agreed; a genre with no
      note gets the spine, because a made-up convention is worse than an absent
      one, and a test keeps the notes to genres the app actually offers.

      *Left:* `book-templates.ts` is still unused — chapter skeletons are a
      different idea from beats, and it stays held back for its own reasons.
- [x] **Story bible.** Done 2026-08-01. A tab in the editor rail beside Ideas,
      backed by `src/lib/bible.ts` (pure, 15 tests) and one
      `openchapter:bible:<bookId>` key per book. People, places, things and
      notes, each with the aliases it answers to.

      **The lookup is the feature, not the list.** Anyone can keep a file of
      names and nobody keeps it current; what a file cannot do is say who is in
      the chapter you have open. That is a search over what is already written,
      so it is right whether or not the bible has been maintained — which is why
      the panel opens with it.

      **Whole-word matching is the whole difficulty.** A character called Ash
      must not match "ashes", "cashew" or "Ashton", a two-word name is matched
      as a phrase so "Mrs Danvers" does not count every "Danvers", and an alias
      sitting inside a longer name is not counted twice. A plain `includes`
      turns the feature into noise the first time somebody names a character Sam
      and writes "same".

      Aliases are the point rather than a nicety: a character who is Elizabeth
      to the narrator and Lizzie to her brother is one person, and a lookup that
      missed the second would be worse than no lookup.

      **This also completed the resume card**, which was built with a "who is in
      the scene" line noted as waiting for exactly this. It is silent when the
      bible is empty — a writer who has not made one does not need telling what
      they are missing every time they open a book.

      *Left:* the assistant filling it in by reading chapters, which is the
      "AI reads, never writes" job.
- [x] **The bible across a series.** Done 2026-08-03. `src/lib/series.ts`
      (pure, 27 tests) and a scope toggle in the same panel. The blocker
      recorded here — "a series needs a notion of series the store does not
      have" — had quietly gone away: `publishing.series` and `seriesIndex`
      arrived with the listing details, because a shop asks for them.

      **So a series is derived, never declared.** No series object, no "create
      a series" screen, no migration: books are in a series when their listings
      say the same thing. A second place to record it is a second place to keep
      in step, which is the lesson the store already learned about word counts.

      **Entries stay at their own book's key and nothing new is written.** The
      series bible is a read across the sibling books' bibles, merged on the
      way through. A shared `bible:series:<name>` key was the obvious other
      answer and loses on three counts: renaming the series orphans it, a book
      leaving takes nothing with it, and an entry loses the fact that makes the
      merged view worth having — which book wrote it down.

      **It opens on the series when there is one**, and that default is the
      argument rather than a preference. A writer on book three whose panel
      says "none of them, by name at least" about a chapter full of book one's
      cast has been told something false by the half of the feature that was
      supposed to be reliable whether or not anyone maintained a list.

      **Merging is exact and refuses to be clever.** Same name or same alias,
      case-insensitively, and nothing fuzzier — the same refusal `subjects.ts`
      makes about "Fantasy" and "Fantasy fiction". Every rule smart enough to
      see that Beth is Elizabeth also welds two different Toms together, and a
      duplicate is visible to the writer where a bad merge is not. Matching
      *is* transitive, so Elizabeth–Lizzie in book one and Lizzie–Beth in book
      two make one person without anyone stating the pair that closes it. Kind
      is part of identity: a character called Ash and a place called Ash stay
      two things, because a town named after its founder is ordinary.

      **Differing details are shown, not flagged.** Book one's description sits
      above book three's, each labelled, rather than being merged or marked as
      a contradiction. Details accumulate across a series far more often than
      they conflict, so a warning badge would fire on nearly every character
      and mean nothing by book two; putting both sets of words on screen is the
      one thing the writer has never been able to do, and they can see it
      themselves. Adding always writes to the book being written; removing
      names the book it removes from, since an unlabelled Remove in the series
      view would delete out of a manuscript nobody is looking at.

      *Left:* the sync hole gets worse here, not better — none of these keys
      sync, so a series read on a second machine is a series of whichever books
      that machine holds. The panel says so.
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
- [x] **Paperback setup.** Done 2026-08-01. `/book/[bookId]/paperback`, backed
      by `src/lib/paperback.ts` (pure, 13 tests). Spine width, inside margin,
      and the full cover wrap in inches and millimetres.

      *"I'm just cursed when it comes to setting up paperbacks — it always takes
      ten times as long as it should."* It takes ten times as long because four
      numbers all depend on the page count and the page count is the last thing
      a writer learns. None of it is hard; all of it is fiddly, and one wrong
      figure means a rejected upload or a title printed off the spine.

      **The page count is an input with an estimate offered**, because the real
      figure comes out of the exported PDF — it depends on trim, type size,
      leading and where every chapter breaks. The estimate rounds up to an even
      number, since a leaf has two sides.

      **Every constant is a published KDP figure held in a named constant**, so
      when a shop changes one there is a single line to change and a test that
      fails. The gutter table is the part writers most often leave at a default
      and most often regret: a thick book does not open flat, and text near the
      spine curves out of sight.

      **It says twice that it does not replace the shop's template.** A
      printer's file is the one place where approximately right is worth
      nothing. This is for knowing the numbers before you get there, and for
      checking that the template you were sent is the one you asked for.
- [ ] **Categories and comp titles.** A real BISAC picker, replacing today's
      free-text field in `publishing.ts` — which is already noted further down
      this file as a gap.
- [x] **Honest numbers and the before-you-pay checks.** Done 2026-08-01, as one
      page — they are the same conversation. `/book/[bookId]/money`, backed by
      `src/lib/money.ts` (9 tests): four figures about what a book usually
      earns, five things writers pay for with the checks to make first, and a
      break-even sum.

      **Every figure carries its own provenance, and a test enforces it.** They
      are directional — repeated across industry summaries and author posts
      rather than audited — and a page presenting them as hard data would be
      doing the exact thing it warns about. Writing it this way also caught the
      landing page stating the 97% figure flat, which is now attributed too.

      **No company is named, and a test enforces that as well.** Several come
      up by name in the research; calling a named business a scam is a legal
      matter rather than a feature, and it is unnecessary — the checks describe
      the *shape* of the thing, which is more use anyway, because next year it
      will have a different name. The one that matters most is the whole test
      for a publisher: **if they ask you for money, they are not a publisher.**

      Free, and the page says why that is unusual: everyone else in this market
      is paid when a writer spends.

### Later

- [x] **Prose report — and never a prose editor.** Done 2026-08-01.
      `/book/[bookId]/prose`, backed by `src/lib/prose.ts` (pure, 18 tests).
      Five things counted per chapter: dialogue tags other than "said", words
      ending in -ly, filter words, runs of three sentences starting the same
      way, and sentences over 45 words.

      This is `storeReadiness()` pointed at prose instead of metadata, and the
      distinction is load-bearing: writers in this research are sick of
      Grammarly and describe Word's AI making 150 corrections that *"caused the
      writing to be more bland"*. A report keeps both standing promises — the
      assistant has no write access, and we do not blandify anyone. A rewrite
      button would break both.

      **There is no score, and a test asserts there is no score.** No grade, no
      rating, no number out of a hundred. Every one of those is invented to look
      like an answer, and prose is the last place a made-up number belongs.

      **Every convention is named as a convention.** Adverbs are not a fault,
      filter words are not a fault, a long sentence is a style. The page says so
      at the foot, and each finding says why anyone mentions the thing rather
      than what to do about it. The "said" count is reported *beside* the
      alternatives, because two exclaims in a chapter of four hundred saids is a
      different fact from two in a chapter of six.

      *Left:* plot holes, which were in the original note and are not here.
      Finding one needs to understand the story, which is the assistant's job
      and not a regular expression's.
- [ ] **"Why isn't it selling" diagnostic.** A structured self-audit — cover,
      blurb, categories, price, sample. Extends `storeReadiness()`.
- [x] **Cover checker.** Done 2026-08-01, on the covers page under the wall,
      backed by `src/lib/cover-check.ts` (pure, 14 tests). Dimensions, shape,
      file weight and overall contrast, measured in the browser and never
      uploaded.

      **Only two things are called problems** — under the minimum size, and over
      the file limit — because those are the two a shop actually refuses.
      Everything else is a note, including the shape: an unusual ratio is not
      rejected, it is letterboxed, so the cover appears smaller than its
      neighbours in a list, which is worth knowing and is not an error.

      **It checks the file the writer is about to upload, not the copy this app
      stores**, and says so. Ours is compressed to fit a 250KB cap and would
      fail a size check it was never meant to pass; a checker quietly measuring
      the wrong file would be worse than none.

      The two questions that actually decide a cover — is the title readable at
      60px, does it look like its genre — are **not** attempted. Neither is
      measurable, and both are answered by the wall directly above it.
- [x] **Streaks, pace and a finish date.** Done 2026-08-01.
      `/book/[bookId]/progress`, backed by `src/lib/activity.ts` (pure, 22
      tests) and an `openchapter:activity` key — one number per day, so a year
      is a few kilobytes.

      Behind it is the largest and least tractable pain in the research: *"12
      years to finish my novel"*, *"14 years"*. Nothing here fixes that. What it
      does is make the question answerable — a writer with seventeen minutes a
      day cannot tell from the inside whether they are getting anywhere, and
      being unable to tell is its own discouragement.

      **Facts, never verdicts.** "You wrote on 12 of the last 30 days" is a
      fact; "you should write more" is a stick, and the people selling sticks
      are pain point #17 in the same research. Three decisions follow from that:

      - **Net words, not words typed.** Cutting 800 words is work, and a counter
        that only went up would call that a wasted day.
      - **Yesterday keeps a streak alive.** A writer who has not sat down *yet
        today* has not broken anything, and a counter resetting at midnight
        would tell them they had.
      - **The finish date refuses to appear rather than say something cruel.**
        No target, already there, a shrinking manuscript, or a date more than
        two years out, and it says nothing. A projection off a revision reads as
        "never" — true arithmetic, and a terrible thing to print at somebody in
        the middle of a hard month.

      Logged across the whole library rather than per book: the question is
      about the writer, and somebody who spent March on book two did not have a
      bad March.

      *Left:* not synced, like the other own-key stores. Sprints — a timer for a
      single sitting — are a different feature and not built.
- [x] **ARC tracker.** `src/lib/arc.ts` + `/book/[bookId]/arc`, in the
      dashboard's Track area beside the ledger — reviews and money are the two
      halves of what happens to a book once it is out.

      A tracker, not a marketplace, and that distinction is the whole point: it
      finds nobody for you and sends nothing. The complaint in the research was
      never "there are no readers", it was six open tabs and no idea who held
      what.

      Three things carry the feature. **The deadline**, which is what turns
      thirty contacts into the two people to email this morning — late readers
      sort to the top, and if the book has a publication date the page works
      back to when copies need to go out (28 days, the convention the shops and
      the review sites both work to). **What each reader actually reads**,
      recorded at the point of adding them, because the review everybody
      remembers comes from someone outside the genre. And **the review rate is
      counted against those who answered**, not against everyone — the silent
      majority are neither failures nor pending forever, and the screen shows
      how many are still open beside the figure.

      `fromDay()` is the tested part that looks trivial and is not: a date input
      gives `YYYY-MM-DD`, which `new Date()` parses as *UTC*, so a writer west
      of Greenwich picking the 1st gets an instant that is the 31st where they
      are sitting. It also anchors to the *end* of the day, or every reader is
      overdue from one minute past midnight on the morning their review was due.

      *Left:* not synced, like the other own-key stores.
- [x] **Writing provenance.** `src/lib/provenance.ts` + `/book/[bookId]/provenance`,
      called the Writing record, linked from Tools.

      It gathers what the app was keeping anyway — the day log from
      `activity.ts`, the saved drafts from `history.ts` — into a plain-text
      document that survives being pasted into an email or a contest form, plus
      a SHA-256 of the manuscript.

      **The claim stayed narrower than "this proves you wrote it"**, which was
      the condition on building it at all. Four limits are stated on the screen
      *and again in the exported file*, because the screen is not what gets
      forwarded: it is evidence rather than proof; it is not tamper-evident,
      since the record is in a browser the writer controls; it begins when they
      started here, so an imported manuscript lands as one large day; and the
      day figures are library-wide rather than per book. `importDays()` surfaces
      those large days on the page on purpose — being surprised by your own
      record in somebody else's hands is the failure this exists to prevent.

      **The fingerprint is the only part that is not self-reported**, and it is
      worth nothing until it is timestamped somewhere we do not control. The
      page says so and deliberately does not offer to store it: a notary that is
      also the accused party is not a notary. `crypto.subtle` is absent outside
      a secure context (plain `http://<lan-ip>`, the same trap `newId()` works
      around), so the hash degrades to null and the rest of the record still
      builds.

      *Not doing:* **C2PA**. Its value is a signature chained to a certificate
      authority; signing with a key shipped in the browser produces a file that
      looks like the real thing and carries none of its weight, which is worse
      than not signing. Revisit only with a real CA relationship.

      *Left:* keystroke-level history was the original idea and is not what got
      built — the app keeps eight snapshots per chapter and a net figure per
      day, not every edit. Storing more is a localStorage question first.

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

- [x] **Rank the comps with a model.** Done 2026-08-03.
      `src/lib/comps/rank.ts` (pure, 29 tests), `/api/comps/rank`, and a card
      on the comps screen.

      **This is the one place in the cluster where AI earns its cost:
      *deciding which books are actually like yours*.** Everything else here is
      a plain request and some arithmetic — no key, no model, no bill. But a
      keyword search returns forty books of which five are genuinely
      comparable, and sorting those five out is a fuzzy judgement, which is
      what a model is for. It picks at most five, best first, each with a
      reason in a sentence, and names the pattern across them.

      **A separate route, and that split is the design.** `/api/comps` stays
      free, keyless and cached for a day; the ranking is its own POST behind
      `requirePro()` and its own button. Folding them together would have made
      the whole feature need a key and a plan for the sake of a step most
      searches do not want — and a feature that spends a model call to read a
      page count is one that gets switched off when the invoice arrives. Sonnet
      rather than the assistant's Opus, for the same reason: this is a bounded
      classification over twenty short records.

      **There is no score, and there is no field to put one in.** Not a
      percentage, not stars, not a confidence. It would be invented, and it
      would be the most believable invented number in the app because it would
      sit in a list of real books. A test asserts the parsed shape carries
      nothing but the book and the reason, and it is one of the tests not to
      "fix".

      **The model may only choose from books that were fetched.** It is handed
      a numbered list and answers with numbers; anything out of range is
      dropped rather than guessed at, and the parser enforces it server-side
      where a reader with devtools cannot edit it. A model asked about books
      will happily produce a plausible title that does not exist, and a made-up
      comp on a screen somebody is about to paste into a query letter is the
      worst failure this feature has available.

      The parser assumes hostile input generally, because generated text is
      neither our input nor the user's: prose preambles, code fences, bare
      arrays, duplicate ids, reasons four paragraphs long and reasons missing
      entirely are all handled, and each has a test. The one that bit during
      the build is worth keeping: scanning a bare array for `{` finds the first
      *element's* brace and silently parses one pick as the whole reply, so the
      clean parse is tried first and the bracket shapes in the order they
      appear.

      **This is the second route that sends prose**, after the assistant. The
      opening of the manuscript is what answers the question a keyword search
      cannot — does this *sound* like that book — so it goes, capped at a
      couple of pages, only on a press, and the card lists exactly what leaves
      before the button. Same shape as the feedback dialog. Images are dropped
      on the way out, and the sample is cut at a paragraph rather than
      mid-sentence, since a severed clause is a false signal about how the
      writer ends their sentences.

      *Left:* the first of the three jobs — turning the blurb and opening into
      a *better search* — is not done. `buildQuery()` still builds the query
      out of keywords, and the model only sees what that fetched. Worth doing
      when the ranking's answers show the search is what is limiting them.
- [ ] **Blurb benchmarking.** Google Books returns the real blurb of every
      published book, so the blurb tool can show five actual blurbs from books
      like yours and the average length, instead of giving advice. This is what
      makes the blurb workshop teach rather than lecture.
- [x] **Category suggestions without licensing BISAC.** Done 2026-08-01.
      `/book/[bookId]/categories`, backed by `src/lib/comps/subjects.ts` (pure,
      18 tests). Reads what comparable books are filed under and ranks it, so
      the answer comes off the shelf rather than out of a code list we would
      have to license from BISG.

      **The cleaning is most of the feature.** Raw, a live search for dragons
      answered `Fiction (20)` — true of every novel ever written — alongside
      `Protected DAISY`, `In library` and `Collection:dragonlance`, which are
      things a librarian recorded about a copy. Compound strings are split on
      both shapes the services use, Google's path (`Fiction / Fantasy / Epic`)
      and Open Library's reversed heading (`Fiction, fantasy, general`), which
      is what lets the useless half be dropped while the useful half is kept.
      The same search now answers `Dragons (14), Fantasy (14), Juvenile fiction
      (9)`. Every one of the noise terms was found in live results rather than
      guessed at.

      Two deliberate refusals. **Nothing is merged semantically** — "Fantasy"
      and "Fantasy fiction" stay separate, because every rule that folds those
      together also folds "Science fiction" into "Science". And **nothing is
      selected automatically**: each row says how many of the comparable books
      carry it, because "9 of 20" and "2 of 20" are different kinds of advice
      and the count is the only honest way to say which.

      `summarise()` in `comps.ts` now runs through the same ranking, so the
      comps screen stopped showing "Fiction" as its top subject too.

      *Left:* these are what a *librarian* files a book under, not a shop's own
      category list, and the screen says so. Matching them to KDP's own scheme
      is still the writer's job.
- [x] **A cover wall for the genre.** Done 2026-08-01. `/book/[bookId]/covers`.
      The writer's cover beside the shelf it has to sit on — the thing they
      would do themselves given a bookshop and an afternoon, which is all we can
      honestly offer when we cannot design covers and have said in public that
      we will not generate them.

      **The size control is the feature.** The wall opens at 60px, because
      nobody buys a book at the size a cover was designed at — they see it in a
      search result next to nine others and decide in about a second. A cover
      whose title cannot be read at thumbnail size has a problem that no amount
      of admiring it at full size will reveal. Larger sizes are there for
      afterwards.

      **Nothing is scored.** No palette analysis, no "34% less saturated than
      your genre". Partly practical — reading pixels off another origin's image
      needs CORS headers neither service reliably sends — and mostly because it
      would be a number invented to look like an answer. The writer looks;
      looking is the skill being lent.

      `coversOf()` in `comps.ts` (3 tests) drops books with no cover rather than
      leaving gaps in the grid, since a half-empty wall teaches that a genre has
      no visual convention, and dedupes on the image URL rather than the book —
      the two services carry different editions pointing at the same scan, and
      the same JPEG twice makes a convention look stronger than it is.
- [x] **Is this title already taken?** Done 2026-08-01.
      `/book/[bookId]/title-check`, backed by `src/lib/comps/title-check.ts`
      (pure, 10 tests). Searched with `intitle:`, unlike every other screen
      here — the comps query deliberately leaves the writer's own title out,
      and this is the one question where finding a book of the same name is the
      whole point.

      **The answer is never yes or no, and the page opens by saying so.** Book
      titles are not trademarks and cannot be copyrighted, so nothing here is
      about permission. The useful question is whether somebody else's book
      turns up first when a reader searches for yours — so it reports what is
      out there in three grades of closeness, exact first, and recent first
      within a grade, because a clash with last year deserves more attention
      than one with 1961. A leading article is dropped in the comparison:
      "The Drowned Coast" and "Drowned Coast" are the same title to anyone
      searching, and a check that called them different would miss the clash it
      exists to find.

      It gives no advice. Sharing a title with an obscure book from 1974 is
      nothing; sharing one with a bestseller in the same genre is a real
      problem; and a writer can tell those apart faster than any rule we could
      write.

- [x] **Real length targets.** Done 2026-08-01. A panel on the comps screen,
      backed by `src/lib/comps/length.ts` (pure, 8 tests), plus a new
      `setTargetWords()` in the store.

      **It returns a range, not a number, and that is the whole design.**
      Catalogues record pages, and a page is not a fixed quantity of words — it
      depends on trim size, type size and leading — so a median of 320 pages
      becomes 80,000–96,000 words at 250–300 words a page. A single figure
      derived from a page count would be a guess wearing the costume of a
      measurement.

      It also **shows the folklore beside it rather than replacing it**.
      `suggestTarget()` says 110,000 for a fantasy novel; that number is roughly
      right and nobody can name the books it came from. Printing it next to a
      figure that names its twenty is the entire argument for the feature, and
      hiding it would be claiming a victory over a number the writer never saw.

      Refuses to answer from fewer than five books, and states "under" and
      "over" as positions rather than verdicts — a book is finished when it is
      finished, and telling a writer their novel is too short is the thing this
      product exists not to do.

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

## Guiding the writer — the UI/UX pass

Written down 2026-08-02, after taking the dashboard and the tool screens through
a redesign. The goal these serve is one sentence: **a writer should never have to
work out what to do next, and should never hit a screen that cannot help them.**

Ranked. The first and third together are most of it.

- [x] **Ask an imported book what it is.** Done 2026-08-02. `/book/new` defaults
      the genre to Fantasy, so books made there were always fine.
      `createBookFromImport` sets none — and with no genre and no blurb,
      `buildQuery()` returns an empty string, which dead-ends Comp titles,
      Categories, the Blurb examples and Structure.

      Two halves, and the second is the one that was missing. **Genre is now
      editable at all**: it could only ever be set when a book was *made*, so an
      imported book had a blank there and nowhere in the app to fill it in. It
      is a field in the book-details dialog now (`setBookDetails` takes it), and
      that dialog is renamed from "Edit cover", which is what it stopped being
      some time ago.

      And the dashboard **asks**. A book with no genre is a finding on the
      Overview — "We do not know what kind of book this is", with what it costs
      written beside it and the dialog one press away. Nothing used to tell a
      writer that the blank cost them four tools.

      *Left:* `suggestTarget(kind, genre)` could fill the target length in at the
      same moment, which would close the "No length to aim at" finding in the
      same click.
- [x] **Run the check before the sign-in wall.** Done 2026-08-03. The landing
      hero carried a drawn still of the Overview screen with an invented book on
      it. It was honest and well made and it was still a *screenshot's*
      argument — here is a product, imagine it working on yours — aimed at
      readers who have been shown convincing screenshots by people who then sold
      them a course that taught nothing.

      It is now the real check. `book-check.tsx` over the pure `file-check.ts`:
      drop a manuscript, it is parsed in the browser by the ordinary
      `importFile` path, and `storeReadiness()` reports what a shop would
      refuse — same findings, same order, same words as the dashboard. No
      account, no email, nothing uploaded. Pressing any fix keeps the book in
      this browser and goes to `/signup?next=` the tool that mends it, so the
      writer lands signed in, on the right screen, with their book on the shelf;
      `syncWithServer` already uploads a library that predates the account.

      The half that was not obvious going in: **an EPUB's own metadata had to be
      read first.** A finished EPUB carries an author, an ISBN, a blurb,
      categories and a cover, and import dropped all of it — so the check would
      have opened by telling a writer with a complete file that five things were
      wrong with it, on the first screen they ever saw. `metadata.ts` +
      `epubMetadata()` + `docxMetadata()` + `cover.ts` read it, and
      `setupFromImport()` carries it into the book, which also quietly fixes the
      in-app import: an EPUB brought in through the shelf keeps its author and
      its cover now.

      *Left:* the check runs on one file at a time and says nothing about the
      prose. That is correct — the prose report is a Pro tool and this is the
      shop's own checklist — but "check another" makes a fresh card rather than
      a list, so somebody with a series compares by memory.
- [x] **Let the landing page follow the theme.** Done 2026-08-03. It was always
      light on the argument that a shop front should not change colour because
      of a setting made inside the product. Right about brand consistency, wrong
      about whose setting it is: a reader on a dark machine has told their whole
      screen how bright to be, and the one page ignoring them was the first one
      they ever saw — arriving as a white flashbang at night.

      It now reads `data-theme` off the `--color-lp-*` block in `globals.css`,
      stated in both theme blocks with the light values it shipped with, so
      daylight is unchanged to the pixel. Where the app already had a word for
      something — `fg`, `muted`, `line`, `raised`, the whole ok/note/stop family
      whose light values already *were* these reds and ambers — the page uses
      the app's token rather than restating it in hex, which is what stops the
      two drifting again.

      Two things came out of doing it that are worth not re-deriving. The accent
      needs **two values at night** (`lp-accent` for fills, `lp-accent-text` for
      type): white must sit on the fill and a link must sit on near-black, and
      no single indigo clears 4.5:1 in both directions. And a status needs a
      `-solid` for fills and a `-fg` for text for the same reason — using one
      for both gives either a pale block with white on it or text nobody can
      read. Every pair was checked by contrast rather than by eye.
- [ ] **One readiness model, not two.** Prepare says "3 to fix"; the roadmap
      says "1 of 18". Same question — is this book ready — two scores, and
      nothing reconciles them. The roadmap is the one with an opinion about
      order, so it should be the spine, and `storeReadiness()` should read as
      one phase inside it rather than as a rival number on another screen.

      The deeper of these and the one to do deliberately: it is a rethink of how
      the two screens relate, not a change to either.
- [ ] **Every tool should say what comes after it.** Finish the blurb and the
      screen sits there. `roadmapFor()` already knows the next step for that
      book, so each tool page could end with "Next: choose categories →".

      This is the whole guidance mechanism, and it is nearly free — the data
      exists and `ToolHeader` is already shared, so the footer can be too. It is
      what turns fifteen isolated screens into a path.

      *Half done, 2026-08-02:* the **dashboard** now does this. Overview's hero
      is the book's phase plus its next step as the button, so the verb follows
      the book instead of always being "continue writing", and a hand-ticked
      step can be marked done from there — which matters most for an imported
      finished manuscript, whose writer would otherwise sit at "Finish the first
      draft" forever and never reach the phases where the publishing help is.
      The fifteen tool pages still end where they end.
- [ ] **The editor and the dashboard do not know about each other.** Inside a
      chapter there is no way to reach the Prose report *for that chapter*: the
      rail has nine tabs and none of them is a tool. A writer revising has to
      leave the editor, find the dashboard, pick the book, pick the tool and
      pick the chapter again.
- [ ] **Saving is announced inconsistently.** The blurb says "saved when you
      click away". Categories saves silently. Roadmap ticks save silently.
      Adjacent screens give different answers to "did that stick?".
- [ ] **The export screen is a different app.** Its own wizard chrome, no
      breadcrumb, no book chip, no way back to Tools — the one screen that
      skipped the shared `ToolHeader` when the other fourteen took it. Decide
      whether it joins them or stays deliberately its own thing.

**Not checked, so not claimed.** Mobile at any width, keyboard and screen-reader
flow, and whether the tool pages survive a narrow window. The dashboard rail is
`hidden md:flex` with a `<select>` fallback that has never been looked at.

## Taken out on purpose

- **The light/dark theme,** removed 2026-08-01 at the owner's request. It is one
  commit in the history if it is ever wanted back — search for the one that
  removes `ThemeSync`.

  What went with it: `theme` in `Prefs`, the `Theme` type, `theme-sync.tsx` and
  the already-unused `theme-toggle.tsx`, the pre-paint bootstrap script and
  `suppressHydrationWarning` in `layout.tsx`, the editor rail's toggle, the
  `:root[data-theme="dark"]` token block, and the `[data-theme="light"]` block
  that only existed so the landing page could opt *out* of dark.

  Two things this bought. Six chrome classes (`.nav-chrome`, `.panel-chrome`,
  `.shelf-sidebar`, `.auth-ground`, `.auth-aside`, `.shelf-hero`) were written
  as a dark base plus a `:root:not([data-theme="dark"])` override — the light
  rule was the real styling and the base was the fallback, which is a
  confusing shape to read. They now state their colour once. And the
  `[data-theme="light"]` block carried a standing hazard, recorded in its own
  comment: *"this block has to be kept in step with @theme by hand"*.

  **And then it came back, greyscale, on 2026-08-02** — also at the owner's
  request, and in three steps in one sitting: the whole app was repainted black
  and white, then the status badges and the tool marks were given their colour
  back, then a System / Light / Dark toggle went in and the light half was
  written to match.

  What is there now: one greyscale palette in two value-sets, the dark one in
  `@theme` and the light one in `:root[data-theme="light"]` under it, with the
  two rules that keep them in step written at the top of the block.
  `prefs.theme` is `system | light | dark`, "system" is resolved before CSS sees
  it, and `ThemeSync` listens to `prefers-color-scheme` so a machine turning
  dark at sunset takes the app with it. `--color-accent-ink` is the black-or-
  white that sits on a filled action. The unpicked page follows the theme.

  Two families keep their hue and neither is decoration — the status tokens
  (`ok` / `note` / `stop`, plus `danger`), where the colour *is* the
  information, and the fifteen tool marks, which are product marks rather than
  chrome.

  **Do not add `dark:` variants.** They key off `prefers-color-scheme`, so they
  ignore a writer who chose against their system — which is the whole point of
  the setting.

  *Left:* the orphaned landing components still hold the old blue design, and
  the landing page itself states its greys literally, so it stays dark in both
  themes. The print/PDF output is untouched and still black on white, which is
  correct for paper and worth not "fixing".

## Built, but held back on purpose

Two features are complete, tested, and have **no way in**. They were shelf
buttons pointed at an "Available soon" dialog; on 2026-08-01 the buttons were
removed too, at the owner's request, so nothing reaches the code now.

**Neither feature was deleted** and neither is dead code. Do not tidy them away:
adding a rail item that opens the real dialog is the whole of switching either
on. The "Available soon" dialog itself (`coming-soon-dialog.tsx`) is likewise
kept — it has no callers at the moment and is the thing to reach for the next
time something ships half-ready.

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

- [x] **The two rows the pricing page promised.** Done 2026-08-03, by
      deleting them. "Books 50" and "Imports 10 files" were never enforced
      anywhere — nothing counted a shelf or an import — and wiring the
      counters would have been building a limit to keep a sentence honest,
      which is the wrong way round. Neither limit is part of the plan now:
      books and imports are unlimited on both sides, which is what the code has
      always done. Every row on that page is true of the app again.

- [x] **A new plan, and a lifetime tier.** Done 2026-08-03.
      $9 monthly, $72 a year, **$199 once**. `plans.ts`, a migration widening
      the two `period` CHECK constraints, and gates moved to match.

      **The lifetime tier exists because this market does not subscribe.**
      Scrivener is $59.99 bought once, Atticus $147, Vellum $199–250,
      Publisher Rocket $199 — all one-time. A writer comparing us against
      those is being asked to accept a model the category has trained them to
      distrust, and no amount of being cheaper answers that. The outright
      purchase sits in the billing toggle beside the cycles, where the
      objection is formed.

      Four things about it are load-bearing, and each is a real failure if
      missed. **PayHere is sent no `recurrence` and no `duration`** — those
      two fields are the whole of what makes a charge repeat, so shipping them
      against a $199 order would bill somebody $199 a month; `recurrenceOf`
      returns null and the checkout spreads the keys in conditionally rather
      than setting them empty, because an empty string is still a field.
      **`periodEnd` returns null**, since a far-future sentinel would have
      every screen tell a writer their outright purchase renews in 2999.
      **`isPro` checks the period before the missing-date guard**, or every
      writer who paid would be refused — that guard reads a null end as "the
      first payment has not landed". And **`canCancel` is already false** for
      it, because PayHere issues no subscription id for a one-off; do not
      loosen that, since offering to cancel something bought outright is
      offering to take it away for nothing.

      **The split is by what a row costs to run and who it is for.** Writing a
      book and getting it out stays free and whole — unlimited books, every
      import, all four exports, sync, the check and the roadmap, comps, blurb,
      categories, covers, structure, progress. Every competitor charges for
      formatting, so giving it away is the wedge, and the landing page has
      promised it in those words since it was written. Pro is the metered
      routes and the business layer: money, readers, the curve, the evidence
      document, the prose report, and the series read of the story bible.

      **Bookmarks came off Pro.** It was the weakest paid row the app had —
      a filtered view of stars already set, computed in the browser, gated by a
      client-side check on data sitting in `localStorage`. A paid feature whose
      gate is visibly decorative teaches a reader that the rest are too.

      *Left:* the enforcement is uneven and the pricing page's own comment now
      says which is which. Four rows are checked server-side by `requirePro()`;
      the rest are computed in the browser and gated there. That is normal for
      local-first software, but it means **the honest hard lever is syncing the
      Pro data** — the ledger, the ARC list and the bible do not sync at all
      yet, and building that sync as Pro-only would move those rows behind a
      check a reader cannot edit. A free-tier book limit on sync was considered
      for this and rejected: it undermines the one promise this product cannot
      afford to weaken, which is that your books are safe here.

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
