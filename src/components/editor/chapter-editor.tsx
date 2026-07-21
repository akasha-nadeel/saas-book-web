"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  EditorContent,
  useEditor,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Focus, Placeholder } from "@tiptap/extensions";
import Image from "@tiptap/extension-image";
import { ChatPanel } from "@/components/chat/chat-panel";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { Rail, RailButton, icons } from "@/components/editor/icon-rail";
import { LeftPanel, type PanelTab } from "@/components/editor/left-panel";
import { ColumnHeader } from "@/components/editor/top-bar";
import { ExportDialog } from "@/components/export/export-dialog";
import {
  findBook,
  pageSetupOf,
  renameChapter,
  saveBody,
  setPref,
  touchLastOpened,
  type Book,
  type Prefs,
} from "@/lib/library-store";
import { pageMetrics } from "@/lib/page-setup";
import {
  useChapterBody,
  useHydrated,
  usePrefs,
  useShelf,
} from "@/lib/use-library";
import { useTypewriter } from "@/lib/use-typewriter";
import { useAutosave, type SaveStatus } from "@/lib/use-autosave";

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

  const [exporting, setExporting] = useState(false);
  // Lifted out of the surface so the toolbar and the assistant can both reach
  // it — they are siblings of the manuscript, not children of it.
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tab, setTab] = useState<PanelTab>("chapters");

  const book = findBook(shelf, bookId);
  const chapter = book?.chapters.find((c) => c.id === chapterId) ?? null;

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
  if (!hydrated) return null;
  if (!book || !chapter) return <MissingChapter />;

  return (
    // Rails and panel run the full height of the window; the header that used
    // to sit above them now belongs to the centre column.
    <div className="flex h-full">
      <>
        <Rail side="left">
          <RailButton label="All books" href="/">
            {icons.home}
          </RailButton>

          <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />

          {(
            [
              ["chapters", "Manuscript", icons.chapters],
              ["notes", "Notes", icons.notes],
              ["bookmarks", "Bookmarks", icons.bookmarks],
            ] as const
          ).map(([value, label, icon]) => (
            <RailButton
              key={value}
              label={label}
              // Clicking the panel you are already on closes it, so the rail
              // doubles as the way to get the width back.
              active={prefs.leftPanel && tab === value}
              onClick={() => {
                if (prefs.leftPanel && tab === value) {
                  setPref("leftPanel", false);
                } else {
                  setTab(value);
                  setPref("leftPanel", true);
                }
              }}
            >
              {icon}
            </RailButton>
          ))}
        </Rail>

        {prefs.leftPanel && (
          <LeftPanel tab={tab} bookId={bookId} chapterId={chapterId} />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <ColumnHeader book={book} paper={prefs.paper} />
          <EditorToolbar editor={editor} book={book} />
          {/* Keyed on the stored text as well as the id, so a save from another
              tab reloads the surface rather than leaving this one stale. */}
          <EditorSurface
            key={`${chapterId}:${raw ?? ""}`}
            bookId={bookId}
            chapterId={chapterId}
            chapterTitle={chapter.title}
            chapterNumber={book.chapters.indexOf(chapter) + 1}
            book={book}
            initialContent={initialContent}
            prefs={prefs}
            onEditorReady={setEditor}
          />
        </div>

        {prefs.rightPanel && (
          <aside
            className="flex w-80 shrink-0 flex-col border-l border-line bg-panel"
            aria-label="Assistant"
          >
            <div className="flex h-10 shrink-0 items-center border-b border-line px-3">
              <span className="font-sans text-xs tracking-wide text-muted uppercase">
                Assistant
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel
                chapterTitle={chapter.title}
                getChapterText={() => editor?.getText() ?? ""}
              />
            </div>
          </aside>
        )}

        <Rail
          side="right"
          footer={
            <RailButton label="Export" onClick={() => setExporting(true)}>
              {icons.export}
            </RailButton>
          }
        >
          <RailButton
            label="Assistant"
            active={prefs.rightPanel}
            onClick={() => setPref("rightPanel", !prefs.rightPanel)}
          >
            {icons.assistant}
          </RailButton>

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
      </>

      {exporting && (
        <ExportDialog
          book={book}
          chapterId={chapterId}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}

/**
 * Step to the chapter either side of this one.
 *
 * Pinned to the workspace rather than the page, so it stays put whatever paper
 * size is set, and absent at the ends rather than shown disabled — there is
 * nothing to explain about an edge that does not exist.
 */
function ChapterStep({
  bookId,
  chapter,
  side,
}: {
  bookId: string;
  chapter: { id: string; title: string } | null;
  side: "left" | "right";
}) {
  if (!chapter) return null;

  return (
    <Link
      href={`/book/${bookId}/chapter/${chapter.id}`}
      aria-label={`${side === "left" ? "Previous" : "Next"} chapter: ${chapter.title}`}
      title={chapter.title}
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2
                  items-center justify-center rounded-full border border-line
                  bg-panel/90 text-lg text-muted opacity-60 backdrop-blur
                  outline-none transition-opacity hover:text-fg
                  hover:opacity-100 focus-visible:opacity-100
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    side === "left" ? "left-3" : "right-3"
                  }`}
    >
      <span aria-hidden="true">{side === "left" ? "‹" : "›"}</span>
    </Link>
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

function EditorSurface({
  bookId,
  chapterId,
  chapterTitle,
  chapterNumber,
  book,
  initialContent,
  prefs,
  onEditorReady,
}: {
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  book: Book;
  initialContent: JSONContent | null;
  prefs: Prefs;
  onEditorReady: (editor: Editor) => void;
}) {
  const [words, setWords] = useState(0);
  const holdCaret = useTypewriter(prefs.typewriter);

  const page = pageSetupOf(book);
  const metrics = pageMetrics(page);

  // Neighbours in the book's own order, so stepping through matches the order
  // the manuscript panel shows.
  const index = book.chapters.findIndex((c) => c.id === chapterId);
  const previous = index > 0 ? book.chapters[index - 1] : null;
  const next =
    index >= 0 && index < book.chapters.length - 1
      ? book.chapters[index + 1]
      : null;

  // Words at the moment this chapter opened, so the status bar can show what
  // was written in this sitting. State rather than a ref because it is read
  // during render. Deliberately not persisted — a session ends when you close
  // the tab, and carrying it across reloads would make the number lie.
  const [openedWith, setOpenedWith] = useState<number | null>(null);

  const { schedule, status, lastSavedAt } = useAutosave<ChapterSnapshot>({
    save: ({ doc, words }) => saveBody(bookId, chapterId, doc, words),
  });

  // Word count is throttled rather than recomputed per keystroke. Setting
  // React state on every input is the classic way to make Tiptap feel laggy.
  const wordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttleWordCount = (next: number) => {
    if (wordTimer.current) return;
    wordTimer.current = setTimeout(() => {
      wordTimer.current = null;
      setWords(next);
    }, 400);
  };

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
      // they are downscaled first.
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: initialContent ?? "",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Chapter text",
        spellcheck: "true",
      },
    },
    onCreate: ({ editor }) => {
      const initial = editor.storage.characterCount.words();
      setWords(initial);
      setOpenedWith(initial);
      onEditorReady(editor);
    },
    onUpdate: ({ editor }) => {
      const next = editor.storage.characterCount.words();
      // Read the true count here, not the throttled state — the sidebar should
      // land on the right number even if the last tick never fires.
      schedule({ doc: editor.getJSON(), words: next });
      throttleWordCount(next);
      holdCaret(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      // Clicking or arrowing to a distant line should recentre too, not only
      // typing.
      holdCaret(editor);
    },
  });

  return (
    <>
      {/* The workspace, and the page on it. Physical dimensions in inches —
          CSS understands `in` natively, so the numbers from pageMetrics go
          straight into the style with no pixels-per-inch fudge. */}
      <div className="relative flex min-h-0 flex-1">
      <main
        data-paper={prefs.paper}
        data-columns={page.columns}
        className={`manuscript min-h-0 flex-1 cursor-text overflow-auto
                    bg-surface px-8 py-8 ${
                      prefs.focusMode ? "focus-mode" : ""
                    }`}
        onClick={() => editor?.chain().focus().run()}
      >
        <div
          className="paper mx-auto shadow-lg"
          style={{
            width: `${metrics.width}in`,
            minHeight: `${metrics.height}in`,
            paddingTop: `${metrics.top}in`,
            paddingBottom: prefs.typewriter ? "60vh" : `${metrics.bottom}in`,
            paddingLeft: `${metrics.left}in`,
            paddingRight: `${metrics.right}in`,
          }}
        >
          {/* Centred, with the chapter's number above it, the way the page of
              a printed book opens. */}
          <p
            className="text-center font-serif text-5xl leading-none"
            style={{ color: "var(--paper-muted)", opacity: 0.5 }}
          >
            {chapterNumber}
          </p>
          {/* An input rather than a heading with contenteditable: the title is
              a single line of plain text, and a plain input gets the caret,
              undo and screen-reader behaviour right for free. */}
          <input
            value={chapterTitle}
            onChange={(e) => renameChapter(bookId, chapterId, e.target.value)}
            onBlur={(e) => {
              if (!e.target.value.trim()) {
                renameChapter(bookId, chapterId, "Untitled chapter");
              }
            }}
            aria-label="Chapter title"
            spellCheck={false}
            style={{ color: "var(--paper-fg)" }}
            className="mt-6 mb-12 w-full rounded-sm bg-transparent text-center
                       font-serif text-4xl outline-none focus-visible:ring-2
                       focus-visible:ring-accent/60"
          />
          <EditorContent editor={editor} />
        </div>
      </main>

        <ChapterStep bookId={bookId} chapter={previous} side="left" />
        <ChapterStep bookId={bookId} chapter={next} side="right" />
      </div>

      <StatusBar
        words={words}
        sessionWords={openedWith === null ? 0 : words - openedWith}
        status={status}
        lastSavedAt={lastSavedAt}
      />
    </>
  );
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  error: "Could not save",
};

function StatusBar({
  words,
  sessionWords,
  status,
  lastSavedAt,
}: {
  words: number;
  sessionWords: number;
  status: SaveStatus;
  lastSavedAt: Date | null;
}) {
  return (
    // In the flow rather than pinned to the viewport: with three panes that can
    // open and close there is no fixed offset that stays on the manuscript.
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-line px-4 font-sans text-xs text-muted">
      <span className="flex items-baseline gap-3">
        <span>
          {words.toLocaleString()} {words === 1 ? "word" : "words"}
        </span>
        {sessionWords > 0 && (
          <span className="text-accent-strong">
            +{sessionWords.toLocaleString()}
          </span>
        )}
      </span>

      <span className={status === "error" ? "text-accent" : undefined}>
        {STATUS_LABEL[status]}
        {status === "saved" && lastSavedAt
          ? ` · ${lastSavedAt.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}`
          : null}
      </span>
    </footer>
  );
}
