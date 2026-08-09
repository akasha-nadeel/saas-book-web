"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useEffect, useRef, useState } from "react";
import type { Period } from "@/lib/billing/plans";

/**
 * The Upgrade button, when Paddle is the gateway.
 *
 * PayHere's version is a form that POSTs the browser away to a payment page.
 * Paddle's is an overlay that opens over this one, which changes two things
 * worth knowing.
 *
 * **The transaction is made before the overlay opens, by our own route.** So
 * this component never sees a price id and never sends one — it asks for a
 * transaction and opens whatever comes back. That is what stops the price and
 * the buyer's identity being editable by anybody reading the page source; see
 * `/api/billing/paddle/checkout`.
 *
 * **Paddle.js is loaded on the first press, not on mount.** The pricing page is
 * read far more often than it is bought from, and a script from a payment
 * network on every visit is a third party watching people who are only looking.
 * It costs a few hundred milliseconds on the press, which is inside the time
 * the transaction call takes anyway.
 *
 * There is no success handler. The overlay closing proves nothing — the writer
 * may have closed it themselves — so the grant comes from Paddle's webhook and
 * the page waits for the plan to change, exactly as `/upgrade/done` polls
 * rather than trusting PayHere's return URL.
 */

export function PaddleUpgradeButton({
  period,
  environment,
  token,
  className,
}: {
  period: Period;
  environment: "sandbox" | "production";
  /** Paddle's client-side token. Public by design — it can only open a checkout. */
  token: string;
  className: string;
}) {
  const paddle = useRef<Paddle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nothing is loaded on mount; this only tears down a checkout left open if
  // the writer navigates away mid-press.
  useEffect(() => {
    return () => {
      paddle.current?.Checkout.close();
    };
  }, []);

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

      // Loaded once and kept: initializePaddle returns the same instance on a
      // second call, but holding the reference saves the round trip.
      paddle.current ??= (await initializePaddle({ environment, token })) ?? null;

      if (!paddle.current) {
        setError("The payment window would not load. Check your connection.");
        return;
      }

      paddle.current.Checkout.open({ transactionId: data.transactionId });
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
