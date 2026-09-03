"use client";

import { Shell, DialogClose } from "@/components/ui/dialog";
import type { AssistantAllowance } from "@/lib/use-plan";
import { usePlan } from "@/lib/use-plan";
import { TIER_NAMES } from "@/lib/billing/tiers";

/**
 * What is left of each assistant allowance, as a dialog from the account menu.
 *
 * **It lived on `/billing`, and that was the wrong room.** That screen is the
 * account seen from the money side — plan, card, invoices, cancellation — and
 * these two numbers are not money, they are an entitlement. The question they
 * answer is "how many replies have I got left?", which is a glance taken in the
 * middle of writing rather than a reason to leave the page and come back.
 *
 * `Shell` carries the dialog palette, the focus trap, Escape and focus
 * restoration, so none of that is written here.
 */
export function UsageDialog({ onClose }: { onClose: () => void }) {
  const plan = usePlan();

  return (
    <Shell onClose={onClose} width="w-[30rem]">
      <DialogClose onClose={onClose} />

      <h2 className="pr-8 font-serif text-xl text-tremor-content-strong">
        Assistant usage
      </h2>

      <p className="mt-2 font-sans text-sm leading-6 text-tremor-content">
        {plan.tier ? `On ${TIER_NAMES[plan.tier]}.` : ""} Quick replies refill
        every day and Careful ones every month, both at midnight UTC — shown
        below in your own time.
      </p>

      {plan.assistant ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <AssistantMeter
            label="Quick"
            note="Refills every day"
            allowance={plan.assistant.quick}
          />
          <AssistantMeter
            label="Careful"
            note="Refills every month"
            allowance={plan.assistant.careful}
          />
        </div>
      ) : (
        <p className="mt-4 font-sans text-sm text-tremor-content">
          Checking your allowance&hellip;
        </p>
      )}
    </Shell>
  );
}

/**
 * One allowance: what has been spent, out of what, and when it comes back.
 *
 * **`resetAt` is rendered in the reader's own time zone**, never described as
 * "tomorrow". The daily window turns over at 00:00 UTC, which is half past five
 * in the morning in Colombo and the evening before in Los Angeles — a phrase
 * would be wrong for most of the people reading it.
 *
 * A limit of zero is a plan without the assistant rather than one that has run
 * out, so it says so instead of drawing a full bar.
 */
function AssistantMeter({
  label,
  note,
  allowance,
}: {
  label: string;
  note: string;
  allowance: AssistantAllowance;
}) {
  const { used, limit, remaining, resetAt } = allowance;
  const included = limit === null || limit > 0;

  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-sans text-sm font-semibold text-fg">{label}</p>
        <p className="font-sans text-xs text-muted">{note}</p>
      </div>

      {included ? (
        <>
          <p className="mt-2 font-display text-3xl font-bold text-fg">
            {used}
            {limit !== null && (
              <span className="ml-1 text-base font-medium text-muted">
                / {limit}
              </span>
            )}
          </p>
          <p className="mt-1 font-sans text-xs text-muted">
            {remaining !== null ? `${remaining} left` : "Unlimited"}
            {resetAt &&
              ` · back ${new Date(resetAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}`}
          </p>
          {limit !== null && limit > 0 && (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-raised">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
              />
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 font-sans text-sm text-muted">
          Not on this plan.
        </p>
      )}
    </div>
  );
}
