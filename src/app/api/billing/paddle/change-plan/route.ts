import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { asPeriod } from "@/lib/billing/plans";
import {
  PADDLE_API_KEY,
  PADDLE_SANDBOX,
  isPaddleConfigured,
  isPaddleSetupFault,
  paddleErrorCode,
  paddlePriceId,
} from "@/lib/billing/paddle";
import { currentSubscription } from "@/lib/billing/server";
import { asPaidTier } from "@/lib/billing/tiers";

/**
 * Move an existing subscription onto a different plan or cycle.
 *
 * **The checkout routes could not do this, and that was a hole rather than a
 * rule.** Both of them refuse an active subscriber with a 409 — one live
 * authorisation per writer, because `subscriptions` holds one row per writer
 * and two authorisations against one card is two charges a month. That guard is
 * still right and still there. What it was never meant to mean is *a customer
 * on Draft cannot buy Writer* — but with one paid plan the two were
 * indistinguishable, and with three they are not: a Draft writer who wanted the
 * assistant had to cancel and sit out the period they had already paid for.
 *
 * So a **change** is its own route. Paddle swaps the price on the existing
 * subscription; there is no second authorisation, and the row this app keeps
 * goes on describing the one subscription it always did.
 *
 * **Nothing here grants anything.** The plan is written by `subscription.updated`
 * arriving at `paddle/notify`, where `paddlePlanFrom` reads our own price id back
 * out of the payload. That is the same rule the checkout follows — a return from
 * the gateway proves nothing, only the webhook does — and it is the payoff for
 * having built that reverse lookup rather than trusting Paddle's billing
 * interval.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isPaddleConfigured()) {
    return Response.json({ error: "Paddle not configured" }, { status: 501 });
  }

  const { subscription } = await currentSubscription();

  /* A writer with nothing to change is a writer who should be checking out.
     Answering 400 rather than quietly starting a purchase keeps the two paths
     apart: this one only ever moves money that is already moving. */
  if (!subscription?.paddleSubscriptionId) {
    return Response.json(
      { error: "There is no Paddle subscription on this account to change." },
      { status: 400 },
    );
  }

  /* A subscription on its way out is not one to move. Paddle would take the
     change and then cancel anyway, leaving a writer charged a difference for a
     plan that ends this period. */
  if (subscription.status === "cancelled") {
    return Response.json(
      { error: "This subscription is already cancelled. Start a new one instead." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    tier?: unknown;
    period?: unknown;
  } | null;

  /* Narrowed, never trusted — and the price id still comes from our own env
     table below, so the browser names a *plan* and never a price. */
  const tier = asPaidTier(body?.tier);
  const period = asPeriod(body?.period);
  if (!tier || !period) {
    return Response.json({ error: "Pick a plan and a cycle." }, { status: 400 });
  }

  if (tier === subscription.tier && period === subscription.period) {
    return Response.json(
      { error: "That is already the plan on this account." },
      { status: 409 },
    );
  }

  const paddle = new Paddle(PADDLE_API_KEY, {
    environment: PADDLE_SANDBOX ? Environment.sandbox : Environment.production,
  });

  try {
    await paddle.subscriptions.update(subscription.paddleSubscriptionId, {
      items: [{ priceId: paddlePriceId(tier, period), quantity: 1 }],
      /* **Charged now, and effective now.** The convention for an upgrade, and
         the honest one: a writer pressing "Upgrade to Writer" wants the
         assistant in this sitting, not at the end of the month they have
         already paid for. Paddle works the difference out itself — a Draft
         writer eleven days into a month pays for nineteen days of Writer, not
         a whole one.

         It reads the same way going down: the credit for the plan being left
         lands against the cheaper one, so nobody is charged twice for one
         period. */
      prorationBillingMode: "prorated_immediately",
    });
  } catch (error) {
    console.error("[billing] paddle plan change failed", {
      code: paddleErrorCode(error),
      error,
    });

    // The same division the checkout route draws: a setting nobody has made yet
    // is not a glitch, and must not be described as one.
    if (isPaddleSetupFault(error)) {
      return Response.json(
        { error: "Changing plan isn't available on this deployment yet." },
        { status: 503 },
      );
    }

    return Response.json({ error: "Could not change the plan." }, { status: 502 });
  }

  /* `ok`, not the new plan. The webhook is what writes it, and answering with a
     tier this route merely *asked* for would be the page believing the gateway's
     return instead of its notification. `/upgrade` refreshes and reads it back. */
  return Response.json({ ok: true });
}
