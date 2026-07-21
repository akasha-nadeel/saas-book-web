"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { useAutosave, type SaveStatus } from "@/lib/use-autosave";

const STORAGE_KEY = "openchapter:spike:chapter-1";

/**
 * Spike storage. Deliberately isolated behind the same shape a Supabase read
 * and write will have, so swapping the backend later touches only this block.
 */
function subscribeToDraft(onStoreChange: () => void) {
  // Fires for writes from *other* tabs only, which is exactly what we want:
  // our own saves must not invalidate the editor we're typing into.
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getDraftSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerDraftSnapshot(): string | null {
  return null;
}

function saveDraft(doc: JSONContent) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
}

export function ChapterEditor() {
  // Reading an external store this way keeps us SSR-safe without a loading
  // flag: the server renders the empty snapshot, the client swaps in the real
  // one straight after hydration.
  const raw = useSyncExternalStore(
    subscribeToDraft,
    getDraftSnapshot,
    getServerDraftSnapshot,
  );

  const initialContent = useMemo<JSONContent | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as JSONContent;
    } catch {
      return null;
    }
  }, [raw]);

  return (
    <div className="flex flex-1 flex-col">
      <ChapterHeader />
      {/* Keyed on the stored draft so the surface remounts once, when the
          client snapshot replaces the server's empty one. */}
      <EditorSurface key={raw ?? "empty"} initialContent={initialContent} />
    </div>
  );
}

function ChapterHeader() {
  return (
    <header className="pt-16 pb-10">
      <div className="mx-auto w-full max-w-(--measure-manuscript) px-6">
        <p className="font-sans text-xs uppercase tracking-[0.18em] text-warmgray">
          The Salt Road
        </p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Chapter One</h1>
      </div>
    </header>
  );
}

function EditorSurface({
  initialContent,
}: {
  initialContent: JSONContent | null;
}) {
  const [words, setWords] = useState(0);

  const { schedule, status, lastSavedAt } = useAutosave<JSONContent>({
    save: saveDraft,
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
      schedule(editor.getJSON());
      throttleWordCount(editor.storage.characterCount.words());
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
      className="pointer-events-none fixed inset-x-0 bottom-0 px-6 py-5
                 opacity-40 transition-opacity duration-500 hover:opacity-100
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
