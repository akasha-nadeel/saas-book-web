import type { ReactNode } from "react";
import { ROW_BODY, ROW_TITLE } from "@/components/landing/type";

/**
 * One feature row: a screen on one side, what it is for on the other.
 *
 * **Pulled out of `feature-shots.tsx` on 2026-08-15**, when the tool guide
 * needed the same row sixteen more times. It was private to that file while it
 * had three callers in one place; the moment a second page wanted it, the
 * choice was one component or two copies of a layout whose every measurement
 * is an argument — and a copy is how two sections that are meant to look
 * identical end up a step apart.
 *
 * The shape is the one every serious SaaS feature section uses, and each part
 * of it is doing a job:
 *
 * - **The heading is the outcome, not the feature's name.** A reader deciding
 *   whether to pay is asking what changes for them, and a feature name answers
 *   a question they have not asked yet. The screen underneath supplies the
 *   noun.
 * - **One row, one job.** A row that argued two things would be skimmed as
 *   neither.
 * - **The sides alternate.** The eye zigzags down the page instead of running
 *   along one gutter, which is what keeps structurally identical rows from
 *   reading as one long block.
 * - **Short lead, then disclosure.** Two lines a skimmer will actually read,
 *   with the detail folded underneath for the reader who has decided to care.
 *   This is where a page usually cheats by burying the qualifications; here the
 *   fold is the *specifics*, and the summary line is true on its own.
 *
 * **No `"use client"`, and the disclosures are `<details>`.** The browser
 * already knows how to open and close one, announce its state, and find it with
 * a page search — so every section built on this ships no JavaScript at all,
 * the same as `order-rows.tsx`. An accordion built out of `useState` would be
 * three behaviours to write and a hydration cost, for something the platform
 * does better.
 */

export interface RowPoint {
  term: string;
  detail: ReactNode;
}

export interface FeatureRowProps {
  /**
   * The row's anchor, when something links to it.
   *
   * `/tools` gives every row its tool's own path (`#comps`, `#blurb`), because
   * the bar's Tools menu links to each one individually — a menu of sixteen
   * names that all landed at the top of one page would be sixteen copies of
   * the same link. It carries the scroll margin that keeps the row's heading
   * clear of the sticky header; the three rows on the landing page pass
   * nothing and are reached by scrolling.
   */
  id?: string;
  /**
   * A small line above the heading, drawn only when there is one.
   *
   * The tool guide needs it and the three feature rows do not, which is the
   * whole of the difference between them: those headings name an outcome for a
   * part of the app that has no single name, while every row on `/tools` is
   * *about* a named tool, and a reader who has just met sixteen marks in a
   * cloud has to be able to find the one they are reading about. A node rather
   * than a string so the caller can put the tool's own mark in it.
   */
  eyebrow?: ReactNode;
  /** The outcome, in the writer's terms. */
  title: string;
  lead: ReactNode;
  /**
   * What goes in the wide column — an `AppWindow` holding a capture, or a
   * drawing standing in for one.
   *
   * A node rather than an image source, because the two callers frame their
   * contents differently and the framing is the part that must not be guessed
   * at here: a capture needs its own alt text on the window, a drawing needs
   * none and must not claim any.
   */
  figure: ReactNode;
  /** The tinted ground the window floats on. Whole class names — see below. */
  ground: string;
  points: RowPoint[];
  /** Swap the sides. Set by the caller from the row's index. */
  flip: boolean;
}

export function FeatureRow({
  id,
  eyebrow,
  title,
  lead,
  figure,
  ground,
  points,
  flip,
}: FeatureRowProps) {
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
      id={id}
      /* `scroll-mt-28` rather than the sections' `scroll-mt-20`: a linked row
         lands mid-page with rows above and below it, so it needs the header's
         height *and* enough air to read as the top of something rather than as
         a row that happens to be under the bar. The sections have their own
         padding doing that job. */
      className={`grid items-center gap-8 lg:gap-16 ${id ? "scroll-mt-28" : ""} ${
        flip ? "lg:grid-cols-[1.3fr_1fr]" : "lg:grid-cols-[1fr_1.3fr]"
      }`}
    >
      {/* `flip` swaps the sides from `lg` up and nowhere else. Below that the
          row is one column and the *reading* order is what matters — words
          first, then the picture of the thing they describe — so the DOM order
          is the words and the picture is moved by `order`, never the other way
          round. A layout that put the image first in the markup would hand a
          screen reader a long alt text before it had any idea what the row was
          about. */}
      <div className={flip ? "lg:order-2" : ""}>
        {eyebrow && <div className="mb-4">{eyebrow}</div>}
        <h3 className={`oc-heading font-serif text-lp-ink ${ROW_TITLE}`}>
          {title}
        </h3>
        <p className={`mt-4 max-w-prose font-sans ${ROW_BODY}`}>{lead}</p>

        <div className="mt-7 border-t border-lp-line">
          {points.map((point) => (
            <Point key={point.term} term={point.term} detail={point.detail} />
          ))}
        </div>
      </div>

      {/* The tinted card, and the window floating on it. The padding is what
          makes it a *stage* rather than a border: a screenshot pressed to the
          edge of its tint reads as a coloured frame, which is a fifth kind of
          box on a page that already has enough. */}
      <div
        className={`rounded-[1.75rem] p-4 sm:p-7 lg:p-9 ${ground} ${
          flip ? "lg:order-1" : ""
        }`}
      >
        {figure}
      </div>
    </div>
  );
}

/**
 * The decorative grounds a row may sit on, in the order they cycle.
 *
 * `--color-lp-card-1/2/3` are the page's one decorative hue set: indigo, peach
 * and violet at about 4% saturation, and the long note beside them in
 * `globals.css` binds them to two rules — **grounds only**, never ink and never
 * a control, and never stronger than that, because a saturated middle card
 * reads as amber and amber on this page means *this costs you readers*. A tint
 * behind a screenshot is exactly the case they were written for: rows told
 * apart by the floor under them rather than by anything that carries a fact.
 *
 * Whole class names rather than `bg-lp-card-${i}`, because Tailwind reads class
 * names as literals and an interpolated one ships no rule at all — the same
 * trap `landing-page.tsx` documents at its own card tints. Exported as an array
 * so a caller with sixteen rows can cycle it without writing that trap itself.
 */
export const ROW_GROUNDS = [
  "oc-row-ground-1",
  "oc-row-ground-2",
  "oc-row-ground-3",
] as const;

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
export function Point({ term, detail }: RowPoint) {
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
