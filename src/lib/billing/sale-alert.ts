import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { CONTACT_EMAIL } from "@/lib/legal";
import {
  PAID_TIERS,
  TIER_NAMES,
  amazonDataAllowed,
  asPaidTier,
  type PaidTier,
} from "./tiers";

/**
 * Where an operational alert goes.
 *
 * **`CONTACT_EMAIL` is the address on the site, which is not the same thing as
 * an address somebody reads.** It is published for writers to reach support at,
 * and on a domain whose mail is set up to *send*; the first twelve plan-interest
 * alerts were accepted by Resend and delivered to a mailbox nobody was
 * watching. An operational alert wants the inbox its owner actually opens, and
 * that is not a fact about the product, so it is configuration rather than a
 * constant.
 *
 * Falls back to the published address, which keeps a self-hosted copy working
 * without a setting and is the right destination when the domain does have a
 * mailbox.
 */
export function alertAddress(): string {
  return process.env.PLAN_INTEREST_ALERT_EMAIL?.trim() || CONTACT_EMAIL;
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Tell the owner a writer has just started paying for Amazon's data.
 *
 * **Why this exists (2026-10-12):** Amazon's data comes from OpenWeb Ninja,
 * paid by the request, and the owner chose to sell Pro Plus before paying for
 * more than OpenWeb Ninja's free 100 requests a month — one genre's worth. The
 * first sale is the moment to move it to a paid plan, and a webhook is the
 * only thing that knows the moment has come.
 *
 * Fires when a plan that reads Amazon's data replaces one that did not, so a
 * renewal, a change of cycle or a repeated notification sends nothing. It
 * carries no writer details, only how many writers now have the data. Never
 * throws and never changes what the webhook answers: the subscription row is
 * the feature, and the mail is a courtesy to the operator.
 */
export async function alertIfAmazonSubscriber(
  db: Admin,
  previousPlan: unknown,
  tier: PaidTier,
): Promise<void> {
  try {
    if (!isEmailConfigured() || !amazonDataAllowed(tier)) return;
    const before = asPaidTier(previousPlan);
    if (before && amazonDataAllowed(before)) return;

    const reading = PAID_TIERS.filter(amazonDataAllowed);
    const { count } = await db
      .from("subscriptions")
      .select("owner", { count: "exact", head: true })
      .in("plan", reading)
      .neq("status", "cancelled");

    const name = TIER_NAMES[tier];
    const total = typeof count === "number" ? `${count} in total` : "count unknown";
    const line = `A writer has just subscribed to ${name} (${total}).`;
    const ask =
      "Amazon's data comes from OpenWeb Ninja, paid by the request. If it is still on the free plan (100 requests a month, about one genre), move it to pay-as-you-go now. At about three subscribers the $25 fixed plan is cheaper.";

    const sent = await sendEmail({
      to: alertAddress(),
      subject: `New ${name} subscriber: check OpenWeb Ninja`,
      text: `${line}\n\n${ask}`,
      html: `<p>${line}</p><p>${ask}</p>`,
    });
    if (!sent.sent) {
      console.error("[billing] the new-subscriber alert was not sent", {
        reason: sent.reason,
        detail: sent.detail,
      });
    }
  } catch (error) {
    console.error("[billing] the new-subscriber alert failed", error);
  }
}
