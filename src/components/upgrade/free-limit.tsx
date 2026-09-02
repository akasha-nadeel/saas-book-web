"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { displayPrice, priceOf } from "@/lib/billing/plans";
import {
  bookAllowance,
  dailyAllowance,
  itemAllowance,
  leftBadge,
  leftLine,
  reachedHeadline,
  resetsDaily,
  SEATS_PER_BOOK,
  spentLine,
  totalAllowance,
  type Allowance,
  type BookLimit,
  type DailyLimit,
  type ItemLimit,
  type Limited,
  type TotalLimit,
} from "@/lib/free-limits";
import { markToolBook, spendDailyUse } from "@/lib/library-store";
import { usePrefs } from "@/lib/use-library";
import { usePlan } from "@/lib/use-plan";

/**
 * What the counted screens share, so six of them cannot say six different
 * things about the same four limits.
 *
 * The import page, the shelf's import dialog, the two in-editor chapter panels,
 * the comps screen, the covers screen and the title check all put the same
 * question to the same two stores and draw the same answer. That is the shape
 * `ProGate` is in for the six Pro screens, and for the same reason: written
 * separately, the one that reads most like a paywall becomes what the product
 * feels like.
 *
 * Three states, three shapes, and the escalation is the design:
 *
 * 1. **Nothing at all** while there is plenty left. See `WARN_WHEN_LEFT`.
 * 2. **`LeftPill`** — a small count on the control itself, in the last three.
 * 3. **`LimitBanner`**, standing on the screen for as long as the plan has
 *    nothing left — it does not interrupt, so it does not have to wait for
 *    anything — and **`LimitDialog`** on the press that is *refused*, the
 *    eleventh rather than the tenth, because that one does interrupt. See
 *    `useLimitGate`.
 */

/**
 * What is being asked about.
 *
 * A discriminated union rather than a bare action, so the compiler refuses a
 * book limit with no book and an item limit with nothing counted. Six limits of
 * three shapes is exactly the situation where a loose string argument goes wrong
 * quietly — the version before this took a `bookId` and four screens were
 * passing the literal `"imports"`.
 */
/**
 * The lifetime-counted actions, as a set `spend` can test.
 *
 * A set rather than a string comparison because there is one of these today
 * and adding a second must not require anybody to notice this line: a new
 * member of `TotalLimit` that was left out here would silently be spent as a
 * *daily* count, which is the wrong counter and the wrong sentence.
 */
const TOTAL = new Set<Limited>(["keywordsAi", "blurbChat"]);

export type LimitAsk =
  | { action: DailyLimit }
  | { action: BookLimit; bookId: string }
  | { action: ItemLimit; items: number }
  /**
   * A lifetime total. `used` is read from prefs by the caller rather than
   * looked up here, which keeps this hook's dependency on the store to the one
   * `usePrefs` call it already makes — and lets a screen show the count
   * without asking twice.
   */
  | { action: TotalLimit; used: number };

/**
 * The plan and whichever counter this limit keeps, in a single answer.
 *
 * **A loading plan counts as entitled**, exactly as `ProGate` does: half a
 * second of a paywall shown to somebody who is paying is worse than half a
 * second of nothing, and here it would be a search button refusing to work on
 * arrival. The plan resolves in a moment and the notice arrives with it.
 */
export function useAllowance(ask: LimitAsk): Allowance {
  const plan = usePlan();
  const prefs = usePrefs();
  const pro = plan.loading || plan.pro;

  if ("bookId" in ask) {
    const books = prefs.usedOn[ask.action] ?? [];
    return bookAllowance(
      ask.action,
      books.length,
      books.includes(ask.bookId),
      pro,
    );
  }

  if ("items" in ask) return itemAllowance(ask.action, ask.items, pro);

  if ("used" in ask) return totalAllowance(ask.action, ask.used, pro);

  return dailyAllowance(ask.action, prefs.usedToday, pro);
}

/**
 * The plan, the tally, and what happens when there is nothing left.
 *
 * **Nothing is said until the writer tries.** The tenth search runs and looks
 * like the nine before it; the *eleventh press* is when the banner appears and
 * the dialog opens. That is a deliberate reversal of what this did first —
 * which was to go dark the instant the tenth completed, so a writer who had
 * finished anyway was handed a paywall for a thing they had not asked for.
 * Being told at the moment you are refused is information; being told at the
 * moment you stop needing it is an advertisement.
 *
 * It follows that **the controls stay live**. A disabled button cannot be
 * pressed an eleventh time, so there would be no moment to answer — and a
 * control that is merely dark explains nothing on its own anyway. The press is
 * refused, and the refusal is what speaks.
 *
 * **The refusal only ever lands on a book that is not already on the list.** A
 * book being worked on is never blocked, however many searches it takes, so the
 * writer who is refused is the one opening a *sixth* manuscript — never the one
 * in the middle of naming their fourth. That is the whole reason the limit
 * counts books rather than attempts.
 *
 * Two ways to ask, because the marking happens in two places:
 *
 * - **`spend()`** for the searches, which mark here.
 * - **`check()`** for the imports, which mark inside the store — at the funnel
 *   every import screen goes through, so marking here as well would be a second
 *   write for one file.
 *
 * Both answer `true` when the caller may go ahead, and `false` having already
 * put the refusal on screen.
 */
export function useLimitGate(ask: LimitAsk): {
  allowance: Allowance;
  /** True once a press has been refused. Drives the banner, which stays. */
  refused: boolean;
  /**
   * Whether the dialog is up.
   *
   * **Separate from `refused`, and that separation is the bug this had.** The
   * two were one flag — `refused || dialog` — so closing the dialog left
   * `refused` true, the condition rendering it stayed true, and the dialog
   * came straight back. Pressing Not now did fire; there was simply nothing it
   * could turn off. They are two states because they have two lifetimes: the
   * banner belongs to the limit and stays while it does, the dialog belongs to
   * the interruption and goes when it is dismissed.
   */
  dialogOpen: boolean;
  /** Ask, and record the use if there is one to record. */
  spend: () => boolean;
  /** Close the dialog. The banner stays: the limit has not moved. */
  closeDialog: () => void;
} {
  const allowance = useAllowance(ask);
  const [refused, setRefused] = useState(false);
  const [dialog, setDialog] = useState(false);

  // The ask is an object literal at every call site, so a new one arrives every
  // render; the fields are what `spend` actually depends on.
  const action = ask.action;
  const bookId = "bookId" in ask ? ask.bookId : null;

  const spend = useCallback(() => {
    if (allowance.blocked) {
      setRefused(true);
      setDialog(true);
      return false;
    }

    // Daily counts are spent here; a book is marked here, idempotently, so a
    // screen may call this on every action without working out whether this
    // press is the first. An item limit records nothing at all — the caller's
    // own append *is* the item, and counting it here as well would double it.
    //
    // **A total records nothing here either, and for a different reason.** It
    // is the only limit in front of a request that can fail: a gateway 502 or
    // a model timeout would cost a writer one of five allowances they never
    // received the benefit of, and five is few enough that one is worth
    // caring about. So the screen calls `spendTotalUse` when the reply
    // actually lands. The cost of that choice is a writer who presses twice
    // very quickly getting two calls for one allowance, which is a second of
    // exposure against a permanent unfairness.
    if (bookId !== null) markToolBook(action as BookLimit, bookId);
    else if (action !== "arcReaders" && !TOTAL.has(action)) {
      spendDailyUse(action as DailyLimit);
    }

    return true;
  }, [allowance.blocked, action, bookId]);

  return {
    allowance,
    refused,
    dialogOpen: dialog,
    spend,
    closeDialog: () => setDialog(false),
  };
}

/**
 * How many are left, as a pill on the control that spends them.
 *
 * **A chip beside the button, not a sentence under it.** That is how the rest
 * of the trade shows a remaining allowance — a small count attached to the
 * thing it is counting, which is read in the same glance as the button and
 * takes no line of its own. It was a sentence for a while and a sentence is
 * prose: it reads as something to *understand* rather than as a number to
 * notice, and it sat in the same grey as the footnotes around it.
 *
 * **It is silent on a fresh account**, which is the whole design. "0 of 10
 * used" in front of somebody who has not used anything teaches them that this
 * is a metered product before they have had a thing out of it, and it is the
 * line every reader of a freemium page has been burned by. `leftBadge` keeps
 * quiet until the last three, and null on Pro and on a self-hosted copy
 * because there is no limit to report. The four numbers live on the pricing
 * page and in the Help dialog, where somebody deciding what to pay for goes
 * looking.
 *
 * **The eye gets two words and a screen reader gets the sentence.** "3 checks
 * left" is unambiguous beside the Check it button and meaningless read out on
 * its own, so `aria-label` carries the full line — the badge may be terse
 * because the label is not.
 *
 * A link rather than a label, because the one thing somebody who has just
 * noticed it might want to do is see what lifts it.
 */
export function LeftPill({
  allowance,
  className = "",
}: {
  allowance: Allowance;
  className?: string;
}) {
  const badge = leftBadge(allowance);
  const full = leftLine(allowance);
  if (!badge || !full) return null;

  return (
    <Link
      href="/upgrade"
      aria-label={`${full} Pro has no limit.`}
      title={`${full} Pro has no limit.`}
      className={`inline-flex shrink-0 items-center gap-1.5 self-center rounded-full
                  border border-line bg-raised px-2.5 py-1 font-sans text-xs
                  font-medium text-muted outline-none transition-colors
                  hover:border-accent/40 hover:text-fg focus-visible:ring-2
                  focus-visible:ring-accent/50 ${className}`}
    >
      {/* A ring drawn as a meter: the arc is what is left of the ten. Two
          pixels of drawing, and it is what makes the number read as a
          remaining amount rather than as a count of something done. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0 -rotate-90"
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.25"
        />
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${
            (2 * Math.PI * 6 * (allowance.left ?? 0)) / (allowance.limit ?? 1)
          } 100`}
        />
      </svg>
      {badge}
    </Link>
  );
}

/**
 * The banner that stands where the control was, once the ten are gone.
 *
 * **It was a grey pill, then a tinted card, and it is a filled one now.** The
 * pill was set in muted ink at footnote size, so the one sentence explaining
 * why the button beside it had gone dark *read* as a footnote. The tint was
 * legible but sat at the same volume as the panel it was on, on a screen made
 * of panels. This is the shape the trade actually uses for the state where the
 * free plan stops: a filled block, white type, and one white button.
 *
 * **The gradient is the one in the chrome**, and its two stops are tokens
 * (`upgrade-from`/`-to`, purple into indigo) declared in both themes. They keep their hue at night, where `--color-accent` goes white, for
 * the reason the landing page's `lp-accent` does: this is a *fill*, and
 * following the chrome would put a white slab across a black screen.
 *
 * What it still does not do is shout. No red, no exclamation, no countdown:
 * running out of ten free searches is not an error and the writer has done
 * nothing wrong. It says the two things a paywall usually leaves out — that
 * everything already found is untouched, and that the rest of the screen still
 * works — because the fear at this moment is that something has been taken
 * away.
 */
/**
 * What Pro does to *this* limit, which is not the same for all of them.
 *
 * **"Pro lifts every one of them" is false of seats**, and this app does not get to
 * say a false thing on a paid-plan prompt. Pro takes the ceiling off the four
 * counted actions; it *raises* a book's seats from two to ten. Stating the number
 * is also the more persuasive line, and it is read from `SEATS_PER_BOOK` rather
 * than written out, so the sentence cannot drift from the price table.
 */
function proLine(allowance: Allowance): string {
  if (allowance.action === "collaborators") {
    return `Pro takes a book from ${SEATS_PER_BOOK.free} people to ${SEATS_PER_BOOK.pro}. Nobody already on this book is affected, and the rest of this screen still works.`;
  }
  return "Pro lifts every one of them. Everything you have already found stays where it is, and the rest of this screen still works.";
}

export function LimitBanner({
  allowance,
  refused,
  className = "",
}: {
  allowance: Allowance;
  /**
   * Whether a press has actually been turned away — `useLimitGate`'s own flag.
   *
   * **Required, not optional with a default.** Getting this wrong is invisible
   * on the screen that forgets it, so the compiler is the thing that has to
   * notice. Nine call sites pass `gate.refused`.
   */
  refused: boolean;
  className?: string;
}) {
  const line = spentLine(allowance);
  if (!allowance.blocked || !line) return null;

  /* ---- When this may appear, and it is not the same for every limit -------

     **A daily allowance waits for a refused press; every other shape stands.**

     The rule used to be "shown for as long as the limit lasts, not just after
     a refusal", on the reasoning that the *dialog* interrupts and so has to be
     earned while this does not — and that a writer coming back should be told
     where they are rather than press a dead button to find out. That argument
     survives intact for the shapes that do not reset. A book at 2 of 2 seats,
     or five of five keyword suggestions spent for good, is a standing fact
     about the account, and saying so before it is bumped into is help.

     It is wrong for a daily one. Three checks a day means the *third* press
     spends the last, so the banner landed on the search a writer was entitled
     to — a purple upgrade block over a result they had just paid for, telling
     them they had run out at the moment they had not been refused anything.
     Nothing has been denied until a fourth press, and that is when this
     speaks. The cost is that a reload while blocked shows nothing until the
     next press; a daily limit is gone by tomorrow, so that is a smaller
     unfairness than the one it replaces.

     `LimitDialog` is unchanged — it has always fired on the refused press, and
     this brings the banner into line with it rather than the other way. */
  if (resetsDaily(allowance.action) && !refused) return null;

  return (
    <section
      role="status"
      className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-4
                  rounded-xl bg-linear-to-r from-upgrade-from to-upgrade-to
                  px-7 py-6 ${className}`}
    >
      <div className="min-w-[16rem]">
        <p className="font-sans text-base font-bold text-white">{line}</p>
        <p className="mt-1.5 font-sans text-sm leading-relaxed text-white/85">
          {proLine(allowance)}
        </p>
      </div>

      {/* **Literal white, not a token, and that is the exception justified.**
          Every other fill in the app inverts with the theme, which is why
          `accent-ink` exists — it is black by night and white by day. This
          fill does *not* move: the two gradient stops are stated identically
          in both blocks. Ink that followed the theme would therefore change
          on a ground that did not, which is the one way to get this wrong. */}
      <Link
        href="/upgrade"
        className="shrink-0 rounded-lg bg-white px-5 py-2.5 font-sans text-sm
                   font-semibold text-upgrade-ink outline-none transition-opacity
                   hover:opacity-90 focus-visible:ring-2
                   focus-visible:ring-white/70"
      >
        See what Pro adds
      </Link>
    </section>
  );
}

/**
 * The banner folded into a column, for the two rails that import into a book.
 *
 * The same fill and the same words — it is the *width* that differs, not the
 * message. A book panel is about three hundred pixels across, and the banner's
 * row of two lines and a button would either overflow it or wrap into
 * something that looks broken. So it stacks, and the button goes full width
 * under the sentence rather than beside it.
 */
export function LimitNote({
  allowance,
  className = "",
}: {
  allowance: Allowance;
  className?: string;
}) {
  const line = spentLine(allowance);
  // Standing state, like `LimitBanner` — see the note there.
  if (!allowance.blocked || !line) return null;

  return (
    <section
      role="status"
      className={`rounded-lg bg-linear-to-r from-upgrade-from to-upgrade-to
                  px-3.5 py-3 ${className}`}
    >
      <p className="font-sans text-xs font-semibold text-white">{line}</p>
      <Link
        href="/upgrade"
        className="mt-2.5 block rounded-md bg-white px-3 py-1.5 text-center
                   font-sans text-xs font-semibold text-upgrade-ink outline-none
                   transition-opacity hover:opacity-90 focus-visible:ring-2
                   focus-visible:ring-white/70"
      >
        See what Pro adds
      </Link>
    </section>
  );
}

/**
 * What Pro lifts, in the order somebody standing at this wall cares about.
 *
 * Four lines and no more. A pricing table pasted into a dialog is a decision
 * nobody makes at the moment they were interrupted — what is wanted here is
 * enough to answer "is this worth eleven dollars to me", and the page that
 * answers the rest is one press away.
 */
const WHAT_PRO_ADDS = [
  "Comp searches, cover searches and title checks with no daily limit",
  "The blurb, prose report and money tracking on every book",
  "Advance reader lists with no ceiling",
  "The assistant, ranked comps and the audio routes",
];

/**
 * The line for the wall this writer actually hit, put first.
 *
 * Four lines is the rule, so a fifth cannot simply be added for each new limit —
 * and it should not be, because the one that answers the question is the one
 * about the thing that just stopped them. So the reached limit leads and the
 * rest follow, deduplicated: for most of these it is a line already in the list,
 * which is why it is filtered rather than prepended blindly.
 */
const REACHED_LINE: Record<Limited, string> = {
  comps: "Comp searches, cover searches and title checks with no daily limit",
  covers: "Comp searches, cover searches and title checks with no daily limit",
  titleCheck: "Comp searches, cover searches and title checks with no daily limit",
  blurb: "The blurb, prose report and money tracking on every book",
  prose: "The blurb, prose report and money tracking on every book",
  track: "The blurb, prose report and money tracking on every book",
  arcReaders: "Advance reader lists with no ceiling",
  // The one line here that is *not* also in `WHAT_PRO_ADDS`, so it is genuinely
  // prepended rather than reordered — which is what that filter is for.
  keywordsAi: "Keyword suggestions whenever you want them",
  blurbChat: "Work on the blurb with a reader as often as you like",
  keywordChat: "Talk your keywords through as often as you like",
  collaborators: `Up to ${SEATS_PER_BOOK.pro} people on a book instead of ${SEATS_PER_BOOK.free}`,
};

function proAdds(action: Limited): string[] {
  const first = REACHED_LINE[action];
  return [first, ...WHAT_PRO_ADDS.filter((line) => line !== first)].slice(0, 4);
}

/**
 * Shown once, on the press that spends the last one.
 *
 * **The moment is the whole argument for a dialog.** A writer who has just been
 * stopped is the one person who wants to know what the paid plan does; the same
 * dialog on arrival, or on every visit afterwards, is the nag this product is
 * built to be the opposite of. So it is fired by the press and never by an
 * effect, it closes three ways, and it never returns on its own — the banner is
 * what stands in its place from then on.
 *
 * The content follows what the good ones do: name what was reached without
 * blaming anybody, say what changes in four lines rather than a table, print
 * the price so nobody has to leave to find it, offer a real way out, and end on
 * what is *not* affected — because the fear at this moment is that work has
 * been taken away.
 *
 * It is a **free-plan** dialog, and seats are the one limit Pro raises rather
 * than lifts — so a Pro owner who fills a book at ten never sees this. The share
 * dialog states that in plain words instead; showing somebody who is already
 * paying a panel about paying is the insult this component exists to avoid.
 */
export function LimitDialog({
  action,
  onClose,
}: {
  action: Limited;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="limit-dialog-title"
      // Escape closes a <dialog> natively and it means what Not now means: the
      // writer has read it and would like to get on.
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      /* Capped and scrollable: on a short window the picture's caption and the
         reassurance line were both below the fold, and a dialog whose buttons
         cannot be reached is a dialog nobody can answer. */
      /* **A dark frame with a white card floating in it**, which is the shape
         of the reference and the thing that makes it read as one object rather
         than as two panels butted together. The frame is the picture's own
         darkest navy, so the artwork on the left runs into it instead of
         ending at a seam — **re-matched when the picture was swapped, and it
         has to be again if it changes**, the way the landing page's hero framing has to be
         re-measured against its backdrop. It is stated literally rather than
         as a token for the same reason the type over the image is: it belongs
         to a photograph, and a photograph does not follow the theme.

         Capped and scrollable: on a short window the caption and the
         reassurance line were both below the fold, and a dialog whose buttons
         cannot be reached is a dialog nobody can answer. */
      /* **No scrollbar, because there is nothing to scroll.** The content is
         cut to fit an ordinary window rather than made scrollable — a
         scrolling dialog is a dialog that is too long, and the answer to too
         long is fewer words. `overflow-hidden` is what keeps the picture
         inside the rounded corners; the height cap is a floor under a very
         short window rather than something the layout relies on. */
      className="m-auto max-h-[calc(100dvh-2rem)] w-[46rem]
                 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl sm:overflow-hidden
                 bg-[#050a18] p-0 text-fg shadow-2xl backdrop:bg-black/70"
    >
      {/* The picture sits behind everything rather than inside the left half,
          so the frame around the white card *is* the artwork — the border and
          the panel are one image, which is what stops the card reading as a
          rectangle stuck on top of a photograph. The wrapper is what `fill`
          measures itself against, and it grows with the content, so a dialog
          that has to scroll is covered to its full height rather than to one
          viewport of it. */}
      <div className="relative">
        {/* **The filename carries the picture, not the slot.** Swapping the
            artwork under one name looks like it has not worked: `next/image`
            caches the optimised copy by URL, so the old picture keeps being
            served from `.next/cache/images` however many times the file is
            replaced. A new picture gets a new name — that busts the
            optimiser, the browser and anything in front of them at once. */}
        <Image
          src="/upgrade-panel-blur.jpg"
          alt=""
          aria-hidden
          fill
          sizes="(min-width: 640px) 46rem, 100vw"
          className="object-cover"
        />
        {/* **One veil over the whole picture, rather than a gradient on the
            left half.** The gradient made the two visible parts of the same
            photograph — the panel and the strip framing the card — read as two
            different pictures: near-black on the left, bright cyan down the
            right edge. An even wash puts them at one tone, which is what makes
            the frame and the panel obviously one image, and it is the same
            navy as the fallback under it so there is no edge where the picture
            has not loaded yet. It is 45% rather than 60% since the artwork
            went darker: the veil is there to even the picture out, and past a
            point it stops being a veil and becomes a paint. */}
        <div aria-hidden="true" className="absolute inset-0 bg-[#050a18]/45" />

        <div className="relative grid sm:grid-cols-[1fr_1.1fr]">
          {/* ---- The picture ------------------------------------------------

            **A photograph of nothing, which is the point.** The landing page's
            rule is that figures are drawn rather than screenshotted, because a
            picture of the product goes stale in silence while the product
            moves. Abstract artwork is the other way of satisfying that: it is
            not a claim about anything, so there is nothing in it that can stop
            being true.

            Hidden below `sm`, where the dialog is one column and the writer
            needs the words rather than the mood. */}
          <div className="relative hidden sm:block">
            <div className="relative flex h-full flex-col p-7">
              {/* The mark, where the reference puts its logo — the one place in
                the app it is drawn over a picture, so both halves are white
                rather than the sidebar's two tones: `--color-wordmark` is the
                indigo of a white page and would sink into this navy. */}
              <p className="font-sans text-lg font-bold tracking-tight text-white">
                Open<span className="text-white/70">Chapter</span>
              </p>

              <div className="mt-auto">
                {/* Literal white and a literal sky, not tokens: this is type on a
                photograph, and a photograph does not invert with the theme.
                Same reasoning as the landing page's drawn book covers. */}
                <p className="font-display text-3xl leading-tight font-bold text-white">
                  Unlock
                  <br />
                  <span className="text-[#7dd3fc]">every tool</span>
                </p>
                <p className="mt-3 max-w-[16rem] font-sans text-sm leading-relaxed text-white/70">
                  Every search, every import, nothing counted.
                </p>
              </div>
            </div>
          </div>

          {/* ---- What happened, and what changes ------------------------- */}
          <div className="relative m-2.5 rounded-2xl bg-panel p-6 sm:ml-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 flex h-8 w-8 items-center
                       justify-center rounded-full text-muted outline-none
                       transition-colors hover:bg-raised hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="h-4 w-4"
              >
                <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
              </svg>
            </button>

            <p
              className="inline-block rounded-full bg-linear-to-r
                       from-upgrade-from to-upgrade-to px-2.5 py-1 font-sans
                       text-xs font-medium text-white"
            >
              Free plan
            </p>

            <h2
              id="limit-dialog-title"
              className="mt-3.5 font-serif text-2xl leading-tight text-fg"
            >
              {reachedHeadline(action)}
            </h2>

            {/* **The deck is gone, and that is what makes the dialog fit.** It
                read "the free plan runs 10 title checks and you have used them.
                Pro takes the ceiling off this and the three beside it" — the
                first half is the headline directly above it, the second half is
                the list directly below, so it was the same thing three times
                and eighty pixels of height. A dialog that has to scroll is a
                dialog with too many words in it; the count moved into the
                headline, where it was going to be read anyway. */}
            <ul className="mt-3.5 space-y-1.5">
              {proAdds(action).map((item) => (
                <li key={item} className="flex gap-2.5">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                  >
                    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                  </svg>
                  <span className="font-sans text-sm leading-snug text-fg">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            {/* Read from the price table, never restated — the same rule the
              pricing page follows, so the two cannot disagree. */}
            <p className="mt-4 font-sans text-sm text-muted">
              {displayPrice(priceOf("monthly"))} a month, or{" "}
              {displayPrice(priceOf("annual"))} a year.
            </p>

            {/* Full width, as the reference has it: at the foot of a column of
              reasons there is one thing to do, and a button sized to its own
              label reads as one option among several. "Not now" stays a real
              way out — a dialog with no exit but the cross is the pattern this
              product is built to be the opposite of — but it is a quiet line
              rather than a second button competing with the first. */}
            <Link
              href="/upgrade"
              className="mt-5 block rounded-xl bg-linear-to-r from-upgrade-from
                       to-upgrade-to px-5 py-3 text-center font-sans text-sm
                       font-semibold text-white outline-none transition-opacity
                       hover:opacity-90 focus-visible:ring-2
                       focus-visible:ring-upgrade-to/50"
            >
              See what Pro adds
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 block w-full rounded-lg px-3 py-2 text-center
                       font-sans text-sm text-muted outline-none
                       transition-colors hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/50"
            >
              Not now
            </button>

            <p className="mt-4 font-sans text-xs leading-relaxed text-muted">
              Nothing you have already found, imported or written is affected,
              and everything else on the free plan keeps working.
            </p>
          </div>
        </div>
      </div>
    </dialog>
  );
}

