"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePlan } from "@/lib/use-plan";

/**
 * Where PayHere sends the writer back to.
 *
 * This page cannot simply say "thank you, you're on Pro", and the reason is the
 * whole design of it: the browser gets here the instant the card clears, but
 * what actually grants Pro is PayHere's *server* posting to our webhook, and
 * those two races are not ordered. Nine times in ten the notification wins by a
 * second. Sometimes it does not.
 *
 * So the page asks, and keeps asking, and describes exactly which of the three
 * states it is in — confirmed, refused, or still waiting. The tempting shortcut
 * is to trust the redirect and switch the plan on here; that would put a writer
 * on Pro on the strength of a URL they could have typed.
 */

/** Every two seconds, for two minutes. Long enough for a queue, short enough
 *  that a genuinely stuck payment is admitted to rather than spun on forever. */
const EVERY_MS = 2000;
const GIVE_UP_AFTER = 60;

export function CheckoutResult({ orderId }: { orderId: string | null }) {
  const plan = usePlan(orderId ?? undefined);
  const { refresh } = plan;
  const [tries, setTries] = useState(0);

  // Refused outright — no amount of waiting changes these.
  const refused =
    plan.order?.status === "failed" ||
    plan.order?.status === "cancelled" ||
    plan.order?.status === "chargedback";

  const settled = plan.pro || refused;
  const waiting = !settled && tries < GIVE_UP_AFTER;

  useEffect(() => {
    if (!waiting) return;

    const timer = setTimeout(() => {
      setTries((n) => n + 1);
      refresh();
    }, EVERY_MS);

    return () => clearTimeout(timer);
  }, [waiting, tries, refresh]);

  return (
    <main className="scroll-slim h-dvh overflow-y-auto bg-surface">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-16 text-center">
        {plan.loading && tries === 0 ? (
          <Result title="Checking with PayHere…" tone="wait" />
        ) : plan.pro ? (
          <Result
            tone="good"
            title="You're on Pro"
            body="The assistant, the bookmarks and the audiobook are switched on. PayHere has emailed your receipt."
            action={{ href: "/", label: "Back to writing" }}
          />
        ) : refused ? (
          <Result
            tone="bad"
            title={
              plan.order?.status === "cancelled"
                ? "Payment cancelled"
                : "That payment didn't go through"
            }
            body={
              plan.order?.status === "cancelled"
                ? "Nothing was charged. Your books are exactly where you left them."
                : "PayHere turned the payment down and nothing was charged. It is usually the card rather than the account — trying another one is the quickest thing."
            }
            action={{ href: "/upgrade", label: "Back to plans" }}
          />
        ) : waiting ? (
          <Result
            tone="wait"
            title="Confirming your payment"
            body="PayHere is letting us know. This is normally a few seconds — you can leave this page open."
          />
        ) : (
          // Two minutes without a notification, and we have stopped asking.
          //
          // The mark here is deliberately *not* the spinner. A spinner means
          // something is happening; nothing is, and one that turns forever over
          // a page that has given up is the page lying about its own state. So
          // it goes still, and the way to ask again becomes a button the writer
          // presses rather than a reload they have to think of.
          <Result
            tone="idle"
            title="Still waiting on PayHere"
            body="The payment may have gone through — PayHere sometimes takes a few minutes to confirm. Your receipt email is the thing to trust; if it arrives and Pro is still off in an hour, send us that receipt."
            action={{
              label: "Check again",
              onClick: () => {
                setTries(0);
                refresh();
              },
            }}
            secondary={{ href: "/", label: "Back to writing" }}
          />
        )}
      </div>
    </main>
  );
}

/** The one button style, whether it goes somewhere or does something. */
const BUTTON = `inline-block rounded-xl bg-fg px-6 py-3 font-sans text-sm
  font-semibold text-surface outline-none transition-opacity hover:opacity-90
  focus-visible:ring-2 focus-visible:ring-accent/60`;

function Result({
  tone,
  title,
  body,
  action,
  secondary,
}: {
  tone: "good" | "bad" | "wait" | "idle";
  title: string;
  body?: string;
  /** A link when it has an href, a button when it has an onClick. */
  action?:
    | { href: string; label: string; onClick?: never }
    | { onClick: () => void; label: string; href?: never };
  /** The quieter way out, when the main button is something else. */
  secondary?: { href: string; label: string };
}) {
  return (
    <div>
      <Mark tone={tone} />

      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-fg">
        {title}
      </h1>

      {body && (
        <p className="mx-auto mt-3 max-w-sm font-sans text-sm leading-relaxed text-muted">
          {body}
        </p>
      )}

      {action && (
        <div className="mt-8">
          {action.href ? (
            <Link href={action.href} className={BUTTON}>
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className={`cursor-pointer ${BUTTON}`}
            >
              {action.label}
            </button>
          )}
        </div>
      )}

      {secondary && (
        <div className="mt-4">
          <Link
            href={secondary.href}
            className="font-sans text-sm text-muted underline underline-offset-2
                       outline-none transition-colors hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {secondary.label}
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * A tick, a cross, a clock, or a turning ring.
 *
 * The state is carried by the shape as well as the colour, so it survives a
 * reader who cannot tell the two hues apart — and the ring turns only while
 * something is actually being waited on. `idle` is the same size and weight
 * standing still, which is the difference between "asking" and "stopped".
 */
function Mark({ tone }: { tone: "good" | "bad" | "wait" | "idle" }) {
  if (tone === "wait") {
    return (
      <div
        aria-hidden="true"
        className="mx-auto h-12 w-12 animate-spin rounded-full border-2
                   border-line border-t-accent"
      />
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`mx-auto h-12 w-12 ${tone === "good" ? "text-accent" : "text-muted"}`}
    >
      <circle cx="12" cy="12" r="9.5" />
      {tone === "good" ? (
        <path d="m8 12.25 2.75 2.75L16 9" />
      ) : tone === "bad" ? (
        <path d="m9 9 6 6M15 9l-6 6" />
      ) : (
        // Clock hands: waiting, but not working.
        <path d="M12 7v5.25l3.25 1.75" />
      )}
    </svg>
  );
}
