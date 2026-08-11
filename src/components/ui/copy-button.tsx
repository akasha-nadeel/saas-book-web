"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copy one field to the clipboard.
 *
 * **Why this exists at all.** None of the listing details this app holds are
 * uploaded anywhere — a shop's keyword boxes and category selector live on the
 * shop's own form, and a writer publishing a book retypes what is on our screen
 * into theirs. Retyping a fifty-character phrase into a fifty-character box is
 * where a typo becomes a keyword nobody searches for.
 *
 * **One field per press, never a joined blob.** A shop gives seven separate
 * boxes; a comma-joined string of all seven would have to be taken apart again
 * at the other end, which is the work this is meant to remove rather than move.
 * So this is a control that belongs to *one* value, placed beside it.
 *
 * **Nothing to copy means no button.** An empty keyword box draws none — the
 * house rule is that a control either works or says plainly that it does not,
 * and a copy button that would put an empty string on the clipboard is the
 * quietest possible way to break it. The caller reserves the space (see the
 * keyword rows), so the row does not resize as the first character is typed.
 *
 * Extracted rather than written a third time: `share-dialog.tsx` and
 * `invite-sent-dialog.tsx` each hand over an invitation link this way. Those
 * two are not migrated here — their copy prefixes `window.location.origin` and
 * reports failure into a dialog-wide banner — but a fourth copy of this
 * belongs on this shelf rather than in a screen.
 */

/** Long enough to be read, short enough that the button is ready again. */
const HELD_MS = 2000;

export function CopyButton({
  value,
  label,
  className = "",
}: {
  /** The exact text to put on the clipboard. */
  value: string;
  /** The accessible name, naming what is copied: "Copy keyword 3". */
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number | null>(null);

  // Clearing on unmount, or a writer who copies and then leaves the screen
  // inside two seconds sets state on a component that has gone.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!value.trim()) return null;

  function hold(next: "done" | "failed") {
    setState(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), HELD_MS);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      hold("done");
    } catch {
      /*
       * A browser that refuses the clipboard — an insecure origin, or a
       * permission turned off — is not a failure worth a banner. The words are
       * on screen and can be selected by hand, so the button says it did not
       * work and goes back to offering itself.
       */
      hold("failed");
    }
  }

  const said =
    state === "done" ? "Copied" : state === "failed" ? "Could not copy" : label;

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={said}
        title={said}
        /* **No colour of its own**, like `Spinner`: this sits on a plain panel
           in one place and on a filled indigo chip in another, and a fixed
           grey would be a smudge on the second. The caller says what colour
           the row is; what changes here is the *glyph*, which reads on any
           ground and does not depend on anybody seeing a hue. */
        className={`inline-flex shrink-0 items-center justify-center rounded-lg
                    border border-transparent p-1.5 outline-none transition-colors
                    focus-visible:ring-2 focus-visible:ring-accent/50 ${className}`}
      >
        <Glyph state={state} />
      </button>

      {/* A changed accessible name is announced on the focused button by some
          screen readers and not others; this says it either way. */}
      <span role="status" className="sr-only">
        {state === "idle" ? "" : said}
      </span>
    </>
  );
}

/** Two sheets, a tick once it is done, a warning when the browser refused. */
function Glyph({ state }: { state: "idle" | "done" | "failed" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {state === "done" ? (
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
      ) : state === "failed" ? (
        <>
          <path d="M8 2.5 15 14H1z" />
          <path d="M8 6.5v3.5" />
          <path d="M8 12h.01" />
        </>
      ) : (
        <>
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 3.5a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5V9A1.5 1.5 0 0 0 4 10.5" />
        </>
      )}
    </svg>
  );
}
