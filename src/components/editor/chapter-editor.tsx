"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ToolRail } from "@/components/editor/editor-toolbar";
import { Rail, RailButton, icons } from "@/components/editor/icon-rail";
import { LeftPanel, type PanelTab } from "@/components/editor/left-panel";
import { ExportDialog } from "@/components/export/export-dialog";
import { BookCover } from "@/components/shelf/book-cover";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import {
  bookWordCount,
  findBook,
  pageSetupOf,
  renameBook,
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
  useCover,
  useHydrated,
  usePrefs,
  useShelf,
} from "@/lib/use-library";
import { useTypewriter } from "@/lib/use-typewriter";
import { useAutosave, type SaveStatus } from "@/lib/use-autosave";

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
  const cover = useCover(bookId);

  const [exporting, setExporting] = useState(false);
  const [editingCover, setEditingCover] = useState(false);
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
          paper={prefs.paper}
          footer={
            <RailButton label="Export" onClick={() => setExporting(true)}>
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
            />
          </button>

          <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />

          <ToolRail editor={editor} book={book} paper={prefs.paper} />

          <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />

          <RailButton
            label="Assistant"
            active={prefs.rightPanel}
            onClick={() => setPref("rightPanel", !prefs.rightPanel)}
          >
            {icons.assistant}
          </RailButton>

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
      {editingCover && (
        <CoverDialog book={book} onClose={() => setEditingCover(false)} />
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
      className={`absolute top-1/2 z-10 flex h-12 w-8 -translate-y-1/2
                  items-center justify-center text-2xl leading-none
                  opacity-35 outline-none transition-opacity
                  hover:opacity-90 focus-visible:opacity-100
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    side === "left" ? "left-1" : "right-1"
                  }`}
      style={{ color: "var(--paper-muted)" }}
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
  const holdCaret = useTypewriter(prefs.typewriter);

  const page = pageSetupOf(book);
  const metrics = pageMetrics(page);
  const written = bookWordCount(book);

  // Neighbours in the book's own order, so stepping through matches the order
  // the manuscript panel shows.
  const index = book.chapters.findIndex((c) => c.id === chapterId);
  const previous = index > 0 ? book.chapters[index - 1] : null;
  const next =
    index >= 0 && index < book.chapters.length - 1
      ? book.chapters[index + 1]
      : null;

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
      onEditorReady(editor);
    },
    onUpdate: ({ editor }) => {
      // The chapter's count still reaches the panel: it is saved with the
      // document and each chapter row renders its own.
      schedule({
        doc: editor.getJSON(),
        words: editor.storage.characterCount.words(),
      });
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
      {/* The paper palette moves up here so the running head can share it.
          Every rule that depends on it is a descendant selector, so hoisting
          the class and both data attributes changes nothing below. */}
      <div
        data-paper={prefs.paper}
        data-columns={page.columns}
        className={`manuscript flex min-h-0 flex-1 flex-col ${
          prefs.focusMode ? "focus-mode" : ""
        }`}
      >
        {/* The running head: which book this is on the left, how it is going on
            the right. On the paper's own colour, so it reads as the top of the
            sheet rather than as chrome above it — and it follows the page
            colour, since a white bar over a black page would look like a
            rendering fault.

            The title is editable here, and only here. It used to be read-only
            because the manuscript panel carried the same field, and two live
            inputs bound to one value fight over the caret — with the panel's
            gone, this is the one place a book gets its name. */}
        <header
          className="relative shrink-0 px-6 py-3"
          style={{
            background: "var(--paper-bg)",
            borderBottom: "1px solid var(--paper-rule)",
          }}
        >
          <div className="flex items-baseline justify-between gap-4">
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
                         font-serif text-lg outline-none focus-visible:ring-2
                         focus-visible:ring-accent/60"
              style={{ color: "var(--paper-fg)" }}
            />

            <div
              className="flex shrink-0 items-baseline gap-4 font-sans text-sm"
              style={{ color: "var(--paper-muted)" }}
            >
              <span className="tabular-nums">
                {written.toLocaleString()}
                {book.targetWords
                  ? ` of ${book.targetWords.toLocaleString()}`
                  : ""}{" "}
                words
              </span>
              {/* Polite, so a failed save is announced rather than waiting to
                  be noticed — silent data loss is what this exists to catch. */}
              <span
                aria-live="polite"
                style={status === "error" ? { color: "#ff6568" } : undefined}
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

          {/* Progress sits on the header's own bottom edge rather than taking a
              row of its own. It fills to 100% and stops while the count above
              keeps climbing: passing a target is not an error, and a bar
              overflowing its track would read like one. */}
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

        {/* The workspace, and the page on it. Physical dimensions in inches —
            CSS understands `in` natively, so the numbers from pageMetrics go
            straight into the style with no pixels-per-inch fudge. */}
        <div className="relative flex min-h-0 flex-1">
          <main
            className={`scroll-slim min-h-0 flex-1 cursor-text overflow-auto
                        bg-surface ${page.fit ? "" : "px-8 py-8"}`}
            onClick={() => editor?.chain().focus().run()}
          >
            {/* Fitted, the page is the column and needs no shadow — there is no
                desk left showing for it to cast onto. */}
            <div
              className={page.fit ? "paper min-h-full" : "paper mx-auto shadow-lg"}
              style={{
                width: page.fit ? "100%" : `${metrics.width}in`,
                minHeight: page.fit ? undefined : `${metrics.height}in`,
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
      </div>
    </>
  );
}

