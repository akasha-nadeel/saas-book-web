import type { ReactNode } from "react";

/**
 * The four pictures beside the path section's stages.
 *
 * Drawn from the app's own tokens rather than screenshotted, for the reason
 * `landing-figures.tsx` gives: a screenshot is an asset that goes stale
 * silently while the app keeps moving.
 *
 * **They carry real type, not bars.** The grey-bar idiom the other figures on
 * this page use is right at the size those are drawn — a 240px card, where
 * words would be four pixels tall. This slot is up to 720px wide and one
 * figure is all there is on that side of the panel, and at that size a stack of
 * grey bars stops reading as a manuscript and starts reading as a page that has
 * not finished loading.
 *
 * The prose is written for these figures and is nobody's book. It is doing a
 * job in each: the draft page carries one paragraph *across* the seam, which is
 * what `pagination.ts` actually does — it measures in lines, so a paragraph
 * fills the sheet and continues over the break rather than being pushed whole
 * to the next page — and the import figure's headings are the headings its
 * chapter list is made of, which is the whole of that card's claim.
 *
 * Type is sized in `cqw` against the frame, the same way `.book-face` in
 * globals.css sizes a cover that is drawn at 96px and at full width. One set of
 * proportions beats a pixel size that only suits one of the two.
 *
 * All decorative: the card beside each says everything they do, so they are
 * hidden from assistive technology rather than described twice.
 */

/** The white surface a figure is drawn on, and the container its type scales to. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      style={{ aspectRatio: "4/3" }}
      className="@container relative w-full overflow-hidden rounded-2xl border
                 border-line bg-surface p-[4%] shadow-sm select-none"
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Draft
   --------------------------------------------------------------------------- */

/**
 * The manuscript on its page sheets, with a paragraph running over the seam.
 *
 * Set in the manuscript face (`font-serif`, which is what `--ms-font` falls
 * back to) rather than the page's brand sans, because that is the type a writer
 * would actually be looking at.
 */
export function DraftFigure() {
  return (
    <Frame>
      <div className="mx-auto flex h-full w-[64%] flex-col">
        <div className="rounded-t-[1cqw] bg-panel px-[8%] pt-[7%] pb-[5%] shadow-sm">
          <p className="text-center font-serif text-[3.1cqw] font-semibold text-fg">
            Chapter Seven
          </p>
          <p className="mt-[7%] font-serif text-[2.2cqw] leading-[1.85] text-fg/85">
            The lamp in the hall had been left burning. By its light she could
            see that the door of the study stood open, and she had closed it
            herself, hours before, when the rain
          </p>
        </div>

        {/* The seam. The sentence above stops mid-clause and the sheet below
            picks it up, because that is what measuring in lines produces. */}
        <div className="flex items-center gap-[3%] py-[1.5%]">
          <span className="h-px flex-1 bg-line" />
          <span className="font-sans text-[1.7cqw] text-muted">page 12</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex-1 rounded-b-[1cqw] bg-panel px-[8%] pt-[5%] shadow-sm">
          <p className="font-serif text-[2.2cqw] leading-[1.85] text-fg/85">
            began. Nothing inside appeared to have been moved. The papers were
            squared to the edge of the desk where she had left them, and the
            window was still latched from within.
          </p>
        </div>
      </div>
    </Frame>
  );
}

/* ---------------------------------------------------------------------------
   Manuscript
   --------------------------------------------------------------------------- */

/**
 * Import: the file on one side, the chapters it became on the other.
 *
 * The two headings in the document are the first two rows of the list beside
 * it. That correspondence is the card's sentence — *your headings become
 * chapters* — and it is the reason the figure is two panels and an arrow rather
 * than one picture of a file.
 */
const IMPORTED = ["Chapter One", "Chapter Two", "Chapter Three", "Chapter Four"];

export function ImportFigure() {
  return (
    <Frame>
      <div className="flex h-full items-stretch gap-[3%]">
        {/* The document going in. */}
        <div className="flex flex-1 flex-col rounded-[1.2cqw] bg-panel p-[6%] shadow-sm">
          <p className="font-serif text-[2.4cqw] font-semibold text-fg">
            Chapter One
          </p>
          <p className="mt-[3%] font-serif text-[1.9cqw] leading-[1.75] text-fg/75">
            It rained for three days before anyone thought to ask where he had
            gone.
          </p>
          <p className="mt-[8%] font-serif text-[2.4cqw] font-semibold text-fg">
            Chapter Two
          </p>
          <p className="mt-[3%] font-serif text-[1.9cqw] leading-[1.75] text-fg/75">
            The station master remembered the case well enough, but not the man
            who had been carrying it.
          </p>
          <span className="mt-auto font-code text-[1.7cqw] text-muted">
            manuscript.docx
          </span>
        </div>

        <div className="flex shrink-0 items-center">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[4cqw] w-[4cqw] text-accent"
          >
            <path d="M3 10h13M11 5l5 5-5 5" />
          </svg>
        </div>

        {/* The book it became: the chapter list, as the panel shows it. */}
        <div className="flex flex-1 flex-col rounded-[1.2cqw] border border-line bg-panel p-[4%] shadow-sm">
          <p className="px-[3%] pb-[3%] font-sans text-[1.6cqw] font-semibold tracking-[0.1em] text-muted uppercase">
            Chapters
          </p>
          {IMPORTED.map((title, i) => (
            <div
              key={title}
              className={`flex items-center gap-[4%] rounded-[0.8cqw] px-[3%] py-[2.6%] ${
                i === 0 ? "bg-accent/10" : ""
              }`}
            >
              <span
                className={`font-sans text-[1.7cqw] tabular-nums ${
                  i === 0 ? "text-accent" : "text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`font-sans text-[1.9cqw] ${
                  i === 0 ? "font-semibold text-accent" : "text-fg/80"
                }`}
              >
                {title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* ---------------------------------------------------------------------------
   Check
   --------------------------------------------------------------------------- */

/**
 * The pre-upload check, at a fraction of the real panel's size.
 *
 * **Every row is a check `storeReadiness()` performs** — the same rule
 * `publishing-check.tsx` is built under, and for the same reason: this is one
 * click from a signup that would show the writer the real panel with those rows
 * in it. The wording is cut to fit, never invented.
 *
 * The chips carry their word as well as their colour. A blocking problem and an
 * advisory are different sentences — "a shop will refuse this" against "this
 * only costs you readers" — and colour alone does not say which.
 */
const CHECKS = [
  {
    field: "Cover image",
    level: "problem",
    note: "No cover attached. A shop rejects the upload.",
  },
  {
    field: "ISBN",
    level: "problem",
    note: "Check digit does not add up. One digit is wrong.",
  },
  {
    field: "Categories",
    level: "advisory",
    note: "None chosen. These decide which shelf it turns up on.",
  },
  {
    field: "Book title",
    level: "pass",
    note: "Set, and no longer the placeholder it started as.",
  },
] as const;

const CHIP = {
  problem: { label: "problem", color: "#C22B2B", bg: "#FDECEC" },
  advisory: { label: "advisory", color: "#9A5B00", bg: "#FDF3E2" },
  pass: { label: "pass", color: "#1147C9", bg: "#E7EEFE" },
} as const;

export function CheckFigure() {
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-[2.4%]">
        {CHECKS.map(({ field, level, note }) => {
          const chip = CHIP[level];
          return (
            <div
              key={field}
              className="flex items-center gap-[3%] rounded-[1.2cqw] border border-line
                         bg-panel px-[4%] py-[3%] shadow-sm"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-[0.4cqw]">
                <span className="truncate font-sans text-[2.1cqw] font-semibold text-fg">
                  {field}
                </span>
                <span className="truncate font-sans text-[1.8cqw] text-muted">
                  {note}
                </span>
              </span>
              <span
                className="shrink-0 rounded-full px-[1.4cqw] py-[0.5cqw] font-sans
                           text-[1.5cqw] font-bold"
                style={{ color: chip.color, background: chip.bg }}
              >
                {chip.label}
              </span>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

/* ---------------------------------------------------------------------------
   Files
   --------------------------------------------------------------------------- */

/**
 * What the export produces: the four files, named.
 *
 * Four and only four, because that is what `src/lib/export/` writes. The note
 * under each says what the format is *for* rather than repeating its name — a
 * writer choosing between them is asking where the file is going.
 */
const FILES = [
  { name: "manuscript.epub", note: "Shops and e-readers" },
  { name: "manuscript.docx", note: "Word, and an editor's track changes" },
  { name: "manuscript.pdf", note: "Proofs at your trim size" },
  { name: "manuscript.md", note: "Plain text that outlives us all" },
];

export function FilesFigure() {
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-[2.4%]">
        {FILES.map(({ name, note }) => (
          <div
            key={name}
            className="flex items-center gap-[3.5%] rounded-[1.2cqw] border border-line
                       bg-panel px-[4%] py-[3%] shadow-sm"
          >
            <span className="flex h-[5cqw] w-[5cqw] shrink-0 items-center justify-center rounded-[1cqw] bg-accent/10">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[2.8cqw] w-[2.8cqw] text-accent"
              >
                <path d="M11 2H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6l-4-4Z" />
                <path d="M11 2v4h4" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[0.4cqw]">
              <span className="truncate font-code text-[1.9cqw] font-semibold text-fg">
                {name}
              </span>
              <span className="truncate font-sans text-[1.8cqw] text-muted">
                {note}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
