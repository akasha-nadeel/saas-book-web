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
import { clickToType } from "@/lib/editor/click-to-type";
import { keepCaretInView } from "@/lib/editor/caret-scroll";
import { FontSize } from "@/lib/editor/font-size";
import { TextAlign } from "@/lib/editor/text-align";
import { NoIndent } from "@/lib/editor/no-indent";
import { ResizableImage } from "@/lib/editor/resizable-image";
import { LeftPanel, type PanelTab } from "@/components/editor/left-panel";
import { BookPanel, type BookPanelMode } from "@/components/editor/book-panel";
import { BookCover } from "@/components/shelf/book-cover";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import {
  bookWordCount,
  chapterLabel,
  chapterMatterOf,
  chapterNumberOf,
  findBook,
  isGenericChapterTitle,
  pageSetupOf,
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
  // The left panel here is tools only — the book panel beside the manuscript is
  // the chapter list, so offering a second one was the same list twice. With no
  // chapter list to land on, the panel starts closed and a rail tab opens it;
  // "search" is only the seed, never seen until a tab is picked. Local state
  // rather than the stored leftPanel flag, which still governs the overview,
  // where the panel *is* the chapter list and belongs open.
  const [tab, setTab] = useState<PanelTab>("search");
  const [panelOpen, setPanelOpen] = useState(false);
  // Which face the right book panel shows — the cover-and-steppers Book View, or
  // the chapter list. Seeded from the module-scope memory so a chapter change
  // (which remounts this component) keeps the face the writer left it on.
  const [panelMode, setPanelMode] = useState<BookPanelMode>(lastPanelMode);
  const changePanelMode = (mode: BookPanelMode) => {
    lastPanelMode = mode;
    setPanelMode(mode);
  };
  // Page zoom. Held here rather than in the surface, which is remounted on every
  // chapter change — so the level the writer set survives moving between
  // chapters, the way it does in a word processor.
  const [zoom, setZoom] = useState(1);

  // Opening a book is worth marking; it renders faster than the eye can catch,
  // so the loading screen is held for a beat, then faded. It plays only on the
  // way *into* a book — the id above is remembered across the surface's remounts
  // between chapters, so flipping chapter to chapter never replays it.
  //
  // Whether this mount is an opening is decided *here*, once, and held as state.
  // The effect below must not be the thing that decides, because React mounts
  // effects twice in development (run, clean up, run again): a guard the effect
  // sets itself passes on the first run and fails on the second, so the timers
  // it scheduled are cleared and never replaced — leaving the splash on screen
  // for good, pulsing, with nothing left to take it down.
  const [opening] = useState(() => splashedBookId !== bookId);
  const [splash, setSplash] = useState<"show" | "leaving" | "gone">(
    opening ? "show" : "gone",
  );
  useEffect(() => {
    if (!opening) return;
    splashedBookId = bookId;
    const hold = setTimeout(() => setSplash("leaving"), 1000);
    const drop = setTimeout(() => setSplash("gone"), 1000 + 350);
    return () => {
      clearTimeout(hold);
      clearTimeout(drop);
    };
  }, [opening, bookId]);

  const book = findBook(shelf, bookId);
  const chapter = book?.chapters.find((c) => c.id === chapterId) ?? null;

  // ⌘K / Ctrl+K opens search in the panel, wherever the caret is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTab("search");
        setPanelOpen(true);
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
    // No chrome bar across the top: the rail runs full height on the left, the
    // panels and manuscript fill the rest, and the word count and save status
    // float in the workspace's top-left corner (see EditorSurface).
    <div className="flex h-full">
      <WorkspaceRail
        bookId={bookId}
        tab={tab}
        onSelectTab={setTab}
        leftPanel={panelOpen}
        onPanel={setPanelOpen}
        chapters={false}
        theme={prefs.theme}
      />

      {/* One continuous gradient wash behind the book panel and the paper — the
          shelf hero's, in both themes — so the two read as one surface rather
          than separate sections. The children below are transparent; only the
          rails and the open left panel lay their own chrome over it. */}
      <div className="shelf-hero flex min-h-0 min-w-0 flex-1">
          {panelOpen && (
          <LeftPanel
            tab={tab}
            bookId={bookId}
            chapterId={chapterId}
            chapterTitle={chapter.title}
            getChapterText={() => editor?.getText() ?? ""}
            onClose={() => setPanelOpen(false)}
          />
        )}

        {/* The book panel sits on the left, the manuscript to its right. */}
        <BookPanel
          book={book}
          chapterId={chapterId}
          cover={cover}
          paper={prefs.paper}
          mode={panelMode}
          onMode={changePanelMode}
        />

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
            // Front and back matter are designed on the page — a title page, a
            // dedication, an epigraph. Only they get click-and-type; a body
            // chapter flows. See handleSheetDoubleClick.
            placeable={chapterMatterOf(chapter) !== "body"}
            book={book}
            initialContent={initialContent}
            prefs={prefs}
            zoom={zoom}
            onZoom={setZoom}
            onEditorReady={setEditor}
          />
        </div>

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
            label="Typewriter scrolling"
            active={prefs.typewriter}
            onClick={() => setPref("typewriter", !prefs.typewriter)}
          >
            {icons.typewriter}
          </RailButton>
          {/* Word's ¶ button: what is actually on the page, as against what can
              be seen of it. */}
          <RailButton
            label="Show paragraph marks"
            active={prefs.marks}
            onClick={() => setPref("marks", !prefs.marks)}
          >
            <span
              aria-hidden="true"
              className="font-sans text-base leading-none"
            >
              ¶
            </span>
          </RailButton>
        </Rail>
      </div>

      {editingCover && (
        <CoverDialog book={book} onClose={() => setEditingCover(false)} />
      )}

      {/* The opening splash, over the editor while it settles, then faded. */}
      {splash !== "gone" && <LoadingScreen leaving={splash === "leaving"} />}
    </div>
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
  onEditorReady,
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
  onEditorReady: (editor: Editor) => void;
}) {
  const holdCaret = useTypewriter(prefs.typewriter);

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
  const geomRef = useRef(geom);
  const [pageCount, setPageCount] = useState(1);

  // Read from inside the editor's own scroll handler, which is bound once when
  // the editor is built and so cannot close over a changing preference.
  const typewriterRef = useRef(prefs.typewriter);
  useEffect(() => {
    typewriterRef.current = prefs.typewriter;
  }, [prefs.typewriter]);

  const { schedule, status, lastSavedAt } = useAutosave<ChapterSnapshot>({
    save: ({ doc, words }) => saveBody(bookId, chapterId, doc, words),
  });

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
      // The flush-at-the-margin mark a click-placed line carries, so it begins
      // where the caret was shown rather than a first-line indent in from it.
      NoIndent,
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
  const handleSheetClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || !editor.isEditable) return;

    // The title, the floating toolbars, and the prose itself all handle their
    // own clicks — the browser has already placed the caret inside the text.
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '.chapter-opener, button, input, a, [contenteditable="true"]',
      )
    ) {
      return;
    }

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
    if (!placeable) return;
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
    geomRef.current = geom;
    if (editor) {
      editor.view.dispatch(editor.state.tr.setMeta("repaginate", true));
    }
  }, [geom, editor]);

  // The desk is as tall as the sheets, so the last page shows in full even when
  // the writing does not fill it.
  const totalHeight = pageCount * geom.pageH + (pageCount - 1) * geom.gap;

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
        // Shows the ¶ at the end of every paragraph — see the note in
        // globals.css for why it is drawn at zero width.
        data-marks={prefs.marks ? "" : undefined}
        className={`manuscript flex min-h-0 flex-1 flex-col ${
          prefs.focusMode ? "focus-mode" : ""
        }`}
      >
        {/* The workspace: the manuscript on real page sheets, like a word
            processor's print layout. The sheets are drawn behind; the editable
            flows over them, and the pagination plugin inserts the gaps so text
            never sits across a page seam. */}
        {/* Transparent, so the shared gradient on the row above shows through
            and the page sheets float on it. */}
        <div className="relative flex min-h-0 flex-1">
          <main
            className="scroll-paper min-h-0 flex-1 cursor-text overflow-auto
                       bg-transparent px-4 py-8 md:py-10"
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
                (e.target as HTMLElement).closest(".ProseMirror, .tiptap")
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
            <div
              className="pointer-events-none sticky top-0 z-10 mx-auto mb-2 flex
                         items-baseline justify-between font-sans text-xs text-muted"
              style={{
                width: `${geom.pageW * zoom * PAGE_SCALE}px`,
                maxWidth: "100%",
              }}
            >
              <span className="tabular-nums">
                {written.toLocaleString()}
                {book.targetWords
                  ? ` of ${book.targetWords.toLocaleString()}`
                  : ""}{" "}
                words
              </span>
              <span
                aria-live="polite"
                style={
                  status === "error"
                    ? { color: "var(--color-danger)" }
                    : undefined
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

