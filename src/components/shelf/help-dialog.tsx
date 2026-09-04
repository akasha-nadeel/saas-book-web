"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { CREDIT_COST } from "@/lib/billing/credits";
import { TIER_LIMITS, TIER_NAMES } from "@/lib/billing/tiers";
import { ALL_CHECKS } from "@/lib/consistency";
import { FREE_LIMITS } from "@/lib/free-limits";
import { MAX_SNAPSHOTS } from "@/lib/history";
import { IMPORT_FORMATS } from "@/lib/import";

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
        name: "The shelf",
        desc: "Every book you are writing, on one screen. A book you are not working on can be archived, and a book you delete goes to the trash rather than away — nothing is destroyed by a single press.",
      },
      {
        name: "Starting a book",
        desc: "New book asks for a title and gives you a first chapter. You can also paste text straight in, or bring one you have already written.",
      },
      {
        name: "Importing what you have written",
        desc: `${IMPORT_FORMATS.map((f) => f.label).join(", ")} — the file is read in this browser, split into chapters where it says chapters are, and put on your shelf. Word documents keep their italics and their scene breaks.`,
      },
      {
        name: "Finding things",
        desc: "Search reads every book and every chapter at once, by title and by what is written inside them.",
      },
    ],
  },
  {
    title: "Writing",
    items: [
      {
        name: "The editor",
        desc: "One chapter at a time on a page the size of the book you are making. The rail on the left holds the chapter list, search, notes, the consistency check, the assistant, and your versions.",
      },
      {
        name: "Autosave",
        desc: "Everything is saved as you type, to this browser first and then to your account. There is no save button and nothing to lose by closing the tab.",
      },
      {
        name: "Versions",
        desc: `The last ${MAX_SNAPSHOTS} saved states of each chapter, kept automatically. Open one to read it, and restore it if the version you have now is worse.`,
      },
      {
        name: "Notes",
        desc: "A note lives beside the chapter it is about, not in a separate file you forget to open.",
      },
      {
        name: "The consistency check",
        desc: `Reads the whole book at once for the ${ALL_CHECKS.length} things a writer cannot catch by re-reading their own draft: a name spelled two ways, British and American spellings side by side, a word written two ways, straight quotation marks among curly ones, a quotation mark left open, a word typed twice, a compound that gains and loses its hyphen, a number written as a word in one place and in digits in another, a term capitalised only sometimes, scene breaks marked more than one way, and a word used once that is one letter from a word you use often — a mistyped invented name, which no spelling checker can catch because it has never heard of the word either. Tick the ones you want and run those.`,
      },
      {
        name: "Dictation",
        desc: "The microphone uses your browser's own speech recognition, so nothing is uploaded by us. It works in Chrome and Edge.",
      },
    ],
  },
  {
    title: "The writing assistant",
    items: [
      {
        name: "What it does",
        desc: `It reads the chapter you are in and answers questions about it — what is not working in a scene, whether a passage is doing what you meant. On every paid plan, and on a free account holding credits.`,
      },
      {
        name: "Quick, Careful and Deep",
        desc: `Three models, one balance. Quick answers straight away and costs ${CREDIT_COST.quick} credits; Careful thinks first, for ${CREDIT_COST.careful}; Deep takes the longest and costs ${CREDIT_COST.deep}. ${TIER_NAMES.draft} includes ${TIER_LIMITS.draft.creditsPerMonth.toLocaleString("en-US")} credits a month, ${TIER_NAMES.writer} ${TIER_LIMITS.writer.creditsPerMonth.toLocaleString("en-US")} and ${TIER_NAMES.studio} ${TIER_LIMITS.studio.creditsPerMonth.toLocaleString("en-US")}. Spend them however you like. Unused credits do not carry over into the next month. Usage in the account menu shows what is left.`,
      },
      {
        name: "Letting it write into the chapter",
        desc: "Off by default. With it on, prose the assistant offers grows Replace and Insert: Replace swaps the passage you selected and shows the change word by word before it is made, Insert puts a paragraph in below the cursor. Nothing moves without a press, one undo takes any of it back, and the chapter as it stood is kept in Versions first.",
      },
    ],
  },
  {
    title: "Getting the book out",
    items: [
      {
        name: "Export",
        desc: `Word, EPUB and PDF, free on every plan — ${TIER_NAMES.free} included. The EPUB is checked against the same validator the shops use. There is no plan on which your finished file is held back.`,
      },
      {
        name: "The title check",
        desc: "Searches millions of published books for the title you are considering, and shows what a reader would find instead of yours. Titles cannot be copyrighted, so this reports rather than advises.",
      },
    ],
  },
  {
    title: "The plans",
    items: [
      {
        name: TIER_NAMES.free,
        desc: `Free, no card. ${TIER_LIMITS.free.books} books, unlimited chapters and words, importing, syncing, every export format, and ${FREE_LIMITS.titleCheck.free} title checks a day. No writing assistant.`,
      },
      {
        name: TIER_NAMES.draft,
        desc: `Everything on Free, with unlimited books, unlimited title checks, and the writing assistant on ${TIER_LIMITS.draft.creditsPerMonth.toLocaleString("en-US")} credits a month.`,
      },
      {
        name: TIER_NAMES.writer,
        desc: `Everything in ${TIER_NAMES.draft}, with ${TIER_LIMITS.writer.creditsPerMonth.toLocaleString("en-US")} credits a month.`,
      },
      {
        name: TIER_NAMES.studio,
        desc: `Everything in ${TIER_NAMES.writer}, with ${TIER_LIMITS.studio.creditsPerMonth.toLocaleString("en-US")} — for a writer leaning on the assistant daily.`,
      },
      {
        name: "Cancelling",
        desc: "From the billing page, at any time. The plan runs to the end of the period you have paid for, and nothing is deleted when it lapses — your books are yours on every plan.",
      },
    ],
  },
  {
    title: "Your data",
    items: [
      {
        name: "Where the book lives",
        desc: "In this browser first. With an account it also syncs, so the same shelf opens on your other machines — but the copy you are typing into is the local one, which is why the editor works with the network off.",
      },
      {
        name: "What leaves this machine",
        desc: "The writing assistant sends the open chapter with your question. PDF export sends the book to our server to be laid out; Word and EPUB are built here. The title check sends only the words you typed. The privacy page names every one of these.",
      },
      {
        name: "Taking it with you",
        desc: "Export at any time, on any plan, with no wait and no watermark. A tool that holds your finished file back is the thing this trade's writers have been burned by, and this one does not.",
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
      className="m-auto w-[42rem] max-w-[calc(100vw-2rem)] rounded-lg bg-tremor-background
                 p-0 text-tremor-content-strong backdrop:bg-black/70"
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-tremor-border px-6 py-4">
          <h2 className="font-serif text-xl">How OpenChapter works</h2>
          <DialogClose onClose={onClose} corner={false} />
        </header>

        <div className="scroll-slim overflow-y-auto px-6 py-5">
          {SECTIONS.map((section) => (
            <section key={section.title} className="mb-6 last:mb-0">
              <h3 className="font-sans text-xs font-semibold tracking-wide text-tremor-content uppercase">
                {section.title}
              </h3>
              <dl className="mt-3 space-y-3">
                {section.items.map((item) => (
                  <div key={item.name}>
                    <dt className="font-sans text-sm font-medium text-tremor-content-strong">
                      {item.name}
                    </dt>
                    <dd className="mt-0.5 font-sans text-sm leading-relaxed text-tremor-content">
                      {item.desc}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <footer className="flex justify-end border-t border-tremor-border px-6 py-4">
          <Button onClick={onClose}>
            Back to writing
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
