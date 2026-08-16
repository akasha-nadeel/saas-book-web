import { SELF_TICKING } from "./roadmap";

/**
 * What each of the sixteen tools is, explained to somebody who has not bought
 * anything yet.
 *
 * **This is the long half of `book-tools.ts`, not a second copy of it.** That
 * file holds the path, the name, the mark and one sentence, and it is read by
 * two screens *inside* the app, where the reader already has a book open and
 * only needs reminding which tile is which. A visitor on `/tools` is in a
 * different position: they are deciding whether any of this is worth an
 * account, and one sentence per tool is a list of nouns. So the name and the
 * grouping still come from `book-tools.ts` — there is exactly one place a tool
 * is declared — and what lives here is the part that only a marketing page
 * needs.
 *
 * **Every entry is held to the page's standing rule**: no claim the code cannot
 * back, no invented number, no verdict. The specifics below are lifted from the
 * modules that implement them rather than written for effect — the KDP figures
 * from `cover-check.ts` and `paperback.ts`, the seven boxes from `keywords.ts`,
 * the five states from `arc.ts`, the two catalogues from `comps/comps.ts` — so
 * a reader who signs up meets the screen they were promised. Where a tool
 * deliberately refuses to do something, the refusal is in the entry, because
 * the refusals are the product.
 *
 * **No plan claims live here.** Which parts of which tool are metered is
 * `free-limits.ts`'s answer and it moves; a sentence on a marketing page
 * repeating it is a sentence that goes quietly wrong. The pricing page is
 * where that question is answered.
 *
 * **A test asserts every tool in `ALL_TOOLS` has an entry**, so adding a
 * seventeenth tool fails the suite rather than shipping a row with nothing in
 * it — the same shape as the `DESTINATIONS` check behind the dashboard's
 * findings.
 */

export interface ToolGuide {
  /** The tool's `path` in `book-tools.ts`. The join between the two files. */
  path: string;
  /**
   * The row's heading — the *outcome*, not the tool's name.
   *
   * The name is printed beside it as an eyebrow, so this is free to say what
   * changes for the reader. "The four numbers a paperback cover depends on"
   * rather than "Paperback setup", which they can already see.
   */
  headline: string;
  /**
   * The words a skimmer takes, set in ink. Read as the opening of the lead
   * below, which continues the same sentence.
   */
  claim: string;
  /** The rest of that sentence, in deck grey. Continues from `claim`. */
  lead: string;
  /** Three folded specifics. Always three: two reads thin, four is a list. */
  points: { term: string; detail: string }[];
  /**
   * The capture of this tool's screen — **absent on every entry today, and the
   * space for it is reserved rather than left to collapse.**
   *
   * With no `shot`, the row draws the tool's own mark on a stage of the same
   * proportions a capture will take (`ToolShot` in `tools-page.tsx`), so the
   * page is a finished thing now and adding a picture later moves nothing
   * around it. Filling one in is: put the file in `public/`, add the four
   * fields here, and the drawing is replaced.
   *
   * **`alt` is not optional when there is a `src`.** The row hands it to
   * `AppWindow` as the whole description of the picture, and its contents hide
   * behind it — an empty one would make the screen invisible rather than
   * decorative. Describe what is *on* the screen, the way the three captures in
   * `feature-shots.tsx` do, not "a screenshot of the covers tool".
   *
   * These are bitmaps, so they carry the standing cost every bitmap on this
   * site carries: when the screen moves, nothing fails and nothing warns — the
   * picture simply starts showing something that is not true any more.
   */
  shot?: { src: string; width: number; height: number; alt: string };
}

export const TOOL_GUIDES: ToolGuide[] = [
  // ---- Get it out ---------------------------------------------------------
  {
    path: "export",
    headline: "The finished file, in every format a shop takes",
    claim: "EPUB, Word, Markdown and a print PDF",
    lead: " — built from your manuscript in the browser, with everything a shop would refuse listed before you upload anything.",
    points: [
      {
        term: "The EPUB is verified, not asserted",
        detail:
          "It is checked against EPUBCheck 5.3 — the same validator the shops run — with no errors and no warnings, both for a fully filled-in book and for a bare one with no cover and nothing entered.",
      },
      {
        term: "It reports what a shop would refuse. It never refuses",
        detail:
          "A missing ISBN, an undersized cover, no author name: each is listed with the field that fixes it. Nothing here blocks the export, because a file you want for your own reader is a perfectly good reason to make one.",
      },
      {
        term: "The print PDF is set on real pages, and numbered",
        detail:
          "Your trim size, a running head naming the chapter, a page number on every page, and a contents list whose numbers are the pages the chapters actually land on. It is still not a printer-ready file in the trade sense — no bleed, no crop marks, no CMYK — and every page in the app that mentions it says so rather than letting you find out at the printer.",
      },
    ],
  },
  {
    path: "roadmap",
    headline: "Every step from blank page to published, in order",
    claim: "Nobody tells you the order",
    lead: " — so this does: one road, five phases, and it already knows which steps your book has finished.",
    points: [
      {
        term: "Most steps tick themselves",
        detail: `${SELF_TICKING} of them are worked out from the book itself — a blurb you wrote, a cover you set, an ISBN you entered. A checklist you have to maintain by hand is a second job, and it goes stale the first time you forget, at which point it is lying to you.`,
      },
      {
        term: "The ones nobody can detect say so",
        detail:
          "Finishing a draft and getting a cover made cannot be worked out from a file. Those are ticked by hand, and they are marked as yours to tick rather than quietly sitting there looking incomplete.",
      },
      {
        term: "Advance readers come before publishing, not after",
        detail:
          "That placement is the whole reason the road exists. Reviews are wanted on the day the book goes on sale, which means lining readers up months before it — the single most common thing writers say they learned too late.",
      },
    ],
  },
  {
    path: "listing",
    headline: "The form every shop asks you to fill in, answered once",
    claim: "ISBN, language, publisher, publication date and series",
    lead: " — kept on the book instead of dug up again for every upload, and checked as you type.",
    points: [
      {
        term: "The ISBN's check digit is real arithmetic",
        detail:
          "An ISBN-13 carries a final digit computed from the other twelve. A typo in any of them fails here, in a form you can fix, rather than at the shop after you have uploaded.",
      },
      {
        term: "None of it is required to write or to export",
        detail:
          "Every field is optional. A writer making an EPUB for their own phone should not have to invent a publisher, so nothing on this screen blocks anything.",
      },
      {
        term: "Filling one field answers the same question in three places",
        detail:
          "The dashboard's findings, the roadmap's ticks and the pre-upload check all read these fields. They are facts about the book, so they are stored on the book rather than inside one export.",
      },
    ],
  },
  {
    path: "paperback",
    headline: "The four numbers a paperback cover depends on",
    claim: "Spine width, inside margin, and the cover's full width and height",
    lead: " — every one of which depends on your page count, which is the last thing you find out.",
    points: [
      {
        term: "The constants are published figures, not guesses",
        detail:
          "The paper thicknesses and margin bands are Amazon KDP's own, kept as named constants so a change is one line and a failing test. They are the strictest in common use, so a cover built to them passes elsewhere.",
      },
      {
        term: "The paper stock moves the answer",
        detail:
          "Cream is thicker than white and colour is thicker again, so the same page count gives three different spines. Choosing the stock here is what makes the number the right one.",
      },
      {
        term: "It does not replace the shop's own template",
        detail:
          "KDP will generate an exact template for a given page count, and a printer's file is the one place where approximately right is worth nothing. This is for knowing the numbers before you get there, and for checking the template you were sent is the one you asked for.",
      },
    ],
  },

  // ---- Find your shelf ----------------------------------------------------
  {
    path: "comps",
    headline: "The published books yours sits beside",
    claim: "Every listing form and every agent letter asks for two or three",
    lead: " — and the only honest way to answer is to go and read the shelf. This is that reading, done for you.",
    points: [
      {
        term: "Two catalogues, merged field by field",
        detail:
          "Google Books and Open Library are asked together. Google carries the blurbs and page counts, Open Library carries the subjects and a cover for almost everything, and their gaps are in different places — so preferring one wholesale throws away the field the other was asked for.",
      },
      {
        term: "Your manuscript does not go anywhere",
        detail:
          "What leaves is the words in the search box and the genre you picked. Every screen in this group lists exactly what it sends, above the button, before you press it.",
      },
      {
        term: "The shelf is measured, with its own sample size",
        detail:
          "Median page count, the subjects those books are filed under, and where your length falls — each reported with how many of the books actually carried the field, because a median from three books and the same median from eighteen are different claims.",
      },
    ],
  },
  {
    path: "blurb",
    headline: "The two hundred words that decide whether anyone opens it",
    claim: "Measured against the shops' own limits, never written for you",
    lead: " — with what is unusual about yours named, and the same measurements from real published books beside it.",
    points: [
      {
        term: "Only two things here are called problems",
        detail:
          "An empty blurb, and one over the shops' character limit. Everything else is an observation with a number attached, because nobody knows whether your three paragraphs beat somebody else's two, and a tool claiming to is doing the thing this product exists not to do.",
      },
      {
        term: "The workshop asks rather than invents",
        detail:
          "It asks who the book is about, what they want, what stands in the way and what failure costs, then shapes a draft out of your own answers. It is instructed to state no fact you did not give it, and only the opening of the book is ever sent — so there is no ending to leak onto your back cover.",
      },
      {
        term: "Nothing reaches the book without a press",
        detail:
          "A draft lands in the form, where you can edit it or throw it away. The blurb on your listing changes when you save it and not before.",
      },
    ],
  },
  {
    path: "categories",
    headline: "The seven keyword boxes nobody explains",
    claim:
      "Amazon already indexes your title, subtitle, author and series name",
    lead: " — so a keyword box repeating any of them buys nothing at all, and nothing anywhere tells you that.",
    points: [
      {
        term: "Counted, never scored",
        detail:
          "No keyword strength, no traffic light, and no search volume. That last one is the number you actually want, and it cannot be had honestly: Amazon publishes no such figure, its ad API is gone, and the tools that quote one are buying scraped data.",
      },
      {
        term: "What it does check",
        detail:
          "Boxes over the fifty-character limit, words your own title already owns, the same word spent twice across two boxes, and phrases the shops publish a rule against.",
      },
      {
        term: "Suggestions go through that same checker",
        detail:
          "Anything a suggested phrase would be flagged for is dropped rather than trimmed to fit — a phrase cut at fifty characters is a different phrase, and one with its offending word removed is a phrase nobody wrote.",
      },
    ],
  },
  {
    path: "covers",
    headline: "Your cover in the shelf it has to compete on",
    claim: "At the size a reader actually meets it",
    lead: " — among real covers from your genre, with the mechanical checks on the file itself beside them.",
    points: [
      {
        term: "What a file can honestly be checked for",
        detail:
          "Pixel dimensions, shape, weight and how much contrast the image has, against Amazon's published floor of 1000px tall by 625px wide and its 10,000px ceiling. Whether a cover is good is not measurable, and this does not pretend otherwise — there is no score.",
      },
      {
        term: "The two questions that decide it are answered by looking",
        detail:
          "Is the title readable at thumbnail size, and does it look like its genre. Neither can be computed, which is exactly what the wall of real covers is for.",
      },
      {
        term: "Your original file is what gets packaged",
        detail:
          "The full-resolution artwork is kept apart from the small copy the shelf draws, so the EPUB ships the picture you chose rather than a thumbnail of it.",
      },
    ],
  },
  {
    path: "title-check",
    headline: "Whether somebody else's book turns up first",
    claim: "A title cannot be copyrighted, so the answer is never simply taken",
    lead: " — what matters is whether you are publishing into a shadow, and how big the book casting it is.",
    points: [
      {
        term: "Exact, close, and merely containing",
        detail:
          "Each book found is graded by how near its title is to yours, with a leading “The” discounted — The Drowned Coast and Drowned Coast are the same title as far as a reader searching is concerned.",
      },
      {
        term: "An empty result is only good news if the search ran",
        detail:
          "The verdict says which catalogues answered. A service being down for five minutes and a title genuinely being unused look identical in the data, and only the source flags tell them apart.",
      },
      {
        term: "It reports and does not advise",
        detail:
          "Plenty of good books share a title with an obscure one and nobody minds. Sharing with a bestseller in your own genre is a different situation, and you are the one who can tell which of those you are in.",
      },
    ],
  },

  // ---- The writing --------------------------------------------------------
  {
    path: "structure",
    headline: "The shape most novels share, with your word count on it",
    claim: "A convention, not a rule",
    lead: " — for the writer at 30,000 words of 80,000 who cannot see why the road ran out.",
    points: [
      {
        term: "The beats are placed as a share of the finished length",
        detail:
          "Which is what lets the screen say something useful: you are at the middle, and the middle is usually where the thing that makes going back impossible happens.",
      },
      {
        term: "Plain names, deliberately ours",
        detail:
          "The famous beat sheets are somebody's copyrighted framework, and their vocabulary is its own barrier. “The middle turn” says what it is; the alternative needs a book explaining it first.",
      },
      {
        term: "Excellent novels ignore every line of it",
        detail:
          "The screen says so itself. This is for when you have run out of road, not a shape you are being held to.",
      },
    ],
  },
  {
    path: "prose",
    headline: "What is actually in the chapter, counted",
    claim: "It never changes a word",
    lead: " — no score, no grade, no readability rating, and no rewrite button anywhere on the screen.",
    points: [
      {
        term: "Every convention is named as a convention",
        detail:
          "Adverbs are not a fault. Filter words are not a fault. Long sentences are not a fault. They are things writers are widely advised about, and the useful service is showing you where yours are — not deciding for you whether it matters.",
      },
      {
        term: "What is countable, and only that",
        detail:
          "Dialogue tags that are something other than “said”, sentences that open the same way several times running, and how far apart a distinctive word repeats.",
      },
      {
        term: "You ask for it",
        detail:
          "Nothing is measured on arrival. The report runs when you press the button, on the chapter you chose.",
      },
    ],
  },
  {
    path: "progress",
    headline: "Whether the writing is actually moving",
    claim: "Facts, never verdicts",
    lead: " — “you wrote on 12 of the last 30 days” is a fact. “You should write more” is a stick, and you have had enough of those.",
    points: [
      {
        term: "Net words, not words typed",
        detail:
          "Cutting a chapter down by 800 words is work, and a counter that only ever goes up would call that a wasted day. The measure is what the book weighs at the end of the day against the start, so a negative day is a day of writing like any other.",
      },
      {
        term: "A finish date only where one can be worked out",
        detail:
          "At the pace you are going, roughly when the draft lands. Where that cannot be answered honestly — a manuscript that is currently shrinking — the screen says nothing rather than something plausible.",
      },
      {
        term: "The day log is library-wide, and says so",
        detail:
          "It records what you wrote, not what you wrote in this one book. Stating that is the difference between a number and a misleading number.",
      },
    ],
  },
  {
    path: "provenance",
    headline: "The trail the work left, in a document you can send",
    claim: "Writers are being accused of using AI",
    lead: " — the accusation has no test that settles it, and the detectors sold as a remedy fail hardest on plain, clean prose.",
    points: [
      {
        term: "Evidence, not proof — and the file says so in its own words",
        detail:
          "The record lives in your browser and anybody at that machine could edit it. It is not tamper-evident. Presenting it as proof would be selling false confidence to somebody in the middle of an argument they are frightened of losing.",
      },
      {
        term: "It starts when you started here",
        detail:
          "A book drafted elsewhere and imported arrives as one large day, which is an import and is evidence of nothing either way. The exported document states that limit rather than burying it.",
      },
      {
        term: "The fingerprint is the part that is not self-reported",
        detail:
          "A SHA-256 of the manuscript is a number anyone can recompute from the same text. What gives it weight is a timestamp somewhere we do not control — so the page tells you to email it to yourself, and never offers to keep it here.",
      },
    ],
  },

  // ---- Money and reviews --------------------------------------------------
  {
    path: "money",
    headline: "What it costs, told to you before the money leaves",
    claim: "Everybody else in this market earns when you spend",
    lead: " — which is why almost nobody tells you this, and telling you is cheap.",
    points: [
      {
        term: "Every figure carries where it came from",
        detail:
          "The widely repeated sales numbers come from industry summaries and from writers describing their own results. They are directional rather than audited, and each one says so beside itself — better an honest rough number than a confident false one.",
      },
      {
        term: "No company is named",
        detail:
          "However often one comes up, calling a named business a scam is a legal problem rather than a feature, and it is unnecessary. The checks describe the shape of the thing instead: who pays whom, what is promised, and what to establish before any money moves.",
      },
      {
        term: "It is a planning screen, not a ledger",
        detail:
          "What covers, editing and promotion usually cost, and what to settle before paying for them. Recording what you actually spent is the next tool along.",
      },
    ],
  },
  {
    path: "track",
    headline: "What this book cost against what it earned",
    claim: "Nobody tracks it, so nobody sees it coming",
    lead: " — costs on one side, sales on the other, and how many copies get you level.",
    points: [
      {
        term: "Sales arrive as a file, because there is no other way",
        detail:
          "Amazon publishes no sales API. What KDP does let you do is download a report, and the import reads its header row and asks which column is which — so it works with a shop's export, an aggregator's, or a spreadsheet you keep by hand, and does not break the week a column is renamed.",
      },
      {
        term: "Break-even is shown only when it can be worked out",
        detail:
          "It needs a royalty rate to be a real number. Without one the screen says nothing, rather than printing a figure that would look like an answer.",
      },
      {
        term: "It stays on the machine you enter it on",
        detail:
          "The ledger is not one of the things that syncs between your devices, and the screen tells you that rather than letting you discover it on a second computer.",
      },
    ],
  },
  {
    path: "arc",
    headline: "Who has an advance copy, and who actually reviewed",
    claim: "One list instead of six sites and a spreadsheet",
    lead: " — each with the date its review is wanted, which is the entire reason for sending a copy early.",
    points: [
      {
        term: "A tracker, not a marketplace",
        detail:
          "It cannot supply readers and does not pretend to. What writers described was never a shortage of readers — it was six browser tabs and no idea who had what.",
      },
      {
        term: "Five states, including the one no form has",
        detail:
          "Sent, reading, reviewed, declined — and silent, for the reader who took the copy and stopped answering. That happens constantly and is worth being able to write down.",
      },
      {
        term: "The due date is the feature",
        detail:
          "A copy sent with no date is a copy nobody chases, and a writer who does not know when the reviews are wanted finds out on launch day.",
      },
    ],
  },
];

/** By path, for a screen that has a `BookTool` and wants its long half. */
export const GUIDE_BY_PATH: Record<string, ToolGuide> = Object.fromEntries(
  TOOL_GUIDES.map((guide) => [guide.path, guide]),
);
