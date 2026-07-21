"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createChapter,
  deleteChapter,
  moveChapter,
  setBookTitle,
} from "@/lib/chapter-store";
import { useManifest } from "@/lib/use-chapters";

export function ChapterSidebar() {
  const { bookTitle, chapters } = useManifest();
  const router = useRouter();
  const pathname = usePathname();

  // The route is the source of truth for which chapter is open, so the sidebar
  // needs no state of its own to stay in sync with the editor.
  const activeId = pathname.startsWith("/chapter/")
    ? decodeURIComponent(pathname.slice("/chapter/".length))
    : null;

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleCreate = () => {
    router.push(`/chapter/${createChapter()}`);
  };

  const handleDelete = (id: string, title: string) => {
    // A chapter is somebody's prose. Cheap dialog, but never silently.
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;

    const remaining = chapters.filter((c) => c.id !== id);
    deleteChapter(id);

    // Only navigate if the writer just deleted the chapter they were looking at.
    if (id === activeId) {
      router.replace(remaining.length ? `/chapter/${remaining[0].id}` : "/");
    }
  };

  const handleDrop = (to: number) => {
    if (dragIndex !== null) moveChapter(dragIndex, to);
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
        <input
          value={bookTitle}
          onChange={(e) => setBookTitle(e.target.value)}
          aria-label="Book title"
          spellCheck={false}
          className="w-full truncate rounded-sm bg-transparent font-serif text-base
                     text-ink outline-none focus-visible:ring-2
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
                  href={`/chapter/${chapter.id}`}
                  aria-current={isActive ? "page" : undefined}
                  // Native drag-and-drop is mouse-only, so reordering also needs
                  // a keyboard path or it is unreachable for some writers.
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                  onKeyDown={(e) => {
                    if (!e.altKey) return;
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      moveChapter(index, index - 1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      moveChapter(index, index + 1);
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
