"use client";

import { useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/shelf/book-cover";
import { runExport, type Format } from "@/lib/export";
import {
  DEFAULT_TYPESET,
  TEMPLATES,
  TRIMS,
  templateById,
  type TypesetOptions,
} from "@/lib/export/typeset";
import { findBook } from "@/lib/library-store";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";

/**
 * Getting the book out.
 *
 * Every control here changes the file that is produced. Options that only moved
 * a preview would be worse than none at all, because the writer would find out
 * at the printer — so the typesetting choices are shown only for the two
 * formats whose look is ours to decide, and hidden for the two where it is not.
 */

const FORMATS: {
  value: Format;
  label: string;
  hint: string;
  typeset: boolean;
}[] = [
  {
    value: "pdf",
    label: "PDF",
    hint: "Typeset to your trim size, through your browser's print dialog",
    typeset: true,
  },
  {
    value: "epub",
    label: "EPUB",
    hint: "For e-readers and the ebook stores",
    typeset: true,
  },
  {
    value: "docx",
    label: "Word",
    hint: "What agents and editors ask for",
    typeset: false,
  },
  {
    value: "markdown",
    label: "Markdown",
    hint: "Plain text that reads anywhere",
    typeset: false,
  },
];

export function ExportPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const cover = useCover(bookId);

  const [format, setFormat] = useState<Format>("pdf");
  const [manuscript, setManuscript] = useState(true);
  const [typeset, setTypeset] = useState<TypesetOptions>(DEFAULT_TYPESET);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hydrated) return null;

  const book = findBook(shelf, bookId);
  if (!book) {
    return (
      <main className="flex h-dvh items-center justify-center px-6">
        <div className="text-center">
          <p className="font-serif text-xl text-fg">This book isn’t here.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-sm font-sans text-sm text-accent
                       underline underline-offset-4 outline-none
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Back to your books
          </Link>
        </div>
      </main>
    );
  }

  const active = FORMATS.find((f) => f.value === format)!;
  const template = templateById(typeset.template);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await runExport({ book, format, manuscript, typeset });
    } catch (err) {
      console.error("[export] failed", err);
      setError(
        "That export could not be produced. If the book is very large, try a single format at a time.",
      );
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof TypesetOptions>(
    key: K,
    value: TypesetOptions[K],
  ) => setTypeset((prev) => ({ ...prev, [key]: value }));

  return (
    <main className="scroll-slim h-dvh overflow-y-auto bg-surface">
      <header className="border-b border-line bg-panel px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto flex max-w-5xl items-center gap-4 md:gap-5">
          <div className="w-14 shrink-0 md:w-20">
            <BookCover
              title={book.title}
              subtitle={book.subtitle}
              author={book.author}
              words={0}
              image={cover}
              bare={book.bareCover}
              seed={book.id}
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-xl text-fg md:text-2xl">
              {book.title}
            </h1>
            <p className="mt-1 font-sans text-sm text-muted">
              Typeset your manuscript and take it out of here.
            </p>
          </div>
          <Link
            href={`/book/${bookId}`}
            aria-label="Back to writing"
            className="ml-auto shrink-0 rounded-md px-3 py-2 font-sans text-sm
                       text-muted outline-none transition-colors
                       hover:bg-raised hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            {/* An arrow on phones, the words where there's room. */}
            <span className="md:hidden" aria-hidden="true">←</span>
            <span className="hidden md:inline">Back to writing</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Format">
            <div className="grid gap-3 sm:grid-cols-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={format === f.value}
                  onClick={() => setFormat(f.value)}
                  className={`rounded-md border px-4 py-3 text-left outline-none
                              transition-colors focus-visible:ring-2
                              focus-visible:ring-accent/60 ${
                                format === f.value
                                  ? "border-accent bg-accent/10"
                                  : "border-line hover:border-accent/50 hover:bg-raised"
                              }`}
                >
                  <span className="block font-sans text-sm font-medium text-fg">
                    {f.label}
                  </span>
                  <span className="mt-0.5 block font-sans text-xs text-muted">
                    {f.hint}
                  </span>
                </button>
              ))}
            </div>

            {format === "pdf" && (
              <p className="mt-4 rounded-md border border-line bg-surface px-3 py-2.5 font-sans text-xs text-muted">
                This opens your browser’s print dialog — choose “Save as PDF”.
                It sets the interior at your trim size. It does not add bleed or
                crop marks, so a printer may ask you for those separately.
              </p>
            )}

            {format === "docx" && (
              <label className="mt-4 flex items-start gap-2.5 font-sans text-sm">
                <input
                  type="checkbox"
                  checked={manuscript}
                  onChange={(e) => setManuscript(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="text-fg">Standard manuscript format</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Double-spaced, 12pt, with a byline block — what submission
                    guidelines mean.
                  </span>
                </span>
              </label>
            )}
          </Card>

          {active.typeset ? (
            <>
              <Card
                title="Formatting"
                note="These change the file, not just the preview."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Toggle
                    label="Hide chapter numbers"
                    hint="Titles only, with no numeral above them"
                    on={typeset.hideChapterNumbers}
                    onChange={(v) => set("hideChapterNumbers", v)}
                  />
                  <Toggle
                    label="Drop caps"
                    hint="A raised initial opening each chapter"
                    on={typeset.dropCaps}
                    onChange={(v) => set("dropCaps", v)}
                  />
                </div>
              </Card>

              <Card
                title="Trim size"
                note={
                  format === "epub"
                    ? "Used for the PDF. An e-reader chooses its own page, so EPUB ignores this."
                    : "The finished page size, before binding."
                }
              >
                <select
                  value={typeset.trim}
                  onChange={(e) => set("trim", e.target.value)}
                  disabled={format === "epub"}
                  className="w-full rounded-md border border-line bg-surface
                             px-3 py-2.5 font-sans text-sm text-fg
                             focus-visible:border-accent
                             focus-visible:outline-none disabled:opacity-50"
                >
                  {TRIMS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Card>

              <Card title="Template" note="How the book is set.">
                <div className="grid gap-3 sm:grid-cols-3">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={typeset.template === t.id}
                      onClick={() => set("template", t.id)}
                      className={`rounded-md border px-3 py-3 text-left
                                  outline-none transition-colors
                                  focus-visible:ring-2
                                  focus-visible:ring-accent/60 ${
                                    typeset.template === t.id
                                      ? "border-accent bg-accent/10"
                                      : "border-line hover:border-accent/50 hover:bg-raised"
                                  }`}
                    >
                      <span className="block font-sans text-sm font-medium text-fg">
                        {t.name}
                      </span>
                      <span
                        className="mt-0.5 block text-xs text-muted"
                        style={{ fontFamily: t.stack }}
                      >
                        {t.face}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Set in the template's own face at its own size, so what is
                    shown is the setting rather than a picture of one. */}
                <div className="mt-4 rounded-md bg-white p-6">
                  <div
                    className="mx-auto max-w-sm text-[#16191f]"
                    style={{
                      fontFamily: template.stack,
                      fontSize: `${template.bodyPt}pt`,
                      lineHeight: template.leading,
                    }}
                  >
                    {!typeset.hideChapterNumbers && (
                      <p
                        className="text-center text-[#555]"
                        style={{ fontSize: `${template.bodyPt * 1.4}pt` }}
                      >
                        1
                      </p>
                    )}
                    <p
                      className="mt-1 text-center"
                      style={{
                        fontSize: `${template.bodyPt * 1.6}pt`,
                        fontVariant: template.headingCaps
                          ? "small-caps"
                          : "normal",
                        letterSpacing: template.headingCaps ? "0.06em" : "0",
                      }}
                    >
                      {book.chapters[0]?.title ?? "Chapter One"}
                    </p>
                    <p
                      className="mt-6 text-justify"
                      style={
                        typeset.dropCaps
                          ? ({
                              ["--drop" as string]: "1",
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      {typeset.dropCaps && (
                        <span
                          style={{
                            float: "left",
                            fontSize: `${template.bodyPt * 3.2}pt`,
                            lineHeight: 0.82,
                            padding: "0.06em 0.08em 0 0",
                          }}
                        >
                          T
                        </span>
                      )}
                      {typeset.dropCaps
                        ? "he road ran west, and the salt began before she had counted a mile of it."
                        : "The road ran west, and the salt began before she had counted a mile of it."}
                    </p>
                    <p className="text-justify" style={{ textIndent: "1.5em" }}>
                      She did not look back, and afterwards could never say
                      whether that had been courage or the simple want of a
                      reason to.
                    </p>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card title="Formatting">
              <p className="font-sans text-sm text-muted">
                {format === "docx"
                  ? "Word carries its own styles, so the template and trim size below do not apply — your editor will set the book their way."
                  : "Markdown is plain text with no typesetting, so there is nothing here to choose."}
              </p>
            </Card>
          )}

          {/* Announced, not pretended. A live-looking button that does nothing
              is worse than one that says plainly it is not built yet. */}
          <section className="rounded-lg border border-dashed border-line p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M4 11V9.6a6 6 0 0 1 12 0V11" />
                  <path d="M4.2 11h1.4a1 1 0 0 1 1 1v2.6a1 1 0 0 1-1 1h-.8A1.8 1.8 0 0 1 3 13.8V12.2a1.2 1.2 0 0 1 1.2-1.2z" />
                  <path d="M15.8 11h-1.4a1 1 0 0 0-1 1v2.6a1 1 0 0 0 1 1h.8a1.8 1.8 0 0 0 1.8-1.8V12.2a1.2 1.2 0 0 0-1.2-1.2z" />
                </svg>
              </span>

              <div className="min-w-0 flex-1">
                <h2 className="font-sans text-sm font-semibold text-fg">
                  Audiobook
                </h2>
                <p className="mt-1 font-sans text-xs text-muted">
                  Read your manuscript aloud and export it as audio. Not built
                  yet — this is here so you know it is planned, not because it
                  works.
                </p>
              </div>

              <button
                type="button"
                disabled
                title="Not available yet"
                className="shrink-0 cursor-not-allowed rounded-md border
                           border-line px-3 py-2 font-sans text-sm text-muted
                           opacity-60"
              >
                Coming soon
              </button>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-lg border border-line bg-panel p-5">
            <p className="font-serif text-lg text-fg">
              {active.label} of {book.chapters.length}{" "}
              {book.chapters.length === 1 ? "chapter" : "chapters"}
            </p>
            <p className="mt-1 font-sans text-sm text-muted">{active.hint}</p>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-accent/50 bg-accent-deep/30 px-3 py-2.5 font-sans text-sm text-fg"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="mt-5 w-full rounded-md bg-accent py-2.5 font-sans
                         text-sm font-semibold text-white outline-none
                         transition-colors hover:bg-accent-strong
                         focus-visible:ring-2 focus-visible:ring-accent/60
                         disabled:opacity-50"
            >
              {busy ? "Working…" : `Export ${active.label}`}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-panel p-5">
      <h2 className="font-sans text-sm font-semibold text-fg">{title}</h2>
      {note && <p className="mt-1 font-sans text-xs text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`rounded-md border px-3 py-3 text-left outline-none
                  transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    on
                      ? "border-accent bg-accent/10"
                      : "border-line hover:border-accent/50 hover:bg-raised"
                  }`}
    >
      <span className="block font-sans text-sm font-medium text-fg">
        {label}
      </span>
      <span className="mt-0.5 block font-sans text-xs text-muted">{hint}</span>
    </button>
  );
}
