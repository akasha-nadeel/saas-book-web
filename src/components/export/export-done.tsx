"use client";

import { useEffect, useRef, useState } from "react";
import { DESTINATIONS } from "@/components/landing/works-with";
import { ToolStepDone } from "@/components/ui/tool-save";
import { download, fileSize, type Format } from "@/lib/export";
import type { Book } from "@/lib/library-store";
import { roadmapFor, type StepState } from "@/lib/roadmap";
import type { ToolSaveState } from "@/lib/use-tool-save";

/**
 * The moment after the file leaves.
 *
 * **A download is the one action in this app with no visible result.** The
 * browser takes the file to a folder we cannot name and, depending on how it is
 * set up, says nothing at all — so the loudest press on the loudest screen ends
 * in silence, and a writer is left wondering whether a forty-chapter EPUB was
 * built or whether the button simply did not work. Every screen in the trade
 * that ends in a file answers this the same way, and so does this one.
 *
 * Four things it says, in the order somebody wants them:
 *
 * - **That it happened, and what the file is called.** The name is what they
 *   will be looking for in a downloads folder, and it is ours rather than
 *   theirs — `slugify` turns "The Salt Road" into `the-salt-road.epub`, which is
 *   not what anybody would search for unaided.
 * - **A second copy on request.** A blocked or missed download is the commonest
 *   failure here and it is invisible from this side, so the blob is kept and
 *   offered again. Nothing is rebuilt: it is the same bytes, so the two presses
 *   cannot produce different files.
 * - **Where it opens**, from `DESTINATIONS` — the same list the landing page
 *   makes its claim from, so the two cannot disagree and neither can name a shop
 *   the export does not actually reach.
 * - **What is next on the road**, and the tick for the step just finished.
 *
 * What it does *not* do is congratulate. No confetti, no "well done": a writer
 * exporting for the fourth time this afternoon is fixing something.
 *
 * **It is opened by the press, never by an effect.** Same rule as `LimitDialog`
 * — an effect watching for a finished export would also fire on a remount, and
 * a success dialog for a file somebody downloaded yesterday is a lie about the
 * last thing they did.
 */

/** The audiobook is a zip rather than a `Format`, and it ends the same way. */
export type DoneFormat = Format | "audiobook";

export interface ExportDone {
  format: DoneFormat;
  filename: string;
  blob: Blob;
}

/**
 * The headline, in the writer's words rather than the file extension's.
 *
 * **PDF joined the list on 2026-08-16.** It was absent because this dialog
 * never saw one: the export handed the writer the browser's own print dialog,
 * and what they did with it — saved it, cancelled it, sent it to a real
 * printer — was never knowable from here. The PDF is rendered by a browser on
 * the server now and comes back as bytes, so there is a file to name and a
 * size to state, exactly like the other three. On an installation with no
 * browser behind that route the old print dialog is still the fallback, and
 * there `runExport` still answers null and this dialog still never opens.
 */
const READY: Record<DoneFormat, string> = {
  epub: "Your EPUB is ready",
  docx: "Your Word file is ready",
  markdown: "Your Markdown file is ready",
  audiobook: "Your audiobook is ready",
  pdf: "Your PDF is ready",
};

/**
 * The name each format goes by in `DESTINATIONS`.
 *
 * A map rather than a comparison against the format id, because that list is
 * written for a reader — "DOCX", "Markdown" — and this is the one place the two
 * vocabularies meet. A format with nothing against it simply shows no row: the
 * audiobook zip opens in whatever plays MP3s, which is not a claim worth making.
 */
const CATALOGUE_FORMAT: Partial<Record<DoneFormat, string>> = {
  epub: "EPUB",
  docx: "DOCX",
  markdown: "Markdown",
  pdf: "PDF",
};

export function ExportDoneDialog({
  done,
  book,
  save,
  blocking,
  onClose,
}: {
  done: ExportDone;
  book: Book;
  /** The road, so the step just finished can be ticked from here. */
  save: ToolSaveState;
  /** Listing problems a shop would refuse, counted by the screen already. */
  blocking: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [again, setAgain] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  /* Confirmation for the second press, for the same reason the first one needs
     this dialog: a repeat download is even quieter than the original, since the
     screen does not change at all. Cleared on a timer rather than left standing,
     so a writer who presses it twice sees it answer twice. */
  useEffect(() => {
    if (!again) return;
    const timer = window.setTimeout(() => setAgain(false), 4000);
    return () => window.clearTimeout(timer);
  }, [again]);

  const opens = DESTINATIONS.filter(
    (d) => d.format === CATALOGUE_FORMAT[done.format],
  );

  /*
   * What follows this on the road.
   *
   * Not `progressOf(...).next`, which would answer with the export step itself:
   * it is hand-ticked, and at this moment it is un-ticked by definition — the
   * writer has this second finished the thing it stands for. So the search
   * starts *after* it, and skips anything already done. Steps are read live
   * rather than named here, because "Open the files yourself" following "Export
   * the files" is a fact about `roadmap.ts` and not about this dialog.
   */
  const steps = roadmapFor(book, book.roadmapDone ?? []);
  const from = steps.findIndex((s) => s.id === "export");
  const next: StepState | null =
    from === -1 ? null : (steps.slice(from + 1).find((s) => !s.done) ?? null);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="export-done-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="oc-done-in m-auto w-[34rem] max-w-[calc(100vw-2rem)]
                 rounded-2xl border border-line bg-panel p-0 text-fg shadow-2xl
                 backdrop:bg-black/60"
    >
      <div className="relative p-6 sm:p-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-8 w-8 items-center
                     justify-center rounded-full text-muted outline-none
                     transition-colors hover:bg-raised hover:text-fg
                     focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="h-4 w-4"
          >
            <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
          </svg>
        </button>

        {/* The tick keeps its colour, like every other "this passed" in the app:
            green is the one thing in a greyscale palette that needs no
            teaching, and `ok` is a token pair so it is dark ink on a pale
            ground by day and the reverse at night. */}
        <span
          aria-hidden="true"
          className="oc-done-pop flex h-12 w-12 items-center justify-center
                     rounded-full border border-ok-line bg-ok-bg text-ok-fg"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        </span>

        <h2
          id="export-done-title"
          className="mt-4 font-serif text-2xl leading-tight text-fg"
        >
          {/* PDF never reaches here; the fallback is a type-level formality
              rather than a state anything can produce. */}
          {READY[done.format as Exclude<DoneFormat, "pdf">] ??
            "Your file is ready"}
        </h2>
        <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted">
          Your browser has it. Where it puts a download is its own setting, so
          look wherever that is — the name is below.
        </p>

        {/* ---- The file ------------------------------------------------- */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-raised px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm text-fg">
              {done.filename}
            </span>
            <span className="mt-0.5 block font-sans text-xs text-muted">
              {fileSize(done.blob.size)}
            </span>
          </span>
          {/* Not a re-export. The same bytes are handed over again, so a writer
              who lost the first copy cannot end up with a second file that
              differs from it. */}
          <button
            type="button"
            onClick={() => {
              download(done.blob, done.filename);
              setAgain(true);
            }}
            className="shrink-0 rounded-lg border border-line px-3.5 py-2
                       font-sans text-sm font-semibold text-fg outline-none
                       transition-colors hover:border-accent/60 hover:bg-panel
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Save it again
          </button>
        </div>
        {again && (
          <p role="status" className="mt-2 font-sans text-xs text-muted">
            Sent to your browser again.
          </p>
        )}

        {/* ---- Where it opens -------------------------------------------- */}
        {opens.length > 0 && (
          <div className="mt-5">
            <p className="font-sans text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
              It opens in
            </p>
            {/* Names rather than the brand marks that sit beside them on the
                landing page. Those are drawn in each brand's own hex — Apple's
                is #000000 — and this dialog is on black half the time. A
                trademark is not ours to re-tint, so it is left out rather than
                shown wrong. */}
            <ul className="mt-2 flex flex-wrap gap-2">
              {opens.map((d) => (
                <li
                  key={d.name}
                  className="rounded-lg border border-line bg-raised px-2.5 py-1
                             font-sans text-xs font-medium text-fg"
                >
                  {d.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---- What a shop would still refuse ----------------------------
            Quiet, and only where it is true. The full list is on the screen
            behind this dialog, which is where the fixing happens — repeating it
            here would be a second copy of the readiness check to keep in step.
            It is said at all because this is the moment before an upload. */}
        {done.format === "epub" && blocking > 0 && (
          <p className="mt-4 rounded-lg border border-stop-line bg-stop-bg px-3.5 py-2.5 font-sans text-xs leading-relaxed text-stop-fg">
            {blocking} {blocking === 1 ? "thing" : "things"} on the listing
            {blocking === 1 ? " is" : " are"} still what a shop would refuse —
            they are listed under this button. The file is yours either way.
          </p>
        )}

        {/* ---- The road --------------------------------------------------- */}
        {next && (
          <div className="mt-5 rounded-xl border border-line px-4 py-3.5">
            <p className="font-sans text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
              Next on your roadmap
            </p>
            <p className="mt-1.5 font-sans text-sm font-semibold text-fg">
              {next.title}
            </p>
            <p className="mt-1 font-sans text-xs leading-relaxed text-muted">
              {next.note}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {/* The same control the header carries, not a second implementation
              of it: what it ticks is worked out from the step's own `href`, and
              two buttons deciding that separately would eventually disagree. It
              is here as well because this is the moment the step is true. */}
          <ToolStepDone state={save} />

          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg bg-accent px-5 py-2.5 font-sans
                       text-sm font-semibold text-accent-ink outline-none
                       transition-colors hover:bg-accent-strong
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
