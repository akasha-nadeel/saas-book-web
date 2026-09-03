import type { PaidTier, PlanTier } from "./tiers";
import type { Period } from "./plans";
import type { Provider } from "./provider";

/**
 * What a subscription is, and when it entitles someone to anything.
 *
 * Pure, so the one question the whole app asks of billing — "is this writer on
 * Pro right now" — has a single tested answer rather than a date comparison
 * written slightly differently at each call site.
 */

/** PayHere's `status_code`, as it arrives on a notification. */
export const STATUS_CODE = {
  success: 2,
  pending: 0,
  canceled: -1,
  failed: -2,
  chargedback: -3,
} as const;

/** What one payment attempt came to. */
export type PaymentStatus =
  | "paid"
  | "pending"
  | "cancelled"
  | "failed"
  | "chargedback"
  | "unknown";

export function paymentStatusFromCode(code: number): PaymentStatus {
  switch (code) {
    case STATUS_CODE.success:
      return "paid";
    case STATUS_CODE.pending:
      return "pending";
    case STATUS_CODE.canceled:
      return "cancelled";
    case STATUS_CODE.failed:
      return "failed";
    case STATUS_CODE.chargedback:
      return "chargedback";
    default:
      return "unknown";
  }
}

/**
 * Where a subscription stands.
 *
 * `cancelled` is not the same as gone: PayHere stops charging, and the writer
 * keeps what they paid for until the period they already bought runs out.
 * `past_due` is a renewal that failed — PayHere retries, so the plan is not torn
 * up on the first miss.
 */
export type SubscriptionStatus = "active" | "past_due" | "cancelled";

/**
 * Which plan a subscription entitles its owner to *right now*.
 *
 * `isPro`'s date arithmetic decides whether the row still counts; the row's own
 * `tier` decides what it counts *as*. One rule, one place — a second date
 * comparison here would be a second answer to "is this still paid for".
 */
export function planTierOf(
  subscription: Subscription | null,
  now: Date = new Date(),
): PlanTier {
  return isPro(subscription, now) ? subscription!.tier : "free";
}

export interface Subscription {
  /**
   * Which gateway this one was bought through, and it is a fact about the row
   * rather than about the deployment. A writer who subscribed through PayHere
   * keeps being cancelled at PayHere after the app has moved to Paddle for new
   * checkouts — the alternative is telling somebody they are cancelled while
   * their card goes on being charged.
   */
  provider: Provider;
  /**
   * Which of the three paid plans this row bought.
   *
   * Narrowed on the way in, so nothing downstream has to wonder what a `plan`
   * column might hold. A row whose plan does not narrow is refused entirely by
   * `toSubscription` — the same treatment an unknown status or period already
   * gets, and for the same reason: a subscription that cannot be described is
   * not one to act on.
   */
  tier: PaidTier;
  status: SubscriptionStatus;
  period: Period;
  /** The end of the cycle that has been paid for. */
  currentPeriodEnd: Date | null;
  /** PayHere's id for the recurring authorisation, if it has told us one yet. */
  payhereSubscriptionId: string | null;
  /** Paddle's id for the subscription, likewise. `sub_…`. */
  paddleSubscriptionId: string | null;
  cancelledAt: Date | null;
}

/**
 * How long past the paid-up date access survives.
 *
 * A renewal charge and its notification do not land on the stroke of the hour,
 * and a card that needs one retry is a normal Tuesday, not a lapsed customer.
 * Three days is short enough that a genuinely dead subscription closes within
 * the week and long enough that nobody loses the assistant mid-sentence over
 * PayHere's queue.
 */
const GRACE_DAYS = 3;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Is this subscription entitling the writer to Pro at `now`?
 *
 * A cancelled one gets no grace: the writer asked for it to stop, so it stops
 * the moment the paid period ends rather than three days later.
 */
export function isPro(
  subscription: Subscription | null,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false;

  const end = subscription.currentPeriodEnd;
  // An active subscription with no end date recorded is one whose first
  // notification has not arrived. It is not yet paid for, so it is not yet Pro.
  if (!end) return false;

  const grace = subscription.status === "cancelled" ? 0 : GRACE_DAYS * DAY;
  return now.getTime() <= end.getTime() + grace;
}

/** Narrows a status off a database row. */
export function asSubscriptionStatus(value: unknown): SubscriptionStatus | null {
  return value === "active" || value === "past_due" || value === "cancelled"
    ? value
    : null;
}
