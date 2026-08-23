"use client";

import { initializePaddle } from "@paddle/paddle-js";
import { useEffect, useRef, useState } from "react";

/**
 * Paddle's checkout, set into the page instead of floating over it.
 *
 * The overlay was Paddle's default and it costs the page: a white card in the
 * middle of a dimmed screen, with our own pricing showing through behind it and
 * neither surface acknowledging the other. Inline mode hands us the frame and
 * we place it, so the section around it is ours — our measure, our ground, our
 * way back — and the only foreign thing on screen is the form itself.
 *
 * **What we do not get is the form's own colours.** Structure and styling
 * inside the frame are Paddle's, set in their dashboard under Checkout
 * settings, and no property here can reach them. What this file controls is
 * everything outside the frame, plus the one thing Paddle does take from us:
 * `theme`, which is light or dark and nothing finer.
 *
 * `frameTarget` is a **class name**, not an id — Paddle's own quirk, and the
 * reason the container below carries a class it shares with nothing else.
 */

const FRAME_CLASS = "paddle-checkout-frame";

export function PaddleInlineCheckout({
  transactionId,
  environment,
  token,
  onBack,
}: {
  transactionId: string;
  environment: "sandbox" | "production";
  token: string;
  onBack: () => void;
}) {
  const [failed, setFailed] = useState(false);
  // React 19 runs effects twice in development; opening a checkout twice into
  // the same frame leaves two of them.
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;

    let cancelled = false;

    (async () => {
      const paddle = await initializePaddle({
        environment,
        token,
        checkout: {
          settings: {
            displayMode: "inline",
            frameTarget: FRAME_CLASS,
            frameInitialHeight: 450,
            // Transparent and borderless so the section behind it is what a
            // reader sees the form sitting on, rather than a second card.
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
  }, [environment, token, transactionId]);

  return (
    <section className="mx-auto w-full max-w-4xl px-5 pt-8 pb-20 text-left sm:pt-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 font-sans
                   text-sm text-muted outline-none transition-colors hover:bg-raised
                   hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span aria-hidden="true">←</span> Back to plans
      </button>

      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        Complete your upgrade
      </h1>
      <p className="mt-3 max-w-xl font-sans text-base leading-relaxed text-muted">
        Paddle is our reseller and handles the payment. Your card details go to
        them and never to us.
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-panel p-4 sm:p-6">
        {failed ? (
          <p role="alert" className="font-sans text-sm text-danger">
            The payment form would not load. Check your connection and try again.
          </p>
        ) : (
          // Paddle writes its iframe in here. Empty until it does, and given a
          // height so the section does not jump when it arrives.
          <div className={`${FRAME_CLASS} min-h-[450px]`} />
        )}
      </div>
    </section>
  );
}
