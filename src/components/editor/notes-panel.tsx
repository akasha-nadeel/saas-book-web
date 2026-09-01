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
  /* What the timer is holding, so the unmount below has something to write.
     Without it the cleanup can only cancel, which is the bug it was meant to
     prevent. */
  const pending = useRef<string | null>(null);

  const persist = (nextSynopsis: string, nextNotes: string) => {
    if (timer.current) clearTimeout(timer.current);
    const combined =
      nextSynopsis || nextNotes ? `${nextSynopsis}${SEPARATOR}${nextNotes}` : "";
    pending.current = combined;
    timer.current = setTimeout(() => {
      saveNotes(chapterId, combined);
      pending.current = null;
    }, 500);
  };

  /*
   * **Flush on unmount — which is what this said and not what it did.**
   *
   * It cleared the timer and stopped, so the last half-second of typing was
   * cancelled rather than saved: type a line and switch chapters inside 500ms
   * and the line was gone. Harmless enough while the panel only closed on a
   * deliberate press; not harmless now that a click into the manuscript puts it
   * away, which is exactly what a writer does immediately after jotting a note
   * about the page they are looking at.
   *
   * The ref is read in the cleanup rather than the state, because a cleanup
   * with an empty dependency list closes over the *first* render's values.
   */
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) {
        saveNotes(chapterId, pending.current);
        pending.current = null;
      }
    };
    // The panel is keyed on the chapter, so this id cannot change under it.
  }, [chapterId]);

  const value = { synopsis, notes };
  const setValue = { synopsis: setSynopsis, notes: setNotes };

  return (
    <div className="scroll-slim flex h-full flex-col gap-1 overflow-y-auto p-3">
      {SECTIONS.map((section) => (
        <section key={section.key}>
          <button
            type="button"
            onClick={() =>
              setOpen((prev) => ({ ...prev, [section.key]: !prev[section.key] }))
            }
            aria-expanded={open[section.key]}
            className="flex w-full items-center gap-1.5 rounded-md px-1 py-1.5
                       font-sans text-[11px] font-semibold tracking-wide
                       text-muted uppercase outline-none hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {/* **A drawn chevron, not a `›`.** The character is a typographic
                mark: it sits on the text baseline rather than centred on the
                row, its weight is the font's rather than the icon set's, and
                it rotates around its own em-box instead of its middle. Every
                other disclosure in the pass is a 24-grid path. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
                open[section.key] ? "rotate-90" : ""
              }`}
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
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
              /* Filled rather than outlined, and a ring on focus rather than a
                 border swap — the field treatment the whole pass uses. */
              className="scroll-slim mt-1 w-full resize-y rounded-[10px] bg-raised
                         px-3 py-2 font-sans text-[13px] leading-relaxed text-fg
                         outline-none placeholder:text-muted
                         focus:ring-2 focus:ring-accent/50"
            />
          )}
        </section>
      ))}
    </div>
  );
}
