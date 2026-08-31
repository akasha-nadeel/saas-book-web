"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";

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
        desc: "Bring in a .docx, .epub, .md, .txt, or .html file — it is split into chapters for you. Importing is unlimited on either plan.",
      },
      {
        name: "How a file is split into chapters",
        desc: "Your file is cut up by what is actually in it, and it is tried in this order. First, headings: if you used Heading 1 in Word or # in Markdown, you have already said where the chapters are, and that is believed. Failing that, a short line on its own that reads like a chapter opener — “Chapter Four”, “Prologue”, “Part Two” — and, when you are importing into one of the three cards, that part’s own page names as well, so a back-matter file with no heading styles still breaks at “Afterword” and “Glossary”. Failing both, the whole file arrives as one chapter, because cutting a manuscript at guessed-at points is worse than leaving it whole. That last case is the common surprise. If your chapter titles run straight into the first sentence — “Chapter 1: The Initialization Julian stared at his monitors…” — then nothing in the file marks where one chapter ends and the next begins, so nothing is cut, however many chapters you meant it to have. Put each title on a line of its own with a paragraph break after it, or better still style those lines Heading 1, and import again. You are told how many chapters were found before anything is added, so you can cancel and fix the file first.",
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
        desc: "Add your own cover art, or edit the title, subtitle, and author printed on a typeset cover. Your artwork is kept at full size for your exports — upload it at 1600×2560 and that is exactly what goes into your EPUB — while a small copy is what the shelf draws. The full-size copy stays on this machine and is not synced, so if you sign in on another computer, upload the artwork again there before exporting.",
      },
    ],
  },
  {
    title: "Writing",
    items: [
      {
        name: "Book overview",
        desc: "Opening a book lands on its overview — the book panel on the left and a short guide to how the book is put together — rather than a chapter. Pick a chapter to write, or use “Continue writing” on the shelf to jump straight back to where you left off.",
      },
      {
        name: "Chapters",
        desc: "Add, rename, reorder by dragging, and delete chapters. Star one to keep it in Bookmarks.",
      },
      {
        name: "Search this book",
        desc: "The Search tab on the editor rail (or ⌘K / Ctrl+K) finds a word anywhere in the book — every chapter’s text, not just titles — with a snippet, and jumps you to the chapter.",
      },
      {
        name: "Importing one section on its own",
        desc: "A finished book is often three files rather than one, so each of the three cards — Front matter, Body matter, Back matter — has its own import button in its header, beside Hide pages. It brings a file into that part alone. Only the pieces of the file that belong there are used: import into Back matter and an epilogue, an afterword and a glossary go in, while anything the file holds that is not back matter is left out and named on screen rather than dropped in silence. If the section already has pages you are asked what to do with them — keep them and add what is new, or replace them with the file’s — and Replace touches that part and nothing else, so your chapters and the other end of the book are safe. Either way you can undo it straight after. An empty section is not worth a question and simply takes the file in. The rail’s own “Import a file” button is still there for a whole book in one file.",
      },
      {
        name: "Importing the same pages twice",
        desc: "Front and back matter are a set of named pages rather than a sequence — a book has one dedication, not two — so a page arriving in an import that your book already has is left out rather than added beside it. Pages are matched by which division they are, not by how they are spelled, so a file calling it PREFACE does not add a second copy of your “Preface or introduction”. Chapters are the opposite: a book may genuinely have two chapters of the same name, so nothing is ever dropped from the body. If every page in a file turns out to be one you already have, you are told that and nothing is changed.",
      },
      {
        name: "Restore a deleted chapter",
        desc: "A deleted chapter is kept in the Deleted chapters tab (the trash icon on the editor rail), where you can restore it whole — or delete it for good.",
      },
      {
        name: "Front & back matter",
        desc: "The book panel holds a card for each of a book’s three parts, in the order they are bound, each in its own colour — and the page you write on takes the colour of the part it belongs to. All three open into a list. Where Body matter lists the chapters you wrote, Front matter and Back matter list every section a book can have, with a switch on each: half-title, title page, copyright, dedication, epigraph, contents, preface and prologue at the front; epilogue, afterword, acknowledgements, about the author, also by the author, a word about reviews, an excerpt from the next book and glossary at the back. So the card answers the question it is there for — what this book has, and what it does not. Switch one on and the page is made for you, in the place it belongs in the running order rather than at the end. Switch it off and it goes to the book’s trash, where you can get it back. Click a row to write on that page, ⋯ to rename it or move it to another part, and “Add your own page” at the foot of the list for a page that is on no list. These pages are named, never numbered.",
      },
      {
        name: "Choosing your pages",
        desc: "The first time you open a book you are asked which of those pages it needs, with a line explaining each one — tick them and they appear in the two cards. Skip for now if you would rather not decide yet: you are only asked once per book, and nothing is lost by skipping, because every section is a switch in the two cards whenever you want it.",
      },
      {
        name: "Which of those pages you actually need",
        desc: "None of them. No shop requires a dedication, an epigraph or an acknowledgements page — what they want is a cover, a title page, working navigation, honest details and a book you own. Your export already builds a title page, a copyright page and a contents list, so you only need those pages if you would rather write your own. Add the ones your book really has and leave the rest: an empty epigraph or an invented “also by the author” list makes a book look less finished, not more.",
      },
      {
        name: "Why a page says Draft",
        desc: "Each front- and back-matter page arrives with the shape of the real thing and your own details left in [square brackets] — “For [name].” for a dedication. While any brackets are left on a page, or the page is blank, it is marked Draft and is left out of your exports, so a half-filled template can never end up inside your finished book. Fill it in and it joins the book — and note that any bracket left anywhere on the page keeps it out, so filling in some of a page is not enough. Switch off the pages you do not want. A page still holding its example text switches off without a question, because there is nothing on it you wrote; one you have actually written on asks first. The export screen names every page it is leaving out before you press the button.",
      },
      {
        name: "Import into a book",
        desc: "Use the upload button at the top of the book panel to bring a .docx, .epub, .md, .txt, or .html file into the book you have open. If you have already written here and the file brings chapters with it, you are asked whether to add them (numbered on from your last one) or replace the chapters you have — and you can undo either right after. Replace only ever touches chapters: your front and back matter pages are kept, because a manuscript file is the story and not your dedication. A file carrying only front or back matter is not worth a question, so it simply comes in. Chapters are found the same way as on the shelf — see “How a file is split into chapters”, which is also where to look if a file you expected to arrive in ten pieces arrives in one. Importing is unlimited on either plan.",
      },
      {
        name: "Autosave",
        desc: "Everything you type is saved to this browser as you go; the header shows the status.",
      },
      {
        name: "Clicking the page",
        desc: "Clicking a bare part of a sheet puts the cursor at the nearest place text can go: under the last line takes you to the end of it, beside a line takes you into that line. A chapter is a sequence of paragraphs that flow, so text is never dropped at a loose spot on the page.",
      },
      {
        name: "Click and type (front & back matter only)",
        desc: "On a front- or back-matter page — a title page, dedication or epigraph, which are designed on the page rather than written in a flow — double-clicking a blank area puts the cursor there, adding the blank lines it takes to reach that spot and centring or right-aligning text started in the middle or right of the column. Body chapters deliberately do not do this: lines placed by eye slide out of position the moment the margins or type size change.",
      },
      {
        name: "Formatting",
        desc: "Bold, italic, headings, quotes, bullet and numbered lists, scene breaks, links, inline code, and images.",
      },
      {
        name: "Text beside a picture",
        desc: "Select an image and use the wrap button on its toolbar to let the prose run alongside it instead of starting again underneath — Word calls this square wrapping. The picture takes the left or right of the column and the words fill the rest. Drag its edge to resize, and the text reflows around it. Choosing centre alignment turns wrapping off, since a centred picture leaves no side for the words.",
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
        name: "Where a paragraph begins",
        desc: "“Paragraphs” under the Aa button decides how one paragraph is told from the next: Spaced, as a word processor sets it — flush openings with a space between — or Indented, as a printed novel is set, with the first line stepped in and no space. It is one or the other, never both, so the setting sets the indent and the spacing together. New books start on Spaced.",
      },
      {
        name: "Text & type",
        desc: "The Aa button on the editor rail sets the book's body typography (font, text size, line spacing, first-line indent, paragraph spacing, page colour) and the alignment of the selected paragraphs — left, centre, right, or justify. Alignment is per paragraph, so different paragraphs can differ; select all to align the whole chapter. New books start on professional novel defaults.",
      },
      { name: "Notes", desc: "Keep private notes beside each chapter." },
      {
        name: "Versions",
        desc: "A version of the open chapter is kept about every ten minutes you are editing, and the last eight are kept — so a bad afternoon is not permanent. The panel also counts how many sittings the chapter has had. It is a safety net rather than an archive: it can give you this chapter as it was before lunch, not as it was last March.",
      },
      {
        name: "Story bible",
        desc: "People, places and things, kept beside the manuscript — with the aliases each answers to, so a character who is Elizabeth to the narrator and Lizzie to her brother is one person. The panel opens with who is in the chapter you have open, which is a search over what you have written rather than something you have to keep current. Give two books the same series name in their listing details and the panel reads across the whole series: the lookup finds the people you wrote down two books ago, each entry says which book introduced them, and every book's own description sits under it rather than being merged into one. Adding always writes to the book you are in. Series are read from the books on this machine, and bibles do not sync.",
      },
      {
        name: "Ideas",
        desc: "Park the idea that is not this book, without leaving the chapter you are in. Ideas are not books — they sit here costing nothing until you decide one is real, and Start a book turns it into one.",
      },
      {
        name: "Focus mode",
        desc: "Dim every paragraph but the one you are working on.",
      },
      {
        name: "Typewriter scrolling",
        desc: "Hold the line you are typing at a steady height on screen.",
      },
      {
        name: "Paragraph marks",
        desc: "The ¶ button on the editor rail marks the end of every paragraph, as Word's does. Blank space on a page is either room the page still has or empty paragraphs left behind — they look identical and behave completely differently, and this is how you tell. An empty paragraph shows as a mark on its own. Switching it on never changes where a line wraps or a page breaks.",
      },
      {
        name: "Paper",
        desc: "Choose the page colour under your prose — white, off-white, grey, charcoal or black — from the Aa flyout in the editor. Until you pick one it follows the theme, so a light app gets a white page and a dark one a black page.",
      },
      {
        name: "Theme",
        desc: "Light, dark, or whatever your computer is set to. The control is at the foot of the sidebar on this screen, and in the editor's Aa flyout beside the page colour. On “match my system” the app turns with your machine, so it goes dark when your laptop does.",
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
        desc: "An AI writing partner for the chapter you have open. Needs either an ANTHROPIC_API_KEY or a GOOGLE_GENERATIVE_AI_API_KEY set on the server.",
      },
    ],
  },
  {
    title: "The publishing tools",
    items: [
      {
        name: "Consistency check",
        desc: "Reads every chapter of a book at once and reports what it spells more than one way — a name spelled two ways, British and American spellings side by side, straight quotation marks among curly ones, a word typed twice. It reports and never changes a word, and anything you say is not a mistake stays put away.",
      },
      {
        name: "Formats",
        desc: "Export to Word (.docx) or EPUB, or print to PDF. Markdown is marked Soon on the format step: the text half works, but a book with pictures in it would carry them as code rather than as pictures, so it comes back as a text file with an images folder beside it.",
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
        name: "The cover in your file",
        desc: "Your artwork goes in as the first page of the file — EPUB, PDF and Word alike — and the Front matter step has a Cover page switch to turn that off. There is one reason to: the PDF is a print interior, set at your trim size with no bleed or crop marks, and a print shop wants the cover as its own separate file rather than bound into the pages. The cover page is your picture exactly as you uploaded it, with no title or author printed over it — that is what shops expect of finished artwork, and it is what your title page is for, which is the very next sheet. The shelf still draws the title over your cover, but that is the shelf showing you which book is which rather than anything that goes in the file.",
      },
      {
        name: "Generated front matter",
        desc: "For EPUB and PDF, a title page, a copyright page and a contents list are built from your book and placed at the front — all three on unless you switch them off. The copyright page needs an author’s name and is left out when the book has none, rather than naming the wrong rights holder.",
      },
      {
        name: "Preview, on any step of the export",
        desc: "A Preview button sits beside Back on every step of the export screen, and it opens the book over the whole window as the file will actually have it — not a picture of one. How far each one can be trusted differs, and each says so on the page. The PDF is the finished file itself, so the page count and the page numbers beside the contents entries are the ones you will get; Markdown is the text character for character. EPUB is the real file opened up, so the pages, their order and the stylesheet are exact — but trust it for structure rather than for looks, because e-readers substitute their own font, spacing and margins, and each picks its own page, which is also why there is no page count there. Word is the real .docx opened by a viewer rather than by Word, so the content is exact and the layout is close. If you have written your own title, copyright or contents page, the preview says so: yours is used and ours stands down for it.",
      },
      {
        name: "Store listing",
        desc: "Choosing EPUB adds the details a shop asks for — ISBN, language, publisher, categories, blurb, series. They are saved to the book, so you fill them in once.",
      },
      {
        name: "Ready for the shops",
        desc: "The EPUB panel tells you what would stop a shop taking the file — a missing cover or author, an ISBN whose check digit is wrong, images that cannot be packaged — before you upload rather than after.",
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
        desc: "Your books live in this browser. Nothing is sent to a server — except the chapter text you hand the Assistant when you ask it something.",
      },
      {
        name: "Your account",
        desc: "Signing in syncs your books to your account, so opening OpenChapter on another machine brings your library with it. They are still written to this browser first, which is why the app keeps working with no connection.",
      },
      {
        name: "Plans",
        desc: "Writing a book and getting it out are free, whole: unlimited books, every export format, syncing to every device, the pre-upload check and the roadmap, comps, blurb, categories, covers, structure and progress. Each tool is limited in the unit its own work comes in, and nothing else is limited at all. The three that ask a catalogue something are counted per day and start again the next morning: two comparable-title searches, two title checks, three cover searches. The ones that work on one manuscript are counted in books: the blurb on 5, the prose report on 6, money tracking on 2 — and a book already counted never costs again however much you redraft there. Advance copies hold 10 readers on each book. Two allowances are counted for the life of the account rather than per day or per book, because every press asks a model rather than a free catalogue: five sets of keyword suggestions, and three blurb conversations. Neither comes back. A blurb conversation is one chat however many messages you send in it, and it is counted when you send the first — so opening the panel and reading it costs nothing. Seats work differently again: a book holds 2 people including you on the free plan and 10 on Pro, and that is a number at a time rather than a number spent — take somebody off and the place comes back. Everything else is unlimited on both plans, including the writing record, the story bible across a whole series, and typing in the keyword boxes yourself. Pro lifts every one of those numbers and adds the parts that spend a model's time or an audio bill per use (the assistant, ranked comps, and importing an audiobook as text), plus reading a shop's sales export into the ledger and the book-over-book curve. Monthly or yearly. See Pricing in the header.",
      },
      {
        name: "Paying",
        desc: "Card details are entered on PayHere and never reach OpenChapter. Pro starts the moment PayHere confirms, usually a few seconds after you pay, and renews on the same date each cycle until you cancel.",
      },
      {
        name: "Cancelling",
        desc: "In your account, from the chip in the shelf header. You keep Pro until the period you have already paid for runs out, and nothing is deleted — your books are yours on either plan, and so is everything the paid screens hold. A ledger, an advance-copy list or a series bible written on Pro stays on your machine if the plan lapses, and is there again the moment you come back.",
      },
      {
        name: "Forgotten password",
        desc: "The sign-in screen can email you a link that signs you in and lets you set a new one. Open it in the same browser you asked from — the link is tied to it, and works once.",
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
