"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Book } from "@/lib/library-store";

/**
 * Everything this app can do to one book, on one sheet.
 *
 * The book card used to carry all of it as chips — twenty-one identical grey
 * pills per card, three cards to a row. Two things were wrong with that and
 * neither is fixed by making the pills smaller. Nothing had any weight, so
 * *Write* and *Trash* were the same size and colour; and a pill has room for a
 * name but not for what the thing is, so a writer who did not already know what
 * "Comps" meant had no way to find out except by pressing it.
 *
 * So the card keeps the two verbs a writer came for, and this holds the rest —
 * grouped by the part of the job they belong to, and each one saying what it
 * does. It is longer to read than a row of pills and far quicker to use, which
 * is the trade a launcher should make.
 *
 * **Every entry here is built and working.** Nothing is a preview and nothing
 * needs a Pro plan to open. That is what makes it a launcher rather than a
 * catalogue of things to buy.
 */

const GROUPS: {
  title: string;
  note: string;
  items: [path: string, name: string, what: string][];
}[] = [
  {
    title: "Get it out",
    note: "The parts a shop sees.",
    items: [
      [
        "export",
        "Export and publish",
        "EPUB, DOCX, Markdown and a print PDF — and what a shop would refuse before you upload it.",
      ],
      [
        "roadmap",
        "What to do next",
        "Every step in the order it happens. Most of it ticks itself from what is already in the book.",
      ],
      [
        "paperback",
        "Paperback setup",
        "Trim size, margins and the spine width for the page count you actually have.",
      ],
    ],
  },
  {
    title: "Find your shelf",
    note: "Read from Google Books and Open Library. Nothing you have written is sent.",
    items: [
      [
        "comps",
        "Comp titles",
        "The published books yours sits beside, which every listing form and query letter asks for.",
      ],
      [
        "blurb",
        "Blurb",
        "Counted against the shops’ limits, and shown real blurbs from books like yours.",
      ],
      [
        "categories",
        "Categories",
        "Which shelf you land on, worked out from where comparable books are filed.",
      ],
      [
        "covers",
        "Covers",
        "Yours at thumbnail size beside the shelf it competes on, and a check on the file itself.",
      ],
      [
        "title-check",
        "Title check",
        "Whether somebody else’s book turns up first when a reader searches for yours.",
      ],
    ],
  },
  {
    title: "The writing",
    note: "About the manuscript rather than the listing.",
    items: [
      [
        "structure",
        "Structure",
        "The shape most novels share, with your word count placed on it. A convention, not a rule.",
      ],
      [
        "prose",
        "Prose report",
        "What is in a chapter, counted. No score, and it never changes a word.",
      ],
      [
        "progress",
        "Progress",
        "Whether the writing is moving, and roughly when it finishes at this pace.",
      ],
      [
        "provenance",
        "Writing record",
        "The trail the work left, in a document you can send if you are ever accused.",
      ],
    ],
  },
  {
    title: "Money and reviews",
    note: "What happens once it is out.",
    items: [
      [
        "money",
        "Before you spend",
        "What covers, editing and promotion cost, and what to establish before the money moves.",
      ],
      [
        "track",
        "Track",
        "What this book cost against what it earned, and how many copies get you level.",
      ],
      [
        "arc",
        "Advance copies",
        "Who holds one, who reviewed, and who is late. One list instead of six sites.",
      ],
    ],
  },
];

export function BookToolsDialog({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // `showModal` rather than an `open` attribute: it brings Escape, the focus
  // trap and the inert backdrop with it, none of which are worth rebuilding.
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
      className="m-auto w-[44rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line
                 bg-panel p-0 text-fg backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{book.title}</h2>
          <p className="mt-0.5 text-sm text-muted">
            Everything this app can do to this book. All of it works today.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 shrink-0 rounded-lg px-2.5 py-1.5 text-xl leading-none
                     text-muted hover:bg-raised"
        >
          ×
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
        {GROUPS.map((group) => (
          <section key={group.title} className="mb-6 last:mb-0">
            <h3 className="text-xs font-bold tracking-widest text-muted uppercase">
              {group.title}
            </h3>
            <p className="mt-1 text-xs text-muted">{group.note}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.items.map(([path, name, what]) => (
                <Link
                  key={path}
                  href={`/book/${book.id}/${path}`}
                  onClick={onClose}
                  className="rounded-xl border border-line bg-surface p-3
                             transition-colors hover:border-accent/40"
                >
                  <span className="block text-sm font-bold text-fg">
                    {name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {what}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </dialog>
  );
}
