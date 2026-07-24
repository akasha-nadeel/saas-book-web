"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  EditorContent,
  useEditor,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Focus, Placeholder } from "@tiptap/extensions";
import { ToolRail } from "@/components/editor/editor-toolbar";
import { Rail, RailButton, icons } from "@/components/editor/icon-rail";
import { WorkspaceRail } from "@/components/editor/workspace-rail";
import { SelectionToolbar } from "@/components/editor/selection-toolbar";
import { ImageToolbar } from "@/components/editor/image-toolbar";
import { Pagination, type PageGeometry } from "@/lib/editor/pagination";
import { FontSize } from "@/lib/editor/font-size";
import { TextAlign } from "@/lib/editor/text-align";
import { ResizableImage } from "@/lib/editor/resizable-image";
import { LeftPanel, type PanelTab } from "@/components/editor/left-panel";
import { BookPanel, type BookPanelMode } from "@/components/editor/book-panel";
import { BookCover } from "@/components/shelf/book-cover";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import {
  bookWordCount,
  chapterLabel,
  chapterNumberOf,
  findBook,
  isGenericChapterTitle,
  pageSetupOf,
  renameBook,
  renameChapter,
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

/** What one autosave carries: the document, plus the count the sidebar shows. */
interface ChapterSnapshot {
  doc: JSONContent;
  words: number;
}

/** The two page-scroll actions the surface hands up to the Book View steppers. */
type Pager = { next: () => void; prev: () => void };

// Remembers the book whose opening splash has already played, so moving from
// chapter to chapter inside it never shows the loading screen again — only
// entering a different book does. Module scope, so it survives the surface's
// remounts between chapters.
let splashedBookId: string | null = null;

// The book panel's last face — Book View or the chapter list. Kept at module
// scope so it survives the remount a chapter change triggers: without it,
// opening a chapter from the list would snap the panel back to Book View every
// time, which is exactly what a writer clicking through chapters does not want.
let lastPanelMode: BookPanelMode = "book";

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
  // Lifted out of the surface so the toolbar and the assistant can both reach
  // it — they are siblings of the manuscript, not children of it.
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tab, setTab] = useState<PanelTab>("chapters");
  // Which face the right book panel shows — the cover-and-steppers Book View, or
  // the chapter list. Seeded from the module-scope memory so a chapter change
  // (which remounts this component) keeps the face the writer left it on.
  const [panelMode, setPanelMode] = useState<BookPanelMode>(lastPanelMode);
  const changePanelMode = (mode: BookPanelMode) => {
    lastPanelMode = mode;
    setPanelMode(mode);
  };
  // The save status is lifted here so the full-width running head — which now
  // spans the top above the columns — can show it; autosave still lives in the
  // surface below and reports up.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // The Book View page steppers scroll the manuscript by a page; the surface
  // below owns the scroll and fills this in with its two scroll actions.
  const pagerRef = useRef<Pager | null>(null);
  // Page zoom. Held here rather than in the surface, which is remounted on every
  // chapter change — so the level the writer set survives moving between
  // chapters, the way it does in a word processor.
  const [zoom, setZoom] = useState(1);

  // Opening a book is worth marking; it renders faster than the eye can catch,
  // so the loading screen is held for a beat, then faded. It plays only on the
  // way *into* a book — the id above is remembered across the surface's remounts
  // between chapters, so flipping chapter to chapter never replays it.
  const [splash, setSplash] = useState<"show" | "leaving" | "gone">(() =>
    splashedBookId === bookId ? "gone" : "show",
  );
  useEffect(() => {
    if (splashedBookId === bookId) return;
    splashedBookId = bookId;
    const hold = setTimeout(() => setSplash("leaving"), 1000);
    const drop = setTimeout(() => setSplash("gone"), 1000 + 350);
    return () => {
      clearTimeout(hold);
      clearTimeout(drop);
    };
  }, [bookId]);

  const book = findBook(shelf, bookId);
  const chapter = book?.chapters.find((c) => c.id === chapterId) ?? null;

  // ⌘K / Ctrl+K opens search in the panel, wherever the caret is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTab("search");
        setPref("leftPanel", true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Remembering the open chapter is what lets a book's route land the writer
  // back where they left off, so it is worth a write on every visit.
  useEffect(() => {
    if (hydrated) touchLastOpened(bookId, chapterId);
  }, [hydrated, bookId, chapterId]);

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
    // The left rail runs the full height of the window on its own; the running
    // head is a bar across everything to its right, with the panels and
    // manuscript in the row beneath it.
    <div className="flex h-full">
      <WorkspaceRail
        bookId={bookId}
        tab={tab}
        onSelectTab={setTab}
        leftPanel={prefs.leftPanel}
        theme={prefs.theme}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <EditorHeader
          bookId={bookId}
          book={book}
          status={saveStatus}
          lastSavedAt={lastSavedAt}
          paper={prefs.paper}
        />

        <div className="flex min-h-0 flex-1">
          {prefs.leftPanel && (
          <LeftPanel
            tab={tab}
            bookId={bookId}
            chapterId={chapterId}
            chapterTitle={chapter.title}
            getChapterText={() => editor?.getText() ?? ""}
            onClose={() => setPref("leftPanel", false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Keyed on the id and a cross-tab reload counter — not the stored
              text — so a save from another tab reloads the surface, while this
              tab's own autosaves never remount it mid-keystroke. */}
          <EditorSurface
            key={`${chapterId}:${reload}`}
            bookId={bookId}
            chapterId={chapterId}
            chapterTitle={chapter.title}
            chapterNumber={chapterNumberOf(book, chapterId)}
            book={book}
            initialContent={initialContent}
            prefs={prefs}
            zoom={zoom}
            onZoom={setZoom}
            onEditorReady={setEditor}
            onStatus={setSaveStatus}
            onLastSaved={setLastSavedAt}
            pagerRef={pagerRef}
          />
        </div>

        <BookPanel
          book={book}
          chapterId={chapterId}
          cover={cover}
          mode={panelMode}
          onMode={changePanelMode}
          onPrevPage={() => pagerRef.current?.prev()}
          onNextPage={() => pagerRef.current?.next()}
        />

        <Rail
          side="right"
          paper={prefs.paper}
          // Hidden on phones: the formatting tools want a pointer and room, and
          // the screen has neither to spare next to the page. Export moves to the
          // manuscript header there instead.
          className="hidden md:flex"
          footer={
            <RailButton label="Export" href={`/book/${bookId}/export`}>
              {icons.export}
            </RailButton>
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
            title="Edit cover"
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

          <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />

          <ToolRail editor={editor} book={book} paper={prefs.paper} />

          <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />

          <RailButton
            label="Focus mode"
            active={prefs.focusMode}
            onClick={() => setPref("focusMode", !prefs.focusMode)}
          >
            {icons.focus}
          </RailButton>
          <RailButton
            label="Typewriter scrolling"
            active={prefs.typewriter}
            onClick={() => setPref("typewriter", !prefs.typewriter)}
          >
            {icons.typewriter}
          </RailButton>
        </Rail>
        </div>
      </div>

      {editingCover && (
        <CoverDialog book={book} onClose={() => setEditingCover(false)} />
      )}

      {/* The opening splash, over the editor while it settles, then faded. */}
      {splash !== "gone" && <LoadingScreen leaving={splash === "leaving"} />}
    </div>
  );
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

/**
 * The running head, a bar across the full width of the screen above the columns.
 * It wears the paper's own colour (via data-paper) so it reads as the top of the
 * page rather than chrome, and carries the book's editable title, the running
 * word count and the save status. The title is editable here, and only here —
 * autosave lives in the surface below and reports its status up to this bar.
 */
function EditorHeader({
  bookId,
  book,
  status,
  lastSavedAt,
  paper,
}: {
  bookId: string;
  book: Book;
  status: SaveStatus;
  lastSavedAt: Date | null;
  paper: Prefs["paper"];
}) {
  const written = bookWordCount(book);

  return (
    <header
      data-paper={paper}
      className="relative shrink-0 px-4 py-3 md:px-6"
      style={{
        background: "var(--paper-bg)",
        borderBottom: "1px solid var(--paper-rule)",
        colorScheme: paper === "slate" || paper === "black" ? "dark" : "light",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 md:gap-4">
        <input
          value={book.title}
          onChange={(e) => renameBook(bookId, e.target.value)}
          onBlur={(e) => {
            // A book with no name is unfindable on the shelf.
            if (!e.target.value.trim()) renameBook(bookId, "Untitled Book");
          }}
          aria-label="Book title"
          spellCheck={false}
          className="min-w-0 flex-1 truncate rounded-sm bg-transparent
                     font-serif text-base outline-none focus-visible:ring-2
                     focus-visible:ring-accent/60 md:text-lg"
          style={{ color: "var(--paper-fg)" }}
        />

        <div
          className="flex shrink-0 items-baseline gap-3 font-sans text-xs
                     md:gap-4 md:text-sm"
          style={{ color: "var(--paper-muted)" }}
        >
          <span className="tabular-nums">
            {written.toLocaleString()}
            {/* The "of target" and the word "words" are dropped on phones,
                where the header has no room to spare. */}
            <span className="hidden sm:inline">
              {book.targetWords
                ? ` of ${book.targetWords.toLocaleString()}`
                : ""}{" "}
              words
            </span>
          </span>
          {/* Polite, so a failed save is announced rather than waiting to be
              noticed — silent data loss is what this exists to catch. */}
          <span
            aria-live="polite"
            style={
              status === "error" ? { color: "var(--color-danger)" } : undefined
            }
          >
            {STATUS_LABEL[status]}
            {status === "saved" && lastSavedAt
              ? ` · ${lastSavedAt.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : null}
          </span>
        </div>
      </div>

      {/* Progress sits on the header's own bottom edge rather than taking a row
          of its own. It fills to 100% and stops while the count above keeps
          climbing: passing a target is not an error, and a bar overflowing its
          track would read like one. */}
      {book.targetWords ? (
        <div
          role="progressbar"
          aria-valuenow={written}
          aria-valuemin={0}
          aria-valuemax={book.targetWords}
          aria-label="Words written toward your target"
          className="absolute inset-x-0 bottom-0 h-0.5"
        >
          <div
            className="h-full bg-accent transition-[width] duration-500"
            style={{
              width: `${Math.min(100, Math.round((written / book.targetWords) * 100))}%`,
            }}
          />
        </div>
      ) : null}
    </header>
  );
}

function EditorSurface({
  bookId,
  chapterId,
  chapterTitle,
  chapterNumber,
  book,
  initialContent,
  prefs,
  zoom,
  onZoom,
  onEditorReady,
  onStatus,
  onLastSaved,
  pagerRef,
}: {
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  /** The body-chapter number, or null for front and back matter — which are
   *  named, so no number is printed above their title. */
  chapterNumber: number | null;
  book: Book;
  initialContent: JSONContent | null;
  prefs: Prefs;
  zoom: number;
  onZoom: (zoom: number) => void;
  onEditorReady: (editor: Editor) => void;
  /** The surface owns autosave, but the running head that shows the status now
   *  sits above the columns — so the status is reported up to it. */
  onStatus: (status: SaveStatus) => void;
  onLastSaved: (at: Date | null) => void;
  /** The surface owns the scrolling manuscript; it registers its page-scroll
   *  actions here for the Book View steppers. */
  pagerRef: { current: Pager | null };
}) {
  const holdCaret = useTypewriter(prefs.typewriter);

  const page = pageSetupOf(book);
  const metrics = pageMetrics(page);

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
  const geomRef = useRef(geom);
  const [pageCount, setPageCount] = useState(1);

  // The scrolling manuscript element, for the Book View page steppers.
  const scrollRef = useRef<HTMLElement>(null);

  const { schedule, status, lastSavedAt } = useAutosave<ChapterSnapshot>({
    save: ({ doc, words }) => saveBody(bookId, chapterId, doc, words),
  });

  // Push the save status up to the full-width running head above the columns.
  useEffect(() => onStatus(status), [status, onStatus]);
  useEffect(() => onLastSaved(lastSavedAt), [lastSavedAt, onLastSaved]);

  const editor = useEditor({
    // Required under Next's SSR — rendering immediately causes a hydration
    // mismatch, since the server has no contenteditable to produce.
    immediatelyRender: false,
    extensions: [
      StarterKit,
      CharacterCount,
      Placeholder.configure({ placeholder: "Begin your chapter…" }),
      // Marks the block the caret is in. Focus mode is then pure CSS —
      // everything without this class dims.
      Focus.configure({ className: "has-focus", mode: "shallowest" }),
      // Images are stored inline as data URLs — see lib/image-import for why
      // they are downscaled first. ResizableImage adds width/alignment and the
      // drag handles, so a picture can be handled like a word processor's.
      ResizableImage.configure({ inline: false, allowBase64: true }),
      // Inline font sizing, so a selection can be resized without turning its
      // whole paragraph into a heading.
      FontSize,
      // Per-paragraph alignment (left / centre / right / justify).
      TextAlign,
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

  // Keep the plugin's geometry current, and nudge it to re-measure when the page
  // setup changes (a resize the plugin cannot otherwise see, since the document
  // did not change).
  useEffect(() => {
    geomRef.current = geom;
    if (editor) {
      editor.view.dispatch(editor.state.tr.setMeta("repaginate", true));
    }
  }, [geom, editor]);

  // The desk is as tall as the sheets, so the last page shows in full even when
  // the writing does not fill it.
  const totalHeight = pageCount * geom.pageH + (pageCount - 1) * geom.gap;

  // Register the page-scroll actions for the Book View steppers. One "page" is a
  // sheet plus the desk gap; a CSS zoom scales the rendered pixels, so the scroll
  // amount scales with it.
  useEffect(() => {
    const step = (geom.pageH + geom.gap) * zoom;
    pagerRef.current = {
      next: () =>
        scrollRef.current?.scrollBy({ top: step, behavior: "smooth" }),
      prev: () =>
        scrollRef.current?.scrollBy({ top: -step, behavior: "smooth" }),
    };
    return () => {
      pagerRef.current = null;
    };
  }, [pagerRef, geom.pageH, geom.gap, zoom]);

  return (
    <>
      {/* The paper palette moves up here so the running head can share it.
          Every rule that depends on it is a descendant selector, so hoisting
          the class and both data attributes changes nothing below. */}
      <div
        data-paper={prefs.paper}
        // One column in print layout: the sheets flow top to bottom, so a
        // multi-column measure would put the page breaks in the wrong place.
        data-columns={1}
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
        className={`manuscript flex min-h-0 flex-1 flex-col ${
          prefs.focusMode ? "focus-mode" : ""
        }`}
      >
        {/* The workspace: the manuscript on real page sheets, like a word
            processor's print layout. The sheets are drawn behind; the editable
            flows over them, and the pagination plugin inserts the gaps so text
            never sits across a page seam. */}
        <div className="relative flex min-h-0 flex-1">
          <main
            ref={scrollRef}
            className="scroll-paper min-h-0 flex-1 cursor-text overflow-auto
                       bg-surface px-4 py-8 md:py-10"
            onClick={(e) => {
              // Clicking the text is handled by ProseMirror itself — only a
              // click on the surrounding desk needs to move focus in. And the
              // focus is placed without scrolling: focus()'s default is to
              // scroll the selection into view, which is what jumped the page to
              // the top or bottom on every click.
              if (
                editor &&
                !(e.target as HTMLElement).closest(".ProseMirror, .tiptap")
              ) {
                editor.chain().focus(undefined, { scrollIntoView: false }).run();
              }
            }}
          >
            {/* Zoomed with the CSS `zoom` property, not a transform: a transform
                on the pages breaks the browser's "scroll the caret into view"
                maths, so clicking to place the caret jumped the page to the top
                or bottom. `zoom` reflows the layout, so the caret stays put and
                the scrollbars still measure the real page height. */}
            <div
              className="pageflow"
              style={{
                width: `${geom.pageW}px`,
                height: `${totalHeight}px`,
                // Only when actually zoomed, so at 100% the property is absent
                // and cannot affect the caret-into-view maths at all.
                ...(zoom !== 1 ? { zoom } : {}),
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
                    className="reader-title w-full rounded-sm bg-transparent
                               outline-none focus-visible:ring-2
                               focus-visible:ring-accent/60"
                  />
                </div>
                <EditorContent editor={editor} />
                {/* The Word-style mini toolbars: one over a text selection, one
                    over a selected image. */}
                <SelectionToolbar editor={editor} />
                <ImageToolbar editor={editor} />
              </div>
            </div>
          </main>

          <ZoomControl zoom={zoom} onZoom={onZoom} />
        </div>
      </div>
    </>
  );
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

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
      className="absolute right-3 bottom-3 z-10 flex items-center gap-0.5
                 rounded-lg border border-line bg-panel/95 px-1 py-0.5 shadow-md
                 backdrop-blur"
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

