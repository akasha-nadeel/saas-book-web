"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { TIER_LIMITS, TIER_NAMES } from "@/lib/billing/tiers";
import { ALL_CHECKS, FREE_CHECKS, PRO_CHECKS } from "@/lib/consistency-ids";
import { CHECK_LOOK } from "@/lib/consistency-checks";
import { FREE_LIMITS, FREE_RECORD_DAYS } from "@/lib/free-limits";
import { MAX_SNAPSHOTS } from "@/lib/history";
import { IMPORT_FORMATS } from "@/lib/import";
import { TINTS } from "@/lib/library-store";
import { plural } from "@/lib/plural";

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
        desc: "One chapter at a time on a page the size of the book you are making. One bar across the top: home, a File menu, undo and redo, the word count, whether it has saved, and Import and Export at the right. One rail down the left opens the chapter list, search, the consistency check, notes, versions and the trash, one at a time.",
      },
      {
        name: "Colour themes",
        desc: `${TINTS.map((t) => t.name).join(", ")} — beside plain light, plain dark, and whichever your computer is set to. A theme colours the whole editor: the bar, the rail, the panels and the page you type on. Under Paper and theme in Page and type.`,
      },
      {
        name: "Page and type",
        desc: "The Tools button on the rail opens a card rather than a panel: font, size, line spacing, paragraph style, first-line indent and the space between paragraphs. The paper has its own setting there — white, cream, sepia, slate, black, or whatever the theme says — so you can keep a dark theme with a light page. Typewriter scrolling holds the line you are typing at a fixed height, and paragraph marks show where your paragraphs actually end, so empty ones stop looking like room on the page.",
      },
      {
        name: "Focus mode",
        desc: "The button at the right of the top bar puts the chrome away — bar, rail and panel — leaving the page, the toolbar you get when you select text, and one button to come back. It closes nothing, so leaving focus mode gives you back exactly what was open.",
      },
      {
        name: "Links",
        desc: "Select some words and press the link button, in the toolbar that appears over the selection or in the Tools card. A full address works and so does a bare domain — openchapter.app becomes a link on its own. Links are blue and underlined, and they survive the export.",
      },
      {
        name: "The word count",
        desc: "In the top bar beside the save state, or faint under the last line you have written, where you can watch it without looking away from the sentence. One button in the bar moves it, and it stays where you put it.",
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
        name: "Ideas",
        desc: `Somewhere to park an idea for a different book: type it and press Enter. Start a book from one when it turns out to be real. In the dashboard's side panel. Kept in this browser, and not synced. ${TIER_NAMES.free} parks ${FREE_LIMITS.ideas.free} at a time — forget one or start a book from it to make room — and ${TIER_NAMES.pro} has no limit.`,
      },
      {
        name: "The consistency check",
        desc: `Reads the whole book at once for the ${ALL_CHECKS.length} things a writer cannot catch by re-reading their own draft: a name spelled two ways, British and American spellings side by side, a word written two ways, straight quotation marks among curly ones, a quotation mark left open, a word typed twice, a compound that gains and loses its hyphen, a number written as a word in one place and in digits in another, a term capitalised only sometimes, scene breaks marked more than one way, and a word used once that is one letter from a word you use often — a mistyped invented name, which no spelling checker can catch because it has never heard of the word either. Tick the ones you want and run those. ${TIER_NAMES.free} runs ${FREE_CHECKS.length} of them — ${FREE_CHECKS.map((id) => CHECK_LOOK[id].name.toLowerCase()).join(", ")} — and says how many things the other ${PRO_CHECKS.length} found.`,
      },
      {
        name: "Dictation",
        desc: "The microphone uses your browser's own speech recognition, so nothing is uploaded by us. It works in Chrome and Edge, and Chrome sends the audio to Google to turn it into text — the privacy page says so.",
      },
    ],
  },
  {
    title: "No AI",
    items: [
      {
        name: "Nothing writes for you",
        desc: "OpenChapter has no AI. There is no assistant, nothing is generated, and no part of your book is sent to a language model. Every word in it is yours.",
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
      {
        name: "The writing record",
        desc: `A dated record of the days you wrote and the drafts that were saved, gathered into a plain-text document you can send if anyone says you used AI. It is evidence, not proof, and the document says so. On the Export screen. ${TIER_NAMES.free} covers the last ${FREE_RECORD_DAYS} days; ${TIER_NAMES.pro} covers the twelve months the app keeps and adds a fingerprint of the text. Every day is kept either way, in this browser.`,
      },
      {
        name: "Paperback setup",
        desc: `Spine width, inside margin and the full cover size for your page count and trim, from Amazon KDP's published figures. In the dashboard's side panel, and part of ${TIER_NAMES.pro}. Check the numbers against the template KDP makes for you; the PDF this app exports has no bleed or crop marks.`,
      },
    ],
  },
  {
    title: "The plans",
    items: [
      {
        name: TIER_NAMES.free,
        desc: `Free, no card. ${plural(TIER_LIMITS.free.books ?? 0, "book")}, unlimited chapters and words, importing, syncing, every export format, ${plural(FREE_LIMITS.titleCheck.free, "title check")} a day, ${plural(FREE_LIMITS.ideas.free, "parked idea")} at a time, ${FREE_CHECKS.length} consistency checks and the last ${FREE_RECORD_DAYS} days of the writing record.`,
      },
      {
        name: TIER_NAMES.pro,
        desc: `Everything on Free, with unlimited books, title checks and parked ideas, all ${ALL_CHECKS.length} consistency checks, twelve months of the writing record with its fingerprint, and paperback setup.`,
      },
      {
        name: "Not on sale yet",
        desc: `${TIER_NAMES.pro} cannot be bought at the moment. Pressing it tells us you wanted it, so we know to open it — and everything free stays free meanwhile.`,
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
        desc: "PDF export sends the book to our server to be laid out; Word and EPUB are built here. The title check sends only the words you typed, and voice typing in Chrome sends your voice to Google. The privacy page names every one of these.",
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
