"use client";

import { useCallback, useEffect, useState } from "react";
import { TIER_LIMITS, TIER_NAMES } from "@/lib/billing/tiers";
import Link from "next/link";
import type { PaymentTone } from "@/lib/billing/history";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { plural } from "@/lib/plural";
import { usePlan } from "@/lib/use-plan";
import { PaddleUpdatePaymentButton } from "./paddle-update-button";

/**
 * The billing page — the writer's account seen from the money side.
 *
 * The order is the one every subscription page settles on, and it is an order
 * rather than a list: what you are on, what pays for it, what you have used,
 * what you were charged, and — last, where nobody lands on it by accident —
 * how to stop. Cancellation at the foot of the page is the point of that
 * sequence, not decoration.
 *
 * Adapted for OpenChapter's Paddle billing rather than Stripe: Paddle is the
 * merchant of record, so the card dialog and the invoice PDFs are Paddle's own.
 *
 * Everything here is display. Nothing gates anything or grants anything — the
 * subscription row is what does that, and it is written only by the webhook.
 * What this page does is let a writer see what the webhook wrote.
 */

interface PaymentEvent {
  id: string;
  date: string | null;
  amount: number | null;
  currency: string;
  provider: string | null;
  /** Read from the gateway's own words on the server — see `billing/history.ts`. */
  status: { label: string; tone: PaymentTone };
  /** Whether there is an invoice document to open. */
  invoice: boolean;
}

/** The three status colours, plus the one that spends none. */
const TONE_CLASS: Record<PaymentTone, string> = {
  ok: "border-ok-line bg-ok-bg text-ok-fg",
  note: "border-note-line bg-note-bg text-note-fg",
  stop: "border-stop-line bg-stop-bg text-stop-fg",
  plain: "border-line bg-raised text-muted",
};

function money(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An ISO code Intl does not know. The number is still the number.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingPage({
  paddle,
}: {
  /** Read on the server; null when Paddle is not the gateway. */
  paddle: { token: string; environment: "sandbox" | "production" } | null;
}) {
  const plan = usePlan();
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    fetch("/api/billing/history", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { events?: PaymentEvent[] } | null) => {
        setEvents(data?.events ?? []);
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(loadHistory, [loadHistory]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setCancelError(data?.error ?? "Could not cancel. Try again shortly.");
        return;
      }
      setCancelModalOpen(false);
      plan.refresh();
    } catch {
      setCancelError("Could not reach the server.");
    } finally {
      setCancelling(false);
    }
  }, [plan]);

  const handleResume = useCallback(async () => {
    setResuming(true);
    setResumeError(null);
    try {
      const res = await fetch("/api/billing/resume", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setResumeError(data?.error ?? "Could not renew. Try again shortly.");
        return;
      }
      plan.refresh();
    } catch {
      setResumeError("Could not reach the server.");
    } finally {
      setResuming(false);
    }
  }, [plan]);

  if (plan.loading) {
    return (
      <main className="scroll-slim h-[var(--oc-layout-height)] overflow-y-auto bg-surface pb-(--oc-safe-bottom)">
        <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center px-5">
          <div
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent"
          />
        </div>
      </main>
    );
  }

  /* The plan's own name, read rather than typed. `TIER_NAMES` is the one place
     these words exist, so a rename cannot leave `/billing` disagreeing with the
     pricing cards about what somebody bought. */
  const planName = plan.tier ? TIER_NAMES[plan.tier] : "Free";

  const periodLabel = plan.period === "annual" ? "Annual" : "Monthly";
  const renewDate = plan.currentPeriodEnd ? shortDate(plan.currentPeriodEnd) : null;
  const cancelled = plan.status === "cancelled";

  return (
    <main className="scroll-slim h-[var(--oc-layout-height)] overflow-y-auto bg-surface pb-(--oc-safe-bottom)">
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

      <div className="mx-auto max-w-2xl px-5 pt-8 pb-20">
        <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
          Billing
        </h1>

        {/* ── Plan summary ─────────────────────────────────────────── */}
        <section className="mt-8 rounded-2xl border border-line bg-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
                <PlanIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-sans text-base font-bold text-fg">
                  {planName} plan
                </h2>
                {plan.pro && (
                  <p className="font-sans text-sm text-muted">{periodLabel}</p>
                )}
                {plan.pro && renewDate && (
                  <p className="mt-0.5 font-sans text-xs text-muted">
                    {cancelled
                      ? `Your subscription ends on ${renewDate}.`
                      : `Your subscription will auto renew on ${renewDate}.`}
                  </p>
                )}
                {!plan.pro && (
                  <p className="mt-0.5 font-sans text-xs text-muted">
                    {plural(TIER_LIMITS.free.books ?? 0, "book")}, every
                    export format, no writing assistant
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/upgrade"
              className="shrink-0 rounded-lg border border-line bg-surface px-4 py-2
                         font-sans text-sm font-medium text-fg outline-none
                         transition-colors hover:bg-raised focus-visible:ring-2
                         focus-visible:ring-accent/60"
            >
              {plan.pro ? "Adjust plan" : "Upgrade"}
            </Link>
          </div>
        </section>

        {/* ── Payment method ───────────────────────────────────────── */}
        {plan.pro && (
          <section className="mt-6">
            <h2 className="font-sans text-base font-bold text-fg">Payment</h2>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-panel px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ok-bg">
                  <PaddleIcon className="h-4 w-4 text-ok-fg" />
                </span>
                <span className="font-sans text-sm font-medium text-fg">
                  Managed by Paddle
                </span>
              </div>
              {/* Paddle is the merchant of record, so the card dialog is
                  Paddle's own, opened over this page. Its config is read on the
                  server and passed in — see the route's comment for what that
                  cost when it was read here. */}
              {paddle?.token ? (
                <PaddleUpdatePaymentButton
                  {...paddle}
                  onUpdated={() => {
                    plan.refresh();
                    loadHistory();
                  }}
                />
              ) : (
                <span className="font-sans text-xs text-muted">
                  Update from your Paddle receipt email
                </span>
              )}
            </div>
          </section>
        )}

        {/* ── Invoices ─────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="font-sans text-base font-bold text-fg">Invoices</h2>
          {eventsLoading ? (
            <div className="mt-4 flex justify-center py-8">
              <div
                aria-hidden="true"
                className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent"
              />
            </div>
          ) : events.length === 0 ? (
            <p className="mt-4 font-sans text-sm text-muted">
              No payments recorded yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-panel">
              <table className="w-full text-left font-sans text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold tracking-wider text-muted uppercase">
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Total</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className="px-5 py-3 whitespace-nowrap text-fg">
                        {shortDate(event.date)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-fg">
                        {money(event.amount, event.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[event.status.tone]}`}
                        >
                          {event.status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {/* A link, not a fetch: the route redirects to Paddle's
                            own short-lived PDF URL, so there is nothing to open
                            programmatically and nothing to keep. Rows with no
                            invoice show nothing rather than a dead link. */}
                        {event.invoice ? (
                          <a
                            href={`/api/billing/invoice/${encodeURIComponent(event.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-sm text-accent underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/60"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Cancellation ─────────────────────────────────────────── */}
        {plan.pro && !cancelled && (
          <section className="mt-10">
            <h2 className="font-sans text-base font-bold text-fg">Cancellation</h2>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-sans text-sm font-medium text-fg">Cancel plan</p>
                {!plan.canCancel && (
                  // No dead control: where the gateway cannot be reached from
                  // here, the page says how instead of offering a button that
                  // fails when pressed.
                  <p className="mt-0.5 font-sans text-xs text-muted">
                    Cancel from the receipt email your payment provider sent.
                  </p>
                )}
              </div>
              {plan.canCancel && (
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="shrink-0 rounded-lg bg-danger px-4 py-2 font-sans text-sm font-medium text-accent-ink outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-danger/50"
                >
                  Cancel
                </button>
              )}
            </div>
            {cancelError && (
              <p
                role="alert"
                className="mt-2 rounded-lg bg-danger/10 px-4 py-2 font-sans text-xs text-danger"
              >
                {cancelError}
              </p>
            )}
          </section>
        )}

        {plan.pro && cancelled && (
          <section className="mt-10">
            <h2 className="font-sans text-base font-bold text-fg">Subscription</h2>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-sans text-sm font-medium text-fg">
                  Subscription cancelled
                </p>
                <p className="mt-0.5 font-sans text-xs text-muted">
                  {planName} access continues until{" "}
                  {renewDate ?? "the end of the paid period"}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResume}
                disabled={resuming}
                className="shrink-0 rounded-lg bg-accent px-4 py-2 font-sans text-sm font-medium text-accent-ink outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60"
              >
                {resuming ? "Renewing…" : "Renew plan"}
              </button>
            </div>
            {resumeError && (
              <p
                role="alert"
                className="mt-2 rounded-lg bg-danger/10 px-4 py-2 font-sans text-xs text-danger"
              >
                {resumeError}
              </p>
            )}
          </section>
        )}
      </div>

      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              className="absolute top-4 right-4 text-muted transition-colors hover:text-fg"
              aria-label="Close"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="mb-4 text-fg">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-10 w-10"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>

            <h2 className="font-display text-2xl font-bold text-fg">Cancel plan</h2>
            <p className="mt-2 font-sans text-sm text-muted">
              Cancel to stop recurring billing. You keep OpenChapter{" "}
              {planName} until {renewDate ?? "the end of your billing period"}.
            </p>

            <div className="mt-6">
              <h3 className="font-sans text-sm font-bold text-fg">
                You&rsquo;ll go back to the free plan
              </h3>
              <ul className="mt-3 space-y-2 rounded-xl border border-line bg-surface p-4 font-sans text-sm text-muted">
                <li>
                  {plural(LAUNCH_LIMITS.freeBooks, "book")}, and the rest kept safe
                  but read-only above that.
                </li>
                <li>Five assistant replies a month instead of sixty.</li>
                {/* Export is on both plans, so cancelling takes nothing
                    away there — and a writer deciding whether to cancel is
                    exactly who needs told that their book still comes out. */}
                <li>Every export format stays. Nothing you have written moves.</li>
              </ul>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="rounded-lg bg-raised px-4 py-2 font-sans text-sm font-medium text-fg transition-colors hover:bg-line"
              >
                Keep your {planName} plan
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-lg bg-danger px-4 py-2 font-sans text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Cancel plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────── */

function PlanIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2.5 19.5 6 12 9.5 4.5 6z" />
      <path d="M4.5 10 12 13.5 19.5 10" />
      <path d="M4.5 14 12 17.5 19.5 14" />
    </svg>
  );
}

function PaddleIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm1 5.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5a.75.75 0 0 1 .75.75Zm0 2.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5a.75.75 0 0 1 .75.75Z" />
    </svg>
  );
}

