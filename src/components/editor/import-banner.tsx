"use client";

/**
 * The bar across the top after an import, until the writer decides.
 *
 * Chapter detection and ordering are a guess, so nothing is final the moment it
 * lands — this invites the writer to scroll the chapter list, check the order,
 * and either keep it or undo the whole import in one click. It sits above the
 * editor rather than in the sidebar so it survives the panel being collapsed.
 */
export function ImportBanner({
  count,
  onUndo,
  onKeep,
}: {
  count: number;
  onUndo: () => void;
  onKeep: () => void;
}) {
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b
                 border-accent/40 bg-accent-deep/30 px-4 py-2.5 font-sans text-sm
                 text-fg md:px-6"
    >
      <span className="min-w-0 flex-1">
        Imported{" "}
        <span className="font-semibold">
          {count} {count === 1 ? "chapter" : "chapters"}
        </span>
        . Check the order in the panel — undo if it isn’t right.
      </span>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          className="rounded-md px-3 py-1.5 font-medium text-muted outline-none
                     transition-colors hover:bg-raised hover:text-fg
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="rounded-md bg-accent px-3 py-1.5 font-semibold text-white
                     outline-none transition-colors hover:bg-accent-strong
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Keep
        </button>
      </div>
    </div>
  );
}
