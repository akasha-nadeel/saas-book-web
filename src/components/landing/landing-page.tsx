import Link from "next/link";
import type { ReactNode } from "react";
import { displayPrice, perMonthOf } from "@/lib/billing/plans";
import { LandingNav } from "./landing-nav";
import { EditorScreen } from "./laptop-mockup";
import { PublishingCheck } from "./publishing-check";
// Not from landing-nav.tsx — that module is "use client", and a Server
// Component importing a value from one gets a client reference rather than the
// array. See the note in sections.ts.
import { SECTIONS } from "./sections";
import { DESTINATIONS } from "./works-with";

/**
 * What a signed-out visitor sees at `/`.
 *
 * Built from the "OpenChapter Landing v2" design, and built to its palette and
 * type rather than to the app's: the hexes below are the design's own, and the
 * face is Plus Jakarta Sans (`font-brand`), which is why they are written
 * literally instead of taken from the `@theme` tokens. Those tokens describe the
 * *product* — a writing surface that has to work in light and dark — and this is
 * the shop front, which is one fixed light composition. Bending the app's
 * palette to cover both would have made every token lie a little.
 *
 * The page is `data-theme="light"` for that reason, as the previous version was.
 *
 * **Where this departs from the source design, it is because a claim was not
 * true.** The design is a picture of a product and had no way to know which
 * parts of ours exist; those are marked at each site with what the code actually
 * does. The list, so it is not lost:
 *
 * - The print PDF is not "print-ready" in the trade sense and does not do bleed.
 *   `print.ts` says so in its own header, and so does the export screen.
 * - Four of the eight publishing checks were invented. See `publishing-check.tsx`.
 * - "Free" needed to name what Pro actually costs money for.
 * - The import list was four formats; it is six.
 * - The footer's Terms / Privacy / Contact links pointed at `#`.
 *
 * That is not pedantry about a mockup. The visitor this page is written for has
 * already been sold a course that taught nothing and a cover that turned out to
 * be AI, and the FAQ below stakes the whole pitch on being checkable in an
 * afternoon. One decorative overclaim and that sentence is worth nothing.
 */
export function LandingPage() {
  return (
    // <body> is overflow-hidden for the editor shell, so this page owns its own
    // scrolling. min-h-dvh would put the footer out of reach.
    <div
      data-theme="light"
      // `scroll-mt-20` on everything with an id, set once here rather than
      // repeated on six sections: the header is sticky now, so an anchor jump
      // that lands flush with the top of the container puts the heading
      // *behind* the bar. 5rem is its 4rem plus a little air.
      className="h-dvh overflow-x-hidden overflow-y-auto bg-white font-brand
                 text-[#5A6170] [scroll-behavior:smooth] [&_[id]]:scroll-mt-20"
    >
      {/* Sticky, and the scroll listener inside it reads this div's scrollTop —
          see the note in landing-nav.tsx for why it cannot read the window's. */}
      <LandingNav />
      <Hero />
      <OpensIn />
      <Features />
      <Formats />
      <Path />
      <Publishing />
      <Faq />
      <Footer />
    </div>
  );
}

// The design's palette, named once. Written out rather than tokenised because
// they are used inside `style` as often as in classes — a gradient stop and a
// chip background cannot both come from a Tailwind colour utility.
const INK = "#0E1116";
const BLUE = "#1B63F5";

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

/**
 * The design's pill button: label, then an arrow in a translucent disc.
 *
 * Written once because the page uses it four times and they must not drift —
 * the disc's size is what makes it read as a button rather than as a link with
 * a character stuck on the end.
 */
function PillLink({
  href,
  children,
  size = "lg",
}: {
  href: string;
  children: ReactNode;
  size?: "lg" | "md";
}) {
  const lg = size === "lg";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-3 rounded-full bg-[#1B63F5] font-brand
                  font-semibold text-white outline-none transition-colors
                  hover:bg-[#1147C9] focus-visible:ring-2 focus-visible:ring-[#1B63F5]/60
                  ${
                    lg
                      ? "py-[15px] pr-4 pl-7 text-base"
                      : "py-[13px] pr-4 pl-6 text-[15px]"
                  }`}
    >
      {children}
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-full
                    bg-white/[0.22] ${lg ? "h-7 w-7 text-sm" : "h-[26px] w-[26px] text-[13px]"}`}
      >
        →
      </span>
    </Link>
  );
}

/** The outlined uppercase eyebrow above most headings. */
function Eyebrow({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <span
      className={`inline-block rounded-full border px-4 py-2 font-brand text-[11px]
                  font-semibold tracking-[0.14em] uppercase ${
                    tone === "dark"
                      ? "border-white/[0.18] text-[#7FA8FF]"
                      : "border-[#E5E8EF] text-[#5A6170]"
                  }`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  return (
    // Pulled up by the header's exact height (`h-16`, 4rem) so the pale blue
    // runs behind a transparent bar rather than starting under it — without
    // this there is a white strip across the top of the page. The top padding
    // then puts the content back: 4rem for the bar it now sits behind, plus the
    // 4rem/5.5rem of air the hero wants under it.
    //
    // Both numbers track `h-16` in landing-nav.tsx. Change the bar's height and
    // these move with it.
    <section
      id="top"
      className="-mt-16 bg-[#F1F5FF] px-5 pt-32 pb-16 sm:px-10 sm:pt-[152px] sm:pb-[88px]"
    >
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-12 lg:gap-16">
        <div className="min-w-[300px] flex-1 basis-[480px]">
          <span
            className="inline-block rounded-full border border-[#DCE7FD] bg-white px-4 py-2
                       font-brand text-[11px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: BLUE }}
          >
            Write · Check · Export
          </span>

          <h1
            className="mt-6 max-w-[640px] font-brand text-[clamp(38px,4.6vw,62px)]
                       leading-[1.06] font-extrabold tracking-[-0.03em] text-balance"
            style={{ color: INK }}
          >
            Write your novel. Export what the stores accept.
          </h1>

          <p className="mt-[22px] max-w-[520px] font-brand text-lg leading-[1.65] text-pretty">
            One app to draft a book and turn it into EPUB, DOCX, PDF at your trim
            size, and Markdown. No plugin chain, no conversion website, no seven
            open tabs.
          </p>

          <div className="mt-[34px] flex flex-wrap items-center gap-7">
            <PillLink href="/signup">Start writing free</PillLink>
            {/* Points at the FAQ's first row, which is open by default. The
                design made this the hero's second action, and it is the right
                one: to somebody who has been oversold, "here is what we don't
                do" is a stronger invitation than a second Get Started. */}
            <a
              href="#faq-limits"
              className="border-b border-[#C9D6F5] pb-[3px] font-brand text-[15.5px]
                         font-medium outline-none transition-colors hover:text-[#1B63F5]
                         focus-visible:ring-2 focus-visible:ring-[#1B63F5]/50"
              style={{ color: INK }}
            >
              See what it doesn&rsquo;t do
            </a>
          </div>

          {/* The design's line read "Writing, your shelf, syncing and all four
              export formats are free, and stay free" — true, and kept. What it
              could not know is that three things are *not* in that list, so the
              FAQ below names them rather than leaving the reader to find out at
              a paywall. */}
          <p className="mt-[26px] font-brand text-[14.5px] leading-[1.6]">
            Writing, your shelf, syncing and all four export formats are free,
            and stay free.
          </p>
        </div>

        <div className="min-w-[300px] flex-1 basis-[520px]">
          {/* The browser window the design frames the product in. Inside it is
              the editor drawn from the app's own tokens — see `EditorScreen` —
              rather than a screenshot, which would go stale silently and needs
              re-taking every time the rail changes. */}
          <div
            className="rounded-[20px] border border-[#E5E8EF] bg-white p-2.5"
            style={{ boxShadow: "0 18px 50px rgba(14,17,22,.08)" }}
          >
            <div aria-hidden="true" className="flex items-center gap-[7px] px-2.5 pt-2 pb-3">
              <span className="h-[9px] w-[9px] rounded-full bg-[#E5E8EF]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#E5E8EF]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#E5E8EF]" />
            </div>
            <div
              aria-hidden="true"
              className="h-[300px] overflow-hidden rounded-xl sm:h-[420px]"
            >
              <EditorScreen />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Where the exports open, with the real brand marks.
 *
 * The design set these as four names in bold type. `works-with.tsx` already
 * carries the actual logos in their official colours — with the licensing
 * worked out, which is the expensive part — so they are used instead. A row of
 * marks is what makes the claim land at a glance; four words in Jakarta Bold
 * read as four assertions.
 *
 * Four of the seven, matching the design's lineup.
 */
const OPENS_IN = ["Microsoft Word", "Apple Books", "Google Play Books", "Obsidian"];

function OpensIn() {
  const shown = OPENS_IN.map((name) => {
    const found = DESTINATIONS.find((d) => d.name === name);
    if (!found) throw new Error(`Unknown destination: ${name}`);
    return found;
  });

  return (
    <section className="bg-white px-5 pt-16 pb-2 sm:px-10">
      <div className="mx-auto max-w-[1240px] text-center">
        <p className="mb-7 font-brand text-[11px] font-semibold tracking-[0.14em] text-[#8A919E] uppercase">
          Your exported files open in
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14">
          {shown.map(({ name, mark }) => (
            <li key={name} className="flex items-center gap-3">
              <svg
                aria-hidden="true"
                viewBox={mark.viewBox}
                className="h-6 w-6 shrink-0"
              >
                {mark.paths.map((p, i) => (
                  <path key={i} d={p.d} fill={p.fill} />
                ))}
              </svg>
              <span
                className="font-brand text-lg font-bold tracking-[-0.02em] sm:text-xl"
                style={{ color: INK }}
              >
                {name}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-7 font-brand text-[14.5px] leading-[1.6]">
          We make standard files. We don&rsquo;t upload anything on your behalf.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

/** The tools this replaces, struck through. The design's own list. */
const REPLACES = [
  "a word processor",
  "a converter site",
  "an epub formatter",
  "a validator",
  "cloud storage",
  "a spreadsheet",
];

function Features() {
  return (
    <section id="features" className="bg-white px-5 pt-[88px] sm:px-10">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-12 lg:gap-16">
        <div className="min-w-[300px] flex-1 basis-[380px] pt-3">
          <Eyebrow>Features</Eyebrow>
          <h2
            className="mt-[22px] max-w-[420px] font-brand text-[clamp(30px,3.2vw,42px)]
                       leading-[1.12] font-extrabold tracking-[-0.028em] text-balance"
            style={{ color: INK }}
          >
            Four things, done properly
          </h2>
          <p className="mt-5 max-w-[400px] font-brand text-[16.5px] leading-[1.7] text-pretty">
            Publishing one book usually means seven tools and a spreadsheet to
            remember which version is current. Every hand-off between them is a
            chance for the file to come out wrong — and you find out after the
            upload.
          </p>

          <ul className="mt-[26px] flex max-w-[420px] flex-wrap gap-2">
            {REPLACES.map((tool) => (
              <li
                key={tool}
                className="rounded-full bg-[#F3F5F9] px-3.5 py-[7px] font-brand text-[13px]
                           font-medium text-[#8A919E] line-through"
              >
                {tool}
              </li>
            ))}
          </ul>

          <div className="mt-[34px]">
            <PillLink href="/signup" size="md">
              Get started
            </PillLink>
          </div>
        </div>

        <div className="grid min-w-[300px] flex-1 basis-[560px] grid-cols-1 gap-[18px] rounded-[26px] bg-[#F3F5F9] p-[18px] sm:grid-cols-2">
          <FeatureCard
            filled
            glyph={<span className="block h-3.5 w-3.5 rounded-[3px] bg-white" />}
            title="One app instead of seven"
            body="Draft, manuscript, metadata and export live in one file tree."
          />
          <FeatureCard
            glyph={
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-white" />
            }
            title="A shelf, not a folder"
            body="Books, chapters and drafts stay in order and sync as you type."
          />
          <FeatureCard
            glyph={<span className="block h-3 w-3 rotate-45 bg-white" />}
            title="Checked before you upload"
            body="We name what would get your book rejected, in plain words."
            link={{ href: "#publishing", label: "See the check →" }}
          />
          <FeatureCard
            glyph={
              <span
                className="block h-[3px] w-4 rounded-sm bg-white"
                style={{ boxShadow: "0 6px 0 #FFFFFF" }}
              />
            }
            title="An assistant that can’t touch your book"
            body="No write access at all. It reads one chapter, only when you ask."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  glyph,
  title,
  body,
  link,
  filled,
}: {
  glyph: ReactNode;
  title: string;
  body: string;
  link?: { href: string; label: string };
  /** The blue card. One per grid, top left, as the design has it. */
  filled?: boolean;
}) {
  return (
    <article
      className={`flex min-h-[230px] flex-col rounded-[18px] px-6 pt-[26px] pb-7 ${
        filled ? "bg-[#1B63F5]" : "bg-white"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mb-auto flex h-[42px] w-[42px] items-center justify-center rounded-full ${
          filled ? "bg-white/[0.18]" : "bg-[#1B63F5]"
        }`}
      >
        {glyph}
      </span>
      <h3
        className="mt-7 mb-2 font-brand text-[19px] leading-[1.3] font-bold tracking-[-0.015em]"
        style={{ color: filled ? "#FFFFFF" : INK }}
      >
        {title}
      </h3>
      <p
        className={`font-brand text-[14.5px] leading-[1.6] text-pretty ${
          filled ? "text-white/[0.86]" : "text-[#5A6170]"
        } ${link ? "mb-3" : ""}`}
      >
        {body}
      </p>
      {link && (
        <a
          href={link.href}
          className="font-brand text-sm font-semibold outline-none transition-colors
                     hover:text-[#1147C9] focus-visible:ring-2 focus-visible:ring-[#1B63F5]/50"
          style={{ color: BLUE }}
        >
          {link.label}
        </a>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

/**
 * What the importer actually reads — `IMPORT_FORMATS` in `src/lib/import/index.ts`,
 * plus the audiobook route.
 *
 * The design listed four and one of them was "paste". Import is file-based and
 * dispatches on extension; there is no paste-a-manuscript path, and the two it
 * left out (EPUB and HTML) are real. Six is also the more impressive number, so
 * this is a correction that costs nothing.
 */
const BRING_IN = [
  [".docx", "Word, or a Pages export"],
  [".epub", "An ebook you already published"],
  [".md", "Markdown, headings intact"],
  [".txt", "Plain text"],
  [".html", "A web page or a Docs export"],
  ["audio", "An audiobook, transcribed and split into chapters"],
] as const;

/**
 * The four exports.
 *
 * **The PDF line is the one that was changed.** The design promised
 * "Print-ready: your trim size, fonts embedded", and the FAQ under it promised
 * bleed. `print.ts` renders through the browser's print engine and says in its
 * own header: no bleed, no crop marks, no CMYK. The export screen tells writers
 * the same thing. A landing page contradicting the product's own disclosure is
 * exactly the trick this audience has learned to look for.
 */
const TAKE_OUT = [
  [".epub", "EPUB 3, checked against EPUBCheck 5.3"],
  [".docx", "For anyone who asks for Word"],
  [".pdf", "Your trim size, fonts embedded, ready to proof"],
  [".md", "Markdown, so the text is never trapped"],
] as const;

/**
 * What comes in and what goes out, on ink.
 *
 * The section is a dark band rather than the design's white one. It gives the
 * page a second dark ground between the hero and the publishing section, and it
 * suits what is being said: the two cards are the *product's* edges — what it
 * will swallow and what it will hand back — and on white they read as two more
 * panels among the six above them.
 *
 * The band is self-contained: its own padding top and bottom, rather than the
 * shared `pt-24` the white sections use to space themselves off each other. A
 * coloured section that inherits a white section's spacing gets its colour
 * clipped against the next heading.
 */
function Formats() {
  return (
    <section
      id="formats"
      className="mt-24 px-5 py-20 sm:px-10 sm:py-24"
      style={{ background: INK }}
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-9 flex flex-wrap items-end gap-x-14 gap-y-6">
          <div className="flex-1 basis-[480px]">
            <Eyebrow tone="dark">Formats</Eyebrow>
            <h2
              className="mt-[22px] max-w-[520px] font-brand text-[clamp(30px,3.2vw,42px)]
                         leading-[1.12] font-extrabold tracking-[-0.028em] text-white"
            >
              What goes in, what comes out
            </h2>
          </div>
          <p className="max-w-[440px] flex-1 basis-[360px] font-brand text-base leading-[1.7] text-pretty text-white/[0.72]">
            Every export is a real file on your disk, not a preview. No
            watermark, no export limit. If you leave, your book leaves with you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
          <FormatColumn label="Bring in" rows={BRING_IN} />
          <FormatColumn label="Take out" rows={TAKE_OUT} filled />
        </div>
      </div>
    </section>
  );
}

function FormatColumn({
  label,
  rows,
  filled,
}: {
  label: string;
  rows: readonly (readonly [string, string])[];
  /** The blue column — "Take out", as the design has it. */
  filled?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] px-6 pt-8 pb-9 sm:px-[34px] ${
        filled ? "bg-[#1B63F5]" : "bg-[#F3F5F9]"
      }`}
    >
      <p
        className={`mb-6 font-brand text-[11px] font-semibold tracking-[0.14em] uppercase ${
          filled ? "text-white/70" : "text-[#8A919E]"
        }`}
      >
        {label}
      </p>
      <ul className="flex flex-col gap-4">
        {rows.map(([code, note]) => (
          <li key={code} className="flex flex-wrap items-baseline gap-x-[18px] gap-y-1">
            {/* `audio` is not a file extension, so it is set in the muted grey
                rather than dressed up as one. */}
            <span
              className={`min-w-[62px] font-code text-[13px] font-medium ${
                filled
                  ? "text-white"
                  : code === "audio"
                    ? "text-[#8A919E]"
                    : "text-[#1B63F5]"
              }`}
            >
              {code}
            </span>
            <span
              className={`font-brand text-base ${
                filled ? "text-white/[0.88]" : "text-[#5A6170]"
              }`}
            >
              {note}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The path
// ---------------------------------------------------------------------------

/**
 * The four stages, absorbing what used to be a separate "Three steps, no setup
 * wizard" section further down the page.
 *
 * They were the same journey told twice — start, write, check, export — and a
 * landing page that walks a visitor through its own process two ways invites
 * the question of which one is real. The three-card version had the better
 * specifics and this has the better shape, so the specifics moved here: no
 * template to choose (was step 01), the list of importable formats (step 02),
 * and fixing what the check names before exporting (step 03).
 */
const STAGES = [
  [
    "Draft",
    "No template to choose and nothing to fill in first. Start typing, name the book later, and it saves and syncs as you go.",
  ],
  [
    "Manuscript",
    "Bring in a DOCX, EPUB, Markdown, text or HTML file and your headings become chapters. Metadata, trim size and blurb live with the book.",
  ],
  [
    "Check",
    "The pre-upload check names what a store would reject, in plain words, and which problems would actually stop the upload.",
  ],
  [
    "Files",
    "Export EPUB, DOCX, PDF at your trim size and Markdown, ready to upload wherever you sell.",
  ],
] as const;

/**
 * The four stages, on the design's rising and falling line.
 *
 * The source positions each node absolutely against a hand-drawn SVG path and
 * sets a 1080px minimum width with a horizontal scrollbar under it. That works
 * on a desktop and is miserable on a phone — a landing page that has to be
 * dragged sideways to be read is one a phone visitor leaves.
 *
 * So the line and its scroller are the *large* layout only, and below that the
 * same four stages stack as a plain numbered column. Same content, same order,
 * no horizontal scroll. The curve is decoration; the sequence is the point.
 */
function Path() {
  return (
    // Pale blue, sitting between the two black bands — Formats above and
    // Publishing below — so the page alternates rather than running two dark
    // sections together. It is the hero's own tint, which makes the journey
    // read as a return to where the page started.
    <section
      id="path"
      className="px-5 py-20 sm:px-10 sm:py-24"
      style={{ background: "#F1F5FF" }}
    >
      <div className="mx-auto max-w-[1240px]">
        <Eyebrow>The path</Eyebrow>
        <h2
          className="mt-[22px] max-w-[560px] font-brand text-[clamp(30px,3.2vw,42px)]
                     leading-[1.12] font-extrabold tracking-[-0.028em]"
          style={{ color: INK }}
        >
          Blank page to finished file
        </h2>
        <p className="mt-[18px] max-w-[620px] font-brand text-base leading-[1.7] text-pretty">
          Four stages, one app. No setup wizard, no hand-off, no export chain,
          and no second subscription.
        </p>

        {/* Large screens: the curve. */}
        <div className="mt-2 hidden lg:block">
          <div className="relative h-[420px]">
            <svg
              aria-hidden="true"
              viewBox="0 0 1200 260"
              preserveAspectRatio="none"
              className="absolute top-0 left-0 h-[260px] w-full"
            >
              <path
                d="M 0 150 H 200 C 285 150 285 205 370 205 H 530 C 615 205 615 70 700 70 H 840 C 925 70 925 140 1010 140 H 1200"
                fill="none"
                stroke="#C6D8FA"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {/* left% and top px are the design's, node by node — they are where
                the curve actually passes, so they cannot be derived. */}
            {(
              [
                ["10.83%", 104],
                ["37.5%", 159],
                ["64.17%", 24],
                ["85.83%", 94],
              ] as const
            ).map(([left, top], i) => (
              <div key={STAGES[i][0]}>
                <span
                  aria-hidden="true"
                  className="absolute flex h-[92px] w-[92px] -translate-x-1/2 items-center
                             justify-center rounded-full bg-[#EAF1FE]"
                  style={{ left, top }}
                >
                  <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#1B63F5] font-brand text-[13px] font-bold text-white">
                    #{i + 1}
                  </span>
                </span>
                <div
                  className="absolute w-[240px] -translate-x-1/2 text-center"
                  style={{ left, top: top + 104 }}
                >
                  <p
                    className="mb-2.5 font-brand text-lg font-bold tracking-[-0.015em]"
                    style={{ color: INK }}
                  >
                    {STAGES[i][0]}
                  </p>
                  <p className="font-brand text-sm leading-[1.6] text-pretty">
                    {STAGES[i][1]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Everything narrower: the same four, stacked. */}
        <ol className="mt-10 flex flex-col gap-5 lg:hidden">
          {STAGES.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                           bg-[#EAF1FE] font-brand text-[13px] font-bold"
                style={{ color: BLUE }}
              >
                #{i + 1}
              </span>
              <div>
                <p
                  className="mb-1.5 font-brand text-lg font-bold tracking-[-0.015em]"
                  style={{ color: INK }}
                >
                  {title}
                </p>
                <p className="font-brand text-sm leading-[1.6] text-pretty">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* The border is `#C9D6F5` rather than the white sections' `#EDEFF4`:
            a near-white hairline disappears on this tint. */}
        <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3 border-t border-[#C9D6F5] pt-[22px] lg:mt-2">
          {[
            "Nothing in this path needs a second tool",
            "Nothing in it costs money",
            "You keep every file at every stage",
          ].map((line) => (
            <p
              key={line}
              className="font-brand text-[13.5px] font-medium"
              style={{ color: BLUE }}
            >
              {line}
            </p>
          ))}
        </div>

        {/* The call to action the three-step section used to carry. It belongs
            at the end of the journey rather than at the end of a second
            description of it. */}
        <div className="mt-11">
          <PillLink href="/signup">Start writing free</PillLink>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Publishing checks
// ---------------------------------------------------------------------------

function Publishing() {
  return (
    // No top margin: this follows the pale-blue path section directly, so the
    // page runs black (formats) → pale blue (the path) → black (the checks) on
    // hard edges. A gap between any two of them would show a white strip and
    // read as a section that failed to reach its neighbour.
    <section
      id="publishing"
      className="px-5 py-20 sm:px-10 sm:py-24"
      style={{ background: INK }}
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-10 flex flex-wrap items-end gap-x-14 gap-y-6">
          <div className="flex-1 basis-[520px]">
            <Eyebrow tone="dark">Publishing checks</Eyebrow>
            <h2 className="mt-[22px] max-w-[600px] font-brand text-[clamp(30px,3.6vw,46px)] leading-[1.1] font-extrabold tracking-[-0.03em] text-balance text-white">
              The store says no, and doesn&rsquo;t say why
            </h2>
          </div>
          <p className="max-w-[460px] flex-1 basis-[380px] font-brand text-[16.5px] leading-[1.7] text-pretty text-white/[0.72]">
            You upload, you wait, and three days later an email arrives naming no
            cause. The reason is usually small and mechanical: a missing file, a
            digit, a field left empty. We look for those before you upload, and
            we say which one it is.
          </p>
        </div>

        <PublishingCheck />

        <div className="mt-11 grid grid-cols-1 gap-7 sm:grid-cols-3">
          {[
            [
              "Plain words, not error codes",
              "“Cut 212 characters from the blurb” instead of a validation ID and a help-centre link.",
            ],
            [
              "It runs while you write",
              "Part of the export screen, not a paid add-on. Fix one thing and the list answers again.",
            ],
            [
              "We tell you what we can’t see",
              "Mechanical problems we catch. A store’s editorial judgement we can’t, and we say so.",
            ],
          ].map(([title, body]) => (
            <div key={title}>
              <p className="mb-2.5 font-brand text-base font-semibold text-white">
                {title}
              </p>
              <p className="font-brand text-[14.5px] leading-[1.65] text-pretty text-white/[0.66]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/**
 * The FAQ, and the part of this page worth guarding hardest.
 *
 * Three answers differ materially from the design's, and each is marked below.
 * The section's own promise — that nothing here needs more than an afternoon to
 * disprove — is what makes the rest of the page worth reading, and it is void
 * the moment one of these is written to flatter.
 */
const QUESTIONS: { id?: string; q: string; a: string }[] = [
  {
    id: "faq-limits",
    q: "What doesn’t it do?",
    a: "A fair amount. It does not design covers, edit or proofread your prose, write your blurb, market your book, buy ads, upload to any store, or introduce you to other writers. It is a writing app with an export pipeline and a pre-upload check. Everything else on your list is still yours.",
  },
  {
    // CHANGED. The design answered this as though nothing is ever charged for,
    // which would have been read as a promise and broken at the first paywall.
    // Pro exists today and gates three things; the price is read from the same
    // table the checkout charges from, so this line cannot drift from it.
    q: "Is it really free, or free until it isn’t?",
    a: `Writing, your shelf, syncing and all four export formats are free, and they stay free — no watermark, no export cap, nothing to unlock before you can export a finished book. Three things are not free: the assistant, the audiobook narration and the bookmarks panel are Pro, at ${displayPrice(
      perMonthOf("monthly"),
    )} a month. You never need any of them to write a book and publish it.`,
  },
  {
    q: "Who owns what I write?",
    a: "You do. We claim no rights over your manuscript, and we take no cut of anything you sell.",
  },
  {
    q: "Do you train AI on my manuscript?",
    a: "No. Your book is not training data. The assistant only ever receives the single chapter you hand it, at the moment you ask, and it is not used to train a model afterwards. It also has no way to edit your document — it answers in its own panel, and anything you take from it you copy across yourself.",
  },
  {
    q: "Will the checks guarantee my book is accepted?",
    a: "No, and anyone promising that is selling you something. We catch mechanical problems: a missing cover, a malformed ISBN, a blurb over the length limit, required fields left empty. A store can still reject a book for reasons we cannot see. The panel tells you what it checked and which problems would actually stop an upload, as against the ones that only cost you readers.",
  },
  {
    q: "Can I get my work out if I stop using it?",
    a: "Yes, and without asking us for permission or filing a data request. Export EPUB, DOCX, PDF and Markdown whenever you want. Markdown is plain text — it opens in any editor, including one written thirty years ago.",
  },
  {
    // CHANGED, and this is the important one. The design promised bleed and
    // called the file print-ready. `print.ts` renders through the browser's
    // print engine, which cannot produce bleed, crop marks or CMYK — its own
    // header says so, and so does the export screen. Shipping the design's
    // wording would have put the landing page in direct contradiction with the
    // product two clicks later.
    q: "Is the PDF ready for a printer?",
    a: "It is a clean interior PDF at the trim size you choose, with fonts embedded — right for proofing, for readers, and for print-on-demand services that accept an interior file. It is not a full pre-press file: there is no bleed, no crop marks and no CMYK conversion, because it is produced by your browser's print engine rather than a pre-press tool. The export screen says the same thing. If your printer asks for bleed, that step still needs another tool.",
  },
  {
    q: "I’ve paid for tools that did none of this. Why is this different?",
    a: "You can test the whole claim in an afternoon without paying: write a page, import a draft, run the check, export all four files, and open them in Word and an e-reader. If any of it doesn’t work, you have lost an afternoon rather than a thousand pounds.",
  },
];

function Faq() {
  return (
    <section id="faq" className="bg-white px-5 pt-24 sm:px-10">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-9 flex flex-wrap items-end gap-x-14 gap-y-6">
          <div className="flex-1 basis-[480px]">
            <Eyebrow>Questions</Eyebrow>
            <h2
              className="mt-[22px] max-w-[520px] font-brand text-[clamp(30px,3.2vw,42px)]
                         leading-[1.12] font-extrabold tracking-[-0.028em]"
              style={{ color: INK }}
            >
              Reasonable suspicion, answered
            </h2>
          </div>
          <p className="max-w-[440px] flex-1 basis-[360px] font-brand text-base leading-[1.7] text-pretty">
            If a claim here can&rsquo;t be tested in an afternoon without paying,
            it shouldn&rsquo;t be on the page.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {QUESTIONS.map(({ id, q, a }, i) => (
            // `group` + `open:` rather than the design's !important CSS block —
            // the same effect with nothing to keep in step in globals.css.
            // The first row is open on load, as the design has it, because the
            // hero links straight at it.
            <details key={q} id={id} open={i === 0} className="group">
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-6
                           rounded-[18px] bg-[#F3F5F9] py-5 pr-5 pl-7 transition-colors
                           outline-none group-open:rounded-b-none group-open:bg-[#1B63F5]
                           focus-visible:ring-2 focus-visible:ring-[#1B63F5]/50
                           [&::-webkit-details-marker]:hidden"
              >
                <span
                  className="font-brand text-[17px] leading-[1.4] font-bold tracking-[-0.015em]
                             group-open:text-white sm:text-[19px]"
                  style={{ color: INK }}
                >
                  {q}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-[38px] w-[38px] shrink-0 items-center justify-center
                             rounded-full bg-[#1B63F5] font-brand text-[15px] text-white
                             transition-colors group-open:bg-white group-open:text-[#1B63F5]"
                >
                  <span className="block transition-transform group-open:rotate-90">
                    →
                  </span>
                </span>
              </summary>
              {/* Two elements, and it has to be two. The measure belongs on the
                  paragraph; put it on the blue panel instead and the panel
                  stops short of the summary bar above it, leaving a step cut
                  out of the right-hand side of the open row. */}
              <div className="rounded-b-[18px] bg-[#1B63F5] px-7 pt-1 pb-[26px]">
                <p className="max-w-[820px] font-brand text-base leading-[1.7] text-pretty text-white/[0.92]">
                  {a}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer() {
  return (
    <footer className="mt-24 px-5 pt-[72px] pb-11 sm:px-10" style={{ background: INK }}>
      <div className="mx-auto max-w-[1240px]">
        <div className="flex flex-wrap justify-between gap-x-14 gap-y-12 border-b border-white/[0.12] pb-13">
          <div className="basis-[340px]">
            <p className="mb-3.5 font-display text-[22px] font-bold tracking-[-0.02em] text-white">
              Open<span style={{ color: "#4B87FF" }}>Chapter</span>
            </p>
            <p className="mb-[26px] max-w-[290px] font-brand text-[15px] leading-[1.65] text-white/60">
              One app, blank page to finished file.
            </p>
            <PillLink href="/signup" size="md">
              Start writing free
            </PillLink>
          </div>

          <div className="flex flex-wrap gap-x-16 gap-y-10">
            <FooterColumn
              heading="Product"
              links={SECTIONS.map(([label, href]) => ({ label, href }))}
            />
            {/*
              The design's third column was Terms, Privacy and "Contact a human",
              all pointing at `#`. None of those pages exists, and a footer link
              that goes nowhere is the same dead control the house rules forbid —
              worse here, because a visitor only finds out after clicking, on the
              page whose whole argument is that we do not overstate.
              These are the account routes, which are real.
            */}
            <FooterColumn
              heading="Your account"
              links={[
                { label: "Create an account", href: "/signup" },
                { label: "Log in", href: "/signin" },
                { label: "Reset your password", href: "/forgot-password" },
                { label: "Pricing", href: "/upgrade" },
              ]}
            />
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <p className="font-brand text-[13px] text-white/45">
            © {new Date().getFullYear()} OpenChapter
          </p>
          {/* Where a footer usually puts Privacy and Terms. Neither exists yet,
              so this says something true instead of linking to two pages that
              are not there. */}
          <p className="font-brand text-[13px] text-white/45">
            Your books stay in your browser.
          </p>
        </div>
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
    <div className="flex flex-col gap-3.5">
      <p className="mb-0.5 font-brand text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">
        {heading}
      </p>
      {links.map(({ label, href }) =>
        href.startsWith("#") ? (
          <a
            key={href}
            href={href}
            className="font-brand text-[15px] text-white/[0.78] outline-none transition-colors
                       hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {label}
          </a>
        ) : (
          <Link
            key={href}
            href={href}
            className="font-brand text-[15px] text-white/[0.78] outline-none transition-colors
                       hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {label}
          </Link>
        ),
      )}
    </div>
  );
}
