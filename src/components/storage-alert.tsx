"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { clearStorageTrouble } from "@/lib/library-store";
import { useStorageTrouble } from "@/lib/use-library";
import {
  LOCAL_STORAGE_LIMIT,
  describeSpace,
  localBytes,
} from "@/lib/storage-space";

/**
 * What a writer sees when this browser runs out of room.
 *
 * **The two states are not the same size and must not be told at the same
 * volume.** A save that hit the quota and then succeeded because the version
 * history was given up has cost the writer a nicety; a save that could not be
 * written at all means the words they are typing are going nowhere, which is
 * the worst thing that can happen in a writing app. So one is a note in the
 * corner and the other stops the screen.
 *
 * **In the root layout, beside ThemeSync and LibrarySync**, because a full
 * origin is a fact about the app rather than about the screen that happened to
 * notice it: the editor's autosave is the likeliest place to hit it, but the
 * bible, the ARC list and the ledger all write unguarded and would throw with
 * nothing on screen to explain why.
 *
 * **Raised by the store, never by an effect on mount.** An effect that opened
 * this on load would meet a writer who filled their storage yesterday with a
 * dialog about it today — the rule `LimitDialog` already follows, for the same
 * reason.
 */
export function StorageAlert() {
  const trouble = useStorageTrouble();

  /* **Measured once per change, not once per render.**
     `localBytes` walks every key and reads every value, which on a full origin
     is five megabytes of string — and this component sits in the root layout,
     so a render-time call would pay that on every render of every screen while
     the dialog was up. It was written that way for one commit and it was
     wrong; the figure changes only when the writer goes and frees something,
     at which point they are not looking at this. A memo rather than an effect
     with state, which is the same fix one render later and one the lint rule
     rightly refuses.

     **Not `navigator.storage.estimate()`**, which does not count
     `localStorage` at all — measured on the library that hit this, it reported
     16MB used of a 10,753MB quota, every byte of it IndexedDB, while
     `localStorage` sat at 4.93MB and the saves were failing. Quoting that here
     would have told a writer whose book had stopped saving that they had ten
     gigabytes spare. */
  const used = useMemo(
    () => (trouble === "full" ? localBytes() : 0),
    [trouble],
  );

  useEffect(() => {
    if (trouble !== "full") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearStorageTrouble();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [trouble]);

  if (trouble === "none") return null;

  /* The quiet half. Their versions are gone and they should hear it from us,
     but the book saved and nothing is at risk — so it waits to be noticed and
     goes away when it is. */
  if (trouble === "history-dropped") {
    return (
      <div
        role="status"
        className="oc-panel-in fixed right-4 bottom-4 z-40 flex max-w-sm items-start
                   gap-3 rounded-xl border border-note-line bg-note-bg px-4 py-3
                   shadow-lg"
      >
        <p className="min-w-0 flex-1 font-sans text-xs leading-relaxed text-note-fg">
          This browser was out of room, so older chapter versions were cleared to
          make space. Your writing is saved.
        </p>
        <button
          type="button"
          onClick={clearStorageTrouble}
          aria-label="Dismiss"
          className="-mr-1 -mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-sans
                     text-sm text-note-fg/70 outline-none transition-colors
                     hover:text-note-fg focus-visible:ring-2
                     focus-visible:ring-note-fg/50"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="This browser is out of room"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={clearStorageTrouble}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-panel p-5 text-left shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-sans text-base font-bold text-fg">
          This browser is out of room
        </h2>
        <p className="mt-2 font-sans text-sm leading-relaxed text-muted">
          Your last few edits have not been saved. Nothing already saved is lost
          — but until there is space, new writing cannot be stored.
        </p>

        {/* "About", because it is: the limit is not queryable and browsers
            differ on whether they charge for UTF-16. An invented figure here
            would be the most believable invented number in the app, on the one
            screen a writer is deciding what to delete from — so the word does
            real work. */}
        {used > 0 && (
          <p className="mt-3 rounded-lg border border-line bg-raised px-3 py-2.5 font-sans text-xs leading-relaxed text-fg">
            About {describeSpace(used)} stored, of the roughly{" "}
            {describeSpace(LOCAL_STORAGE_LIMIT)} this browser allows one site.
          </p>
        )}

        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          Deleting a book you no longer need — and emptying the trash after —
          frees the most.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/"
            onClick={clearStorageTrouble}
            className="rounded-lg bg-accent px-4 py-2.5 text-center font-sans
                       text-sm font-semibold text-accent-ink outline-none
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Manage your books
          </Link>
          <button
            type="button"
            onClick={clearStorageTrouble}
            className="rounded-lg border border-line px-4 py-2.5 font-sans text-sm
                       font-semibold text-fg outline-none transition-colors
                       hover:bg-raised focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
