"use client";

import { initializePaddle } from "@paddle/paddle-js";
import { useEffect, useRef, useState } from "react";

/**
 * "Update" on the payment row, and the card dialog it opens.
 *
 * The dialog is **Paddle's form in our own card**, not Paddle's overlay. That
 * is not decoration: the overlay arrived as a wide two-column page of its own,
 * white whatever the app was set to, with an order summary nobody asked for
 * beside a card field — for the one job of changing a card. Inline mode hands
 * us the frame, so the chrome around it is ours and no wider than the form
 * needs. It also unlocks Paddle's inline styling options, which is the only way
 * the button inside the frame stops being green.
 *
 * What stays Paddle's is what has to be: the card fields themselves. Paddle is
 * the merchant of record, the number never touches this origin, and a form we
 * hosted would make PCI scope out of a page that currently has none.
 *
 * `transactionId` comes from our own route, which asks Paddle for a
 * zero-amount payment-method-change transaction against *this* writer's
 * subscription. The browser never names the subscription it is updating.
 */

const FRAME_CLASS = "paddle-update-frame";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

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

      setTransactionId(data.transactionId);
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

      {transactionId && (
        <PaymentMethodDialog
          transactionId={transactionId}
          environment={environment}
          token={token}
          onClose={() => setTransactionId(null)}
          onUpdated={() => {
            setTransactionId(null);
            onUpdated?.();
          }}
        />
      )}
    </div>
  );
}

/**
 * The card the form sits in.
 *
 * Native `<dialog>` for the same reason the editor's panels use it: the top
 * layer, the focus trap, Escape and focus restoration are the platform's job
 * and it does them better than a div with a z-index.
 */
function PaymentMethodDialog({
  transactionId,
  environment,
  token,
  onClose,
  onUpdated,
}: {
  transactionId: string;
  environment: "sandbox" | "production";
  token: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  // React 19 runs effects twice in development, and two checkouts opened into
  // one frame leaves two of them.
  const opened = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;

    let cancelled = false;

    (async () => {
      const paddle = await initializePaddle({
        environment,
        token,
        eventCallback: (event) => {
          if (event.name === "checkout.completed") onUpdated();
        },
        checkout: {
          settings: {
            displayMode: "inline",
            frameTarget: FRAME_CLASS,
            frameInitialHeight: 416,
            frameStyle:
              "width: 100%; min-width: 312px; background-color: transparent; border: none;",
            theme:
              document.documentElement.dataset.theme === "dark" ? "dark" : "light",
          },
        },
      });

      if (cancelled) return;
      if (!paddle) {
        setFailed(true);
        return;
      }

      paddle.Checkout.open({ transactionId });
    })().catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
    // onUpdated is a fresh closure each render and would re-open the frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, token, transactionId]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="payment-method-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line
                 bg-panel p-0 text-fg backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <h2
          id="payment-method-title"
          className="font-sans text-base font-bold text-fg"
        >
          Payment method
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="-m-1 rounded-md p-1 text-muted outline-none transition-colors
                     hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-4 w-4"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <p className="px-6 pt-1 font-sans text-xs leading-relaxed text-muted">
        Paddle handles the card. Your details go to them and never to us.
      </p>

      <div className="px-6 pt-4 pb-6">
        {failed ? (
          <p role="alert" className="font-sans text-sm text-danger">
            The payment form would not load. Check your connection and try again.
          </p>
        ) : (
          <div className={`${FRAME_CLASS} min-h-[416px]`} />
        )}
      </div>
    </dialog>
  );
}
