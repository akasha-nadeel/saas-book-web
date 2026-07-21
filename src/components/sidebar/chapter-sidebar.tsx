"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createChapter,
  deleteChapter,
  findBook,
  moveChapter,
  renameBook,
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
    <aside
      className="flex w-(--sidebar-width) shrink-0 flex-col border-r
                 border-ink/10 bg-ink/[0.025]"
      aria-label="Chapters"
    >
      <div className="px-5 pt-6 pb-4">
        <Link
          href="/"
          className="rounded-sm font-sans text-xs text-warmgray outline-none
                     hover:text-burgundy focus-visible:ring-2
                     focus-visible:ring-gold/60"
        >
          ← All books
        </Link>
        <input
          value={book?.title ?? ""}
          onChange={(e) => renameBook(bookId, e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) renameBook(bookId, "Untitled Book");
          }}
          aria-label="Book title"
          spellCheck={false}
          className="mt-2 w-full truncate rounded-sm bg-transparent font-serif
                     text-base text-ink outline-none focus-visible:ring-2
                     focus-visible:ring-gold/60"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
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
                    ? "before:absolute before:inset-x-2 before:-top-px before:h-px before:bg-gold"
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
                  className={`flex items-baseline gap-2 rounded-sm py-2 pr-8 pl-3
                              font-sans text-sm outline-none
                              focus-visible:ring-2 focus-visible:ring-gold/60 ${
                                isActive
                                  ? "bg-burgundy/8 text-burgundy"
                                  : "text-warmgray hover:text-ink"
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
                             py-0.5 font-sans text-sm leading-none text-warmgray
                             opacity-0 outline-none transition-opacity
                             group-hover:opacity-60 hover:!opacity-100
                             hover:text-burgundy focus-visible:opacity-100
                             focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="px-2 pb-4">
        <button
          type="button"
          onClick={handleCreate}
          className="w-full rounded-sm py-2 pl-3 text-left font-sans text-sm
                     text-warmgray outline-none hover:text-burgundy
                     focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          + New chapter
        </button>
      </div>
    </aside>
  );
}
