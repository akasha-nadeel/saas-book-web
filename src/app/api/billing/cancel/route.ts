import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import {
  PADDLE_API_KEY,
  PADDLE_SANDBOX,
  isPaddleConfigured,
} from "@/lib/billing/paddle";
import {
  APP_ID,
  APP_SECRET,
  canManageSubscriptions,
  payhereOrigin,
} from "@/lib/billing/payhere";
import { currentSubscription } from "@/lib/billing/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stop the recurring charge.
 *
 * Cancelling has to happen at PayHere first and in our table second, in that
 * order. The other way round leaves a writer who has been told they are
 * cancelled with a card that is still being charged every month, which is the
 * one outcome here that costs somebody real money.
 *
 * What cancelling does *not* do is take anything away. The subscription keeps
 * its current_period_end, so the writer has what they already paid for until
 * the cycle runs out — see isPro(), which gives a cancelled plan no grace
 * beyond that date and an active one three days.
 *
 * This needs the Subscription Manager credentials, which are a second pair made
 * under Domains & Credentials and separate from the checkout's merchant secret.
 * Without them the route says so rather than half-cancelling, and the account
 * dialog never offers the button in the first place.
 */

export const dynamic = "force-dynamic";

/**
 * The same job at Paddle, and it is shorter for one structural reason: Paddle
 * *is* the merchant of record, so cancelling is one authenticated call rather
 * than an OAuth exchange followed by a request.
 *
 * `effectiveFrom: "next_billing_period"` is the whole of the policy this app
 * states on its refunds page — the renewal stops and the writer keeps what they
 * have paid for. `"immediately"` would end the period they bought, which is the
 * one thing cancelling here has never done.
 *
 * Our table is written second, exactly as with PayHere, and for the same
 * reason: a writer told they are cancelled while the card is still live is the
 * only outcome here that costs somebody real money. Paddle's own webhook will
 * also arrive and write the same row, which is harmless — it carries the
 * absolute period end, so writing it twice writes the same dates twice.
 */
async function cancelAtPaddle(
  userId: string,
  subscriptionId: string | null,
): Promise<Response> {
  if (!isPaddleConfigured()) {
    return Response.json(
      {
        error:
          "Cancelling from here isn't switched on. Cancel from the receipt " +
          "Paddle emailed you, or write to us.",
      },
      { status: 501 },
    );
  }

  if (!subscriptionId) {
    return Response.json(
      { error: "There is no subscription to cancel." },
      { status: 400 },
    );
  }

  const paddle = new Paddle(PADDLE_API_KEY, {
    environment: PADDLE_SANDBOX ? Environment.sandbox : Environment.production,
  });

  try {
    await paddle.subscriptions.cancel(subscriptionId, {
      effectiveFrom: "next_billing_period",
    });
  } catch (error) {
    console.error("[billing] Paddle refused the cancellation", error);
    return Response.json(
      { error: "Paddle could not cancel that subscription." },
      { status: 502 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    // Cancelled at Paddle, unrecorded here — the half that matters is done, and
    // Paddle's webhook will write the row when it arrives.
    console.error(
      "[billing] cancelled at Paddle but SUPABASE_SECRET_KEY is not set",
      { userId },
    );
    return Response.json({ ok: true, recorded: false });
  }

  await supabase
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("owner", userId);

  return Response.json({ ok: true, recorded: true });
}

/** An access token, from the app id and secret. Good for this request only. */
async function accessToken(): Promise<string | null> {
  const basic = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");

  const response = await fetch(`${payhereOrigin()}/merchant/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function POST() {
  const { userId, subscription } = await currentSubscription();

  if (!userId) {
    return Response.json({ error: "Sign in to manage your plan." }, { status: 401 });
  }

  if (!subscription) {
    return Response.json(
      { error: "There is no subscription to cancel." },
      { status: 400 },
    );
  }

  // Which gateway is asked is decided by the row, never by which one this
  // deployment sells through today. Cancelling a PayHere subscription at Paddle
  // would answer "not found", we would mark the row cancelled, and the card
  // would go on being charged every month with the app saying it had stopped.
  if (subscription.provider === "paddle") {
    return cancelAtPaddle(userId, subscription.paddleSubscriptionId);
  }

  if (!canManageSubscriptions()) {
    return Response.json(
      {
        error:
          "Cancelling from here isn't switched on. Add PAYHERE_APP_ID and " +
          "PAYHERE_APP_SECRET, or cancel from the receipt PayHere emailed you.",
      },
      { status: 501 },
    );
  }

  if (!subscription.payhereSubscriptionId) {
    return Response.json(
      { error: "There is no subscription to cancel." },
      { status: 400 },
    );
  }

  const token = await accessToken();
  if (!token) {
    return Response.json(
      { error: "PayHere would not authorise the request. Try again shortly." },
      { status: 502 },
    );
  }

  const response = await fetch(
    `${payhereOrigin()}/merchant/v1/subscription/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription_id: subscription.payhereSubscriptionId,
      }),
      cache: "no-store",
    },
  );

  const result = (await response.json().catch(() => null)) as {
    status?: number;
    msg?: string;
  } | null;

  // PayHere answers 200 with a status of 1 for success and -1 for a refusal, so
  // the HTTP code on its own is not the answer.
  if (!response.ok || result?.status !== 1) {
    console.error("[billing] PayHere refused the cancellation", result);
    return Response.json(
      { error: result?.msg ?? "PayHere could not cancel that subscription." },
      { status: 502 },
    );
  }

  // Cancelled there; now say so here. `authenticated` has no update grant on
  // this table by design, so it takes the secret key — the same one the webhook
  // uses, and the same reason: nothing a browser sends decides what is paid for.
  const supabase = createAdminClient();
  if (!supabase) {
    // Cancelled at PayHere, unrecorded here. The writer is not being charged
    // again, which is the half that matters; the row will look active until its
    // period runs out and then stop, so this fails safe rather than silently.
    console.error(
      "[billing] cancelled at PayHere but SUPABASE_SECRET_KEY is not set",
      { userId },
    );
    return Response.json({ ok: true, recorded: false });
  }

  await supabase
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("owner", userId);

  return Response.json({ ok: true, recorded: true });
}
