# OpenChapter — what's next

Last updated 2026-08-10. Ordered roughly by value, not by effort.

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

- [x] **Co-writers.** Done 2026-08-07. Some books have two writers, and until
      now the app could not express that at all: every row in the library schema
      carries `owner uuid` and every policy on it was `auth.uid() = owner`, so a
      book was reachable by exactly one account.

      **Two roles, and the second is deliberately the last.** `editor` writes the
      manuscript, `viewer` reads and exports it. The standard third rung across
      this trade is a *commenter*, and it is absent because there are no comments
      in this app — a role that cannot do the one thing its name promises is worse
      than a role that does not exist. Reedsy is the cautionary case: three
      advertised permission levels, one enforced.

      **Seats are per book and count the owner** — 2 free, 10 on Pro, from
      `SEATS_PER_BOOK` in `free-limits.ts`. Deliberately not a spend: a seat is
      current occupancy and comes back when somebody is removed. The number is
      enforced in SQL under a row lock (`invite_book_member`,
      `accept_book_invite`), because two invitations racing each other each see
      the other's absence and both get in. The *number* stays in TypeScript,
      since it needs `isPro()`.

      **One bug here would have shipped on the go-live configuration.** Fixed
      2026-08-10. `seatsFor()` asked **PayHere's** `isBillingConfigured()` to
      answer "is anything for sale at all" — the branch that hands out Pro's
      seats when nothing can be bought, so a self-hosted copy is unlimited. With
      Paddle set and PayHere unset, which is exactly what going live means, that
      reads false and **every free owner got 10 seats instead of 2**. It now asks
      `billingConfigured()` from `provider.ts`, which is the gateway-neutral
      question the comment above the line already claimed it was asking. The
      other three callers of PayHere's version are its own webhook, its own order
      creation and its own checkout page, and are right to ask it.

      **The line is drawn at the book, not the prose.** An editor writes chapters,
      bodies and notes; the `books` row, the cover and the listing details stay the
      owner's. That is not caution — `last_opened_id`, `last_opened_at` and
      `position` live on that shared row and are per-writer, so an editor allowed
      to write it would overwrite the owner's place in the manuscript every few
      minutes. One sentence covers it: an editor writes the book, the owner owns
      the book.

      **A pre-existing hole was found and closed on the way.** `chapters`' insert
      check was `auth.uid() = owner`, and `book_id` is only a foreign key — so any
      signed-in account could already insert a chapter row into any book whose id
      it knew. Invisible only because reads were also owner-filtered. Making reads
      book-scoped, which sharing requires, would have turned that into injected
      chapters appearing in a stranger's sidebar. So
      `20260806000000_collaboration.sql` **drops and rebuilds** those policies
      rather than adding to them: writes are keyed on `book_id` alone and `owner`
      is derived by trigger, never accepted from the client.

      Two more that would have bitten. Those `owner` columns cascade to
      `auth.users`, so one wrong push meant **an editor closing their account
      would silently delete the owner's chapters and prose**. And `pushBook`
      upserted the *entire* chapter list on any change to the book — including a
      word count bumped by autosave elsewhere — so two co-writers would have
      silently reverted each other's renames; it now sends only the rows that
      actually changed.

      *Left:* presence ("Ann is editing Chapter 4") and the resolve-a-conflict UI.
      The data-safety half of the conflict guard is done — `chapter_bodies.rev`,
      a conditional update in `pushBody`, and a conflict set that stops
      `applyRemote` overwriting the text it preserved — but nothing yet *asks* the
      writer which version to keep. **Ownership transfer is also not built**, and
      the account-deletion hazard below still stands: `books.owner` cascades, so
      deleting an owner deletes the book out from under its collaborators.

      The invitation flow *was* exercised with two real accounts on 2026-08-10 —
      see the two entries below — so the "untested" caveat that stood here is
      gone. What that testing did not cover is two writers **editing the same
      chapter at once**, which is the case the conflict guard exists for.

- [x] **The invitation carries somebody all the way in.** Done 2026-08-10, and
      tested with two real accounts, which is what the line above was waiting
      for. A share link used to end in a paragraph: signed in as the wrong
      account it named the right address and told you to go and sign in as it,
      with nothing to press; expired, answered, or waiting on an unconfirmed
      email it said so and offered nothing at all. **Three of the seven states a
      link can resolve to were a sentence and a closed tab.** Every one of them
      ends in exactly one control now, which is the rule the screen is built on
      and the thing every large product converged on.

      So: a **Switch account** button carrying `next` *and* the invited address
      back to the invitation, because the account being signed out of is the one
      the browser will helpfully autofill. An already-accepted link **opens the
      book** rather than reporting that the token has been used. An unconfirmed
      address gets **Send it again** — the one blocked state a reader can clear
      without anybody else acting. And accepting opens the book rather than a
      card with a button to the shelf, awaiting `syncWithServer()` first so the
      page that renders the book is asked for *after* this browser has it.

      **Following the link and signing in is the yes.** `via=link`, set by the
      proxy when it turns an invitation away and by the switch button, suppresses
      the Accept card on that path only — never a check, since `acceptInvite`
      still refuses anyone whose *confirmed* address is not the invited one.

      The bug underneath it is the one worth remembering: three actions read
      `getUserById`'s `data` and dropped its `error`, so a lookup that *failed*
      became a confident false statement. `acceptInvite` answered "confirm your
      email address first" about a state nobody had established — which is how it
      and `offerFor` disagreed about one account, the page offering Accept and
      the press being refused. `declineInvite` was worse: it fell through to
      matching `invited_email = ""`, hit no rows, raised no error, and reported an
      invitation declined **when nothing had happened**. One `accountFor()` helper
      checks the error and returns null; each caller says so in its own words.

      A second one found the same day and fixed with a typed constant
      (`ON_THE_BOOK`): `memberFaces` and `offerFor` filtered on
      `status = 'accepted'`, and the CHECK constraint allows only 'pending',
      'active' and 'revoked'. The query was well formed, raised no error, and
      returned nothing — so the face pile drew initials for collaborators who all
      had photographs, and "you are already on this book" was unreachable. **A
      mismatched enum value in a filter is indistinguishable from an empty
      table**, which is why it passed tests, lint, typecheck and a build.

- [x] **A collaborator can take themselves off a book.** Done 2026-08-10. Only
      the owner could remove anybody, so a writer on somebody else's book was on
      it for good. Survivable while joining took a deliberate Accept; not
      survivable the moment an invite link started auto-accepting, because a
      stray link then puts a book on your shelf permanently.

      `leaveBook` is the invitee's side of `removeMember`, kept apart rather than
      sharing one function because they authorise differently: **it takes a book
      id and never a member id**, finding the row by the caller's own user id, so
      no argument anybody can pass reaches somebody else's membership. The row is
      revoked rather than deleted, like a removal — the seat comes back either
      way, and a deleted row would lose the record that this address was ever on
      the book, which the invitation's unique index needs to re-invite cleanly.

      The client follows with `deleteBook`, which is safe on a shared book
      because it refuses to push a deletion for a book somebody else owns.
      Without it the shelf holds the book until the next sync marks it "No longer
      shared" — the wording for *being removed*, which reads as a fault rather
      than as the thing just done.

- [x] **A shared book says so, and the faces are real.** Done 2026-08-10. Nothing
      on any screen said a book belonged to somebody else: `isSharedBook` existed
      in the store and had no caller. The badge is on the dashboard card, the
      book's overview and the book panel — always **above the title**, where
      GitHub puts the owner in `owner/repo`, because whose book this is has to be
      read before the name. Blue for a book you may write, `note` amber for one
      you may only read, since a viewer's editing controls are gone and the badge
      is the only thing explaining a manuscript that will not take a keystroke.

      The face pile draws real photographs where a provider gave one.
      `memberFaces()` **takes no arguments** and derives its own id list from the
      books the caller is on — a function accepting uuids would be an oracle
      returning a name and a face for any account. The caller's own face was
      already on the page, resolved server-side, so the disc that leads every
      pile paints in the first frame instead of waiting on a request for
      something we were holding.

      *Left:* only Google accounts have a photo at all, so the initial is the
      permanent fallback rather than a loading state.

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

      **It is a safety net, not an archive, and the panel says so.** A ceiling
      is what shaped it — `localStorage` was ~5MB an origin and this app lived
      near it — so history is bounded three ways: eight versions a chapter, a
      400KB budget behind that, and 1.5MB across the whole library, oldest
      evicted first. The bounds survived the move to IndexedDB on 2026-08-17
      and are no longer about the browser: eight versions of every chapter of
      every book a writer will ever own is the archive this refuses to be.
      A snapshot is taken at
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
      back to when copies need to go out (**42 days** — six weeks; it was 28
      until 2026-08-09, which was under the floor of every source and is
      written up in `arc.ts`). **What each reader actually reads**,
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
      day, not every edit. That was a storage question first, and since the move
      to IndexedDB the room is there; what is left is whether a writer wants
      every keystroke kept, which is a different question and has not been
      asked.

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
- [x] **Blurb benchmarking.** Done — the blurb screen has shown five real
      blurbs and the median length since it shipped, which is what makes it
      teach rather than lecture. This entry was simply never ticked.

      **Ranked, as of 2026-08-04.** The five arrived in the catalogue's own
      order, which is a keyword match: a search for a modern mystery handed
      back *Crime and Punishment* — a real blurb, and no use as a model for
      yours. A second press now sends the books that *have* blurbs through
      `/api/comps/rank` and keeps the five judged closest, each with its
      reason. Only books carrying a description are sent, because a pick with
      no blurb is no use as an example here.

      **The free five stay free**, which is why it is a second press rather
      than part of the first: five real blurbs off the shelf is the feature,
      having them sorted is the paid refinement. It judges against the draft in
      the box, falling back to the opening chapter — which matters, since a
      writer arrives here *because* they have no blurb, and judging on the
      blurb alone would refuse exactly the person the screen is for.
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

      *Left:* nothing. The two halves that were left are done — see below.
- [x] **The shop's own categories, and the seven keyword boxes.** Done
      2026-08-04. `src/lib/keywords.ts` (pure, 22 tests) and
      `src/lib/comps/shelves.ts` (pure, 19 tests), a Pro route at
      `/api/comps/categories`, and two sections on the categories screen.

      **Amazon's data is not available and this does not pretend otherwise.**
      Researched properly first: PA-API 5.0 was deprecated 30 April 2026 and
      shut down 15 May, and stopped taking new customers before that. Its
      replacement, the Creators API, needs an Associates account with **10
      qualifying sales in the last 30 days** — a gate nobody can pass before
      they have an affiliate business. Publisher Rocket has no special access
      either: it buys scraped data from Traject Data. Scraping Amazon is
      arguably legal in the US after *hiQ v. LinkedIn* but is explicitly
      forbidden by Amazon's Conditions of Use, breaks constantly, and puts the
      civil risk on us. So: **no search volume, no competition score, no rank,
      anywhere.** Both modules have a test asserting the shape carries none,
      and they are two of the tests not to "fix".

      **What is buildable is the form itself.** Amazon dropped BISAC for its
      own store tree in 2023; a writer now picks 3 categories from that tree
      and fills 7 keyword fields of 50 characters. The seven are the half
      nobody explains, and most are wasted: the shop already indexes the title,
      subtitle, author and series, so a keyword repeating any of them buys
      nothing. `keywordReport` counts that, plus fields over 50, the same word
      spent in two boxes, and the phrases Amazon publishes a rule against.
      Every finding names its box, because a writer looking at seven near
      identical fields cannot act on "one of these repeats your title".

      **The mapping is the second place a model earns its cost**, after the
      comp ranking. Librarian subjects to shop categories is a translation no
      table can do. Two rules hold it: **the counts are ours, re-attached after
      parsing** — asked for a number a model produces a plausible one, and a
      plausible count is indistinguishable from a real one — and **a path is
      a candidate, not a fact**, because only the shop knows its own tree. The
      screen says to confirm each in the selector. Nothing about the book is
      sent: subject names and counts only.

      **Free stays free.** The subject ranking is what a book needs to be filed
      at all; matching to a shop and spending the seven boxes well is
      optimising a listing, which is work for a book that is going out. Both
      new sections are `ProGate`d.
- [x] **Suggested keywords, and a fourth limit shape.** Done 2026-08-11.
      `/api/comps/keywords` over the pure `src/lib/keywords/suggest.ts`
      (17 tests), with the control at the top of the keyword panel on the
      categories screen.

      **What changed is the search, not our position on it.** Amazon's keyword
      matching stopped being literal in 2024 — a semantic layer now reads a
      listing for meaning, so covering the right ideas earns a book its place
      and stuffing the right strings does not. That makes the judgement worth a
      model call, and it makes the figure every competitor sells (search
      volume, bought from resellers, disagreed on between tools) *less*
      decisive rather than more. So the refusal in `keywords.ts` stops being a
      limitation. There is still no volume, no score and no rank, and
      `suggest.ts` now carries the same test.

      **The checker is the filter, which is the whole design.** Every candidate
      goes through `keywordReport()` as though it were already in a box, and
      anything raising an issue is dropped rather than truncated or repaired. A
      prompt is a request; this is a guarantee, and it means the suggesting
      half and the checking half of one screen cannot drift into disagreeing.
      Suggestions fill empty slots only, land in the draft rather than the
      store, and Undo puts the previous seven back.

      **The limit is a new shape.** Five for the life of the account — not per
      day, not per book — because this is the first thing here that costs money
      on every press: five a day would be seven hundred model calls a year per
      free account. `TotalLimit` in `free-limits.ts`, `usedTotal` in prefs,
      merged by taking the larger count rather than the sum. Its sentences may
      not say "today", "tomorrow" or "a day", and a test walks all four of them
      — this is the only allowance in the app that does not come back, and
      borrowing the daily vocabulary would be a small lie told at the moment
      somebody is refused. `useLimitGate` deliberately does not record for this
      shape: the screen calls `spendTotalUse` when a reply lands, so a gateway
      502 cannot cost one of five.

      **Nothing about the manuscript is sent** — the blurb, the genre, the
      categories and the listing's own names, all typed into form fields. KDP
      requires no AI disclosure for metadata, so there is no warning; what the
      screen does carry is *check each one is true of your book*, because a
      shop requires the keywords, title and description to describe the same
      book and a suggested trope the book lacks is a rule broken rather than
      bad advice.
- [x] **The keyword workshop, and three rules the checker was missing.** Done
      2026-08-11. `/api/comps/keywords/chat` over the pure
      `src/lib/keywords/workshop.ts` (22 tests), in a card where the one-press
      suggester's box used to be — the press moved *inside* it.

      **Two doors, because they answer different questions.** The press asks
      "give me seven from the blurb" and costs one model call; the conversation
      asks "which seven, and why" and costs one per turn. Making the chat the
      only way in would charge a writer one of three conversations for a job
      that used to cost one of five cheaper presses. So both live in one card,
      with two counters: `keywordsAi` (5, total) and the new `keywordChat` (3,
      total), the number and the wording rules taken from `blurbChat` for the
      same reason — a conversation is five to fifteen calls where a press is
      one.

      **Half of what it does is documentation, and that half is free
      everywhere else.** What a model is actually paid for here is judgement —
      which seven, given this book's own subject and what its title and
      shelves already carry. The explaining is in the prompt as *given facts*
      rather than recalled ones (seven boxes, fifty characters, combinations
      indexed, quotation marks refused, the ban list, the semantic-search
      shift), because a model answering from memory about a form Amazon has
      changed several times is the failure this feature would be judged on.

      **Same tag discipline as the blurb workshop.** Candidates arrive inside
      `<keywords>`, so a turn that answers a question has no button under it —
      every heuristic for "was that a suggestion?" is wrong somewhere. They go
      through `keepUsable`, split out of `suggest.ts` so both doors share one
      filter and the chat cannot offer a phrase the checker below it would
      flag. Empty boxes only, into the draft, Undo intact.

      **Three checker gaps closed, all from KDP's own pages rather than
      folklore.** Quotation marks are refused outright (double anywhere, single
      only when they wrap the field, so "reader's choice" is untouched). Words
      the *categories* already carry now count, matched **as whole shelf names
      rather than word by word** — a path like `Fiction / Mystery & Detective /
      Women Sleuths` taken word by word would condemn "cozy mystery with cats",
      the best keyword a cozy writer could spend a box on, and Amazon's own
      example of the rule is a shelf name repeated whole. One-word segments
      ("Fiction") are skipped for the same reason.

      **And the mechanism nobody mentions: keyword-gated subcategories.** A few
      Amazon shelves cannot be reached through the category selector at all —
      the book appears only if a keyword carries the word they are gated on
      (its own LGBT page is the plain example). The screen names the mechanism
      and links to Amazon; **the list is deliberately not shipped**, and the
      prompt forbids the model reciting one. It changes, it is published per
      genre, and a stale copy of somebody else's rules read as ours is the
      invented-data failure this screen exists to avoid. Same reasoning that
      keeps a search volume off it.
- [x] **The keyword guide — the whole method, with the model switched off.**
      Done 2026-08-11. `src/lib/keywords/guide.ts` (8 tests) in
      `keyword-guide.tsx`, opened by **How these work** beside the count.

      **It exists because the model is the part most likely not to be there.**
      A self-hosted copy has no key and the route answers 501; a free account
      spends its five and its three; a gateway has an afternoon. In every one
      of those the writer still has seven empty boxes and a book to publish,
      and a screen whose only answer is a button that is not working today has
      failed them. So everything the chat knows is also written down — free,
      offline, and reachable from the chat's own error, which is the one place
      somebody is certain to be standing when they need it.

      **A sheet, not a dialog, and the research agrees with the app's own
      precedent.** A modal is for a decision that must be made before anything
      else; a drawer is for something read *while* carrying on — which is this,
      since the form being explained is visible behind it. Same layer the
      roadmap opens a tool in: fixed, right-anchored, inset, `z-40` so a dialog
      still opens over it, a real `<button>` for the backdrop, Escape.

      **Two panes, because a guide is a list of topics and a list of
      questions.** Topics in a card down the left, the chosen one's questions
      as `<details>` on the right — the browser's own disclosure, so it needs
      no JavaScript, is announced correctly, and the browser's own find
      searches inside it. The rows are keyed on the topic, or the third
      question of a new topic arrives already open because the third of the
      last one was.

      **Every fact is the shop's, and the sheet says so with links.** This is
      the subject with more confident wrong advice attached to it than any
      other part of self-publishing, so the only honest answer to "says who?"
      is a link — including the correction of the most-quoted mistake, that
      "single words work better than phrases" is a sentence about quotation
      marks rather than general advice. No volume, no score, no rank; a test
      asserts it, because a guide is where an invented number would be *most*
      believable.
- [x] **The blurb workshop — a chat that drafts from your own answers.** Done
      2026-08-11. `/api/blurb/workshop` over the pure
      `src/lib/blurb-workshop.ts` (21 tests), in the blurb screen's rail above
      "Ask a reader".

      **The refusal moved, and it moved on purpose.** This screen said it would
      not write a blurb, and it still refuses the thing that refusal was
      about — paste your book, get a paragraph. What it does now is *ask*: who
      the book is about, what they want, what stands in the way, what failure
      costs, and the draft is assembled from the writer's own answers. The odd,
      specific details are theirs. Both failures the old note named are avoided
      by construction rather than by prompting: the system prompt forbids
      stating any fact the writer did not give, and only the *opening* is sent,
      so there is no ending to put on the back cover. The public promise is
      untouched — the landing page refuses covers and *prose*, and a blurb is
      metadata, which is also why the shops ask for no AI declaration.

      **The draft is tagged rather than guessed at.** An earlier shape asked
      for prose and tried to spot which paragraph was the blurb; a long answer
      to "why does that opening not work" looks exactly like a draft. A
      `<blurb>` tag is a signal the model either sends or does not, so a turn
      that is a question has no button. Over `BLURB_MAX` it is refused, not
      truncated.

      **Third route that sends prose**, so it carries the obligations: a line
      on `/privacy`, and the panel names what leaves above the input before the
      press. The opening is cut shorter than `rank.ts`'s and cut again
      server-side.

      **Not streamed**, and that is about deployment rather than taste: it goes
      through `askModel`, so it runs on Gemini in development and Claude in
      production without branching. Streaming would need an SSE reader for
      Gemini's REST API — the complication `ai.ts` exists to avoid. If it is
      worth doing, it belongs in `ai.ts` for both providers.

      **Three conversations free, not five, and a conversation is the unit.**
      One of these costs roughly fifty times one keyword press. Counting
      messages would stop a writer mid-brainstorm, and the interview asks four
      questions before offering anything — so the use is spent on the first
      message of a chat, and opening the panel costs nothing.
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

### Collaboration — what is left, and two hazards written down

- [x] **The database half, verified against the live project.** Done 2026-08-07,
      by script rather than by reading the migration back. Six things pass:
      `owner` is derived by trigger and a deliberately wrong value is thrown away;
      a chapter cannot be moved between books; a signed-in stranger sees no books,
      no chapters and no prose; and **a stranger cannot inject a chapter into a
      book whose id they know** — the hole that existed before this migration. All
      five manuscript tables carry the rebuilt policies and none of the old
      `*_owner_*` ones survive on them.

      Two things about testing this are worth keeping. The SQL editor connects as
      `postgres`, which **bypasses RLS** — so a policy test run there means
      nothing unless it first does `set local role authenticated` and sets
      `request.jwt.claims`. Trigger tests need no such thing, because triggers
      fire for everyone. And any check for surviving old policies must be scoped
      to those five tables: `prefs`, `library_claims` and the billing tables keep
      their `*_owner_*` policies on purpose, and a schema-wide scan reports them
      as a failure that is really the design.

- [x] **An editor, across two real accounts.** Done 2026-08-07. A free-plan owner
      shared a book with a Pro account; the invitation was found in-app, accepted,
      and the book arrived with its cover and its role. The editor added prose and
      it saved. What the database then showed is the part worth keeping:

      | | |
      |---|---|
      | chapter row filed under | the **book owner** |
      | prose row filed under | the **book owner** |
      | `updated_by` | the account that actually typed |
      | owner's `last_opened_at` | **19:33** — unmoved |
      | manuscript last changed | **20:38** |

      Sixty-five minutes between those last two is "an editor writes the book, the
      owner owns the book" made visible. The prose is stored under the *owner's*
      uuid though somebody else wrote it, which is exactly what stops the writer's
      account being deleted from taking the book with it — and `updated_by` keeps
      the honest record of authorship, which is a different question from
      ownership and rightly a different column.

      Also confirmed incidentally: the owner's **free** plan governed the seat, not
      the collaborator's Pro one; `book_covers` select for members works (the
      jacket rendered); and `rev` is incrementing, so the conflict guard is live
      rather than merely present.

- [ ] **A viewer, and a revocation.** The two still untested, and the second is
      the one that would hurt. Downgrade the collaborator to *Can view* and confirm
      the editor stops taking keystrokes and every write control goes. Then
      **Remove** them, reload their shelf, and check `books.owner` in Postgres is
      still the owner's — if the strays filter in `syncWithServer` were wrong, that
      load would re-upload somebody else's manuscript under the ex-collaborator's
      account. Use a second browser profile, not a second tab: `openchapter:owner`
      wipes the local library when a different account signs in, which is correct
      and would take the first writer's shelf with it.
- [ ] **Presence.** "Ann is editing Chapter 4", over Supabase Realtime on a
      private per-book channel, with an RLS policy on `realtime.messages` reusing
      `book_role()` — a public channel would let anyone holding a book id read
      collaborator names. This is where the largest ratio of relief to work sits:
      it turns a silent overwrite into visible turn-taking without touching the
      merge model.
- [ ] **The resolve-a-conflict control.** The guard already keeps the local text
      and marks the chapter; what is missing is the two buttons — *see their
      version* and *keep mine as a copy* (a new chapter beside it, using the
      existing creation path, so nothing is lost). Until then a conflict is safe
      but silent, which is half a feature.
- [ ] **Ownership transfer, and the hazard underneath it.**
      `books.owner references auth.users on delete cascade`, so **deleting the
      owner's account deletes the book out from under its collaborators.** That is
      exactly the Google Workspace failure the research turned up — an admin there
      must transfer ownership *before* deletion or the file goes. The cascade is
      left alone for now on purpose: changing it orphans rows with no owner to
      reach them, which is a different bug. The honest fix is a transfer flow with
      the shape Google's has — only to somebody the book is already shared with,
      they must accept, the old owner drops to editor, cancellable until then.
- [ ] **Per-chapter permissions.** Notion has publicly conceded its inheritance
      model is too coarse; ours is one book, one role. Retrofitting per-chapter
      overrides is a data migration, so decide it deliberately rather than by
      drift.

**Live co-editing is not on this list, and that is a decision.** Google Docs uses
OT; Figma uses last-writer-wins per property and says outright that it would lose
a concurrent text edit, *"because Figma is a design tool, not a text editor"*.
Doing it properly here means Yjs + Hocuspocus, one `Y.Doc` per chapter, and a
**stateful server** — which breaks the one property this whole store is built
around, that the app works on a train. A `Y.Doc` is also a different storage shape
from Tiptap JSON at a `localStorage` key, so it is not a layer on top of what
exists. Scrivener offers no collaboration at all and Atticus offers no live
editing; access control with presence and history is competitive in this market
today.

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

- [ ] **"Change book" inside every tool.** Asked for 2026-08-10. The dashboard's
      Tools area has a book picker — `Menu` with a checked row per book, in
      `bookshelf.tsx` (~1034), shown only when `all.length > 1` — and the tool
      screens themselves have none. So a writer comparing the same job across two
      manuscripts has to go **out** to the launcher and back in for every switch:
      breadcrumb → All tools → pick the book → pick the same tool again. Four
      presses to change one variable.

      **It belongs in `ToolHeader`**, which every tool mounts and which already
      draws the book as a chip with its cover — so the control has a natural home
      beside the thing it changes, and building it there gets all sixteen at once
      rather than sixteen times. The existing `Menu` and `shelfIcons.check` come
      across unchanged; this is mostly assembly.

      Three things to get right, none of them obvious:

      - **Switching must keep the tool and swap only the book**, which means
        rewriting `/book/<a>/comps` to `/book/<b>/comps` rather than navigating
        to the launcher. The tool segment is already in the URL, so it is a
        substitution rather than a lookup.
      - **`?from=` has to survive the switch.** A writer who reached the tool
        from Prepare and then changes book should still go back to Prepare — see
        `areas.ts` and the `?from=` note in CLAUDE.md. Dropping it silently
        returns them to the launcher, which is the exact errand this removes.
      - **Some tools hold an unsaved draft** (blurb, listing, ARC). Switching
        book is leaving the screen as far as the writer's work is concerned, so
        it must go through `confirmLeave` like the roadmap panel's Close, or a
        half-typed blurb vanishes with no question asked.

      Not in `ToolHeader`'s `embedded` mode: the roadmap panel opens a tool
      *over* the road for the book the road is about, and a book switch inside it
      would leave the panel and the page disagreeing about which book is on
      screen.

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

      **Reversed on 2026-08-12: the landing page is pinned to daylight again.**
      The reasoning above holds for *the app*, a room somebody works in for
      hours. It does not hold for a shop front, which is one composition: the
      grounds, the marker, the drawn screens and the closing banner were all
      drawn and measured against white, and the dark set was a second design of
      the page that nobody could hold in their head beside the first. A brand
      has one look and this is where a reader meets it.

      **None of the work above was thrown away, and that is the point of how it
      was done.** The `lp-*` tokens keep both values, because the four legal
      pages share the palette through `legal-shell.tsx` and still follow the
      theme — they are opened by writers from inside the app. What changed is
      one attribute and one selector: the light block is now
      `[data-theme="light"]` rather than `:root[data-theme="light"]`, so any
      subtree can pin a theme, and the landing page's root `<div>` carries the
      attribute. That covers the app tokens the page borrows as well as its own,
      which is why it is a scope rather than a re-point. If the argument turns
      again, deleting the attribute is the whole of putting it back.
- [x] **"The order" is a road you travel down.** Done 2026-08-13.
      `src/components/landing/order-path.tsx` over the pure, tested
      `src/lib/landing-path.ts` (17 tests). The five phases are stations on one
      curve, a marker rides it as the reader scrolls, and the station it has
      reached is at full strength while the rest sit at a floor.

      It was a two-column split — a paragraph beside a boxed list of five rows
      — and a boxed list is a picture of the very thing this page says nobody's
      problem is. What a writer is short of is not five names, it is the road
      between them and where on it they are standing.

      **The technique, since three are in circulation.** `getPointAtLength` on
      a real path driven from a scroll handler, which is the long-standing
      scrollytelling one: the browser solves the curve, so the marker is on the
      line by construction. CSS `offset-path` with a scroll-driven timeline is
      the right answer one day and not yet — still flagged in Firefox, and it
      places the marker only, while the dimming is a function of the same
      progress, so there would be two sources of truth for one number. An
      `IntersectionObserver` per station answers a different question: three
      stations can be *in view* at once and a marker cannot be in three places.

      Four things worth not re-deriving:

      - **The curve is drawn through measured station positions**, never a
        hand-written `d`. That is what lets one code path serve the phone,
        where the stations stack down a rail, and the desktop, where they
        alternate across a lane.
      - **The marker's vertical position *is* the reading line** — progress is
        the line's position inside the section, so `progress × height + top` is
        the line itself and the marker cannot appear to lag the scroll. Pacing
        is therefore controlled by row height alone: it felt frantic at four
        hundred pixels a station and reads properly at `min-height: 30rem`.
      - **The stations must alternate exactly** and stay inside the empty
        middle column. A cubic whose control x equals its endpoints' x cannot
        overshoot, and perfect alternation is what zeroes those arms — two
        stations on the same side running would bulge the curve into a
        sentence.
      - **The layout is in `globals.css`, not in utilities**, because
        `md:grid-cols-[minmax(0,1fr)_18%_minmax(0,1fr)]`, `md:min-h-[27rem]`
        and `md:max-w-[24rem]` all produced *no CSS at all* — the standing
        Tailwind v4 hazard — which collapsed the row to one column and drew the
        road straight through the prose. A layout whose correctness depends on
        a rule existing does not belong where the rule can vanish quietly.

      The road sits on `--color-lp-road`, a fourth decorative ground. Green is
      the `ok` end of the status family here, so it is held at the card tints'
      saturation on purpose: a saturated green field would tell somebody who
      has not started that the road is finished.

      **Each station also shows the screen it is talking about**
      (`phase-screens.tsx`), in the column its words are not in — the road on
      its own named the order and never showed the software, so a reader who
      has not been inside the app finished the section knowing the sequence and
      nothing else. Three of the five are computed rather than drawn from
      memory: the writing and revising screens both run the real
      `proseReport()` over one fixed passage, so the word count on the page and
      every finding on the report are what the checker actually returns; the
      advance-copy screen reads `STATUSES` and `LEAD_DAYS` out of `arc.ts`, so
      its five states and its "6 weeks" are the tool's own; and the publishing
      screen filters `DESTINATIONS` the way the export dialog does. The passage
      is deliberately flawed in the ways the report looks for — a clean sample
      would draw an empty report, which is a picture of a checker that does not
      work.

- [x] **The three refusal bands show the screen that catches each one.** Done
      2026-08-12. `src/components/landing/refusal-figures.tsx`, drawn beside the
      words in `Rejection`, sides alternating down the page.

      Both halves of those bands used to be words: the injury on the left, a
      panel on the right headed "What this does about it". That is a claim
      answered by another claim — on the one part of this page that is about the
      reader's problem rather than our solution to it, for a reader whose whole
      history is of being told things by software that could not do them. The
      proof went to a drawn screen, and the three settled as **cards rather
      than bands**: one section holding three tinted panels, each with a badge,
      a title, a couple of sentences and the same link back to the check at the
      top of the page, the screen beside it. They were full-bleed bands with
      alternating grounds and the figure changing sides, which gave each
      refusal the weight of a chapter — three chapters is more than this idea
      is worth to a reader who has not yet been told what the product does.

      Two shapes were tried in between and both are worth not repeating. A
      matched problem/solution pair — two badges, two titles, two paragraphs —
      is a page inside a card at this width. And blending the two into one
      paragraph loses the reply: the sentence about *this product* arrives
      halfway down a paragraph about Amazon with nothing marking it. What
      works is one description that names the problem and answers it in the
      same breath, with the detail on the screen beside it.

      **The three grounds are the page's only decorative colour**, and they are
      documented as an exception at `--color-lp-card-*` — grounds only, never
      ink, never a control, and held near 4% saturation so the middle card does
      not read as amber. The figures wear the **pale ring**, not the bezel: they
      had the bezel while these were bands on white, and a bezel inside a
      tinted card is two frames around one screen.

      **Two of the three are computed rather than drawn from memory**, which is
      the shape to copy. The covers figure runs `coverReport()` over a fixed set
      of measurements — a 500 × 800 PNG, the ordinary shape of that mistake — so
      every row, every label and the counts in "2 things a shop would refuse ·
      6 checks" are the checker's own answers; change a rule in `cover-check.ts`
      and the picture changes with it. The export figure filters `DESTINATIONS`
      the way the real dialog does, so it cannot name a shop the export does not
      reach. Only the listing figure quotes strings, because that form's copy
      lives inside `publishing-card.tsx` — and its ISBN is the field's own
      placeholder with the last digit moved by one, so it really does fail the
      check digit the screen would run on it.

      Two small things worth not re-deriving. There are now two pictures of the
      listing form on the page and that is deliberate: `store-listing-demo.tsx`
      shows it filling in, this one shows it *refusing*, which is the only thing
      refusal 02 is about. And refusal 03's mark had to stop being a tick —
      drawn in `STOP` it sat four lines above the green tick on "What this does
      about it", one glyph carrying two opposite meanings.
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

- **The export wizard's four-pane review** — the way in came off on
  **2026-08-17** at the owner's request, to be put back once the panes
  themselves are fixed. The owner asked to be reminded of it, so it is here and
  in the assistant's memory both.

  **What changed.** The **Preview** button on the wizard's action bar opened
  `PreviewSheet` — a full-window layer holding `ReviewPane`'s four panes, each
  building the *real* artifact: the PDF fetched from `/api/export/pdf`, the
  `.docx` built and read back through `docx-preview`, the `.epub` built and
  opened as a zip, and the Markdown as it would be written. In its place the
  wizard has a **Preview step**, one station before Export, mounting
  `BookPages` — the reading view's flip-book of the book's own pages.

  **Nothing is deleted.** `preview-sheet.tsx`, `review-pane.tsx` and
  `epub-preview.ts` are whole, still tested and now callerless, the standing
  `templates-dialog.tsx` has. Putting them back means restoring a `preview`
  state and the `PreviewSheet` mount in `export-page.tsx`, plus a way in — and
  the decision to make then is whether they replace the Preview step or sit
  beside it. The comment above `stepsFor`'s preview entry records why the step
  is a step.

  **Three consequences of the swap, and they are what has to be weighed when it
  returns:**

  1. **The reading view is the book, not the file.** It sets the manuscript on
     real page sheets through the same `toBlocks` → `blocksToXhtml` path the
     exporters use, so the prose and the page breaks are right — but it is not
     the EPUB, not the `.docx` and not the PDF, and it cannot catch what the
     packagers do. Nothing a shop's ingestion breaks on is visible in it.
  2. **So nothing here names a format.** The old button said "Preview EPUB"
     beside "Export EPUB"; the step's deck says *your book on its pages*,
     because the old label over a page of the manuscript would be a claim the
     code cannot back.
  3. **And it is no longer conditional on a format being chosen.** The panes
     depended on the pick; the book does not.

  **A link out is not the shape to reach for.** Briefly on the same day Preview
  was a `<Link>` to `/book/<id>/read?from=export`, and it cost the wizard's
  memory: `output`, `typeset`, `manuscript` and `stepId` are component state
  persisted nowhere, so leaving the route dropped the writer's format,
  template, trim and front-matter switches and landed them on step one.
  Whatever replaces the step has to stay inside the flow, or the wizard's state
  has to be persisted first.

  **Two things the panes were the only check for**, and neither has a
  replacement today: that every EPUB document parses as XML before it reaches a
  shop (`epub-preview.ts` runs each through `DOMParser`, which is
  `stripInvalidXml`'s only test from the outside), and that the cover page —
  a document that exists only in the package — is really there. Whatever
  replaces the panes owes those two.

- **The Markdown export** — marked **Soon** on **2026-08-16** at the owner's
  request, to be switched back on once it ships as a folder rather than a file.

  **Nothing is deleted.** `buildMarkdownFile`, `blocksToMarkdown`, their tests
  and the review pane's `MarkdownReview` are all whole and still exercised —
  the format is simply not selectable. Switching it on is deleting `soon: true`
  from its entry in `FORMATS` (`export-page.tsx`) and putting back the claims
  listed below.

  **Why it went.** The text half is correct. What is not is a book with a
  picture in it: `blocksToMarkdown` writes the image into the file as a base64
  `data:` URL, which makes a small book an enormous file and does not reliably
  display — GitHub and many parsers refuse a `data:` image outright, so the
  writer gets a wall of code where a picture should be.

  **What it comes back as**, from a search of what the field does:

  - **Notion** exports a zip of the markdown plus an `assets/` folder. Its one
    wart is worth avoiding — its image paths are relative to the zip root, so
    they break the moment the `.md` is moved out. Use paths relative to the
    file.
  - **Bear** and **Ulysses** use **TextBundle** (`textbundle.org`), which is
    the same idea standardised: a folder holding `text.md`, `info.json` and
    `assets/`, zipped as `.textpack`. More correct, but almost no writer has
    heard of the extension, and a file nobody can open is not a handoff.
  - **Obsidian** does not do it built-in; its most-installed export plugin
    exists to add exactly this, which is the tell that the base behaviour was
    wrong.
  - **Scrivener** is the counter-example: its markdown export drops images
    altogether. Silently losing part of the book is worse than either.

  So: a plain `.md` when the book has no pictures, a zip of `book.md` plus
  `images/` when it has. `epub-images.ts` already lifts `data:` URLs into real
  files for the EPUB, so the hard half exists.

  **What was reworded and has to come back with it** — every one of these named
  Markdown as a shipping format, and the house rule is that nothing claims what
  the code cannot back:

  - `plans.tsx` — the Exports row: detail was "EPUB, DOCX, PDF, Markdown" and
    both plan cells said "All four"; now three. Its two comments too.
  - `landing-page.tsx` — the shop-refusal answer ("with DOCX, PDF and Markdown
    beside it"), the privacy claim ("all four exports"), two FAQ answers, the
    "back out in four formats" lead, and the mosaic's "exactly seven
    destinations" comment.
  - `works-with.tsx` — the **Obsidian** entry left `DESTINATIONS` with it,
    since a destination there needs an export that opens in it. Its mark and
    licence note go back in the same commit.
  - `help-dialog.tsx` — the Formats entry, and the free-plan paragraph.
  - `free-limits.ts`, `privacy/page.tsx`, `terms/page.tsx` — "all four
    exports" / the format lists.

- **The landing page's "Not built yet" section — "What comes after that"** —
  removed **2026-08-14** at the owner's request. The owner asked to be reminded
  of it in future sessions, so it is here and in the assistant's memory both.

  It was three dashed cards under a centred header, each headed **Not built**,
  over the lead: *"Listed so you can hold us to the difference between a plan
  and a product. No dates: a date is a promise with a number on it."* `LATER`,
  the array behind it, was deleted with it rather than kept callerless — three
  strings and a `.map` is the case CLAUDE.md distinguishes from
  `templates-dialog.tsx`, and an unused const buys nothing but a lint warning.
  So the entries are kept **verbatim here**, which makes rebuilding it a paste:

  1. **A real print-ready PDF** — "Today's PDF is the browser's print engine,
     which we say wherever it appears: no bleed, no crop marks, no CMYK. A
     printer's file needs a real PDF library and is a project of its own."
  2. **Sales reports without a detour** — "Track reads CSV, and KDP downloads
     .xlsx — so today you open it and save it again. Reading the spreadsheet
     directly is the whole of the difference."
  3. **Your tools on your second machine** — "Your books and chapters sync. The
     ledger, the story bible and the advance-copy list do not yet, so a writer
     on a laptop and a desktop keeps two of each. Every screen with one says so
     on it."

  **What went with it, and it is the part worth not re-deriving.** The section
  enforced a rule that fails quietly: *nothing stays under that badge once it
  ships.* The list had carried the series bible, ranked comps and the
  book-three curve until each landed, and a page still promising a shipped
  feature says something untrue in the one section whose whole job was being
  trustworthy about the difference. It also had a companion rule — when
  something comes off, put something real in its place rather than shortening
  the list, because three honest absences buy more than two.

  With the section gone there is nothing to walk when a feature ships, which is
  a maintenance burden lifted. The exposure it leaves is the mirror image:
  **an unbuilt feature named anywhere on that page is now a promise with no
  section admitting it is one.** All three absences above are still stated
  where they actually bite — the PDF's limits wherever the PDF is named, and
  the tool stores' not syncing on every screen that has one — so the page is
  honest as it stands. Rebuilding the section is the answer if that ever stops
  being true.

- **Refusal 01's computed figure — `CoverCheckFigure`** — replaced by a
  photograph of the covers screen on **2026-08-14** at the owner's request.
  Settled rather than owed, but it is the most expensive of the page's five
  bitmaps and the cost belongs here as well as beside the code.

  It was not a *drawing* of that screen. It **ran `coverReport()`** over a
  fixed 500 × 800 PNG, so every row, every label and the count in its summary
  line were the checker's own answers — change a rule in `cover-check.ts` and
  the picture changed with it. It could not go stale because there was nothing
  in it to drift. `CoverCheckShot` in `landing-page.tsx` can, in the usual way:
  **when the covers screen moves, nothing fails and nothing warns — the picture
  starts lying.** Re-shoot `public/cover-check-screen.webp` when the deck, the
  check rows or their wording change, and especially when a rule is added to
  `cover-check.ts`, since the shot's own caption counts seven checks. Shoot it
  at about **1.3:1** — the window is `fill`ed to the row's height like the
  other two, and a wider crop leaves a band of white glass under it that reads
  as a screenshot which failed to load.

  The component is kept whole and callerless in `refusal-figures.tsx`, so
  putting the computed version back is one word at the call site. Two details
  in the replacement are deliberate and easy to undo by accident: it is the
  only figure in that section with the **black bezel** (a photograph already
  carries the app's own white card in its pixels, so a pale ring on a tinted
  card reads as a rectangle of the wrong background), and it is **lossless
  WebP served `unoptimized`** — `next/image` at its default quality 75 fringes
  every letter of a screenshot of type, on the one figure whose job is that
  the checks in it can be read.

- **Two landing sections — "Three phases. Writing is one." and the "Before you
  upload" panel** — removed **2026-08-14** at the owner's request. Settled
  rather than owed: nothing in either is missing from the page.

  **"Three phases" (`id="does"`)** was three cards — Write, Prepare, Track —
  each counting its own group of tools, over the claim that most software stops
  when the draft does. That claim is now made by the order rows, whose writing
  phase carries it in as many words. Gone with it: the `Phase` component and
  the `WRITE` and `PREPARE` copy arrays, which nothing else counted (`TRACK`
  stays — the Track section draws four of its five). The **nav lost its "What
  it does" entry in the same commit**, because a link to an id that is not on
  the page scrolls nowhere.

  **The "Before you upload" panel** was a warm-paper band holding `CheckDemo`
  at full width under a two-column header. Its three parts were distributed
  rather than deleted: the **demo** is the figure for phase 02 in "The order";
  the **header shape** (eyebrow and heading left, lead right) is what the
  listing section uses; and the **claim** — that a refusal is slow, silent and
  never says which of a dozen things was wrong — is what the three refusal
  cards say, by naming the three. `CheckDemo` itself is untouched and is now
  rendered once rather than twice.

  What is now unused and left alone: `--color-lp-paper` and the
  `lp-paper-accent*` pair in `globals.css`. Nothing on the page is warm paper
  any more, but a token stated in one theme block and not the other is the bug
  that file warns about, and these are stated in both.

- **The audiobook export — text read aloud,** removed **2026-08-14** at the
  owner's request, **to be switched back on later.** The owner asked to be
  reminded of it in a future session, so it is here and in the assistant's
  memory both. Nothing was deleted: this is a removal of the *way in*, the
  standing `templates-dialog.tsx` and `ambience.ts` already have.

  **What is kept, whole and callerless.** `/api/narrate/route.ts` (still
  `requirePro()`, still chunked), `src/lib/export/narrate.ts` **with its tests
  still running** — `speechChunks` is the expensive part and cuts at the largest
  boundary that fits, because a break mid-clause is audible — `export/
  audiobook.ts` (the per-chapter zip, the progress callback, `NarrationError`),
  `AudiobookPreview` and its badge in `format-previews.tsx`, and the
  `"audiobook"` arm of `DoneFormat` in `export-done.tsx`. Do not tidy any of it
  away.

  **What came off.** The Audiobook row in `FORMATS`; the `Output = Format |
  "audiobook"` union and every branch that read it (the export step's title and
  deck, the "Read by a speech model" note, the narration state and the
  `narrate()` handler, the footer's Read-aloud primary, the progress line and
  its error); and the `.zip` arm of `exportFilename`.

  **Four claims elsewhere were reworded in the same commit**, because a feature
  with no way in that a page still advertises is the failure the house rules
  will not have: the pricing table's row (now **"Audiobook import"**, which is
  the transcription half and is still true), the Pro card's blurb, the PayHere
  success message, and the Help dialog's Plans entry. The privacy page's
  **Narration** disclosure came off with it — nothing can reach the route, so
  nothing is sent, and naming a transfer that cannot happen is as wrong as
  missing one that can. Putting the feature back means putting that entry back
  in the same commit.

  **Note the import half is untouched.** Audio → text (`/api/transcribe`, the
  shelf's Audiobook import) is a different feature and still shipped.

- **Everything in Advance copies that worked out what was *late*,** removed
  **2026-08-13** at the owner's request, **to be built again later.** This one
  is *owed a rebuild* rather than settled — the owner asked to be reminded of
  it in a future session, so it is here and in the assistant's memory both.

  **What went, all five of it.** The `late` count from the tool's stat row
  (four boxes down to three); the row treatment — an accent border on an
  overdue card, plus the "N days late" beside its date; the dashboard's amber
  **"N advance readers are past their date"** panel, with the per-book read and
  frozen clock that fed it; the red `N late` flag on each row of the Track
  area's book list; and `ArcSummary.overdue`, which every one of those was
  computed from. `sortReaders` lost its late-first branch with them.

  **What was kept, and must not be tidied away.** `isOverdue` in `src/lib/arc.ts`
  is whole, exported, **called by nothing**, and still covered by its three
  tests — the same standing as `templates-dialog.tsx` and `ambience.ts`. It
  holds two decisions the rebuild would otherwise have to make again and could
  easily make differently: a reader who **reviewed or declined is never late**
  however old the date, and **silence is** — because silence is the one state
  left that chasing can still change. Start there.

  **Three consequences worth knowing before rebuilding.** The list still sorts
  by date, so a reader whose date has gone still arrives at the top — a passed
  date is simply the earliest date — and the only thing lost is that a
  *reviewed* reader with an old date now floats up with them. The Track area's
  "advance copies out" note counts what came back (`N reviewed so far`) where
  it used to count what was overdue. And three places that *described* the tool
  as tracking lateness were reworded in the same commit, because a claim the
  code cannot back is the one thing the house rules will not have: the tool's
  own line in `book-tools.ts`, the Help dialog's entry, and the landing page's
  tools list. Whatever comes back has to put those three right again.

- **The landing page's order road,** replaced **2026-08-13** at the owner's
  request with alternating feature rows (`order-rows.tsx`), to the layout of
  the reference they supplied. `order-path.tsx` and the pure, tested
  `landing-path.ts` behind it are **left in the tree and imported by nothing**,
  the way the previous landing design was — `landing-path.test.ts` still runs
  and still passes, and the curve arithmetic is the expensive part to rebuild.

  **What the road was, and what the rows owe it.** Five phases as stations on
  one drawn curve, with a marker riding it as the reader scrolled: the station
  being read at full strength, the rest at a floor. Its argument was that a
  writer is short of the *sequence* rather than of five names, which a boxed
  list of phases cannot say. The rows have to keep making that argument by
  other means, and three things do: the phases are numbered in the eyebrow,
  each says how many steps it holds, and the ARC callout still quotes its
  step's real number and phase. Take those away and this is the boxed list the
  road was built to replace.

  **What the change bought.** `OrderRows` has no `"use client"` and ships no
  JavaScript. The road needed measurement on mount, a scroll handler, a
  `ResizeObserver`, a `document.fonts.ready` re-measure and a reduced-motion
  path, and its `d` came out empty if any of that did not run — which cost real
  time to diagnose more than once. It also freed the notes: the road sat on a
  tinted green field where `lp-deck` measured 4.16:1 and had to fall back to
  `lp-body`, and the rows are on white where the deck grey is legal.

  If the road ever comes back, the three numbers that were one calculation are
  the lane width in `.oc-road-row`, the cap on `.oc-road-words`, and the `at`
  values — git history has them in step at 16% / 30rem / 0.45–0.55.

- **The landing page's "What writers said" row,** removed **2026-08-13** at the
  owner's request, **to be added back later**. Unlike the counted band below,
  this one is *owed a replacement* rather than settled — record it here so the
  rebuild does not start from a blank slot and quietly become the thing the row
  was built to avoid.

  What it was: the slot a landing page fills with customer testimonials,
  holding the **research** instead — four real things writers said about the
  *problem*, said to somebody else before this existed, each with the module it
  caused underneath it (`roadmap.ts`, `money.ts`, `cover-check.ts`,
  `ideas.ts`). The `VOICES` const and its long note went with it; git history
  has both, and the quotes themselves are still in the modules they caused.

  **The four rules it kept, which any replacement owes.** Nobody is named and
  nobody is described — real quotes, anonymous sources, no invented "Sarah M.,
  fantasy author", because attaching a face is the part that makes it a lie.
  The section says what they are *above* the quotes, so a reader who takes only
  the heading has still been told these are not customers. They are quoted
  rather than paraphrased, and each is recorded in the module it caused, which
  is what made it checkable like everything else on that page. And each carries
  what was built about it — a quote about a problem with nothing under it is
  decoration.

  When there are real writers using this and willing to be quoted, they replace
  it, with names and with their permission. Until then the slot stays empty:
  the page's standing rule is that no user count, rating or testimonial appears
  until there is a real one, and an empty slot claims nothing. The risk
  reversal that sat under the row (no card, the refund window, a reachable
  human) stayed on the page — it was never part of the row, and the refund
  window is stated nowhere else.

- **The landing page's counted band,** removed **2026-08-12** at the owner's
  request. Four figures on a row of their own under the refusals — 19 steps,
  16 tools, 4 export formats, 0 EPUBCheck errors — each imported and counted
  rather than typed, in the slot a SaaS page fills with users and downloads.

  It is worth being clear about what was wrong with it, because the *rule* it
  embodied is still in force. The figures were never the problem: they are all
  true, all counted out of the source, and all still on the page. Four numerals
  on a band of their own ask a reader to be impressed by an arithmetic nobody
  has yet given them a reason to care about — it arrives before the page has
  said what the tools are for, and a number without a stake in it reads as
  padding. Each one now sits where it means something: the steps in "The
  order", the tool count in the tools heading, the formats in the strip under
  the hero and in the footer, and the zero in "The export is verified, not
  asserted".

  The `Counted` component went with it, which is the *opposite* call from
  `subject-combobox.tsx` and `templates-dialog.tsx` below, deliberately: those
  are whole features waiting on a way in, while this was twenty lines of
  presentation whose every input is imported elsewhere on the page. Keeping it
  callerless would have bought a standing lint warning and nothing else.

  **The rule survives the row**: nothing may go in that slot which cannot be
  counted out of the source, and no user count, rating or testimonial goes
  anywhere on the page until there is a real one. Both `CLAUDE.md` and the
  header comment in `landing-page.tsx` now state it as a rule about the page
  rather than about that band.

- **"On this book" — the categories half of the categories screen,** taken off
  on **2026-08-11** at the owner's request, who is writing another version of
  it. **This is a rebuild waiting to happen, not a cut**: raise it if the
  categories screen comes up and nothing has replaced it yet.

  What went: the heading, the three-shop "Every shop asks" chip, the *n* chosen
  count, the token field holding the chosen categories, the quick-add row off
  `COMMON_SUBJECTS`, and the two footnotes at the foot of the page (the
  librarian-subjects caveat and the note about Amazon's keyword-gated
  subcategories). The seven keyword boxes and the workshop beside them are
  untouched and are now the whole of that screen.

  What was kept, and must not be tidied away:
  **`src/components/categories/subject-combobox.tsx`** — the picker itself,
  moved out whole and exported with nothing calling it. It is the expensive
  part of any replacement: the debounce with last-reply-wins, the local
  `COMMON_SUBJECTS` index answering the first keystroke that the live one
  cannot, the merge that stops rows reshuffling under the reader, and the
  keyboard handling. Same standing as `templates-dialog.tsx` and `ambience.ts`
  below.

  What still works without it: `book.publishing.subjects` is read on that
  screen (the keyword checker needs it — a keyword repeating a category is a
  box spent on nothing) and the draft still carries a `chosen` field through
  the save bar, so the new section has a store, a save and a checker waiting
  for it. The export, the EPUB and `checkup()` all read the field as before.

  **The gap, and it is the reason to finish the rebuild rather than leave it:**
  categories can only be set from the *listing* screen now, which is a
  comma-separated box in `ListingDetails` with no suggestions behind it — while
  two places still send a writer to `/book/<id>/categories` to set them. The
  roadmap's "Choose categories" step (`roadmap.ts`) and the dashboard finding
  for `subjects` (`DESTINATIONS` in `checkup.ts`) both land there, and neither
  now offers the control it promised. That is the dead-end shape those
  destinations exist to prevent. Both were left pointing where they point
  because the section is coming back; if it does not, repoint them at
  `listing`.

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

  - [x] **Apply the migration.** Done 2026-08-07.
        `supabase/migrations/20260730000000_book_publishing.sql` adds the
        `publishing` jsonb column, and until it ran the push rejected the whole
        row and listing details never left the browser. Applied alongside
        `20260806000000_collaboration.sql`, and verified the way it should be —
        not by the SQL editor saying "Success" but by reloading the app and
        confirming the `[sync]` warnings were gone.
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
- [ ] **Real print-ready PDF.** Paged.js paginates the PDF now, so the interior
      is properly set — trim size, running heads, a folio on every page, and a
      contents list whose numbers are real. What is still missing is what the
      *browser* cannot write, whatever paginates first: no bleed, no crop marks,
      no CMYK. Every page that mentions the PDF says so.
      Bleed and crop marks are the reachable half — Paged.js implements
      `@page { bleed; marks }`, and the trim numbers are already computed by the
      paperback screen; that needs verifying against a real printer's spec
      rather than assumed. CMYK is the half that cannot be reached this way at
      all: the colour space belongs to the file the browser writes. That one
      needs a true PDF library owning line-breaking and justification — which
      would likely set worse prose than the browser does — or server-side
      rendering, which would break "the manuscript never leaves the browser".
      Weigh it against KDP accepting RGB; IngramSpark is the one that asks.

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

      **Cancelling verified too, 2026-08-08.** The live sandbox subscription
      from the July test was cancelled from the account menu: PayHere's
      Subscriptions page flipped Active → Cancelled, the row kept its
      `current_period_end`, and the menu read "Cancelled — runs until Oct 1,
      2026" with the Pro chip intact — which is `isPro()` running a cancelled
      plan to its paid-up date, read straight off the row the route returns.

      Where those credentials come from is the part that cost the time, because
      it is not where the code comment said. **Settings → API Keys → Create API
      Key**, with an app name, a comma-separated domain whitelist and the
      **Subscription Management API** permission toggled on; the App ID and
      Secret then sit behind *View Credentials* on that row. **Integrations**
      (the old Domains & Credentials) is a different thing entirely — its
      "App" type is for the mobile SDK and hands back a merchant secret, not an
      App ID/Secret pair.

      One thing that lands with the live switch: PayHere IP-whitelists merchant
      API keys in the live environment, by emailing them the calling server's
      address. Vercel has no static egress IP on the ordinary plans, so
      cancelling may not work from there even though sandbox does. It fails in
      the safe direction — no working credentials means no Cancel button and
      the writer cancels from PayHere's receipt email — but ask them about it
      rather than finding out after the first paying writer tries to leave.

- [x] **A root domain, before any of this can take real money.** Done —
      `openchapterapp.com` is live. PayHere's Domains & Credentials refuses
      subdomains outright ("Sub Domains not allowed or Invalid Domain name"),
      which ruled out every ngrok URL and `openchapter.vercel.app` with it;
      sandbox only ever worked because PayHere accepts the literal `localhost`.

- [x] **Paddle, and it is verified end to end.** Done 2026-08-09. New
      checkouts go through Paddle; PayHere is kept intact beside it and
      `provider.ts` picks whichever is configured, Paddle winning when both
      are. A `subscriptions` row records which gateway sold it, so a writer who
      subscribed through PayHere keeps being cancelled at PayHere — the
      alternative is telling somebody they are cancelled while their card goes
      on being charged.

      **Tested against Paddle's sandbox, 2026-08-09**, with a real overlay
      checkout on the 4242 test card. What was verified: the transaction is
      created **server-side** (`/api/billing/paddle/checkout`) so neither the
      price nor the buyer's id can be edited by the person paying; the webhook
      wrote `provider = paddle`, `status = active`, both Paddle ids and a
      period end one month out; `transaction.completed` landed in
      `payment_events` at **10.99 USD**, which is the cents-to-dollars
      conversion working (Paddle sends `"1099"`); the `payment_orders` row our
      checkout wrote was closed to `paid`; the account menu showed Pro with the
      renewal date; and cancelling produced a **scheduled cancellation at
      Paddle** for the exact period end, with Pro intact until then.

      **One bug found by that test, and it is the reason to run one.** Paddle
      keeps a cancelled subscription at `status: "active"` until the period
      actually ends and announces the cancellation in `scheduled_change`
      instead — which is correct of Paddle, since the writer has paid to the
      9th. Our cancel route wrote `cancelled`, Paddle's `subscription.updated`
      arrived a second later saying `active`, and the webhook faithfully undid
      it: `cancelled_at` back to null, the Cancel button offered again for a
      subscription already cancelled, and a renewal promised that was never
      coming. `paddleStatus()` now reads the scheduled change **before** the
      status, and is pure and tested for exactly that. Confirmed by replaying
      the offending notification from Paddle's own log against the fixed
      handler — a real payload, not a mock.

      Worth knowing for later: the sandbox **API key expires 7 Nov 2026**
      (Paddle defaults to 90 days), and `cancelled_at` for a scheduled cancel
      is stored as the change's *effective* date, because Paddle leaves its own
      `canceled_at` null until the period runs out.

- [ ] **Live Paddle, applied for 2026-08-09 and waiting on two reviews.**
      Seller ID 397664, Sri Lanka, sole trader. What is already done in the
      live account: the product and both prices (`pro_01kzjxz78fknh3hr9dvg2rkr58`,
      `pri_01kzjy5ewf255ssnrew3fjazsk` monthly, `pri_01kzjyce7089qb9q9p315asyqv`
      yearly), the payout profile, the domain submitted for approval, and
      verification submitted.

      **Both were replaced on 2026-08-10** when the price moved to $9.99 /
      $89.99. The live catalog now holds `pri_01kznxm0d86ytgwqbnsrfzjhvy`
      ($9.99 monthly) and `pri_01kznxqx4j47kspyjt55vh0avb` ($89.99 yearly), with
      the original pair **archived** — existing transactions are untouched, and
      neither can be used for a new checkout. The ids still have to reach
      `PADDLE_PRICE_MONTHLY` / `PADDLE_PRICE_ANNUAL` in Vercel Production; see
      the entry below.

      Two things are pending and neither is ours to hurry: **account
      verification** (Paddle, ~1–3 days) and **domain approval** for
      `openchapterapp.com`. Live checkout cannot open until both pass.

      **Payoneer was the third and is abandoned.** Its activation form offers
      no Sri Lanka in the bank-country list at all, matching reports that it has
      stopped accepting new Sri Lankan accounts — money would have arrived there
      and never come out. The payout profile is a **wire transfer to Sampath
      Bank PLC (`BSAMLKLX`), in USD**, set 2026-08-10. Paddle pays out two ways
      only, wire or Payoneer, so this was the only path; PayPal was never one.
      USD because LKR is not among Paddle's thirteen payout currencies and the
      balance is USD already, so there is one conversion, done by Sampath on
      arrival, rather than Paddle taking up to 1.5% first. A plain rupee account
      receives it — **Rs 575 per inward credit** plus their TT spread, on top of
      Paddle's possible $15 SWIFT. That is 2–4% on a $100 payout and noise on
      $500, so raising the threshold above $100 is worth doing once sales are
      regular.

      Two details worth keeping. **Business verification is skipped entirely
      for a sole trader** — only domain review and identity verification run,
      which is why no BR certificate was needed anywhere in the flow. And
      **Paddle checks that the site's prices match the live catalog**, which is
      the reason the live product had to exist *before* verification rather
      than after: a pricing page advertising a figure against an empty catalog
      is a mismatch a reviewer would flag. That cuts both ways, which is why
      the price change below has to reach the live catalog rather than only the
      site.

      Still to do once approved: a live API key (**make it non-expiring** —
      the sandbox default of 90 days would silently break checkout), a live
      client-side token, a notification destination at
      `https://openchapterapp.com/api/billing/paddle/notify` with all events,
      the five `PADDLE_*` values in Vercel's **Production** environment with
      `PADDLE_ENV=production`, and one real payment, cancelled and refunded.
      Until those are set, production quietly falls back to PayHere, which is
      the right state rather than a broken one.

- [ ] **Carry the new price ids into the sandbox and the environment.**
      `plans.ts` moved to $9.99 / $89.99 on 2026-08-10 and the **live** catalog
      was re-priced with it, which is the half that mattered for the review —
      Paddle checks a site's figures against its live catalog. Two pieces are
      left:

      - **The sandbox catalog still holds $10.99 / $99**, so local testing
        charges what the page no longer advertises. Same shape as the live fix:
        two new prices, the old pair archived, the ids into `.env.local`.
      - **`PADDLE_PRICE_MONTHLY` / `PADDLE_PRICE_ANNUAL` in Vercel
        Production** want `pri_01kznxm0d86ytgwqbnsrfzjhvy` and
        `pri_01kznxqx4j47kspyjt55vh0avb`, alongside the rest of the go-live
        values above. A **redeploy** is needed either way, since the figure on
        the page is inlined at build time.

      **The rule for any future move: add prices, do not edit them.** A price is
      referenced by id and an existing subscription stays on the one it was
      bought at, so editing in place muddles the record of what somebody agreed
      to pay. The $89.99 row is the one exception and only because it had been
      created minutes earlier and never sold. Descriptions carry the figure
      (`openchapter-pro-annual-89.99`) so the catalog reads at a glance.

      None of this is scriptable from here yet: the key in `.env.local` is
      scoped to transactions and subscriptions and answers `forbidden` on
      `/prices`. It was done through the dashboard. A key with catalog write
      would make it an API call next time.

- [ ] **When to move back to PayHere, and it is arithmetic.** The switch is a
      config change now, not a migration:

      - **Nature of Business "Sole proprietorship" demands a Business
        Registration number.** Unregistered is allowed — PayHere's own rules
        exempt home-based businesses, freelancers, clubs and government bodies,
        who give "proof of business" (an active website) instead.
      - **But an unregistered business gets PayHere Lite, and Lite cannot sell
        a subscription.** One-time payments only, no recurring billing, and
        **no USD payouts** — against a price table that is in USD.
      - Recurring starts at **Plus, LKR 3,990/month** (2.99%, Rs 250,000 per
        payment), which needs the BR. Premium is LKR 9,990.

      Paddle answered that, and the entry above records it. What remains is
      **when to come back**: the crossover is around **19 subscribers** —
      Paddle takes 5% + $0.50 = $1.00 a month on $9.99 with no fixed cost,
      PayHere Plus takes 2.99% = $0.30 plus ~$13 fixed, and 13 ÷ 0.70 ≈ 19.
      Below that Paddle is cheaper *and* needs no BR; above it Plus wins and
      the gap widens with every subscriber. Recompute rather than quoting 18 if
      the price or the rupee has moved. Two things the saving does not cover:
      Plus needs the business registration, and leaving a merchant of record
      puts **worldwide sales tax** back on us.

      The code half is already done, which is the point of building it the way
      it was built: `provider.ts` picks the gateway from whichever env block is
      filled in, and both webhooks, both cancel paths and both id columns
      exist. Moving is emptying the Paddle block in the environment — not a
      migration, and not a line of code.

- [x] **The four policy pages, because every gateway reviews the site.** Done
      2026-08-08: `/privacy`, `/terms`, `/refunds`, `/contact` over
      `components/legal/legal-shell.tsx`, linked from the landing footer, from
      each other, and from the checkout screen. A missing privacy or refund
      policy is a standard rejection at PayHere, Paddle and every MoR alike,
      so this is the one piece of launch work that is not specific to whichever
      gateway wins.

      Three things in there are load-bearing. **They are in `PUBLIC_EXACT` in
      `proxy.ts`** — a reviewer reads the site signed out, so a policy behind
      the sign-in wall does not exist as far as the review is concerned; they
      are read from `LEGAL_PAGES` so a fifth page cannot forget the list. **The
      privacy page names every route that sends anything**, feature by feature,
      rather than saying "third-party service providers" — which means adding a
      route that leaves the browser means adding it there, the same obligation
      the feedback dialog carries for its own fields. And **the prices, the free
      limits and the refund window are imported**, never retyped: the one page a
      customer quotes back at you in a dispute is the worst place for a figure
      nobody updated.

      The seven-day refund window is honoured by hand from the mailbox —
      nothing enforces it in code. A stated window is what a reviewer looks for,
      and "no refunds ever" on a subscription invites the chargebacks it was
      written to prevent.

- [x] **The two rows the pricing page promised.** Done 2026-08-03, by
      deleting them. "Books 50" and "Imports 10 files" were never enforced
      anywhere — nothing counted a shelf or an import — and wiring the
      counters would have been building a limit to keep a sentence honest,
      which is the wrong way round. Neither limit is part of the plan now:
      books and imports are unlimited on both sides, which is what the code has
      always done. Every row on that page is true of the app again.

      **Counted limits came back on 2026-08-06, this time as a decision about
      the plan rather than a sentence to keep.** Four of them, ten each and
      unlimited on Pro: **imports**, **comp searches**, **cover searches**,
      **title checks**. `src/lib/free-limits.ts` holds the numbers, the names
      and the arithmetic; `prefs.usage` holds the tallies; `countUse` in the
      store is the only thing that writes one; and the pricing rows quote
      `FREE_LIMITS` so the page and the gate cannot drift. The shelf limit did
      **not** come back and is not planned — books a writer starts here stay
      free and unbounded, which is the promise the whole product rests on.

      Four things about it are worth keeping. Imports count **files rather than
      books**, because `importIntoBook` would otherwise be one click round it
      ("new book, then import into it") — and undoing an in-book import gives
      the import back, since the writer reversed the thing they were charged
      for. **A search the app ran is never counted**: the comps screen and the
      title check both open by searching for the book already on screen, and
      charging for that would spend the ten on ten visits, so the seed is free
      and the press is counted. The tallies are in **prefs** rather than on a
      book: prefs sync as a blob, so a second machine does not hand out ten
      more, where a field on the book would have needed a Postgres column to
      survive `sync.ts`. And the landing page's hero check **counts an import
      but never refuses one** — the reader there has no account for a plan
      limit to be about, and that page's entire argument is that a manuscript
      can be checked before paying.

      **The counter is silent until the last three.** The first version put
      "0 of 10 free comp searches used" under the search box on every visit,
      which is the freemium mistake this audience has been burned by: a meter
      shown to somebody who has used nothing, before the screen has done
      anything for them. What the rest of the trade does is stay quiet, warn in
      the last quarter, and be explicit when it is gone — so `WARN_WHEN_LEFT`
      is 3, the line says what is *left* rather than what was spent, and the
      four numbers live on the pricing page and in Help for anyone deciding
      what to pay for. A test walks the whole allowance and fails if it speaks
      early.

      **Nothing is said until the eleventh press.** The first version went
      dark the instant the tenth search completed — banner up, button
      disabled — which hands a paywall to somebody who had finished anyway,
      and leaves no press for it to be an answer *to*. `useLimitGate` holds the
      rule now: controls stay live, the refused press is the trigger, and it
      costs nothing.

      **The spent state is a banner and a one-time dialog.** It was a grey pill
      first, which is the shape this app uses for footnotes — so the sentence
      explaining why the button beside it had gone dark read as a footnote.
      `LimitBanner` is a filled banner now — purple-into-indigo, white type,
      one white button — after a tinted version that was legible but sat at the
      same volume as every other panel on the screen. Still no red and no
      exclamation: running out of ten free searches is not an error. The
      gradient is three tokens (`--color-upgrade-*`) stated identically in both
      themes, which is the one place in `globals.css` a pair of blocks does not
      differ, and the reasoning is written at both ends. `LimitDialog` fires **once**,
      on the press that spends the last one — the only moment a writer is
      looking straight at what they ran out of — and never from an effect,
      which would fire again on arrival for somebody who ran out yesterday.
      Its right half is a wall of drawn book covers; spines were tried twice
      and read as a bar chart both times, and nine of anything read as a
      countable set on a dialog about a ceiling, so there are twelve and the
      grid is cropped. Checked in both themes.

      **Replaced twice since, and the second replacement is the one that
      stands.** Everything above describes four meters of ten, which shipped on
      2026-08-06 and is gone. What follows is why, because the reasoning is the
      part worth keeping.

      **2026-08-09 — five books, everything unlimited inside them.** The meters
      each counted an *attempt*, and every one of those screens is a screen you
      use badly on purpose: naming is iterative, so ten searches is perhaps three
      real candidates, and the meter ran out in the middle of the one activity
      the tool exists for. The writer who felt it first was the writer using it
      properly. Counting books charged for *scale* instead — Figma's free tier is
      the same shape and nearly the same sentence.

      **2026-08-10 — per-tool limits, because the container leaked.** The comps
      box and the title-check box take **arbitrary text**, so one book slot was a
      general-purpose research desk for any number of manuscripts. A container
      limit cannot hold a container whose contents are arbitrary; it only ever
      bound the tools that read the manuscript. So each tool is metered in the
      unit its own work comes in:

      | Shape | Tools | Free |
      |---|---|---|
      | **Per day** | comps, covers, title check | 2 / 3 / 2 |
      | **Per book** | blurb, prose report, track | 5 / 6 / 2 |
      | **By occupancy** | ARC readers, seats | 10 a book / 2 a book |

      The three that query a catalogue are counted **per day** — what every
      serious research tool does (Semrush's free plan is ten queries a day) and
      for the same reason: a search box takes arbitrary input, so the honest unit
      is the query. **They come back tomorrow**, which is the half that matters:
      nobody is permanently walled out of a book they own, and every sentence
      about them says so. Occupancy counts what is *currently* there, so removing
      an advance reader gives the place back.

      Imports became **unlimited** in the same change, and so did the writing
      record, the series read of the story bible and the keyword boxes — all
      three of which left the Pro column. What remains Pro: the six server-gated
      routes that cost real money, the sales-report import inside Track, and the
      book-three curve.

      Four things hold it up. **`onThisBook`** keeps "unlimited within a book" —
      a book already counted is never blocked, so the wall lands on the *next*
      one and never mid-sentence. The **daily reset lives in `dailyAllowance`**
      rather than the parser, because `getPrefs` caches on the raw string and
      anything derived from the clock there goes stale at midnight with nothing
      to invalidate it. **Every limit is spent on a press**, which is why the
      prose report gained a Run button rather than an exception to the rule that
      `LimitDialog` never fires from an effect. And **`warnAt` caps the warning at
      `limit - 1`**, or three of these limits would greet a writer who had used
      nothing with a meter.

      **The counters are merged on the way down, not replaced.** `applyRemote`
      spreads remote prefs over local, which is right for a preference and wrong
      for a spend: a laptop and a phone could each hand out a full daily
      allowance. `usedOn` is a **set union** — lossless, which is the advantage of
      a set of books over a tally of attempts — and `usedToday` takes the **larger
      count per tool** on the same day, the later day outright otherwise. The bias
      is towards the plan: where two machines disagree, it believes the one that
      spent more.

      **Verified in a browser on a real free account, 2026-08-10**, which is what
      unit tests could not do. All three daily limits count, warn, refuse and open
      the right dialog, with the counters independent per tool. **Arrival searches
      cost nothing** — the property that stops 2/day being a limit on opening a
      screen. Prose refuses the seventh book without recording it; blurb refuses
      on *save* with nothing written; ARC refuses the eleventh reader while all
      ten still render **and the typed name survives**. The merge proved itself
      against the real server: a locally lowered counter came back at the higher
      value. An old library came up `{day: "", counts: {}}` — the migration
      working.

      That session found exactly one bug, now fixed: the title check **hid its
      verdict whenever the allowance was blocked**. Defensible at ten per
      lifetime, where blocked was a rare terminal state; at two a day it is the
      *second* search that spends the last one, so the writer pressed a button
      they were entitled to press, the catalogues answered, and the screen showed
      them nothing — every day, under a banner claiming "everything you have
      already found stays where it is".

      *Left:* these are browser gates, like the prose report and the money
      screens, and they are honest about being that. Enforcing them server-side
      would mean `/api/comps` checking a plan, and that route is deliberately
      free and keyless — which is worth more than closing a hole nobody is
      trying to defend to that standard. The daily ones are also resettable by
      anybody willing to move their machine's clock, which the file header says
      outright rather than leaving to be discovered.

      *Also left:* **the daily rollover has never been watched happen.** The
      reset is unit-tested with an injected day and the arithmetic is right, but
      nobody has yet left a browser open past local midnight and pressed the
      button. And `service_role` has **no GRANT on the `prefs` table** — nothing
      needs it today, and an admin path that ever does will fail with "permission
      denied" rather than anything more helpful.

- [x] **A new plan.** Done 2026-08-03.
      $9 monthly, $72 a year, **$199 once**. `plans.ts`, a migration widening
      the two `period` CHECK constraints, and gates moved to match.

      **A lifetime tier was built and removed the same day.** Selling
      outright is what this market mostly does — Scrivener, Atticus, Vellum
      and Publisher Rocket are all one-time — but it trades recurring revenue
      for a support obligation with no end date, and that is a business call
      rather than a pricing one. The code is back to two cycles and the
      migration that would have widened the `period` CHECK was deleted
      unapplied, so no row can carry the value. `asPeriod` still refuses it,
      which is the guard if one ever did.

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

## Storage — the ceiling is gone

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
- [x] **Storage pressure.** Done in two halves on 2026-08-17, after a writer hit
      `QuotaExceededError` pasting into a long chapter and their work stopped
      being saved.

      *First, the leak and the silence.* `history.ts` had always said its
      per-chapter 400KB cap was made safe by a global sweep in the store — and
      **the sweep was never written**, so forty-five chapters were each entitled
      to 400KB against an origin of five megabytes. That is what filled the
      origin. The sweep exists now (whole chapters, oldest first, 1.5MB
      library-wide); `commit` and `saveBody` give up the whole history rather
      than fail a write; `StorageAlert` in the root layout says so — a dialog
      when work is at risk and a dismissible note when only the history went;
      `navigator.storage.persist()` asks the browser to stop evicting the
      origin; `deleteBook` stopped leaking its full-size cover into IndexedDB
      and a boot sweep clears the ones already there.

      *Then the ceiling itself.* Bodies, notes, history and cover thumbnails
      moved to **IndexedDB** — ~60% of free disk in Chrome against five
      megabytes — with the shelf, prefs and owner deliberately left behind. See
      the long note in CLAUDE.md: memory is the read path so every getter stays
      synchronous, `localStorage` stays a fallback read path for good, and
      `useHydrated` waits for the disk because the editor's surface is keyed on
      the chapter id rather than the text.

      *Left:* no usage indicator anywhere until something actually fails. That
      is now a much smaller gap — the wall is gigabytes away — but a writer with
      a genuinely full device still meets it for the first time at the moment of
      failure.

## Editor

- [x] **Front/back matter.** Back, as a flat tag rather than the old drill-down.
      A page's ⋯ menu moves it to front matter, the body, or back matter; the
      list stays one sequence with a quiet label per part, only body chapters are
      numbered, and export lays out front → body → back. The old sectioned
      version (drill-down, per-part drop strips) stays cut — see `207f805`.
      *That first sentence was untrue from the rebuild until 2026-08-18*:
      `setChapterMatter` was written and tested and had no caller anywhere in
      `src/components`, so the row menu offered Star, Rename and Delete and a
      page in the wrong part could only be deleted and typed again. It is wired
      now, in `book-panel.tsx`, and it is what repairs a book imported before
      the importer could read its own headings (below).
      *Phase 2 (done):* the export dialog generates a title page, copyright page,
      and contents list for EPUB and PDF, and front/back matter is set unnumbered
      (only body chapters carry a numeral). *Phase 3 (done):* real page numbers
      in the print contents, which this entry said the browser print engine
      could not produce — true of the browser, and the reason the print export
      is now paginated by Paged.js before the browser writes the file. The
      contents carries dot leaders and a folio from `target-counter`, and every
      page carries a running head naming its chapter. *Left:* the same generated
      pages for DOCX/Markdown if wanted.
- [x] **Search across a book.** The editor's Search tab (⌘K) reads every
      chapter's text — walked out of the Tiptap JSON in `src/lib/search.ts` —
      matches title and prose, and shows a snippet that jumps to the chapter.
      *Left, if wanted:* a whole-library search, and jumping to the exact match
      inside the chapter (it opens the chapter, not the line).
- [ ] **Per-chapter status and synopsis.** Offered early, never chosen.

## What writers ask for — read off the competition

Added 2026-08-27, from a review of **22 writing tools** published 2025-05-16 by
Dominic de Souza, an author writing a long series with heavy worldbuilding —
exactly the reader this app is aimed at. It is one person's opinion and is
written down as one, but his likes and dislikes are the ones this category
repeats, and several of them are things we have already built and hidden.

**What he says he wants**, in his own order: a beautiful, immersive writing
experience; freedom to brain-dump, organise and mind-map his own way; offline
access ("the moment I open Chrome, I'm Pavlov'd to open new tabs"); free or
low-cost while he is *not* writing, which may be six months at a stretch; and
**export freedom — "so I can take everything and leave anytime I want"**.

**What blocks him**: busy design, having to learn somebody else's method,
systems that cannot hold a large world, a writing surface that does not feel
good, online-only, and a subscription that bills through the fallow months.

His scoring lines up with that, and it is the *reasons* that are worth keeping:

| Rated well | Why |
|---|---|
| Obsidian 9 | offline, folders, messy or structured as you like, no imposed method |
| Anytype 9 | offline, header art and icons, a whole duplicated workspace per book |
| Craft 8.5 | page background art and gradients, character cards as a visual cluster |
| Novelcrafter 8.5 | minimal chrome, a Codex for characters and lore, $4/month |
| Milanote 8 | drag-and-drop columns; scene planning by moving cards |

| Rated badly | Why |
|---|---|
| Novelize 5.5 | brand orange louder than the prose, washed-out text, dated grey |
| AutoCrit 5.5 | locked features and pro upgrades all over the interface |
| Storywriter Pro 5.5 | **cannot export anything unless you pay** |
| FirstDraftPro 6.5 | a permanent upgrade prompt in the sidebar he cannot dismiss |
| Motif 6.5 | writing column far too wide — "nobody reads lines that long" |
| Speare 6 | forces its structure on a writer who needs to be messy first |

### What we already answer

The quiet chrome, the real page at a real trim, and a measure held near 66
characters (`bookSetting`) — the exact fault Motif was marked down for. Storage
is local-first. Three export formats. The price sits between Novelcrafter's $4
and everybody else's $9–10.

### The one to watch — answered 2026-08-27

**Done — every format is free on both plans now.** `freeExports` carries all
three, `launch.test.ts` pins it, and the copy across twelve files, both legal
pages and the landing page says so. What follows is why, kept because the
reasoning is the useful part and because it is the argument against reversing
it again.

**Export behind the plan was the riskiest thing in the launch MVP.** His
first-stated want is to take everything and leave; the one tool he singles out
for locking export scored 5.5. Free Word export softens it and is probably
enough — but if this app starts being reviewed, that is the sentence that gets
written. It is one edit (`LAUNCH_LIMITS.freeExports`), and the older rule it
reversed — *export must never move behind the plan* — is recorded under
**Billing** above.

Second, smaller: two tools lost a point each for **a permanent upgrade prompt
sitting in the chrome**. Ours must never live in the rail or the sidebar.

### Why editing tools annoy the writers who buy them

From *What Writers Often Get Wrong About Editing Tools*, Anca Antoci, The
Writing Cooperative, 2024-06-25, on Grammarly and ProWritingAid. **Only the free
preview was readable** — the thesis, the section on adverbs and the comments —
so this is a partial read and is written down as one.

**The complaint is tone, not accuracy.** A tool underlines every adverb; the
writer reads the underline as an instruction, accepts everything, and ends up
with prose that is "accurate but dull, losing the author's voice in the
process". Her answer: *"the tools highlight them for your consideration, not
elimination. It's all about context."* She also notes that Stephen King's
"kill your adverbs" is teacherly exaggeration aimed at dialogue tags — he uses
them, sparingly.

**This is evidence for three rules already in the house style**, from the side
of the writer they were written for: *report facts, never verdicts*; no score,
no grade, no rating out of a hundred; and the prose report has no rewrite
button. Her image of the problem is "a page full of red underlines, feeling like
your creativity is being strangled."

**And one thing we have earned and do not say.** The top comment is a writer
using ProWritingAid's Rephrase and asking *"Do I need to disclose AI
assistance?"* — a real anxiety with a real cost. **The assistant here never
writes into the book**, so a writer using OpenChapter has nothing to disclose:
every word in the file is theirs. That is an architectural decision recorded in
`CLAUDE.md` and stated on no page a visitor sees. Against Sudowrite and AutoCrit,
both marked down in the review above for being AI-heavy, it is the difference
worth naming.

**For the prose report, when it comes off `HIDDEN_BOOK_TOOL_PATHS`:**

- Show **where** something clusters, with the sentence. "40 adverbs" is a
  number; "12 of them in dialogue tags" is a thing a writer can act on.
- **Never red.** Red means error, and an adverb is not one.
- The screen already may not carry a score. This is the same rule pointed at
  the wording rather than at the arithmetic.

**Writers stack tools** — one commenter runs ProWritingAid and then AutoCrit.
We do not have to be the last word on editing; we have to not fight the
workflow, which is what export in every format on every plan is for.

### What writers say in the comments, which is where the useful part is

From *Best Writing Apps and Tools for Authors in 2025*, Caroline Mitchell
(23 books, 2M+ copies sold), and the 23 comments under it. The tool round-up
covers the same ground as the review above — Scrivener, Dabble, Atticus,
Reedsy, Vellum, Ulysses, Word, Docs. **The comments are the new information.**

**Speed on a long manuscript is something people ask for refunds over.** One
commenter: *"I love Atticus but it became incredibly slow once I got over 50,000
words (I mean, it took days to update text — they gave me a refund)."* The
article says the same of Google Docs, which *"doesn't handle huge documents as
smoothly (long novels can get sluggish)."*

**We are structurally safe from that in the editor and not in the other two
screens**, which is worth knowing before it is claimed anywhere. Bodies are one
document per *chapter* (`saveBody(bookId, chapterId, doc, words)`), so the
editor never holds a whole novel and Atticus's failure cannot reach it. The
**reading view** and the **export** do load every chapter — `loadChapters` walks
the book and `paginate()` measures the lot. Neither has been tried against a
real 120,000-word manuscript. **Do that before it is a sentence on a page.**

**Three claims we have earned and make nowhere:**

- **It runs on any computer.** Scrivener is desktop-only with no Android,
  Vellum is Mac-only, Ulysses is Mac and iOS. A commenter asks outright:
  *"With more people bailing out of the Microsoft sphere with all of the Win11
  mandates, it would be helpful to add which ones are available with Linux
  users."* A browser app answers that for free, and Linux and Chromebook are
  audiences nobody in this list is serving.
- **Write and format in one place, free.** The most detailed comment in the
  thread describes stitching two tools together: *"So I write and edit in
  Scrivener. Format in D2D"* — Draft2Digital — *"and get the formats I need to
  upload."* Chosen because it is free, and because Word means *"you have to have
  separate files for world building and characters."* One tool that writes,
  holds the world and produces the files, at no charge, is the whole of that
  comment answered.
- **No card to start.** The first comment on the post is *"do Novlr and Vellum
  are free to use them?"* — price is the first question. A fifth-grader further
  down: *"I cannot seem to sign up to any of these apps"*, and is sent to Google
  Docs. So is a 57-year-old finally starting. Sign-up friction is the filter.

**Subscription fatigue, for the second post running:** *"I find subscription
based software very obnoxious — that was a deal breaker for me."* Noted beside
the pause idea below.

**Already built and being asked for:** *"I need a software package where I can
insert images and illustrations into my chapters."* Inline images with resize,
alignment and wrap have been in the editor since `resizable-image.ts`.

**One audience we are not built for, written down so it is not mistaken for a
gap.** Two commenters want non-fiction with apparatus — a language course with
dialogues, exercises and pictures; an illustrated instructional book. The whole
model here is the novel: chapters, front and back matter, a trim size. Serving
them is a different product, not a feature.

### A hundred complaints about a competitor, and how many we already answer

From the Play Store reviews of **Novelist**, a free offline Android novel
writer with around 50,000 users, read 2026-08-27. Roughly a hundred reviews with
the developer's replies underneath. **This is the most useful of the three
sources here**, because it is not a reviewer's opinion of what writers want —
it is writers describing what actually went wrong.

**The complaints, by how many people made them:**

| Theme | Roughly | A representative one |
|---|---|---|
| Lost work | a dozen | *"When my phone ceased to stop working, I lost EVERYTHING."* |
| Lag on a real manuscript | eight | *"After you have over 3,000 words it takes a few seconds for the app to catch up… a few seconds per letter."* (61 found it helpful) |
| Images in chapters | eight | *"I need an option for… adding pictures directly to a book."* |
| No sync between devices | seven | *"There is no sign in… you cannot access what you have on your phone on your computer."* |
| Losing your place | **101 found it helpful** | *"When reopening the tab, it takes me back up to the top of my writing rather than being where I left off."* |
| Too complicated | six | *"Overwhelming with its terms: themes, events, character, location, props, extra, plot, scene, write, organize. I just want to write a book."* |

**Most of that list is already answered here**, and it is worth writing down
which, because it is the clearest evidence yet that the architecture was pointed
at the right problems:

- **Lost work** — autosave that says *Saved* only once the IndexedDB write
  resolves, `rescueBody` to `localStorage` on page close, and optional Supabase
  sync. Novelist's answer to a dozen people who lost books is *"it's a free
  offline app, the user is responsible for safety backups"*, which reads as
  blame and earned more one-star reviews than the bug did.
- **Lag** — one document per *chapter*, so the editor never holds a novel. His
  workaround is to tell writers to *"keep scenes short (1000-2000 words)"*: the
  architecture asking the user to compensate for it.
- **Images, spell check, page size, drop caps, indentation** — all built. His
  reply to the font request is *"How many font options have you actually seen in
  novels?"*, and to the page-size one, *"Novelist is a writing tool, not a
  publishing tool. Pages are a matter of publishing."* That division is exactly
  the one this app decided not to make.
- **Export that a shop refuses** — *"EPUB export fail the upload checker 4
  amazon & draft2digital"*, *"No copyright page. If you create 1 the TOC is
  before the copyright which is wrong"*, *"chapter 2 can begin on the same
  page"*. Those three are `bindBook`, the generated copyright page and the
  section page-breaks — every one of them a bug this app has already had and
  fixed, which is what `export/consistency.test.ts` is standing guard over.

**Two gaps this turns up that we do not answer:**

1. **Your place inside the chapter.** `resume.ts` returns a `ChapterMeta` — the
   right chapter, opened at the top of it. On a five-thousand-word chapter that
   is a scroll every single time you come back. **101 people marked that
   complaint helpful, more than any other review in the set**, so it matters
   more than its size suggests. Storing a caret position or a scroll offset per
   chapter is small; deciding where it lives (`prefs`, not the shelf) is the
   only real question.
2. **Performance on a whole book** — the reading view and the export, already
   written down above. This source is the second independent report that slow
   is not a polish issue but the thing people leave over.

**And a lesson that is not a feature.** The developer answers criticism badly,
and it costs him: *"Bad reviews because the app is too simple. Bad reviews
because it has too many features… The result is that I'll stop developing
Novelist soon. Bye."* One reviewer dropped a star purely for the replies —
*"the creator's responses to criticism are so unprofessional that it is actually
a detriment"* — and another wrote a review entirely about them. **How a
complaint is answered is part of the product**, and this is the file where that
gets remembered.

**The sharpest line in the whole set**, from somebody who left:
*"It was structured like how you analyze a novel rather than how you write
one."* That is the test to hold every tool to as it comes off
`HIDDEN_BOOK_TOOL_PATHS`.

### Ideas to bank, roughly by how often the category asks for them

1. **Worldbuilding that is not a form.** Every tool he rated 8.5 or above has
   one — Codex, objects, a wiki. `bible.ts` is built and tested; it is on
   `HIDDEN_BOOK_TOOL_PATHS`.
2. **A visual board.** Scene cards dragged into columns. It is the whole of
   Milanote's 8, and the half-point Lattics lost for feeling unimmersive.
3. **Atmosphere per book.** Cover art as a page header, a colour that says
   *this world*. Craft and Anytype both scored on this alone, and we have the
   artwork already.
4. **A link to share for feedback.** The *only* gap he names in Obsidian, his
   9/10 — he copies the book into Google Docs to get comments. Collaboration is
   built; `/invite/[token]` redirects home under the launch flag.
5. **Installable, and offline in so many words.** Named as a want five times
   across the review. We are local-first already; a PWA would let the landing
   page say so without inventing a claim.
6. **Somewhere to pause.** "Pricey subscriptions when I might not even be
   writing for six months." An annual plan exists; a pause does not.

**Three of those six are things already written and switched off** (1, 4, and
arguably 5), which makes them the cheapest items on any roadmap here. See
`LAUNCH_POST_BACKLOG` for the order they were meant to come back in.

## Known rough edges

- [ ] **`/tools` has no screenshots yet, and the space for them is reserved.**
      Added 2026-08-15. Every row draws the tool's mark on a stage at
      `aspect-[2/1]` — the proportion the three landing captures take — so
      dropping the real pictures in moves nothing on the page. Filling one in is
      three steps: put the file in `public/`, add `shot: { src, width, height,
      alt }` to that tool's entry in `src/lib/tool-guide.ts`, and the drawing is
      replaced by the capture. The `alt` is not optional — `AppWindow` hides the
      picture's contents behind it, so an empty one makes the screen invisible
      rather than decorative; describe what is *on* the screen, as
      `feature-shots.tsx` does. These are bitmaps and carry the standing cost:
      when the screen moves, nothing fails and nothing warns.
- [ ] **`npx tsc --noEmit` is red — 7 errors, all in test files**, found
      2026-08-15: `editor/text-align.test.ts`, `export/docx.test.ts` and
      `export/epub.test.ts` build `LoadedChapter`/`EpubChapter` literals that
      have drifted from the types (`number` missing, a stray `id`). `npm run
      test` is green because Vitest does not typecheck, so this only shows up
      in the manual `tsc` pass CLAUDE.md tells you to run. Fixtures, not
      product code — but it means the typecheck cannot be used as a clean
      signal until they are updated.
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
