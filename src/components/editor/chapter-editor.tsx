"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { renameChapter, saveBody, touchLastOpened } from "@/lib/chapter-store";
import { useChapterBody, useHydrated, useManifest } from "@/lib/use-chapters";
import { useAutosave, type SaveStatus } from "@/lib/use-autosave";

/** What one autosave carries: the document, plus the count the sidebar shows. */
interface ChapterSnapshot {
  doc: JSONContent;
  words: number;
}

export function ChapterEditor({ chapterId }: { chapterId: string }) {
  const hydrated = useHydrated();
  const { bookTitle, chapters } = useManifest();
  const raw = useChapterBody(chapterId);

  const chapter = chapters.find((c) => c.id === chapterId) ?? null;

  // Remembering the open chapter is what lets "/" land the writer back where
  // they left off, so it is worth a write on every visit.
  useEffect(() => {
    if (hydrated) touchLastOpened(chapterId);
  }, [hydrated, chapterId]);

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
  if (!chapter) return <MissingChapter />;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ChapterHeader
        bookTitle={bookTitle}
        title={chapter.title}
        chapterId={chapterId}
      />
      {/* Keyed on the stored text as well as the id, so a save from another tab
          reloads the surface rather than leaving this one silently stale. */}
      <EditorSurface
        key={`${chapterId}:${raw ?? ""}`}
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
        <p className="font-serif text-xl text-ink">This chapter isn’t here.</p>
        <p className="mt-2 font-sans text-sm text-warmgray">
          It may have been deleted, or the link may be wrong.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-sm font-sans text-sm text-burgundy
                     underline underline-offset-4 outline-none
                     focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          Back to your book
        </Link>
      </div>
    </main>
  );
}

function ChapterHeader({
  bookTitle,
  title,
  chapterId,
}: {
  bookTitle: string;
  title: string;
  chapterId: string;
}) {
  return (
    <header className="pt-16 pb-10">
      <div className="mx-auto w-full max-w-(--measure-manuscript) px-6">
        <p className="font-sans text-xs tracking-[0.18em] text-warmgray uppercase">
          {bookTitle}
        </p>
        {/* An input rather than a heading with contenteditable: the title is a
            single line of plain text, and a plain input gets the caret, undo
            and screen-reader behaviour right for free. */}
        <input
          value={title}
          onChange={(e) => renameChapter(chapterId, e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) {
              renameChapter(chapterId, "Untitled chapter");
            }
          }}
          aria-label="Chapter title"
          spellCheck={false}
          className="mt-2 w-full rounded-sm bg-transparent font-serif text-3xl
                     text-ink outline-none focus-visible:ring-2
                     focus-visible:ring-gold/60"
        />
      </div>
    </header>
  );
}

function EditorSurface({
  chapterId,
  initialContent,
}: {
  chapterId: string;
  initialContent: JSONContent | null;
}) {
  const [words, setWords] = useState(0);

  const { schedule, status, lastSavedAt } = useAutosave<ChapterSnapshot>({
    save: ({ doc, words }) => saveBody(chapterId, doc, words),
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
      setWords(editor.storage.characterCount.words());
    },
    onUpdate: ({ editor }) => {
      const next = editor.storage.characterCount.words();
      // Read the true count here, not the throttled state — the sidebar should
      // land on the right number even if the last tick never fires.
      schedule({ doc: editor.getJSON(), words: next });
      throttleWordCount(next);
    },
  });

  return (
    <>
      <main
        className="manuscript flex-1 cursor-text px-6 pb-40"
        onClick={() => editor?.chain().focus().run()}
      >
        <div className="mx-auto w-full max-w-(--measure-manuscript)">
          <EditorContent editor={editor} />
        </div>
      </main>

      <StatusBar words={words} status={status} lastSavedAt={lastSavedAt} />
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
  status,
  lastSavedAt,
}: {
  words: number;
  status: SaveStatus;
  lastSavedAt: Date | null;
}) {
  return (
    <footer
      // Pinned to the manuscript column, not the viewport, so it stays centred
      // on the same measure as the prose above it.
      className="pointer-events-none fixed right-0 bottom-0
                 left-(--sidebar-width) px-6 py-5 opacity-40
                 transition-opacity duration-500 hover:opacity-100
                 focus-within:opacity-100"
    >
      <div className="mx-auto flex w-full max-w-(--measure-manuscript) items-baseline justify-between font-sans text-xs text-warmgray">
        <span>
          {words.toLocaleString()} {words === 1 ? "word" : "words"}
        </span>
        <span className={status === "error" ? "text-burgundy" : undefined}>
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
