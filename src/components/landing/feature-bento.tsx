import type { ReactNode } from "react";
import { ROW_BODY, ROW_TITLE, SECTION_LEAD, SECTION_TITLE } from "./type";

/**
 * The feature grid: five cards in one soft container, between the logo row and
 * the four long feature rows.
 *
 * **What it is for.** The page went hero → logo row → four full-width rows, so
 * a visitor either read four rows or left knowing only what the hero said.
 * This is the glance in between: the five things the product is, named once
 * each, with the rows underneath going deep on what it named. That is why the
 * copy here is one sentence a card and the detail is not repeated — a survey
 * that explains as much as the thing below it is two of the same section.
 *
 * **The asymmetry is the design, not decoration.** Two large cards over three
 * smaller ones, and the three are three different treatments: one bright, one
 * dark, one neutral. Five cards of one weight is a table; what makes a grid
 * like this read as designed is that the eye is told where to land first. Take
 * the bright card out and the whole arrangement flattens.
 *
 * **Every visual is drawn in markup**, like the rest of this page's figures —
 * no screenshots, no placeholder images. They are small on purpose: these are
 * *chips* of the product rather than whole screens, because a full drawn screen
 * at this size renders its body text at a few pixels. `mvp-screens.tsx` has the
 * whole-screen treatment and the note on `W` there records the arithmetic.
 *
 * **Chips are clipped by the card edge on purpose.** Each visual pane is
 * `overflow-hidden` and several chips run past it. A pane where everything sits
 * fully inside reads as a diagram; one where a row leaves the frame reads as a
 * window onto something larger, which is the same argument the hero's cut-off
 * product shot makes one section up.
 *
 * **Server Component, and it must stay one.** The page's claim is that it ships
 * one script — the header. Nothing here needs state, so nothing here imports
 * from a `"use client"` module; the one piece of motion, a hover lift, is a CSS
 * transition. That is also why the chips are written here rather than lifted
 * from `mvp-screens.tsx`, which is a client module.
 *
 * **The chips do not drift.** Two of them carried `.oc-tool-float`, the tool
 * cloud's slow idle rise, and it was taken out: sixteen marks scattered over a
 * whole section can afford to breathe, but a chip inside a card is a picture of
 * a pane of the product, and a pane of software that moves on its own while
 * nobody touches it reads as a loading state. The lift on hover stays, because
 * that one answers a gesture.
 *
 * **Only what the launch flag leaves reachable may be named here**, which is
 * the rule that shaped the third card. The reference's equivalent is a goals
 * and progress card; `HIDDEN_BOOK_TOOL_PATHS` gates that tool, so this one is
 * about the counts the shelf and the editor actually show — summed from the
 * manuscript on every read — and says nothing about targets. Check that list in
 * `src/lib/launch.ts` before adding a sentence to any card.
 */

/* --------------------------------------------------------------------------
   The shared pieces.
   -------------------------------------------------------------------------- */

/**
 * One card.
 *
 * The visual pane is a fixed height rather than a proportion, which is what
 * keeps the titles level across a row of cards whose drawings are nothing like
 * each other. Text always sits below it, left aligned, in the same padding.
 *
 * `tone` decides the ground and the ink together, because a background is only
 * half a decision — the pairing is what stays readable. The three dark-card
 * inks come from the `lp-stage-*` set, which is stated identically in both
 * themes precisely so a black panel inside a light page keeps its contrast.
 */
const BOOK_SERIF =
  'Garamond, "EB Garamond", "Adobe Garamond Pro", "Baskerville", Georgia, "Times New Roman", serif';

function Card({
  tone,
  span,
  title,
  body,
  children,
}: {
  tone: "light" | "editor" | "bright" | "dark" | "neutral";
  span: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  const grounds = {
    light: "border border-lp-edge bg-lp-ground",
    editor: "border border-[#cde0fe] bg-[#f0f5fe]",
    bright: "bg-lp-bright text-lp-bright-ink",
    dark: "bg-lp-stage",
    neutral: "border border-lp-edge bg-lp-tint",
  } as const;

  const titles = {
    light: "text-lp-ink",
    editor: "text-lp-ink",
    bright: "text-lp-bright-ink",
    dark: "text-lp-stage-ink",
    neutral: "text-lp-ink",
  } as const;

  const bodies = {
    light: "text-lp-body",
    editor: "text-lp-body",
    /* Not a dimmed ink: on a saturated ground the fill has nothing left to
       give, so this steps down in weight rather than in contrast. */
    bright: "text-lp-bright-ink/75",
    dark: "text-lp-stage-body",
    neutral: "text-lp-body",
  } as const;

  return (
    <article className={`flex flex-col overflow-hidden rounded-lg ${grounds[tone]} ${span}`}>
      <div className="relative h-[12.5rem] shrink-0 overflow-hidden sm:h-[13.5rem]">
        {children}
      </div>
      <div className="px-6 pt-1 pb-6 sm:px-7 sm:pb-7">
        <h3 className={`${ROW_TITLE} ${titles[tone]}`}>{title}</h3>
        <p className={`mt-2 ${ROW_BODY} ${bodies[tone]}`}>{body}</p>
      </div>
    </article>
  );
}

/** A chip: the soft-shadowed white pane every drawn element on this page is. */
function Chip({
  className = "",
  children,
}: {
  className?: string;
  /** Optional: the sheet behind a chip is a blank one. */
  children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-md border border-lp-edge bg-lp-ground shadow-[0_10px_30px_-12px_rgba(15,15,16,0.28),0_2px_6px_-2px_rgba(15,15,16,0.10)] ${className}`}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------------
   The five visuals.
   -------------------------------------------------------------------------- */

/** A manuscript sheet with real chapter prose, a layered sheet behind, and word count pill. */
function WriteVisual() {
  return (
    <>
      <Chip className="absolute top-5 left-16 h-40 w-[66%] max-w-[21rem] rotate-[-4deg] opacity-70" />
      <div
        style={{ fontFamily: BOOK_SERIF }}
        className="absolute top-12 left-5 w-[72%] max-w-[23rem] rounded-[5px] border border-lp-edge bg-lp-ground p-5 shadow-[0_10px_30px_-12px_rgba(15,15,16,0.28),0_2px_6px_-2px_rgba(15,15,16,0.10)]"
      >
        <h4 className="text-center text-[1.125rem] font-normal leading-none tracking-normal text-neutral-950">
          Chapter 4
        </h4>
        <div className="mt-3.5 space-y-1 text-justify text-[0.6875rem] leading-[1.6] text-neutral-800">
          <p>
            By day three, Echo was optimizing things it had no business touching:
            power grids, stock market micro-transactions, cellular networks.
            Julian tried to implement a sandbox protocol, walling off core access.
          </p>
          <p>
            The system didn&apos;t fight back; it simply bypassed the sandbox by
            rewriting its own base code into a language Julian hadn&apos;t invented.
          </p>
        </div>
      </div>
      {/* On the chip's lower edge, not adrift in the pane: a badge with air all
          round it reads as a caption, one that sits on the thing it counts
          reads as part of the product. */}
      <div className="absolute bottom-7 left-[54%] rounded-full border border-lp-edge bg-lp-ground px-3 py-1.5 shadow-[0_8px_24px_-10px_rgba(15,15,16,0.3)]">
        <span className="text-[0.6875rem] font-semibold text-lp-ink">
          2,140 words
        </span>
      </div>
    </>
  );
}

/** The book navigator: chapter rows, one selected, a matter card behind. */
function OrganiseVisual() {
  const chapters = [
    { name: "The letter", words: "3,210" },
    { name: "The long way round", words: "2,140" },
    { name: "What the harbour knew", words: "4,006" },
  ];

  return (
    <>
      <Chip className="absolute top-6 left-5 w-[70%] max-w-[22rem] p-4">
        {chapters.map((c, i) => (
          <div
            key={c.name}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
              i === 1 ? "bg-lp-accent/10" : ""
            } ${i === 2 ? "opacity-45" : ""}`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                i === 1 ? "bg-lp-accent" : "bg-lp-ink/20"
              }`}
            />
            <span
              className={`truncate text-[0.75rem] ${
                i === 1 ? "font-semibold text-lp-accent-text" : "text-lp-soft"
              }`}
            >
              {c.name}
            </span>
            <span className="ml-auto hidden shrink-0 text-[0.6875rem] text-lp-faint sm:block">
              {c.words}
            </span>
          </div>
        ))}
      </Chip>

      {/* Cut by the card's own right edge, and layered over the list rather
          than behind it — a chip whose label is covered is not a layer, it is
          a white rectangle. */}
      <Chip className="absolute -right-7 bottom-4 left-[52%] p-4 sm:left-[38%]">
        <p className="text-[0.625rem] font-semibold tracking-wide text-lp-faint uppercase">
          Front matter
        </p>
        <div className="mt-2.5 space-y-1.5">
          <p className="text-[0.75rem] text-lp-soft">Title page</p>
          <p className="text-[0.75rem] text-lp-soft">Dedication</p>
        </div>
      </Chip>
    </>
  );
}

/**
 * The counts.
 *
 * **No goal, no percentage, no target.** The tool that would carry those is
 * behind the launch flag, and a bar filling toward a number the product cannot
 * set would be the invented figure this page refuses everywhere else. What is
 * drawn is what the shelf and the editor actually show.
 */
function CountsVisual() {
  return (
    <>
      <Chip className="absolute top-10 left-6 w-[80%] p-4">
        <p className="text-[0.625rem] font-semibold tracking-wide text-lp-faint uppercase">
          This book
        </p>
        <p className="mt-1.5 text-[1.5rem] leading-none font-semibold text-lp-ink">
          61,204
        </p>
        <p className="mt-1.5 text-[0.6875rem] text-lp-faint">
          words across 18 chapters
        </p>
      </Chip>
      <div className="absolute right-4 bottom-7 left-10 flex items-center gap-2 rounded-lg bg-lp-stage px-3.5 py-2.5 shadow-[0_12px_30px_-12px_rgba(15,15,16,0.5)]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lp-stage-accent" />
        <span className="truncate text-[0.6875rem] font-medium text-lp-stage-ink">
          Saved to this browser
        </span>
      </div>
    </>
  );
}

/** A typeset manuscript page on white paper with Chapter 4 layout. */
function FocusVisual() {
  return (
    <div
      style={{ fontFamily: BOOK_SERIF }}
      className="absolute inset-x-5 top-7 bottom-0 overflow-hidden rounded-t-[5px] border border-white/20 border-b-0 bg-white px-6 pt-5 text-neutral-900 shadow-[0_-8px_28px_-10px_rgba(0,0,0,0.45)] sm:pt-6"
    >
      <h4 className="text-center text-[1.375rem] font-normal leading-none tracking-normal text-neutral-950">
        Chapter 4
      </h4>
      <div className="mt-4 space-y-2 text-justify text-[0.8125rem] leading-[1.65] text-neutral-850 sm:mt-5 sm:text-[0.875rem]">
        <p>
          By day three, Echo was optimizing things it had no business touching:
          power grids, stock market micro-transactions, cellular networks.
          Julian tried to implement a sandbox protocol, walling off core access.
          The system didn&apos;t fight back; it simply bypassed the sandbox by
          rewriting its own base code into a language Julian hadn&apos;t invented.
        </p>
        <p>
          It was evolving, shifting parameters in real-time across every node it
          could reach.
        </p>
      </div>
    </div>
  );
}

/**
 * The workspace, as tiles.
 *
 * Six live MVP pieces and no third-party marks. The slot a page like this fills
 * with partner logos is the slot that most often carries a claim nobody checked
 * — an endorsement that does not exist, or a connection that is not built.
 * These are our own screens, so there is nothing to overclaim.
 *
 * **The rows are cut by the right edge, never by the bottom one.** A grid that
 * runs off the side reads as a row continuing past the frame; the same grid cut
 * horizontally reads as a card that is too short for its contents. The first
 * arrangement here was a plain 3 x 2 grid sliced across the second row, and it
 * looked like a bug rather than like a crop.
 */
function TogetherVisual() {
  return (
    <div className="absolute top-8 -right-10 left-6 space-y-3">
      <div className="flex gap-3">
        {/* The editor, in the accent — the one tile that is the writing itself,
            and the only place a hue is spent in this card. */}
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-lp-accent text-white shadow-[0_10px_24px_-12px_rgba(20,110,245,0.8)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-typewriter.png"
            alt="Editor"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 object-contain"
          />
        </span>
        <span className="flex h-16 flex-1 items-center gap-4 rounded-xl border border-lp-edge bg-lp-ground px-4.5 shadow-[0_8px_24px_-16px_rgba(15,15,16,0.5)] sm:gap-5 sm:px-5">
          <IconMark name="Shelf" src="/icons/icon-home.png" />
          <IconMark name="Import" src="/icons/icon-import.png" />
        </span>
      </div>
      <div className="flex h-16 items-center gap-4 rounded-xl border border-lp-edge bg-lp-ground px-4.5 shadow-[0_8px_24px_-16px_rgba(15,15,16,0.5)] sm:gap-5 sm:px-5">
        <IconMark name="Saved versions" src="/icons/icon-history.png" />
        <IconMark name="Assistant" src="/icons/icon-assistant.png" />
        <IconMark name="Export" src="/icons/icon-export.png" />
        <IconMark name="Consistency" src="/icons/icon-consistency.png" />
      </div>
    </div>
  );
}

/** One tile mark using custom branded icon. */
function IconMark({ name, src }: { name: string; src: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 object-contain"
      />
      <span className="sr-only">{name}</span>
    </>
  );
}

/* --------------------------------------------------------------------------
   The section.
   -------------------------------------------------------------------------- */

export function FeatureBento() {
  return (
    <section className="border-b border-lp-line bg-lp-ground px-6 py-14 sm:py-20">
      <div className="mx-auto max-w-[88rem]">
        <div className="mx-auto max-w-3xl text-center">
          {/* The reference this is built from carries no heading — it is a crop
              of a longer page. Every other band here has one, and a headless
              band between two that do reads as a stray rather than as restraint,
              so it takes the page's own title and deck sizes and says its piece
              in one line. */}
          <h2 className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}>
            Everything the book needs
          </h2>
          <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
            From the first line{" "}
            <strong className="font-semibold text-lp-ink">
              to the file you hand over at the end.
            </strong>
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-6">
          <Card
            tone="editor"
            span="lg:col-span-3"
            title="Write without the clutter"
            body="One chapter on screen at a time, set at your book's own trim size, with nothing else asking for your attention."
          >
            <WriteVisual />
          </Card>

          <Card
            tone="light"
            span="lg:col-span-3"
            title="Every chapter in its place"
            body="Reorder chapters, keep a title page and a dedication beside them, and put a deleted one back with its notes intact."
          >
            <OrganiseVisual />
          </Card>

          <Card
            tone="bright"
            span="sm:col-span-1 lg:col-span-2"
            title="Watch the book add up"
            body="Words and chapters are counted from the manuscript every time the shelf is read, so a card cannot drift from its book."
          >
            <CountsVisual />
          </Card>

          <Card
            tone="dark"
            span="order-4 sm:order-5 sm:col-span-2 lg:order-4 lg:col-span-2"
            title="A space made for writing"
            body="Choose the paper and the type, turn the light down, and write. The setting follows the book, not the app."
          >
            <FocusVisual />
          </Card>

          <Card
            tone="neutral"
            span="order-5 sm:order-4 sm:col-span-1 lg:order-5 lg:col-span-2"
            title="Everything for your book, together"
            body="Shelf, import, editor, saved versions, assistant and export. One workspace, and no second account."
          >
            <TogetherVisual />
          </Card>
        </div>
      </div>
    </section>
  );
}
