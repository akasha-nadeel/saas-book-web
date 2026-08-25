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
function Card({
  tone,
  span,
  title,
  body,
  children,
}: {
  tone: "light" | "bright" | "dark" | "neutral";
  span: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  const grounds = {
    light: "border border-lp-edge bg-lp-ground",
    bright: "bg-lp-bright text-lp-bright-ink",
    dark: "bg-lp-stage",
    neutral: "border border-lp-edge bg-lp-tint",
  } as const;

  const titles = {
    light: "text-lp-ink",
    bright: "text-lp-bright-ink",
    dark: "text-lp-stage-ink",
    neutral: "text-lp-ink",
  } as const;

  const bodies = {
    light: "text-lp-body",
    /* Not a dimmed ink: on a saturated ground the fill has nothing left to
       give, so this steps down in weight rather than in contrast. */
    bright: "text-lp-bright-ink/75",
    dark: "text-lp-stage-body",
    neutral: "text-lp-body",
  } as const;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-[0.875rem] transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none ${grounds[tone]} ${span}`}
    >
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
      className={`rounded-[0.625rem] border border-lp-edge bg-lp-ground shadow-[0_10px_30px_-12px_rgba(15,15,16,0.28),0_2px_6px_-2px_rgba(15,15,16,0.10)] ${className}`}
    >
      {children}
    </div>
  );
}

/** A line of prose, drawn. `w` is a Tailwind width class. */
function Rule({ w, dark = false }: { w: string; dark?: boolean }) {
  return (
    <span
      className={`block h-[0.3125rem] rounded-full ${
        dark ? "bg-lp-stage-ink/20" : "bg-lp-ink/10"
      } ${w}`}
    />
  );
}

/* --------------------------------------------------------------------------
   The five visuals.
   -------------------------------------------------------------------------- */

/** A manuscript sheet, with a second one behind it and a count pill on top. */
function WriteVisual() {
  return (
    <>
      <Chip className="absolute top-5 left-16 h-40 w-[66%] max-w-[21rem] rotate-[-4deg] opacity-70" />
      <Chip className="absolute top-12 left-5 w-[72%] max-w-[23rem] p-5">
        <p className="text-[0.8125rem] font-semibold text-lp-ink">
          Chapter Four
        </p>
        <p className="mt-1 text-[0.6875rem] text-lp-faint">The long way round</p>
        <div className="mt-4 space-y-2">
          <Rule w="w-full" />
          <Rule w="w-[92%]" />
          <Rule w="w-[97%]" />
          <Rule w="w-[64%]" />
        </div>
      </Chip>
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
      <div className="absolute right-4 bottom-7 left-10 flex items-center gap-2 rounded-xl bg-lp-stage px-3.5 py-2.5 shadow-[0_12px_30px_-12px_rgba(15,15,16,0.5)]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lp-stage-accent" />
        <span className="truncate text-[0.6875rem] font-medium text-lp-stage-ink">
          Saved to this browser
        </span>
      </div>
    </>
  );
}

/** The dark writing surface: a page of prose and nothing around it. */
function FocusVisual() {
  return (
    /* A lift off the card rather than a colour of its own: `lp-stage` is
       #0b0b0f by day and #14141c at night, so a literal hex here was the same
       value as the ground it sits on in one theme and a hole in the other. Four
       per cent of the stage's own ink reads as a page on a surface in both. */
    <div className="absolute inset-x-5 top-8 bottom-0 rounded-t-xl border border-lp-stage-line border-b-0 bg-lp-stage-ink/[0.04] px-5 pt-6">
      <p className="text-center font-serif text-[0.8125rem] font-medium text-lp-stage-ink">
        Chapter Four
      </p>
      <div className="mt-5 space-y-2.5">
        <Rule w="w-full" dark />
        <Rule w="w-[94%]" dark />
        <Rule w="w-[98%]" dark />
        <Rule w="w-[88%]" dark />
        <Rule w="w-[96%]" dark />
        <Rule w="w-[52%]" dark />
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
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-[0_10px_24px_-12px_rgba(249,115,22,0.8)]">
          <Glyph name="Editor" path={GLYPHS.editor} />
        </span>
        <span className="flex h-16 flex-1 items-center gap-5 rounded-2xl border border-lp-edge bg-lp-ground px-5 shadow-[0_8px_24px_-16px_rgba(15,15,16,0.5)]">
          <Glyph name="Shelf" path={GLYPHS.shelf} />
          <Glyph name="Import" path={GLYPHS.import} />
        </span>
      </div>
      <div className="flex h-16 items-center gap-5 rounded-2xl border border-lp-edge bg-lp-ground px-5 shadow-[0_8px_24px_-16px_rgba(15,15,16,0.5)]">
        <Glyph name="Saved versions" path={GLYPHS.versions} />
        <Glyph name="Assistant" path={GLYPHS.assistant} />
        <Glyph name="Export" path={GLYPHS.export} />
        <Glyph name="Sync" path={GLYPHS.sync} />
      </div>
    </div>
  );
}

const GLYPHS = {
  shelf: "M5 4h3v16H5V4Zm5 0h3v16h-3V4Zm7.4.6 2.8.8-3.4 12.5-2.9-.8L17.4 4.6Z",
  import: "M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3",
  editor: "M4 20h16M6 16l9.5-9.5a2.1 2.1 0 0 0-3-3L3 13v3h3Z",
  versions: "M12 8v4l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3",
  assistant: "M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1Z",
  export: "M12 16V4m0 0L8.5 7.5M12 4l3.5 3.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3",
  sync: "M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.6L4 16m0 4v-4h4",
} as const;

/** One tile mark. Takes `currentColor`, so the tile decides the colour. */
function Glyph({ name, path }: { name: string; path: string }) {
  return (
    <>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
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

        <div className="mt-12 rounded-[1.25rem] border border-lp-line bg-lp-tint-soft p-4 sm:mt-14 sm:p-6 lg:p-8">
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-6">
            <Card
              tone="light"
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
      </div>
    </section>
  );
}
