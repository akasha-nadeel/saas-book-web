"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PagePreview } from "@/components/editor/page-preview";
import { SharedBadge } from "@/components/collab/shared-badge";
import { relativeTime } from "@/lib/relative-time";
import { resumeChapter } from "@/lib/resume";
import {
  bookWordCount,
  chapterMatterOf,
  chapterNumberOf,
  canWriteBook,
  createChapter,
  createMatterPage,
  createMatterPages,
  deleteChapter,
  isSharedBook,
  orderedChapters,
  rememberMatterAsked,
  renameChapter,
  setChapterMatter,
  setChapterUnnumbered,
  shouldAskMatter,
  toggleBookmark,
  type Book,
  type ChapterMatter,
  type ChapterMeta,
} from "@/lib/library-store";
import type { MatterPart, MatterSection } from "@/lib/matter";
import { matterRows } from "@/lib/matter-list";
import { isDraftMatter } from "@/lib/export/blocks";
import { SwitchTrack } from "@/components/ui/switch";
import {
  RowMenu,
  menuIcons,
  type RowMenuItem,
} from "@/components/sidebar/row-menu";
import { MatterSetupDialog } from "@/components/editor/matter-setup-dialog";
import { SectionImportButton } from "@/components/editor/section-import";
import { ConfirmDialog, PromptDialog } from "@/components/ui/dialog";

/**
 * Moving a page between the parts, and why it is back.
 *
 * This menu offered **Move to front matter / the body / back matter** until
 * 2026-08-20, when the owner asked for them off: three destinations on every
 * page's menu, for a repair most books never need. The objection was right
 * about the *three* — one of them was always the part the page was already in,
 * so a third of that clutter did nothing at all.
 *
 * It came back the same day, and the reason is the import. `matterDivisionOf`
 * reads a heading against a table and calls everything it does not recognise a
 * chapter, which is the right default and is also, sometimes, wrong: a novel
 * with a chapter genuinely called "The End" now has it filed as back matter.
 * Widening that table — which is what makes the common case work — is only safe
 * while there is a way back from a wrong answer. Without this menu there was
 * none: the page could be deleted and typed again, and that is all.
 *
 * So: restored, minus the no-op. `destinationsFrom` leaves out the part the
 * page is in, so a row offers two moves rather than three.
 */
function destinationsFrom(
  bookId: string,
  chapterId: string,
  from: ChapterMatter,
): RowMenuItem[] {
  const all: { to: ChapterMatter; label: string }[] = [
    { to: "front", label: "Move to front matter" },
    { to: "body", label: "Move to the body" },
    { to: "back", label: "Move to back matter" },
  ];
  return all
    .filter((d) => d.to !== from)
    .map((d) => ({
      label: d.label,
      icon: menuIcons.movePart,
      onSelect: () => setChapterMatter(bookId, chapterId, d.to),
    }));
}

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
 * The card buttons, and they are the same on all three cards.
 *
 * They used to take the part's own fill — white on Front matter, mid-grey on
 * Body, charcoal on Back — which put three differently-coloured slabs down the
 * panel and made the *buttons* the loudest thing on a screen whose job is to
 * list a book.
 *
 * The style is the header's own — a hairline and the panel's raised value — so
 * the four controls at the top of the panel and the three down its side read as
 * one set of chrome rather than two vocabularies.
 *
 * **`hover:bg-line` works in both themes, and that is not a coincidence.** The
 * dark set lifts away from the ground (#1c1c1c → #262626) and the light set
 * deepens towards it (#e9e9ec → #e2e2e5), because the two blocks cross over —
 * which is the same reason `raised` means different things in each.
 */
/**
 * **The fill is stated against `fg`, not taken from `raised`, and that is the
 * fix rather than a preference.**
 *
 * These cards live inside `.panel-chrome`, which re-points the greys for the
 * left chrome: `raised` there is *6% ink on white*, and `line` is 10%. Those
 * are the right values for a hover wash and a hairline and the wrong ones for
 * the only control on a card — the button came out at 94% white with a border
 * you had to look for, which is what a *disabled* control looks like in every
 * other app a writer has used. Pressable and dark are the same signal.
 *
 * An alpha of the ink instead, so one pair of numbers works in both themes:
 * `fg` is near-black by day and near-white at night, so 14% is a legible grey
 * slab on the white card and a legible lift on the near-black one, and the
 * hover deepens by day and brightens at night without a second rule.
 *
 * Still grey, and deliberately. The palette spends its one hue on *the way
 * forward* and nothing else — three indigo buttons down a panel that lists a
 * book would make the chrome the loudest thing on the screen again, which is
 * the whole reason the parts' colour ladder came off these cards.
 */
const CARD_BUTTON = `border border-accent/30 bg-accent/15 text-black dark:text-fg
                     hover:border-accent/60 hover:bg-accent/25
                     focus-visible:ring-accent/50`;

/** The second control, when a card has one. Outlined, so the pair is not two
 *  identical slabs — the same relationship the header's controls have. Its edge
 *  matches the filled one's, or the two read as different kinds of thing. */
const CARD_OUTLINE = `border border-accent/30 bg-transparent text-black dark:text-fg
                      hover:border-accent/60 hover:bg-accent/10
                      focus-visible:ring-accent/50`;

/**
 * The open row in any of the three lists.
 *
 * Same chrome as the buttons, for the same reason: this used to take the part's
 * own fill, so the chapter you were reading was a white slab on the
 * front-matter list and a mid-grey one on the body's, and the panel had three
 * ways of saying one thing.
 *
 * **The hairline is what separates it from a hover**, which is also `raised`.
 * Two more signals back it up, because in daylight `line` and `raised` are a
 * few percent apart: the title takes medium weight, and the number or Draft
 * mark comes up out of muted into full ink. Selection is persistent and a hover
 * is under the pointer, so the two are never really confusable in use — but the
 * row has to be readable in a screenshot too.
 */
const ROW_ACTIVE = "border-line bg-raised font-medium text-fg";

/**
 * A card shrunk to a strip, when another part's list has the room.
 *
 * The strip is the whole control at that size, so it wore the part's fill to
 * say which part it was — three strips, three colours. It says it in words
 * instead now, which is what the label was always for, and the panel keeps one
 * button style from top to bottom.
 */
const CARD_STRIP = `border border-accent/30 bg-accent/15 text-black dark:text-fg hover:bg-accent/25
                    focus-visible:ring-accent/50`;

/**
 * The card's edge — one value for all three parts, and it says *selected*
 * rather than *which part*.
 *
 * **It used to be a three-step ladder** — white on Front matter, mid-grey on
 * Body, charcoal on Back, in the order a book is bound — so the border was
 * doing two jobs at once: telling you which part a card was, and telling you
 * which one you were in. It could not do both, and the half it failed at is the
 * half that matters. The palest step is a few percent off the ground it sits
 * on, so the *back matter card looked identical selected and unselected*; the
 * middle step was ambiguous; only the strongest one read at all. A writer
 * cannot compare three cards to work out which of them is "the dark one" — they
 * see one card at a time, and what they need to know from it is whether it is
 * the part they are in.
 *
 * So there is one edge now, at full ink, and the three cards are told apart by
 * the thing that was always going to tell them apart: their names. The two
 * rules that run from the selected card to the page take the same value, and so
 * does the sheet's own edge (`--paper-edge-on` in globals.css) — the point of
 * those was never the hue, it was that the page and the card it came from are
 * plainly the same colour.
 *
 * Written out as whole class names rather than built from a part name, because
 * Tailwind finds its utilities by reading the source: `border-matter-${part}`
 * is a string at runtime and an empty stylesheet at build time.
 */
const CARD_EDGE = "border-line";
const CARD_EDGE_ACTIVE = "border-fg";
/** The raw token, for the two rules drawn inline rather than from a utility. */
const CARD_EDGE_VAR = "--color-fg";

/**
 * Which part's list is open, remembered at module scope. Null is all three
 * shut, which is the panel's resting state.
 *
 * The panel is remounted every time the writer opens a different chapter, so
 * component state would put the list back to its default on each click —
 * clicking through a book would keep re-opening a list a writer had just shut.
 * Same reason the panel's face is held this way in the editor.
 *
 * Shut to begin with. The panel's first face is the book's three parts, whole
 * and equal; a list is what you ask for, not what you arrive at. It used to
 * open itself whenever the writer was in a numbered chapter, which is nearly
 * always — so nearly always the panel opened straight past its own front page.
 *
 * **One part at a time, and that is a layout fact rather than a preference.**
 * An open list takes the height the other two cards give up; two of them open
 * at once would each get half a panel, which on a laptop is three rows and a
 * scrollbar apiece. Opening one shuts the others.
 *
 * This was a boolean for as long as front and back matter were a single page
 * each — there was only ever the body's list to expand. They are lists of
 * pages now, so all three cards open, and the question changed from "is it
 * open" to "which one".
 */
let openPartMemory: ChapterMatter | null = null;

/**
 * A shape change that has to survive a page opening.
 *
 * Pressing Open or Chapters does two things at once: it changes what the cards
 * look like, and it opens a page. Opening a page remounts this panel, and a
 * remount is the end of any transition running through it — so the collapse
 * began, ran for three or four frames, and was dropped into place. That is the
 * stutter.
 *
 * Skipping the state change avoided the stutter by having nothing move at all,
 * which is not a fix. So the move is *carried across* instead: the shape the
 * writer left is recorded here, the panel mounts wearing it, and the new shape
 * is set a frame later. The transition then runs in full, on the far side of
 * the navigation, from exactly where it would have started.
 */
let arriving: {
  from: ChapterMatter | null;
  to: ChapterMatter | null;
} | null = null;

/** Open this part's list, or shut it if it is the one already open. */
function togglePart(part: ChapterMatter): ChapterMatter | null {
  openPartMemory = openPartMemory === part ? null : part;
  return openPartMemory;
}

function closeParts(): null {
  openPartMemory = null;
  return null;
}

/**
 * Which part's list is open, held above this panel.
 *
 * It lives up in the editor rather than in here because the manuscript needs it
 * too: the page's edge takes the colour of the part the panel says is selected,
 * and pressing Chapters selects the body. Two copies of this would be two
 * answers to the same question.
 */
export function useOpenPart() {
  /**
   * The move to finish, taken once and then held.
   *
   * Held in state rather than read from the module variable inside the effect,
   * because React mounts effects twice in development — run, clean up, run
   * again. An effect that took the move and cleared it found nothing on its
   * second run, cancelled the frames the first had booked, and left the cards
   * sitting in the shape they arrived in: press Chapters, land in Chapter One,
   * and the list never opens.
   *
   * The initializer only *reads*. Clearing happens in the effect, where doing
   * it twice costs nothing.
   */
  const [entrance] = useState(() => arriving);

  // Mounted wearing the shape the writer left, when there is a move to finish.
  const [open, setOpen] = useState(() =>
    entrance && entrance.from !== entrance.to ? entrance.from : openPartMemory,
  );

  useEffect(() => {
    arriving = null;
    if (!entrance || entrance.from === entrance.to) return;

    // Two frames, not one. The from-shape has to be *painted* before the change
    // for the browser to have anything to transition from; an effect runs after
    // the commit but still before that paint, and so does the first frame it
    // asks for. The second is the first one after the writer can see it.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setOpen(entrance.to));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [entrance]);

  return {
    /** The part whose list is showing, or null when all three are shut. */
    open,
    toggle: (part: ChapterMatter) => setOpen(togglePart(part)),
    close: () => setOpen(closeParts()),
    /**
     * Record a shape change that a page opening is about to interrupt.
     *
     * Used by the actions that navigate. Nothing moves in *this* mount — there
     * would be no time — but the move is not lost: see `arriving`, which hands
     * it to the next one to play out in full.
     */
    remember: (next: ChapterMatter | null) => {
      arriving = { from: openPartMemory, to: next };
      openPartMemory = next;
    },
  };
}

export type OpenPart = ReturnType<typeof useOpenPart>;

export function BookPanel({
  book,
  chapterId,
  cover,
  paper,
  mode,
  onMode,
  body,
  entering = false,
  always = false,
  connectToPage = true,
  onNavigate,
  onClose,
  className,
}: {
  book: Book;
  chapterId: string | null;
  cover: string | null;
  /** The page-colour preference, handed to the print preview. */
  paper: string;
  mode: BookPanelMode;
  onMode: (mode: BookPanelMode) => void;
  /* No `dictation`. This panel used to carry a second microphone beside the
     manuscript rail's, on the reasoning that a writer reading the chapter list
     might want to start speaking without going back to the page. One engine
     with two switches is a thing to keep in step for a control the writer only
     ever reaches by opening a list first, so the rail's is now the only one. */
  /** Which part's list is showing, owned by the editor — see useOpenPart. */
  body: OpenPart;
  /** Play the entrance. Set only when this panel’s face changes, never on the
   *  remount that opening a different chapter causes. */
  entering?: boolean;
  /** Show at every width. Set by the overview, where this is the only way in. */
  always?: boolean;
  /**
   * Draw the selected-card rule toward the live manuscript. A full-screen
   * mobile navigator deliberately has no visible page to connect to, even
   * though the preserved editor remains mounted behind its modal layer.
   */
  connectToPage?: boolean;
  /** Called before a chapter/page route is opened, so an overlay can dismiss. */
  onNavigate?: () => void;
  /** Hide or dismiss the panel. */
  onClose?: () => void;
  /** Optional custom class name override. */
  className?: string;
}) {
  const router = useRouter();
  const bookId = book.id;

  /*
   * May this writer change the manuscript?
   *
   * Read off the book rather than fetched: `sync.ts` puts the role on it on the
   * way down, so the answer is known during the first render — which matters,
   * because a control that appears and then vanishes is worse than one that was
   * never there. Absence of a role means the book is their own.
   */
  const canWrite = canWriteBook(book);

  /**
   * How far it is from the edge of these cards to the edge of the paper.
   *
   * The two rules that run out of the selected card have to *land* on the page,
   * and that distance is not a number anyone can write down: the page is
   * centred in whatever the window leaves and drawn at the writer's zoom, so it
   * moves with the window, with the zoom, and with the panel's own breakpoints.
   * Measured, then, and re-measured whenever either end moves.
   *
   * Zero where there is no page — the book overview shows these same cards with
   * a guide beside them rather than a manuscript, and a rule reaching for
   * nothing is worse than no rule.
   */
  const stackRef = useRef<HTMLDivElement>(null);
  const [gapToPage, setGapToPage] = useState(0);

  useEffect(() => {
    if (mode !== "chapters" || !connectToPage) return;

    let frame = 0;
    let last = -1;

    const measure = () => {
      // The card's own right edge, not the column's: the stack carries a
      // right padding, and measuring from outside it left every rule short by
      // exactly that much.
      const card = stackRef.current?.firstElementChild;
      const page = document.querySelector<HTMLElement>(".pageflow");

      // Three pixels past the paper's left edge, so the rule finishes *under*
      // the page's border instead of against it. Butted up, a hairline of
      // background shows between the two and the join looks like a near miss.
      const next =
        card && page
          ? Math.max(
              0,
              Math.round(
                page.getBoundingClientRect().left -
                  card.getBoundingClientRect().right +
                  3,
              ),
            )
          : 0;

      if (next !== last) {
        last = next;
        setGapToPage(next);
      }
      frame = requestAnimationFrame(measure);
    };

    // Measured every frame rather than watched.
    //
    // A ResizeObserver was the obvious answer and it is the wrong one: it
    // reports a box changing *size*, and most of what moves this page changes
    // only its *position*. The zoom control scales the page with CSS `zoom`,
    // which leaves its CSS box exactly as it was; opening the tool panel slides
    // the page sideways without resizing it at all. Both left the rules pointing
    // at where the paper used to be.
    //
    // Two getBoundingClientRect calls a frame is nothing, state is set only when
    // the number actually changes so React almost never re-renders, and the loop
    // runs only on this face of the panel — Book View has no page to reach.
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [connectToPage, mode]);

  const chapters = book.chapters;
  const bodyChapters = chapters.filter((c) => chapterMatterOf(c) === "body");
  const frontPages = chapters.filter((c) => chapterMatterOf(c) === "front");
  const backPages = chapters.filter((c) => chapterMatterOf(c) === "back");

  // Which part the open page belongs to. Read off the chapter itself rather
  // than by elimination: front and back matter are lists now, so "not the one
  // front page and not the one back page" no longer means body.
  const openChapter = chapterId
    ? (chapters.find((c) => c.id === chapterId) ?? null)
    : null;
  const openPart = openChapter ? chapterMatterOf(openChapter) : null;

  // The Book View flip-book: page 0 is the cover, 1…N the chapter's printed
  // pages. The preview reports its page count so the pager can clamp.
  /**
   * Whether to put the front/back-matter question, asked once per book.
   *
   * **Latched on mount rather than read each render**, which is what makes it a
   * question rather than a flicker: `shouldAskMatter` goes false the instant
   * the first page is created, so a live read would tear the dialog away
   * mid-answer. Held here rather than in the two screens above because both
   * mount this panel and the answer belongs to the cards it draws.
   *
   * The lazy initialiser reads storage during the first render, which is safe
   * for the same reason `useSyncExternalStore` snapshots are: it is a read, and
   * the server render never runs it — the panel is a client component that only
   * paints once the library has been read.
   */
  const [askMatter, setAskMatter] = useState(() => shouldAskMatter(book));

  const [previewIndex, setPreviewIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const prevPage = () => setPreviewIndex((i) => Math.max(0, i - 1));
  const nextPage = () => setPreviewIndex((i) => Math.min(pageCount, i + 1));

  const open = (id: string) => {
    onNavigate?.();
    router.push(`/book/${bookId}/chapter/${id}`);
  };

  const handleCreate = () => open(createChapter(bookId));

  /**
   * Where this book carries on — the chapter, or null for an empty one.
   *
   * Asked through `resumeChapter` rather than worked out here, so this button
   * and anything else that wants to know cannot arrive at different answers.
   */
  const resume = resumeChapter(book);

  /**
   * Back into the writing: the chapter list, and the chapter.
   *
   * The face change and the navigation both, because they are one intention.
   * `remember` rather than a plain toggle, since opening a page remounts this
   * panel and would cut the card's collapse off mid-move — see `arriving`.
   */
  const openBook = () => {
    onMode("chapters");
    if (!resume) return;
    body.remember("body");
    open(resume.id);
  };

  /**
   * Reveal a part's list — and, the first time, go to a page in it.
   *
   * Pressing Chapters used to reveal the list and leave the writer looking at
   * whatever page they were already on. The panel said body and the page said
   * title page, which is exactly the disagreement the coloured edge exists to
   * prevent. So opening a part the writer is not already inside takes them to
   * its first page as well.
   *
   * Only when they are not already in that part. A writer on Chapter Five who
   * opens the list wants the list, not to be sent back to the beginning of the
   * book — and shutting a list is never a reason to go anywhere.
   */
  const pagesOf = (part: ChapterMatter) =>
    part === "front" ? frontPages : part === "back" ? backPages : bodyChapters;

  const openPartList = (part: ChapterMatter) => {
    const pages = pagesOf(part);
    const goingToPage = body.open !== part && openPart !== part && !!pages[0];

    // Remembered rather than set when a page is about to open: the remount that
    // follows would cut the collapse off mid-move. See `remember`.
    if (goingToPage) {
      body.remember(part);
      open(pages[0].id);
      return;
    }
    body.toggle(part);
  };

  /**
   * A standard division switched on, and **the writer stays where they are.**
   *
   * The Add-page menu this replaced opened the new page, which was right for a
   * menu: you went looking for one page and got it. A switch is a setting, and
   * a writer setting up the front of a book flips four or five of them in a
   * row — opening each one would remount the editor and the panel underneath
   * them four or five times, and leave them somewhere they did not ask to be.
   * The row lighting up with its Draft mark is the answer, and the row is
   * still a press away from the page itself.
   */
  const handleSwitchOnMatterPage = (part: MatterPart, title: string) => {
    createMatterPage(bookId, part, title);
  };

  /**
   * A page the writer named themselves, opened so they can fill it in.
   *
   * Unlike the switch above: they have just typed a title for a page that is
   * on no list, so the page is what they were after.
   */
  const handleAddMatterPage = (part: MatterPart, title: string) => {
    const id = createMatterPage(bookId, part, title);
    if (!id) return;
    body.remember(part);
    open(id);
  };

  /**
   * Delete a page, and go somewhere if it was the one on screen.
   *
   * **Deleting used to leave the writer on the deleted page's URL**, which the
   * editor answers with "This chapter isn't here. It may have been deleted, or
   * the link may be wrong." Every word of that is true and the whole screen is
   * wrong: they know it was deleted, they did it a moment ago, and being asked
   * to press "Back to your books" sends them out of the manuscript entirely.
   *
   * So the neighbour takes its place. Only when the deleted page was the open
   * one: deleting Chapter Nine from inside Chapter Two is not a reason to move
   * Chapter Two off the screen.
   *
   * **Its neighbour within its own part, and only then anywhere.** Deleting a
   * chapter should land on a chapter; deleting a dedication should land on
   * another front-matter page. The first version took the neighbour from the
   * *stored* array, which is one flat sequence — and since a restored chapter
   * is appended to the end of it, deleting Chapter Two put the writer on the
   * prologue. Reading order is what a reader would call next, and staying
   * inside the part is what the writer meant.
   *
   * `replace` rather than `push`, so Back does not walk into the dead URL.
   *
   * The sidebar has always done a version of this
   * (`chapter-sidebar.tsx`), which is why the missing case only showed up here
   * — and it showed up much more often once front and back matter became lists
   * of pages a writer deletes the ones they do not want from.
   */
  /* Was `window.confirm`, which the browser can be told to stop showing — see
     `ui/dialog.tsx`. The row to delete waits in state until the question is
     answered; `handleDelete` below is unchanged and simply runs afterwards. */
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(
    null,
  );

  const handleDelete = (id: string) => {
    const part = pagesOf(openPart ?? "body");
    const within = part.findIndex((c) => c.id === id);
    const siblings = part.filter((c) => c.id !== id);

    // The page that slid up into its position, or the one before it at the end
    // of a list. With the part emptied, the next page in the book as a whole;
    // with the book emptied, the overview.
    const ordered = orderedChapters(book).filter((c) => c.id !== id);
    const next = siblings[within] ?? siblings[within - 1] ?? ordered[0] ?? null;

    deleteChapter(bookId, id);

    if (id !== chapterId) return;
    router.replace(
      next ? `/book/${bookId}/chapter/${next.id}` : `/book/${bookId}`,
    );
  };

  // The whole import flow moved to `import-chapter-button.tsx`, which is
  // rendered on the manuscript rail beside Export. It travelled as one piece —
  // the file input, the add-or-replace question, the undo banner and the
  // failure — because a button in one component and its dialog in another is
  // how a control ends up offered where it cannot be answered.

  return (
    <aside
      aria-label="Book"
      data-book-panel-mode={mode}
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
      className={`book-panel flex-col bg-white dark:bg-transparent ${
        className
          ? className
          : `w-72 shrink-0 xl:w-80 2xl:w-[22rem] ${
              always ? "flex" : "hidden xl:flex"
            }`
      }`}
    >
      {/* **Outside both modes' scroll containers, so it cannot be scrolled
          away.** This panel is the one piece of chrome mounted on the overview
          *and* the editor, which makes it the only place a single badge is
          present wherever a writer is inside the book. It draws nothing at all
          on a book of their own. */}
      {isSharedBook(book) && (
        <div className="px-6 pt-6">
          <SharedBadge book={book} />
        </div>
      )}

      {mode === "book" ? (
        /* Three bands, in the order a writer reads them: the page, what the
           book is, and the way out of here. `gap-7` sets the rhythm once
           instead of a different margin on each child, and the action is
           pushed to the foot by mt-auto so it sits in the same place whether
           the book is one chapter or forty. */
        <div className="scroll-slim flex h-full flex-col gap-7 overflow-y-auto px-6 py-8">
          {/* The cover on page 0; every page after it is the chapter as it will
              print, so the writer can flip through the finished pages here. */}
          <div
            className={`flex flex-col items-center gap-3 ${
              entering ? "book-cover-enter" : ""
            }`}
          >
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
          <div
            className={`rounded-xl border border-line bg-panel/70 p-4 ${
              entering ? "book-card-enter" : ""
            }`}
          >
            <h2 className="font-serif text-lg leading-snug font-medium text-fg">
              {book.title}
            </h2>

            <p className="mt-1.5 font-sans text-sm text-muted">
              <span className="font-medium text-fg">
                {bodyChapters.length.toLocaleString()}
              </span>{" "}
              <span className="text-chapter-fg">
                {bodyChapters.length === 1 ? "chapter" : "chapters"}
              </span>
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

            {/* **The one way back into the writing, and it carries on where
                the writer left off.**

                There used to be two: this button, which opened the chapter
                list, and a "Where you left off" card in the middle of the
                overview with a Carry on button under it. Two controls for one
                intention, on one screen, a hand's width apart — and the card
                was the one with the answer while this was the one that looked
                like the way in. So the card is gone and its job is here: press
                it and the chapter list opens *and* the chapter you were in
                does.

                It says which of the two it is doing, because "Chapters" on a
                button that jumps you into chapter nine is a name for the
                lesser half of what happens. A book with nothing written in it
                has nowhere to carry on to, and there it stays "Chapters". */}
            <button
              type="button"
              onClick={openBook}
              className="mt-4 w-full cursor-pointer rounded-lg bg-accent py-2.5
                         font-sans text-sm font-semibold text-accent-ink outline-none
                         transition-colors hover:bg-accent-strong
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              {resume ? "Carry on" : "Chapters"}
            </button>

            {/* Which chapter, and when — the two lines of the old card that
                were doing real work. The rest of it (the last paragraph, the
                note, who is in the scene) is on the page itself the moment the
                button is pressed, which is one press away rather than one
                screen away. */}
            {resume && (
              <p className="mt-2 text-center font-sans text-xs text-muted">
                {resume.title} · {relativeTime(book.lastOpenedAt)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col px-5 pt-4 pb-5">
          {/* The way back to Book View, and nothing else.
​
              This row used to hold four controls — back, a microphone and an
              import button behind a spacer. Both of those were second copies
              of something the manuscript's own rail already carried, and
              reaching them meant opening a list first; dictation lives on that
              rail and Import now sits beside Export there, which is the pair
              it belongs to.

              Back is an icon alone. A chevron at the left end of a bar is the
              one icon nobody has to be taught, and its name lives in the label
              and the tooltip for anyone who does. */}
          <div className="flex items-center justify-between gap-2">
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

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Hide panel"
                title="Hide panel"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center
                           rounded-lg border border-line text-muted outline-none
                           transition-colors hover:border-accent/60 hover:bg-raised hover:text-fg
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
                  <path d="M8 3.5v13" />
                </svg>
              </button>
            )}
          </div>

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
          <div
            ref={stackRef}
            className={`mt-3 flex min-h-0 flex-1 flex-col gap-2 pr-1 ${
              entering ? "matter-stack" : ""
            }`}
          >
            <MatterPagesCard
              gapToPage={gapToPage}
              part="front"
              label="Front matter"
              description="The pages before Chapter 1 — a title page, the copyright, a dedication."
              book={book}
              bookId={bookId}
              pages={frontPages}
              chapterId={chapterId}
              open={body.open === "front"}
              // Yields to whichever list is open, so exactly one part is ever
              // marked and the page's edge always has a card to match.
              active={
                body.open === "front" || (!body.open && openPart === "front")
              }
              compact={!!body.open && body.open !== "front"}
              onToggle={() => openPartList("front")}
              onAdd={(title) => handleAddMatterPage("front", title)}
              onSwitchOn={(title) => handleSwitchOnMatterPage("front", title)}
              onOpenPage={open}
              onDelete={(id, title) => setDeleting({ id, title })}
              onDeleteNow={handleDelete}
              canWrite={canWrite}
            />

            <MatterCard
              gapToPage={gapToPage}
              label="Body matter"
              description={
                body.open === "body"
                  ? undefined
                  : "The story itself, chapter by chapter, in reading order."
              }
              meta={
                <>
                  {bodyChapters.length}{" "}
                  <span className="text-chapter-fg">
                    {bodyChapters.length === 1 ? "chapter" : "chapters"}
                  </span>
                </>
              }
              action={body.open === "body" ? "Hide chapters" : "Chapters"}
              // Open counts as selected, as well as being in a chapter. The
              // page's edge is driven from the same expression upstream, so
              // this border and that edge cannot disagree — which is the only
              // reason "open" is allowed to mean "selected" at all.
              active={
                body.open === "body" || (!body.open && openPart === "body")
              }
              onAction={() => openPartList("body")}
              /* This part's own import, beside the two controls the card
                 already had. A reader is offered none of the three. */
              trailing={
                canWrite ? (
                  <SectionImportButton
                    book={book}
                    part="body"
                    label="Body matter"
                  />
                ) : undefined
              }
              compact={!!body.open && body.open !== "body"}
              // Only once the list is open. Shut, the card has one thing to
              // offer — open me — and a second button beside it halves the
              // width of that one thing to sit next to a list nobody is looking
              // at. The new chapter appears in the list it was added to, so the
              // button belongs where the list is.
              secondary={
                body.open === "body" && canWrite
                  ? { label: "New chapter", onClick: handleCreate }
                  : undefined
              }
              grow={body.open === "body"}
            >
              {bodyChapters.length > 0 ? (
                bodyChapters.map((c) => (
                  <ChapterPill
                    key={c.id}
                    number={chapterNumberOf(book, c.id)}
                    title={c.title}
                    active={c.id === chapterId}
                    onClick={() => open(c.id)}
                    // Empty for a reader: every item writes the chapter row.
                    menu={!canWrite ? [] : [
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
                        // A dialog rather than the sidebar's edit-in-place:
                        // the same three actions, without a second copy of the
                        // rename state to keep in step with it. It was
                        // `window.prompt` until the browser's own "stop showing
                        // these" made renaming fail silently — see `ui/dialog`.
                        onSelect: () =>
                          setRenaming({ id: c.id, title: c.title }),
                      },
                      /* **Only on the body's list, and only one item.** The
                         three Move-to-part entries came off this menu the same
                         day for being three destinations on every page; this is
                         one line, on the one list where it means anything — a
                         front-matter page is named rather than numbered and has
                         nothing to take out. See `ChapterMeta.unnumbered`. */
                      {
                        label: c.unnumbered
                          ? "Number this one"
                          : "Don’t number this one",
                        icon: menuIcons.numbering,
                        onSelect: () =>
                          setChapterUnnumbered(bookId, c.id, !c.unnumbered),
                      },
                      ...destinationsFrom(bookId, c.id, "body"),
                      {
                        label: "Delete",
                        icon: menuIcons.trash,
                        danger: true,
                        onSelect: () => setDeleting({ id: c.id, title: c.title }),
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

            <MatterPagesCard
              gapToPage={gapToPage}
              part="back"
              label="Back matter"
              description="The pages after the story — an epilogue, acknowledgements, about the author."
              book={book}
              bookId={bookId}
              pages={backPages}
              chapterId={chapterId}
              open={body.open === "back"}
              active={
                body.open === "back" || (!body.open && openPart === "back")
              }
              compact={!!body.open && body.open !== "back"}
              onToggle={() => openPartList("back")}
              onAdd={(title) => handleAddMatterPage("back", title)}
              onSwitchOn={(title) => handleSwitchOnMatterPage("back", title)}
              onOpenPage={open}
              onDelete={(id, title) => setDeleting({ id, title })}
              onDeleteNow={handleDelete}
              canWrite={canWrite}
            />
          </div>
        </div>
      )}

      {askMatter && (
        <MatterSetupDialog
          onCreate={(picks) => {
            setAskMatter(false);
            rememberMatterAsked(bookId);
            const first = createMatterPages(bookId, picks);
            if (!first) return;
            // Land on the first page they asked for, with its list open beside
            // it — the same move Start makes, so what they just chose is on
            // screen rather than behind a card.
            body.remember(picks[0].part);
            open(first);
          }}
          onSkip={() => {
            setAskMatter(false);
            rememberMatterAsked(bookId);
          }}
        />
      )}

      {renaming && (
        <PromptDialog
          title="Rename this chapter"
          label="Chapter title"
          initial={renaming.title}
          onSubmit={(next) => renameChapter(bookId, renaming.id, next)}
          onClose={() => setRenaming(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Move this to the trash?"
          body={
            <>
              <span className="text-fg">{deleting.title}</span> goes to this
              book&rsquo;s trash. You can restore it from there.
            </>
          }
          confirmLabel="Move to trash"
          onConfirm={() => handleDelete(deleting.id)}
          onClose={() => setDeleting(null)}
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
      // bg-panel, not white: a white disc here would be a bright hole punched
      // in a dark card. The panel's own value plus a hairline keeps it a disc.
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

/** A body chapter as a pill — numbered, filled with the body value when open. */
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
  mark,
  markColumn,
  onSwitchOff,
}: {
  number: number | null;
  title: string;
  active: boolean;
  onClick: () => void;
  menu: RowMenuItem[];
  /** A word in place of the number — "Draft" on an unfilled matter page. */
  mark?: string;
  /**
   * Keep the wide mark column on a row that has no mark.
   *
   * A matter list is mostly rows without one, and the column was sized per
   * row — so a finished dedication and a draft one started their titles four
   * characters apart, in a list whose whole job is being read down.
   */
  markColumn?: boolean;
  /**
   * The switch that takes this page back out of the book. Absent on a body
   * chapter, and on a book somebody let this writer only read.
   */
  onSwitchOff?: () => void;
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
                    py-2 pl-2.5 text-left font-sans text-sm outline-none
                    border transition-colors focus-visible:ring-2
                    focus-visible:ring-accent/50 ${
                      onSwitchOff ? "pr-11" : "pr-9"
                    } ${
                      active
                        ? ROW_ACTIVE
                        : "border-transparent text-fg hover:bg-raised"
                    }`}
      >
        {/* Fixed width and right-aligned, so the titles line up whether the
            number is 1 or 40 rather than stepping right as the book grows.

            A matter page has no number — it is named, not counted — so the
            column carries the template mark instead, which is the one thing
            about these pages worth seeing without opening them. */}
        <span
          className={`shrink-0 text-right text-[10px] tabular-nums ${
            mark
              ? "w-10 tracking-wide uppercase"
              : markColumn
                ? "w-10"
                : "w-5 text-xs"
          } ${active ? "text-fg" : "text-muted"}`}
        >
          {mark ?? number ?? ""}
        </span>

        <span className="min-w-0 flex-1 truncate">{title}</span>
      </button>

      {/* **No items, no trigger.** Every item in this menu writes the chapter row,
          so a book somebody let this writer *read* passes an empty list — and a ⋯
          that opens onto nothing is worse than no ⋯ at all. */}
      {menu.length > 0 && (
        <span
          className={`absolute top-1/2 -translate-y-1/2 ${
            onSwitchOff ? "right-11" : "right-1"
          }`}
        >
          {/* `active` keeps the trigger shown on the open chapter: its actions
              should be one click away rather than one hover, and it is the row a
              touch user cannot hover to find at all. */}
          <RowMenu label={title} items={menu} active={active} />
        </span>
      )}

      {/* **The switch says whether the book has this page at all**, which is
          the question the card is now a list of answers to.

          A sibling of the row's button rather than a child of it: a control
          inside a control is not a thing the platform has, and nesting them
          would make one press mean both "open this page" and "delete it". */}
      {onSwitchOff && (
        <span className="absolute top-1/2 right-1 -translate-y-1/2">
          <button
            type="button"
            role="switch"
            aria-checked={true}
            aria-label={`Take ${title} out of the book`}
            onClick={onSwitchOff}
            className="flex cursor-pointer rounded-full outline-none
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <SwitchTrack on={true} />
          </button>
        </span>
      )}
    </li>
  );
}

/**
 * A division the book has no page for yet.
 *
 * There is nothing to open, so the whole row *is* the switch — the shape every
 * settings list uses, and the reason the card no longer needs an Add page
 * menu. It keeps the page row's height, its left edge and its mark column so
 * the two read as one list rather than two.
 *
 * Quieter than a page row on purpose: `text-muted` and no mark. The card is a
 * list of what the book has, and these are the gaps in it — legible, one press
 * away, and not competing with the pages that are really there.
 */
function MatterOfferPill({
  section,
  onSwitchOn,
}: {
  section: MatterSection;
  onSwitchOn: () => void;
}) {
  return (
    <li className="relative">
      <button
        type="button"
        role="switch"
        aria-checked={false}
        onClick={onSwitchOn}
        /* The name as well as the hint, because this column is narrow enough
           to truncate the longest of them — "An excerpt from the next book"
           does not survive it — and a row you cannot finish reading is a row
           you cannot decide about. */
        title={`${section.title} — ${section.hint}`}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg
                   border border-transparent py-2 pr-11 pl-2.5 text-left
                   font-sans text-sm text-muted outline-none transition-colors
                   hover:bg-raised hover:text-fg focus-visible:ring-2
                   focus-visible:ring-accent/50"
      >
        <span aria-hidden="true" className="w-10 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{section.title}</span>
      </button>

      {/* Laid over the row and deaf to the pointer, so the press lands on the
          button underneath and the whole row is one target. There is no second
          thing to press here — unlike a page row, which also opens a page. */}
      <span className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2">
        <SwitchTrack on={false} />
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
 *
 * **One structure, both sizes.** The full card and the shrunk strip used to be
 * two separate returns, and nothing can transition between two trees — pressing
 * Chapters swapped them in the same frame, so the panel rearranged itself in a
 * cut. Everything the strip drops now lives in one collapsing region and the
 * header restyles in place, which is what lets the three cards resize together
 * over half a second instead of jumping.
 */
function MatterCard({
  label,
  description,
  meta,
  action,
  active,
  onAction,
  secondary,
  secondaryNode,
  trailing,
  grow = false,
  compact = false,
  gapToPage = 0,
  children,
}: {
  label: string;
  /** Dropped once the card has been opened: a sentence explaining what body
   *  matter is has done its work the moment the chapters are on screen, and the
   *  room it was using is room the list can have. */
  description?: string;
  /** A figure under the description — the body's chapter count. */
  /** A ReactNode rather than a string: the body card colours the word
   *  "chapter" and leaves the count in the panel's own ink. */
  meta?: React.ReactNode;
  /** The button's words. It is the only control on the card, so this is the
   *  whole of what the card offers and is worth saying exactly. */
  /** Undefined removes the button entirely — a reader's empty matter part has
   *  nothing to press, and an empty button is the dead UI the house rules
   *  forbid. */
  action?: string;
  /** True when the writer is inside this part of the book. */
  active: boolean;
  onAction: () => void;
  /**
   * A second button beside the first. Only the body has one — making a chapter
   * belongs with the chapters, not up in the panel's chrome where it was
   * competing with the way out of the panel.
   */
  secondary?: { label: string; onClick: () => void };
  /**
   * The second control, when it opens a menu rather than doing something.
   *
   * Front and back matter offer *which page to add*, which is a list rather
   * than an action — so the slot takes a node and the caller renders its own
   * trigger with `matterOutlineClass` on it, instead of this card growing a
   * second set of props describing somebody else's menu.
   *
   * Mutually exclusive with `secondary`; passing both draws both, which is a
   * caller error rather than a state worth guarding.
   */
  secondaryNode?: React.ReactNode;
  /**
   * A control at the end of the button row, outside the flex-1 share.
   *
   * The two above take an equal half of the row each, which is right for two
   * words apiece and wrong for a third: the body card would read
   * `[Hide chapters][New chapter][Import]` across a card about 250px wide and
   * the first label would not fit. This slot is for a square icon button that
   * takes only its own width, so the text buttons keep theirs.
   */
  trailing?: React.ReactNode;
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
  /** Distance from the panel to the page, measured upstream. Zero where
   *  there is no page to reach. */
  gapToPage?: number;
  children?: React.ReactNode;
}) {
  const listOpen = grow && !!children;
  // How far the rules run. Only the selected card draws them, and never a
  // shrunk one — three cards each trailing rules would be a diagram of
  // nothing, and a strip has no height to hang two of them on.
  const reach = active && !compact ? gapToPage : 0;

  return (
    <section
      aria-current={active ? "page" : undefined}
      // `relative` for the shrunk card's cover button, below.
      //
      // Shrinkable only while its list is open, and that is what stops a long
      // book running off the bottom of the panel. A flex item's natural size is
      // its content, and with the list open that content is every chapter row —
      // so `shrink-0` set a floor at the height of the whole list and the back
      // matter was pushed off the screen. Allowed to shrink, the card takes what
      // the panel has and the list scrolls inside it.
      //
      // **The closed ones keep `shrink-0`, and for a while only this comment
      // said so.** They were given plain `shrink` along with the open card,
      // which is the same thing flexbox does by default — so at thirty-odd
      // chapters the open card's content squeezed the other two until "Front
      // matter" and "Back matter" were clipped strips with their own titles cut
      // through. They hold two lines of text and have nothing to give: the card
      // with the list is the one thing on this panel that can absorb a long
      // book, because its list scrolls.
      //
      // Height is `grow` alone, never `flex-1`. `flex-1` sets a basis of 0%,
      // and switching a basis between 0% and auto is a discrete change no
      // transition can smooth — the card jumped to its new size and then eased
      // the leftovers, which is what made the collapse look broken. With the
      // basis left at auto, flex-grow 0 is the card's own content height and
      // flex-grow 1 is that plus the free space, and the number between them is
      // a real intermediate size.
      //
      // Two pixels of border on every card, not only the selected one: a border
      // that thickens on selection would move the card's contents by a pixel
      // each time, and three cards nudging as you click between them is the
      // kind of thing you see without being able to say what you saw.
      //
      // Shrunk, the border takes the fill's own colour rather than going
      // transparent, so the box does not appear to lose two pixels of height at
      // the same moment it is losing the rest.
      // Not overflow-hidden. It was, and the two rules below could not have
      // left the card — the collapsing regions inside clip themselves, so
      // nothing here needed it.
      className={`relative flex flex-col rounded-xl border-2
                  transition-[background-color,border-color,flex-grow]
                  duration-500 ease-out
                  ${
                    compact
                      ? CARD_STRIP
                      : `bg-white dark:bg-panel/60 ${
                          active ? CARD_EDGE_ACTIVE : CARD_EDGE
                        }`
                  }
                  min-h-0
                  ${listOpen ? "shrink grow" : "shrink-0 grow-0"}`}
    >
      {/* Two rules running out of the selected card towards the page, in that
          part's own colour — the page's edge is already wearing it, and these
          say the two are the same thing rather than leaving a reader to notice
          that they match.

          They fade out rather than meeting the paper. The gap between this
          panel and the page is not a number anyone can know: the page is
          centred in whatever is left of the window and drawn at the writer's
          zoom, so a rule of fixed length would fall short on one screen and lie
          across the paper on the next. A rule that fades has no endpoint to get
          wrong, and reads as reaching rather than as stopping short.

          Only when the card is the selected one — three cards each trailing
          rules would be a diagram of nothing. */}
      {[25, 75].map((y, i) => (
        <span
          key={y}
          aria-hidden="true"
          // Always mounted, and grown from nothing rather than switched on. A
          // rule that appears at its full length has nowhere to travel from,
          // and travelling out of the card to the paper is the whole point of
          // it — so the element is always here and its width is what changes.
          className="pointer-events-none absolute left-full h-1.5
                     -translate-y-1/2 rounded-r-sm transition-[width,opacity]
                     duration-700 ease-out"
          style={{
            top: `${y}%`,
            width: reach ? `${reach}px` : 0,
            opacity: reach ? 1 : 0,
            // A flat colour. It was a gradient fading to nothing, from back when
            // the distance was a guess and a rule had to have no endpoint to get
            // wrong — measured, it lands on the paper, and the fade was only ever
            // reading as a smear.
            backgroundColor: `var(${CARD_EDGE_VAR})`,
            // The lower one a beat behind the upper, so the pair draws itself
            // rather than arriving.
            transitionDelay: `${i * 110}ms`,
          }}
        />
      ))}

      {/* The one row that survives shrinking. It restyles rather than being
          replaced: the title steps down a size and takes the fill's ink, and
          the verb the button was carrying fades in beside it. */}
      <div
        className={`relative flex shrink-0 items-center gap-2.5 px-3.5
                    transition-[padding] duration-500 ease-out ${
                      compact ? "py-2" : "pt-3"
                    }`}
      >
        <h3
          className={`min-w-0 flex-1 truncate font-serif font-semibold
                      transition-[font-size,color,line-height] duration-500
                      ease-out ${compact ? "text-sm text-black dark:text-fg" : "text-base font-bold text-fg"}`}
        >
          {label}
        </h3>

        {/* Present in both sizes, so it can fade rather than appear. Out of the
            flow while the full card is showing — its own button says this
            already, and a second copy of the word beside the title is noise. */}
        <span
          aria-hidden={!compact}
          className={`shrink-0 font-sans text-xs transition-opacity duration-500
                      ease-out ${
                        compact
                          ? "text-black dark:text-fg opacity-100 font-medium"
                          : "w-0 overflow-hidden opacity-0"
                      }`}
        >
          {action}
        </span>

        {!compact && action && (
          <button
            type="button"
            onClick={onAction}
            aria-label={`${label} — ${action}`}
            aria-expanded={children ? listOpen : undefined}
            className="oc-matter-card-mobile-toggle absolute inset-0 hidden rounded-t-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset"
          />
        )}
      </div>

      {/* Everything the strip drops.
          A 1fr → 0fr grid row rather than a max-height guess: the row resolves
          to the content's own height, so the collapse is exact at any length of
          description and needs no number a longer sentence would break. */}
      <div
        /* `shrink`, not `shrink-0`: this block is what gives way when three
           cards are taller than the panel. Held rigid, the third card was
           simply pushed off the bottom of the screen with no way to reach it
           — a flex item that cannot shrink overflows its container rather
           than fitting in it. The inner `overflow-hidden` does the clipping,
           so a squeezed card loses the tail of its description and keeps its
           heading and its button, which are the parts you need. */
        className={`grid min-h-0 shrink transition-[grid-template-rows,opacity]
                    duration-500 ease-out ${
                      compact
                        ? "grid-rows-[0fr] opacity-0"
                        : "grid-rows-[1fr] opacity-100"
                    }`}
      >
        <div className="overflow-hidden">
          <div className="px-3.5 pt-1 pb-3">
            {/* Two lines at the panel's width: long enough to say what the part
                is, short enough that the card stays a card and not a paragraph.

                Set in fg at three-quarters rather than in muted. Muted is the
                weight for metadata a reader skips — timestamps, counts — and
                this is the one line on the card that has something to teach. It
                should read like text, not like a caption. */}
            {description && (
              <p className="font-sans text-[13px] leading-snug font-medium text-fg/75">
                {description}
              </p>
            )}

            {meta && (
              <p className="mt-1.5 font-sans text-xs font-semibold text-fg">
                {meta}
              </p>
            )}

            {/* Two buttons of equal width when the card has a second one, not a
                primary with a smaller thing beside it: seeing the chapters and
                adding one are both ordinary, frequent moves, and picking a
                winner between them would only make the loser harder to hit. */}
            <div className="mt-2.5 flex items-stretch gap-2">
              {action && (
              <button
                type="button"
                onClick={onAction}
                // Out of the tab order once shrunk: the cover button is the
                // control then, and a tab stop inside a zero-height box is a
                // focus ring on nothing.
                tabIndex={compact ? -1 : undefined}
                aria-expanded={children ? listOpen : undefined}
                // Smaller only when it is sharing the row. Alone it is the
                // card's one action and takes the card's full width, so it is
                // set at full size; beside a second button each has half the
                // room and the pair reads better a step down.
                className={`flex-1 cursor-pointer rounded-lg font-sans
                            font-semibold outline-none transition-colors
                            focus-visible:ring-2 ${CARD_BUTTON} ${
                              secondary || secondaryNode
                                ? "py-1.5 text-xs"
                                : "py-1.5 text-sm"
                            }`}
              >
                {action}
              </button>
              )}

              {secondaryNode}

              {secondary && (
                <button
                  type="button"
                  onClick={secondary.onClick}
                  tabIndex={compact ? -1 : undefined}
                  // Outlined in the card's own colour rather than filled: two
                  // solid blocks side by side fight, and this is the card's
                  // second thing.
                  className={`flex-1 cursor-pointer rounded-lg
                              py-1.5 font-sans text-xs font-semibold outline-none
                              transition-colors focus-visible:ring-2
                              ${CARD_OUTLINE}`}
                >
                  {secondary.label}
                </button>
              )}

              {trailing}
            </div>
          </div>
        </div>
      </div>

      {/* The chapter list, on the same kind of collapsing row, so the body card
          grows into its list at the rate the other two shrink out of theirs.

          The floor matters once it is open: three cards plus a list is more
          than a laptop's panel can always hold, and a flex child with no
          minimum is squeezed to nothing rather than scrolling. Four rows and
          its own scrollbar is a usable list; a 2px sliver is not. */}
      {children && (
        <div
          // Two things, and both are needed.
          //
          // `flex-1` is what fills the card once it is open — a basis of 0% so
          // the list takes whatever the card is given beyond its own content
          // and nothing before that.
          //
          // The 1fr → 0fr row is what makes "nothing before that" true. A
          // flex item with a basis of 0% still contributes its *content* to the
          // container's intrinsic height, so with the row left at 1fr the shut
          // list was silently making the card as tall as the chapters it was
          // hiding — which is what pushed the back matter off the panel. At 0fr
          // the row is genuinely zero and the card is its own content again.
          className={`grid min-h-0 flex-1 transition-[grid-template-rows,opacity]
                      duration-500 ease-out ${
                        listOpen
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="scroll-slim h-full overflow-y-auto px-2 pb-2">
              {children}
            </ul>
          </div>
        </div>
      )}

      {/* Shrunk, the whole card is one button — there is nothing else on it to
          press. An overlay rather than making the header a button at both
          sizes: the full card already has its own button, and a second control
          doing the same job is a question the reader has to stop and answer. */}
      <button
        type="button"
        onClick={onAction}
        aria-label={action ? `${label} — ${action}` : label}
        // Mounted at both sizes and switched off with pointer-events rather
        // than added and removed. Shrinking and growing take half a second, and
        // a control that appears or vanishes partway through that is a control
        // a writer can press at the moment it stops existing — which is exactly
        // the click that seems to do nothing.
        aria-hidden={!compact}
        tabIndex={compact ? undefined : -1}
        className={`absolute inset-0 rounded-xl outline-none
                    focus-visible:ring-2 focus-visible:ring-white/70
                    focus-visible:ring-inset ${
                      compact ? "cursor-pointer" : "pointer-events-none"
                    }`}
      />
    </section>
  );
}

/**
 * Front or back matter as a list of pages, the way the body is a list of
 * chapters.
 *
 * **This card used to open a page. Now it opens a part.** Front matter was one
 * page holding every standard division as a heading — Half-title, Title,
 * Copyright, Dedication, Epigraph, Contents, Preface, Prologue, stacked on a
 * single sheet with a blank line under each. A writer met eight printer's
 * terms at once, could not open one of them, could not delete the six they did
 * not want, and was told nothing about what belongs under any of them. Worse,
 * left alone that sheet exported: a reader opening the finished EPUB found a
 * bare list of terms between the cover and Chapter One.
 *
 * They are pages now. The card behaves like the body's — press it and the list
 * unfolds inside it, click a row to open that page, ⋯ to rename or move it —
 * because the three parts of a book are three of the same kind of thing and
 * the panel had been saying they were not.
 *
 * **Where the body lists chapters, this lists divisions**, and that is the one
 * place the two cards part company. A book has whatever chapters the writer
 * wrote; the divisions are a fixed catalogue of sixteen (`matter.ts`), and the
 * question about each is only ever whether this book has one. So every one of
 * them is a row with a switch — on when the page exists, off when it does not
 * — and the card is a list of answers rather than a list of pages.
 *
 * That replaced an **Add page** menu, which hid fourteen of the sixteen behind
 * a dropdown and left the card unable to say what it was for: a writer looking
 * at three rows had no way to know whether their book was missing a copyright
 * page or had never been offered one. Switching a row on is what adding a page
 * has become, and switching it off deletes it — into the book's trash, the
 * same soft delete the ⋯ menu's Delete does, so nothing said yes to here
 * cannot be taken back. A page with the writer's own prose on it still asks
 * first; see `switchOff` below.
 *
 * **The "draft" mark is the honest half.** Each page is seeded with the real
 * shape of the thing — `For [name].` for a dedication — and every line the
 * writer has to replace carries a `[bracket]`. A page with brackets left in it
 * does not go into the export, so the list says so on the row rather than
 * letting somebody discover it in the file. See `src/lib/matter.ts`.
 */
function MatterPagesCard({
  part,
  label,
  description,
  book,
  bookId,
  pages,
  chapterId,
  open,
  active,
  compact,
  gapToPage,
  onToggle,
  onAdd,
  onSwitchOn,
  onOpenPage,
  onDelete,
  onDeleteNow,
  canWrite,
}: {
  part: MatterPart;
  label: string;
  description: string;
  /** The whole book: the section import counts against it and dedupes on it. */
  book: Book;
  bookId: string;
  pages: readonly ChapterMeta[];
  chapterId: string | null;
  open: boolean;
  active: boolean;
  compact: boolean;
  gapToPage: number;
  onToggle: () => void;
  /** A page the writer named themselves. Creates it and opens it. */
  onAdd: (title: string) => void;
  /** A standard division switched on. Creates it and stays put. */
  onSwitchOn: (title: string) => void;
  onOpenPage: (id: string) => void;
  /** Confirms, deletes, and moves off the page when it was the open one. */
  onDelete: (id: string, title: string) => void;
  /** The same, with no question asked. Only for a page with nothing on it. */
  onDeleteNow: (id: string) => void;
  /** False for a book somebody let this writer read: no controls that write. */
  canWrite: boolean;
}) {
  /* Both were `window.prompt`, which the browser can be told to stop showing —
     see `ui/dialog.tsx`. Two questions, so two slots: naming a page that does
     not exist yet, and renaming one that does. */
  const [naming, setNaming] = useState(false);
  const [renamingPage, setRenamingPage] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const started = pages.length > 0;

  /**
   * Which of these pages is still all template.
   *
   * **Read during the render, and not memoised.** Bodies are read here and
   * nowhere else in this panel — the shelf holds titles and counts precisely so
   * that opening a book parses no prose — so this is a deliberate exception,
   * and it is kept honest by being small: at most a dozen very short documents,
   * only while the list is open, and a substring test rather than a parse.
   *
   * A memo was tried and was wrong in the one case that matters. There is no
   * key that changes when a page stops being a draft: the ids do not move, and
   * the word count does not either when `Copyright © [year] [author name]`
   * becomes `Copyright © 2026 Marguerite Hale` — five words before and five
   * after. `saveBody` skips the shelf write when the count is unchanged, so
   * every cached answer went stale exactly where a writer had just finished a
   * page and was looking at the list to see it.
   */
  const drafts = new Set<string>();
  if (open) {
    for (const page of pages) {
      // The same call the export and the reading view make, so a row
      // that says Draft and a file that leaves the page out can never
      // disagree. See `isDraftMatter`.
      if (isDraftMatter(page.id)) drafts.add(page.id);
    }
  }

  /**
   * Every division this part offers, whether or not the book has a page for
   * it — and the pages the book has that are on no list, at the end.
   *
   * The arithmetic is `matter-list.ts` rather than a sort here, because the
   * one rule that is easy to get wrong lives in it: a page the book already
   * has is never moved, and an offer sits exactly where switching it on would
   * put the page. See the note at the top of that file.
   *
   * **A reader sees the book that exists.** Filtering the offers out rather
   * than showing sixteen dead switches is the same choice the header buttons
   * make — a control that cannot be worked is worse than no control.
   */
  const rows = canWrite
    ? matterRows(part, pages)
    : matterRows(part, pages).filter((row) => row.kind === "page");

  /**
   * Switching a page off.
   *
   * **The question is only worth asking when there is something to lose.** A
   * page still carrying its `[brackets]` has nothing on it the writer wrote —
   * the export leaves it out for exactly that reason, and it goes to the
   * book's trash either way — so a dialog there is a speed bump in the middle
   * of setting up a book, four or five switches at a time. A page they have
   * actually written gets the same confirmation the row menu's Delete gives
   * it, because the switch must never be a quiet way to bin somebody's
   * dedication.
   *
   * `drafts` is the same `isDraftMatter` answer the row's mark is drawn from,
   * so the rule a writer can see on the row is the rule that decides.
   */
  const switchOff = (page: ChapterMeta) => {
    if (drafts.has(page.id)) onDeleteNow(page.id);
    else onDelete(page.id, page.title);
  };

  return (
    <MatterCard
      gapToPage={gapToPage}
      label={label}
      description={open ? undefined : description}
      meta={
        started
          ? `${pages.length} ${pages.length === 1 ? "page" : "pages"}`
          : undefined
      }
      // Always the same two words, where this used to say "Start" on an empty
      // part. There is no empty state left to start: a part with no pages
      // opens onto its eight offers with every switch off, which says what the
      // part is for far better than a button that made all eight at once.
      action={open ? "Hide pages" : "Pages"}
      active={active}
      onAction={onToggle}
      compact={compact}
      grow={open}
      /* This part on its own, from a file. Front matter, the chapters and back
         matter are often three documents rather than one, and the rail's
         whole-book import has no way to be told which of the three it is
         holding. See `section-import.tsx`. */
      trailing={
        canWrite ? (
          <SectionImportButton book={book} part={part} label={label} />
        ) : undefined
      }
    >
      {rows.map((row) =>
        row.kind === "offer" ? (
          <MatterOfferPill
            key={`offer:${row.section.title}`}
            section={row.section}
            onSwitchOn={() => onSwitchOn(row.section.title)}
          />
        ) : (
          <ChapterPill
            key={row.page.id}
            number={null}
            // Never a number — these pages are named, not counted. The column
            // carries whether the page is still scaffolding instead, which is
            // the one thing about it worth seeing from the list.
            mark={drafts.has(row.page.id) ? "Draft" : undefined}
            markColumn
            title={row.page.title}
            active={row.page.id === chapterId}
            onClick={() => onOpenPage(row.page.id)}
            onSwitchOff={canWrite ? () => switchOff(row.page) : undefined}
            menu={
              !canWrite
                ? []
                : [
                    {
                      label: "Rename",
                      icon: menuIcons.rename,
                      onSelect: () => {
                        setRenamingPage({
                          id: row.page.id,
                          title: row.page.title,
                        });
                      },
                    },
                    /* The direction that matters most for an import: a page the
                       catalogue put in the wrong part, back into the story. */
                    ...destinationsFrom(bookId, row.page.id, part),
                    {
                      label: "Delete",
                      icon: menuIcons.trash,
                      danger: true,
                      onSelect: () => onDelete(row.page.id, row.page.title),
                    },
                  ]
            }
          />
        ),
      )}

      {/* Only ever a reader: a writer always has sixteen rows, because the
          offers are rows. Somebody who was let in to read a part with no pages
          in it should be told that rather than shown a gap. */}
      {rows.length === 0 && (
        <li className="px-1 py-2 font-sans text-xs text-muted italic">
          No pages yet.
        </li>
      )}

      {/* **A page of the writer's own, and the last thing on the list.**
          The Add-page menu it came off carried this as "Something else…" —
          the switches replace the other sixteen entries, but not this one:
          nothing on a catalogue can express a page nobody has named yet, and
          a book with an "A note on the maps" in it is a book that needed one.

          A row rather than a button in the header, because it is not a peer of
          "Hide pages" — it is the end of the list it adds to. */}
      {canWrite && (
        <li className="relative">
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="flex w-full cursor-pointer items-center gap-2.5
                       rounded-lg border border-dashed border-line py-2 pr-3
                       pl-2.5 text-left font-sans text-sm text-muted
                       outline-none transition-colors hover:border-fg/35
                       hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/50"
          >
            <span aria-hidden="true" className="w-10 shrink-0 text-right">
              +
            </span>
            <span className="min-w-0 flex-1 truncate">Add your own page</span>
          </button>
        </li>
      )}

      {naming && (
        <PromptDialog
          title={`Add a ${part === "front" ? "front" : "back"}-matter page`}
          label="What is this page called?"
          confirmLabel="Add page"
          placeholder={part === "front" ? "Author's note" : "A note on the text"}
          onSubmit={onAdd}
          onClose={() => setNaming(false)}
        />
      )}

      {renamingPage && (
        <PromptDialog
          title="Rename this page"
          label="Page title"
          initial={renamingPage.title}
          onSubmit={(next) => renameChapter(bookId, renamingPage.id, next)}
          onClose={() => setRenamingPage(null)}
        />
      )}
    </MatterCard>
  );
}
