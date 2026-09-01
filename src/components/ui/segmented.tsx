"use client";

/**
 * The segmented control, drawn the way Apple draws it.
 *
 * **The active segment is a raised neutral pill, not a saturated fill.** That
 * distinction is the whole component: a two-up control filled with the brand
 * colour is the loudest thing on a panel beside a manuscript, and it says
 * "press me" about a tab that is already selected. A pale pill lifted off a
 * grey track says *you are here* and then gets out of the way.
 *
 * **On this shelf because there were four.** `theme-toggle.tsx`,
 * `covers-page.tsx` and `search-panel.tsx` had each rolled their own, with
 * three different radii and three different ideas of the active state.
 *
 * **`theme-toggle.tsx` keeps its accent fill and should not be converted.**
 * That one is three 28px icon-only targets, where a fill is the only state a
 * glyph can carry — an icon in a pale pill on a pale track is not visibly
 * selected at that size. This is for controls wide enough to hold a word.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for a screen reader — it is one control with one answer. */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`grid shrink-0 gap-1 rounded-[10px] bg-raised p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`truncate rounded-[7px] px-2 py-1.5 text-[13px] outline-none
                        transition-all focus-visible:ring-2 focus-visible:ring-accent/60 ${
                          active
                            ? "bg-panel font-semibold text-fg shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                            : "font-medium text-muted hover:text-fg"
                        }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
