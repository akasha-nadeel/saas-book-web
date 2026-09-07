"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PaidTier } from "@/lib/billing/tiers";
import type { Period } from "@/lib/billing/plans";

/**
 * What the preview route answers: what moves now, and which way.
 *
 * `failed` is its own field rather than inferred from a null amount, because
 * *"nothing to pay today"* and *"we could not find out"* are opposite things to
 * tell somebody about to spend money, and both arrive with no figure.
 */
type Quote = {
  action: "charge" | "credit" | null;
  amount: number | null;
  currency?: string;
  failed?: boolean;
};

/**
 * The figure, in the currency Paddle quoted it in.
 *
 * Paddle's own currency rather than a hardcoded dollar sign: the prices are USD
 * today and `plans.ts` says so, but the quote carries its own code and printing
 * "$" over a figure Paddle called something else is the kind of small lie that
 * survives a currency being added.
 */
function money(amount: number, currency: string | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
  }).format(amount);
}

/** The sentence above the confirm, or null when there is nothing to promise. */
function quoteLine(quote: Quote): string {
  if (quote.failed) {
    return "We could not work out the amount. Confirming may charge your card.";
  }
  if (quote.amount === null) {
    return "Nothing to pay today — the new price starts at your next renewal.";
  }
  if (quote.action === "credit") {
    return `You will be credited ${money(quote.amount, quote.currency)}.`;
  }
  return `You will be charged ${money(quote.amount, quote.currency)} now.`;
}

/**
 * Move an existing Paddle subscription onto this card's plan.
 *
 * **Not a checkout, and it must not look like one.** There is no overlay and no
 * card form: the authorisation already exists and Paddle is only being told to
 * bill a different price against it. A writer pressing this has already paid
 * once and is not being asked to do it again.
 *
 * **No success handler decides anything.** The route answers `{ ok: true }` and
 * nothing more; the plan is written when `subscription.updated` reaches
 * `paddle/notify`. So the press refreshes the route and lets the page read the
 * new plan back out of the server — the same rule `/upgrade/done` follows for
 * PayHere, and the reason neither one trusts a gateway's return.
 *
 * The refresh is a beat behind the webhook on a slow round trip, which is why
 * the button says so rather than sitting silent: "Updating…" is true whether the
 * notification has landed yet or not.
 */
export function ChangePlanButton({
  tier,
  period,
  label,
  className,
}: {
  tier: PaidTier;
  period: Period;
  /**
   * What the press says it will do.
   *
   * **Passed in rather than worked out here**, because there are three of them
   * and only the card knows which: "Upgrade to Studio" going up, "Switch to
   * Draft" going down, and "Switch to annual" when the plan is already theirs
   * and only the cycle is moving. Deriving it from `tier` alone produced
   * "Switch to Writer" on the card of somebody already on Writer.
   */
  label: string;
  className: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Whether the refusal has a page the writer can go and act on.
   *
   * **402 is the only status here that leaves the writer something to do.**
   * The route sends it when the bank declined the card, and a message naming a
   * remedy without a way to reach it is half an answer — /billing is where the
   * payment method is changed and it is two clicks away from this card
   * otherwise. Read off the status rather than matched out of the message, so
   * rewording the sentence cannot silently drop the link.
   */
  const [declined, setDeclined] = useState(false);

  /**
   * What Paddle says this press moves *now*, once it has been asked.
   *
   * `null` while nothing has been asked; a quote once it has, whose `action`
   * is null when the answer is "nothing changes hands today". `amount: null`
   * inside a quote means the preview itself failed — the press is still
   * offered, because the real call does its own refusing and a courtesy that
   * breaks must not take the feature down with it.
   */
  const [quote, setQuote] = useState<Quote | null>(null);
  /** Whether the press is now the second one, the one that spends money. */
  const [confirming, setConfirming] = useState(false);

  /**
   * Ask what it costs. The first press does this and nothing else.
   *
   * **A plan change bills immediately and named no figure**, which is how
   * "Switch to Draft" under a $7.98 heading came to attempt $68.61 — the cycle
   * toggle was on annual and the charge is the year, prorated. Everywhere else
   * money moves in this app it says the amount first.
   */
  async function ask() {
    setBusy(true);
    setError(null);
    setDeclined(false);

    try {
      const response = await fetch("/api/billing/paddle/change-plan/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, period }),
      });

      const data = (await response.json().catch(() => null)) as
        | (Quote & { error?: string })
        | null;

      /* A refusal the *change* would also give — already on this plan, nothing
         to change — is worth saying now rather than after a second press. */
      if (!response.ok && response.status !== 502) {
        setError(data?.error ?? "Could not change the plan. Try again shortly.");
        return;
      }

      setQuote(
        response.ok
          ? {
              action: data?.action ?? null,
              amount: typeof data?.amount === "number" ? data.amount : null,
              currency: data?.currency,
            }
          : { action: null, amount: null, failed: true },
      );
      setConfirming(true);
    } catch {
      setError("Could not reach the server. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  async function change() {
    setBusy(true);
    setError(null);
    setDeclined(false);

    try {
      const response = await fetch("/api/billing/paddle/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, period }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Could not change the plan. Try again shortly.");
        setDeclined(response.status === 402);
        return;
      }

      /* The webhook writes the plan; this only asks the page to go and look.
         `refresh()` re-runs the Server Component, so the cards come back with
         the new plan marked rather than this one guessing at it. */
      /* Back to one press. The card is about to be re-rendered as somebody
         else's — "Your plan" rather than "Switch to Draft" — but a component
         that survives the refresh must not come back still holding a quote for
         a change that has already happened. */
      setConfirming(false);
      setQuote(null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* **The figure goes above the press, not after it.** A confirm step that
          names no amount is the same button with an extra click in it. */}
      {confirming && quote && (
        <p className="mb-3 font-sans text-xs leading-relaxed text-fg">
          {quoteLine(quote)}
        </p>
      )}

      <button
        type="button"
        onClick={confirming ? change : ask}
        disabled={busy}
        className={`w-full cursor-pointer disabled:cursor-default
                    disabled:opacity-70 ${className}`}
      >
        {busy ? (confirming ? "Updating…" : "Checking…") : confirming ? "Confirm" : label}
      </button>

      {/* A way back out, because the first press has already told them
          something they may not have known — that this one costs $68.61 and not
          the $7.98 on the card above it. Being able to read that and stop is
          the whole point of asking first. */}
      {confirming && !busy && (
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setQuote(null);
            setError(null);
            setDeclined(false);
          }}
          className="mt-2 w-full cursor-pointer font-sans text-xs text-muted
                     underline"
        >
          Cancel
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 font-sans text-xs leading-relaxed text-muted">
          {error}
          {declined && (
            <>
              {" "}
              <Link href="/billing" className="text-accent underline">
                Update payment method
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
