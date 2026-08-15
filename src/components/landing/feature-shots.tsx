import Image from "next/image";
import type { ReactNode } from "react";
import { AppWindow } from "@/components/landing/app-window";
import {
  SECTION_LEAD,
  SECTION_TITLE,
  LEAD_EM,
} from "@/components/landing/type";
import { ALL_TOOLS, TOOL_GROUPS } from "@/lib/book-tools";
import { ROLE_LABELS } from "@/lib/collab";
import { SEATS_PER_BOOK } from "@/lib/free-limits";

/**
 * Three screens of the app, photographed, each beside what it is for.
 *
 * **The shape is the one every serious SaaS feature section uses, and each
 * part of it is doing a job**:
 *
 * - **The heading is the outcome, not the feature's name.** "Every book you
 *   have, on one shelf" rather than "Library". A reader deciding whether to
 *   pay is asking what changes for them, and a feature name answers a question
 *   they have not asked yet. The screen underneath supplies the noun.
 * - **One row, one job.** Three rows, three things: keeping the books
 *   straight, the work after the last chapter, and getting a second person in.
 *   A row that argued two things would be skimmed as neither.
 * - **The sides alternate.** The eye zigzags down the page instead of running
 *   along one gutter, which is what keeps three structurally identical rows
 *   from reading as one long block.
 * - **Short lead, then disclosure.** Two lines a skimmer will actually read,
 *   with the detail folded underneath for the reader who has decided to care.
 *   This is where a page usually cheats by burying the qualifications; here
 *   the fold is the *specifics*, and the summary line is true on its own.
 * - **Real screens, not drawings.** Everywhere else this page draws its
 *   figures in markup so they cannot go stale. These are captures, which is
 *   the trade the owner has already taken elsewhere on the page — see the note
 *   below.
 *
 * **Everything countable in here is imported and counted.** The tool total and
 * the four group names and notes come from `book-tools.ts`, the two role
 * descriptions from `collab.ts`, the seat numbers from `free-limits.ts`. That
 * is the page's standing rule and it matters most in a section like this one,
 * whose whole claim is "this is what you get": a hand-typed "16 tools" would
 * go wrong the first time a tool is added, on the one screen a buyer is
 * reading to decide.
 *
 * **The pictures are whole windows, sidebar and all.** That is what makes three
 * shots read as one application rather than three loose panels, and it is why
 * the screen's column is the wider half of every row — see `FeatureRow`.
 *
 * **They can go stale, and nothing will warn.** They are `public/feature-*.webp`,
 * prepared by `scripts/feature-shots.cjs` — re-shoot and re-run it when the
 * Write, Tools or Collaborators screens change. When one of those screens
 * moves, nothing here fails and nothing warns; the picture simply starts
 * showing something that is not true any more. That is the standing cost of a
 * bitmap on this page.
 *
 * **No `"use client"`, and the disclosures are `<details>`.** The browser
 * already knows how to open and close one, announce its state, and find it
 * with a page search — so this whole section ships no JavaScript at all, the
 * same as `order-rows.tsx`. An accordion built out of `useState` would be
 * three behaviours to write and a hydration cost, for something the platform
 * does better.
 */

interface Row {
  /** The outcome, in the writer's terms. */
  title: string;
  lead: ReactNode;
  shot: { src: string; width: number; height: number; alt: string };
  /** The tinted ground the window floats on. Whole class names — see below. */
  ground: string;
  points: { term: string; detail: ReactNode }[];
}

/*
 * The three decorative grounds, and the reason they are safe here.
 *
 * `--color-lp-card-1/2/3` are the page's one decorative hue set: indigo, peach
 * and violet at about 4% saturation, and the long note beside them in
 * `globals.css` binds them to two rules — **grounds only**, never ink and never
 * a control, and never stronger than that, because a saturated middle card
 * reads as amber and amber on this page means *this costs you readers*. A tint
 * behind a screenshot is exactly the case they were written for: three rows
 * told apart by the floor under them rather than by anything that carries a
 * fact.
 *
 * Whole class names rather than `bg-lp-card-${i}`, because Tailwind reads class
 * names as literals and an interpolated one ships no rule at all — the same
 * trap `landing-page.tsx` documents at its own card tints.
 */
const ROWS: Row[] = [
  {
    title: "Every book you have, on one shelf",
    lead: (
      <>
        <strong className={LEAD_EM}>
          The covers, the counts, and where you left off
        </strong>{" "}
        — the whole library on the screen you land on, not a folder you have to
        remember the name of.
      </>
    ),
    ground: "bg-lp-card-1",
    shot: {
      src: "/feature-shelf.webp",
      width: 1893,
      height: 948,
      alt: "The Write area of OpenChapter: the app's sidebar down the left — Overview, Write, Prepare, Track, Tools, Collaborators — beside a grid of book cards, each with its cover, chapter and word count, when it was last opened, and Write and Read buttons. Tabs above the grid count the books, the archived ones and the trash.",
    },
    points: [
      {
        term: "Write or read, in one press",
        detail:
          "Each card opens straight into the editor, or into the reading view that sets the whole book on real pages at its trim size.",
      },
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
    ],
  },
  {
    /* Counted, not typed. Adding a tool changes this heading by itself. */
    title: `${ALL_TOOLS.length} tools for the part after the last chapter`,
    lead: (
      <>
        Writing it was the half you knew about.{" "}
        <strong className={LEAD_EM}>
          These are the jobs nobody tells you the order of
        </strong>{" "}
        — grouped by what they are for, and all working on a real book rather
        than a sample.
      </>
    ),
    ground: "bg-lp-card-2",
    shot: {
      src: "/feature-tools.webp",
      width: 1896,
      height: 946,
      alt: "The Tools area of OpenChapter: tools grouped under Get it out, Find your shelf and The writing, each a coloured mark with its name under it, beside the app's sidebar.",
    },
    /* The groups describe themselves. `book-tools.ts` is the one place a tool's
       name and group live, so this list cannot fall out of step with the app —
       and a group added there appears here without an edit. */
    points: TOOL_GROUPS.map((group) => ({
      term: group.title,
      detail: (
        <>
          {group.note}{" "}
          <span className="text-lp-faint">
            {group.tools.map((t) => t.name).join(" · ")}
          </span>
        </>
      ),
    })),
  },
  {
    title: "Put an editor on the book, not in your inbox",
    lead: (
      <>
        <strong className={LEAD_EM}>Invite by email or by link.</strong> They
        land in the manuscript itself, with exactly the access you gave them —
        no attachments going back and forth, no version with a date in its
        filename.
      </>
    ),
    ground: "bg-lp-card-3",
    shot: {
      src: "/feature-collab.webp",
      width: 1894,
      height: 945,
      alt: "The Collaborators area of OpenChapter: a list of books, each showing who is on it — one reading “2 people · 1 invited”, the rest “Only you” — with a Share button on every row, beside the app's sidebar.",
    },
    points: [
      {
        term: ROLE_LABELS.editor.label,
        detail: ROLE_LABELS.editor.what,
      },
      {
        term: ROLE_LABELS.viewer.label,
        detail: ROLE_LABELS.viewer.what,
      },
      {
        term: "Seats you can take back",
        detail: `${SEATS_PER_BOOK.free} people on a free book and ${SEATS_PER_BOOK.pro} on Pro, counting you. A seat is who is on the book now, so removing somebody gives it back.`,
      },
    ],
  },
];

export function FeatureShots() {
  return (
    <section className="border-b border-lp-line px-6 py-14 sm:py-20">
      <div className="mx-auto max-w-[88rem]">
        <div className="mx-auto max-w-3xl text-center">
          <p className="flex items-center justify-center gap-2.5 font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-lp-faint"
            />
            Inside the app
          </p>
          <h2
            className={`oc-display mt-5 font-serif text-lp-ink ${SECTION_TITLE}`}
          >
            Everything the writing needs around it
          </h2>
          <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
            The shelf you land on, the tools around the manuscript, and the way
            a second writer gets in.
          </p>
        </div>

        <div className="mt-14 flex flex-col gap-14 sm:mt-20 sm:gap-20">
          {ROWS.map((row, i) => (
            <FeatureRow key={row.title} row={row} flip={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * One row: the screen on one side, what it is for on the other.
 *
 * `flip` swaps the sides from `lg` up and nowhere else. Below that the row is
 * one column and the *reading* order is what matters — words first, then the
 * picture of the thing they describe — so the DOM order is the words and the
 * picture is moved by `order`, never the other way round. A layout that put
 * the image first in the markup would hand a screen reader a long alt text
 * before it had any idea what the row was about.
 */
function FeatureRow({ row, flip }: { row: Row; flip: boolean }) {
  return (
    /* **The screen's column is the wider one, and the template flips with the
       row.** These are whole application windows at about 2:1, so an even split
       would set a 1900px screenshot into 600-odd pixels and the app would be a
       texture. The extra weight also matches what the row is for: the words are
       a heading and three folded lines, the picture is the evidence.

       The template has to swap because grid columns are *positional* while
       `order` only moves the items through them — leave it fixed and the flipped
       row puts the wide column under the text. */
    <div
      className={`grid items-center gap-8 lg:gap-16 ${
        flip ? "lg:grid-cols-[1.3fr_1fr]" : "lg:grid-cols-[1fr_1.3fr]"
      }`}
    >
      <div className={flip ? "lg:order-2" : ""}>
        <h3
          className={`oc-heading font-serif text-[1.75rem] leading-[1.15] font-semibold text-lp-ink sm:text-[2rem]`}
        >
          {row.title}
        </h3>
        <p className="mt-4 max-w-prose font-sans text-[1.0625rem] leading-relaxed text-lp-deck">
          {row.lead}
        </p>

        <div className="mt-7 border-t border-lp-line">
          {row.points.map((point) => (
            <Point key={point.term} term={point.term} detail={point.detail} />
          ))}
        </div>
      </div>

      {/* The tinted card, and the window floating on it. The padding is what
          makes it a *stage* rather than a border: a screenshot pressed to the
          edge of its tint reads as a coloured frame, which is a fifth kind of
          box on a page that already has enough. */}
      <div
        className={`rounded-[1.75rem] p-4 sm:p-7 lg:p-9 ${row.ground} ${
          flip ? "lg:order-1" : ""
        }`}
      >
        <AppWindow label={row.shot.alt}>
          {/* `quality={95}`, the same as the page's other captures. These are
              screens whose entire content is small type, and the one picture on
              this page that was squeezed hard has visible ringing on its
              letters. `sizes` stops a phone downloading the desktop-width copy
              of all three. */}
          <Image
            src={row.shot.src}
            alt=""
            width={row.shot.width}
            height={row.shot.height}
            sizes="(min-width: 1024px) 46rem, 100vw"
            quality={95}
            className="block h-auto w-full"
          />
        </AppWindow>
      </div>
    </div>
  );
}

/**
 * One disclosure.
 *
 * **This is `listing-questions.tsx`'s style, not a third one.** That component
 * settles what a disclosure looks like in this position — hairline rows, a
 * bare chevron, a rule between — against the FAQ's carded rows, and the
 * reasoning transfers exactly: these sit in a column beside a screen, in a
 * section made of words and a picture, where a card would be another kind of
 * box in a row that already has one. What differs is the *scale*. Those
 * questions are their section's whole content and are set at 22px serif; these
 * hang under a heading of their own, so they are a step quieter. Same family,
 * one size down — which is the thing that keeps two disclosures on one page
 * from reading as two designs.
 *
 * **It is a `<details>` where that one is state, and the reason is the reason
 * they gave.** Theirs is a client component solely because the owner wanted one
 * row always open, which `<details>` cannot promise — and the cost they name is
 * that a closed answer leaves the DOM, so the browser's page search cannot find
 * its words. That cost is worth paying for three sentences that restate the
 * section above them; it is not worth paying here, where the folded text is the
 * specifics a buyer is looking for. So: the platform's own disclosure, no
 * script, findable closed, and the FAQ's reasoning rather than theirs.
 *
 * The default triangle is suppressed on both engines — `list-none` for Firefox,
 * the `::-webkit-` pseudo-element for the rest — and replaced with the same
 * travelling chevron, one glyph turned over rather than two swapped, so the row
 * does not flicker as it opens.
 */
function Point({ term, detail }: { term: string; detail: ReactNode }) {
  return (
    <details className="group border-b border-lp-line">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-6
                   py-3.5 font-sans text-[0.9375rem] font-semibold text-lp-ink
                   outline-none focus-visible:ring-2 focus-visible:ring-lp-accent/60
                   [&::-webkit-details-marker]:hidden"
      >
        {term}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-lp-faint transition-transform duration-200
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
      {/* `lp-soft` and stopped short of the chevron, both for the reasons
          `listing-questions.tsx` gives: it is the darkest grey that is still
          plainly not the ink, so the term keeps the row. */}
      <p className="pr-10 pb-5 font-sans text-[0.9375rem] leading-[1.6] text-lp-soft">
        {detail}
      </p>
    </details>
  );
}
