import type { ReactNode } from "react";
import { AppWindow } from "@/components/landing/app-window";
import { DESTINATIONS } from "@/components/landing/works-with";
import { STATUSES, LEAD_DAYS } from "@/lib/arc";
import { proseReport } from "@/lib/prose";

/**
 * One screen from the product per phase of the road, so each station shows the
 * thing it is talking about rather than only naming it.
 *
 * **The road said what the order is and never showed what any of it looks
 * like.** Five phases, five sentences, and a reader who has not been inside
 * the app finishes the section knowing the sequence and nothing about the
 * software. These fill the empty half of each row — the words on one side of
 * the line, the screen on the other — which is what that layout had spare and
 * what the reference the section is drawn from does with it.
 *
 * **Drawn in markup, never screenshotted**, like every other figure on this
 * page: a screenshot goes stale silently while the app moves, on the one page
 * whose whole pitch is being checkable.
 *
 * Three of the five go further and are **computed from the app's own
 * modules**, which is the shape to prefer:
 *
 * - The writing and revising screens both run the real `proseReport()` over
 *   one fixed passage. The word count on the editor page is that passage's
 *   count, and the findings on the report are the ones the checker actually
 *   returns for it — labels, counts and all. Change a rule in `prose.ts` and
 *   these pictures change with it.
 * - The advance-copy screen reads `STATUSES` and `LEAD_DAYS` out of `arc.ts`,
 *   so the five states it draws are the five the tool has and the six weeks it
 *   quotes is the figure the tool works back from.
 * - The publishing screen filters `DESTINATIONS` the way the export dialog
 *   does, so it cannot name a shop the export does not reach.
 *
 * The preparing screen quotes its field names, because that form's copy lives
 * inside `publishing-card.tsx` rather than in a module either side can import.
 *
 * All five are **pictures**: they pass a `label` to `AppWindow`, so each hides
 * its contents behind one description rather than reading out as a list of
 * stray words. And all five take the pale ring rather than the bezel — they
 * sit on the road's own tinted field, and a dark bezel inside a tinted panel
 * is two frames around one screen.
 */

/**
 * The passage the two writing screens are drawn from, and the only invented
 * thing in either: three paragraphs of ordinary novel prose, written here so
 * nothing anybody owns is reproduced on a marketing page.
 *
 * It is deliberately *flawed* in the ways the report looks for — a stack of
 * adverbs, a filter verb, a repeated word, one sentence that runs long —
 * because a report drawn over clean prose would have nothing in it, and a page
 * showing an empty checker is showing a checker that does not work.
 */
const PASSAGE = [
  "The tide came in quickly that morning, and Mara walked slowly along the wall, watching the water climb the stones she had counted as a child.",
  "She had promised herself she would not come back. She had promised her mother the same thing, and her mother had simply nodded, which was worse than an argument.",
  "The salt was already on her coat. She could taste it when she breathed, and she thought, suddenly and completely, of the ledger in the drawer at home — the one nobody had opened since the funeral, the one that would tell her exactly how much the harbour had cost them and exactly who had been paid.",
].join("\n\n");

const REPORT = proseReport(PASSAGE);

/* --------------------------------------------------------------------------
   Shared parts
   -------------------------------------------------------------------------- */

/**
 * The eyebrow every panel in this app puts over a group of facts.
 *
 * It takes a `className` for spacing rather than being wrapped, because it
 * renders a `<p>` — and a paragraph inside a paragraph is invalid HTML that
 * the browser silently unnests while React is still expecting the markup it
 * sent, which surfaces as a hydration error rather than as anything you can
 * see.
 */
function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-code text-[0.5625rem] font-semibold tracking-[0.14em] text-lp-faint uppercase ${className}`}
    >
      {children}
    </p>
  );
}

/** A line of prose, drawn rather than set — the shape of text at a size where
 *  the words would be unreadable anyway, which is how every drawn editor in
 *  this page's figures handles a page of writing. */
function Line({ w }: { w: number }) {
  return (
    <span
      className="block h-[5px] rounded-full bg-lp-raised"
      style={{ width: `${w}%` }}
    />
  );
}

/* --------------------------------------------------------------------------
   01 — writing
   -------------------------------------------------------------------------- */

export function WriteScreen() {
  return (
    <AppWindow
      label={`The editor: a chapter on a page, with ${REPORT.words} words counted at the foot of it.`}
    >
      <div className="flex">
        {/* The chapter rail, which is what the editor opens with. */}
        <div className="w-[34%] shrink-0 border-r border-lp-line bg-lp-well p-3">
          <Eyebrow>Chapters</Eyebrow>
          <ul className="mt-2.5 space-y-1.5">
            {["One", "Two", "Three", "Four"].map((n, i) => (
              <li
                key={n}
                className={`truncate rounded px-1.5 py-1 text-[0.625rem] ${
                  i === 1
                    ? "bg-lp-accent/10 font-semibold text-lp-accent-text"
                    : "text-lp-body"
                }`}
              >
                Chapter {n}
              </li>
            ))}
          </ul>
        </div>

        {/* The page. A sheet with a margin, because that is what the editor
            draws — the manuscript is set on real page sheets. */}
        <div className="min-w-0 flex-1 p-4">
          <div className="space-y-2 rounded-sm bg-lp-ground px-4 py-4 shadow-[0_1px_3px_rgba(15,15,16,0.06)]">
            <Line w={92} />
            <Line w={98} />
            <Line w={64} />
            <span className="block h-2" />
            <Line w={96} />
            <Line w={88} />
            <Line w={45} />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-code text-[0.5625rem] tracking-[0.12em] text-lp-faint uppercase">
              Chapter Two
            </span>
            {/* Counted from the passage rather than typed. */}
            <span className="text-[0.625rem] font-medium text-lp-body tabular-nums">
              {REPORT.words.toLocaleString()} words
            </span>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

/* --------------------------------------------------------------------------
   02 — revising
   -------------------------------------------------------------------------- */

export function ReviseScreen() {
  return (
    <AppWindow
      label="The prose report: what the writing does often, counted — adverbs, filter words, repeats and long sentences — with no score anywhere on it."
    >
      <div className="p-4">
        <Eyebrow>Prose report</Eyebrow>

        <div className="mt-3 flex gap-5">
          {[
            ["Words", REPORT.words.toLocaleString()],
            ["Sentences", String(REPORT.sentences)],
            ["Average", `${REPORT.averageSentence}`],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[0.5625rem] text-lp-faint">{label}</p>
              <p className="mt-0.5 font-serif text-base text-lp-ink tabular-nums">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Every row is a finding the checker really returned for the passage
            above — and there is **no score on it**, which is the report's
            standing rule rather than a detail of this drawing. */}
        <ul className="mt-4 space-y-2.5 border-t border-lp-line pt-3">
          {REPORT.findings.slice(0, 4).map((finding) => (
            <li key={finding.id} className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-lp-body">
                {finding.label}
              </span>
              <span className="shrink-0 text-[0.6875rem] font-semibold text-lp-ink tabular-nums">
                {finding.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </AppWindow>
  );
}

/* --------------------------------------------------------------------------
   03 — preparing
   -------------------------------------------------------------------------- */

/** What a shop asks for that is not the book, in the words the listing form
 *  uses for each field. Quoted rather than imported — that form's copy lives
 *  in `publishing-card.tsx`, which has no table to read. */
const ASKED_FOR = [
  ["Title", "done"],
  ["Author", "done"],
  ["Cover", "done"],
  ["ISBN", "todo"],
  ["Categories", "todo"],
  ["Blurb", "todo"],
] as const;

export function PrepareScreen() {
  const left = ASKED_FOR.filter(([, state]) => state === "todo").length;

  return (
    <AppWindow label="The pre-upload check: the fields a shop asks for, ticked as they are filled in, with three still to do.">
      <div className="p-4">
        <Eyebrow>Before you upload</Eyebrow>
        <p className="mt-2 text-[0.8125rem] font-semibold text-lp-ink">
          {left} thing{left === 1 ? "" : "s"} still to do
        </p>

        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {ASKED_FOR.map(([field, state]) => (
            <li key={field} className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  state === "done"
                    ? "bg-ok-bg text-ok-fg"
                    : "bg-note-bg text-note-fg"
                }`}
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  className="h-2.5 w-2.5"
                >
                  {state === "done" ? (
                    <path d="M5 10.5l3.5 3.5L15 7" />
                  ) : (
                    <path d="M10 5.5v5M10 14v.4" />
                  )}
                </svg>
              </span>
              <span
                className={`truncate text-[0.6875rem] ${
                  state === "done" ? "text-lp-faint" : "text-lp-ink"
                }`}
              >
                {field}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </AppWindow>
  );
}

/* --------------------------------------------------------------------------
   04 — before you publish
   -------------------------------------------------------------------------- */

/** Who has the advance copy, drawn against the tool's own five states. The
 *  names are invented; the *states* are not, and neither is the lead time. */
const READERS = [
  ["R. Okafor", "reviewed"],
  ["J. Halloran", "reading"],
  ["The Salt Circle", "sent"],
  ["M. Devlin", "silent"],
] as const;

export function ArcScreen() {
  const weeks = Math.round(LEAD_DAYS / 7);

  return (
    <AppWindow
      label={`The advance-copy tracker: four readers against the states the tool has, with the send-by date ${weeks} weeks before publication.`}
    >
      <div className="p-4">
        <Eyebrow>Advance readers</Eyebrow>
        {/* Six weeks, worked out from the tool's own constant rather than
            typed — the whole argument of this phase is a date. */}
        <p className="mt-2 text-[0.8125rem] font-semibold text-lp-ink">
          Send {weeks} weeks before publication
        </p>

        <ul className="mt-3 space-y-2">
          {READERS.map(([name, status]) => {
            const state = STATUSES.find((s) => s.id === status)!;
            const tone =
              status === "reviewed"
                ? "bg-ok-bg text-ok-fg"
                : status === "silent"
                  ? "bg-stop-bg text-stop-fg"
                  : "bg-lp-raised text-lp-body";
            return (
              <li key={name} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-lp-ink">
                  {name}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[0.5625rem] font-semibold ${tone}`}
                >
                  {state.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </AppWindow>
  );
}

/* --------------------------------------------------------------------------
   05 — publishing
   -------------------------------------------------------------------------- */

/** Filtered the way the export dialog filters it, so this cannot name a shop
 *  the export does not reach. */
const EPUB_OPENS = DESTINATIONS.filter((d) => d.format === "EPUB");

export function PublishScreen() {
  return (
    <AppWindow label="The finished export: an EPUB at zero EPUBCheck errors, with the shops it opens in.">
      <div className="p-4">
        <Eyebrow>Export</Eyebrow>

        <div className="mt-3 flex items-center gap-3 rounded-lg border border-lp-edge bg-lp-well px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-code text-[0.6875rem] text-lp-ink">
              the-salt-road.epub
            </span>
            <span className="mt-0.5 block text-[0.5625rem] text-lp-faint">
              EPUB · 1.4 MB
            </span>
          </span>
          <span className="shrink-0 rounded bg-ok-bg px-1.5 py-0.5 text-[0.5625rem] font-semibold text-ok-fg">
            0 errors
          </span>
        </div>

        {/* The spacing goes on the eyebrow itself rather than on a wrapper —
            `Eyebrow` renders a `<p>`, and a `<p>` inside a `<p>` is invalid
            HTML that the browser silently unnests, which shows up as a
            hydration error rather than as anything visible. */}
        <Eyebrow className="mt-3.5">It opens in</Eyebrow>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {EPUB_OPENS.map((destination) => (
            <li
              key={destination.name}
              className="rounded border border-lp-edge bg-lp-well px-1.5 py-1 text-[0.5625rem] font-medium text-lp-ink"
            >
              {destination.name}
            </li>
          ))}
        </ul>
      </div>
    </AppWindow>
  );
}
