"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BOOK_TEMPLATES, type BookTemplate } from "@/lib/book-templates";
import { createBookFromTemplate } from "@/lib/library-store";

export function TemplatesDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const start = (template: BookTemplate) => {
    const { bookId, chapterId } = createBookFromTemplate(
      title.trim() || "Untitled Book",
      template.chapters,
    );
    router.push(`/book/${bookId}/chapter/${chapterId}`);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[34rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">Start from a template</h2>
        <p className="mt-1 font-sans text-sm text-muted">
          A template sets up the chapters. Nothing is written for you.
        </p>

        <label className="mt-5 block font-sans text-sm">
          <span className="text-xs tracking-wide text-muted uppercase">
            Book title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Book"
            className="mt-1.5 w-full rounded-md border border-line bg-surface
                       px-3 py-2 text-fg placeholder:text-muted
                       focus-visible:border-accent focus-visible:outline-none"
          />
        </label>

        <ul className="mt-5 flex flex-col gap-1.5">
          {BOOK_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => start(template)}
                className="w-full rounded-md border border-line px-3 py-2.5
                           text-left outline-none transition-colors
                           hover:border-accent/60 hover:bg-raised
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-sans text-sm font-medium text-fg">
                    {template.name}
                  </span>
                  <span className="shrink-0 font-sans text-xs tabular-nums text-muted">
                    {template.chapters.length}{" "}
                    {template.chapters.length === 1 ? "chapter" : "chapters"}
                  </span>
                </span>
                <span className="mt-0.5 block font-sans text-xs text-muted">
                  {template.description}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 font-sans text-sm text-muted
                       outline-none transition-colors hover:bg-raised
                       hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
