# Comps, keywords, the title check, the assistant, and every model route

Read before touching `src/lib/ai.ts`, `src/lib/comps/`, `src/lib/keywords/`, the blurb routes, the assistant route, or audio (narration, transcription, dictation).

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

**The title check is one box too, and its finding arrives in the corner.**
The shelf's own name sits at the top of that box with the search *under* it —
while nothing has been checked the covers are the page, and the field is the
thing you use on them. The paragraph explaining what the button would do is
gone: it described the button to somebody looking at the button. And the
verdict — the coloured card with the count, the reason and the provenance — is
a **banner** (`VerdictBanner` + `VerdictActions`), full width, directly under
the field, carrying *Try another* and *Keep it*. It is *never* on a timer: it
is the answer rather than a save confirmation, it takes longer to read than any
timeout, and the shelves it describes stay on the page, so dismissing it loses
the summary and none of the evidence. (This passage described a top-right toast
called `TitleToast` until 2026-08-15; there has never been a component by that
name in `src`, so anyone looking for one was hunting something that does not
exist.)

**The comps screen is one box: shelves, then the search, then the covers.**
The three were loose on the page with nothing saying where the controls ended
and the answer began, and the covers — which *are* the answer — read as a
separate page underneath. The shelves are *inside* the search box — `SearchBox` is a combobox, and
opening it shows all twenty-six at once in columns rather than a scrolling
eighth of them. They were a section of their own for a while and that was one
section too many: a heading, a caption and twenty-six chips doing the job the
box does. Picking one **fills the field and does not search** — browsing the
list is not a decision to spend one of the ten — and the field shows the
shelf's *name* rather than the `subject:"…"` query it stands for, which is our
syntax leaking into somebody's text field. The box sits directly above the
covers it produces, which is where every shop that sells books puts its
search. What stays outside the box is the
arithmetic below it — median pages, the subjects, the length reading — because
those are readings *of* the shelf and keep their own cards, or the box is the
whole page and stops meaning anything.

**Two free catalogues sit behind `/api/comps`** — Google Books and Open Library.
Server-side not for secrecy (neither needs a key) but for a shared cache, so one
service being down costs half the results rather than the panel, and so a
reader's browser is not handed to two third parties for a request they did not
make. Records are merged **field by field** on ISBN, or title-plus-author when
neither has one: Google carries blurbs and page counts, Open Library carries
subjects and a cover for almost everything, and the gaps are in different
places, so preferring one source wholesale throws away the field the other was
fetched for. `GOOGLE_BOOKS_API_KEY` is optional — without it Google answers 429
under any real traffic (the anonymous quota is per IP and a server is one IP for
every writer), the feature degrades to Open Library alone, and the screen says
Google did not answer rather than implying the genre is empty. **The manuscript
never goes**: what leaves is a query built from the book's genre and blurb.

**The two catalogues take the same question in different dialects**, and
`openLibraryQuery()` translates it. Google wants `intitle:`, Open Library wants
`title:` — and Open Library answers a prefix it does not know with **zero
results rather than an error**, which is the failure mode worth naming: the
title check sent `intitle:` to both for its whole life, so every result it ever
showed came from Google alone while the page said it read both. It looked like
it worked because Google carries the popular titles. Anything with no prefix —
every ordinary comps search — passes through untouched. `reportedTotal()` is
the other half of honesty here: Google's `totalItems` says how many the
catalogue claims exist against the handful it handed over, because a screen
counting what it fetched reads as counting the world. It is an estimate, wobbles
between identical requests, and so is shown as an approximation and never used
in arithmetic.

**A fourth route feeds the category box as it is typed into** — and **nothing
calls it at the moment**, because that box came off the categories screen on
2026-08-11 to be rebuilt. The picker it feeds is kept whole and callerless in
`categories/subject-combobox.tsx`, the same standing `templates-dialog.tsx`
has; the route is what it will reach for. Do not tidy either away, and see
TODO.md under "Taken out on purpose" for what went and what is owed.
`/api/comps/subjects` (GET, **free and keyless**, like `/api/comps` and for the
same reasons — it is a lookup rather than a judgement) queries Open Library's
subject index so the suggestions are real shelves with real sizes. It is not a
hard-coded list on purpose: BISAC is licensed, and inventing our own list of
"all book categories" is the exact failure the categories screen exists to
avoid. Two measured details drive its shape. Nothing is fetched below **two
characters** — `m*` is an HTTP 500 on their side and plain `m` matches middle
initials, returning Nixon and Kennedy — so the first keystroke is answered
locally from `common-subjects.ts`, 900 of Open Library's own headings with
Open Library's own counts, harvested once and shipped (CC0; caching their
answers is not inventing them). And the query goes as **both the plain word and
a wildcard, joined by OR**: the index is stemmed, so `cozy*` matches nothing
against terms stored as "cozi", while a bare `myst` finds the computer game and
no mystery shelf. A failed lookup returns an empty list, never an error — a
dropdown that cannot suggest is just the text box it was before.

**A fifth route writes the query itself, before the search rather than after
it.** `/api/comps/query` (POST, `requirePro()`, a model via `ai.ts`) over the
pure `src/lib/comps/query.ts` sits *upstream* of the ranking, which is where
the leverage is: `rank.ts` reorders what was fetched and cannot rescue a fetch
that brought back the wrong books, and a writer describes a *story* while a
catalogue indexes *subjects*. What is sent is the words in the box and the
genre already chosen — not the manuscript, not the blurb — so it is the
cheapest of the model routes by a wide margin. Five things hold it:

- **Nothing here invents a book**, which is what makes it allowed. The model
  writes a *search*; the catalogues still supply every record, so the failure
  `rank.ts` exists to prevent — a plausible title that does not exist, about to
  be pasted into a query letter — is structurally impossible in this direction.
  The worst a bad query can do is find nothing.
- **A prefix neither catalogue takes is dropped**, not passed on (`ALLOWED`),
  because Open Library answers an unknown prefix with zero results rather than
  an error — one stray `isbn:` would empty the shelf with nothing on screen to
  explain why.
- **The query goes back into the box**, editable and undoable. A model quietly
  rewriting somebody's search and presenting the results as theirs is the
  invisible hand this app refuses everywhere else.
- **A translation that finds nothing loses to the words it replaced.** Measured,
  and not a rare edge: a stacked four-term query is ANDed by the catalogue and
  returns 0 where the raw words returned 6. The prompt was tightened, but a
  prompt is a request rather than a guarantee — so the client re-runs the
  writer's own words on an empty result and the box goes back to showing what
  was actually searched.
- **Only plain words are translated at all.** `looksPlain()` skips anything
  already carrying a field prefix, since the shelf chips and the seeded search
  send `subject:"…"` — the very thing a model would be asked to produce.

**Ranking those comps is a separate route, and the split is the design.**
`/api/comps/rank` (POST, `requirePro()`, a model via `ai.ts`) over the
pure `src/lib/comps/rank.ts` is the one place in the cluster where a model
earns its cost — a keyword search returns forty books of which five are really
comparable, and sorting those out is a judgement rather than a query. Folding
it into `/api/comps` would make the *whole* feature need a key and a plan for a
step most searches do not want; kept apart, everything above the button works
free and keyless. Three rules hold it: **there is no score and no field to put
one in** (a number here would be invented and would be the most believable
invented number in the app, sitting in a list of real books — a test asserts
the parsed pick carries nothing but the book and the reason); **the model may
only choose from books that were fetched**, by numbered id, with anything out
of range dropped rather than guessed at and the parser enforcing it
*server-side*, because a model asked about books will produce a plausible title
that does not exist and a made-up comp is about to be pasted into a query
letter; and **generated text is treated as hostile input** — preambles, code
fences, bare arrays, duplicate ids and missing reasons each have a test. The
clean parse is tried before any bracket scan, since scanning a bare array for
`{` finds the first *element's* brace and silently parses one pick as the whole
reply.

**Ranking is the second of three routes that send prose** — the assistant, this,
and the blurb workshop — and the opening of the manuscript goes, because
whether a book *sounds* like another is what a keyword search cannot answer.
Capped at a couple of pages by `openingFrom()`, cut at a paragraph
(a severed clause is a false signal about how the writer ends sentences),
images dropped, sent only on a press — and the card lists exactly what leaves
*before* the button, the same shape the feedback dialog uses. Add a field to
what is sent and add it to that list, and to `/privacy`.

**A third route answers the shop’s form rather than the librarian’s.**
`/api/comps/categories` (POST, `requirePro()`, a model via `ai.ts`) over the pure
`src/lib/comps/shelves.ts` translates the librarian subjects `subjects.ts`
ranks into the category paths a shop’s own selector uses — a translation no
table can do, since Amazon dropped BISAC for its own tree in 2023. It sends
**subject names and counts only**, never the book. Two rules hold it: the
counts are *ours*, re-attached after parsing, because a model asked for a
number produces a plausible one and a plausible count cannot be told from a
real one; and a path is a **candidate**, not a fact, because only the shop
knows its own tree — the screen says to confirm each in the selector.

**Those two routes ask a model through `src/lib/ai.ts`, and which model is a
deployment decision.** Both want the same shape — a system prompt, one user
message, JSON back — and neither cares who answers, so `askModel()` is the one
way to ask: `ANTHROPIC_API_KEY` makes it Claude, `GOOGLE_GENERATIVE_AI_API_KEY`
makes it Gemini, both set and Claude wins, `OPENCHAPTER_MODEL` overrides the
model name without a deploy. `modelProvider()` returning null is how a route
answers 501 with a message saying so, the same shape as everything else here.
Three things about it are deliberate. **The assistant now goes through it too,
as of 2026-08-15, and `streamModel` is the second half of the file.** It did
not: `/api/chat` streams, caches the chapter across turns and reasons about
prose, so it stayed on the Anthropic SDK and this note said `ai.ts` was for
short, bounded, one-shot calls — while naming, correctly, where streaming
belonged if it were ever wanted for both providers. It was: a deployment with
only a Google key had every other model route working and a dead assistant
telling it to go and fetch an Anthropic key. `askModel` is untouched; the two
paths share only the provider choice, which is the point — an installation has
one answer to "is there a model" rather than two. Three things inside it are
load-bearing:

- **`splitSse` is pure and tested because a network chunk is not a message.**
  One `read()` can carry half an event, and a splitter that parsed whatever it
  was handed would drop that half silently — the JSON fails, the piece is
  skipped, and a long reply loses about a token in ten in a way that reads as
  the model writing badly. CRLF gets the same treatment for a louder reason: a
  stray `\r` makes every payload a parse error, so the reply arrives empty.
- **The first chunk is pulled before the response is returned.** That is what
  keeps a rejected key a 401 instead of a 200 with an apology in the prose. Once
  the first byte is out the status is spent, so a failure after that can only be
  a note in the stream — the two paths are the two halves of one failure, told
  apart by whether the writer has seen anything yet.
- **There are two model tiers now** (`DEFAULTS.task` / `.chat`, and
  `OPENCHAPTER_CHAT_MODEL` beside `OPENCHAPTER_MODEL`). Not tidiness: the route
  named `claude-opus-4-8` itself and `ai.ts` defaulted to `claude-sonnet-5`, so
  folding one into the other would have quietly downgraded the assistant.
  Google is the same id in both tiers on purpose — a wrong model name fails as a
  404 behind a screen that says the assistant is unavailable, so it stays on the
  id the six working routes already prove.

**Nor is the gateway used**, though narration and transcription go
through it on `AI_GATEWAY_API_KEY` and it would have been the tidier home: it
was tried, and the gateway refuses every request without a card on file. And
**Gemini is written out over its REST API** rather than pulled in via
`@ai-sdk/google`, because the whole of what it does is one POST and one field
lookup, and it keeps the dependency list honest about a provider expected to be
temporary. Its key rides in a header, not the query string, so it stays out of
anything that logs a URL. Budget generously on Gemini 3 — thinking tokens count
against `maxOutputTokens`, so a ceiling that comfortably fits the answer still
truncates it.

**No search volume, no competition score, no rank — anywhere in this
cluster.** That is the figure a writer wants and it cannot be had honestly:
Amazon’s Product Advertising API shut down in May 2026, its replacement needs
ten affiliate sales a month, and the tools quoting a figure buy scraped data
from a vendor. Scraping is forbidden by Amazon’s own terms and would put the
risk on us. `keywords.ts`, `keywords/suggest.ts` and `shelves.ts` each have a
test asserting their shape carries no such number, and all three are tests not
to "fix". What is offered instead is `keywordReport()`: the seven backend
keyword boxes counted — over the 50-character limit, words the title already
owns so the shop indexes them anyway, the same word spent twice, and phrases
shops publish a rule against.

**A sixth route writes candidates for those boxes**, and the reason it is
allowed is that the ground moved. `/api/comps/keywords` (POST, `requirePro()`,
a model via `ai.ts`) over the pure `src/lib/keywords/suggest.ts` suggests
phrases for the seven fields. Amazon's search stopped being literal — since
2024 it carries a semantic layer that reads a listing the way a person would,
so *coverage of the right ideas* is what earns a book its place and keyword
stuffing is explicitly less effective than it was. That is a judgement, which
is the only thing a model is worth paying for here. It also means the figure
the competitors sell is becoming less decisive while the thing that matters can
be produced honestly, so the refusal above stops being a limitation.

Four things hold it, and the first is the interesting one:

- **The checker is the filter.** Every candidate is run through
  `keywordReport()` as though it were already in a box, and anything raising an
  issue is dropped — too long, a word the title already owns, a phrase the
  shops publish a rule against, a word already spent in an earlier suggestion.
  A prompt is a request; this is a guarantee, and it is what stops the two
  halves of the screen disagreeing about what a good keyword is.
- **Dropped, never truncated or repaired.** A phrase cut at fifty characters is
  a different phrase and one with its offending word removed is a phrase nobody
  wrote. Losing a suggestion costs a writer nothing; showing them a mangled one
  costs the trust the screen runs on.
- **Empty slots only, and Undo.** Words a writer typed are never overwritten,
  and suggestions land in the *draft* so nothing reaches the book until Save.
- **The manuscript does not go** — the blurb, genre, categories and the
  listing's own names, all of it typed into form fields. That keeps this off
  the short list of routes that send prose. Add a field and it needs a line on
  the privacy page in the same commit. KDP requires no AI disclosure for
  metadata, so the screen carries no warning; what it does carry is *check each
  one is true of your book*, because a shop requires the keywords, title and
  description to describe the same book — a suggested trope the book lacks is a
  rule broken rather than bad advice.

**A seventh route is the conversation about those same boxes**, and it is a
sibling of the press rather than a replacement for it.
`/api/comps/keywords/chat` (POST, `requirePro()`, a model via `ai.ts`) over the
pure `src/lib/keywords/workshop.ts` answers "which seven, and why" where the
press answers "give me seven from the blurb"; the two sit under one parent so
the whole feature is found in one place, and they **share `keepUsable`**, so
neither can offer a phrase the other's checker would flag. It is the blurb
workshop's four rules pointed at a different form field — candidates are
**tagged** (`<keywords>`, so a turn that answers a question has no button under
it), the **checker is still the filter**, nothing reaches the book without a
press (empty slots only, into the draft), and **no prose leaves**: the
conversation, blurb, genre, categories, listing names and the seven boxes as
they stand, all form fields. Two things are its own. The **rules are given, not
recalled** — the system prompt states the shop's own numbers and prohibitions,
including that seven boxes of fifty characters is Amazon's shape and not a
standard, so an answer about Kobo or IngramSpark does not quietly assume KDP.
And the refusal of a search volume is repeated *to the model* as a hard rule,
because a plausible number beside a real keyword would be the most believable
invented thing in the app.

**`src/lib/keywords/guide.ts` is the same knowledge with no model behind it,
and that is the point.** A self-hosted copy has no key, a free account runs out
of conversations, a gateway has a bad afternoon — and in every one of those the
writer still has seven empty boxes and a book to publish. So the whole of what
the chat knows is also written down, free, offline and readable signed out
(`keyword-guide.tsx`, dynamically imported by the categories screen). Every
fact in it was checked against the shop's own help pages rather than the
folklore, `SOURCES` records which, and a test asserts it offers no invented
number — a guide is exactly where one would be most believable, because it
reads as documentation rather than as a guess.


**The assistant** is `src/app/api/chat/route.ts`, streaming through
`streamModel` in `ai.ts` — so it runs on **either** `ANTHROPIC_API_KEY` or
`GOOGLE_GENERATIVE_AI_API_KEY`, whichever is set, with Anthropic winning when
both are. Without either the route returns 501 with a message naming both, the
same shape every other model route uses. Chapter text is sent only when the
writer opens the panel and asks, and rides in the system prompt as `context` —
its own cached block on Anthropic, joined to the instruction on Gemini, which
caches a repeated prefix implicitly and has nothing to declare. The Help and
support dialogs name both keys; they said only Anthropic for a while after this
changed, which is the documentation-goes-stale rule catching the app itself.

**Audio is three separate things, and they are not interchangeable.** All three
degrade the way the assistant does — no key, 501 with a message saying so — and
the two paid ones need `AI_GATEWAY_API_KEY` (not the Anthropic one) and check
auth themselves, because the proxy skips `/api` and a minute of speech is
somebody else's invoice.
- **Text → audio** (`/api/narrate` + `src/lib/export/narrate.ts`,
  `export/audiobook.ts`) — **and it has no way in as of 2026-08-14.** The
  export page's Audiobook card came off at the owner's request, to be switched
  back on later; all of this is whole, still tested, and callerless, the
  standing `templates-dialog.tsx` and `ambience.ts` have. Do not tidy it away,
  and read TODO.md under "Taken out on purpose" before putting it back — four
  pages had claims about it reworded and the privacy page lost its Narration
  entry, which has to return in the same commit. What it does: one MP3 per
  chapter in a zip, the route doing *one chunk per request* and stateless, with
  the loop driven from the client so a 40-chapter book is 40 visible steps
  rather than one request that fails having produced nothing. The tested part
  is `speechChunks()` — cut at the largest boundary that fits (paragraph, then
  sentence, then word, never mid-word), because a break mid-clause is audible.
- **Audio → text** (`/api/transcribe` + `src/lib/import/transcript.ts`):
  importing an audiobook. Only the transcript is made server-side; chaptering and
  book creation go through the same `parseText → splitIntoChapters →
  createBookFromImport` path as a `.docx`. `transcriptToProse()` rebuilds
  paragraphs from the *segment timings* — a narrator's pause between paragraphs
  is longer than between sentences — because otherwise the whole book arrives as
  one paragraph and `splitIntoChapters` finds nothing to split on.
- **Dictation** (`src/lib/editor/use-dictation.ts`) is the browser's own
  `SpeechRecognition`: live, free, no key, Chrome/Edge only. `supported` is false
  elsewhere and the button hides. Don't "unify" it with the transcriber — that
  one bills per minute and takes finished files.


