/**
 * The bar across the top of a page pushed inside the bible.
 *
 * **iOS's navigation bar**: the way back on the left, named after where it
 * goes, and the page's one action on the right. The words are the accent
 * because they are the ways forward and back; the action that finishes an edit
 * is set heavier than the one that abandons it, which is how a writer tells
 * Done from Cancel without reading either.
 *
 * **Sticky, on a translucent material**, the way iOS draws its bars: the page
 * scrolls under it and stays faintly visible through it, so the bar reads as
 * floating over the content rather than as a lid on it. It runs the width of
 * the view, and what is on it is held to the page's own column (`PageColumn`),
 * so Back sits above the start of the text rather than out at the window's
 * edge.
 */
export function PageBar({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 shrink-0 bg-surface/75 backdrop-blur-md">
      <div className="mx-auto flex h-12 w-full max-w-2xl items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center">{left}</div>
        {right && <div className="flex shrink-0 items-center">{right}</div>}
      </div>
    </div>
  );
}

/**
 * A page's content, held to a readable measure in the middle of the view.
 * `flex-1`, so a page shorter than the view still pushes a sticky footer
 * (the connect page's) to the bottom.
 */
export function PageColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 pt-2 pb-16 sm:px-8">
      {children}
    </div>
  );
}

const BAR_TEXT =
  "rounded-[10px] px-2 py-1.5 font-sans text-[13px] outline-none transition-colors " +
  "hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent/60 " +
  "disabled:pointer-events-none disabled:opacity-40";

/** The way back, with a chevron, named after the page it returns to. */
export function BackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Back to ${label}`}
      className={`flex min-w-0 items-center gap-0.5 text-accent ${BAR_TEXT}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="-ml-1 h-4 w-4 shrink-0"
      >
        <path d="m15 5-7 7 7 7" />
      </svg>
      <span className="truncate">{label}</span>
    </button>
  );
}

/** A word in the bar. `strong` is the one that finishes: Done, Add. */
export function BarButton({
  children,
  onClick,
  strong = false,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  strong?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-accent ${strong ? "font-semibold" : ""} ${BAR_TEXT}`}
    >
      {children}
    </button>
  );
}
