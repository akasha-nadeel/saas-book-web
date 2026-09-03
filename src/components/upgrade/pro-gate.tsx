"use client";

import Link from "next/link";
import { TIER_NAMES } from "@/lib/billing/tiers";
import type { ReactNode } from "react";
import { ToolHeader } from "@/components/tool-header";
import { toolShell } from "@/lib/tool-page";
import { usePlan } from "@/lib/use-plan";

/**
 * The one shape a Pro-only screen wears when the writer is not on Pro.
 *
 * Six screens need this and they must not each invent it, for the reason the
 * tool header exists: six upgrade prompts written separately drift into six
 * different tones, and the one that reads most like a paywall becomes what the
 * product feels like.
 *
 * Three rules, and each is the opposite of what an upsell usually does.
 *
 * **It says what the screen is for, not what is being withheld.** A writer
 * reading "Upgrade to unlock" has learned nothing about whether they want it.
 * `what` is a plain description of the feature — the same sentence the help
 * dialog would use — because somebody deciding whether to pay is entitled to
 * know what for.
 *
 * **It never appears while the plan is still loading.** Half a second of an
 * upgrade prompt shown to somebody who is already paying is worse than half a
 * second of nothing, and it is the failure people screenshot.
 *
 * **It is absent entirely when nothing is for sale.** With no payment gateway
 * configured, `plan.pro` comes back true from the subscription route and every
 * one of these screens works — a self-hosted copy running on its owner's keys
 * behaves as it always did. That is the same shape as a missing API key.
 *
 * The data behind a gated screen is never touched. Everything here is local and
 * stays local: a writer who lets Pro lapse keeps their ledger, their readers
 * and their notes, and gets them back the moment they return.
 */
export function ProGate({
  title,
  what,
  children,
}: {
  /** The feature's own name, as the tool list has it. */
  title: string;
  /** What it does, in the writer's terms. One or two sentences. */
  what: string;
  /** Shown when the writer is entitled to it. */
  children: ReactNode;
}) {
  const plan = usePlan();

  if (plan.loading || plan.pro) return <>{children}</>;

  return (
    <section className="rounded-xl border border-line bg-panel p-6">
      <p className="font-sans text-xs tracking-wide text-muted uppercase">
        Part of {TIER_NAMES.draft}
      </p>
      <h2 className="mt-2 text-lg font-bold text-fg">{title}</h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
        {what}
      </p>
      <Link
        href="/upgrade"
        className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm
                   font-semibold text-accent-ink outline-none
                   focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        See what {TIER_NAMES.draft} adds
      </Link>
      <p className="mt-3 text-xs text-muted">
        Nothing you have already recorded is touched, and it is all still on
        this machine.
      </p>
    </section>
  );
}

/**
 * The same question without the markup, for a screen that has to arrange its
 * own layout around the answer — the shelf's Track area draws the gate inside
 * a section it already owns.
 *
 * Returns true while loading, on the same reasoning as above: the benefit of
 * the doubt for half a second beats flashing a paywall at a paying writer.
 */
export function useEntitled(): boolean {
  const plan = usePlan();
  return plan.loading || plan.pro;
}

/**
 * A whole tool screen, standing in for one the writer has not bought.
 *
 * **It keeps the header**, and that is the point of doing it this way rather
 * than redirecting to the pricing page or hiding the tile. The writer arrived
 * somewhere deliberately; the breadcrumb, the book chip and the tool's own name
 * are how they know they are in the right place and how they get back out. A
 * tool that silently vanishes from the launcher is a feature nobody can find
 * out about, which is the same failure as a control that does nothing.
 *
 * Four screens use it and they are all the same three pieces, so the shell
 * lives here once — the alternative was four copies of a header wrapper, which
 * is how the tool screens got a shared header in the first place.
 */
export function GatedTool({
  book,
  tool,
  what,
  deck,
  embedded,
  heading,
}: {
  book: Parameters<typeof ToolHeader>[0]["book"];
  tool: string;
  what: string;
  /** The line under the heading, as the ungated screen has it. */
  deck: ReactNode;
  embedded?: boolean;
  heading?: ReactNode;
}) {
  return (
    <div className={toolShell(embedded)}>
      {!embedded && (
        <ToolHeader book={book} tool={tool}>
          {deck}
        </ToolHeader>
      )}
      <div className="mx-auto max-w-7xl px-6 pt-6 pb-16">
        {heading}
        <div className="mt-8">
          <ProGate title={tool} what={what}>
            {null}
          </ProGate>
        </div>
      </div>
    </div>
  );
}
