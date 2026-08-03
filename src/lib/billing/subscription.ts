import type { Period } from "./plans";

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

export interface Subscription {
  status: SubscriptionStatus;
  period: Period;
  /** The end of the cycle that has been paid for. */
  currentPeriodEnd: Date | null;
  /** PayHere's id for the recurring authorisation, if it has told us one yet. */
  payhereSubscriptionId: string | null;
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

  /*
   * Bought outright, so there is no date to be past.
   *
   * This is checked before the null guard below and not after, which is the
   * whole of the difference: a lifetime row legitimately has no
   * `currentPeriodEnd` — `periodEnd()` returns null for it because inventing
   * one would put a fictional renewal date on screen — and the guard below
   * reads a missing date as "the first payment has not landed yet". Ordered
   * the other way round, every writer who paid $199 would be refused.
   *
   * A chargeback still ends it: the webhook writes `cancelled` and stamps
   * `cancelled_at`, and that is what this reads. Nothing else cancels a
   * lifetime, because there is no authorisation to stop.
   */
  if (subscription.period === "lifetime") {
    return subscription.status !== "cancelled";
  }

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
