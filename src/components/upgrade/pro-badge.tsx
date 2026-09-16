import { TIER_NAMES } from "@/lib/billing/tiers";

/**
 * The marker on a row that belongs to Pro.
 *
 * **It carries no plan logic and must not.** Six of these render at once in the
 * consistency picker; a `usePlan()` inside the badge would be six fetches of
 * `/api/billing/subscription` for one answer. Every caller already knows —
 * `useCheckPlan()` in the picker, `onFreePlan(plan)` in the dashboard — so this
 * is markup and nothing else, and the decision of *whether* a writer should see
 * it stays at the one place that already made it.
 *
 * **It wears the app's one licensed gradient**, `--color-upgrade-from` →
 * `-to` (`globals.css`), which `ProCard` and `LimitBanner` already fill with.
 * That is the point: purple means "this is Pro" everywhere in the product, so
 * the badge joins the card rather than adding a third idea to it. The gradient
 * is stated identically in all three theme blocks — it is a *fill*, and a
 * saturated mid-tone carries its own ink on any ground — so this needs no dark
 * variant and does not invert under a tint.
 *
 * **White at 10px is why the gradient's values may not be lightened.** Small
 * uppercase text needs 4.5:1; white clears 5.4:1 on the purple end and 6.4:1
 * on the indigo, which is the same measurement that forced
 * `--color-badge-new-bg` darker than the eye reaches for.
 *
 * **`rounded-md`, not a capsule.** A full pill is a *control* in this app, and
 * a label nobody can press must not borrow the shape of one — the rule the
 * "Usually" lozenge on the matter rows follows, and whose markup this copies.
 *
 * **It is not the pricing table's `--color-badge-pro-*`.** Those are a tint
 * because twenty filled lozenges down two columns all shout at one volume. One
 * badge on a rail row, and one on a check nobody can run, is the opposite case:
 * there the fill is what makes it findable without reading.
 */
export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`shrink-0 rounded-md bg-linear-to-r from-upgrade-from
                  to-upgrade-to px-1.5 py-0.5 font-sans text-[10px] font-bold
                  tracking-wide text-white uppercase ${className}`}
    >
      {TIER_NAMES.pro}
    </span>
  );
}
