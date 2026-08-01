# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

OpenChapter is a novel-writing app: a shelf of books, a distraction-light chapter
editor, and import/export to the formats a writer actually hands off. It runs
almost entirely in the browser — the manuscript never leaves the machine except
for the one assistant feature.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build. Also the way to check Tailwind output: v4
  silently drops utilities it cannot parse, so verify against `.next/static/chunks/*.css`.
- `npm run lint` — ESLint (next/core-web-vitals + next/typescript). It does *not*
  typecheck; for that, `npx tsc --noEmit` — there is no script for it.
- `npm run test` — Vitest, single run (jsdom env)
- `npm run test:watch` — Vitest watch
- One test file: `npx vitest run src/lib/export/epub.test.ts`
- One test by name: `npx vitest run -t "scene break"`
- `java -jar epubcheck.jar book.epub` — the EPUB check the unit tests can't do
  (see below). Not in CI; run it by hand after touching `epub.ts`.

Every environment variable is optional and every one of them is documented, with
its failure mode, in `.env.local.example`. That file is the canonical list —
read it rather than grepping for `process.env`.

Tests live beside their subjects as `*.test.ts` and concentrate on the pure
logic: the import/export pipelines (including the XHTML and front-matter
renderers), the store, page setup, typography, search, book kinds, the custom
Tiptap marks, pagination and click-to-type arithmetic, caret scrolling,
narration chunking, transcript paragraphing, publishing details and the ISBN
check digit, the billing price/cycle arithmetic and PayHere's two MD5s, the
account fallbacks and the `?next=` redirect guard, ambience, relative time.
Components are not tested — jsdom is there for `localStorage`, not for a DOM.

`docs/plans/` holds the design and implementation notes for the bigger pieces
(the bookshelf, export, and the Supabase persistence design). They record what
was decided and why, and are worth reading before reworking any of them.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Tiptap 3 editor · `@anthropic-ai/sdk` (the assistant) · `ai` v7 through Vercel AI
Gateway (speech and transcription) · `docx` + `jszip` for exports. Path alias
`@/*` → `src/*`.

This is a newer Next.js than your training data (see AGENTS.md). Two things that
bite: `params` is a `Promise` and must be awaited, and route components are typed
with the generated helpers `PageProps<"/route">` / `LayoutProps<"/route">` rather
than hand-written prop types.

## Architecture

**Persistence is one module.** `src/lib/library-store.ts` is the *only* file that
touches `localStorage`; everything else goes through it. This is deliberate — the
planned Supabase migration is meant to be a rewrite of that one module plus its
React bindings, with nothing else changing. Keep that boundary intact.

**The store is split by write-cost, not by type:**
- **shelf** (`openchapter:shelf`) — one document holding every book with its
  chapter list (ids, titles, order, denormalised word counts) plus each book's
  per-book settings: page setup, body typography, the front/back-matter tag and
  bookmark flag per chapter, and the trash list. One doc so a reorder commits
  atomically. Parsed on every read by every screen.
- **bodies** (`openchapter:chapter:<id>`) — one Tiptap JSON document per chapter,
  each at its own key, so opening a 40-chapter book parses no prose.
- **covers**, **notes**, **prefs** — likewise at their own keys, for the same
  reason: unbounded data that must not ride along in every shelf write.

Book/chapter totals are summed on read, never stored, so they can't drift.
Deleting a chapter is a soft delete: its meta moves to the book's `trash` list in
the shelf, but its body and notes stay at their own keys until the trash is
emptied, so a restore is lossless. A *book* is soft-deleted differently — it
stays in `shelf.books` and gains an `archivedAt` or `trashedAt` stamp, and
`booksIn(shelf, view)` filters the three shelf views out of the one list.

**Two subscription audiences, opposite needs.** Shelf listeners want every write
including our own (renaming a chapter must repaint the sidebar now), so local
fan-out is manual and shelf-only. Body listeners want *only* other tabs — echoing
our own save back would remount the surface the writer is typing into. The
`storage` event covers cross-tab for both, since browsers fire it only in other
tabs. Get this backwards and you eat the caret.

**React binds via `src/lib/use-library.ts`** — kept apart from the store so the
store stays React-free. It uses `useSyncExternalStore` with empty server
snapshots (SSR renders nothing, the client swaps in real data after hydration).
`useHydrated()` distinguishes "no books yet" from "storage not read yet"; guard
on it before rendering not-found states. Server snapshots must be referentially
stable (see the frozen `EMPTY_SHELF`) or the store loops.

**The editor** (`src/components/editor/chapter-editor.tsx`) is Tiptap. The surface
is keyed on `${chapterId}:${storedText}` so a save from another tab reloads it
instead of leaving it stale. Autosave is `src/lib/use-autosave.ts`; body is
written before word count (a stale count is cosmetic, lost prose is not). Custom
Tiptap extensions live in `src/lib/editor/`: font size, font family, text align,
blockquote, resizable images, and `no-indent.ts`. That last one is a mark, not a
setting, and it pairs with `click-to-type.ts` — double-clicking blank page below
the prose puts the caret *there* (Word's click-and-type), and a paragraph the
writer placed must begin where the caret was shown rather than take the book's
first-line indent. Aligning a body paragraph left is a different question and
must leave the indent alone, which is why the two aren't one attribute.
`caret-scroll.ts` is the other pure one: move the view only when the caret would
leave it, and then only as far as the edge.

The one to understand is `pagination.ts`: it sets the manuscript on real page
sheets by *measuring* the rendered text and inserting
spacer **decorations** at each page break — never document content, so undo,
autosave and export see the same text. It measures in **lines**, not blocks, so a
long paragraph fills the page and continues over the seam the way Word's does;
the break arithmetic is the pure, tested `pageBreaks()`. Two things hold it
together: every measure runs with the existing spacers `display:none`, so breaks
are always computed from the document's natural flow and can never drift pass by
pass; and a mid-paragraph gap is a full-width **inline-block**, because a block
box there would make the browser split the paragraph into anonymous blocks and
the continuation would take the book's first-line indent. A paragraph whose lines
can't be read falls back to moving whole, which is how this worked before. Inline images are a resizable node
(`resizable-image.ts` + `image-node-view.tsx`) that stores width as a percentage
of the column; `src/lib/image-import.ts` handles paste/drop, capped at 900KB.

**The editor shell is a rail, a tool panel, and the book panel.**
`workspace-rail.tsx` selects which tool panel (`PanelTab` in `left-panel.tsx`:
chapters, search, notes, bookmarks, assistant, trash) is open, and clicking the
active tab closes it — one control, never two. The chapter editor and the book
overview now mount the *same three*, so a change lands on both screens at once:
both pass `chapters={false}` and keep the tool panel closed until a tab is
picked, because `book-panel.tsx` on the right is already the chapter list. The
overview used to carry its own list on the left instead; two navigators for one
book meant two things to keep in step, so the older one is gone. The overview
differs only in having no manuscript — it shows `book-guide.tsx` where the page
would be, and passes no `dictation`, so the panel's microphone hides rather than
appearing with nowhere to put the words.

`book-panel.tsx` is the navigator proper: the book's three parts as cards
(front/body/back), each in its own colour, the chapter list inside the body one.
Its face is the stored `bookPanel` pref rather than component state, so a reload
does not put the writer back on the cover; the list's own open/shut lives in
`useBodyOpen`, exported from that file and called by the *screen* rather than the
panel, because the manuscript needs the same answer — the page sheet's edge takes
the colour of whichever part the panel has selected (`data-matter`, and the
`--paper-edge-*` tokens in `globals.css`), and pressing Chapters selects the body.
Two copies of that state would be two answers to one question.

The panes live in the *pages* rather than in `book/[bookId]/layout.tsx`, because
the left panel needs the chapter id and the assistant needs the editor instance,
neither of which a layout can see. The import banner is the exception and does
live in that layout — it has to survive the writer clicking chapter to chapter.

**The reading view** (`/book/[bookId]/read`, `src/components/reader/`) sets the
whole book on real page sheets at the book's trim size. Prose is not re-laid out:
each chapter is walked through the export path (`toBlocks` → `blocksToXhtml`) and
styled with the book's typography, so the read-through, the print PDF and the
EPUB match. Pagination *is* ours — the browser has none on screen — so
`paginate()` in `reader-pages.tsx` measures the rendered blocks in a hidden
column at the page's true content width (outside any `zoom` wrapper, which would
distort the numbers) and packs them into page-height groups, re-running once the
manuscript font loads. **That same `paginate()` backs the editor's Book View
preview** (`page-preview.tsx`), so both break pages identically; keep them on the
one function. `reader-flipbook.tsx` is the same flowed pages presented as a book
you open and turn.

**Import, export and the reading view share a format-neutral block IR**
(`Block`/`Run` in `src/lib/export/blocks.ts`). A Tiptap doc is walked once into
blocks, then each renderer consumes them — the tricky parts (marks, nesting, hard
breaks) live in one tested place. Heavy libraries (`docx`, `jszip`) are
dynamically imported so a writer who never exports never downloads them.
- Export: `src/lib/export/` — markdown, docx, epub, and PDF via the browser's
  print engine (`print.ts`, rendered into a hidden iframe). `index.ts`
  orchestrates; `xhtml.ts` is the shared XHTML renderer behind epub, PDF and the
  reader; `typeset.ts` controls the look of the outputs that are ours;
  `front-matter.ts` generates the title/copyright/contents pages.

**The EPUB is built to be sold, not just opened**, and it is **verified against
EPUBCheck 5.3 (EPUB 3.3): 0 errors, 0 warnings**, for both a fully-specified book
and a bare one with no cover and nothing filled in. Re-check after changing
anything in `epub.ts` — the suite tests the strings, not the spec.

Three things in there are load-bearing and none of them are visible in a working
file. The cover is declared *twice*, under `properties="cover-image"` and the
legacy `<meta name="cover">`, because which one a given shop reads is not
knowable in advance. The identifier comes from `bookIdentifier()` and is derived
from the book's id, never minted fresh: a random UUID per export makes a
corrected file read as a second, unrelated title, which is how one book becomes
two listings. And the `schema:access*` metadata is written from what the book
actually contains — claiming `alternativeText` for undescribed pictures is a
false accessibility claim, which is worse than an absent one.

`epub-images.ts` lifts inline images out of their `data:` URLs into real
`OEBPS/images/` entries, de-duplicated across the book. Note what this is *not*
for: a `data:` src passes EPUBCheck fine (checked, not assumed). It is for size —
base64 is a third larger than the bytes and compresses badly inside XHTML, and a
repeated ornament is one file instead of one copy per use.

`src/lib/publishing.ts` holds the listing details (ISBN with a checked digit,
language, publisher, blurb, categories, series) as `Book.publishing`, and
`storeReadiness()` is the honest half of a Publish button: it reports what a shop
would refuse and never vetoes the export, because a writer is allowed to want the
file for their own reader. `checkStoreReadiness()` in `export/index.ts` is the
half that has to read the manuscript, which is why it is not in the pure module.
- Import: `src/lib/import/` — docx, epub, md, txt, html, plus audio via the
  transcriber. `index.ts` dispatches by extension and refuses `.doc`/`.pdf` *by
  name* with what to do instead; `split.ts` breaks a flat block stream into
  chapters.

**The small pure modules** are where the conventions of the trade live, kept out
of components so they can be tested and changed in one place: `book-kinds.ts`
(novel/novella/short story, genre word-count targets), `book-templates.ts`
(chapter skeletons only — never boilerplate prose), `search.ts` (walks plain text
out of stored Tiptap JSON for the ⌘K panel), `page-setup.ts`, `typography.ts`,
`relative-time.ts`, `use-typewriter.ts`.

Two of them are about accounts and both are tested. `account.ts` resolves the
name, face and email the chrome shows — a chain of fallbacks rather than a field
lookup, because Google hands over a real name and a photo and an email signup
hands over neither, and the shelf header and the account dialog have to agree on
the answer. It takes whatever is in the JWT rather than a typed user, since
`user_metadata` is written by identity providers and has never been
type-checked. `auth-redirect.ts` is `safeNext()`, the open-redirect guard on the
`?next=` parameter: rooted same-site paths only, which means rejecting `//evil`
(protocol-relative, and reads as a path if you only check the leading slash) and
anything with a backslash. Anyone can put anything in that query string.

**The assistant** is `src/app/api/chat/route.ts` — Anthropic streaming. Needs
`ANTHROPIC_API_KEY` in `.env.local`; without it the route returns 501 with a
message saying so. Chapter text is sent only when the writer opens the panel and
asks, and rides in the (cached) system prompt.

**Audio is three separate things, and they are not interchangeable.** All three
degrade the way the assistant does — no key, 501 with a message saying so — and
the two paid ones need `AI_GATEWAY_API_KEY` (not the Anthropic one) and check
auth themselves, because the proxy skips `/api` and a minute of speech is
somebody else's invoice.
- **Text → audio** (`/api/narrate` + `src/lib/export/narrate.ts`,
  `export/audiobook.ts`): the export page's Audiobook card, one MP3 per chapter
  in a zip. The route does *one chunk per request* and is stateless; the loop is
  driven from the client so a 40-chapter book is 40 visible steps rather than one
  request that fails having produced nothing. The tested part is `speechChunks()`
  — cut at the largest boundary that fits (paragraph, then sentence, then word,
  never mid-word), because a break mid-clause is audible.
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

**Auth is Supabase, and optional.** Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the app grows accounts and a sign-in
wall; leave both unset and it runs exactly as it always did, local-only, with the
account menu saying why — the same shape as the missing API key. Every entry
point checks `isSupabaseConfigured()` first, because the clients throw on an
empty URL.

`src/proxy.ts` is the load-bearing file (Next 16 renamed Middleware to Proxy). A
Server Component cannot write cookies, so something ahead of the render must
refresh an expired token and store it — without that file, sessions die
mid-session and writers get logged out at random. Two details are easy to get
wrong: `setAll` must rebuild the response *after* putting the new cookies on the
request, and it must copy the `headers` argument onto the response, or a CDN
caches one writer's `Set-Cookie` and serves it to the next reader. A redirect out
of the proxy has to carry those cookies too. The gate reads `getClaims()`, which
verifies the JWT signature — never `getSession()`, which trusts the cookie.

`src/lib/supabase/` holds the three clients (browser, server, and the one the
proxy builds inline); sign-in/up/out are Server Actions in
`src/app/auth/actions.ts`, so the session cookie and the redirect land in the
same response and there is no sign-in flash. The proxy skips `/api` on purpose —
redirecting a `fetch` to an HTML page yields a parse error, not a 401 — so the
chat route checks for itself.

**Everything funnels through `/auth/confirm`.** Password reset, email
confirmation and Google all end there: `/forgot-password` mails a link pointed
at `/auth/confirm?next=/reset-password`, and `signInWithGoogle` (a Server
Action, so the PKCE verifier lands in an httpOnly cookie) sends Google → Supabase
→ the same route. One place creates sessions, whatever started them. So
`/reset-password` needs no token of its own and is *gated* rather than public —
by the time a writer arrives they are signed in, and `updateUser()` knows who
they are, which also makes it a plain change-password screen for anyone already
in. Google's redirect URI is registered as *Supabase's* callback, never ours;
our domains live in Supabase's Redirect URLs allowlist.

**Supabase reports auth failures in the URL fragment**, which browsers never
send to a server. `useFragmentError` in `auth-shell.tsx` reads it after
hydration — through `useSyncExternalStore`, like `useHydrated`, with the capture
cached at module scope so the snapshot stays stable and survives the effect that
wipes the hash. Without it every failure reads as "that link expired", including
a rejected OAuth secret, which is a genuinely misleading place to start
debugging. The four auth screens share `auth-shell.tsx` so the chrome cannot
drift between them.

**Persistence is Supabase behind localStorage, not instead of it.**
`library-store.ts` still reads and writes `localStorage` synchronously — that is
what lets `useSyncExternalStore` read a snapshot during render, and why none of
the 37 files that read the store changed. `src/lib/sync.ts` is the async half:
`commit()` diffs the shelf and pushes what moved, and `syncWithServer()`
reconciles once per load. Reading through Supabase directly would make
`getShelf()` async, which unpicks all of it — and would cost offline, which for a
drafting tool is not a nice-to-have. The price is last-write-wins per chapter
between two machines. See `docs/plans/2026-07-29-supabase-persistence-design.md`.

Two things in there are load-bearing. **Pushes are diffed in `commit()`**, not
added at each of the twenty-odd mutation sites: every shelf write funnels
through it and the writes are immutable, so reference inequality is an exact
test for "this book changed" — and a new mutation cannot forget to push.
Deletions are found by comparing chapter id sets before and after, because
`pushBook` upserts a book's chapters but cannot know one was removed.

**The mapping narrows values on the way out** (`matterOrNull`, `count`, `text`,
the guard in `toIso`). The types describe today's code; `localStorage` holds
whatever older versions left there, unchecked by any compiler, and the database
has CHECK constraints and NOT NULLs that will refuse the difference — one stale
field in one chapter is otherwise enough to abort a whole library upload.
`uploadLibrary` also drops bodies and covers whose chapter or book is not going
up: after enough versions some keys belong to nothing, and a dangling foreign
key takes the batch with it.

The SQL behind all that is checked in: `supabase/migrations/`. Schema changes
belong there, not only in the dashboard.

**Payments are PayHere, and optional in the same way everything else is.** Set
`PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` and the app grows plans;
leave them unset and there are no plans *and nothing is held back* — the
assistant, the audiobook and the bookmarks panel all work, and the Upgrade
button says why there is nothing to buy. `isBillingConfigured()` is checked
first everywhere, and `requirePro()` passes everyone when it is false, so a
self-hosted copy running on its owner's API keys behaves exactly as it did
before billing existed.

`src/lib/billing/` is the pure half — `plans.ts` (the price table, the cycle
arithmetic), `signature.ts` (PayHere's two MD5s), `subscription.ts` (`isPro()`,
the status codes) — all tested. `payhere.ts` holds the credentials and is
server-only by naming: none of it carries a `NEXT_PUBLIC_` prefix, so an
accidental client import reads empty strings and `isBillingConfigured()`
answers false rather than leaking a secret. `server.ts` is `requirePro()`, the
gate in front of `/api/chat`, `/api/narrate` and `/api/transcribe` — 401 when
signed out, **402** when signed in and unpaid, and the three are different
messages because "sign in" shown to someone already signed in is a loop.

Four things in there are load-bearing.

**Only the webhook grants Pro.** `/api/billing/notify` is a POST from PayHere's
*servers*, with no session and no cookies, and it is the one caller that writes
`subscriptions` — which is why `authenticated` has no insert or update grant on
that table at all and the route uses the secret key
(`src/lib/supabase/admin.ts`). The return_url is not proof of anything: a writer
can type it. `/upgrade/done` therefore polls rather than assumes, because the
browser's redirect and PayHere's notification race and are not ordered.

**The notification is verified before it is believed.** The URL is public and
the body is entirely attacker-shaped; `verifyNotification()` against the
merchant secret is the only thing standing between that and a stranger writing
"paid" into the table. A bad signature is refused with 403 and never retried.

**It is idempotent on `payment_id`,** which is the primary key of
`payment_events`. PayHere retries anything it did not get a 200 for, and a
subscription charges again on the *same* order id every cycle — so an order
cannot be the key, and a retry that re-ran would extend the period twice.
Anything the route cannot act on answers 200 and logs; only a storage failure
answers 500, because that one *should* come back.

**A cancel goes to PayHere first and our table second.** The other order leaves
a writer who has been told they are cancelled with a card still being charged.
Cancelling takes a second credential pair (`PAYHERE_APP_ID` / `_APP_SECRET`) for
the Subscription Manager API; without it the account dialog shows no Cancel
button rather than one that cannot work. Cancelled is not gone — `isPro()` runs
a cancelled plan to its paid-up date with no grace, and an active or past_due
one three days past it, because a renewal that needs one retry is a normal
Tuesday and PayHere's queue is not instant.

`use-plan.ts` is the client's view of all that, and it **fetches rather than
derives**: the plan lives in Postgres and changes when PayHere says so — a
webhook away, months later, with no page open — so there is nothing local to
read it from, and it is deliberately not part of `library-store.ts`. Nothing it
returns gates anything that costs money; the billed routes check server-side,
which is the only check a reader with devtools cannot edit. It exists to tell a
writer the truth about their own account.

**The root layout carries three things no screen owns.** `ThemeSync` (above),
`LibrarySync` — which runs `syncWithServer()` once per mount, enough because
every way of signing in ends in a redirect or full navigation, and flushes
queued pushes on `visibilitychange` so a closed tab doesn't take the last save
with it — and `AppLoader`, the held splash. `AppLoader` skips `/` deliberately
and is *seeded* to "gone" there rather than switched off in an effect, or it
paints and is taken away, which is the flash it exists to prevent.

**The landing page is the one screen not built from the app's tokens.**
`src/components/landing/` is what a signed-out visitor sees at `/`, drawn to the
"OpenChapter Landing v2" design in that design's own palette and in Plus Jakarta
Sans (`font-brand`, declared in `globals.css` and wired in `layout.tsx`). The
hexes are written literally on purpose: the `@theme` tokens describe the
*product*, and this is a shop front — a fixed composition built around a
photograph and a shelf of covers. Bending the app's tokens to cover both would
make several of them lie a little. (It used to carry `data-theme="light"` to opt
out of the dark theme; that theme is gone, so the attribute went with it.)

Three things there will bite. `sections.ts` has no `"use client"` and exists
*only* so both sides of the boundary can read the section list: Next replaces a
client module's exports with client references, so a Server Component importing
`SECTIONS` from `landing-nav.tsx` gets `.map` of a reference object and the page
500s. The nav's scroll listener reads its scrolling *container*, not the window —
`<body>` is `overflow-hidden`, so `window.scrollY` sits at 0 forever and the bar
never gains its background. And the header's `h-16` and the hero's compensating
`-mt-16 pt-32` are one measurement written in two places; move one without the
other and the first heading slides under the bar.

**Every claim on that page has to be true of the code**, which is where it
departs from the source design — the deltas are listed in the header comment of
`landing-page.tsx` and marked again at each site. The largest: four of the eight
rows in `publishing-check.tsx` were invented by the design and are *gone* rather
than reworded, because each remaining row is a check `storeReadiness()` actually
performs and the section is one click from a signup that would show the real
panel. `works-with.tsx` names export destinations rather than customer logos
(there are none to show), with real marks in their real colours and the sourcing
and licences recorded in the file. The figures (`landing-figures.tsx`,
`toolkit-figures.tsx`, `laptop-mockup.tsx`, `book-fan.tsx`, `formats-flow.tsx`)
are drawn from the app's own tokens rather than screenshotted, so they cannot go
stale silently while the app moves.

**Routes:** `/` — landing page for a signed-out visitor, shelf for a writer,
decided on the server off `getClaims()` so neither sees the other's screen
first; with no Supabase configured everyone gets the shelf ·
`/signin` · `/signup` · `/forgot-password` ·
`/reset-password` · `/auth/confirm` (the far end of any emailed link) ·
`/upgrade` plans (public — a price is read before an account exists) ·
`/upgrade/checkout/[orderId]` billing details, then a form POST straight to
PayHere · `/upgrade/done` PayHere's return_url, which polls ·
`/book/new` setup · `/book/import` · `/book/[bookId]` book
overview (lands here, not on a chapter) ·
`/book/[bookId]/chapter/[chapterId]` editor · `/book/[bookId]/read` reading view ·
`/book/[bookId]/export`.

## Styling

Tailwind v4 with the palette declared in `@theme` in `src/app/globals.css`. Colors
are named for their *job* (`surface`, `panel`, `raised`, `line`, `fg`, `muted`,
`accent`) so a hue change doesn't make class names lie. The writing surface has
its own palette layer: a `[data-paper]` attribute re-points `--paper-*` CSS vars,
and anything that should sit with the page rather than the chrome opts in via that
attribute. Body type is the same shape: `src/lib/page-setup.ts` and
`src/lib/typography.ts` turn a book's page-and-type settings into `--ms-*` custom
properties on the manuscript container, which the editor and the reading view
both read — so one setting styles the writing surface and the read-through alike.

**There is one palette, and it is light.** A light/dark theme lived in `prefs`
until it was removed — with it went `ThemeSync`, the pre-paint bootstrap script
in `layout.tsx`, `suppressHydrationWarning` on `<html>`, the rail's toggle, and
the `:root[data-theme="dark"]` block. Nothing reads `data-theme` now. Do not add
a `dark:` variant to a class: it will never match, and it reads to the next
person as if the app still had a theme. If dark is ever wanted back, the git
history has the whole of it in one commit.

Two writer-facing looks are still stored in `prefs` and each is applied its own
way: `paper` as `[data-paper]` on the writing surface, and `focusMode` /
`typewriter` as behaviour.

`<body>` is `overflow-hidden` (for the editor shell). A standalone scrolling page
therefore needs `h-dvh overflow-y-auto` — `min-h-dvh` puts content out of reach.

## House rules

- **No dead UI.** A control either works or plainly says it isn't built. Don't
  copy chrome from a reference and leave it inert.
- **No claim the code can't back**, which is the same rule pointed at words
  instead of controls. The landing page, the pricing rows and the FAQ are held
  to what ships — the print PDF is the browser's print engine and is *not*
  print-ready in the trade sense, and every page that mentions it says so. When
  a design or a reference promises something we don't do, cut the promise rather
  than reword it.
- **The Help dialog is documentation and goes stale like documentation.** When a
  feature ships, add it to the `SECTIONS` list in `shelf/help-dialog.tsx` — it's
  the only place in the app that explains what exists.
- **Templates and Background sound are built, tested, and have no way in.**
  `templates-dialog.tsx` + `book-templates.ts`, and `ambience.ts` +
  `use-ambience.ts` + `sounds-dialog.tsx`. They were shelf buttons pointed at an
  "Available soon" dialog; the buttons are now gone too, so the code is
  unreachable. It is not dead — do not tidy it away. `TODO.md` says what each is
  waiting on, and adding a rail item that opens the real dialog is the whole of
  switching either on.
- Storage limits are real: covers capped at 250KB, inline images at 900KB, import
  at 8MB — localStorage is ~5MB per origin. `setCover` and `createBookFromImport`
  fail cleanly and return a signal; honour it.
- `TODO.md` tracks pending work and records *why* things were cut (e.g. front/back
  matter, per-chapter status). Read it before rebuilding something that looks
  missing — it may have been removed on purpose.
