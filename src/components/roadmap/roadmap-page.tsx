"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
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
 * **Most of this ticks itself**, from what is in the book. A checklist a writer
 * has to maintain by hand is a second job, and the first time they forget to
 * tick something it starts lying — which is worse than not existing. The steps
 * that happen outside the app say so on their face.
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

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href={`/book/${bookId}`} className="text-sm text-muted">
          ← {book.title}
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold text-fg">
          Blank page to published
        </h1>
        <p className="mt-3 text-muted">
          The order it actually has to happen in. Most of this ticks itself from
          what is in your book.
        </p>

        {/* ---- Where you are ------------------------------------------ */}
        <section className="mt-6 rounded-xl border border-line bg-panel p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-bold text-fg">
              {progress.done} of {progress.total} done
            </p>
            {progress.next && (
              <p className="text-sm text-muted">
                Next: <strong className="text-fg">{progress.next.title}</strong>
              </p>
            )}
          </div>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-raised"
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{
                width: `${(progress.done / progress.total) * 100}%`,
              }}
            />
          </div>
          {progress.next && (
            <p className="mt-3 text-sm text-muted">{progress.next.note}</p>
          )}
        </section>

        {/* ---- The list ----------------------------------------------- */}
        {PHASES.map((phase) => {
          const inPhase = steps.filter((s) => s.phase === phase.id);
          return (
            <section key={phase.id} className="mt-8">
              <h2 className="font-bold text-fg">{phase.label}</h2>
              <p className="text-sm text-muted">{phase.note}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {inPhase.map((step) => (
                  <Row key={step.id} step={step} bookId={bookId} />
                ))}
              </ul>
            </section>
          );
        })}

        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">
          Ticks you make by hand stay on this machine — they are not synced to
          your other devices yet.
        </p>
      </div>
    </div>
  );
}

function Row({ step, bookId }: { step: StepState; bookId: string }) {
  const href = step.href?.(bookId);

  return (
    <li
      className={`rounded-xl border p-4 ${
        step.done ? "border-line bg-panel" : "border-line bg-panel"
      }`}
    >
      <div className="flex items-start gap-3">
        {step.automatic ? (
          /* Worked out, so not a control. A checkbox a writer can click but
             which snaps back the moment the page re-reads the book would be a
             lie about who is in charge of it. */
          <span
            aria-hidden="true"
            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${
              step.done ? "bg-accent text-white" : "bg-raised text-muted"
            }`}
          >
            {step.done ? "✓" : ""}
          </span>
        ) : (
          <input
            type="checkbox"
            checked={step.done}
            onChange={(e) => setRoadmapStep(bookId, step.id, e.target.checked)}
            aria-label={step.title}
            className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
          />
        )}

        <div className="min-w-0 flex-1">
          <p
            className={`font-bold ${step.done ? "text-muted line-through" : "text-fg"}`}
          >
            {step.title}
          </p>
          <p className="mt-1 text-sm text-muted">{step.note}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {href && (
              <Link href={href} className="font-semibold text-accent">
                {step.done ? "Open" : "Do this"} →
              </Link>
            )}
            <span className="text-muted">
              {step.automatic
                ? "Ticks itself from your book"
                : "You tick this one"}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
