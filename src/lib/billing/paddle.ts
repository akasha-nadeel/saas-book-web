/**
 * Where Paddle is, and whether this deployment has one at all.
 *
 * The second gateway, and the reason there are two is written down in TODO.md:
 * PayHere cannot sell a subscription without a business registration and a
 * LKR 3,990/month plan, while Paddle costs nothing until it is paid. Paddle is
 * also a **merchant of record** — it is the legal seller, so worldwide sales
 * tax is its problem rather than ours. That is most of why it wins at this size
 * and most of why it stops winning later.
 *
 * PayHere's module is deliberately left intact beside this one. It is verified
 * against its sandbox end to end and it becomes the cheaper answer at around
 * eighteen subscribers; deleting it would mean building it again.
 *
 * Server-side only, with one exception. None of these names carry a
 * NEXT_PUBLIC_ prefix except the client token, which is *designed* to be public
 * — it is what Paddle.js authenticates with in the browser and it can do
 * nothing but open a checkout. The API key and the webhook secret must never
 * appear in a client component: read from one they would be empty strings, so
 * `isPaddleConfigured()` answers false and nothing leaks.
 */

/** Server-side. Creates transactions and cancels subscriptions. */
export const PADDLE_API_KEY = process.env.PADDLE_API_KEY ?? "";

/**
 * The endpoint secret of the notification destination, `pdl_ntfset_…`.
 *
 * One per destination in the Paddle dashboard, and the *only* thing that
 * distinguishes a real notification from a POST anybody can make: the webhook
 * URL is public and its body is entirely attacker-shaped.
 */
export const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET ?? "";

/**
 * Public by design. Paddle.js needs it in the browser, it is scoped to opening
 * checkouts, and Paddle's own documentation prints it in an HTML snippet.
 */
export const PADDLE_CLIENT_TOKEN =
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

/**
 * Which Paddle this deployment is talking to, and why it is not simply a flag.
 *
 * `PADDLE_ENV` still decides when it is set, and it is the only thing that can
 * *choose* — a deployment saying `production` gets production whatever its keys
 * look like, because an explicit setting is a statement rather than a hint.
 *
 * When it says nothing the credentials are asked, because **they each name
 * their own environment**: Paddle issues `pdl_live_…` / `pdl_sdbx_…` API keys
 * and `live_…` / `test_…` client tokens, and a credential cannot be wrong about
 * where it came from. The default stays sandbox for anything unrecognised.
 *
 * This is here because the mismatch is silent and expensive. Paddle.js refuses
 * to start with a live token against the sandbox and the API answers 401 to a
 * live key aimed at it, so a half-configured deployment gets a checkout that
 * never opens and a route that will not create a transaction — with nothing on
 * screen naming the cause. Reading the keys removes the whole class.
 *
 * Pure, and exported for the test rather than for a caller.
 */
export function paddleSandboxFrom(
  explicit: string | undefined,
  apiKey: string,
  clientToken: string,
): boolean {
  if (explicit === "production") return false;
  if (explicit === "sandbox") return true;

  if (apiKey.startsWith("pdl_live_") || clientToken.startsWith("live_")) {
    return false;
  }

  return true;
}

/**
 * `sandbox` unless the environment or the keys say production.
 *
 * Read in the browser too, through `paddleClientConfig()`. `PADDLE_ENV` carries
 * no NEXT_PUBLIC_ prefix so it is `undefined` there by construction — which is
 * exactly why the client token has to be able to answer for itself.
 */
export const PADDLE_SANDBOX = paddleSandboxFrom(
  process.env.PADDLE_ENV,
  PADDLE_API_KEY,
  PADDLE_CLIENT_TOKEN,
);

/**
 * The two prices, made once in the Paddle dashboard.
 *
 * Server-side on purpose. The transaction is created by our own route rather
 * than by the browser (see `/api/billing/paddle/checkout`), so the price the
 * writer is charged is chosen here and cannot be swapped for a cheaper one by
 * anybody reading the page source.
 */
const PRICE_IDS = {
  monthly: process.env.PADDLE_PRICE_MONTHLY ?? "",
  annual: process.env.PADDLE_PRICE_ANNUAL ?? "",
} as const;

export function paddlePriceId(period: "monthly" | "annual"): string {
  return PRICE_IDS[period];
}

/**
 * True once Paddle can actually take money. All four are required: a client
 * token with no API key opens a checkout nothing can create, and an API key
 * with no webhook secret takes payments nobody is granted for.
 */
export function isPaddleConfigured(): boolean {
  return (
    PADDLE_API_KEY.length > 0 &&
    PADDLE_WEBHOOK_SECRET.length > 0 &&
    PADDLE_CLIENT_TOKEN.length > 0 &&
    PRICE_IDS.monthly.length > 0 &&
    PRICE_IDS.annual.length > 0
  );
}

/**
 * What Paddle's subscription state means in our three words.
 *
 * **A cancelled Paddle subscription says `active` right up until the period
 * ends**, and announces the cancellation in `scheduled_change` instead. That is
 * correct of Paddle — the writer has paid to the 9th and is entitled to it —
 * and it cost us a bug the first time round: cancelling wrote `cancelled` to
 * our row, Paddle's `subscription.updated` landed a second later saying
 * `active`, and this mapping faithfully undid the cancellation. The account
 * menu then offered a Cancel button for a subscription that was already
 * cancelled, and promised a renewal that was never going to happen.
 *
 * So the scheduled change is read *first*. Everything else is the plain status.
 *
 * Pure and tested, which is why it lives here rather than in the route: it is
 * the one piece of the webhook that is a judgement rather than a field lookup.
 */
export function paddleStatus(
  status: string,
  scheduledAction?: string | null,
): "active" | "past_due" | "cancelled" | null {
  // A cancel already agreed with Paddle, whatever the status still says.
  if (scheduledAction === "cancel") return "cancelled";

  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "paused":
      // Paused is not cancelled at Paddle, but it is not being charged for
      // either, and this table has no fourth word. Treating it as cancelled is
      // the safe direction: `isPro()` runs it to the paid-up date and then
      // stops, rather than serving Pro indefinitely for nothing.
      return "cancelled";
    default:
      return null;
  }
}

/**
 * Paddle's own code for a refusal, or null if this was not Paddle refusing.
 *
 * The SDK throws an object carrying `code`, `type` and a `detail` written for
 * whoever set the account up. None of it should reach a writer — "no default
 * payment link has been set" is not their problem and not their sentence — but
 * all of it belongs in the log, and the code is what decides which of the two
 * things we can honestly say is true.
 */
export function paddleErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

/**
 * The refusals that no amount of trying again will fix.
 *
 * Every one of them means somebody has to go and change something — in the
 * Paddle dashboard or in this deployment's environment — and until they do,
 * the request will fail identically every time. Telling a writer to "try again
 * shortly" in that state is sending them round a loop with no exit, which is
 * the specific failure this set exists to prevent.
 *
 * `transaction_default_checkout_url_not_set` is the one that has actually
 * happened: a live Paddle account with valid keys and active prices still
 * refuses to create a transaction until a default payment link is set under
 * Checkout settings, and the button reported a temporary glitch for it.
 *
 * Codes are added here only once they have been *seen*. A guessed code that
 * Paddle does not send is a branch that never runs.
 */
const PADDLE_SETUP_FAULTS = new Set([
  "transaction_default_checkout_url_not_set",
  "forbidden",
  "authentication_missing",
  "invalid_token",
  "paddle_billing_not_enabled",
]);

/** True when the refusal is somebody's to fix rather than something to retry. */
export function isPaddleSetupFault(error: unknown): boolean {
  const code = paddleErrorCode(error);
  return code !== null && PADDLE_SETUP_FAULTS.has(code);
}

/**
 * What the browser needs and nothing else.
 *
 * A single function rather than two exports because the environment and the
 * token have to agree — a production token against the sandbox environment
 * fails at the checkout with a message about neither.
 */
export function paddleClientConfig(): {
  token: string;
  environment: "sandbox" | "production";
} {
  return {
    token: PADDLE_CLIENT_TOKEN,
    environment: PADDLE_SANDBOX ? "sandbox" : "production",
  };
}
