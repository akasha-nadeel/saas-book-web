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
import {
  AssistantScreen,
  ImportScreen,
  ManuscriptScreen,
  ShelfScreen,
  VersionsScreen,
} from "@/components/landing/mvp-screens";
import {
  LEAD_EM,
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

  /* Grouped by the format, so the strip says which export opens where rather
     than listing seven programs under one unqualified claim. Read from
     `DESTINATIONS`, which cannot name a shop the export does not reach. */
  const byFormat = DESTINATIONS.reduce<Record<string, string[]>>(
    (all, destination) => {
      (all[destination.format] ??= []).push(destination.name);
      return all;
    },
    {},
  );

  return (
    /* `<body>` is `overflow-hidden` for the editor shell, so this page owns its
       own scrolling — `min-h-dvh` would put the footer out of reach.

       `data-theme="light"` pins everything under here to daylight: the tokens
       are inherited variable re-points, so the `lp-*` set and the app tokens
       this page borrows both resolve light whatever `<html>` says. `lp-type`
       re-points `--font-serif` for the whole subtree, which is why
       `font-serif` on this page is the grotesque. Both are documented at
       length on `LandingPage`. */
    <div
      data-theme="light"
      className="lp-type h-[var(--oc-layout-height)] overflow-y-auto bg-lp-ground text-lp-body [scroll-behavior:smooth]"
    >
      <LandingHeader ink={INK} items={NAV} />

      <main>
        {/* ---- Hero -------------------------------------------------------

            A centred stack over the product, whole rather than cropped. The
            page has one thing to show and it is the editor, so it is shown at
            full measure with nothing over it — a screen bled past the fold is
            the standard way of saying "there is more of this", and there is
            not; there is this, and then what comes out of it.

            `-mt-16` pulls the section up under the transparent bar, matching
            the fixed offset the other page uses. */}
        <section className="-mt-16 border-b border-lp-line bg-lp-tint px-6 pt-32 pb-14 sm:pt-36 sm:pb-20">
          <div className="mx-auto max-w-[88rem]">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
                Write a book · Keep it · Take the file
              </p>
              <h1
                className={`oc-display mt-5 font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                Write the whole book, then leave with the file.
              </h1>
              <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
                A quiet editor for a whole manuscript — chapters, notes,
                versions, front matter and all.{" "}
                <strong className={LEAD_EM}>
                  It writes to your own browser and hands you a Word, EPUB or
                  PDF file whenever you want one.
                </strong>
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  style={{ backgroundColor: INK }}
                  className="w-full rounded-full px-7 py-3.5 text-center text-[1.0625rem] font-semibold text-lp-accent-ink transition-opacity hover:opacity-90 sm:w-auto"
                >
                  Start writing free
                </Link>
                {/* `?next=` rather than a bare `/book/import`: the proxy
                    walls that route, so a visitor with no account would be
                    dropped on *sign in* — the one screen they cannot use.
                    `safeNext()` on the far side is what keeps the parameter
                    from being an open redirect. */}
                <Link
                  href="/signup?next=/book/import"
                  className="w-full rounded-full border border-lp-edge bg-lp-ground px-7 py-3.5 text-center text-[1.0625rem] font-semibold text-lp-ink transition-colors hover:border-lp-edge-strong sm:w-auto"
                >
                  Import a manuscript
                </Link>
              </div>

              {/* The catch, above the fold and before the press — read from
                  `LAUNCH_LIMITS` so it cannot say something the gate does
                  not. */}
              <p className="mt-5 text-[0.875rem] font-medium text-lp-ink">
                No card needed. {plural(LAUNCH_LIMITS.freeBooks, "book")} free,
                with no limit on chapters or words.
              </p>
            </div>

            {/* `max-w-4xl`, and it is a measurement rather than a taste.
                These screens are drawn at a design about 770px wide and
                mapped onto their container, so the container's width *is* the
                zoom: run the hero to the page's full 88rem and the editor's
                own type comes out at twenty-odd pixels, which reads as a
                mock-up rather than as an application. At 4xl it lands near
                fifteen, which is about where the real editor's chrome sits.
                The note on `W` in `mvp-screens.tsx` has the arithmetic. */}
            <div className="mx-auto mt-14 max-w-4xl sm:mt-16">
              <ManuscriptScreen />
            </div>
          </div>
        </section>

        {/* ---- Where a finished file opens --------------------------------

            The slot a landing page fills with customer logos, and there are no
            customers to name — so it names the programs a finished manuscript
            *opens in* instead, which is both true of the export pipeline and
            the thing a writer is actually nervous about. Read from
            `DESTINATIONS`, grouped by the export that reaches each one, so it
            cannot promise a shop we do not open in and cannot attach the wrong
            format to one we do. Nominative use — no endorsement is implied and
            none exists; see the note in `works-with.tsx`. */}
        <section className="border-b border-lp-line px-6 py-12 sm:py-14">
          <div className="mx-auto max-w-[88rem]">
            <p className="text-center text-[0.9375rem] font-semibold text-lp-body">
              Your book leaves in formats these already read — no licence, no
              lock-in.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {Object.entries(byFormat).map(([format, names]) => (
                <div
                  key={format}
                  className="rounded-2xl border border-lp-line bg-lp-well px-5 py-4"
                >
                  <p className="font-code text-[0.6875rem] tracking-[0.16em] text-lp-faint uppercase">
                    {format}
                  </p>
                  <ul className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    {names.map((name) => (
                      <li
                        key={name}
                        className="font-serif text-lg font-semibold text-lp-ink"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Inside the app --------------------------------------------- */}
        <section
          id="inside"
          className="scroll-mt-20 border-b border-lp-line px-6 py-14 sm:py-20"
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
                        this page that carry a fact rather than a decoration. */}
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-code text-[0.625rem] tracking-[0.12em] uppercase ${
                        entry.plan === "Free"
                          ? "bg-ok-bg text-ok-fg"
                          : "bg-lp-accent-pale text-lp-accent-text"
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
          className="scroll-mt-20 border-b border-lp-line px-6 py-14 sm:py-20"
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
                cadence="for as long as you like"
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
                title="Pro"
                price={`${monthly}`}
                cadence="a month, or billed yearly below"
                lines={[
                  "Unlimited books",
                  "Everything on Free",
                  `${LAUNCH_LIMITS.proAssistantRepliesPerMonth} assistant replies a month`,
                  "EPUB export, checked at zero errors",
                  "PDF export, typeset to your trim",
                ]}
                note={`${annualTotal} a year — about ${annualPerMonth} a month, ${saving}% off.`}
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
          className="scroll-mt-20 border-b border-lp-line px-6 py-14 sm:py-20"
        >
          <div className="mx-auto grid max-w-[88rem] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="flex items-center gap-2.5 font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
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
          marquee off — there are none to run past on this page. */}
      <CtaBanner
        title={
          <>
            You have the book.
            <br />
            Take the first one free.
          </>
        }
        lead="Import the manuscript you already have, or start on a blank chapter. Either way the file at the end is yours."
        note="No card needed. Already have an account? Log in below."
        marquee={false}
      />
      <LandingFooter columns={FOOTER_COLUMNS} />
    </div>
  );
}

/**
 * One plan.
 *
 * Two cards at one shape, told apart by whether the accent is the border or
 * the button — the same "outline, then fill" pairing the header's two actions
 * use, so a reader meets one control with two answers rather than two designs.
 * Nothing here states a figure of its own; every number arrives as a prop from
 * the modules that enforce it.
 */
function PlanCard({
  title,
  price,
  cadence,
  lines,
  note,
  href,
  cta,
  featured = false,
}: {
  title: string;
  price: string;
  cadence: string;
  lines: string[];
  note?: string;
  href: string;
  cta: string;
  featured?: boolean;
}) {
  return (
    <article
      className={`flex flex-col rounded-[1.75rem] border bg-lp-ground p-7 sm:p-8 ${
        featured ? "border-lp-accent" : "border-lp-line"
      }`}
    >
      <h3 className="oc-heading font-serif text-2xl font-semibold text-lp-ink">
        {title}
      </h3>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-serif text-4xl font-semibold text-lp-ink tabular-nums">
          {price}
        </span>
        <span className="text-[0.9375rem] text-lp-faint">{cadence}</span>
      </p>

      <ul className="mt-7 space-y-3 text-[0.9375rem] leading-[1.5] text-lp-soft">
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 h-4 w-4 shrink-0 text-ok-fg"
            >
              <path d="M4.5 10.5l3.5 3.5 7-7.5" />
            </svg>
            {line}
          </li>
        ))}
      </ul>

      {note && (
        <p className="mt-6 rounded-xl bg-lp-tint-soft px-4 py-3 text-[0.875rem] font-medium text-lp-ink">
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
          className={`block rounded-full px-6 py-3.5 text-center text-[1.0625rem] font-semibold transition-opacity ${
            featured
              ? "bg-lp-accent text-lp-accent-ink hover:opacity-90"
              : "border border-lp-edge text-lp-ink hover:border-lp-edge-strong"
          }`}
        >
          {cta}
        </Link>
      </div>
    </article>
  );
}
