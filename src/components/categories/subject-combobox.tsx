"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  matchHeadings,
  mergeHeadings,
  rankHeadings,
  type SubjectHeading,
} from "@/lib/comps/subjects";
import { COMMON_SUBJECTS } from "@/lib/comps/common-subjects";

/*
 * **Kept whole, with nothing calling it, and that is on purpose.**
 *
 * This is the picker out of the categories screen's "On this book" section,
 * which was taken off the page on 2026-08-11 to be rebuilt rather than left
 * half-present. What went with the section was its framing — the heading, the
 * three-shop chip, the count, the quick-add row. What is here is the part any
 * replacement needs and none of it is cheap to write again: the debounce with
 * last-reply-wins, the shipped index answering the first keystroke before the
 * network can, the merge that stops the rows reshuffling under the reader, and
 * the keyboard handling a combobox is judged by.
 *
 * It follows the house pattern for `templates-dialog.tsx` and `ambience.ts` —
 * built, working, no way in — so `TODO.md` carries what it is waiting on. Do
 * not tidy it away; pointing the new section at it is the whole of switching
 * it back on.
 */
/**
 * The box a writer types their own category into, with the catalogue
 * suggesting as they go.
 *
 * **The suggestions are a real index, not a list we wrote.** Open Library's
 * subject search, through `/api/comps/subjects` — free, keyless, cached for a
 * week. That matters more here than it looks: BISAC is licensed and shipping
 * our own idea of "all book categories" would be the invented-taxonomy problem
 * this whole screen exists to avoid. Nobody here knows what the categories
 * are; the catalogue does.
 *
 * **The shelf size is the useful half.** "Fiction, mystery & detective,
 * general — 61,392 works" tells a writer they are looking at the main road,
 * where "Cozy Mystery — 157" is a lane. It is Open Library's figure, labelled
 * as works catalogued, and it is never presented as an Amazon rank or a search
 * volume — those cannot be had honestly and nothing on this screen claims one.
 *
 * **It stays a text box.** Typing something the index has never heard of and
 * pressing Add still works, because a shop's own category names are not in
 * this index and a writer pasting one out of KDP must not be blocked by a
 * dropdown that has no opinion about it. The suggestions help; they do not
 * gate.
 */
export function SubjectCombobox({
  value,
  onChange,
  onAdd,
  onPick,
  chips,
  onBackspace,
}: {
  value: string;
  onChange: (next: string) => void;
  onAdd: () => void;
  onPick: (name: string) => void;
  /**
   * The chosen categories, drawn *inside* the field.
   *
   * They used to sit in a zone of their own above a divider, with the input
   * below — two boxes for one idea. Every token field worth copying puts the
   * tokens in the field: Gmail's recipients, Stack Overflow's tags, Linear's
   * labels. The pattern's own rule is that the chips and the caret share one
   * bordered surface and clicking anywhere in it focuses the input, because
   * what the writer is editing is *the list*, and the caret is just where the
   * next one goes.
   */
  chips?: ReactNode;
  /**
   * Backspace on an empty input removes the last chip.
   *
   * Named as an anti-pattern in the guidance — omitting it "forces mouse
   * usage" — and it is the one keyboard habit anybody who has typed into a
   * recipient field already has.
   */
  onBackspace?: () => void;
}) {
  const [found, setFound] = useState<SubjectHeading[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  /*
   * Debounced, and the last reply wins.
   *
   * A request per keystroke would be rude to a free catalogue and pointless —
   * nobody reads a dropdown mid-word. 200ms is about the gap between letters
   * for a fast typist. The counter guards against the older of two in-flight
   * replies landing last and overwriting the newer, which is the bug every
   * autocomplete has once.
   */
  // Only the part being typed: with commas, the earlier ones are finished.
  const fragment = (value.split(/[,;]/).pop() ?? "").trim();

  const asked = useRef(0);
  useEffect(() => {
    // One letter is answered locally — see `local` below — and the index
    // cannot answer it anyway. Nothing is cleared here: whether the list is
    // *shown* is derived, so a stale reply cannot flash and this effect never
    // sets state synchronously.
    if (fragment.length < 2) return;

    const mine = ++asked.current;
    const timer = setTimeout(() => {
      void fetch(`/api/comps/subjects?q=${encodeURIComponent(fragment)}`)
        .then((r) => (r.ok ? r.json() : { subjects: [] }))
        .then((data) => {
          if (mine !== asked.current) return;
          setFound(Array.isArray(data.subjects) ? data.subjects : []);
          setActive(-1);
        })
        .catch(() => {
          // A dropdown that cannot suggest is a text box, which still works.
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [fragment]);

  /** Replace only the part being typed, so earlier commas survive. */
  function pick(name: string) {
    const parts = value.split(/[,;]/);
    if (parts.length > 1) {
      parts.pop();
      const kept = parts.map((p) => p.trim()).filter(Boolean);
      onChange("");
      for (const one of kept) onPick(one);
    } else {
      onChange("");
    }
    onPick(name);
    setFound([]);
    setOpen(false);
  }

  /**
   * The shipped index, answering before the network can.
   *
   * **Local first is what makes an autocomplete feel like one.** Every
   * suggestion worth using appears on the first character, and this one has
   * to: the live index 500s on `m*` and matches middle initials on plain `m`,
   * so a letter was previously answered with nothing. 900 real headings sit in
   * `common-subjects.ts`, matched and ranked with the same two functions the
   * server uses, so the local and remote halves cannot disagree about order.
   */
  const local = useMemo(
    () => rankHeadings(matchHeadings(COMMON_SUBJECTS, fragment), fragment),
    [fragment],
  );

  /**
   * Both halves as one list, local first.
   *
   * The remote is not a replacement — it is the long tail. Merged rather than
   * swapped in, so the rows a reader was already looking at do not reshuffle
   * under them when the request lands, which is the thing that makes a
   * dropdown feel like it is fighting you.
   */
  const rows = useMemo(
    () => rankHeadings(mergeHeadings(local, found), fragment).slice(0, 8),
    [local, found, fragment],
  );

  const showing = open && rows.length > 0;

  return (
    <div className="relative">
      {/* **One field, not two boxes.** The border moved off the input and onto
          this row, so the chips, the caret and Add sit on a single surface —
          and `focus-within` puts the ring around the whole of it, which is what
          makes it read as one control rather than a chip list that happens to
          be above a text box. */}
      <form
        className="flex flex-wrap items-center gap-2 rounded-xl border border-line
                   bg-surface p-2 transition-colors focus-within:border-accent/60
                   focus-within:ring-2 focus-within:ring-accent/40"
        onSubmit={(e) => {
          e.preventDefault();
          if (showing && active >= 0) pick(rows[active].name);
          else onAdd();
        }}
      >
        {chips}
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // A click on a suggestion blurs the input first, so closing is
          // deferred past the click that would otherwise never land.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            /* **Before the `showing` guard**, or this only works while the
               dropdown happens to be open — which is exactly when the writer
               is least likely to want it. */
            if (e.key === "Backspace" && value === "" && onBackspace) {
              e.preventDefault();
              onBackspace();
              return;
            }
            if (!showing) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % rows.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i <= 0 ? rows.length - 1 : i - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={showing}
          aria-controls="subject-suggestions"
          aria-autocomplete="list"
          placeholder="Type a category of your own"
          aria-label="Add a category of your own"
          /* Borderless: the surrounding form is the field now, and an input
             with its own edge inside another edge is the "box in a box" that
             made the old layout read as two controls. */
          className="min-w-[10rem] flex-1 border-0 bg-transparent px-2 py-1.5 text-sm
                     text-fg outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={value.trim() === ""}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold
                     text-fg disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {showing && (
        <ul
          id="subject-suggestions"
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border
                     border-line bg-panel shadow-lg"
        >
          {rows.map((subject, i) => (
            <li key={subject.name} role="option" aria-selected={i === active}>
              <button
                type="button"
                // onMouseDown, not onClick: the input's blur fires first and
                // would close the list before a click could land on it.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(subject.name);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2
                            text-left text-sm ${
                              i === active ? "bg-raised text-fg" : "text-fg"
                            }`}
              >
                <span className="min-w-0 truncate">{subject.name}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {subject.works.toLocaleString()} works
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
