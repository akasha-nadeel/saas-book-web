"use client";

import { ProBadge } from "@/components/upgrade/pro-badge";

export type Store = "amazon" | "apple";

/**
 * Whose best-seller list the price check is reading: Amazon's or Apple's.
 *
 * **Amazon's side is Pro, and on the free plan it stays pressable.** The press
 * opens the offer rather than doing nothing — the rule the consistency check's
 * locked cards and the theme swatches follow — so the badge is a promise the
 * button keeps rather than a dead control. Nothing is fetched for a free
 * writer: Amazon's data is paid for per request, and the server refuses it to
 * a free account anyway (`require-pro-data.ts`).
 *
 * Amazon first, because for a Pro writer it is the list they are paying for
 * and the one they land on.
 */
export function StoreSwitch({
  value,
  locked,
  onChange,
  onLocked,
}: {
  value: Store;
  /** True on the free plan: the Amazon side opens the offer. */
  locked: boolean;
  onChange: (store: Store) => void;
  onLocked: () => void;
}) {
  const tab = (store: Store, active: boolean) =>
    `flex min-h-11 items-center justify-center gap-2 rounded-[7px] px-4 text-[13px] outline-none
     transition-all focus-visible:ring-2 focus-visible:ring-accent/60 ${
       active
         ? "bg-panel font-semibold text-fg shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
         : "font-medium text-muted hover:text-fg"
     }`;

  return (
    <div
      role="tablist"
      aria-label="Whose best-seller list"
      className="inline-grid grid-cols-2 gap-1 rounded-[10px] bg-raised p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "amazon"}
        onClick={() => (locked ? onLocked() : onChange("amazon"))}
        className={tab("amazon", value === "amazon")}
      >
        Amazon
        {locked && <ProBadge />}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "apple"}
        onClick={() => onChange("apple")}
        className={tab("apple", value === "apple")}
      >
        Apple Books
      </button>
    </div>
  );
}
