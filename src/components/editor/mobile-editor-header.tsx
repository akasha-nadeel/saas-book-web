"use client";

import Link from "next/link";
import { RailMark } from "@/components/editor/rail-mark";

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
      <div className="flex shrink-0 items-center gap-0.5">
        <Link
          href="/"
          aria-label="All books"
          className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg/80 outline-none hover:bg-raised/70 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <RailMark mark="home" />
        </Link>

        <button
          type="button"
          onClick={onChapters}
          aria-label={`Choose a chapter. Current chapter: ${chapterTitle}`}
          className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg/80 outline-none hover:bg-raised/70 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <RailMark mark="chapters" />
        </button>
      </div>

      <span className="min-w-0 flex-1 truncate font-serif text-[13px] font-semibold text-fg">
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
