import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import {
  PADDLE_API_KEY,
  PADDLE_SANDBOX,
  PADDLE_WEBHOOK_SECRET,
  isPaddleConfigured,
  paddlePriceId,
  paddleStatus,
} from "@/lib/billing/paddle";
import type { Period } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Paddle's notifications, and the only thing in the app that grants Pro.
 *
 * The same rule PayHere's webhook follows and for the same reasons. This route
 * has no session and no cookies — it is a POST from Paddle's servers — so it
 * writes with the secret key, and `authenticated` has no insert or update grant
 * on `subscriptions` at all. Nothing a browser sends decides what is paid for.
 *
 * **The URL is public and the body is entirely attacker-shaped.** `unmarshal`
 * against the endpoint secret is the whole of what stands between that and a
 * stranger writing "paid" into the table: it verifies the HMAC in the
 * `Paddle-Signature` header and refuses a replayed timestamp. A bad signature
 * is 403 and is never retried.
 *
 * **Idempotency comes free here, unlike with PayHere.** PayHere sends "extend
 * by one cycle", so a retried notification had to be refused by primary key or
 * it would extend twice. Paddle sends the *absolute* period end, so writing the
 * same event twice writes the same date twice. The transaction row still has
 * the transaction id as its key, because a duplicate charge in the ledger would
 * be a lie about how much somebody paid.
 *
 * **Whose row to write** is `custom_data.userId`, which our own checkout route
 * puts there server-side — the browser never chooses it, which is the whole
 * reason that route exists rather than opening a checkout from a price id.
 * Paddle's customer id is the fallback: it is on every subscription event, and
 * a renewal two years from now may arrive with custom data we no longer
 * recognise. A notification that resolves to nobody is logged and answered 200,
 * because a retry would resolve to nobody again.
 */

export const dynamic = "force-dynamic";

/**
 * Which cycle this is, decided by the price id we sent rather than by the
 * billing interval Paddle reports back.
 *
 * The interval would work today and would quietly break the day somebody adds a
 * quarterly price: `period` is a CHECK constraint of two values, and a row that
 * fails it aborts the write for a payment that has already been taken.
 */
function periodFrom(priceIds: (string | undefined)[]): Period | null {
  if (priceIds.includes(paddlePriceId("annual"))) return "annual";
  if (priceIds.includes(paddlePriceId("monthly"))) return "monthly";
  return null;
}

export async function POST(request: Request) {
  if (!isPaddleConfigured()) {
    return Response.json({ error: "Paddle is not configured." }, { status: 501 });
  }

  const signature = request.headers.get("paddle-signature");
  if (!signature) {
    return Response.json({ error: "Unsigned." }, { status: 403 });
  }

  // The raw text, not the parsed body: the signature covers the bytes Paddle
  // sent, and re-serialising a parsed object changes them.
  const raw = await request.text();

  const paddle = new Paddle(PADDLE_API_KEY, {
    environment: PADDLE_SANDBOX ? Environment.sandbox : Environment.production,
  });

  let event;
  try {
    event = await paddle.webhooks.unmarshal(raw, PADDLE_WEBHOOK_SECRET, signature);
  } catch (error) {
    console.error("[billing] paddle signature refused", error);
    return Response.json({ error: "Bad signature." }, { status: 403 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    // The one failure worth a 500: Paddle retries a non-200, and this one
    // genuinely should come back. Everything else here answers 200 and logs,
    // because a retry would fail the same way for ever.
    console.error("[billing] paddle notification with no SUPABASE_SECRET_KEY");
    return Response.json({ error: "Storage unavailable." }, { status: 500 });
  }

  // Through `unknown` deliberately. `event.data` is a union of every entity
  // Paddle can send, and reading it as a bag of fields is the point: the shape
  // is narrowed field by field below, the same way the sync mapping narrows a
  // database row, because what arrives is whatever Paddle's API sends today.
  const data = event.data as unknown as Record<string, unknown>;
  const custom = (data.customData ?? null) as { userId?: unknown } | null;
  const fromCustom = typeof custom?.userId === "string" ? custom.userId : null;
  const customerId =
    typeof data.customerId === "string" ? data.customerId : null;

  /** Whose subscription this is: what we stamped, then who we already know. */
  async function ownerOf(): Promise<string | null> {
    if (fromCustom) return fromCustom;
    if (!customerId) return null;

    const { data: row } = await supabase!
      .from("subscriptions")
      .select("owner")
      .eq("paddle_customer_id", customerId)
      .maybeSingle();

    return typeof row?.owner === "string" ? row.owner : null;
  }

  if (event.eventType.startsWith("subscription.")) {
    const owner = await ownerOf();
    if (!owner) {
      console.error("[billing] paddle subscription event for nobody", {
        eventType: event.eventType,
        customerId,
      });
      return Response.json({ ok: true, granted: false });
    }

    // Read *before* the status, because a Paddle subscription cancelled for
    // the end of its period still reports `active`. See `paddleStatus`.
    const scheduled = data.scheduledChange as
      | { action?: unknown; effectiveAt?: unknown }
      | null;
    const scheduledAction =
      typeof scheduled?.action === "string" ? scheduled.action : null;

    const status = paddleStatus(String(data.status), scheduledAction);
    const items = Array.isArray(data.items) ? data.items : [];
    const period = periodFrom(
      items.map((item) => {
        const price = (item as { price?: { id?: unknown } }).price;
        return typeof price?.id === "string" ? price.id : undefined;
      }),
    );

    if (!status || !period) {
      // A status or a price this version does not know about. Recorded rather
      // than guessed at — writing a row that fails a CHECK would abort the
      // whole request for a payment already taken.
      console.error("[billing] paddle subscription in an unknown shape", {
        status: data.status,
        eventType: event.eventType,
      });
      return Response.json({ ok: true, granted: false });
    }

    const billingPeriod = data.currentBillingPeriod as { endsAt?: unknown } | null;
    const endsAt =
      typeof billingPeriod?.endsAt === "string" ? billingPeriod.endsAt : null;
    /*
     * When it was cancelled, and a scheduled cancel has no such date yet:
     * Paddle leaves `canceled_at` null until the period actually runs out, so
     * a row cancelled today would come back with nothing recorded and read as
     * a plan nobody had touched. The scheduled change's own effective date is
     * used instead — it is the moment the cancellation takes hold, it is
     * stable across the repeat notifications Paddle sends, and it is the only
     * honest date available at this point.
     */
    const canceledAt =
      typeof data.canceledAt === "string"
        ? data.canceledAt
        : scheduledAction === "cancel" && typeof scheduled?.effectiveAt === "string"
          ? scheduled.effectiveAt
          : null;

    const { error } = await supabase.from("subscriptions").upsert(
      {
        owner,
        provider: "paddle",
        plan: "pro",
        period,
        status,
        paddle_subscription_id: typeof data.id === "string" ? data.id : null,
        paddle_customer_id: customerId,
        current_period_end: endsAt,
        cancelled_at: canceledAt,
      },
      { onConflict: "owner" },
    );

    if (error) {
      console.error("[billing] paddle subscription write failed", error);
      return Response.json({ error: "Could not store." }, { status: 500 });
    }

    return Response.json({ ok: true, granted: status === "active" });
  }

  if (event.eventType === "transaction.completed") {
    const owner = await ownerOf();
    if (!owner) {
      console.error("[billing] paddle transaction for nobody", { customerId });
      return Response.json({ ok: true, recorded: false });
    }

    const details = data.details as
      | { totals?: { grandTotal?: unknown; currencyCode?: unknown } }
      | null;
    const total = details?.totals?.grandTotal;

    // Paddle sends money in the currency's smallest unit as a string — "999"
    // is $9.99. Storing it raw would put a hundredfold error in the ledger.
    const amount =
      typeof total === "string" && total.length > 0 ? Number(total) / 100 : null;

    const { error } = await supabase.from("payment_events").upsert(
      {
        payment_id: typeof data.id === "string" ? data.id : event.eventId,
        order_id: typeof data.id === "string" ? data.id : event.eventId,
        owner,
        provider: "paddle",
        amount: Number.isFinite(amount) ? amount : null,
        currency:
          typeof data.currencyCode === "string" ? data.currencyCode : null,
        event_type: event.eventType,
        subscription_id:
          typeof data.subscriptionId === "string" ? data.subscriptionId : null,
      },
      { onConflict: "payment_id", ignoreDuplicates: true },
    );

    if (error) {
      console.error("[billing] paddle transaction write failed", error);
      return Response.json({ error: "Could not store." }, { status: 500 });
    }

    // The order this began as, if we started one. Paddle's transaction id is
    // what our checkout route wrote as the order id, so this closes the loop
    // the same way PayHere's does.
    await supabase
      .from("payment_orders")
      .update({ status: "paid" })
      .eq("order_id", typeof data.id === "string" ? data.id : "");

    return Response.json({ ok: true, recorded: true });
  }

  // Anything else Paddle chooses to send. Answered rather than refused: a 200
  // is what stops it retrying an event we were never going to act on.
  return Response.json({ ok: true, ignored: event.eventType });
}
