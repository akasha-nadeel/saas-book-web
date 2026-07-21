"use client";

import { useEffect, useRef } from "react";

/**
 * The Upgrade button has to lead somewhere, and there is nowhere yet.
 *
 * OpenChapter has no accounts, no server and no billing — everything lives in
 * this browser. Rather than a button that silently does nothing, or a fake
 * pricing table, this says where the product actually is. Replace it with real
 * plans once there is a backend to bill for.
 */
export function UpgradeDialog({ onClose }: { onClose: () => void }) {
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
      className="m-auto w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">Plans aren’t available yet</h2>

        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          OpenChapter runs entirely in this browser. Your books never leave the
          machine you wrote them on, and there is no account to bill.
        </p>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          Paid plans arrive with syncing — when your library follows you between
          devices, that is the thing worth paying for. Until then everything the
          app can do, it does.
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
