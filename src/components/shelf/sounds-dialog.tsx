"use client";

import { useEffect, useRef } from "react";

/**
 * A placeholder, not a player — the sounds themselves come later.
 *
 * The button has to lead somewhere honest rather than sit inert, so this says
 * what is coming and that it is not here yet. Replace it with the real mixer
 * (rain, a café, waves, a lo-fi bed) when that ships.
 */
export function SoundsDialog({ onClose }: { onClose: () => void }) {
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
      className="m-auto w-[28rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">Background sounds are coming</h2>

        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          Rain, a café, waves, a lo-fi bed — ambient sound to write to, playing
          right here in the browser. It is not built yet; the button is here so
          it has somewhere to land.
        </p>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-4 py-2 font-sans text-sm
                       font-semibold text-white outline-none transition-colors
                       hover:bg-accent-strong focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Back to writing
          </button>
        </div>
      </div>
    </dialog>
  );
}
