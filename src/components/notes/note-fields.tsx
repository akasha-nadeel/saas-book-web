"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { saveNotes } from "@/lib/library-store";
import { useNotes } from "@/lib/use-library";

/**
 * The two fields a chapter's notes are made of, and the storage behind them.
 *
 * Lifted out of `editor/notes-panel.tsx` when the notes left the side panel for
 * a screen of their own (`notes-view.tsx`). The storage half is unchanged and
 * is the part worth not rewriting: one stored document per chapter, split on a
 * sentinel line, written on a 500ms debounce, and **flushed on unmount**.
 *
 * Deliberately plain text rather than a second rich-text editor: notes are for
 * the writer, not for the reader, and a second Tiptap instance would double the
 * surface for no gain.
 */

/** The two sections share one stored document, split on a sentinel line. */
const SEPARATOR = "\n---notes---\n";

export function splitNote(raw: string | null): [string, string] {
  if (!raw) return ["", ""];
  const at = raw.indexOf(SEPARATOR);
  if (at === -1) return [raw, ""];
  return [raw.slice(0, at), raw.slice(at + SEPARATOR.length)];
}

/**
 * The one line a list row shows of a note.
 *
 * The synopsis first, because it is the line that says what the chapter *is*;
 * the notes only when there is no synopsis. Empty when the chapter has neither,
 * which is what the row draws its "nothing here yet" from.
 */
export function notePreview(raw: string | null): string {
  const [synopsis, notes] = splitNote(raw);
  const source = synopsis.trim() ? synopsis : notes;
  return source.split("\n").find((line) => line.trim())?.trim() ?? "";
}

/** Whether a chapter has anything written against it at all. */
export function hasNote(raw: string | null): boolean {
  const [synopsis, notes] = splitNote(raw);
  return Boolean(synopsis.trim() || notes.trim());
}

/**
 * A field that is as tall as what is in it.
 *
 * The synopsis is a sentence or two for most chapters and a paragraph for
 * some, and a box fixed at either size is wrong for the other. Measured rather
 * than guessed from the character count: a wrapped line is a line.
 *
 * `height = auto` before reading `scrollHeight` is the part that is easy to
 * miss — once a previous pass has set an explicit height, the scroll height
 * *is* that height, and the box can only ever grow.
 */
function GrowingArea({
  value,
  onChange,
  placeholder,
  label,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className={`scroll-slim w-full resize-none rounded-xl bg-raised px-4 py-3
                  font-sans text-[15px] leading-relaxed text-fg outline-none
                  placeholder:text-muted focus:ring-2 focus:ring-accent/50
                  ${className}`}
    />
  );
}

/** The small-caps label over a field. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block px-1 font-sans text-[11px] font-semibold tracking-wide text-muted uppercase">
      {children}
    </span>
  );
}

/**
 * Keyed on `chapterId` by the caller, so moving to another chapter remounts —
 * which is what makes the flush below write the chapter being *left* rather
 * than the one being arrived at, and what lets the lazy initialisers re-read.
 * Mirroring the store into state with an effect instead would cascade a render
 * on every keystroke.
 */
export function NoteFields({ chapterId }: { chapterId: string }) {
  const stored = useNotes(chapterId);
  const [synopsis, setSynopsis] = useState(() => splitNote(stored)[0]);
  const [notes, setNotes] = useState(() => splitNote(stored)[1]);

  // Debounced, so a paragraph of notes isn't one storage write per key.
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
   * deliberate press; not harmless now that this screen lets a writer walk a
   * whole book's notes a row at a time, where every move is a remount.
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
    // The fields are keyed on the chapter, so this id cannot change under them.
  }, [chapterId]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div>
        <FieldLabel>Synopsis</FieldLabel>
        <GrowingArea
          label="Synopsis"
          value={synopsis}
          placeholder="What happens in this chapter?"
          className="min-h-[7rem]"
          onChange={(next) => {
            setSynopsis(next);
            persist(next, notes);
          }}
        />
      </div>

      {/* The notes take whatever height is left. The pane is the size of the
          field, so it carries no resize handle — a corner grip that can only
          make a box smaller than its container is a control with nothing to
          offer. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <FieldLabel>Notes</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            persist(synopsis, e.target.value);
          }}
          placeholder="Anything to fix, check, or remember."
          aria-label="Notes"
          className="scroll-slim min-h-[10rem] w-full flex-1 resize-none rounded-xl
                     bg-raised px-4 py-3 font-sans text-[15px] leading-relaxed
                     text-fg outline-none placeholder:text-muted
                     focus:ring-2 focus:ring-accent/50"
        />
      </div>
    </div>
  );
}
