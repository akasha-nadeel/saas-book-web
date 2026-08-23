import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { currentSubscription } from "@/lib/billing/server";
import {
  PADDLE_API_KEY,
  PADDLE_SANDBOX,
  isPaddleConfigured,
  isPaddleSetupFault,
  paddleErrorCode,
} from "@/lib/billing/paddle";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isPaddleConfigured()) {
    return Response.json({ error: "Paddle not configured" }, { status: 501 });
  }

  const { subscription } = await currentSubscription();
  if (!subscription?.paddleSubscriptionId) {
    return Response.json({ error: "No active Paddle subscription" }, { status: 400 });
  }

  const paddle = new Paddle(PADDLE_API_KEY, {
    environment: PADDLE_SANDBOX ? Environment.sandbox : Environment.production,
  });

  try {
    // Generate a zero-amount transaction specifically for updating the card
    const txn = await paddle.subscriptions.getPaymentMethodChangeTransaction(
      subscription.paddleSubscriptionId
    );
    return Response.json({ transactionId: txn.id });
  } catch (error) {
    console.error("[billing] paddle update payment method error", {
      code: paddleErrorCode(error),
      error,
    });

    // Same division as the checkout route: a setting nobody has made yet is not
    // a glitch, and must not be described as one.
    if (isPaddleSetupFault(error)) {
      return Response.json(
        { error: "Updating your card isn't available on this deployment yet." },
        { status: 503 },
      );
    }

    return Response.json({ error: "Could not start update." }, { status: 500 });
  }
}
