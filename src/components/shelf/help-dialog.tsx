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
        desc: "Bring in a .docx, .epub, .md, .txt, or .html file — it is split into chapters for you. The free plan brings in ten files; the screen says how many of them you have used, and Pro has no limit.",
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
        desc: "The book panel holds a card for each of a book’s three parts, in the order they are bound, each in its own colour — and the page you write on takes the colour of the part it belongs to. All three open into a list. Press Start on Front matter and you get a page for each of a book’s opening sections — half-title, title page, copyright, dedication, epigraph, contents, preface, prologue — and on Back matter one for each of its closing ones: epilogue, afterword, acknowledgements, about the author, also by the author, a word about reviews, an excerpt from the next book, glossary. Click a page to write on it, Add page for one more, ⋯ to rename or delete. These pages are named, never numbered.",
      },
      {
        name: "Choosing your pages",
        desc: "The first time you open a book you are asked which of those pages it needs, with a line explaining each one — tick them and they appear in the two cards. Skip for now if you would rather not decide yet; you are only asked once per book, and Start on either card still makes the whole set whenever you want it.",
      },
      {
        name: "Which of those pages you actually need",
        desc: "None of them. No shop requires a dedication, an epigraph or an acknowledgements page — what they want is a cover, a title page, working navigation, honest details and a book you own. Your export already builds a title page, a copyright page and a contents list, so you only need those pages if you would rather write your own. Add the ones your book really has and leave the rest: an empty epigraph or an invented “also by the author” list makes a book look less finished, not more.",
      },
      {
        name: "Why a page says Draft",
        desc: "Each front- and back-matter page arrives with the shape of the real thing and your own details left in [square brackets] — “For [name].” for a dedication. While any brackets are left on a page, or the page is blank, it is marked Draft and is left out of your exports, so a half-filled template can never end up inside your finished book. Fill it in and it joins the book; delete the pages you do not want. The export screen names every page it is leaving out before you press the button.",
      },
      {
        name: "Import into a book",
        desc: "Use the upload button at the top of the book panel to bring a .docx, .epub, .md, .txt, or .html file into the book you have open. If you have already written here, you are asked whether to add the chapters (numbered on from your last one) or replace what you have — and you can undo it right after. This counts against the free plan's ten imports like any other file, and undoing gives it back.",
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
        name: "Cover checker",
        desc: "Under the cover wall: drop in the artwork you are about to upload and it says whether a shop will refuse it — dimensions, shape, file weight, and whether the image is very flat. Checks the file you drop in, which is also the one your exports use. Measured in your browser and never uploaded, and never counted against anything — it is the wall above it, where you search for the covers your book has to sit beside, that spends one of the free plan's ten. Whether the cover is any good is the wall's job, not a number's.",
      },
      {
        name: "Blurb",
        desc: "The two hundred words that decide whether anybody opens the book. It writes nothing — writers in this research describe an AI-written blurb as the thing that hurt their sales — so instead it counts what you have written against the shops’ limits and tells you where it is unusual: the length, whether it opens with the title the shop has already printed above it, whether it is one wall of text on a phone, the longest sentence, and a shouted word. Only two things on the screen are rules: an empty blurb, and one over 4,000 characters, which shops refuse. Everything else is a measurement. The five example blurbs from published books were removed on 2026-08-04 — the catalogue returned classics rather than recent comparable titles, and the median length it computed was drawn from one-line catalogue summaries rather than real blurbs, so the screen was telling writers a normal blurb was too long.",
      },
      {
        name: "Listing details",
        desc: "The handful of facts every shop asks for before it will list a book: an ISBN with its check digit verified, the language, the publisher, the publication date and the series. Answered once and stored on the book, so they travel into every export rather than being asked again each time. Until 2026-08-05 these lived only inside the export flow's fourth step, reachable by starting an export and choosing EPUB; they have their own tool now, and the dashboard's findings link straight to it.",
      },
      {
        name: "Categories & keywords",
        desc: "Where you keep the categories a shop's form asks you for, and the seven keyword boxes beside them. The keyword half counts what you have typed and says what it is costing you — boxes over the 50-character limit, words your title already owns so the shop indexes them anyway, the same word spent in two boxes, and phrases shops reject like “bestseller” or “new”. There is no search volume and no ranking anywhere: Amazon publishes none, its data API closed in 2026, and the tools that quote a figure buy scraped data. The subject search — which read where comparable books are actually filed, and the Pro step that matched those subjects to a shop’s own category paths — was removed on 2026-08-04 to get a release out, and is meant to return.",
      },
      {
        name: "Comp titles",
        desc: "The published books yours sits beside — what every listing form and query letter asks for, and what most writers guess at. A search built from your genre and blurb goes to Google Books and Open Library, and what comes back is what those catalogues hold for those words, in their order. Then Rank these asks a model which of them are genuinely like your book: at most five, best first, each with a reason in a sentence. There is no score and no percentage — it is a judgement worth disagreeing with, not a measurement. Ranking is the one part of the screen that sends anything you have written (your blurb and the opening of your first chapter), it only goes when you press the button, and the card lists exactly what leaves before you do. The search itself sends only the words in the box and works with no account and no key. On the free plan you get ten searches of your own; the shelf this screen opens on is not one of them, and neither is looking at what is already there. The screen tells you when three are left.",
      },
      {
        name: "Track",
        desc: "What a book cost against what it earned. Add what you spent on covers, editing and ads, then import a sales report as CSV — you say which column is which, so it works whatever the shop calls things. It tells you how many more copies get you level, using the per-copy figure your own rows show rather than a royalty rate we made up. Amazon has no public API, so nothing is fetched and nothing is sent.",
      },
      {
        name: "Book over book",
        desc: "On the Track area of your dashboard, once there is money recorded: what each book earned in the same stretch of its own life — the first so many months on sale — so that a book out for three years is not compared against one out for three months. It answers the thing writers repeat to each other, that there is no traction until a third book, with your own figures rather than a forecast. It refuses more often than it answers, and says why: a book with no publication date has no day one to count from, a book out for less than a month would only be telling you it is new, and a book with no sales rows is a gap in the record rather than a zero. Every book left off is named.",
      },
      {
        name: "Writing record",
        desc: "For when somebody accuses you of not having written your own book. It gathers what the app has been keeping anyway — which days you wrote on, how the count moved, and every draft saved along the way — into a plain-text document you can send, with a SHA-256 fingerprint of the manuscript. The limits are in the document as well as on the screen: it is evidence rather than proof, it is not tamper-evident, it starts when you started here, and an imported manuscript lands as one large day. The fingerprint is only worth something once you timestamp it somewhere we do not control, so the page tells you to do that and never offers to keep it.",
      },
      {
        name: "Advance copies",
        desc: "Who holds an advance copy, who read it, who is late — one list instead of six sites and a spreadsheet. Record where you found each reader and what they actually read, since the review everybody remembers comes from someone who does not read your genre. Late readers sort to the top, and if the book has a publication date the page works back to when copies need to go out. It finds nobody for you and sends nothing.",
      },
      {
        name: "Before you spend",
        desc: "What a book usually earns, what covers, editing, promotion and courses cost, and what to establish before the money moves — plus how many copies a given spend has to sell to get back to nothing. Every figure says where it came from and how much weight it can carry. No company is named: the checks describe the shape of the thing, which is more use, because next year it will have a different name.",
      },
      {
        name: "Progress",
        desc: "Whether the writing is moving: days written in the last month, words on a day you write, and — if the book has a target — roughly when it finishes at that pace. Counted across every book, because the question is about you rather than one manuscript. A day of cutting counts as a day of writing, and nothing here is a target you have missed.",
      },
      {
        name: "Prose report",
        desc: "What is in a chapter, counted: dialogue tags that are not “said”, words ending in -ly, filter words, runs of sentences that start the same way, and very long sentences. There is no score and it never changes a word — none of these is a fault, and the only useful service is showing you where yours are.",
      },
      {
        name: "Paperback setup",
        desc: "Spine width, inside margin and the full cover wrap, worked out from your page count and trim size — four numbers that all depend on the page count, which is why setting a paperback up takes people an evening. Type in the page count from your exported PDF; an estimate from your word count stands in until you have one. These are Amazon KDP's published figures and they do not replace the shop's own template.",
      },
      {
        name: "Structure",
        desc: "The shape most novels share, in plain words, with your own word count placed on it — for when the middle has run out of road. It needs a target length, because every position is a share of a finished book, and it will not guess one. A convention, not a rule.",
      },
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
        desc: "An AI writing partner for the chapter you have open. Needs an ANTHROPIC_API_KEY set on the server.",
      },
    ],
  },
  {
    title: "The publishing tools",
    items: [
      {
        name: "Saving your work",
        desc: "A tool that holds something you typed — the blurb, the categories and keywords, the listing details, a new advance reader — keeps it on screen until you press Save. A bar appears at the foot of the window the moment you change anything and stays there until you do, with Discard beside it to put the form back. Try leaving with it up and you are asked first.",
      },
      {
        name: "Ticking the roadmap from the tool",
        desc: "Saving also ticks the roadmap step the tool finishes, so you do not have to go to the road and say you did it. Most steps work themselves out from the book — write the blurb and “Write the blurb” ticks itself — and the few nothing can detect, like getting a cover made or settling on a title, have a “Mark step done” button at the top of the screen where the work happens.",
      },
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
        desc: "For EPUB and PDF, a title page, a copyright page and a contents list are built from your book and placed at the front — all three on unless you switch them off. The copyright page needs an author’s name and is left out when the book has none, rather than naming the wrong rights holder.",
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
    title: "Writing with someone else",
    items: [
      {
        name: "Two writers, one book",
        desc: "Some books have two writers. Open Collaborators in the sidebar, or press Share on a book, and invite somebody by the email address their account uses. A free book holds 2 people including you; Pro holds 10. Whoever owns the book pays for its seats — the person you invite needs an account, but not a plan.",
      },
      {
        name: "Can edit, or can view",
        desc: "Two levels and no more. Can edit writes the chapters and can add, rename and reorder them. Can view reads the book and can export it, and changes nothing. Either way the book's own details — its title, cover, page setup and shop listing — stay with whoever owns it, because the panel remembers where each of you left off and a shared setting could only remember one.",
      },
      {
        name: "Sending an invitation",
        desc: "You get a link to pass on however you like — we send no email. The link only works for the address you invited, so forwarding it gives nobody access, and it lasts 14 days. It also appears under Collaborators when they next sign in, so a lost link is not the end of it. Cancelling an invitation tells them nothing.",
      },
      {
        name: "Two people in one chapter",
        desc: "This is not live co-editing: you will not see each other type. Changes travel when they are saved, and a chapter is one document — so if you both write the same one at once, the second save is refused rather than quietly replacing the first, and you are asked what to keep. Working in different chapters, which is what usually happens, needs no thought at all.",
      },
      {
        name: "What does not travel",
        desc: "The chapters, their notes and the book's settings sync. The story bible, advance readers, the ledger, your writing record and your roadmap ticks do not — none of those sync between machines for anybody, so a co-writer sees none of yours. Full-size cover artwork stays on the machine it was uploaded from, so if they export the book they get the thumbnail.",
      },
      {
        name: "Taking somebody off",
        desc: "Press Share, then Remove. They lose access from that moment. It cannot reach into a copy their browser has already downloaded, which is what local-first means — so remove somebody you have stopped trusting rather than relying on it afterwards.",
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
        desc: "Writing a book and getting it out are free, whole: unlimited books, all four export formats, syncing to every device, the pre-upload check and the roadmap, comps, blurb, categories, covers, structure and progress. Four things are counted on the free plan, ten each: imports (files, whether one becomes a new book or goes into a book you already have), comp searches, cover searches and title checks. Pro has no limit on any of them. A fifth is counted differently: a book holds 2 people including you on the free plan and 10 on Pro, and that is a number at a time rather than a number spent — take somebody off and the place comes back. The searches those screens run for you when you arrive — your genre’s shelf, your own title — are free and always were; what is counted is a search you asked for. Nothing you have already done is affected either way. Pro covers two kinds of thing — the parts that spend a model's time or an audio bill per use (the assistant, ranked comps, the audiobook and audio import), and the parts you only need once a book is out (the prose report, money tracking and the book-over-book curve, advance copies, the writing record, and reading your story bible across a whole series). Monthly or yearly. See Pricing in the header.",
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
                       font-semibold text-accent-ink outline-none transition-colors
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
