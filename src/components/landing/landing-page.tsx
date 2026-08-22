import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { GoogleButton } from "@/components/auth/auth-shell";
import { BookCheck } from "@/components/landing/book-check";
import { CheckDemo } from "@/components/landing/check-demo";
import { ExportScreen } from "@/components/landing/export-screen";
import { FeatureShots } from "@/components/landing/feature-shots";
import { ListingQuestions } from "@/components/landing/listing-questions";
import { CtaBanner } from "@/components/landing/cta-banner";
import { HeroWall } from "@/components/landing/hero-wall";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { OrderRows, type Station } from "@/components/landing/order-rows";
import { ToolCloud } from "@/components/landing/tool-cloud";
import {
  LEAD_EM,
  SECTION_LEAD,
  SECTION_TITLE,
} from "@/components/landing/type";
import { ReviseScreen } from "@/components/landing/phase-screens";
import { AppWindow } from "@/components/landing/app-window";
import {
  ExportDoneFigure,
  ListingFigure,
} from "@/components/landing/refusal-figures";
import { StoreListingDemo } from "@/components/landing/store-listing-demo";
import { DESTINATIONS } from "@/components/landing/works-with";
import { ALL_TOOLS } from "@/lib/book-tools";
import { PHASES, SELF_TICKING, STEPS, YOURS_TO_TICK } from "@/lib/roadmap";
import {
  IDEAL_RATIO,
  MAX_EDGE,
  MIN_HEIGHT,
  MIN_WIDTH,
} from "@/lib/cover-check";
/* `REPLY_DAYS` was imported here for the FAQ's "Still have a question?"
   panel, which came off on 2026-08-15. Nothing else on this page promises a
   reply time, which is worth knowing rather than only noticing later. */
import { CONTACT_EMAIL, REFUND_DAYS } from "@/lib/legal";

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
 * have both been emptied rather than filled with something invented — a band
 * of four counted figures which stood under the refusals until it was removed
 * (the rule survived it, and all four figures are still on the page in places
 * that give them a meaning), and the testimonial row, which for a while
 * carried the *research* instead of customers and came out on 2026-08-13 to be
 * rebuilt. `TODO.md` holds what that row was and the rules its replacement
 * owes. An empty slot claims nothing, which is the safe direction here.
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
 * **One measure down the whole page: `max-w-[88rem] px-6`.** The header, every
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
 * **Every claim has to be true of the code**, and nothing here may claim what
 * the app cannot do — the print PDF is the browser's print engine and says so
 * wherever it appears. The phases, the step counts and the tool list are all
 * imported rather than restated, which is the shape to prefer for any new
 * figure here.
 *
 * That rule used to have a second half — *nothing stays under the "Not built
 * yet" badge once it ships* — and the section that badge belonged to was
 * **removed on 2026-08-14** at the owner's request. There is no longer a place
 * on this page where an unbuilt thing is listed, so there is nothing to walk
 * when a feature lands. What the page must not do is grow one by accident: an
 * unbuilt feature named anywhere here is a promise with no section admitting
 * it is one. See the note where that section stood, and TODO.md.
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
 * states where it sits — "step 13 of 19" — and those are facts about a list
 * that lives somewhere else. Written by hand they would be right today and
 * quietly wrong the first time a step is added, on the one page whose entire
 * pitch is being checkable.
 *
 * **The phase number went with the Revise row on 2026-08-13.** The callout used
 * to say "here in phase 4", counted off `PHASES` — and once this section stopped
 * drawing all five and renumbered what was left, that four disagreed with the
 * "PHASE 03" printed on the very row it sat in. The step's position in the whole
 * list says the same thing and cannot drift: thirteenth of nineteen is before
 * the end however the phases are grouped.
 */
const ARC_INDEX = STEPS.findIndex((step) => step.id === "arc");
const ARC_STEP = STEPS[ARC_INDEX]!;

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
 * The station headings, longer than the phase's own label.
 *
 * **A landing-page override rather than a rename**, and the distinction is the
 * whole reason this exists. `PHASES[].label` is product vocabulary: the
 * roadmap screen, the dashboard's five dials and `checkup` all say "Prepare",
 * so changing it in `roadmap.ts` to suit a heading here would rename the phase
 * everywhere a writer meets it. These are five headings on one page.
 *
 * Two rules keep the override honest. **The phase's own word comes first** in
 * every one of them, so a reader who arrives in the app finds the same
 * vocabulary rather than wondering which of two names is the real one. And it
 * falls back to `phase.label`, so a phase added to `roadmap.ts` and forgotten
 * here still draws its station with the right name rather than nothing.
 *
 * `launch` is absent on purpose: "Before you publish" is already the longest
 * of the five and needs no help.
 */
const ORDER_TITLES: Record<string, string> = {
  write: "Write the first draft",
  revise: "Revise it into shape",
  /* "Prepare what shops ask for" was the first try and set as three lines
     where the other four set as two. The size has come down since (40px from
     `sm`), so the ceiling is nearer thirty characters — but the rule is
     unchanged: every one of these sets to the same number of lines, or the
     rows read as different sizes of thing. */
  prepare: "Prepare for the shops",
  publish: "Publish, then check it",
};

/*
 * **Three lines each, and that is a length rather than a style.** These were
 * held to two — roughly seventy-five characters with the step count — on the
 * reasoning that a reader takes them at scrolling speed and one line is a
 * caption while four is a paragraph. That ceiling was raised deliberately on
 * 2026-08-13: each phase now names *what is actually in it* before it makes
 * its point, because "the longest phase" tells a reader nothing they can
 * picture and "the cover, the blurb, the categories, the keywords, the ISBN"
 * tells them exactly what they are in for.
 *
 * The bound that replaced it is still a bound, and it is measured rather than
 * guessed: the column is about 29rem and these set at 22px, so a line holds
 * roughly forty characters and **eight lines is about three hundred and
 * twenty characters with the count included**. That ceiling has now been
 * raised five times at the owner's request — 75 characters, then 105, 150,
 * 190, 215, now 320 — so treat the *number* as current rather than settled and
 * the *rule* as the fixed part: every station sets to the same number of lines,
 * because five stations of different heights read as five sizes of thing
 * rather than as one road. The five below run 317–325 characters, which is one
 * line of slack across the set; keep any rewrite inside that.
 *
 * **The extra room went on what each phase actually does**, not on adjectives:
 * the writing one now says the page is a real page and saves as you type, the
 * revising one says the report has no score and no rewrite button, the
 * preparing one says what happens when a shop asks for something you have not
 * got, and the publishing one names EPUBCheck. Every one of those is a claim
 * the code backs — the same rule as everywhere else on this page.
 *
 * Four drafts overran whatever the bound was at the time — one set "Prepare"
 * as five lines when the rest were two, one left "3" at the end of a line with
 * "steps." alone under it, one ran two stations long while three sat short.
 * Measure the wrap, not the character count; they disagree about where the
 * spaces fall.
 *
 * They are nodes rather than strings so each can carry `<Em>` on its point —
 * the deck treatment, so a reader skimming the road takes five claims and
 * nothing else. The step count is appended in `ORDER_STATIONS` and stays
 * plain: it is a counted figure, not the claim.
 */
const ORDER_LEADS: Record<string, ReactNode> = {
  write: (
    <>
      Get the words down, with your notes, your bookmarks, your story bible and
      the idea parking lot in the same rail — leaving the chapter is the
      interruption. The page is a real page at your trim size, it saves as you
      type, and it keeps working with the connection off.{" "}
      <Em>The only phase most writing software covers.</Em>
    </>
  ),
  revise: (
    <>
      Make them the right words — the echoes, the crutch words, the sentences
      that all begin the same way, the adverbs. The report counts them and shows
      you where every one of them is, and it changes nothing: no score, no
      grade, and no button that rewrites your prose for you.{" "}
      <Em>The last phase about the book itself.</Em>
    </>
  ),
  prepare: (
    <>
      The cover, the blurb, the categories, the keywords, the ISBN, the
      paperback setup. None of it is writing, and most people meet it in the
      wrong order — or meet it at the upload, when a shop asks for something
      they have never heard of and the file comes back refused.{" "}
      <Em>Everything a shop asks for that is not the book.</Em>
    </>
  ),
  launch: (
    <>
      Line up advance readers, and the rest of what only works before the book
      is out — reviews on the page the day it goes up, not three months late.
      The list holds who has a copy, who is reading and who came back, so who is
      left is a glance rather than a hunt through the mail.{" "}
      <Em>Almost everybody finds this out too late.</Em>
    </>
  ),
  publish: (
    <>
      Send it, then <Em>check what you actually sent, as a reader sees it</Em> —
      in the reading view, at the book&rsquo;s real trim size, with the front
      matter and the contents where the file really puts them. The file is built
      to pass EPUBCheck, the validator the shops run, and the last screen names
      anything a shop would refuse.
    </>
  ),
};

/*
 * The screen each phase is shown by, in the column its words are not in.
 *
 * Keyed by the phase's own id rather than by index, so re-ordering `PHASES`
 * cannot quietly put the advance-copy tracker beside "Write". Three of the
 * five are computed out of the app's own modules — see `phase-screens.tsx`.
 */
/**
 * The writing phase's figure, and the first of this section's three bitmaps.
 *
 * The drawn figures elsewhere on this page are a rule rather than a habit: a
 * drawing of a pure module cannot go stale, because it is rendered from the
 * module. This one can. It was swapped in on 2026-08-13 at the owner's
 * request, and the cost is worth writing down where somebody will find it —
 * **if the editor's chrome changes, nothing fails and nothing warns; this
 * picture simply starts lying.** The rail down the left, the front/body/back
 * matter panel, the chapter list and the right-hand tool rail are all things
 * the app really has today. Re-shoot it when they move.
 *
 * **Re-shot on 2026-08-14, and the new file has a new name.** The first
 * version was a hand holding the machine, and the hand reached further left
 * than the laptop did — so the frame had to be cropped *into* it to stop the
 * laptop floating in the middle of its own figure, and the hand ran off the
 * left edge. This one is the whole machine on white, which needs no such
 * trick: the crop is the content bbox plus 10px, the same as the other two.
 * The name changed from `editor-laptop.webp` because `next/image` caches its
 * optimised copy by URL — replacing a file under the same name looks like it
 * has not worked, however many times you replace it. Same rule as the upgrade
 * dialog's artwork.
 *
 * `priority` is deliberately absent — it sits several screens down the page,
 * so eager-loading it would cost the hero its bandwidth.
 *
 * **`sizes` has to be re-checked whenever that grid moves, and it is the part
 * that fails quietly.** It says what the layout actually does — the wide
 * column of the order grid from `lg`, full width below it — and `next/image`
 * picks which generated variant to download from it, not from the box the
 * picture lands in. Set too small and the browser confidently fetches a
 * narrower file and scales it *up*: nothing errors, nothing warns, the
 * photograph just goes soft, on a page whose whole argument is that you can
 * read the app's own type in it. It was 44rem while the column was one; the
 * column reaches about 60rem now (`100rem` container, 1.85fr), so this is
 * 62rem — rounded up, because over-declaring costs a slightly larger download
 * and under-declaring costs the sharpness the picture is there for.
 *
 * **`quality` is the other half of that, and it is the half that had actually
 * gone wrong.** These three went soft when the section widened, and widening
 * only exposed it: the shipped files had been encoded at about q82 and
 * `next/image` then re-encoded them at its **default 75** on the way out, so
 * what a reader saw was two lossy passes over a picture of *type*, which is
 * the content webp's default tuning handles worst. Both ends are fixed —
 * re-encoded at q95 from the originals (`write-laptop.webp` went 73KB → 128KB,
 * `arc-laptop.webp` 45KB → 86KB) and served at 95, so there is no second
 * generation worth the name.
 *
 * The ceiling left is the source: these are 1448px originals cropped to about
 * 1350, so a 2× screen showing them near 955px CSS is above what the file
 * holds. That cannot be encoded away — it needs the mockups rendering larger,
 * which is a re-shoot rather than a setting. Do not answer it by raising
 * `quality` further; past about 95 webp buys size and nothing a reader sees.
 *
 * **`mix-blend-multiply` stays on the three photographs even though the
 * section is white again.** On white it is arithmetically a no-op — multiplying
 * by 1 is identity, so not a pixel of these moves — and it is what let the
 * section be tinted for an afternoon without three white rectangles appearing
 * around three machines. These were shot on pure white; multiplying renders
 * that white as whatever ground is behind it, with no cut-out and no halo
 * along the machine's edge, which a transparency matte on an anti-aliased
 * photograph does not manage. Keep it, and the ground stays free to change.
 * The one thing it rules out is a *dark* ground: multiply would take the app's
 * own white screen down with it, and the pictures would have to be re-cut.
 */
function WriteShot() {
  return (
    <Image
      src="/write-laptop.webp"
      alt="A laptop showing the OpenChapter editor: the book's front matter, body matter and back matter down the left with a list of twelve chapters, the manuscript open at Chapter 1 in the middle, and the writing tools down the right."
      width={1353}
      height={991}
      sizes="(min-width: 1024px) 62rem, 100vw"
      quality={95}
      className="mix-blend-multiply block h-auto w-full"
    />
  );
}

/*
 * **The prepare row is the moving demo, not a photograph, since 2026-08-14.**
 *
 * `PrepareShot` — a tablet photograph of the real Prepare area, at
 * `/prepare-ipad.webp` — is gone from this file at the owner's request and
 * `CheckDemo` stands in its place (see `ORDER_SCREENS`). The file is still in
 * `public/`, so putting the picture back is one `<Image>`; what is *not*
 * recoverable from the file is the alt text, so here it is: "A tablet showing
 * OpenChapter's Prepare area: a book with one thing to fix and four more,
 * listed as what a shop would refuse — nothing in the book to publish yet, no
 * ISBN, no blurb, no categories, no publisher — each with the control that
 * fixes it."
 *
 * The demo is a better fit for this row than it looks: it draws the same
 * screen the photograph did and then *works* it — Overview, Prepare, a book's
 * findings opening with the fix beside each one — which is the phase's whole
 * claim rather than a still of it. It carries its own dark frame (`AppWindow`
 * with `bezel`), so the row keeps a device, and it scales its 760px design to
 * whatever width the column gives it, so it lands at the size the photograph
 * had.
 *
 * **The cost, stated where it will be found: the same figure now appears twice
 * on the page** — here, and in the "Before you upload" panel it was drawn for.
 * Nothing breaks, and each instance animates only while it is on screen, but
 * two identical drawn dashboards a few sections apart is a repetition rather
 * than a rhyme. If one of them is to go, it is a one-line change either way.
 */

/**
 * The launch phase's figure — the third bitmap, on the same terms as the two
 * above, and the one that gave up the most to become one.
 *
 * `ArcScreen` did not merely draw this list, it **read `STATUSES` and
 * `LEAD_DAYS` out of `arc.ts`**: the states in it were the states the tool
 * has, and "six weeks" was `LEAD_DAYS` divided by seven. Neither could go
 * stale. This picture can, and in two ways rather than one — if a status is
 * renamed, and if the lead time changes. Swapped in on 2026-08-13 at the
 * owner's request.
 *
 * What is in it is the real screen as it stands today: the five badges, their
 * colours, the ordering line under the count and the panel's own control. Note
 * it is a shot of the list *since the chasing came out* — nothing in it says
 * late, which is the truthful state of the tool. Re-shoot it when that half is
 * built again, or the page will be advertising a screen the app no longer has.
 *
 * 1296×977, cropped to the machine plus its shadow with 10px of air — measured
 * from the dark-pixel bbox, which is the lesson from `WriteShot`.
 */
function ArcShot() {
  return (
    <Image
      src="/arc-laptop.webp"
      alt="A laptop showing OpenChapter's advance-copy list: five readers ordered by whose review is wanted soonest, each with a coloured badge for where they have got to — no answer, sent, reading, reviewed, declined — beside the genre they read, where they were found, and the date their review is wanted."
      width={1292}
      height={976}
      sizes="(min-width: 1024px) 62rem, 100vw"
      quality={95}
      className="mix-blend-multiply block h-auto w-full"
    />
  );
}

/*
 * **The publishing row is a drawn screen again since 2026-08-14**, and it is
 * the one row that went to a bitmap and came back.
 *
 * `PublishShot` — a tablet at `/export-tablet.webp`, swapped in on 2026-08-14
 * on the same terms as the three photographs — is gone from this file and
 * `ExportScreen` (`export-screen.tsx`) stands in its place. Not a change of
 * mind about the trade: that picture was the one of the four that could not be
 * fixed by re-encoding. It was composed by a script from a screenshot no
 * longer on disk, so there was nothing to re-encode *from*, and at 1984×1326
 * in 49KB — about 0.15 bits a pixel, on flat grounds and small type — webp's
 * ringing sat on the letters. Its own note said the real fix was to render it
 * again; that is what the drawing is. The file stays in `public/` and
 * `export-screen.tsx` carries the alt text, so the photograph is one `<Image>`
 * away if it is ever wanted back.
 *
 * The other three rows keep their bitmaps and keep the cost that comes with
 * them. This one now costs nothing to keep true: two of its values are read
 * out of the app, and the rest is markup that a browser sets at whatever size
 * the column gives it rather than pixels that were sized once.
 *
 * `PublishScreen` in `phase-screens.tsx` — the small card-sized drawing that
 * filtered `DESTINATIONS` — is still there and still callerless. It is a
 * different figure rather than this one at another size: it draws the finished
 * file and the shops it opens in, where this draws the screen the writer is
 * standing on.
 */

const ORDER_SCREENS: Record<string, ReactNode> = {
  write: <WriteShot />,
  revise: <ReviseScreen />,
  prepare: <CheckDemo />,
  launch: <ArcShot />,
  publish: <ExportScreen />,
};

/*
 * The line under each drawn screen, naming what it is.
 *
 * Every one names a screen that exists in the app, which is the same rule the
 * screens themselves are held to — three of the five are computed out of the
 * app's own modules. A caption that named something aspirational would be the
 * one place on this page a drawing turned into a promise.
 */
const ORDER_CAPTIONS: Record<string, string> = {
  write: "The editor",
  revise: "The prose report",
  prepare: "The pre-upload check",
  launch: "The advance-reader list",
  publish: "The export",
};

/**
 * The phases this section draws — **four of the road's five, since
 * 2026-08-13.**
 *
 * Revising came out at the owner's request. Everything about it is *kept*
 * rather than deleted: `ORDER_TITLES`, `ORDER_LEADS`, `ORDER_SCREENS` and
 * `ORDER_CAPTIONS` all still carry a `revise` entry, and `ReviseScreen` is
 * still its screen — so putting the row back is deleting one id from the set
 * below, and nothing else in this file has to be found and undone.
 *
 * **The rows are numbered off this list, not off `PHASES`,** which is what
 * makes them read 01–04 with no gap. The cost is worth knowing: the app's own
 * roadmap still has five phases and still calls this last one phase five, so a
 * writer who signs up meets different numbers from the ones on the page. Two
 * things follow from that and are handled where they live — the deck no longer
 * prints a phase count, and the ARC callout no longer names a phase.
 */
const ORDER_HIDDEN = new Set(["revise"]);

const ORDER_STATIONS: Station[] = PHASES.filter(
  (phase) => !ORDER_HIDDEN.has(phase.id),
).map((phase, i) => {
  const steps = STEPS.filter((step) => step.phase === phase.id).length;

  return {
    n: String(i + 1).padStart(2, "0"),
    title: ORDER_TITLES[phase.id] ?? phase.label,
    /* The count is joined by a non-breaking space, which is not a nicety: at
       this measure "3" landed at the end of a line with "steps." alone on the
       next, so the station ended on an orphan that read as a fourth line of
       nothing. Tie the number to its noun and the pair wraps together. */
    note: (
      <>
        {ORDER_LEADS[phase.id] ?? phase.note} {steps}
        &nbsp;step{steps === 1 ? "" : "s"}.
      </>
    ),
    screen: ORDER_SCREENS[phase.id],
    caption: ORDER_CAPTIONS[phase.id] ?? phase.label,
    ...(phase.id === ARC_STEP.phase
      ? {
          callout: `“${ARC_STEP.title}” is step ${ARC_INDEX + 1} of ${STEPS.length} — before you publish, not after.`,
        }
      : {}),
  };
});

/* **`WRITE` and `PREPARE` lived here and went on 2026-08-14**, with the
   "Three phases. Writing is one." section that was the only thing counting
   them. Each was six named claims with a sentence apiece — the six things the
   writing side does, the six the preparing side does — and every claim they
   made is still on the page, in the tools section, which lists all sixteen
   tools out of `book-tools.ts` rather than restating six by hand. `TRACK`
   stays: the Track section below still draws four of its five. See TODO.md
   under "Taken out on purpose". */

/* `PREPARE_MARKS` used to live here — one glyph per point, drawn beside the
   four Prepare claims on the stage. Those four restated four of the sixteen
   tools, which `book-tools.ts` already lists in full, so they went when that
   section took the reference's two-column header. `PREPARE` itself stays: the
   phases section above counts it. */

/* **`TRACK` and `MoneyFigure` stood here and went on 2026-08-15** with the
   "What it cost against what it earned" section they filled, at the owner's
   request. The sibling "Two writers" section went in the same edit.

   Deleted rather than kept callerless, which is the split CLAUDE.md draws and
   the one `LATER` was held to below: `templates-dialog.tsx` and `ambience.ts`
   are whole features waiting on a way in, and these were a string table and a
   figure. What is worth not re-deriving is why the figure was built the way it
   was — every number on it came out of `totals()` and `copiesToLevel()`, the
   same two functions the Track screen uses, because the claim beside it was
   that the break-even count is worked from what a copy has actually earned
   rather than from a royalty rate we invented, and a hand-typed figure under
   that sentence would have been exactly the thing the sentence promised not to
   do. Rebuild it that way or not at all. The Track tool itself is untouched;
   only the landing page's account of it has gone. */

/* **`LATER` stood here and went on 2026-08-14** with the "Not built yet"
   section it filled — see the note where that section was, and TODO.md under
   "Taken out on purpose", which keeps its three entries verbatim so rebuilding
   it is a paste rather than a rewrite.

   Deleted rather than kept callerless, which is the split CLAUDE.md draws:
   `templates-dialog.tsx` and `ambience.ts` are whole features waiting on a way
   in, and this was three strings and a `.map`. An unused const buys nothing
   but a standing lint warning, and TODO.md holds the part that was actually
   worth keeping. */

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
    "An EPUB that clears EPUBCheck with no errors and no warnings, with DOCX and PDF beside it. The last step stays yours, and it is one upload.",
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
/* `STRIP_NAMES` and `STRIP` used to live here: an *edit* of `DESTINATIONS`
   down to five names for a single-line logo row, leaving out LibreOffice
   Writer and Obsidian because three word processors on one line read as a
   compatibility matrix and a Markdown notes app beside four bookshops
   answered a question nobody was asking at that point in the page. The mosaic
   below shows all of them as tiles, where neither problem arises, so the filter
   went with the row it was written for. Nothing was retracted — both were
   always in `DESTINATIONS`, which is still the complete and only list.
   (Obsidian has since left that list with the Markdown export, and returns
   with it.) */

/**
 * The mosaic under the hero: every program a finished file opens in, with
 * three checkable facts set among them.
 *
 * **The marks are read from `DESTINATIONS` rather than listed here**, so this
 * cannot name a program the export does not reach — the same rule the footer
 * and the export dialog follow. All of them are shown, which is why the grid has
 * no fade at its edges: there is no eighth to imply.
 *
 * The facts are placed *between* the marks rather than gathered at one end.
 * The reference alternates its stat tiles with its logos, and the alternation
 * is what stops a row like this reading as a table of specifications with a
 * summary bolted on. Their positions are the only arbitrary thing in the list.
 *
 * Each fact is settleable by the reader today, without an account: the four by
 * pressing export, and the "nothing" by opening devtools while the check above
 * reads their book. That is the bar for anything that joins them — a fact that
 * has to be taken on trust belongs in the prose, not on a tile that looks like
 * evidence.
 *
 * **There were three facts and now there are two.** The first was "0 —
 * EPUBCheck errors, and zero warnings", and it went on 2026-08-15 to make room
 * for the brand mark. Nothing was retracted with it: the sentence directly
 * above this grid already says the EPUB is *verified against EPUBCheck 5.3,
 * not asserted*, so the tile was the same claim a second time, six inches
 * lower. That is also the reason it was the one to give up — of the three it
 * was the only one the prose already carried.
 *
 * The brand tile is the one thing here that is not evidence, which is why it
 * takes a fact's slot rather than a mark's: the marks are a closed list of
 * programs the export reaches, and a logo that is not a destination sitting
 * among them would be claiming to be one.
 */
type Tile =
  | { kind: "mark"; destination: (typeof DESTINATIONS)[number] }
  | { kind: "fact"; figure: string; label: string; tone?: string }
  | { kind: "brand" };

const TILE_FACTS: Record<number, Tile> = {
  1: { kind: "brand" },
  4: { kind: "fact", figure: "4", label: "export formats, free forever" },
  /* **This said "None of your book is uploaded anywhere" until 2026-08-16**,
     and the PDF stopped that being true: it is typeset by a browser on our
     server, because the contents page's numbers cannot be worked out anywhere
     else. The tile is held to the same standard as the two beside it — a fact
     a reader can check today with devtools — so it now counts the formats that
     really are built here rather than claiming all four are. */
  6: {
    kind: "fact",
    figure: "3 of 4",
    label: "formats are built in your browser, not on a server",
  },
};

const TILES: Tile[] = (() => {
  const marks = DESTINATIONS.map((destination): Tile => ({
    kind: "mark",
    destination,
  }));
  /* Counted once, up front. Written as `marks.length + …` inside the
     condition it was a moving target — `shift()` empties the array as the
     loop runs, so the loop stopped four tiles short and three destinations
     silently never rendered. */
  const total = marks.length + Object.keys(TILE_FACTS).length;
  const out: Tile[] = [];
  for (let i = 0; out.length < total; i++) {
    const fact = TILE_FACTS[i];
    out.push(fact ?? marks.shift()!);
  }
  return out;
})();

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
/*
 * A ground, an ink and a fill per card, in order down the page.
 *
 * Whole class names and whole `var()` strings, because Tailwind reads class
 * names as literals — `bg-lp-card-${i}` ships no rule at all — and because the
 * two colours are set through `style`, where a token name has to be complete
 * to resolve. Indexed with a modulo at the call site so a fourth refusal wraps
 * to the first set rather than rendering with none.
 */
const CARD_TINTS = [
  {
    ground: "bg-lp-card-1",
    ink: "var(--color-lp-card-1-ink)",
    fill: "var(--color-lp-card-1-fill)",
  },
  {
    ground: "bg-lp-card-2",
    ink: "var(--color-lp-card-2-ink)",
    fill: "var(--color-lp-card-2-fill)",
  },
  {
    ground: "bg-lp-card-3",
    ink: "var(--color-lp-card-3-ink)",
    fill: "var(--color-lp-card-3-fill)",
  },
];

/*
 * **The title is two lines, and the split is the argument.** The reference
 * this section is drawn from sets the first line in ink and the second in the
 * card's own colour — setup, then payoff. That shape is worth having here for
 * a reason beyond looking like it: a reader skimming three cards reads six
 * lines instead of three, and the second of each pair is the only place the
 * *answer* appears at skimming speed. It used to be buried mid-paragraph.
 *
 * **`fix` is the one that takes the accent**, and it takes the page's own
 * indigo rather than the card's tint. On this page indigo means *this is the
 * way forward* and the card grounds mean nothing at all — they are documented
 * as grounds only, never ink and never a control (see `--color-lp-card-*`).
 * Colouring "The cover is the wrong size" in peach would put a hue on a
 * problem, and amber on this page means *this costs you readers*; colouring
 * the answer in indigo says exactly what indigo says everywhere else.
 *
 * `source` is what the reference fills with a customer's logo and result. We
 * have neither, so it carries the *provenance* of the rule instead — which is
 * this page's own standing habit, and the thing this audience actually wants:
 * not who else believes it, but where the number came from.
 */
const REJECTIONS = [
  {
    title: "The cover is the wrong size",
    fix: "Measured before you send it",
    /* The figures are interpolated rather than typed, like everything
       countable on this page: `MIN_HEIGHT`, `MIN_WIDTH`, `MAX_EDGE` and
       `IDEAL_RATIO` are the constants the checker itself measures against, so
       the sentence and the screen beside it cannot end up quoting different
       numbers at the same reader. */
    note: `The commonest refusal there is. Amazon wants at least ${MIN_HEIGHT.toLocaleString()}px tall and ${MIN_WIDTH} wide, no more than ${MAX_EDGE.toLocaleString()} on a side, at least ${IDEAL_RATIO}:1, and a JPEG or TIFF.`,
    source:
      "Checked against the file you picked, not the copy we resized to fit your browser.",
    figure: <CoverCheckShot />,
  },
  {
    title: "The details do not match",
    fix: "One set of details fills both",
    note: "Title, author and ISBN inside the file have to match your listing down to the punctuation, and a check digit one out is a rejection with no explanation attached.",
    source:
      "The ISBN's check digit is arithmetic on the number itself. We do it as you type.",
    figure: <ListingFigure />,
  },
  {
    title: "The file is broken in a way Amazon hides",
    fix: "Built here, not converted",
    note: "Amazon's converter quietly repairs structural faults that Apple, Kobo and IngramSpark refuse outright, so the book sells for weeks before anyone finds out.",
    source:
      "Verified against EPUBCheck 5.3 at zero errors and zero warnings — run it yourself.",
    figure: <ExportDoneFigure />,
  },
] as const;

/**
 * Refusal 01's figure — a **photograph of the covers screen**, and the fifth
 * bitmap on this page.
 *
 * Swapped in on 2026-08-14 at the owner's request, and it is the most expensive
 * of the five, because `CoverCheckFigure` was not a drawing of that screen — it
 * **ran `coverReport()`** over a fixed set of measurements, so every row, every
 * label and the count in the summary line were the checker's own answers about
 * a made-up 500 × 800 PNG. Change a rule in `cover-check.ts` and the picture
 * changed with it. It could not drift, because there was nothing in it to
 * drift.
 *
 * **This can, and the cost is the usual one: when the covers screen moves,
 * nothing fails and nothing warns — the picture simply starts lying.** What is
 * in it is the real screen as it stands today: the two tabs, the report with
 * its seven checks, the measurements under the artwork, and the blue fix panel
 * with the three repairs. Re-shoot it when any of those change, and especially
 * when a rule is added to `cover-check.ts` — the caption under it counts seven.
 * `CoverCheckFigure` is still in `refusal-figures.tsx`, callerless and whole,
 * so putting the computed version back is one word here.
 *
 * **It keeps the black bezel**, which is the one part that is not simply
 * inherited. The three refusal figures gave the bezel up when they moved onto
 * tinted cards — a dark frame inside a panel is two frames around one screen —
 * and a *photograph* is the case that argument does not cover: this one already
 * carries the app's own white card in its pixels, so on a tinted card with only
 * a pale ring it reads as a rectangle of the wrong background rather than as a
 * screen. The bezel is what says "this is a display". The other two stay as
 * they are; if they are ever photographed too, they take the bezel with them
 * and the rule becomes "drawn figures ring, photographs bezel".
 *
 * **`fill`, like the other two, and the crop is chosen to suit it.** The
 * window has to be the row's height or the three refusal cards hold three
 * different-sized screens, which reads as three products rather than three
 * views of one. A wide crop was tried and is what rules the shape: at 1.65:1
 * against a column of words half again as tall, the frame held the picture at
 * the top with three hundred pixels of glass beneath it — space a *drawn*
 * window carries happily and a photograph does not, because on a photograph it
 * reads as a screenshot that failed to load rather than as a window with room
 * in it. This crop is 1.29:1, near enough the listing figure's own proportions
 * that it nearly fills the glass; what is left under it is a strip of
 * `lp-ground`, which on this page is #ffffff — the same white the screenshot's
 * own card is drawn on, so the seam does not read as one.
 *
 * **Nothing here re-encodes the picture, which is the point of it.** The file
 * is lossless WebP and `unoptimized` hands those exact bytes over:
 * `next/image` would otherwise downscale it to a 640px variant at quality 75,
 * and 75 is tuned for photographs — on a screenshot of *type* it is visible
 * immediately as fringing round every letter, on the one figure whose whole
 * job is that a reader can read the checks in it. The cost is ~190KB with no
 * responsive variants, paid by a picture below the fold. Do not "optimise"
 * this back without looking at the result at 100%.
 *
 * No `mix-blend-multiply` either, unlike the three laptops: those were shot on
 * pure white so that multiplying dissolves the ground into whatever is behind
 * them. This is a rectangular screenshot inside a frame — it has no ground to
 * dissolve, and multiplying it against the card's tint would drag the whole
 * picture towards indigo.
 */
function CoverCheckShot() {
  return (
    <AppWindow
      bezel
      fill
      label="The covers screen, checking a 736 × 1,308 JPEG: seven checks, with nothing a shop would refuse and two worth knowing — smaller than recommended, and taller than a shop's thumbnail — each naming the figure it measured and the rule it measured against."
    >
      <Image
        src="/cover-check-screen.webp"
        alt=""
        width={739}
        height={572}
        unoptimized
        className="block h-auto w-full"
      />
    </AppWindow>
  );
}

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
const PROOFS = [
  [
    "shelf",
    "Your manuscript stays in this browser",
    "Writing, importing, page setup, the check, every export — none of it sends the book anywhere. The few features that do send text name themselves before they run, and the privacy page lists every one.",
  ],
  [
    "check",
    "The export is verified, not asserted",
    "EPUBCheck 5.3, zero errors, zero warnings. Run it yourself on the file you get — the checker is free and it does not take our word either.",
  ],
  [
    "formats",
    "Leaving costs nothing and needs no permission",
    "Every format is free forever, on the free plan, with no export limit. The EPUB is the one a shop takes, and the DOCX is what an agent asks for.",
  ],
  [
    "steps",
    "Nothing here is a made-up number",
    "No score, no grade, no rating out of a hundred. Every figure on this page is counted out of the source when it builds, so it cannot flatter and cannot drift.",
  ],
] as const;

/**
 * The questions, and the answers set the way the decks are.
 *
 * **The answers are nodes rather than strings**, so each can carry `<Em>` on
 * the one or two phrases that are its actual answer. That is what makes a
 * column of open cards skimmable: a reader taking only the dark words gets
 * "Straight in", "You do", "No", and the rest is the qualification that makes
 * each of those true. Two emphases an answer is the ceiling — a third and the
 * eye stops treating any of them as the point.
 *
 * Note the ink: these sit on `lp-well`, where the deck grey measures **4.38:1**
 * and misses AA, so the answers take `lp-body`. Same call as the panel beside
 * them, and the same rule — `lp-deck` is calibrated against the page's pure
 * white and anything on an off-white or tinted ground steps up.
 */
const FAQ: [question: string, answer: React.ReactNode][] = [
  [
    "I have a finished manuscript. Where does it go?",
    <>
      <Em>Straight in.</Em> Import a .docx, .epub, .md, .txt or .html file and
      it is split into chapters for you. Then the first screen tells you what
      stands between it and a shop —{" "}
      <Em>usually four or five things, most of them ten minutes each.</Em>
    </>,
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
    <>
      <Em>Yes.</Em> Put somebody on a book and choose whether they can edit it
      or only read it — free covers you and one other, and Pro raises that.
      Whoever owns the book pays for the seats, so the person you invite needs
      an account and nothing else.{" "}
      <Em>What it is not is Google Docs: you will not see each other type.</Em>{" "}
      Changes travel when they are saved, and if you both write the same chapter
      at once the second save is refused rather than quietly replacing the
      first. Working in different chapters, which is what usually happens, needs
      no thought at all.
    </>,
  ],
  [
    "What doesn’t it do?",
    <>
      <Em>A fair amount.</Em> It does not design covers, edit your prose, write
      your blurb, market your book, buy ads, upload to any store, or introduce
      you to other writers. It will tell you what a cover needs to be and show
      you the shelf yours has to sit on; it will not draw one. It will count
      what is in your prose; <Em>it will not change a word.</Em>
    </>,
  ],
  [
    "Who owns what I write?",
    <>
      <Em>You do.</Em> We claim no rights over your manuscript and{" "}
      <Em>take no cut of anything you sell.</Em>
    </>,
  ],
  [
    "Do you train AI on my manuscript?",
    <>
      <Em>No.</Em> The assistant receives only the single chapter you hand it,
      at the moment you ask, and{" "}
      <Em>it is not used to train a model afterwards.</Em>
    </>,
  ],
  [
    "Can I get my work out if I stop using it?",
    <>
      <Em>Yes, without asking us.</Em> EPUB, DOCX and PDF, whenever you want.
      <Em> The EPUB is an open format</Em> — it opens in any e-reader, and the
      DOCX opens in Word, Pages and Google Docs.
    </>,
  ],
  [
    "I’ve paid for tools that did none of this. Why is this different?",
    <>
      <Em>You can test the whole claim in an afternoon without paying</Em>:
      import a draft, run the check, export the files, open them in Word
      and an e-reader. If any of it does not work,{" "}
      <Em>you have lost an afternoon rather than a thousand pounds.</Em>
    </>,
  ],
];

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
      className="lp-type h-[var(--oc-layout-height)] overflow-y-auto bg-lp-ground text-lp-body [scroll-behavior:smooth]"
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
        <section className="relative -mt-16 flex items-center overflow-hidden border-b border-lp-line bg-lp-tint pt-36 pb-16 sm:pt-40 sm:pb-20 lg:min-h-dvh lg:pt-32 lg:pb-16">
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
              this page holds its content in the same `max-w-[88rem]` measure, and
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

          <div className="relative mx-auto w-full max-w-[88rem] px-6 sm:px-8 lg:px-10">
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
              {/* **The mark, on its own and large.**

                  It was a pill with the mark and a line of small caps in it,
                  matching the eyebrows further down the page. That is gone at
                  the owner's request and what is left is the logo, which is
                  the version with nothing to keep true: a badge is a claim
                  slot — it is where "trusted by 5,000 writers" goes on every
                  other page of this kind — and a mark makes no claim at all.

                  `alt=""` and `aria-hidden`: the wordmark is already in the
                  header directly above this, so announcing the brand twice
                  before the headline is noise to anyone listening rather than
                  looking. The `<h1>` under it is the first thing said. */}
              <Image
                src="/logo-mark.png"
                alt=""
                aria-hidden="true"
                width={512}
                height={512}
                priority
                className="mb-6 h-16 w-16 object-contain sm:mb-7 sm:h-20 sm:w-20"
              />

              <h1 className="oc-display font-serif text-[2rem] leading-[1.1] font-semibold sm:text-[2.75rem] sm:leading-[1.05] lg:text-[3rem] xl:text-[3.5rem]">
                {/* **Ink, not the soft slate it was.** The two halves used
                    to be told apart by *value* — a grey problem above a blue
                    answer — and they are told apart by hue alone now, at the
                    owner's request. It reads harder, which suits the sentence:
                    the quiet half is the bad news. `lp-accent-soft` is left in
                    the palette; the note beside it still describes the pairing
                    this used to be half of. */}
                <span className="block text-lp-ink">
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
              {/* `max-w-2xl` rather than `xl`: at 36rem this set as three
                  lines and the last one carried a single word, which reads as
                  a paragraph that ran out rather than as a sentence. 42rem
                  turns it at the comma into two even lines.

                  **`lp-ink/85` rather than `lp-soft`**, a step darker at the
                  owner's request. Opacity rather than the next token down is
                  safe *here specifically*: the ladder has no step between
                  `lp-soft` and full ink, and this paragraph carries no
                  emphasis inside it — which is the one thing an opacity would
                  fade along with the rest. Do not copy the pattern into a
                  deck, where the whole mechanism is the gap between the grey
                  and the ink inside it. */}
              <p className="oc-lead mt-6 max-w-2xl font-serif text-xl leading-relaxed font-medium text-lp-ink/85 sm:mt-7 sm:text-[1.375rem]">
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

        {/* ---- Where the book comes back out ----------------------------

            The slot every landing page fills with customer logos under the
            words "trusted by", and **this one has no customers and will not
            invent any** — the same rule that removed the stat band and, later,
            the testimonial row further down. What it has instead is better
            suited to the moment:
            a visitor who has just dropped a manuscript into the check above is
            asking one question, *does my book come back out*, and every tile
            here answers it with something they can verify without an account.

            **The mosaic is the shape, borrowed deliberately.** A panel lifted
            over the hero, one sentence across the top, then a bento of small
            tiles — it is the arrangement a reader has been trained to read as
            proof, and the argument of this section is that our version of that
            proof is checkable where the usual one is not. Two kinds of tile:
            the programs a finished file opens in, each with the format that
            opens it, and three facts about what leaves this browser and in
            what shape.

            **Real marks in their real colours**, which is the page's other
            documented exception to greyscale: a row like this works on instant
            recognition, and Microsoft's four squares flattened to one grey is
            the *monochrome* mark, a different one from the mark people know.
            Sourcing and licences are in `works-with.tsx`. Nominative use —
            these are programs that open our exports, not partners, and nothing
            here says otherwise.

            **No edge fade.** The reference crops its grid at both sides so it
            bleeds, which says *there is more of this than the page has room
            for*. Every destination in `DESTINATIONS` is here, so a fade would
            be implying a count we do not have. The number is deliberately not
            written down in this comment or on the page: it was seven until
            Obsidian came off with the Markdown export, and a figure repeated
            in prose is the thing that goes stale while the grid stays
            correct. */}
        <section className="border-b border-lp-line px-6 pb-14 sm:pb-20">
          {/* Lifted over the hero, which is what makes it a panel rather than
              the next band down. The hero keeps its own bottom rule, so the
              overlap reads as one surface laid on another. */}
          <div className="relative mx-auto -mt-8 max-w-[88rem] rounded-3xl bg-lp-ground p-6 shadow-[0_-1px_0_var(--color-lp-line),0_24px_60px_-40px_rgba(15,15,16,0.35)] sm:-mt-12 sm:p-10">
            {/* Wider than the decks under a heading (`3xl`, not `2xl`): this
                one has no title over it to set its measure, and at the deck
                size a `2xl` column turns it into five short lines. */}
            {/* **"Your manuscript never leaves this browser" was here until
                2026-08-16.** The PDF is typeset on our server now — it is the
                only way a contents page can carry the page the chapters
                actually land on — so the sentence was no longer true of all
                four formats and has been narrowed to the three it is true of
                rather than softened into something vaguer. `/privacy` names
                the PDF route in full. */}
            <p className={`mx-auto max-w-3xl text-center ${SECTION_LEAD}`}>
              Your EPUB and Word file are <Em>built in this browser</Em> and
              send nothing; only the PDF is typeset on ours. The EPUB is{" "}
              <Em>verified against EPUBCheck 5.3</Em>, not asserted.
            </p>

            <ul className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-3 lg:grid-cols-5">
              {/* The three facts, spread through the marks rather than
                  gathered at one end — the reference alternates its stat tiles
                  with its logos, and the alternation is what stops the row
                  reading as a table of specifications with a summary stuck on
                  it. Each is checkable by the reader today: the first with
                  devtools, the second with a free validator, the third by
                  pressing export. */}
              {TILES.map((tile) =>
                tile.kind === "brand" ? (
                  /* The mark, on a fact's tinted ground rather than a mark's
                     bordered one — see the note on `Tile`. `/logo-mark.png` is
                     the blue-on-transparent artwork, so it sits on the tint
                     without a plate of its own; the white-on-blue file is the
                     favicon and would be a filled block here.

                     `alt=""` and `aria-hidden`: the wordmark is in the header
                     and the footer of this page already, so announcing the
                     brand a third time in the middle of a list of *other*
                     people's programs would be noise. */
                  <li
                    key="brand"
                    className="flex items-center justify-center rounded-2xl bg-lp-tint-soft p-4 sm:p-5"
                  >
                    <Image
                      src="/logo-mark.png"
                      alt=""
                      aria-hidden="true"
                      width={512}
                      height={512}
                      className="h-12 w-12 object-contain sm:h-14 sm:w-14"
                    />
                  </li>
                ) : tile.kind === "fact" ? (
                  <li
                    key={tile.label}
                    className="rounded-2xl bg-lp-tint-soft p-4 sm:p-5"
                  >
                    <p
                      className="oc-display font-serif text-[1.75rem] leading-none font-semibold sm:text-[2rem]"
                      style={tile.tone ? { color: tile.tone } : undefined}
                    >
                      {tile.figure}
                    </p>
                    <p className="mt-2 text-[0.8125rem] leading-snug text-lp-faint">
                      {tile.label}
                    </p>
                  </li>
                ) : (
                  <li
                    key={tile.destination.name}
                    title={`Opens the ${tile.destination.format} export`}
                    className="flex flex-col justify-between rounded-2xl border border-lp-line p-4 sm:p-5"
                  >
                    <svg
                      viewBox={tile.destination.mark.viewBox}
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0"
                    >
                      {tile.destination.mark.paths.map((path) => (
                        <path key={path.d} d={path.d} fill={path.fill} />
                      ))}
                    </svg>
                    <span className="mt-4 block">
                      <span className="block text-[0.875rem] leading-snug font-semibold tracking-tight text-lp-ink">
                        {tile.destination.name}
                      </span>
                      <span className="mt-1 block font-code text-[0.625rem] tracking-[0.12em] text-lp-faint uppercase">
                        {tile.destination.format}
                      </span>
                    </span>
                  </li>
                ),
              )}
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
          <div className="mx-auto max-w-[88rem]">
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

            It sits *above* the mosaic under the hero on purpose. That mosaic
            is a reassurance ("your book comes back out"), and a reassurance
            before the fear has been named is an answer to a question nobody
            asked. Named first, the mosaic becomes its first reply.

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
          <div className="mx-auto max-w-[88rem]">
            <Head
              center
              eyebrow="Before you upload"
              title="Three ways a finished book gets turned away"
              lead={
                <>
                  None of them is about the writing. Each one is a rule a shop
                  publishes and then enforces quietly, so the first you hear of
                  it is a listing that never appears.{" "}
                  <Em>
                    All three are knowable while the file is still on your
                    machine.
                  </Em>
                </>
              }
            />

            <ul className="mt-12 space-y-5 sm:mt-14 sm:space-y-6">
              {REJECTIONS.map((rejection, i) => (
                <Rejection
                  key={rejection.title}
                  n={String(i + 1).padStart(2, "0")}
                  title={rejection.title}
                  fix={rejection.fix}
                  note={rejection.note}
                  source={rejection.source}
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
            four formats in the mosaic under the hero and in the footer, and the
            zero in "The export is verified, not asserted". Four numerals on a
            band of their own asked a reader to be impressed by an arithmetic
            they had not been given a reason to care about yet.

            `Counted`, the component that drew one cell, went with it. It is
            twenty lines of presentation and every figure it read is imported
            elsewhere on this page, so keeping it callerless would have bought
            nothing but a standing lint warning — unlike `templates-dialog.tsx`
            and the coming-soon dialog, which are whole features waiting on a
            way in. */}

        {/* **"Three phases. Writing is one." is gone, removed 2026-08-14** at
            the owner's request, with the "Before you upload" panel below it.
            It was three cards — Write, Prepare, Track — each counting its own
            group out of `book-tools.ts`, over the claim that most software
            stops when the draft does.

            Nothing on the page depended on it and one thing is owed by it: the
            nav lost its `#does` entry in the same commit, because a link to an
            id that is not on the page scrolls nowhere and says nothing. The
            arrays it counted (`WRITE`, `PREPARE`, `TRACK`) are still read by
            the tools section, which lists them in full. */}

        {/* ---- The order, as a road you travel down ----------------------

            **Five alternating rows: the screen on one side, the phase on the
            other, sides swapping down the page.** Rebuilt on 2026-08-13 to the
            reference's layout, replacing a drawn road with a marker that rode
            it as the reader scrolled.

            The road's argument has to survive the change, and it is the reason
            this is not just a list: a writer is short of the *sequence*, not
            of five names. Three things carry it — the phases are numbered, each
            says how many steps it holds, and the ARC callout names its step's
            real number and phase. A reader taking only the numbers still gets
            an order.

            `OrderRows` has no `"use client"` and ships no script, which the
            road could not manage: the dimming needed measurement, a scroll
            handler and a reduced-motion path. `order-path.tsx` and the tested
            `landing-path.ts` are left in the tree unused — see TODO.md. */}
        <section
          id="order"
          /* **More side padding than the rest of the page, and it is the one
             section that needs it.** Everything else caps at `6xl`, so on a
             1280 window the max-width itself leaves about 64px of margin and
             `px-6` never comes into play. This section caps at `7xl` — wider
             than that window — so the padding *is* the margin, and at 24px the
             words ran to within an inch of the browser's edge while the row
             beside them had room to spare. 40px from `lg` puts the text back
             on a margin without giving the screens the width back.

             **It was a tinted field for part of 2026-08-14 and is white
             again.** Worth keeping the measurement that came out of it: on
             `lp-tint`, `lp-deck` — the deck grey every section lead is set in
             — falls to **3.95:1** and misses AA, where `lp-body` clears
             **5.8:1**. The tint carried `[--color-lp-deck:var(--color-lp-body)]`
             for exactly that reason, re-pointing the token for the subtree
             rather than hunting every deck in it. Put the tint back and that
             line has to come with it. On white the deck grey is legal (4.56:1)
             and the token stands as the palette states it. */
          className="scroll-mt-20 border-b border-lp-line px-6 py-14 sm:px-8 sm:py-20 lg:px-10"
        >
          {/* **`100rem` here where the rest of the page is `6xl`**, and it is
              for the screens rather than for the words: this is the one
              section built around large pictures, and at `6xl` with two equal
              columns each of them had about 34rem to live in — a laptop
              rendered at that width puts the app's own type below the size it
              can be read at. The header and the closing line under it cap
              themselves (`Head` at `3xl` when centred), so nothing but the
              rows takes the extra width.

              **Widened from `7xl` on 2026-08-14**, and it is the part of that
              change that costs the words nothing. Going at the grid's *ratio*
              alone buys the screens width by taking it from the column beside
              them, which is the move that has already had to be paid for
              twice — the phase heading came down from 72px to 52 and then to
              40 as that column narrowed. Container width is new rather than
              borrowed, so on a wide window it does most of the work and the
              text column ends up wider than it began.

              **The catch, and the reason `7xl` looked like it had done
              nothing: below about 1440 this cap is not what binds.** The
              section's own `lg:px-10` takes 80px off the viewport first, so
              anything above `viewport - 80` is a ceiling nothing reaches, and
              the row is exactly as wide at `100rem` as it was at `7xl`. Growth
              at those widths has to come from the grid ratio and the gap —
              which is why all three moved together, and why changing this
              number alone will read as no change at all on a 1280 window. */}
          <div className="mx-auto max-w-[100rem]">
            <Head
              center
              eyebrow="The whole point"
              title="The order"
              /* **No phase count here since 2026-08-13.** It read
                 "{STEPS.length} steps, {PHASES.length} phases" — counted off
                 the roadmap, which is the shape everything on this page
                 follows. Then this section stopped drawing the revising phase,
                 so the page said five and showed four, and a reader who counts
                 is exactly the reader this page is written for. The step count
                 stays because it is still true of the road and is the stronger
                 number; the rows themselves say how many phases are here. */
              lead={
                <>
                  {STEPS.length} steps, in the order they have to happen. The
                  software is the least of it;{" "}
                  <Em>the sequence is the thing nobody hands you</Em> — and the
                  steps people miss are the ones that cannot be done late.
                </>
              }
            />

            {/* The rows sit on the section's tint — see the note on the
                `<section>` above for the ground and the ink that came with
                it. */}
            <div className="mt-16 sm:mt-20">
              <OrderRows stations={ORDER_STATIONS} />
            </div>

            <p
              className={`mx-auto mt-16 max-w-3xl text-center sm:mt-20 ${SECTION_LEAD}`}
            >
              <Em>
                {SELF_TICKING} of the {SELF_TICKING + YOURS_TO_TICK} steps tick
                themselves
              </Em>{" "}
              from what is already in your book — no checklist to maintain, and
              nothing that can be lied to by accident. There is a test in the
              codebase asserting that the advance-copy step stays where it is.{" "}
              <Em>If it ever moves, the build fails.</Em>
            </p>
          </div>
        </section>

        {/* **The "Before you upload" panel is gone, removed 2026-08-14** at
            the owner's request, together with "Three phases. Writing is one."
            above it. It was a warm-paper panel — a two-column header over
            `CheckDemo` at full width — and its parts were not deleted so much
            as *distributed*, which is why the page loses nothing by it:

            - the **demo itself** is the figure for phase 02 in "The order"
              now, where it draws the same screens and works them;
            - the **header shape** — eyebrow and heading left, lead right — is
              what the listing section below uses;
            - the **claim** it made, that a shop's refusal is slow and silent
              and never says which of a dozen things was wrong, is made by the
              three refusal cards further up, which name the three.

            What went with it and is not owed: `--color-lp-paper` and the
            `lp-paper-accent*` pair are now unused by this file. They are left
            in `globals.css` — a token stated in one theme block and not the
            other is the bug that file warns about, and these are stated in
            both — but nothing on the page is warm paper any more. */}

        {/* ---- The metadata, which is where people actually give up ------

            A separate section from the check on purpose. The check is about
            what is *wrong*; this is about the part nobody warns you is boring
            — eight fields a shop demands, half of which have names you have
            never had to know. It is the most-skipped work in publishing and the
            cheapest to get right, so showing the form is showing the product
            doing its least glamorous and most useful thing. */}
        {/* **Set to the check panel's own shape since 2026-08-14**, at the
            owner's request: a two-column header — the eyebrow and the heading
            on the left, the lead on the right — and the figure on a row of its
            own beneath, rather than the `Split` this used to be.

            It buys the same thing it bought there. As a `Split` the heading,
            the lead and both paragraphs stacked in one half while the form sat
            in the other, so the words were a narrow column of four different
            sizes and the demo was read before any of them. Split across two
            rows, the header is taken in one pass at the width of the page and
            the demo gets a half rather than a column.

            The figure is on the **right** now (the `Split` carried `flip`,
            which put it left). Nothing in the section's argument depended on
            the side; what does depend on it is the two sections either side of
            this one, which both lead with words. */}
        {/* `bg-lp-ground` is written out rather than inherited: the sections
            either side of this one are tinted, and a white band between two
            tints is a decision. Stating it means a later change to the page's
            own ground cannot quietly take it. */}
        <section className="border-b border-lp-line bg-lp-ground px-6 py-14 sm:py-20">
          <div className="mx-auto max-w-[88rem]">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
              <div>
                {/* The dotted eyebrow the check panel uses, in this section's
                    own grey — that one is on warm paper and takes the paper
                    accent, which would be a second hue out here. */}
                <p className="flex items-center gap-2.5 font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-lp-faint"
                  />
                  The tedious part
                </p>
                <h2
                  className={`oc-display mt-5 font-serif text-lp-ink ${SECTION_TITLE}`}
                >
                  Every field a shop asks for, and why
                </h2>
              </div>

              {/* Top-aligned against the heading rather than centred on it,
                  which is what makes the two columns read as one row. */}
              <div className="lg:pt-1">
                <p className={`oc-lead font-serif ${SECTION_LEAD}`}>
                  An ISBN, a publisher, a language, a series.{" "}
                  <Em>Fields with names you have never needed</Em> until the
                  moment a shop refuses to go on without them.
                </p>
              </div>
            </div>

            {/* **Three questions beside the form, rather than two
                paragraphs.** Same two facts as the prose it replaced — every
                field says who wants it, every answer is saved, and none of it
                is required — but a reader arriving at a form full of words
                they have never had to know does not have a *paragraph*
                question, they have three specific ones. Asked as questions
                they can be scanned and only one has to be opened.

                Three, and no more: this is a column beside a figure, not the
                FAQ. The page has one of those already, further down, and a
                second long list here would be answering questions the section
                has not raised. */}
            <div className="mt-12 grid items-center gap-10 lg:mt-14 lg:grid-cols-2 lg:gap-16">
              <ListingQuestions />

              <WideFigure>
                <StoreListingDemo />
              </WideFigure>
            </div>
          </div>
        </section>

        {/* ---- Inside the app -------------------------------------------

            Three captures of the real screens, each beside what it is for.
            It sits here because everything above it argues about the *job* —
            the order, the refusals, the fields a shop asks for — and a reader
            who has been persuaded there wants to see the thing.

            The one section on this page whose figures are photographs by
            design rather than by exception, and the standing cost comes with
            it: when one of those screens moves, nothing fails and nothing
            warns. `scripts/feature-shots.cjs` regenerates them. */}
        <FeatureShots />

        {/* ---- The tool cloud --------------------------------------------

            **Four cards of pills until 2026-08-15**, grouped by job with a
            note on each and sixteen named chips inside them. It is a scatter
            of the marks around the count now, to the owner's reference.

            What went is the grouping and the sixteen names. That is a real
            loss and worth being honest about: the cards said what each tool
            was *for*, and a cloud says only how many there are. What buys it
            back is that this is not the only place they are listed — the
            footer carries every one by name, and the marks here are the
            dashboard's own, so a reader meets the same sixteen objects on this
            page that they will meet inside the product.

            **The names came back on 2026-08-15, one page along.** The loss
            above was real and `/tools` is where it is made good: the four
            groups, the sixteen names, and room to say what each one does rather
            than a pill's worth of space. The button below is the only way in
            from here, which is the trade this section is making — the cloud
            says how much there is, and the page says what it is.

            The count in the heading and the marks in the cloud both come from
            `ALL_TOOLS`, so neither can claim a tool that does not exist. */}
        <section
          id="tools"
          className="scroll-mt-20 overflow-hidden border-b border-lp-line px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-[88rem]">
            <ToolCloud>
              <p className="font-code text-[0.8125rem] font-semibold tracking-[0.18em] text-lp-faint uppercase">
                All of it included
              </p>
              <h2 className={`oc-display mt-4 text-lp-ink ${SECTION_TITLE}`}>
                {ALL_TOOLS.length} tools, nothing held back
              </h2>
              <p className={`mt-5 ${SECTION_LEAD}`}>
                Every one of them works on a real book rather than a sample.
              </p>
              {/* The way into the guide, and the one control in this section.
                  It is filled rather than a text link because it is the only
                  thing here to press — the marks around it are hover cards
                  rather than destinations, and a section whose sole action is
                  set as a sentence has no action as far as a skimming reader is
                  concerned.

                  `mt-8` matches the hero's gap under its own deck, so the two
                  centred stacks on this page put their buttons the same
                  distance below the words. */}
              <div className="mt-8 flex justify-center">
                <Link
                  href="/tools"
                  style={{ backgroundColor: INK }}
                  className="rounded-full px-6 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink hover:opacity-90"
                >
                  See what each tool does
                </Link>
              </div>
            </ToolCloud>
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
          <div className="mx-auto max-w-[88rem]">
            {/* The lead was two sentences and is now one, which cost nothing:
                the second half — that a no with nothing behind it is a feature
                we are missing — is *demonstrated* by the table's right-hand
                column rather than needing to be announced above it. */}
            <Head
              center
              eyebrow="Straight answer"
              title="What we will not do, and what we do instead"
              lead={
                <>
                  AI covers, AI editing, a marketplace.{" "}
                  <Em>We say no in public</Em> so you can plan around it rather
                  than discover it six months in, and each no carries the work
                  we did instead.
                </>
              }
            />
            {/*
              **Separated cards, and still a `<table>`.**

              It was one unbroken grid: cells butted together with shared
              hairlines, a ✕/✓ beside every line, and two column headings
              carrying the same two marks at the top. The style is the owner's
              — cards with air between them, a small label on each, no icons —
              and the markup underneath is deliberately unchanged.

              A refusal and the work we do instead are a *pair*; that is the
              whole argument of the section, and a pair is what a table row is.
              Rebuilt as two `<div>` columns it would read to a screen reader as
              four unrelated refusals followed by four unrelated promises, with
              nothing saying which answers which. So the cells simply became
              cards: `border-spacing` puts the air in, each cell takes its own
              border and radius, and the row still binds the two.

              The headings stay for the same reason and go `sr-only`: they are
              the accessible names for the columns, and the cards carry the
              same two words visibly. Printing both would say it twice.
            */}
            <table className="mt-12 w-full border-separate border-spacing-x-0 border-spacing-y-4 text-left md:border-spacing-x-4">
              <thead className="sr-only">
                <tr>
                  <th scope="col">What we will not do</th>
                  <th scope="col">What we do instead</th>
                </tr>
              </thead>
              <tbody className="max-md:block">
                {REFUSALS.map(([name, why, doTitle, doNote]) => (
                  <tr key={name} className="max-md:block">
                    <td className="rounded-2xl border-2 border-stop-line bg-stop-bg px-7 py-7 align-top max-md:block md:w-1/2">
                      <Point
                        eyebrow="Will not"
                        tone={STOP}
                        title={name}
                        note={why}
                      />
                    </td>
                    <td className="rounded-2xl border-2 border-ok-line bg-ok-bg px-7 py-7 align-top max-md:mt-4 max-md:block md:w-1/2">
                      <Point
                        eyebrow="Instead"
                        tone={PASS}
                        title={doTitle}
                        note={doNote}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Where "What comes after that" was -------------------------

            The **"Not built yet"** section — three dashed cards, each headed
            "Not built", under the promise that you could hold us to the
            difference between a plan and a product — was **removed on
            2026-08-14** at the owner's request. `LATER`, the array behind it,
            went with it: the three entries are recorded verbatim in TODO.md
            under "Taken out on purpose", which is where to look before
            rebuilding it.

            **The rule it enforced does not go with it, and it now has nowhere
            of its own to live, which is the cost.** It was this: nothing stays
            under that badge once it ships. The list had carried the series
            bible, ranked comps and the book-three curve until each one landed,
            and a page still promising a shipped feature says something untrue
            in the one section whose whole job was being trustworthy about that
            distinction. What survives the removal is the *other* half of the
            same rule, and it is the half that still binds every line on this
            page: nothing here may claim what the app cannot do. The three
            absences the section listed are all still stated where they
            actually bite — the PDF's limits wherever the PDF is named, and the
            tool stores' not syncing on every screen that has one.

            Nothing linked to it: it carried no `id` and the nav never had an
            entry for it, so this is a deletion with no dangling anchor. */}

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
            be searched with the browser's own find.

            **The rows are cards and the ask is a panel**, which is the
            reference's arrangement rather than the hairline list this used to
            be. Three things follow from copying it, and each is a rule this
            page already had rather than a new one:

            - The panel takes `lp-card-1`, the page's own decorative indigo
              ground. That token is *grounds only* — never ink, never a control
              and never a badge — so the eyebrow above it stays neutral
              (`lp-well`) even though the reference tints its own. A badge in a
              decorative hue is the one use the palette note rules out by name.
            - The question cards take `lp-well` with a hairline, so the tinted
              panel is the only colour on the row and the eye goes to the ask
              rather than to the list. Two tinted columns would compete.
            - The mark on the right became a chevron in a ring, because a card
              *is* a surface you press and the ring now reads as the control the
              whole card is. The bare plus was right when these were rows on the
              page and would read as punctuation floating on a card. */}
        {/* `id="faq"` is the bar's own entry. `scroll-mt-20` clears the sticky
            header, as every other anchored section here does. */}
        <section
          id="faq"
          className="scroll-mt-20 border-b border-lp-line px-6 py-16 sm:py-24"
        >
          {/* **One centred column, not two.** It was a 24rem heading column
              beside the rows — the arrangement the rest of this page uses —
              and it is the owner's reference that changed it: the heading sits
              over the list now, centred, with the rows running the full
              measure under it.

              What that buys is line length. Beside a heading column the rows
              had about two thirds of the page; centred they have all of it, so
              a question and its answer stop turning at awkward places on a
              laptop. What it costs is the heading's job — it was holding one
              side of a two-column composition and is now a title over a list,
              which is what every other section heading here already is. That
              is the trade, and it makes this section less special rather than
              more, which is the right direction for the one section a reader
              arrives at with a specific question. */}
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              {/* The dot is what turns a line of small caps into a *label*, and
                  the pill is what the reference puts around it. Neutral ground
                  on purpose: the decorative tints are grounds, and a badge is
                  the use they are ruled out for. */}
              <p className="inline-flex items-center gap-2.5 rounded-full border border-lp-edge bg-lp-well px-3.5 py-1.5 font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-lp-faint"
                />
                Questions
              </p>

              <h2
                className={`oc-display mt-6 font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                Frequently Asked Questions
              </h2>
            </div>

            {/* **The "Still have a question?" panel was here and is gone**, at
                the owner's request. It carried the contact address and the
                reply time out of `legal.ts`, and the reason it existed is
                worth leaving on the record: a reader whose question is not on
                the list has just been told, by omission, that there is nowhere
                to put it. Nothing else in this section says otherwise now —
                the footer's Contact link is the only remaining route, and it
                does not promise a person or a reply time. Put it back here if
                that ever reads as a gap. */}
            {/* **Hairline rows, not cards**, at the owner's request — the
                same treatment `listing-questions.tsx` uses further up the
                page, so the two question lists finally look like one idea
                rather than two components that happen to both open.

                The card version put a border, a ground and a ring around every
                row, which is a lot of furniture for a list whose whole job is
                to be scanned. A rule between rows is the least a list can be
                divided by, and it lets the question take the size it wants:
                the heading is now the FAQ's own type rather than a label
                inside a box.

                It stays `<details>` rather than borrowing that component
                outright. `ListingQuestions` keeps one open at a time in React
                state, which is right beside a figure — the column has a fixed
                height to respect. Here there is nothing to push out of place,
                so a reader may open as many as they like and the section needs
                no JavaScript at all. */}
            <div className="mt-10 border-t border-lp-line sm:mt-12">
              {FAQ.map(([q, a], i) => (
                <details
                  key={q}
                  open={i === 0}
                  className="group border-b border-lp-line"
                >
                  {/* `list-none` and the WebKit rule together: Safari draws its
                      triangle through a pseudo-element the standard property
                      does not reach, so one without the other leaves a marker
                      in exactly one browser. */}
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                    <span className="oc-heading font-serif text-[1.375rem] leading-snug font-semibold text-lp-ink sm:text-[1.5rem]">
                      {q}
                    </span>
                    {/* **The ring is gone with the card.** A circled mark reads
                        as a button sitting beside a label when the row is a
                        rule rather than a surface — it was stripped back for
                        exactly this reason the last time these were rows, and
                        the ring only earned its place while the whole card was
                        the control. One glyph turned over rather than two
                        swapped, so the row does not flicker as it opens. */}
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 shrink-0 text-lp-faint transition-transform duration-200 group-hover:text-lp-body group-open:-rotate-180 group-open:text-lp-body"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </summary>
                  {/* Stopped short of the chevron, so the answer reads as
                      belonging to the line above it rather than as the next
                      row. `lp-soft` at regular weight, which is the same
                      answer type the listing questions take — the emphasis
                      inside stays semibold ink, so the two-tone reading the
                      copy is written for survives the lighter base. */}
                  <p className="pr-10 pb-6 text-[1.0625rem] leading-[1.6] text-lp-soft">
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
          <div className="mx-auto max-w-[88rem]">
            <Head
              center
              eyebrow="Before you trust us"
              title="Four things you can check without believing a word"
              lead={
                <>
                  <Em>
                    Every claim on this page can be settled by you, today,
                  </Em>{" "}
                  without an account and without taking our word for any of it —
                  with devtools, a free validator, and the export button.
                </>
              }
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

            {/* **The testimonial slot was here and is coming back.** It held
                the *research* rather than customers — real things writers said
                about the problem, nobody named, each with the module it caused
                underneath. It came out on **2026-08-13** to be rebuilt, and
                `TODO.md` records the four rules it kept so the replacement does
                not quietly become the invented quotes this page refuses. Until
                then there is no testimonial row at all, which is the safe
                direction: an empty slot claims nothing.

                What stays is the risk reversal, which was always the last thing
                in this block rather than part of the row above it. */}
            <div className="mt-14 border-t border-lp-line pt-10">
              {/* The free plan, the refund window and a reachable human. The
                  first is made twice more on this page and the address is in
                  the footer, but the refund window is said nowhere else, and
                  it is the one a reader is owed before they are asked for a
                  card. The address is the same module `/contact` prints
                  from. */}
              <p className="text-center text-[0.875rem] leading-relaxed text-lp-faint">
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

            The last ask, and the top half of one closing composition: a
            landscape running full-bleed under both this and the footer, with
            the ask centred on its sky and the footer riding up onto its foot
            as a card. The two are separate elements — this one closes `<main>`
            and the footer follows it — but they are one picture, joined by a
            negative margin rather than by a wrapper, so `<main>` keeps the
            content that belongs in it.

            Read `cta-banner.tsx` for what the picture cost (the drawn app
            window, and why nothing it said was lost) and `globals.css` beside
            `.oc-closing-field` for the contrast measurement that decides what
            may sit on the sky at all. */}
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

/**
 * The claim inside a deck, in near-black on the deck's grey.
 *
 * One component rather than `<strong className={LEAD_EM}>` at thirteen call
 * sites: the emphasis is a *rule* about how a deck is read, and thirteen copies
 * of a class string is how eleven of them end up right and two drift.
 */
function Em({ children }: { children: React.ReactNode }) {
  return <strong className={LEAD_EM}>{children}</strong>;
}

function Head({
  eyebrow,
  title,
  lead,
  center = false,
}: {
  eyebrow: string;
  title: string;
  /* A `ReactNode` rather than a string so a deck can carry `<Em>` on the words
     that are its claim — see `SECTION_LEAD`. Plain strings still work and most
     of the shorter decks are still strings. */
  lead?: React.ReactNode;
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
  /* A `stage` flag used to sit here, swapping every ink for the `lp-stage-*`
     set so this could be used on the black check panel. That panel is warm
     paper now and writes its own two-tone heading, so the flag lost its only
     caller. The stage tokens themselves stay: `AppWindow`'s bezel is drawn
     with them, and it is what frames the check's own screen. */
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
        {eyebrow}
      </p>
      <h2 className={`oc-display mt-5 font-serif text-lp-ink ${SECTION_TITLE}`}>
        {title}
      </h2>
      {lead && (
        <p className={`oc-lead mt-5 font-serif ${SECTION_LEAD}`}>{lead}</p>
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
  title,
  fix,
  note,
  source,
  figure,
  tint,
}: {
  n: string;
  title: string;
  fix: string;
  note: string;
  source: string;
  figure: ReactNode;
  tint: (typeof CARD_TINTS)[number];
}) {
  return (
    /* `overflow-hidden`, because the figure runs to the card's own edge and
       has to be cut by its rounding rather than sitting inside it. */
    <li className={`rounded-3xl p-6 sm:p-8 lg:p-10 ${tint.ground}`}>
      {/* **Even margin all round the figure, and the two columns are one
          height.** The figure ran to the card's own right edge for a while —
          the reference's own trick — and at these proportions it was wrong
          twice: the drawn screen is wider than it is tall, so bleeding it
          right made it collide with the card's corner instead of settling
          into it, and the card lost the band of colour that tells the three
          apart at a glance.

          Padded evenly and stretched, the tint frames the screen on all four
          sides and the figure is as tall as the words beside it — which is
          what makes the row read as *a page beside a screen* rather than as
          two objects of unrelated height that happen to be adjacent.

          `items-stretch` is what does the second half, with `fill` on the
          window inside. The drawn screen keeps its own size and sits at the
          top of the glass; the space under it is not a gap to be closed, it
          is what a real application window looks like. */}
      <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
        {/* `items-start` is not optional. A flex column stretches its children
            across the cross axis by default, which took the badge and the
            button — both `inline-flex`, both meant to hug their own words —
            and ran them the full width of the column as two coloured bars. */}
        <div className="flex flex-col items-start justify-center">
          {/* **A solid pill in the card's own hue, with three fading echoes
              behind it**, as the reference draws it. They are the same pill
              shifted left and dimmed, so the badge reads as something that has
              *arrived* rather than as a static label — motion implied by
              repetition, which is the one way to suggest it without anything
              actually moving on a page a reader may leave open.

              Absolutely positioned rather than laid out, so they take no width
              and the solid pill keeps the left edge the heading and the
              paragraph below it use. They extend into the card's own padding,
              which is 40px at `lg` against 24px of trail, so nothing is
              clipped — the card carries no `overflow-hidden`, and must not
              grow one without this being re-checked.

              The mark went with the change, and that is the reference's shape
              rather than an accident: it was a white glyph on a coloured pill
              beside three words in caps, at 14px, where the word is doing all
              the work. The nouns it drew — a shelf, a magnifier, a file — are
              still on the drawn screen beside it. */}
          <span className="relative inline-flex items-center">
            {[
              { at: 8, opacity: 0.42 },
              { at: 16, opacity: 0.24 },
              { at: 24, opacity: 0.12 },
            ].map(({ at, opacity }) => (
              <span
                key={at}
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-full rounded-full"
                style={{
                  backgroundColor: tint.fill,
                  opacity,
                  transform: `translateX(-${at}px)`,
                }}
              />
            ))}
            <span
              style={{ backgroundColor: tint.fill }}
              className="font-code relative rounded-full px-4 py-1.5 text-[0.6875rem] font-semibold tracking-[0.14em] text-white uppercase"
            >
              Refusal {n}
            </span>
          </span>

          {/* Two lines: the problem in ink, the answer in the card's own hue.
              `block` on both, so the break is the layout's rather than a
              `<br>` that has to be re-guessed at every width.

              **Set to the order rows' own scale since 2026-08-14** — 32px into
              40px, bold, at `leading-[1.08]` — so the two sections a reader
              meets one after the other are plainly one typography rather than
              two sizes of the same idea. The pattern is the whole of what was
              copied: eyebrow, big bold title, one heavy grey paragraph. The
              badge and the button keep their own sizes, because those are
              controls and a control that grows with the prose stops looking
              like a control. */}
          <h3 className="oc-heading mt-5 font-serif text-[2rem] leading-[1.08] font-bold sm:text-[2.5rem]">
            <span className="block text-lp-ink">{title}</span>
            <span className="block" style={{ color: tint.ink }}>
              {fix}
            </span>
          </h3>

          {/* The rows' note, to the letter, with one change forced by the
              ground: `lp-body` rather than `lp-deck`. The deck grey is
              calibrated against pure white and these cards are tinted panels,
              where it lands under 4.5:1 — the same step-up the FAQ makes on
              `lp-well` and the order section now makes by re-pointing the
              token. `max-w-prose` came off with the size: at 22px it capped
              nothing the column was not already capping. */}
          <p className="mt-5 text-[1.25rem] leading-[1.5] font-semibold text-lp-body sm:text-[1.375rem]">
            {note}
          </p>

          {/* Where the reference puts a customer's logo and their result. We
              have neither and will not invent them, so the slot carries the
              provenance of the rule — which is what this audience is actually
              short of, and what the rest of the page already does with every
              figure it prints.

              No rule above it any more: on a coloured ground a hairline is a
              third line of chrome in a column that already has a pill and a
              button, and the reference separates this with space alone. */}
          {/* Up from 13px with the rest of the card. It has no counterpart in
              the order rows — nothing there carries a provenance line — so it
              keeps its job as the quiet one and simply stops being tiny beside
              a 22px paragraph. */}
          <p className="mt-8 text-[0.9375rem] leading-relaxed text-lp-faint">
            {source}
          </p>

          {/* **One button, where the reference has two.** Its second is a
              link into a marketplace; the honest second here would be the tool
              that mends this, and every one of those needs an account, so it
              would be a button that goes to a sign-up wall wearing the label
              of a feature. One control that works beats two where one is a
              door.

              A plain anchor, not `<Link>`, and that is the same choice the
              header's three in-page links make. The page's scroll container is
              the `lp-type` div rather than the window, so the fragment has to
              be handled by the browser — which walks up to the nearest
              scrollable ancestor — instead of by the router's own scroll
              restoration, which is written for the document. */}
          <a
            href="#check"
            style={{ backgroundColor: tint.fill }}
            className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.875rem] font-semibold text-white hover:opacity-90"
          >
            Check your book
            <span aria-hidden="true">→</span>
          </a>
        </div>

        {figure}
      </div>
    </li>
  );
}

/* `Split` — a section with the words on one side and a picture on the other,
   with `flip` to swap them — stood here until 2026-08-14 and is gone rather
   than kept, because it had run down to one caller and that caller now writes
   its own two rows. It is the case CLAUDE.md distinguishes from
   `templates-dialog.tsx`: thirty lines of layout, no logic, nothing tested,
   and keeping it callerless would have bought nothing but a standing lint
   warning. The one thing worth carrying forward is why the flip classes sat on
   the *figure* rather than on the words — so the words stay first in the DOM
   and a screen reader is never handed the picture first. `OrderRows` does the
   same thing for the same reason. */

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
  eyebrow,
  tone,
  title,
  note,
}: {
  /** The card's own label, since the column headings are `sr-only` now. */
  eyebrow: string;
  tone: string;
  title: string;
  note: string;
}) {
  return (
    <div>
      {/* The one thing on the card that carries the hue. The title stays in
          `lp-ink` and the note in the section's body grey: a card tinted red
          with red type on it is a warning, and half of these are the opposite
          of one. */}
      <p
        className="font-code text-[0.8125rem] font-semibold tracking-[0.14em] uppercase"
        style={{ color: tone }}
      >
        {eyebrow}
      </p>
      {/* **The FAQ's question and answer, verbatim.** Those two lines are the
          page's existing treatment for a short claim followed by the paragraph
          that qualifies it, which is exactly the job these cards do — so they
          take the same face, size, weight and leading rather than a fourth
          scale invented for one section.

          `lp-soft` for the body, and it is the one value that had to be
          checked rather than copied: the FAQ sits on white and these cards sit
          on a tint. It measures 8.7:1 on `stop-bg` and 9.0:1 on `ok-bg`, so it
          carries over comfortably — unlike `lp-deck`, which is tuned to white
          and fails on both. */}
      <p className="oc-heading mt-3 font-serif text-[1.375rem] leading-snug font-semibold text-lp-ink sm:text-[1.5rem]">
        {title}
      </p>
      <p className="mt-3 text-[1.0625rem] leading-[1.6] text-lp-soft">{note}</p>
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

/* `Phase` — the three cards of "Three phases. Writing is one." — went with
   that section on 2026-08-14. It is the `Counted` case again: presentation
   with no logic, no test and no second caller, where keeping it callerless
   buys a standing lint warning and nothing else. The one detail in it worth
   carrying: its glyph tile was a `color-mix` wash of whatever it sat on rather
   than an eight-digit hex, because a token cannot carry its own alpha —
   `var(--x)1f` is a string, not a colour, and CSS drops the declaration
   without a word. */

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
