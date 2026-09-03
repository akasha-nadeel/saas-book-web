"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaidTier } from "@/lib/billing/tiers";
import type { Period } from "@/lib/billing/plans";

/**
 * Move an existing Paddle subscription onto this card's plan.
 *
 * **Not a checkout, and it must not look like one.** There is no overlay and no
 * card form: the authorisation already exists and Paddle is only being told to
 * bill a different price against it. A writer pressing this has already paid
 * once and is not being asked to do it again.
 *
 * **No success handler decides anything.** The route answers `{ ok: true }` and
 * nothing more; the plan is written when `subscription.updated` reaches
 * `paddle/notify`. So the press refreshes the route and lets the page read the
 * new plan back out of the server — the same rule `/upgrade/done` follows for
 * PayHere, and the reason neither one trusts a gateway's return.
 *
 * The refresh is a beat behind the webhook on a slow round trip, which is why
 * the button says so rather than sitting silent: "Updating…" is true whether the
 * notification has landed yet or not.
 */
export function ChangePlanButton({
  tier,
  period,
  label,
  className,
}: {
  tier: PaidTier;
  period: Period;
  /**
   * What the press says it will do.
   *
   * **Passed in rather than worked out here**, because there are three of them
   * and only the card knows which: "Upgrade to Studio" going up, "Switch to
   * Draft" going down, and "Switch to annual" when the plan is already theirs
   * and only the cycle is moving. Deriving it from `tier` alone produced
   * "Switch to Writer" on the card of somebody already on Writer.
   */
  label: string;
  className: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/paddle/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, period }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Could not change the plan. Try again shortly.");
        return;
      }

      /* The webhook writes the plan; this only asks the page to go and look.
         `refresh()` re-runs the Server Component, so the cards come back with
         the new plan marked rather than this one guessing at it. */
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={change}
        disabled={busy}
        className={`w-full cursor-pointer disabled:cursor-default
                    disabled:opacity-70 ${className}`}
      >
        {busy ? "Updating…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-3 font-sans text-xs leading-relaxed text-muted">
          {error}
        </p>
      )}
    </div>
  );
}
