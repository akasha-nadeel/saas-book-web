"use client";

import { useEffect, useRef } from "react";
import { nounFor, plural } from "@/lib/plural";
import { Button } from "@/components/ui/button";

/**
 * Asked before a file lands in one part of the book that already has pages.
 *
 * The whole-book import asks its own version of this (`ImportModeDialog`) and
 * asks it about the chapters, because that is the only thing its Replace can
 * clear. A card's import is a narrower thing and needs a narrower question:
 * *what should happen to the pages in this one part?* — which is the question
 * that had no way of being asked at all until now. A writer with eight
 * switched-on back-matter templates and a file of the real prose was told
 * "This book already has every page in that file", which was true of the names
 * and beside the point.
 *
 * **Both answers are spelled out in what they will actually do**, not in what
 * they are called. Add is the safe one and leads, but it is also the one that
 * can quietly do nothing — every incoming page may be a page the book has, and
 * that is exactly the case that used to surface afterwards as a storage error.
 * So it carries its own count, and when the count is zero the button says so
 * before it is pressed rather than after.
 */
export function SectionImportDialog({
  label,
  noun,
  existingCount,
  incomingCount,
  newCount,
  leftOut,
  onAdd,
  onReplace,
  onClose,
}: {
  /** The card's own name — "Front matter", "Back matter". */
  label: string;
  /** What this part is counted in: "page" for matter, "chapter" for the body. */
  noun: string;
  /** Pages the part holds now. Never zero — the caller does not ask if it is. */
  existingCount: number;
  /** Pieces of the file that belong to this part. */
  incomingCount: number;
  /** How many of those the book does not already have, if Add is chosen. */
  newCount: number;
  /** Titles in the file that are not this part, in the file's own words. */
  leftOut: readonly string[];
  onAdd: () => void;
  onReplace: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const yours = plural(existingCount, noun);
  const theirs = plural(incomingCount, noun);

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
        <h2 className="font-serif text-xl">
          {label} already has {yours}
        </h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-tremor-content">
          That file has <span className="text-tremor-content-strong">{theirs}</span> for this part.
          What should happen to the {nounFor(existingCount, noun)}{" "}
          you have?
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {/* Add: the safe answer, so it leads — even when it is the empty one. */}
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg border border-tremor-border px-4 py-3 text-left outline-none
                       transition-colors hover:border-accent/60 hover:bg-tremor-background-subtle
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="block font-sans text-sm font-semibold text-tremor-content-strong">
              Keep mine and add what is new
            </span>
            <span className="mt-0.5 block font-sans text-xs text-tremor-content">
              {newCount === 0
                ? `Every ${noun} in that file is one this book already has, so nothing would go in. Pages are matched by name — a book has one dedication, not two.`
                : `${plural(newCount, noun)} would go in. The ${yours} you have are left exactly as they are.`}
            </span>
          </button>

          {/* Replace: destructive, so it carries the danger colour and its own
              consequence in plain words — and names what it does *not* touch,
              because the last dialog to say "everything" here did not mean it. */}
          <button
            type="button"
            onClick={onReplace}
            className="rounded-lg border px-4 py-3 text-left outline-none
                       transition-colors hover:bg-tremor-background-subtle focus-visible:ring-2
                       focus-visible:ring-accent/60"
            style={{
              borderColor:
                "color-mix(in srgb, var(--color-danger) 45%, transparent)",
            }}
          >
            <span
              className="block font-sans text-sm font-semibold"
              style={{ color: "var(--color-danger)" }}
            >
              Replace my {nounFor(existingCount, noun)}
            </span>
            <span className="mt-0.5 block font-sans text-xs text-tremor-content">
              Delete the {yours} in {label.toLowerCase()}{" "}
              and use the file&rsquo;s {theirs} instead. Nothing outside this
              part is touched. You can still undo this straight after.
            </span>
          </button>
        </div>

        {/* **What is not going in, named.** A filter nobody can see is worse
            than the problem it solves — the same rule the export screen follows
            for the pages it leaves out. It sits under the two answers rather
            than in the question, because it is true of both. */}
        {leftOut.length > 0 && (
          <p className="mt-4 rounded-lg border border-note-line bg-note-bg px-3.5
                        py-2.5 font-sans text-xs leading-relaxed text-note-fg">
            <span className="font-semibold">
              {leftOut.length === 1
                ? "One other thing in that file"
                : `${leftOut.length} other things in that file`}
            </span>{" "}
            {leftOut.length === 1 ? "is" : "are"} not {label.toLowerCase()} and{" "}
            {leftOut.length === 1 ? "is" : "are"} not going in:{" "}
            {leftOut.join(", ")}.
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onClose} className="text-tremor-content hover:bg-tremor-background-subtle hover:text-tremor-content-strong">
            Cancel
          </Button>
        </div>
      </div>
    </dialog>
  );
}
