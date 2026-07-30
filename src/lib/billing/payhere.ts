/**
 * Where PayHere is, and whether this deployment has one at all.
 *
 * Billing is optional the same way accounts and the API keys are optional: with
 * the merchant credentials unset there is no gateway, nothing is gated, and the
 * pricing page says so plainly instead of offering a button that cannot charge
 * anybody. A fresh clone still runs.
 *
 * Server-side only, and none of these names carry a NEXT_PUBLIC_ prefix — which
 * is what keeps the merchant secret out of the browser bundle, since that
 * prefix is the only thing Next inlines. Read from a client component these
 * would all be empty strings, so an accidental import fails closed rather than
 * leaking: `isBillingConfigured()` simply answers false.
 */

export const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID ?? "";
export const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET ?? "";

/**
 * The Subscription Manager credentials — a second, separate pair, made under
 * Domains & Credentials in the merchant portal. Only cancelling needs them, so
 * they are optional on their own: checkout works without them.
 */
export const APP_ID = process.env.PAYHERE_APP_ID ?? "";
export const APP_SECRET = process.env.PAYHERE_APP_SECRET ?? "";

/**
 * Sandbox unless told otherwise. The safe way round: a missing or fat-fingered
 * PAYHERE_MODE takes test cards, it does not take real ones.
 */
export const SANDBOX = process.env.PAYHERE_MODE !== "live";

/** Checkout, the OAuth token and the subscription API all hang off this. */
export function payhereOrigin(): string {
  return SANDBOX ? "https://sandbox.payhere.lk" : "https://www.payhere.lk";
}

export function checkoutUrl(): string {
  return `${payhereOrigin()}/pay/checkout`;
}

/** True once a merchant id and secret are set. Checked before anything charges. */
export function isBillingConfigured(): boolean {
  return MERCHANT_ID.length > 0 && MERCHANT_SECRET.length > 0;
}

/** True once cancelling can be done from inside the app rather than by email. */
export function canManageSubscriptions(): boolean {
  return isBillingConfigured() && APP_ID.length > 0 && APP_SECRET.length > 0;
}

/**
 * Our own public address.
 *
 * PayHere needs three absolute URLs — where to send the writer back, where to
 * send them on cancel, and where to post the notification. The last of those is
 * called by PayHere's servers, not the browser, so it cannot be a relative path
 * and it cannot be localhost: nothing outside this machine can reach that. See
 * PAYHERE_NOTIFY_URL below for how to test locally.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Vercel knows its own production domain without being told.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

/**
 * Where PayHere posts the result.
 *
 * Overridable on its own so a tunnel (ngrok, cloudflared) can receive
 * notifications while the app itself is still running on localhost — the one
 * part of the flow that cannot be tested without a public address.
 */
export function notifyUrl(): string {
  return process.env.PAYHERE_NOTIFY_URL || `${siteUrl()}/api/billing/notify`;
}

/** What to tell a writer who reaches a checkout with no merchant behind it. */
export const NOT_CONFIGURED =
  "Payments aren't configured. Add PAYHERE_MERCHANT_ID and " +
  "PAYHERE_MERCHANT_SECRET to .env.local and restart the dev server.";
