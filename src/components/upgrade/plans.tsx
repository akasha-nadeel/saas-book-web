"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { startCheckout, type CheckoutState } from "@/app/upgrade/actions";
import { ComingSoonDialog } from "@/components/shelf/coming-soon-dialog";
import { displayPrice, perMonthOf, priceOf } from "@/lib/billing/plans";
import { FREE_LIMITS, SEATS_PER_BOOK } from "@/lib/free-limits";

/**
 * The two plans, presented as a pricing section rather than a settings screen:
 * a chip, a headline, a period switch, then the cards.
 *
 * Both cards run the same lines with a value against each, rather than each
 * listing only what it includes. It is the longer of the two shapes, and it is
 * the one that answers the question actually being asked: not "what does Pro
 * have" but "what do I lose by staying". A row missing from one side breaks the
 * line the eye reads across, so a row is never dropped — it is answered.
 *
 * The paid card is `bg-fg`/`text-surface`, not a fixed colour. Stated as the
 * two tokens it inverts with the palette rather than against it — which is what
 * keeps it a card standing off the page instead of a hole cut in one, and is
 * the whole of why the palette is written as jobs rather than as hues.
 *
 * **Every line below is true of the code.** Two were not, once — a shelf
 * counted to fifty and an eleventh import refused — and both were deleted
 * rather than reworded, because nothing counted either and a limit promised on
 * a pricing page that no code enforces is the same failure as a feature claim
 * the app cannot back. The counted rows are back because the counting is:
 * `prefs.usage` is stamped by `countUse` at each of the six places that spend
 * one, and `lib/free-limits.ts` holds the four numbers this file quotes. The
 * shelf limit is *not* back and is not planned — books a writer starts here
 * are free and unbounded, which is the promise the product rests on.
 *
 * The rows differ in *how* they are enforced, and it is worth knowing which is
 * which. The four metered ones — assistant, ranked comps, audiobook, audio
 * import — are checked server-side by `requirePro()`, which is the only check a
 * reader with devtools cannot edit. The rest are computed in the browser and
 * are therefore gated in the browser: the prose report, the money screens, the
 * advance-copy list, the writing record and the series bible. That is normal
 * for local-first software and it is not a secret, but do not add a row here
 * whose value depends on the gate being unbreakable.
 *
 * The figures are not written here. They come from lib/billing/plans.ts, which
 * is also what signs the amount into the PayHere checkout, so the number on the
 * card and the number on the card statement cannot drift apart.
 */

/*
 * Imported rather than restated. This file used to declare its own
 * `type Period = "monthly" | "annual"`, which is the same drift the note above
 * warns about with prices, one level up: adding a third way to buy in
 * `plans.ts` left this copy two-valued, and the toggle could not offer what the
 * checkout was perfectly able to charge for.
 */
import type { Period } from "@/lib/billing/plans";

/**
 * The one value that means "no". Named, because the mark in front of a row is
 * chosen by comparing against it — a tick beside the words "Not included" is a
 * yes and a no in the same line.
 */
const NOT_INCLUDED = "Not included";

/**
 * The Pro card's button, in whichever of its three forms.
 *
 * Written once because it is a link in one state and a submit in two others,
 * and the three have to be indistinguishable — a button that changes shape as
 * the page learns what plan you are on reads as a glitch.
 *
 * **Filled with the accent, which is what now separates the two cards.** The
 * Pro card used to be inverted — near-black ground, pale button — and both
 * cards are the same card now, so the hierarchy has to come from somewhere
 * that means something. The accent is the app's one reserved hue and it means
 * exactly this: the way forward. The free card's button is an outline, because
 * two filled buttons side by side ask the reader to choose between two equals.
 *
 * `text-accent-ink` rather than a fixed white: the fill is white at night and
 * near-black by day, so a hardcoded colour is invisible in exactly one theme.
 */
const PRO_BUTTON = `block rounded-xl bg-accent px-5 py-3 text-center font-sans
  text-sm font-semibold text-accent-ink outline-none transition-opacity
  hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/60`;

/**
 * The comparison, read across a line: label, what Starter gives, what Pro does.
 *
 * **The split is by what a row costs to run and who it is for**, not by what
 * would squeeze hardest. Three lines govern it:
 *
 * - **Writing a book and getting it out is free, whole.** All four exports, the
 *   pre-upload check and the roadmap included. Every competitor charges for
 *   formatting — Scrivener at $60, Atticus at $147, Vellum at $200 and up — so
 *   giving it away is the wedge, and the landing page has already promised it
 *   in those words: get it out without paying to find out what was wrong.
 * - **Anything with a bill attached is Pro.** The four metered routes cost real
 *   money per use and are the only things here that do.
 * - **The business layer is Pro.** Earnings, advance readers, the curve, the
 *   evidence document: a drafting writer has no money and a selling one does.
 *
 * Two rows were removed rather than reworded. "Books 50" and "Imports 10 files"
 * were limits the code has never enforced — a promise on a pricing page that
 * nothing implements is the same failure as a claim the code cannot back, and
 * this is the page a sceptical reader checks hardest.
 */
const ROWS: { label: string; starter: string; pro: string }[] = [
  { label: "Books and words", starter: "Unlimited", pro: "Unlimited" },
  { label: "Exports", starter: "All four", pro: "All four" },
  /*
   * The four counted rows, and every number is read out of `FREE_LIMITS` so the
   * page and the gate cannot drift — the same rule the prices follow.
   *
   * Imports are counted **files, not books**: a manuscript brought into a book
   * that already exists spends one too, or "make a book first" is one click
   * round it. The three searches count a press rather than a screen — both the
   * comps page and the title check open by searching for the book already in
   * front of the writer, and that arrival search is free, or the ten would go
   * on ten visits. Blurb and categories are not counted at all, which is why
   * they moved off the search row and onto their own.
   */
  { label: "Imports", starter: `${FREE_LIMITS.imports} files`, pro: "Unlimited" },
  { label: "Comp searches", starter: `${FREE_LIMITS.comps}`, pro: "Unlimited" },
  { label: "Cover searches", starter: `${FREE_LIMITS.covers}`, pro: "Unlimited" },
  {
    label: "Title checks",
    starter: `${FREE_LIMITS.titleChecks}`,
    pro: "Unlimited",
  },
  { label: "Pre-upload check & roadmap", starter: "Included", pro: "Included" },
  { label: "Blurb & categories", starter: "Included", pro: "Included" },
  { label: "Structure & progress", starter: "Included", pro: "Included" },
  { label: "Story bible", starter: "Per book", pro: "Across a series" },
  /*
   * **Both numbers, because Pro raises this rather than lifting it.**
   *
   * Every other metered row reads "Unlimited" on the right; a book's seats do
   * not, and printing "Unlimited" here would be the one false cell on the page.
   * Read from `SEATS_PER_BOOK` for the same reason the four above are read from
   * `FREE_LIMITS` — one number, one place — and counting the owner, so the figure
   * a reader sees is the number of faces on the book.
   */
  {
    label: "People per book",
    starter: `${SEATS_PER_BOOK.free} incl. you`,
    pro: `${SEATS_PER_BOOK.pro} incl. you`,
  },
  // Free on both because it costs nothing to run: dictation is the browser's
  // own SpeechRecognition, not the paid transcriber. The value says which
  // browsers rather than "Included" — it is a Chrome and Edge feature, the
  // button hides itself elsewhere, and a plan row is the wrong place to find
  // that out later.
  { label: "Voice typing", starter: "Chrome & Edge", pro: "Chrome & Edge" },
  { label: "Sync", starter: "Every device", pro: "Every device" },
  { label: "Assistant", starter: NOT_INCLUDED, pro: "Included" },
  { label: "Ranked comps", starter: NOT_INCLUDED, pro: "Included" },
  { label: "Audiobook & audio import", starter: NOT_INCLUDED, pro: "Included" },
  { label: "Prose report", starter: NOT_INCLUDED, pro: "Included" },
  { label: "Money tracking & the curve", starter: NOT_INCLUDED, pro: "Included" },
  { label: "Advance copies", starter: NOT_INCLUDED, pro: "Included" },
  { label: "Writing record", starter: NOT_INCLUDED, pro: "Included" },
];

export function Plans({
  /** Decides where the starter card's button goes — the shelf, or the way in. */
  signedIn,
  /** Is there a PayHere merchant behind the Upgrade button? */
  billing,
  /** Already paying. The card stops selling and starts confirming. */
  pro: alreadyPro,
  /** Set when PayHere sent the writer back without taking anything. */
  cancelled = false,
}: {
  signedIn: boolean;
  billing: boolean;
  pro: boolean;
  cancelled?: boolean;
}) {
  const [period, setPeriod] = useState<Period>("monthly");

  // With no merchant configured there is nothing to sell. The house rule is
  // that a control either works or plainly says it does not, so the button
  // stays where it will always be and pressing it explains itself.
  const [soon, setSoon] = useState(false);

  const [state, checkout, pending] = useActionState<CheckoutState, FormData>(
    startCheckout,
    {},
  );

  // Both cycles show a per-month rate, because a reader compares plans by the
  // month whatever they are billed on. The annual one names the real total.
  const headline = displayPrice(perMonthOf(period));
  const note =
    period === "annual"
      ? `${displayPrice(priceOf("annual"))} billed annually`
      : undefined;

  return (
    // <body> is overflow-hidden for the editor shell, so this page owns its own
    // scrolling. min-h-dvh would put the last card out of reach.
    <main className="scroll-slim h-dvh overflow-y-auto bg-surface">
      {/* No header bar: the section is the page, the way a pricing section is.
          The way back is one quiet link in the corner rather than a chrome bar
          competing with the headline. */}
      <div className="px-5 pt-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5
                     font-sans text-sm text-muted outline-none transition-colors
                     hover:bg-raised hover:text-fg focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          <span aria-hidden="true">←</span> Back to writing
        </Link>
      </div>

      <div className="mx-auto max-w-4xl px-5 pt-8 pb-20 text-center sm:pt-12">
        <p
          className="inline-block rounded-full border border-line bg-panel px-4
                     py-1.5 font-sans text-xs font-medium text-muted"
        >
          Pricing
        </p>

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">
          Plans for your writing
        </h1>
        {/* Not `text-muted`: this is the sentence the headline is asking to be
            read, so it takes the page's own ink held slightly back rather than
            the grey used for metadata. Wider measure too — at this size the old
            max-w-xl broke it after three words. */}
        <p
          className="mx-auto mt-4 max-w-2xl font-sans text-lg leading-relaxed
                     font-medium text-fg/80"
        >
          Writing a book is free, and stays free. The parts that spend a
          model&rsquo;s time are what the paid plan pays for.
        </p>

        <PeriodToggle period={period} onChange={setPeriod} />

        {cancelled && (
          // PayHere's cancel_url lands back here. Said out loud, because a
          // writer who abandoned a card form wants to know nothing was taken —
          // silence on that reads as "did it go through?"
          <p
            role="status"
            className="mx-auto mt-8 max-w-md rounded-xl border border-line
                       bg-panel px-4 py-3 font-sans text-sm text-muted"
          >
            That checkout was cancelled and nothing was charged.
          </p>
        )}

        {/* items-start so the raised card grows upward on its own rather than
            stretching its neighbour to match. */}
        <div className="mt-12 grid gap-6 text-left sm:grid-cols-2 sm:items-start">
          <PlanCard
            mark={<PenIcon className="h-6 w-6" />}
            name="Starter"
            blurb="For everything it takes to write a book and get it out."
            price="$0"
            rows={ROWS.map((r) => ({ label: r.label, value: r.starter }))}
            action={
              // Not a disabled "current plan" chip: a writer who is already in
              // has somewhere to be, and one who is not has an account to make.
              // Both are real destinations, which is more use than a label.
              <Link
                href={signedIn ? "/" : "/signup"}
                className="block rounded-xl border border-line bg-surface px-5 py-3
                           text-center font-sans text-sm font-semibold text-fg
                           outline-none transition-colors hover:bg-raised
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {signedIn ? "Keep writing" : "Start writing"}
              </Link>
            }
          />

          <PlanCard
            featured
            badge="Ideal once the book is going out"
            mark={<StackIcon className="h-6 w-6" />}
            name="Pro"
            blurb="For the assistant, the money, the readers and the book read aloud."
            price={headline}
            note={note}
            rows={ROWS.map((r) => ({ label: r.label, value: r.pro }))}
            action={
              alreadyPro ? (
                // Nothing to sell someone who has already bought it. A disabled
                // "current plan" chip would be a dead control on the one card
                // that most needs to say something useful.
                <Link href="/" className={PRO_BUTTON}>
                  You&rsquo;re on Pro — keep writing
                </Link>
              ) : billing ? (
                <form action={checkout}>
                  {/* The cycle is read from the toggle at submit time rather
                      than from a second piece of state on the server. */}
                  <input type="hidden" name="period" value={period} />
                  <button
                    type="submit"
                    disabled={pending}
                    className={`w-full cursor-pointer disabled:cursor-default
                                disabled:opacity-70 ${PRO_BUTTON}`}
                  >
                    {pending ? "Starting checkout…" : "Upgrade"}
                  </button>
                  {state.error && (
                    // On the card's own ink, not text-red: the ground here is
                    // bg-fg, and a red that reads on paper disappears on it.
                    <p
                      role="alert"
                      className="mt-3 font-sans text-xs leading-relaxed text-surface/75"
                    >
                      {state.error}
                    </p>
                  )}
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setSoon(true)}
                  className={`w-full cursor-pointer ${PRO_BUTTON}`}
                >
                  Upgrade
                </button>
              )
            }
          />
        </div>

        <p className="mx-auto mt-10 max-w-xl font-sans text-sm leading-relaxed text-muted">
          Your manuscripts are yours on either plan. They are written to this
          browser first and synced to your account, so nothing here decides
          whether you can open your own book.
        </p>
      </div>

      {soon && (
        <ComingSoonDialog title="Pro" onClose={() => setSoon(false)}>
          There is no payment gateway configured on this copy of OpenChapter, so
          there is nothing to buy — and nothing is held back either. The
          assistant, the bookmarks and the audiobook all work here for anyone
          running their own API keys; Pro is those same three without a key to
          keep.
        </ComingSoonDialog>
      )}
    </main>
  );
}

/**
 * Monthly / Annually.
 *
 * A radiogroup rather than two buttons with `aria-pressed`: these are one
 * choice with two answers, and a screen reader should hear it that way — which
 * is also how the tab key then behaves, landing on the group once instead of
 * on each half.
 *
 * The chosen half is a filled pill on a light track, so the state is carried by
 * the fill and not by a weight change that only sighted readers catch.
 */
function PeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (next: Period) => void;
}) {
  const options: { value: Period; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "annual", label: "Annually" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className="mt-8 inline-flex items-center gap-1 rounded-full border
                 border-line bg-panel p-1"
    >
      {options.map((option) => {
        const on = period === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded-full px-5 py-2 font-sans text-sm
                        font-medium outline-none transition-colors
                        focus-visible:ring-2 focus-visible:ring-accent/60 ${
                          on
                            ? "bg-fg text-surface"
                            : "text-muted hover:text-fg"
                        }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

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
function PlanCard({
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
  rows: { label: string; value: string }[];
  action: React.ReactNode;
}) {
  const card = (
    <section
      className={`flex h-full flex-col bg-panel p-7 text-fg sm:p-8 ${
        featured
          ? // Inside the shell, so it carries no border of its own and takes a
            // tighter radius — a card curving as hard as the thing holding it
            // leaves a crescent of colour showing at every corner.
            "rounded-xl"
          : "rounded-2xl border border-line shadow-sm"
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
      <p className="mt-4 min-h-10 font-sans text-sm leading-relaxed text-muted">
        {blurb}
      </p>

      {/* The number, at the size the reference sets it: big enough to be the
          thing you land on after the name, with the unit small beside it so the
          figure keeps the weight. */}
      <p className="mt-5 font-display text-5xl font-bold tracking-tight">
        {price}
        <span className="ml-1.5 text-base font-medium text-muted">/month</span>
      </p>
      {/* Reserved whether or not it is filled, so the two cards' buttons stay on
          one line as the period switches. */}
      <p className="mt-1.5 h-5 font-sans text-xs text-muted">{note}</p>

      <div className="mt-5">{action}</div>

      <div aria-hidden="true" className="mt-7 h-px bg-line" />

      {/* No "Features" heading. The rule already says a new part of the card
          has started, and the reference reads better without a word between
          the button and the list. */}
      <dl className="mt-6 space-y-3.5">
        {rows.map((row) => {
          // What the plan gives you is set in the card's own ink — mark, label
          // and value alike — and what it withholds is the only thing faded.
          const has = row.value !== NOT_INCLUDED;

          return (
            <div
              key={row.label}
              className={`flex items-center gap-2.5 ${has ? "" : "text-muted"}`}
            >
              {/* The same circle either way, so the column of marks stays a
                  column. Only what is inside it changes: a tick for a line the
                  plan gives you, a cross for one it does not — because a tick
                  against the words "Not included" is a yes drawn on top of a
                  no.

                  Both take the status family's own tokens rather than literal
                  shades — `ok-fg` and `stop-fg` — which is what makes them
                  legible in both themes: saturated ink at night, darker ink by
                  day. A hex green tuned against black is a smudge on white.

                  Drawn at 20px and a heavier stroke than the card marks above
                  them, because these are read as a column at a glance rather
                  than looked at one at a time, and at 16px and hairline weight
                  the tick and the cross are the same grey smudge until you
                  lean in. */}
              {has ? (
                <CheckIcon className="h-5 w-5 shrink-0 text-ok-fg" />
              ) : (
                <CrossIcon className="h-5 w-5 shrink-0 text-stop-fg" />
              )}
              <dt className="font-sans text-sm">{row.label}</dt>
              {/* ml-auto rather than a two-column grid: the value is set
                  against the right edge the way a price list is, and a long one
                  wraps under itself instead of squeezing the label.

                  "Included" and "Not included" are dropped rather than printed:
                  the mark in front has already said both, and a word repeating
                  a glyph is the kind of line a reader learns to skip — which
                  costs the rows that do carry a value. */}
              {row.value !== "Included" && !has === false && (
                <dd className="ml-auto text-right font-sans text-sm text-muted">
                  {row.value}
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
   * The fill is `bg-accent` and the writing on it is `text-accent-ink`, which
   * is the pair that inverts correctly: the accent is the brand indigo by day
   * and white at night, and its ink is the opposite of whichever it is. A
   * fixed white here would be invisible in daylight — the half nobody tests.
   *
   * `p-1.5 pt-0` is the whole geometry: no padding above, so the strip's own
   * line-height sets the band's depth, and a hairline of colour on the other
   * three sides.
   */
  return (
    <div className="rounded-2xl bg-accent p-1.5 pt-0 shadow-md">
      <p className="py-2.5 text-center font-sans text-xs font-medium text-accent-ink">
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
    <Stroke className={className} weight={2}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="m6.75 10.25 2.25 2.25 4.25-4.75" />
    </Stroke>
  );
}

/** The same circle, crossed. */
function CrossIcon({ className }: { className?: string }) {
  return (
    <Stroke className={className} weight={2}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="m7.5 7.5 5 5M12.5 7.5l-5 5" />
    </Stroke>
  );
}

function PenIcon({ className }: { className?: string }) {
  return (
    <Stroke className={className}>
      <path d="M14.5 3.5a2.1 2.1 0 0 1 3 3L8 16l-4 1 1-4z" />
      <path d="M12.5 5.5l3 3" />
    </Stroke>
  );
}

function StackIcon({ className }: { className?: string }) {
  return (
    <Stroke className={className}>
      <path d="M10 2.5 17.5 6 10 9.5 2.5 6z" />
      <path d="M2.5 10 10 13.5 17.5 10" />
      <path d="M2.5 14 10 17.5 17.5 14" />
    </Stroke>
  );
}
