"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addIdea,
  editIdea,
  IDEA_MAX,
  ideaColour,
  matchIdeas,
  removeIdea,
  titleFromIdea,
  type Idea,
} from "@/lib/ideas";
import {
  booksAgainstPlan,
  createBook,
  saveIdeasRaw,
} from "@/lib/library-store";
import { LAUNCH_LIMITS, onFreePlan } from "@/lib/launch";
import { relativeTime } from "@/lib/relative-time";
import { EmptyState } from "@/components/ui/empty-state";
import { RailMark, type MarkName } from "@/components/editor/rail-mark";
import { Tooltip } from "@/components/ui/tooltip";
import {
  LeftPill,
  LimitDialog,
  LimitNote,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { UpgradeDialog } from "@/components/upgrade/upgrade-dialog";
import { useIdeas, useShelf } from "@/lib/use-library";
import { usePlan } from "@/lib/use-plan";

/**
 * From how many parked ideas the search field is worth drawing.
 *
 * Free parks five at a time, so below this a writer can see the whole board at
 * once and a search box is a control over nothing — the kind of dead chrome
 * copied from a reference that the house rules are specifically against. Six
 * is one past that ceiling: the first board that cannot be taken in at a
 * glance is the first one worth searching.
 */
const SEARCH_FROM = 6;

/**
 * The idea parking lot, drawn as a board.
 *
 * **Being here is the feature.** Writers describe the shiny new idea arriving
 * mid-draft and stalling book two, and describe writing ideas down on their
 * phone because there is nowhere else. Both are the same problem: the idea
 * nags until it is captured, and if capturing it means leaving the book, then
 * leaving *is* the interruption. One box, one key, still in the chapter.
 *
 * Parked, not started. An idea here is not a book — it has no shelf entry and
 * costs nothing to keep. Turning every stray thought into a book is how a shelf
 * fills with eleven abandoned first chapters, which is its own pain further
 * down the research. The "Start a book" button exists for the one that turns
 * out to be real, and it is the writer who decides which.
 *
 * ---
 *
 * **Cards on a board, and that is a deliberate departure from the panel design
 * language.** `ui/list.tsx` is what every other panel here is built from, and
 * the argument for it is that one container per *group of related rows* beats
 * one box per row. That argument holds wherever the rows belong together.
 * These do not. Each parked idea is a separate object with nothing to do with
 * the one beside it — being separate from the book and from each other is the
 * entire premise — and a reader scans a parking lot looking for *one* of them.
 * A stack of identical grey rows gives the eye nothing to aim at; six grounds
 * do. This is the one place in the app where a card per item is the honest
 * drawing rather than sprawl, and it should not be tidied back into a
 * `ListGroup`.
 *
 * **One component, sized by its container.** It is mounted twice at very
 * different widths — the dashboard's Ideas area, full width, and the editor
 * rail's Ideas tab at `--sidebar-width`. `@container` rather than `sm:`/`lg:`,
 * the same choice `blurb-page.tsx` and `categories-page.tsx` make and for the
 * same reason: the component is sized by the slot it is standing in, and it
 * must not have to know which of its two mounts it is looking out of. A
 * window breakpoint would answer for the window and get the rail wrong at
 * every width.
 */
export function IdeasPanel({ bookId }: { bookId?: string }) {
  const ideas = useIdeas();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const router = useRouter();

  /*
   * **Starting a book from an idea is a new book, and the free plan counts
   * books.** This called `createBook` straight away, which walked past the
   * limit `new-book-form.tsx` keeps: the book appeared here and Postgres then
   * refused to take it. Same test as that form, through `onFreePlan`, and the
   * same dialog, opened on the press.
   */
  const shelf = useShelf();
  const plan = usePlan();
  const [full, setFull] = useState(false);
  const shelfFull =
    onFreePlan(plan) && booksAgainstPlan(shelf).length >= LAUNCH_LIMITS.freeBooks;

  /*
   * **Free parks five at a time; Pro has no ceiling** (2026-09-16). Occupancy,
   * like advance readers: handed the list's length, so forgetting an idea or
   * starting a book from one makes room, and nothing already parked is hidden.
   */
  const gate = useLimitGate({ action: "ideas", items: ideas.length });

  /* The board searches over everything parked, never over what is on screen,
     so the count in the header and the limit above stay about the lot rather
     than about the filter. */
  const searchable = ideas.length >= SEARCH_FROM;
  const shown = searchable ? matchIdeas(ideas, query) : ideas;

  function commit(next: Idea[]) {
    saveIdeasRaw(JSON.stringify(next));
  }

  function capture() {
    const clean = text.trim();
    if (!clean) return;
    // Refused before anything is written, and the words stay in the box — a
    // writer told there is no room has not lost the idea they just typed.
    if (!gate.spend()) return;
    commit(
      addIdea(ideas, clean, {
        id: crypto.randomUUID(),
        at: Date.now(),
        ...(bookId ? { from: bookId } : {}),
      }),
    );
    setText("");
  }

  /*
   * **`flex-1`, never `h-full`.** The editor rail already hands its tab
   * content a box with a real height (`flex h-full min-h-0 flex-1 flex-col
   * overflow-hidden` in `left-panel.tsx`), so filling it is a job for
   * `flex-1` — and `flex-1` is inert outside a flex container, which is what
   * makes the same component safe on the dashboard, where it grows to its
   * content and the page does the scrolling.
   *
   * `h-full` was the bug. On the dashboard it made the board demand the
   * area's whole height, and the `SectionBanner` above it was squeezed to a
   * strip — `min-h-52` on the banner could not save it, because the board
   * below was claiming the space before the banner was measured.
   * `TitleCheckArea` undoes the same thing from the outside with
   * `EMBEDDED_TOOL`, because a tool screen's shell is not ours to change.
   * This panel is ours, so it is fixed here rather than papered over by a
   * wrapper.
   */
  return (
    <div className="@container flex min-h-0 flex-1 flex-col">
      {full && <UpgradeDialog reason="books" onClose={() => setFull(false)} />}
      {gate.dialogOpen && (
        <LimitDialog action="ideas" onClose={gate.closeDialog} />
      )}

      {/* The search sits above the board rather than on it, because it acts on
          the whole lot and not on any one card. Drawn only once there is a
          board too big to take in — see `SEARCH_FROM`. */}
      {searchable && (
        <div className="px-3 pt-3">
          <label className="relative block">
            <span className="sr-only">Search parked ideas</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4
                         -translate-y-1/2 text-muted"
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="m13.5 13.5 3 3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-[10px] bg-raised py-2 pr-3 pl-9 font-sans
                         text-[13px] text-fg outline-none placeholder:text-muted
                         focus:ring-2 focus:ring-accent/50"
            />
          </label>
        </div>
      )}

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
        {/* One grid, and the capture box is its first tile — a pad with a
            blank note waiting, which is what the board is. In the rail the
            grid is one column, so it is exactly the full-width box it has
            always been; nothing is lost by it being a tile there. */}
        <ul className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
          <li>
            <form
              className="flex h-full min-h-[11rem] flex-col rounded-2xl border
                         border-dashed border-line bg-panel p-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                capture();
              }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  // Enter commits, Shift+Enter makes a new line. Ten seconds
                  // means not reaching for the mouse.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    capture();
                  }
                }}
                maxLength={IDEA_MAX}
                placeholder="The idea that is not this book…"
                aria-label="Park an idea"
                /* Unfilled and borderless inside the tile: the tile is the
                   box. A filled field inside a dashed card is two boxes for
                   one control. */
                className="scroll-slim min-h-0 w-full flex-1 resize-none bg-transparent
                           font-sans text-[13px] leading-relaxed text-fg outline-none
                           placeholder:text-muted"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-sans text-[11px] text-muted">
                  Enter to park it
                </span>
                <span className="flex items-center gap-2">
                  <LeftPill allowance={gate.allowance} />
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="rounded-[10px] bg-accent px-3 py-1.5 font-sans text-[13px]
                               font-semibold text-accent-ink transition-opacity
                               hover:opacity-90 disabled:opacity-40"
                  >
                    Park it
                  </button>
                </span>
              </div>
            </form>
          </li>

          {shown.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onStart={() => {
                if (shelfFull) {
                  setFull(true);
                  return;
                }
                const { bookId: made } = createBook(titleFromIdea(idea.text));
                commit(removeIdea(ideas, idea.id));
                router.push(`/book/${made}`);
              }}
              onEdit={(text) => commit(editIdea(ideas, idea.id, text))}
              onForget={() => commit(removeIdea(ideas, idea.id))}
            />
          ))}
        </ul>

        {/* The stacked note rather than the wide banner: this panel is also
            the editor rail's, about three hundred pixels across. It stands
            while the lot is full, as every occupancy limit's notice does. */}
        <LimitNote allowance={gate.allowance} className="mt-3" />

        {ideas.length === 0 && (
          <EmptyState
            glyph={
              <>
                <path d="M9 18h6M10 21h4" />
                <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
              </>
            }
            title="Nothing parked"
          >
            When the next book barges in halfway through this one, put it here
            and carry on.
          </EmptyState>
        )}

        {/* A search that finds nothing says so and names what was looked for.
            A board that has simply gone blank reads as a bug. */}
        {ideas.length > 0 && shown.length === 0 && (
          <EmptyState title={`Nothing parked matches “${query.trim()}”`}>
            {ideas.length} parked in all.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

/**
 * One small square action on a card: the mark, an accessible name, a tooltip.
 *
 * The shape is `section-import.tsx`'s, which is the app's established one for
 * a button with no words: `group relative` so `RailMark` can scale on hover and
 * `Tooltip` can measure the trigger, a full-sentence `aria-label` because the
 * icon says nothing to a screen reader, and **no `title`** — the browser's own
 * tooltip beside the app's card is two tooltips.
 *
 * The tooltip fires on focus as well as on hover, which is the whole reason
 * these can lose their labels at all: an icon-only control that explains itself
 * only to a mouse is a control a keyboard cannot learn.
 */
function CardAction({
  mark,
  label,
  name,
  onClick,
  style,
}: {
  mark: MarkName;
  /** The short label on the tooltip card. */
  label: string;
  /** The whole action, for a screen reader. */
  name: string;
  onClick: () => void;
  style: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      style={style}
      className="group relative flex h-7 w-7 cursor-pointer items-center
                 justify-center rounded-[7px] outline-none transition-colors
                 hover:bg-black/5 hover:text-fg focus-visible:ring-2
                 focus-visible:ring-accent/60 dark:hover:bg-white/10"
    >
      <RailMark mark={mark} size={16} />
      <Tooltip label={label} side="top" nowrap />
    </button>
  );
}

/**
 * One parked idea, on the ground its id gives it.
 *
 * The ground is a wash of one of six hues into `--color-panel`, so it follows
 * all eight palettes without a second palette existing — the reasoning is
 * beside `--idea-1` in `globals.css`. The ink stays `--color-fg`, and
 * `idea-colours.test.ts` holds every hue × palette pair to `AA_TEXT`; that is
 * what lets the ink stay a token here rather than being stated literally the
 * way type over a photograph has to be.
 *
 * **All three actions are always drawn.** They are quiet at rest and come
 * forward on hover and focus, but they are never *absent* until hover:
 * `row-menu.tsx` has the rule and its reasons — a hover-only control is
 * unreachable from a keyboard, missing altogether on a touch screen, and puts
 * a destructive action one stray mouse movement away.
 *
 * **Pencil, book, bin — least destructive to most.** The bin sits furthest
 * from where the eye lands coming off the text, so the two safe presses are
 * not a slip away from it.
 *
 * The card is either reading or editing and never both. **Editing is in place
 * rather than in a dialog**: a sticky note is written on where it lies, and a
 * modal over the whole board to change four words is a heavier gesture than a
 * parking lot deserves.
 */
function IdeaCard({
  idea,
  onStart,
  onEdit,
  onForget,
}: {
  idea: Idea;
  onStart: () => void;
  onEdit: (text: string) => void;
  onForget: () => void;
}) {
  const hue = `var(--idea-${ideaColour(idea.id)})`;
  /* `null` is reading and a string is editing — one piece of state rather than
     a flag and a draft that can disagree with each other. */
  const [draft, setDraft] = useState<string | null>(null);

  /*
   * The caret, put at the end once when editing begins.
   *
   * **On mount rather than on focus**, which is the difference between a
   * convenience and a bug: `onFocus` fires every time the box is focused, so
   * clicking into the middle of a sentence to fix one word raced the browser
   * setting the caret where the click landed. An effect keyed on entering the
   * edit state runs once, when the box appears.
   *
   * The end rather than a select-all, because the press that got here was
   * "change this", not "replace this" — with the text selected, one keystroke
   * wipes what the writer meant to amend.
   */
  const box = useRef<HTMLTextAreaElement>(null);
  const editing = draft !== null;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  /* The ground is published as `--oc-card` so the small print can be mixed
     against it rather than a nested `color-mix` being written out twice. */
  const ground = {
    "--oc-card": `color-mix(in srgb, ${hue} var(--idea-wash), var(--color-panel))`,
    background: "var(--oc-card)",
    borderColor: `color-mix(in srgb, ${hue} var(--idea-edge-wash), var(--color-panel))`,
  } as React.CSSProperties;

  /* Not `text-muted`: the six tints already ship that below AA on a plain
     panel, and a hue washed on top takes it to 3.76 on the dark ones. See
     `--idea-meta-dim` in globals.css — this is the card's own ink, dimmed
     towards the card's own ground, and `idea-colours.test.ts` holds it to
     4.5:1 across all forty-eight combinations. An icon is as much a thing to
     see as the words it replaced, so the actions wear it too. */
  const small = {
    color:
      "color-mix(in srgb, var(--oc-card) var(--idea-meta-dim), var(--color-fg))",
  };

  function save() {
    if (draft === null) return;
    // `editIdea` leaves a blank edit alone, so this cannot empty a card by
    // accident — the bin is how an idea goes.
    onEdit(draft);
    setDraft(null);
  }

  return (
    <li
      className="flex min-h-[11rem] flex-col rounded-2xl border p-3.5
                 transition-shadow hover:shadow-md"
      style={ground}
    >
      {draft === null ? (
        <>
          {/* Clamped rather than scrolled. A parked idea is capped at
              `IDEA_MAX` and the card is a glance — the pencil is one press
              away for the whole of it. */}
          <p className="line-clamp-6 font-sans text-[13px] leading-relaxed text-fg">
            {idea.text}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
            <span className="font-sans text-[11px]" style={small}>
              {relativeTime(idea.at)}
            </span>
            <span className="ml-auto flex items-center gap-0.5">
              <CardAction
                mark="edit"
                label="Edit"
                name="Edit this idea"
                onClick={() => setDraft(idea.text)}
                style={small}
              />
              <CardAction
                mark="book"
                label="Start a book"
                name="Start a book from this idea"
                onClick={onStart}
                style={small}
              />
              <CardAction
                mark="trash"
                label="Forget it"
                name="Forget this idea"
                onClick={onForget}
                style={small}
              />
            </span>
          </div>
        </>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // The capture box's keys, so the board has one idiom: Enter
              // commits, Shift+Enter makes a line, Escape puts it back.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDraft(null);
              }
            }}
            maxLength={IDEA_MAX}
            aria-label="Edit this idea"
            ref={box}
            className="scroll-slim min-h-0 w-full flex-1 resize-none bg-transparent
                       font-sans text-[13px] leading-relaxed text-fg outline-none"
          />
          {/* The capture tile's own footer, so the two read as one control in
              two places. */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-sans text-[11px]" style={small}>
              Esc to cancel
            </span>
            <button
              type="button"
              onClick={save}
              className="rounded-[10px] bg-accent px-3 py-1.5 font-sans text-[13px]
                         font-semibold text-accent-ink transition-opacity
                         hover:opacity-90"
            >
              Save
            </button>
          </div>
        </>
      )}
    </li>
  );
}
