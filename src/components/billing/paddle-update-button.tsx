"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useEffect, useRef, useState } from "react";

/**
 * "Update" on the payment row, and the card dialog it opens.
 *
 * The dialog is **Paddle's**, opened over this page rather than navigated to.
 * That is not a shortcut around building our own: Paddle is the merchant of
 * record, the card never touches this origin, and a card form we hosted would
 * make PCI scope out of a page that currently has none. What we own is the
 * button, the failure message, and the theme the dialog opens in.
 *
 * `transactionId` comes from our own route, which asks Paddle for a
 * zero-amount payment-method-change transaction against *this* writer's
 * subscription. The browser never names the subscription it is updating.
 */
export function PaddleUpdatePaymentButton({
  environment,
  token,
  onUpdated,
}: {
  environment: "sandbox" | "production";
  token: string;
  /** Called once Paddle says the card was changed, so the page can re-read. */
  onUpdated?: () => void;
}) {
  const paddle = useRef<Paddle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      paddle.current?.Checkout.close();
    };
  }, []);

  async function update() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/paddle/update-payment-method", {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.transactionId) {
        setError(data?.error ?? "Could not start update. Try again shortly.");
        return;
      }

      paddle.current ??=
        (await initializePaddle({
          environment,
          token,
          eventCallback: (event) => {
            // Paddle names this one for a completed checkout of any kind,
            // a card change included. Re-reading is cheap and the row is what
            // the page believes, not this callback.
            if (event.name === "checkout.completed") onUpdated?.();
          },
        })) ?? null;

      if (!paddle.current) {
        setError("The payment window would not load. Check your connection.");
        return;
      }

      paddle.current.Checkout.open({
        transactionId: data.transactionId,
        settings: {
          displayMode: "overlay",
          // The dialog sits on our page, so it takes our colours rather than
          // arriving white over a dark app. Read from the attribute the theme
          // bootstrap resolves, which is always light or dark by this point.
          theme:
            document.documentElement.dataset.theme === "light" ? "light" : "dark",
        },
      });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={update}
        disabled={busy}
        className="shrink-0 rounded-lg border border-line bg-surface px-4 py-2 font-sans text-sm font-medium text-fg outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:opacity-60"
      >
        {busy ? "Loading…" : "Update"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
