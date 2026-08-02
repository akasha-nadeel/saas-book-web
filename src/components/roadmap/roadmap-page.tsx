"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { StepPanelTool, panelToolFor } from "@/components/roadmap/step-panel";
import { findBook, setRoadmapStep } from "@/lib/library-store";
import {
  PHASES,
  progressOf,
  roadmapFor,
  type Phase,
  type StepState,
} from "@/lib/roadmap";
import { useHydrated, useShelf } from "@/lib/use-library";

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
  const book = findBook(shelf, bookId);

  const steps = useMemo(
    () => (book ? roadmapFor(book, book.roadmapDone ?? []) : []),
    [book],
  );
  const progress = useMemo(() => progressOf(steps), [steps]);

  // Counted rather than written down, so the sentence below cannot go stale
  // the way "most of this ticks itself" did.
  const automatic = steps.filter((s) => s.automatic).length;

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
  const setPanel = (stepId: string | null) => {
    const next = new URLSearchParams();
    next.set("phase", open);
    if (stepId) next.set("open", stepId);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const openStep = steps.find((s) => s.id === params.get("open")) ?? null;
  const openHref = openStep?.href?.(bookId);
  const openTool = openHref ? panelToolFor(openHref, bookId) : null;

  const index = PHASES.findIndex((p) => p.id === open);
  const current = phases[index] ?? phases[0];
  const previous = index > 0 ? phases[index - 1] : null;
  const following = index < phases.length - 1 ? phases[index + 1] : null;
  /** Only worth offering when the writer has browsed away from their position. */
  const skipTo = here && here !== open ? phases.find((p) => p.id === here) : null;

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

  const nextHref = progress.next?.href?.(bookId);
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
        {/* Which book this is. Shared by every tool screen, because they all open
            full-window with none of the dashboard around them, and the Tools area
            lets a writer change book before opening one. */}
        <ToolHeader
          book={book}
          tool="Roadmap"
          title="Blank page to published"
          width={split ? "full" : "3xl"}
        >
          The order it actually has to happen in — including the step almost
          everybody finds out about too late.
        </ToolHeader>

        <div
          className={`px-6 pt-6 pb-16 ${split ? "" : "mx-auto max-w-3xl"}`}
        >
        {/* ---- Where you are ---------------------------------------------
            The next step is a button, not a sentence. It is the one thing a
            writer opens this page to find, and reading its name only to go
            hunting for the same name further down is the work this card exists
            to save. Its explanation is gone from here too — it appeared twice
            on one screen, once in this card and again in the step's own row. */}
        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
            <div className="min-w-[8rem]">
              <p className="text-2xl font-extrabold text-fg">
                {progress.done}
                <span className="text-base font-bold text-muted">
                  {" "}
                  of {progress.total}
                </span>
              </p>
              <p className="text-xs text-muted">steps done</p>
            </div>

            <div className="min-w-[10rem] flex-1">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-raised"
                role="progressbar"
                aria-valuenow={progress.done}
                aria-valuemin={0}
                aria-valuemax={progress.total}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${share}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">{share}% of the way</p>
            </div>
          </div>

          {progress.next ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface px-5 py-3.5">
              <span className="text-xs font-bold tracking-widest text-muted uppercase">
                Next
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-fg">
                {progress.next.title}
              </span>
              {nextHref && (
                <Link
                  href={nextHref}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
                >
                  Do this
                </Link>
              )}
            </div>
          ) : (
            <p className="border-t border-line bg-surface px-5 py-3.5 font-semibold text-fg">
              Every step done. That is the whole list.
            </p>
          )}
        </section>

        {/* Said once, here, rather than on all eighteen rows. */}
        <p className="mt-4 text-sm text-muted">
          {automatic} of these work themselves out from what is in your book,
          and are marked <em>ticks itself</em>. The other{" "}
          {progress.total - automatic} happen somewhere else, so they are yours
          to tick — and those ticks stay on this machine rather than syncing to
          your other ones.
        </p>

        {/* ---- The order, all of it, always ------------------------------

            Five stations with their tallies. This is the half of the page
            that carries the claim — a writer can see the whole road and where
            on it they stand without reading eighteen steps to work it out.

            Scrolls sideways on a narrow screen rather than wrapping to two
            rows: a line that wraps stops looking like a line, and the shape is
            doing the explaining here. */}
        {/* Five bars, stacked, each filled by its own progress.

            They were five boxes in a row, which is the shape that cannot
            survive this page: the column is a third of the screen once a step
            is open, five cards do not fit in it at any label length, and what
            a reader got was a horizontal scrollbar under the one control that
            is supposed to show the whole road at a glance. A thing you have to
            scroll to see all of is not an overview.

            Stacked bars have no such width to lose. Every phase is one full
            line at any container size — no truncation, no scrollbar, nothing
            to fit — and the fill turns the tally into something readable
            before it is read, which the boxes never did. It also stops being
            five competing cards and starts looking like a route, which is what
            it is. */}
        <nav aria-label="Phases" className="mt-6 flex flex-col gap-1.5">
          {phases.map((phase, i) => {
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
                className={`relative overflow-hidden rounded-lg border px-3 py-2 text-left
                            transition-colors ${
                              isOpen
                                ? "border-accent bg-panel"
                                : "border-line bg-panel hover:border-accent/40"
                            }`}
              >
                {/* The bar itself. A wash rather than a hairline strip, so the
                    row *is* the measure and there is no second element to keep
                    in step with the number beside it. */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 ${
                    phase.complete ? "bg-ok-fg/12" : "bg-accent/10"
                  }`}
                  style={{ width: `${share}%` }}
                />

                <span className="relative flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                      phase.complete
                        ? "bg-ok-fg text-panel"
                        : isOpen
                          ? "bg-accent text-accent-ink"
                          : "bg-raised text-muted"
                    }`}
                  >
                    {phase.complete ? "✓" : i + 1}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-xs font-bold ${
                      isOpen ? "text-fg" : "text-muted"
                    }`}
                  >
                    {phase.label}
                  </span>
                  {/* Where the road actually is, which is not always what is
                      open — a writer browsing ahead should still be able to
                      see their own position without leaving the page. */}
                  {phase.id === here && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      title="You are here"
                    />
                  )}
                  <span
                    className={`shrink-0 text-[11px] font-semibold ${
                      phase.complete ? "text-ok-fg" : "text-muted"
                    }`}
                  >
                    {phase.complete
                      ? "done"
                      : `${phase.done} of ${phase.steps.length}`}
                  </span>
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
            {/* `text-accent-ink`, never a fixed white: `danger` is a deep red
                by day and a pale one at night, so the ink has to cross over
                with it or the word vanishes in exactly one theme. Same rule as
                every other filled action. */}
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="rounded-lg bg-danger px-3.5 py-1.5 text-sm font-semibold
                         text-accent-ink hover:opacity-90"
            >
              Close
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
}: {
  step: StepState;
  bookId: string;
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

  const marker = `z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full
                  text-[11px] font-bold ${
                    step.done
                      ? "bg-accent text-accent-ink"
                      : "border-2 border-line bg-panel text-transparent"
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
          className={`${marker} transition-colors ${
            step.done ? "" : "hover:border-accent hover:text-accent/40"
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
          {panel && onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              aria-expanded={Boolean(active)}
              className="ml-auto text-xs font-semibold text-accent"
            >
              {active ? "Open ✓" : "Open →"}
            </button>
          ) : (
            href && (
              <Link
                href={href}
                className="ml-auto text-xs font-semibold text-accent"
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
