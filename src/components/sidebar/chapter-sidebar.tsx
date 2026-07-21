"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createChapter,
  deleteChapter,
  findBook,
  moveChapter,
} from "@/lib/library-store";
import { useShelf } from "@/lib/use-library";

export function ChapterSidebar({ bookId }: { bookId: string }) {
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const router = useRouter();
  const pathname = usePathname();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // The route is the source of truth for which chapter is open, so the sidebar
  // needs no state of its own to stay in sync with the editor.
  const prefix = `/book/${bookId}/chapter/`;
  const activeId = pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null;

  const chapters = book?.chapters ?? [];

  const handleCreate = () => {
    router.push(`/book/${bookId}/chapter/${createChapter(bookId)}`);
  };

  const handleDelete = (id: string, title: string) => {
    // A chapter is somebody's prose. Cheap dialog, but never silently.
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;

    const remaining = chapters.filter((c) => c.id !== id);
    deleteChapter(bookId, id);

    // Only navigate if the writer just deleted the chapter they were reading.
    if (id === activeId) {
      router.replace(
        remaining.length
          ? `/book/${bookId}/chapter/${remaining[0].id}`
          : `/book/${bookId}`,
      );
    }
  };

  const handleDrop = (to: number) => {
    if (dragIndex !== null) moveChapter(bookId, dragIndex, to);
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    // No width or chrome of its own: it is one tab inside the left panel now.
    <div className="flex h-full flex-col" aria-label="Chapters">
      <nav className="flex-1 px-2 pt-2 pb-2">
        <ol>
          {chapters.map((chapter, index) => {
            const isActive = chapter.id === activeId;

            return (
              <li
                key={chapter.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragOver={(e) => {
                  // Without preventDefault the browser refuses the drop.
                  e.preventDefault();
                  setOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(index);
                }}
                className={`group relative rounded-sm ${
                  overIndex === index && dragIndex !== index
                    ? "before:absolute before:inset-x-2 before:-top-px before:h-px before:bg-accent"
                    : ""
                } ${dragIndex === index ? "opacity-40" : ""}`}
              >
                <Link
                  href={`/book/${bookId}/chapter/${chapter.id}`}
                  aria-current={isActive ? "page" : undefined}
                  // Native drag-and-drop is mouse-only, so reordering also
                  // needs a keyboard path or it is unreachable for some writers.
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                  onKeyDown={(e) => {
                    if (!e.altKey) return;
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      moveChapter(bookId, index, index - 1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      moveChapter(bookId, index, index + 1);
                    }
                  }}
                  // The open chapter is filled, not tinted — a solid deep green
                  // with white on it, the way a selected nav row reads.
                  className={`flex items-baseline gap-2 rounded-md py-2 pr-8 pl-3
                              font-sans text-sm outline-none transition-colors
                              focus-visible:ring-2 focus-visible:ring-accent/60 ${
                                isActive
                                  ? "bg-accent-deep text-white"
                                  : "text-muted hover:bg-raised hover:text-fg"
                              }`}
                >
                  <span className="w-4 shrink-0 text-right text-xs tabular-nums opacity-60">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate">{chapter.title}</span>
                  {chapter.words > 0 && (
                    <span className="shrink-0 text-xs tabular-nums opacity-50">
                      {chapter.words.toLocaleString()}
                    </span>
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => handleDelete(chapter.id, chapter.title)}
                  aria-label={`Delete ${chapter.title}`}
                  className="absolute top-1/2 right-1 -translate-y-1/2 rounded-sm px-1.5
                             py-0.5 font-sans text-sm leading-none text-muted
                             opacity-0 outline-none transition-opacity
                             group-hover:opacity-60 hover:!opacity-100
                             hover:text-accent focus-visible:opacity-100
                             focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="px-3 pt-2 pb-4">
        {/* A real primary button rather than a line of grey text — creating a
            chapter is the main thing this panel is for. */}
        <button
          type="button"
          onClick={handleCreate}
          className="w-full rounded-md bg-accent py-2 text-center font-sans
                     text-sm font-semibold text-white outline-none
                     transition-colors hover:bg-accent-strong
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          New chapter
        </button>
      </div>
    </div>
  );
}
