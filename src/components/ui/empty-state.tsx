/**
 * The nothing-here state, unboxed.
 *
 * **A bordered card around "no results" makes an absence look like a result.**
 * Every panel in the editor boxes this, so a writer who searches for a word
 * that is not in their book is handed a card — the same shape a *finding*
 * arrives in — containing the news that there is nothing. Apple draws these as
 * a glyph, a line and the room around them, sitting in the space the content
 * would have filled.
 *
 * **Centred in what is left, not at the top of it.** `flex-1` rather than a
 * fixed block: an empty state pinned under the controls reads as a fifth row of
 * chrome, where the same words in the middle of the empty space read as the
 * state of the screen.
 *
 * The glyph is deliberately quiet — `text-muted/60`, stroked at 1.5 rather than
 * the 2 the controls use. It is a picture of absence and should not be the most
 * confident mark on the panel.
 */
export function EmptyState({
  glyph,
  title,
  children,
  className = "",
}: {
  /** A 24-grid stroked path, drawn by the caller. */
  glyph?: React.ReactNode;
  title: string;
  /** One line. If it needs two, the screen is explaining too much. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center ${className}`}
    >
      {glyph && (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7 text-muted/60"
        >
          {glyph}
        </svg>
      )}
      <p className="text-[13px] font-semibold text-fg">{title}</p>
      {children && (
        <p className="max-w-[240px] text-[13px] leading-relaxed text-muted">
          {children}
        </p>
      )}
    </div>
  );
}
