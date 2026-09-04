"use client";

import { useCallback, useEffect, useState } from "react";
import type { Period } from "@/lib/billing/plans";
import type { SubscriptionStatus } from "@/lib/billing/subscription";
import type { PlanTier } from "@/lib/billing/tiers";

/**
 * What plan the browser thinks it is on.
 *
 * Fetched, not derived. The plan lives in Postgres and changes when PayHere
 * says it changes — a webhook away, months later, with no page open — so there
 * is nothing local to read it from, and unlike the library it is not the
 * browser's to own. `library-store.ts` stays the only thing touching
 * localStorage, and this is deliberately not part of it.
 *
 * Nothing here gates anything that costs money. The two billed routes check the
 * subscription themselves, server-side, because that is the only check a reader
 * with devtools cannot edit. What this is for is showing a writer the truth
 * about their own account — which button to offer, which state to describe.
 */

/**
 * What is left to spend on the assistant.
 *
 * **Two buckets, because they behave differently.** `grantLeft` is this
 * month's allowance and disappears on the 1st; `purchased` was paid for and
 * does not. A gate asks `total`; `/billing` prints the split, so a writer can
 * see what they are about to lose and what they are not.
 *
 * `null` throughout means *nothing is metered here* — no payment gateway
 * configured, which is the self-hosted case — and must read as unlimited
 * rather than as empty.
 */
export interface CreditBalance {
  grantLeft: number | null;
  purchased: number | null;
  total: number | null;
  /** ISO instant. Rendered in the reader's own time zone, never as a phrase. */
  resetAt: string | null;
}

export interface PlanState {
  /** Still asking. Distinguish this from "on the free plan" before rendering. */
  loading: boolean;
  /** Is there a payment gateway configured at all? */
  billing: boolean;
  signedIn: boolean | null;
  /**
   * Which of the four plans, once known.
   *
   * **Anything gating the assistant must read this, never `pro`.** Draft is a
   * paid plan with no AI, so `pro` answers true for a writer who may not use
   * the assistant at all — a gate written against `pro` unlocks it for them,
   * and a paid feature whose gate is visibly decorative teaches a reader that
   * the rest are too.
   */
  tier: PlanTier | null;
  /** Any paid plan at all. The right question for books, trash and tools. */
  pro: boolean;
  status: SubscriptionStatus | null;
  period: Period | null;
  /** ISO, or null while a first payment is still in flight. */
  currentPeriodEnd: string | null;
  /** Whether cancelling can be done from inside the app. */
  canCancel: boolean;
  /** Present only when an order id was asked about. */
  order: { id: string; status: string } | null;
  /**
   * What is left to spend on the assistant, reported by the backend.
   *
   * **This, not `tier`, is what gates the panel.** A Free account holding
   * bought credits has some; a Writer who has spent the month has none. Both
   * are facts about the balance rather than the plan, and `aiChatClosed()` in
   * `launch.ts` reads `credits.total` for exactly that reason.
   *
   * `resetAt` is an instant rather than a phrase because 00:00 UTC on the 1st
   * is 5:30am in Colombo — every screen renders it in the reader's own time.
   */
  credits: CreditBalance | null;
  /** Book allowance. `null` means unlimited. */
  books: { limit: number | null } | null;
  /** Export formats by plan. */
  exports: { free: readonly string[]; pro: readonly string[] } | null;
}

const UNKNOWN: PlanState = {
  loading: true,
  billing: false,
  signedIn: null,
  // Not `"free"`: not knowing is a third answer, and a gate that treats it as
  // free refuses a paying writer for the width of one request. Every gate reads
  // `!loading && billing && …` for exactly this reason.
  tier: null,
  pro: false,
  status: null,
  period: null,
  currentPeriodEnd: null,
  canCancel: false,
  order: null,
  credits: null,
  books: null,
  exports: null,
};

export function usePlan(orderId?: string): PlanState & { refresh: () => void } {
  const [state, setState] = useState<PlanState>(UNKNOWN);

  const refresh = useCallback(() => {
    const query = orderId ? `?order=${encodeURIComponent(orderId)}` : "";

    fetch(`/api/billing/subscription${query}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Partial<PlanState> | null) => {
        // A failed request leaves the state as it was rather than reporting a
        // free plan: "we could not ask" and "you have not paid" are different
        // answers, and only one of them should change what a writer is shown.
        if (!data) {
          setState((previous) => ({ ...previous, loading: false }));
          return;
        }
        setState({ ...UNKNOWN, ...data, loading: false });
      })
      .catch(() => {
        setState((previous) => ({ ...previous, loading: false }));
      });
  }, [orderId]);

  useEffect(refresh, [refresh]);

  return { ...state, refresh };
}
