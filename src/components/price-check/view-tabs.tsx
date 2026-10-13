"use client";

import { ProBadge } from "@/components/upgrade/pro-badge";
import { AMAZON_DATA_TIER, TIER_NAMES } from "@/lib/billing/tiers";

export type View = "prices" | "categories" | "trends";

export const VIEWS: { value: View; label: string }[] = [
  { value: "prices", label: "Prices" },
  { value: "categories", label: "Categories" },
  { value: "trends", label: "Trends" },
];

/**
 * The Market check's three questions about one genre: what it charges, which
 * categories its best sellers rank in, and what is moving.
 *
 * **A genre opens on these three and nothing else** (2026-10-13): no section
 * is selected until the writer presses one, and the bar stays on top once
 * they are inside so moving between sections is one press.
 *
 * **Drawn like `StoreSwitch`, 44px a tab**, because it is pressed on phones
 * and the segmented control's 13px rows are for panels beside a manuscript.
 *
 * **Categories and Trends are Amazon's data alone**, so below
 * `AMAZON_DATA_TIER` they wear its badge and stay pressable: the press opens a
 * page saying what the tab shows, with no figures on it, rather than doing
 * nothing — the rule the locked Amazon list follows.
 */
export function ViewTabs({
  value,
  locked,
  onChange,
}: {
  /** The open section, or null before the writer has chosen one. */
  value: View | null;
  /** True when Amazon's data is shut to this writer. */
  locked: boolean;
  onChange: (view: View) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="What to look at"
      className="grid grid-cols-3 gap-1 rounded-[10px] bg-raised p-1"
    >
      {VIEWS.map(({ value: view, label }) => {
        const active = value === view;
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(view)}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-[7px] px-2 text-sm
                        outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/60 ${
                          active
                            ? "bg-panel font-semibold text-fg shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                            : "font-medium text-muted hover:text-fg"
                        }`}
          >
            <span className="truncate">{label}</span>
            {locked && view !== "prices" && (
              <>
                {/* The badge needs room a phone's third of a row has not
                    got, so there the lock alone says it; the tab's page
                    names the plan. */}
                <ProBadge tier={AMAZON_DATA_TIER} className="hidden @xl:inline" />
                <svg
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5 shrink-0 @xl:hidden"
                  aria-label={`Part of ${TIER_NAMES[AMAZON_DATA_TIER]}`}
                  role="img"
                >
                  <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="currentColor" />
                  <path
                    d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
