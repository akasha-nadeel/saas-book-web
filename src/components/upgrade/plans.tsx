"use client";

import { useActionState, useState } from "react";
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
import { PaddleInlineCheckout } from "@/components/upgrade/paddle-inline-checkout";
import { ROWS } from "@/lib/billing/plan-rows";
import {
  PenIcon,
  PlanCard,
  StackIcon,
} from "@/components/upgrade/plan-card";

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
 * which. The three metered ones — assistant, ranked comps, audio import — are
 * checked server-side by `requirePro()`, which is the only check a
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
 * - **Writing a book and getting it out is free, whole**, and as of 2026-08-27
 *   that is true again rather than aspirational — the launch MVP sold EPUB and
 *   PDF as Pro for a while and it has been undone. All three exports, the
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

  /*
   * The transaction being paid for, once there is one.
   *
   * Held here rather than in the button because it decides what the *page* is:
   * plans, or a checkout. Paddle's overlay used to make that decision for us by
   * floating over whatever happened to be underneath, which is how the pricing
   * cards ended up dimmed behind a form they had nothing to do with.
   */
  const [checkoutTransaction, setCheckoutTransaction] = useState<string | null>(
    null,
  );

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

  if (checkoutTransaction && paddle) {
    return (
      <main className="scroll-slim h-[var(--oc-layout-height)] overflow-y-auto bg-surface pb-(--oc-safe-bottom)">
        <PaddleInlineCheckout
          transactionId={checkoutTransaction}
          token={paddle.token}
          environment={paddle.environment}
          onBack={() => setCheckoutTransaction(null)}
        />
      </main>
    );
  }

  return (
    // <body> is overflow-hidden for the editor shell, so this page owns its own
    // scrolling. min-h-dvh would put the last card out of reach.
    <main className="scroll-slim h-[var(--oc-layout-height)] overflow-y-auto bg-surface pb-(--oc-safe-bottom)">
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

      {/* **Tightened, 2026-09-03.** The chip, headline, lead and toggle took
          a full screen before a card was visible, so a reader had to scroll
          to reach the thing they came for. The rows are unchanged; only the
          air around them is. The prices stay large — that is the one figure
          on this page anybody is looking for. */}
      <div className="mx-auto max-w-4xl px-5 pt-6 pb-14 text-center sm:pt-8">
        <p
          className="inline-block rounded-full border border-line bg-panel px-4
                     py-1.5 font-sans text-xs font-medium text-muted"
        >
          Pricing
        </p>

        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          Simple pricing for writing your book
        </h1>
        {/* Not `text-muted`: this is the sentence the headline is asking to be
            read, so it takes the page's own ink held slightly back rather than
            the grey used for metadata. Wider measure too — at this size the old
            max-w-xl broke it after three words. */}
        <p
          className="mx-auto mt-3 max-w-2xl font-sans text-base leading-relaxed
                     font-medium text-fg/80"
        >
          Every format is free, on both plans — take your book and go whenever
          you like. Pro is for when you need more books than five, or more of
          the assistant.
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
        <div className="mt-8 grid gap-5 text-left sm:grid-cols-2 sm:items-start">
          <PlanCard
            mark={<PenIcon className="h-6 w-6" />}
            name="Free"
            blurb="For writing a book and getting it out — every export format, and a small assistant allowance."
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
            badge="Best for serious writers"
            mark={<StackIcon className="h-6 w-6" />}
            name="Pro"
            blurb="For a shelf that keeps growing, and the assistant to hand."
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
                  onTransaction={setCheckoutTransaction}
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
          there is nothing to buy and nothing is held back. Once billing is
          configured, Pro unlocks unlimited books, more assistant replies, and
          letting the assistant write into a chapter. Every export format is
          free either way.
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
