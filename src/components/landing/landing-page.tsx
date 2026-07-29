import Link from "next/link";
import type { ReactNode } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { GoogleButton } from "@/components/auth/auth-shell";
import { BookFan } from "./book-fan";
import {
  FormatFigure,
  PageFigure,
  ReadFigure,
  ShelfFigure,
} from "./landing-figures";

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
      <Rows />
      <Faq />
      <Closing />
      <Footer />
    </div>
  );
}

const SECTIONS = [
  ["Writing", "#writing"],
  ["Library", "#library"],
  ["Formats", "#formats"],
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

function Rows() {
  return (
    <div className="border-t border-line">
      <Row
        id="writing"
        eyebrow="Writing"
        title="A page that behaves like a page."
        body="Your manuscript sits on real sheets at the trim size you chose. Long paragraphs fill the page and carry over the break, just as a word processor handles them. What you see while drafting is what comes out the other end."
        figure={<PageFigure />}
      />
      <Row
        id="library"
        eyebrow="Library"
        title="A shelf, not a folder."
        body="Every book with its cover, its word count and where you left off. Chapters reorder by dragging, move to front or back matter, and take a bookmark for the scene you keep returning to."
        figure={<ShelfFigure />}
        flip
      />
      <Row
        id="formats"
        eyebrow="Formats"
        title="Hand it off in what they asked for."
        body="EPUB, DOCX, a print-ready PDF and Markdown, with a title page, copyright page and contents generated for you. Bring an existing manuscript in and it is split into chapters on the way."
        figure={<FormatFigure />}
      />
      <Row
        id="reading"
        eyebrow="Reading"
        title="Read it before anyone else has to."
        body="The whole manuscript on real pages at your trim size, or as a book you open and turn. It is not a preview of the export — it is the same typesetting, so the read-through and the file agree."
        figure={<ReadFigure />}
        flip
      />
    </div>
  );
}

function Row({
  id,
  eyebrow,
  title,
  body,
  figure,
  flip,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  figure: ReactNode;
  /** Puts the figure on the left, so the rows alternate down the page. */
  flip?: boolean;
}) {
  return (
    <section id={id} className="border-b border-line px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={flip ? "lg:order-2" : undefined}>
          {/* Set as a small heading rather than a spaced-out label: bigger,
              bolder, and in its own case. Uppercase with wide tracking reads as
              a category tag, which is a quieter job than this is doing. */}
          <p className="font-sans text-lg font-bold text-accent">{eyebrow}</p>
          <h2 className="mt-3 font-display text-3xl leading-tight font-semibold text-fg sm:text-4xl">
            {title}
          </h2>
          {/* Set exactly as the hero's sub-copy: same size, weight and
              full-strength ink, so the two read as one voice. */}
          <p className="mt-4 font-sans text-lg font-medium leading-relaxed text-fg sm:text-xl">
            {body}
          </p>
        </div>

        <div className={flip ? "lg:order-1" : undefined}>{figure}</div>
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
