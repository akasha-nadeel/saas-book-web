import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { currentSubscription } from "@/lib/billing/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PADDLE_API_KEY, PADDLE_SANDBOX, isPaddleConfigured } from "@/lib/billing/paddle";

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId, subscription } = await currentSubscription();

  if (!userId) {
    return Response.json({ error: "Sign in to manage your plan." }, { status: 401 });
  }

  if (!subscription || subscription.status !== "cancelled") {
    return Response.json({ error: "No cancelled subscription to renew." }, { status: 400 });
  }

  if (subscription.provider === "paddle") {
    if (!isPaddleConfigured()) {
      return Response.json({ error: "Paddle not configured." }, { status: 501 });
    }

    const paddle = new Paddle(PADDLE_API_KEY, {
      environment: PADDLE_SANDBOX ? Environment.sandbox : Environment.production,
    });

    try {
      // Clear the scheduled cancellation
      await paddle.subscriptions.update(subscription.paddleSubscriptionId!, {
        scheduledChange: null,
      });
    } catch (error) {
      console.error("[billing] Paddle refused to resume", error);
      return Response.json({ error: "Could not renew subscription." }, { status: 502 });
    }

    const supabase = createAdminClient();
    if (supabase) {
      await supabase
        .from("subscriptions")
        .update({ status: "active", cancelled_at: null })
        .eq("owner", userId);
    }

    return Response.json({ ok: true });
  }

  return Response.json({ error: "Please resubscribe from the pricing page once your plan expires." }, { status: 501 });
}
