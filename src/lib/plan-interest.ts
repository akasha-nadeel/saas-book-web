import type { Period } from "@/lib/billing/plans";
import type { PaidTier } from "@/lib/billing/tiers";

/**
 * Tell the server somebody wanted a plan we are not currently selling.
 *
 * One function rather than a `fetch` at each call site, because the two callers
 * are a button on `/upgrade` and a link on the landing page and the payload has
 * to be the same shape for the row to be worth reading. `/api/plan-interest`
 * narrows all three fields again on arrival; this is convenience, never trust.
 *
 * **`sendBeacon` first, and the reason is the landing page.** Those controls
 * are `<Link>`s that navigate on the same press, and a `fetch` started in that
 * click handler is cancelled when the page goes. A beacon is queued by the
 * browser and delivered whether this document survives or not, which is exactly
 * the guarantee wanted for a press whose whole purpose is to leave.
 *
 * **Never throws and never returns anything to wait on.** The dialog opens on
 * the press regardless; a recording that fails must not delay it or, worse,
 * surface as an error to somebody who only pressed a price.
 */
export function notePlanInterest(
  tier: PaidTier,
  period: Period,
  source: "upgrade" | "landing",
): void {
  if (typeof navigator === "undefined") return;

  const body = JSON.stringify({ tier, period, source });

  try {
    /* `type: "application/json"` matters: a beacon defaults to text/plain and
       the route reads the body as JSON. */
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/plan-interest", blob)) return;

    /* Beacons can be refused — a size cap, or the API missing. `keepalive` is
       the same promise by another route: the request outlives the document. */
    void fetch("/api/plan-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* A press is not worth an exception. */
  }
}
