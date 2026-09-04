"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { startCheckout, type CheckoutState } from "@/app/upgrade/actions";
import { ComingSoonDialog } from "@/components/shelf/coming-soon-dialog";
import {
  displayPrice,
  perMonthOf,
  priceOf,
} from "@/lib/billing/plans";
import { PaddleUpgradeButton } from "@/components/upgrade/paddle-checkout";
import { ChangePlanButton } from "@/components/upgrade/change-plan-button";
import { PaddleInlineCheckout } from "@/components/upgrade/paddle-inline-checkout";
import { PlanTable } from "@/components/upgrade/plan-table";
import {
  BEST_FOR,
  PASS_BEST_FOR,
  PASS_HIGHLIGHTS,
  highlightsFor,
  replyCountsFor,
} from "@/lib/billing/plan-highlights";
import { STARTER_PASS, passReplyCounts } from "@/lib/billing/starter-pass";
import { PeriodToggle } from "@/components/upgrade/period-toggle";
import {
  PLAN_BUTTON_PLAIN,
  planButton,
} from "@/components/upgrade/plan-button";
import {
  TIER_NAMES,
  tierAtLeast,
  type PaidTier,
} from "@/lib/billing/tiers";
import {
  KeyIcon,
  NibIcon,
  PenIcon,
  PlanCard,
  ShelfIcon,
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


/**
 * The three paid cards, in the order they are read.
 *
 * Data rather than three hand-written blocks, because four columns of the same
 * shape written out four times is four places for one of them to drift — which
 * is the drift `plan-rows.ts` already exists to prevent one level down.
 *
 * **Writer is the featured one**, and the reason changed under it on
 * 2026-09-04. It used to be "where the assistant first appears" — true while
 * Draft had none, and false the moment every paid plan got credits. What is
 * still true is that it is the middle anchor: featuring the dearest card would
 * make the ask $29.98 of an audience that mostly has not decided whether it
 * wants an assistant at all, and featuring the cheapest gives the page nothing
 * to compare against.
 *
 * **The words are gone from this array**, which is the point of the 2026-09-04
 * rebuild: the positioning line comes from `BEST_FOR`, the contents from
 * `highlightsFor`, and every actual claim from `ROWS` through `PlanTable`
 * below. What is left here is the mark and which card is featured — the two
 * things that really are decisions about *this page*.
 *
 * **The four marks run page → pencil → nib → shelf**, which is the ladder the
 * plans themselves climb.
 */
const PAID_CARDS: {
  tier: PaidTier;
  mark: React.ReactNode;
  featured?: boolean;
}[] = [
  { tier: "draft", mark: <PenIcon /> },
  { tier: "writer", mark: <NibIcon />, featured: true },
  { tier: "studio", mark: <ShelfIcon /> },
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
  /** What they are on now, or null for a writer with no subscription. */
  current,
  /** Set when the gateway sent the writer back without taking anything. */
  cancelled = false,
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
}) {
  /* **Annual, not monthly.** The toggle's own badge says a year saves 25%, and
     opening on the cycle that badge is about means the first figure a reader
     sees is the one being recommended. Switching to monthly is one press. */
  const [period, setPeriod] = useState<Period>("annual");

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
  /* Its own flag rather than sharing `soon`: "no gateway is configured here"
     and "the pass has no checkout yet" are different facts, and one dialog
     answering both would be wrong for whichever reader it was not written
     for. */
  const [passSoon, setPassSoon] = useState(false);

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
          you like. {TIER_NAMES.draft} is for more than five books; every paid
          plan adds the writing assistant, and what differs is how many credits
          a month you get to spend on it.
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

        {/* **Four cards, one array, one component.**

            `xl:grid-cols-4` rather than four across from `sm`: four columns at
            768px is 190px each and every row in them wraps. The 2×2 in between
            falls as (Free, Draft) and (Writer, Studio) — the half without the
            assistant and the half with it — which is the right seam for the
            pair to break on.

            items-start so the featured card grows upward on its own rather
            than stretching its neighbours to match. */}
        {/* **`items-stretch`, which the old grid did not do.** The four cards
            carry lists of different lengths and their buttons are the row a
            reader compares last; equal heights plus `mt-auto` on the action is
            what puts those four on one line. Ragged card feet under a tidy row
            of prices reads as a layout that gave up halfway.

            `xl:grid-cols-4` rather than four across from `sm`: four columns at
            768px is 190px each and every figure in them wraps. The 2×2 in
            between falls as (Free, Draft) and (Writer, Studio). */}
        <div className="mt-10 grid gap-3.5 sm:grid-cols-2 sm:items-stretch xl:grid-cols-5">
          <PlanCard
            mark={<StackIcon />}
            name={TIER_NAMES.free}
            bestFor={BEST_FOR.free}
            price="$0"
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

          {/* **Second, between Free and Draft, because that is what it is
              for.** The pass is the step a reader takes when Free has shown
              them the tool and $7.98 a month is still a bigger decision than
              they are ready to make. Putting it at the end of the row — with
              the plans — would file it as the cheapest subscription, which is
              the one thing it is not. */}
          <PlanCard
            tone="pass"
            badge="New writers only"
            mark={<KeyIcon />}
            name="Starter Pass"
            bestFor={PASS_BEST_FOR}
            price={displayPrice(STARTER_PASS.price)}
            note="Charged once, never renews"
            highlights={PASS_HIGHLIGHTS}
            replies={passReplyCounts()}
            action={
              /* **Honest about not being on sale yet.** The card draws because
                 the pass is a decided product with settled numbers; the button
                 says what is actually true, which is that there is no checkout
                 behind it until a one-time price exists in Paddle and a webhook
                 credits the ledger. A button that opened nothing would be the
                 dead UI the house rules forbid, and a card quietly missing from
                 the row would lose the argument the row is making.

                 **The one-time checkout goes here** when `passOnSale()` starts
                 answering true — one branch beside this one, the same shape as
                 the plan buttons below. */
              <button
                type="button"
                onClick={() => setPassSoon(true)}
                className={`w-full cursor-pointer ${PLAN_BUTTON_PLAIN}`}
              >
                Get the Starter Pass
              </button>
            }
          />

          {PAID_CARDS.map(({ tier, mark, featured }) => (
            <PlanCard
              key={tier}
              tone={featured ? "featured" : "plain"}
              badge={featured ? "Most chosen" : undefined}
              mark={mark}
              name={TIER_NAMES[tier]}
              bestFor={BEST_FOR[tier]}
              price={displayPrice(perMonthOf(tier, period))}
              note={
                period === "annual"
                  ? `${displayPrice(priceOf(tier, "annual"))} billed annually`
                  : "Billed monthly"
              }
              highlights={highlightsFor(tier)}
              replies={replyCountsFor(tier)}
              action={
                /* **Every card answers for itself now.**

                   It used to be one boolean: already paying meant "Keep
                   writing" on all three, so a Draft customer looking at Studio
                   was told there was nothing to do — the dearest plan reading
                   as unavailable to the person most likely to buy it.

                   Four answers instead. On the plan already held, the card
                   confirms and points at `/billing`. Above or below it, a
                   change. With nothing held, the checkout that was always
                   there. And on a PayHere subscription, a sentence rather than
                   a button, because that gateway has no call that swaps a plan
                   and a control that always fails is worse than none. */
                current && current.tier === tier ? (
                  /* **The plan they are on says so, whichever cycle is showing.**

                     This compared the cycle too, so a Writer on monthly who
                     flicked the toggle to annual saw "Switch to Writer" on
                     their own plan — which reads as though they are not on it.
                     The tier is the plan; the cycle is how it is paid for, and
                     conflating the two put the wrong words on the one card a
                     subscriber looks at first. */
                  current.period === period ? (
                    <Link href="/billing" className={planButton(featured)}>
                      Your plan
                    </Link>
                  ) : current.provider === "paddle" ? (
                    /* Same plan, other cycle. A real change, and named as the
                       cycle change it is rather than as a plan change. */
                    <ChangePlanButton
                      tier={tier}
                      period={period}
                      label={`Switch to ${period === "annual" ? "annual" : "monthly"}`}
                      className={planButton(featured)}
                    />
                  ) : (
                    <Link href="/billing" className={planButton(featured)}>
                      Your plan
                    </Link>
                  )
                ) : current && current.provider === "paddle" ? (
                  <ChangePlanButton
                    tier={tier}
                    period={period}
                    label={`${
                      tierAtLeast(tier, current.tier) ? "Upgrade to" : "Switch to"
                    } ${TIER_NAMES[tier]}`}
                    className={planButton(featured)}
                  />
                ) : current ? (
                  /* PayHere. Honest about what it cannot do, and pointed at the
                     one place the writer can act. */
                  <p
                    className={`font-sans text-xs leading-relaxed ${
                      featured ? "text-surface/75" : "text-muted"
                    }`}
                  >
                    To move to {TIER_NAMES[tier]}, cancel your current plan from{" "}
                    <Link href="/billing" className="underline">
                      billing
                    </Link>{" "}
                    first — it runs to the end of the period you have paid for.
                  </p>
                ) : provider === "paddle" && paddle ? (
                  <PaddleUpgradeButton
                    tier={tier}
                    period={period}
                    onTransaction={setCheckoutTransaction}
                    className={planButton(featured)}
                  />
                ) : provider === "payhere" ? (
                  <form action={checkout}>
                    {/* Both read from the controls at submit time rather than
                        from a second piece of state on the server. */}
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="period" value={period} />
                    <button
                      type="submit"
                      disabled={pending}
                      className={`w-full cursor-pointer disabled:cursor-default
                                  disabled:opacity-70 ${planButton(featured)}`}
                    >
                      {pending ? "Starting checkout…" : `Get ${TIER_NAMES[tier]}`}
                    </button>
                    {state.error && (
                      // On the card's own ink, not text-red: the featured
                      // ground is bg-fg, and a red that reads on paper
                      // disappears on it.
                      <p
                        role="alert"
                        className={`mt-3 font-sans text-xs leading-relaxed ${
                          featured ? "text-surface/75" : "text-muted"
                        }`}
                      >
                        {state.error}
                      </p>
                    )}
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSoon(true)}
                    className={`w-full cursor-pointer ${planButton(featured)}`}
                  >
                    Get {TIER_NAMES[tier]}
                  </button>
                )
              }
            />
          ))}
        </div>

        {/* **Every claim, in full, under the four cards that summarise them.**
            The cards are the pitch and this is the contract — skim across the
            top, read down when you are deciding. `spotlight` tints the column
            the featured card names, so the two say the same thing about which
            plan is being recommended. */}
        <PlanTable spotlight="writer" />

        <p className="mx-auto mt-10 max-w-xl font-sans text-sm leading-relaxed text-muted">
          Your manuscripts are yours on every plan. They are written to this
          browser first and synced to your account, so nothing here decides
          whether you can open your own book.
        </p>
      </div>

      {soon && (
        <ComingSoonDialog title="Plans" onClose={() => setSoon(false)}>
          There is no payment gateway configured on this copy of OpenChapter, so
          there is nothing to buy and nothing is held back — the assistant is
          unmetered here. Once billing is configured, {TIER_NAMES.draft} unlocks
          unlimited books and the assistant runs on a monthly credit balance.
          Every export format is free either way.
        </ComingSoonDialog>
      )}

      {passSoon && (
        <ComingSoonDialog
          title="Starter Pass"
          onClose={() => setPassSoon(false)}
        >
          The pass is not on sale yet — it needs a one-time price set up with
          the payment gateway before it can be bought, and we would rather show
          you what it will be than quietly leave it off the page.{" "}
          {STARTER_PASS.credits.toLocaleString("en-US")} credits for{" "}
          {displayPrice(STARTER_PASS.price)}, charged once, good for{" "}
          {STARTER_PASS.days} days, one per writer. In the meantime{" "}
          {TIER_NAMES.draft} is the cheapest way to the assistant.
        </ComingSoonDialog>
      )}
    </main>
  );
}
