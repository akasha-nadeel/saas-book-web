/**
 * Long-form descriptions for launch-visible tools.
 *
 * The hidden tool pages remain in the repo, but the public guide must describe
 * only what users can reach — `tool-guide.test.ts` walks `ALL_TOOLS` in both
 * directions so neither list can drift from the other.
 *
 * Five as of 2026-09-15: the title check, the consistency check, paperback
 * setup, the writing record and Export. (Advance copies had a guide for a day
 * and lost it when its tool went back behind the gate.)
 * Comp titles was the fourth and went back behind the launch gate; its guide
 * went with it, because a guide for a tool the product does not list fails
 * the test in the other direction.
 */

export interface ToolGuide {
  path: string;
  headline: string;
  claim: string;
  lead: string;
  points: { term: string; detail: string }[];
  shot?: { src: string; width: number; height: number; alt: string };
}

export const TOOL_GUIDES: ToolGuide[] = [
  {
    path: "title-check",
    headline: "Whether a reader searching for your title finds somebody else first",
    claim: "Who else is publishing under this name",
    lead: " — with how close each one is, and no verdict.",
    points: [
      {
        term: "No title is taken",
        detail:
          "Titles cannot be copyrighted, so nothing here is about permission. The useful question is whether you are publishing into somebody else's shadow, and that is the question this answers.",
      },
      {
        term: "Graded by how near it is",
        detail:
          "An exact match, the same words in another order, and a title that merely contains yours are three different problems. Each match is placed on that scale so you can see which kind you are looking at.",
      },
      {
        term: "An empty result is never read as a good one",
        detail:
          "A search that could not reach a catalogue returns nothing, and nothing rendered as an all-clear would be a confident answer produced by a search that never ran. Which services replied is shown beside the result.",
      },
    ],
  },
  {
    path: "consistency",
    headline: "The mistakes that only show up when the whole book is read at once",
    claim: "Names, spellings and quotation marks",
    lead: " — checked across every chapter in one pass.",
    points: [
      {
        term: "A name spelled two ways",
        detail:
          "Katherine through the first twelve chapters and Catherine in the thirtieth is invisible from inside a draft, because nobody reads their own book straight through. This finds both spellings and says which chapters each one is in.",
      },
      {
        term: "British and American spellings in one book",
        detail:
          "Colour beside color, travelled beside traveled, grey beside gray. Neither spelling is wrong, and a manuscript carrying both is one of the things a copy editor is hired to catch.",
      },
      {
        term: "Straight quotation marks among curly ones",
        detail:
          "Text typed here takes typographic quotes, while text brought in from elsewhere keeps whatever it arrived with, so one manuscript can print two ways. This says where each kind is.",
      },
    ],
  },
  /* The two below arrived with their tools on 2026-09-15. */
  {
    path: "paperback",
    headline: "The numbers a printed book needs, before the printer rejects it",
    claim: "Spine width, inside margin and cover size",
    lead: " — worked out from your page count and trim.",
    points: [
      {
        term: "The spine follows the page count",
        detail:
          "Every page adds its thickness, and cream paper is thicker than white. Type in the page count from your PDF, pick the paper, and the spine and the full cover width follow.",
      },
      {
        term: "The inside margin grows with the book",
        detail:
          "A thick book does not open flat, so the margin at the spine has to widen as the page count rises. The figures are the ones Amazon KDP publishes.",
      },
      {
        term: "Check it against the shop's template",
        detail:
          "KDP makes an exact template once it knows your page count. This is for knowing the numbers before you get there, and for checking the template you were sent.",
      },
    ],
  },
  {
    path: "provenance",
    headline: "A record of your book being written, for when somebody asks",
    claim: "The days you wrote and the drafts that were saved",
    lead: " — gathered into a document you can send.",
    points: [
      {
        term: "Evidence, not proof",
        detail:
          "No test settles whether a book was written by a person, and the detectors sold for it misfire on plain prose. A dated trail of the work is what people reach for instead, and this is that trail.",
      },
      {
        term: "It says what it cannot show",
        detail:
          "The record lives in your browser and starts when you started writing here. The document says both, so nobody reading it is told more than it establishes.",
      },
      {
        term: "Nothing is sent anywhere",
        detail:
          "The record and its fingerprint are made on your machine. Where the document goes after that is your decision.",
      },
    ],
  },
  {
    path: "export",
    headline: "A clean file when your book needs to leave OpenChapter",
    claim: "Word, EPUB and PDF",
    lead: " — so your manuscript is never trapped in the app.",
    points: [
      {
        term: "Word is the safest first file",
        detail:
          "DOCX export is the safest first-launch format because agents, editors and backup workflows all understand it.",
      },
      {
        term: "Publishing-ready formats are there when needed",
        detail:
          "EPUB is for ebook stores and readers. PDF is typeset on the server so page numbers and contents pages can be built correctly.",
      },
      {
        term: "Hidden formats can come back later",
        detail:
          "Markdown and the broader publishing workflow are preserved for post-launch work, but are not shown until they are worth the extra complexity.",
      },
    ],
  },
];

export const GUIDE_BY_PATH: Record<string, ToolGuide> = Object.fromEntries(
  TOOL_GUIDES.map((guide) => [guide.path, guide]),
);
