import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { asPeriod } from "@/lib/billing/plans";
import {
  PADDLE_API_KEY,
  PADDLE_SANDBOX,
  isPaddleConfigured,
  paddleErrorCode,
  paddlePriceId,
} from "@/lib/billing/paddle";
import { currentSubscription } from "@/lib/billing/server";
import { asPaidTier } from "@/lib/billing/tiers";

/**
 * What a plan change would cost, before anybody is charged for it.
 *
 * **A plan change takes money on the press and used to name no figure.** The
 * card said "Switch to Draft" under a $7.98 heading and attempted $68.61,
 * because the cycle toggle was on annual and the charge is the whole year
 * prorated — a writer had no way to know that until it had either gone through
 * or been declined. Every other place money moves in this app says the amount
 * first; this was the one that did not.
 *
 * **The figure is Paddle's, not ours.** `previewUpdate` runs the same
 * arithmetic the real update runs — proration, credit for the unused part of
 * the current period, tax — and returns what it would actually collect. We
 * could compute a difference from `plans.ts` and be roughly right, and roughly
 * right is exactly the invented number the house rules refuse: a writer shown
 * "about $1" and charged $68.61 is worse off than one shown nothing.
 *
 * Read-only. It creates no transaction and moves nothing, so it is safe to call
 * on a press that has not been confirmed yet.
 *
 * The guards are the change route's, in the same order and for the same
 * reasons — a preview of a change that would be refused is a figure with
 * nothing behind it.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isPaddleConfigured()) {
    return Response.json({ error: "Paddle not configured" }, { status: 501 });
  }

  const { subscription } = await currentSubscription();

  if (!subscription?.paddleSubscriptionId) {
    return Response.json(
      { error: "There is no Paddle subscription on this account to change." },
      { status: 400 },
    );
  }

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
    const preview = await paddle.subscriptions.previewUpdate(
      subscription.paddleSubscriptionId,
      {
        items: [{ priceId: paddlePriceId(tier, period), quantity: 1 }],
        /* The same mode the change itself asks for. A preview of a *different*
           proration than the one we will run is a lie with extra steps. */
        prorationBillingMode: "prorated_immediately",
      },
    );

    const result = preview.updateSummary?.result;
    if (!result) {
      /* No summary means Paddle worked out that nothing moves now — a change
         with no immediate money, which is a real answer rather than a failure.
         Said as `null` so the button can word it rather than print "$0.00". */
      return Response.json({ action: null, amount: null });
    }

    /* Paddle sends money in the currency's smallest unit, as a string. The same
       hundredfold error the notify route guards against. */
    const minor = Number(result.amount);

    return Response.json({
      action: result.action,
      amount: Number.isFinite(minor) ? minor / 100 : null,
      currency: result.currencyCode,
    });
  } catch (error) {
    console.error("[billing] paddle plan preview failed", {
      code: paddleErrorCode(error),
      error,
    });

    /* **A preview that fails must not block the press.** It is a courtesy on
       the way to the real call, which does its own refusing with its own
       messages — answering 502 here and letting the button fall back to asking
       without a figure is better than telling somebody their plan change is
       broken when it may not be. */
    return Response.json(
      { error: "Could not work out the amount." },
      { status: 502 },
    );
  }
}
