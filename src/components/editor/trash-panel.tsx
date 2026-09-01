"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteChapterForever,
  findBook,
  restoreChapter,
  trashedChapters,
} from "@/lib/library-store";
import { useShelf } from "@/lib/use-library";
import { plural } from "@/lib/plural";
import { EmptyState } from "@/components/ui/empty-state";
import { ListFooter, ListGroup, ListRow, SectionHeader } from "@/components/ui/list";
import { relativeTime } from "@/lib/relative-time";
import { ConfirmDialog } from "@/components/ui/dialog";

/**
 * Deleted chapters for this book, and the way back.
 *
 * Deletion is recoverable: a deleted chapter keeps its prose and sits here until
 * the writer restores it or clears it for good. A tab of its own — always in the
 * rail — so it is somewhere a writer knows to look, not a section that only
 * appears once something is gone.
 */
export function TrashPanel({ bookId }: { bookId: string }) {
  const router = useRouter();
  const book = findBook(useShelf(), bookId);
  const trash = book ? trashedChapters(book) : [];

  const restore = (chapterId: string) => {
    restoreChapter(bookId, chapterId);
    router.push(`/book/${bookId}/chapter/${chapterId}`);
  };

  /* Was `window.confirm`, which the browser can be told to stop showing — see
     `ui/dialog.tsx`. The question is state now, so the answer arrives through a
     callback rather than from a blocking call.

     **Two slots, because both controls on a row now ask.** They are opposite
     questions and only one of them is destructive, but the two buttons sit
     millimetres apart at the end of a narrow row — and a press meant for
     Restore that lands on Delete is the one mistake in this panel nothing can
     undo. Asking on both means the mis-press is caught by a dialog that names
     which one you actually hit. */
  const [confirming, setConfirming] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [restoring, setRestoring] = useState<{
    id: string;
    title: string;
  } | null>(null);

  return (
    // No heading of its own: the panel's shared header already carries
    // "Deleted chapters", and two of them was two rows saying one thing.
    <div className="flex h-full flex-col">
      {trash.length === 0 ? (
        <EmptyState
          glyph={
            <>
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </>
          }
          title="Nothing deleted"
        >
          A chapter you delete from the manuscript is kept here, so you can
          bring it back.
        </EmptyState>
      ) : (
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
          {/* One group, where this was a `gap-0.5` column of loose rows. The
              two controls per row sit together at the end of it, which is where
              a row's actions go — not floated at two different insets. */}
          <SectionHeader trailing={trash.length}>Deleted</SectionHeader>
          <ListGroup as="ul">
          {trash.map((item) => (
            <li key={item.id}>
              <ListRow
                title={item.title}
                detail={
                  <>
                    deleted {relativeTime(item.trashedAt)}
                    {item.words > 0 ? ` · ${plural(item.words, "word")}` : ""}
                  </>
                }
                trailing={
                  <span className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setRestoring(item)}
                aria-label={`Restore ${item.title}`}
                title="Restore"
                className="shrink-0 rounded-md p-1.5 text-muted outline-none
                           transition-colors hover:bg-raised hover:text-fg
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M3.4 9.6a6.6 6.6 0 1 1 1.9 4.6" />
                  <path d="M3.2 5.4v4.2h4.2" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => setConfirming(item)}
                aria-label={`Delete ${item.title} forever`}
                title="Delete forever"
                className="shrink-0 rounded-md p-1.5 text-muted outline-none
                           transition-colors hover:bg-fg/10 hover:text-danger
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
                  </span>
                }
              />
            </li>
          ))}
          </ListGroup>

          <ListFooter>
            A deleted chapter waits here until you delete it for good. Nothing
            here counts towards your book&rsquo;s word total.
          </ListFooter>
        </div>
      )}

      {restoring && (
        /* Not `danger`: this puts a chapter back, and a red button on the
           harmless half of the pair would teach the writer to read the colour
           rather than the words — which is what makes the red one below stop
           working. It says where the chapter lands, because restoring also
           navigates there and a panel that jumps you into a chapter without
           warning is the same surprise from the other side. */
        <ConfirmDialog
          title="Put this chapter back?"
          body={
            <>
              <span className="text-tremor-content-strong">
                {restoring.title}
              </span>{" "}
              returns to the manuscript and opens.
            </>
          }
          confirmLabel="Restore"
          danger={false}
          onConfirm={() => restore(restoring.id)}
          onClose={() => setRestoring(null)}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Delete this permanently?"
          body={
            <>
              {/* The dialog palette, not the app's. `text-fg` here was the
                  documented mistake — a dialog carries `--color-tremor-*`, and
                  the two questions now sit side by side, so an emphasised
                  title in two different colours would be visible. */}
              <span className="text-tremor-content-strong">
                {confirming.title}
              </span>{" "}
              would be gone for good. This cannot be undone.
            </>
          }
          confirmLabel="Delete for good"
          onConfirm={() => deleteChapterForever(bookId, confirming.id)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
