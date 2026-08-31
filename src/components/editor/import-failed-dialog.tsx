"use client";

import { useEffect, useRef } from "react";

/**
 * A failed read, said in a dialog.
 *
 * In the chapter list this was a paragraph under the button, which a rail has
 * no room for — and a rail button that silently does nothing on a damaged file
 * is the worst of the options. The message is the importer's own, which names
 * the format problem rather than saying the file is bad.
 */
export function ImportFailedDialog({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg bg-tremor-background
                 p-0 text-tremor-content-strong backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">That file did not come in</h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-tremor-content">
          {message}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-tremor-border px-3 py-2 font-sans text-sm
                       text-tremor-content-strong outline-none transition-colors hover:bg-tremor-background-subtle
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
