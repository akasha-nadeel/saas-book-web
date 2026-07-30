"use client";

import { useCallback, useEffect, useState } from "react";
import type { Period } from "@/lib/billing/plans";
import type { SubscriptionStatus } from "@/lib/billing/subscription";

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

export interface PlanState {
  /** Still asking. Distinguish this from "on the free plan" before rendering. */
  loading: boolean;
  /** Is there a payment gateway configured at all? */
  billing: boolean;
  signedIn: boolean | null;
  pro: boolean;
  status: SubscriptionStatus | null;
  period: Period | null;
  /** ISO, or null while a first payment is still in flight. */
  currentPeriodEnd: string | null;
  /** Whether cancelling can be done from inside the app. */
  canCancel: boolean;
  /** Present only when an order id was asked about. */
  order: { id: string; status: string } | null;
}

const UNKNOWN: PlanState = {
  loading: true,
  billing: false,
  signedIn: null,
  pro: false,
  status: null,
  period: null,
  currentPeriodEnd: null,
  canCancel: false,
  order: null,
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
