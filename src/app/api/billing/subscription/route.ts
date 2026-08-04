import { canManageSubscriptions, isBillingConfigured } from "@/lib/billing/payhere";
import { currentSubscription } from "@/lib/billing/server";
import { isPro } from "@/lib/billing/subscription";
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
  const billing = isBillingConfigured();

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
    });
  }

  const { userId, subscription } = await currentSubscription();

  // The page a writer lands on after paying asks about one particular order as
  // well as the plan, because the two answer different questions: the plan says
  // whether Pro is on, the order says whether the payment failed. Both are read
  // through RLS, so an order id that is not this writer's finds nothing.
  const wanted = new URL(request.url).searchParams.get("order");
  let order: { id: string; status: string } | null = null;

  if (wanted && userId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("payment_orders")
      .select("order_id, status")
      .eq("order_id", wanted)
      .maybeSingle();

    if (data) order = { id: String(data.order_id), status: String(data.status) };
  }

  return Response.json({
    billing: true,
    signedIn: Boolean(userId),
    pro: isPro(subscription),
    order,
    status: subscription?.status ?? null,
    period: subscription?.period ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    // Whether the Cancel button should exist at all. The Subscription Manager
    // credentials are a separate pair from the checkout ones and may well not
    // be set, in which case a button here could not do anything — so the dialog
    // shows how to cancel by hand instead of a control that fails when pressed.

    canCancel: Boolean(
      subscription?.payhereSubscriptionId &&
        subscription.status !== "cancelled" &&
        canManageSubscriptions(),
    ),
  });
}
