"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { findBook, setRoadmapStep } from "@/lib/library-store";
import { PHASES, progressOf, roadmapFor, type StepState } from "@/lib/roadmap";
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

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      {/* Which book this is. Shared by every tool screen, because they all open
          full-window with none of the dashboard around them, and the Tools area
          lets a writer change book before opening one. */}
      <ToolHeader book={book} tool="Roadmap">
        The order it actually has to happen in — including the step almost
        everybody finds out about too late.
      </ToolHeader>

      <div className="mx-auto max-w-3xl px-6 pt-6 pb-16">
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
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
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

        {/* ---- The line --------------------------------------------------- */}
        {PHASES.map((phase) => {
          const inPhase = steps.filter((s) => s.phase === phase.id);
          const done = inPhase.filter((s) => s.done).length;
          const complete = done === inPhase.length;

          return (
            <section key={phase.id} className="mt-8">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-bold text-fg">{phase.label}</h2>
                <span
                  className={`text-xs font-bold ${
                    complete ? "text-emerald-700" : "text-muted"
                  }`}
                >
                  {complete ? "done" : `${done} of ${inPhase.length}`}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted">{phase.note}</p>

              <ul className="mt-3">
                {inPhase.map((step, i) => (
                  <Row
                    key={step.id}
                    step={step}
                    bookId={bookId}
                    next={progress.next?.id === step.id}
                    last={i === inPhase.length - 1}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
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
}: {
  step: StepState;
  bookId: string;
  /** The first unfinished step in the whole list. */
  next: boolean;
  /** Last in its phase, so the rail stops here. */
  last: boolean;
}) {
  const href = step.href?.(bookId);

  const marker = `z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full
                  text-[11px] font-bold ${
                    step.done
                      ? "bg-accent text-white"
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
          next
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

          {href && (
            <Link
              href={href}
              className="ml-auto text-xs font-semibold text-accent"
            >
              Open →
            </Link>
          )}
        </div>

        {!step.done && <p className="mt-1 text-sm text-muted">{step.note}</p>}
      </div>
    </li>
  );
}
