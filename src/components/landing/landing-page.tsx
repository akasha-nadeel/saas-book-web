import Link from "next/link";
import type { ReactNode } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { GoogleButton } from "@/components/auth/auth-shell";
import { BookCheck } from "@/components/landing/book-check";
import { CheckDemo } from "@/components/landing/check-demo";
import { LandingHeader } from "@/components/landing/landing-header";
import { StoreListingDemo } from "@/components/landing/store-listing-demo";
import { DESTINATIONS } from "@/components/landing/works-with";
import { ALL_TOOLS, TOOL_GROUPS } from "@/lib/book-tools";
import { PHASES, SELF_TICKING, STEPS, YOURS_TO_TICK } from "@/lib/roadmap";

/**
 * The landing page.
 *
 * **The positioning, in one line: nobody tells you the order.** That is the
 * sharpest thing in four batches of writer research and the one claim no
 * competitor is making, because it is not a feature — it is the shape of the
 * whole problem. A writer arrives having finished a book and discovers, one
 * expensive surprise at a time, that advance copies had to go out weeks ago,
 * that the blurb is over a limit nobody mentioned, that the cover was the
 * problem all along. So the page leads with the order, proves it with the ARC
 * example, and only then says what the software does.
 *
 * **The reader has been sold to already.** This audience has bought a course
 * that taught nothing and a cover that turned out to be AI. Every superlative
 * spends credit this page does not have, so there are none: the numbers are
 * counted from the code, the unbuilt things are labelled, the PDF's limits are
 * stated on the page that sells it, and there is a section listing what the
 * product refuses to do. **The refusals convert.** They are the only block here
 * a funded competitor cannot copy, because copying it would cost them a
 * roadmap. Each one is paired with the work behind it — see the note on
 * `REFUSALS`: a no standing on its own is indistinguishable from a no we had
 * no choice about.
 *
 * **The stat band is the honest version of "trusted by 5,000 brands".** The
 * layout this was built to wants social proof there and we have none, so it
 * carries four figures counted out of the source instead — steps, tools,
 * formats, EPUBCheck errors. Never put a user count, a rating or a testimonial
 * in that row until there is one to count.
 *
 * **It follows the theme, like everything else.** It used to be always light
 * and state every colour literally, on the argument that a shop front should
 * not change because of a setting made inside the product. That was right
 * about brand consistency and wrong about who the setting belongs to: a reader
 * whose machine is dark has not expressed a view about our marketing, they
 * have told their whole screen how bright to be — and the one page ignoring
 * them was the first one they ever saw. So the page reads `data-theme` like
 * the app does, through the `--color-lp-*` tokens in `globals.css`, which are
 * stated in both blocks with the light values it shipped with. Daylight is
 * unchanged to the pixel.
 *
 * Two things stay literal on purpose, and neither is chrome: the drawn book
 * covers in the figures, because a cover is a picture of an object, and the
 * marks in `works-with.tsx`, because a trademark is a trademark.
 *
 * **Every claim has to be true of the code, in both directions** — nothing
 * claims what the app cannot do, and nothing stays under the "Not built yet"
 * badge once it ships. That second half fails silently and has been wrong once
 * already, so walk the badges whenever a feature lands. The phases, the step
 * counts and the tool list are all imported rather than restated,
 * which is the shape to prefer for any new figure here.
 */

/**
 * The palette, and the reasoning it has to survive.
 *
 * **Colour is information here, not decoration.** The reader is a writer who
 * has been sold to by everybody, and a page where everything is coloured says
 * nothing — brightness is what the courses and the cover mills look like. So
 * the ground stays paper and ink, and a hue only appears where it is carrying a
 * fact the reader needs to feel before they read it.
 *
 * - `INK` is the brand action — a deep indigo rather than the SaaS blue.
 *   It is ink on paper, it reads as institution rather than startup, and it is
 *   the colour of a decision: every CTA and every link is this and nothing else.
 * - `INK_TEXT` is the same colour *as type*, and it is a second value only at
 *   night. White has to sit on the fill and a link has to sit on near-black,
 *   and at those two ends one indigo cannot clear 4.5:1 in both directions —
 *   the windows do not overlap. In daylight the two are identical. Use `INK`
 *   for anything filled and `INK_TEXT` for anything read.
 * - `STOP` and `PASS` are two thirds of the semantic ladder the app itself
 *   uses (`stop` / `note` / `ok` tokens). Red is *would be refused*, green is
 *   *free, passed, nothing owed*. They never appear as decoration, only as
 *   verdicts. The amber middle — *costs you readers* — is on the page too, but
 *   only inside `check-demo.tsx`, which is the one place that has both
 *   verdicts side by side and is where the distinction is being made.
 * - The tinted grounds are `INK` itself with the volume down — see the note
 *   under the constants. One colour at four volumes, not a hue plus a neutral.
 *
 * The emotional arc down the page is deliberate: red where the fear is named,
 * amber where the cost is, green where something has passed or been earned,
 * indigo on every way forward.
 */
const INK = "var(--color-lp-accent)"; // the brand action — actions and links
const STOP = "var(--color-stop-fg)"; // would be refused
const PASS = "var(--color-ok-fg)"; // free, passed, earned
const INK_TEXT = "var(--color-lp-accent-text)";

/*
 * The two tinted grounds, and both are `INK` with the volume down.
 *
 * `lp-tint` is the accent at about 8% on white and backs the hero; `lp-tint-soft`
 * is the same at about 4% and backs the alternating bands. Tinting the *brand*
 * colour rather than reaching for a neutral is what makes a page feel designed
 * instead of assembled: the hero, the lit card and the section grounds are then
 * one colour at four volumes, and the eye reads that as intent.
 *
 * They were a warm paper grey, which was pleasant and wrong — a warm ground
 * under a cool indigo card is two colour systems in one viewport, and it is the
 * kind of mismatch nobody can name but everybody feels.
 *
 * At night the same relationship is kept by lifting rather than tinting: the
 * bands are a shade *above* the page instead of below it, which is the same
 * inversion the app's own `raised` makes, and for the same reason — a shadow
 * on black is invisible, so elevation has to be carried by lightness.
 *
 * Used through Tailwind classes (`bg-lp-tint`) rather than these constants
 * wherever a class will do: Tailwind reads class names as literals and would
 * ship no rule for a name built at runtime. The constants exist for the
 * handful of places that set colour in a `style` object.
 */

/**
 * The icon set, drawn here rather than imported.
 *
 * One grid (24), one stroke weight, one cap style, so eleven glyphs read as a
 * set rather than as eleven downloads. Sized by the caller and never below
 * 16px: a line icon under that is a smudge at any weight, which is the usual
 * way an icon set stops carrying meaning and starts being texture.
 */
const icons = {
  write: (
    <>
      <path d="M4 20h16" />
      <path d="M14.5 4.5a2.1 2.1 0 0 1 3 3L9 16l-4 1 1-4Z" />
    </>
  ),
  prepare: (
    <>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  track: (
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m8 15 3.5-4 3 2.5L20 8" />
    </>
  ),
  steps: (
    <>
      <path d="M4 18h4v-4H4z" />
      <path d="M10 14h4v-4h-4z" />
      <path d="M16 10h4V6h-4z" />
    </>
  ),
  tools: (
    <>
      <path d="M14.5 5.5a3.5 3.5 0 0 0 4.6 4.6l-8 8a2.3 2.3 0 0 1-3.2-3.2Z" />
      <path d="m5 5 3 3" />
    </>
  ),
  formats: (
    <>
      <path d="M5.5 3.5h8L18.5 8v12.5h-13Z" />
      <path d="M13.5 3.5V8h5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  cross: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  /* The three below are for the Prepare points, and each draws the *noun* in
     its heading rather than an abstraction of it: a shelf of spines for the
     books yours sits beside, lines of text with a short last one for a blurb,
     a magnifier for going looking. A reader should be able to name the glyph
     without reading the line beside it. */
  /* One book standing and one leaning against it, on a shelf. Three even
     spines was the first draft and reads as a bar chart at 20px — equal
     vertical bars on a baseline is a chart before it is anything else, and
     this page has real charts elsewhere. The lean is what makes it books. */
  shelf: (
    <>
      <path d="M4 20h16" />
      <path d="M6.6 7.4h3.8v12.6H6.6z" />
      <path d="M12.6 20 15.4 8.3l3.4.8L16.4 20Z" />
    </>
  ),
  blurb: (
    <>
      <path d="M4.5 7h15" />
      <path d="M4.5 12h15" />
      <path d="M4.5 17h9" />
    </>
  ),
  search: (
    <>
      <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
      <path d="m16.2 16.2 3.8 3.8" />
    </>
  ),
} as const;

/**
 * One glyph from the set above. 18px unless a caller has a reason.
 *
 * `weight` exists because stroke width is in *user units*, so a glyph scaled up
 * keeps the same absolute hairline and reads lighter the bigger it gets. A mark
 * carrying meaning at 22px needs more stroke than one sitting inside a line of
 * text, and this is the only honest way to ask for it.
 */
function Icon({
  name,
  className = "h-[18px] w-[18px]",
  weight = 1.6,
}: {
  name: keyof typeof icons;
  className?: string;
  weight?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {icons[name]}
    </svg>
  );
}

/**
 * The step that carries the whole argument, read out of the roadmap itself.
 *
 * Derived rather than typed, because the page quotes the step's own title and
 * states where it sits — "step 13 of 18, phase four" — and those are three
 * facts about a list that lives somewhere else. Written by hand they would be
 * right today and quietly wrong the first time a step is added, on the one page
 * whose entire pitch is being checkable.
 */
const ARC_INDEX = STEPS.findIndex((step) => step.id === "arc");
const ARC_STEP = STEPS[ARC_INDEX]!;
const ARC_PHASE = PHASES.findIndex((phase) => phase.id === ARC_STEP.phase) + 1;

const WRITE = [
  [
    "Where you left off",
    "Open the book and the last paragraph you wrote is there, with the note you left yourself. For the seventeen free minutes, not the two clear hours.",
  ],
  [
    "An idea parking lot",
    "Catch the shiny new idea without leaving the chapter you are in. Leaving is the interruption.",
  ],
  [
    "The shape most novels share",
    "Your word count placed on it, in plain words, for when the middle has run out of road. A convention, not a rule.",
  ],
  [
    "Versions, and how many sittings",
    "A version kept every ten minutes or so, and a count of how often you have been round this chapter. A bad afternoon is not permanent.",
  ],
  [
    "A distraction-light editor",
    "Chapters, focus mode, typewriter scrolling, and free dictation for the days when typing is the thing draining you.",
  ],
  [
    "Proof of the work, if you are ever accused",
    "A day-by-day record of the book accumulating, the drafts saved along the way, and a fingerprint of the text — in a document you can send. Evidence, not proof, and it says which it is in its own words.",
  ],
] as const;

/*
 * The first four are the ones the Prepare section prints, and they are written
 * short on purpose.
 *
 * They ran to three and four lines each, which stacked to a wall of grey beside
 * a figure that is the actual argument — a reader skims that and takes none of
 * it. What went in every case was the *qualifying* clause, not a claim: the
 * checks are still named, the comps are still found by reading the blurb, the
 * blurb is still counted and still not written for you. Same rule the hero deck
 * was cut under. Anything that would have removed a claim stayed.
 */
const PREPARE = [
  [
    "A pre-upload check",
    "Missing cover, malformed ISBN, blurb over the limit — and which of them would actually stop the upload. It never blocks your export.",
  ],
  [
    "The books yours sits beside",
    "Real comps, found by reading your blurb — and from them your categories, the length those books run, and the covers yours has to sit against.",
  ],
  [
    "Your blurb, counted against real ones",
    "The shops' limit, five real blurbs from books like yours, and how long they run. We do not write it.",
  ],
  [
    "Is the title taken, will the cover be refused",
    "Whether another book turns up first when a reader searches yours, and whether your artwork is the right size, shape and weight.",
  ],
  [
    "Paperback numbers, worked out",
    "Spine width, inside margin and the full cover wrap, from your page count and trim size.",
  ],
  [
    "Four files out",
    "EPUB, DOCX, PDF at your trim size, and Markdown. No watermark, no export cap, and the EPUB is checked against EPUBCheck 5.3 with no errors and no warnings.",
  ],
] as const;

/**
 * A mark for each of the four Prepare points the page shows, positionally.
 *
 * **They are all one colour, and that colour is `INK`.** The temptation with
 * four icons is to give each a hue, and on this page that would be a lie by
 * decoration: red and amber are *verdicts* here — would be refused, costs you
 * readers — and they are spent, twice, inside the figure beside these points
 * where they carry real findings. A red mark on "A pre-upload check" would say
 * the check itself is the problem. So the marks take the way-forward indigo,
 * the colour every other "here is the answer" on this page is set in, and the
 * status hues keep meaning what they mean everywhere else.
 */
const PREPARE_MARKS = ["prepare", "shelf", "blurb", "search"] as const;

const TRACK = [
  [
    "Cost against earnings, per book",
    "Cover, editing, ads and proof copies on one side. Royalties on the other. Nobody keeps this, which is why the total is always a shock.",
  ],
  [
    "Import your sales report",
    "Amazon has no public API, so nothing is fetched — but it will let you download your sales. Hand the file over and you say which column is which, so it works whatever the shop renames next year.",
  ],
  [
    "How many more copies get you level",
    "Worked from what a copy has actually earned you, never from a royalty rate we invented. If your rows do not say, neither do we.",
  ],
  [
    "Who has an advance copy, and who is late",
    "One list instead of six sites and a spreadsheet, with the dates attached — and a send-by date worked back from your publication date.",
  ],
  [
    "What it usually costs, and what to check first",
    "What a book typically earns, what covers and editing and promotion run to, and what to establish before the money moves. Every figure says where it came from.",
  ],
] as const;

const LATER = [
  [
    "A story bible across a series",
    "People, places and things travel between books in a series. Today they stop at the one book they were written in.",
  ],
  [
    "Comps ranked, not just found",
    "A model reading your opening chapter to say which five of twenty are genuinely like your book, rather than which forty matched a word.",
  ],
  [
    "The book-three curve",
    "Writers report no traction until their third book. Whether you are on that curve should not be a feeling — but it needs more than one book of history to say anything.",
  ],
] as const;

/**
 * Every refusal, with the work that sits on our side of it.
 *
 * **A no on its own reads as a missing feature.** This section was four
 * refusals and nothing else for a while, and the failure mode of that is
 * specific: a reader who does not already trust you cannot tell "we choose not
 * to" from "we cannot", and every line lands as the second one. Pairing each no
 * with the thing we do instead fixes that in both directions — the refusal
 * becomes a decision rather than an absence, and the reader leaves the section
 * knowing what they get rather than only what they don't.
 *
 * So the shape is one boundary drawn twice: what we will not cross, and the
 * work we do up against it. Each third entry has to be something already
 * shipped — this is the section a sceptical reader checks first, and a promise
 * hiding among four refusals would cost more than all four earn.
 */
const REFUSALS = [
  [
    "We will not design your cover or edit your prose with AI",
    "AI here reads and reports. It never writes into your book. The cheap way to build covers and editing is generative, and doing it would make liars of us in front of the one audience that checks. If those ever exist here, they come from real designers and real editors.",
    "We will check the cover you already have",
    "Dimensions, shape, weight and contrast against what a shop refuses, and a shelf of the covers already selling in your genre to set yours beside. Then a count of what is in your prose, with none of it changed.",
  ],
  [
    "We will not sell you a course",
    "You have met those people already.",
    "We will give you the order for nothing",
    `${STEPS.length} steps across ${PHASES.length} phases, ${SELF_TICKING} of them ticking themselves off your own book. The sequence is the part the courses are charging for.`,
  ],
  [
    "We will not promise your book will sell",
    "Anyone who does is selling you something. We can tell you what a shop will refuse. We cannot tell you what a reader will love.",
    "We will tell you what would stop the upload",
    "Named before you make it, and kept beside what the book has cost against what it has actually earned. Both of those can be checked; a forecast cannot.",
  ],
  [
    "We will not upload to Amazon for you",
    "There is no public API. Anyone automating that dashboard is risking your publishing account, not theirs.",
    "We will hand you the file that shop takes",
    "An EPUB that clears EPUBCheck with no errors and no warnings, with DOCX, PDF and Markdown beside it. The last step stays yours, and it is one upload.",
  ],
] as const;

const FAQ = [
  [
    "I have a finished manuscript. Where does it go?",
    "Straight in. Import a .docx, .epub, .md, .txt or .html file and it is split into chapters for you. Then the first screen tells you what stands between it and a shop — usually four or five things, most of them ten minutes each.",
  ],
  [
    "What doesn’t it do?",
    "A fair amount. It does not design covers, edit your prose, write your blurb, market your book, buy ads, upload to any store, or introduce you to other writers. It will tell you what a cover needs to be and show you the shelf yours has to sit on; it will not draw one. It will count what is in your prose; it will not change a word.",
  ],
  [
    "Who owns what I write?",
    "You do. We claim no rights over your manuscript and take no cut of anything you sell.",
  ],
  [
    "Do you train AI on my manuscript?",
    "No. The assistant receives only the single chapter you hand it, at the moment you ask, and it is not used to train a model afterwards.",
  ],
  [
    "Can I get my work out if I stop using it?",
    "Yes, without asking us. EPUB, DOCX, PDF and Markdown, whenever you want. Markdown is plain text — it opens in any editor, including one written thirty years ago.",
  ],
  [
    "I’ve paid for tools that did none of this. Why is this different?",
    "You can test the whole claim in an afternoon without paying: import a draft, run the check, export all four files, open them in Word and an e-reader. If any of it does not work, you have lost an afternoon rather than a thousand pounds.",
  ],
] as const;

export function LandingPage() {
  return (
    // `<body>` is overflow-hidden for the editor shell, so this page owns its
    // own scrolling. `min-h-dvh` would put the footer out of reach.
    //
    // Colours come from the `lp-*` tokens, so the page follows `data-theme`
    // like the app does — including for a reader who has never been inside it,
    // whose machine has already said which it wants through
    // `prefers-color-scheme`. The bootstrap in layout.tsx resolves that before
    // the first paint, so there is no flash of the wrong page.
    <div className="h-dvh overflow-y-auto bg-lp-ground text-lp-body [scroll-behavior:smooth]">
      <LandingHeader ink={INK} />

      <main>
        {/* ---- Hero -----------------------------------------------------

            Centred stack, then the product cropped by the fold — the shape
            the references use, and the right one: a reader who has been
            promised things by four other tools wants to see the thing before
            they read another adjective. */}
        {/* `pb-*` where the hero used to have none: what sits under the deck is
            now a control rather than a picture, and a tool cropped by the fold
            is a tool the reader has to go looking for the bottom of. The old
            figure was *meant* to be cut off — a screenshot bleeding past the
            edge is the standard way of saying "there is more of this". A drop
            zone has to be whole. */}
        <section className="relative -mt-16 overflow-hidden border-b border-lp-line bg-lp-tint px-6 pt-28 pb-16 sm:pt-32 sm:pb-20">
          {/* ---- The backdrop ------------------------------------------

              Two images, one per theme, swapped through `--lp-hero` rather
              than by rendering both and hiding one: a `<picture>` with a
              media query would key off `prefers-color-scheme` and so ignore a
              reader who chose against their system, which is the whole point
              of the setting. A CSS variable follows `data-theme` instead, and
              costs one request either way.

              `bg-lp-tint` stays underneath as the floor. It is what shows
              while the image is still arriving and if it never does, and it
              is the colour the rest of the page is built on, so the failure
              looks like the old hero rather than like a broken one.

              Each var carries the whole `background` shorthand, position and
              size included, because the two images want different framing —
              see globals.css, where the measurement behind that is written
              down. Setting them here as separate utilities would let a theme
              inherit the other one's position.

              Decorative, so `aria-hidden` and no `alt` to write: it carries
              no information a reader would miss. Both are ~9KB WebP — a
              smooth gradient is almost nothing once it is not a PNG. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 [background:var(--lp-hero)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 [background-image:var(--lp-hero-veil)]"
          />

          <div className="relative mx-auto max-w-5xl text-center">
            {/* Two-tone, the way both references split a headline. There is no
                accent hue in this product to split on, so the two lines split
                on weight of ink: the quiet half sets up the loud one.

                Nothing above it. A badge there was buying attention with a
                small grey sentence before the headline had spent any — and the
                three facts it carried (free, offline, your book stays here) are
                all made again below, where they land against something. The
                first thing on the page should be the sentence the page is
                about. */}
            {/* An instruction, then what it saves — which is the shape that
                works on somebody who arrived with a finished book and a
                problem, because they know what they would get by the fourth
                word.

                **Both halves are claims the code can back.** The first is the
                pre-upload check, which really does name what a shop would
                refuse. The second is about *time*, not about shops being
                silent: a draft of this read "and never says why", which is a
                good line and not reliably true — shops usually do say
                something, even if it is templated, vague about which of several
                problems it means, or a wall of validator output. On the first
                line a reader sees, that would have broken the one rule this
                page lives by.

                **No number in the second line, deliberately.** A draft read
                "before it costs you a month", which sounds concrete and is not
                defensible: a rejected upload is a few days' loop at most shops,
                not four weeks. The only real month in this product is the 28
                days `arc.ts` works back for advance copies — a true figure
                attached to an entirely different problem. Borrowing it here
                would have been the invented number this app refuses everywhere
                else, on the first line a reader sees.

                "Before you upload it" needs no defending, and it is the better
                line anyway: it names the reader's own action rather than the
                shop's, which is the decision actually in front of them.

                Line one is muted indigo rather than grey, so the two read as one
                sentence at two volumes rather than as grey text with a coloured
                answer stapled underneath. */}
            <h1 className="oc-display font-serif text-[2.5rem] leading-[1.08] font-semibold sm:text-[3.5rem]">
              <span className="block text-lp-accent-soft">
                Find out what&rsquo;s wrong with your book
              </span>
              <span className="block" style={{ color: INK_TEXT }}>
                before you upload it.
              </span>
            </h1>

            {/* The three commonest refusals, then the sting. Concrete beats
                abstract here — a reader who has had that email recognises their
                own one in the list — and every item is a check the app really
                performs, so the deck is as checkable as the headline above it.

                Cut to two lines. It ran to four, and a hero deck that long
                stops being a deck and becomes the first paragraph of an essay:
                the eye leaves before the buttons. The clauses that went were
                the qualifying ones ("eleven characters", "with a bad check
                digit") — precision the reader does not need to feel the point,
                and which is made properly further down where there is room. */}
            <p className="oc-lead mx-auto mt-7 max-w-2xl font-serif text-xl leading-relaxed">
              A missing cover. A bad ISBN digit. A blurb over the limit. Every
              one of them is knowable before you upload.
            </p>

            {/* Smaller and quieter than they were, because they are no longer
                the only way forward on this screen: the check below is, and
                two full-sized pills directly above a drop zone made three
                primary actions competing inside one viewport. A reader who
                arrived ready to sign up still finds them first; a reader who
                arrived sceptical — which the research says is most of them —
                gets to test the claim before being asked for anything. */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                style={{ backgroundColor: INK }}
                className="rounded-full px-6 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink hover:opacity-90"
              >
                Start free
              </Link>
              {/* `GoogleButton` renders its own form; `next` is where the
                  writer lands once Supabase is done, which for a new signup is
                  the shelf at `/`. inline-flex, or its mark and label stack
                  into two rows and it stands taller than the pill beside it. */}
              <GoogleButton
                action={signInWithGoogle}
                next="/"
                label="Continue with Google"
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-lp-edge bg-lp-ground px-6 py-3 text-[0.9375rem] font-semibold text-lp-ink hover:border-lp-edge-strong"
              />
            </div>

          </div>

          {/* ---- The claim, kept ------------------------------------------

              The headline promises the reader they can find out what is wrong
              with their book before they upload it. This is that, working, on
              their book, four inches below the promise — the real readiness
              check out of `checkup.ts`, running in their browser, with no
              account and nothing uploaded.

              It replaced a drawn still of the Overview screen. The still was
              honest and well made, but it was making a screenshot's argument
              — *here is a product, imagine it on yours* — to a reader who has
              been shown convincing screenshots by people who then sold them a
              course that taught nothing. Every other claim on this page is
              checkable by reading it; this is the one that is checkable by
              using it, and it is the only block here a competitor cannot
              answer with a nicer illustration.

              It is also the page's own rule turned on itself: the figures are
              drawn from the source so they cannot go stale, and this one
              cannot go stale at all, because it *is* the source. */}
          <div className="relative">
            <BookCheck />
          </div>
        </section>

        {/* ---- The logo strip -------------------------------------------

            The row a landing page fills with customer logos, and we have none
            to put there — a wall of publishers' marks would be inventing them.
            So it names the places a finished manuscript *goes*, which is both
            true of the export pipeline and the thing a writer is actually
            nervous about: not who else is here, but whether the book comes out
            again. The format sits beside each name, so the claim is checkable
            on sight rather than taken on faith.

            Real marks in their real colours — the only colour on the page —
            from `works-with.tsx`, where the sourcing and licences for each one
            are recorded. Nominative use: these are programs that open our
            exports, not partners or customers. */}
        <section className="border-b border-lp-line px-6 py-10">
          <div className="mx-auto max-w-5xl">
            <p className="text-center font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
              Your book comes back out — and opens in
            </p>
            {/* Tight enough that seven sit on one line at desktop widths — a
                strip that wraps five-then-two reads as a mistake rather than
                as a row. The format tag is the first thing to go when there is
                no room for it; the name and the mark are the claim. */}
            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-5">
              {DESTINATIONS.map((destination) => (
                <li
                  key={destination.name}
                  className="flex items-center gap-2.5"
                  title={`${destination.name} — opens the ${destination.format} export`}
                >
                  <svg
                    viewBox={destination.mark.viewBox}
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0"
                  >
                    {destination.mark.paths.map((path) => (
                      <path key={path.d} d={path.d} fill={path.fill} />
                    ))}
                  </svg>
                  <span className="text-[0.8125rem] font-medium text-lp-soft">
                    {destination.name}
                  </span>
                  <span className="hidden font-code text-[0.625rem] tracking-wider text-lp-faint uppercase xl:inline">
                    {destination.format}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- The counted band -----------------------------------------

            The slot a SaaS page fills with users and downloads. Every figure
            here is counted out of the source at build time, so the row cannot
            drift and cannot flatter. */}
        <section className="border-b border-lp-line px-6 py-14">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 text-center md:grid-cols-4">
            <Counted icon="steps" n={String(STEPS.length)} label="steps, in order" />
            <Counted
              icon="tools"
              n={String(ALL_TOOLS.length)}
              label="tools, all included"
            />
            <Counted icon="formats" n="4" label="export formats" />
            {/* The only figure in the row that is a *verdict* rather than a
                count, so it is the only one that gets a colour. A green zero
                is the whole argument of the export pipeline in one glyph. */}
            <Counted icon="check" n="0" label="EPUBCheck errors" tone={PASS} />
          </div>
        </section>

        {/* ---- Three up, one lit ---------------------------------------- */}
        <section id="does" className="border-b border-lp-line px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <Head
              eyebrow="What it does"
              title="Three phases. Writing is one."
              lead="Most tools stop when the draft does. The expensive part starts there."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              <Phase
                lit
                n="01"
                icon="write"
                title="Write"
                note="Seventeen free minutes a day, and not losing your place between them."
                items={WRITE.length}
              />
              <Phase
                n="02"
                icon="prepare"
                title="Prepare"
                note="Everything a shop asks for that is not the book, checked before you upload."
                items={PREPARE.length}
              />
              <Phase
                n="03"
                icon="track"
                title="Track"
                note="What the book cost against what it earned, and who still owes you a review."
                items={TRACK.length}
              />
            </div>
          </div>
        </section>

        {/* ---- The order, as an alternating block ------------------------ */}
        <Split
          id="order"
          eyebrow="The whole point"
          title="The order"
          tint
          figure={<OrderFigure />}
        >
          <p className="oc-lead font-serif text-xl leading-relaxed">
            {STEPS.length} steps, {PHASES.length} phases. The software is the
            least of it; the sequence is the thing nobody hands you.
          </p>
          <p className="mt-5 leading-relaxed">
            <strong className="text-lp-ink">
              “{ARC_STEP.title}” is step {ARC_INDEX + 1}, in phase {ARC_PHASE}.
            </strong>{" "}
            Before you publish, not after. That single placement is why this
            exists: three separate batches of writer research describe the same
            injury, and it is never a missing tool — it is a missing order.
          </p>
          <p className="mt-4 leading-relaxed">
            There is a test in the codebase asserting that step stays where it
            is. If it ever moves, the build fails.
          </p>
          <p className="mt-6 leading-relaxed">
            <strong className="text-lp-ink">
              {SELF_TICKING} of the {SELF_TICKING + YOURS_TO_TICK} tick
              themselves
            </strong>{" "}
            from what is already in your book — no checklist to maintain, and
            nothing that can be lied to by accident.
          </p>
        </Split>

        {/* ---- Prepare --------------------------------------------------

            Words left, the product working on the right — but written out
            rather than handed to `Split`, for two reasons that are both about
            `CheckDemo`.

            **It is not on a half.** The figure is a whole dashboard at 760
            design px with 11px labels on it, and those labels *are* the
            content — a finding, and the button that fixes it. On an even half
            of `max-w-5xl` it scales to about 0.6 and they stop being readable,
            so this section takes the wider container and gives the figure the
            larger column. That is the whole difference between a screenshot of
            a product and a screenshot of a product you can read.

            **And the ground is the hero's**, not the alternating tint the rest
            of the page uses. This is where the promise the hero makes is shown
            being kept, and the two are the same colour so they read as one
            claim made twice.

            **The figure is pinned and the words scroll past it.** The left
            column is four points and a caveat — taller than the tablet by half
            again — so centred it left the figure adrift in whitespace and, worse,
            out of the frame for most of the reading. Sticky is the honest
            arrangement: the claims go by while the thing making them stays on
            screen, and the reader can look up from any one of them at a product
            that is still working. `items-start` is what makes it possible —
            a stretched grid item has nothing to stick inside — and it is
            `md:` only, because on one column the figure would pin over the very
            text it belongs to. `top-24` clears the sticky header above it.

            The figure replaced a drawn still of the export screen's readiness
            list. The still could show that the app lists problems; only the
            moving one shows the fix sitting *on* the problem, which is the
            claim this section is actually making. */}
        <section className="border-b border-lp-line bg-lp-tint px-6 py-20">
          <div className="mx-auto grid max-w-6xl items-start gap-12 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div>
              <Head
                eyebrow="Before you upload"
                title="Find out from us, not from a rejection"
              />
              <p className="oc-lead mt-6 font-serif text-xl leading-relaxed">
                A shop refusing your upload is a slow, silent thing. The check
                names what would actually stop it — and separates that from what
                merely costs you readers.
              </p>
              {/* **The four headings are the list; the notes are the
                  footnotes.** Set a step apart on the page's own scale — 24px
                  serif against 14px sans — they can be read on their own, in
                  order, without a word of the small text, which is how a reader
                  who has just met a lit screen beside them actually arrives.
                  Closing that gap made four paragraphs with bold first lines,
                  and the eye had nowhere to land.

                  **The marks carry no tile.** A boxed icon is a *control* —
                  the same shape as the chips inside the figure beside it — and
                  four of them down the margin promised four buttons. Naked,
                  they are what they are: a mark on the paper, in the way-forward
                  indigo. Bigger and heavier to earn that (28px at weight 2),
                  because stroke width is in user units and a glyph scaled up
                  keeps its hairline and quietly reads lighter. */}
              <ul className="mt-8 flex flex-col gap-7">
                {PREPARE.slice(0, 4).map(([name, note], i) => (
                  <li key={name} className="flex gap-4">
                    <span className="mt-1 shrink-0" style={{ color: INK_TEXT }}>
                      <Icon
                        name={PREPARE_MARKS[i]!}
                        className="h-7 w-7"
                        weight={2}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="oc-heading font-serif text-2xl leading-snug text-lp-ink">
                        {name}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed">{note}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {/* White, where every other instance of this box is `var(--color-lp-tint-soft)`:
                  on the hero's tinted ground that fill has nowhere to stand
                  and the box stops reading as a box. */}
              <p className="mt-7 rounded-xl border border-lp-edge bg-lp-ground p-4 text-sm leading-relaxed">
                <strong className="text-lp-ink">About the PDF.</strong> A
                clean interior file at your trim size with fonts embedded — not
                a pre-press file. No bleed, no crop marks, no CMYK, because it
                comes from your browser’s print engine.
              </p>
            </div>

            <div className="md:sticky md:top-24">
              <CheckDemo />
            </div>
          </div>
        </section>

        {/* ---- The metadata, which is where people actually give up ------

            A separate section from the check on purpose. The check is about
            what is *wrong*; this is about the part nobody warns you is boring
            — eight fields a shop demands, half of which have names you have
            never had to know. It is the most-skipped work in publishing and the
            cheapest to get right, so showing the form is showing the product
            doing its least glamorous and most useful thing. */}
        <Split
          eyebrow="The tedious part"
          title="Every field a shop asks for, and why"
          figure={<StoreListingDemo />}
          flip
        >
          <p className="oc-lead font-serif text-xl leading-relaxed">
            An ISBN, a publisher, a language, a series. Fields with names you
            have never needed until the moment a shop refuses to go on without
            them.
          </p>
          <p className="mt-5 leading-relaxed">
            Every one carries a line saying what it is for and who actually
            wants it — Amazon assigns its own ISBN, Apple and Kobo want yours,
            and nobody tells you that until you have hunted for the answer.
          </p>
          <p className="mt-4 leading-relaxed">
            Answered once and saved to the book, not re-asked on every export.
            And every one of them is skippable: the export runs on a blank form,
            because a file you want for your own reader is nobody else&rsquo;s
            business.
          </p>
        </Split>

        {/* ---- Track ---------------------------------------------------- */}
        <Split
          eyebrow="Once it is out"
          title="What it cost against what it earned"
          tint
          figure={<MoneyFigure />}
        >
          <p className="oc-lead font-serif text-xl leading-relaxed">
            Nobody keeps this, which is why the total is always a shock.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {TRACK.slice(0, 4).map(([name, note]) => (
              <li key={name}>
                <p className="oc-heading font-serif text-lg text-lp-ink">{name}</p>
                <p className="text-sm leading-relaxed">{note}</p>
              </li>
            ))}
          </ul>
        </Split>

        {/* ---- The bento ------------------------------------------------

            The tool list, read out of `book-tools.ts` so the page cannot claim
            a tool that does not exist or miss one that does. Cards of two
            sizes, the way the reference mixes them, with the group that answers
            the most expensive question given the wide cell. */}
        <section id="tools" className="border-b border-lp-line px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <Head
              eyebrow="All of it included"
              title={`${ALL_TOOLS.length} tools, nothing held back`}
              lead="Every one works on a real book, and none of them is behind the paid plan."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {TOOL_GROUPS.map((group, i) => (
                <div
                  key={group.title}
                  // The first group gets the wide cell *and* the brand ground:
                  // "the parts a shop sees" is the question this audience
                  // arrives with, so it is the one that should be read first.
                  className={`rounded-2xl border p-6 ${
                    i === 0 ? "text-lp-accent-pale md:col-span-2" : "border-lp-edge"
                  }`}
                  style={
                    i === 0
                      ? { backgroundColor: INK, borderColor: INK }
                      : undefined
                  }
                >
                  <p
                    className={`oc-heading font-serif text-xl ${
                      i === 0 ? "text-lp-accent-ink" : "text-lp-ink"
                    }`}
                  >
                    {group.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">{group.note}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {group.tools.map((tool) => (
                      <li
                        key={tool.path}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          i === 0
                            ? "border-lp-accent-ink/20 text-lp-accent-ink"
                            : "border-lp-edge text-lp-ink"
                        }`}
                      >
                        {tool.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Refusals, and their other half ---------------------------

            High on the page on purpose. For a reader who has been sold to by
            everyone, the fastest way to earn a minute of attention is to say
            what you will not take money for.

            Each row is one boundary from both sides, and a real `<table>` is
            the honest markup for that: two columns, four rows, every cell
            meaning something only in relation to the one beside it. A screen
            reader gets "what we do instead" against each cell from the column
            header, without the words being printed four times.

            **Every point carries its own mark**, header or no header. The two
            columns are the width of the page apart, and by the fourth row the
            header that named them is off the top of the screen — so a reader
            who has just glanced across has nothing telling them which side
            they landed on. The marks are hung in the margin rather than set
            inline, so the text of every point starts on one left edge and the
            column still reads as a column.

            **Both sides are shaped identically** — mark, title, small
            description — because the moment the two halves are set out
            differently, the fuller one reads as the real content and the other
            as a caption on it. Same shape, both directions, and the reader
            weighs them against each other instead.

            The layout is the argument. Each column is an enclosed panel in its
            own colour, and the seam where the two meet — a red edge against a
            green one — is the boundary the whole section is about. Nothing
            here is decoration: red is what we refuse, green is what you get,
            which is the same ladder the app uses for readiness.

            Three volumes of one hue per side, and the order matters. The
            ground is `STOP` / `PASS` at about 4%, quiet enough that four rows
            of it reads as paper rather than as a warning. The outline is the
            same hue at about 35%, which is the least that reads as *coloured*
            rather than as a grey hairline at 1px. The row separators inside
            sit between the two, so the panel is outlined and the rows are only
            divided — one line weight for both would flatten the panel into a
            grid. The marks and the column labels are the full-strength
            colours, and they are the only things here at full strength.

            Below `md` there is no room for two columns of prose, so the table
            unfolds into stacked pairs and the hidden column header comes back
            per row. The alternative — a horizontally scrolling table on a
            phone — is the one thing on this page that would need explaining. */}
        <section className="border-b border-lp-line bg-lp-tint-soft px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <Head
              eyebrow="Straight answer"
              title="What we will not do, and what we do instead"
              lead="Every item below is something writers ask for constantly, and we say no in public so you can plan around it. Each no carries the work on our side of it — a refusal with nothing behind it is just a feature we are missing."
            />
            <table className="mt-12 w-full border-separate border-spacing-0 text-left max-md:block">
              <thead className="max-md:hidden">
                <tr>
                  <th
                    scope="col"
                    className="w-1/2 rounded-tl-2xl border-x border-t border-stop-line bg-stop-bg px-7 pt-6 pb-4 align-bottom"
                  >
                    <span
                      className="font-code flex items-center gap-3 text-[0.9375rem] font-semibold tracking-[0.12em] uppercase"
                      style={{ color: STOP }}
                    >
                      <Icon
                        name="cross"
                        className="h-[23px] w-[23px]"
                        weight={2.3}
                      />
                      What we will not do
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="rounded-tr-2xl border-x border-t border-ok-line bg-ok-bg px-7 pt-6 pb-4 align-bottom"
                  >
                    <span
                      className="font-code flex items-center gap-3 text-[0.9375rem] font-semibold tracking-[0.12em] uppercase"
                      style={{ color: PASS }}
                    >
                      <Icon
                        name="check"
                        className="h-[23px] w-[23px]"
                        weight={2.3}
                      />
                      What we do instead
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="max-md:block">
                {REFUSALS.map(([name, why, doTitle, doNote], i) => {
                  const last = i === REFUSALS.length - 1;
                  return (
                    <tr key={name} className="max-md:block max-md:pt-4">
                      <td
                        className={`bg-stop-bg px-7 py-7 align-top max-md:block max-md:rounded-2xl max-md:border max-md:border-stop-line md:border-x md:border-t md:border-x-stop-line md:border-t-stop-line ${
                          last
                            ? "md:rounded-bl-2xl md:border-b md:border-b-stop-line"
                            : ""
                        }`}
                      >
                        <Point
                          mark="cross"
                          tone={STOP}
                          title={name}
                          note={why}
                        />
                      </td>
                      <td
                        className={`bg-ok-bg px-7 py-7 align-top max-md:mt-4 max-md:block max-md:rounded-2xl max-md:border max-md:border-ok-line md:border-x md:border-t md:border-x-ok-line md:border-t-ok-line ${
                          last
                            ? "md:rounded-br-2xl md:border-b md:border-b-ok-line"
                            : ""
                        }`}
                      >
                        {/* The column header is hidden on a phone, so the
                            label comes back per row. Its mark does not — the
                            point below is already carrying one. */}
                        <span
                          className="font-code mb-3 block text-[0.9375rem] font-semibold tracking-[0.12em] uppercase md:hidden"
                          style={{ color: PASS }}
                        >
                          What we do instead
                        </span>
                        <Point
                          mark="check"
                          tone={PASS}
                          title={doTitle}
                          note={doNote}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Still to come -------------------------------------------- */}
        <section className="border-b border-lp-line px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <Head
              eyebrow="Not built yet"
              title="What comes after that"
              lead="Listed so you know where this is going, and so you can hold us to the difference between a plan and a product. No dates — a date is a promise with a number on it."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {LATER.map(([name, note]) => (
                <div
                  key={name}
                  className="rounded-2xl border border-dashed border-lp-edge p-6"
                >
                  <p className="font-code text-[0.625rem] tracking-[0.16em] text-lp-faint uppercase">
                    Not built
                  </p>
                  <p className="oc-heading mt-3 font-serif text-lg text-lp-ink">
                    {name}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ---- FAQ ------------------------------------------------------ */}
        <section className="border-b border-lp-line px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <Head eyebrow="Questions" title="Reasonable suspicion, answered" />
            <div className="mt-12 flex flex-col">
              {FAQ.map(([q, a], i) => (
                <details
                  key={q}
                  open={i === 0}
                  className="border-t border-lp-edge py-5 first:border-t-0 first:pt-0"
                >
                  <summary className="oc-heading cursor-pointer font-serif text-lg text-lp-ink marker:text-[var(--color-lp-edge-strong)]">
                    {q}
                  </summary>
                  <p className="mt-3 leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Close ---------------------------------------------------- */}
        <section className="px-6 py-24 text-center" style={{ backgroundColor: INK }}>
          <div className="mx-auto max-w-2xl">
            <h2 className="oc-heading font-serif text-4xl leading-tight text-lp-accent-ink sm:text-5xl">
              You have the book.
              <br />
              Take the order for free.
            </h2>
            <p className="oc-lead mt-6 font-serif text-xl leading-relaxed text-lp-accent-pale">
              Import the manuscript you already have and the first screen tells
              you what stands between it and a shop. If any of it does not work,
              you have lost an afternoon.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-lp-ground px-7 py-3.5 font-semibold text-lp-ink hover:opacity-90"
              >
                Start free
              </Link>
              <Link
                href="/signin"
                className="rounded-full border border-lp-accent-ink/25 px-7 py-3.5 font-semibold text-lp-accent-ink hover:border-lp-accent-ink/50"
              >
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 font-code text-xs tracking-wider text-lp-faint uppercase">
          <span>© {new Date().getFullYear()} OpenChapter</span>
          <span>Your manuscript stays in your browser</span>
        </div>
      </footer>
    </div>
  );
}

/* ---- The furniture ------------------------------------------------------- */

function Head({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
        {eyebrow}
      </p>
      <h2 className="oc-heading mt-4 font-serif text-4xl leading-tight text-lp-ink sm:text-[2.75rem]">
        {title}
      </h2>
      {lead && (
        <p className="oc-lead mt-4 font-serif text-xl leading-relaxed">{lead}</p>
      )}
    </div>
  );
}

/**
 * A section with the words on one side and a picture of the thing on the other.
 *
 * `flip` swaps the sides. Alternating them down the page is what stops six
 * sections reading as one long column — the reference does it for the same
 * reason, and the order-reversal classes are on the *figure* so the words stay
 * first in the DOM and a screen reader is never handed the picture first.
 */
function Split({
  id,
  eyebrow,
  title,
  children,
  figure,
  flip,
  tint,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  figure: ReactNode;
  flip?: boolean;
  tint?: boolean;
}) {
  return (
    <section
      {...(id ? { id } : {})}
      className={`border-b border-lp-line px-6 py-20 ${
        tint ? "bg-lp-tint-soft" : ""
      }`}
    >
      <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
        <div>
          <Head eyebrow={eyebrow} title={title} />
          <div className="mt-6">{children}</div>
        </div>
        <div className={flip ? "md:order-first" : ""}>{figure}</div>
      </div>
    </section>
  );
}

/**
 * One marked point: mark, title, small description.
 *
 * Shared by both halves of the refusals table, and that is the reason it
 * exists rather than being written twice. The moment one side is set out more
 * fully than the other, the fuller one reads as the argument and the other as
 * a footnote on it — and the whole point of that table is that the two weigh
 * the same. One component makes drifting apart impossible.
 *
 * The mark hangs in the margin rather than sitting inline in the title, so the
 * description below starts on the same left edge as the words above it. Both
 * glyphs centre on y=12 of the 24 grid, so one offset serves both.
 *
 * It is set heavier than the rest of the icon set on purpose: here the mark is
 * the *verdict* — refused or provided — rather than a label's decoration, and
 * at a hairline it was the quietest thing in a row it should lead.
 */
function Point({
  mark,
  tone,
  title,
  note,
}: {
  mark: "cross" | "check";
  tone: string;
  title: string;
  note: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="mt-0.5 shrink-0" style={{ color: tone }}>
        <Icon name={mark} className="h-[28px] w-[28px]" weight={2.3} />
      </span>
      <div>
        <p className="oc-heading font-serif text-xl leading-snug text-lp-ink">
          {title}
        </p>
        <p className="mt-2 text-sm leading-relaxed">{note}</p>
      </div>
    </div>
  );
}

/**
 * One counted figure. Never a user count — see the note at the top.
 *
 * `tone` is for the one that is a verdict rather than a tally. Colouring all
 * four would make the row decorative and the green would stop meaning "passed".
 */
function Counted({
  icon,
  n,
  label,
  tone,
}: {
  icon: keyof typeof icons;
  n: string;
  label: string;
  tone?: string;
}) {
  return (
    <div>
      <span
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-full"
        style={{
          color: tone ?? INK,
          backgroundColor: `${tone ?? INK}12`,
        }}
      >
        <Icon name={icon} />
      </span>
      <p
        className="oc-heading mt-3 font-serif text-4xl"
        style={{ color: tone ?? "var(--color-lp-ink)" }}
      >
        {n}
      </p>
      <p className="mt-1 text-sm">{label}</p>
    </div>
  );
}

function Phase({
  n,
  icon,
  title,
  note,
  items,
  lit,
}: {
  n: string;
  icon: keyof typeof icons;
  title: string;
  note: string;
  items: number;
  lit?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-7"
      style={
        lit
          ? { borderColor: INK, backgroundColor: INK, color: "var(--color-lp-accent-pale)" }
          : { borderColor: "var(--color-lp-edge)", backgroundColor: "var(--color-lp-ground)" }
      }
    >
      {/* The lit card is the brand indigo rather than black: it is the phase
          most readers are standing in, and indigo says "you are here" where
          black said "this one is heavier than the others".

          The tile behind the glyph is a wash of whatever it sits on — the ink
          on the lit card, the accent on the unlit one — through `color-mix`
          rather than an eight-digit hex. A hex carries its own alpha and a
          token cannot: `var(--x)1f` is not a colour, it is a string with two
          characters stuck on the end, and CSS drops the whole declaration
          without saying so. */}
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={
          lit
            ? {
                backgroundColor:
                  "color-mix(in srgb, var(--color-lp-accent-ink) 12%, transparent)",
                color: "var(--color-lp-accent-ink)",
              }
            : {
                backgroundColor:
                  "color-mix(in srgb, var(--color-lp-accent) 7%, transparent)",
                color: INK_TEXT,
              }
        }
      >
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p
        className={`mt-5 font-code text-xs tracking-[0.18em] uppercase ${
          lit ? "text-lp-accent-ink/60" : "text-lp-faint"
        }`}
      >
        {n}
      </p>
      <p
        className={`oc-heading mt-4 font-serif text-2xl ${
          lit ? "text-lp-accent-ink" : "text-lp-ink"
        }`}
      >
        {title}
      </p>
      <p className="oc-lead mt-2 font-serif text-lg leading-relaxed">{note}</p>
      <p
        className={`mt-5 font-code text-xs tracking-wider uppercase ${
          lit ? "text-lp-accent-ink/60" : "text-lp-faint"
        }`}
      >
        {items} things it does
      </p>
    </div>
  );
}

/* ---- The figures ---------------------------------------------------------
 *
 * Drawn in markup rather than screenshotted, which is this repo's standing
 * rule for its own figures: a screenshot is an asset that goes stale silently
 * while the app moves, and these would be lying about the first screen a new
 * writer sees. Each uses the same words and the same order the real screen
 * does, so they can only go wrong if the product does.
 * ------------------------------------------------------------------------- */

/** The five phases, with the ARC step marked where it actually sits. */
function OrderFigure() {
  return (
    <div
      className="rounded-2xl border border-lp-edge bg-lp-ground p-7"
      aria-hidden="true"
    >
      <ol className="flex flex-col">
        {PHASES.map((phase, i) => {
          const here = i + 1 === ARC_PHASE;
          return (
            <li
              key={phase.id}
              className="flex gap-4 border-t border-[var(--color-lp-raised)] py-4 first:border-t-0 first:pt-0"
            >
              <span className="font-code text-xs text-[var(--color-lp-edge-strong)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-serif text-lg ${
                    here ? "text-lp-ink" : "text-lp-body"
                  }`}
                >
                  {phase.label}
                </span>
                {here && (
                  // Indigo, not black: this is the step the whole page is
                  // arguing about, and the brand colour is what every other
                  // "here is the answer" on the page is set in.
                  <span
                    className="mt-2 block rounded-lg px-3 py-2 text-xs font-semibold text-lp-accent-ink"
                    style={{ backgroundColor: INK }}
                  >
                    {ARC_STEP.title}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* The pre-upload check used to be drawn here as a still of the export
   screen's readiness list. `check-demo.tsx` replaced it — same red/amber
   verdict, on the real screen, with the fix beside each problem. */

/** Cost against earnings, the way the Track screen puts it. */
function MoneyFigure() {
  return (
    <div
      className="rounded-2xl border border-lp-edge bg-lp-ground p-7"
      aria-hidden="true"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-lp-tint-soft p-4">
          <p className="font-code text-[0.625rem] tracking-[0.16em] text-lp-faint uppercase">
            Spent
          </p>
          <p className="oc-heading mt-2 font-serif text-2xl" style={{ color: STOP }}>
            £1,240
          </p>
          <p className="mt-1 text-xs">Cover · editing · ads · proofs</p>
        </div>
        <div className="rounded-xl bg-lp-tint-soft p-4">
          <p className="font-code text-[0.625rem] tracking-[0.16em] text-lp-faint uppercase">
            Earned
          </p>
          <p className="oc-heading mt-2 font-serif text-2xl" style={{ color: PASS }}>
            £410
          </p>
          <p className="mt-1 text-xs">From your own sales report</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-lp-edge p-4">
        <p className="text-sm text-lp-ink">
          <strong>412 more copies</strong> gets you level.
        </p>
        <p className="mt-1 text-xs leading-relaxed">
          Worked from what a copy has actually earned you. With no rows saying
          so, the figure does not appear at all.
        </p>
      </div>
    </div>
  );
}
