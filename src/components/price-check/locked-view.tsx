import { AMAZON_DATA_TIER, TIER_NAMES } from "@/lib/billing/tiers";
import type { View } from "./view-tabs";

/**
 * What the Categories and Trends tabs show, for a writer whose plan does not
 * include Amazon's data.
 *
 * **Words and no figures.** Every figure on those tabs is a request somebody
 * paid for, so none is drawn here — not a blurred one, not a sample. What the
 * tab answers is said plainly, so the offer is something a writer can judge
 * rather than a lock on an empty box.
 */
const WHAT: Record<Exclude<View, "prices">, { title: string; points: string[] }> = {
  categories: {
    title: "Which categories this genre's best sellers rank in",
    points: [
      "Where the #1, #10, #25, #50 and #100 books on Amazon's list rank in the whole Kindle Store, so you can see how far down the store this genre's best sellers sit.",
      "Every category the top 100 also rank in, how many of them rank there, and the highest rank anyone holds in it. A category with books ranking in it has a real page readers can reach.",
      "Amazon's own numbers from each book's page. No sales estimates and no difficulty score.",
    ],
  },
  trends: {
    title: "What is new, rising and wanted in this genre",
    points: [
      "Amazon's New Releases, Movers & Shakers and Most Wished For lists for the genre, refreshed daily, with covers and prices.",
      "How many ratings the top 100 and the new releases carry, so you know what a launch is up against.",
      "What new books launch at, counted in price bands, and a wall of the top 100's covers.",
    ],
  },
};

export function LockedView({
  view,
  onUpgrade,
}: {
  view: Exclude<View, "prices">;
  onUpgrade: () => void;
}) {
  const { title, points } = WHAT[view];
  const plan = TIER_NAMES[AMAZON_DATA_TIER];
  return (
    <div className="mt-5 rounded-xl border border-line p-5">
      <h3 className="text-lg font-bold text-fg">{title}</h3>
      <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 text-sm text-fg">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p className="mt-4 max-w-prose text-sm text-muted">
        This comes from Amazon&rsquo;s own lists, which we pay for by the request,
        so it is part of {plan}.
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-4 min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink"
      >
        See {plan}
      </button>
    </div>
  );
}
