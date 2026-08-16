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
        desc: "Bring in a .docx, .epub, .md, .txt, or .html file — it is split into chapters for you. Importing is unlimited on either plan.",
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
        desc: "Use the upload button at the top of the book panel to bring a .docx, .epub, .md, .txt, or .html file into the book you have open. If you have already written here, you are asked whether to add the chapters (numbered on from your last one) or replace what you have — and you can undo it right after. Importing is unlimited on either plan.",
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
        desc: "The covers screen has two halves and a switch above them: the shelf, and this. Drop in the artwork you are about to upload and it reports every rule it knows, with a tick against the ones it passed as well as a mark against the ones it did not, so you can see what was examined rather than only what was wrong. The rules are Amazon's own published figures: at least 1,000 pixels tall and 625 wide, no more than 10,000 on either side, at least 1.6:1 (taller than that is fine by Amazon — it is only letterboxed in a thumbnail), under 50MB, and saved as a JPEG or TIFF. That last one catches the commonest avoidable rejection there is: PNG is what most design tools and image generators hand you, Amazon does not take it for an ebook cover, and re-saving costs you thirty seconds against days of a delayed launch. It also reports two things Amazon asks for rather than requires — whether the image is very flat, and whether its edges are nearly white, which Amazon warns makes a cover seem to disappear against the shop's own white page unless you put a narrow grey border on it. Where a fix can be made honestly it is offered: re-saving a PNG as a JPEG with every pixel where it was, crop or pad to the shape shops use — both drawn at the artwork's own resolution so nothing is invented — and an enlarge that says on the button that it adds no detail. You choose what shows before anything is written, nothing is uploaded, and you get a copy rather than a change to your file. Every file it writes is a JPEG, which is the format the check itself asks for. Measured in your browser and never counted against anything — it is the other half, where you search for the covers your book has to sit beside, that spends one of the free plan's three a day. Whether the cover is any good is that half's job, not a number's.",
      },
      {
        name: "Blurb",
        desc: "The two hundred words that decide whether anybody opens the book. It writes nothing — writers in this research describe an AI-written blurb as the thing that hurt their sales — so instead it counts what you have written against the shops’ limits and tells you where it is unusual: the length, whether it opens with the title the shop has already printed above it, whether it is one wall of text on a phone, the longest sentence, and a shouted word. Only two things on the screen are rules: an empty blurb, and one over 4,000 characters, which shops refuse. Everything else is a measurement. “Ask a reader” is the one part that uses a model, and it still writes nothing: it answers with what somebody in a bookshop would still be wondering after reading your description — who wants what, what stands in the way, what it costs — and there is no suggested wording anywhere on the card to paste back in. It is sent your description, your title and your genre, never the manuscript, and it is part of Pro. “Work it out loud” is the other half, for the empty box rather than a finished blurb: it asks about your book — who it is about, what they want, what stands in the way, what failure costs — and puts a draft together from your answers. It never states anything you did not tell it, and it is not told your ending. This one does send prose: your conversation, your draft, title and genre, and the opening of your first chapter, so the words sound like the book; the panel names all of that above the box before you send anything. A draft appears with a button and goes nowhere until you press it, and nothing is stored until you press Save. Three conversations are free in total rather than per day — they do not come back — and Pro has no limit. The five example blurbs from published books were removed on 2026-08-04 — the catalogue returned classics rather than recent comparable titles, and the median length it computed was drawn from one-line catalogue summaries rather than real blurbs, so the screen was telling writers a normal blurb was too long.",
      },
      {
        name: "Listing details",
        desc: "The handful of facts every shop asks for before it will list a book: an ISBN with its check digit verified, the language, the publisher, the publication date and the series. Answered once and stored on the book, so they travel into every export rather than being asked again each time. Until 2026-08-05 these lived only inside the export flow's fourth step, reachable by starting an export and choosing EPUB; they have their own tool now, and the dashboard's findings link straight to it.",
      },
      {
        name: "Categories & keywords",
        desc: "The seven keyword boxes a shop's form asks you for. Seven boxes of 50 characters is Amazon's shape rather than a standard — Kobo has one keywords field, Apple Books none, IngramSpark works from BISAC codes — and this screen is built to the strictest of them, so a set of phrases that fits here fits anywhere. None of it goes into the book file: keywords live on the shop's own listing form, filled in when you upload and changeable afterwards without touching the manuscript — so each keyword has a copy button beside it to save you retyping. The keyword half counts what you have typed and says what it is costing you — boxes over the 50-character limit, quotation marks, which Amazon refuses outright, words your title or your chosen categories already own so the shop indexes them anyway, the same word spent in two boxes, and phrases shops reject like “bestseller” or “new”. Beside the boxes is a chat that does two jobs: it answers questions about the seven — what they are, where they go, what a shop refuses — and it works out which seven this book should spend. It can offer phrases, and a button puts them in the empty boxes; nothing overwrites a box you typed in, nothing is saved until you press Save, and Undo puts the previous seven back. Three conversations are free in total, and they do not come back. The button above it, Suggest seven from my blurb, does the common case in one press instead — five of those are free, also in total. Both send your description, genre, categories and listing names, never the manuscript. One thing worth knowing that the three categories cannot do: a few of Amazon’s subcategories are reached only through these boxes, when a keyword carries the word they are gated on, and Amazon publishes which genre by genre. How these work, beside the count, opens a guide to all of it — what the seven are, where they go on Amazon’s form, the step-by-step method for writing them yourself, and what a shop refuses, each checked against Amazon’s own help pages. It needs no plan, no key and no connection, which is the point of it: the checking half of this screen works when nothing is suggesting anything. Check each suggestion is true of your book: shops ask that the keywords, title and description describe the same one. There is no search volume and no ranking anywhere: Amazon publishes none, its data API closed in 2026, and the tools that quote a figure buy scraped data. Two halves of this screen are out and both are meant to return: the subject search — which read where comparable books are actually filed, and the Pro step that matched those subjects to a shop’s own category paths — went on 2026-08-04 to get a release out, and the list of chosen categories itself went on 2026-08-11 to be rebuilt. Until it is back, categories are set on the Listing details screen, in the box that takes them separated by commas; the keyword checker still reads them from there, so it still tells you when a box repeats one.",
      },
      {
        name: "Comp titles",
        desc: "The published books yours sits beside — what every listing form and query letter asks for, and what most writers guess at. A search built from your genre and blurb goes to Google Books and Open Library, and what comes back is what those catalogues hold for those words, in their order. Then Rank these asks a model which of them are genuinely like your book: at most five, best first, each with a reason in a sentence. There is no score and no percentage — it is a judgement worth disagreeing with, not a measurement. Ranking is the one part of the screen that sends anything you have written (your blurb and the opening of your first chapter), it only goes when you press the button, and the card lists exactly what leaves before you do. The search itself sends only the words in the box and works with no account and no key. The free plan runs two of these searches a day and Pro has no limit; the shelf this screen opens on is not one of them, and neither is looking at what is already there. Whatever you have found stays where it is when the day's two are gone, and there are two more tomorrow.",
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
        desc: "Who holds an advance copy and who read it — one list instead of six sites and a spreadsheet. Record where you found each reader and what they actually read, since the review everybody remembers comes from someone who does not read your genre. The list is ordered by whose review is wanted soonest, and if the book has a publication date the page works back to when copies need to go out. It does not yet tell you who is overdue; that part is being rebuilt. It finds nobody for you and sends nothing.",
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
        desc: "An AI writing partner for the chapter you have open. Needs either an ANTHROPIC_API_KEY or a GOOGLE_GENERATIVE_AI_API_KEY set on the server.",
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
        name: "Generated front matter",
        desc: "For EPUB and PDF, a title page, a copyright page and a contents list are built from your book and placed at the front — all three on unless you switch them off. The copyright page needs an author’s name and is left out when the book has none, rather than naming the wrong rights holder.",
      },
      {
        name: "Read it before you send it",
        desc: "The step before the export shows the book as the file will actually have it, not a picture of one. The PDF is laid out by the same engine that lays out the PDF, so the page count and the page numbers beside the contents entries are the ones you will get. Word is the real .docx, built and opened back up. EPUB is the pages the file packages, in your own typography — no page count there, because an e-reader picks its own page. If you have written your own title, copyright or contents page, the review says so: yours is used and ours stands down for it.",
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
        desc: "We email them an invitation, and you also get a link to pass on however you like — the screen tells you whether the email actually went. The link only works for the address you invited, so forwarding it gives nobody access, and it lasts 14 days. It also appears under Collaborators when they next sign in, so a lost email is not the end of it. Cancelling an invitation tells them nothing.",
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
