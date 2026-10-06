import type { ReactNode } from "react";

/**
 * A card that opens to show more: the price check's answers that only some
 * writers want.
 *
 * **A native `<details>`**, so keyboard, screen reader and find-in-page all
 * work without a line of script, and the closed card still says what is
 * inside it in one line — progressive disclosure that does not hide what is
 * on offer.
 */
export function Disclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group mt-5 rounded-2xl border border-line bg-panel">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-5
                   outline-none focus-visible:ring-2 focus-visible:ring-accent/60 @2xl:px-6
                   [&::-webkit-details-marker]:hidden"
      >
        <span className="min-w-0">
          <span className="block text-lg font-bold text-fg">{title}</span>
          <span className="mt-0.5 block text-sm text-muted">{summary}</span>
        </span>
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          <path
            d="M3.5 6 8 10.5 12.5 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="border-t border-line p-5 @2xl:px-6">{children}</div>
    </details>
  );
}
