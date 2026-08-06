"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";
import { BookCover } from "@/components/shelf/book-cover";
import { StepPanelTool, panelToolFor } from "@/components/roadmap/step-panel";
import { bookWordCount, findBook, setRoadmapStep } from "@/lib/library-store";
import {
  PHASES,
  progressOf,
  roadmapFor,
  type Phase,
  type StepState,
} from "@/lib/roadmap";
import { confirmLeave } from "@/lib/unsaved";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";

/**
 * Blank page to published, in the order it has to happen.
 *
 * The most-confirmed thing in the research and the cheapest to build. Three
 * separate threads describe writers who did not lack a tool but an *order* —
 * most sharply the one who realised advance copies were essential only after
 * publishing, and then spent months chasing reviews for a book already out.
 *
 * **A third of them work themselves out** from what is in the book; the rest
 * happen somewhere else and are the writer's to tick. This page used to say
 * "most of this ticks itself", which was the wrong way round and is exactly the
 * claim the house rules exist to catch. The real split is counted in
 * `SELF_TICKING` and printed, and only the self-ticking ones are marked — a step that fills itself in is the surprising
 * one, and labelling the other eleven was eleven repeats of something the
 * checkbox already says.
 *
 * **It is drawn as a line rather than a stack of cards**, because the whole
 * feature is that these are in an order. Eighteen equal boxes said nothing
 * about sequence and ran to two and a half screens; a rail with the phases as
 * stations says it in the shape.
 *
 * **One phase at a time, with all five always in view.** The rail still ran to
 * two and a half screens, and eighteen steps arriving at once is a wall — a
 * writer on step three reads twelve things that will not matter for months.
 * So the detail is one phase, and the *order* — the thing this page exists to
 * teach — stays on screen above it as five stations with their counts.
 *
 * Which half does which job is the whole of the design here. Collapsing the
 * phases to a strip and paging through them would have hidden the order, and
 * the order is the one claim in this product a competitor cannot answer by
 * shipping a feature. Showing every step at once told the truth and buried it.
 * The strip carries the sequence, the panel carries the work.
 *
 * **Nothing on this page can tick a step but the writer.** `Next` and `Skip`
 * move the view and change no state — the ordinary wizard reading of "Next"
 * (I have done this, mark it and move on) is exactly the lie `roadmapFor`
 * refuses, since a third of these steps are worked out from the book and would
 * un-tick themselves on the next render. The only control that writes is the
 * marker on a hand-tickable row, which is where it has always been.
 *
 * A step that is done loses its explanation. "Why this matters" is for somebody
 * deciding whether to do a thing, and it is dead weight above a line already
 * crossed — so the page gets shorter as the book gets further along, which is
 * the right direction for it to move in.
 */
export function RoadmapPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const cover = useCover(bookId);
  const book = findBook(shelf, bookId);

  const steps = useMemo(
    () => (book ? roadmapFor(book, book.roadmapDone ?? []) : []),
    [book],
  );
  const progress = useMemo(() => progressOf(steps), [steps]);

  /* `automatic` was counted here for the paragraph that explained which ticks
     work themselves out. That paragraph is gone with the rest of the header —
     the rows say "ticks itself" on the steps it applies to, which is the same
     fact where it can be acted on rather than three lines above. */

  /** Each phase with its steps and tally, in road order. Drawn twice — the
   *  strip reads the counts, the panel reads the steps of one of them. */
  const phases = useMemo(
    () =>
      PHASES.map((phase) => {
        const inPhase = steps.filter((s) => s.phase === phase.id);
        const done = inPhase.filter((s) => s.done).length;
        return {
          ...phase,
          steps: inPhase,
          done,
          complete: inPhase.length > 0 && done === inPhase.length,
        };
      }),
    [steps],
  );

  /** The phase holding the next unfinished step — "where you are" on the road. */
  const here = progress.next?.phase ?? null;

  /*
   * Which phase is open, from `?phase=` and written back to it.
   *
   * Same shape as the dashboard's `?area=`, and for the same two reasons: a
   * writer who opens a step's tool and comes back should land where they left
   * rather than at the top of the road, and a reload should not lose their
   * place. `useSearchParams` rather than reading `window.location` in a lazy
   * initialiser — during a client navigation that initialiser sees the
   * *previous* URL.
   *
   * It falls back to where the writer actually is rather than to Write. Opening
   * a book on step fifteen at the start of the road would make the first thing
   * this page does be wrong about them.
   */
  const params = useSearchParams();
  const asked = params.get("phase");
  const [picked, setPicked] = useState<Phase | null>(null);
  const open: Phase =
    picked ??
    (PHASES.some((p) => p.id === asked)
      ? (asked as Phase)
      : (here ?? PHASES[0].id));

  /*
   * Which step's tool is open beside the road, in `?open=`.
   *
   * This one *is* written back to the URL, where the phase is not, and the
   * difference is deliberate: a phase is a glance and a tool is work. Somebody
   * halfway through choosing categories who reloads, or who presses the
   * browser's back button expecting the panel to shut, is in the middle of
   * something — losing it there costs more than landing on the wrong phase.
   *
   * `replace` rather than `push` for the open, so opening tool after tool does
   * not build a stack the back button has to walk out of; `push` for the close
   * would be worse still. The phase rides along on every write so shutting a
   * panel cannot silently drop it.
   *
   * It holds a *step* id rather than a tool name because two different steps
   * open Comps — "Set a length to aim at" and "Find your comp titles" — and
   * the panel is titled with the step, not the tool. A writer who pressed
   * "Set a length to aim at" should see that at the top of the panel; being
   * told they are in "Comp titles" is the app answering a question they did
   * not ask.
   */
  const router = useRouter();
  const pathname = usePathname();
  /*
   * Guarded, because swapping the panel unmounts whatever is in it.
   *
   * Opening a *second* step's tool over the first is leaving the first, and it
   * is a `router.replace` rather than a link — no anchor to intercept, no
   * `popstate`, no unload. `confirmLeave` falls through when there is nothing
   * pending, so every ordinary press behaves exactly as it did.
   */
  const setPanel = (stepId: string | null) => {
    confirmLeave(() => {
      const next = new URLSearchParams();
      next.set("phase", open);
      if (stepId) next.set("open", stepId);
      router.replace(`${pathname}?${next}`, { scroll: false });
    });
  };

  const openStep = steps.find((s) => s.id === params.get("open")) ?? null;
  const openHref = openStep?.href?.(bookId);
  const openTool = openHref ? panelToolFor(openHref, bookId) : null;

  const index = PHASES.findIndex((p) => p.id === open);
  const current = phases[index] ?? phases[0];
  const previous = index > 0 ? phases[index - 1] : null;
  const following = index < phases.length - 1 ? phases[index + 1] : null;
  /*
   * Only worth offering when the writer has browsed away from their position —
   * *and* when it is not simply the next phase, which the primary button
   * already goes to. Ticking the last step of the phase you are looking at put
   * "Skip to Revise" and "Revise →" on the same row: two controls, one
   * destination, two different words for it. Skip earns its place as a jump
   * across several phases or backwards; as a synonym for Next it is noise on
   * the row that matters most.
   */
  const skipTo =
    here && here !== open && here !== following?.id
      ? (phases.find((p) => p.id === here) ?? null)
      : null;

  if (!hydrated) return <LoadingScreen />;

  if (!book) {
    return (
      <div className="grid h-dvh place-items-center bg-surface p-8 text-center">
        <div>
          <p className="text-lg font-bold text-fg">That book is not here.</p>
          <Link href="/" className="mt-3 inline-block text-accent">
            Back to your books
          </Link>
        </div>
      </div>
    );
  }

  const share = Math.round((progress.done / progress.total) * 100);

  const split = Boolean(openTool);

  return (
    /*
     * Two columns once a step is open, one otherwise.
     *
     * The road keeps its place on the left rather than being replaced: the
     * whole complaint this page answers is that nobody tells you the order, and
     * sending a writer to a full-window tool the moment they act on a step
     * takes the order away again at exactly the moment it is being used. Coming
     * back then meant the browser's back button and a scroll hunt for where
     * they were.
     *
     * `lg` is where the split starts. Below it there is no honest way to put a
     * list and a working tool side by side, so the panel takes the screen —
     * still a panel with a Close, so the road is one press away, which is the
     * part that matters.
     */
    <div className="flex h-dvh overflow-hidden bg-surface">
      {/* A proportion rather than a fixed column, and the larger of the two.

          The road is the subject of this screen — the tool is what a single
          step opens — so the split reads the wrong way round when the panel
          dominates. Percentages rather than rem so the ratio holds at every
          window size instead of the roadmap staying put while the tool takes
          everything a wider monitor gives.

          A *width* in both states, never `flex-1` in one and a width in the
          other: two different properties cannot transition into each other, so
          that pairing snapped the column to its new size while the panel eased
          in beside it — which looks more broken than no animation at all. With
          both ends expressed as widths the road narrows as the panel arrives,
          and the two read as one movement. */}
      <div
        className={`shrink-0 overflow-y-auto transition-[width] duration-300 ease-out
                    motion-reduce:transition-none ${
                      split
                        ? "hidden border-r border-line lg:block lg:w-[55%]"
                        : "w-full"
                    }`}
      >
        {/* ---- One strip, instead of three blocks -------------------------

            This screen opened with a full `ToolHeader` (cover, title, a line of
            explanation), then a progress card (a big "5 of 18", a bar, a
            percentage, the next step), then a paragraph about which ticks are
            automatic. Three stacked blocks, most of a screen, before the road
            itself began — on a page whose entire job is to show eighteen steps
            in order. On the panel's half-width column it was worse: the first
            actual step sat below the fold.

            All of it collapses into one line. The cover shrinks to an icon
            because it is an *identifier* here, not a subject — the writer knows
            which book they are in, and the breadcrumb says so anyway. The
            counts survive as text, which is all they ever were: "5 of 18" and
            "28%" are two numbers, and they had a card each. */}
        <header className="sticky top-0 z-10 border-b border-line bg-panel/95 px-6 py-2.5 backdrop-blur">
          <div className={`flex items-center gap-3 ${split ? "" : "mx-auto max-w-7xl"}`}>
            <Link
              href={`/book/${book.id}`}
              aria-label={`Open ${book.title}`}
              className="w-7 shrink-0 overflow-hidden rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.2)]
                         transition-transform hover:-translate-y-0.5"
            >
              <BookCover
                title={book.title}
                words={bookWordCount(book)}
                seed={book.id}
                image={cover}
                {...(book.subtitle ? { subtitle: book.subtitle } : {})}
                {...(book.author ? { author: book.author } : {})}
                {...(book.bareCover ? { bare: true } : {})}
              />
            </Link>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-fg">
                Blank page to published
              </p>
              <p className="truncate text-xs text-muted">
                {book.title} · {progress.done} of {progress.total} steps ·{" "}
                {share}% of the way
              </p>
            </div>

            <Link
              href="/?area=tools"
              className="shrink-0 text-xs font-semibold text-muted hover:text-fg"
            >
              ← All tools
            </Link>
          </div>
        </header>

        <div
          className={`px-6 pt-5 pb-16 ${split ? "" : "mx-auto max-w-7xl"}`}
        >
        {/* ---- The road, as a stepper -------------------------------------

            A rail of segments rather than five stacked bars. The bars were an
            improvement on five boxes that could not fit, but they still cost a
            line each — five rows of chrome above a list that is itself rows,
            which on the panel's column pushed the first step off the screen.

            The segment is the bar: a hairline that fills with the phase's own
            progress, with the station under it. That is the shape every
            multi-step flow uses, and it is *horizontal* here for the reason
            the boxes were: these are in an order, and a row says so where a
            stack says only "five things".

            It fits at this size where the boxes did not because a segment has
            no box to fit — the label may truncate and the line still reads.
            The mark carries the state for anyone who cannot see the fill: a
            tick for done, a filled ring for where you are, an empty one for
            what is ahead. */}
        <nav aria-label="Phases" className="flex gap-2">
          {phases.map((phase) => {
            const isOpen = phase.id === open;
            const share =
              phase.steps.length > 0
                ? Math.round((phase.done / phase.steps.length) * 100)
                : 0;
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => setPicked(phase.id)}
                aria-current={isOpen ? "step" : undefined}
                title={`${phase.label} — ${
                  phase.complete ? "done" : `${phase.done} of ${phase.steps.length}`
                }`}
                className="group min-w-0 flex-1 text-left"
              >
                <span className="block h-[3px] overflow-hidden rounded-full bg-raised">
                  <span
                    className={`block h-full rounded-full ${
                      phase.complete ? "bg-ok-fg" : "bg-accent"
                    }`}
                    style={{ width: `${share}%` }}
                  />
                </span>

                <span className="mt-2 flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full
                                text-[8px] font-bold ${
                                  phase.complete
                                    ? "bg-ok-fg text-panel"
                                    : isOpen
                                      ? "bg-accent text-accent-ink"
                                      : "border-2 border-line"
                                }`}
                  >
                    {phase.complete ? "✓" : isOpen ? "" : ""}
                  </span>
                  <span
                    className={`truncate text-[11px] font-semibold ${
                      isOpen
                        ? "text-fg"
                        : "text-muted group-hover:text-fg"
                    }`}
                  >
                    {phase.label}
                  </span>
                  {/* Where the road actually is, which is not always what is
                      open — a writer browsing ahead should still be able to
                      see their own position. */}
                  {phase.id === here && !isOpen && (
                    <span
                      aria-hidden="true"
                      className="h-1 w-1 shrink-0 rounded-full bg-accent"
                    />
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        {/* ---- One phase, in full ----------------------------------------- */}
        <section className="mt-6">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-bold text-fg">{current.label}</h2>
            <span
              className={`text-xs font-bold ${
                current.complete ? "text-ok-fg" : "text-muted"
              }`}
            >
              {current.complete
                ? "done"
                : `${current.done} of ${current.steps.length}`}
            </span>
            <span className="ml-auto text-xs text-muted">
              Phase {index + 1} of {phases.length}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted">{current.note}</p>

          <ul className="mt-4">
            {current.steps.map((step, i) => (
              <Row
                key={step.id}
                step={step}
                bookId={bookId}
                next={progress.next?.id === step.id}
                last={i === current.steps.length - 1}
                active={openStep?.id === step.id}
                onOpen={() => setPanel(step.id)}
                phase={open}
              />
            ))}
          </ul>
        </section>

        {/* ---- Moving between them ---------------------------------------

            Neither of these writes anything. `Next` is the road's own order —
            the reason to walk it forward is to *read* what is coming, which is
            the whole service this page performs. `Skip` jumps to the phase
            holding the actual next step, so a writer four phases along is one
            press from their own position rather than paging back through
            everything they have finished.

            Each is absent rather than disabled when it has nowhere to go: a
            greyed button is a control that has to be tried before it can be
            understood. Skip only appears once the writer has browsed away from
            where they are, since otherwise it would land them where they
            already stand. */}
        {/* Stacked in the narrow column, one row when the page is whole.

            Three controls carrying phase *names* — "← Revise", "Skip to
            Write", "Before you publish →" — cannot share a 24rem line, and
            wrapping left them ragged with the primary stranded on its own row
            anyway. Driven off `split` rather than a breakpoint because the
            column is narrow while the *viewport* is wide, which is exactly the
            case a media query cannot see. */}
        <div
          className={`mt-8 gap-3 border-t border-line pt-5 ${
            split
              ? "flex flex-col items-stretch"
              : "flex flex-wrap items-center"
          }`}
        >
          {previous ? (
            <button
              type="button"
              onClick={() => setPicked(previous.id)}
              className="truncate rounded-lg border border-line bg-panel px-4 py-2 text-sm
                         font-semibold text-fg hover:border-accent"
            >
              ← {previous.label}
            </button>
          ) : null}

          {skipTo && (
            <button
              type="button"
              onClick={() => setPicked(skipTo.id)}
              className="truncate text-sm font-semibold text-accent"
            >
              Skip to {skipTo.label}
            </button>
          )}

          {following ? (
            <button
              type="button"
              onClick={() => setPicked(following.id)}
              className={`truncate rounded-lg bg-accent px-4 py-2 text-sm font-semibold
                         text-accent-ink hover:bg-accent-strong ${
                           split ? "" : "ml-auto"
                         }`}
            >
              {following.label} →
            </button>
          ) : (
            <p className={`text-sm text-muted ${split ? "" : "ml-auto"}`}>
              That is the whole road.
            </p>
          )}
        </div>
        </div>
      </div>

      {/* ---- The step, opened beside the road ---------------------------

          Its own title bar rather than the tool's `ToolHeader`, and the title
          is the *step* — "Find your comp titles" — because that is the thing
          the writer pressed. The tool's own name for itself is an answer to a
          question nobody asked here.

          Keyed on the step so opening a second tool mounts a second component
          rather than handing the first one new props. Two of these steps open
          the same screen, and without the key a writer moving between them
          would keep the previous one's scroll position and half-typed state
          under a heading that had changed. */}
      {openTool && openStep && (
        <section
          aria-label={openStep.title}
          className="oc-panel-in flex min-w-0 flex-1 flex-col bg-surface"
        >
          {/* Close and nothing else.

              The step's name used to sit here, and a fixed strip carrying two
              lines of text costs that height at every scroll position, in the
              half of the window doing the work. The name has gone down into
              the page — see `heading` below — where it sits in the tool's own
              column and scrolls with what it names, which is the right
              relationship for a heading.

              The bar stays, thin, because Close cannot go with it: a control
              that scrolls out of reach is one a writer has to hunt for to get
              back to the road. */}
          <header className="flex shrink-0 items-center justify-end border-b border-line bg-panel px-5 py-2.5">
            {/* **Not `danger`, which is what this was.**

                Red is one of the four meanings this app's palette spends a hue
                on, and it means *a shop would refuse this* — it is the colour
                of the blocking findings and of Delete. Closing a panel throws
                nothing away — the road is still there, and where the tool
                does hold an unsaved draft `confirmLeave` asks before this
                runs, which is the guarantee rather than the styling. A red
                button says the opposite, and the cost of that is a writer who
                hesitates over the only way back to the road, or who reads it
                as "discard" and does not press it at all.

                A quiet outline instead — the same shape the panel's own
                secondary controls use. The one control on a bar of its own
                does not need a fill to be found. */}
            {/* Through `confirmLeave` because this is the one exit from a tool
                that is not a navigation: no anchor to intercept, no `popstate`,
                no unload. It falls straight through when nothing is pending,
                so the ordinary press is unchanged. */}
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="Close this step and go back to the road"
              className="rounded-lg border border-line px-3.5 py-1.5 text-sm
                         font-semibold text-fg outline-none transition-colors
                         hover:border-accent/60 hover:bg-raised
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Close ✕
            </button>
          </header>

          {/* Keyed on the step, so switching tools re-runs the entrance and
              the swap reads as a replacement rather than a repaint. */}
          <div key={openStep.id} className="oc-step-in min-h-0 flex-1">
            <StepPanelTool
              key={openStep.id}
              tool={openTool}
              bookId={bookId}
              heading={
                <div className="mb-6">
                  <p className="text-[11px] font-bold tracking-widest text-muted uppercase">
                    {current.label}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-fg">
                    {openStep.title}
                  </h2>
                </div>
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * One step on the rail.
 *
 * The marker is the control where there is one to have. A step the app works
 * out is a dot and never a checkbox: a checkbox a writer can click, which then
 * snaps back the moment the page re-reads the book, is a lie about who is in
 * charge of it.
 */
function Row({
  step,
  bookId,
  next,
  last,
  onOpen,
  active,
  phase,
}: {
  step: StepState;
  bookId: string;
  /** The open phase, so a step that navigates away can point the way back. */
  phase: string;
  /** The first unfinished step in the whole list. */
  next: boolean;
  /** Last in its phase, so the rail stops here. */
  last: boolean;
  /** Opens this step beside the road. Absent for steps that navigate away. */
  onOpen?: () => void;
  /** This step's tool is the one currently in the panel. */
  active?: boolean;
}) {
  const href = step.href?.(bookId);
  /* A tool that can sit in the panel gets a button; the editor and the reading
     view keep their link, because they really do take you off this page and a
     control that looks identical to the one beside it should not sometimes do
     that. */
  const panel = href ? panelToolFor(href, bookId) : null;

  /*
   * **The marker had no affordance, and thirteen of the nineteen steps need
   * one.** An unticked marker was a 24px circle drawn in `line` — the faintest
   * hairline in the palette, the same value as the decorative rail running
   * through it — holding a tick set to `text-transparent`. So the one control
   * on this page that writes anything was invisible, and pixel-identical to
   * the non-interactive `<span>` on a step that ticks itself. A writer looking
   * at "Finish the first draft · NEXT" had no way to see that the roadmap
   * could be marked at all, which for a checklist is close to the whole
   * feature. (The dashboard's next-step card grew an explicit "Already done"
   * button for exactly this reason and the road never got one.)
   *
   * So an unticked *hand-tickable* marker carries a faint tick and a `muted`
   * border: it reads as a box waiting to be checked, which is exactly what it
   * is. Hover and focus take it to the accent, the app's one colour for a way
   * forward.
   *
   * **An unticked automatic marker stays empty, and that is the load-bearing
   * half.** The first attempt at this gave it a filled grey circle with a faint
   * tick in it, to say "not yours to press" — and a filled circle with a tick
   * in it is what *done* looks like. "Write the blurb · ticks itself" appeared
   * finished on a book with no blurb at all, which is worse than the problem it
   * was solving: a marker with no affordance merely fails to invite, while one
   * that reads as ticked states something untrue about the book. The two kinds
   * are told apart by the tick — a box you can check shows a faint one, a box
   * that fills itself shows none — and the row says "ticks itself" beside it.
   */
  const marker = `z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full
                  text-[11px] font-bold ${
                    step.done
                      ? "bg-accent text-accent-ink"
                      : step.automatic
                        ? "border-2 border-line bg-panel text-transparent"
                        : "border-2 border-muted/60 bg-panel text-muted/45"
                  }`;

  return (
    <li className="relative flex gap-3 pb-2.5 last:pb-0">
      {/* The rail stops at the end of each phase rather than running on through
          the next heading, so the phases read as stations rather than as one
          undifferentiated queue of eighteen. */}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute top-8 bottom-0 left-3 w-px -translate-x-1/2 bg-line"
        />
      )}

      {step.automatic ? (
        <span aria-hidden="true" className={marker}>
          ✓
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setRoadmapStep(bookId, step.id, !step.done)}
          aria-pressed={step.done}
          aria-label={
            step.done
              ? `Mark "${step.title}" as not done`
              : `Mark "${step.title}" as done`
          }
          title={step.done ? "Mark as not done" : "Mark as done"}
          className={`${marker} cursor-pointer outline-none transition-colors
                      focus-visible:ring-2 focus-visible:ring-accent/60 ${
                        step.done
                          ? "hover:opacity-80"
                          : "hover:border-accent hover:text-accent"
                      }`}
        >
          ✓
        </button>
      )}

      <div
        className={`min-w-0 flex-1 rounded-xl border px-4 py-2.5 ${
          active
            ? "border-accent bg-accent/8 ring-1 ring-accent/25"
            : next
              ? "border-accent/50 bg-panel ring-1 ring-accent/20"
              : "border-line bg-panel"
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p
            className={`font-semibold ${step.done ? "text-muted" : "text-fg"}`}
          >
            {step.title}
          </p>
          {next && (
            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">
              Next
            </span>
          )}
          {step.automatic && (
            <span className="text-[11px] text-muted">ticks itself</span>
          )}

          {/* `aria-expanded`, not `aria-pressed`: the button reveals a region
              rather than toggling a setting, and the marker beside it is
              already a real pressed-state toggle — two controls in one row
              claiming the same semantics is how a screen reader ends up
              describing "Open" as a checkbox for the step. */}
          {/* **The step being asked for says how to answer it.**

              A circle you have to guess is clickable is not an instruction, and
              on the one row the page is actively pointing at — the NEXT badge,
              the ring, the explanation left in place — a writer needs to be
              told what to do rather than shown a bullet. So the next step, when
              it is one only the writer can confirm, carries the words.

              Only that row. Thirteen "Mark as done" buttons down a phase would
              turn a road into a form, and the marker beside every other row
              does the same job now that it can be seen. Same wording as the
              dashboard's next-step card, which reached this conclusion first.

              `aria-hidden` because the marker is already a labelled toggle for
              the same state: two controls in one row both announcing "mark this
              done" is a screen reader reading the row twice. Sighted writers
              get the affordance; everyone else already had one. */}
          {next && !step.automatic && !step.done && (
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setRoadmapStep(bookId, step.id, true)}
              className="ml-auto shrink-0 rounded-md border border-accent/40 px-2.5
                         py-1 text-xs font-semibold text-accent outline-none
                         transition-colors hover:bg-accent/10"
            >
              Already done
            </button>
          )}

          {panel && onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              aria-expanded={Boolean(active)}
              className={`text-xs font-semibold text-accent ${
                next && !step.automatic && !step.done ? "" : "ml-auto"
              }`}
            >
              {active ? "Open ✓" : "Open →"}
            </button>
          ) : (
            href && (
              /* The two that leave — the editor and the reading view — mark
                 the door they came out of. Both take the whole window by
                 design, and until now that was a one-way trip: a writer who
                 pressed "Read it end to end" from the road had no route back
                 to it. The phase rides along so the way back lands where they
                 left rather than at step one. */
              <Link
                href={`${href}${href.includes("?") ? "&" : "?"}from=roadmap&phase=${phase}`}
                className={`text-xs font-semibold text-accent ${
                  next && !step.automatic && !step.done ? "" : "ml-auto"
                }`}
              >
                Open →
              </Link>
            )
          )}
        </div>

        {!step.done && <p className="mt-1 text-sm text-muted">{step.note}</p>}
      </div>
    </li>
  );
}

