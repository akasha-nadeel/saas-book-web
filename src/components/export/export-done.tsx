"use client";

import { useEffect, useRef, useState } from "react";
import { DESTINATIONS } from "@/components/landing/works-with";
import { download, fileSize, type Format } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";

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
 *
 * It used to carry a fourth thing — the next roadmap step and a tick for the
 * one just finished — and that came off with the rest of the publishing half;
 * see the note where it stood.
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
  onClose,
}: {
  done: ExportDone;
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

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="export-done-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="oc-done-in m-auto w-[34rem] max-w-[calc(100vw-2rem)] overflow-y-auto
                 rounded-2xl border border-tremor-border bg-tremor-background p-0 text-tremor-content-strong shadow-2xl
                 backdrop:bg-black/60"
    >
      <div className="relative p-6 sm:p-7">
        <DialogClose onClose={onClose} />

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
          className="mt-4 font-serif text-2xl leading-tight text-tremor-content-strong"
        >
          {/* PDF never reaches here; the fallback is a type-level formality
              rather than a state anything can produce. */}
          {READY[done.format as Exclude<DoneFormat, "pdf">] ??
            "Your file is ready"}
        </h2>
        <p className="mt-1.5 font-sans text-sm leading-relaxed text-tremor-content">
          Your browser has it. Where it puts a download is its own setting, so
          look wherever that is — the name is below.
        </p>

        {/* ---- The file ------------------------------------------------- */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-tremor-border bg-tremor-background-subtle px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm text-tremor-content-strong">
              {done.filename}
            </span>
            <span className="mt-0.5 block font-sans text-xs text-tremor-content">
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
            className="shrink-0 rounded-lg border border-tremor-border px-3.5 py-2
                       font-sans text-sm font-semibold text-tremor-content-strong outline-none
                       transition-colors hover:border-accent/60 hover:bg-tremor-background
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Save it again
          </button>
        </div>
        {again && (
          <p role="status" className="mt-2 font-sans text-xs text-tremor-content">
            Sent to your browser again.
          </p>
        )}

        {/* ---- Where it opens -------------------------------------------- */}
        {opens.length > 0 && (
          <div className="mt-5">
            <p className="font-sans text-[11px] font-semibold tracking-[0.14em] text-tremor-content uppercase">
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
                  className="rounded-lg border border-tremor-border bg-tremor-background-subtle px-2.5 py-1
                             font-sans text-xs font-medium text-tremor-content-strong"
                >
                  {d.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* **The shop-readiness note and the roadmap card came off on
            2026-08-25.** Both belonged to the publishing half of the
            product, and under the launch flag that half is not there:
            `roadmap` and `listing` are both in `HIDDEN_BOOK_TOOL_PATHS`, so
            the note pointed at a list nobody could open and the card named
            the next step on a road with no way onto it. The tick button went
            with them — it marked a roadmap step done on a roadmap that
            redirects home.

            What is left is what this MVP actually is: the file is written,
            and here is where it went. `roadmapFor` and `storeReadiness` are
            untouched, and all three come back with the tools. */}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button onClick={onClose} className="ml-auto">
            Done
          </Button>
        </div>
      </div>
    </dialog>
  );
}
