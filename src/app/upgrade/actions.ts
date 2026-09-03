"use server";

import { redirect } from "next/navigation";
import { isBillingConfigured, NOT_CONFIGURED } from "@/lib/billing/payhere";
import { CURRENCY, asPeriod, priceOf } from "@/lib/billing/plans";
import { asPaidTier } from "@/lib/billing/tiers";
import { subscriptionFor } from "@/lib/billing/server";
import { isPro } from "@/lib/billing/subscription";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Pressing Upgrade.
 *
 * A Server Action rather than a link, because starting a checkout is a write:
 * an order has to exist before the writer leaves for PayHere, or the
 * notification that comes back has nothing to be matched against. Doing that
 * during a page render would mint a fresh order on every refresh.
 *
 * It ends in a redirect to a page that only *reads* that order and posts it on,
 * so the trip to PayHere is reloadable and the back button is harmless.
 */

export type CheckoutState = { error?: string };

/** Unlikely to collide, and short enough for PayHere's field. */
function newOrderId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `OC-${stamp}-${random}`;
}

export async function startCheckout(
  _state: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const period = asPeriod(formData.get("period")) ?? "monthly";

  /* No default. The cycle can fall back to monthly because both cost the writer
     something and the cheaper one is the safer guess; the *plan* cannot, since
     every fallback is either giving away the dearest tier or charging for a
     cheaper one than was pressed. */
  const tier = asPaidTier(formData.get("tier"));
  if (!tier) {
    return { error: "Pick a plan." };
  }

  if (!isSupabaseConfigured()) {
    return { error: "Accounts aren't configured, so there is nothing to bill." };
  }
  if (!isBillingConfigured()) {
    return { error: NOT_CONFIGURED };
  }
  // Checked here rather than after the money moves. Without the secret key the
  // webhook cannot write a subscription, so the payment would go through and
  // buy nothing — the worst failure available in this flow, and the one that
  // has to be caught before the writer reaches a card form.
  if (!isAdminConfigured()) {
    return {
      error:
        "Payments can't be recorded yet: SUPABASE_SECRET_KEY isn't set. " +
        "Nothing has been charged.",
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) {
    redirect("/signin?next=/upgrade");
  }

  // One live authorisation per writer. Two would be two charges a month, and
  // the subscriptions table — one row per writer, on purpose — could only
  // remember one of them. Changing cycle means cancelling first.
  const existing = await subscriptionFor(supabase, userId);
  if (isPro(existing) && existing?.status !== "cancelled") {
    return {
      error:
        "You already have an active subscription. Cancel it from your account " +
        "before starting another.",
    };
  }

  const orderId = newOrderId();

  const { error } = await supabase.from("payment_orders").insert({
    order_id: orderId,
    owner: userId,
    plan: tier,
    period,
    amount: priceOf(tier, period),
    currency: CURRENCY,
  });

  if (error) {
    console.error("[billing] could not start a checkout", error);
    return { error: "Could not start the checkout. Try again in a moment." };
  }

  redirect(`/upgrade/checkout/${orderId}`);
}
