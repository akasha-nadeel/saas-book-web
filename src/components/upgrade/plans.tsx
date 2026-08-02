"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { startCheckout, type CheckoutState } from "@/app/upgrade/actions";
import { ComingSoonDialog } from "@/components/shelf/coming-soon-dialog";
import { displayPrice, perMonthOf, priceOf } from "@/lib/billing/plans";

/**
 * The two plans, presented as a pricing section rather than a settings screen:
 * a chip, a headline, a period switch, then the cards.
 *
 * Both cards run the same eight lines with a value against each, rather than
 * each listing only what it includes. It is the longer of the two shapes, and
 * it is the one that answers the question actually being asked: not "what does
 * Pro have" but "what do I lose by staying". A row missing from one side breaks
 * the line the eye reads across, so a row is never dropped — it is answered.
 *
 * The paid card is `bg-fg`/`text-surface`, not a fixed colour. Stated as the
 * two tokens it inverts with the palette rather than against it — which is what
 * keeps it a card standing off the page instead of a hole cut in one, and is
 * the whole of why the palette is written as jobs rather than as hues.
 *
 * Two of the lines below are still the plan the app intends rather than the app
 * as it stands: nothing counts a shelf to fifty or an eleventh import. The
 * other six are real — the assistant and the audiobook check the subscription
 * server-side, and the bookmark panel checks it in the browser. Where a row is
 * ahead of the code it is a promise, and TODO.md records which two.
 *
 * The figures are not written here. They come from lib/billing/plans.ts, which
 * is also what signs the amount into the PayHere checkout, so the number on the
 * card and the number on the card statement cannot drift apart.
 */

type Period = "monthly" | "annual";

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
 * The ring is offset onto the card's own ground rather than drawn against the
 * button: the pill is bg-surface, and a surface ring touching it would only
 * make it look bigger. Both colours are tokens, so it inverts with the card.
 */
const PRO_BUTTON = `block rounded-xl bg-surface px-5 py-3 text-center font-sans
  text-sm font-semibold text-fg outline-none transition-opacity
  hover:opacity-90 focus-visible:ring-2 focus-visible:ring-surface
  focus-visible:ring-offset-2 focus-visible:ring-offset-fg`;

/** The comparison, read across a line: label, what Starter gives, what Pro does. */
const ROWS: { label: string; starter: string; pro: string }[] = [
  { label: "Books", starter: "50", pro: "Unlimited" },
  { label: "Sync", starter: "Every device", pro: "Every device" },
  { label: "Exports", starter: "All four", pro: "All four" },
  { label: "Imports", starter: "10 files", pro: "Unlimited" },
  // Free on both because it costs nothing to run: dictation is the browser's
  // own SpeechRecognition, not the paid transcriber. The value says which
  // browsers rather than "Included" — it is a Chrome and Edge feature, the
  // button hides itself elsewhere, and a plan row is the wrong place to find
  // that out later.
  { label: "Voice typing", starter: "Chrome & Edge", pro: "Chrome & Edge" },
  { label: "Bookmarks", starter: NOT_INCLUDED, pro: "Included" },
  { label: "Assistant", starter: NOT_INCLUDED, pro: "Included" },
  { label: "Audiobook", starter: NOT_INCLUDED, pro: "Included" },
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

  const perMonth = displayPrice(perMonthOf(period));
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
            dark
            badge="Popular"
            mark={<StackIcon className="h-6 w-6" />}
            name="Pro"
            blurb="For the assistant, the bookmarks and the book read aloud."
            price={perMonth}
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
 * One plan.
 *
 * `dark` inverts the whole card rather than restyling its parts, which is why
 * every colour below is written as a pair. Once the ground flips, a hairline
 * that stayed `border-line` would vanish and muted text would go illegible, so
 * the secondary ink and the divider ride on the card's own ink at low alpha.
 */
function PlanCard({
  dark = false,
  badge,
  mark,
  name,
  blurb,
  price,
  note,
  rows,
  action,
}: {
  dark?: boolean;
  /** The flag on the card being pushed. Absent on the others. */
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
  const secondary = dark ? "text-surface/60" : "text-muted";
  const rule = dark ? "bg-surface/15" : "bg-line";

  return (
    <section
      className={`flex flex-col rounded-3xl p-7 sm:p-8 ${
        dark
          ? // Lifted a little at the top and given a deeper shadow: the pushed
            // card in the reference sits proud of the row. Only from sm up,
            // since stacked on a phone there is no row to sit proud of.
            "bg-fg text-surface shadow-xl sm:-mt-5"
          : "border border-line bg-panel text-fg shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={dark ? "text-surface" : "text-fg"}>{mark}</span>
        {badge && (
          <span
            className={`rounded-full px-3 py-1 font-sans text-xs font-medium ${
              dark ? "bg-surface/15 text-surface" : "bg-raised text-muted"
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">
        {name}
      </h2>
      <p className={`mt-1.5 font-sans text-sm leading-relaxed ${secondary}`}>
        {blurb}
      </p>

      {/* The number, at the size the reference sets it: big enough to be the
          thing you land on after the name, with the unit small beside it so the
          figure keeps the weight. */}
      <p className="mt-6 font-display text-5xl font-bold tracking-tight">
        {price}
        <span className={`ml-1.5 text-base font-medium ${secondary}`}>
          /month
        </span>
      </p>
      {/* Reserved whether or not it is filled, so the two cards' buttons stay on
          one line as the period switches. */}
      <p className={`mt-1.5 h-5 font-sans text-xs ${secondary}`}>{note}</p>

      <div className="mt-6">{action}</div>

      <div aria-hidden="true" className={`mt-8 h-px ${rule}`} />

      <h3 className="mt-6 font-sans text-sm font-semibold">Features</h3>
      <dl className="mt-4 space-y-3.5">
        {rows.map((row) => {
          // What the plan gives you is set in the card's own ink — mark, label
          // and value alike — and what it withholds is the only thing faded.
          // The greyed-back row was doing the opposite: on Starter, five of the
          // eight lines are the reason to stay, and they were the quietest
          // thing on the card.
          const has = row.value !== NOT_INCLUDED;

          return (
            <div
              key={row.label}
              className={`flex items-center gap-2.5 ${has ? "" : secondary}`}
            >
              {/* The same circle either way, so the column of marks stays a
                  column. Only what is inside it changes: a tick for a line the
                  plan gives you, a cross for one it does not — because a tick
                  against the words "Not included" is a yes drawn on top of a
                  no. */}
              {has ? (
                <CheckIcon className="h-4 w-4 shrink-0" />
              ) : (
                <CrossIcon className="h-4 w-4 shrink-0 opacity-70" />
              )}
              <dt className="font-sans text-sm">{row.label}</dt>
              {/* ml-auto rather than a two-column grid: the value is set
                  against the right edge the way a price list is, and a long one
                  wraps under itself instead of squeezing the label. */}
              <dd className="ml-auto text-right font-sans text-sm">
                {row.value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
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
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
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
    <Stroke className={className}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="m6.75 10.25 2.25 2.25 4.25-4.75" />
    </Stroke>
  );
}

/** The same circle, crossed. */
function CrossIcon({ className }: { className?: string }) {
  return (
    <Stroke className={className}>
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
