"use client";

import { useState } from "react";
import type { Period } from "@/lib/billing/plans";

/**
 * The Upgrade button, when Paddle is the gateway.
 *
 * PayHere's version is a form that POSTs the browser away to a payment page.
 * Paddle's asks our own route for a transaction and hands the id to the page,
 * which sets the checkout into a section of its own — see
 * `paddle-inline-checkout.tsx` for why it is not an overlay.
 *
 * **The transaction is made before any form appears, by our own route.** So
 * this component never sees a price id and never sends one — it asks for a
 * transaction and passes on whatever comes back. That is what stops the price
 * and the buyer's identity being editable by anybody reading the page source;
 * see `/api/billing/paddle/checkout`.
 *
 * **Paddle.js is not loaded here at all.** The pricing page is read far more
 * often than it is bought from, and a script from a payment network on every
 * visit is a third party watching people who are only looking. It loads with
 * the checkout section, which exists only once somebody has pressed this.
 *
 * There is no success handler. A closed form proves nothing — the writer may
 * have closed it themselves — so the grant comes from Paddle's webhook and the
 * page waits for the plan to change, exactly as `/upgrade/done` polls rather
 * than trusting PayHere's return URL.
 */

export function PaddleUpgradeButton({
  period,
  onTransaction,
  className,
}: {
  period: Period;
  /** Handed the transaction to check out. The page decides where to show it. */
  onTransaction: (transactionId: string) => void;
  className: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/paddle/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });

      const data = (await response.json().catch(() => null)) as {
        transactionId?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.transactionId) {
        setError(data?.error ?? "Could not start the checkout. Try again shortly.");
        return;
      }

      onTransaction(data.transactionId);
    } catch {
      setError("Could not reach the server. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={upgrade}
        disabled={busy}
        className={`w-full cursor-pointer disabled:cursor-default disabled:opacity-70 ${className}`}
      >
        {busy ? "Starting checkout…" : "Upgrade"}
      </button>
      {error && (
        // On the card's own ink: this button sits on bg-fg, where a red that
        // reads on paper disappears.
        <p role="alert" className="mt-3 font-sans text-xs leading-relaxed text-surface/75">
          {error}
        </p>
      )}
    </div>
  );
}
