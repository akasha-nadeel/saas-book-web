"use client";

import { Shell, DialogClose } from "@/components/ui/dialog";
import { usePlan } from "@/lib/use-plan";
import { CREDIT_COST, repliesFrom } from "@/lib/billing/credits";
import { TIER_LIMITS, TIER_NAMES } from "@/lib/billing/tiers";

/**
 * What is left to spend on the assistant, as a dialog from the account menu.
 *
 * **It lived on `/billing`, and that was the wrong room.** That screen is the
 * account seen from the money side — plan, card, invoices, cancellation — and
 * this number is not money, it is an entitlement. The question it answers is
 * "how many replies have I got left?", which is a glance taken in the middle of
 * writing rather than a reason to leave the page and come back.
 *
 * **Two meters became one balance**, and the dialog changed shape with them:
 * where it printed two bars against two windows, it now prints one figure and
 * says what that figure buys. A credit is an accounting unit and nobody thinks
 * in them, so the replies line is doing the actual work here.
 *
 * `Shell` carries the dialog palette, the focus trap, Escape and focus
 * restoration, so none of that is written here.
 */
export function UsageDialog({ onClose }: { onClose: () => void }) {
  const plan = usePlan();
  const credits = plan.credits;

  /* A grant of zero is a plan that is not *given* credits — Free — rather than
     one that has spent them. The two need different sentences, and only the
     tier can tell them apart. */
  const granted = plan.tier ? TIER_LIMITS[plan.tier].creditsPerMonth : 0;

  return (
    <Shell onClose={onClose} width="w-[30rem]">
      <DialogClose onClose={onClose} />

      <h2 className="pr-8 font-serif text-xl text-tremor-content-strong">
        Assistant credits
      </h2>

      <p className="mt-2 font-sans text-sm leading-6 text-tremor-content">
        {plan.tier ? `On ${TIER_NAMES[plan.tier]}.` : ""} A reply costs{" "}
        {CREDIT_COST.quick} credits on Quick, {CREDIT_COST.careful} on Careful and{" "}
        {CREDIT_COST.deep} on Deep. Monthly credits refill at midnight UTC on
        the 1st — shown below in your own time.
      </p>

      {credits ? (
        <Balance
          total={credits.total}
          grantLeft={credits.grantLeft}
          purchased={credits.purchased}
          resetAt={credits.resetAt}
          granted={granted}
        />
      ) : (
        <p className="mt-4 font-sans text-sm text-tremor-content">
          Checking your balance&hellip;
        </p>
      )}
    </Shell>
  );
}

/**
 * The balance, what it buys, and the split between the two buckets.
 *
 * **`resetAt` is rendered in the reader's own time zone**, never described as
 * "next month". The window turns over at 00:00 UTC on the 1st, which is half
 * past five in the morning in Colombo and the evening of the last of the month
 * in Los Angeles — a phrase would be wrong for most of the people reading it.
 *
 * **The split is only shown when both buckets have something in them.** A
 * writer with no bought credits does not need to be told they have none, and an
 * account holding only bought ones does not need a line saying its grant is
 * empty when it was never going to have one.
 */
function Balance({
  total,
  grantLeft,
  purchased,
  resetAt,
  granted,
}: {
  total: number | null;
  grantLeft: number | null;
  purchased: number | null;
  resetAt: string | null;
  granted: number;
}) {
  /* Nothing is metered on this deployment — no payment gateway — so there is a
     balance in name only. Saying "unlimited" is the honest reading. */
  if (total === null) {
    return (
      <div className="mt-4 rounded-2xl border border-line bg-panel p-6">
        <p className="font-display text-3xl font-bold text-fg">Unlimited</p>
        <p className="mt-1 font-sans text-sm text-muted">
          This copy of OpenChapter runs on its own API key, so replies are not
          metered.
        </p>
      </div>
    );
  }

  const replies = repliesFrom(total);
  const spentOfGrant = Math.max(granted - (grantLeft ?? 0), 0);
  const bothBuckets = (grantLeft ?? 0) > 0 && (purchased ?? 0) > 0;

  return (
    <div className="mt-4 rounded-2xl border border-line bg-panel p-6">
      <p className="font-display text-3xl font-bold text-fg">
        {total.toLocaleString("en-US")}
        <span className="ml-1 text-base font-medium text-muted">
          credit{total === 1 ? "" : "s"} left
        </span>
      </p>

      <p className="mt-1 font-sans text-xs text-muted">
        {replies.quick} Quick &middot; {replies.careful} Careful &middot;{" "}
        {replies.deep} Deep
      </p>

      {granted > 0 && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{
              width: `${Math.min(100, (spentOfGrant / granted) * 100)}%`,
            }}
          />
        </div>
      )}

      <p className="mt-3 font-sans text-xs text-muted">
        {granted > 0 ? (
          <>
            {grantLeft?.toLocaleString("en-US")} of{" "}
            {granted.toLocaleString("en-US")} monthly credits left
            {resetAt &&
              ` · back ${new Date(resetAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}`}
          </>
        ) : (
          "Your plan includes no monthly credits."
        )}
      </p>

      {bothBuckets && (
        <p className="mt-1 font-sans text-xs text-muted">
          Plus {purchased?.toLocaleString("en-US")} bought credits, which do not
          expire.
        </p>
      )}

      {!bothBuckets && (purchased ?? 0) > 0 && granted === 0 && (
        <p className="mt-1 font-sans text-xs text-muted">
          Bought credits do not expire.
        </p>
      )}
    </div>
  );
}
