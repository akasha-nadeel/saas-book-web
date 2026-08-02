"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FormatMark,
  FormatPreview,
  OPENING,
  SECOND,
  type PreviewBook,
} from "@/components/export/format-previews";
import {
  ListingBlurb,
  ListingDetails,
  Note,
  StoreReadiness,
} from "@/components/export/publishing-card";
import { loadChapters, runExport, type Format } from "@/lib/export";
import {
  DEFAULT_TYPESET,
  TEMPLATES,
  TRIMS,
  templateById,
  trimById,
  type TypesetOptions,
} from "@/lib/export/typeset";
import { bookWordCount, findBook, type Book } from "@/lib/library-store";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";
import { BookCover } from "@/components/shelf/book-cover";
import { storeReadiness } from "@/lib/publishing";
import { type ToolPageProps } from "@/lib/tool-page";

/**
 * Getting the book out, as a sequence rather than a wall.
 *
 * Every control here changes the file that is produced. Options that only moved
 * a preview would be worse than none at all, because the writer would find out
 * at the printer — so the typesetting choices are shown only for the formats
 * whose look is ours to decide, and hidden for the ones where it is not.
 *
 * **The page is a wizard because the work genuinely is one.** The old screen
 * stacked every card at once, which meant a writer exporting Markdown scrolled
 * past trim sizes and drop caps that could not apply to their file, and a writer
 * exporting EPUB met eight listing fields in one go. The steps are built from
 * the chosen format (`stepsFor`), so the rail is a truthful table of contents:
 * what is on it is what this export will actually ask you.
 *
 * Nothing here gates. Every step is reachable at any time and no answer is
 * required — the Export button sits on the last step and works whatever is left
 * blank. A wizard that refuses to let a writer reach the end of their own export
 * would be a worse screen than the wall it replaced.
 */

/** The four export formats plus the audiobook, which is one more way out. */
type Output = Format | "audiobook";

const FORMATS: { value: Output; label: string; hint: string }[] = [
  {
    value: "pdf",
    label: "PDF",
    hint: "Typeset to your trim size, through your browser’s print dialog",
  },
  { value: "epub", label: "EPUB", hint: "For e-readers and the ebook stores" },
  { value: "docx", label: "Word", hint: "What agents and editors ask for" },
  {
    value: "markdown",
    label: "Markdown",
    hint: "Plain text that reads anywhere",
  },
  {
    value: "audiobook",
    label: "Audiobook",
    hint: "Read aloud — one MP3 per chapter, in a zip",
  },
];

/** The two whose look is ours, and therefore the two with a Formatting step. */
const isTypeset = (output: Output | null) =>
  output === "pdf" || output === "epub";

type StepId =
  | "format"
  | "template"
  | "layout"
  | "frontmatter"
  | "listing"
  | "blurb"
  | "export";

/**
 * The steps a link from outside may open directly.
 *
 * Deliberately not every step. A deep link is a promise that the writer will
 * land on the field they were sent for, so it only holds the ones a *finding*
 * names — the listing details and the blurb. "Format" is where the flow starts
 * anyway, and the export step at the end would drop somebody into a Download
 * button having skipped every question it depends on.
 */
const STEP_DEEP_LINKS = new Set<StepId>(["listing", "blurb"]);

interface Step {
  id: StepId;
  /** The heading on the rail. Consecutive steps sharing one become a group. */
  group: string;
  /** Shown as a sub-item under the group, when the group has more than one. */
  label?: string;
  title: string;
  blurb: string;
}

/**
 * The steps this export actually has.
 *
 * Derived rather than filtered at render, so the rail, the Next button and the
 * "step 3 of 5" counter can never disagree about how long the road is.
 */
function stepsFor(output: Output | null): Step[] {
  const steps: Step[] = [
    {
      id: "format",
      group: "Format",
      title: "How do you want it?",
      blurb: "What comes next depends on this, so it is the first question.",
    },
  ];

  // Nothing chosen, nothing to promise. The road genuinely is not known yet —
  // Markdown is two steps and EPUB is seven — so the rail shows the one question
  // that has been asked rather than a route that might not be taken.
  if (output === null) return steps;

  if (isTypeset(output)) {
    steps.push(
      {
        id: "template",
        group: "Formatting",
        label: "Template",
        title: "How the book is set",
        blurb: "The face your prose is printed in, shown in its own type.",
      },
      {
        id: "layout",
        group: "Formatting",
        label: "Page and chapters",
        title: "The page and the chapters",
        blurb: "How a chapter opens, and how big the page it opens on is.",
      },
      {
        id: "frontmatter",
        group: "Front matter",
        title: "The pages before the story",
        blurb:
          "Built from what the book already knows, and placed at the front for you.",
      },
    );
  }

  if (output === "epub") {
    steps.push(
      {
        id: "listing",
        group: "Store listing",
        label: "Book details",
        title: "What a shop asks for",
        blurb:
          "Saved to the book, so you answer these once rather than once per export.",
      },
      {
        id: "blurb",
        group: "Store listing",
        label: "Blurb and shelves",
        title: "How it gets found",
        blurb: "The text under the cover, and the shelves it sits on.",
      },
    );
  }

  steps.push({
    id: "export",
    group: "Export",
    title:
      output === "audiobook" ? "Read it aloud" : "Take it out of here",
    blurb:
      output === "audiobook"
        ? "One chapter at a time, so a long book is visible progress rather than one long wait."
        : "Everything is set. Here is what you are about to get.",
  });

  return steps;
}

/** Consecutive steps sharing a group name, for the rail. */
function groupsOf(steps: Step[]) {
  const groups: { name: string; steps: Step[] }[] = [];
  for (const step of steps) {
    const last = groups[groups.length - 1];
    if (last?.name === step.group) last.steps.push(step);
    else groups.push({ name: step.group, steps: [step] });
  }
  return groups;
}

export function ExportPage({ bookId, embedded, heading }: ToolPageProps) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const cover = useCover(bookId);

  /*
   * Where to open, and in what format.
   *
   * **Nothing chosen to begin with**, normally. A card that arrives already
   * ticked is the app answering its own first question, and a writer who wanted
   * that format never finds out they had a choice.
   *
   * `?step=` is the exception, and it exists because of a specific broken
   * promise. A finding on the dashboard says "No ISBN" with a button reading
   * "Set the ISBN" — and that field lives on this flow's *listing* step, four
   * screens in. Sent to the top, the writer arrives at "How do you want it?"
   * and has to guess that a format chooser is the way to an ISBN box. So a
   * caller that knows which field it is sending somebody to may say so.
   *
   * It carries the format with it, because a step is only reachable in a format
   * that has it: the listing steps exist for EPUB alone — attaching an ISBN to
   * a Markdown download would be asking a writer to fill in a form for a file
   * nobody will list. Deep-linking to a step therefore *is* choosing EPUB, and
   * pretending otherwise would land them back on the format chooser anyway.
   *
   * Read once, as an initial value. After that the flow is the writer's: making
   * this reactive would drag them back to the linked step every time they moved.
   */
  const initial = useSearchParams().get("step");
  const deepLink =
    initial && STEP_DEEP_LINKS.has(initial as StepId) ? (initial as StepId) : null;

  const [output, setOutput] = useState<Output | null>(deepLink ? "epub" : null);
  const [stepId, setStepId] = useState<StepId>(deepLink ?? "format");
  const [manuscript, setManuscript] = useState(true);
  const [typeset, setTypeset] = useState<TypesetOptions>(DEFAULT_TYPESET);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Narration keeps its own state rather than sharing the export flags: it runs
  // for minutes, reports progress as it goes, and a writer should still be able
  // to move around the wizard while it does.
  const [narrating, setNarrating] = useState(false);
  const [narrationLabel, setNarrationLabel] = useState("");
  const [narrationError, setNarrationError] = useState<string | null>(null);

  const steps = useMemo(() => stepsFor(output), [output]);

  /**
   * What a shop would refuse, for the rail to show from step one.
   *
   * The listing half only — `storeReadiness` is pure and reads the book's own
   * fields, so this costs nothing per render. The half that needs the
   * manuscript (`checkStoreReadiness`, which walks every chapter for broken or
   * undescribed images) stays on the export step where it already runs, because
   * parsing the whole book to draw a sidebar badge would be a real cost for a
   * number that is only a prompt.
   *
   * `findBook` is called here rather than reusing the one below, because every
   * hook has to run before the early returns — a book that is not there must
   * not change how many hooks this component runs.
   */
  const blocking = useMemo(() => {
    const b = findBook(shelf, bookId);
    if (!b) return 0;
    return storeReadiness({
      book: b,
      ...(b.publishing ? { meta: b.publishing } : {}),
      hasCover: cover !== null,
      chapterCount: b.chapters.filter((c) => c.words > 0).length,
      brokenImages: 0,
    }).filter((issue) => issue.level === "blocking").length;
  }, [shelf, bookId, cover]);

  // Every hook is above the early returns on purpose — a book that is not there
  // must not change how many hooks this component runs.
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

  // A format change can retire the step we are standing on (EPUB → Markdown
  // takes the listing away). Falling back to the first step is the only answer
  // that is always valid.
  const found = steps.findIndex((s) => s.id === stepId);
  const index = found === -1 ? 0 : found;
  const step = steps[index];
  const groups = groupsOf(steps);
  const active = FORMATS.find((f) => f.value === output) ?? null;

  // The first *body* chapter, not the first stored one. This book opens on a
  // chapter tagged as front matter, and the specimen prints a chapter number
  // above whatever it is given — so the untagged one is the only honest sample.
  const sampleTitle =
    book.chapters.find((c) => !c.matter)?.title ??
    book.chapters[0]?.title ??
    "Chapter One";

  // With no format chosen there is only the one step, and it is not an ending —
  // it is a question waiting for an answer.
  const last = output !== null && index === steps.length - 1;

  const go = (next: number) => {
    setStepId(steps[Math.min(steps.length - 1, Math.max(0, next))].id);
    // A step change is a new screen; the old one's scroll position is not it.
    document.getElementById("export-scroll")?.scrollTo({ top: 0 });
  };

  const pick = (value: Output) => {
    setOutput(value);
    setError(null);
    // Standing on "format" already, so the step id stays valid whatever the new
    // format's road looks like.
    setStepId("format");
  };

  const run = async () => {
    if (output === null || output === "audiobook") return;
    setBusy(true);
    setError(null);
    try {
      await runExport({ book, format: output, manuscript, typeset });
    } catch (err) {
      console.error("[export] failed", err);
      setError(
        "That export could not be produced. If the book is very large, try a single format at a time.",
      );
    } finally {
      setBusy(false);
    }
  };

  const narrate = async () => {
    setNarrating(true);
    setNarrationError(null);
    setNarrationLabel("Starting…");
    try {
      const { exportAudiobook } = await import("@/lib/export/audiobook");
      await exportAudiobook(
        book.title,
        loadChapters(book),
        "onyx",
        ({ chapter, chapters, chapterTitle, chunk, chunks }) => {
          setNarrationLabel(
            `Chapter ${chapter} of ${chapters} — ${chapterTitle} (part ${chunk} of ${chunks})`,
          );
        },
      );
      setNarrationLabel("");
    } catch (err) {
      console.error("[narrate] failed", err);
      // The route's own message when it has one — "no key", "sign in", "too
      // long" are all things the writer can act on, unlike a generic failure.
      setNarrationError(
        err instanceof Error && err.message
          ? err.message
          : "The audiobook could not be produced.",
      );
      setNarrationLabel("");
    } finally {
      setNarrating(false);
    }
  };

  const set = <K extends keyof TypesetOptions>(
    key: K,
    value: TypesetOptions[K],
  ) => setTypeset((prev) => ({ ...prev, [key]: value }));

  return (
    // The shell owns the height and does not scroll; the content column does.
    // <body> is overflow-hidden, so a scrolling region has to be declared.
    //
    // The rail takes the tint and the content takes the white, which is the way
    // round this pattern wants: the form is the subject, so it gets the clean
    // ground, and the navigation sits back on a wash.
    // The export screen keeps its own rail in the panel rather than taking the
    // `toolShell` helper: this one is already a two-pane layout and the rail is
    // the step list, not chrome. Only the height claim changes.
    <main
      className={`flex ${embedded ? "h-full" : "h-dvh"} overflow-hidden bg-panel`}
    >
      <Rail
        book={book}
        bookId={bookId}
        cover={cover}
        blocking={blocking}
        groups={groups}
        currentId={step.id}
        currentIndex={index}
        steps={steps}
        onGo={(id) => go(steps.findIndex((s) => s.id === id))}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Above this screen's own Back/step header rather than inside it: the
            step name belongs to the whole export flow, and the header below
            changes with every step of it. */}
        {heading && <div className="shrink-0 px-5 pt-5 md:px-12 md:pt-7">{heading}</div>}
        <header className="flex shrink-0 items-center gap-4 px-5 pt-5 md:px-12 md:pt-7">
          {/* Back sits at the top, where you came in, rather than at the bottom
              where it would compete with the step's own action. Absent on the
              first step rather than disabled — there is nothing behind it. */}
          {index > 0 ? (
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="group flex items-center gap-2.5 rounded-full outline-none
                         focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full
                           bg-surface text-muted transition-colors
                           group-hover:bg-raised group-hover:text-fg"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <path d="M12 5l-5 5 5 5" />
                </svg>
              </span>
              <span className="font-sans text-sm text-muted transition-colors group-hover:text-fg">
                Previous
              </span>
            </button>
          ) : (
            <span className="font-sans text-sm text-muted lg:hidden">
              Step {index + 1} of {steps.length}
            </span>
          )}

          {/* The rail carries this where the rail exists. */}
          <Link
            href={`/book/${bookId}`}
            className="ml-auto shrink-0 rounded-sm font-sans text-sm text-muted
                       outline-none transition-colors hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/60 lg:hidden"
          >
            Back to writing
          </Link>
        </header>

        <div
          id="export-scroll"
          className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-8 md:px-12 md:py-10"
        >
          <div className="mx-auto w-full max-w-2xl">
            <h1 className="font-serif text-2xl text-fg md:text-[1.75rem]">
              {step.title}
            </h1>
            <p className="mt-2 font-sans text-sm leading-relaxed text-muted">
              {step.blurb}
            </p>

            <div className="mt-8">
              {step.id === "format" && (
                <FormatStep
                  output={output}
                  // The previews are set with this book's own title and first
                  // chapter rather than a stand-in. It costs nothing and it is
                  // the difference between a picture of a format and a picture
                  // of *your book* in that format. Same body chapter the
                  // specimen uses — these pages carry a chapter number too.
                  book={{
                    title: book.title,
                    chapter: sampleTitle,
                    author: book.author,
                  }}
                  onPick={pick}
                  manuscript={manuscript}
                  onManuscript={setManuscript}
                />
              )}

              {step.id === "template" && (
                <TemplateStep
                  typeset={typeset}
                  onPick={(id) => set("template", id)}
                  sampleTitle={sampleTitle}
                />
              )}

              {step.id === "layout" && (
                <LayoutStep
                  typeset={typeset}
                  output={output}
                  sampleTitle={sampleTitle}
                  onSet={set}
                />
              )}

              {step.id === "frontmatter" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Toggle
                    label="Title page"
                    hint="The book’s title and author"
                    on={typeset.titlePage}
                    onChange={(v) => set("titlePage", v)}
                  />
                  <Toggle
                    label="Copyright page"
                    hint="© this year, in the author’s name"
                    on={typeset.copyright}
                    onChange={(v) => set("copyright", v)}
                  />
                  <Toggle
                    label="Contents"
                    hint="A list of the chapters"
                    on={typeset.contents}
                    onChange={(v) => set("contents", v)}
                  />
                </div>
              )}

              {step.id === "listing" && <ListingDetails book={book} />}
              {step.id === "blurb" && <ListingBlurb book={book} />}

              {/* Only reachable once a format is chosen, which is what builds
                  this step in the first place. */}
              {step.id === "export" && output !== null && (
                <ExportStep
                  book={book}
                  cover={cover}
                  output={output}
                  label={active?.label ?? ""}
                  typeset={typeset}
                  manuscript={manuscript}
                  busy={busy}
                  error={error}
                  narrating={narrating}
                  narrationLabel={narrationLabel}
                  narrationError={narrationError}
                  onRun={run}
                  onNarrate={narrate}
                />
              )}
            </div>

            {/* The step's own action, full width at the end of the form. The
                last step has no Continue because its action *is* the export,
                which ExportStep renders in this same shape — one button per
                screen, always in the same place. */}
            {!last && (
              <div className="mt-9 space-y-4">
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  // The one place in this wizard where a control is genuinely
                  // unavailable: there is no next step until a format is picked,
                  // because which steps exist is what the pick decides.
                  disabled={output === null}
                  className="w-full rounded-lg bg-accent py-3 font-sans text-sm
                             font-semibold text-accent-ink outline-none
                             transition-colors hover:bg-accent-strong
                             focus-visible:ring-2 focus-visible:ring-accent/60
                             disabled:cursor-not-allowed disabled:bg-raised
                             disabled:text-muted"
                >
                  {output === null ? "Choose a format to continue" : "Continue"}
                </button>

                {/* Only where it is true. The listing steps are genuinely
                    optional — the export runs without any of it — so saying so
                    is honest. Offering it on the format step would be a lie,
                    since something has to be chosen. */}
                {(step.id === "listing" || step.id === "blurb") && (
                  <button
                    type="button"
                    onClick={() => go(steps.length - 1)}
                    className="mx-auto block rounded-sm font-sans text-sm
                               font-medium text-accent underline-offset-4
                               outline-none transition-colors
                               hover:text-accent-strong hover:underline
                               focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    Skip — you can add this later
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// The rail
// ---------------------------------------------------------------------------

/**
 * The stepper, and the book it is about.
 *
 * Every step is clickable, including ones ahead: nothing here is required, so
 * refusing to let a writer skip forward would be inventing a gate to guard an
 * empty room. "Done" therefore means *behind you*, not *answered*.
 *
 * The accent throughout rather than the usual green tick. There is no green in
 * this palette to reach for, and the accent is what every other "done" in the
 * app is drawn with, so a second treatment here would be a thing to learn for
 * no gain.
 */
function Rail({
  book,
  bookId,
  cover,
  blocking,
  groups,
  steps,
  currentId,
  currentIndex,
  onGo,
}: {
  book: Book;
  bookId: string;
  /** The stored cover, or null. Passed down so the rail fetches nothing. */
  cover: string | null;
  /** How many listing problems a shop would refuse today. */
  blocking: number;
  groups: { name: string; steps: Step[] }[];
  steps: Step[];
  currentId: StepId;
  currentIndex: number;
  onGo: (id: StepId) => void;
}) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="shrink-0 px-8 pt-7">
        {/* The way back out, first.

            Every other tool screen carries a breadcrumb and an "All tools"
            escape; this one never took the shared header, so a writer who
            opened it from the wall of tools had no way back except the browser
            button. A wizard is the *worst* screen to strand somebody on,
            because the whole shape of it implies there is no exit until the
            end. */}
        <Link
          href="/?area=tools"
          className="font-sans text-xs font-semibold text-muted
                     underline-offset-4 hover:text-fg hover:underline"
        >
          ← All tools
        </Link>

        {/* The book, with its cover.

            The other fourteen tools put this in `ToolHeader` for one reason:
            the Tools area lets a writer pick a book *before* opening a tool, so
            landing on the wrong manuscript is a real way to lose ten minutes —
            and on this screen it is a way to publish the wrong book. A writer
            knows their own covers on sight and has to read a title. */}
        <div className="mt-4 flex items-start gap-3">
          <span className="w-9 shrink-0">
            <BookCover
              title={book.title}
              words={bookWordCount(book)}
              seed={book.id}
              image={cover}
              {...(book.subtitle ? { subtitle: book.subtitle } : {})}
              {...(book.author ? { author: book.author } : {})}
              {...(book.bareCover ? { bare: true } : {})}
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-sans text-sm font-semibold text-fg">
              {book.title}
            </span>
            <span className="mt-0.5 block font-sans text-xs text-muted">
              {book.chapters.length}{" "}
              {book.chapters.length === 1 ? "chapter" : "chapters"} ·{" "}
              {bookWordCount(book).toLocaleString()} words
            </span>
          </span>
        </div>

        {/* Where you are in the road, as a number.

            The rail drew five circles and lit one, which says *which* step but
            not *how far*. "Step 2 of 5" is the thing a person actually wants
            when deciding whether to start something now or after lunch, and it
            costs one line. */}
        {/* Only once the road is known.

            Before a format is chosen `steps` is genuinely one long, and "Step 1
            of 1" reads as *finished* — the exact opposite of the truth, on the
            screen where the writer has not yet answered anything. The honest
            line there is that the length depends on the answer, which is also
            the reason the first question is the first question. */}
        <p className="mt-5 font-sans text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
          {steps.length > 1
            ? `Step ${currentIndex + 1} of ${steps.length}`
            : "Pick a format to see the steps"}
        </p>
      </div>

      {/* Scrolls rather than clips. On a short laptop the steps are taller than
          the rail, and the thing that must never be cut off is the
          navigation. */}
      <nav className="scroll-slim mt-9 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 pb-6">
        {groups.map((group, i) => {
          const indices = group.steps.map((s) => steps.indexOf(s));
          const isCurrent = group.steps.some((s) => s.id === currentId);
          const isDone = Math.max(...indices) < currentIndex;
          const isLast = i === groups.length - 1;

          return (
            <div key={group.name} className="relative">
              {/* The thread through the steps. Absolutely positioned from under
                  this circle into the gap below, so it reaches the next circle
                  whatever height this row grew to — a group showing its
                  sub-steps is twice as tall as one that is not. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`absolute top-7 -bottom-6 left-[11px] w-0.5 rounded-full ${
                    isDone ? "bg-accent" : "bg-line"
                  }`}
                />
              )}

              <button
                type="button"
                onClick={() => onGo(group.steps[0].id)}
                className="relative flex w-full items-center gap-3.5 rounded-sm
                           text-left outline-none focus-visible:ring-2
                           focus-visible:ring-accent/60"
              >
                {/* Filled for both done and current, outlined only for what is
                    still ahead: the circle answers "have I been here", and
                    where you are standing is somewhere you have been. */}
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center
                              rounded-full font-sans text-[11px] font-semibold
                              transition-colors ${
                                isDone || isCurrent
                                  ? "bg-accent text-accent-ink"
                                  : "border border-line bg-panel text-muted"
                              }`}
                >
                  {isDone ? <Check /> : i + 1}
                </span>
                <span
                  className={`font-sans text-sm ${
                    isCurrent
                      ? "font-semibold text-fg"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {group.name}
                </span>
              </button>

              {/* Sub-steps only for the group you are standing in — listing them
                  everywhere would make the rail a table of contents for a book
                  nobody asked to read. */}
              {isCurrent && group.steps.length > 1 && (
                <div className="mt-3 ml-[2.4rem] flex flex-col gap-2.5">
                  {group.steps.map((sub) => {
                    const here = sub.id === currentId;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onGo(sub.id)}
                        className={`flex items-center gap-2 rounded-sm text-left
                                    font-sans text-sm outline-none
                                    transition-colors focus-visible:ring-2
                                    focus-visible:ring-accent/60 ${
                                      here
                                        ? "font-medium text-fg"
                                        : "text-muted hover:text-fg"
                                    }`}
                      >
                        {sub.label}
                        {here && <Arrow className="ml-auto text-muted" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* What a shop would refuse, from step one rather than step five.

          This is the product's whole argument and it was invisible until the
          last screen of the wizard — a writer answered four steps' worth of
          questions before anything told them the book had no author name. The
          count is pure and cheap (`storeReadiness` reads the listing details
          only; `hasCover` tests for a key rather than fetching a data URL), so
          there is no reason to withhold it.

          It never blocks: the sentence under it says the export runs anyway,
          which is the standing promise of this screen — the file is yours
          whether or not a shop would take it. */}
      {blocking > 0 && (
        <button
          type="button"
          onClick={() => onGo("export")}
          className="mx-6 mb-4 shrink-0 rounded-xl border border-stop-line
                     bg-stop-bg px-4 py-3 text-left outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span className="block font-sans text-sm font-semibold text-stop-fg">
            {blocking} {blocking === 1 ? "thing" : "things"} a shop would refuse
          </span>
          <span className="mt-0.5 block font-sans text-xs text-muted">
            The export still runs. Fixing them first saves the upload.
          </span>
        </button>
      )}

      {/* The way out, where the reference puts Log out: bottom of the rail,
          quiet, and never mistakable for a step. */}
      <div className="shrink-0 px-8 pb-8">
        <Link
          href={`/book/${bookId}`}
          className="rounded-sm font-sans text-sm text-muted underline
                     underline-offset-4 outline-none transition-colors
                     hover:text-fg focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          Back to writing
        </Link>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function FormatStep({
  output,
  book,
  onPick,
  manuscript,
  onManuscript,
}: {
  output: Output | null;
  book: PreviewBook;
  onPick: (value: Output) => void;
  manuscript: boolean;
  onManuscript: (on: boolean) => void;
}) {
  // EPUB leads, and the other four sit under it. Not a styling whim: it is the
  // only one of the five a shop will take, and the only one the store-listing
  // steps exist for. A grid of equals would say the choice does not matter,
  // which is the opposite of what this screen knows.
  const featured = FORMATS.find((f) => f.value === "epub")!;
  const rest = FORMATS.filter((f) => f.value !== "epub");

  return (
    <div role="radiogroup" aria-label="Format" className="space-y-3">
      <FormatCard
        format={featured}
        book={book}
        selected={output === featured.value}
        onPick={onPick}
        featured
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {rest.map((f) => (
          <FormatCard
            key={f.value}
            format={f}
            book={book}
            selected={output === f.value}
            onPick={onPick}
          />
        ))}
      </div>

      {output === "pdf" && (
        <Note>
          This opens your browser’s print dialog — choose “Save as PDF”. It sets
          the interior at your trim size. It does not add bleed or crop marks, so
          a printer may ask you for those separately.
        </Note>
      )}

      {output === "audiobook" && (
        <Note>
          Read by a speech model, one chapter at a time, and downloaded as a zip.
          It needs a connection and is billed per minute of audio.
        </Note>
      )}

      {output === "markdown" && (
        <Note>
          Markdown is plain text with no typesetting, so there is nothing to set
          — the next step is the export itself.
        </Note>
      )}

      {output === "docx" && (
        <div className="space-y-3">
          <label className="flex items-start gap-2.5 rounded-lg border border-line bg-panel px-4 py-3.5 font-sans text-sm">
            <input
              type="checkbox"
              checked={manuscript}
              onChange={(e) => onManuscript(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
            />
            <span>
              <span className="font-semibold text-fg">
                Standard manuscript format
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                Double-spaced, 12pt, with a byline block — what submission
                guidelines mean.
              </span>
            </span>
          </label>
          <Note>
            Word carries its own styles, so the template and trim size do not
            apply — your editor will set the book their way.
          </Note>
        </div>
      )}
    </div>
  );
}

/**
 * One format, with a picture of the file it makes.
 *
 * `featured` is the same card given the room to be read first: full width,
 * taller, its name at heading size and a badge saying what it is for. The
 * construction underneath is identical, so the two can never drift apart.
 */
function FormatCard({
  format,
  book,
  selected,
  onPick,
  featured,
}: {
  format: (typeof FORMATS)[number];
  book: PreviewBook;
  selected: boolean;
  onPick: (value: Output) => void;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onPick(format.value)}
      // h-* and overflow-hidden are load-bearing, not styling: they are what
      // crops the preview at the corner. See .oc-tilt-card.
      //
      // flex-col is load-bearing too, for a duller reason: a <button> centres
      // its content vertically, so at a fixed height the title floats into the
      // middle of the card instead of sitting at the top.
      className={`oc-tilt-card relative flex w-full flex-col items-start
                  overflow-hidden rounded-xl border px-4 pt-4
                  text-left outline-none transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    featured ? "h-[250px] sm:px-6 sm:pt-5" : "h-[200px]"
                  } ${
                    selected
                      ? "border-accent bg-accent/8"
                      : // A hairline at --color-line vanishes on white at this
                        // corner radius; the card needs an edge you can find
                        // before you can decide to click it.
                        "border-fg/20 bg-panel hover:border-fg/45"
                  }`}
    >
      {/* Above the preview, which passes under the text on its way out of the
          corner. */}
      <span className="relative z-10 flex items-center gap-2.5">
        <FormatMark
          format={format.value}
          className={featured ? "h-7 w-7" : "h-5 w-5"}
        />
        <span
          className={`font-sans font-semibold text-fg ${
            featured ? "text-xl" : "text-base"
          }`}
        >
          {format.label}
        </span>
        {featured && (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-sans text-[11px] font-semibold tracking-[0.06em] text-accent uppercase">
            Store-ready
          </span>
        )}
      </span>

      <span
        className={`relative z-10 mt-1.5 block font-sans leading-relaxed text-muted ${
          featured ? "max-w-[28rem] text-[0.9375rem]" : "max-w-[92%] text-sm"
        }`}
      >
        {featured
          ? "For e-readers and every ebook shop. The only format here a store will take — and the one the listing steps are for."
          : format.hint}
      </span>

      {/* The chosen one says so in the corner as well as in its border — colour
          alone is not an answer for a reader who cannot see it. */}
      {selected && (
        <span
          aria-hidden="true"
          className="absolute top-3.5 right-3.5 z-10 flex h-5 w-5 items-center
                     justify-center rounded-full bg-accent text-accent-ink"
        >
          <Check />
        </span>
      )}

      <span
        aria-hidden="true"
        className={`oc-tilt absolute h-full w-full overflow-hidden rounded-lg
                    border border-line bg-panel shadow-sm ${
                      // The wider the card, the more a large left offset turns
                      // into dead space under the text rather than a preview
                      // entering from the corner.
                      featured ? "top-[52%] left-[13%]" : "top-[55%] left-[15%]"
                    }`}
      >
        <FormatPreview format={format.value} book={book} wide={featured} />
      </span>
    </button>
  );
}

function TemplateStep({
  typeset,
  onPick,
  sampleTitle,
}: {
  typeset: TypesetOptions;
  onPick: (id: TypesetOptions["template"]) => void;
  sampleTitle: string;
}) {
  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Template" className="grid gap-3 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            typeset={typeset}
            sampleTitle={sampleTitle}
            checked={typeset.template === t.id}
            onClick={() => onPick(t.id)}
          />
        ))}
      </div>

      <Specimen typeset={typeset} sampleTitle={sampleTitle} />
    </div>
  );
}

/**
 * A template, with a page already set in it.
 *
 * The three faces are a comparison, and a comparison you have to click through
 * one at a time is not one — you are remembering the last card rather than
 * seeing it. So each carries its own tilted page, set in its own type, and the
 * three can be read side by side. The big specimen below is still there for
 * judging the chosen one at a readable size; this is for choosing it.
 */
function TemplateCard({
  template,
  typeset,
  sampleTitle,
  checked,
  onClick,
}: {
  template: (typeof TEMPLATES)[number];
  typeset: TypesetOptions;
  sampleTitle: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={`oc-tilt-card relative flex h-[190px] w-full
                  flex-col items-start overflow-hidden rounded-lg border px-3.5
                  pt-3.5 text-left outline-none transition-colors
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    checked
                      ? "border-accent bg-accent/8"
                      : "border-fg/20 bg-panel hover:border-fg/45"
                  }`}
    >
      <span className="relative z-10 block font-sans text-base font-semibold text-fg">
        {template.name}
      </span>
      {/* Named in its own face, so the line under the name is a specimen of the
          thing it names rather than a description of it. */}
      <span
        className="relative z-10 mt-0.5 block text-sm text-muted"
        style={{ fontFamily: template.stack }}
      >
        {template.face}
      </span>

      <span
        aria-hidden="true"
        className="oc-tilt absolute top-[47%] left-[12%] h-full w-full
                   overflow-hidden rounded-md border border-line bg-panel
                   shadow-sm"
      >
        <span
          className="block h-full w-full px-4 pt-3 text-[#ededed]"
          style={{ fontFamily: template.stack }}
        >
          {!typeset.hideChapterNumbers && (
            <span className="block text-center text-[7px] text-[#ededed]/40">
              1
            </span>
          )}
          <span
            className="mt-1 block truncate text-center text-[9px] text-[#ededed]/75"
            style={{
              fontVariant: template.headingCaps ? "small-caps" : "normal",
              letterSpacing: template.headingCaps ? "0.06em" : "0",
            }}
          >
            {sampleTitle}
          </span>
          <span
            className="mt-2 block text-justify text-[6.5px] text-[#ededed]/55"
            style={{ lineHeight: template.leading }}
          >
            {typeset.dropCaps && (
              <span
                style={{
                  float: "left",
                  fontSize: "20px",
                  lineHeight: 0.82,
                  padding: "0.06em 0.08em 0 0",
                }}
              >
                T
              </span>
            )}
            {typeset.dropCaps ? OPENING.slice(1) : OPENING} {SECOND}
          </span>
        </span>
      </span>
    </button>
  );
}

/**
 * The specimen page.
 *
 * Rendered on *both* typesetting steps, not just the one that picks the face.
 * Template, chapter numbers and drop caps are three settings for one outcome, so
 * a step that changes the outcome and shows nothing is a switch with the lamp in
 * the next room — which is what "Page and chapters" was until this was pulled
 * out of TemplateStep.
 */
function Specimen({
  typeset,
  sampleTitle,
}: {
  typeset: TypesetOptions;
  sampleTitle: string;
}) {
  const template = templateById(typeset.template);

  return (
    // Set in the template's own face at its own size, so what is shown is the
    // setting rather than a picture of one.
    <div className="rounded-lg border border-line bg-white p-6">
      <div
        className="mx-auto max-w-sm text-[#ededed]"
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
            fontVariant: template.headingCaps ? "small-caps" : "normal",
            letterSpacing: template.headingCaps ? "0.06em" : "0",
          }}
        >
          {sampleTitle}
        </p>
        <p className="mt-6 text-justify">
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
          She did not look back, and afterwards could never say whether that had
          been courage or the simple want of a reason to.
        </p>
      </div>
    </div>
  );
}

function LayoutStep({
  typeset,
  output,
  sampleTitle,
  onSet,
}: {
  typeset: TypesetOptions;
  // Only ever pdf or epub in practice — this step does not exist otherwise —
  // but typed as the caller has it rather than asserted at the call site.
  output: Output | null;
  sampleTitle: string;
  onSet: <K extends keyof TypesetOptions>(
    key: K,
    value: TypesetOptions[K],
  ) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle
          label="Hide chapter numbers"
          hint="Titles only, with no numeral above them"
          on={typeset.hideChapterNumbers}
          onChange={(v) => onSet("hideChapterNumbers", v)}
        />
        <Toggle
          label="Drop caps"
          hint="A raised initial opening each chapter"
          on={typeset.dropCaps}
          onChange={(v) => onSet("dropCaps", v)}
        />
      </div>

      {/* Both toggles above change this and nothing else on the screen. Without
          it they are switches with the lamp in the next room. */}
      <Specimen typeset={typeset} sampleTitle={sampleTitle} />

      <label className="block">
        <span className="block font-sans text-xs font-medium text-fg">
          Trim size
        </span>
        <select
          value={typeset.trim}
          onChange={(e) => onSet("trim", e.target.value)}
          disabled={output === "epub"}
          className="mt-1.5 w-full rounded-md border border-line bg-panel px-3
                     py-2.5 font-sans text-sm text-fg outline-none
                     focus-visible:border-accent focus-visible:ring-2
                     focus-visible:ring-accent/20 disabled:opacity-50"
        >
          {TRIMS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block font-sans text-xs text-muted">
          {output === "epub"
            ? "An e-reader chooses its own page, so EPUB ignores this."
            : "The finished page size, before binding."}
        </span>
      </label>

      {output === "pdf" && (
        <Note>
          The PDF is made by your browser’s print, so two of its settings finish
          the page. Turn off “Headers and footers” to drop the date and page
          counter it prints around the edge, and set Paper size to match your
          trim — otherwise a small book page is centred on a big sheet.
        </Note>
      )}
    </div>
  );
}

function ExportStep({
  book,
  cover,
  output,
  label,
  typeset,
  manuscript,
  busy,
  error,
  narrating,
  narrationLabel,
  narrationError,
  onRun,
  onNarrate,
}: {
  book: Book;
  cover: string | null;
  output: Output;
  label: string;
  typeset: TypesetOptions;
  manuscript: boolean;
  busy: boolean;
  error: string | null;
  narrating: boolean;
  narrationLabel: string;
  narrationError: string | null;
  onRun: () => void;
  onNarrate: () => void;
}) {
  // What the file will contain, said back in one place. A writer who clicked
  // through four screens should not have to click back to check what they set.
  const summary: [string, string][] = [
    ["Format", label],
    [
      "Chapters",
      `${book.chapters.length} ${book.chapters.length === 1 ? "chapter" : "chapters"}`,
    ],
  ];
  if (isTypeset(output)) {
    summary.push(["Template", templateById(typeset.template).name]);
    if (output === "pdf") summary.push(["Trim", trimById(typeset.trim).label]);
    const front = [
      typeset.titlePage && "title page",
      typeset.copyright && "copyright",
      typeset.contents && "contents",
    ].filter(Boolean) as string[];
    summary.push(["Front matter", front.length ? front.join(", ") : "none"]);
  }
  if (output === "docx") {
    summary.push(["Layout", manuscript ? "Standard manuscript" : "Clean document"]);
  }

  return (
    <div className="space-y-5">
      <dl className="divide-y divide-line rounded-lg border border-line bg-panel">
        {summary.map(([term, value]) => (
          <div key={term} className="flex items-baseline gap-4 px-4 py-3">
            <dt className="font-sans text-xs tracking-wide text-muted uppercase">
              {term}
            </dt>
            <dd className="ml-auto text-right font-sans text-sm text-fg">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* The honest half of "publish": what a shop would say about this file,
          said here instead — before the upload rather than after it. */}
      {output === "epub" && <StoreReadiness book={book} cover={cover} />}

      {output === "audiobook" ? (
        <>
          {narrating && (
            <p className="font-sans text-sm text-muted">{narrationLabel}</p>
          )}
          {narrationError && (
            <p role="alert" className="font-sans text-sm text-danger">
              {narrationError}
            </p>
          )}
          <button
            type="button"
            onClick={onNarrate}
            disabled={narrating}
            className="flex w-full items-center justify-center gap-2 rounded-md
                       bg-accent py-3 font-sans text-sm font-semibold text-accent-ink
                       outline-none transition-colors hover:bg-accent-strong
                       focus-visible:ring-2 focus-visible:ring-accent/60
                       disabled:opacity-50"
          >
            {narrating ? "Reading…" : "Read aloud"}
            {!narrating && <Arrow />}
          </button>
        </>
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2.5 font-sans text-sm text-fg"
            >
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onRun}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md
                       bg-accent py-3 font-sans text-sm font-semibold text-accent-ink
                       outline-none transition-colors hover:bg-accent-strong
                       focus-visible:ring-2 focus-visible:ring-accent/60
                       disabled:opacity-50"
          >
            {busy ? "Working…" : `Export ${label}`}
            {!busy && <Arrow />}
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * One choosable card — a template, a switch, anything the writer picks.
 *
 * The format cards are the loud version of this and the only reason they are
 * their own component is the tilted preview inside them. Everything else that
 * gets chosen on this screen is this: same border, same radius, same weight,
 * same pointer. Two near-identical card styles in one wizard is two things to
 * keep in step, and they would not stay in step.
 */
function OptionCard({
  role,
  checked,
  onClick,
  label,
  hint,
  hintStyle,
}: {
  role: "radio" | "switch";
  checked: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  /** The template picker sets its own face here, so the name is its specimen. */
  hintStyle?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      onClick={onClick}
      className={`rounded-lg border px-3.5 py-3 text-left
                  outline-none transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    checked
                      ? "border-accent bg-accent/8"
                      : "border-fg/20 bg-panel hover:border-fg/45 hover:bg-raised"
                  }`}
    >
      <span className="block font-sans text-base font-semibold text-fg">
        {label}
      </span>
      <span
        className="mt-0.5 block font-sans text-sm leading-relaxed text-muted"
        style={hintStyle}
      >
        {hint}
      </span>
    </button>
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
    <OptionCard
      role="switch"
      checked={on}
      onClick={() => onChange(!on)}
      label={label}
      hint={hint}
    />
  );
}

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${className}`}
    >
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <path d="M4.5 10.5l3.5 3.5 7-7.5" />
    </svg>
  );
}
