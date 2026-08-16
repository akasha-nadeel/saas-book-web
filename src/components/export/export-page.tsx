"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FormatMark,
  FormatPreview,
  FOURTH,
  OPENING,
  SECOND,
  THIRD,
  type PreviewBook,
} from "@/components/export/format-previews";
import {
  ListingBlurb,
  ListingDetails,
  Note,
  StoreReadiness,
} from "@/components/export/publishing-card";
import {
  ExportDoneDialog,
  type ExportDone,
} from "@/components/export/export-done";
import {
  loadChapters,
  runExport,
  skippedMatterPages,
  slugify,
  type Format,
} from "@/lib/export";
import { Spinner } from "@/components/ui/spinner";
import { ReviewPane } from "@/components/export/review-pane";
import { ToolStepDone } from "@/components/ui/tool-save";
import { useToolSave } from "@/lib/use-tool-save";
import { writtenPages } from "@/lib/export/front-matter";
import {
  DEFAULT_TYPESET,
  TEMPLATES,
  TRIMS,
  templateById,
  trimById,
  trimMargins,
  type TypesetOptions,
} from "@/lib/export/typeset";
import { chapterMatterOf, findBook, type Book } from "@/lib/library-store";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";
import { storeReadiness } from "@/lib/publishing";
import { type ToolPageProps } from "@/lib/tool-page";
import { areaLabel } from "@/lib/areas";

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

interface FormatOption {
  value: Format;
  label: string;
  hint: string;
  /** What the reader gets, in the words a file manager would use. */
  produces: string;
}

/**
 * The four ways out.
 *
 * **There were five, and the audiobook was taken off on 2026-08-14.** It is
 * coming back — the machinery is untouched and still tested (`/api/narrate`,
 * `export/narrate.ts`, `export/audiobook.ts`, and its own preview in
 * `format-previews.tsx`), it is simply not offered while the rest of the
 * publishing side settles. Putting it back is this row and the branches that
 * went with it; see TODO.md under "Taken out on purpose" for the list.
 *
 * EPUB leads because it is the only one of the four a shop will take, and the
 * only one the store-listing steps exist for.
 */
const FORMATS: FormatOption[] = [
  {
    value: "epub",
    label: "EPUB",
    hint: "For e-readers and every ebook shop — the only one a store will take",
    produces: "One .epub file",
  },
  {
    value: "pdf",
    label: "PDF",
    hint: "Typeset to your trim size, through your browser’s print dialog",
    produces: "Your browser’s print dialog — choose “Save as PDF”",
  },
  {
    value: "docx",
    label: "Word",
    hint: "What agents and editors ask for",
    produces: "One .docx file",
  },
  {
    value: "markdown",
    label: "Markdown",
    hint: "Plain text that reads anywhere",
    produces: "One .md file",
  },
];

/** The two whose look is ours, and therefore the two with a Formatting step. */
const isTypeset = (output: Format | null) =>
  output === "pdf" || output === "epub";

type StepId =
  | "format"
  | "template"
  | "layout"
  | "frontmatter"
  | "listing"
  | "blurb"
  | "review"
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
function stepsFor(output: Format | null): Step[] {
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
        title:
          output === "epub"
            ? "How a chapter opens"
            : "The page and the chapters",
        blurb:
          // An e-reader picks its own page, so there is no page size to set —
          // and a deck promising one on a step that cannot offer it is the
          // dead promise this app refuses in words as well as in controls.
          output === "epub"
            ? "The opening of every chapter, and how the type sits under it."
            : "How a chapter opens, and how big the page it opens on is.",
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

  /* **The book itself, before the file exists.**
​
     Every format gets this, and it is a step rather than a panel on the export
     screen because it is a different question: everything before it asks *how*
     the book should be made, and this one asks whether it came out right. It
     shows the real artifact rather than a description of one — see
     `ReviewPane`.

     Deliberately not a gate. Continue is live whether or not the writer scrolls
     it, which is what KDP and Reedsy do: they put the preview in front of you
     and let you walk past. A primary button disabled until somebody has
     scrolled is the dead control the house rules argue against, and it would
     punish the writer exporting their tenth draft hardest. */
  steps.push({
    id: "review",
    group: "Review",
    title: "Read it before you send it",
    blurb: "The book as the file will have it — not a picture of one.",
  });

  steps.push({
    id: "export",
    group: "Export",
    title: "Take it out of here",
    blurb: "Everything is set. Here is what you are about to get.",
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
  const params = useSearchParams();
  const initial = params.get("step");
  const deepLink =
    initial && STEP_DEEP_LINKS.has(initial as StepId)
      ? (initial as StepId)
      : null;
  /** Which dashboard area sent the writer here, for the rail's way back. */
  const from = params.get("from");

  const [output, setOutput] = useState<Format | null>(deepLink ? "epub" : null);
  const [stepId, setStepId] = useState<StepId>(deepLink ?? "format");
  const [manuscript, setManuscript] = useState(true);
  const [typeset, setTypeset] = useState<TypesetOptions>(DEFAULT_TYPESET);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * The file that just left, or null.
   *
   * Set by the press that produced it and by nothing else — an effect watching
   * for a finished export would fire again on a remount, which is a success
   * dialog about something the writer did yesterday. See `ExportDoneDialog`.
   * Null for a PDF, which `runExport` answers with because the print dialog's
   * outcome is the browser's and not ours to state.
   */
  const [done, setDone] = useState<ExportDone | null>(null);

  const steps = useMemo(() => stepsFor(output), [output]);

  /**
   * Which matter pages this export would leave out.
   *
   * Reads every front- and back-matter body, so it is memoised rather than run
   * per render — the same reasoning that keeps prose out of the shelf. Resolved
   * from the shelf inside the memo because every hook has to sit above the
   * early returns below, and `book` is found after them.
   */
  const skipped = useMemo(() => {
    const b = findBook(shelf, bookId);
    return b ? skippedMatterPages(b) : [];
  }, [shelf, bookId]);

  /**
   * Which of the three generated pages the writer has already written.
   *
   * The switch above each one stays on and the *written* page wins — see
   * `writtenPages`. That is the right outcome and the wrong thing to leave
   * unsaid: a switch that is on and produces nothing is the dead UI this app
   * refuses, and the writer would only find out by counting pages in the
   * finished file. So the hint changes to say which page is being used.
   */
  const written = useMemo(() => {
    const b = findBook(shelf, bookId);
    return b ? writtenPages(loadChapters(b)) : new Set<string>();
  }, [shelf, bookId]);

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

  /*
   * Two road steps end here — "Run the pre-upload check" and "Export the
   * files" — and neither can be detected. Nothing in the library records that
   * a writer read the readiness list, and a file that has been downloaded is
   * gone from this app the moment the browser takes it.
   *
   * No draft: every field on this flow writes as it is filled, and the export
   * itself is already the biggest button on the screen. This press is only
   * the road.
   */
  const save = useToolSave({ book: findBook(shelf, bookId), tool: "export" });

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

  /* **Which steps put a page beside their controls.** These two are the ones
     whose every control lands on the sheet, and they are also the only ones
     the sheet can honestly illustrate: a format card is a picture of its own,
     and the front-matter step draws the pages it makes. Named here rather
     than asked inside the two components because the layout above it — one
     column or two — is a decision about the whole screen. */
  const showSheet = step.id === "template" || step.id === "layout";

  const go = (next: number) => {
    setStepId(steps[Math.min(steps.length - 1, Math.max(0, next))].id);
    // A step change is a new screen; the old one's scroll position is not it.
    document.getElementById("export-scroll")?.scrollTo({ top: 0 });
  };

  const pick = (value: Format) => {
    setOutput(value);
    setError(null);
    // Standing on "format" already, so the step id stays valid whatever the new
    // format's road looks like.
    setStepId("format");
  };

  const run = async () => {
    if (output === null) return;
    setBusy(true);
    setError(null);
    try {
      const file = await runExport({
        book,
        format: output,
        manuscript,
        typeset,
      });
      // Null is the PDF, which went to the browser's print dialog rather than
      // to a file we made.
      if (file) setDone({ format: output, ...file });
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
    // The shell owns the height and does not scroll; the content column does.
    // <body> is overflow-hidden, so a scrolling region has to be declared.
    //
    // **The rail is the chrome and the content is the desk**, which is the way
    // round the rest of the app already works — the shelf's sidebar is `nav`
    // and the page beside it is `surface`. It was the other way here, white
    // content on a tinted rail, and the cost only showed once the steps became
    // cards: a white card on a white column is a card you cannot see, so every
    // panel on every step was a hairline drawing a rectangle around nothing. On
    // the desk the same card is an object with an edge, in both themes and by
    // the palette's own elevation logic rather than by adding a shadow.
    //
    // The export screen does not take the `toolShell` helper: it is a wizard
    // with a band of its own rather than a page with a heading. Only the
    // height claim changes.
    <main
      className={`flex ${embedded ? "h-full" : "h-dvh"} flex-col overflow-hidden bg-surface`}
    >
      {/* **The rail is gone and this band replaces it.**

          It was an 18rem column down the left carrying the step list, the
          book, the readiness count and the two escapes — and it cost the
          width that the thing being set up needs. These steps *set a page*,
          and the page they set is four hundred pixels wide: with a rail taking
          18rem, the sheet had nowhere to go but underneath the controls, so a
          writer flipping a switch scrolled to see what it did. Laid along the
          top instead, the same information takes a band and hands back a
          column, and the controls and the preview sit side by side where a
          switch and its lamp belong.

          It renders in the panel too, unlike the rail, which was hidden there
          for the reason a sidebar inside a sidebar is: a band is not competing
          for the panel's width, and it scrolls sideways where it has to. What
          it drops there is only the chrome the panel already provides. */}
      {/* **Everything scrolls except the action bar.**

          The band used to be pinned above the scroller, so the window was
          three fixed strips with a small scrolling middle — on a laptop the
          steps that carry a sheet had about half the height to move in. The
          band is *context*: once a writer is working down a step they have
          read it, and holding it on screen spends height on something already
          answered. So it scrolls with the page and the whole window becomes
          the scroll area.

          The action bar stays pinned, and it is the one thing that should be:
          it is where both directions live, and a wizard's next step is the one
          control that must never have to be hunted for. `min-h-0` on the
          scroller is what lets it shrink below its content — a flex item
          defaults to `min-height: auto`, which is what pushed the bar off the
          bottom of the window when this box first became a column item. */}
      <div
        id="export-scroll"
        className="scroll-slim min-h-0 min-w-0 flex-1 overflow-y-auto"
      >
        <TopBar
          blocking={blocking}
          groups={groups}
          currentId={step.id}
          currentIndex={index}
          steps={steps}
          onGo={(id) => go(steps.findIndex((s) => s.id === id))}
          from={from}
          embedded={Boolean(embedded)}
        />

        {/* The step name belongs to the whole export flow rather than to the
            question below it, so it sits between the band and the body. */}
        {heading && <div className="px-5 pt-5 md:px-12 md:pt-4">{heading}</div>}

        {/* The body's own padding. It is here rather than on the scroller so
            the band above can run full-bleed to the window's edges — its
            warning strip is a full-width bar and would otherwise be inset by
            the body's margin. */}
        <div className="px-5 py-8 md:px-12 md:py-10">
          {/* **Two columns on the steps that set a page, one on the rest.**

              `showSheet` is the whole condition, and it is what the band above
              was widened to pay for: the template and the page-and-chapters
              steps are a handful of controls whose entire result is the sheet
              beside them. Stacked, every switch was a switch with the lamp in
              the next room — the preview sat below a four-hundred-pixel fold,
              so seeing what "Drop caps" did meant scrolling away from the
              control that set it.

              The other steps get the measure they always had. A column of
              format cards or front-matter switches has nothing to sit beside,
              and a two-column grid with an empty right half is a page with a
              hole in it. */}
          <div
            className={
              showSheet
                ? /* 28rem, and the number is measured rather than picked. The
                     sheet renders at its trim's natural 72px to the inch and
                     caps there — 432px for a 6in page — and its figure spends
                     2rem on padding, so a 28rem column hands it 416px and the
                     preview sits within a few per cent of true size. Narrower
                     and the whole setting scales down, which is honest but
                     shows a typeface at a size nobody can judge. `items-start`
                     is load-bearing for the sticky column: a stretched grid
                     item is already full height, so sticky never engages. */
                  "mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start lg:gap-10"
                : "mx-auto w-full max-w-2xl"
            }
          >
            <div className="min-w-0">
              <h1 className="font-serif text-2xl text-fg md:text-[1.75rem]">
                {step.title}
              </h1>
              {/* The same lift the shared `ToolHeader` took, so the one tool
                that never adopted that header does not read as a quieter
                product. Not `text-muted`, which this app spends on metadata:
                on a wizard step this line is the only thing saying what the
                step is for. The serif heading above is left alone — at 28px it
                is already a size up, and it is a deliberately different type
                treatment rather than a smaller version of the others. */}
              <p className="mt-2 font-sans text-base leading-relaxed font-medium text-fg/75">
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
                  />
                )}

                {step.id === "layout" && (
                  <LayoutStep typeset={typeset} output={output} onSet={set} />
                )}

                {step.id === "frontmatter" && (
                  <FrontMatterStep
                    book={book}
                    typeset={typeset}
                    written={written}
                    skipped={skipped}
                    onSet={set}
                  />
                )}

                {step.id === "listing" && <ListingDetails book={book} />}
                {step.id === "blurb" && <ListingBlurb book={book} />}

                {/* Same guard as the export step below: this step only exists
                    once a format has been chosen. */}
                {step.id === "review" && output !== null && (
                  <ReviewPane
                    book={book}
                    output={output}
                    typeset={typeset}
                    manuscript={manuscript}
                  />
                )}

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
                    skipped={skipped.length}
                    written={written}
                  />
                )}
              </div>
            </div>

            {/* **The page these steps set, beside the controls that set it.**

                Lifted out of `TemplateStep` and `LayoutStep`, which each drew
                their own: rendered here it is one sheet for both steps, so
                walking from the template to the page settings leaves the
                preview standing where it is instead of unmounting and
                remounting a near-identical copy one row further down.

                Sticky, so it stays put while the controls scroll. `top-0`
                against this scroll container rather than the window — the
                body is the scrolling element here, not `<main>`. */}
            {showSheet && (
              <aside className="min-w-0 lg:sticky lg:top-0">
                <Sheet
                  typeset={typeset}
                  output={output}
                  sampleTitle={sampleTitle}
                  bookTitle={book.title}
                />
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* **The action bar, and it stands still.**

            Continue used to sit at the end of the form, which is fine on a
            step that is four fields long and wrong on the two that carry a
            page of typesetting: the sheet is four hundred pixels tall, so the
            only control that moves the writer on was below the fold on an
            ordinary laptop, on a screen whose entire job is to be walked
            through. A wizard's next step is the one control that must never
            have to be hunted for.

            So it is pinned to the foot of the window, both directions in one
            place, and it is the same bar on every step including the last —
            where the primary is the export itself rather than a Continue. That
            is what "one button per screen, always in the same place" was
            reaching for; the form's own end is not a place, because it moves
            with the form. */}
      {/* `bg-surface`, matching the band above — see the note there. */}
      <footer className="shrink-0 border-t border-line bg-surface px-5 py-4 md:px-12">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          {/* **The roadmap's tick, moved down here from the band.** It was
                top right, opposite nothing, on a band that is now only
                context — and it is an *action*, which is what this row is
                for. It is not a step of the wizard, so it sits with Back
                rather than near the primary: nothing about it moves the
                writer through the flow. */}
          <ToolStepDone state={save} />

          {/* Absent on the first step rather than disabled — there is
                nothing behind it. */}
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="flex items-center gap-2 rounded-lg border border-line
                           bg-panel px-4 py-2.5 font-sans text-sm font-medium
                           text-fg outline-none transition-colors
                           hover:bg-raised focus-visible:ring-2
                           focus-visible:ring-accent/60"
            >
              <Arrow className="rotate-180" />
              Back
            </button>
          )}

          {/* Only where it is true. The listing steps are genuinely optional
                — the export runs without any of it — so saying so is honest.
                Offering it on the format step would be a lie, since something
                has to be chosen. */}
          {(step.id === "listing" || step.id === "blurb") && (
            <button
              type="button"
              onClick={() => go(steps.length - 1)}
              className="rounded-sm px-1 font-sans text-sm font-medium
                           text-muted underline-offset-4 outline-none
                           transition-colors hover:text-fg hover:underline
                           focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Skip for now
            </button>
          )}

          {last ? (
            <PrimaryAction
              busy={busy}
              label={`Export ${active?.label ?? ""}`}
              onClick={run}
            />
          ) : (
            <PrimaryAction
              // The one place in this wizard where a control is genuinely
              // unavailable: there is no next step until a format is picked,
              // because which steps exist is what the pick decides.
              disabled={output === null}
              label={output === null ? "Choose a format" : "Continue"}
              onClick={() => go(index + 1)}
            />
          )}
        </div>
      </footer>

      {/* The one thing this screen does that leaves no trace on it. A `<dialog>`
          opened with `showModal` sits in the browser's top layer, so it clears
          the roadmap's sheet and this flow's own rail without a z-index to keep
          in step with either. */}
      {done && (
        <ExportDoneDialog
          done={done}
          book={book}
          save={save}
          blocking={blocking}
          onClose={() => setDone(null)}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// The step band
// ---------------------------------------------------------------------------

/**
 * Where you are in the export, laid along the top.
 *
 * **This is the `/book/new` band, and that is the point.** Both screens are
 * short wizards a writer walks once per book, and until now they were two
 * different products to look at: this one had an 18rem rail down the left
 * carrying the steps, the book, the readiness count and two escapes, while the
 * setup flow had a centred title with a row of numbered steps under it and one
 * red Cancel in the corner. Same shape of task, same app, two vocabularies.
 * So this takes that one — centred stack, numbered row, red Cancel — and the
 * writer learns the pattern once.
 *
 * What the rail carried and this does not:
 *
 * - **The book, as a box.** The safeguard it existed for is real — the Tools
 *   area lets a writer pick a book *before* opening a tool, and on this screen
 *   landing on the wrong manuscript is a way to publish the wrong book — so it
 *   is not simply dropped. It is the line under the heading now, which answers
 *   the same question in a quarter of the height and does not compete with the
 *   steps for the top of the screen.
 * - **"All tools" and "Back to writing".** One red Cancel replaces both, for
 *   the reason `/book/new` has one: two quiet escapes at opposite ends of a
 *   band read as chrome, and a wizard needs exactly one obvious way out. It
 *   goes where the writer came from (`?from=`), falling back to the tools
 *   wall.
 * - **"Mark step done".** Moved to the action bar at the foot, beside Back and
 *   the primary. It is an action on the roadmap rather than a piece of context,
 *   and this band is now only context.
 *
 * Every step is clickable, including ones ahead: nothing here is required, so
 * refusing to let a writer skip forward would be inventing a gate to guard an
 * empty room. "Done" therefore means *behind you*, not *answered*.
 *
 * The accent throughout rather than a green tick. There is no green in this
 * palette to reach for, and the accent is what every other "done" in the app is
 * drawn with, so a second treatment here would be a thing to learn for no gain.
 */
/* No `book` prop any more — the line naming it came off with the step count,
   and nothing else here reads the manuscript. */
function TopBar({
  blocking,
  groups,
  steps,
  currentId,
  currentIndex,
  onGo,
  from,
  embedded,
}: {
  /** The dashboard area this was opened from, if the link said so. */
  from: string | null;
  /** How many listing problems a shop would refuse today. */
  blocking: number;
  groups: { name: string; steps: Step[] }[];
  steps: Step[];
  currentId: StepId;
  currentIndex: number;
  onGo: (id: StepId) => void;
  /** In the roadmap's panel, where the frame supplies its own chrome. */
  embedded: boolean;
}) {
  const group = groups.find((g) => g.steps.some((s) => s.id === currentId));

  return (
    /* **One ground for the whole screen, not three.** The band and the action
       bar were `bg-nav` — which is `#ffffff` by day against a `#f4f4f5`
       body — so the wizard read as a white strip, a grey middle and a white
       strip, and the cards in the middle were the same white as the chrome
       above them. `/book/new` puts everything on `surface` and lets the cards
       be the only white, which is the app's own elevation logic; this now
       does the same. The hairlines stay: the middle scrolls between two fixed
       bands, and without an edge the content slides under them with nothing
       marking where the page stops. */
    <header className="shrink-0 border-b border-line bg-surface">
      {/* `pt-14` below `sm` is the room the absolute Cancel needs, the same
          arithmetic `/book/new` uses: the stack is centred and the button is
          out of the flow, so on a phone the two would otherwise share a line.
          Padding rather than a margin on the heading, which would collapse
          through this box and take the button with it. */}
      <div
        className={`relative px-5 pb-4 md:px-12 ${
          embedded ? "pt-5" : "pt-14 sm:pt-5"
        }`}
      >
        {/* The one way out, in the corner, in red — `/book/new`'s control and
            its reasoning: this is the only thing on the screen that abandons
            what the writer is doing, so it should not look like the greys
            around it, and the `stop` tint carries its own ink in both themes
            where a solid red slab would read as *confirm a deletion*.

            Absent in the panel, which has a Close of its own two rows up. */}
        {!embedded && (
          <Link
            href={areaLabel(from) ? `/?area=${from}` : "/?area=tools"}
            className="absolute top-5 right-5 z-10 rounded-md border border-stop-line
                       bg-stop-bg px-4 py-2 font-sans text-sm font-medium text-stop-fg
                       outline-none transition-colors hover:border-stop-fg
                       focus-visible:ring-2 focus-visible:ring-stop-fg/60 md:right-12"
          >
            Cancel
          </Link>
        )}

        <h1 className="text-center font-serif text-2xl text-fg md:text-[1.75rem]">
          Export your book
        </h1>

        {/* **The book line and the "Step 3 of 7" line were both here.**

            The book — title, chapter count, word count — was what survived of
            the rail's cover-and-title box, and the count line was the rail's
            own. Both came off at the owner's request, and what they were doing
            is worth recording rather than re-deriving:

            The count line answered *how far*, which five circles in a column
            could not. That argument is much weaker now the stepper is a row —
            every step is on screen at once, numbered, with the current one
            filled — so the row answers it by being looked at.

            The book line answered *which manuscript*, and nothing on this
            screen answers it now. The Tools area lets a writer pick a book
            before opening a tool, so arriving on the wrong one is possible;
            the cost is a wrong export rather than lost work, and the file
            names itself after the book. If it needs saying again, the heading
            is where it goes — not a third line under it. */}

        {/* Scrolls sideways rather than wrapping. Five groups with their names
            do not fit a phone or the roadmap's panel, and a stepper that wraps
            to two lines stops reading as one line of travel. `justify-center`
            with `w-max mx-auto` inside, so it centres when it fits and scrolls
            from the left when it does not — a centred flex row that overflows
            clips its first item unreachably. */}
        <nav className="scroll-none mt-2.5 overflow-x-auto">
          <div className="mx-auto flex w-max items-center gap-1">
            {groups.map((g, i) => {
              const indices = g.steps.map((s) => steps.indexOf(s));
              const isCurrent = g.steps.some((s) => s.id === currentId);
              const isDone = Math.max(...indices) < currentIndex;

              return (
                <div key={g.name} className="flex shrink-0 items-center gap-1">
                  {/* The thread between the circles, taking the accent only
                      where it is behind you. */}
                  {i > 0 && (
                    <span
                      aria-hidden="true"
                      className={`h-px w-5 md:w-8 ${
                        isDone || isCurrent ? "bg-accent" : "bg-line"
                      }`}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => onGo(g.steps[0].id)}
                    aria-current={isCurrent ? "step" : undefined}
                    className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1
                               outline-none transition-colors hover:bg-raised
                               focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    {/* Filled for where you are, outlined for everywhere else.
                        A step behind you keeps the accent on its edge, so the
                        row reads as a line you have walked part of. */}
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center
                                  rounded-full font-sans text-[11px] font-semibold
                                  transition-colors ${
                                    isCurrent
                                      ? "bg-accent text-accent-ink"
                                      : isDone
                                        ? "border border-accent text-fg"
                                        : "border border-line bg-panel text-muted"
                                  }`}
                    >
                      {isDone ? <Check /> : i + 1}
                    </span>
                    {/* The name of the step you are *on* survives at every
                        width; the others are the first thing to go, since
                        their circles still number them. */}
                    <span
                      className={`font-sans text-sm whitespace-nowrap ${
                        isCurrent
                          ? "font-medium text-fg"
                          : "hidden text-muted md:block"
                      }`}
                    >
                      {g.name}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Sub-steps only for the group you are standing in — listing them all
            would make this a table of contents for a book nobody asked to
            read. A centred row of pills, since they now hang under a
            horizontal stepper and the rail's indent points at nothing here. */}
        {group && group.steps.length > 1 && (
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
            {group.steps.map((sub) => {
              const here = sub.id === currentId;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onGo(sub.id)}
                  aria-current={here ? "step" : undefined}
                  className={`rounded-md border px-2.5 py-1 font-sans text-xs
                              outline-none transition-colors focus-visible:ring-2
                              focus-visible:ring-accent/60 ${
                                here
                                  ? "border-accent bg-accent/10 font-semibold text-fg"
                                  : "border-line bg-panel text-muted hover:bg-raised hover:text-fg"
                              }`}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* **What a shop would refuse, from step one rather than step five.**

          This is the product's whole argument and it was invisible until the
          last screen of the wizard — a writer answered four steps' worth of
          questions before anything told them the book had no author name. The
          count is pure and cheap (`storeReadiness` reads the listing details
          only; `hasCover` tests for a key rather than fetching a data URL), so
          there is no reason to withhold it.

          A full-width strip rather than the rail's card, which is the shape
          that matches a horizontal band. It keeps the `stop` tint it always
          had and it still never blocks — the second sentence says the export
          runs anyway, which is the standing promise of this screen: the file
          is yours whether or not a shop would take it. */}
      {blocking > 0 && (
        <button
          type="button"
          onClick={() => onGo("export")}
          className="flex w-full items-center gap-3 border-t border-stop-line
                     bg-stop-bg px-5 py-2.5 text-left outline-none
                     transition-colors hover:bg-stop-bg/70
                     focus-visible:ring-2 focus-visible:ring-inset
                     focus-visible:ring-accent/60 md:px-12"
        >
          <span className="font-sans text-sm font-semibold text-stop-fg">
            {blocking} {blocking === 1 ? "thing" : "things"} a shop would refuse
          </span>
          <span className="hidden font-sans text-xs text-muted sm:block">
            The export still runs. Fixing them first saves the upload.
          </span>
          <Arrow className="ml-auto shrink-0 text-stop-fg" />
        </button>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

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
  output: Format | null;
  book: PreviewBook;
  onPick: (value: Format) => void;
  manuscript: boolean;
  onManuscript: (on: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {/* **Four cards of one size.** EPUB led at full width and half again as
          tall for a while, on the argument that it is the only one a shop will
          take — and it made the choice look like an advertisement rather than
          a choice, with the three real alternatives filed underneath as an
          afterthought. The claim it was shouting is now a badge on an equal
          card, which is where a fact belongs; being first in the grid is
          emphasis enough. */}
      <div
        role="radiogroup"
        aria-label="Format"
        className="grid gap-3 sm:grid-cols-2"
      >
        {FORMATS.map((f) => (
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
          the interior at your trim size. It does not add bleed or crop marks,
          so a printer may ask you for those separately.
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
          {/* A switch rather than the bare checkbox this was: every other
              yes-or-no on this flow is a row in a settings card, and one
              checkbox in a bordered label was the only control here that had to
              be learned separately. */}
          <SettingsCard>
            <SwitchRow
              label="Standard manuscript format"
              hint="Double-spaced, 12pt, with a byline block — what submission guidelines mean."
              on={manuscript}
              onChange={onManuscript}
            />
          </SettingsCard>
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
 * **The preview is paper now.** It was drawn on `panel`, which is white in
 * daylight, under text that was also near-white — so the whole picture was a
 * blank rectangle for anybody not on a dark machine, on the one card that
 * exists to show what the file looks like. See `format-previews.tsx`.
 */
function FormatCard({
  format,
  book,
  selected,
  onPick,
}: {
  format: FormatOption;
  book: PreviewBook;
  selected: boolean;
  onPick: (value: Format) => void;
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
      className={`oc-tilt-card relative flex h-[204px] w-full flex-col
                  items-start overflow-hidden rounded-xl border bg-panel px-4
                  pt-4 text-left outline-none
                  transition-[border-color,box-shadow] focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    selected
                      ? // A ring on top of the border rather than a tint behind
                        // the sheet: the card's ground is what the paper is read
                        // against, and washing it in the accent makes the one
                        // chosen preview the one hardest to look at.
                        "border-accent ring-1 ring-accent"
                      : "border-line hover:border-fg/35"
                  }`}
    >
      {/* Above the preview, which passes under the text on its way out of the
          corner. */}
      <span className="relative z-10 flex w-full items-center gap-2.5 pr-7">
        <FormatMark
          format={format.value}
          className={`h-[18px] w-[18px] ${
            selected ? "text-accent" : "text-fg/55"
          }`}
        />
        <span className="font-sans text-base font-semibold text-fg">
          {format.label}
        </span>
        {/* The one fact that separates these four, said where a fact goes.
            EPUB used to make this argument by being twice the size of
            everything else on the step. */}
        {format.value === "epub" && (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-sans text-[10px] font-semibold tracking-[0.06em] text-accent uppercase">
            Store-ready
          </span>
        )}
      </span>

      <span className="relative z-10 mt-1.5 block max-w-[92%] font-sans text-sm leading-relaxed text-muted">
        {format.hint}
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
        className="oc-tilt absolute top-[55%] left-[15%] h-full w-full
                   overflow-hidden rounded-lg border border-sheet-edge bg-sheet
                   shadow-[0_1px_2px_rgba(0,0,0,0.06),0_10px_24px_-14px_rgba(0,0,0,0.4)]"
      >
        <FormatPreview format={format.value} book={book} />
      </span>
    </button>
  );
}

/**
 * The three faces, as three faces.
 *
 * **They were three cards holding three miniature pages**, on the argument that
 * a comparison you have to click through one at a time is not one. That was
 * right about the comparison and wrong about the specimen: a page shrunk into a
 * third of a 42rem column sets its body at six pixels, which is a grey texture
 * rather than a typeface — so the writer was comparing three identical grey
 * textures and reading the *names* to tell them apart, which is what the cards
 * were built to avoid.
 *
 * A face is chosen by looking at a line of it at a size you could read. So each
 * template is a row with the book's own opening sentence set in it, big enough
 * to see the difference between Georgia and Palatino, and the page below shows
 * the chosen one whole.
 */
/* The sheet's four props went with the sheet — `ExportPage` renders it in the
   column beside this one now, and it already holds every one of them. */
function TemplateStep({
  typeset,
  onPick,
}: {
  typeset: TypesetOptions;
  onPick: (id: TypesetOptions["template"]) => void;
}) {
  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Template"
        className="divide-y divide-line overflow-hidden rounded-xl border
                   border-line bg-panel"
      >
        {TEMPLATES.map((t) => {
          const checked = typeset.template === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onPick(t.id)}
              className={`flex w-full items-center gap-4 px-4 py-3.5 text-left
                          outline-none transition-colors focus-visible:ring-2
                          focus-visible:ring-inset focus-visible:ring-accent/60
                          ${checked ? "bg-accent/6" : "hover:bg-raised"}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center
                            rounded-full border transition-colors ${
                              checked
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-line bg-panel"
                            }`}
              >
                {checked && <Check />}
              </span>

              <span className="w-[8.5rem] shrink-0">
                <span className="block font-sans text-sm font-semibold text-fg">
                  {t.name}
                </span>
                <span className="mt-0.5 block font-sans text-xs text-muted">
                  {t.face}
                </span>
              </span>

              {/* The book's own first sentence, set in the face being offered.
                  Two lines at fifteen pixels, which is the smallest size at
                  which a serif's actual character shows. */}
              <span
                className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug text-fg/80"
                style={{ fontFamily: t.stack }}
              >
                {OPENING}
              </span>
            </button>
          );
        })}
      </div>

      {/* The description sits under the list rather than in every row: three of
          them stacked is a paragraph nobody reads, and only the chosen one is
          about a decision that has been made. */}
      <p className="font-sans text-sm leading-relaxed text-muted">
        {templateById(typeset.template).description}
      </p>
      {/* The sheet used to close this step and is now the column beside it —
          see `showSheet` in `ExportPage`. */}
    </div>
  );
}

/**
 * A page of the book, set the way the export will set it.
 *
 * **It is measured in the page's own width, and that is the whole trick.**
 * Every size on it — the type, the margins, the drop cap, the running head — is
 * stated as a share of the sheet through a container query, so at the sheet's
 * natural width (72 pixels to the inch) one point is exactly one pixel and the
 * type is the size the template really sets. Narrow the window and the sheet
 * shrinks with the *whole setting* to scale, rather than reflowing into a page
 * that is not the page.
 *
 * The margins come from `trimMargins`, which `typesetCss` also asks. A preview
 * that computed its own would drift from the file the moment either changed,
 * and drift is the one thing a preview may not do.
 *
 * **The bottom is cropped rather than the page shrunk.** A 6×9 page at readable
 * type is 648 pixels tall, which is a whole laptop screen for a picture the
 * writer is meant to glance at; shrinking it to fit sets the body at five
 * pixels and shows a typeface nobody can see. So the sheet shows the top of the
 * page — which is where every choice on these two steps actually lands, since
 * all of them are about how a chapter opens — and fades out where it is cut, so
 * nothing claims to be a whole page.
 */
function Sheet({
  typeset,
  output,
  sampleTitle,
  bookTitle,
}: {
  typeset: TypesetOptions;
  /** EPUB has no page of its own; see the trim below. */
  output: Format | null;
  sampleTitle: string;
  bookTitle: string;
}) {
  const t = templateById(typeset.template);

  /* An e-reader picks its own page, so an EPUB preview drawn at the writer's
     trim would be stating something the file cannot honour — and at the A4
     default it would draw a novel on a sheet of office paper. A typical reader
     page instead, said so in the caption. */
  const epub = output === "epub";
  const trim = epub ? trimById("6x9") : trimById(typeset.trim);
  const { side, ends } = trimMargins(trim);

  const across = (inches: number) =>
    `${((inches / trim.width) * 100).toFixed(4)}cqw`;
  const pt = (points: number) => across(points / 72);

  const caps = t.headingCaps
    ? { fontVariant: "small-caps", letterSpacing: "0.06em" }
    : {};

  const body = (
    <>
      <p style={{ margin: 0, textIndent: 0 }}>
        {typeset.dropCaps && (
          <span
            style={{
              float: "left",
              fontSize: pt(t.bodyPt * 3.2),
              lineHeight: 0.82,
              padding: "0.06em 0.08em 0 0",
            }}
          >
            T
          </span>
        )}
        {typeset.dropCaps ? OPENING.slice(1) : OPENING} {SECOND}
      </p>
      <p style={{ margin: 0, textIndent: "1.5em" }}>{THIRD}</p>
      <p style={{ margin: 0, textIndent: "1.5em" }}>{FOURTH}</p>
    </>
  );

  return (
    <figure className="rounded-xl border border-line bg-panel px-4 py-5">
      <div
        className="relative mx-auto max-h-[22rem] w-full overflow-hidden
                   rounded-[3px] border border-sheet-edge bg-sheet
                   shadow-[0_1px_2px_rgba(0,0,0,0.06),0_14px_32px_-18px_rgba(0,0,0,0.45)]"
        style={{
          maxWidth: `${trim.width * 72}px`,
          containerType: "inline-size",
        }}
      >
        <div
          className="relative text-sheet-ink"
          style={{
            aspectRatio: `${trim.width} / ${trim.height}`,
            padding: `${across(ends)} ${across(side)}`,
            fontFamily: t.stack,
            fontSize: pt(t.bodyPt),
            lineHeight: t.leading,
            textAlign: "justify",
            hyphens: "auto",
          }}
        >
          {/* The running head is a print thing — `typesetCss` writes it only
              `forPrint` — so it is drawn only where it will be printed. */}
          {output === "pdf" && (
            <span
              className="absolute text-sheet-ink/45"
              style={{
                top: across(ends * 0.4),
                left: across(side),
                right: across(side),
                textAlign: "right",
                fontSize: pt(t.bodyPt * 0.8),
                ...(t.headingCaps
                  ? { fontVariant: "small-caps", letterSpacing: "0.05em" }
                  : { fontStyle: "italic" }),
              }}
            >
              {bookTitle}
            </span>
          )}

          {!typeset.hideChapterNumbers && (
            <p
              className="text-sheet-ink/55"
              style={{
                textAlign: "center",
                textIndent: 0,
                fontSize: pt(t.bodyPt * 1.4),
                margin: "0 0 0.4em",
              }}
            >
              1
            </p>
          )}

          <h2
            style={{
              textAlign: "center",
              fontWeight: "normal",
              fontSize: pt(t.bodyPt * 1.6),
              margin: "2.4em 0 1.6em",
              ...caps,
            }}
          >
            {sampleTitle}
          </h2>

          {body}
        </div>

        {/* Where the page is cut. A hard edge would read as a short page. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20
                     bg-gradient-to-b from-transparent to-sheet"
        />
      </div>

      <figcaption className="mt-3 text-center font-sans text-xs text-muted">
        {epub
          ? "A reader’s page. E-readers set their own, so an EPUB reflows to the device."
          : `The top of a chapter, at ${trim.label.split("—")[0].trim()}.`}
      </figcaption>
    </figure>
  );
}

/* `sampleTitle` and `bookTitle` went with the sheet — see `TemplateStep`.
   `output` stays: this step still asks it whether to draw a trim row. */
function LayoutStep({
  typeset,
  output,
  onSet,
}: {
  typeset: TypesetOptions;
  // Only ever pdf or epub in practice — this step does not exist otherwise —
  // but typed as the caller has it rather than asserted at the call site.
  output: Format | null;
  onSet: <K extends keyof TypesetOptions>(
    key: K,
    value: TypesetOptions[K],
  ) => void;
}) {
  const epub = output === "epub";

  return (
    <div className="space-y-4">
      <SettingsCard>
        {/* **Stated as the thing you get, not the thing you lose.** The stored
            option is `hideChapterNumbers` and the switch used to be labelled
            with it, so turning the control *on* took something off the page —
            which is the one thing a switch may not do. The store keeps its
            field; the label is inverted here, where a reader is. */}
        <SwitchRow
          label="Chapter numbers"
          hint="A numeral above each chapter title"
          on={!typeset.hideChapterNumbers}
          onChange={(v) => onSet("hideChapterNumbers", !v)}
        />
        <SwitchRow
          label="Drop caps"
          hint="A raised initial opening each chapter"
          on={typeset.dropCaps}
          onChange={(v) => onSet("dropCaps", v)}
        />

        {/* No trim row for an EPUB, rather than a dead one. It was a select
            greyed out with a sentence under it saying why, which is a control
            in the tab order that can never do anything. */}
        {!epub && (
          <SelectRow
            label="Trim size"
            hint="The finished page size, before binding."
            value={typeset.trim}
            onChange={(v) => onSet("trim", v)}
            options={TRIMS.map((t) => [t.id, t.label] as const)}
          />
        )}
      </SettingsCard>

      {epub && (
        <Note>
          An e-reader chooses its own page size, so there is no trim to set
          here. The type and the chapter openings below are what an EPUB
          carries.
        </Note>
      )}

      {/* Both switches change the sheet and nothing else on the screen, which
          is why it is now the column *beside* them rather than the thing
          under them — see `showSheet` in `ExportPage`. */}

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

/**
 * The pages the export builds for you.
 *
 * **Every hint says what will actually happen**, because each of these three
 * switches has a case where it is on and produces nothing — and a switch that
 * quietly does nothing is the dead UI this app refuses. Two such cases: the
 * writer has a page of their own, which wins (see `writtenPages`), or the book
 * has no author to put on a copyright notice.
 *
 * They were three cards with a name and a sentence, identical whether on or
 * off, on a step with nothing else on it. Three things follow from that being
 * wrong. Each carries a **switch you can see the state of**; each carries a
 * **picture of the page it makes**, drawn in the chosen template's own face, so
 * "Epigraph" and "Half-title" stop being printer's words a writer has to
 * already know; and a page standing down for one of the writer's own says so
 * *on the picture*, where the decision is.
 */
function FrontMatterStep({
  book,
  typeset,
  written,
  skipped,
  onSet,
}: {
  book: Book;
  typeset: TypesetOptions;
  written: ReadonlySet<string>;
  skipped: string[];
  onSet: <K extends keyof TypesetOptions>(
    key: K,
    value: TypesetOptions[K],
  ) => void;
}) {
  const author = book.author?.trim();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MatterCard
          label="Title page"
          hint={
            written.has("title")
              ? "Your own page is used instead"
              : "The book’s title and author"
          }
          on={typeset.titlePage}
          yours={written.has("title")}
          onChange={(v) => onSet("titlePage", v)}
          typeset={typeset}
          art="title"
          book={book}
        />
        <MatterCard
          label="Copyright page"
          hint={
            written.has("copyright")
              ? "Your own page is used instead"
              : author
                ? "© this year, in the author’s name"
                : "Left out — this book has no author’s name yet"
          }
          on={typeset.copyright}
          yours={written.has("copyright")}
          onChange={(v) => onSet("copyright", v)}
          typeset={typeset}
          art="copyright"
          book={book}
        />
        <MatterCard
          label="Contents"
          hint={
            written.has("contents")
              ? "Your own page is used instead"
              : "A list of the chapters"
          }
          on={typeset.contents}
          yours={written.has("contents")}
          onChange={(v) => onSet("contents", v)}
          typeset={typeset}
          art="contents"
          book={book}
        />
      </div>

      {/* **The filter, said out loud.**

          A front- or back-matter page still carrying its `[placeholders]` is
          left out of the file, because the alternative is a reader meeting
          "For [name]." on the page after the cover. But a page quietly
          disappearing from somebody's book is the same class of mistake as a
          template quietly shipping in one — the file does not match the book on
          screen, and only one of the two is discoverable. So they are named, in
          the writer's own page titles, with what to do.

          A note rather than a warning: nothing here is wrong. These are pages
          the writer has not got to yet, and the export is doing the right thing
          by them. */}
      {skipped.length > 0 && (
        <div className="rounded-xl border border-note-line bg-note-bg px-4 py-3.5">
          <p className="font-sans text-sm font-semibold text-note-fg">
            {skipped.length === 1
              ? "One page is not going in"
              : `${skipped.length} pages are not going in`}
          </p>
          <p className="mt-1 font-sans text-xs leading-relaxed text-note-fg/85">
            {skipped.join(", ")} — still blank, or still holding the example
            text in [square brackets]. Fill one in and it joins the book; delete
            the ones you do not want.
          </p>
        </div>
      )}
    </div>
  );
}

/** One generated page: a picture of it, what it is, and whether it goes in. */
function MatterCard({
  label,
  hint,
  on,
  yours,
  onChange,
  typeset,
  art,
  book,
}: {
  label: string;
  hint: string;
  on: boolean;
  /** The writer has a page of this kind, so theirs is what the file will use. */
  yours: boolean;
  onChange: (on: boolean) => void;
  typeset: TypesetOptions;
  art: "title" | "copyright" | "contents";
  book: Book;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex flex-col rounded-xl border bg-panel p-3.5 text-left
                  outline-none transition-[border-color,box-shadow]
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    on
                      ? "border-accent ring-1 ring-accent"
                      : "border-line hover:border-fg/35"
                  }`}
    >
      <span
        aria-hidden="true"
        className={`relative mx-auto block aspect-[3/4] w-full max-w-[8rem]
                    overflow-hidden rounded-[2px] border bg-sheet transition-opacity ${
                      on
                        ? "border-sheet-edge shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_18px_-12px_rgba(0,0,0,0.45)]"
                        : "border-dashed border-line opacity-35"
                    }`}
        style={{ containerType: "inline-size" }}
      >
        <MatterArt art={art} book={book} typeset={typeset} />
        {on && yours && (
          <span
            className="absolute inset-x-0 bottom-0 bg-fg/80 py-[3px] text-center
                       font-sans text-[9px] font-semibold text-panel"
          >
            Your own page
          </span>
        )}
      </span>

      <span className="mt-3 flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-sm font-semibold text-fg">
            {label}
          </span>
          <span className="mt-0.5 block font-sans text-xs leading-relaxed text-muted">
            {hint}
          </span>
        </span>
        <SwitchTrack on={on} />
      </span>
    </button>
  );
}

/**
 * What each generated page looks like, in the face it will be set in.
 *
 * Drawn from the book's own title and author rather than a stand-in, so it is a
 * picture of *this* book's title page. Sized in `cqw` like the big sheet, so
 * one card is one page whatever the column does.
 */
function MatterArt({
  art,
  book,
  typeset,
}: {
  art: "title" | "copyright" | "contents";
  book: Book;
  typeset: TypesetOptions;
}) {
  const t = templateById(typeset.template);
  const author = book.author?.trim();
  const caps = t.headingCaps
    ? { fontVariant: "small-caps" as const, letterSpacing: "0.05em" }
    : {};
  const line = (width: string) => (
    <span
      className="block rounded-full bg-sheet-ink/25"
      style={{ height: "1.6cqw", width }}
    />
  );

  if (art === "title") {
    return (
      <span
        className="flex h-full w-full flex-col items-center justify-center gap-[4cqw] px-[10cqw] text-center text-sheet-ink"
        style={{ fontFamily: t.stack }}
      >
        <span
          className="line-clamp-2 leading-tight"
          style={{ fontSize: "11cqw", ...caps }}
        >
          {book.title}
        </span>
        <span className="block w-[30%] border-t border-sheet-ink/25" />
        <span
          className="line-clamp-1 text-sheet-ink/70"
          style={{ fontSize: "7cqw" }}
        >
          {author || "Author"}
        </span>
      </span>
    );
  }

  if (art === "copyright") {
    return (
      <span
        className="flex h-full w-full flex-col justify-end gap-[3cqw] px-[12cqw] pb-[16cqw] text-sheet-ink"
        style={{ fontFamily: t.stack }}
      >
        <span className="line-clamp-1" style={{ fontSize: "7cqw" }}>
          © {new Date().getFullYear()} {author || "—"}
        </span>
        {line("100%")}
        {line("86%")}
        {line("94%")}
        {line("48%")}
      </span>
    );
  }

  return (
    <span
      className="flex h-full w-full flex-col gap-[4cqw] px-[12cqw] pt-[18cqw] text-sheet-ink"
      style={{ fontFamily: t.stack }}
    >
      <span
        className="text-center"
        style={{ fontSize: "9cqw", marginBottom: "3cqw", ...caps }}
      >
        Contents
      </span>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="flex items-center gap-[4cqw]">
          {line("100%")}
          <span
            className="shrink-0 text-sheet-ink/45"
            style={{ fontSize: "5.5cqw" }}
          >
            {i + 1}
          </span>
        </span>
      ))}
    </span>
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
  skipped,
  written,
}: {
  book: Book;
  cover: string | null;
  output: Format;
  label: string;
  typeset: TypesetOptions;
  manuscript: boolean;
  busy: boolean;
  error: string | null;
  /** How many matter pages the export is leaving out — see `skippedMatterPages`. */
  skipped: number;
  /** Generated pages the writer has a page of their own for — see `writtenPages`. */
  written: ReadonlySet<string>;
}) {
  // What the file will contain, said back in one place. A writer who clicked
  // through four screens should not have to click back to check what they set.
  //
  // **The body chapters, not every page in the book.** This counted
  // `book.chapters.length`, which was near enough while front and back matter
  // were one page each and the count was off by two. They are lists of pages
  // now — a book with the standard set has sixteen of them — so the row read
  // "20 chapters" for a three-chapter novel, and counted pages that were about
  // to be left out for still being blank. The matter pages are reported on
  // their own line, where they can say how many are actually going in.
  const bodyCount = book.chapters.filter(
    (c) => chapterMatterOf(c) === "body",
  ).length;
  const matterCount = book.chapters.length - bodyCount - skipped;
  const summary: [string, string][] = [
    ["Chapters", `${bodyCount} ${bodyCount === 1 ? "chapter" : "chapters"}`],
  ];
  if (matterCount > 0) {
    summary.push([
      "Your own pages",
      matterCount === 1
        ? "1 page of front or back matter"
        : `${matterCount} pages of front and back matter`,
    ]);
  }
  if (isTypeset(output)) {
    summary.push(["Template", templateById(typeset.template).name]);
    if (output === "pdf") summary.push(["Trim", trimById(typeset.trim).label]);
    /* **What will actually be generated, not what is switched on.** This is
       the last thing a writer reads before pressing the button, so it may not
       promise a page that is about to stand down for one of their own — nor a
       copyright notice for a book with nobody to name on it. Same three
       conditions as `frontSections`, said in the same order. */
    const front = [
      typeset.titlePage && !written.has("title") && "title page",
      typeset.copyright &&
        !written.has("copyright") &&
        Boolean(book.author?.trim()) &&
        "copyright",
      typeset.contents && !written.has("contents") && "contents",
    ].filter(Boolean) as string[];
    summary.push(["Front matter", front.length ? front.join(", ") : "none"]);
  }
  if (output === "docx") {
    summary.push([
      "Layout",
      manuscript ? "Standard manuscript" : "Clean document",
    ]);
  }

  const format = FORMATS.find((f) => f.value === output);

  return (
    <div className="space-y-4">
      {/* **The file, named.** The summary was a list of rows headed FORMAT ·
          EPUB, which is the least surprising row on it — the writer chose the
          format four steps ago and has been reading its name in the rail ever
          since. What they cannot know is *what lands in the downloads folder*,
          which is the one thing a download tells nobody. So the format is the
          card's own heading, with the filename under it. */}
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex items-center gap-3.5 border-b border-line px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-raised text-fg">
            <FormatMark format={output} className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-sans text-sm font-semibold text-fg">
              {exportFilename(output, book.title) ?? label}
            </span>
            <span className="mt-0.5 block font-sans text-xs text-muted">
              {format?.produces}
            </span>
          </span>
        </div>

        <dl className="divide-y divide-line">
          {summary.map(([term, value]) => (
            <div
              key={term}
              className="flex items-baseline gap-4 px-4 py-2.5 font-sans text-sm"
            >
              <dt className="text-muted">{term}</dt>
              <dd className="ml-auto text-right font-medium text-fg">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* The honest half of "publish": what a shop would say about this file,
          said here instead — before the upload rather than after it. */}
      {output === "epub" && <StoreReadiness book={book} cover={cover} />}

      {busy && (
        <p className="flex items-center gap-2.5 rounded-lg border border-line bg-panel px-4 py-3 font-sans text-sm text-muted">
          <Spinner className="h-3.5 w-3.5" />
          Building the file…
        </p>
      )}
      {error && <Failed>{error}</Failed>}
    </div>
  );
}

/**
 * The name the browser will save it under.
 *
 * The same arithmetic `runExport` uses, which is the only thing that makes it
 * safe to print — a filename guessed at here and produced there is a promise
 * this screen cannot keep. **Null for PDF**, for the reason `runExport`
 * answers null: what leaves is the browser's print dialog, and whether anything
 * was saved, or under what name, is not ours to say.
 */
function exportFilename(output: Format, title: string): string | null {
  if (output === "pdf") return null;
  const ext = output === "docx" ? "docx" : output === "epub" ? "epub" : "md";
  return `${slugify(title)}.${ext}`;
}

/** Something went wrong, in the status family's own red. */
function Failed({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-stop-line bg-stop-bg px-4 py-3
                 font-sans text-sm leading-relaxed text-stop-fg"
    >
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// The shared controls
// ---------------------------------------------------------------------------

/**
 * A group of settings as one object, rather than a grid of loose cards.
 *
 * Everything on these steps that is a yes-or-no now lives in one of these, with
 * a hairline between rows. The version before this drew each switch as its own
 * bordered card in a two- or three-column grid, and the cost was not the
 * looks: a card that is chosen and a card that is *on* looked identical, so a
 * row of them read as a set of radio buttons where every one happened to be
 * picked. A list with a switch at the end of each row is the shape every
 * settings screen in the world uses, and it is legible at a glance.
 */
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
      {children}
    </div>
  );
}

/**
 * The switch itself.
 *
 * **A control has to look like what it does.** These were `role="switch"` on a
 * card whose only state was a tinted border — the same tint the format cards
 * use for *chosen* — so nothing on screen said on or off, and the front-matter
 * step in particular was three identical white boxes for three settings that
 * were all switched on. A track and a thumb say it without a word, and say it
 * the same way every phone the writer owns says it.
 */
function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5
                  transition-colors ${
                    on ? "bg-accent" : "bg-raised ring-1 ring-line ring-inset"
                  }`}
    >
      <span
        className={`h-4 w-4 rounded-full transition-transform ${
          on ? "translate-x-4 bg-accent-ink" : "bg-muted"
        }`}
      />
    </span>
  );
}

function SwitchRow({
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
      className="flex w-full items-start gap-4 px-4 py-3.5 text-left outline-none
                 transition-colors hover:bg-raised focus-visible:ring-2
                 focus-visible:ring-inset focus-visible:ring-accent/60"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-sans text-sm font-semibold text-fg">
          {label}
        </span>
        <span className="mt-0.5 block font-sans text-xs leading-relaxed text-muted">
          {hint}
        </span>
      </span>
      <SwitchTrack on={on} />
    </button>
  );
}

/** The same row, for the one setting on these steps that is not a yes-or-no. */
function SelectRow({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-start gap-4 px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block font-sans text-sm font-semibold text-fg">
          {label}
        </span>
        <span className="mt-0.5 block font-sans text-xs leading-relaxed text-muted">
          {hint}
        </span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[13.5rem] shrink-0 rounded-lg border border-line bg-panel
                   px-3 py-2 font-sans text-sm text-fg outline-none
                   focus-visible:border-accent focus-visible:ring-2
                   focus-visible:ring-accent/20"
      >
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The one thing on the bar that moves the writer on.
 *
 * Busy and unavailable are drawn differently on purpose: a button that is
 * working is still the accent one, because it is doing the thing that was
 * asked, while a button with nothing to do sits back in the chrome.
 */
function PrimaryAction({
  label,
  busyLabel = "Working…",
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`ml-auto flex min-w-[10rem] items-center justify-center gap-2
                  rounded-lg px-5 py-2.5 font-sans text-sm font-semibold
                  outline-none transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    disabled
                      ? "cursor-not-allowed bg-raised text-muted"
                      : "bg-accent text-accent-ink hover:bg-accent-strong"
                  } ${busy ? "opacity-90" : ""}`}
    >
      {busy ? (
        <>
          <Spinner className="h-3.5 w-3.5" />
          {busyLabel}
        </>
      ) : (
        <>
          {label}
          {!disabled && <Arrow />}
        </>
      )}
    </button>
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
