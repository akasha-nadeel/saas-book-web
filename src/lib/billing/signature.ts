import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The two MD5s PayHere runs on: one we send, one we check.
 *
 * MD5 is not a choice here — it is what the gateway specifies, on both sides.
 * It is not being used to protect anything at rest; it is a shared-secret
 * checksum over fields the gateway also knows, and the security of it rests
 * entirely on the merchant secret never leaving the server. Which is why this
 * module is server-only: import it from a client component and Next will hand
 * the secret to the browser.
 *
 * Both formulas are PayHere's, verbatim:
 *
 *   hash   = upper(md5(merchant_id + order_id + amount + currency + upper(md5(secret))))
 *   md5sig = upper(md5(merchant_id + order_id + payhere_amount + payhere_currency
 *                      + status_code + upper(md5(secret))))
 *
 * The amount is a *string* in both, and the caller passes the same string it
 * sends (or was sent). Re-formatting a number here would be a second opinion on
 * something that has already been decided — see payhereAmount() in plans.ts.
 */

function md5(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

/** The secret, hashed and upper-cased. The inner half of both formulas. */
function secretDigest(merchantSecret: string): string {
  return md5(merchantSecret).toUpperCase();
}

/**
 * The `hash` field posted to the checkout page. Without it PayHere rejects the
 * request outright — it has been mandatory since 2022.
 */
export function checkoutHash(params: {
  merchantId: string;
  orderId: string;
  /** Already formatted to two decimals. */
  amount: string;
  currency: string;
  merchantSecret: string;
}): string {
  const { merchantId, orderId, amount, currency, merchantSecret } = params;
  return md5(
    merchantId + orderId + amount + currency + secretDigest(merchantSecret),
  ).toUpperCase();
}

/** What the `md5sig` on an incoming notification should be. */
export function notificationSignature(params: {
  merchantId: string;
  orderId: string;
  /** PayHere's `payhere_amount`, used exactly as it arrived. */
  amount: string;
  currency: string;
  /** PayHere's `status_code`, as a string, exactly as it arrived. */
  statusCode: string;
  merchantSecret: string;
}): string {
  const { merchantId, orderId, amount, currency, statusCode, merchantSecret } =
    params;
  return md5(
    merchantId +
      orderId +
      amount +
      currency +
      statusCode +
      secretDigest(merchantSecret),
  ).toUpperCase();
}

/**
 * Is this notification genuinely from PayHere?
 *
 * The one check that matters on the webhook. Nothing else about that request
 * proves anything — the URL is public and the body is attacker-controllable, so
 * an unverified notification is a stranger writing "paid" into your database.
 *
 * Compared in constant time. The window is narrow and the secret is not being
 * guessed a byte at a time over the internet in practice, but a comparison that
 * returns early on the first wrong character is free to avoid.
 */
export function verifyNotification(
  received: string | null | undefined,
  expected: string,
): boolean {
  if (!received || received.length !== expected.length) return false;
  return timingSafeEqual(
    Buffer.from(received.toUpperCase(), "utf8"),
    Buffer.from(expected, "utf8"),
  );
}
