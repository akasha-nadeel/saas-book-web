"use client";

/**
 * Which checks to run.
 *
 * The screen ran all of them or nothing for its whole life, and that was the
 * wrong only option: a writer working through the names does not want the
 * hyphens back on every pass, and a book that trips one check loudly buries
 * the rest under it.
 *
 * **Nothing starts ticked.** It was all of them, so that the first press did
 * what the screen did before it had a picker — and that stopped being right at
 * ten checks, where a writer who wants the names has to untick nine cards to
 * get a short answer. An empty picker asks the question the screen exists to
 * ask, and `Run` says `Pick a check` until there is one.
 *
 * **The choice is session state and is never stored.** A stored selection means
 * a writer picks three checks in March and quietly gets three in June, with the
 * other half of their book unread and nothing on screen saying so.
 *
 * **Grouped, since there are ten.** Six was a grid; ten in one flat grid is
 * four rows on the full page and a long scroll in the panel before the writer
 * reaches Run. Three short headings are the same ten cards with somewhere to
 * look, and each heading can be ticked as a set — a writer chasing punctuation
 * wants all three of those and none of the others.
 *
 * Shared by the full screen and the rail's panel; the columns come from
 * `@container` rather than from a prop, so the panel gets one and the page gets
 * three with nothing passed.
 */

import { ALL_CHECKS, type CheckId } from "@/lib/consistency";
import {
  CHECK_GROUPS,
  checksIn,
  type CheckGroup,
} from "@/lib/consistency-checks";
import { plural } from "@/lib/plural";
import { Tooltip } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { EDITOR_LAYOUT_EVENT } from "@/lib/use-visual-viewport";

/**
 * Whether this is a screen with no pointer to hover with.
 *
 * The same classifier every other piece of editor chrome reads, through the
 * same event — so the picker and the panel around it can never disagree about
 * which mode they are in. Read here and passed down rather than in each of
 * eleven cards, which would be eleven listeners for one fact.
 */
function useNoHover(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTouch(root.dataset.editorLayout === "continuous");
    read();
    root.addEventListener(EDITOR_LAYOUT_EVENT, read);
    return () => root.removeEventListener(EDITOR_LAYOUT_EVENT, read);
  }, []);
  return touch;
}

export function CheckPicker({
  picked,
  onToggle,
  onAll,
  onNone,
  onGroup,
  onRun,
  running,
  toRead,
  onBack,
}: {
  picked: ReadonlySet<CheckId>;
  onToggle: (id: CheckId) => void;
  onAll: () => void;
  onNone: () => void;
  /** Tick or untick a whole heading at once. */
  onGroup: (group: CheckGroup, on: boolean) => void;
  onRun: () => void;
  running: boolean;
  /** Chapters this book has to read, so the button can say what it is about to do. */
  toRead: number;
  /** Present only when there is a report to go back to. */
  onBack?: () => void;
}) {
  const count = picked.size;
  const noHover = useNoHover();

  return (
    <div className="@container">
      {onBack && (
        /* **Back has to lead somewhere.** Leaving the results by pressing Back
           and then finding no way in again is a trap door, not a way out. */
        <button
          type="button"
          onClick={onBack}
          className="mb-3 text-[13px] font-semibold text-accent hover:underline"
        >
          ← Back to the findings you have
        </button>
      )}

      <div className="flex flex-col gap-5">
        {CHECK_GROUPS.map((group) => {
          const inside = checksIn(group.id);
          const on = inside.filter((check) => picked.has(check.id)).length;
          return (
            <section key={group.id}>
              <div className="mb-1.5 flex items-center gap-2 px-1">
                <h3 className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-muted uppercase">
                  {group.name}
                </h3>
                {/* One control, not two. It says what pressing it does, so a
                    half-ticked group reads as "there is more to turn on". */}
                <button
                  type="button"
                  onClick={() => onGroup(group.id, on < inside.length)}
                  className="shrink-0 text-[11px] font-semibold text-muted hover:text-fg"
                >
                  {on < inside.length ? "All" : "None"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2.5 @sm:grid-cols-2 @3xl:grid-cols-3">
                {inside.map((check) => (
                  <CheckCard
                    key={check.id}
                    on={picked.has(check.id)}
                    name={check.name}
                    hint={check.hint}
                    hue={check.hue}
                    onChange={() => onToggle(check.id)}
                    showHint={noHover}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3 text-[11px] font-semibold text-muted">
          <button type="button" onClick={onAll} className="hover:text-fg">
            All {ALL_CHECKS.length}
          </button>
          <span aria-hidden="true" className="text-line">
            ·
          </span>
          <button type="button" onClick={onNone} className="hover:text-fg">
            None
          </button>
        </div>

        <button
          type="button"
          onClick={onRun}
          disabled={running || count === 0}
          className="ml-auto rounded-[10px] bg-accent px-5 py-2.5 text-[13px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {running
            ? `Reading ${plural(toRead, "chapter")}…`
            : count === 0
              ? "Pick a check"
              : `Run ${plural(count, "check")}`}
        </button>
      </div>
    </div>
  );
}

/**
 * One check, on or off.
 *
 * **The state has to be loud, and it is the tile that carries it.**
 * `export-page.tsx` records the verdict on getting this wrong — a card whose
 * only state was a tinted border, so nothing on screen said on or off. That
 * lesson is why this had a drawn tickbox for most of its life.
 *
 * The box is gone and the lesson is not. What replaced it is a 36px tile that
 * goes from a wash of the check's hue to the hue itself, which is a great deal
 * louder than a 16px square and very much louder than a border. Everything
 * else about the card follows it: the ground and the edge move in the same
 * direction at the same moment, so there are three signals agreeing rather
 * than one being relied on.
 *
 * **A button with `role="checkbox"`, not a label around a hidden input.** The
 * keyboard and the screen reader get the same control either way — `aria-checked`
 * is what a tickbox announces — and this way the card itself takes focus, which
 * is what lets the example below reach a keyboard at all. A `<label>` cannot.
 *
 * **Every colour here is the check's own hue at a different strength**, mixed
 * into a theme token rather than painted flat, which is the rule
 * `finding-card.tsx` sets out: one value is a pale card by day and a deep one
 * at night with no second table.
 */
function CheckCard({
  on,
  name,
  hint,
  hue,
  onChange,
  showHint,
}: {
  on: boolean;
  name: string;
  hint: string;
  hue: string;
  onChange: () => void;
  /**
   * Draw the example under the name instead of leaving it to the tooltip.
   *
   * True where there is no pointer to hover with. The tooltip is the better
   * shape — eleven cards with two lines each is a long scroll before a writer
   * reaches Run — but a phone would simply never see the example, and four of
   * the eleven names do not explain themselves.
   */
  showHint: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onChange}
      /* The platform's own fallback, for anything that shows neither the
         tooltip nor the line. */
      title={hint}
      className={`group relative flex w-full cursor-pointer items-center gap-3
                  rounded-[10px] border p-2.5 text-left outline-none
                  transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    on ? "" : "border-line bg-panel hover:border-fg/30"
                  }`}
      style={
        on
          ? {
              backgroundColor: `color-mix(in srgb, ${hue} 10%, var(--color-panel))`,
              /* A translucent hue rather than a mix into `--color-line`, which
                 the editor's panel re-points to a wash of `fg` — see the note
                 on `tint` in `finding-card.tsx`. `--color-panel` is safe. */
              borderColor: `color-mix(in srgb, ${hue} 55%, transparent)`,
            }
          : undefined
      }
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors"
        style={
          on
            ? { backgroundColor: hue, color: "var(--color-panel)" }
            : {
                backgroundColor: `color-mix(in srgb, ${hue} 14%, transparent)`,
                color: hue,
              }
        }
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
        >
          {/* A magnifier over a line of text: what every one of these does is
              read the book looking for one thing. One mark for all eleven and
              not eleven metaphors — the hue is what tells them apart, and it is
              the same hue their findings carry. */}
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="m15 15 4.5 4.5" />
          <path d="M8 9.5h5M8 12h3" />
        </svg>
      </span>

      <span className="min-w-0">
        <span className="block text-[13px] leading-snug font-semibold text-fg">
          {name}
        </span>
        {showHint && (
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
            {hint}
          </span>
        )}
      </span>

      {!showHint && <Tooltip label={hint} side="top" />}
    </button>
  );
}
