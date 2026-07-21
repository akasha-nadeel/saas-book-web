"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Typewriter scrolling: hold the caret at a comfortable height instead of
 * letting it sink to the bottom edge as the writer types.
 *
 * The caret is kept inside a band rather than pinned to an exact line. Pinning
 * means the page moves on every keystroke, which reads as the text sliding
 * around underneath you; a band means it only moves once you have drifted, so
 * the page is still most of the time.
 */

/** Fraction of the scroll container's height where the caret should sit. */
const ANCHOR = 0.42;

/** How far the caret may drift from the anchor before the page moves, in px. */
const TOLERANCE = 90;

function scrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const overflow = getComputedStyle(current).overflowY;
    if (overflow === "auto" || overflow === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

export function useTypewriter(enabled: boolean) {
  return useCallback(
    (editor: Editor) => {
      if (!enabled) return;

      const container = scrollParent(editor.view.dom as HTMLElement);
      if (!container) return;

      // coordsAtPos gives viewport coordinates, so compare against the
      // container's viewport box rather than its scroll offset.
      const caret = editor.view.coordsAtPos(editor.state.selection.head);
      const box = container.getBoundingClientRect();
      const target = box.top + box.height * ANCHOR;
      const drift = caret.top - target;

      if (Math.abs(drift) < TOLERANCE) return;

      // Instant, not smooth: a smooth scroll queued on every keystroke lags
      // behind the typing and feels like the page is chasing the caret.
      container.scrollBy({ top: drift, behavior: "auto" });
    },
    [enabled],
  );
}
