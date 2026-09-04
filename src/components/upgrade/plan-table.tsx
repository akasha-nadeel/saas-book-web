/**
 * The four plans compared line by line, grouped.
 *
 * **This is where the claims live now.** The cards used to carry all ten rows
 * each — four columns of mostly identical values, in which the one line a buyer
 * is choosing between was eighth of ten. The cards lead with a handful and this
 * carries the contract, which is the arrangement every pricing page that works
 * arrives at: skim across the top, then read down when you are deciding.
 *
 * **No `"use client"`**, for the same reason `plan-card.tsx` has none — the
 * landing page is a Server Component, and a client module's exports reach it as
 * references rather than as data.
 *
 * **Every value comes from `ROWS`**, so this and the cards cannot disagree, and
 * nothing here may be typed by hand. `plan-rows.ts` reads its counts out of
 * `TIER_LIMITS` and `FREE_LIMITS` — the same constants the gates enforce — so a
 * value in this table cannot promise something the app then refuses.
 */

import { NOT_INCLUDED, ROWS, ROW_GROUPS } from "@/lib/billing/plan-rows";
import { TIER_NAMES, TIER_ORDER, type PlanTier } from "@/lib/billing/tiers";

/**
 * A value that is a plain yes, and therefore better drawn than written.
 *
 * "Included" repeated down four columns is a wall of one word; a tick is read
 * at a glance and takes a quarter of the width. Anything with an actual value —
 * a count, a format list, "Unlimited" — is printed as itself.
 */
const PLAIN_YES = "Included";

export function PlanTable({
  /** Drawn with a tint down its column, matching the featured card above. */
  spotlight,
}: {
  spotlight?: PlanTier;
}) {
  return (
    /* The table scrolls inside its own box rather than pushing the page
       sideways. Four plan columns plus a label column does not fit a phone, and
       a horizontally scrolling *page* is the one failure that makes a layout
       feel broken rather than tight. */
    <div className="mt-12 overflow-x-auto">
      <table className="w-full border-collapse text-center font-sans text-sm">
        <caption className="sr-only">
          What each plan includes, compared line by line
        </caption>
        <thead>
          <tr>
            {/* Sticky, so the row you are reading keeps its name while the
                plans scroll under it on a narrow window. */}
            <th
              scope="col"
              className="sticky left-0 z-20 min-w-[11.875rem] bg-surface px-4
                         pb-3.5 text-left font-sans text-xs font-semibold
                         tracking-[0.09em] text-faint uppercase"
            >
              <span className="sr-only">Feature</span>
            </th>
            {TIER_ORDER.map((tier) => (
              <th
                key={tier}
                scope="col"
                className={`border-b px-4 pb-3.5 font-display text-[1.0625rem]
                            font-semibold whitespace-nowrap ${
                              tier === spotlight
                                ? "border-accent bg-accent/9 text-fg"
                                : "border-line text-fg"
                            }`}
              >
                {TIER_NAMES[tier]}
              </th>
            ))}
          </tr>
        </thead>

        {/* One tbody a group, which is what lets the group heading be a real
            row rather than a styled first cell — and what keeps a row filed in
            the wrong group from printing its heading twice halfway down. */}
        {ROW_GROUPS.map((group) => {
          const rows = ROWS.filter((row) => row.group === group);
          if (rows.length === 0) return null;

          return (
            <tbody key={group}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={TIER_ORDER.length + 1}
                  className="border-b border-line bg-panel px-4 pt-4 pb-2.5
                             text-left font-sans text-[0.65625rem]
                             font-semibold tracking-[0.11em] text-fg uppercase"
                >
                  {group}
                </th>
              </tr>

              {rows.map((row) => (
                <tr key={row.label} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-[11.875rem] border-b
                               border-line bg-surface px-4 py-3 text-left
                               font-sans text-sm font-normal text-muted
                               group-hover:bg-accent/5"
                  >
                    {row.label}
                  </th>

                  {TIER_ORDER.map((tier) => {
                    const value = row.values[tier];
                    const has = value !== NOT_INCLUDED && value !== "";
                    const spot = tier === spotlight;

                    return (
                      <td
                        key={tier}
                        className={`border-b border-line px-4 py-3 ${
                          spot
                            ? "bg-accent/9 group-hover:bg-accent/14"
                            : "group-hover:bg-accent/5"
                        }`}
                      >
                        {!has ? (
                          /* An em dash, not a cross. A whole column of red
                             crosses reads as a scolding; the absence is the
                             information and a dash states it without
                             editorialising. The screen-reader text is what
                             carries the meaning for anyone not seeing it. */
                          <span className="text-faint" aria-hidden="true">
                            &mdash;
                          </span>
                        ) : value === PLAIN_YES ? (
                          <span
                            className="font-semibold text-accent"
                            aria-hidden="true"
                          >
                            &#10003;
                          </span>
                        ) : (
                          <span className="font-sans text-[0.9375rem] font-semibold tabular-nums">
                            {value}
                          </span>
                        )}
                        <span className="sr-only">
                          {!has
                            ? "Not included"
                            : value === PLAIN_YES
                              ? "Included"
                              : value}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
