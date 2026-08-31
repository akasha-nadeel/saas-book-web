"use client";

import { usePathname } from "next/navigation";
import { BookPanel, useOpenPart } from "@/components/editor/book-panel";
import { findBook } from "@/lib/library-store";
import { useCover, usePrefs, useShelf } from "@/lib/use-library";

/**
 * The chapter and matter pages sidebar navigator.
 *
 * Renders the same 3-matter-cards BookPanel navigator (front matter, body,
 * and back matter), with chapter switching and section imports.
 */
export function ChapterSidebar({
  bookId,
  onNavigate,
  onClose,
}: {
  bookId: string;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const prefs = usePrefs();
  const cover = useCover(bookId);
  const body = useOpenPart();
  const pathname = usePathname();

  const prefix = `/book/${bookId}/chapter/`;
  const activeId = pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null;

  if (!book) return null;

  return (
    <div className="h-full w-full">
      <BookPanel
        book={book}
        chapterId={activeId}
        cover={cover}
        paper={prefs.paper}
        body={body}
        always
        onNavigate={onNavigate}
        onClose={onClose ?? onNavigate}
        className="flex h-full w-full flex-col bg-white dark:bg-transparent"
      />
    </div>
  );
}
