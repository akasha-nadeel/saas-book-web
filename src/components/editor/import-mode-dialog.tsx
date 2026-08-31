"use client";

import { useEffect, useRef } from "react";
import { summaryPhrase, type ImportSummary } from "@/lib/import/split";
import { plural } from "@/lib/plural";
import { Button } from "@/components/ui/button";

/**
 * Asked before an import lands in a book that already has chapters in it.
 *
 * A writer who has started a novel here and then imports a file has to be told
 * what will happen to what they wrote. Replace clears the chapters; Add keeps
 * them and numbers the import on from the end. Replace is destructive, so it
 * says so and wears the warning colour.
 *
 * **It counts in the two units the book is actually made of.** It used to take
 * a single number for each side and call both of them chapters, which was two
 * separate untruths on one screen. The book's number was body chapters — right,
 * but silently so, and a writer looking at eight back-matter pages in the panel
 * beside "You have 10 chapters" had no way to tell whether the eight were
 * counted. The file's number was everything in the file, matter pages included,
 * so importing eight back-matter pages announced "the file has 8 chapters" and
 * then offered to number them on from Chapter 11 — pages that are named and
 * never numbered. Both sides are an `ImportSummary` now, phrased by the same
 * function the banner uses.
 *
 * **And "Replace everything" never replaced everything.** `importIntoBook`
 * spares every front- and back-matter page on purpose — a manuscript file is
 * the story, not the writer's dedication — so the heading was frightening in a
 * way the behaviour was not. It names what it takes.
 */
export function ImportModeDialog({
  existing,
  incoming,
  onAdd,
  onReplace,
  onClose,
}: {
  /** What the book holds now, counted by part. */
  existing: ImportSummary;
  /** What the file holds, counted the same way. */
  incoming: ImportSummary;
  onAdd: () => void;
  onReplace: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  /* Only ever asked when both sides have body chapters — with none at stake
     there is nothing for Replace to mean, and the caller lets the import
     straight in. See `import-chapter-button.tsx`. */
  const yourChapters = plural(existing.body, "chapter");
  const theirChapters = plural(incoming.body, "chapter");
  /* Whether the sentence about sparing matter is worth saying at all. On a book
     with no front or back matter it is an answer to a question nobody asked. */
  const keepsPages = existing.front + existing.back > 0;
  const bringsPages = incoming.front + incoming.back > 0;

  return (
    <dialog
      ref={dialogRef}
      data-dialog-presentation="sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[30rem] max-w-[calc(100vw-2rem)] rounded-lg bg-tremor-background
                 p-0 text-tremor-content-strong backdrop:bg-black/70"
    >
      <div className="oc-dialog-scroll p-6">
        <h2 className="font-serif text-xl">This book already has writing</h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-tremor-content">
          You have <span className="text-tremor-content-strong">{summaryPhrase(existing)}</span> in
          this book, and the file has{" "}
          <span className="text-tremor-content-strong">{summaryPhrase(incoming)}</span>. What should
          happen to your chapters?
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {/* Add: the safe default, so it leads. */}
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg border border-tremor-border px-4 py-3 text-left outline-none
                       transition-colors hover:border-accent/60 hover:bg-tremor-background-subtle
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="block font-sans text-sm font-semibold text-tremor-content-strong">
              Add to my book
            </span>
            <span className="mt-0.5 block font-sans text-xs text-tremor-content">
              Keep everything you have. The file&rsquo;s {theirChapters} go after
              yours, numbered on from Chapter {existing.body + 1}.
              {bringsPages
                ? " Its front and back pages join the ones you already have — any page you already have is left alone."
                : ""}
            </span>
          </button>

          {/* Replace: destructive, so it carries the danger colour and its own
              consequence in plain words. */}
          <button
            type="button"
            onClick={onReplace}
            className="rounded-lg border px-4 py-3 text-left outline-none
                       transition-colors hover:bg-tremor-background-subtle focus-visible:ring-2
                       focus-visible:ring-accent/60"
            style={{ borderColor: "color-mix(in srgb, var(--color-danger) 45%, transparent)" }}
          >
            <span
              className="block font-sans text-sm font-semibold"
              style={{ color: "var(--color-danger)" }}
            >
              Replace my chapters
            </span>
            <span className="mt-0.5 block font-sans text-xs text-tremor-content">
              Delete the {yourChapters} you have here and use the file&rsquo;s
              instead, numbered from Chapter 1.
              {keepsPages
                ? " Your front and back matter pages are kept — this only touches chapters."
                : ""}{" "}
              You can still undo this straight after.
            </span>
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onClose} className="text-tremor-content hover:bg-tremor-background-subtle hover:text-tremor-content-strong">
            Cancel
          </Button>
        </div>
      </div>
    </dialog>
  );
}
