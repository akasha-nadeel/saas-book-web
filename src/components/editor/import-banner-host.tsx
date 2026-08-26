"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { undoChapterImport, type ImportUndo } from "@/lib/library-store";
import { ImportBanner } from "@/components/editor/import-banner";
import type { ImportSummary } from "@/lib/import/split";

/**
 * Holds and shows the post-import undo banner.
 *
 * The banner has to outlive the chapter the writer lands on — they should be
 * able to click through the imported chapters checking the order while it stays
 * up — so its state lives at module scope, not inside the editor that remounts
 * on every chapter change. The host is rendered once in the book layout, which
 * persists across chapter navigation; ChapterSidebar sets the state after an
 * import through showImportBanner.
 */
interface BannerState {
  bookId: string;
  /**
   * Absent when a whole book was imported rather than chapters added to one.
   * There is nothing to undo *to* in that case — the book did not exist a
   * moment ago — so the banner reports and dismisses instead of offering a
   * button that would have to mean "delete this book".
   */
  undo?: ImportUndo;
  summary: ImportSummary;
  /**
   * What the file held that was not this part, when a section import left
   * something behind.
   *
   * The card's dialog names it too, but only when it is shown — and it is not
   * shown for a part that had no pages to ask about. Without this, a manuscript
   * dropped on an empty Back matter card would land its epilogue and say
   * nothing at all about the ten chapters it left on the floor.
   */
  leftOut?: readonly string[];
}

let current: BannerState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showImportBanner(
  bookId: string,
  summary: ImportSummary,
  undo?: ImportUndo,
  leftOut?: readonly string[],
) {
  current = { bookId, summary, undo, leftOut };
  emit();
}

function clearImportBanner() {
  current = null;
  emit();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function ImportBannerHost() {
  const router = useRouter();
  const state = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

  if (!state) return null;

  // Narrowed once here: inside the callback below, `state.undo` is optional
  // again as far as the compiler is concerned.
  const undo = state.undo;

  return (
    <ImportBanner
      summary={state.summary}
      leftOut={state.leftOut}
      onKeep={clearImportBanner}
      onUndo={
        undo
          ? () => {
              undoChapterImport(undo);
              clearImportBanner();
              // Back to whatever was open before the import, or the book root
              // if that chapter is now gone.
              router.push(
                undo.prevLastOpenedId
                  ? `/book/${state.bookId}/chapter/${undo.prevLastOpenedId}`
                  : `/book/${state.bookId}`,
              );
            }
          : undefined
      }
    />
  );
}
