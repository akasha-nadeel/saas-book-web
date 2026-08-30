"use client";

import {
  useCallback,
  useEffect,
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
import { ToolRail, useEditorState } from "@/components/editor/editor-toolbar";
import {
  Rail,
  RailButton,
  RailDivider,
  icons,
} from "@/components/editor/icon-rail";
import {
  BackToBooks,
  WorkspaceRail,
  selectPanel,
} from "@/components/editor/workspace-rail";
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
  type BookPanelMode,
  type OpenPart,
} from "@/components/editor/book-panel";
import { BookGuide } from "@/components/editor/book-guide";
import { BookCover } from "@/components/shelf/book-cover";
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
  type PaperColor,
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

const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Off-white", swatch: "#ededed" },
  { value: "sepia", label: "Grey", swatch: "#d6d6d6" },
  { value: "slate", label: "Charcoal", swatch: "#1c1c1c" },
  { value: "black", label: "Black", swatch: "#0d0d0d" },
];

/**
 * A rail button that shows the current page colour as a swatch and opens a
 * small portal dropdown to switch it — same five options as the Aa flyout,
 * promoted here so they are one press away without opening the full type panel.
 */
function PageColorButton({ paper }: { paper: PaperColor }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const current = PAPERS.find((p) => p.value === paper) ?? PAPERS[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !panelRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };
    const onResize = () => setOpen(false);
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            setRect(triggerRef.current?.getBoundingClientRect() ?? null);
            setOpen(true);
          }
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Page colour"
        title="Page colour"
        className={`flex h-12 w-12 shrink-0 items-center justify-center
                    rounded-xl outline-none transition-colors
                    focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      open
                        ? "bg-raised text-fg"
                        : "text-muted hover:bg-raised/50 hover:text-fg"
                    }`}
      >
        {/* Orange circle background matching the search/other PNG rail icons,
            with the colour swatch centred inside it. */}
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "#f5a030" }}
        >
          <span
            className="h-5 w-5 rounded-full border-[3px] border-black"
            style={{ background: current.swatch }}
          />
        </span>
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: rect.top,
            left: rect.left,
            transform: "translateX(-100%)",
            paddingRight: 8,
            zIndex: 50,
          }}
        >
          <div className="flex flex-col gap-1 rounded-md border border-line bg-panel p-2 shadow-xl">
            <p className="px-1 font-sans text-[0.62rem] tracking-wide text-muted uppercase">
              Page colour
            </p>
            <div className="flex flex-col gap-1">
              {PAPERS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setPref("paper", p.value);
                    setOpen(false);
                  }}
                  aria-label={p.label}
                  title={p.label}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left
                              font-sans text-xs outline-none transition-colors
                              focus-visible:ring-2 focus-visible:ring-accent/60 ${
                                p.value === paper
                                  ? "bg-accent text-accent-ink"
                                  : "text-fg hover:bg-raised"
                              }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 rounded-full border border-line"
                    style={{ background: p.swatch }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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
    // away, or switching to Book View, while still speaking. There is nowhere
    // to put it, so it is dropped rather than pushed into a dead instance.
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
   * Same reasoning as `bookPanel` below, and the same store: a navigation is
   * not a decision, and neither is a reload.
   */
  const tab = prefs.panelTab;
  const setTab = useCallback((next: PanelTab) => setPref("panelTab", next), []);
  const panelOpen = prefs.leftPanel;
  const setPanelOpen = useCallback(
    (open: boolean) => setPref("leftPanel", open),
    [],
  );
  const chapterSectionOpen = prefs.chapterSectionOpen;
  const setChapterSectionOpen = useCallback(
    (open: boolean) => setPref("chapterSectionOpen", open),
    [],
  );
  const [mobileBookOpen, setMobileBookOpen] = useState(false);
  // Which face the right book panel shows — the cover-and-steppers Book View, or
  // the book's three parts. Stored rather than held in memory: it used to be a
  // module variable, which survived the remount a chapter change triggers but
  // not a reload, so refreshing put a writer back on the cover having asked for
  // nothing of the sort. A reload is not a decision.
  const panelMode: BookPanelMode = prefs.bookPanel;
  const isLeftPanelOpen = Boolean(
    panelOpen && tab !== "chapters" && panelMode !== "book",
  );

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
  const changePanelMode = (mode: BookPanelMode) => {
    setEntering(true);
    setMobileBookOpen(false);
    // Book View takes the rail down with the manuscript, and the rail is what
    // opens and closes the tool panel. Left open it would be a drawer anchored
    // at `left-(--rail-width)` against a rail that is no longer there, with its
    // own header button the only way to shut it — and every tab in it is about
    // a chapter that is no longer on screen.
    if (mode === "book") setPanelOpen(false);
    setPref("bookPanel", mode);
  };
  useEffect(() => {
    if (!entering) return;
    // Comfortably past the page's 760ms, which is the last to land. Removing
    // the class after the fact changes nothing on screen — the element is
    // already sitting at the animation's end state.
    const done = setTimeout(() => setEntering(false), 1100);
    return () => clearTimeout(done);
  }, [entering]);
  // Page zoom. Held here rather than in the surface, which is remounted on every
  // chapter change — so the level the writer set survives moving between
  // chapters, the way it does in a word processor.
  const [zoom, setZoom] = useState(1);

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

  // Book View is not one of the three parts. It shows the book whole and picks
  // out none of them, so the page takes the accent of the button it offers — the
  // same rule as the rest, applied to a panel that has nothing selected.
  const selectedPart =
    panelMode === "book" ? "book" : (body.open ?? chapterPart);

  /**
   * The editor, but only while there is one to act on.
   *
   * `editor` is state set from the surface's `onCreate`, so it outlives the
   * surface: the instance sits there destroyed until a new one replaces it.
   * There are two windows where that matters — Book View, which unmounts the
   * surface for as long as it is showing, and the render between one chapter's
   * editor being destroyed and the next one's `onCreate`. In both, anything
   * that touches the instance reaches through a null `view`; `editor.can()` in
   * the formatting rail throws outright.
   *
   * So the rail, the assistant and dictation all read this instead. Derived
   * rather than cleared in an effect, because an effect would leave exactly the
   * render that crashes. `isDestroyed` is safe to read on a dead editor — it
   * answers from `editorView?.isDestroyed ?? true` rather than assuming a view.
   */
  const liveEditor =
    panelMode === "book" || !editor || editor.isDestroyed ? null : editor;

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
        // Book View has no rail for the drawer to come out from — only the way
        // back out, which the drawer would cover. Searching is something you do
        // beside a page, so asking for it asks for the page back; without this
        // the one shortcut that can still open the panel opens it onto the one
        // screen with nothing to close it with.
        if (panelMode === "book") {
          setEntering(true);
          setPref("bookPanel", "chapters");
        }
        setTab("search");
        setEditorPanel(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelMode, setEditorPanel, setTab]);

  // Remembering the open chapter is what lets a book's route land the writer
  // back where they left off, so it is worth a write on every visit.
  useEffect(() => {
    if (hydrated) touchLastOpened(bookId, chapterId);
  }, [hydrated, bookId, chapterId]);

  // Opening a chapter shows the chapter.
  //
  // The panel's face is one preference shared with the book overview, and the
  // overview resets it to "book" on arrival — which is right there and wrong
  // here, because in this screen "book" means the manuscript is unmounted and
  // the guide stands in its place. Without this, opening a chapter from the
  // overview lands the writer on a page with no page on it.
  //
  // The pair is the whole rule: the overview always opens on the book, a
  // chapter always opens on the chapter, and switching faces afterwards is the
  // writer's and sticks until they leave.
  useEffect(() => {
    if (hydrated) setPref("bookPanel", "chapters");
    // Per chapter arrival. Not watching prefs.bookPanel, which would undo
    // "Back to Book View" the instant it was pressed.
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
    // No chrome bar across the top: the rail runs full height on the left, the
    // panels and manuscript fill the rest, and the word count and save status
    // float in the workspace's top-left corner (see EditorSurface).
    <div
      className="editor-shell flex h-full min-w-0"
      data-panel-mode={panelMode}
    >
      {/* **Book View takes the left rail down too, and for the right rail's own
          reason.** The rail is what a writer keeps beside a page — search, this
          chapter's notes, its versions — and Book View unmounts the page. So a
          rail left standing there is nine ways into panels about a chapter that
          is no longer on screen, drawn around a manuscript that is not there.
          The book overview is this screen with the page taken out and has never
          carried one; showing one here made the same book look like two
          different screens depending on which way in the writer took.
          `BackToBooks` is what the overview puts in that corner. */}
      {panelMode === "book" ? (
        <BackToBooks />
      ) : (
        <WorkspaceRail
          bookId={bookId}
          tab={tab}
          onSelectTab={setTab}
          leftPanel={panelOpen}
          onPanel={setEditorPanel}
          chapters
          chapterSectionOpen={chapterSectionOpen}
          onToggleChapters={setChapterSectionOpen}
          // The manuscript's own right rail carries it now, beside the tools
          // that act on the page it talks about. Two sparkles on two edges of
          // one screen is the duplication the book panel already taught us to
          // avoid — and the panel it opens is the same panel either way.
          assistant
          className="editor-workspace-rail hidden md:flex"
        />
      )}

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
            onMode={changePanelMode}
            onNavigate={closeMobileBookNavigation}
            onClose={closeMobileBookNavigation}
          />
        )}

        {/* Rendered whether or not it is open: it owns its own mounting so it
            can animate its way out, and it renders nothing until first opened.
            See LeftPanel's `open`. Tool tabs (search, notes, etc.) float over
            the editor; chapters section sits inline to push the page. */}
        <LeftPanel
          open={panelOpen && tab !== "chapters"}
          tab={tab}
          bookId={bookId}
          chapterId={chapterId}
          chapterTitle={chapter.title}
          editor={liveEditor}
          getChapterText={() => liveEditor?.getText() ?? ""}
          onClose={() => setEditorPanel(false)}
        />

        {(panelMode === "book" || chapterSectionOpen) && (
          <BookPanel
            book={book}
            chapterId={chapterId}
            cover={cover}
            paper={prefs.paper}
            mode={panelMode}
            onMode={changePanelMode}
            body={body}
            entering={entering}
            always
            connectToPage={true}
            onClose={() => setChapterSectionOpen(false)}
          />
        )}

        <div className="editor-main flex min-w-0 flex-1 flex-col bg-white dark:bg-transparent">
                {/* Book View selects no part of the book, so there is no page to
                    show; the overview stands in its place. The panel and the middle
                    of the window are one statement — the book as an object, or a page
                    of it — rather than a panel that can describe one thing while the
                    page shows another.

                    The surface is unmounted rather than hidden. Its autosave flushes
                    on dispose, so nothing typed is lost, and a hidden manuscript is a
                    manuscript whose pagination measures a zero-height column. */}
                {panelMode === "book" ? (
                  <BookGuide title={book.title} book={book} entering={entering} />
                ) : (
                  /* Keyed on the id and a cross-tab reload counter — not the stored
                     text — so a save from another tab reloads the surface, while this
                     tab's own autosaves never remount it mid-keystroke. */
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
                )}
              </div>

              {/* The right rail belongs to the manuscript, so it leaves with it.
                  When the left panel expands, the right rail smoothly slides right
                  and disappears, allowing the editor canvas to occupy the full remaining space. */}
              {panelMode !== "book" && (
                <Rail
                  side="right"
                  // Hidden on phones: the formatting tools want a pointer and room.
                  className={`hidden lg:flex transition-all duration-300 ease-in-out ${
                    isLeftPanelOpen
                      ? "translate-x-full opacity-0 pointer-events-none !w-0 !border-l-0 overflow-hidden"
                      : "translate-x-0 opacity-100 w-(--rail-width)"
                  }`}
                  footer={
              <>
                <RailDivider />
                {/* **Share, beside Export, and the group is the argument.**

                    Every product that does this well puts the control on the
                    thing being shared while you are looking at it — Google
                    Docs, Notion and Figma all carry it in the document's own
                    chrome, and none of them make you go to a management page
                    to add somebody. `ShareDialog`'s own note says the same
                    thing and has said it since it was written; what was
                    missing is that the only way to open it was the dashboard's
                    Collaborators area, which is exactly the separate screen
                    that argument rules out. A writer in chapter nine who wants
                    their editor on the book had to leave the book to do it.

                    It sits in the "leave" group rather than beside the writing
                    tools because it does not act on the page: like Export, it
                    is about handing the manuscript to somebody else. Export
                    stays last — it is the end of the road, and Share is a
                    thing you do while still on it. */}
                {canShare && (
                  <RailButton label="Share" onClick={() => setSharing(true)}>
                    {icons.share}
                  </RailButton>
                )}
                {/* **Import, immediately above Export, because they are a
                    pair.** It used to be a third button in the chapter list's
                    header, which is a place you have to open a list to reach —
                    and the two halves of moving a manuscript through this app
                    then lived on opposite sides of the window. Neither acts on
                    the sheet, which is what this last group is for. Hidden for
                    a reader, like every other write: `canWrite` is the same
                    test the chapter list used. */}
                {canWriteThis && <ImportChapterButton book={book} />}
                <RailButton
                  label="Export"
                  href={`/book/${bookId}/export`}
                  imgSrc="/icons/icon-export.png"
                />
              </>
            }
          >
            {/* Which book these tools act on, as the object rather than another
              copy of its title — the running head already carries the words.

              It is also the way in to changing it. A cover is the one thing
              here you would click expecting to edit it, and there was nowhere
              else in the editor to reach the title page from. */}
            <button
              type="button"
              onClick={() => setEditingCover(true)}
              aria-label={`Edit the cover of ${book.title}`}
              title="Edit book details"
              className="block w-10 shrink-0 rounded-md outline-none
                       transition-transform hover:-translate-y-0.5
                       focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <BookCover
                title={book.title}
                subtitle={book.subtitle}
                author={book.author}
                words={bookWordCount(book)}
                image={cover}
                seed={book.id}
              />
            </button>

            <RailDivider />

            <ToolRail
              editor={liveEditor}
              book={book}
              paper={prefs.paper}
              dictation={dictation}
            />

            <RailDivider />

            <RailButton
              label="Typewriter scrolling"
              active={prefs.typewriter}
              onClick={() => setPref("typewriter", !prefs.typewriter)}
              imgSrc="/icons/icon-typewriter.png"
            />
            <PageColorButton paper={prefs.paper} />
          </Rail>
        )}
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
  onMode,
  onNavigate,
  onClose,
}: {
  book: Book;
  chapterId: string;
  cover: string | null;
  paper: string;
  body: OpenPart;
  onMode: (mode: BookPanelMode) => void;
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
        mode="chapters"
        onMode={onMode}
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
  /** What the panel has selected — the sheet's edge takes its colour. "book" is
   *  Book View, which selects no part of the book at all. */
  matter: "front" | "body" | "back" | "book";
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

  return (
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
        // page-enter: this element is mounted fresh whenever the writer comes
        // back from Book View or opens a different chapter, so the entrance
        // plays exactly when a new page arrives and never on a keystroke.
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
          {/* The strip of desk above the sheet, doing the work of a bar.

              Outside the scroller, not stuck to the top of it. Sticky, it stayed
              put while the page slid up underneath — so it ended up lying across
              the paper with the sheet's own top border above it, which reads as
              a band drawn *on* the page rather than a bar above it. Out here the
              page cannot reach it: the manuscript scrolls in the box below, and
              this keeps its own line of desk however far down a writer goes.

              No rule and no panel behind it either. The desk that was already
              there is the bar; an edge would only have drawn a second one. */}
          <div className="editor-desk-strip shrink-0 bg-white dark:bg-accent/7 px-4 pt-3 pb-2">
            <div
              className="mx-auto flex items-center justify-between gap-3
                         font-sans text-xs text-muted"
              style={{
                width: `${geom.pageW * zoom * PAGE_SCALE}px`,
                maxWidth: "100%",
              }}
            >
              {/* The two readings take equal, fixed shares of the bar, so the
                  control between them sits on the middle of the sheet rather
                  than wherever a word count of four digits happens to leave
                  it — the number changes as a writer types, and a control that
                  drifts while they work is a control they have to look for. */}
              <span className="pointer-events-none flex-1 truncate tabular-nums">
                {written.toLocaleString()}
                {book.targetWords
                  ? ` of ${book.targetWords.toLocaleString()}`
                  : ""}{" "}
                words
              </span>

              {/* The centre is where the bar's controls live and the flanks
                  are readings, so history joins the zoom here rather than
                  crowding one of the two numbers. A hairline between the pair
                  keeps them as two groups: what has happened to the document,
                  and how large it is drawn. */}
              <div className="flex shrink-0 items-center gap-1">
                <HistoryControls editor={editor} />
                <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
                <ZoomControl zoom={zoom} onZoom={onZoom} />
              </div>

              {/* **A save indicator on a book that cannot be saved is a lie**, and
                  this is the corner of the screen a writer checks to find out
                  whether their work is safe. So for a book somebody let them
                  *read*, it reports the permission instead of a status — which is
                  also the only place in the editor that explains why the page will
                  not take a keystroke. */}
              <span
                aria-live="polite"
                className="pointer-events-none flex-1 truncate text-right"
                style={
                  status === "error" && canWrite
                    ? { color: "var(--color-danger)" }
                    : undefined
                }
              >
                {!canWrite ? (
                  "Read-only · shared with you"
                ) : (
                  <>
                    {STATUS_LABEL[status]}
                    {status === "saved" && lastSavedAt
                      ? ` · ${lastSavedAt.toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : null}
                  </>
                )}
              </span>
            </div>

            {/* Only while the microphone is live, and on its own line under the
                readings rather than squeezed among them: this is a mode, not a
                measurement, and it has a sentence to show. It appears inside
                the desk strip, so it never covers the page — the reason the
                floating microphone that used to do this job is gone. */}
            {dictation.listening && (
              <DictationBar
                dictation={dictation}
                width={geom.pageW * zoom * PAGE_SCALE}
              />
            )}
          </div>

          <main
            className="scroll-paper min-h-0 flex-1 cursor-text overflow-auto
                       bg-white dark:bg-accent/7 px-4 pt-3 pb-8 md:pb-10"
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
              className="pageflow"
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

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

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

/**
 * The page-zoom control, pinned to the bottom-right of the workspace the way a
 * word processor puts it in the status bar. Pinned to the workspace rather than
 * the scrolling page, so it stays in reach as the manuscript scrolls.
 */
function ZoomControl({
  zoom,
  onZoom,
}: {
  zoom: number;
  onZoom: (zoom: number) => void;
}) {
  const clamp = (z: number) =>
    Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));

  return (
    <div
      // In the bar now rather than floating at the foot of the page. It sat
      // over the bottom-right corner of the paper, which is where the last
      // lines of a chapter are — the one part of the page a writer is looking
      // at. Up here it is on the bar's own ground, centred over the sheet, and
      // never over the words.
      //
      // No card of its own any more: the bar is the ground, and a bordered box
      // inside a bordered bar is one border too many.
      className="flex shrink-0 items-center gap-0.5"
    >
      <button
        type="button"
        onClick={() => onZoom(clamp(zoom - ZOOM_STEP))}
        disabled={zoom <= ZOOM_MIN}
        aria-label="Zoom out"
        title="Zoom out"
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
          className="h-4 w-4"
        >
          <path d="M5 10h10" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => onZoom(1)}
        aria-label="Reset zoom"
        title="Reset zoom"
        className="w-11 rounded-md py-1 text-center font-sans text-xs tabular-nums
                   text-muted outline-none transition-colors hover:bg-raised
                   hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {Math.round(zoom * 100)}%
      </button>

      <button
        type="button"
        onClick={() => onZoom(clamp(zoom + ZOOM_STEP))}
        disabled={zoom >= ZOOM_MAX}
        aria-label="Zoom in"
        title="Zoom in"
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
          className="h-4 w-4"
        >
          <path d="M10 5v10M5 10h10" />
        </svg>
      </button>
    </div>
  );
}
