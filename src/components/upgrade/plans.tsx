"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { startCheckout, type CheckoutState } from "@/app/upgrade/actions";
import { ComingSoonDialog } from "@/components/shelf/coming-soon-dialog";
import {
  displayPrice,
  perMonthOf,
  priceOf,
  upgradeTo,
} from "@/lib/billing/plans";
import { PaddleUpgradeButton } from "@/components/upgrade/paddle-checkout";
import { ChangePlanButton } from "@/components/upgrade/change-plan-button";
import { PaddleInlineCheckout } from "@/components/upgrade/paddle-inline-checkout";
import { PlanTable } from "@/components/upgrade/plan-table";
import { BEST_FOR, highlightsFor } from "@/lib/billing/plan-highlights";
import { PeriodToggle } from "@/components/upgrade/period-toggle";
import {
  PLAN_BUTTON_PLAIN,
  planButton,
} from "@/components/upgrade/plan-button";
import { TIER_LIMITS, TIER_NAMES, type PaidTier } from "@/lib/billing/tiers";
import { PLANS_ON_SALE } from "@/lib/launch";
import { notePlanInterest } from "@/lib/plan-interest";
import { PlanCard, PricingDecor } from "@/components/upgrade/plan-card";
import { plural } from "@/lib/plural";

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
 * **Every line below is true of the code.** A limit promised on a pricing page
 * that no code enforces is the same failure as a feature claim the app cannot
 * back. The book limit is a Postgres trigger; the title check allowance is a
 * browser gate, which is normal for local-first software and not a secret —
 * but do not add a row here whose value depends on a browser gate being
 * unbreakable.
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
 * The one paid card.
 *
 * **Pro, since 2026-09-14.** There were three paid plans that differed only by
 * how many assistant credits a month they granted; with the AI gone they were
 * one product at three prices. The mark is the nib the featured plan wore.
 */
const PRO: PaidTier = "pro";

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
  /** What they are on now, or null for a writer with no subscription. */
  current,
  /** Set when the gateway sent the writer back without taking anything. */
  cancelled = false,
  /**
   * What this writer pressed before they were asked to sign in, off `?buy=`.
   *
   * Narrowed on the server (`app/upgrade/page.tsx`) so the cycle is right in
   * the first paint rather than corrected in the browser a frame later.
   */
  intent = null,
}: {
  signedIn: boolean;
  provider: "paddle" | "payhere" | null;
  paddle?: { token: string; environment: "sandbox" | "production" };
  current: {
    tier: PaidTier;
    period: Period;
    /** The row's own gateway. Paddle can swap a price; PayHere cannot. */
    provider: "paddle" | "payhere";
  } | null;
  cancelled?: boolean;
  intent?: { tier: PaidTier; period: Period } | null;
}) {
  /* **Monthly first, by the owner's choice (2026-09-24)**, the same default
     as the landing page's cards. It was annual, on the argument that the
     toggle's "Save" badge is about the year; the annual saving is still one
     press away.

     Unless they already chose. A writer who pressed Upgrade on the annual card
     and signed in is shown annual — being handed the monthly price after
     picking the other one reads as a switch somebody made on their behalf. */
  const [period, setPeriod] = useState<Period>(intent?.period ?? "monthly");

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

  /** Whether the "not on sale" dialog is open. */
  const [soon, setSoon] = useState(false);

  /**
   * Whether to open the checkout without waiting to be pressed.
   *
   * **This is the one place in the app where a money-moving surface opens from
   * an effect, and the house rule says it should not.** `LimitDialog` fires on
   * the press that is refused; `ExportDoneDialog` opens on the press that
   * finished the file; neither is allowed to appear on its own. The rule is
   * there because a form that arrives unasked is a form nobody consented to.
   *
   * What makes this different is that **the press already happened.** The
   * writer pressed Upgrade, was sent to sign in because they had no account,
   * and came back — one gesture with an interruption in the middle, not a fresh
   * arrival. `?buy=` is that press, carried. Refusing to act on it would mean
   * asking somebody to press the same button twice and calling it consent.
   *
   * The exception is kept narrow so it cannot spread:
   *
   * - only when `intent` names the paid tier this card sells, so a stray
   *   `?buy=` for anything else does nothing;
   * - only while signed in, since the whole point is the return trip;
   * - never over an existing paid subscription — `current` means the card says
   *   "Your plan", and charging that writer again is the thing
   *   `/api/billing/paddle/checkout` refuses with a 409 anyway;
   * - never while `PLANS_ON_SALE` is false, which is the gate over every other
   *   money-moving arm in this ladder;
   * - and the button strips `?buy=` as it fires, so a reload cannot repeat it.
   */
  const autoStart =
    PLANS_ON_SALE && signedIn && !current && intent?.tier === PRO;

  const [state, checkout, pending] = useActionState<CheckoutState, FormData>(
    startCheckout,
    {},
  );

  // Both cycles show a per-month rate, because a reader compares plans by the
  // month whatever they are billed on. The annual one names the real total.
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
      {/* **Wider than the words it opens with, because four cards live in it.**

          This was `max-w-4xl` — 896px, which is the right measure for a
          headline and a lead, and 224px a card once four of them are sharing
          it. Every badge on every row ran off its card at that width. The
          block keeps its measure by putting it back on the headline itself;
          the grid below gets the room. */}
      <div className="mx-auto max-w-[96rem] px-4 pt-6 pb-14 text-center sm:pt-8">
        <p
          className="inline-block rounded-full border border-line bg-panel px-4
                     py-1.5 font-sans text-xs font-medium text-muted"
        >
          Pricing
        </p>

        <h1 className="mx-auto mt-4 max-w-3xl font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
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
          Every format is free, on every plan — take your book and go whenever
          you like. {TIER_NAMES.pro} is for more than{" "}
          {plural(TIER_LIMITS.free.books ?? 0, "book")}, every consistency check,
          your whole writing record and paperback setup. No AI on either plan:
          every word is yours.
        </p>

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

        {/* **The section the reference draws**: its own pale ground, the
            switch over the paid column, and the two cards. Its palette and
            face are `price-*` and `font-pricing` — see `plan-card.tsx`. */}
        <div className="relative mx-auto mt-8 max-w-[52rem] overflow-hidden rounded-3xl bg-price-ground px-4 pt-7 pb-10 text-left sm:px-10">
          <PricingDecor />

          <div className="relative mx-auto flex max-w-[45rem] justify-center sm:justify-end sm:pr-8">
            <PeriodToggle period={period} onChange={setPeriod} />
          </div>

        <div className="relative mx-auto mt-5 grid max-w-[45rem] gap-5 sm:grid-cols-2 sm:items-stretch">
          <PlanCard
            name={TIER_NAMES.free}
            subtitle={BEST_FOR.free}
            price="$0"
            per="/month"
            note="No card needed"
            highlights={highlightsFor("free")}
            action={
              // Not a disabled "current plan" chip: a writer who is already in
              // has somewhere to be, and one who is not has an account to make.
              // Both are real destinations, which is more use than a label.
              <Link
                href={signedIn ? "/" : "/signup"}
                className={PLAN_BUTTON_PLAIN}
              >
                {signedIn ? "Keep writing" : "Start writing"}
              </Link>
            }
          />

          <PlanCard
              tone="featured"
              badge="Recommended"
              name={TIER_NAMES[PRO]}
              subtitle={BEST_FOR[PRO]}
              /* The real monthly price, struck only over the real per-month
                 annual figure. On the monthly cycle there is nothing to strike. */
              was={
                period === "annual"
                  ? displayPrice(priceOf(PRO, "monthly"))
                  : undefined
              }
              price={displayPrice(perMonthOf(PRO, period))}
              per="/month"
              note={
                period === "annual"
                  ? `${displayPrice(priceOf(PRO, "annual"))} billed annually`
                  : "Billed monthly"
              }
              highlights={highlightsFor(PRO)}
              action={
                /* **Nothing is for sale, so nothing takes money.**

                   One branch above the whole ladder rather than a condition
                   inside each of its money-moving arms, so switching
                   selling back on is deleting this and nothing else. The
                   ladder below is untouched and still correct — it is simply
                   not reached while `PLANS_ON_SALE` is false. */
                !PLANS_ON_SALE ? (
                  <button
                    type="button"
                    onClick={() => {
                      notePlanInterest(PRO, period, "upgrade");
                      setSoon(true);
                    }}
                    className={`w-full cursor-pointer ${planButton(true)}`}
                  >
                    Get {TIER_NAMES[PRO]}
                  </button>
                ) : /* **The card answers for the writer looking at it.** On Pro
                   already, it confirms and points at `/billing`, or offers the
                   other cycle. With nothing held, the checkout. */
                current ? (
                  /* **The plan they are on says so, whichever cycle is showing.**

                     This compared the cycle too, so a subscriber on monthly
                     who flicked the toggle to annual saw "Switch to Pro" on
                     their own plan — which reads as though they are not on it.
                     The tier is the plan; the cycle is how it is paid for, and
                     conflating the two put the wrong words on the one card a
                     subscriber looks at first. */
                  current.period === period ? (
                    <Link href="/billing" className={planButton(true)}>
                      Your plan
                    </Link>
                  ) : current.provider === "paddle" ? (
                    /* Same plan, other cycle. A real change, and named as the
                       cycle change it is rather than as a plan change. */
                    <ChangePlanButton
                      tier={PRO}
                      period={period}
                      label={`Switch to ${period === "annual" ? "annual" : "monthly"}`}
                      className={planButton(true)}
                    />
                  ) : (
                    /* PayHere has no call that swaps a cycle, so the card points
                       at the one place the writer can act. */
                    <Link href="/billing" className={planButton(true)}>
                      Your plan
                    </Link>
                  )
                ) : !signedIn ? (
                  /* **A signed-out press goes to the door, not to a 401.**
                     `/api/billing/paddle/checkout` answers "Sign in to
                     subscribe", and that used to arrive as red text under the
                     button — the writer said they wanted to pay and was told
                     no, with no way on. The press is carried instead: the tier
                     and cycle travel in `next`, and `?buy=` opens the checkout
                     on the other side.

                     Sign-in rather than sign-up, the opposite of the landing
                     page's button: somebody already this far into the app
                     usually has an account, and the form offers the other with
                     `next` intact either way. */
                  <Link
                    href={`/signin?next=${encodeURIComponent(upgradeTo(PRO, period))}`}
                    className={planButton(true)}
                  >
                    Get {TIER_NAMES[PRO]}
                  </Link>
                ) : provider === "paddle" && paddle ? (
                  <PaddleUpgradeButton
                    tier={PRO}
                    period={period}
                    onTransaction={setCheckoutTransaction}
                    className={planButton(true)}
                    autoStart={autoStart}
                  />
                ) : provider === "payhere" ? (
                  <form action={checkout}>
                    {/* Both read from the controls at submit time rather than
                        from a second piece of state on the server. */}
                    <input type="hidden" name="tier" value={PRO} />
                    <input type="hidden" name="period" value={period} />
                    <button
                      type="submit"
                      disabled={pending}
                      className={`w-full cursor-pointer disabled:cursor-default
                                  disabled:opacity-70 ${planButton(true)}`}
                    >
                      {pending ? "Starting checkout…" : `Get ${TIER_NAMES[PRO]}`}
                    </button>
                    {state.error && (
                      // On the card's own ink, not text-red: the featured
                      // ground is the indigo `price-brand`, and a red that
                      // reads on paper disappears on it.
                      <p
                        role="alert"
                        className="mt-3 font-sans text-xs leading-relaxed text-white/75"
                      >
                        {state.error}
                      </p>
                    )}
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSoon(true)}
                    className={`w-full cursor-pointer ${planButton(true)}`}
                  >
                    Get {TIER_NAMES[PRO]}
                  </button>
                )
              }
            />
        </div>
        </div>

        {/* **Every claim, in full, under the cards that summarise them.**
            The cards are the pitch and this is the contract — skim across the
            top, read down when you are deciding. `spotlight` tints the column
            the featured card names, so the two say the same thing about which
            plan is being recommended. */}
        <PlanTable spotlight="pro" />

        <p className="mx-auto mt-10 max-w-xl font-sans text-sm leading-relaxed text-muted">
          Your manuscripts are yours on every plan. They are written to this
          browser first and synced to your account, so nothing here decides
          whether you can open your own book.
        </p>
      </div>

      {soon && (
        <ComingSoonDialog
          title={PLANS_ON_SALE ? "Plans" : TIER_NAMES[PRO]}
          onClose={() => setSoon(false)}
        >
          {PLANS_ON_SALE ? (
            <>
              There is no payment gateway configured on this copy of
              OpenChapter, so there is nothing to buy and nothing is held back.
              Once billing is configured, {TIER_NAMES[PRO]} unlocks unlimited
              books, title checks and parked ideas, and paperback setup. Every
              export format is free either way.
            </>
          ) : (
            /* **It says the press was noted, because it was.** A button that
               quietly reports to us is the thing the house rules are against,
               and the feedback dialog already sets the precedent of listing
               what is sent above the control that sends it. Naming the plan
               back is also the honest version of "we heard you" — it shows
               exactly what we wrote down. */
            <>
              {TIER_NAMES[PRO]} is not on sale yet. We have noted that you
              wanted it — that is how we decide what to switch on first, and it
              is all we record about this press. Everything free stays free
              meanwhile: {plural(TIER_LIMITS.free.books ?? 0, "book")}, unlimited
              chapters and words, and every export format.
            </>
          )}
        </ComingSoonDialog>
      )}

    </main>
  );
}
