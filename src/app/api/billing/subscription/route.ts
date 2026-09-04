import { TIER_LIMITS } from "@/lib/billing/tiers";
import { planTierOf } from "@/lib/billing/subscription";
import { isPaddleConfigured } from "@/lib/billing/paddle";
import { canManageSubscriptions } from "@/lib/billing/payhere";
import { billingConfigured } from "@/lib/billing/provider";
import { creditBalanceFor } from "@/lib/billing/launch-entitlements";
import { currentSubscription } from "@/lib/billing/server";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { createClient } from "@/lib/supabase/server";

/**
 * What the browser is allowed to know about its own plan.
 *
 * One request answers everything the client needs — is there a gateway at all,
 * is this writer on Pro, until when, and can the app cancel for them — so the
 * account dialog and the pricing page do not each have to reason from a
 * different half of the picture, and no component has to be handed billing
 * props down through the shelf.
 *
 * Read-only by construction: this route decides nothing. What it reports comes
 * from the subscriptions row, which only the webhook writes.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const billing = billingConfigured();

  // No gateway means nothing is for sale and therefore nothing is held back.
  // The same shape as a missing API key or a missing Supabase project: the app
  // runs whole, and says why the buying part is absent.
  if (!billing) {
    return Response.json({
      billing: false,
      signedIn: null,
      pro: true,
      status: null,
      period: null,
      currentPeriodEnd: null,
      canCancel: false,
      order: null,
      assistant: { used: 0, limit: null, remaining: null, resetAt: null },
      books: { limit: null },
      exports: { free: LAUNCH_LIMITS.freeExports, pro: LAUNCH_LIMITS.proExports },
    });
  }

  const { userId, subscription } = await currentSubscription();
  const supabase = userId ? await createClient() : null;

  // The page a writer lands on after paying asks about one particular order as
  // well as the plan, because the two answer different questions: the plan says
  // whether Pro is on, the order says whether the payment failed. Both are read
  // through RLS, so an order id that is not this writer's finds nothing.
  const wanted = new URL(request.url).searchParams.get("order");
  let order: { id: string; status: string } | null = null;

  if (wanted && supabase) {
    const { data } = await supabase
      .from("payment_orders")
      .select("order_id, status")
      .eq("order_id", wanted)
      .maybeSingle();

    if (data) order = { id: String(data.order_id), status: String(data.status) };
  }

  const tier = planTierOf(subscription);
  /* Kept alongside `tier` and derived from it, so the nine screens that only
     ever asked "is this a paid plan" need no edit. Its meaning is now exactly
     that — *any* paid tier — which is the right question for books, the trash,
     the hidden tools and export, and the wrong one for the assistant. Anything
     gating AI reads `tier`. */
  const pro = tier !== "free";

  /* A signed-out reader is told zero rather than null: null means *unmetered*,
     and a visitor who has not signed in has no balance rather than an
     unlimited one. `resetAt` stays null because there is no grant to refill. */
  const credits =
    supabase && userId
      ? await creditBalanceFor(supabase, userId, subscription)
      : { grantLeft: 0, purchased: 0, total: 0, resetAt: null };

  return Response.json({
    billing: true,
    signedIn: Boolean(userId),
    tier,
    pro,
    order,
    status: subscription?.status ?? null,
    period: subscription?.period ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    // Whether the Cancel button should exist at all, asked of *this row's*
    // gateway rather than of the deployment's current one — a writer who
    // subscribed through PayHere is still cancelled at PayHere after new
    // checkouts have moved to Paddle.
    //
    // Each gateway can fail to answer for its own reason. PayHere needs the
    // Subscription Manager credentials, which are a separate pair from the
    // checkout ones and may well not be set; Paddle needs an API key. Where the
    // answer is no, the dialog shows how to cancel by hand rather than a
    // control that fails when pressed.
    canCancel: Boolean(
      subscription &&
        subscription.status !== "cancelled" &&
        (subscription.provider === "paddle"
          ? subscription.paddleSubscriptionId && isPaddleConfigured()
            : subscription.payhereSubscriptionId && canManageSubscriptions()),
    ),
    credits,
    books: { limit: TIER_LIMITS[tier].books },
    exports: { free: LAUNCH_LIMITS.freeExports, pro: LAUNCH_LIMITS.proExports },
  });
}
