import Link from "next/link";
import type { ReactNode } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { GoogleButton } from "@/components/auth/auth-shell";
import { LandingHeader } from "@/components/landing/landing-header";
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
 * roadmap.
 *
 * **The stat band is the honest version of "trusted by 5,000 brands".** The
 * layout this was built to wants social proof there and we have none, so it
 * carries four figures counted out of the source instead — steps, tools,
 * formats, EPUBCheck errors. Never put a user count, a rating or a testimonial
 * in that row until there is one to count.
 *
 * **It is always light**, whichever theme the app is wearing, and it states its
 * colours literally rather than using the `@theme` tokens. A shop front that
 * changed colour depending on a setting made inside the product would be a
 * different page to the one someone linked to.
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
 * - `STOP` / `WARN` / `PASS` are the semantic three, and they are the same
 *   ladder the app itself uses (`stop` / `note` / `ok` tokens). Red is
 *   *would be refused*, amber is *costs you readers*, green is *free, passed,
 *   nothing owed*. They never appear as decoration, only as verdicts.
 * - The tinted grounds are `INK` itself with the volume down — see the note
 *   under the constants. One colour at four volumes, not a hue plus a neutral.
 *
 * The emotional arc down the page is deliberate: red where the fear is named,
 * amber where the cost is, green where something has passed or been earned,
 * indigo on every way forward.
 */
const INK = "#312e81"; // indigo-900 — actions and links
const STOP = "#b91c1c"; // would be refused
const WARN = "#b45309"; // costs you readers
const PASS = "#15803d"; // free, passed, earned

/*
 * The two tinted grounds, and both are `INK` with the volume down.
 *
 * `#eeeef5` is INK at about 8% on white and backs the hero; `#f7f7fb` is the
 * same at about 4% and backs the alternating bands. Tinting the *brand* colour
 * rather than reaching for a neutral is what makes a page feel designed instead
 * of assembled: the hero, the lit card and the section grounds are then one
 * colour at four volumes, and the eye reads that as intent.
 *
 * They were a warm paper grey, which was pleasant and wrong — a warm ground
 * under a cool indigo card is two colour systems in one viewport, and it is the
 * kind of mismatch nobody can name but everybody feels.
 *
 * Written at each site as literal classes rather than held here as constants:
 * Tailwind reads class names as literals and would ship no rule for a name
 * built at runtime.
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
} as const;

/** One glyph from the set above. 18px unless a caller has a reason. */
function Icon({
  name,
  className = "h-[18px] w-[18px]",
}: {
  name: keyof typeof icons;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
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

const PREPARE = [
  [
    "A pre-upload check",
    "It names what a store would refuse — missing cover, malformed ISBN, blurb over the limit — and says which problems would actually stop the upload as against the ones that only cost you readers. It never blocks your export.",
  ],
  [
    "The books yours sits beside",
    "Real comparable titles, found by reading your blurb rather than matching one word — and from them, what your genre is filed under, how long those books run, and what their covers look like at the size a reader meets them.",
  ],
  [
    "Your blurb, counted against real ones",
    "The shops' limit, five actual blurbs from books like yours, and the length they run to. We do not write it.",
  ],
  [
    "Is the title taken, and will the cover be refused",
    "Whether somebody else's book turns up first when a reader searches for yours; and whether your artwork is the right size, shape and weight to upload.",
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

const REFUSALS = [
  [
    "We will not design your cover or edit your prose with AI",
    "AI here reads and reports. It never writes into your book. The cheap way to build covers and editing is generative, and doing it would make liars of us in front of the one audience that checks. If those ever exist here, they come from real designers and real editors.",
  ],
  ["We will not sell you a course", "You have met those people already."],
  [
    "We will not promise your book will sell",
    "Anyone who does is selling you something. We can tell you what a shop will refuse. We cannot tell you what a reader will love.",
  ],
  [
    "We will not upload to Amazon for you",
    "There is no public API. Anyone automating that dashboard is risking your publishing account, not theirs.",
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
    // Colours stated literally, so the page is the same page whichever theme
    // the reader has chosen inside the app — including a reader who has never
    // been inside it.
    <div className="h-dvh overflow-y-auto bg-white text-[#5b5b63] [scroll-behavior:smooth]">
      <LandingHeader ink={INK} />

      <main>
        {/* ---- Hero -----------------------------------------------------

            Centred stack, then the product cropped by the fold — the shape
            the references use, and the right one: a reader who has been
            promised things by four other tools wants to see the thing before
            they read another adjective. */}
        <section className="-mt-16 overflow-hidden border-b border-[#ececee] bg-[#eeeef5] px-6 pt-28 sm:pt-32">
          <div className="mx-auto max-w-5xl text-center">
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
              <span className="block text-[#6e6c96]">
                Find out what&rsquo;s wrong with your book
              </span>
              <span className="block" style={{ color: INK }}>
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

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                style={{ backgroundColor: INK }}
                className="rounded-full px-7 py-3.5 font-semibold text-white hover:opacity-90"
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
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-[#dcdce0] bg-white px-7 py-3.5 font-semibold text-[#0f0f10] hover:border-[#b9b9c0]"
              />
            </div>

          </div>

          <DashboardFigure />
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
        <section className="border-b border-[#ececee] px-6 py-10">
          <div className="mx-auto max-w-5xl">
            <p className="text-center font-code text-[0.6875rem] tracking-[0.18em] text-[#9a9aa2] uppercase">
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
                  <span className="text-[0.8125rem] font-medium text-[#3f3f46]">
                    {destination.name}
                  </span>
                  <span className="hidden font-code text-[0.625rem] tracking-wider text-[#b0b0b8] uppercase xl:inline">
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
        <section className="border-b border-[#ececee] px-6 py-14">
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
        <section id="does" className="border-b border-[#ececee] px-6 py-20">
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
            <strong className="text-[#0f0f10]">
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
            <strong className="text-[#0f0f10]">
              {SELF_TICKING} of the {SELF_TICKING + YOURS_TO_TICK} tick
              themselves
            </strong>{" "}
            from what is already in your book — no checklist to maintain, and
            nothing that can be lied to by accident.
          </p>
        </Split>

        {/* ---- Prepare, mirrored ---------------------------------------- */}
        <Split
          eyebrow="Before you upload"
          title="Find out from us, not from a rejection"
          flip
          figure={<CheckFigure />}
        >
          <p className="oc-lead font-serif text-xl leading-relaxed">
            A shop refusing your upload is a slow, silent thing. The check names
            what would actually stop it — and separates that from what merely
            costs you readers.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {PREPARE.slice(0, 4).map(([name, note]) => (
              <li key={name}>
                <p className="oc-heading font-serif text-lg text-[#0f0f10]">{name}</p>
                <p className="text-sm leading-relaxed">{note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-xl border border-[#e6e6e8] bg-[#f7f7fb] p-4 text-sm leading-relaxed">
            <strong className="text-[#0f0f10]">About the PDF.</strong> A clean
            interior file at your trim size with fonts embedded — not a
            pre-press file. No bleed, no crop marks, no CMYK, because it comes
            from your browser’s print engine.
          </p>
        </Split>

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
          figure={<ListingFigure />}
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
                <p className="oc-heading font-serif text-lg text-[#0f0f10]">{name}</p>
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
        <section id="tools" className="border-b border-[#ececee] px-6 py-20">
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
                    i === 0 ? "text-[#c7d2fe] md:col-span-2" : "border-[#e6e6e8]"
                  }`}
                  style={
                    i === 0
                      ? { backgroundColor: INK, borderColor: INK }
                      : undefined
                  }
                >
                  <p
                    className={`oc-heading font-serif text-xl ${
                      i === 0 ? "text-white" : "text-[#0f0f10]"
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
                            ? "border-white/20 text-white"
                            : "border-[#e2e2e5] text-[#0f0f10]"
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

        {/* ---- Refusals -------------------------------------------------

            High on the page on purpose. For a reader who has been sold to by
            everyone, the fastest way to earn a minute of attention is to say
            what you will not take money for. */}
        <section className="border-b border-[#ececee] bg-[#f7f7fb] px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <Head
              eyebrow="Straight answer"
              title="What we will not do"
              lead="Every item below is something writers ask for constantly. We are saying no in public so you can plan around it."
            />
            <ul className="mt-12 flex flex-col">
              {REFUSALS.map(([name, note]) => (
                <li
                  key={name}
                  className="grid gap-2 border-t border-[#e6e6e8] py-6 first:border-t-0 first:pt-0 md:grid-cols-[1fr_1.4fr] md:gap-10"
                >
                  {/* A red ✕ against a "we will not" is the one decorative-
                      looking use of colour that is not decorative: the whole
                      section is a list of refusals, and the mark is what makes
                      that legible before a word is read. */}
                  <p className="oc-heading flex items-start gap-2.5 font-serif text-xl leading-snug text-[#0f0f10]">
                    <span className="mt-1 shrink-0" style={{ color: STOP }}>
                      <Icon name="cross" className="h-[18px] w-[18px]" />
                    </span>
                    {name}
                  </p>
                  <p className="leading-relaxed">{note}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Still to come -------------------------------------------- */}
        <section className="border-b border-[#ececee] px-6 py-20">
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
                  className="rounded-2xl border border-dashed border-[#dcdce0] p-6"
                >
                  <p className="font-code text-[0.625rem] tracking-[0.16em] text-[#9a9aa2] uppercase">
                    Not built
                  </p>
                  <p className="oc-heading mt-3 font-serif text-lg text-[#0f0f10]">
                    {name}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ---- FAQ ------------------------------------------------------ */}
        <section className="border-b border-[#ececee] px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <Head eyebrow="Questions" title="Reasonable suspicion, answered" />
            <div className="mt-12 flex flex-col">
              {FAQ.map(([q, a], i) => (
                <details
                  key={q}
                  open={i === 0}
                  className="border-t border-[#e6e6e8] py-5 first:border-t-0 first:pt-0"
                >
                  <summary className="oc-heading cursor-pointer font-serif text-lg text-[#0f0f10] marker:text-[#c8c8ce]">
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
            <h2 className="oc-heading font-serif text-4xl leading-tight text-white sm:text-5xl">
              You have the book.
              <br />
              Take the order for free.
            </h2>
            <p className="oc-lead mt-6 font-serif text-xl leading-relaxed text-[#c7d2fe]">
              Import the manuscript you already have and the first screen tells
              you what stands between it and a shop. If any of it does not work,
              you have lost an afternoon.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-white px-7 py-3.5 font-semibold text-[#0f0f10] hover:bg-[#e6e6e8]"
              >
                Start free
              </Link>
              <Link
                href="/signin"
                className="rounded-full border border-white/25 px-7 py-3.5 font-semibold text-white hover:border-white/50"
              >
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 font-code text-xs tracking-wider text-[#9a9aa2] uppercase">
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
      <p className="font-code text-[0.6875rem] tracking-[0.18em] text-[#9a9aa2] uppercase">
        {eyebrow}
      </p>
      <h2 className="oc-heading mt-4 font-serif text-4xl leading-tight text-[#0f0f10] sm:text-[2.75rem]">
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
      className={`border-b border-[#ececee] px-6 py-20 ${
        tint ? "bg-[#f7f7fb]" : ""
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
        style={{ color: tone ?? "#0f0f10" }}
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
          ? { borderColor: INK, backgroundColor: INK, color: "#c7d2fe" }
          : { borderColor: "#e6e6e8", backgroundColor: "#fff" }
      }
    >
      {/* The lit card is the brand indigo rather than black: it is the phase
          most readers are standing in, and indigo says "you are here" where
          black said "this one is heavier than the others". */}
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={
          lit
            ? { backgroundColor: "#ffffff1f", color: "#fff" }
            : { backgroundColor: `${INK}12`, color: INK }
        }
      >
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p
        className={`mt-5 font-code text-xs tracking-[0.18em] uppercase ${
          lit ? "text-white/60" : "text-[#9a9aa2]"
        }`}
      >
        {n}
      </p>
      <p
        className={`oc-heading mt-4 font-serif text-2xl ${
          lit ? "text-white" : "text-[#0f0f10]"
        }`}
      >
        {title}
      </p>
      <p className="oc-lead mt-2 font-serif text-lg leading-relaxed">{note}</p>
      <p
        className={`mt-5 font-code text-xs tracking-wider uppercase ${
          lit ? "text-white/60" : "text-[#9a9aa2]"
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

/** The Overview, cropped by the fold. */
function DashboardFigure() {
  return (
    <div className="mx-auto mt-16 max-w-5xl" aria-hidden="true">
      <div className="rounded-t-2xl border-x border-t border-[#e6e6e8] bg-white p-2 shadow-[0_-24px_60px_-30px_rgba(15,15,16,0.25)]">
        <div className="flex gap-px overflow-hidden rounded-t-xl bg-[#ececee]">
          <div className="hidden w-44 shrink-0 flex-col gap-1 bg-white p-4 sm:flex">
            <span className="mb-3 font-serif text-sm text-[#0f0f10]">
              OpenChapter
            </span>
            {["Overview", "Write", "Prepare", "Track", "Tools"].map(
              (item, i) => (
                <span
                  key={item}
                  className={`rounded-md px-2.5 py-1.5 text-xs ${
                    i === 0
                      ? "bg-[#f1f1f3] font-medium text-[#0f0f10]"
                      : "text-[#9a9aa2]"
                  }`}
                >
                  {item}
                </span>
              ),
            )}
          </div>

          <div className="min-w-0 flex-1 bg-white p-5 sm:p-6">
            <p className="font-code text-[0.625rem] tracking-[0.18em] text-[#9a9aa2] uppercase">
              Getting it ready
            </p>
            <p className="oc-heading mt-1.5 font-serif text-xl text-[#0f0f10]">
              The Drowned Coast
            </p>
            <p className="mt-3 text-sm">
              <span className="font-semibold text-[#0f0f10]">2 things</span>{" "}
              would stop a shop taking this · 3 worth doing
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {[
                [
                  "No cover.",
                  "It is the only thing most readers ever see.",
                  "Add a cover",
                ],
                [
                  "No blurb.",
                  "The text under the cover is what decides the sale.",
                  "Work on the blurb",
                ],
              ].map(([title, why, action]) => (
                <div
                  key={title}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#e6e6e8] bg-[#f7f7fb] px-3.5 py-3"
                >
                  <span className="min-w-[10rem] flex-1">
                    <span className="block text-sm font-semibold text-[#0f0f10]">
                      {title}
                    </span>
                    <span className="block text-sm">{why}</span>
                  </span>
                  <span
                    className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: INK }}
                  >
                    {action}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-[#ececee] pt-4">
              {PHASES.map((phase, i) => (
                <span key={phase.id} className="flex flex-1 items-center gap-2">
                  {/* Filled = done, ringed = where the book is, hollow = ahead.
                      Three states from one shape and one colour, which is what
                      the real dials do — a second hue here would imply a
                      severity that a phase does not have. */}
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border-2"
                    style={{
                      borderColor: i <= 2 ? INK : "#dcdce0",
                      backgroundColor: i < 2 ? INK : "transparent",
                    }}
                  />
                  {i < PHASES.length - 1 && (
                    <span className="h-px flex-1 bg-[#ececee]" />
                  )}
                </span>
              ))}
            </div>
            <p className="mt-3 font-code text-[0.625rem] tracking-[0.18em] text-[#9a9aa2] uppercase">
              Next · {ARC_STEP.title}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The five phases, with the ARC step marked where it actually sits. */
function OrderFigure() {
  return (
    <div
      className="rounded-2xl border border-[#e6e6e8] bg-white p-7"
      aria-hidden="true"
    >
      <ol className="flex flex-col">
        {PHASES.map((phase, i) => {
          const here = i + 1 === ARC_PHASE;
          return (
            <li
              key={phase.id}
              className="flex gap-4 border-t border-[#f1f1f3] py-4 first:border-t-0 first:pt-0"
            >
              <span className="font-code text-xs text-[#c0c0c6]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-serif text-lg ${
                    here ? "text-[#0f0f10]" : "text-[#5b5b63]"
                  }`}
                >
                  {phase.label}
                </span>
                {here && (
                  // Indigo, not black: this is the step the whole page is
                  // arguing about, and the brand colour is what every other
                  // "here is the answer" on the page is set in.
                  <span
                    className="mt-2 block rounded-lg px-3 py-2 text-xs font-semibold text-white"
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

/** The pre-upload check, as it reads on the export screen. */
function CheckFigure() {
  return (
    <div
      className="rounded-2xl border border-[#e6e6e8] bg-white p-7"
      aria-hidden="true"
    >
      <p className="font-code text-[0.625rem] tracking-[0.18em] text-[#9a9aa2] uppercase">
        Before you upload
      </p>
      <ul className="mt-5 flex flex-col gap-3">
        {[
          ["Would be refused", "Cover missing", true],
          ["Would be refused", "ISBN check digit does not add up", true],
          ["Costs you readers", "No categories chosen", false],
          ["Costs you readers", "No publisher named", false],
        ].map(([weight, what, blocking]) => (
          <li
            key={what as string}
            className="flex items-start gap-3 border-b border-[#f1f1f3] pb-3 last:border-b-0 last:pb-0"
          >
            <span
              // The badge *is* the verdict, so it is the one place on the page
              // where red and amber are load-bearing: filled red for what a
              // shop refuses, outlined amber for what merely costs you readers.
              // Weight carries it too — filled against outlined — so a reader
              // who cannot separate the two hues still reads the difference.
              className="mt-0.5 shrink-0 rounded-md px-2 py-1 font-code text-[0.5625rem] tracking-wider uppercase"
              style={
                blocking
                  ? { backgroundColor: STOP, color: "#fff" }
                  : { border: `1px solid ${WARN}55`, color: WARN }
              }
            >
              {weight as string}
            </span>
            <span className="text-sm text-[#0f0f10]">{what as string}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs leading-relaxed text-[#9a9aa2]">
        It never blocks the export. The file is yours whether or not a shop
        would take it.
      </p>
    </div>
  );
}

/**
 * The store-listing form, as the export wizard really draws it.
 *
 * **The hints are the point, not the inputs.** Any form can ask for an ISBN;
 * the line underneath saying *"Amazon assigns its own; Apple and Kobo want
 * yours"* is the thing a writer cannot get anywhere without paying somebody.
 * So the figure is drawn label-first with the hint given equal weight, which is
 * the opposite of how a form is usually shown off.
 *
 * The strings are copied from `publishing-card.tsx` rather than imported —
 * that file is a Client Component full of inputs and state, and pulling it in
 * to read six sentences would ship the whole editor to a marketing page. The
 * cost is that they can drift; the check against that is that they are short,
 * quoted here, and a change to a hint is a change somebody is already reading.
 *
 * **All six fields, not a representative four.** An earlier version showed
 * two-thirds of the form to keep the panel short, which is the kind of edit
 * that looks like design and is actually a small lie: the reader counts what
 * they are shown, and a page whose whole claim is being checkable cannot round
 * its own screenshots down. ISBN is left empty because it is the one most books
 * genuinely do not have yet, and the Skip line stays — "you can add this later"
 * is a promise the export really honours and the most reassuring thing here.
 */
function ListingFigure() {
  const fields: [string, string, string, boolean][] = [
    ["ISBN", "978-0-306-40615-7", "13 digits. Amazon assigns its own; Apple and Kobo want yours.", false],
    ["Language", "English", "Decides which storefront the book is listed on.", true],
    ["Publisher", "Elena Rosa", "Your own name is the usual answer when self-publishing.", true],
    ["Publication date", "08/02/2026", "Leave empty until it has one.", true],
    ["Series", "The salt cycle", "The shelf this book belongs to, if any.", true],
    ["Number in series", "1", "As a reader would count it.", true],
  ];

  return (
    // A tablet, held slightly off the page.
    //
    // The bezel and the shadow are doing one job between them: they say *this
    // is a real screen in a real product*, which a bordered card on a white
    // page does not. The shadow is deliberately tight and dark rather than the
    // big soft blur a template reaches for — a diffuse shadow reads as a
    // sticker floating above the page, a short one reads as an object resting
    // on it, and the second is the impression worth having.
    //
    // The frame is drawn, like every other figure here, because a photograph of
    // a device is an asset that goes stale the day the UI moves.
    <div
      className="rounded-[1.75rem] border border-[#d8d8de] bg-[#f2f2f5] p-3
                 shadow-[0_2px_0_#d8d8de,0_18px_28px_-14px_rgba(15,15,16,0.45)]"
      aria-hidden="true"
    >
      <div className="rounded-[1.25rem] bg-white p-6 sm:p-7">
      <p className="oc-heading font-serif text-xl text-[#0f0f10]">
        What a shop asks for
      </p>
      <p className="mt-1 text-sm">
        Saved to the book, so you answer these once rather than once per export.
      </p>

      <div className="mt-6 grid gap-x-5 gap-y-5 sm:grid-cols-2">
        {fields.map(([label, value, hint, filled]) => (
          <div key={label}>
            <p className="text-xs font-medium text-[#0f0f10]">{label}</p>
            <p
              className={`mt-1.5 rounded-lg border px-3 py-2 text-sm ${
                filled
                  ? "border-[#dcdce0] text-[#0f0f10]"
                  : "border-[#e6e6e8] text-[#b0b0b8]"
              }`}
            >
              {value}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#8a8a92]">
              {hint}
            </p>
          </div>
        ))}
      </div>

      <p
        className="mt-6 rounded-lg py-2.5 text-center text-sm font-semibold text-white"
        style={{ backgroundColor: INK }}
      >
        Continue
      </p>
      <p className="mt-3 text-center text-xs text-[#8a8a92]">
        Skip — you can add this later
      </p>
      </div>
    </div>
  );
}

/** Cost against earnings, the way the Track screen puts it. */
function MoneyFigure() {
  return (
    <div
      className="rounded-2xl border border-[#e6e6e8] bg-white p-7"
      aria-hidden="true"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#f7f7fb] p-4">
          <p className="font-code text-[0.625rem] tracking-[0.16em] text-[#9a9aa2] uppercase">
            Spent
          </p>
          <p className="oc-heading mt-2 font-serif text-2xl" style={{ color: STOP }}>
            £1,240
          </p>
          <p className="mt-1 text-xs">Cover · editing · ads · proofs</p>
        </div>
        <div className="rounded-xl bg-[#f7f7fb] p-4">
          <p className="font-code text-[0.625rem] tracking-[0.16em] text-[#9a9aa2] uppercase">
            Earned
          </p>
          <p className="oc-heading mt-2 font-serif text-2xl" style={{ color: PASS }}>
            £410
          </p>
          <p className="mt-1 text-xs">From your own sales report</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-[#e6e6e8] p-4">
        <p className="text-sm text-[#0f0f10]">
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
