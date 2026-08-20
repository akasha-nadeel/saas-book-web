# The landing page, the tool guide, and the marketing claims

Read before touching `src/components/landing/`, `tools-page.tsx`, `tool-guide.ts`, or any public-facing claim.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

**The landing page is one Server Component** —
`src/components/landing/landing-page.tsx`, what a signed-out visitor sees at
`/` — **plus four client pieces it cannot hold itself**: `landing-header.tsx`,
and the three things that go in a window (below).

**There is a second marketing page, and it exists to buy back what the tool
cloud gave up.** `/tools` (`tools-page.tsx` over the pure `tool-guide.ts`) is
every tool explained one at a time, grouped the way `book-tools.ts` groups them.
The cloud that replaced the four cards of pills says *how many* tools there are
and nothing about what any of them does — its own note calls that a real loss —
so the names, the grouping and the explanations live here, one page along, with
a button under the cloud as the way in. Four things hold it:

- **`book-tools.ts` still declares a tool; this only describes one.** The path,
  name, mark and one-liner stay there and are read by the two screens *inside*
  the app; `tool-guide.ts` holds the headline, the claim and the three folded
  points a *visitor* needs. **A test walks `ALL_TOOLS` and fails if either side
  lacks the other**, so a seventeenth tool cannot ship as a heading over an
  empty column — the same shape as the `DESTINATIONS` check behind the
  dashboard's findings.
- **The row is `feature-row.tsx`, shared rather than copied.** It came out of
  `feature-shots.tsx` when this page needed the same layout sixteen more times.
  Every measurement in it is an argument (the uneven columns, the alternation,
  the `<details>` disclosures that keep both sections free of JavaScript), and
  two copies is how two sections meant to look identical end up a step apart.
- **The screenshots are not in yet and the space is reserved, not collapsed.**
  `ToolShot` draws the tool's mark on a stage at `aspect-[2/1]` — the
  proportion the existing captures take — so filling `guide.shot` in later
  moves nothing on the page. The stand-in claims nothing about the screen it
  stands for, because a mocked-up interface is the one thing this site refuses.
- **No plan claims in `tool-guide.ts`, and a test enforces that too.** What is
  metered is `free-limits.ts`'s answer and it moves; a sentence here repeating
  it goes quietly wrong on the page a reader uses to decide. The line *"None is
  behind the paid plan"* came off the cloud in the same commit for that reason.

`LandingHeader` and `LandingFooter` both take a `home` flag because of this
page: three footer columns and the nav's anchors are in-page links, which scroll
nowhere off `/`, so away from home they are rooted to `/#order`. It is a prop
rather than `usePathname()` so neither has to become a client component.

**The bar's Tools entry is a menu, and it is the only nav item that earns the
machinery.** `tools-menu.tsx`: four columns from `TOOL_GROUPS`, a small grey
label over a column of names, each name linking to **that tool's own row** —
`/tools#comps`, matched by an `id` on every `FeatureRow` there. The section it
used to point at is a cloud of marks around a count, which is right as a section
and useless as a destination since it names none of the sixteen. Five things
hold it:

- **Hover opens it; hover is not the only thing that does.** A menu that exists
  only under a pointer does not exist on a touchscreen, under a keyboard, or by
  voice — and this one holds the only links to two thirds of the product. The
  trigger is a real `<button>` with `aria-expanded`: pointer, press, and focus
  all open it, Escape closes it and returns focus to the trigger.
- **`CLOSE_MS` is a grace period on the way out**, because the panel hangs below
  the bar with a gap, and a menu that closes the instant the pointer leaves the
  word closes while the pointer is crossing to the thing it was aimed at. A
  delay rather than an invisible bridging element, which would swallow clicks on
  whatever is under it.
- **The bar must not slide away while it is open.** The header hides on a
  downward scroll and is this panel's ancestor, so it would take the open menu
  off the top of the screen mid-read. The menu reports upward through
  `onOpenChange` and `hidden && !menuOpen` is where that is spent — the scroll
  listener goes on recording direction either way, so the bar is correct the
  moment the menu closes rather than needing another scroll to catch up.
- **The panel stays mounted and hides with `invisible`.** An unmounted panel
  cannot animate out, and — the one that bites — the `onBlur` that closes it
  needs the element focus is leaving to still exist when the event fires.
- **Every nav entry points at something that exists**, and that rule has already
  cost one: "What it does" pointed at `#does`, whose section came off the page on
  2026-08-14. The header's copy went in the same commit and **the footer's did
  not**, so it offered a scroll to nowhere until 2026-08-15. Both are `#inside`
  now. Anchored sections carry `scroll-mt-20` and linked rows `scroll-mt-28`, or
  the jump lands with the heading under the bar.

**There is one window, and `app-window.tsx` is it.** The page had a tablet slab
under the check demo, another under the listing form and a bare card in the
hero; three frames on one page read as three products. So one frame takes all
three, and its `label` prop is the load-bearing part — the two demos are
*pictures* (they pass a label, take `role="img"`, and hide their contents behind
that one description), while the hero passes none, because what is inside it is
a real file input and a screen reader has to meet the control rather than a
sentence about a picture of one. Get that backwards and the only working thing
on the page goes invisible to the people who most need it announced.

The two pictures are `check-demo.tsx` (the dashboard working: Overview →
Prepare → a book's findings, each with its fix beside it) and
`store-listing-demo.tsx` (the listing form filling itself in beside "Every
field a shop asks for"). Both quote the real screens' strings, so they can only
go wrong if the product does. Two rules govern anything that animates there. It
runs only while on screen and stops with the tab, because a landing page is a
page somebody leaves open. And **it measures with the camera parked** — the
pointer aims at real rects, `getBoundingClientRect` reports the *transformed*
rect, and the fonts land a second in, so measuring through a live push records
where a field currently appears rather than where it sits and the pointer clicks
air. Same rule as `pagination.ts`.

**The hero carries the real check, not a picture of one.**
`book-check.tsx` over the pure `file-check.ts`: a signed-out visitor drops the
manuscript they already have, it is parsed *in their browser* by the ordinary
`importFile` path, and `storeReadiness()` reports what a shop would refuse —
the same findings, in the same order, in the same words as the dashboard. Four
rules hold it together.

`checkFile()` **invents no rules**; it goes through `fromReadiness()` like every
other screen, so there is no second, louder list of shop rules written for
marketing. It **raises the advisories** that `checkup()` gates by phase, on the
same reasoning as the Prepare screen: somebody who has dropped a finished
manuscript on a page about uploading has asked the publishing question. Findings
are **never held back for an email** — the whole list shows whether or not
anybody signs up, because gating them is the pattern this reader has been burned
by; what needs an account is *fixing* something, and the buttons say so before
they are pressed. And **the book comes with them**: pressing a fix writes it to
`localStorage` and sends them to `/signup?next=` the tool that mends it, which
works because `syncWithServer` already handles a library that existed before the
account did. Nothing is written until they press, so a visitor who only wanted
the check leaves no trace either.

This is why the file's metadata had to be read (see the import note above): the
landing page and the dashboard must not say different things about one file.

**Its positioning is "nobody tells you the order"** — the sharpest thing in the
writer research and the one claim a competitor cannot answer by shipping a
feature, because it is the shape of the problem rather than a part of it. So the
page leads with the order, proves it by naming where the ARC step sits, and only
then says what the software does. It opened on a feature for a while, which is
an answer to a question the reader has not been asked yet. **Sharing a book is
on the page but after the tools, never in the hero**, for that same reason — a
co-writer feature is exactly the kind of thing a competitor can answer by
shipping one. Its figure is drawn in markup and its seat numbers come from
`SEATS_PER_BOOK`, so it can only go wrong if the product does, and an FAQ entry
answers the question the section invites: this is not Google Docs, and you will
not see each other type.

**It is always light, and it is the only screen that is.** It followed
`data-theme` for a while, on the argument that a reader on a dark machine has
not expressed a view about our marketing — they have told their whole screen
how bright to be, and the one page ignoring them was the first one they ever
saw. That holds for *the app*, a room somebody works in for hours, and is the
wrong trade for a shop front: this page is one composition whose grounds,
marker and closing banner were drawn and measured against white, and the dark
set was a second design of it nobody could hold in their head at once.

**The mechanism is one attribute, and it is why the light block's selector is
`[data-theme="light"]` rather than `:root[data-theme="light"]`.** These tokens
are inherited variable re-points, so the page's root `<div>` carries the
attribute and everything under it resolves to daylight whatever `<html>` says —
covering the `lp-*` set *and* the app tokens the page borrows in one place,
which a per-token override could not. `color-scheme` rides along, so that div's
scrollbar comes out light too. Nothing else may write that attribute below the
root: it is the app's own theme everywhere else.

**The dark `lp-*` values are still live** — the four legal pages share this
palette through `legal-shell.tsx`, are opened by writers from inside the app,
and do follow the theme. So every `lp-*` token goes on being stated in both
blocks, like every other token in the file.

Four things about that palette are worth knowing:

- **It reuses the app's tokens wherever the two mean the same thing** — `fg`,
  `muted`, `line`, `raised`, and the whole `ok`/`note`/`stop` family, whose
  light values already *were* the landing page's reds and ambers. The `lp-*`
  names exist only for what the chrome has no word for: two tinted grounds,
  the drawn tablet's shell, and the accent shades below. That borrowing is the
  reason pinning the theme had to be done by scope rather than by re-pointing
  the `lp-*` names: half the page's colour does not come from them.
- **`lp-accent` is the fill and `lp-accent-text` is the same colour as type**,
  and at night they must be two values: white has to sit on the fill and a link
  has to sit on near-black, and no single indigo clears 4.5:1 in both
  directions. In daylight they are identical. Use the fill for anything filled
  and the text one for anything read.
- **The accent keeps its hue at night**, where the chrome's accent goes white.
  The chrome's reason does not transfer: this page's largest element is a
  full-bleed block *of* the accent, so following `--color-accent` would have
  put a white slab across a dark page.
- **The drawn artwork stays literal in both themes** — the book covers in the
  figures, and the brand marks in `works-with.tsx`. A cover is a picture of an
  object and a trademark is a trademark. Only the drawn *interface* inside
  those figures follows the theme, because it is a picture of this app.
- **`--color-lp-card-1/2/3` and `--color-lp-road` are the page's one
  decorative hue, and the only one.** Indigo, peach and violet hold the three
  refusal cards; the green holds the order road's field. Everywhere else here a
  colour carries a fact — indigo is the way forward, the status family is a
  verdict — and these carry none: they exist so cards in a column are told
  apart by the floor under them. Two rules keep that from leaking, and both are
  in the long note beside them in `globals.css`: they are **grounds only**,
  never ink and never a control or a badge, and they stay at about 4%
  saturation, because a stronger middle card reads as amber, which on this page
  means *this costs you readers*. `--color-lp-road` is the one to watch — green
  is the `ok` end of the status family, so a saturated version of it would say
  the road is *finished* to somebody who has not started.

Three things in it are load-bearing:

- **The figures are drawn in markup, never screenshotted** — the phase list,
  the pre-upload check, the money panel. A screenshot is an asset that goes
  stale silently while the app moves, on the one page whose whole pitch is
  being checkable. **Three of them go further and are *computed*
  (`refusal-figures.tsx`)**: the three refusal bands each carry a picture of
  the screen that catches them, and the covers one runs `coverReport()` over a
  fixed set of measurements while the export one filters `DESTINATIONS` the way
  the real dialog does — so every row, label and count in them is the app's own
  answer and there is nothing left to drift. Prefer that shape for any new
  figure whose subject is a pure module. **"The whole point" is five
  alternating rows** (`order-rows.tsx`): a drawn screen on one side, the phase
  on the other, sides swapping down the page, each screen captioned with the
  name of the screen it draws. It has no `"use client"` and ships no script.

  It **replaced an order road on 2026-08-13** — the five phases as stations on
  a measured curve with a marker riding it as the reader scrolled. That road is
  still in the tree, imported by nothing, along with the pure and still-tested
  `landing-path.ts`; TODO.md records why it went and what the rows owe it. The
  short version is the part to keep: the road's argument was that a writer is
  short of the *sequence* rather than of five names, so the rows carry the
  phase numbers, the per-phase step counts and the ARC callout. Strip those and
  this is the boxed list the road existed to replace. Each row carries a screen
  in the column its words are not in — and **two of the four are photographs of
  the real app, which is this section's standing exception to the rule above.**
  They were all drawn by `phase-screens.tsx` and computed: `proseReport()` over
  a fixed passage for the writing and revising ones, `STATUSES`/`LEAD_DAYS` for
  advance copies, `DESTINATIONS` for the export. Three were swapped for bitmaps
  on 2026-08-13 and the fourth on 2026-08-14, at the owner's request. The cost
  is the same one every time and worth restating: **when the screen it
  photographs moves, nothing fails and nothing warns; the picture simply starts
  lying.** `WriteShot` and `ArcShot` in `landing-page.tsx` still carry it, each
  with the cost written above it — re-shoot them when the editor's chrome or
  the ARC statuses change. The drawn components are all still there and
  callerless, so putting one back is a line in `ORDER_SCREENS`.

  **Two rows have come back off bitmaps, and the publishing one is the case to
  learn from.** Prepare took `CheckDemo` on 2026-08-14, which draws the screen
  and then works it. Publishing took a new drawing the same day —
  `ExportScreen` in `export-screen.tsx`, a full-width recreation of the export
  wizard's last step, replacing `/export-tablet.webp`. That picture was the one
  of the four that **could not be fixed by re-encoding**: composed by a script
  from a screenshot no longer on disk, so there was nothing to re-encode
  *from*, and at 1984×1326 in 49KB — about 0.15 bits a pixel, on flat grounds
  and small type — webp's ringing sat on the letters. Its own note said the
  real fix was to render it again. Two of the new drawing's values are read out
  of the app (the export's own `FormatMark`, and "Classic" from
  `templateById(DEFAULT_TYPESET.template)`); the rest is quoted by hand,
  because the strings live in `export-page.tsx`, which is `"use client"` — a
  Server Component importing a *value* from a client module gets a client
  reference, which is the `sections.ts` lesson. It sizes itself in `cqw`
  against a container query on `AppWindow`'s glass, so it needs no script and
  holds its proportions at any column width. The hero is the
  other exception and goes further still: it carries the **real check**, not a
  drawing of one — see `book-check.tsx`. Two more bitmaps are *scenery* rather
  than pictures of the product, so neither can go stale: the hero *backdrop*
  (`public/hero-{dark,light}.webp`, per theme, behind `--lp-hero`) and the
  **closing landscape** (`public/closing-field.webp`, behind
  `.oc-closing-field`). **Both framings
  are *measured*, not eyeballed**, and the long comments above them in
  `globals.css` record the numbers: the hero's records the contrast ratio each
  anchor and size buys against the headline, with a separate phone framing
  because the text block ends higher there.

  **The closing landscape is one picture under the last ask *and* the footer**,
  and it replaced two separate endings — an indigo CTA gradient with a drawn app
  window cropped by its bottom edge, and a paler landscape band
  (`footer-field.webp`) inside a white footer under it. The ask sits on the
  page's own ground and **the picture is the `<footer>`'s own background**
  (`.oc-closing`), with its `padding-top` as the reveal — the scene with nothing
  on it before the card starts. That placement is the load-bearing part. It was
  a fixed-height band above the footer with the card lifted onto it by a
  negative margin, and landscape then ran down either side of the card for
  exactly the height of that lift and stopped, leaving the lower two thirds of
  a tall card on plain white. Painted here it covers however tall the footer
  turns out to be, so the strips reach the last line of small print whatever
  gets added.

  **`cover` cannot do it and the arithmetic is why.** The footer is ~1120px tall
  against a 3:1 panorama, so height-driven scaling put the ridge level with the
  card's top edge and left the reveal as bare sky; buying the scene back needs a
  ~1000px reveal, which means upscaling a 2172px image 2.4× and showing its
  middle quarter. So from `48rem` up the picture is laid at its **natural
  aspect** (`100% auto`) and its last scanline is extended downward by
  `--lp-closing-floor`, a thirteen-stop horizontal gradient *sampled from that
  scanline* — which is why the join is invisible rather than close. Re-sample it
  whenever the image changes. Below `48rem` it falls back to `cover`, because at
  390px the natural-aspect scene is a 130px ribbon and a centre crop is the
  better picture. The reveal is a percentage of the width, so it holds at **89%
  of the scene at every width from 1024 to 2560** — and therefore at any browser
  zoom.

  **Nothing is written on this picture, and that is the finding worth not
  re-deriving.** Two landscapes were tried with the ask centred on the sky.
  Both were measured band by band against `lp-ink`, and the second is genuinely
  good — **13.6:1 to 15.7:1 through the top 36%** — but its dark ridge starts at
  that 36% line and runs 1.9:1 to 4.5:1 below it, and white type fails on all of
  it (1.2:1 on the sky). The killer is not the short safe zone: the ask is a
  *fixed stack of pixels* while the frame scales with the width, so probing four
  widths in an iframe put the caveat line at 41% of the frame at 1280 and **58%
  at 390**, out over open water. No padding lever fixes that — they are all
  proportions of the width and the text is not. So the words went onto the white
  above, which is what the reference does, and the band below carries nothing.
  **Anything placed on it must bring its own ground**; bare type does not go back
  without re-running that probe, at 390 first. The frame is `cover` anchored
  `top` so the sky survives at every width. Re-measure before swapping any of the
  three images.
- **Everything countable is imported and counted**: `STEPS`, `PHASES`,
  `ALL_TOOLS`, `TOOL_GROUPS`, the price from `plans.ts`. The ARC step's title,
  its number and its phase are all derived, because the page quotes them.
- **Every section title is one scale, and it is a constant** —
  `SECTION_TITLE` in `components/landing/type.ts`, paired with `oc-display`.
  Most headings go through `Head`, but three are hand-written (the FAQ's
  column carries a marker dot and a description, the check's is centred over a
  window, the closing banner's is centred on the landscape), so the size has to
  live somewhere all four can read it — `type.ts` has no `"use client"` for
  the same reason `sections.ts` does not, and it avoids a cycle with
  `cta-banner.tsx`. The scale tops out a little **above** the hero's own 56px:
  a deliberate trade, since the hero holds its place by being three lines
  against one and by the marker behind its last clause. Re-check that if the
  hero is ever cut to a single line. The footer's column labels are not
  section titles and stay small.
- **Nothing on this page may be a number a SaaS page would invent.** There is
  where "trusted by 5,000 brands" goes, and there are no customers to count —
  so no user count, no rating, no testimonial goes anywhere on the page until
  there is a real one. That rule outlived the row it was written for: a band of
  four counted figures (steps, tools, formats, EPUBCheck errors) sat under the
  refusals and was **removed on 2026-08-12**, because four numerals on a band
  of their own ask a reader to be impressed by an arithmetic nobody has given
  them a reason to care about. All four figures are still on the page, each
  where it means something — the steps in "The order", the tool count in the
  tools heading, the formats in the mosaic under the hero and in the footer,
  the zero in "The export is verified, not asserted".
- **There is no testimonial slot on the page, and the empty space is owed a
  replacement.** It held the *research* rather than customers — things writers
  said about the *problem*, quoted from the module each one caused, nobody
  named, nothing invented, under a heading saying outright they were not our
  customers — and it was **removed on 2026-08-13** to be rebuilt. `VOICES` went
  with it. Read TODO.md under "Taken out on purpose" before rebuilding it: the
  four rules that kept it honest are recorded there, and they are what stop the
  replacement becoming the invented quotes this page refuses. Until it returns
  the slot stays empty, which claims nothing.
- **A refusal card's title is two lines and only the second takes a hue** —
  the problem in ink, the answer in the page's own indigo. That is what a
  reader gets at skimming speed, and it is why the accent is indigo rather
  than the card's tint: indigo means *this is the way forward* everywhere on
  this page, the card grounds mean nothing at all, and peach on a problem
  would read as amber, which means *this costs you readers*. Its badge is the
  status family for the same reason, and the line above its button carries the
  rule's **provenance** where the reference puts a customer's logo and result.
- **The "trusted by" slot under the hero holds `TILES`**, and it is the third
  answer to the same problem. A panel lifted over the hero, one sentence
  across it, then a bento of small tiles — the arrangement every reader has
  been trained to read as proof — filled with the only proof this page can
  honestly offer: the **seven programs a finished file opens in**, each with
  the format that opens it, read from `DESTINATIONS` so it cannot name one the
  export does not reach, and **three facts a reader can settle today** (zero
  EPUBCheck errors, four formats, nothing uploaded). No company logo appears
  under any claim of endorsement, because none of them endorse us. The grid
  has **no edge fade**: the reference crops its own to say there is more than
  fits, and all seven destinations are shown, so a fade would imply an eighth.

**Every claim on it has to be true of the code.** Nothing claims what the app
cannot do — the print PDF is the browser's print engine and says so. The page
reads `SELF_TICKING` / `YOURS_TO_TICK` out of `roadmap.ts` and prices out of
`billing/plans.ts` rather than restating either, which is the shape to prefer
for any new figure on it.

**There is no "Not built yet" section any more, and the rule it carried is
worth knowing anyway.** "What comes after that" — three dashed cards naming
what is genuinely unbuilt — was **removed on 2026-08-14** at the owner's
request; TODO.md keeps its three entries verbatim. Its rule was that *nothing
stays under that badge once it ships*, which failed in the safe direction and
so failed silently: Track carried "none of it exists today" for a while after
Track shipped, which is still a page saying something untrue. Nothing needs
walking now — but the mirror of that rule binds harder than it did, because
**an unbuilt feature named anywhere on this page is now a promise with no
section admitting it is one.** Do not name one; if the page ever has to, the
section comes back.

**`works-with.tsx` is half-live, and the half that lives is the data.** The
current page imports `DESTINATIONS` from it — the shops and readers our exports
open in, each with the format named beside it so the claim stays checkable —
while the `WorksWith()` component that used to draw them is left over from the
previous design and has no caller. Do not delete the file when tidying that
design away, and do not add a destination there without an export that actually
opens in it.

The **previous** design — `landing-nav.tsx`, `publishing-check.tsx`,
`sections.ts`, `path-scroller.tsx` and the drawn figures (`landing-figures`,
`toolkit-figures`, `laptop-mockup`, `book-fan`, `formats-flow`,
`path-figures`) — is still in that folder and **nothing imports any of it
now**; the rewrite left it behind, and `font-brand` and the
"OpenChapter Landing v2" palette live only in those files. It is the finished
visual design of the *old* positioning, so treat it as reference rather than as
something to wire back up unchanged. One lesson in there is general and worth
keeping whatever happens to the rest: `sections.ts` has no `"use client"` and
exists only so both sides of the boundary can read one array — Next replaces a
client module's exports with client *references*, so a Server Component
importing an array from a `"use client"` file gets `.map` of a reference object
and the page 500s.


