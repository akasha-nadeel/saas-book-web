import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import {
  PADDLE_API_KEY,
  PADDLE_SANDBOX,
  isPaddleConfigured,
  isPaddleSetupFault,
  paddleErrorCode,
  paddlePriceId,
} from "@/lib/billing/paddle";
import { asPeriod, priceOf } from "@/lib/billing/plans";
import { asPaidTier } from "@/lib/billing/tiers";
import { CONTACT_EMAIL } from "@/lib/legal";
import { currentSubscription } from "@/lib/billing/server";
import { isPro } from "@/lib/billing/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Starts a Paddle checkout, server-side.
 *
 * **The transaction is created here rather than in the browser, and that is the
 * whole point of this route.** Paddle's overlay will happily open from a price
 * id and a `customData` object supplied by the page — which means the person
 * paying chooses both the price and the name on the receipt. Creating it here
 * means the price comes from `plans.ts` and the buyer's id comes from their own
 * session, and neither is editable by anybody reading the page source. It is
 * the same reasoning `payment_orders` was built on for PayHere: a browser may
 * *start* a checkout, and may not say what it is for.
 *
 * What goes back is a transaction id. The client opens the overlay with it and
 * nothing else, so there is nothing left for the page to get wrong.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isPaddleConfigured()) {
    return Response.json(
      { error: "Payments aren't configured on this deployment." },
      { status: 501 },
    );
  }

  const { userId, subscription } = await currentSubscription();
  if (!userId) {
    return Response.json({ error: "Sign in to subscribe." }, { status: 401 });
  }

  // One live subscription per writer, for the reason the table has one row per
  // writer: two authorisations against one card is two charges a month, and
  // this schema could only remember one of them.
  if (isPro(subscription) && subscription?.status !== "cancelled") {
    return Response.json(
      { error: "There is already an active subscription on this account." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    tier?: unknown;
    period?: unknown;
  } | null;

  const period = asPeriod(body?.period);
  if (!period) {
    return Response.json({ error: "Pick a monthly or annual plan." }, { status: 400 });
  }

  /* Narrowed rather than trusted, and `free` is refused with the rubbish: this
     route creates a charge, and there is nothing to charge for a plan that
     costs nothing. The price itself still comes from our own table below, so
     the worst a bad value can do is fail here. */
  const tier = asPaidTier(body?.tier);
  if (!tier) {
    return Response.json({ error: "Pick a plan." }, { status: 400 });
  }

  const paddle = new Paddle(PADDLE_API_KEY, {
    environment: PADDLE_SANDBOX ? Environment.sandbox : Environment.production,
  });

  let transaction;
  try {
    transaction = await paddle.transactions.create({
      items: [{ priceId: paddlePriceId(tier, period), quantity: 1 }],
      // What the webhook reads to know whose subscription this is. Written
      // from the session, so it cannot name anybody else.
      customData: { userId, tier, period },
    });
  } catch (error) {
    // The code is logged next to the error because it is the part an operator
    // acts on, and Paddle's `detail` says exactly what to go and change.
    console.error("[billing] paddle would not create a transaction", {
      code: paddleErrorCode(error),
      error,
    });

    /*
     * Two different failures, and they must not share a sentence.
     *
     * A live account with valid keys and active prices still refuses every
     * transaction until a default payment link is set in the Paddle dashboard
     * — `transaction_default_checkout_url_not_set`. Answering that with "try
     * again shortly" is a claim the code cannot back: it will fail the same way
     * for as long as the setting is missing, and a writer pressing Upgrade
     * again is being sent nowhere. Nothing about the account's configuration
     * goes back to them, only the fact that it is not theirs to retry.
     */
    if (isPaddleSetupFault(error)) {
      return Response.json(
        {
          error: `Checkout isn't available yet. Nothing was charged — please let us know at ${CONTACT_EMAIL}.`,
        },
        { status: 503 },
      );
    }

    return Response.json(
      { error: "Could not start the checkout. Try again shortly." },
      { status: 502 },
    );
  }

  // The order row, written before the writer sees a payment form — so a
  // notification that arrives has something of ours to be matched against, and
  // a checkout somebody abandoned is distinguishable from one that never
  // started. `authenticated` may insert here and nowhere else; this route uses
  // the admin client only because it also has to be sure the row exists before
  // the overlay opens.
  const supabase = createAdminClient();
  if (supabase) {
    const { error } = await supabase.from("payment_orders").insert({
      order_id: transaction.id,
      owner: userId,
      provider: "paddle",
      plan: tier,
      period,
      amount: priceOf(tier, period),
      currency: "USD",
      status: "pending",
    });

    // Not fatal. The webhook resolves the owner from custom data, so a missing
    // order row costs the audit trail rather than the payment — and refusing a
    // checkout over it would be turning away money to keep a record tidy.
    if (error) console.error("[billing] paddle order row not written", error);
  }

  return Response.json({ transactionId: transaction.id });
}
