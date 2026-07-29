"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PagePreview } from "@/components/editor/page-preview";
import { relativeTime } from "@/lib/relative-time";
import {
  bookWordCount,
  chapterMatterOf,
  chapterNumberOf,
  createChapter,
  createMatterSection,
  deleteChapter,
  importIntoBook,
  renameChapter,
  toggleBookmark,
  type Book,
} from "@/lib/library-store";
import type { Dictation } from "@/lib/editor/use-dictation";
import { IMPORT_ACCEPT, ImportError, importFile } from "@/lib/import";
import {
  RowMenu,
  menuIcons,
  type RowMenuItem,
} from "@/components/sidebar/row-menu";
import type { ImportedChapter } from "@/lib/import/split";
import { ImportModeDialog } from "@/components/editor/import-mode-dialog";
import { showImportBanner } from "@/components/editor/import-banner-host";

export type BookPanelMode = "book" | "chapters";

/**
 * The book navigator, between the workspace rail and the manuscript. Two faces
 * of the same thing:
 *
 * - **Book View** — the cover, large, with the two page steppers and the way in
 *   to the chapter list. The book as an object.
 * - **Chapters** — the cover small beside its figures, the make-and-import
 *   controls, then the book's three parts as boxes that open and shut — a
 *   table of contents you scroll and click. The book as its parts.
 *
 * The mode changes only this panel; the manuscript in the centre is untouched.
 * Previous / Next Page step to the page either side of the open one — front
 * matter, body, back matter, in the book's own order — so the centre and the
 * cover thumbnail on the tool rail both move with it.
 *
 * (The module-scope pieces below belong to the Chapters face; the component
 * itself follows them.)
 */

/**
 * The three parts, each in its own colour, so the panel is read by hue before
 * it is read by word — the writer who has learnt that the purple one holds the
 * chapters stops reading the headings at all.
 *
 * Written out as whole class names rather than built from a part name, because
 * Tailwind finds its utilities by reading the source: `bg-matter-${part}` is a
 * string at runtime and an empty stylesheet at build time.
 *
 * The border is a wash of the same colour so a card is placeable even when it
 * is not the one you are in; being *in* it takes the colour to full.
 */
const MATTER_TONE = {
  front: {
    border: "border-matter-front/30",
    borderActive: "border-matter-front",
    button: `bg-matter-front text-matter-front-ink hover:bg-matter-front-strong
             focus-visible:ring-matter-front/50`,
    // Shrunk, the whole strip becomes the button, so it takes the fill the
    // button had. Ink is a token too, because the black card inverts at night
    // and white text on it would then be white on near-white.
    strip: `bg-matter-front text-matter-front-ink hover:bg-matter-front-strong
            focus-visible:ring-matter-front-ink/60`,
    outline: `border-matter-front text-matter-front hover:bg-matter-front/10
              focus-visible:ring-matter-front/50`,
    inkSoft: "text-matter-front-ink/70",
    ringInk: "ring-matter-front-ink/60",
  },
  body: {
    border: "border-matter-body/30",
    borderActive: "border-matter-body",
    button: `bg-matter-body text-matter-body-ink hover:bg-matter-body-strong
             focus-visible:ring-matter-body/50`,
    strip: `bg-matter-body text-matter-body-ink hover:bg-matter-body-strong
            focus-visible:ring-matter-body-ink/60`,
    outline: `border-matter-body text-matter-body hover:bg-matter-body/10
              focus-visible:ring-matter-body/50`,
    inkSoft: "text-matter-body-ink/70",
    ringInk: "ring-matter-body-ink/60",
  },
  back: {
    border: "border-matter-back/30",
    borderActive: "border-matter-back",
    button: `bg-matter-back text-matter-back-ink hover:bg-matter-back-strong
             focus-visible:ring-matter-back/50`,
    strip: `bg-matter-back text-matter-back-ink hover:bg-matter-back-strong
            focus-visible:ring-matter-back-ink/60`,
    outline: `border-matter-back text-matter-back hover:bg-matter-back/10
              focus-visible:ring-matter-back/50`,
    inkSoft: "text-matter-back-ink/70",
    ringInk: "ring-matter-back-ink/60",
  },
} as const;

type MatterTone = keyof typeof MATTER_TONE;

/**
 * Whether the body list is open, remembered at module scope.
 *
 * The panel is remounted every time the writer opens a different chapter, so
 * component state would put the list back to its default on each click —
 * clicking through a book would keep re-opening a list a writer had just shut.
 * Same reason the panel's face is held this way in the editor.
 *
 * Shut to begin with. The panel's first face is the book's three parts, whole
 * and equal; the list is what you ask for, not what you arrive at. It used to
 * open itself whenever the writer was in a numbered chapter, which is nearly
 * always — so nearly always the panel opened straight past its own front page.
 *
 * Only the body has this. Front and back matter are one page each and are shown
 * as cards, which have nothing to expand.
 */
let bodyOpenMemory = false;

function toggleBody(): boolean {
  bodyOpenMemory = !bodyOpenMemory;
  return bodyOpenMemory;
}

function closeBody(): boolean {
  bodyOpenMemory = false;
  return bodyOpenMemory;
}

/**
 * The open/shut state of the chapter list, held above this panel.
 *
 * It lives up in the editor rather than in here because the manuscript needs it
 * too: the page's edge takes the colour of the part the panel says is selected,
 * and pressing Chapters selects the body. Two copies of this would be two
 * answers to the same question.
 */
export function useBodyOpen() {
  const [open, setOpen] = useState(bodyOpenMemory);
  return {
    open,
    toggle: () => setOpen(toggleBody()),
    close: () => setOpen(closeBody()),
  };
}

export type BodyOpen = ReturnType<typeof useBodyOpen>;

export function BookPanel({
  book,
  chapterId,
  cover,
  paper,
  mode,
  onMode,
  dictation,
  body,
  always = false,
}: {
  book: Book;
  chapterId: string | null;
  cover: string | null;
  /** The page-colour preference, handed to the print preview. */
  paper: string;
  mode: BookPanelMode;
  onMode: (mode: BookPanelMode) => void;
  /**
   * The editor's live dictation, started upstream. Shared with the tool rail's
   * microphone so the two controls are two views of one session, not two.
   *
   * Absent on the book overview, which has no manuscript: the microphone hides
   * rather than appearing with nowhere to put the words.
   */
  dictation?: Dictation;
  /** The chapter list’s open state, owned by the editor — see useBodyOpen. */
  body: BodyOpen;
  /** Show at every width. Set by the overview, where this is the only way in. */
  always?: boolean;
}) {
  const router = useRouter();
  const bookId = book.id;

  const chapters = book.chapters;
  const bodyChapters = chapters.filter((c) => chapterMatterOf(c) === "body");
  const front = chapters.find((c) => c.matterKey === "front") ?? null;
  const back = chapters.find((c) => c.matterKey === "back") ?? null;

  // Is the open chapter one of the numbered ones? Anything that is not the
  // front or back matter page is, which is what "body" means here.
  const inBody =
    !!chapterId && front?.id !== chapterId && back?.id !== chapterId;

  // Named once because it is both the tooltip and the accessible name, and a
  // toggle whose two labels disagree is a toggle screen readers misreport.
  const dictationLabel = dictation?.listening
    ? "Stop dictating"
    : "Dictate — speak and the words are typed";

  // Importing a file into this book — mirrors the left panel: a read in flight,
  // any error, the hidden input, and a parsed file waiting on add-or-replace.
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<ImportedChapter[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The Book View flip-book: page 0 is the cover, 1…N the chapter's printed
  // pages. The preview reports its page count so the pager can clamp.
  const [previewIndex, setPreviewIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const prevPage = () => setPreviewIndex((i) => Math.max(0, i - 1));
  const nextPage = () => setPreviewIndex((i) => Math.min(pageCount, i + 1));

  const open = (id: string) => router.push(`/book/${bookId}/chapter/${id}`);

  const handleCreate = () => open(createChapter(bookId));

  // Front / back matter: open the page, seeding it from the template the first
  // time it is asked for.
  //
  // The chapter list shuts on the way. Going to the front matter is leaving the
  // body, and leaving it open would land the writer on a page whose card is a
  // strip at the top of a list of somewhere else — three cards at full height
  // is the panel's resting state, and this is a writer coming to rest.
  const openMatter = (matter: "front" | "back") => {
    const existing = matter === "front" ? front : back;
    const id = existing?.id ?? createMatterSection(bookId, matter);
    if (!id) return;
    // Set even though the navigation remounts this panel: the writer may
    // already be on that page, in which case the push changes nothing and this
    // is the only thing that closes the list.
    body.close();
    open(id);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const parsed = await importFile(file);
      // Already wrote here? Ask add-or-replace. An empty book just takes it in.
      if (bookWordCount(book) > 0) {
        setPending(parsed.chapters);
        return;
      }
      runImport(parsed.chapters, "replace");
    } catch (err) {
      setImportError(
        err instanceof ImportError
          ? err.message
          : "That file could not be read. It may be damaged, or not the format its name suggests.",
      );
    } finally {
      setImporting(false);
    }
  };

  const runImport = (chapters: ImportedChapter[], mode: "add" | "replace") => {
    setPending(null);
    const result = importIntoBook(bookId, chapters, mode);
    if (!result) {
      setImportError(
        "Those chapters could not be saved — the book may be too large for this browser's storage.",
      );
      return;
    }
    showImportBanner(bookId, result.undo, chapters.length);
    open(result.firstId);
  };

  return (
    <aside
      aria-label="Book"
      // Transparent, with no divider: the gradient wash and the seamless blend
      // into the paper come from the shared row in the editor layout, so the
      // book panel and the manuscript read as one surface.
      // Widens with the window rather than taking one fixed number. 18rem was
      // set for the cover, which is the narrower of the two things this panel
      // shows; the chapter list wants room for a title, its number and its word
      // count without the title truncating.
      //
      // Beside a manuscript it appears only at lg and up, so the page keeps its
      // measure on a laptop and gains from a monitor. On the overview there is
      // no manuscript to protect and this panel is the only way into the book,
      // so it is always shown — hiding it there would leave that screen a guide
      // with no navigation at all.
      className={`w-80 shrink-0 flex-col xl:w-[22rem] 2xl:w-96 ${
        always ? "flex" : "hidden lg:flex"
      }`}
    >
      {mode === "book" ? (
        /* Three bands, in the order a writer reads them: the page, what the
           book is, and the way out of here. `gap-7` sets the rhythm once
           instead of a different margin on each child, and the action is
           pushed to the foot by mt-auto so it sits in the same place whether
           the book is one chapter or forty. */
        <div className="scroll-slim flex h-full flex-col gap-7 overflow-y-auto px-6 py-8">
          {/* The cover on page 0; every page after it is the chapter as it will
              print, so the writer can flip through the finished pages here. */}
          <div className="flex flex-col items-center gap-3">
            <PagePreview
              book={book}
              cover={cover}
              paper={paper}
              index={previewIndex}
              onPageCount={setPageCount}
            />

            {/* A pager, not two arrows over the page.
                Laid on the preview they covered the prose — which is the one
                thing the preview exists to show, so the controls were hiding
                their own subject. Set beside the caption they cover nothing,
                the page keeps its full width, and the three parts read as one
                control: back, where you are, forward.

                Tabular figures so the number does not jog sideways as the count
                passes a wider digit and shifts the arrows under the cursor. */}
            <div className="flex items-center gap-1">
              <PageArrow
                label="Previous page"
                disabled={previewIndex === 0}
                onClick={prevPage}
                direction="left"
              />
              <span className="min-w-[7.5rem] text-center font-sans text-xs tabular-nums text-muted">
                {previewIndex === 0
                  ? "Cover"
                  : `Page ${previewIndex} of ${pageCount}`}
              </span>
              <PageArrow
                label="Next page"
                disabled={previewIndex >= pageCount}
                onClick={nextPage}
                direction="right"
              />
            </div>
          </div>

          {/* Title, figures and the way in to the chapters, as one block on a
              card rather than three things loose on the panel.

              They were loose, with the action pinned to the foot — which left a
              hand's width of nothing between the last line and the button. A
              gap that size reads as something failing to load. Grouping them
              gives the text an edge to sit against and puts the action where
              the reader already is, and the empty space falls below the block
              where it looks like room rather than a hole.

              The figures are one quiet line, not a grid of labelled cells:
              three numbers do not need a table, and the labels were louder than
              the values they described. */}
          <div className="rounded-xl border border-line bg-panel/70 p-4">
            <h2 className="font-serif text-lg leading-snug font-medium text-fg">
              {book.title}
            </h2>

            <p className="mt-1.5 font-sans text-sm text-muted">
              <span className="font-medium text-fg">
                {bodyChapters.length.toLocaleString()}
              </span>{" "}
              {bodyChapters.length === 1 ? "chapter" : "chapters"}
              <span aria-hidden="true" className="px-1.5 text-line">
                |
              </span>
              <span className="font-medium text-fg">
                {bookWordCount(book).toLocaleString()}
              </span>{" "}
              words
            </p>
            <p className="mt-0.5 font-sans text-xs text-muted">
              Opened {relativeTime(book.lastOpenedAt)}
            </p>

            <button
              type="button"
              onClick={() => onMode("chapters")}
              className="mt-4 w-full cursor-pointer rounded-lg bg-accent py-2.5
                         font-sans text-sm font-semibold text-white outline-none
                         transition-colors hover:bg-accent-strong
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Chapters
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col px-5 py-6">
          {/* One row: the way out, the way to make a chapter, and the two ways
              to bring one in.

              The step back used to sit on its own line above, which spent a
              whole row of a narrow panel on one small link and left the row
              below it looking like the top of the panel anyway. Four controls
              of one height read as one bar, and the panel starts where its
              content starts.

              Back is an icon alone. Giving it its word back would take a third
              of the row from the primary action at this width, and a chevron at
              the left end of a bar is the one icon nobody has to be taught. Its
              name lives in the label and the tooltip for anyone who does. */}
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => onMode("book")}
              aria-label="Back to Book View"
              title="Back to Book View"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center
                         rounded-lg border border-line text-fg outline-none
                         transition-colors hover:border-accent/60 hover:bg-raised
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M12 5l-5 5 5 5" />
              </svg>
            </button>

            {/* Everything after this is an action, and the step back is not, so
                the gap between them carries the difference. */}
            <span className="flex-1" />

            {/* Dictation. Hidden outright where the browser has no speech
                engine — on Safari and Firefox this could never work, and a
                control that is permanently dead is worse than one that was
                never offered. It keeps the import button's exact footprint so
                turning the microphone on cannot shift the row. */}
            {dictation?.supported && (
              <button
                type="button"
                aria-pressed={dictation.listening}
                aria-label={dictationLabel}
                title={dictationLabel}
                onClick={() =>
                  dictation.listening ? dictation.stop() : dictation.start()
                }
                className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center
                            justify-center rounded-lg border outline-none
                            transition-colors focus-visible:ring-2
                            focus-visible:ring-accent/50 ${
                              dictation.listening
                                ? "border-danger bg-danger text-white"
                                : `border-line text-fg hover:border-accent/60
                                   hover:bg-raised`
                            }`}
              >
                {/* A ring that keeps pulsing while the microphone is live. This
                    is a control a writer switches on and then stops looking at,
                    so the state has to carry from the corner of the eye. */}
                {dictation.listening && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 animate-ping rounded-lg
                               bg-danger/40"
                  />
                )}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="relative h-4 w-4"
                >
                  <rect x="7.4" y="2.6" width="5.2" height="9.4" rx="2.6" />
                  <path d="M4.6 9.6a5.4 5.4 0 0 0 10.8 0" />
                  <path d="M10 15v2.4" />
                </svg>
              </button>
            )}

            <button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              aria-label={importing ? "Reading file…" : "Import a file"}
              title="Import a file"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border
                         border-line text-fg outline-none transition-colors
                         hover:border-accent/60 hover:bg-raised focus-visible:ring-2
                         focus-visible:ring-accent/50 disabled:opacity-50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5" />
                <path d="M3.5 12.5v2A1.5 1.5 0 0 0 5 16h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
              </svg>
            </button>
          </div>

          {/* While the microphone is live, say so in words as well as colour —
              and say where the words are going, since the writer is looking at
              the chapter list rather than at the page they are dictating into.
              A refused microphone reports itself here too; nothing else would
              tell the writer why speaking is doing nothing. */}
          {dictation?.supported && (dictation.listening || dictation.error) && (
            <p
              className={`mt-2 font-sans text-xs ${
                dictation.error ? "text-danger" : "text-muted"
              }`}
              role={dictation.error ? "alert" : "status"}
            >
              {dictation.error ?? "Listening — speak and the words are typed."}
            </p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={IMPORT_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleImport(file);
            }}
          />

          {importError && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-line bg-raised px-2.5 py-2
                         font-sans text-xs leading-relaxed"
              style={{ color: "var(--color-danger)" }}
            >
              {importError}
            </p>
          )}

          {/* The book's three parts, one card each. Front matter opens the
              book, the body is the story, back matter closes it — the order
              they are bound in.

              Cards rather than a flat list because the list had no shape: nine
              chapters ran between two markers with nothing saying where the
              story started and stopped, and nothing at all saying what "front
              matter" means to someone who has not published before.

              Front and back keep their natural height and the body takes what
              is left once its list is open, so the story fills the panel and
              scrolls inside its own card — the two short cards cannot be pushed
              off the bottom by a forty-chapter book, which is exactly when a
              writer wants to reach them. */}
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 pr-1">
            <MatterCard
              tone="front"
              label="Front matter"
              description="The pages before Chapter 1: title, copyright, dedication."
              action={front ? "Open" : "Start"}
              // Yields to the body while its list is open, so exactly one part
              // is ever marked and the page's edge always has a card to match.
              active={!body.open && front?.id === chapterId}
              onAction={() => openMatter("front")}
              compact={body.open}
            />

            <MatterCard
              tone="body"
              label="Body matter"
              description={
                body.open
                  ? undefined
                  : "The story itself, chapter by chapter, in reading order."
              }
              meta={`${bodyChapters.length} ${
                bodyChapters.length === 1 ? "chapter" : "chapters"
              }`}
              action={body.open ? "Hide chapters" : "Chapters"}
              // Open counts as selected, as well as being in a chapter. The
              // page's edge is driven from the same expression upstream, so
              // this border and that edge cannot disagree — which is the only
              // reason "open" is allowed to mean "selected" at all.
              active={body.open || inBody}
              onAction={body.toggle}
              // Only once the list is open. Shut, the card has one thing to
              // offer — open me — and a second button beside it halves the
              // width of that one thing to sit next to a list nobody is looking
              // at. The new chapter appears in the list it was added to, so the
              // button belongs where the list is.
              secondary={
                body.open
                  ? { label: "New chapter", onClick: handleCreate }
                  : undefined
              }
              grow={body.open}
            >
              {bodyChapters.length > 0 ? (
                bodyChapters.map((c) => (
                  <ChapterPill
                    key={c.id}
                    number={chapterNumberOf(book, c.id)}
                    title={c.title}
                    active={c.id === chapterId}
                    onClick={() => open(c.id)}
                    menu={[
                      {
                        label: c.bookmarked ? "Unstar" : "Star",
                        icon: c.bookmarked
                          ? menuIcons.starFilled
                          : menuIcons.star,
                        onSelect: () => toggleBookmark(bookId, c.id),
                      },
                      {
                        label: "Rename",
                        icon: menuIcons.rename,
                        onSelect: () => {
                          // A prompt rather than the sidebar's edit-in-place:
                          // the same three actions, without a second copy of
                          // the rename state to keep in step with it.
                          const next = window.prompt("Chapter title", c.title);
                          if (next === null) return;
                          const trimmed = next.trim();
                          if (trimmed) renameChapter(bookId, c.id, trimmed);
                        },
                      },
                      {
                        label: "Delete",
                        icon: menuIcons.trash,
                        danger: true,
                        onSelect: () => {
                          if (
                            window.confirm(
                              `Move “${c.title}” to this book's trash? You can restore it from there.`,
                            )
                          ) {
                            deleteChapter(bookId, c.id);
                          }
                        },
                      },
                    ]}
                  />
                ))
              ) : (
                <li className="px-1 py-2 font-sans text-xs text-muted italic">
                  No chapters yet.
                </li>
              )}
            </MatterCard>

            <MatterCard
              tone="back"
              label="Back matter"
              description="The pages after the story: acknowledgements, notes, an epilogue."
              action={back ? "Open" : "Start"}
              active={!body.open && back?.id === chapterId}
              onAction={() => openMatter("back")}
              compact={body.open}
            />
          </div>
        </div>
      )}

      {pending && (
        <ImportModeDialog
          existingCount={bodyChapters.length}
          importCount={pending.length}
          onAdd={() => runImport(pending, "add")}
          onReplace={() => runImport(pending, "replace")}
          onClose={() => setPending(null)}
        />
      )}
    </aside>
  );
}

/** One of the two page steppers under the cover in Book View — each flips the
 *  print preview by a page. */
/**
 * One end of the pager under the page.
 *
 * Quiet by default and lit on hover, because a pager sits under something worth
 * looking at and should not compete with it. Disabled it dims rather than
 * disappearing: the pair keeps its shape, so the caption between them does not
 * shift sideways at the first and last page.
 *
 * Icon-only, so it carries a label for anyone not looking at it — the arrow
 * tells a sighted reader which way and a screen reader nothing at all.
 */
function PageArrow({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: "left" | "right";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      // bg-panel, not white: it is white on the light theme and the lifted
      // slate on the dark one, so the disc stays a disc in both rather than
      // becoming a bright hole at night.
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center
                 rounded-full border border-line bg-panel text-fg shadow-sm
                 outline-none transition-[background-color,box-shadow,color]
                 hover:bg-raised hover:shadow focus-visible:ring-2
                 focus-visible:ring-accent/60 disabled:pointer-events-none
                 disabled:opacity-30"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d={direction === "left" ? "M12 4 6 10l6 6" : "M8 4l6 6-6 6"} />
      </svg>
    </button>
  );
}

/** A body chapter as a pill — numbered, the soft blue wash, filled when open. */
/**
 * One chapter in the contents.
 *
 * These were filled pills, every row carrying a tinted block — which made the
 * list a stack of buttons and left the open chapter competing with nine others
 * for attention. A contents list is mostly read, not pressed: the rows are
 * plain now, a hover shows what is under the pointer, and the fill is spent on
 * the one row that has something to say, which is where you are.
 *
 * Losing the fills and the padding roughly doubles how many chapters are in
 * view — the point of a contents list being to see the shape of the book.
 */
function ChapterPill({
  number,
  title,
  active,
  onClick,
  menu,
}: {
  number: number | null;
  title: string;
  active: boolean;
  onClick: () => void;
  menu: RowMenuItem[];
}) {
  return (
    /* `group` and `relative` for the ⋯: it is laid over the row's right end
       rather than sitting in the flow, so the title has the row's full width
       and does not reflow when the menu appears under the pointer. */
    <li className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg
                    py-2 pr-9 pl-2.5 text-left font-sans text-sm outline-none
                    transition-colors focus-visible:ring-2
                    focus-visible:ring-matter-body/50 ${
                      active
                        ? // The body's own colour, not the app accent: this row
                          // sits inside the purple card, and a blue fill there
                          // would read as belonging to something else.
                          "bg-matter-body font-medium text-matter-body-ink"
                        : "text-fg hover:bg-raised"
                    }`}
      >
        {/* Fixed width and right-aligned, so the titles line up whether the
            number is 1 or 40 rather than stepping right as the book grows. */}
        <span
          className={`w-5 shrink-0 text-right text-xs tabular-nums ${
            active ? "text-white/70" : "text-muted"
          }`}
        >
          {number ?? ""}
        </span>

        <span className="min-w-0 flex-1 truncate">{title}</span>
      </button>

      <span className="absolute top-1/2 right-1 -translate-y-1/2">
        {/* `active` keeps the trigger shown on the open chapter: its actions
            should be one click away rather than one hover, and it is the row a
            touch user cannot hover to find at all. */}
        <RowMenu label={title} items={menu} active={active} />
      </span>
    </li>
  );
}

/**
 * One part of the book as a card: what the part is, and the one way in.
 *
 * The three parts are unequal — front and back matter are a single page each,
 * the body is the whole novel — and the first design showed that by giving them
 * different chrome, two disclosures and a list. It read as three unrelated
 * controls. They are three parts of one book and they look like it now: same
 * card, same sentence explaining what belongs there, same button.
 *
 * The sentence is the part worth keeping. "Front matter" is a printer's term,
 * and someone writing a first novel has had no reason to learn which pages go
 * before Chapter 1 — a card that spends its space saying so is worth more than
 * one that spends it on a count of one.
 *
 * `children` is how the body differs: its button reveals the chapter list
 * inside the card rather than opening a page. With `grow` set it then takes the
 * height the other two cards do not need and scrolls inside itself, so a
 * forty-chapter book cannot push the back matter off the bottom of the panel —
 * which is exactly when a writer wants to reach it.
 */
function MatterCard({
  tone,
  label,
  description,
  meta,
  action,
  active,
  onAction,
  secondary,
  grow = false,
  compact = false,
  children,
}: {
  tone: MatterTone;
  label: string;
  /** Dropped once the card has been opened: a sentence explaining what body
   *  matter is has done its work the moment the chapters are on screen, and the
   *  room it was using is room the list can have. */
  description?: string;
  /** A figure under the description — the body's chapter count. */
  meta?: string;
  /** The button's words. It is the only control on the card, so this is the
   *  whole of what the card offers and is worth saying exactly. */
  action: string;
  /** True when the writer is inside this part of the book. */
  active: boolean;
  onAction: () => void;
  /**
   * A second button beside the first. Only the body has one — making a chapter
   * belongs with the chapters, not up in the panel's chrome where it was
   * competing with the way out of the panel.
   */
  secondary?: { label: string; onClick: () => void };
  grow?: boolean;
  /**
   * Shrink to a name and nothing else, because another card is using the room.
   *
   * The chapter list is the thing the panel exists for, and it was getting
   * whatever two explanatory cards left over. So when it opens, the other two
   * stand down to a strip — still there, still in their colour, still one click
   * from opening, but no longer spending a paragraph each on it.
   */
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const paint = MATTER_TONE[tone];

  if (compact) {
    return (
      <h3 className="shrink-0">
        <button
          type="button"
          onClick={onAction}
          aria-current={active ? "page" : undefined}
          // Filled rather than outlined, so the strip is still the card it was
          // — a writer picks these out by colour, and an outline at this height
          // is barely a line of it. The fill also makes the strip read as one
          // button, which it now is: there is nothing else on it to press.
          className={`flex w-full cursor-pointer items-center gap-2.5
                      rounded-xl px-3.5 py-2.5 text-left font-serif text-sm
                      font-semibold outline-none transition-colors
                      focus-visible:ring-2 focus-visible:ring-offset-2
                      ${paint.strip}
                      ${active ? `ring-2 ring-inset ${paint.ringInk}` : ""}`}
        >
          <span className="min-w-0 flex-1 truncate">{label}</span>

          {/* The verb the full card's button carried, kept so the strip still
              says what pressing it does — and whether the page exists yet. */}
          <span className={`shrink-0 font-sans text-xs ${paint.inkSoft}`}>
            {action}
          </span>
        </button>
      </h3>
    );
  }

  return (
    <section
      aria-current={active ? "page" : undefined}
      // Two pixels on every card, not only the selected one: a border that
      // thickens on selection would move the card's contents by a pixel each
      // time, and three cards nudging as you click between them is the kind of
      // thing you see without being able to say what you saw.
      className={`flex flex-col overflow-hidden rounded-xl border-2 bg-panel/60
                  transition-colors
                  ${active ? paint.borderActive : paint.border}
                  ${grow ? "min-h-0 flex-1" : "shrink-0"}`}
    >
      <div className="shrink-0 p-3.5">
        <h3 className="font-serif text-lg font-bold text-fg">{label}</h3>

        {/* Two lines at the panel's width: long enough to say what the part is,
            short enough that the card stays a card and not a paragraph.

            Set in fg at three-quarters rather than in muted. Muted is the
            weight for metadata a reader skips — timestamps, counts — and this
            is the one line on the card that has something to teach. It should
            read like text, not like a caption. */}
        {description && (
          <p className="mt-1.5 font-sans text-sm leading-relaxed font-medium text-fg/75">
            {description}
          </p>
        )}

        {meta && (
          <p className="mt-2 font-sans text-sm font-semibold text-fg">{meta}</p>
        )}

        {/* Two buttons of equal width when the card has a second one, not a
            primary with a smaller thing beside it: seeing the chapters and
            adding one are both ordinary, frequent moves, and picking a winner
            between them would only make the loser harder to hit. */}
        <div className="mt-3 flex items-stretch gap-2">
          <button
            type="button"
            onClick={onAction}
            aria-expanded={children ? !!grow : undefined}
            className={`flex-1 cursor-pointer rounded-lg py-2 font-sans text-sm
                        font-semibold outline-none transition-colors
                        focus-visible:ring-2 ${paint.button}`}
          >
            {action}
          </button>

          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              // Outlined in the card's own colour rather than filled: two solid
              // blocks side by side fight, and this is the card's second thing.
              className={`flex-1 cursor-pointer rounded-lg border-2 bg-transparent
                          py-2 font-sans text-sm font-semibold outline-none
                          transition-colors focus-visible:ring-2
                          ${paint.outline}`}
            >
              {secondary.label}
            </button>
          )}
        </div>
      </div>

      {/* Only the body has anything under the button, and only once opened.
          The floor matters: three cards plus a list is more than a laptop's
          panel can always hold, and a flex child with no minimum is squeezed to
          nothing rather than scrolling. Four rows and its own scrollbar is a
          usable list; a 2px sliver is not. */}
      {grow && children && (
        <ul className="scroll-slim min-h-24 flex-1 overflow-y-auto px-2 pb-2">
          {children}
        </ul>
      )}
    </section>
  );
}
