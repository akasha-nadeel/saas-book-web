"use client";

import { useEffect, useRef, useState } from "react";
import { saveNotes } from "@/lib/library-store";
import { useNotes } from "@/lib/use-library";

/**
 * Per-chapter notes — the "Overview" half of the left panel.
 *
 * Deliberately plain text rather than a second rich-text editor: notes are for
 * the writer, not for the reader, and a second Tiptap instance would double the
 * surface for no gain.
 */

const SECTIONS = [
  {
    key: "synopsis",
    title: "Synopsis",
    hint: "What happens in this chapter?",
  },
  {
    key: "notes",
    title: "Notes",
    hint: "Anything to fix, check, or remember.",
  },
] as const;

/** The two sections share one stored document, split on a sentinel line. */
const SEPARATOR = "\n---notes---\n";

function split(raw: string | null): [string, string] {
  if (!raw) return ["", ""];
  const at = raw.indexOf(SEPARATOR);
  if (at === -1) return [raw, ""];
  return [raw.slice(0, at), raw.slice(at + SEPARATOR.length)];
}

/** Keyed on chapterId by the caller, so switching chapters remounts and the
 *  lazy initialisers below re-read. Mirroring the store into state with an
 *  effect instead would cascade a render on every keystroke. */
export function NotesPanel({ chapterId }: { chapterId: string }) {
  const stored = useNotes(chapterId);
  const [synopsis, setSynopsis] = useState(() => split(stored)[0]);
  const [notes, setNotes] = useState(() => split(stored)[1]);
  const [open, setOpen] = useState<Record<string, boolean>>({
    synopsis: true,
    notes: true,
  });

  // Debounced, so a paragraph of notes isn't one localStorage write per key.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = (nextSynopsis: string, nextNotes: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const combined =
        nextSynopsis || nextNotes
          ? `${nextSynopsis}${SEPARATOR}${nextNotes}`
          : "";
      saveNotes(chapterId, combined);
    }, 500);
  };

  // Flush on unmount, or switching chapters loses the last half-second.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const value = { synopsis, notes };
  const setValue = { synopsis: setSynopsis, notes: setNotes };

  return (
    <div className="flex flex-col gap-1 p-3">
      {SECTIONS.map((section) => (
        <section key={section.key}>
          <button
            type="button"
            onClick={() =>
              setOpen((prev) => ({ ...prev, [section.key]: !prev[section.key] }))
            }
            aria-expanded={open[section.key]}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5
                       font-sans text-xs tracking-wide text-muted uppercase
                       outline-none hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            <span
              aria-hidden="true"
              className={`transition-transform ${
                open[section.key] ? "rotate-90" : ""
              }`}
            >
              ›
            </span>
            {section.title}
          </button>

          {open[section.key] && (
            <textarea
              value={value[section.key]}
              onChange={(e) => {
                const next = e.target.value;
                setValue[section.key](next);
                persist(
                  section.key === "synopsis" ? next : synopsis,
                  section.key === "notes" ? next : notes,
                );
              }}
              placeholder={section.hint}
              rows={section.key === "synopsis" ? 5 : 8}
              className="mt-1 w-full resize-y rounded-md border border-line
                         bg-surface px-3 py-2 font-sans text-sm leading-relaxed
                         text-fg placeholder:text-muted
                         focus-visible:border-accent focus-visible:outline-none"
            />
          )}
        </section>
      ))}
    </div>
  );
}
