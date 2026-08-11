"use client";

import { Fragment, useActionState, useState } from "react";
import Link from "next/link";
import { startCheckout, type CheckoutState } from "@/app/upgrade/actions";
import { ComingSoonDialog } from "@/components/shelf/coming-soon-dialog";
import {
  annualSavingPercent,
  displayPrice,
  perMonthOf,
  priceOf,
} from "@/lib/billing/plans";
import { PaddleUpgradeButton } from "@/components/upgrade/paddle-checkout";
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
 * - **A cap Pro *raises* is a fourth kind, and the three above do not cover
 *   it.** People per book and the story bible are not metered per use and are
 *   not the business layer — they are one feature, sized. So they read "2 / 10"
 *   and "Per book / Across a series" rather than "Unlimited" or a cross, either
 *   of which would be false in a different direction: the free plan really does
 *   share a book with somebody, and Pro really does not make that unbounded.
 *   Both numbers come from `SEATS_PER_BOOK`, so this page cannot drift from what
 *   the database enforces.
 *
 * Two rows were removed rather than reworded. "Books 50" and "Imports 10 files"
 * were limits the code has never enforced — a promise on a pricing page that
 * nothing implements is the same failure as a claim the code cannot back, and
 * this is the page a sceptical reader checks hardest.
 */
/**
 * The three headings the rows are filed under, in the order a book is made.
 *
 * **Twenty-two rows in one column is a list nobody finishes.** That was the
 * shape of this card until now, and the order inside it had no argument at all
 * — the three Pro-only rows sat in the middle, "Prose report" came after
 * "Audiobook", and the writing record landed under the sales curve. A reader
 * scanning for the one thing they came to check had to read every line.
 *
 * Grouping is what the pricing pages that carry this many rows do (Airtable and
 * Notion both file theirs under headings), and for a measurable reason: nobody
 * reads a long feature list, they scan for their own question, and a heading is
 * what tells them which ten lines to look at. It also stops the list reading as
 * a boast — clarity over completeness.
 *
 * **The headings are the job, not the software's parts.** "Writing the book",
 * "Getting it ready", "Selling it" is the same order the roadmap walks and the
 * same claim the landing page makes: nobody tells you the order. A reader who
 * has only written should be able to see where they are on this card.
 */
const GROUPS = ["Writing the book", "Getting it ready", "Selling it"] as const;

type Group = (typeof GROUPS)[number];

/**
 * Two rules order the rows inside a group, and both are about scanning.
 *
 * **What everyone gets comes first, what Pro alone gives comes last.** A reader
 * on the free card meets the strength of the free plan before its edges; a
 * reader on the Pro card reaches the reason to pay at the end of each block,
 * where it is the thing they are looking at when the block finishes. Scattering
 * the crosses through the middle — which is what this list used to do — hides
 * the differences among the twenty rows that are identical on both cards.
 *
 * **Rows that answer one question stay together.** The three daily searches read
 * as a block down the column, which is what makes "a day" legible as a shape
 * rather than three separate numbers, so "Ranked comps" sits after them rather
 * than next to the comp search it belongs to topically.
 */
const ROWS: {
  group: Group;
  label: string;
  /**
   * A quieter aside after the label, set in parentheses and a size down.
   *
   * Its own field rather than part of `label`, because a detail baked into the
   * string cannot be styled apart from the thing it qualifies — and it should
   * be: "which four" is a footnote to "Exports", not a second half of the name.
   * Keeping them separate also means `STARTER_HIGHLIGHT` still matches on a
   * short, stable label.
   */
  detail?: string;
  starter: string;
  pro: string;
}[] = [
  /* ---- Writing the book ------------------------------------------------- */
  { group: "Writing the book", label: "Books and words", starter: "Unlimited", pro: "Unlimited" },
  { group: "Writing the book", label: "Imports", starter: "Unlimited", pro: "Unlimited" },
  { group: "Writing the book", label: "Sync", starter: "Every device", pro: "Every device" },
  // Free on both because it costs nothing to run: dictation is the browser's
  // own SpeechRecognition, not the paid transcriber. The value says which
  // browsers rather than "Included" — it is a Chrome and Edge feature, the
  // button hides itself elsewhere, and a plan row is the wrong place to find
  // that out later.
  {
    group: "Writing the book",
    label: "Voice typing",
    starter: "Chrome & Edge",
    pro: "Chrome & Edge",
  },
  /*
   * **Both numbers, because Pro raises this rather than lifting it.**
   *
   * Every other metered row reads "Unlimited" on the right; a book's seats do
   * not, and printing "Unlimited" here would be the one false cell on the page.
   * Read from `SEATS_PER_BOOK` for the same reason the four below are read from
   * `FREE_LIMITS` — one number, one place — and counting the owner, so the figure
   * a reader sees is the number of faces on the book.
   */
  {
    group: "Writing the book",
    label: "People per book",
    starter: `${SEATS_PER_BOOK.free} incl. you`,
    pro: `${SEATS_PER_BOOK.pro} incl. you`,
  },
  {
    group: "Writing the book",
    label: "Story bible",
    starter: "Across a series",
    pro: "Across a series",
  },
  {
    group: "Writing the book",
    label: "Structure & progress",
    starter: "Included",
    pro: "Included",
  },
  { group: "Writing the book", label: "Writing record", starter: "Included", pro: "Included" },
  {
    group: "Writing the book",
    label: "Prose report",
    starter: `${FREE_LIMITS.prose.free} books`,
    pro: "Unlimited",
  },
  { group: "Writing the book", label: "Assistant", starter: NOT_INCLUDED, pro: "Included" },

  /* ---- Getting it ready -------------------------------------------------- */
  /*
   * **Named in the label, counted in the badge.**
   *
   * "All four" alone asked the reader to take our word for how many and which —
   * on the row that is this page's whole argument, since every competitor
   * charges for formatting. Naming them costs one line and answers it.
   *
   * They sit in the *label* rather than the badge because the badge column is a
   * column of short answers, and "All four (EPUB, DOCX, PDF, Markdown)" in a
   * pill would be twice the width of every other one and break the alignment
   * that makes the column scannable.
   *
   * Written out rather than imported from `export/index.ts`: that module pulls
   * in `cover-store` and the export pipeline at the top level, which is a great
   * deal of code to drag into a pricing page for four words. `Format` there is a
   * type and cannot be counted at runtime anyway. If a fifth format ever ships,
   * this line is part of shipping it.
   *
   * It opens this group because it is the row the whole page rests on, and the
   * first line under a heading is the one that gets read.
   */
  {
    group: "Getting it ready",
    label: "Exports",
    detail: "EPUB, DOCX, PDF, Markdown",
    starter: "All four",
    pro: "All four",
  },
  {
    group: "Getting it ready",
    label: "Pre-upload check & roadmap",
    starter: "Included",
    pro: "Included",
  },
  {
    group: "Getting it ready",
    label: "Blurb",
    starter: `${FREE_LIMITS.blurb.free} books`,
    pro: "Unlimited",
  },
  // Its own row rather than folded into the one above, because the two are
  // gated differently and a reader comparing columns would otherwise see
  // "5 books" and assume it covered both. Writing the blurb, the counts and
  // the findings are free on any book; only the reading is metered, and it is
  // metered on the server by `requirePro()` rather than in the browser.
  {
    group: "Getting it ready",
    label: "A reader on your blurb",
    starter: NOT_INCLUDED,
    pro: "Included",
  },
  {
    group: "Getting it ready",
    label: "Categories & keywords",
    starter: "Included",
    pro: "Included",
  },
  /*
   * **Each tool metered in its own unit, and every number read out of
   * `FREE_LIMITS`** so the page and the gate cannot drift — the same rule the
   * prices follow.
   *
   * A table rather than a paragraph, deliberately: six numbers in three shapes
   * is more than a sentence can carry, and the version of this page that tried
   * ("ten of each of four things") was the reason the whole policy was rewritten
   * once already. Read down a column and each row answers one question.
   *
   * The three searches say "a day" because they come back — the only limits
   * here that do, and a row reading "2" would look like a lifetime allowance.
   * They are kept adjacent for that reason: three of them running together is
   * what makes "a day" read as the shape of this plan rather than as a footnote
   * on one line.
   */
  {
    group: "Getting it ready",
    label: "Comp searches",
    starter: `${FREE_LIMITS.comps.free} a day`,
    pro: "Unlimited",
  },
  {
    group: "Getting it ready",
    label: "Cover searches",
    starter: `${FREE_LIMITS.covers.free} a day`,
    pro: "Unlimited",
  },
  {
    group: "Getting it ready",
    label: "Title checks",
    starter: `${FREE_LIMITS.titleCheck.free} a day`,
    pro: "Unlimited",
  },
  /*
   * **The one row here counted for the life of the account**, so it says "in
   * total" and must never say "a day". It sits directly under the three daily
   * rows on purpose: read against them the difference in wording is the whole
   * of the difference in meaning, and a reader comparing the column can see at
   * a glance which numbers come back and which do not.
   */
  {
    group: "Getting it ready",
    label: "Keyword suggestions",
    starter: `${FREE_LIMITS.keywordsAi.free} in total`,
    pro: "Unlimited",
  },
  {
    group: "Getting it ready",
    label: "Blurb conversations",
    // Counted in conversations, so the cell has to say so — beside a chat
    // feature, a bare "3 in total" reads as three messages.
    starter: `${FREE_LIMITS.blurbChat.free} conversations`,
    pro: "Unlimited",
  },
  { group: "Getting it ready", label: "Ranked comps", starter: NOT_INCLUDED, pro: "Included" },
  {
    group: "Getting it ready",
    label: "Audiobook & audio import",
    starter: NOT_INCLUDED,
    pro: "Included",
  },

  /* ---- Selling it -------------------------------------------------------- */
  {
    group: "Selling it",
    label: "Advance copies",
    starter: `${FREE_LIMITS.arcReaders.free} a book`,
    pro: "Unlimited",
  },
  {
    group: "Selling it",
    label: "Money tracking",
    starter: `${FREE_LIMITS.track.free} books`,
    pro: "Unlimited",
  },
  {
    group: "Selling it",
    label: "Sales report import & the curve",
    starter: NOT_INCLUDED,
    pro: "Included",
  },
];

export function Plans({
  /** Decides where the starter card's button goes — the shelf, or the way in. */
  signedIn,
  /**
   * Which gateway is behind the Upgrade button, or null if none is.
   *
   * It was a boolean while PayHere was the only one. The two buy in genuinely
   * different shapes — PayHere POSTs the browser to a payment page, Paddle
   * opens an overlay over this one — so the card needs to know which, and a
   * boolean would have meant guessing.
   */
  provider,
  /** Paddle's client-side token and environment, when Paddle is the gateway. */
  paddle,
  /** Already paying. The card stops selling and starts confirming. */
  pro: alreadyPro,
  /** Set when the gateway sent the writer back without taking anything. */
  cancelled = false,
}: {
  signedIn: boolean;
  provider: "paddle" | "payhere" | null;
  paddle?: { token: string; environment: "sandbox" | "production" };
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
            blurb="For everything it takes to write a book — on your own or with one other — and get it out."
            price="$0"
            rows={ROWS.map((r) => ({
              group: r.group,
              label: r.label,
              detail: r.detail,
              value: r.starter,
            }))}
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
            rows={ROWS.map((r) => ({
              group: r.group,
              label: r.label,
              detail: r.detail,
              value: r.pro,
            }))}
            action={
              alreadyPro ? (
                // Nothing to sell someone who has already bought it. A disabled
                // "current plan" chip would be a dead control on the one card
                // that most needs to say something useful.
                <Link href="/" className={PRO_BUTTON}>
                  You&rsquo;re on Pro — keep writing
                </Link>
              ) : provider === "paddle" && paddle ? (
                <PaddleUpgradeButton
                  period={period}
                  token={paddle.token}
                  environment={paddle.environment}
                  className={PRO_BUTTON}
                />
              ) : provider === "payhere" ? (
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
  const saving = annualSavingPercent();

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
        /* The saving rides *on the control that switches to it*, which is
           where every subscription page puts it and the only place it is an
           answer rather than a fact: the reader is deciding between two
           buttons and this is the difference between them. On the price
           beneath it, it would be arriving after the decision.

           The percentage is computed from the two prices (see
           `annualSavingPercent`) rather than written here — a badge is a claim
           about figures that live somewhere else, and the last hand-typed one
           in this codebase went stale the day a price moved. */
        const badge = option.value === "annual" && saving > 0;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={`flex cursor-pointer items-center gap-2 rounded-full py-2
                        font-sans text-sm font-medium outline-none
                        transition-colors focus-visible:ring-2
                        focus-visible:ring-accent/60 ${badge ? "pr-2 pl-5" : "px-5"} ${
                          on
                            ? "bg-fg text-surface"
                            : "text-muted hover:text-fg"
                        }`}
          >
            {option.label}
            {badge && (
              /* `ok`, the status family's green, because a saving is money
                 kept rather than a feature — the same ink the readiness
                 badges use for "nothing owed here". It keeps its own ground
                 on both sides of the toggle, so the figure stays legible when
                 the pill behind it inverts. */
              <span
                className="rounded-md border border-ok-line bg-ok-bg px-2 py-0.5
                           font-sans text-[0.6875rem] font-semibold text-ok-fg"
              >
                Save {saving}%
              </span>
            )}
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
const STARTER_HIGHLIGHT = new Set(["Exports", "Sync"]);

/**
 * Which fill a value wears.
 *
 * Gold outranks everything: it means *no ceiling*, and it may never be spent on
 * anything else. After that the card decides — Pro is purple throughout, and
 * Starter is blue except for the two rows above.
 */
function badgeTone(label: string, value: string, pro: boolean): Tone {
  if (value === "Unlimited") return "gold";
  if (pro) return "purple";
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
      className={`inline-flex items-center rounded-lg border px-2.5 py-1
                  font-sans text-[0.9375rem] leading-tight font-semibold
                  tracking-tight ${skin}`}
    >
      {value}
    </span>
  );
}

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
  rows: { group: Group; label: string; detail?: string; value: string }[];
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
      <dl className="mt-6 space-y-4">
        {GROUPS.map((group) => (
          <Fragment key={group}>
            {/* Small, uppercase and muted: it separates the blocks without
                competing with the labels under it, which are the thing being
                scanned. The hairline does the separating — the words only say
                which block this is.

                `first:mt-0` because the list already opens directly under the
                card's own rule, and a second gap there would leave the first
                block floating.

                `aria-hidden`, because a screen reader is walking a definition
                list term by term and a bare heading spliced between the pairs
                announces itself as another term. The labels underneath are
                self-describing; the heading is a scanning aid for the eye. */}
            <div
              className="mt-7 flex items-center gap-3 first:mt-0"
              aria-hidden="true"
            >
              <span className="font-sans text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                {group}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
            {rows
              .filter((row) => row.group === group)
              .map((row) => {
                // What the plan gives you is set in the card's own ink — mark,
                // label and value alike — and what it withholds is the only
                // thing faded.
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

                  Drawn at 24px and a heavier stroke than the card marks above
                  them, because these are read as a column at a glance rather
                  than looked at one at a time, and at 16px and hairline weight
                  the tick and the cross are the same grey smudge until you
                  lean in.

                  **Sized with the row rather than fixed.** They were 20px
                  against a 14px label; the values became 15px badges, and a mark
                  that stays put while everything beside it grows stops reading
                  as the anchor of its line and starts reading as a bullet
                  somebody forgot to scale. Now 24px against a 16px label. */}
              {has ? (
                <CheckIcon className="h-6 w-6 shrink-0 text-ok-fg" />
              ) : (
                <CrossIcon className="h-6 w-6 shrink-0 text-stop-fg" />
              )}
              {/* 16px and medium.

                  The label used to stay regular so the semibold badge had
                  something to win against — but the badges carry a *hue* now,
                  gold or blue, and hue outranks weight by a distance. So the
                  hierarchy survives the label getting heavier, and the row stops
                  reading as a caption with a button stuck on the end.

                  Medium rather than semibold, though: one step below the badge
                  keeps the order of the two, which is the part that matters. */}
              <dt className="font-sans text-base leading-snug font-medium">
                {row.label}
                {/* A size down, regular weight, muted — three steps back, so it
                    reads as an aside to the label rather than competing with it.
                    Inline rather than on its own line: a parenthesis opening at
                    the end of one line and closing on the next is a bracket the
                    eye has to hold open. */}
                {row.detail && (
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    ({row.detail})
                  </span>
                )}
              </dt>
              {/* ml-auto rather than a two-column grid: the value is set
                  against the right edge the way a price list is, and a long one
                  wraps under itself instead of squeezing the label.

                  "Included" and "Not included" are dropped rather than printed:
                  the mark in front has already said both, and a word repeating
                  a glyph is the kind of line a reader learns to skip — which
                  costs the rows that do carry a value. */}
                    {row.value !== "Included" && !has === false && (
                      <dd className="ml-auto shrink-0 pl-2 text-right">
                        <ValueBadge
                          value={row.value}
                          tone={badgeTone(row.label, row.value, Boolean(featured))}
                        />
                      </dd>
                    )}
                  </div>
                );
              })}
          </Fragment>
        ))}
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
