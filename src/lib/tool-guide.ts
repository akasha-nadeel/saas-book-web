/**
 * Long-form descriptions for launch-visible tools.
 *
 * The launch MVP exposes only Export from the old tool catalogue. The hidden
 * tool pages remain in the repo, but the public guide must describe only what
 * users can reach.
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
