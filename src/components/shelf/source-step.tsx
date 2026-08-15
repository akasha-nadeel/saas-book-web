"use client";

import { useRef, useState } from "react";
import { IMPORT_ACCEPT, ImportError, importFile } from "@/lib/import";
import type { ImportedBook } from "@/lib/import/split";
import { plural } from "@/lib/plural";

/**
 * Where a manuscript is coming from. Blank books never reach this step.
 *
 * **No `audio`.** A recording is the third thing the shelf's menu names, and it
 * is named there with a "Soon" badge that opens an explanation instead of this
 * screen — the transcriber and the chaptering after it are both written, but
 * the route in is not finished, and `/book/import` has said so in those words
 * for a while. A tab here would be a second way in to the thing being held
 * back, which is how a feature ends up half-offered. When it is ready it comes
 * back as one more entry in that menu and one more tab here; nothing else
 * about this file has to change.
 */
export type SourceKind = "file" | "paste";

export const SOURCE_KINDS: readonly SourceKind[] = ["file", "paste"];

export function isSourceKind(value: string | null): value is SourceKind {
  return value !== null && (SOURCE_KINDS as readonly string[]).includes(value);
}

const TAB_LABEL: Record<SourceKind, string> = {
  file: "Local file",
  paste: "Paste text",
};

/**
 * The first step of `/book/new` when the writer picked something other than a
 * blank book: bring the manuscript in, then carry on into the same details,
 * front-matter and back-matter steps a blank book goes through.
 *
 * **It replaced a dialog, and the reason is the flow rather than the widget.**
 * Importing used to open a modal that parsed the file, asked for a title and
 * then made the book — a second, shorter way of creating one, which meant an
 * imported book never got asked any of the questions a blank one is asked and
 * arrived with no author, no genre and no word-count goal. Two ways in, two
 * different books. The tabs are now doors onto one road.
 *
 * Both readers converge on the same `ImportedBook`: pasted prose goes in as
 * `.md` so its headings become chapters, and by the time anything leaves here
 * it is a parsed manuscript that nothing downstream can tell apart.
 */
export function SourceStep({
  kind,
  onKind,
  onBook,
}: {
  kind: SourceKind;
  onKind: (kind: SourceKind) => void;
  /** Called once a manuscript has been read. The wizard moves on from here. */
  onBook: (book: ImportedBook) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");

  const read = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      onBook(await importFile(file));
    } catch (err) {
      setError(
        err instanceof ImportError
          ? err.message
          : "That file could not be read. It may be damaged, or not the format its name suggests.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Both doors, named. A tab rather than a dropdown because a writer with
          prose on a clipboard does not know this app takes it that way until
          it says so. */}
      <div
        role="tablist"
        aria-label="Where the manuscript is coming from"
        className="flex gap-1 border-b border-line"
      >
        {SOURCE_KINDS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            onClick={() => {
              onKind(value);
              setError(null);
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold outline-none
                        transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
                          kind === value
                            ? "border-accent text-fg"
                            : "border-transparent text-muted hover:text-fg"
                        }`}
          >
            {TAB_LABEL[value]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {kind === "paste" ? (
          <>
            <label
              htmlFor="paste-manuscript"
              className="block text-sm font-semibold text-fg"
            >
              Paste your manuscript
            </label>
            <textarea
              id="paste-manuscript"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={12}
              placeholder={"# My Book\n\n## Chapter One\n\nThe road ran west…"}
              className="mt-2 w-full rounded-xl border border-line bg-panel px-4 py-3
                         font-sans text-sm text-fg outline-none
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            />
            <p className="mt-2 text-xs text-muted">
              {pasted.trim()
                ? `${plural(pasted.trim().split(/\s+/).length, "word")} pasted. `
                : ""}
              Lines starting with{" "}
              <code className="rounded bg-raised px-1">##</code> become chapters.
              Nothing is uploaded.
            </p>
            <button
              type="button"
              disabled={!pasted.trim() || busy}
              onClick={() =>
                void read(
                  new File([pasted.trim()], "Untitled Book.md", {
                    type: "text/markdown",
                  }),
                )
              }
              className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold
                         text-accent-ink outline-none disabled:opacity-50"
            >
              {busy ? "Reading…" : "Use this text"}
            </button>
          </>
        ) : (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void read(file);
              }}
              className={`rounded-xl border-2 border-dashed px-6 py-12 text-center
                          transition-colors ${
                            dragging
                              ? "border-accent bg-raised"
                              : "border-line bg-panel"
                          }`}
            >
              <p className="font-sans text-base font-semibold text-fg">
                Drag and drop your manuscript
              </p>
              <p className="mt-1 font-sans text-sm text-muted">
                It stays on your device — nothing is uploaded.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="mt-5 rounded-lg border border-line bg-surface px-4 py-2.5
                           text-sm font-semibold text-fg outline-none
                           transition-colors hover:border-accent/60 hover:bg-raised
                           focus-visible:ring-2 focus-visible:ring-accent/50
                           disabled:opacity-50"
              >
                {busy ? "Reading…" : "Select file"}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept={IMPORT_ACCEPT}
                aria-label="Choose a manuscript file"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void read(file);
                }}
              />
            </div>

            <p className="mt-3 font-sans text-xs leading-relaxed text-muted">
              Reads .docx, .epub, .md, .txt, .html. Text, headings, bold and
              italic come through; images, footnotes and comments do not. PDF and
              old .doc files cannot be read here — save your manuscript as .docx
              first.
            </p>
          </>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-line bg-raised px-3 py-2
                       font-sans text-sm"
            style={{ color: "var(--color-danger)" }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
