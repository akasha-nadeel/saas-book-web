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
 * One check, tickable.
 *
 * **The tick has to be a tick.** `export-page.tsx` records the verdict on
 * getting this wrong — a card whose only state was a tinted border, so nothing
 * on screen said on or off. The border and the ground here are the *second*
 * signal; the box is the first, and it is a real `<input type="checkbox">`
 * under an `sr-only`, so the keyboard and the screen reader get the control the
 * platform already knows how to describe.
 *
 * The drawn box is filled from `style` rather than from `peer-checked:`,
 * because the fill is the check's own hue and Tailwind cannot generate a class
 * for a colour it only learns at runtime.
 */
function CheckCard({
  on,
  name,
  hint,
  hue,
  onChange,
}: {
  on: boolean;
  name: string;
  hint: string;
  hue: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
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
      <input
        type="checkbox"
        checked={on}
        onChange={onChange}
        className="peer sr-only"
      />

      <span
        aria-hidden="true"
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60"
        style={
          on
            ? { backgroundColor: hue, borderColor: hue }
            : { borderColor: "var(--color-muted)" }
        }
      >
        {on && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-panel)"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>

      <span className="min-w-0">
        <span className="block text-[13px] leading-snug font-semibold text-fg">
          {name}
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
          {hint}
        </span>
      </span>
    </label>
  );
}
