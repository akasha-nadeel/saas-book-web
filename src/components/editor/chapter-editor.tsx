"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  EditorContent,
  useEditor,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { useEditorState } from "@/components/editor/editor-toolbar";
import {
  EditorTopBar,
  FileMenuItem,
} from "@/components/editor/editor-top-bar";
import {
  FormatPill,
  useFormatPillVisible,
} from "@/components/editor/format-pill";
import {
  SETTLE_ZOOM_MS,
  anchorDelta,
  pagePointUnder,
  steppedZoom,
  zoomFromWheel,
} from "@/lib/editor/zoom";
import { useStoredZoom } from "@/lib/editor/use-stored-zoom";
import { suspendPagination } from "@/lib/editor/pagination";
import {
  WorkspaceRail,
  selectPanel,
} from "@/components/editor/workspace-rail";
import { ToolsPopover } from "@/components/editor/tools-popover";
import { icons } from "@/components/editor/icon-rail";
import { Tooltip } from "@/components/ui/tooltip";
import { ImportChapterButton } from "@/components/editor/import-chapter-button";
import { SelectionToolbar } from "@/components/editor/selection-toolbar";
import { ImageToolbar } from "@/components/editor/image-toolbar";
import { FormatControls } from "@/components/editor/format-controls";
import { MobileEditorHeader } from "@/components/editor/mobile-editor-header";
import { MobileWritingDock } from "@/components/editor/mobile-writing-dock";
import { MobileMoreControls } from "@/components/editor/mobile-more-controls";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Pagination, type PageGeometry } from "@/lib/editor/pagination";
import { clickToType } from "@/lib/editor/click-to-type";
import { keepCaretInView } from "@/lib/editor/caret-scroll";
import { FontSize } from "@/lib/editor/font-size";
import { FontFamily } from "@/lib/editor/font-family";
import { FontPreview } from "@/lib/editor/font-preview";
import { TextAlign } from "@/lib/editor/text-align";
import { NoIndent } from "@/lib/editor/no-indent";
import { SmartQuotes } from "@/lib/editor/smart-quotes";
import {
  SearchHighlight,
  clearSearchHighlights,
  deselectEditorText,
} from "@/lib/editor/search-highlight";
import {
  useDictation,
  useDictationLive,
  type Dictation,
} from "@/lib/editor/use-dictation";
import { ResizableImage } from "@/lib/editor/resizable-image";
import { usePreservedEditorSelection } from "@/lib/editor/preserved-selection";
import { EDITOR_LAYOUT_EVENT } from "@/lib/use-visual-viewport";
import { LeftPanel, type PanelTab } from "@/components/editor/left-panel";
import {
  BookPanel,
  useOpenPart,
  type OpenPart,
} from "@/components/editor/book-panel";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import { ShareDialog } from "@/components/collab/share-dialog";
import {
  bookWordCount,
  canWriteBook,
  chapterLabel,
  chapterMatterOf,
  chapterNumberOf,
  findBook,
  isGenericChapterTitle,
  pageSetupOf,
  renameChapter,
  clearRescue,
  rescueBody,
  saveBody,
  setPref,
  touchLastOpened,
  typographyOf,
  type Book,
  type Prefs,
} from "@/lib/library-store";
import { pageMetrics } from "@/lib/page-setup";
import { typographyVars } from "@/lib/typography";
import {
  useBodyReload,
  useChapterBody,
  useCover,
  useHydrated,
  usePrefs,
  useShelf,
} from "@/lib/use-library";
import { useTypewriter } from "@/lib/use-typewriter";
import { useAutosave, type SaveStatus } from "@/lib/use-autosave";
import { LoadingScreen } from "@/components/loading-screen";


const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved",
  saving: "Saving…",
  error: "Save failed",
};

/**
 * The height of one line of body text, in unzoomed page pixels.
 *
 * Measured from the caret at the end of the prose rather than read off the CSS,
 * so it is the line the new paragraphs will actually occupy — and so it stays
 * right at every zoom, which a computed `line-height` cannot be trusted to be.
 * Zero when it cannot be measured, which leaves the caret at the end of the text
 * instead of guessing a drop and getting it wrong.
 */
function lineHeightAtEnd(editor: Editor, scale: number): number {
  try {
    const at = editor.view.coordsAtPos(
      Math.max(0, editor.state.doc.content.size - 1),
    );
    const height = (at.bottom - at.top) / scale;
    return height > 0 ? height : 0;
  } catch {
    // coordsAtPos throws on a position it cannot map to the screen.
    return 0;
  }
}

/**
 * How large the page is actually drawn when the zoom reads 100%.
 *
 * A 6×9 novel page is a small sheet, and a screen pixel is nothing like a
 * printer's dot — drawn at its literal CSS size the type comes out smaller than
 * anyone would choose to write in. So 100% means "the size the page is meant to
 * be worked at" rather than "one CSS pixel per page pixel", which is a number
 * that means nothing to a writer and is not what any word processor shows
 * either. The zoom control counts from here: 100% is this, 110% is a tenth more.
 *
 * Only the drawing is scaled. The page is still 6×9 inches everywhere it
 * matters — page setup, pagination, and every export — so what is written is
 * unaffected by how big it looks.
 */
const PAGE_SCALE = 1.3;

/** What one autosave carries: the document, plus the count the sidebar shows. */
interface ChapterSnapshot {
  doc: JSONContent;
  words: number;
}

export function ChapterEditor({
  bookId,
  chapterId,
}: {
  bookId: string;
  chapterId: string;
}) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const prefs = usePrefs();
  const raw = useChapterBody(chapterId);
  const reload = useBodyReload(chapterId);
  const cover = useCover(bookId);

  const [editingCover, setEditingCover] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Lifted out of the surface so the toolbar and the assistant can both reach
  // it — they are siblings of the manuscript, not children of it.
  const [editor, setEditor] = useState<Editor | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  /**
   * Dictation lives here rather than in either button, because there are two of
   * them — one in the tool rail, one in the chapter list — and they must drive
   * the same engine. A hook per button would start two SpeechRecognition
   * sessions competing for one microphone, and each button would show only its
   * own half of the state.
   *
   * Words go in through the editor's own command, so dictated prose is
   * undoable, autosaved and counted like anything typed. The leading space is
   * what stops phrases running together: the recogniser returns "she opened the
   * door" with no trailing space, and the next phrase would begin against it.
   */
  const dictation = useDictation((text) => {
    // A phrase can arrive after the surface has gone — the writer navigating
    // away while still speaking. There is nowhere to put it, so it is dropped
    // rather than pushed into a dead instance.
    if (!editor || editor.isDestroyed) return;

    const at = editor.state.selection.from;
    const before = editor.state.doc.textBetween(Math.max(0, at - 1), at, " ");
    const needsSpace = before !== "" && before !== " " && before !== "\n";
    editor
      .chain()
      .focus()
      .insertContent(`${needsSpace ? " " : ""}${text}`)
      .run();
  });
  // The left panel here is tools only — the book panel beside the manuscript is
  // the chapter list, so offering a second one was the same list twice. With no
  /*
   * **Which panel is open, and whether it is, are stored rather than held.**
   *
   * They were `useState` here, and opening a chapter closed the panel. A route
   * change replaces this component's subtree, so the state went with it — and
   * both panels that list chapters hand the writer links *into* chapters, which
   * made the panel dismiss itself every time it was used for the thing it is
   * for. The search panel had it first and had it longest.
   *
   * A navigation is not a decision, and neither is a reload.
   */
  const tab = prefs.panelTab;
  const setTab = useCallback((next: PanelTab) => setPref("panelTab", next), []);
  const panelOpen = prefs.leftPanel;
  const setPanelOpen = useCallback(
    (open: boolean) => setPref("leftPanel", open),
    [],
  );
  const [mobileBookOpen, setMobileBookOpen] = useState(false);

  /**
   * The chrome, put away.
   *
   * Nothing is *closed* when it goes on — `panelOpen` and `tab` are left
   * exactly as they were, so coming back out puts the writer in front of the
   * same panel they left. The same reasoning as the navigator staying open
   * behind a tool panel: a mode that tidies up after you is a mode you have to
   * rebuild your desk from.
   */
  const focus = prefs.focusMode;
  const setFocus = useCallback((on: boolean) => setPref("focusMode", on), []);

  /**
   * Whether the panel is on screen.
   *
   * **It used to exclude the chapters tab**, because the navigator was a
   * second panel in a slot of its own with its own stored flag. It is the
   * `chapters` tab of this one now, so there is one question and one answer.
   *
   * The tools strip stands in the same place, so it takes the panel's
   * turn rather than sitting on top of it — and **the slot that holds the
   * page's width reads this same flag**, which is the half that was missed
   * first time round: hiding the panel while a 25rem spacer stayed behind left
   * a column of empty ground beside a 3rem strip. */
  /* The tools, the one rail tab that is not the panel: it opens as a strip
     at the rail’s edge instead — see `ToolsPopover` for why. Declared above
     the flag below, which reads it. */
  const [toolsOpen, setToolsOpen] = useState(false);

  const isLeftPanelOpen = panelOpen && !focus && !toolsOpen;

  /**
   * Whether the panel and page should play their entrance.
   *
   * The animations used to be mount-based, which meant they replayed on every
   * chapter click: opening a chapter remounts this editor, and a remounted node
   * runs its CSS animation again. A writer clicking down a list of forty
   * chapters watched the panel reassemble forty times.
   *
   * So it is switching the face that plays them, not mounting. False to begin
   * with — arriving at a chapter is not opening the section — and set true by
   * the one control that changes the face, then cleared once the longest of
   * them has finished.
   *
   * **Creating a book is the one arrival that does earn it.** `/book/new`
   * lands here with `?new=1`, and at that moment the three matter cards are
   * being seen for the first time with the pages the setup just made in them —
   * which is exactly the "the face changed" case above, reached by a different
   * route. Read with `useSearchParams` rather than `window.location`, the rule
   * the rest of the app follows: a lazy initialiser reading the location sees
   * the *previous* URL during a client navigation, and this arrives on a
   * `router.push`.
   */
  const isNewBook = useSearchParams().get("new") === "1";
  const [entering, setEntering] = useState(isNewBook);
  /* The flag is spent once. Dropped with `replaceState` rather than
     `router.replace` because nothing needs re-fetching — the point is only
     that a reload does not replay the entrance, and that a URL somebody keeps
     does not carry a setup flag around with it. */
  useEffect(() => {
    if (!isNewBook) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [isNewBook]);
  useEffect(() => {
    if (!entering) return;
    // Comfortably past the page's 760ms, which is the last to land. Removing
    // the class after the fact changes nothing on screen — the element is
    // already sitting at the animation's end state.
    const done = setTimeout(() => setEntering(false), 1100);
    return () => clearTimeout(done);
  }, [entering]);
  // Page zoom: state at the speed of a gesture, storage at the speed of a
  // setting. See `useStoredZoom`.
  const [zoom, setZoom] = useStoredZoom();

  /* Whether the work is safe, reported up from the surface that saves it so
     the bar above the rails can say so. See `onSaveState`. */
  const [saveState, setSaveState] = useState("");
  /* And how much of it there is. Same round trip, same reason. */
  const [words, setWords] = useState("");

  // Opening a book is worth marking; it renders faster than the eye can catch,
  // so the loading screen is held for a beat, then faded. It plays only on the
  // way *into* a book — the id above is remembered across the surface's remounts
  // between chapters, so flipping chapter to chapter never replays it.
  //
  const book = findBook(shelf, bookId);

  /*
   * **Whether this writer may share this book at all**, checked before the
   * button is drawn rather than after it is pressed.
   *
   * Two conditions, and both are refusals the *server* would make anyway — the
   * point of testing them here is that the house forbids dead UI, and a Share
   * button that opens a dialog which can only say no is exactly that.
   *
   * - **Accounts have to exist.** With no Supabase configured the app runs
   *   local-only and there is nobody to share with; `useMembers` already
   *   answers empty in that case, so the dialog would open onto a form whose
   *   Invite can never succeed.
   * - **Only the owner.** `book_members` is written by Server Actions that
   *   check ownership, and the seat count is taken under a row lock in SQL —
   *   an editor or a viewer pressing this gets a refusal from Postgres. A book
   *   carries `role` only when somebody else owns it, which is what
   *   `isSharedBook` reads, so this is the ownership test stated in the terms
   *   the store already has.
   */
  const canShare = false;
  // The rail's Import button is a write, so a viewer is not offered it. Asked
  // here as well as in `EditorSurface` because the rails are rendered by this
  // component and that one is a different scope.
  const canWriteThis = book !== null && canWriteBook(book);
  const chapter = book?.chapters.find((c) => c.id === chapterId) ?? null;

  // The part the open page belongs to, and the part the *panel* says is
  // selected. They are usually the same, and differ in one case: opening one
  // part's list while a page from another is on screen. The panel is the
  // writer's statement of what they are working on, so the page's edge follows
  // the selection rather than the page.
  const chapterPart = chapter ? chapterMatterOf(chapter) : "body";
  const body = useOpenPart();

  const selectedPart = body.open ?? chapterPart;

  /**
   * The editor, but only while there is one to act on.
   *
   * `editor` is state set from the surface's `onCreate`, so it outlives the
   * surface: the instance sits there destroyed until a new one replaces it.
   * The window that matters is the render between one chapter's editor being
   * destroyed and the next one's `onCreate` — anything that touches the
   * instance there reaches through a null `view`, and `editor.can()` in the
   * formatting rail throws outright.
   *
   * So the rail, the assistant and dictation all read this instead. Derived
   * rather than cleared in an effect, because an effect would leave exactly the
   * render that crashes. `isDestroyed` is safe to read on a dead editor — it
   * answers from `editorView?.isDestroyed ?? true` rather than assuming a view.
   */
  const liveEditor = !editor || editor.isDestroyed ? null : editor;

  const {
    capture: captureSelection,
    restore: restoreSelection,
    run: runWithSelection,
  } = usePreservedEditorSelection(liveEditor);

  const restoreEditorFocus = useCallback(() => {
    requestAnimationFrame(() => {
      restoreSelection();
      if (liveEditor && !liveEditor.isDestroyed) {
        liveEditor.commands.focus(undefined, { scrollIntoView: false });
      }
    });
  }, [liveEditor, restoreSelection]);

  const setEditorPanel = useCallback(
    (open: boolean) => {
      if (open) captureSelection();
      setPanelOpen(open);
      if (!open) restoreEditorFocus();
    },
    [captureSelection, restoreEditorFocus, setPanelOpen],
  );

  const closeMobileBookNavigation = useCallback(() => {
    setMobileBookOpen(false);
    restoreEditorFocus();
  }, [restoreEditorFocus]);

  const openMobileBookNavigation = useCallback(() => {
    captureSelection();
    // The chapter-title control asks for chapters, so it lands directly on
    // the body list. Front/back matter remain one tap away in the same view.
    if (body.open !== "body") body.toggle("body");
    // Never stack editor tools below a modal navigator.
    setPanelOpen(false);
    setFormatOpen(false);
    setMoreOpen(false);
    setMobileBookOpen(true);
  }, [body, captureSelection, setPanelOpen]);

  // ⌘K / Ctrl+K opens search in the panel, wherever the caret is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTab("search");
        setEditorPanel(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setEditorPanel, setTab]);

  /**
   * ⌘/ / Ctrl+/ shows and hides the panel.
   *
   * **A toggle, not a collapse.** The panel's handle only exists while the
   * panel does, so a shortcut that could only close would be a one-way door:
   * press it once and the keyboard has no way back. Both directions, from
   * anywhere, including with the caret in the manuscript.
   *
   * It sits beside ⌘K rather than in the panel, because it has to work when
   * the panel is not mounted — `LeftPanel` returns null until its first open.
   *
   * Registered on `keydown` with `preventDefault`, which is what stops Firefox
   * opening its quick-find on a bare `/` reaching the page.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setEditorPanel(!panelOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setEditorPanel, panelOpen]);

  /**
   * ⌘= / ⌘− / ⌘0, the zoom shortcuts every application has.
   *
   * **`preventDefault` is the whole reason these exist as well as the wheel
   * gesture.** Left alone, Ctrl+− shrinks the *browser* — chrome, panels and
   * all — which is never what somebody looking at a page of prose meant. So the
   * app has to claim them in order to do the right thing with them.
   *
   * `=` rather than `+`: the key is unshifted, and every application binds it
   * that way. Both are accepted, since a numeric keypad sends `+`.
   *
   * Beside ⌘K and ⌘/ so the editor's shortcuts stay in one place.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom(steppedZoom(zoom, 1));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom(steppedZoom(zoom, -1));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setZoom, zoom]);

  // Remembering the open chapter is what lets a book's route land the writer
  // back where they left off, so it is worth a write on every visit.
  useEffect(() => {
    if (hydrated) touchLastOpened(bookId, chapterId);
  }, [hydrated, bookId, chapterId]);

  // When switching to another tab on the left rail (Consistency check, Notes, Bible, etc.)
  // or closing the panel, deselect all search highlights and active selections in the manuscript
  useEffect(() => {
    if (!liveEditor || liveEditor.isDestroyed) return;
    if (tab !== "search" || !panelOpen) {
      clearSearchHighlights(liveEditor);
      deselectEditorText(liveEditor);
    }
  }, [tab, panelOpen, liveEditor]);

  const initialContent = useMemo<JSONContent | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as JSONContent;
    } catch {
      return null;
    }
  }, [raw]);

  // Nothing to render until storage has been read — see useHydrated.
  if (!hydrated) return <LoadingScreen />;
  if (!book || !chapter) return <MissingChapter />;

  return (
    /* **A bar across the top, and the rails under it.** There was no header at
       all: the way back to the shelf, the file-level actions and the save state
       were spread between the two rails and a thin strip that only said the word
       count. The bar spans the whole window, so the shell is a column now with
       the rail-and-page row inside it. */
    <div className="editor-shell flex h-full min-w-0 flex-col">
      {focus ? (
        /* **The whole of focus mode's chrome.**

           Fixed at the top left, over the page and clear of it — the paper is
           centred, so the corner is empty at every width. Always drawn and
           never on a timer or a hover: a hidden way out of a mode that hid
           everything else is exactly the trap the mode is worth avoiding.

           The same glyph as the button that turned it on, because they are one
           control saying *chrome on, chrome off* in the two places it can be
           said from. */
        <button
          type="button"
          onClick={() => setFocus(false)}
          aria-label="Leave focus mode"
          className="group fixed top-3 left-3 z-40 flex h-9 w-9 items-center
                     justify-center rounded-lg text-fg/70 outline-none
                     transition-colors hover:bg-raised hover:text-fg
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
          >
            {icons.panel}
          </svg>
          <Tooltip label="Leave focus mode" side="right" nowrap />
        </button>
      ) : (
      <EditorTopBar
        bookId={bookId}
        bookTitle={book.title}
        chapterTitle={chapter?.title ?? ""}
        words={words}
        saveState={saveState}
        focus={focus}
        onFocus={setFocus}
        history={<HistoryControls editor={liveEditor} />}
        /* **One row today, and that is the honest state of it.** A File menu
           is the right home for what acts on the manuscript as a file, and of
           those the book's own details is the only one that is not already a
           control on this bar: Import and Export are the two buttons at its
           right end, and putting them here as well would be one action with
           two entrances. Page setup belongs here next — `page-menu.tsx` holds
           it, and it draws its own menu, so it cannot simply be a row in this
           one. */
        fileActions={
          <FileMenuItem
            onClick={() => setEditingCover(true)}
            hint="Title, author, and the cover"
          >
            Book details…
          </FileMenuItem>
        }
        importControl={
          canWriteThis ? (
            <ImportChapterButton book={book} presentation="bar" />
          ) : null
        }
      />
      )}

      <div className="flex min-h-0 min-w-0 flex-1">
      {!focus && (
      <WorkspaceRail
        bookId={bookId}
        tab={tab}
        onSelectTab={setTab}
        leftPanel={panelOpen}
        onPanel={setEditorPanel}
        chapters
        // There is one rail now, so there is one way in. The assistant used
        // to be offered on both edges of the window — a sparkle on the right
        // beside the tools, a tab on the left — for one panel that opened in
        // the same place either way.
        assistant
        toolsOpen={toolsOpen}
        onTools={setToolsOpen}
        className="editor-workspace-rail hidden md:flex"
      />
      )}

      {/* Portalled and `fixed`, so it is drawn here only because this is where
          the state lives — on screen it stands at the rail’s edge. */}
      <ToolsPopover
        open={toolsOpen && !focus}
        onClose={() => setToolsOpen(false)}
        book={book}
        editor={liveEditor}
        paper={prefs.paper}
        typewriter={prefs.typewriter}
        dictation={dictation}
        canWrite={canWriteThis}
      />

      {/* One continuous gradient wash behind the book panel and the paper — the
          shelf hero's, in both themes — so the two read as one surface rather
          than separate sections. The children below are transparent; only the
          rails and the open left panel lay their own chrome over it. */}
      <div className="shelf-hero flex min-h-0 min-w-0 flex-1">
        {mobileBookOpen && (
          <MobileBookNavigation
            book={book}
            chapterId={chapterId}
            cover={cover}
            paper={prefs.paper}
            body={body}
            onNavigate={closeMobileBookNavigation}
            onClose={closeMobileBookNavigation}
          />
        )}

        {/* Rendered whether or not it is open: it owns its own mounting so it
            can animate its way out, and it renders nothing until first opened.
            See LeftPanel's `open`. It is `fixed` — it wants the window's full
            height, its own slide and a scrim on a phone — so the slot below
            holds the page's place for it. */}
        {/* **The card covers the panel, so the panel stands down under it.**

            Lighting only one rail tab was half the fix and looked like the
            whole of it: the card is a little narrower than the panel, so the
            panel's heading and the edges of its cards went on showing all
            round it — two things on screen at once for a rail claiming one.

            Open and *not visible*, not closed. `panelOpen` and `tab` are
            untouched, so putting the card away gives back the panel that was
            there — the same arrangement the navigator used to have behind a
            tool panel, and the reason is the same: a writer who opens a
            setting has not asked to lose their place. The slot below still
            holds the page's width for both, so nothing moves as one replaces
            the other. */}
        <LeftPanel
          open={isLeftPanelOpen}
          tab={tab}
          bookId={bookId}
          chapterId={chapterId}
          chapterTitle={chapter.title}
          editor={liveEditor}
          getChapterText={() => liveEditor?.getText() ?? ""}
          canWrite={canWriteThis}
          onClose={() => setEditorPanel(false)}
        />

        {/* **The left chrome is one slot, and the page sits beside it rather
            than under it.**

            The tool panel used to float over the manuscript: a 25rem sheet laid
            across the page, with its left margin and the first character of
            every line underneath. That reads as a panel covering the writing
            rather than standing next to it, and the one thing a writer needs to
            see while searching their book is the book.

            The panel cannot simply take a place in this row — `fixed` is what
            gives it the window's full height, its slide from the rail's edge
            and the phone's scrim — so this empty box takes it instead, at the
            same `--sidebar-width`. When the navigator is open it is already
            holding that width and the panel covers it exactly, so a spacer
            *as well* would push the page twice; hence the `&&`.

            The width transitions rather than switching, at the drawer's own
            220ms, so the page travels with the panel instead of arriving before
            it. `main` centres the paper in whatever is left (`.pageflow` is
            `margin: 0 auto`), and nothing here remounts — the pagination
            re-measures off its own ResizeObserver and the caret stays put. */}
        {isLeftPanelOpen && (
          <div
            aria-hidden="true"
            className="oc-panel-slot hidden w-(--sidebar-width) shrink-0
                       transition-[width] duration-[220ms]
                       ease-[cubic-bezier(0.22,0.61,0.36,1)] md:block"
          />
        )}

        {/* **The navigator is not here any more; it is the panel’s `chapters`
            tab.** It used to be a second panel in a slot of its own, with its
            own stored flag, its own dismiss and a special case in the rail for
            the one button that opened it rather than the panel — so the
            column made two different promises and nothing about a glyph said
            which you were about to get. `LeftPanel` already knew how to draw
            it (`ChapterSidebar` mounts the same `BookPanel`); the editor
            simply was not going through it. */}

        <div className="editor-main flex min-w-0 flex-1 flex-col bg-white dark:bg-transparent">
          {/* Keyed on the id and a cross-tab reload counter — not the stored
              text — so a save from another tab reloads the surface, while this
              tab's own autosaves never remount it mid-keystroke. */}
          <EditorSurface
            key={`${chapterId}:${reload}`}
            bookId={bookId}
            chapterId={chapterId}
            chapterTitle={chapter.title}
            chapterNumber={chapterNumberOf(book, chapterId)}
            // Front and back matter are designed on the page — a title page, a
            // dedication, an epigraph. Only they get click-and-type; a body
            // chapter flows. See handleSheetDoubleClick.
            placeable={chapterMatterOf(chapter) !== "body"}
            book={book}
            initialContent={initialContent}
            prefs={prefs}
            zoom={zoom}
            onZoom={setZoom}
            focus={focus}
            onSaveState={setSaveState}
            onWords={setWords}
            matter={selectedPart}
            entering={entering}
            dictation={dictation}
            onEditorReady={setEditor}
            formatOpen={formatOpen}
            assistantOpen={panelOpen && tab === "assistant"}
            moreOpen={moreOpen}
            onOpenChapters={openMobileBookNavigation}
            onFormat={() => {
              captureSelection();
              setMoreOpen(false);
              setFormatOpen((open) => !open);
            }}
            onAssistant={() => {
              captureSelection();
              selectPanel(
                "assistant",
                { tab, open: panelOpen },
                { onSelectTab: setTab, onPanel: setEditorPanel },
              );
            }}
            onMore={() => {
              captureSelection();
              setFormatOpen(false);
              setMoreOpen((open) => !open);
            }}
          />
        </div>

      </div>
      </div>

      {/* Rendered on the press and never from an effect, like every other
          dialog here. `ShareDialog` opens itself with `showModal`, so it sits
          in the browser's top layer and clears both rails and the tool panel
          without a z-index to keep in step with any of them. */}
      {sharing && (
        <ShareDialog
          bookId={bookId}
          bookTitle={book.title}
          onClose={() => {
            setSharing(false);
            restoreEditorFocus();
          }}
        />
      )}

      {editingCover && (
        <CoverDialog
          book={book}
          onClose={() => {
            setEditingCover(false);
            restoreEditorFocus();
          }}
        />
      )}

      {formatOpen && (
        <ResponsivePanel
          title="Format"
          presentation="sheet"
          onClose={() => {
            setFormatOpen(false);
            restoreEditorFocus();
          }}
        >
          {liveEditor ? (
            <FormatControls
              editor={liveEditor}
              book={book}
              paper={prefs.paper}
              runCommand={runWithSelection}
            />
          ) : null}
        </ResponsivePanel>
      )}

      {moreOpen && (
        <ResponsivePanel
          title="More writing tools"
          presentation="full"
          onClose={() => {
            setMoreOpen(false);
            restoreEditorFocus();
          }}
        >
          <MobileMoreControls
            book={book}
            prefs={prefs}
            dictation={dictation}
            canShare={canShare}
            runCommand={runWithSelection}
            onShare={() => {
              setMoreOpen(false);
              requestAnimationFrame(() => setSharing(true));
            }}
            onDetails={() => {
              setMoreOpen(false);
              requestAnimationFrame(() => setEditingCover(true));
            }}
          />
        </ResponsivePanel>
      )}
    </div>
  );
}

/**
 * The phone's chapter chooser is the same book-parts navigator used beside the
 * desktop manuscript. A native modal keeps the live editor mounted and inert
 * behind it, so opening the list cannot discard text, selection, or autosave
 * state. Wider layouts dismiss it as soon as the persistent navigator returns.
 */
function MobileBookNavigation({
  book,
  chapterId,
  cover,
  paper,
  body,
  onNavigate,
  onClose,
}: {
  book: Book;
  chapterId: string;
  cover: string | null;
  paper: string;
  body: OpenPart;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // No cleanup `close()`: React's development setup/cleanup/setup pass would
    // fire the native close event and remove the navigator immediately.
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const closeOnWideLayout = () => {
      if (root.dataset.editorLayout !== "continuous") ref.current?.close();
    };
    root.addEventListener(EDITOR_LAYOUT_EVENT, closeOnWideLayout);
    return () =>
      root.removeEventListener(EDITOR_LAYOUT_EVENT, closeOnWideLayout);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label="Choose a chapter or matter page"
      data-dialog-presentation="editor-full"
      onClose={onClose}
      className="oc-mobile-book-navigation fixed inset-x-0 top-(--oc-visual-offset-top) m-0 h-[var(--oc-visual-height)] max-h-none w-full max-w-none overflow-hidden border-0 bg-surface p-0 text-fg backdrop:bg-black/65"
    >
      <BookPanel
        book={book}
        chapterId={chapterId}
        cover={cover}
        paper={paper}
        body={body}
        always
        connectToPage={false}
        onNavigate={onNavigate}
        onClose={onClose}
      />
    </dialog>
  );
}

/**
 * The document position nearest a click on the blank part of the page — Word's
 * "click and type". ProseMirror's posAtCoords resolves a point over the text; a
 * click in a side margin is retried with x pulled into the text column so it
 * maps to the nearest line, and a click below the last line or above the first
 * falls to the end or start of the document. Null when nothing sensible is near,
 * so the caller just focuses at the existing caret.
 */
function nearestTextPos(
  editor: Editor,
  clientX: number,
  clientY: number,
): number | null {
  const view = editor.view;
  const direct = view.posAtCoords({ left: clientX, top: clientY });
  if (direct) return direct.pos;

  const rect = view.dom.getBoundingClientRect();
  // A margin click: nudge x just inside the text column, keep the click's y, so
  // the nearest line on that row is found.
  const clampedX = Math.min(Math.max(clientX, rect.left + 1), rect.right - 1);
  const onLine = view.posAtCoords({ left: clampedX, top: clientY });
  if (onLine) return onLine.pos;

  // Below all text → end of the document; above the first line → its start.
  if (clientY > rect.bottom) {
    return Math.max(0, editor.state.doc.content.size - 1);
  }
  if (clientY < rect.top) return 0;
  return null;
}

function MissingChapter() {
  return (
    <main className="flex h-full items-center justify-center px-6">
      <div className="text-center">
        <p className="font-serif text-xl text-fg">This chapter isn’t here.</p>
        <p className="mt-2 font-sans text-sm text-muted">
          It may have been deleted, or the link may be wrong.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-sm font-sans text-sm text-accent
                     underline underline-offset-4 outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Back to your books
        </Link>
      </div>
    </main>
  );
}

function EditorSurface({
  bookId,
  chapterId,
  chapterTitle,
  chapterNumber,
  placeable,
  book,
  initialContent,
  prefs,
  zoom,
  onZoom,
  focus,
  onSaveState,
  onWords,
  matter,
  entering,
  dictation,
  onEditorReady,
  formatOpen,
  assistantOpen,
  moreOpen,
  onOpenChapters,
  onFormat,
  onAssistant,
  onMore,
}: {
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  /** The body-chapter number, or null for front and back matter — which are
   *  named, so no number is printed above their title. */
  chapterNumber: number | null;
  /** Whether a double-click on blank page may place a line there. True only for
   *  front and back matter — see handleSheetDoubleClick. */
  placeable: boolean;
  book: Book;
  initialContent: JSONContent | null;
  prefs: Prefs;
  zoom: number;
  onZoom: (zoom: number) => void;
  /**
   * Whether the chrome is put away.
   *
   * The phone’s header and its writing dock belong to this component, so focus
   * mode has to reach them here. Everything else it hides is a sibling of this
   * surface and is simply not rendered.
   */
  focus: boolean;
  /**
   * Reports whether the work is safe, in the words this component already
   * uses, so the bar above the rails can show it.
   *
   * A callback because the autosave lives down here with the editor it is
   * saving, and the bar lives up there with the rails it spans. Hoisting the
   * whole of `useAutosave` to reach it would move a hook to a component that
   * needs nothing else from it; reporting one string upward is the smaller
   * compromise.
   */
  onSaveState?: (label: string) => void;
  /**
   * How much has been written, in the words the bar prints verbatim.
   *
   * Reported rather than recomputed up there, for the reason the save state is:
   * the count is the surface’s, and a second call to `bookWordCount` in the
   * shell would be a second answer to one question the moment either changed.
   */
  onWords?: (label: string) => void;
  /** What the panel has selected — the sheet's edge takes its colour. */
  matter: "front" | "body" | "back";
  /** Play the page's entrance. Set only when the panel's face changes, never
   *  on the remount that opening a different chapter causes. */
  entering: boolean;
  /** The one session, for the listening bar in the desk strip. */
  dictation: Dictation;
  onEditorReady: (editor: Editor) => void;
  formatOpen: boolean;
  assistantOpen: boolean;
  moreOpen: boolean;
  onOpenChapters: () => void;
  onFormat: () => void;
  onAssistant: () => void;
  onMore: () => void;
}) {
  const holdCaret = useTypewriter(prefs.typewriter);

  /*
   * May this writer change the manuscript?
   *
   * Read off the book rather than fetched, which is what makes it usable here:
   * `sync.ts` puts the role on the `Book` on the way down, so the answer is known
   * during the first render. Absence of a role means the book is this writer's
   * own — a book made offline carries none.
   */
  const canWrite = canWriteBook(book);

  /**
   * Where the pointer went down, so a click can tell itself apart from a drag.
   *
   * Both handlers below place the caret, which *collapses* whatever is
   * selected — and a browser fires `click` at the end of a drag as well as at
   * the end of a press. So sweeping a selection that began anywhere but inside
   * the prose ended with the selection thrown away the instant the button came
   * up: the writer had to click into a paragraph first and only then drag,
   * because a drag starting in a margin or on the blank foot of a sheet undid
   * itself.
   *
   * Refreshed on every press rather than cleared on read: a click on the page
   * bubbles through both handlers, and a getter that consumed the value would
   * answer honestly the first time and wrongly the second.
   */
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  /** Three pixels of travel is a drag, not a click — enough to forgive the
   *  shake in a press, far less than the smallest deliberate sweep. */
  const draggedHere = (e: { clientX: number; clientY: number }) => {
    const start = pressAt.current;
    if (!start) return false;
    return (
      Math.abs(e.clientX - start.x) > 3 || Math.abs(e.clientY - start.y) > 3
    );
  };

  /**
   * A sweep that begins on the chapter's title and carries on down the page.
   *
   * The title is an `<input>`, and a browser will not extend a selection out of
   * a form field into the document around it — so a drag that started on the
   * chapter's name selected the name and stopped dead there, however far down
   * the page the pointer went. Nothing in our code was doing it; it is simply
   * what a field is.
   *
   * So the manuscript picks the drag up where the browser drops it. The moment
   * the pointer leaves the field with the button still down, the field lets go
   * and the prose takes over, selecting from its first character to wherever
   * the pointer has reached, and following it until the button comes up.
   *
   * **A `pointerleave` is not proof the pointer moved, and taking it as one
   * made the title look unclickable.** Boundary events fire whenever the hit
   * target under the pointer changes — including when the *element* moves and
   * the pointer does not. Clicking the title focuses it, focusing it can scroll
   * it into view inside the page flow, and the field then slides out from under
   * a perfectly still cursor: `pointerleave` with the button still down, and
   * this handler blurred the field a few milliseconds after the click gave it
   * focus. From the writer's side the title lit up and went dead again, which
   * reads as a field that refuses to be edited.
   *
   * So a drag now has to be a drag: the press must have started in the field,
   * and the pointer must have travelled far enough to mean it. Below that the
   * field keeps the focus the click just gave it, which is the whole of the
   * common case.
   */
  const titleDragFrom = useRef<{ x: number; y: number } | null>(null);

  /** Where the press began, so a leave can tell a drag from a shifting page. */
  const startTitleDrag = (e: React.PointerEvent<HTMLInputElement>) => {
    titleDragFrom.current =
      e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
  };

  const dragOutOfTitle = (e: React.PointerEvent<HTMLInputElement>) => {
    // Left button only, and only while it is actually held: a pointer merely
    // passing over the title on its way somewhere else must do nothing.
    if (e.buttons !== 1 || !editor || !editor.isEditable) return;

    /* A press that did not begin in the field is somebody dragging *through*
       it from elsewhere; the prose already owns that selection. */
    const from = titleDragFrom.current;
    if (!from) return;

    /* Far enough to be a hand rather than a repaint. Four pixels is the slop
       every drag threshold in the trade uses, and it is well under the distance
       a writer covers on the way to the prose. */
    if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < 4) return;

    titleDragFrom.current = null;
    e.currentTarget.blur();

    const extendTo = (x: number, y: number) => {
      const at = editor.view.posAtCoords({ left: x, top: y });
      // Past the last line, posAtCoords gives nothing; the end of the prose is
      // what the pointer is over in that case.
      const to = Math.max(1, at ? at.pos : editor.state.doc.content.size - 1);
      editor
        .chain()
        // Never scrolls: the writer is dragging, and the page moving under the
        // pointer would take the text out from under it.
        .focus(undefined, { scrollIntoView: false })
        .setTextSelection({ from: 1, to })
        .run();
    };

    extendTo(e.clientX, e.clientY);

    const follow = (ev: PointerEvent) => extendTo(ev.clientX, ev.clientY);
    const release = () => {
      titleDragFrom.current = null;
      window.removeEventListener("pointermove", follow);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
    window.addEventListener("pointermove", follow);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
  };

  const page = pageSetupOf(book);
  const metrics = pageMetrics(page);
  const written = bookWordCount(book);

  // The page flow — every sheet — so a click anywhere on it can be measured
  // against the pages. See handleSheetDoubleClick.
  const flowRef = useRef<HTMLDivElement>(null);

  // Page geometry in CSS pixels (96 to the inch), for the print-layout sheets.
  const PX = 96;
  const geom = useMemo<PageGeometry>(
    () => ({
      pageW: metrics.width * PX,
      pageH: metrics.height * PX,
      mT: metrics.top * PX,
      mB: metrics.bottom * PX,
      mL: metrics.left * PX,
      mR: metrics.right * PX,
      contentH: (metrics.height - metrics.top - metrics.bottom) * PX,
      // The desk gap between one sheet and the next.
      gap: 24,
    }),
    [
      metrics.width,
      metrics.height,
      metrics.top,
      metrics.bottom,
      metrics.left,
      metrics.right,
    ],
  );

  // The pagination plugin reads geometry and reports the page count through
  // these refs, so the one editor instance never has to be rebuilt when the
  // page setup or the page count changes.
  const geomRef = useRef<PageGeometry | null>(geom);
  const [pageCount, setPageCount] = useState(1);

  // Read from inside the editor's own scroll handler, which is bound once when
  // the editor is built and so cannot close over a changing preference.
  const typewriterRef = useRef(prefs.typewriter);
  useEffect(() => {
    typewriterRef.current = prefs.typewriter;
  }, [prefs.typewriter]);

  const { schedule, status, lastSavedAt } = useAutosave<ChapterSnapshot>({
    /* **Awaited, which is what makes the word in the corner true.**
       The manuscript is on IndexedDB now, so "we have it" and "the disk has it"
       are two different moments; `saveBody` resolves at the second one and
       rejects if the bytes never landed, and the autosave turns that into
       "Saved" or "Save failed". A version of this that did not wait would print
       "Saved" while the write was still in the air — which is the "Saved beside
       a QuotaExceededError" this app has already met once.

       A resolved `false` is the viewer refusal and is deliberately *not* an
       error: the surface is not editable for a viewer, so reaching it means a
       bug upstream rather than something to report at the bottom of the
       screen. */
    save: async ({ doc, words }) => {
      await saveBody(bookId, chapterId, doc, words);
      /* The rescue slot has done its job the moment the real write lands.
         Left behind, it would be replayed over a *newer* body on the next
         load — the one case where putting writing back would take some away. */
      clearRescue(chapterId);
    },
    /* **The page is closing and there is no time to await anything.** The
       flush below starts an IndexedDB write the browser will not wait for, so
       the pending doc goes to `localStorage` synchronously first and is
       replayed by `loadFromDisk` next time. See `rescueBody`. */
    rescue: ({ doc, words }) => rescueBody(chapterId, doc, words),
  });

  const editor = useEditor({
    // Required under Next's SSR — rendering immediately causes a hydration
    // mismatch, since the server has no contenteditable to produce.
    immediatelyRender: false,
    /*
     * **A book somebody let this writer *read* is not typeable, and this is the
     * one place that can say so.**
     *
     * The database refuses a viewer's write and `saveBody` refuses to cache it
     * locally, so nothing is lost either way — but a surface that accepts
     * keystrokes and quietly discards them is the worst of the three answers. It
     * lets somebody write a page before finding out.
     *
     * `useBookRole` is synchronous — `sync.ts` puts the role on the `Book` on the
     * way down — which is what makes this safe to decide here. A role that
     * resolved a moment later would leave the surface briefly typeable, which is
     * exactly long enough to lose a sentence in.
     */
    editable: canWrite,
    extensions: [
      StarterKit,
      CharacterCount,
      Placeholder.configure({ placeholder: "Begin your chapter…" }),
      // Images are stored inline as data URLs — see lib/image-import for why
      // they are downscaled first. ResizableImage adds width/alignment and the
      // drag handles, so a picture can be handled like a word processor's.
      ResizableImage.configure({ inline: false, allowBase64: true }),
      // Inline font sizing, so a selection can be resized without turning its
      // whole paragraph into a heading.
      FontSize,
      FontFamily,
      // Draws only — see font-preview.ts. No mark, no history, no autosave.
      FontPreview,
      // Per-paragraph alignment (left / centre / right / justify).
      TextAlign,
      // The flush-at-the-margin mark a click-placed line carries, so it begins
      // where the caret was shown rather than a first-line indent in from it.
      NoIndent,
      /* Curly quotes, the em dash and the ellipsis, as a book prints them.
         Input rules, so nothing already written is touched. */
      SmartQuotes,
      // Search match highlights in the live manuscript (active match = green, others = grey).
      SearchHighlight,
      // Print layout: measures the prose and lays it out on real page sheets.
      // The closures are held by the plugin and only ever run later, from its
      // measure loop — never during render — so reading the ref here is safe.
      /* eslint-disable-next-line react-hooks/refs */
      Pagination.configure({
        getGeometry: () => geomRef.current,
        onPages: setPageCount,
      }),
    ],
    content: initialContent ?? "",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Chapter text",
        spellcheck: "true",
      },
      // Pasted text (from the web, Word, an AI chat) usually carries its own
      // `text-align` baked into the markup — often justified — which then fights
      // the alignment buttons. Stripping it on the way in makes pasted text land
      // on the book default, so a writer's alignment choices are the ones that
      // hold, exactly as they do for text typed here.
      transformPastedHTML: (html) =>
        html.replace(/text-align\s*:\s*[^;"']*;?/gi, ""),
      // Keep the page still while typing, like a word processor: it moves only
      // when the caret would otherwise leave the window, and then by exactly the
      // overshoot — never a screenful, never to recentre. Returning true tells
      // ProseMirror the scroll is handled, so its own "chase the caret" pass,
      // which jumps a whole page-gap when a seam opens, never runs.
      //
      // Typewriter scrolling, when on, owns the view instead: it holds the caret
      // in a band and would fight a second correction here. See useTypewriter.
      handleScrollToSelection: (view) => {
        if (!typewriterRef.current) keepCaretInView(view);
        return true;
      },
      handleDOMEvents: {
        /**
         * **Selected prose cannot be dragged; a picture still can.**
         *
         * ProseMirror drags a text selection by default, and in a manuscript
         * that is a way to lose a paragraph rather than a way to move one: the
         * gesture that starts it — press inside the words you have just
         * highlighted, move the pointer — is the same one a writer makes to
         * *extend* a selection, so a sentence lands somewhere nobody chose and
         * the only sign is that the prose has changed under the pointer. Cut
         * and paste says where the text went and can be undone in one step.
         *
         * Refused here rather than with `user-select` or `-webkit-user-drag`:
         * both of those would take the *selection* away too, and selecting is
         * the thing this has to leave working.
         *
         * The exception is the one drag the editor deliberately offers —
         * `data-drag-handle` on the image frame, which is the only way to move
         * a picture (see `image-node-view.tsx`). Anything else is prose.
         *
         * `preventDefault` stops the browser's own drag of the selection, and
         * the `true` stops ProseMirror's: it is consulted before the built-in
         * handler, so returning handled means `view.dragging` is never set and
         * there is no drop for it to complete.
         */
        dragstart: (_view, event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest?.("[data-drag-handle]")) return false;
          event.preventDefault();
          return true;
        },
      },
    },
    onCreate: ({ editor }) => {
      onEditorReady(editor);
    },
    onUpdate: ({ editor }) => {
      // The chapter's count still reaches the panel: it is saved with the
      // document and each chapter row renders its own.
      schedule({
        doc: editor.getJSON(),
        words: editor.storage.characterCount.words(),
      });
      // Typewriter recentring belongs to typing only. It used to run on every
      // selection change too, which meant a plain click recentred — the page
      // lurched under the pointer on click. Typing is the one time the caret
      // should be held in place.
      holdCaret(editor);
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  /**
   * A click on a bare part of the sheet — the blank tail below the prose, or a
   * margin beside it — puts the caret at the closest place text can actually go.
   *
   * This is Word's ordinary behaviour and the flowing model the whole editor is
   * built on: a chapter is a sequence of paragraphs, and the caret always sits
   * between two characters in one of them. Clicking under the last line takes
   * you to the end of it; clicking level with a line takes you into that line.
   * The alternative — letting a click drop text at an arbitrary x/y — is what
   * turns a manuscript into a pile of positioned boxes that come apart the
   * moment the margins or the type size change.
   *
   * The handler sits on the whole page flow rather than on the editable, because
   * the editable is only as tall as its text: the blank tail of a sheet is not
   * part of it, and a click there would otherwise reach nothing at all.
   */
  /**
   * Things on the page that answer their own clicks.
   *
   * **Two handlers ask this question and they must not answer it differently.**
   * `handleSheetClick` on the page flow and the click-to-type handler on the
   * scrolling desk both exist to catch a click that landed on *bare paper* —
   * the margin beside a line, the blank half of a page, the desk around the
   * sheet — and put the caret at the nearest text position. Anything a writer
   * can already put a caret or a press into is not bare paper.
   *
   * It was written out on the inner handler and not the outer one, and the
   * chapter title paid for it: clicking the title focused the input, the click
   * carried on up past the page flow, and the desk's handler answered it by
   * pulling the caret into the prose a moment later. The field lit up and went
   * dead again, which reads as a title that cannot be edited — and the fix is
   * not a bigger target or a slower blur, it is this list being in one place.
   */
  const OWNS_ITS_CLICK =
    '.chapter-opener, button, input, textarea, select, a, [contenteditable="true"]';

  /* One answer for two components: the formatting pill draws itself from this
     and the desk strip stands its readings down on the same frame. Two copies
     of the test would disagree for a frame and the row would flicker. */
  const pillVisible = useFormatPillVisible(editor);

  /**
   * **Pinch and Ctrl+wheel zoom the page — painted during, laid out after.**
   *
   * Without this a trackpad pinch zooms the *browser*, which scales the app's
   * own chrome along with the manuscript and is never what a writer meant. The
   * one test — \ — covers both gestures, because every
   * browser reports a pinch as a wheel event with \ set. A plain
   * two-finger scroll has neither and stays a scroll.
   *
   * **\ and a hand-attached listener**, not \: React
   * registers wheel listeners passively, and a passive listener may not call
   * \, so the browser would go on zooming itself over the top of
   * us.
   *
   * ## Why the gesture is a transform and only the result is a zoom
   *
   * The page is drawn with the CSS \ property, which **reflows**. That is
   * the right choice for the settled state — a transform breaks the browser's
   * scroll-the-caret-into-view arithmetic, which is what \ was chosen over
   * it for — but it is the wrong thing to do sixty times a second. Every
   * fractional value re-wraps the paragraphs and rounds every glyph to a
   * slightly different position, so the prose *crawls* as it scales. That is
   * the shaking, and no amount of correcting the scroll could have fixed it:
   * the text was moving underneath, not the viewport.
   *
   * So a gesture scales the page with a **transform**, which only paints — no
   * reflow, no re-wrap, no repagination, no React render, nothing written to
   * storage. \ at the pointer is what keeps the point under
   * it still, so the gesture needs no scroll arithmetic at all.
   *
   * When the writer stops, the transform is cleared and the real zoom is
   * committed in the same frame — one reflow, one repagination, the text set
   * properly for typing again — with the scroll corrected so nothing appears
   * to move at the hand-over.
   */
  const scrollerRef = useRef<HTMLElement | null>(null);
  /**
   * The gesture in flight, or null between them.
   *
   * \ is the pointer in the page's own unzoomed coordinates, taken once
   * at the start: it is both the transform's origin and, at the hand-over, the
   * point the scroll is corrected against. Re-reading it mid-gesture would
   * measure a page that is halfway to somewhere.
   */
  const gestureRef = useRef<{
    origin: { x: number; y: number };
    pointer: { x: number; y: number };
    from: number;
    live: number;
    pageWidth: number;
  } | null>(null);
  /* The zoom the page is committed at, for the handler to read without
     re-subscribing on every change. Synced in an effect rather than during
     render, which React forbids and which would be a lie anyway: the ref must
     name what is on screen, and that is only true after paint. */
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let frame = 0;
    let settle: number | null = null;

    /** Paint the gesture's current scale. No layout, no React. */
    const paint = () => {
      frame = 0;
      const flow = flowRef.current;
      const gesture = gestureRef.current;
      if (!flow || !gesture) return;

      const scale = gesture.live / gesture.from;

      /**
       * **Horizontally the page is centred, so the gesture has to be too.**
       *
       * Anchoring the transform at the pointer is right for the axis that
       * scrolls and wrong for the one that does not. While the page is
       * narrower than the desk it has no horizontal scroll at all — it sits in
       * the middle by its own margins — so a transform growing it *away* from a
       * pointer at one side is showing something the committed layout will not
       * agree with. At the hand-over the page is laid out centred again, there
       * is no `scrollLeft` to correct with, and it jumps sideways.
       *
       * So: centre while it fits, follow the pointer once it does not and
       * there is somewhere to scroll. The switch happens at the same width the
       * browser's own centring gives up at, which is what keeps the two in
       * step through the middle of a gesture.
       */
      const fits = gesture.pageWidth * scale <= scroller.clientWidth;
      const originX = fits ? flow.offsetWidth / 2 : gesture.origin.x;

      flow.style.transformOrigin = `${originX}px ${gesture.origin.y}px`;
      flow.style.transform = `scale(${scale})`;
    };

    /** Hand the gesture's result to React, which lays it out properly. */
    const commit = () => {
      settle = null;
      const gesture = gestureRef.current;
      if (!gesture) return;

      /**
       * **A gesture that ended where it started still has to be cleaned up.**
       *
       * The hand-over below runs on a change of `zoom`, and this is the one
       * case where there is none: the wheel curve is exact both ways, so
       * pinching in and back out by the same travel lands on the number it
       * began with. React would render nothing, the layout effect would not
       * fire, and the transform would stay on the page — the manuscript stuck
       * at a scale with no state behind it and no way to shift it.
       */
      if (gesture.live === zoomRef.current) {
        const flow = flowRef.current;
        if (flow) {
          flow.style.transform = "";
          flow.style.transformOrigin = "";
        }
        gestureRef.current = null;
        return;
      }

      /* Otherwise left set for the layout effect, which clears the transform
         and puts the scroll right in the same frame the new zoom is laid out. */
      onZoom(gesture.live);
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // Before anything else, or a browser that has already decided to zoom
      // itself will do both.
      event.preventDefault();

      const flow = flowRef.current;
      if (!flow) return;

      if (!gestureRef.current) {
        const page = flow.getBoundingClientRect();
        const scale = page.width / flow.offsetWidth;
        gestureRef.current = {
          origin: pagePointUnder(
            { x: event.clientX, y: event.clientY },
            { x: page.left, y: page.top },
            scale,
          ),
          pointer: { x: event.clientX, y: event.clientY },
          from: zoomRef.current,
          live: zoomRef.current,
          /* The page as drawn when the gesture began, so `paint` can tell
             whether it still fits the desk without measuring every frame. */
          pageWidth: page.width,
        };
      }

      const gesture = gestureRef.current;
      const next = zoomFromWheel(gesture.live, event.deltaY, event.deltaMode);
      if (next === gesture.live) return;
      gesture.live = next;
      gesture.pointer = { x: event.clientX, y: event.clientY };

      /* Pagination measures on a size change and ends by putting the viewport
         back, which would fight the hand-over below. It has nothing to do here
         anyway: breaks are computed in unzoomed pixels. */
      suspendPagination();

      if (!frame) frame = requestAnimationFrame(paint);
      if (settle !== null) window.clearTimeout(settle);
      settle = window.setTimeout(commit, SETTLE_ZOOM_MS);
    };

    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (settle !== null) window.clearTimeout(settle);
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [onZoom]);

  /**
   * The hand-over: drop the transform, keep the view still.
   *
   * \, so all of it happens before the frame is painted — the
   * transform coming off and the new zoom going on are never seen apart, which
   * is what makes a gesture that has been painting at one scale and is now laid
   * out at another look like nothing happened.
   */
  useLayoutEffect(() => {
    const gesture = gestureRef.current;
    const scroller = scrollerRef.current;
    const flow = flowRef.current;
    if (!gesture || !scroller || !flow) return;
    gestureRef.current = null;

    flow.style.transform = "";
    flow.style.transformOrigin = "";

    /* Where the browser has actually put the page, rather than where it ought
       to be: the desk's padding does not scale and the page's centring margins
       change with its width, so anything predicted here is a little wrong. */
    const page = flow.getBoundingClientRect();
    const delta = anchorDelta({
      pointer: gesture.pointer,
      pagePoint: gesture.origin,
      pageEdge: { x: page.left, y: page.top },
      scale: page.width / flow.offsetWidth,
    });

    /* Whole pixels only — a sub-pixel correction is rounded inconsistently,
       which is jitter by another name. */
    if (Math.abs(delta.y) >= 1) scroller.scrollTop += delta.y;

    /* **Only when there is somewhere to scroll sideways.** While the page fits
       the desk it is centred by its own margins and `scrollLeft` is pinned at
       zero, so asking for a horizontal correction is asking for something the
       browser will refuse — and the transform was centred through the gesture
       for exactly that reason. Past that width the page really can be scrolled
       across, and the pointer is the right thing to hold still. */
    const scrollsSideways = scroller.scrollWidth > scroller.clientWidth;
    if (scrollsSideways && Math.abs(delta.x) >= 1) {
      scroller.scrollLeft += delta.x;
    }
  }, [zoom]);

  const handleSheetClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || !editor.isEditable) return;
    if (draggedHere(e)) return;

    // The title, the floating toolbars, and the prose itself all handle their
    // own clicks — the browser has already placed the caret inside the text.
    const target = e.target as HTMLElement;
    if (target.closest(OWNS_ITS_CLICK)) return;

    const prose = editor.view.dom.getBoundingClientRect();
    if (e.clientY >= prose.bottom) {
      editor.commands.focus("end");
      return;
    }
    if (e.clientY <= prose.top) {
      editor.commands.focus("start");
      return;
    }

    // Level with a line but outside it: pull the pointer just inside the text
    // column so ProseMirror resolves it to a position on that line rather than
    // to nothing. This is what makes the margin beside a paragraph clickable.
    const at = editor.view.posAtCoords({
      left: Math.min(Math.max(e.clientX, prose.left + 1), prose.right - 1),
      top: e.clientY,
    });
    editor.commands.focus(at ? at.pos : "end");
  };

  // Word's click-and-type, kept for the pages it belongs on. A double-click on
  // the blank part of a sheet puts the caret where the pointer is: the blank
  // lines it takes to get down there, and the alignment of the third of the
  // column it landed in. Inside the prose a double-click still selects a word,
  // so this only acts below the last line.
  //
  // Body chapters do not get it, and should not: placing a line by pixel breeds
  // empty paragraphs whose count was computed from *this* page setup, so the
  // line slides the moment the margins, the trim size or the type change — and
  // the export, which repaginates from the text, disagrees with the screen. A
  // title page, a dedication or an epigraph is the opposite case: it is designed
  // on the page rather than flowed onto it, and that is exactly what front and
  // back matter are here. So the placement stays, fenced to those pages.
  const handleSheetDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placeable || !geomRef.current) return;
    const flow = flowRef.current;
    if (!editor || !editor.isEditable || !flow) return;

    const flowRect = flow.getBoundingClientRect();
    // The sheets are laid out at geom.pageW, so anything else in their measured
    // width is the zoom. This is the one number that turns a client pixel into a
    // page pixel, and it is right whether the zoom is CSS `zoom` or a transform.
    const scale = geom.pageW ? flowRect.width / geom.pageW : 1;
    if (!(scale > 0)) return;

    const prose = editor.view.dom.getBoundingClientRect();
    if (e.clientY <= prose.bottom) return;

    const { lines, align } = clickToType(
      (e.clientX - flowRect.left) / scale,
      (e.clientY - flowRect.top) / scale,
      (prose.bottom - flowRect.top) / scale,
      lineHeightAtEnd(editor, scale),
      geom,
    );

    // Even with no lines to add this focuses the end, so a double-click on the
    // page always does something rather than appearing to miss. The alignment is
    // set from the third of the column clicked, as Word does; setNoIndent is
    // what starts the words at the spot clicked rather than a first-line indent
    // in from it, and comes last because setting an alignment clears it.
    const chain = editor.chain().focus("end");
    if (lines > 0) {
      chain.insertContent(
        Array.from({ length: lines }, () => ({ type: "paragraph" })),
      );
    }
    chain.setTextAlign(align).setNoIndent().run();
  };

  // Keep the plugin's geometry current, and nudge it to re-measure when the page
  // setup changes (a resize the plugin cannot otherwise see, since the document
  // did not change).
  useEffect(() => {
    const applyLayout = () => {
      const continuous =
        document.documentElement.dataset.editorLayout === "continuous";
      geomRef.current = continuous ? null : geom;
      if (editor && !editor.isDestroyed) {
        editor.view.dispatch(editor.state.tr.setMeta("repaginate", true));
      }
    };

    applyLayout();
    const root = document.documentElement;
    root.addEventListener(EDITOR_LAYOUT_EVENT, applyLayout);
    return () => root.removeEventListener(EDITOR_LAYOUT_EVENT, applyLayout);
  }, [geom, editor]);

  // The desk is as tall as the sheets, so the last page shows in full even when
  // the writing does not fill it.
  const totalHeight = pageCount * geom.pageH + (pageCount - 1) * geom.gap;
  const mobileStatus = !canWrite ? "Read-only" : STATUS_LABEL[status];

  /**
   * The same sentence the bar above the rails shows.
   *
   * **A save indicator on a book that cannot be saved is a lie**, so a book
   * somebody let a writer *read* reports the permission instead of a status —
   * which is also the only place in the editor that explains why the page will
   * not take a keystroke. That decision is made here, where the role is known,
   * and the bar only draws what it is handed.
   */
  const saveState = !canWrite
    ? "Read-only · shared with you"
    : status === "saved" && lastSavedAt
      ? `${STATUS_LABEL[status]} · ${lastSavedAt.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}`
      : STATUS_LABEL[status];

  useEffect(() => {
    onSaveState?.(saveState);
  }, [onSaveState, saveState]);

  /** The same reading the strip below the bar used to carry, now in the bar. */
  const wordLine = `${written.toLocaleString()}${
    book.targetWords ? ` of ${book.targetWords.toLocaleString()}` : ""
  } words`;

  useEffect(() => {
    onWords?.(wordLine);
  }, [onWords, wordLine]);

  return (
    <>
      {/* **The phone’s chrome goes with the rest of it.** Focus mode means
          the same thing on every screen — the page, the pill and the
          selection bar, and one button out — or it means two things
          depending on how wide the window is. Both come back untouched on the
          way out, since neither holds any state of its own. */}
      {!focus && (
        <>
          <MobileEditorHeader
            chapterTitle={chapterTitle}
            status={mobileStatus}
            onChapters={onOpenChapters}
          />
          <MobileWritingDock
            editor={editor}
            formatOpen={formatOpen}
            assistantOpen={assistantOpen}
            moreOpen={moreOpen}
            onFormat={onFormat}
            onAssistant={onAssistant}
            onMore={onMore}
          />
        </>
      )}
      {/* The paper palette moves up here so the running head can share it.
          Every rule that depends on it is a descendant selector, so hoisting
          the class and both data attributes changes nothing below. */}
      <div
        data-paper={prefs.paper}
        // Which part of the book this is, so the sheet's edge takes that part's
        // colour and the page answers the card in the panel it was opened from.
        // Set here rather than on the sheets themselves because the pagination
        // plugin draws those, and a decoration is not its business.
        data-matter={matter}
        // Honour the book's page setting in paged layouts. The continuous
        // phone canvas overrides this to one column in CSS without remounting.
        data-columns={page.columns}
        // The workspace scrollbar (and its inputs) follow the paper, not the app
        // theme: a writer looks at a light page even when the chrome is dark, so
        // its scrollbar must be light too. Set inline so it lands cleanly on the
        // element and cascades to the scrolling <main> inside. The typography
        // variables ride here too, so the whole manuscript takes the book's face,
        // size and spacing.
        style={
          {
            colorScheme:
              prefs.paper === "slate" || prefs.paper === "black"
                ? "dark"
                : "light",
            ...typographyVars(typographyOf(book)),
          } as CSSProperties
        }
        // Shows the ¶ at the end of every paragraph — see the note in
        // globals.css for why it is drawn at zero width.
        data-marks={prefs.marks ? "" : undefined}
        // page-enter: this element is mounted fresh whenever the writer opens
        // a different chapter, so the entrance plays exactly when a new page
        // arrives and never on a keystroke.
        className={`manuscript flex min-h-0 flex-1 flex-col ${
          entering ? "page-enter" : ""
        }`}
      >
        {/* The workspace: the manuscript on real page sheets, like a word
            processor's print layout. The sheets are drawn behind; the editable
            flows over them, and the pagination plugin inserts the gaps so text
            never sits across a page seam. */}
        {/* Transparent, so the shared gradient on the row above shows through
            and the page sheets float on it. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* **The dictation bar and the formatting pill, in the manuscript
              column.**

              They hung off a strip of desk that ran above the page carrying a
              word count and a save status. Both readings are in the bar at the
              top of the window now, and a full-width band drawn to hold nothing
              is a second bar under the first — so the strip went and these two
              moved out here.

              **This wrapper and not the scroller below it**: inside that, the
              pill would slide away with the page. Out here it holds its line,
              and because the wrapper spans the same column the sheet is centred
              in, centring on it is still centring on the paper.

              `pointer-events-none` on the stack with it turned back on for each
              child, so the empty space either side of the pill is not a lid over
              the top of the page — a click there must reach the paper.

              **And it sits above the paper, which now has a number of its
              own.** This column is four layers deep and they only read in
              order if they are written down: the panel at 40, the two
              connector rules at 41, the page at 42 — raised so those rules
              finish underneath it — this bar at 43, and the rail at 45. At 20
              the page covered the middle of the pill and left both ends
              showing, which reads as a bar that failed to draw. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[43] flex flex-col items-center">
            {dictation.listening && (
              <div className="pointer-events-auto w-full">
                <DictationBar
                  dictation={dictation}
                  width={geom.pageW * zoom * PAGE_SCALE}
                />
              </div>
            )}
            <div className="pointer-events-auto">
              <FormatPill
                editor={editor}
                book={book}
                visible={pillVisible}
                history={<HistoryControls editor={editor} />}
              />
            </div>
          </div>

          <main
            /* The scroller the zoom gesture listens on, and the box the
               anchoring measures the pointer against. */
            ref={scrollerRef}
            /* **A grey desk, so the page reads as a page.** This was
               `bg-white` in daylight, which put a white sheet on a white
               ground — the paper had no edge but the hairline drawn round it,
               and a sheet the same value as the desk it lies on is not a
               sheet. The dark theme had always known this: its own note on
               `[data-paper="black"]` says a page must sit one step off the
               desk behind it, and the desk there is a faint accent wash rather
               than the black the chrome is.

               `zinc-100` rather than a token: `--color-raised` is the app's
               *field* grey and is used for controls, and the desk is not a
               control. It is the one literal here, and it is the same
               near-white every word processor puts behind a page. */
            className="scroll-paper min-h-0 flex-1 cursor-text overflow-auto
                       bg-zinc-100 dark:bg-accent/7 px-4 pt-3 pb-8 md:pb-10"
            // Both edges reserved for the scrollbar, so the page is centred in
            // the same box the bar above it is. Without it the scrollbar takes
            // its width off one side only, the page shifts left by half of it,
            // and the bar's ends no longer line up with the sheet's.
            style={{ scrollbarGutter: "stable both-edges" }}
            // Where the press began. Everything below the desk is inside this
            // element, so one listener here sees the start of every drag on the
            // page — see draggedHere.
            onPointerDown={(e) => {
              pressAt.current = { x: e.clientX, y: e.clientY };
            }}
            onClick={(e) => {
              // Clicking the text is handled by ProseMirror itself — only a
              // click on the surrounding desk or the blank part of a page needs
              // handling. Like Word's "click and type", the caret lands at the
              // nearest text position rather than snapping back to the old one:
              // click below the text → caret at the end; click in a margin
              // beside a line → caret to that line. Placed without scrolling,
              // since focus()'s default scroll is what jumped the page on click.
              if (
                !editor ||
                draggedHere(e) ||
                (e.target as HTMLElement).closest(
                  `.ProseMirror, .tiptap, ${OWNS_ITS_CLICK}`,
                )
              ) {
                return;
              }

              /**
               * **The desk around the page is not a text target.**
               *
               * Click-and-type used to reach anywhere on this element, which
               * includes the grey to the left and right of the paper and
               * everything below the last page — so clicking *nothing* put the
               * caret in the prose and left the formatting bar up. Word does
               * not do that either: the surround is where the page sits, not
               * part of it.
               *
               * Inside the column, including the blank lower half of a page,
               * is unchanged. Outside it, the caret is put away — which is
               * also what dismisses the formatting bar, now that it follows
               * focus rather than the selection.
               *
               * `flowRef` is the page column and is already measured for the
               * zoom, so this costs no new geometry.
               */
              const column = flowRef.current?.getBoundingClientRect();
              const onPage =
                column &&
                e.clientX >= column.left &&
                e.clientX <= column.right &&
                e.clientY >= column.top &&
                e.clientY <= column.bottom;

              if (!onPage) {
                editor.commands.blur();
                return;
              }

              const pos = nearestTextPos(editor, e.clientX, e.clientY);
              const chain = editor.chain();
              if (pos !== null) chain.setTextSelection(pos);
              chain.focus(undefined, { scrollIntoView: false }).run();
            }}
          >
            {/* The running head, split to the page's two edges — the word count
                at the paper's left, the save status at its right. It shares the
                page's own width and centring (mx-auto), so its ends line up with
                the sheet however wide the window is, and sticks to the top as the
                page scrolls. aria-live so a failed save is announced rather than
                waiting to be noticed. */}

            {/* Zoomed with the CSS `zoom` property, not a transform: a transform
                on the pages breaks the browser's "scroll the caret into view"
                maths, so clicking to place the caret jumped the page to the top
                or bottom. `zoom` reflows the layout, so the caret stays put and
                the scrollbars still measure the real page height. */}
            <div
              ref={flowRef}
              onClick={handleSheetClick}
              onDoubleClick={handleSheetDoubleClick}
              /* Above the two rules that run to it from the panel, so their
                 3px overshoot finishes underneath the sheet and the join reads
                 as continuous. `relative` is what makes the z-index apply; the
                 continuous layout takes it straight back off, because there
                 the panel is a full-screen overlay and paper above it would
                 show through. */
              className="pageflow relative z-[42]"
              style={{
                width: `${geom.pageW}px`,
                height: `${totalHeight}px`,
                // The reading on the control times the size 100% stands for.
                // Always set now, where it used to be dropped at 100% to keep
                // the property out of the caret-into-view maths — `zoom` reflows
                // the layout rather than painting over it, so that was a
                // precaution rather than a requirement, and everything that
                // measures the page derives its scale from the rendered width
                // (see pagination.ts) rather than assuming this value.
                zoom: zoom * PAGE_SCALE,
              }}
            >
              <div className="pageflow-sheets" aria-hidden="true">
                {Array.from({ length: pageCount }).map((_, p) => (
                  <div
                    key={p}
                    className="pageflow-sheet"
                    style={{
                      top: `${p * (geom.pageH + geom.gap)}px`,
                      height: `${geom.pageH}px`,
                    }}
                  />
                ))}
              </div>

              <div
                className="paper pageflow-paper"
                style={{
                  paddingTop: `${geom.mT}px`,
                  paddingBottom: `${geom.mB}px`,
                  paddingLeft: `${geom.mL}px`,
                  paddingRight: `${geom.mR}px`,
                }}
              >
                {/* One chapter heading, the way a printed book opens: a spelled
                    "Chapter Five" label only when the title is a real name (a
                    chapter still called "Chapter 5" needs no second label), then
                    the title itself. No stray number above it. Front and back
                    matter carry no label — a title page or a dedication is named,
                    not numbered. */}
                <div className="chapter-opener">
                  {chapterNumber !== null &&
                    !isGenericChapterTitle(chapterTitle) && (
                      <p className="chapter-label">
                        {chapterLabel(chapterNumber)}
                      </p>
                    )}
                  {/* An input rather than a heading with contenteditable: the
                      title is a single line of plain text, and a plain input gets
                      the caret, undo and screen-reader behaviour right for free. */}
                  <input
                    value={chapterTitle}
                    // Read-only for a viewer, like the prose below it. `readOnly`
                    // rather than `disabled`: the text stays selectable and
                    // copyable, which is exactly what somebody given a book to
                    // read wants, and a disabled input is also skipped by the
                    // keyboard.
                    readOnly={!canWrite}
                    onChange={(e) =>
                      renameChapter(bookId, chapterId, e.target.value)
                    }
                    onBlur={(e) => {
                      if (!e.target.value.trim()) {
                        renameChapter(bookId, chapterId, "Untitled chapter");
                      }
                    }}
                    aria-label="Chapter title"
                    spellCheck={false}
                    // See dragOutOfTitle: a selection cannot leave a form field
                    // on its own, so the manuscript takes over when it does —
                    // but only for a press that began here and actually
                    // travelled, which is what `onPointerDown` records.
                    onPointerDown={startTitleDrag}
                    onPointerLeave={dragOutOfTitle}
                    /* `reader-title-field` is the hit area and the hover, not
                       the setting — see the note beside it in globals.css. The
                       reading view and the export share `reader-title` alone,
                       so neither moves. */
                    className="reader-title reader-title-field w-full rounded-sm
                               bg-transparent outline-none focus-visible:ring-2
                               focus-visible:ring-accent/60"
                  />
                </div>
                <EditorContent editor={editor} />
                {/* The Word-style mini toolbars: one over a text selection, one
                    over a selected image. */}
                {/* The size list speaks in points, which only means anything
                    against the size this book's body is set in. */}
                <SelectionToolbar
                  editor={editor}
                  bodyPt={typographyOf(book).sizePt}
                />
                <ImageToolbar editor={editor} />
              </div>
            </div>
          </main>

          {/* A floating microphone used to sit here, over the corner of the
              desk. It is gone: dictation is still one press away from the tool
              rail and from the chapter panel, both of which show the same live
              session, so nothing has been lost but the thing covering the page.
              A button pinned over the manuscript is in the way of the one part
              of the screen a writer is actually looking at. */}
        </div>
      </div>
    </>
  );
}


/**
 * What the microphone is hearing, while it is on.
 *
 * Dictation used to signal itself with a coloured button and a pulsing ring at
 * the edge of the screen, which answers "it is on" and nothing else. The
 * question a writer actually has is the next one — *is it hearing me* — and a
 * ring that pulses on a timer cannot answer it: it looks identical whether you
 * are talking, silent, or muted at the operating system.
 *
 * So this shows the two things that are real. The meter moves only while the
 * engine reports a voice, so stillness means silence rather than a broken
 * animation. And the interim words are the engine's own guess, printed as it
 * revises them — which is proof of hearing that no indicator light can fake.
 * They are shown and never inserted; only finished phrases reach the page, for
 * the reason use-dictation.ts gives.
 */
function DictationBar({
  dictation,
  width,
}: {
  dictation: Dictation;
  width: number;
}) {
  const { interim, hearing } = useDictationLive(dictation);

  return (
    <div
      className="mx-auto mt-2 flex items-center gap-2.5 rounded-lg border
                 border-accent/30 bg-accent/8 px-3 py-1.5"
      style={{ width: `${width}px`, maxWidth: "100%" }}
    >
      <Meter hearing={hearing} />

      {/* aria-live, because the whole point is a state a writer is not looking
          straight at — and a screen-reader user has no meter to glance at. */}
      <span
        role="status"
        aria-live="polite"
        className="min-w-0 flex-1 truncate font-sans text-xs"
      >
        {interim ? (
          <span className="text-fg italic">{interim}</span>
        ) : (
          <span className="text-muted">
            {hearing ? "Listening…" : "Listening — go ahead"}
          </span>
        )}
      </span>

      <button
        type="button"
        onClick={dictation.stop}
        className="shrink-0 rounded-md px-2 py-0.5 font-sans text-xs font-medium
                   text-muted outline-none transition-colors hover:bg-raised
                   hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Stop
      </button>
    </div>
  );
}

/**
 * Three bars that rise only while a voice is being heard.
 *
 * `oc-eq` is the shelf's own level meter, reused rather than redrawn — the same
 * mark should mean the same thing in both places. Standing still they are three
 * short dashes, which is a state of its own: the microphone is open and nothing
 * is reaching it. The class already stands down under prefers-reduced-motion.
 */
function Meter({ hearing }: { hearing: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 shrink-0 items-center gap-[3px]"
    >
      {[0, 0.18, 0.36].map((delay) => (
        <span
          key={delay}
          style={hearing ? { animationDelay: `${delay}s` } : undefined}
          className={`w-[3px] rounded-full bg-accent ${
            hearing ? "oc-eq" : "h-1"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * Undo and redo, in the desk bar.
 *
 * Moved out of the right rail, where they sat among the formatting tools. Those
 * act on the page — type, alignment, images; these act on the document's
 * history, which is the same family as the two readings already in this bar:
 * how much has been written, and whether it is saved. The bar is also nearer
 * the text than the far edge of the window is.
 *
 * `useEditorState` is what keeps the disabled state honest. Both flags are read
 * at render time, so without a subscription to the editor's transactions the
 * buttons would show whatever was true the last time something else happened to
 * re-render this component — greyed out with plenty to undo, or lit with
 * nothing.
 */
function HistoryControls({ editor }: { editor: Editor | null }) {
  useEditorState(editor);
  if (!editor) return null;

  return (
    <>
      <HistoryButton
        label="Undo"
        shortcut="Ctrl+Z"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <path d="M3.2 4.4v3.9h3.9" />
        <path d="M3.9 8.3a6.4 6.4 0 1 1-.5 5.3" />
      </HistoryButton>
      <HistoryButton
        label="Redo"
        shortcut="Ctrl+Shift+Z"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <path d="M16.8 4.4v3.9h-3.9" />
        <path d="M16.1 8.3a6.4 6.4 0 1 0 .5 5.3" />
      </HistoryButton>
    </>
  );
}

/** Set exactly as the zoom buttons beside it — one bar, one kind of button. */
function HistoryButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      // The shortcut in the tooltip rather than on the bar: it is worth
      // learning once and worth no space at all afterwards.
      title={`${label} (${shortcut})`}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted
                 outline-none transition-colors hover:bg-raised hover:text-fg
                 focus-visible:ring-2 focus-visible:ring-accent/60
                 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        {children}
      </svg>
    </button>
  );
}

