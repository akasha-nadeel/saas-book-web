import Link from "next/link";
import type { ReactNode } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { GoogleButton } from "@/components/auth/auth-shell";
import { BookCheck } from "@/components/landing/book-check";
import { CheckDemo } from "@/components/landing/check-demo";
import { CtaBanner } from "@/components/landing/cta-banner";
import { HeroWall } from "@/components/landing/hero-wall";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { OrderPath, type Station } from "@/components/landing/order-path";
import { SECTION_TITLE } from "@/components/landing/type";
import {
  ArcScreen,
  PrepareScreen,
  PublishScreen,
  ReviseScreen,
  WriteScreen,
} from "@/components/landing/phase-screens";
import {
  CoverCheckFigure,
  ExportDoneFigure,
  ListingFigure,
} from "@/components/landing/refusal-figures";
import { StoreListingDemo } from "@/components/landing/store-listing-demo";
import { DESTINATIONS } from "@/components/landing/works-with";
import { ALL_TOOLS, TOOL_GROUPS } from "@/lib/book-tools";
import { PHASES, SELF_TICKING, STEPS, YOURS_TO_TICK } from "@/lib/roadmap";
import { SEATS_PER_BOOK } from "@/lib/free-limits";
import {
  IDEAL_RATIO,
  MAX_EDGE,
  MIN_HEIGHT,
  MIN_WIDTH,
} from "@/lib/cover-check";
import { CONTACT_EMAIL, REFUND_DAYS, REPLY_DAYS } from "@/lib/legal";

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
 * **Where a SaaS page keeps its social proof, this one keeps its refusals.**
 * The layout this was built to wants "trusted by 5,000 brands" and we have
 * nobody, so: no user count, no rating and no testimonial anywhere on this
 * page until there is a real one. Two slots that would ordinarily carry them
 * answer the problem instead rather than dodging it — `VOICES`, which quotes
 * the research and says plainly that it is not customers, and a band of four
 * counted figures which stood under the refusals until it was removed (see the
 * note where it was: the rule survived it, and all four figures are still on
 * the page in places that give them a meaning).
 *
 * **It is always light, and it is the one screen in the product that is.** It
 * followed `data-theme` for a while, on the argument that a reader whose
 * machine is dark has not expressed a view about our marketing — they have
 * told their whole screen how bright to be, and the one page ignoring them was
 * the first one they ever saw. That reasoning is sound about *the app*, which
 * is a room somebody works in for hours. It is the wrong trade for a shop
 * front: this page is one composition, its grounds and marker and closing
 * banner were drawn and measured against white, and the dark set was a second
 * design of it that nobody could hold in their head at once. A brand has one
 * look, and the reader who has been sold to by everybody meets it here first.
 *
 * The mechanism is one attribute rather than forty-two literals: the root
 * `<div>` carries `data-theme="light"`, so every token under it — the
 * `--color-lp-*` set and the app tokens the page borrows — resolves to
 * daylight, whatever `<html>` says. The dark `lp-*` values stay stated in
 * `globals.css` because the legal pages still use them and still follow the
 * theme, and because the file's own rule is that every token is stated in both
 * blocks.
 *
 * Two things stay literal on purpose, and neither is chrome: the drawn book
 * covers in the figures, because a cover is a picture of an object, and the
 * marks in `works-with.tsx`, because a trademark is a trademark.
 *
 * **One measure down the whole page: `max-w-6xl px-6`.** The header, every
 * section, the closing banner and the footer all use it, so every heading,
 * every card edge and the wordmark itself start on the same vertical line. It
 * was not always: the header was `6xl` while the sections were `5xl`, which
 * put the wordmark about sixty pixels outside every card on the page — small
 * enough that nobody names it and large enough that the page reads as two
 * designs stacked. If a section needs to be wider than this, it should *bleed
 * past* the measure (the hero's wall of cards, the banner's drawn window) and
 * never simply start further out; a bleed reads as deliberate and a wider
 * container reads as a mistake.
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

/**
 * The five phases as stations on the road.
 *
 * **The title and the step count are the roadmap's own**, counted out of
 * `STEPS` rather than typed, so adding a step to a phase changes this section
 * without anybody having to remember it. The lead sentence is landing copy —
 * the roadmap's own notes are written for somebody already inside the product
 * and run to half a line here, where two lines is what reads as a label on a
 * station rather than as a caption. Each is held to the same rule as every
 * other claim on this page: true of what the phase actually contains.
 *
 * The callout is the argument the whole section exists to make, and even that
 * quotes the step's real title, number and phase from the constants above.
 *
 * **`at` and `side` are drawing, not data**, which is why they are here rather
 * than in `roadmap.ts` — the roadmap has no opinion about a landing page.
 *
 * They must stay inside the empty lane the layout keeps for them. The row is
 * `1fr | 26% | 1fr`, so the lane runs from 0.37 to 0.63 and anything between
 * those is over nothing but ground; outside them the road is drawn through
 * somebody's sentence, which is a strike-through. **And they must alternate
 * exactly**, which is not a matter of taste: a cubic whose control points
 * share their endpoints' x cannot overshoot in x, and perfect alternation is
 * what makes the horizontal control arms — which come from the difference
 * between a station's *neighbours* — vanish. Two stations the same side
 * running would put a bulge in the curve where there is no room for one.
 */
/*
 * Two lines each, and that is a length rather than a style: at the capped
 * width these set as two, which is what reads as a label on a station. One is
 * a caption and four is a paragraph, and a reader takes these at scrolling
 * speed. Keep a replacement inside roughly seventy-five characters, count
 * included.
 */
const ORDER_LEADS: Record<string, string> = {
  write: "Get the words down. The only phase most writing software covers.",
  revise: "Make them the right words. The last phase that is about the book.",
  prepare: "Everything a shop asks for that is not the book. The longest phase.",
  launch: "The part almost everybody finds out about too late to act on.",
  publish: "Send it, then check what you actually sent, as a reader sees it.",
};

/*
 * The screen each phase is shown by, in the column its words are not in.
 *
 * Keyed by the phase's own id rather than by index, so re-ordering `PHASES`
 * cannot quietly put the advance-copy tracker beside "Write". Three of the
 * five are computed out of the app's own modules — see `phase-screens.tsx`.
 */
const ORDER_SCREENS: Record<string, ReactNode> = {
  write: <WriteScreen />,
  revise: <ReviseScreen />,
  prepare: <PrepareScreen />,
  launch: <ArcScreen />,
  publish: <PublishScreen />,
};

const ORDER_STATIONS: Station[] = PHASES.map((phase, i) => {
  const steps = STEPS.filter((step) => step.phase === phase.id).length;
  const place = [
    { at: 0.4, side: "left" as const },
    { at: 0.6, side: "right" as const },
    { at: 0.4, side: "left" as const },
    { at: 0.6, side: "right" as const },
    { at: 0.4, side: "left" as const },
  ][i]!;

  return {
    n: String(i + 1).padStart(2, "0"),
    title: phase.label,
    note: `${ORDER_LEADS[phase.id] ?? phase.note} ${steps} step${steps === 1 ? "" : "s"}.`,
    screen: ORDER_SCREENS[phase.id],
    ...place,
    ...(phase.id === ARC_STEP.phase
      ? {
          callout: `“${ARC_STEP.title}” is step ${ARC_INDEX + 1}, here in phase ${ARC_PHASE} — before you publish, not after.`,
        }
      : {}),
  };
});

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

/**
 * What is genuinely not built, and nothing that is.
 *
 * This list had the series bible, ranked comps and the book-three curve on it
 * until all three shipped, and the rule that matters here is the one that
 * fails quietly: **nothing stays under this badge once it exists.** A page
 * still promising a shipped feature is a page saying something untrue, in the
 * one section whose whole job is being trustworthy about the difference
 * between a plan and a product. Walk it whenever a feature lands — and when
 * something comes off, put something real in its place rather than shortening
 * the list, because three honest absences buy more than two do.
 */
const LATER = [
  [
    "A real print-ready PDF",
    "Today's PDF is the browser's print engine, which we say wherever it appears: no bleed, no crop marks, no CMYK. A printer's file needs a real PDF library and is a project of its own.",
  ],
  [
    "Sales reports without a detour",
    "Track reads CSV, and KDP downloads .xlsx — so today you open it and save it again. Reading the spreadsheet directly is the whole of the difference.",
  ],
  [
    "Your tools on your second machine",
    "Your books and chapters sync. The ledger, the story bible and the advance-copy list do not yet, so a writer on a laptop and a desktop keeps two of each. Every screen with one says so on it.",
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

/**
 * The three ways a finished book is turned away, and what each one costs.
 *
 * **This is the problem section, and the page did not have one.** Every other
 * block here answers a question the reader has not been asked yet: what the
 * product does, what order the work goes in, what we refuse. The research on
 * landing pages says the same thing in the aggregate — most visitors are
 * *problem-aware* rather than product-aware, and a page that opens on its
 * solution talks past them. So this sits directly under the hero: the reader
 * has just been told they can find out what is wrong before they upload, and
 * this is what "wrong" means in practice.
 *
 * Sourced rather than imagined. Each row is a rejection cause documented across
 * the self-publishing help material and author forums — cover dimensions are
 * the single commonest refusal, metadata mismatch between the file and the
 * dashboard is next, and EPUB validation failure is the one that hurts longest.
 * Each is checked in `storeReadiness()` or guaranteed by the export, and the
 * third column says which — a claim on this page has to be answerable by
 * pointing at code.
 *
 * **The third row is the one worth the section.** Amazon's converter silently
 * repairs structural EPUB faults that Apple, Kobo and IngramSpark refuse
 * outright, so a file that "worked on Amazon" is a fault that surfaces weeks
 * later, at the moment a writer tries to go wide, with nothing connecting the
 * two events. That is a specific, checkable, expensive failure — and an
 * exported EPUB that clears EPUBCheck at zero errors is a direct answer to it.
 * No competitor can respond with a nicer illustration.
 */
/**
 * Which destinations the strip under the hero shows, and why it is not all of
 * them.
 *
 * `DESTINATIONS` is the true and complete list — every program one of our four
 * exports opens in — and it stays that way, because it is also what the footer
 * reads and what any future claim about the pipeline should be checked
 * against. What this is, is an *edit* of it for one row: five names on one
 * line, ordered as a writer would meet them, one word processor and the four
 * shops.
 *
 * Two go: LibreOffice Writer, because Microsoft Word already makes the DOCX
 * claim and three word processors in a row of seven made the strip look like a
 * compatibility matrix, and Obsidian, because a Markdown notes app beside four
 * bookshops answers a question nobody at this point in the page is asking.
 * Neither is a retraction — both still open the exports, and both are still in
 * `DESTINATIONS` for anything that needs the whole answer.
 *
 * Filtered by name rather than sliced by index, so reordering that module
 * cannot silently change what this row claims. A name that stops matching
 * drops out of the strip instead of breaking the page.
 */
const STRIP_NAMES = [
  "Microsoft Word",
  "Google Docs",
  "Apple Books",
  "Amazon Kindle",
  "Google Play Books",
];

const STRIP = STRIP_NAMES.map((name) =>
  DESTINATIONS.find((destination) => destination.name === name),
).filter((destination) => destination !== undefined);

/*
 * Each row carries the screen that catches it, because a claim on this page
 * has to be answerable by pointing at something. The figures live in
 * `refusal-figures.tsx` and two of the three are computed out of the app's own
 * modules rather than drawn from memory — see the note at the top of that file.
 *
 * Held on the row rather than in a second list beside it: a picture and the
 * words it illustrates matched up by index is two lists that can disagree, and
 * the one that loses is always the picture.
 */
/*
 * A ground per card, in order down the page.
 *
 * Whole class names, because Tailwind reads them as literals — `bg-lp-card-${i}`
 * ships no rule at all. Indexed with a modulo at the call site so a fourth
 * refusal wraps to the first ground rather than rendering with none.
 */
const CARD_TINTS = ["bg-lp-card-1", "bg-lp-card-2", "bg-lp-card-3"];

const REJECTIONS = [
  {
    mark: "shelf",
    title: "The cover is the wrong size",
    /* The figures are interpolated rather than typed, like everything
       countable on this page: `MIN_HEIGHT`, `MIN_WIDTH`, `MAX_EDGE` and
       `IDEAL_RATIO` are the constants the checker itself measures against, so
       the sentence and the screen beside it cannot end up quoting different
       numbers at the same reader. */
    note: `The commonest refusal there is. Amazon wants at least ${MIN_HEIGHT.toLocaleString()}px tall and ${MIN_WIDTH} wide, no more than ${MAX_EDGE.toLocaleString()} on a side, at least ${IDEAL_RATIO}:1, and a JPEG or TIFF. We measure the file you picked — not the copy we resized to fit your browser — against those figures before you send it.`,
    figure: <CoverCheckFigure />,
  },
  {
    mark: "search",
    title: "The details do not match",
    note: "Title, author and ISBN inside the file have to match your listing down to the punctuation, and a check digit one out is a rejection with no explanation attached. Here one set of details fills both, and the arithmetic is ours.",
    figure: <ListingFigure />,
  },
  {
    /* A file, not a tick. This row's mark used to be `check`, drawn in `STOP`
       like the other two — and once the answer moved into the same column it
       sat directly above the green tick on the solution badge: one glyph, two
       colours, two opposite meanings, four lines apart. The others draw the
       noun in their heading (a shelf, a magnifier); this one draws the file. */
    mark: "formats",
    title: "The file is broken in a way Amazon hides",
    note: "Amazon's converter quietly repairs structural faults that Apple, Kobo and IngramSpark refuse outright, so the book sells for weeks before anyone finds out. The EPUB is built here rather than converted, at zero EPUBCheck errors and zero warnings.",
    figure: <ExportDoneFigure />,
  },
] as const;

/**
 * What is checkable about this page, for a reader who has been sold to.
 *
 * **Last block before the ask, which is where risk reversal belongs.** The
 * research is blunt about the audience this page has: no testimonials, no
 * customer logos, and a reader who has bought a course that taught nothing and
 * a cover that turned out to be AI. What works on that reader is not louder
 * claims — it is claims they can check without trusting anybody, plus the
 * absence of anything to lose by trying.
 *
 * Every row is *verifiable by the reader themselves*, which is the bar. Not
 * "we care about your privacy" but "open devtools" — not "trusted by
 * thousands" but "there is nobody to count yet and we are not going to invent
 * any". The last row is the one most pages would never print, and it is the
 * reason the others get believed.
 */
/**
 * What writers said, and what each one turned into.
 *
 * **This is the testimonial slot, and it holds no testimonials.** The page has
 * the same problem in this row that it has in the stat band: a landing page
 * puts customer quotes here and there are no customers, so the only ways to
 * fill it are to invent people or to put something true in it. Inventing is
 * out — on a page whose whole argument is that every claim can be checked, and
 * to a reader who has already been sold to by a course that taught nothing.
 *
 * So it carries the *research* instead: things writers said about the problem,
 * to somebody else, before this existed. Four rules keep that honest.
 *
 * - **Nobody is named and nobody is described.** Real quotes, anonymous
 *   sources, no invented "Sarah M., fantasy author" under any of them —
 *   attaching a face is the part that would make it a lie.
 * - **The section says what they are, above the quotes rather than under
 *   them.** A reader who takes only the heading has still been told these are
 *   not customers.
 * - **They are quoted, not paraphrased**, and each is recorded in the module
 *   it caused — the file named beside each one below. That is what makes this
 *   checkable in the same way as everything else here: the quote and the
 *   feature it produced sit in the same file.
 * - **Each carries what was built about it**, which is the whole reason the
 *   slot earns its place. A quote about a problem with nothing under it is
 *   decoration; a quote with the answer beneath it is the shortest version of
 *   this product's argument.
 *
 * When there are real writers using this and willing to be quoted, they
 * replace this — with names, and with their permission.
 */
const VOICES = [
  {
    /* roadmap.ts — the quote the whole ordering argument came from. */
    quote:
      "I’ve realized how absolutely essential ARCs are… Now I’m trying to get reviews for a book that has been published for a few months.",
    answer: `Why “${ARC_STEP.title}” is step ${ARC_INDEX + 1} of ${STEPS.length}, before publication rather than after it.`,
  },
  {
    /* money.ts — one of four in that file, and the least angry of them. */
    quote:
      "I look at the massive amount of money I wasted, especially on the first book.",
    answer:
      "Why the money tool works out what a book will cost before it is spent, names no company, and sells nothing.",
  },
  {
    /* cover-check.ts */
    quote: "$1000 covers are a non-starter.",
    answer:
      "Why the covers tool measures your file against a shop's published rules instead of selling you artwork.",
  },
  {
    /* ideas.ts — the shiny-idea problem, which is why the parking lot is in
       the editor's rail rather than on a screen of its own. */
    quote: "I get new shiny ideas when I’m trying to write.",
    answer:
      "Why the parking lot is in the editor's own rail: leaving the book to write the idea down is the interruption.",
  },
] as const;

const PROOFS = [
  [
    "shelf",
    "Your manuscript stays in this browser",
    "Writing, importing, page setup, the check, all four exports — none of it sends the book anywhere. The few features that do send text name themselves before they run, and the privacy page lists every one.",
  ],
  [
    "check",
    "The export is verified, not asserted",
    "EPUBCheck 5.3, zero errors, zero warnings. Run it yourself on the file you get — the checker is free and it does not take our word either.",
  ],
  [
    "formats",
    "Leaving costs nothing and needs no permission",
    "All four formats are free forever, on the free plan, with no export limit. Markdown is plain text: it opens in an editor written thirty years ago.",
  ],
  [
    "steps",
    "Nothing here is a made-up number",
    "No score, no grade, no rating out of a hundred. Every figure on this page is counted out of the source when it builds, so it cannot flatter and cannot drift.",
  ],
] as const;

const FAQ = [
  [
    "I have a finished manuscript. Where does it go?",
    "Straight in. Import a .docx, .epub, .md, .txt or .html file and it is split into chapters for you. Then the first screen tells you what stands between it and a shop — usually four or five things, most of them ten minutes each.",
  ],
  /*
   * **The question the new section invites, answered before it is asked.**
   *
   * "Two writers" reads as Google Docs to anybody who has used Google Docs, and
   * this is not that — changes travel on save, not per keystroke. Leaving that
   * to be discovered is the exact failure this page exists to avoid, and it is
   * cheaper to say plainly here than to have somebody find out with a co-writer
   * waiting. The comparison is checkable rather than a boast: Dabble's own
   * documentation states that an invitee's access depends on their own
   * subscription, so on the closest tool to this one both people pay.
   */
  [
    "Can two of us write the same book?",
    "Yes. Put somebody on a book and choose whether they can edit it or only read it — free covers you and one other, and Pro raises that. Whoever owns the book pays for the seats, so the person you invite needs an account and nothing else. What it is not is Google Docs: you will not see each other type. Changes travel when they are saved, and if you both write the same chapter at once the second save is refused rather than quietly replacing the first. Working in different chapters, which is what usually happens, needs no thought at all.",
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
    // `data-theme="light"` pins the whole page to the light set — see the note
    // above. It is the attribute the app already themes with, put on this div
    // rather than on `<html>`: the tokens are inherited variable re-points, so
    // everything under here is daylight and nothing outside it moves. That
    // covers the `lp-*` tokens and the app tokens the page borrows (`fg`,
    // `muted`, `line`, `raised`, `ok`/`note`/`stop`) in one place, which a
    // per-token override could not.
    // `lp-type` is the page's face, and it is one class rather than forty-two
    // edits: it re-points `--font-serif` for everything under it, so every
    // `font-serif` heading on this page — including the ones inside the drawn
    // figures — is set in the grotesque. See the long note in globals.css,
    // including the consequence that `font-serif` here no longer means a serif.
    <div
      data-theme="light"
      className="lp-type h-dvh overflow-y-auto bg-lp-ground text-lp-body [scroll-behavior:smooth]"
    >
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
        {/* `lg:min-h-dvh`, not `min-h-dvh`. The full screen is what gives the
            wall of cards room to be a wall; below `lg` the wall is hidden and
            the hero is a headline, a deck and two buttons, so a viewport-tall
            section there is half a screen of nothing between the sentence and
            the first thing a reader can do about it. */}
        {/* **The text block sits low rather than centred, by 2rem.** The
            section is pulled up under the header by `-mt-16`, and a headline
            optically centred in the space that leaves starts too close to the
            nav to read as the first thing on the page — it reads as the top of
            the page rather than as a sentence with room around it. The nudge
            is spent as *top padding* in both layouts, which means two
            different arithmetics for the same 2rem: below `lg` the section
            flows from its top edge, so the padding moves the text by the whole
            amount; from `lg` up it is `min-h-dvh` with `items-center`, where
            the content sits at `(H + pt − pb − h) / 2` and the padding moves
            it by half. Hence `pt-36`/`sm:pt-40` (+2rem each) against
            `lg:pt-32` (+4rem, for the same +2rem on screen). The wall is
            absolutely positioned and does not move with any of it. */}
        <section className="relative -mt-16 flex items-center overflow-hidden border-b border-lp-line bg-lp-tint px-6 pt-36 pb-16 sm:pt-40 sm:pb-20 lg:min-h-dvh lg:pt-32 lg:pb-16">
          {/* ---- No backdrop -------------------------------------------

              The hero carried a photographic gradient — `public/hero-{dark,
              light}.webp` through `--lp-hero`, with a veil layer over it — and
              it is gone. It was built for a *centred* hero with nothing beside
              the headline, where a soft wash was the only thing giving the
              section any depth. The wall of cards does that job now, and does
              it with real content: two coloured images competing across one
              screen made the cards look like they were floating on somebody
              else's photograph.

              The floor is `bg-lp-tint` — the accent at about 8%, the same
              ground the page's other lit band uses — which is what the image
              was always painted over anyway.

              **The assets and their tokens are deliberately left in place.**
              `--lp-hero` and `--lp-hero-veil` are still declared in
              globals.css with the long note recording the contrast ratio each
              anchor and size buys against the headline; that measurement is
              expensive to redo and the images are ~9KB each. Putting the
              backdrop back is re-adding these two divs. */}

          {/* ---- The wall ----------------------------------------------

              **Outside the content container, on purpose.** Every section on
              this page holds its content in the same `max-w-6xl` measure, and
              the headline has to start on that margin like every heading below
              it — a hero whose first line begins further left than the rest of
              the page is the commonest way a site looks like two designs. But
              the wall is a *bleed*: it has to run off the right edge of the
              window, because a wall of cards that stops neatly inside a
              container is a gallery, and what this is meant to say is that
              there is more of this than the page has room for.

              So it is absolutely positioned against the section rather than
              placed in the grid: the text keeps the site's margin, the wall
              keeps the viewport. `overflow-hidden` on the section is what
              stops the bleed becoming a horizontal scrollbar. */}
          {/* No width of its own — an absolutely positioned box sizes to its
              contents, and the contents are two columns whose width is already
              a clamp. Giving it a `vw` width instead left a few hundred pixels
              of nothing between the last column and the window edge on a large
              screen, which reads as a wall that failed to load rather than as
              one running off the page.

              **`right-2`, not a negative offset.** It bled 2rem off the right
              at first, on the reasoning that a cropped figure says there is
              more of it than the page has room for. That is true of a *single*
              cropped object and false of a column of them: the second column
              simply looked like it had not finished loading, and the card
              titles were cut mid-word. Both columns are whole now and the
              wall says what it has to say by being taller than the screen
              instead.

              **`top-16` rather than `inset-y-0`, and the 16 is not a guess.**
              The section is pulled up under the header by `-mt-16`, so a wall
              spanning it ran *behind* the nav — and this header carries no
              ground of its own at the top of the page, by design, so "Tools"
              and "Pricing" ended up sitting directly on a lilac card. The
              offset that puts the wall's top edge exactly on the header's
              bottom line is therefore **the same 4rem the section was pulled
              up by**, whatever height the header happens to render at: the
              section's top sits `headerHeight − 4rem` from the viewport, so
              `4rem` down from there is `headerHeight`. That is why these two
              numbers must stay equal — `top-32` was tried and left a 64px band
              of empty tint under the bar, which is exactly the header's height
              counted twice. */}
          <div className="pointer-events-none absolute top-16 right-2 bottom-0 hidden lg:block">
            <HeroWall />
          </div>

          <div className="relative mx-auto w-full max-w-6xl">
            {/* The text stops at half the measure from `lg` up, where the wall
                begins. Without the cap the headline would run under the first
                column of cards — and `overflow-hidden` on the section means it
                would not even scroll into view, it would simply be gone. */}
            <div className="lg:max-w-[32rem] xl:max-w-[38rem]">
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
                not four weeks. The nearest real span in this product is the
                six weeks `arc.ts` works back for advance copies — a sourced
                figure attached to an entirely different problem. Borrowing it here
                would have been the invented number this app refuses everywhere
                else, on the first line a reader sees.

                "Before you upload it" needs no defending, and it is the better
                line anyway: it names the reader's own action rather than the
                shop's, which is the decision actually in front of them.

                Line one is muted indigo rather than grey, so the two read as one
                sentence at two volumes rather than as grey text with a coloured
                answer stapled underneath.

                At night the two swap: line one goes plain white and line two
                keeps the hue. A muted indigo has nowhere to sit on black —
                neither bright enough to lead nor dark enough to recede — so
                the same two-volume sentence is drawn with the volumes the
                other way round. Both values live on `lp-accent-soft`; see the
                note there. */}
              {/* **Three lines, and the breaks are written rather than left to
                the box.** The headline shares its screen with the wall now, so
                it has roughly half the width it used to and wraps where the
                measure happens to run out — which landed the fold mid-phrase
                and changed with every window size. Set as three, it reads as
                three deliberate beats and the shape of the block is the same
                at every width it is drawn at.

                **The sizes are measured, not chosen.** The longest line here
                is "Nobody sees your book" at 21 characters, and a line that
                length set in this face at this weight and tracking runs 476px
                at 48px and 555px at 56px — against the 512px and 608px the
                caps above allow once the wall has taken its side. Those are
                the largest steps that hold three lines with a real gutter left
                between the text and the first column of cards. Change a size,
                the caps, or the wall's own clamp, and all three have to be
                re-checked together.

                **The break falls after "until", not after "until you".** Both
                fit the measure. That one ends the quiet half on a whole
                preposition, and it lets the loud half open on "you" — the only
                word in the sentence that is about the reader. */}
              <h1 className="oc-display font-serif text-[2rem] leading-[1.1] font-semibold sm:text-[2.75rem] sm:leading-[1.05] lg:text-[3rem] xl:text-[3.5rem]">
                <span className="block text-lp-accent-soft">
                  Nobody sees your book
                  <br />
                  in the shop until
                </span>
                <span className="block" style={{ color: INK_TEXT }}>
                  you upload it right.
                </span>
                {/* **The reassurance, marked.** The three lines above are the
                  problem, and a hero that stops there has told a writer they
                  are in trouble and left. This line is the answer, and it is
                  the one thing on the page wearing the highlighter — see the
                  `--color-lp-marker` note in globals.css for why that pen is
                  allowed at all and why it may only be used once.

  **"We help you do it", and both halves of that are load-bearing.**
                  *Help* rather than *fix*, because `checkup()` finds the
                  problem and hands back the control that mends it — the writer
                  presses it. Promising to fix somebody's book, in the largest
                  type on the site, to the audience most likely to test the
                  claim, is the one sentence this page cannot afford.

                  And *do it* rather than *fix it*, which was the first draft:
                  "it" attaches to the nearest noun, and the nearest noun is
                  "your book" — so "we'll fix it" read as *we will edit your
                  manuscript*, which is the thing the assistant is famously not
                  allowed to do. Nobody *does* a book, so the verb pins the
                  reference to the upload instead.

                  `box-decoration-break: clone` is not optional — a marked span
                  that wraps otherwise gets its band only on the first and last
                  line. `w-fit` keeps the pen to the words rather than letting
                  it run the width of the block. */}
                <span
                  style={{
                    backgroundColor: "var(--color-lp-marker)",
                    color: "var(--color-lp-marker-ink)",
                  }}
                  className="mt-3 box-decoration-clone inline-block w-fit rounded-md px-2.5 py-0.5"
                >
                  We help you do it.
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
              {/* **It answers the question the headline provokes**, which the
                deck before it did not: "upload it right" is only a warning
                until somebody says what *right* means. Five nouns say it, and
                the second sentence gives the consequence in the reader's own
                terms — filed where nobody looks — rather than in the shop's
                word, "rejected", which sounds like a verdict on the writing.

                **Set heavier and darker than the page's other decks.** It is
                the only one carrying the load-bearing half of a headline, and
                at `lp-body` it read as a caption under the loud line rather
                than as the second half of the sentence. `lp-soft` and medium
                weight; still a step under the ink of the headline itself, or
                the two compete. */}
              {/* **It answers the question the headline provokes** — "upload it
                right" is only a warning until somebody says what *right*
                means. Five nouns say it, and the second sentence gives the
                consequence in the reader's own terms, filed where nobody
                looks, rather than in the shop's word "rejected", which sounds
                like a verdict on the writing.

                The promise that used to end this line has moved up into the
                headline, where it is marked. Two highlighted phrases on one
                screen and neither is highlighted. */}
              <p className="oc-lead mt-6 max-w-xl font-serif text-xl leading-relaxed font-medium text-lp-soft sm:mt-7 sm:text-[1.375rem]">
                Cover, ISBN, blurb, categories, keywords. Get one wrong and the
                shop files your book where nobody looks.
              </p>

              {/* Smaller and quieter than they were, because they are no longer
                the only way forward on this screen: the check below is, and
                two full-sized pills directly above a drop zone made three
                primary actions competing inside one viewport. A reader who
                arrived ready to sign up still finds them first; a reader who
                arrived sceptical — which the research says is most of them —
                gets to test the claim before being asked for anything. */}
              {/* On a phone they stack and go full width, capped at `max-w-xs`
                so they do not run the whole way across a tablet held upright.
                Two pills of *different* widths centred one above the other is
                the commonest tell of a desktop layout that was never looked at
                on a phone — the eye reads the ragged left edges as a mistake
                before it reads either label. `items-stretch` is what does it:
                the Google control renders its own `<form>`, so the button
                inside can only fill the width the form is given. */}
              <div className="mt-8 flex w-full max-w-xs flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-start">
                <Link
                  href="/signup"
                  style={{ backgroundColor: INK }}
                  className="w-full rounded-full px-6 py-3 text-center text-[0.9375rem] font-semibold text-lp-accent-ink hover:opacity-90 sm:w-auto"
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
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-lp-edge bg-lp-ground px-6 py-3 text-[0.9375rem] font-semibold text-lp-ink hover:border-lp-edge-strong sm:w-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ---- The logo strip -------------------------------------------

            The row a landing page fills with customer logos, and we have none
            to put there — a wall of publishers' marks would be inventing them.
            So it names the places a finished manuscript *goes*, which is both
            true of the export pipeline and the thing a writer is actually
            nervous about: not who else is here, but whether the book comes out
            again.

            **It sits directly under the hero now, which is a reversal.** It
            used to come after the three refusals, on the argument that a
            reassurance before the fear has been named answers a question
            nobody asked — put second, it became the fear's first reply. That
            reading is still true and was traded away deliberately: this is the
            slot every reader has been trained to find a logo strip in, and a
            visitor who has just dropped their manuscript into the check above
            is asking one question — *does my book come back out* — which is
            the one this row answers. If it moves back, move this note with it.

            **Set as one plain row, no format tags.** Seven names with a
            monospace format code beside each wrapped to two lines and read as
            a table of specifications. Five real ones on a single line, under a
            quiet caption, reads as what it is. The formats are not lost — the
            counted band below says four, and the footer names one per badge —
            and each row still carries its own in a `title`.

            Real marks in their real colours, which is the documented exception
            to this page's greyscale: a strip like this works on instant
            recognition, and Microsoft's four squares flattened to one grey is
            the *monochrome* mark, a different one from the mark people know.
            Sourcing and licences are recorded in `works-with.tsx`. Nominative
            use: these are programs that open our exports, not partners or
            customers. */}
        <section className="border-b border-lp-line px-6 py-10 sm:py-12">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-[0.8125rem] text-lp-faint">
              Your book comes back out — and opens in
            </p>
            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:mt-8 sm:gap-x-12">
              {STRIP.map((destination) => (
                <li
                  key={destination.name}
                  className="flex items-center gap-2.5"
                  title={`${destination.name} — opens the ${destination.format} export`}
                >
                  <svg
                    viewBox={destination.mark.viewBox}
                    aria-hidden="true"
                    className="h-[22px] w-[22px] shrink-0"
                  >
                    {destination.mark.paths.map((path) => (
                      <path key={path.d} d={path.d} fill={path.fill} />
                    ))}
                  </svg>
                  <span className="text-[0.9375rem] font-semibold tracking-tight text-lp-soft">
                    {destination.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- The claim, kept ------------------------------------------

            The headline promises the reader they can find out what is wrong
            with their book before they upload it. This is that, working, on
            their book — the real readiness check out of `checkup.ts`, running
            in their browser, with no account and nothing uploaded.

            It replaced a drawn still of the Overview screen. The still was
            honest and well made, but it was making a screenshot's argument —
            *here is a product, imagine it on yours* — to a reader who has been
            shown convincing screenshots by people who then sold them a course
            that taught nothing. Every other claim on this page is checkable by
            reading it; this is the one that is checkable by using it, and it
            is the only block here a competitor cannot answer with a nicer
            illustration.

            It is also the page's own rule turned on itself: the figures are
            drawn from the source so they cannot go stale, and this one cannot
            go stale at all, because it *is* the source.

            **It sits below the strip rather than inside the hero, which is a
            move.** It was under the deck, four inches from the promise, and
            that was the stronger placement for it alone. The hero now carries
            the wall instead, and two things competing for one screen — an
            ambient animation and the only working control on the page — is
            worse than either: a reader is either watching or doing. Given its
            own band, directly after the strip that says the book comes back
            out, the check is the first thing on the page a reader can *use*
            and has nothing beside it. */}
        {/* **A badge, a centred line, then the device — in that order and at
            that scale.** The check used to open cold on its own card, which
            left the one *usable* thing on the page introduced by nothing. The
            pill sets the frame in three words, the line says what the thing
            below it does, and both are centred over it rather than set to the
            left, because what follows is one wide object rather than a column
            of prose.

            The heading is `oc-heading`, not `oc-display`: this is a section
            title, and at hero size it would compete with the one line the page
            actually needs to land. */}
        {/* `id="check"` is what the three refusal cards link back to — the only
            destination on the page that answers all three of them, and a real
            control rather than a promise of one. `scroll-mt` clears the fixed
            header, or the jump lands with the heading under the nav. */}
        <section
          id="check"
          className="scroll-mt-20 border-b border-lp-line bg-lp-tint-soft px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <span
                style={{
                  color: INK_TEXT,
                  backgroundColor:
                    "color-mix(in srgb, var(--color-lp-accent) 10%, transparent)",
                }}
                className="inline-block rounded-full px-3 py-1 font-code text-[0.625rem] font-semibold tracking-[0.18em] uppercase"
              >
                Free, no sign-up
              </span>
              {/* The same scale as every other section title. It was
                  deliberately a step down, on the reasoning that a heading
                  this close under the hero would compete with it — and that
                  reasoning is now spent, because every heading on the page is
                  this size and one exception reads as the odd one rather than
                  as deference. `max-w-4xl` keeps it to two lines at the new
                  size. */}
              <h2
                className={`oc-display mx-auto mt-5 max-w-4xl font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                Find out what a shop would refuse, in ten seconds.
              </h2>
            </div>

            <div className="mt-10 sm:mt-12">
              <BookCheck />
            </div>
          </div>
        </section>

        {/* ---- What actually goes wrong ---------------------------------

            **The problem section, placed before anything is sold.**

            The reader has just been told they can find out what is wrong
            before they upload, and has been handed a box to prove it. This
            says what "wrong" means — three documented refusals, in the order
            of how often they happen, each with the thing on our side of it.

            It sits *above* the logo strip on purpose. The strip is a
            reassurance ("your book comes back out"), and a reassurance before
            the fear has been named is an answer to a question nobody asked.
            Named first, the strip becomes its first reply.

            **Three cards in one section, rather than a band each.** They were
            full-bleed bands with alternating grounds and the figure changing
            sides, which gave each refusal the weight of a chapter — and three
            chapters is more than this idea is worth to a reader who has not
            yet been told what the product does. Set as cards they are a list
            of three, which is what they are, and the section reads as one
            beat instead of four.

            **Each card is a tinted panel holding the words and the screen.**
            The order is the same in all three — badge, title, description,
            control on the left; the screen on the right — because the point
            of a list is that its items are read the same way. Alternating the
            sides was tried while these were bands and is wrong here: at card
            width the eye has to hunt for where each one starts.

            No timescales are claimed for any of them: how long a rejection
            costs depends on the shop, the queue and the writer, and the one
            number this page could honestly print there is nought. */}
        <section className="border-b border-lp-line px-6 pt-14 pb-16 sm:pt-20 sm:pb-20">
          <div className="mx-auto max-w-6xl">
            <Head
              center
              eyebrow="Before you upload"
              title="Three ways a finished book gets turned away"
              lead="None of them is about the writing. All are knowable while the file is still on your machine."
            />

            <ul className="mt-12 space-y-5 sm:mt-14 sm:space-y-6">
              {REJECTIONS.map((rejection, i) => (
                <Rejection
                  key={rejection.title}
                  n={String(i + 1).padStart(2, "0")}
                  mark={rejection.mark}
                  title={rejection.title}
                  note={rejection.note}
                  figure={rejection.figure}
                  tint={CARD_TINTS[i % CARD_TINTS.length]!}
                />
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Where the counted band was --------------------------------

            Four figures — steps, tools, formats, EPUBCheck errors — in the row
            a SaaS page fills with users and downloads. It is gone, and what it
            *stood for* is not: the rule it existed to enforce still holds, that
            nothing may go in that slot which cannot be counted out of the
            source, and that no user count, rating or testimonial goes there
            until there is a real one.

            Every one of those four figures is still on the page, in the place
            that gives it a meaning: the step count and the phases in "The
            order", the tool count in the heading of the tools section, the
            four formats in the strip under the hero and in the footer, and the
            zero in "The export is verified, not asserted". Four numerals on a
            band of their own asked a reader to be impressed by an arithmetic
            they had not been given a reason to care about yet.

            `Counted`, the component that drew one cell, went with it. It is
            twenty lines of presentation and every figure it read is imported
            elsewhere on this page, so keeping it callerless would have bought
            nothing but a standing lint warning — unlike `templates-dialog.tsx`
            and the coming-soon dialog, which are whole features waiting on a
            way in. */}

        {/* ---- Three up, one lit ---------------------------------------- */}
        <section
          id="does"
          className="border-b border-lp-line px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-6xl">
            <Head
              center
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

        {/* ---- The order, as a road you travel down ----------------------

            **The one section on this page whose figure is the argument.** It
            was a two-column split — a paragraph beside a boxed list of five
            phases — and a boxed list is a picture of the very thing the page
            says nobody's problem is. What a writer is short of is not five
            names, it is the road between them and where on it they are
            standing. So the phases are stations on one line, and a marker
            rides it as the reader scrolls: the station being read is at full
            strength and the rest sit at a floor.

            `OrderPath` carries the whole of how that works, including why the
            dimming is allowed here and nowhere else on the page. The two
            sentences under it are the ones the old column carried that the
            stations do not say for themselves. */}
        <section
          id="order"
          className="scroll-mt-20 border-b border-lp-line px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-6xl">
            <Head
              center
              eyebrow="The whole point"
              title="The order"
              lead={`${STEPS.length} steps, ${PHASES.length} phases. The software is the least of it; the sequence is the thing nobody hands you.`}
            />

            {/* The road is drawn on a field of its own, and the section around
                it is left as plain ground so that field reads as one object.
                It was the other way about — a tinted section with the road
                loose on it — which made the road part of the page's furniture
                rather than a thing the page had put down in front of you. */}
            <div className="mt-14 sm:mt-16">
              <OrderPath stations={ORDER_STATIONS} />
            </div>

            <p className="mx-auto mt-16 max-w-prose text-center leading-relaxed sm:mt-20">
              <strong className="text-lp-ink">
                {SELF_TICKING} of the {SELF_TICKING + YOURS_TO_TICK} steps tick
                themselves
              </strong>{" "}
              from what is already in your book — no checklist to maintain, and
              nothing that can be lied to by accident. There is a test in the
              codebase asserting that the advance-copy step stays where it is.
              If it ever moves, the build fails.
            </p>
          </div>
        </section>

        {/* ---- Prepare --------------------------------------------------

            **Stacked, not split, and the figure decides it.** This was words
            left and the product right, with the figure pinned while the claims
            scrolled past. It was a good arrangement for reading and a bad one
            for the thing being read: `CheckDemo` is a whole dashboard drawn at
            760 design px whose *content is 11px labels* — a finding, and the
            button that fixes it — and a column can never be wide enough for
            them. On the larger half of `max-w-6xl` it scaled to about 0.8 and
            the labels went to texture, which is the difference between a
            picture of a product and a picture of a product you can read. It
            also ran off the right edge of the viewport, which is what a fixed
            aspect ratio does when the column it is in is narrower than the
            picture wants.

            So the section centres: header, then the figure at its own full
            width, then the claims underneath in two columns. The figure now
            scales *up* rather than down, and the one thing this section exists
            to show — the fix sitting on the problem — is legible at a glance
            instead of needing to be leant into.

            **It is set on a black panel, inset from the page.** Everywhere
            else the page alternates two tints and keeps one voice; here it
            stops arguing and demonstrates, and going dark is how a keynote
            marks that change of mode. It earns it twice over. The figure is a
            *drawn light interface* — by day a white app on black, which is the
            strongest contrast available on the page and puts every one of
            those 11px labels on its own ground. And the panel is inset with
            the page showing down both sides and around the corners, so it
            reads as a stage the product is standing on rather than as another
            full-bleed band in the stack.

            The ink inside it is a palette of its own (`lp-stage-*`) that does
            *not* invert with the theme, because the surface does not either —
            see the note in globals.css.

            The figure replaced a drawn still of the export screen's readiness
            list. The still could show that the app lists problems; only the
            moving one shows the fix sitting *on* the problem, which is the
            claim this section is actually making. */}
        {/* Near full-bleed, with a thin gutter rather than a container width.
            Capped at `max-w-7xl` the panel left a hand's width of page down
            both sides on any wide screen, which made it read as a very large
            card sitting *in* the layout. The reference this is built to runs
            the dark almost to the glass and keeps only enough page to show the
            rounded corner — so the stage is the width of the window and the
            gutter is a detail, not a margin. The content inside keeps its own
            measures, so nothing stretches with the viewport. */}
        <section className="px-2 py-10 sm:px-4 sm:py-12">
          <div className="rounded-[1.25rem] bg-lp-stage px-4 py-14 sm:rounded-[1.5rem] sm:px-8 sm:py-16">
            <Head
              center
              stage
              eyebrow="Before you upload"
              title="Find out from us, not from a rejection"
              lead="A shop refusing your upload is a slow, silent thing. This names what would stop it, and what merely costs you readers."
            />

            {/* The figure, centred, and deliberately smaller than the panel it
              sits on: about three fifths of it, so there is a full hand's
              width of black down either side. A screen that fills its stage is
              a section with a picture in it; one with room around it is a
              thing being *presented*, which is the whole reason this section
              went dark.

              **760px is the floor and it is a hard one.** The stage is a fixed
              design exactly that wide, so anything under it drops the scale
              below 1, shrinks the 11px labels under native size, and the
              findings stop being readable — which is the one thing this figure
              exists to show. `max-w-4xl` (896) puts it at 1.18, comfortably
              clear of that and still well short of about 1100, past which it
              stops reading as a screen and starts reading as the page. */}
            <div className="mx-auto mt-10 max-w-4xl sm:mt-14">
              <WideFigure>
                <CheckDemo />
              </WideFigure>
            </div>

            {/* **The four headings are the list; the notes are the footnotes.**
              Set a step apart on the page's own scale — 24px serif against 14px
              sans — they can be read on their own, in order, without a word of
              the small text, which is how a reader who has just watched the
              screen above them actually arrives. Closing that gap made four
              paragraphs with bold first lines, and the eye had nowhere to land.

              Two columns rather than four: three of these headings run to five
              or six words, and in a quarter of the container they break to four
              lines each and the row reads as a wall. Two gives every heading at
              most two lines.

              **The marks carry no tile.** A boxed icon is a *control* — the
              same shape as the chips inside the figure above — and four of them
              promised four buttons. Naked, they are what they are: a mark on
              the ground, in the way-forward indigo. Bigger and heavier to earn
              that (28px at weight 2), because stroke width is in user units and
              a glyph scaled up keeps its hairline and quietly reads lighter.
              On the black it takes the stage's own lightness of that indigo —
              the page's #312e81 is a smudge down here. */}
            <ul className="mx-auto mt-14 grid max-w-4xl gap-x-12 gap-y-9 sm:mt-16 sm:grid-cols-2">
              {PREPARE.slice(0, 4).map(([name, note], i) => (
                <li key={name} className="flex gap-4">
                  <span className="mt-1 shrink-0 text-lp-stage-accent">
                    <Icon
                      name={PREPARE_MARKS[i]!}
                      className="h-7 w-7"
                      weight={2}
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="oc-heading font-serif text-xl leading-snug text-lp-stage-ink sm:text-2xl">
                      {name}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-lp-stage-body">
                      {note}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Outlined rather than filled, which is the opposite of every
                other instance of this box on the page. A white card here would
                be a second lit rectangle competing with the screen above it —
                on black, a hairline is enough to make a box, and the caveat
                should be quieter than the thing it qualifies. Centred and
                narrow, or a caveat at the full width of the claims above reads
                as a fifth claim. */}
            <p className="mx-auto mt-12 max-w-2xl rounded-xl border border-lp-stage-line p-4 text-center text-sm leading-relaxed text-lp-stage-body">
              <strong className="text-lp-stage-ink">About the PDF.</strong> A
              clean interior file at your trim size with fonts embedded — not a
              pre-press file. No bleed, no crop marks, no CMYK, because it comes
              from your browser’s print engine.
            </p>
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
          figure={
            <WideFigure>
              <StoreListingDemo />
            </WideFigure>
          }
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
                <p className="oc-heading font-serif text-lg text-lp-ink">
                  {name}
                </p>
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
        <section
          id="tools"
          className="border-b border-lp-line px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-6xl">
            <Head
              center
              eyebrow="All of it included"
              title={`${ALL_TOOLS.length} tools, nothing held back`}
              lead="Every one works on a real book, and none is behind the paid plan."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {TOOL_GROUPS.map((group, i) => (
                <div
                  key={group.title}
                  // The first group gets the wide cell *and* the brand ground:
                  // "the parts a shop sees" is the question this audience
                  // arrives with, so it is the one that should be read first.
                  className={`rounded-2xl border p-6 ${
                    i === 0
                      ? "text-lp-accent-pale md:col-span-2"
                      : "border-lp-edge"
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
        <section className="border-b border-lp-line bg-lp-tint-soft px-6 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl">
            {/* The lead was two sentences and is now one, which cost nothing:
                the second half — that a no with nothing behind it is a feature
                we are missing — is *demonstrated* by the table's right-hand
                column rather than needing to be announced above it. */}
            <Head
              center
              eyebrow="Straight answer"
              title="What we will not do, and what we do instead"
              lead="We say no in public so you can plan around it, and each no carries the work we did instead."
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
        {/* ---- Two writers ---------------------------------------------- */}
        {/*
          **Placed after the tools and before the refusals, not in the hero.**

          The page's argument is "nobody tells you the order", and that is the one
          claim a competitor cannot answer by shipping a feature. Co-writing is a
          different axis — genuinely attractive, and not what this page is about —
          so it earns a section rather than the headline. Putting it higher would
          trade the sharpest thing on the page for a feature several other tools
          also have.

          Everything countable here is imported: the seat numbers come from
          `SEATS_PER_BOOK`, which is also what the database enforces and what the
          pricing page prints. Nothing on this page may restate a figure.

          The competitive line is checkable and that is why it is here at all.
          Dabble's own documentation says "the invitee's access depends on their
          own subscription level, not the project owner's" — so on the tool
          closest to this one, both people pay. Ours is the owner's plan, and a
          reader can verify that by being invited.
        */}
        {/* **The pain named honestly, which is the whole difficulty with this
            section.** Writers do not finish, and the research says so loudly —
            but *why* they do not finish is motivation, time and self-doubt,
            and this app's own build list files all three under "no tool fixes
            these". A share feature is not an accountability system, and a
            heading promising it would make you finish is the exact claim this
            page refuses everywhere else, aimed at the audience that checks.

            So the headline names the situation — nobody is waiting for the
            next chapter — and offers the action rather than the outcome. The
            first line of the body says outright that finishing is not
            something software can give you. On a reader who has been sold to
            by four other tools, that line is doing more work than any promise
            would.

            **One section, in a card, on a tinted ground.** It replaced a plain
            three-bullets-and-a-figure band: the layout is contained now, so
            the copy and the drawn panel read as one object rather than as two
            columns of a page. The three checkable claims survive as a strip
            along the foot of the card — quieter than they were, and still
            there, because they are the half of this section a competitor
            cannot copy.

            The competitive line is checkable and that is why it is here at
            all. Dabble's own documentation says "the invitee's access depends
            on their own subscription level, not the project owner's" — so on
            the tool closest to this one, both people pay. Ours is the owner's
            plan, and a reader can verify that by being invited.

            Every figure is imported: the seat numbers come from
            `SEATS_PER_BOOK`, which is what the database enforces and what the
            pricing page prints. Nothing on this page may restate a number. */}
        <section className="border-b border-lp-line bg-lp-tint-soft px-6 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-[1.75rem] border border-lp-edge bg-lp-ground p-6 sm:p-10 lg:p-12">
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-14">
                {/* ---- The ask ----------------------------------------- */}
                <div>
                  <p className="font-code text-[0.6875rem] font-semibold tracking-[0.18em] text-lp-faint uppercase">
                    Two writers
                  </p>
                  {/* Two lines, the second in the accent — the reference's own
                      headline shape. Line one is the reader's situation, line
                      two is the thing they can do about it. Deliberately not
                      "and you will finish it": the section is allowed to name
                      a pain it does not claim to cure. */}
                  <h2 className={`oc-display mt-4 font-serif ${SECTION_TITLE}`}>
                    No one is waiting for chapter twelve.
                    <br />
                    <span style={{ color: INK_TEXT }}>
                      Put somebody in the book.
                    </span>
                  </h2>

                  <p className="oc-lead mt-6 max-w-md font-serif text-lg leading-relaxed">
                    <strong className="text-lp-ink">
                      Nothing here will make you finish it.
                    </strong>{" "}
                    Nothing can. What you can stop doing is writing into a void:
                    put one person on the book — a co-writer, an editor, whoever
                    keeps asking how it is going — and they can read what you
                    wrote this week, or write the next chapter themselves.
                  </p>

                  <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-lp-faint">
                    It is not Google Docs. You will not see each other type —
                    changes travel when they are saved.
                  </p>

                  <Link
                    href="/signup"
                    style={{ backgroundColor: INK }}
                    className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink hover:opacity-90"
                  >
                    Share a book, free
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M5 12h13m-5.5-5.5L18.5 12l-6 5.5" />
                    </svg>
                  </Link>
                </div>

                {/* ---- The panel ---------------------------------------

                    Filled with the brand accent rather than the reference's
                    lime. This page spends exactly one hue and this is it —
                    a second colour invented for one panel is how a palette
                    starts lying, and the accent is already what the closing
                    banner is filled with, so the two read as the same
                    product.

                    Drawn in markup, never screenshotted: a picture of this
                    app goes stale silently while the app moves, on the one
                    page whose whole pitch is being checkable. It quotes the
                    product's own role labels, so it can only be wrong if the
                    product is. */}
                <div
                  role="img"
                  aria-label={`The collaborators panel for a book shared with one other writer: the owner, and somebody who can edit. A free book holds ${SEATS_PER_BOOK.free} people including you; Pro holds ${SEATS_PER_BOOK.pro}.`}
                  style={{ backgroundColor: INK }}
                  className="rounded-2xl p-6 sm:p-8"
                >
                  <p className="font-code text-[0.625rem] tracking-[0.16em] text-lp-accent-pale uppercase">
                    On this book
                  </p>

                  <div aria-hidden="true" className="mt-5 space-y-2.5">
                    <div className="flex items-center gap-3 rounded-xl bg-lp-accent-ink/10 px-3.5 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lp-accent-ink text-[11px] font-bold text-lp-accent">
                        You
                      </span>
                      <span className="oc-heading flex-1 font-serif text-lp-accent-ink">
                        You
                      </span>
                      <span className="font-code text-[0.625rem] tracking-[0.12em] text-lp-accent-pale uppercase">
                        Owner
                      </span>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl bg-lp-accent-ink/10 px-3.5 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lp-accent-ink/40 text-[11px] font-bold text-lp-accent-ink">
                        A
                      </span>
                      <span className="oc-heading flex-1 truncate font-serif text-lp-accent-ink">
                        your co-writer
                      </span>
                      <span className="rounded-md border border-lp-accent-ink/30 px-2 py-1 font-code text-[0.625rem] tracking-[0.12em] text-lp-accent-ink uppercase">
                        Can edit
                      </span>
                    </div>

                    {/* The empty seat. A wall of filled rows says "this is what
                        a shared book looks like"; one empty row says "there is
                        room for somebody", which is the actual invitation. */}
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-lp-accent-ink/30 px-3.5 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-lp-accent-ink/40 text-lp-accent-pale">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          className="h-4 w-4"
                        >
                          <path d="M12 6v12M6 12h12" />
                        </svg>
                      </span>
                      <span className="flex-1 text-[0.9375rem] text-lp-accent-pale">
                        Invite by email
                      </span>
                    </div>
                  </div>

                  <p className="mt-6 border-t border-lp-accent-ink/20 pt-5 text-[0.9375rem] leading-relaxed text-lp-accent-pale">
                    <strong className="font-semibold text-lp-accent-ink">
                      {SEATS_PER_BOOK.free} people
                    </strong>{" "}
                    on a book, free — including you.{" "}
                    <strong className="font-semibold text-lp-accent-ink">
                      {SEATS_PER_BOOK.pro}
                    </strong>{" "}
                    on Pro.
                  </p>
                </div>
              </div>

              {/* The three checkable claims. Quieter than the bullet list they
                  replaced and still here, because they are the half of this
                  section a funded competitor cannot copy — each one is a
                  thing a reader can verify by being invited. */}
              <ul className="mt-10 grid gap-7 border-t border-lp-line pt-8 sm:grid-cols-3 sm:gap-8">
                {[
                  [
                    "Two levels, both enforced",
                    "Can edit writes the chapters. Can view reads and exports, and changes nothing — refused by the database, not just hidden on screen.",
                  ],
                  [
                    "The owner pays, not the guest",
                    "Whoever owns the book covers its seats. The person you invite needs an account and nothing else.",
                  ],
                  [
                    "Their half stays theirs",
                    "Chapters and notes travel. Your story bible, ledger and writing record do not — and the app says so before you share, not after.",
                  ],
                ].map(([name, note]) => (
                  <li key={name}>
                    <div className="flex items-center gap-2.5">
                      <span style={{ color: PASS }} className="shrink-0">
                        <Icon
                          name="check"
                          className="h-[17px] w-[17px]"
                          weight={2.4}
                        />
                      </span>
                      <p className="oc-heading font-serif text-[1.0625rem] text-lp-ink">
                        {name}
                      </p>
                    </div>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed">
                      {note}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-b border-lp-line px-6 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Head
              center
              eyebrow="Not built yet"
              title="What comes after that"
              lead="Listed so you can hold us to the difference between a plan and a product. No dates: a date is a promise with a number on it."
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

        {/* ---- FAQ ------------------------------------------------------

            **Two columns: the invitation on the left, the questions on the
            right.** Stacked under one centred heading, a dozen closed rows
            read as a support page — a list to be searched rather than a
            conversation. Held beside a heading that stays put, the same rows
            read as answers to somebody, which is what they are.

            The left column ends in a real way to ask something the list does
            not cover, and that is the half most FAQ sections leave out: a
            reader whose question is not on the list has just been told, by
            omission, that there is nowhere to put it. The address and the
            reply time come from `legal.ts`, so what this promises is what the
            contact page promises.

            The rows are `<details>` — the browser's own disclosure, so it
            works with no JavaScript, is announced correctly, and the page can
            be searched with the browser's own find. The circle on the right is
            drawn rather than the default marker, and it is one glyph with its
            upright stroke turned off when open, which is the whole of the plus
            becoming a minus. */}
        <section className="border-b border-lp-line px-6 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-20">
            {/* **The left column is written out rather than using `Head`**, and
                it is the one section on the page where that is right. Every
                other heading is a title over the thing it names; this one is
                half the composition — it stands beside a column of rows and
                has to hold that whole side on its own, which means a display
                size, a three-line stack and a description under it. Pushing
                `Head` to do that would have meant a size prop, and a size prop
                on the page's one heading component is how eleven headings end
                up at nine sizes. */}
            <div>
              {/* The dot is what turns a line of small caps into a *label*.
                  It costs one span and it is the difference between an
                  eyebrow that reads as a heading somebody forgot to size and
                  one that reads as a marker on the section. */}
              <p className="flex items-center gap-2.5 font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-lp-faint"
                />
                Questions
              </p>

              {/* The same scale every other section title takes — see
                  `SECTION_TITLE`. The column is hand-written; the type is not. */}
              <h2 className={`oc-display mt-6 font-serif text-lp-ink ${SECTION_TITLE}`}>
                Reasonable suspicion, answered
              </h2>

              <p className="mt-6 max-w-sm leading-relaxed">
                Every one of these is a question this audience actually asks
                before paying for anything. Still have one? One person answers,
                usually within {REPLY_DAYS} days.
              </p>

              <Link
                href="/contact"
                style={{ backgroundColor: INK }}
                className="mt-8 inline-block rounded-full px-6 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink hover:opacity-90"
              >
                Contact us
              </Link>
            </div>

            {/* The rows carry a rule *above* each rather than below, so the
                list opens with a line at the top edge of the first question
                and closes with one under the last — the shape the reference
                has, and the one that reads as a table of contents rather than
                as a stack of cards that lost their borders. */}
            <div className="flex flex-col border-b border-lp-line lg:pt-1">
              {FAQ.map(([q, a], i) => (
                <details
                  key={q}
                  open={i === 0}
                  className="group border-t border-lp-line"
                >
                  {/* `list-none` and the WebKit rule together: Safari draws its
                      triangle through a pseudo-element the standard property
                      does not reach, so one without the other leaves a marker
                      in exactly one browser. */}
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-8 py-6 [&::-webkit-details-marker]:hidden sm:py-7">
                    <span className="oc-heading font-serif text-[1.125rem] leading-snug text-lp-ink transition-opacity group-hover:opacity-70 sm:text-xl">
                      {q}
                    </span>
                    {/* **A bare plus, not a circled one.** The ring was doing
                        the work of a button, and this is not one — pressing
                        anywhere on the row opens it. Without the ring the mark
                        reads as punctuation on the line, which is what it is,
                        and the row stops looking like a control with a label
                        beside it. */}
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      className="h-5 w-5 shrink-0 text-lp-faint transition-colors group-hover:text-lp-ink"
                    >
                      <path d="M4 12h16" />
                      {/* The upright half of the plus. It fades rather than
                          unmounting, so the plus turns into a minus in place
                          instead of the row flickering. */}
                      <path
                        d="M12 4v16"
                        className="origin-center transition-opacity duration-150 group-open:opacity-0"
                      />
                    </svg>
                  </summary>
                  {/* Stopped short of the mark on the right, so the answer
                      reads as belonging to the line above it rather than as
                      the next row. */}
                  <p className="max-w-prose pr-12 pb-7 text-[1.0625rem] leading-relaxed">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---- What you can check yourself ------------------------------

            **The last block before the ask, which is where risk reversal
            goes.** The FAQ above answers the objections a reader raises; this
            answers the one they do not raise, because it is not a question so
            much as a posture — *why would I believe any of this*.

            The only thing that works on that reader is claims they can settle
            without trusting us, so every row here is checkable by them, today,
            without an account: devtools for the first, a free validator for
            the second, the export button for the third, and this page's own
            source for the fourth.

            **The strip underneath is risk reversal, stated as an invitation
            rather than as an apology.** An earlier draft opened by pointing at
            what the page does not have; that is a real tactic and the wrong
            one here, because it makes the reader think about the absence
            instead of about the afternoon it costs them to find out for
            themselves. The stronger move on the same reader is to make trying
            it free, reversible and answerable by a person.

            The three facts are read from the same modules the pricing page and
            the refunds page read, so they cannot drift into being untrue. */}
        <section className="border-b border-lp-line bg-lp-tint-soft px-6 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Head
              center
              eyebrow="Before you trust us"
              title="Four things you can check without believing a word"
              lead="Every claim on this page can be settled by you, today, without an account."
            />

            <ul className="mt-12 grid gap-5 md:grid-cols-2">
              {PROOFS.map(([mark, title, detail]) => (
                <li
                  key={title}
                  className="rounded-2xl border border-lp-edge bg-lp-ground p-6 sm:p-7"
                >
                  <div className="flex items-start gap-3.5">
                    <span style={{ color: PASS }} className="mt-0.5 shrink-0">
                      <Icon name={mark} className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="oc-heading font-serif text-lg leading-snug text-lp-ink">
                        {title}
                      </h3>
                      <p className="mt-2 text-[0.9375rem] leading-relaxed">
                        {detail}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* ---- What writers said ---------------------------------
                See the note on `VOICES`. This is the slot a landing page
                fills with testimonials and it does not contain any, because
                there is nobody to quote yet. */}
            <div className="mt-14 border-t border-lp-line pt-12">
              <div className="mx-auto max-w-3xl text-center">
                <p className="font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
                  What writers said
                </p>
                <h3 className="oc-heading mt-3 font-serif text-[1.5rem] leading-tight text-lp-ink sm:text-3xl">
                  Not testimonials. The research this was built from
                </h3>
                <p className="mt-3 leading-relaxed">
                  Every one is something a writer said about the problem, not
                  about us — we have no customers to quote yet, and we are not
                  going to invent any. Each is in the codebase, beside the
                  thing it caused.
                </p>
              </div>

              <ul className="mt-10 grid gap-5 sm:grid-cols-2">
                {VOICES.map(({ quote, answer }) => (
                  <li
                    key={quote}
                    className="flex flex-col rounded-2xl border border-lp-edge bg-lp-ground p-6 sm:p-7"
                  >
                    {/* The quote in the page's own display face and a size up
                        from the body, because it is the thing being shown;
                        the answer below is set small and quiet, since it is
                        our voice rather than theirs and must not compete with
                        the words it is answering. */}
                    <blockquote className="oc-lead flex-1 font-serif text-lg leading-relaxed text-lp-ink sm:text-xl">
                      “{quote}”
                    </blockquote>
                    <p className="mt-5 border-t border-lp-line pt-4 text-[0.875rem] leading-relaxed text-lp-faint">
                      {answer}
                    </p>
                  </li>
                ))}
              </ul>

              {/* What the risk-reversal panel that used to sit here was
                  carrying, kept as one line rather than dropped: the free
                  plan, the refund window and a reachable human. The first is
                  made twice more on this page and the address is in the
                  footer, but the refund window is said nowhere else, and it
                  is the one a reader is owed before they are asked for a
                  card. The address is the same module `/contact` prints
                  from. */}
              <p className="mt-8 text-center text-[0.875rem] leading-relaxed text-lp-faint">
                No card to start, {REFUND_DAYS} days to change your mind, and
                one person answers —{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium underline decoration-lp-edge-strong underline-offset-2 hover:text-lp-ink"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* ---- Close ----------------------------------------------------

            The last ask, and the one section on the page whose *shape* is
            borrowed wholesale: a lit sky holding the sentence and the two ways
            in on the left, the product oversized and cropped by the bottom
            edge on the right, and the gradient landing on the footer's own
            ground so the two read as one closing movement. `CtaBanner` carries
            the whole of the reasoning, including what could not be copied from
            the reference and why. */}
        <CtaBanner />
      </main>

      {/* The footer carries the policy pages, and that is not housekeeping: a
          payment provider reviews this site before it will let anybody take a
          card, and what it looks for first is a privacy policy, a refund
          policy, reachable pricing and a way to reach a human. A policy that
          exists at a URL nobody links to is reported as missing. It reads from
          `LEGAL_PAGES` so the four cannot drift out of step with the pages
          themselves — see `landing-footer.tsx` for the rest of it. */}
      <LandingFooter />
    </div>
  );
}

/* ---- The furniture ------------------------------------------------------- */

function Head({
  eyebrow,
  title,
  lead,
  center = false,
  stage = false,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  /**
   * Centred, which every **stacked** section header now is.
   *
   * The rule is about what sits under the header rather than about taste: a
   * header over a full-width grid, table or row of bands is a title for the
   * whole section and belongs over the middle of it, while a header that is
   * the first line of a column — the `Split` sections, the FAQ — is the start
   * of a piece of prose and has to keep the column's own left edge. Left at
   * the edge above a centred three-column grid it reads as a caption that has
   * come adrift; centred above a paragraph it reads as a mistake. So: stacked,
   * centred; in a column, not.
   */
  center?: boolean;
  /** On the black panel, where every ink is a different token — see the stage
   *  note in globals.css. The type scale is identical; only the colours move,
   *  which is exactly why this is a flag here rather than a second Head. */
  stage?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p
        className={`font-code text-[0.6875rem] tracking-[0.18em] uppercase ${
          stage ? "text-lp-stage-faint" : "text-lp-faint"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`oc-display mt-5 font-serif ${SECTION_TITLE} ${
          stage ? "text-lp-stage-ink" : "text-lp-ink"
        }`}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={`oc-lead mt-4 font-serif text-xl leading-relaxed ${
            stage ? "text-lp-stage-body" : ""
          }`}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

/**
 * One way a book gets refused, as a tinted card: the words on one side and the
 * screen that catches it on the other.
 *
 * **Both halves used to be words**, and that was the thing to fix. The injury
 * sat on the left in the page's ordinary ink and the answer on the right in a
 * panel headed "What this does about it" — a claim answered by another claim,
 * on the one part of this page that is about the reader's problem rather than
 * our solution to it, for a reader whose whole history is of being told things
 * by software that could not do them. So the answer hands the *proof* to a
 * drawn screen beside it: `refusal-figures.tsx`, where two of the three are
 * computed out of the app's own modules rather than written.
 *
 * **One badge, one title, one paragraph, one control** — the same four things
 * in the same order in all three cards, which is what makes them read as a
 * list rather than as three arguments. The description carries the injury
 * *and* the answer in a couple of sentences; it was two labelled blocks with a
 * rule between them, and at card width that is a page inside a card. The
 * screen beside it is where the detail went, and it is a better place for it:
 * "PNG is not a format Amazon takes", printed in the product's own words, on
 * the product's own screen.
 *
 * **The badge is neutral and only the glyph is red.** A filled red badge
 * carried the verdict when these were bands on white, and on a tinted card it
 * became the loudest thing in the section — three red slabs down one column,
 * shouting the problem at somebody who has not read the title yet. The pill is
 * the page's own ground now, with the mark inside it in `STOP`: the colour
 * still says *refusal* and it is one glyph rather than a block.
 *
 * **The control is a real one.** Every card ends in the same link to the check
 * at the top of the page — which is a working control on this very page,
 * needs no account, and is the honest answer to all three refusals: find out
 * before you upload. A card that ends in a button nobody can press is the dead
 * UI the house rules forbid, and a different destination per card would be
 * three inventions.
 *
 * **Each card has its own ground**, and those three tints are the only
 * decorative colour on this page — see the long note on `--color-lp-card-*` in
 * globals.css for the rules that keep the exception from leaking. `tint` is a
 * whole class name rather than an index into one, because Tailwind reads class
 * names as literals and ships no rule for a name assembled at runtime.
 */
function Rejection({
  n,
  mark,
  title,
  note,
  figure,
  tint,
}: {
  n: string;
  mark: keyof typeof icons;
  title: string;
  note: string;
  figure: ReactNode;
  tint: string;
}) {
  return (
    <li className={`rounded-3xl p-6 sm:p-8 lg:p-10 ${tint}`}>
      {/* `items-center` rather than `start`: the words are shorter than the
          screen in two of the three, and a short column pinned to the top of a
          tall figure leaves a hole under it that reads as a missing
          paragraph. */}
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          {/* The page's own ground, so the pill lifts off the tint. */}
          <span className="font-code inline-flex items-center gap-2 rounded-full bg-lp-ground px-3 py-1.5 text-[0.6875rem] font-semibold tracking-[0.12em] text-lp-soft uppercase">
            <span style={{ color: STOP }} className="flex">
              <Icon name={mark} className="h-3.5 w-3.5" weight={2.1} />
            </span>
            Refusal {n}
          </span>

          <h3 className="oc-heading mt-5 font-serif text-[1.75rem] leading-[1.15] font-semibold text-lp-ink sm:text-[2rem]">
            {title}
          </h3>
          <p className="mt-4 max-w-prose text-[0.9375rem] leading-relaxed">
            {note}
          </p>

          {/* A plain anchor, not `<Link>`, and that is the same choice the
              header's three in-page links make. The page's scroll container is
              the `lp-type` div rather than the window, so the fragment has to
              be handled by the browser — which walks up to the nearest
              scrollable ancestor — instead of by the router's own scroll
              restoration, which is written for the document. */}
          <a
            href="#check"
            style={{ backgroundColor: INK }}
            className="mt-7 inline-block rounded-full px-5 py-2.5 text-[0.875rem] font-semibold text-lp-accent-ink hover:opacity-90"
          >
            Check your book
          </a>
        </div>

        {figure}
      </div>
    </li>
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
      className={`border-b border-lp-line px-6 py-14 sm:py-20 ${
        tint ? "bg-lp-tint-soft" : ""
      }`}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
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
/**
 * A drawn screen, on a screen too narrow to draw it on.
 *
 * Both figures are fixed designs — 760 CSS px for the dashboard — scaled to
 * whatever width their column gives them. That is exactly right down to about
 * a tablet and falls apart below it: on a 390px phone the dashboard renders at
 * 0.47, which takes its 11px labels to 5px. Those labels *are* the content
 * (the finding, and the button that fixes it), so shrinking them to noise
 * leaves a section arguing for something the reader cannot see.
 *
 * So below `sm` the figure keeps a floor of 34rem and the container scrolls
 * sideways to it — about 0.72 scale, labels near 8px, a swipe of 150-odd
 * pixels on a normal phone. Sideways scrolling is a real cost and it is worth
 * it here: the alternative is not a smaller figure, it is a figure that
 * carries nothing.
 *
 * The scrollbar is deliberately left alone. It is the only thing on a desktop
 * narrow window that says the figure continues, and phones hide it anyway.
 * `overflow-visible` above `sm` so the frame's shadow is not clipped by a
 * scroll container that has nothing left to scroll.
 */
function WideFigure({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto pb-3 sm:overflow-visible sm:pb-0">
      <div className="min-w-[34rem] sm:min-w-0">{children}</div>
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
          ? {
              borderColor: INK,
              backgroundColor: INK,
              color: "var(--color-lp-accent-pale)",
            }
          : {
              borderColor: "var(--color-lp-edge)",
              backgroundColor: "var(--color-lp-ground)",
            }
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

/* The five phases used to be drawn here as a boxed list of rows — `OrderFigure`,
   a picture of a list on the one section that argues nobody's problem is a
   missing list. `order-path.tsx` replaced it: the same five phases, the same
   ARC step in the same place, as stations on a road the reader travels down. */

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
          <p
            className="oc-heading mt-2 font-serif text-2xl"
            style={{ color: STOP }}
          >
            £1,240
          </p>
          <p className="mt-1 text-xs">Cover · editing · ads · proofs</p>
        </div>
        <div className="rounded-xl bg-lp-tint-soft p-4">
          <p className="font-code text-[0.625rem] tracking-[0.16em] text-lp-faint uppercase">
            Earned
          </p>
          <p
            className="oc-heading mt-2 font-serif text-2xl"
            style={{ color: PASS }}
          >
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
