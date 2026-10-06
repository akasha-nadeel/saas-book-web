import type { ReactNode } from "react";
import { SectionHeader } from "@/components/ui/list";
import { BESTSELLER_SHELVES, SHELF_FAMILIES } from "@/lib/pricing/shelves";

/**
 * The first thing the price check asks, and the only thing.
 *
 * **Tiles rather than a dropdown on the first visit**: the whole question is
 * "which of these is yours", and sixteen named buttons answer it in one look
 * and one press, where a closed picker hides the answer behind a click. Once
 * a genre is open the screen switches to a compact picker, because by then the
 * question has been answered and the result deserves the space.
 *
 * Opening a genre is what spends one of the day's checks — the tiles are the
 * press, so the allowance pill sits under them.
 *
 * **Grouped by family since the list grew to 27** (2026-10-06): one labelled
 * grid per family, the way a long list is broken up on Apple's own store and
 * settings pages, so a romance writer reads eleven tiles rather than
 * twenty-seven. A flat list with a search box and a two-step family-then-genre
 * picker were the alternatives; both cost the one-press answer.
 */
export function GenreTiles({
  suggested,
  onOpen,
  children,
}: {
  /** The shelf matching the writer's own book, when there is one. */
  suggested: string | null;
  onOpen: (id: string) => void;
  /** The allowance pill and the refusal banner. */
  children?: ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
      <h2 className="text-2xl font-bold tracking-tight text-fg">
        Which genre is your book?
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted">
        You will see what the top 100 best-selling ebooks in it cost, with
        self-published books kept apart from the big publishers, and what Amazon
        would pay you at any price you try.
      </p>

      {SHELF_FAMILIES.map((family) => (
        <div key={family} className="mt-5">
          <SectionHeader>{family}</SectionHeader>
          <ul className="grid grid-cols-1 gap-2 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
            {BESTSELLER_SHELVES.filter((shelf) => shelf.family === family).map(
              (shelf) => (
                <li key={shelf.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(shelf.id)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px]
                               border border-line bg-surface px-4 py-3 text-left text-[15px]
                               font-semibold text-fg outline-none transition-colors
                               hover:border-accent/50 hover:bg-raised
                               focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <span className="min-w-0 truncate">{shelf.label}</span>
                    {suggested === shelf.id ? (
                      <span className="shrink-0 text-xs font-medium text-muted">
                        Your book&rsquo;s genre
                      </span>
                    ) : (
                      <svg
                        viewBox="0 0 16 16"
                        className="h-4 w-4 shrink-0 text-muted"
                        aria-hidden="true"
                      >
                        <path
                          d="M6 3.5 10.5 8 6 12.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}

      {children}
    </section>
  );
}
