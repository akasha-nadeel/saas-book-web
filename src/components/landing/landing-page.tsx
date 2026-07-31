import Link from "next/link";
import type { ReactNode } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { GoogleButton } from "@/components/auth/auth-shell";
import { BookFan } from "./book-fan";
import {
  AssistantFigure,
  FormatFigure,
  PageFigure,
  ShelfFigure,
} from "./landing-figures";
import { LaptopMockup } from "./laptop-mockup";
import { WorksWith } from "./works-with";

/**
 * What a signed-out visitor sees at `/`.
 *
 * Laid out the way a writing-app landing page usually is: a hero that offers
 * the account immediately, alternating feature rows rather than a grid of
 * cards, then the questions people actually ask, then one more way in.
 *
 * Every claim here is one the app keeps and every link goes somewhere that
 * exists. The FAQ is the part worth guarding — it is where a landing page is
 * most tempted to be vague, and where being exact is worth the most.
 */
export function LandingPage() {
  return (
    // <body> is overflow-hidden for the editor shell, so this page owns its own
    // scrolling. min-h-dvh would put the footer out of reach.
    //
    // Always light, whatever theme the visitor's browser is carrying. This is
    // the front of the product rather than a place to work: it is built around
    // a photograph and a shelf of real covers, all of them made for a white
    // page, and under the dark theme half of it inverted and half of it did
    // not. The attribute re-points the palette for this subtree alone — see
    // [data-theme="light"] in globals.css.
    <div data-theme="light" className="h-dvh overflow-y-auto bg-surface">
      <Nav />
      <Hero />
      <WorksWith />
      <Features />
      <Numbers />
      <Steps />
      <Faq />
      <Closing />
      <Footer />
    </div>
  );
}

// In the order the page presents them. Every section below has an id so it can
// be reached from here — leaving one out makes the nav a table of contents that
// is missing a chapter, and it feeds the footer's column too.
const SECTIONS = [
  ["Features", "#features"],
  ["In numbers", "#numbers"],
  ["Getting started", "#start"],
  ["Questions", "#questions"],
] as const;

/**
 * Mark, wordmark, links down the middle, one filled pill at the end.
 *
 * The pill takes `bg-fg`/`text-surface` rather than a fixed near-black. Those
 * tokens invert with the theme, so it is a dark pill with light text on the
 * light chrome and a light pill with dark text on the dark one — a fixed black
 * would vanish into the dark theme's page.
 */
function Nav() {
  return (
    // Transparent, and therefore *not* sticky. A bar with no ground of its own
    // only works while it sits on the hero photograph; carried down the page it
    // would put white type on the light sections and disappear. Static keeps it
    // where its contrast comes from, and the hero is pulled up underneath so the
    // photograph runs behind it.
    <header className="relative z-30 px-5 pt-5 sm:px-8 sm:pt-6">
      <div className="mx-auto flex max-w-6xl items-center gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <BookMark />
          <span className="font-display text-xl font-semibold tracking-tight text-fg">
            Open<span style={{ color: "#3a86d4" }}>Chapter</span>
          </span>
        </Link>

        {/* Centred in the bar, not merely between its neighbours: flex-1 on the
            nav plus justify-center keeps the links on the midline whatever the
            wordmark and the button happen to measure. */}
        <nav className="hidden flex-1 items-center justify-center gap-9 lg:flex">
          {SECTIONS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              // Matched to the Get started pill: same size, same weight, same
              // full-strength ink. Hover moves to the accent rather than to a
              // darker grey, because at full opacity there is nowhere darker.
              className="font-sans text-base font-semibold text-fg outline-none
                         transition-colors hover:text-accent focus-visible:ring-2
                         focus-visible:ring-accent/50"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          {/* Same size and weight as the section links — it is one more way
              through the nav, not a second button competing with the pill. */}
          <Link
            href="/signin"
            className="hidden px-2 font-sans text-base font-semibold text-fg
                       outline-none transition-colors hover:text-accent
                       focus-visible:ring-2 focus-visible:ring-accent/50 sm:block"
          >
            Sign in
          </Link>
          {/* bg-fg/text-surface rather than a fixed near-black: those invert
              with the theme, so it stays a dark pill on the light chrome and a
              light one on the dark chrome. */}
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-xl bg-fg px-5 py-2.5 font-sans
                       text-base font-semibold text-surface outline-none
                       transition-opacity hover:opacity-85 focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Get started
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M4 10h11M11 6l4 4-4 4" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}

/** The open-book mark, masked so it takes the current text colour. */
function BookMark() {
  return (
    <span
      aria-hidden="true"
      className="h-7 w-7 shrink-0 bg-accent"
      style={{
        maskImage: "url(/logo.png)",
        WebkitMaskImage: "url(/logo.png)",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

function Hero() {
  return (
    // -mt-* pulls the section up under the floating nav, which keeps its space
    // in the flow above. The matching pt-* puts the headline back below it, so
    // the illustration reaches the top of the page and nothing is covered.
    // Exactly one screen, and no more. min-h-dvh with the content centred means
    // the whole pitch — headline, books, sub, buttons — is visible without
    // scrolling on any viewport tall enough to hold it, and the page below is
    // something you choose to scroll to rather than something you must.
    // The negative margin has to track the header's height: it pulls the section
    // up under a header that still holds its own space in the flow. Shrink the
    // header's padding without shrinking this by the same amount and the section
    // starts above the top of the page.
    //
    // pt is then the header's height *plus* the gap wanted under it, since the
    // section begins behind the nav rather than below it — pt-28 against a
    // ~4.5rem header leaves about 3rem of air, and pt-40 at sm leaves ~5.5rem.
    <section className="relative -mt-[4.75rem] flex min-h-dvh flex-col justify-center overflow-hidden px-5 pt-28 pb-12 sm:-mt-[5.25rem] sm:px-8 sm:pt-40">
      <Backdrop />

      {/* Headline above the fan: the words set the claim, the books show it. */}
      <div className="relative mx-auto max-w-6xl">
        {/* The figure is written here rather than counted. If it is ever wired
            to the real number, this is the only place that changes: a view over
            library_claims returning the count and nothing else is enough, since
            the table itself has to stay behind RLS. */}
        <p className="mb-6 text-center font-sans text-xl font-medium text-fg sm:mb-7 sm:text-2xl">
          {/* The figure carries the line, so it is set larger and in the
              display face — the same one the headline below uses, which keeps
              the two as one voice rather than a number borrowed from
              elsewhere. */}
          <span className="font-display text-3xl font-bold sm:text-4xl">
            1,000+
          </span>{" "}
          writers drafting here
        </p>

        <h1 className="mx-auto max-w-3xl text-center font-display text-[2.75rem] leading-[1.08] font-semibold tracking-tight text-fg sm:text-[3.875rem]">
          A place to write your
          <br />
          masterpiece.
        </h1>
      </div>

      {/* Outside the max-w wrapper on purpose: the arc runs the full width of
          the window, and the section's overflow-hidden trims the two books that
          overhang each edge — which is what makes it read as continuing past
          the screen rather than stopping neatly inside it. */}
      <div className="relative mt-8 sm:mt-10">
        <BookFan />
      </div>

      <div className="relative mx-auto -mt-2 max-w-6xl text-center sm:-mt-4">
        <p className="mx-auto max-w-2xl font-sans text-lg font-medium leading-relaxed text-fg sm:text-xl">
          Draft on real pages, and hand it off in the formats they ask for.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-full bg-fg px-7 py-3.5 font-sans
                       text-sm font-semibold text-surface outline-none
                       transition-opacity hover:opacity-85 focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Start writing free
          </Link>
          {/* The quiet second action the reference sets beside its pill —
              still a real one: Google is wired. */}
          <GoogleButton
            action={signInWithGoogle}
            next="/"
            label="Sign in with Google"
            className="flex items-center gap-2.5 px-3 py-3.5 font-sans text-base
                       font-semibold text-fg outline-none transition-colors
                       hover:text-accent focus-visible:ring-2
                       focus-visible:ring-accent/50"
          />
        </div>
      </div>
    </section>
  );
}


/** The faint ruled ground and wash the fan sits on. */
function Backdrop() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-line) 1px, transparent 1px), linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 55% at 50% 20%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 55% at 50% 20%, black, transparent)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[30rem] w-[min(60rem,95%)] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "linear-gradient(110deg, color-mix(in srgb, var(--color-accent) 22%, transparent), color-mix(in srgb, #a78bfa 26%, transparent))",
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Feature rows
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

/**
 * The heading block the three sections below share.
 *
 * A small pill, a centred headline, a line of sub-copy. Written once because
 * three sections use it, and a page whose headings drift in size and spacing
 * reads as three pages stapled together.
 */
function SectionHead({
  eyebrow,
  title,
  body,
}: {
  /** Omitted where the heading is doing the work on its own. */
  eyebrow?: string;
  title: ReactNode;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <p
          className="inline-flex items-center gap-2 rounded-full border border-line
                     bg-panel px-3.5 py-1.5 font-sans text-xs font-semibold text-muted"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-fg not-first:mt-5 sm:text-4xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-xl font-sans text-base leading-relaxed text-muted">
        {body}
      </p>
    </div>
  );
}

/**
 * The features, as a bento of cards that each show the thing they describe.
 *
 * This replaced four full-width alternating rows. Those gave every feature the
 * same enormous weight and took four screens to say four things; somebody
 * deciding whether to sign up wants to take them in at a glance and stop at
 * whichever one is theirs.
 *
 * The arrangement is four cards on a three-by-two grid: two small ones on the
 * top left, one tall down the right spanning both rows, one wide across the
 * bottom. Not a uniform grid — a grid of identical tiles has no reading order,
 * the eye is offered four equal things and settles on none. Three shapes give
 * it somewhere to start and somewhere to finish.
 *
 * Each figure is deliberately larger than the space it is given and is clipped
 * by the card's own edge. A widget drawn to fit inside its card reads as an
 * icon; one running off the bottom reads as a piece of a screen that carries
 * on past the frame, which is the whole point — these are the app, not
 * decoration about the app.
 *
 * Every figure is drawn from the app's own tokens rather than screenshotted,
 * for the reason landing-figures.tsx gives. They are illustrations and are
 * marked as such — decorative to assistive technology, with nothing clickable
 * inside them. That is not the no-dead-UI rule being bent: there is no control
 * here to be dead, and each one depicts something the app genuinely does.
 */
function Features() {
  return (
    <section
      id="features"
      className="border-t border-line px-5 py-20 sm:px-8 sm:py-24"
    >
      <SectionHead
        title={
          <>
            Everything a manuscript needs,
            <br className="hidden sm:block" /> and nothing it doesn&rsquo;t.
          </>
        }
        body="The parts of a writing app you actually use, built to the standard a shop checks — and quiet about everything else."
      />

      {/*
        A B C
        D D C

        Placed explicitly rather than left to auto-flow. The tall card is third
        in the source, and auto-placement would try to fit it in the gap under
        A — the row-span only lands where it is meant to once both the column
        and the row are named.
      */}
      <div className="mx-auto mt-14 grid max-w-6xl gap-5 lg:grid-cols-3 lg:grid-rows-2">
        <FeatureCard
          title="A page that behaves like a page"
          body="Real sheets at your trim size, with paragraphs that carry over the break."
          figure={<PageFigure />}
        />

        <FeatureCard
          title="A shelf, not a folder"
          body="Every book with its cover, its word count, and where you left off."
          figure={<ShelfFigure />}
        />

        {/* The tall one. A conversation is the only figure here that is taller
            than it is wide, so it is the one that earns the double row. */}
        <FeatureCard
          className="lg:col-start-3 lg:row-start-1 lg:row-span-2"
          title="An assistant that has read the chapter"
          body="Ask what isn't landing. Your chapter is sent only when you ask, and never to train anything."
          figure={<AssistantFigure fill tall />}
          inset
        />

        {/* The wide one, text beside the figure rather than above it: across
            two columns a stacked figure would be a letterbox. */}
        <FeatureCard
          className="lg:col-start-1 lg:row-start-2 lg:col-span-2"
          wide
          title="Hand it off in what they asked for"
          body="EPUB, DOCX, a print-ready PDF and Markdown — with the front matter generated for you."
          figure={<FormatFigure />}
        />
      </div>
    </section>
  );
}

/**
 * One card: a title, a couple of lines, and a figure that runs off the edge.
 *
 * The bleed is the whole look and it is done with negative margins against the
 * card's `overflow-hidden` rather than by sizing the figure to fit. Sized to
 * fit, every card would need its own height guess and they would disagree the
 * moment a paragraph wrapped differently; clipped, the card decides and the
 * figure simply continues past it.
 */
function FeatureCard({
  title,
  body,
  figure,
  wide,
  inset,
  className = "",
}: {
  title: string;
  body: string;
  figure: ReactNode;
  /** Figure beside the words instead of below them, for the two-column card. */
  wide?: boolean;
  /** Hold the figure off the left edge too, as the tall card wants. */
  inset?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`relative flex overflow-hidden rounded-3xl bg-panel p-6 sm:p-7
                  ${wide ? "flex-col sm:flex-row sm:items-center sm:gap-8" : "flex-col"}
                  ${className}`}
    >
      {/* The faint wash the reference cards carry, strongest at the top right.
          Pointer-events-none and behind everything: it is light, not a
          surface. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-bl
                   from-accent/8 via-transparent to-transparent"
      />

      <div className={`relative ${wide ? "sm:w-[45%] sm:shrink-0" : ""}`}>
        <h3 className="font-display text-lg font-semibold text-fg sm:text-xl">
          {title}
        </h3>
        {/* Two lines, and the copy above is written to fit in two — the clamp
            is the guarantee, not the mechanism. Relying on it alone would mean
            shipping sentences that end in an ellipsis at whatever width the
            third line appears, which is a worse card than a tall one. */}
        <p className="mt-2 line-clamp-2 font-sans text-sm leading-relaxed text-muted">
          {body}
        </p>
      </div>

      {/* Negative margins pull the figure past the card's padding on the edges
          it should run off. `mt-auto` pins it to the bottom, so cards of
          different text lengths still line their figures up. */}
      <div
        className={`relative ${
          wide
            ? "mt-6 -mr-6 -mb-6 sm:mt-0 sm:-mr-7 sm:-mb-7 sm:flex-1"
            : // mt-auto, not a fixed gap: the titles are one line on some cards
              // and two on others, and a fixed gap carries that difference down
              // into the figures, so one starts a line higher than its
              // neighbours. Pinned to the bottom of a stretched grid row they
              // all begin together whatever the text above them did. pt keeps a
              // floor under it for the narrow layout, where the cards are not
              // in a row and have no common height to align to.
              //
              // min-h-0 alongside flex-1 on the tall card, or the figure's own
              // contents set a floor and the card grows to fit rather than the
              // figure shrinking to the row.
              `mt-auto pt-6 -mb-10 ${
                inset ? "ml-4 sm:ml-6 lg:min-h-0 lg:flex-1" : ""
              }`
        }`}
      >
        {figure}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// In numbers
// ---------------------------------------------------------------------------

/**
 * Four figures, every one of them checkable.
 *
 * The pattern this is drawn from puts traction here — active users, teams
 * onboarded, hours saved. OpenChapter has no such numbers, and inventing them
 * is the one thing a landing page must not do: a made-up user count is a lie
 * told to the exact person deciding whether to trust you with a manuscript. So
 * these are facts about the product instead, each of which can be checked by
 * using it for ten minutes.
 */
const NUMBERS = [
  [
    "4",
    "Export formats",
    "EPUB, DOCX, a print-ready PDF and Markdown — with the front matter generated for you.",
  ],
  [
    "6",
    "Import formats",
    "DOCX, EPUB, Markdown, plain text and HTML — plus an audiobook, transcribed and split into chapters.",
  ],
  [
    "0",
    "EPUBCheck errors",
    "Verified against EPUBCheck 5.3 for EPUB 3.3 — warnings included — on a fully specified book and a bare one.",
  ],
  [
    "100%",
    "Written here first",
    "Every keystroke lands in this browser before anywhere else. Lose the connection and the book is still yours.",
  ],
] as const;

function Numbers() {
  return (
    <section
      id="numbers"
      className="border-t border-line bg-panel px-5 py-20 sm:px-8 sm:py-24"
    >
      <SectionHead
        eyebrow="In numbers"
        title="Why writers choose OpenChapter"
        body="Nothing here about how many people use it — only figures you can check yourself."
      />

      <div className="mx-auto mt-14 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {NUMBERS.map(([figure, label, note], i) => (
          <article
            key={label}
            // Every other card sits lower, so the row reads as a rhythm rather
            // than a table. Only from lg up, where there is a row to stagger.
            className={`flex flex-col rounded-3xl border border-line bg-surface p-6 ${
              i % 2 === 1 ? "lg:mt-8" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-display text-4xl font-bold tracking-tight text-fg">
                {figure}
              </span>
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center
                           rounded-full bg-accent/12"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5 text-accent"
                >
                  <path d="M6 14 14 6M8 6h6v6" />
                </svg>
              </span>
            </div>

            <h3 className="mt-6 font-sans text-sm font-semibold text-fg">{label}</h3>
            <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted">
              {note}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Getting started
// ---------------------------------------------------------------------------

const STEPS = [
  [
    "Start a book",
    "Name it, choose a trim size and set a word target. Or bring a manuscript you already have — it arrives split into chapters.",
  ],
  [
    "Write it",
    "Chapters down one side, the page down the middle. Nothing to set up, and nothing asking to be configured before the first sentence.",
  ],
  [
    "Hand it off",
    "Read the whole thing through at your trim size, then export the file your shop, agent or printer asked for.",
  ],
] as const;

function Steps() {
  return (
    <section id="start" className="border-t border-line px-5 py-20 sm:px-8 sm:py-24">
      <SectionHead
        eyebrow="Getting started"
        title="Blank page to finished file, in three"
        body="No import wizard to survive, and no template to choose before you can begin."
      />

      <div className="mx-auto mt-14 grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {/* The editor itself, drawn rather than screenshotted — the same
            reasoning as every other figure here. It answers "what does it
            actually look like", which the steps beside it can only describe. */}
        <LaptopMockup />

        <ol className="flex flex-col gap-4">
          {STEPS.map(([title, body], i) => (
            <li
              key={title}
              className="flex gap-4 rounded-2xl border border-line bg-panel p-5"
            >
              {/* The number carries the order, so the list needs no bullet and
                  no rule between items. */}
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
                           bg-accent font-sans text-sm font-bold text-white"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-fg">
                  {title}
                </h3>
                <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

function Faq() {
  return (
    <section id="questions" className="bg-panel px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl leading-tight font-semibold text-fg sm:text-4xl">
          The questions people actually ask.
        </h2>

        <dl className="mt-10 flex flex-col divide-y divide-line border-t border-line">
          {QUESTIONS.map(({ q, a }) => (
            <div key={q} className="py-6">
              <dt className="font-sans text-base font-semibold text-fg">{q}</dt>
              <dd className="mt-2 font-sans text-sm leading-relaxed text-muted">
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const QUESTIONS = [
  {
    q: "Is my writing used to train anything?",
    a: "No. The one feature that leaves your machine is the assistant, and it only sees the chapter you have open, only when you open the panel and ask it something. Close the panel and nothing is sent.",
  },
  {
    q: "Who owns what I write?",
    a: "You do, entirely. Nothing here takes a licence to your manuscript, and every format you can export in is one you can open somewhere else.",
  },
  {
    q: "Does it work without a connection?",
    a: "Yes. The app runs in your browser and keeps your books there, so a dropped connection does not stop you writing.",
  },
  {
    q: "Can I get my work out again?",
    a: "Any time, in EPUB, DOCX, PDF or Markdown. There is no export queue and no waiting — the file is built in your browser and saved straight to disk.",
  },
  {
    q: "What does it cost?",
    a: "Nothing while it is being built. There is no card to add and no trial running down.",
  },
];

function Closing() {
  return (
    <section className="border-t border-line px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl leading-tight font-semibold text-fg sm:text-4xl">
          Start the first chapter.
        </h2>
        <p className="mt-3 font-sans text-base leading-relaxed text-muted">
          An account keeps your shelf. The writing starts the moment you are in.
        </p>
        <Link
          href="/signup"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3
                     font-sans text-sm font-semibold text-white outline-none
                     transition-colors hover:bg-accent-strong focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          Create your account
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M4 10h11M11 6l4 4-4 4" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-panel px-5 py-12 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-3">
        <div>
          <span className="font-display text-lg font-semibold text-fg">
            Open<span style={{ color: "#3a86d4" }}>Chapter</span>
          </span>
          <p className="mt-2 max-w-xs font-sans text-sm leading-relaxed text-muted">
            A calm place to write your novel, chapter by chapter.
          </p>
        </div>

        <FooterColumn
          heading="The app"
          links={SECTIONS.map(([label, href]) => ({ label, href }))}
        />
        <FooterColumn
          heading="Your account"
          links={[
            { label: "Sign in", href: "/signin" },
            { label: "Create an account", href: "/signup" },
            { label: "Reset your password", href: "/forgot-password" },
          ]}
        />
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-line pt-6">
        <span className="font-sans text-xs text-muted">
          © {new Date().getFullYear()} OpenChapter
        </span>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="font-sans text-sm font-semibold text-fg">{heading}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map(({ label, href }) => (
          <li key={href}>
            <Link
              href={href}
              className="font-sans text-sm text-muted underline-offset-2 outline-none
                         transition-colors hover:text-fg hover:underline
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
