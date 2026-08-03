import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/upgrade/checkout-form";
import {
  MERCHANT_ID,
  MERCHANT_SECRET,
  SANDBOX,
  checkoutUrl,
  isBillingConfigured,
  notifyUrl,
  siteUrl,
} from "@/lib/billing/payhere";
import {
  asPeriod,
  cycleLabel,
  displayPrice,
  durationOf,
  itemNameOf,
  payhereAmount,
  recurrenceOf,
} from "@/lib/billing/plans";
import { checkoutHash } from "@/lib/billing/signature";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * The last screen before PayHere.
 *
 * It exists for two reasons that are easy to miss. The first is the hash:
 * PayHere refuses a checkout that is not signed with the merchant secret, and
 * that secret may only ever be touched on a server — so the fields have to be
 * assembled here and handed to the browser already signed.
 *
 * The second is that PayHere requires a name, a phone number and an address,
 * and OpenChapter has never asked for any of them. A writer only ever gave us
 * an email. So this page collects them, once, on the way past — which is also
 * the honest place for it, right next to the amount about to be charged.
 *
 * Nothing here decides anything. The order was created by the Server Action
 * that sent the writer here, so this page only reads it; a refresh re-signs the
 * same order rather than starting a second one, and the back button is harmless.
 */

export const metadata = {
  title: "Checkout · OpenChapter",
};

export default async function CheckoutPage(
  props: PageProps<"/upgrade/checkout/[orderId]">,
) {
  const { orderId } = await props.params;

  if (!isSupabaseConfigured() || !isBillingConfigured()) redirect("/upgrade");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/signin?next=/upgrade");

  // Row-level security scopes this to the signed-in writer, so somebody else's
  // order id simply finds nothing rather than needing a check of its own.
  const { data: order } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  // A paid or abandoned order is not something to pay again. Back to the plans,
  // where the state of things is described rather than assumed.
  if (!order || order.status !== "pending") redirect("/upgrade");

  const period = asPeriod(order.period) ?? "monthly";
  const amount = payhereAmount(Number(order.amount));
  const currency = String(order.currency);

  const hash = checkoutHash({
    merchantId: MERCHANT_ID,
    orderId,
    amount,
    currency,
    merchantSecret: MERCHANT_SECRET,
  });

  const base = siteUrl();

  return (
    <CheckoutForm
      action={checkoutUrl()}
      sandbox={SANDBOX}
      summary={{
        item: itemNameOf(period),
        price: displayPrice(Number(order.amount), currency === "LKR" ? "LKR" : "USD"),
        cycle: cycleLabel(period),
      }}
      email={typeof claims.email === "string" ? claims.email : ""}
      /* Everything PayHere is signed against, plus the two fields it hands back
         on the notification. custom_1 is the writer — the webhook has no session
         and this is how it knows whose subscription it is looking at; it is
         covered by the signature, so it cannot be swapped for somebody else's. */
      fields={{
        merchant_id: MERCHANT_ID,
        return_url: `${base}/upgrade/done?order=${encodeURIComponent(orderId)}`,
        cancel_url: `${base}/upgrade?cancelled=1`,
        notify_url: notifyUrl(),
        order_id: orderId,
        items: itemNameOf(period),
        currency,
        amount,
        hash,
        /* Spread rather than set, because for a lifetime purchase these two
           must be *absent* and not empty. PayHere reads the presence of
           `recurrence` and `duration` as "make this repeat" — an empty string
           is still a field, and shipping one against a $199 order would set up
           a $199 monthly authorisation. `recurrenceOf` returns null for
           exactly this, so the object below has no such keys at all. */
        ...(recurrenceOf(period) && durationOf(period)
          ? { recurrence: recurrenceOf(period)!, duration: durationOf(period)! }
          : {}),
        custom_1: String(claims.sub),
        custom_2: period,
      }}
    />
  );
}
