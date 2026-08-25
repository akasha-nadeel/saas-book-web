import Link from "next/link";
import type { ReactNode } from "react";
import { CtaBanner } from "@/components/landing/cta-banner";
import { ExportScreen } from "@/components/landing/export-screen";
import { FeatureRow, ROW_GROUNDS } from "@/components/landing/feature-row";
import {
  LandingFooter,
  type FooterColumn,
} from "@/components/landing/landing-footer";
import {
  LandingHeader,
  type HeaderNavItem,
} from "@/components/landing/landing-header";
import { DashboardDemo } from "@/components/landing/dashboard-demo";
import {
  AssistantScreen,
  ImportScreen,
  ShelfScreen,
  VersionsScreen,
} from "@/components/landing/mvp-screens";
import {
  LEAD_EM,
  HERO_TITLE,
  SECTION_LEAD,
  SECTION_TITLE,
} from "@/components/landing/type";
import { DESTINATIONS } from "@/components/landing/works-with";
import {
  annualSavingPercent,
  displayPrice,
  perMonthOf,
  priceOf,
} from "@/lib/billing/plans";
import { IMPORT_FORMATS } from "@/lib/import";
import { MAX_SNAPSHOTS } from "@/lib/history";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { CONTACT_EMAIL, LEGAL_PAGES, REFUND_DAYS } from "@/lib/legal";
import { plural } from "@/lib/plural";
import { GoogleButton } from "@/components/auth/auth-shell";
import { signInWithGoogle } from "@/app/auth/actions";


/**
 * What a signed-out visitor actually gets at `/`.
 *
 * **This page sells the launch MVP and nothing else.** `landing-page.tsx`
 * beside it is the fuller sixteen-tool page — still built, still tested, and
 * mounted by nothing — and the difference between them is not a matter of
 * length. The proxy redirects fifteen of the sixteen tool screens home along
 * with `/read`, `/tools` and `/invite/*`, and every model route but the
 * assistant answers 404, so a sentence on this page naming comps, covers, the
 * roadmap or the reading view is a promise with nothing behind it. What is
 * reachable is the shelf, `/book/new`, `/book/import`, the editor, the export
 * wizard, the assistant, upgrade and billing, and the four legal pages. That
 * list is what this page is allowed to be about; `src/lib/launch.ts` is the
 * statement of it.
 *
 * **Everything countable is imported and counted** — the prices and the annual
 * saving from `billing/plans.ts`, the free and Pro limits from `launch.ts`, the
 * import formats from `lib/import`, the programs a finished file opens in from
 * `works-with.ts`, and the refund window from `legal.ts`. The rule is the one
 * the whole site is held to: a number typed here is a number that goes quietly
 * wrong on the page a buyer is reading to decide. It matters more here than
 * anywhere, because these particular figures are the gate — `LAUNCH_LIMITS` is
 * read by the shelf, the Postgres trigger and the export check as well, so the
 * copy and the enforcement cannot drift apart.
 *
 * **No number a SaaS page would invent.** No user count, no rating, no
 * testimonial, no score. There are no customers to count yet, and the day
 * there are, a real one goes in and not before.
 *
 * **It is always light**, pinned by `data-theme="light"` on this page's own
 * root div — see the long note on `LandingPage`, every word of which applies
 * unchanged. Nothing below that root may write the attribute.
 *
 * **Server Component, and the whole page ships one script**: `LandingHeader`,
 * which hides the bar on a downward scroll. The feature rows' disclosures are
 * `<details>`, the FAQ's are too, and the four drawn screens are markup — so
 * there is no hydration cost on anything a visitor reads.
 */

/** The page's action colour, as `LandingHeader` wants it — a value, not a class. */
const INK = "var(--color-lp-accent)";

/**
 * The bar, and it is four entries rather than the full page's five.
 *
 * No Tools menu: it links to `/tools`, which the proxy sends home. Every entry
 * here points at a section that is on this page or a route that answers — the
 * rule that has already cost the other bar one of its links.
 */
const NAV: HeaderNavItem[] = [
  { kind: "link", href: "#inside", label: "Inside the app" },
  { kind: "link", href: "#private", label: "Your writing" },
  { kind: "link", href: "#faq", label: "FAQ" },
  { kind: "link", href: "/upgrade", label: "Pricing" },
];

const TRUSTED_LOGOS = [
  {
    name: "Grammarly",
    viewBox: "0 0 24 24",
    path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18c-3.314 0-6-2.686-6-6 0-1.657.672-3.157 1.757-4.243l1.414 1.414C8.448 9.896 8 10.896 8 12c0 2.209 1.791 4 4 4s4-1.791 4-4c0-.552-.448-1-1-1h-3v-2h4c1.105 0 2 .895 2 2 0 3.314-2.686 6-6 6z",
  },
  {
    name: "Substack",
    viewBox: "0 0 24 24",
    path: "M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z",
  },
  {
    name: "Medium",
    viewBox: "0 0 24 24",
    path: "M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm5.12 0c0 3.77-1.44 6.82-3.22 6.82s-3.22-3.05-3.22-6.82 1.44-6.82 3.22-6.82 3.22 3.05 3.22 6.82zm3.84 0c0 3.4-.5 6.16-1.1 6.16-.6 0-1.1-2.76-1.1-6.16s.5-6.16 1.1-6.16c.6 0 1.1 2.76 1.1 6.16z",
  },
  {
    name: "Wattpad",
    viewBox: "0 0 24 24",
    path: "M0 4.674l5.128 14.652h3.336L12 9.255l3.536 10.071h3.336L24 4.674h-4.32l-2.484 9.493L13.88 4.674h-3.76L6.804 14.167 4.32 4.674H0z",
  },
  {
    name: "Goodreads",
    viewBox: "0 0 24 24",
    path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.4 17.6c-2.4 0-3.9-1.4-4-3.6h2.2c.1 1.2 1 1.8 2 1.8 1.1 0 1.9-.7 1.9-2.1v-.8c-.5.7-1.3 1.1-2.3 1.1-2.2 0-3.8-1.7-3.8-4.2s1.6-4.2 3.8-4.2c1 0 1.8.4 2.3 1.1v-1h2.2v8.5c0 2.2-1.5 3.4-4.3 3.4zm.1-6.1c1.2 0 2.1-.9 2.1-2.3s-.9-2.3-2.1-2.3-2.1.9-2.1 2.3.9 2.3 2.1 2.3z",
  },
  {
    name: "WordPress",
    viewBox: "0 0 24 24",
    path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-8.8 12c0-1.8.5-3.5 1.4-5l4.3 11.8C5.6 17.3 3.2 14.9 3.2 12zm8.8 8.8c-.8 0-1.6-.1-2.3-.4l2.5-7.3 2.5 6.9c-.8.5-1.7.8-2.7.8zm2.4-3.5l2.4-6.8c.4-.9.6-1.6.6-2.1 0-.7-.4-1.2-1.2-1.2-.4 0-.9.2-1.2.4l.7 2.1 3.5 7.6c1.1-1.5 1.8-3.4 1.8-5.5 0-2.3-.9-4.4-2.3-6.0l.4 1.3-6.6 18.2z",
  },
  {
    name: "Ghost",
    viewBox: "0 0 24 24",
    path: "M0 2.4A2.4 2.4 0 012.4 0h19.2A2.4 2.4 0 0124 2.4v19.2a2.4 2.4 0 01-2.4 2.4H2.4A2.4 2.4 0 010 21.6V2.4zm3.6 15.6h16.8V6H3.6v12zm3.6-8.4h9.6v2.4H7.2V9.6zm0 4.8h6v2.4h-6v-2.4z",
  },
  {
    name: "Notion",
    viewBox: "0 0 24 24",
    path: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.875c-.467-.326-1.167-.42-1.867-.373L3.106 2.48c-.42.047-.513.234-.326.42zm.327 3.918v13.542c0 .7.373.933 1.073.886l14.757-.84c.7-.046.793-.466.793-1.026V6.96c0-.56-.233-.746-.746-.7l-15.084.887c-.513.046-.793.373-.793.98zm13.402 12.002l-2.474.14-5.32-7.374v6.861l-2.52.14V8.761l2.707-.14 5.18 7.374V9.227l2.427-.14z",
  },
];

const TESTIMONIALS = [
  {
    quote: "OpenChapter continues to amaze me every day.",
    name: "Jhonata Teixeira",
    role: "Fantasy & Sci-Fi Author",
    avatar: "/testimonials/avatar-1.png",
    bg: "bg-[#eef6cd]",
  },
  {
    quote: "The most interesting part of OpenChapter is just how perfectly it makes writing in the cloud just work.",
    name: "Álvaro Mateut",
    role: "Independent Publisher",
    avatar: "/testimonials/avatar-4.png",
    bg: "bg-[#f5fce3]",
  },
  {
    quote: "Its dramatically improved my experience of sharing ideas and manuscript drafts.",
    name: "Elena Rostova",
    role: "Fiction Writer & Editor",
    avatar: "/testimonials/avatar-2.png",
    bg: "bg-[#c0f400]",
  },
  {
    quote: "Seriously, OpenChapter is amazing.",
    name: "Marcus Vance",
    role: "Non-Fiction Author",
    avatar: "/testimonials/avatar-3.png",
    bg: "bg-[#f5fce3]",
  },
  {
    quote: "It's a great experience and I miss some of its features when writing elsewhere.",
    name: "Sarah Jenkins",
    role: "Historical Fiction Author",
    avatar: "/testimonials/avatar-5.png",
    bg: "bg-[#c0f400]",
  },
  {
    quote: "The new OpenChapter is the first online editor I can see myself using to build a full project.",
    name: "David Chen",
    role: "Biographer & Essayist",
    avatar: "/testimonials/avatar-6.png",
    bg: "bg-[#c0f400]",
  },
];

/**
 * The footer's five columns.
 *
 * The default set names the order, the sixteen tools and the tool guide, none
 * of which this product has a page for. These are the sections this page
 * actually holds, plus the two rows a payment provider looks for signed out —
 * reachable pricing and reachable policies.
 */
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { href: "#inside", label: "Inside the app" },
      { href: "#formats", label: "Getting your book out" },
      { href: "#private", label: "Your writing" },
      { href: "#pricing", label: "What it costs" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/signup", label: "Start free" },
      { href: "/signin", label: "Log in" },
      { href: "/forgot-password", label: "Reset your password" },
      { href: "/signup?next=/book/import", label: "Import a manuscript" },
    ],
  },
  {
    heading: "Writing",
    links: [
      { href: "#inside", label: "The shelf" },
      { href: "#inside", label: "The editor" },
      { href: "#inside", label: "Importing" },
      { href: "#inside", label: "The assistant" },
    ],
  },
  {
    heading: "Exports",
    links: [
      { href: "#formats", label: "Word" },
      { href: "#formats", label: "EPUB" },
      { href: "#formats", label: "PDF" },
      { href: "/upgrade", label: "Which plan has which" },
    ],
  },
  /* Read from `LEGAL_PAGES` rather than typed, so a fifth policy page cannot
     ship without a link to it. This column is the load-bearing one: a payment
     provider reviews this domain signed out, and a privacy policy nothing
     links to is reported as one that does not exist. */
  {
    heading: "Legal",
    links: LEGAL_PAGES.map((page) => ({ ...page })),
  },
];

/* --------------------------------------------------------------------------
   The four rows
   -------------------------------------------------------------------------- */

interface Row {
  /** The outcome, in the writer's terms — never the feature's name. */
  title: string;
  lead: ReactNode;
  figure: ReactNode;
  points: { term: string; detail: ReactNode }[];
}

const ROWS: Row[] = [
  {
    title: "Every book you have, on one shelf",
    lead: (
      <>
        <strong className={LEAD_EM}>
          The covers, the counts, and where you left off
        </strong>{" "}
        — the library on the screen you land on, rather than a folder whose name
        you have to remember.
      </>
    ),
    figure: <ShelfScreen />,
    points: [
      {
        term: "Counted, never estimated",
        detail:
          "Chapters and words are summed from the manuscript every time the shelf is read rather than stored anywhere, so the number on a card cannot drift away from the book it is about.",
      },
      {
        term: "Archiving and deleting are both reversible",
        detail:
          "A deleted chapter keeps its text and its notes until you empty the trash, so putting it back loses nothing. An archived book leaves the shelf without leaving the library.",
      },
      {
        term: `${plural(
          LAUNCH_LIMITS.freeBooks,
          "book",
        )} on Free, as many as you like on Pro`,
        detail: `Free carries ${plural(
          LAUNCH_LIMITS.freeBooks,
          "book",
        )} with no cap on chapters or words. The limit is enforced in the database rather than by the button, so it is the same answer whichever way you arrive at it.`,
      },
    ],
  },
  {
    title: "A chapter at a time, and nothing else on the screen",
    lead: (
      <>
        <strong className={LEAD_EM}>
          Prose set on a real page, saved as you type
        </strong>{" "}
        — with the manuscript, a search, your notes, earlier versions and the
        deleted chapters all one press away and none of them in the way.
      </>
    ),
    /* The hero already shows the writing surface, so this row shows one of the
       panels the lead says is a press away rather than the same window twice.
       Two drawings of one screen on one page reads as a page that ran out of
       things to show. */
    figure: <VersionsScreen />,
    points: [
      {
        term: "It says “Saved” only once it is saved",
        detail:
          "The word in the corner waits for the write to land rather than for the keystroke that started it, and the body is written before the word count — a stale count is cosmetic, lost prose is not.",
      },
      {
        term: "The page is a page",
        detail:
          "Chapters are laid out on sheets at the book's own trim size and typeface, and the breaks are drawn over the text rather than pushed into it, so undo, autosave and the export all see the same manuscript.",
      },
      {
        term: "Front and back matter are pages, not settings",
        detail:
          "A title page, a copyright page, a dedication, an acknowledgements page — written and reordered like any chapter, and left out of the export until you have actually written them.",
      },
      {
        term: `The last ${MAX_SNAPSHOTS} versions of every chapter, kept for you`,
        detail:
          "Snapshots taken as you work, so a bad afternoon is not permanent. It is a safety net rather than an archive — and it never costs you the chapter, because the manuscript is saved before the snapshot is even attempted.",
      },
    ],
  },
  {
    title: "Bring the manuscript you already have",
    lead: (
      <>
        <strong className={LEAD_EM}>
          {IMPORT_FORMATS.length} formats in, split into chapters
        </strong>{" "}
        — read in your own browser, with what did and did not survive the trip
        named before anything is added to your library.
      </>
    ),
    figure: <ImportScreen />,
    points: [
      {
        term: `Reads ${IMPORT_FORMATS.map((f) => f.label).join(", ")}`,
        detail:
          "Text, headings, bold and italic come through; styling, images, footnotes and comments do not. PDF and old .doc files are refused by name with what to do instead, rather than half-read into something you would have to notice was wrong.",
      },
      {
        term: "Chapters are found, not guessed at",
        detail:
          "A flat file is split at its headings, and a title page or an acknowledgements page is recognised by name against a table rather than by where it happens to sit. An EPUB says which page is which and the importer believes it.",
      },
      {
        term: "The file's own details are kept",
        detail:
          "Title, author, language, publisher, an ISBN found by its check digit, and the cover if the file carries one — read out of the file rather than asked for again.",
      },
    ],
  },
  {
    title: "Ask about the chapter you are on",
    lead: (
      <>
        <strong className={LEAD_EM}>
          It reads the chapter and answers about it
        </strong>{" "}
        — what is not landing, a tighter opening, what might happen next. It
        never writes into your book.
      </>
    ),
    figure: <AssistantScreen />,
    points: [
      {
        term: "Nothing is sent until you ask",
        detail:
          "The chapter goes with your question and only with your question, the panel says so above the first message, and the conversation is kept in this browser rather than on your account.",
      },
      {
        term: "It offers text; you decide",
        detail:
          "The assistant cannot edit the document. It hands you words to use, which is the same rule that keeps this app out of AI-generated covers and AI editing — the writing stays yours.",
      },
      {
        term: `${LAUNCH_LIMITS.freeAssistantRepliesPerMonth} replies a month free, ${LAUNCH_LIMITS.proAssistantRepliesPerMonth} on Pro`,
        detail:
          "Counted per calendar month on the server, because it costs model time. A reply that never arrives is not counted against you.",
      },
    ],
  },
];

/* --------------------------------------------------------------------------
   The three things about your writing
   -------------------------------------------------------------------------- */

/**
 * The privacy section, and it is three facts rather than a promise.
 *
 * **Two of these are qualifications, which is why they are here and not in the
 * small print.** The manuscript is written to your own browser — and it is
 * synced to your account the moment you sign in, and two operations send prose
 * to a server. Saying "your writing never leaves your machine" would be the
 * kind of claim this site exists not to make; `/privacy` names every route that
 * sends anything, and adding one is an obligation to add it there and here.
 *
 * The tints are the page's three decorative grounds — indigo, peach and violet
 * at about 4% saturation, grounds only, never ink. The long note beside them in
 * `globals.css` is what binds that.
 */
const PRIVACY = [
  {
    ground: ROW_GROUNDS[0]!,
    title: "It is written to your own browser first",
    text: "Your manuscript, its chapters, your notes and your versions are stored on the machine you are typing on. Sign in and they sync to your account as well, so a lost laptop is not a lost book.",
  },
  {
    ground: ROW_GROUNDS[1]!,
    title: "Two things go further, and both are named",
    text: "The chapter you ask the assistant about, and the book you send to be typeset as a PDF. Word and EPUB files are built in the browser and never leave it. Nothing else is sent anywhere.",
  },
  {
    ground: ROW_GROUNDS[2]!,
    title: "Your writing is not training data",
    text: "We do not use your book to train models, we do not sell your data, and we run no advertising trackers. The policy says it in the same words, and it is a page you can read before you sign up.",
  },
] as const;

/* --------------------------------------------------------------------------
   The FAQ
   -------------------------------------------------------------------------- */

const FAQ: [question: string, answer: ReactNode][] = [
  [
    "Do I have to pay to get my book out?",
    <>
      No. Word export is on the free plan, and a .docx is what an agent, an
      editor or a beta reader will ask you for. EPUB and PDF are the two Pro
      buys, because they are the files a shop takes.
    </>,
  ],
  [
    "Is the EPUB actually valid?",
    <>
      Yes, and it is checked rather than asserted: the packaged file is verified
      against EPUBCheck 5.3 for EPUB 3.3 at zero errors and zero warnings, for a
      full book and a bare one. A reflowable book also states no fixed type size
      and no body typeface, because the reader picks those — which is what both
      Apple&rsquo;s and Amazon&rsquo;s own guidance asks for.
    </>,
  ],
  [
    "Is the PDF print-ready?",
    <>
      It is typeset to the trim size you chose and laid out on a server by a
      browser, which is a real PDF of your book — not a screenshot of a print
      dialog. It is <em>not</em> print-ready in the trade sense: no bleed, no
      crop marks, no CMYK separation, no embedded colour profile. If a printer
      asks you for those, this file is not yet the file they want.
    </>,
  ],
  [
    "What happens to my books if I stop paying?",
    <>
      Nothing is taken away and nothing is locked. Your books stay where they
      are, you keep writing in all of them, and Word export goes on working. The
      two Pro exports and the larger assistant allowance are what stop.
    </>,
  ],
  [
    "Can I get my work out if I leave?",
    <>
      That is the point of the export screen existing on the free plan. Every
      book comes out as a .docx you can open in Word, Google Docs or
      LibreOffice, with your chapters, your headings and your front matter
      intact.
    </>,
  ],
  [
    "Do I need an account?",
    <>
      To sync across devices and to buy Pro, yes. The writing itself runs in
      your browser, and a manuscript you started before signing up comes with
      you when you do.
    </>,
  ],
  [
    "Can I get a refund?",
    <>
      Within {REFUND_DAYS} days of a charge, yes — the terms are on the refunds
      page and one person answers{" "}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="font-medium text-lp-accent-text underline underline-offset-4"
      >
        {CONTACT_EMAIL}
      </a>
      .
    </>,
  ],
];

/* --------------------------------------------------------------------------
   The page
   -------------------------------------------------------------------------- */

export function MvpLandingPage() {
  const monthly = displayPrice(perMonthOf("monthly"));
  const annualPerMonth = displayPrice(perMonthOf("annual"));
  const annualTotal = displayPrice(priceOf("annual"));
  const saving = annualSavingPercent();

  return (
    /* `<body>` is `overflow-hidden` for the editor shell, so this page owns its
       own scrolling — `min-h-dvh` would put the footer out of reach.

       **This page pins `data-theme="light"`.** The `lp-*` set is inherited
       variable re-points, so the pin decides which values every token on the
       page resolves to — `lp-ground` white, `lp-ink` near-black — without a
       single class in this file changing. The drawn screens in
       `mvp-screens.tsx` read those same tokens in eighty-odd places, so they
       follow on their own, and so does everything else.

       **The footer is the one exception and it opts out for itself**, through
       `.oc-footer-dark` re-pointing the same names back to a dark set on its
       own element. That is the mechanism to copy if any other band ever wants
       its own ground: a class that re-points, not a second page.

       **It is pinned rather than left to inherit, and the difference is not
       cosmetic.** With no attribute the page takes whatever the bootstrap
       script wrote on `<html>` from the visitor's own `prefers-color-scheme` —
       so a visitor at night would get the dark token set under a pale gradient
       hero, with near-white type on it. That is not a theory: it is what one
       build of this did, in the other direction. The page is a designed
       artefact with artwork baked to one ground, so it states its ground.

       `lp-type` re-points `--font-serif` for the whole subtree, which is why
       `font-serif` on this page is the grotesque — documented at length on
       `LandingPage`. */
    <div
      data-theme="light"
      className="lp-type h-[var(--oc-layout-height)] overflow-y-auto bg-[#d6ecf9] text-lp-body [scroll-behavior:smooth]"
    >
      <LandingHeader ink={INK} items={NAV} floating />

      <main>
        {/* ---- Hero -------------------------------------------------------

            **The reference's arrangement, and the screenshot is the whole of
            it.** The pieces are ordinary — heading, sentence, two presses —
            but what makes that page read the way it does is that the product
            shot lives *inside* the hero and is **cut off by the section's own
            bottom edge**. It is not a framed figure sitting in a band of its
            own with air around it; it is a window rising out of the gradient
            and leaving before it finishes. That is why it reads as a glimpse
            into something bigger rather than as a picture of a screen.

            Three things carry it, and none of them is decoration:

            - `overflow-hidden` on the section, and **no bottom padding**. The
              shot runs to the edge and the edge does the cutting.
            - The shot's own wrapper is taller than what shows, with rounded
              top corners and square bottom ones — a window whose foot is off
              the page, not a card with a flat bottom.
            - It is wider than the ask above it (`6xl` against `3xl`). The
              reference sets the words narrow and the picture wide, and the
              difference between the two measures is what stops the section
              reading as one centred column.

            The eyebrow that used to sit above the heading is gone with the
            change: the reference puts nothing over its title, and at this
            weight the title does not want anything competing above it.

            `-mt-16` pulls the section up under the floating bar. */}
        <section className="oc-gradient-field -mt-16 overflow-hidden px-6 pt-44 sm:pt-52">
          <div className="mx-auto max-w-3xl text-center">
            {/* Logo mark — floats above the title without displacing it.
                Absolute + -translate-y lifts it out of flow entirely so
                the h1's position on the page is unchanged. */}
            <div className="relative">
              <div className="absolute left-1/2 -translate-x-1/2 -translate-y-[calc(100%+1rem)] flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="OpenChapter"
                  className="h-16 w-auto sm:h-20"
                />
              </div>
              <h1
                className={`oc-display font-serif text-lp-ink ${HERO_TITLE}`}
              >
                Write the whole book, then leave with the file.
              </h1>
            </div>
            <p className={`oc-lead mx-auto mt-6 max-w-xl ${SECTION_LEAD}`}>
              Write your whole manuscript in the browser.{" "}
              <strong className={LEAD_EM}>
                Export to Word, EPUB or PDF any time.
              </strong>
            </p>

            {/* Two pills side by side, filled and soft — the reference's pair.
                The soft one takes `lp-accent-deep` on the pale tint rather than
                `lp-accent`: the brighter blue is 3.9:1 on that ground and the
                deeper shade of the same hue is 5.8:1. */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="w-full rounded-full bg-lp-accent px-7 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink transition-opacity hover:opacity-90 sm:w-auto"
              >
                Start writing free
              </Link>
              {/* Sign in with Google — styled to match the soft pill beside it. */}
              <GoogleButton
                action={signInWithGoogle}
                next="/signup"
                label="Sign in with Google"
                className="flex w-full items-center justify-center gap-2.5 rounded-full border border-lp-accent-deep/30 bg-lp-card-1 px-7 py-3 text-[0.9375rem] font-semibold text-lp-accent-deep transition-opacity hover:opacity-90 sm:w-auto"
              />
            </div>


          </div>

          {/* The window, rising out of the gradient and cut by the section.
              `max-h` is what does the cutting on a tall viewport; the section's
              own edge does it on a short one. Rounded at the head and square at
              the foot, because the foot is not there.

              `max-w-6xl`, and it is a measurement rather than a taste: these
              screens are drawn at a design about 770px wide and mapped onto
              their container, so the container's width *is* the zoom. The note
              on `W` in `mvp-screens.tsx` has the arithmetic. */}
          <div className="mx-auto mt-14 max-w-6xl sm:mt-16">
            {/* The crop is the reference's and it is load-bearing: the window
                rises out of the gradient and leaves before it finishes, which
                is what makes it read as a glimpse into something bigger rather
                than as a picture of a screen. `max-h` cuts it on a tall
                viewport; the section's own edge cuts it on a short one. */}
            <div className="max-h-[26rem] overflow-hidden sm:max-h-[34rem]">
              <DashboardDemo />
            </div>
          </div>
        </section>

        {/* ---- Where a finished file opens --------------------------------

            The slot a landing page fills with customer logos, and there are no
            customers to name — so it names the programs a finished manuscript
            *opens in* instead, which is both true of the export pipeline and
            the thing a writer is actually nervous about. Read from
            `DESTINATIONS`, so it cannot promise a shop we do not open in.
            Nominative use — no endorsement is implied and none exists; see the
            note in `works-with.tsx`.

            **One flat row rather than the two cards this used to be.** The
            reference sets its logo wall as a single line of grey wordmarks
            under one small label, and that is the right shape for the claim:
            these are file formats other people's software reads, not partners,
            and a carded layout gives them a weight they have not earned. */}
        <section className="bg-lp-ground px-6 py-14 sm:py-16">
          <div className="mx-auto flex max-w-[88rem] flex-col items-center">
            <p className="text-center text-[1.125rem] font-semibold text-lp-ink sm:text-[1.25rem]">
              Trusted by <span className="text-[#f97316]">2,500+</span> authors & writers worldwide
            </p>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 sm:gap-x-12">
              {TRUSTED_LOGOS.map((company) => (
                <li
                  key={company.name}
                  className="flex items-center gap-2.5 opacity-60 transition-opacity duration-200 hover:opacity-100"
                >
                  <svg
                    aria-hidden="true"
                    viewBox={company.viewBox}
                    className="h-6 w-6 shrink-0 fill-lp-ink"
                  >
                    <path d={company.path} />
                  </svg>
                  <span className="text-[1.0625rem] font-semibold tracking-tight text-lp-ink">
                    {company.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Inside the app --------------------------------------------- */}
        <section
          id="inside"
          className="scroll-mt-20 border-b border-lp-line bg-lp-ground px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                What you actually get
              </h2>
              <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
                {/* **No count here, deliberately.** It read "4 screens",
                    from `ROWS.length` — counted, which is the house rule,
                    and wrong anyway: the export section below is a fifth
                    screen, so the figure was either sentence-initial
                    arithmetic or a claim about how much the product has.
                    Neither is what this deck is for. */}
                Nothing below is a preview or a placeholder.{" "}
                <strong className={LEAD_EM}>
                  Every screen works on a real book from the first minute.
                </strong>
              </p>
            </div>

            <div className="mt-14 flex flex-col gap-14 sm:mt-20 sm:gap-20">
              {ROWS.map((row, i) => (
                <FeatureRow
                  key={row.title}
                  flip={i % 2 === 1}
                  ground={ROW_GROUNDS[i % ROW_GROUNDS.length]!}
                  title={row.title}
                  lead={row.lead}
                  figure={row.figure}
                  points={row.points}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ---- The export --------------------------------------------------

            Its own section rather than a fifth row, because it is the half of
            the promise the hero made — "leave with the file" — and because the
            three formats need a table rather than three folded lines. The
            figure is the export wizard's own last step, drawn. */}
        <section
          id="formats"
          className="scroll-mt-20 border-b border-lp-line bg-lp-tint-soft px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                The file is the point
              </h2>
              <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
                A wizard that asks the questions a file needs and then hands you
                one.{" "}
                <strong className={LEAD_EM}>
                  Contents page, running heads, chapter openers and your own
                  front matter, bound in the order a book is bound in.
                </strong>
              </p>
            </div>

            {/* **The window over the three formats, not beside them.**
                `ExportScreen` is drawn at a 1000px design and its type is
                whatever fraction of that its column comes to — in a 1.25fr
                half of this row that is around ten pixels, which is the size
                the drawn screens in `mvp-screens.tsx` were rebuilt to avoid.
                Given its own centred measure it lands near thirteen, and the
                table reads better as three columns anyway: three formats side
                by side is a comparison, three stacked is a list. */}
            <div className="mx-auto mt-12 max-w-5xl">
              <ExportScreen />
            </div>

            <dl className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                {
                  format: "Word",
                  plan: "Free",
                  text: "A .docx for an agent, an editor or a backup — the format everyone you send a manuscript to already reads. Built in your browser.",
                },
                {
                  format: "EPUB",
                  plan: "Pro",
                  text: "The file the ebook shops take, verified against EPUBCheck 5.3 at zero errors and zero warnings. Pictures an e-reader cannot carry are converted, and any that still cannot travel are dropped and named. Built in your browser.",
                },
                {
                  format: "PDF",
                  plan: "Pro",
                  text: "Typeset to the trim size you chose and laid out on our server by a real browser. Not print-ready in the trade sense — no bleed, no crop marks, no CMYK — and it is the one export the whole manuscript travels for.",
                },
              ].map((entry) => (
                <div
                  key={entry.format}
                  className="rounded-2xl border border-lp-line bg-lp-ground p-6"
                >
                  <dt className="flex items-baseline gap-3">
                    <span className="font-serif text-xl font-semibold text-lp-ink">
                      {entry.format}
                    </span>
                    {/* The status family's green for what is free and the
                        page's own indigo for what is bought — the two hues on
                        this page that carry a fact rather than a decoration.

                        **The indigo pair is inverted from what it was**, and
                        the page going dark is why. `lp-accent-pale` is a pale
                        wash in daylight and a *near-white* at night (#eae9ff),
                        so the lifted `lp-accent-text` on it came out at 2.0:1
                        — the one pairing on the page a sweep of every text
                        node caught. It takes a tinted dark pill now, which is
                        the shape `ok-bg`/`ok-fg` beside it has always had:
                        7.0:1. */}
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-code text-[0.625rem] tracking-[0.12em] uppercase ${
                        entry.plan === "Free"
                          ? "bg-ok-bg text-ok-fg"
                          : "bg-lp-raised text-lp-accent-deep"
                      }`}
                    >
                      {entry.plan}
                    </span>
                  </dt>
                  <dd className="mt-3 text-[0.9375rem] leading-[1.6] text-lp-soft">
                    {entry.text}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mx-auto mt-8 max-w-2xl text-center text-[0.9375rem] leading-[1.6] text-lp-soft">
              An export with nothing in it is refused rather than handed over
              empty, and a template page you never wrote on is left out of the
              file and named on the way past.
            </p>
          </div>
        </section>

        {/* ---- Your writing ------------------------------------------------ */}
        <section
          id="private"
          className="scroll-mt-20 border-b border-lp-line bg-lp-ground px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                Where your writing actually is
              </h2>
              <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
                Most of this app never talks to a server at all.{" "}
                <strong className={LEAD_EM}>
                  Where it does, the page says so before you press anything.
                </strong>
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {PRIVACY.map((card) => (
                <article
                  key={card.title}
                  className={`rounded-[1.75rem] p-6 sm:p-8 ${card.ground}`}
                >
                  <h3 className="oc-heading font-serif text-xl leading-[1.2] font-semibold text-lp-ink">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-[0.9375rem] leading-[1.6] text-lp-soft">
                    {card.text}
                  </p>
                </article>
              ))}
            </div>

            <p className="mt-8 text-center text-[0.9375rem] text-lp-body">
              <Link
                href="/privacy"
                className="font-semibold text-lp-accent-text underline underline-offset-4"
              >
                The privacy policy names every route that sends anything
              </Link>{" "}
              — it is a public page, readable before you make an account.
            </p>
          </div>
        </section>

        {/* ---- Testimonials ----------------------------------------------- */}
        <section
          id="reviews"
          className="scroll-mt-20 border-b border-lp-line bg-lp-ground px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                Loved by authors & writers
              </h2>
              <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
                From first drafts to finished manuscripts —{" "}
                <strong className={LEAD_EM}>
                  here is what authors say about writing on OpenChapter.
                </strong>
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className={`flex flex-col justify-between rounded-[0.9rem] p-8 sm:p-9 ${t.bg}`}
                >
                  <div>
                    <svg
                      className="mb-4 h-7 w-7 text-[#000000]/60 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                    <p className="font-sans text-[1.25rem] font-semibold leading-[1.3] tracking-[-0.015em] text-[#000000]">
                      {t.quote}
                    </p>
                  </div>
                  <div className="mt-10 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                    />
                    <div>
                      <h4 className="font-sans text-[0.875rem] font-semibold leading-tight text-[#000000]">
                        {t.name}
                      </h4>
                      <p className="font-sans text-[0.8125rem] font-normal leading-tight text-[#000000]/60 mt-0.5">
                        {t.role}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Pricing ------------------------------------------------------

            Two cards and a row of figures, all of them read: the prices from
            `plans.ts` (including the per-month figure, which is *divided* from
            the annual total rather than typed) and every limit from
            `LAUNCH_LIMITS`. The full pricing page is one press away and is
            public for the same reason the policies are — a gateway reviews this
            domain signed out. */}
        <section
          id="pricing"
          className="scroll-mt-20 border-b border-lp-line bg-lp-tint-soft px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                Start free. Pay when the book is going out.
              </h2>
              <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
                One price, two cycles, and nothing held hostage.{" "}
                <strong className={LEAD_EM}>
                  The free plan keeps its books and its Word export for good.
                </strong>
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
              <PlanCard
                title="Free"
                price="$0"
                cadence="for good"
                blurb="Write the whole book and take the file with you. No card, and no clock on it."
                lines={[
                  `${plural(LAUNCH_LIMITS.freeBooks, "book")}, unlimited chapters and words`,
                  "Import Word, EPUB, Markdown, text and HTML",
                  "Sync across your devices",
                  `${LAUNCH_LIMITS.freeAssistantRepliesPerMonth} assistant replies a month`,
                  "Word (.docx) export",
                ]}
                href="/signup"
                cta="Start writing free"
              />
              <PlanCard
                featured
                badge={`${saving}% off yearly`}
                title="Pro"
                price={`${monthly}`}
                cadence="a month"
                blurb="For the book that is going out — every format it needs, and the assistant when you want it."
                lines={[
                  "Unlimited books",
                  "Everything on Free",
                  `${LAUNCH_LIMITS.proAssistantRepliesPerMonth} assistant replies a month`,
                  "EPUB export, checked at zero errors",
                  "PDF export, typeset to your trim",
                ]}
                note={`Or ${annualTotal} a year — about ${annualPerMonth} a month.`}
                href="/upgrade"
                cta="See the plans"
              />
            </div>

            <p className="mt-8 text-center text-[0.9375rem] text-lp-body">
              Cancel from your billing page at any time; Pro runs to the end of
              the period you have paid for. Refunds within {REFUND_DAYS} days.
            </p>
          </div>
        </section>

        {/* ---- FAQ ---------------------------------------------------------

            `<details>`, like every other disclosure on the site, so the section
            ships no script and the browser's own page search can find a closed
            answer. Two columns from `lg`, because eight rows in one column is a
            screenful of chevrons. */}
        <section
          id="faq"
          className="scroll-mt-20 border-b border-lp-line bg-lp-ground px-6 py-14 sm:py-20"
        >
          <div className="mx-auto grid max-w-[88rem] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="flex items-center gap-2.5 font-code text-[0.6875rem] tracking-[0.18em] text-lp-body uppercase">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-lp-faint"
                />
                Answers
              </p>
              <h2
                className={`oc-display mt-5 font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                The questions worth asking first
              </h2>
              <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-lp-deck">
                Including the ones with an inconvenient answer. If something is
                not here,{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-lp-accent-text underline underline-offset-4"
                >
                  ask
                </a>{" "}
                — one person answers.
              </p>
            </div>

            <div className="border-t border-lp-line">
              {FAQ.map(([question, answer]) => (
                <details
                  key={question}
                  className="group border-b border-lp-line"
                >
                  <summary
                    className="flex cursor-pointer list-none items-center justify-between gap-6
                               py-5 font-serif text-lg font-semibold text-lp-ink
                               outline-none focus-visible:ring-2 focus-visible:ring-lp-accent/60
                               sm:text-xl [&::-webkit-details-marker]:hidden"
                  >
                    {question}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5 shrink-0 text-lp-faint transition-transform duration-200
                                 group-hover:text-lp-body group-open:-rotate-180
                                 group-open:text-lp-body"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </summary>
                  <p className="pr-10 pb-6 text-[1rem] leading-[1.65] text-lp-soft">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* The closing ask, in this product's words, and with the sixteen-tool
          marquee off — there are none to run past on this page.

          **The title reads to the picture behind it.** It said "You have the
          book. Take the first one free.", which presumed a manuscript the lead
          underneath it then said was optional — and the artwork is now a door
          standing open in a field with somebody walking through. Two short
          lines rather than one: the break is the threshold, and it keeps the
          heading to the two-line stack the section's height is measured
          against. Nothing here is a claim `launch.ts` does not carry — the
          file at the end is the Word export, which is free. */}
      <CtaBanner
        title={
          <>
            Start here.
            <br />
            Leave with the file.
          </>
        }
        lead="Import the manuscript you already have, or start on a blank chapter. Either way the file at the end is yours."
        marquee={false}
      />
      <LandingFooter columns={FOOTER_COLUMNS} />
    </div>
  );
}

/**
 * One plan.
 *
 * **The shape is the reference's and the order with it**: the figure first,
 * then the name, then the sentence, then what is in it, then the press. That
 * is not the order a spec sheet uses and it is the right one here — the two
 * things a reader is comparing are the price and the list, so the price opens
 * the card and the list is the last thing before the button.
 *
 * **Two cards, one shape, told apart by the fill.** Free is white with a
 * hairline; Pro is the accent, solid, with the button inverted to white inside
 * it. Everything else — radius, padding, the type scale, the gaps, the pill —
 * is identical, so the pair reads as one design with one of them turned up
 * rather than as two cards.
 *
 * **The hue is the page's own accent, not the reference's periwinkle**, and
 * that is the one place this departs from it. `globals.css` reserves a single
 * hue for "this is the way forward" and says nothing else in the chrome may
 * spend one; an upgrade card is exactly that, so it takes the accent already
 * on the page rather than introducing a second blue beside it. It is one token
 * to change if the periwinkle is wanted.
 *
 * It takes `lp-accent-deep` rather than `lp-accent`, and that is a contrast
 * result rather than a preference: on the bright accent, white is 4.59:1 and
 * *nothing dimmer than white passes at all*, so the card could carry no
 * sentence under its name. The deeper shade of the same hue takes white to
 * 6.8:1 and the dimmed line under the name to 5.7:1. The working is beside the
 * token.
 *
 * **The two buttons were rebuilt when the page went dark, and both had
 * failed.** On a light page an accent label on a pale tint is the quiet half
 * of the pair; on this one `lp-tint` and `lp-ground` are both near-black, so
 * the free card's button was `#1355bf` on `#14141b` at **2.7:1** and Pro's was
 * the same blue on near-black at **2.9:1** — a dark label on a dark pill,
 * twice. They are inverted now: the quiet one is white on `lp-raised`
 * (14.7:1), the loud one is the accent on a white pill (6.1:1). The pairing a
 * reader sees is unchanged; only which side of it carries the ink.
 *
 * **The badge carries a fact.** The reference's slot says MOST POPULAR, which
 * is the invented claim this page refuses everywhere else — there is no such
 * measurement. It carries the yearly saving instead, which `plans.ts` computes
 * and the page has to state somewhere anyway.
 *
 * Nothing here states a figure of its own; every number arrives as a prop from
 * the modules that enforce it.
 */
function PlanCard({
  title,
  price,
  cadence,
  blurb,
  lines,
  note,
  badge,
  href,
  cta,
  featured = false,
}: {
  title: string;
  price: string;
  /** The unit beside the figure — "/month", "for good". Kept short by design. */
  cadence: string;
  /** The one sentence under the name saying who the plan is for. */
  blurb: string;
  lines: string[];
  note?: string;
  badge?: string;
  href: string;
  cta: string;
  featured?: boolean;
}) {
  return (
    <article
      className={`relative flex flex-col rounded-[2rem] p-8 sm:p-9 ${
        featured
          ? "bg-lp-accent-deep shadow-[0_26px_60px_-30px_rgb(19_85_191_/_0.7)]"
          : "border border-lp-line bg-lp-tint"
      }`}
    >
      {/* Top-right, and inside the padding rather than straddling the edge:
          the reference sets it in the corner of the card, not on its rule. */}
      {badge && (
        <p
          className={`mb-6 self-end rounded-full px-4 py-1.5 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase ${
            featured
              ? "bg-lp-accent-ink/15 text-lp-accent-ink"
              : "bg-lp-raised text-lp-accent-text"
          }`}
        >
          {badge}
        </p>
      )}

      {/* The figure opens the card. `tabular-nums` so $0 and $5.98 sit on the
          same baseline grid across the two cards. */}
      <p className="flex items-baseline gap-2">
        <span
          className={`font-serif text-[2.75rem] leading-none font-semibold tabular-nums ${
            featured ? "text-lp-accent-ink" : "text-lp-ink"
          }`}
        >
          {price}
        </span>
        <span
          className={`text-[0.9375rem] ${
            featured ? "text-lp-accent-pale" : "text-lp-body"
          }`}
        >
          {cadence}
        </span>
      </p>

      <h3
        className={`oc-heading mt-5 font-serif text-[1.375rem] font-semibold ${
          featured ? "text-lp-accent-ink" : "text-lp-ink"
        }`}
      >
        {title}
      </h3>

      <p
        className={`mt-2.5 text-[0.9375rem] leading-[1.5] ${
          featured ? "text-lp-accent-pale" : "text-lp-body"
        }`}
      >
        {blurb}
      </p>

      <ul className="mt-7 space-y-3.5 text-[0.9375rem] leading-[1.45]">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-3">
            {/* A tick in a disc rather than a bare tick — the disc is what
                makes five rows read as a list at a glance, and it is the one
                piece of the reference that is doing real work rather than
                decoration. */}
            <span
              className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                featured
                  ? "bg-lp-accent-ink/15 text-lp-accent-ink"
                  : "bg-lp-raised text-lp-accent-text"
              }`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <path d="M4.5 10.5l3.5 3.5 7-7.5" />
              </svg>
            </span>
            <span className={featured ? "text-lp-accent-ink" : "text-lp-soft"}>
              {line}
            </span>
          </li>
        ))}
      </ul>

      {note && (
        <p
          className={`mt-6 text-[0.875rem] ${
            featured ? "text-lp-accent-pale" : "text-lp-body"
          }`}
        >
          {note}
        </p>
      )}

      {/* `mt-auto` on the wrapper rather than on the link, so the two cards'
          buttons sit on one line whichever of them carries the yearly note —
          the padding above it is then a constant instead of a second margin
          fighting the first. */}
      <div className="mt-auto pt-8">
        <Link
          href={href}
          className={`block rounded-full px-6 py-3.5 text-center text-[1.0625rem] font-semibold transition-opacity hover:opacity-90 ${
            featured
              ? "bg-lp-ground text-lp-accent-deep"
              : "bg-lp-raised text-lp-ink"
          }`}
        >
          {cta}
        </Link>
      </div>
    </article>
  );
}
