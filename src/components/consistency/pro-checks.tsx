"use client";

/**
 * The consistency check's two plans, shared by the full screen and the panel.
 *
 * **Five checks on Free, all eleven on Pro** (2026-09-15; the split and its
 * reasons are on `FREE_CHECKS` in `consistency-ids.ts`). Both windows read the
 * plan through `useCheckPlan` and draw the count through `ProChecksNote`, so
 * the two cannot disagree about what a free writer sees.
 */

import Link from "next/link";
import { useMemo } from "react";

import { TIER_NAMES } from "@/lib/billing/tiers";
import { PRO_CHECKS, type CheckId, type PlanView } from "@/lib/consistency";
import { onFreePlan } from "@/lib/launch";
import { plural } from "@/lib/plural";
import { usePlan } from "@/lib/use-plan";

const NO_LOCKS: ReadonlySet<CheckId> = new Set();

/**
 * Whether this writer is on Free, and which checks are locked for them.
 *
 * `onFreePlan` is the one three-part test, so nothing is locked while the plan
 * is still loading or when billing is not configured.
 */
export function useCheckPlan(): {
  free: boolean;
  locked: ReadonlySet<CheckId>;
} {
  const free = onFreePlan(usePlan());
  const locked = useMemo(
    () => (free ? new Set(PRO_CHECKS) : NO_LOCKS),
    [free],
  );
  return { free, locked };
}

/**
 * What the Pro checks found, as a count and nothing more.
 *
 * **It never shows or hints at a finding**, only how many there were — which
 * is a fact about this book, read off a run that actually happened. Three
 * sentences, because an empty count is only true when every Pro check ran:
 *
 * - some did not run (the near-miss check without its word list): say how many
 *   did, so a zero is not passed off as a clean result;
 * - they all ran and found nothing: say so, plainly;
 * - they found something: say how many.
 */
export function ProChecksNote({ view }: { view: PlanView }) {
  const total = PRO_CHECKS.length;
  const ran = view.proRan.length;
  const partial = ran < total;

  const said = partial
    ? view.proFound === 0
      ? `${ran} of the ${total} ${TIER_NAMES.pro} checks ran, and found nothing.`
      : `${ran} of the ${total} ${TIER_NAMES.pro} checks ran, and found ${plural(view.proFound, "more thing")} in this book.`
    : view.proFound === 0
      ? `The ${total} ${TIER_NAMES.pro} checks found nothing more.`
      : `The ${total} ${TIER_NAMES.pro} checks found ${plural(view.proFound, "more thing")} in this book.`;

  return (
    <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-raised px-3.5 py-3">
      <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-fg">
        {said}
      </p>
      {view.proFound > 0 && (
        <Link
          href="/upgrade"
          className="shrink-0 rounded-[10px] bg-accent px-3.5 py-2 text-[12px] font-semibold text-accent-ink hover:opacity-90"
        >
          See {TIER_NAMES.pro}
        </Link>
      )}
    </section>
  );
}
