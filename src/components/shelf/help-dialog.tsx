"use client";

import { useEffect, useRef } from "react";

/**
 * What OpenChapter can do, in one place.
 *
 * The content is data, not markup, so keeping it current is a matter of adding
 * a line to the list below — which must happen whenever a user-facing feature
 * ships. This is the app's own record of what it offers; a stale one is worse
 * than none.
 */
const SECTIONS: { title: string; items: { name: string; desc: string }[] }[] = [
  {
    title: "Your library",
    items: [
      {
        name: "New book",
        desc: "Start a book, and optionally give it a subtitle, author, genre, a word-count goal, and cover art.",
      },
      {
        name: "Import",
        desc: "Bring in a .docx, .epub, .md, .txt, or .html file — it is split into chapters for you.",
      },
      {
        name: "Templates",
        desc: "Start from a ready-made chapter structure instead of a blank book.",
      },
      { name: "Search", desc: "Filter the shelf by book title." },
      {
        name: "Sort",
        desc: "Order the shelf by most recently opened, title A–Z, or word count.",
      },
      {
        name: "Archive",
        desc: "Set a finished or paused book aside without deleting it.",
      },
      {
        name: "Trash & restore",
        desc: "Move a book to the trash — recoverable — and restore it later, or delete it for good.",
      },
      {
        name: "Covers",
        desc: "Add your own cover art, or edit the title, subtitle, and author printed on a typeset cover.",
      },
    ],
  },
  {
    title: "Writing",
    items: [
      {
        name: "Book overview",
        desc: "Opening a book lands on its overview — the chapter panel on the left and a short guide to how the book is put together — rather than a chapter. Pick a chapter to write, or use “Continue writing” on the shelf to jump straight back to where you left off.",
      },
      {
        name: "Chapters",
        desc: "Add, rename, reorder by dragging, and delete chapters. Star one to keep it in Bookmarks.",
      },
      {
        name: "Read the whole book",
        desc: "The open-book button on the editor rail opens a reading view: every chapter, in order, on one page you can scroll end to end — front matter, body, and back matter, the way the book reads. Click a chapter’s title there to jump back into editing it.",
      },
      {
        name: "Search this book",
        desc: "The Search tab on the editor rail (or ⌘K / Ctrl+K) finds a word anywhere in the book — every chapter’s text, not just titles — with a snippet, and jumps you to the chapter.",
      },
      {
        name: "Restore a deleted chapter",
        desc: "A deleted chapter is kept in the Deleted chapters tab (the trash icon on the editor rail), where you can restore it whole — or delete it for good.",
      },
      {
        name: "Front & back matter",
        desc: "Two buttons bracket the body in the chapters panel. Front matter opens a page templated with a book’s opening sections (half-title, title page, copyright, dedication, epigraph, contents, preface, prologue); Back matter opens one with its closing sections (epilogue, acknowledgements, about the author, about the book, other books). Write under the sections you want, delete the rest. These pages are named, never numbered.",
      },
      {
        name: "Import into a book",
        desc: "Use “Import a file” in the chapters panel to bring a .docx, .epub, .md, .txt, or .html file into the book you have open. If you have already written here, you are asked whether to add the chapters (numbered on from your last one) or replace what you have — and you can undo it right after.",
      },
      {
        name: "Autosave",
        desc: "Everything you type is saved to this browser as you go; the header shows the status.",
      },
      {
        name: "Formatting",
        desc: "Bold, italic, headings, quotes, bullet and numbered lists, scene breaks, links, inline code, and images.",
      },
      {
        name: "Selection toolbar",
        desc: "Highlight text and a small formatting bar appears above it: the marks (bold, italic, underline, strike, code), a link, inline size (A− / A+, ¶, H1–H3), paragraph alignment (left, centre, right, justify), and the block forms — quote (the indented, ruled passage for a letter or epigraph) and bulleted or numbered lists. Each toggles off again. You can also type “> ” for a quote or “- ” / “1. ” to start a list.",
      },
      {
        name: "Images",
        desc: "Insert a picture from the image button on the editor rail. Click it to select, then drag the handles on either side to resize, or use its floating toolbar to sit it left/centre/right, set a quick width (25%, 50%, full, or fit), or delete it. Size and placement are kept in the reader and the export.",
      },
      {
        name: "Text & type",
        desc: "The Aa button on the editor rail sets the book's body typography (font, text size, line spacing, first-line indent, paragraph spacing, page colour) and the alignment of the selected paragraphs — left, centre, right, or justify. Alignment is per paragraph, so different paragraphs can differ; select all to align the whole chapter. New books start on professional novel defaults.",
      },
      { name: "Notes", desc: "Keep private notes beside each chapter." },
      {
        name: "Focus mode",
        desc: "Dim every paragraph but the one you are working on.",
      },
      {
        name: "Typewriter scrolling",
        desc: "Hold the line you are typing at a steady height on screen.",
      },
      {
        name: "Paper",
        desc: "Choose the page colour: white, cream, sepia, slate, or black.",
      },
      {
        name: "Print layout",
        desc: "The editor sets your manuscript on real page sheets, like a word processor — text flows from one page to the next as you type, and a zoom control (bottom-right) scales the pages.",
      },
      {
        name: "Page setup",
        desc: "The ▤ button on the editor rail sets the page the manuscript is printed on: size (6×9 novel by default), orientation, and margins. Body text and font live under the Aa button instead.",
      },
      {
        name: "Word goal",
        desc: "Set a target and watch the progress bar fill as you write.",
      },
      {
        name: "Assistant",
        desc: "An AI writing partner for the chapter you have open. Needs an ANTHROPIC_API_KEY set on the server.",
      },
      {
        name: "Light & dark",
        desc: "Switch the theme from the editor rail or the shelf header.",
      },
    ],
  },
  {
    title: "Exporting",
    items: [
      {
        name: "Formats",
        desc: "Export to Markdown, Word (.docx), or EPUB, or print to PDF.",
      },
      {
        name: "Manuscript layout",
        desc: "Export DOCX in standard manuscript format, ready for submission.",
      },
      {
        name: "Typeset",
        desc: "Choose how your EPUB and PDF are laid out — template, trim size, drop caps.",
      },
      {
        name: "Generated front matter",
        desc: "For EPUB and PDF, switch on a title page, a copyright page, and a contents list — built from your book and placed at the front.",
      },
      {
        name: "Scope",
        desc: "Export a whole book, or just the chapter you are in.",
      },
    ],
  },
  {
    title: "Your data",
    items: [
      {
        name: "Local first",
        desc: "Your books live in this browser. There is no account, and nothing is sent to a server — except the chapter text you hand the Assistant when you ask it something.",
      },
      {
        name: "Back up",
        desc: "Clearing your browser data erases your library, so export anything you want to keep.",
      },
    ],
  },
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[42rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="font-serif text-xl">How OpenChapter works</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted outline-none transition-colors
                       hover:bg-raised hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5"
            >
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="scroll-slim overflow-y-auto px-6 py-5">
          {SECTIONS.map((section) => (
            <section key={section.title} className="mb-6 last:mb-0">
              <h3 className="font-sans text-xs font-semibold tracking-wide text-muted uppercase">
                {section.title}
              </h3>
              <dl className="mt-3 space-y-3">
                {section.items.map((item) => (
                  <div key={item.name}>
                    <dt className="font-sans text-sm font-medium text-fg">
                      {item.name}
                    </dt>
                    <dd className="mt-0.5 font-sans text-sm leading-relaxed text-muted">
                      {item.desc}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <footer className="flex justify-end border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-4 py-2 font-sans text-sm
                       font-semibold text-white outline-none transition-colors
                       hover:bg-accent-strong focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Back to writing
          </button>
        </footer>
      </div>
    </dialog>
  );
}
