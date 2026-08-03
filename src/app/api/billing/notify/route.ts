import { verifyNotification, notificationSignature } from "@/lib/billing/signature";
import { MERCHANT_ID, MERCHANT_SECRET, isBillingConfigured } from "@/lib/billing/payhere";
import { asPeriod, periodEnd, type Period } from "@/lib/billing/plans";
import { paymentStatusFromCode } from "@/lib/billing/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PayHere's payment notification. The only thing in the app that grants Pro.
 *
 * Not a redirect and not a callback the browser makes — PayHere's servers POST
 * here, form-encoded, once per charge, including every automatic renewal months
 * later when nobody is looking at a screen. So it has no session, no cookies
 * and no user; it identifies the writer from the order it is answering.
 *
 * Three properties this has to have, and each one is a real failure if missed:
 *
 *   - **Verified.** The URL is public and the body is entirely attacker-shaped.
 *     Nothing here is believed before the md5sig checks out against the merchant
 *     secret; an unverified notification is a stranger writing "paid" into the
 *     subscriptions table.
 *   - **Idempotent.** PayHere retries anything it did not get a 200 for. The
 *     payment id is the primary key of payment_events, so a retry collides and
 *     stops rather than extending the period a second time.
 *   - **Quick to answer 200.** A slow or erroring endpoint gets retried and,
 *     eventually, gives up. Anything we cannot act on is logged and accepted
 *     rather than left to bounce forever — except a bad signature, which is
 *     refused outright because it should never be retried.
 *
 * The proxy skips /api on purpose, so nothing redirects this to a sign-in page.
 */

/** Renewals arrive months apart; nothing about this response may be cached. */
export const dynamic = "force-dynamic";

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  if (!isBillingConfigured()) {
    // Nothing could have been charged, so nothing can be being reported.
    return new Response("Billing is not configured.", { status: 501 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Expected form-encoded fields.", { status: 400 });
  }

  const merchantId = field(form, "merchant_id");
  const orderId = field(form, "order_id");
  const paymentId = field(form, "payment_id");
  const amount = field(form, "payhere_amount");
  const currency = field(form, "payhere_currency");
  const statusCode = field(form, "status_code");
  const md5sig = field(form, "md5sig");

  // Ours, and correctly signed. Everything past this point is trustworthy in
  // the only sense that matters: PayHere and no one else composed it.
  const expected = notificationSignature({
    merchantId,
    orderId,
    amount,
    currency,
    statusCode,
    merchantSecret: MERCHANT_SECRET,
  });

  if (merchantId !== MERCHANT_ID || !verifyNotification(md5sig, expected)) {
    console.error("[billing] rejected a notification with a bad signature", {
      orderId,
      merchantId,
    });
    return new Response("Bad signature.", { status: 403 });
  }

  if (!orderId || !paymentId) {
    console.error("[billing] verified notification with no order or payment id");
    return new Response("OK", { status: 200 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    // The money moved and we cannot write it down. Answering 500 asks PayHere
    // to retry, which is exactly right: the key may be back by then.
    console.error(
      "[billing] SUPABASE_SECRET_KEY is not set — cannot record payment",
      { orderId, paymentId },
    );
    return new Response("Storage is not configured.", { status: 500 });
  }

  const code = Number.parseInt(statusCode, 10);
  const outcome = paymentStatusFromCode(code);

  // The order row is the *only* thing that says whose payment this is, and the
  // reason is worth spelling out: PayHere's signature covers the merchant, the
  // order, the amount, the currency and the status — and nothing else. The
  // custom_1 field we send the writer's id in is echoed back unsigned, so
  // anyone who can read a checkout form could post one with somebody else's id
  // in it. The row here was written by the Server Action that started the
  // checkout, under row-level security, against a real session. Trusting it
  // instead is the difference between a fact and a claim.
  //
  // It also says what was *meant* to be charged, which the amount check uses.
  const { data: order } = await supabase
    .from("payment_orders")
    .select("owner, period, amount")
    .eq("order_id", orderId)
    .maybeSingle();

  const owner = order?.owner;
  if (!owner) {
    // Nothing to do and nothing to retry: 200 so PayHere stops, and a log
    // loud enough to find, because a real payment with no order behind it is
    // money taken for something the app cannot deliver.
    console.error("[billing] a payment arrived for an order we never started", {
      orderId,
      paymentId,
      claimed: field(form, "custom_1"),
    });
    return new Response("OK", { status: 200 });
  }

  const subscriptionId = field(form, "subscription_id") || null;

  // Idempotency, and the audit trail, in one write. A duplicate payment id is a
  // retry of something already applied: stop here rather than extending twice.
  const { error: seen } = await supabase.from("payment_events").insert({
    payment_id: paymentId,
    order_id: orderId,
    owner,
    amount: amount ? Number(amount) : null,
    currency: currency || null,
    status_code: Number.isFinite(code) ? code : 0,
    method: field(form, "method") || null,
    status_message: field(form, "status_message") || null,
    subscription_id: subscriptionId,
  });

  if (seen) {
    // 23505 is a unique violation — this exact payment has been handled.
    if (seen.code === "23505") return new Response("OK", { status: 200 });

    console.error("[billing] could not record the payment event", seen);
    return new Response("Could not record the payment.", { status: 500 });
  }

  // Only while it is still pending. An order answers one question — how did the
  // checkout that started this go — and a renewal twelve months later must not
  // rewrite that answer. Every charge after the first lives in payment_events.
  await supabase
    .from("payment_orders")
    .update({ status: outcome === "unknown" ? "failed" : outcome })
    .eq("order_id", orderId)
    .eq("status", "pending");

  // From the order for the same reason: custom_2 is unsigned, and an annual
  // cycle claimed on a monthly payment is eleven free months.
  const period = asPeriod(order.period) ?? "monthly";

  if (outcome === "paid") {
    // What was charged has to cover what was quoted. The amount is inside the
    // signature, so this is not about tampering — it catches a plan whose price
    // was changed under a live recurring authorisation, where PayHere would go
    // on charging the old figure indefinitely.
    const paid = Number(amount);
    const quoted = order.amount == null ? paid : Number(order.amount);

    if (Number.isFinite(paid) && paid + 0.005 < quoted) {
      console.error("[billing] paid less than the order quoted; not granting", {
        orderId,
        paid,
        quoted,
      });
      return new Response("OK", { status: 200 });
    }

    await grant(supabase, owner, period, orderId, subscriptionId);
  } else if (outcome === "failed" && subscriptionId) {
    // A renewal that did not go through. PayHere retries on its own schedule,
    // so the plan is marked rather than ended — and isPro()'s grace window is
    // what decides how long a writer keeps working while that plays out.
    await supabase
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("owner", owner)
      .eq("payhere_subscription_id", subscriptionId);
  } else if (outcome === "chargedback") {
    // Money taken back. Access ends now, not at the end of the cycle.
    await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        current_period_end: new Date().toISOString(),
      })
      .eq("owner", owner);
  }

  return new Response("OK", { status: 200 });
}

/**
 * Put a writer on Pro, or keep them there.
 *
 * The new period runs from wherever the paid-up one ended, not from now — a
 * renewal that lands a day early would otherwise quietly cost the writer a day
 * every cycle. From now only when there is nothing left to run from.
 *
 * **A lifetime purchase writes a null `current_period_end`**, which is what
 * `periodEnd` returns for it: there is no date, and putting a far-future
 * sentinel there would have every screen tell the writer their outright
 * purchase renews in the year 2999. `isPro` reads the period for that one and
 * never looks at the date, so the null is safe. It also means a lifetime row
 * cannot be renewed into — there is nothing to extend, and PayHere will never
 * send a second notification for it because the checkout carried no
 * recurrence.
 */
async function grant(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  owner: string,
  period: Period,
  orderId: string,
  subscriptionId: string | null,
) {
  const now = new Date();

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("owner", owner)
    .maybeSingle();

  const previous =
    typeof existing?.current_period_end === "string"
      ? new Date(existing.current_period_end)
      : null;

  const from = previous && previous > now ? previous : now;
  const end = periodEnd(from, period);

  const { error } = await supabase.from("subscriptions").upsert(
    {
      owner,
      plan: "pro",
      period,
      status: "active",
      payhere_subscription_id: subscriptionId,
      payhere_order_id: orderId,
      current_period_end: end ? end.toISOString() : null,
      // A renewal on a subscription the writer had cancelled would be a
      // contradiction, but clearing this is right either way: what is being
      // written here is an active plan.
      cancelled_at: null,
    },
    { onConflict: "owner" },
  );

  if (error) console.error("[billing] could not grant the subscription", error);
}

/**
 * PayHere only ever POSTs here. A GET is somebody checking the URL is alive —
 * usually the merchant portal's own validation — so it gets a plain 200 rather
 * than Next's 405, which reads like a broken endpoint.
 */
export function GET() {
  return new Response("OpenChapter billing notifications.", { status: 200 });
}
