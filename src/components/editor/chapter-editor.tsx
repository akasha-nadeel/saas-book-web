"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Focus, Placeholder } from "@tiptap/extensions";
import { ExportDialog } from "@/components/export/export-dialog";
import {
  findBook,
  renameChapter,
  saveBody,
  setPref,
  touchLastOpened,
  type Book,
  type Prefs,
} from "@/lib/library-store";
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
  const raw = useChapterBody(chapterId);

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
    <div className="flex min-h-full flex-1 flex-col">
      <ChapterHeader
        book={book}
        title={chapter.title}
        bookId={bookId}
        chapterId={chapterId}
      />
      {/* Keyed on the stored text as well as the id, so a save from another tab
          reloads the surface rather than leaving this one silently stale. */}
      <EditorSurface
        key={`${chapterId}:${raw ?? ""}`}
        bookId={bookId}
        chapterId={chapterId}
        initialContent={initialContent}
      />
    </div>
  );
}

function MissingChapter() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
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

function ChapterHeader({
  book,
  title,
  bookId,
  chapterId,
}: {
  book: Book;
  title: string;
  bookId: string;
  chapterId: string;
}) {
  const [exporting, setExporting] = useState(false);

  return (
    <header className="pt-16 pb-10">
      <div className="mx-auto w-full max-w-(--measure-manuscript) px-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-sans text-xs tracking-[0.18em] text-muted uppercase">
            {book.title}
          </p>
          <button
            type="button"
            onClick={() => setExporting(true)}
            // Always visible. This is the one control that gets the writing
            // out of the app, so it does not hide behind a hover the way the
            // destructive actions do.
            className="shrink-0 rounded-sm font-sans text-xs tracking-[0.18em]
                       text-muted uppercase opacity-70 outline-none
                       transition-opacity hover:text-accent hover:opacity-100
                       focus-visible:opacity-100 focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Export
          </button>
        </div>
        {/* An input rather than a heading with contenteditable: the title is a
            single line of plain text, and a plain input gets the caret, undo
            and screen-reader behaviour right for free. */}
        <input
          value={title}
          onChange={(e) => renameChapter(bookId, chapterId, e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) {
              renameChapter(bookId, chapterId, "Untitled chapter");
            }
          }}
          aria-label="Chapter title"
          spellCheck={false}
          className="mt-2 w-full rounded-sm bg-transparent font-serif text-3xl
                     text-fg outline-none focus-visible:ring-2
                     focus-visible:ring-accent/60"
        />
      </div>

      {exporting && (
        <ExportDialog
          book={book}
          chapterId={chapterId}
          onClose={() => setExporting(false)}
        />
      )}
    </header>
  );
}

function EditorSurface({
  bookId,
  chapterId,
  initialContent,
}: {
  bookId: string;
  chapterId: string;
  initialContent: JSONContent | null;
}) {
  const [words, setWords] = useState(0);
  const prefs = usePrefs();
  const holdCaret = useTypewriter(prefs.typewriter);

  // Words at the moment this chapter opened, so the status bar can show what
  // was written in this sitting. State rather than a ref because it is read
  // during render, which a ref does not permit. Deliberately not persisted —
  // a session ends when you close the tab, and carrying it across reloads
  // would make the number lie.
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
      <main
        className={`manuscript flex-1 cursor-text px-6 ${
          // Typewriter mode needs room below the last line, or the caret can
          // never reach the middle of the screen at the end of a chapter.
          prefs.typewriter ? "pb-[60vh]" : "pb-40"
        } ${prefs.focusMode ? "focus-mode" : ""}`}
        onClick={() => editor?.chain().focus().run()}
      >
        <div className="mx-auto w-full max-w-(--measure-manuscript)">
          <EditorContent editor={editor} />
        </div>
      </main>

      <StatusBar
        words={words}
        sessionWords={
          openedWith === null ? 0 : words - openedWith
        }
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
    <footer
      // Pinned to the manuscript column, not the viewport, so it stays centred
      // on the same measure as the prose above it. pointer-events-none on the
      // bar, re-enabled on the row, so the padding never swallows a click
      // meant for the manuscript underneath.
      className="pointer-events-none fixed right-0 bottom-0
                 left-(--sidebar-width) px-6 py-5 opacity-40
                 transition-opacity duration-500 hover:opacity-100
                 focus-within:opacity-100"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-(--measure-manuscript) items-baseline justify-between gap-6 font-sans text-xs text-muted">
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
      </div>
    </footer>
  );
}
