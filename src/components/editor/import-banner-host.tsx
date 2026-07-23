"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { undoChapterImport, type ImportUndo } from "@/lib/library-store";
import { ImportBanner } from "@/components/editor/import-banner";

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
  undo: ImportUndo;
  count: number;
}

let current: BannerState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showImportBanner(bookId: string, undo: ImportUndo, count: number) {
  current = { bookId, undo, count };
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

  return (
    <ImportBanner
      count={state.count}
      onKeep={clearImportBanner}
      onUndo={() => {
        undoChapterImport(state.undo);
        clearImportBanner();
        // Back to whatever was open before the import, or the book root if that
        // chapter is now gone.
        router.push(
          state.undo.prevLastOpenedId
            ? `/book/${state.bookId}/chapter/${state.undo.prevLastOpenedId}`
            : `/book/${state.bookId}`,
        );
      }}
    />
  );
}
