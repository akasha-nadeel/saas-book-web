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
import { ChatPanel } from "@/components/chat/chat-panel";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { LeftPanel } from "@/components/editor/left-panel";
import { TopBar } from "@/components/editor/top-bar";
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
    <div className="flex h-full flex-col">
      <TopBar
        book={book}
        chapterTitle={chapter.title}
        prefs={prefs}
        onExport={() => setExporting(true)}
      />

      <div className="flex min-h-0 flex-1">
        {prefs.leftPanel ? (
          <LeftPanel bookId={bookId} chapterId={chapterId} />
        ) : (
          <CollapsedRail
            side="left"
            label="Show chapters and notes"
            onOpen={() => setPref("leftPanel", true)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <EditorToolbar editor={editor} book={book} />
          {/* Keyed on the stored text as well as the id, so a save from another
              tab reloads the surface rather than leaving this one stale. */}
          <EditorSurface
            key={`${chapterId}:${raw ?? ""}`}
            bookId={bookId}
            chapterId={chapterId}
            chapterTitle={chapter.title}
            book={book}
            initialContent={initialContent}
            prefs={prefs}
            onEditorReady={setEditor}
          />
        </div>

        {!prefs.rightPanel && (
          <CollapsedRail
            side="right"
            label="Show assistant"
            onOpen={() => setPref("rightPanel", true)}
          />
        )}

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
      </div>

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
 * The strip left behind by a closed panel.
 *
 * A panel toggled shut from the top bar leaves no trace at the place it used
 * to be, so the way back is only findable if you remember which button did it.
 * A full-height edge handle keeps it reachable where the panel was.
 */
function CollapsedRail({
  side,
  label,
  onOpen,
}: {
  side: "left" | "right";
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      className={`group flex w-4 shrink-0 items-center justify-center bg-panel
                  outline-none transition-colors hover:bg-raised
                  focus-visible:ring-2 focus-visible:ring-inset
                  focus-visible:ring-accent/60 ${
                    side === "left"
                      ? "border-r border-line"
                      : "border-l border-line"
                  }`}
    >
      <span
        aria-hidden="true"
        className="text-xs text-muted transition-colors group-hover:text-fg"
      >
        {side === "left" ? "›" : "‹"}
      </span>
    </button>
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
  book,
  initialContent,
  prefs,
  onEditorReady,
}: {
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  book: Book;
  initialContent: JSONContent | null;
  prefs: Prefs;
  onEditorReady: (editor: Editor) => void;
}) {
  const [words, setWords] = useState(0);
  const holdCaret = useTypewriter(prefs.typewriter);

  const page = pageSetupOf(book);
  const metrics = pageMetrics(page);

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
          <p
            className="font-sans text-xs tracking-[0.18em] uppercase"
            style={{ color: "var(--paper-muted)" }}
          >
            {book.title}
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
            className="mt-2 mb-10 w-full rounded-sm bg-transparent font-serif
                       text-3xl outline-none focus-visible:ring-2
                       focus-visible:ring-accent/60"
          />
          <EditorContent editor={editor} />
        </div>
      </main>

      <StatusBar
        words={words}
        sessionWords={openedWith === null ? 0 : words - openedWith}
        status={status}
        lastSavedAt={lastSavedAt}
        prefs={prefs}
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

function ModeToggle({
  on,
  onToggle,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`rounded-sm outline-none transition-colors
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    on ? "text-accent" : "text-muted hover:text-fg"
                  }`}
    >
      {children}
    </button>
  );
}

function StatusBar({
  words,
  sessionWords,
  status,
  lastSavedAt,
  prefs,
}: {
  words: number;
  sessionWords: number;
  status: SaveStatus;
  lastSavedAt: Date | null;
  prefs: Prefs;
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
          <span className="text-accent">+{sessionWords.toLocaleString()}</span>
        )}
      </span>

      <span className="flex items-baseline gap-4">
        <ModeToggle
          on={prefs.focusMode}
          onToggle={() => setPref("focusMode", !prefs.focusMode)}
        >
          Focus
        </ModeToggle>
        <ModeToggle
          on={prefs.typewriter}
          onToggle={() => setPref("typewriter", !prefs.typewriter)}
        >
          Typewriter
        </ModeToggle>
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
