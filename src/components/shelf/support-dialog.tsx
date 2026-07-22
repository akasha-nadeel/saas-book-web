"use client";

import { useEffect, useRef } from "react";

/**
 * Where a stuck writer goes.
 *
 * OpenChapter has no support desk — no server, no accounts, nothing to open a
 * ticket against. Rather than a dead "Contact us" that leads nowhere, this is
 * honest self-help: the guide, the Assistant, and the two things that actually
 * go wrong with a browser-local app. Point it at a real channel once one exists.
 */
export function SupportDialog({ onClose }: { onClose: () => void }) {
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
      className="m-auto w-[32rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">Getting help</h2>

        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          OpenChapter runs entirely in this browser — there is no support desk
          yet. Here is how to get unstuck:
        </p>

        <ul className="mt-4 space-y-3 font-sans text-sm leading-relaxed text-muted">
          <li>
            <span className="font-medium text-fg">Learn the app.</span> The Help
            guide lists everything OpenChapter can do.
          </li>
          <li>
            <span className="font-medium text-fg">Ask the Assistant.</span> In the
            editor, it answers questions about the chapter you are writing.
          </li>
          <li>
            <span className="font-medium text-fg">Missing books?</span> Your
            library is tied to this browser and profile. If books seem to vanish,
            check you are in the same browser you wrote them in and that browsing
            data was not cleared — and export regularly to keep backups.
          </li>
          <li>
            <span className="font-medium text-fg">Assistant silent?</span> It
            needs an ANTHROPIC_API_KEY set on the server; without one it says so.
          </li>
        </ul>

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
