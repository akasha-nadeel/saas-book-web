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
 *
 * **On Free, six cards are locked** (2026-09-15). They stay in their groups
 * with their names and examples, carrying a small plan label, so a writer can
 * see what the check would look for; pressing one calls `onLocked` and the
 * caller opens the upgrade dialog on that press. "All" and each group's "All"
 * tick only what can be ticked.
 */

import { ALL_CHECKS, type CheckId } from "@/lib/consistency";
import { ProBadge } from "@/components/upgrade/pro-badge";
import {
  CHECK_GROUPS,
  CHECK_LOOK,
  checksIn,
  type CheckGroup,
} from "@/lib/consistency-checks";
import { CheckMark } from "@/components/consistency/check-marks";
import { plural } from "@/lib/plural";
import { Tooltip } from "@/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";
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

/**
 * Below this, the picker is a column beside something rather than a screen.
 *
 * The editor's panel runs about 240–400px; the full page's picker sits in a
 * `7xl` measure. Nothing lands between the two.
 */
const TIP_FLIP_WIDTH = 420;

/**
 * Whether the picker is a narrow column, so a tooltip has to open sideways.
 *
 * **A tooltip above a card lands on the card above it.** In the panel that is
 * eleven cards in one column, so the label for the check being hovered covers
 * the neighbour it is being compared against — the one thing a writer is doing
 * at that moment. Opening to the right puts it clear of the panel entirely,
 * over the manuscript, where it covers nothing being read.
 *
 * **It measures the space, not the device**, which is the doctrine
 * `lib/editor/editor-layout.ts` runs on and the reason this is not the `dense`
 * flag the panel forbids: the same picker in a wide window keeps its labels
 * above, because there it has the room.
 *
 * A phone never reaches this. `useNoHover()` is already true in continuous
 * layout, where the example is printed on the card and no tooltip is drawn.
 */
function useNarrow() {
  const box = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < TIP_FLIP_WIDTH);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  return [box, narrow] as const;
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
  locked = NO_LOCKS,
  onLocked,
}: {
  /** Checks this writer's plan does not include. Empty on Pro. */
  locked?: ReadonlySet<CheckId>;
  /** A locked card was pressed. */
  onLocked?: (id: CheckId) => void;
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
  // A check picked before the plan was known is not counted once it is locked;
  // the caller leaves it out of the run for the same reason.
  const count = [...picked].filter((id) => !locked.has(id)).length;
  const available = ALL_CHECKS.length - locked.size;
  const noHover = useNoHover();
  const [box, narrow] = useNarrow();

  return (
    <div ref={box} className="@container">
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
          const all = checksIn(group.id);
          const inside = all.filter((check) => !locked.has(check.id));
          const on = inside.filter((check) => picked.has(check.id)).length;
          return (
            <section key={group.id}>
              <div className="mb-1.5 flex items-center gap-2 px-1">
                <h3 className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-muted uppercase">
                  {group.name}
                </h3>
                {/* One control, not two. It says what pressing it does, so a
                    half-ticked group reads as "there is more to turn on". */}
                {inside.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onGroup(group.id, on < inside.length)}
                    className="shrink-0 text-[11px] font-semibold text-muted hover:text-fg"
                  >
                    {on < inside.length ? "All" : "None"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2.5 @sm:grid-cols-2 @3xl:grid-cols-3">
                {all.map((check) => {
                  const isLocked = locked.has(check.id);
                  return (
                    <CheckCard
                      key={check.id}
                      on={!isLocked && picked.has(check.id)}
                      locked={isLocked}
                      id={check.id}
                      name={check.name}
                      hint={check.hint}
                      onChange={() =>
                        isLocked ? onLocked?.(check.id) : onToggle(check.id)
                      }
                      showHint={noHover}
                      tipSide={narrow ? "right" : "top"}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3 text-[11px] font-semibold text-muted">
          <button type="button" onClick={onAll} className="hover:text-fg">
            All {available}
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
 * **Colour means picked, and an unpicked card has none.** Every card carried a
 * wash of its own hue whether it was on or not, so eleven of them were eleven
 * colours in a column and the ones actually chosen had to be found among them.
 * Off is neutral throughout — a surface a step lighter than the panel, a tile a
 * step above that, muted ink — and the hue arrives all at once on the press:
 * the tile fills with it and the card and its edge take a wash of the same
 * value.
 *
 * What colour there is, is the check's own hue **mixed into a theme token
 * rather than painted flat**, which is the rule `finding-card.tsx` sets out:
 * one value is a pale card by day and a deep one at night with no second
 * table.
 */
function CheckCard({
  on,
  locked,
  id,
  name,
  hint,
  onChange,
  showHint,
  tipSide,
}: {
  on: boolean;
  /** Not on this writer's plan: drawn unpicked, with the plan's name on it. */
  locked: boolean;
  /** The check itself, for its mark. The hue is read from it rather than passed
      beside it — two ways in is two things to keep in step. */
  id: CheckId;
  name: string;
  hint: string;
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
  /**
   * Which way the tooltip opens — decided by the picker, which is the only
   * party that knows how much room it has. See `useNarrow`.
   */
  tipSide: "top" | "right";
}) {
  const hue = CHECK_LOOK[id].hue;

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
                    on ? "" : "border-line bg-raised hover:border-fg/30"
                  }`}
      style={
        on
          ? {
              backgroundColor: `color-mix(in srgb, ${hue} 12%, var(--color-raised))`,
              /* A translucent hue rather than a mix into `--color-line`, which
                 the editor's panel re-points to a wash of `fg` — see the note
                 on `tint` in `finding-card.tsx`. A surface token is safe. */
              borderColor: `color-mix(in srgb, ${hue} 55%, transparent)`,
            }
          : undefined
      }
    >
      {/* **A mark of its own, where there used to be one magnifier for all
          eleven.** The old note argued that what every check does is the same —
          read the book looking for one thing — so one glyph was honest and the
          hue could carry which. It asked a writer to learn a legend of eleven
          colours, and the same tile now has to lead a row in a result they are
          scanning rather than sit beside a name they are reading. `CheckMark`
          holds the artwork and the argument.

          **Colour no longer means picked, and that is the trade.** It used to:
          a flat hue when on, neutral when off. But a picker of eleven grey
          tiles until you tick them teaches nothing, which is the whole reason
          the marks exist. The card's own ground and border still say picked —
          see the `style` above — so the mark says *which check* and the card
          says *whether it is on*, which is what a hue already means everywhere
          else in this feature. */}
      <CheckMark id={id} />

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug font-semibold text-fg">
          {name}
        </span>
        {showHint && (
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
            {hint}
          </span>
        )}
      </span>

      {/* The shared badge rather than a pill written here: the rail's Paperback
          row wears the same one, so "purple means Pro" is one statement in one
          file. It was a grey outlined capsule, which read as another piece of
          the card's own chrome. */}
      {locked && <ProBadge />}

      {!showHint && <Tooltip label={hint} side={tipSide} />}
    </button>
  );
}

const NO_LOCKS: ReadonlySet<CheckId> = new Set();
