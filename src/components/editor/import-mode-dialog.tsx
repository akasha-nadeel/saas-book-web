"use client";

import { useEffect, useRef } from "react";

/**
 * Asked before an import lands in a book that already has prose in it.
 *
 * A writer who has started a novel here and then imports a file has to be told
 * what will happen to what they wrote. Replace clears it; Add keeps it and
 * numbers the import on from the end. Replace is destructive, so it says so and
 * wears the warning colour.
 */
export function ImportModeDialog({
  existingCount,
  importCount,
  onAdd,
  onReplace,
  onClose,
}: {
  existingCount: number;
  importCount: number;
  onAdd: () => void;
  onReplace: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const existing = `${existingCount} ${existingCount === 1 ? "chapter" : "chapters"}`;
  const incoming = `${importCount} ${importCount === 1 ? "chapter" : "chapters"}`;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[30rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">This book already has writing</h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          You have <span className="text-fg">{existing}</span> in this book, and
          the file has <span className="text-fg">{incoming}</span>. What should
          happen?
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {/* Add: the safe default, so it leads. */}
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg border border-line px-4 py-3 text-left outline-none
                       transition-colors hover:border-accent/60 hover:bg-raised
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="block font-sans text-sm font-semibold text-fg">
              Add to my chapters
            </span>
            <span className="mt-0.5 block font-sans text-xs text-muted">
              Keep what you wrote. The imported chapters go after it, numbered on
              from Chapter {existingCount + 1}.
            </span>
          </button>

          {/* Replace: destructive, so it carries the danger colour and its own
              consequence in plain words. */}
          <button
            type="button"
            onClick={onReplace}
            className="rounded-lg border px-4 py-3 text-left outline-none
                       transition-colors hover:bg-raised focus-visible:ring-2
                       focus-visible:ring-accent/60"
            style={{ borderColor: "color-mix(in srgb, var(--color-danger) 45%, transparent)" }}
          >
            <span
              className="block font-sans text-sm font-semibold"
              style={{ color: "var(--color-danger)" }}
            >
              Replace everything
            </span>
            <span className="mt-0.5 block font-sans text-xs text-muted">
              Delete all {existing} you have here and use only the imported ones.
              You can still undo this straight after.
            </span>
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 font-sans text-sm text-muted outline-none
                       transition-colors hover:bg-raised hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
