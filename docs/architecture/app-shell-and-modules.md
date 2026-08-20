# The root layout, the small pure modules, and feedback

Read before touching the root layout, `ThemeSync`/`LibrarySync`/`StorageAlert`, `resume.ts`, `account.ts`, `auth-redirect.ts`, `plural.ts`, or the feedback dialog.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

**The small pure modules** are where the conventions of the trade live, kept out
of components so they can be tested and changed in one place: `book-kinds.ts`
(genre word-count targets — it asked novel/novella/short story too until
2026-08-15, and the note at the top of the file says why the picker went),
`book-templates.ts`
(chapter skeletons only — never boilerplate prose), `search.ts` (walks plain text
out of stored Tiptap JSON for the ⌘K panel), `page-setup.ts`, `typography.ts`,
`relative-time.ts`, `use-typewriter.ts`, and `plural.ts` — which is the
third-copy rule again: it was private to `bookshelf.tsx`, so the shelf said
"1 book" correctly while a dozen other screens printed "1 words", "1 days
written" and "1 copies". Its irregular form is a *parameter*, not a rule, since
English plurals are not derivable and "copy" is the one that matters here.

`resume.ts` belongs to that set and is the one to understand, because it stores
nothing: the "where you left off" card on the book overview
(`resume-card.tsx`) is the tail of the last paragraph written plus the first
line of the chapter note, both read back out of what already exists. The
chapter is `lastOpenedId` *when it has prose*, falling back to the last chapter
with any — quoting an empty chapter back at a returning writer is worse than
saying nothing — and the excerpt is the paragraph's tail rather than its head,
cut at a word, because what a writer needs is the sentence they stopped in the
middle of.

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


**Feedback is a private channel, and what it may carry is the whole design.**
`src/lib/feedback.ts` (the topics and the four faces) plus `feedback-dialog.tsx`,
which inserts straight into Supabase. The migration grants `authenticated` an
insert and **no select at all**, so a signed-in reader with devtools cannot read
anybody's notes including their own — it is a suggestion box, not a forum.
Nothing about the book is sent: no title, no word count, and deliberately not
the URL, because a URL in this app carries book and chapter ids. What goes is
the message, a topic from a fixed list, one face, and the account id the server
already knows. The dialog lists exactly that above the send button; if you add a
field, add it there too.

**The root layout carries three things no screen owns.** `ThemeSync` — which
applies `[data-theme]`, listens to `prefers-color-scheme` while the pref is
"system", and runs the one-time theme migration — `LibrarySync` — which runs
`syncWithServer()` once per mount, enough because
every way of signing in ends in a redirect or full navigation, flushes
queued pushes on `visibilitychange` so a closed tab doesn't take the last save
with it, and calls `askToPersist()` — and **`StorageAlert`**, which renders
nothing until a write runs out of room (see the storage-room note above). All
three are facts about the app rather than about whichever screen noticed them.

**`AppLoader` was the fourth and is gone**, at the owner's request: it held the
loading screen up for a second on every route but `/` so the logo's fill
animation had time to play, which is a delay the product invented and a writer
paid for. `LoadingScreen` (`src/components/loading-screen.tsx`) still renders
wherever a screen genuinely has nothing yet, and is a spinner rather than a
mark, so there is nothing left that needs holding. Do not reintroduce a splash
to cover a load that is already instant.


