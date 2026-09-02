/**
 * Long-form descriptions for launch-visible tools.
 *
 * The hidden tool pages remain in the repo, but the public guide must describe
 * only what users can reach — `tool-guide.test.ts` walks `ALL_TOOLS` in both
 * directions so neither list can drift from the other.
 *
 * Three as of 2026-09-03: the title check, the consistency check and Export.
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
