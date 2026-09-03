/**
 * One plan, drawn as a card: the mark, the name, the price, the rows, a button.
 *
 * **No `"use client"`, deliberately.** Nothing here holds state or listens for
 * anything — the period toggle, the checkout and the provider branching all
 * live in `plans.tsx`, which passes the result down as `price` and `action`.
 * That is what lets the landing page, a Server Component, render exactly the
 * same card as `/upgrade` rather than keeping a second one of its own. Two
 * hand-written lists of claims about one product is how a pricing page ends up
 * disagreeing with itself.
 *
 * Anything stateful a caller needs goes in through `action`, which is a node.
 */

import { NOT_INCLUDED } from "@/lib/billing/plan-rows";

/**
 * One plan, as a card.
 *
 * **Both cards are the same card**, which is the change worth explaining. The
 * paid one used to be inverted — near-black ground, pale type, lifted a few
 * pixels above its neighbour — and that is a perfectly good way to push a
 * plan, but it makes the two sides of a comparison two different objects. A
 * reader running their eye down one column and across to the other is doing
 * arithmetic, and it is easier when the rows sit at the same height in the same
 * ink. What marks the recommended one now is the badge, the accent border and
 * the one filled button on the page — a hue this palette reserves for exactly
 * this, so it carries the emphasis without spending a second design on it.
 *
 * The shape, top to bottom: the mark beside the name rather than stacked above
 * it, the blurb, the figure, the action, a rule, then the lines. Everything is
 * a token, so it holds in both themes.
 */
type Tone = "gold" | "purple" | "blue";

/**
 * The two rows the Starter card puts in purple.
 *
 * **These are the wedge, and the pricing page should look like it.** Every
 * competitor charges for formatting — Scrivener $60, Atticus $147, Vellum $200
 * and up — and most charge again for syncing between machines. Giving both away
 * is the argument this page is making, so on the free card they get the colour
 * that says "look here" rather than sitting in the same blue as the row counting
 * cover searches.
 *
 * Matched on the label, which is a string, so a rename in `ROWS` silently drops
 * the highlight. It lives directly under `ROWS` for that reason — the two are
 * meant to be read together.
 */
const STARTER_HIGHLIGHT = new Set(["Autosave and sync", "Export"]);

/**
 * Which fill a value wears.
 *
 * Gold outranks everything: it means *no ceiling*, and it may never be spent on
 * anything else. After that the card decides — Pro is purple throughout, and
 * Starter is blue except for the two rows above.
 */
function badgeTone(label: string, value: string, paid: boolean): Tone {
  if (value === "Unlimited") return "gold";
  if (paid) return "purple";
  return STARTER_HIGHLIGHT.has(label) ? "purple" : "blue";
}

/**
 * A row's value, as a badge rather than a line of grey text.
 *
 * **A tint, a hairline of the same hue, and ink of that hue** — the shape a
 * label takes when it is a value in a table rather than a thing being sold.
 * These were saturated gradient pills with halos and a shine on the gold, and
 * the fix is documented at the tokens in `globals.css`: twenty-odd filled
 * lozenges down two columns all shout at one volume, so the hue meant to
 * separate them had nothing quiet to separate them from, and the gold that
 * meant "no ceiling" was one glint among two dozen.
 *
 * **Gold is still spent on one word.** "Unlimited" is the only value in this
 * table that describes something genuinely without a ceiling, and it is the
 * answer a reader is scanning the Pro column *for*. If a second value ever
 * wears it, this stops working.
 *
 * **The hue carries the hierarchy that weight used to.** Blue is Starter's,
 * purple is Pro's — the card is the context — and amber is the exception, which
 * reads at a glance against a column of the other two without any of them
 * having to be loud.
 *
 * The radius is `rounded-lg` rather than a capsule. A full pill is a *control*
 * in this app (the period toggle two hundred lines up is one), and a value you
 * cannot press should not borrow the shape of one.
 *
 * "Not included" never becomes a badge. A badge is a thing you are being given;
 * putting a negative in one dresses an absence up as a feature, and the crossed
 * mark to its left has already said it more honestly.
 */
function ValueBadge({ value, tone }: { value: string; tone: Tone }) {
  /* Three whole class strings rather than one with a hole in it: Tailwind scans
     source text, so a class assembled from a variable is a class it never sees
     and never emits. */
  const skin =
    tone === "gold"
      ? "border-badge-gold-line bg-badge-gold-bg text-badge-gold-ink"
      : tone === "purple"
        ? "border-badge-pro-line bg-badge-pro-bg text-badge-pro-ink"
        : "border-badge-blue-line bg-badge-blue-bg text-badge-blue-ink";

  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-0.5
                  font-sans text-sm leading-tight font-semibold
                  tracking-tight whitespace-nowrap ${skin}`}
    >
      {value}
    </span>
  );
}

export function PlanCard({
  featured = false,
  badge,
  mark,
  name,
  blurb,
  price,
  note,
  rows,
  action,
}: {
  /** The one being recommended. Gets the shell below; layout is unchanged. */
  featured?: boolean;
  /**
   * The line written along the top of the featured card's shell. Absent on the
   * others, which have no shell to write on.
   */
  badge?: string;
  mark: React.ReactNode;
  name: string;
  blurb: string;
  price: string;
  /** Shown under the price when the cycle needs explaining. */
  note?: string;
  /** In `ROWS` order — which, with the headings gone, is the card's order. */
  rows: { label: string; value: string }[];
  action: React.ReactNode;
}) {
  const card = (
    <section
      className={`flex h-full flex-col bg-panel p-4 text-fg ${
        featured
          ? // Inside the shell, so it carries no border of its own and takes a
            // tighter radius — a card curving as hard as the thing holding it
            // leaves a crescent of colour showing at every corner.
            "rounded-xl"
          : "rounded-2xl border border-line shadow-md"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* The mark sits in a tile rather than loose, so a 20px line drawing
            has some weight beside 24px type. Tinted on the featured card and
            plain grey on the other, which is the same distinction the button
            makes, one size down. */}
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            featured ? "bg-accent/12 text-accent" : "bg-raised text-fg"
          }`}
        >
          {mark}
        </span>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {name}
        </h2>
      </div>

      {/* Two lines held whether or not both are used. The cards sit side by
          side and their blurbs are different lengths, so without this the two
          prices land at different heights and the comparison reads as sloppy
          before it reads as anything. */}
      {/* Reserved to three lines rather than two: at four columns every blurb
          runs to three, and a well shorter than the tallest of them leaves the
          four prices on four different baselines — which is the one row a
          reader compares across before anything else. */}
      <p className="mt-3 min-h-[4.75rem] font-sans text-sm leading-relaxed text-muted">
        {blurb}
      </p>

      {/* The number, at the size the reference sets it: big enough to be the
          thing you land on after the name, with the unit small beside it so the
          figure keeps the weight. */}
      {/* 40px rather than 48. The figure is still the thing the eye lands on
          after the name, but at four columns `$24.98 /month` at `text-5xl` ran
          past the card and clipped its own unit — and a price that does not fit
          is the one number on this page that has to. */}
      <p className="mt-4 font-display text-[2.5rem] leading-none font-bold tracking-tight">
        {price}
        <span className="ml-1.5 text-base font-medium text-muted">/month</span>
      </p>
      {/* Reserved whether or not it is filled, so the two cards' buttons stay on
          one line as the period switches. */}
      <p className="mt-1.5 h-5 font-sans text-xs text-muted">{note}</p>

      <div className="mt-4">{action}</div>

      <div aria-hidden="true" className="mt-6 h-px bg-line" />

      {/* No "Features" heading. The rule already says a new part of the card
          has started, and the reference reads better without a word between
          the button and the list. */}
      {/* **Walked group by group rather than row by row**, and the difference
          is not style: driving the headings off `GROUPS` means a row filed in
          the wrong place lands under its own heading instead of printing that
          heading a second time halfway down the card. Reading the flag off each
          row as it passed would have made the list's *sort order* load-bearing,
          which is the kind of thing a later edit breaks silently.

          It also keeps the two cards in step. Both render the same array
          through the same walk, so a heading falls at the same point in each
          and every row stays on one line across the pair — which is the whole
          reason the two columns can be compared at a glance. */}
      {/* **One flat list, in `ROWS` order.**

          Two uppercase headings used to file these rows into blocks. They went
          when the cards went to four: with four columns and four crossed rows
          the list is short enough to read straight through, and the second
          heading was announcing a boundary that the column of crosses already
          draws far more plainly than a word does.

          What that costs is that the array's *order* is now load-bearing — it
          is the only thing sequencing the card. `plan-rows.ts` says so at the
          top, and the reasoning for the order lives there rather than here.

          Every card walks the same array, so a row falls at the same height in
          each and the four columns can be compared at a glance. That is the
          whole reason the reserved strip below exists. */}
      <dl className="mt-5 space-y-3">
        {rows.map((row) => {
          // What the plan gives you is set in the card's own ink — mark, label
          // and value alike — and what it withholds is the only thing faded.
          const has = row.value !== NOT_INCLUDED;

          return (
            /* **One line per row, and that is the whole shape.**

               This was a wrapping flex holding a tick, a label with its
               explanation inline in brackets, and a badge. At two cards it
               read; at four it came apart — the label ran to two lines, the
               bracket broke across them, `items-center` floated the tick down
               beside the middle of the pair, and a `shrink-0` badge next to a
               `<dt>` that could not shrink went straight over the card's edge.
               On the featured column that overflow printed a blue bar through
               the middle of the list.

               So: every row is a tick, a label short enough to sit on one line,
               and a value against the right edge. The explanations went with
               the second line — a card is a comparison, and eleven rows of
               parenthetical prose is a page. `min-w-0` stays as the guard that
               keeps a long label wrapping rather than shoving the badge out. */
            <div key={row.label} className="flex items-center gap-2.5">
              {/* The same circle either way, so the column of marks stays a
                  column. Only what is inside it changes: a tick for a line the
                  plan gives you, a cross for one it does not — because a tick
                  against the words "Not included" is a yes drawn on top of a
                  no.

                  Four rows carry the cross on the two plans without the
                  assistant, where there used to be one. They fall together at
                  the foot of the list rather than scattered through it, which
                  is what makes them read as a boundary rather than as four
                  separate refusals.

                  Both take the status family's own tokens rather than literal
                  shades — `ok-fg` and `stop-fg` — which is what makes them
                  legible in both themes: saturated ink at night, darker ink by
                  day. A hex green tuned against black is a smudge on white. */}
              {has ? (
                <CheckIcon className="h-5 w-5 shrink-0 text-ok-fg" />
              ) : (
                <CrossIcon className="h-5 w-5 shrink-0 text-stop-fg" />
              )}

              <dt
                /* 14px, level with the badge beside it rather than a step
                   above. "Chapters and words" was the one label that still
                   took two lines at four columns, and the row's whole shape
                   depends on none of them doing that. The hierarchy survives
                   the change because the badge carries a hue, and hue outranks
                   size by a distance. */
                className={`min-w-0 font-sans text-sm leading-snug
                            font-medium ${has ? "" : "text-muted"}`}
              >
                {row.label}
              </dt>

              {/* ml-auto rather than a two-column grid: the value is set
                  against the right edge the way a price list is.

                  "Included" and "Not included" are dropped rather than printed:
                  the mark in front has already said both, and a word repeating
                  a glyph is the kind of line a reader learns to skip — which
                  costs the rows that do carry a value. */}
              {has && row.value !== "Included" && (
                <dd className="ml-auto shrink-0">
                  <ValueBadge
                    value={row.value}
                    tone={badgeTone(row.label, row.value, Boolean(featured))}
                  />
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );

  if (!featured) {
    /*
     * The same shell, empty and transparent.
     *
     * Reserved rather than left off, so the two cards' names, prices and rows
     * sit on the same lines: side by side, a strip on one and not the other
     * offsets every row of the comparison by the depth of the strip, and a
     * reader checking one column against the other has to keep finding their
     * place. Built from the same markup as the real one so the two heights
     * cannot drift — a hand-measured `pt-11` here would be wrong the first time
     * anybody changed the strip's padding.
     *
     * Only from `sm` up. Stacked on a phone there is nothing to line up with,
     * and a blank band above the free card would just be a gap.
     */
    return (
      <div className="rounded-2xl p-1.5 pt-0">
        <p
          aria-hidden="true"
          className="hidden py-2.5 text-center font-sans text-xs font-medium sm:block"
        >
          &nbsp;
        </p>
        {card}
      </div>
    );
  }

  /*
   * The shell: a filled block with a line written along the top and the card
   * set into the rest of it.
   *
   * **It replaces a badge, and it does that job better.** A chip in the card's
   * own corner is read after the name and the price, by which point the reader
   * has already worked out what they are looking at. A strip above the card is
   * read first, and it has room for a sentence rather than a word — so it can
   * say *who the plan is for*, where "Popular" is a claim about other people
   * rather than about the reader.
   *
   * The fill is `bg-brand-fill` and the writing on it is `text-brand-ink`.
   *
   * **It was `bg-accent`/`text-accent-ink` until 2026-08-21**, on the reasoning
   * that the pair inverts correctly — the accent is the brand indigo by day and
   * white at night, its ink the opposite of whichever it is — and that a fixed
   * white would be invisible in daylight. Both halves of that still hold; what
   * changed is that a white slab at night is the loudest thing on a black page,
   * for a strip whose job is to say who the plan is for. `--color-brand-fill`
   * is the brand blue in both blocks with white on it at 4.59:1, so the shell
   * now reads as the brand rather than as the brightest available value.
   *
   * `p-1.5 pt-0` is the whole geometry: no padding above, so the strip's own
   * line-height sets the band's depth, and a hairline of colour on the other
   * three sides.
   */
  return (
    <div className="rounded-2xl bg-brand-fill p-1.5 pt-0 shadow-lg">
      <p className="py-2.5 text-center font-sans text-xs font-medium text-brand-ink">
        {badge}
      </p>
      {card}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Line drawings, all at one weight so the card marks and the row marks read as
   one set.

   The row marks are a circle each and nothing else — a tick or a bar. The
   earlier version drew a different glyph per row (a book, a microphone, a
   waveform), which is the version that had to go: eight small grey pictures
   beside eight words, each one saying what its word already said.
   ------------------------------------------------------------------------- */

function Stroke({
  className,
  weight = 1.5,
  children,
}: {
  className?: string;
  /** Heavier for the row marks, which are read at a glance down a column. */
  weight?: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    // 2.4 rather than 2: at 24px in a column read at a glance, a 2-weight ring
    // and its tick thin out into the same grey mark, and the difference between
    // a yes and a no is the one thing this column exists to carry.
    <Stroke className={className} weight={2.4}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="m6.75 10.25 2.25 2.25 4.25-4.75" />
    </Stroke>
  );
}

/** The same circle, crossed. */
function CrossIcon({ className }: { className?: string }) {
  return (
    <Stroke className={className} weight={2.4}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="m7.5 7.5 5 5M12.5 7.5l-5 5" />
    </Stroke>
  );
}

export function PenIcon({ className }: { className?: string }) {
  return (
    <Stroke className={className}>
      <path d="M14.5 3.5a2.1 2.1 0 0 1 3 3L8 16l-4 1 1-4z" />
      <path d="M12.5 5.5l3 3" />
    </Stroke>
  );
}

export function StackIcon({ className }: { className?: string }) {
  return (
    <Stroke className={className}>
      <path d="M10 2.5 17.5 6 10 9.5 2.5 6z" />
      <path d="M2.5 10 10 13.5 17.5 10" />
      <path d="M2.5 14 10 17.5 17.5 14" />
    </Stroke>
  );
}
