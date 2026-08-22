"use client";

import Link from "next/link";
import { icons } from "@/components/editor/icon-rail";

export function MobileEditorHeader({
  chapterTitle,
  status,
  onChapters,
}: {
  chapterTitle: string;
  status: string;
  onChapters: () => void;
}) {
  return (
    <header className="oc-editor-mobile-header fixed inset-x-0 top-(--oc-visual-offset-top) z-[35] hidden items-center gap-2 border-b border-line bg-panel/95 px-[max(0.5rem,var(--oc-safe-left))] pt-(--oc-safe-top) backdrop-blur">
      <div className="flex shrink-0 items-center">
        <Link
          href="/"
          aria-label="All books"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            {icons.home}
          </svg>
        </Link>

        <button
          type="button"
          onClick={onChapters}
          aria-label={`Choose a chapter. Current chapter: ${chapterTitle}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            {icons.chapters}
          </svg>
        </button>
      </div>

      <span className="min-w-0 flex-1 truncate font-serif text-sm font-semibold text-fg">
        {chapterTitle}
      </span>

      <span
        aria-live="polite"
        className="max-w-[6.5rem] shrink-0 truncate px-1 text-right text-[11px] text-muted"
      >
        {status}
      </span>
    </header>
  );
}
