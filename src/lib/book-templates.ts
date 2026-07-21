/**
 * Starting shapes for a new book.
 *
 * A template here is a chapter skeleton and nothing more — no boilerplate prose
 * dropped into the manuscript. Structure is genuinely useful to start from;
 * somebody else's opening paragraph is not, and a writer would only have to
 * delete it.
 */

export interface BookTemplate {
  id: string;
  name: string;
  description: string;
  chapters: readonly string[];
}

export const BOOK_TEMPLATES: readonly BookTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "One empty chapter. Start anywhere.",
    chapters: ["Chapter One"],
  },
  {
    id: "three-act",
    name: "Three-act structure",
    description: "Setup, confrontation, resolution — the classic spine.",
    chapters: [
      "Act One — Setup",
      "Act Two — Confrontation",
      "Act Three — Resolution",
    ],
  },
  {
    id: "novel",
    name: "Twelve-chapter novel",
    description: "A full skeleton to rename as the shape emerges.",
    chapters: [
      "Chapter One",
      "Chapter Two",
      "Chapter Three",
      "Chapter Four",
      "Chapter Five",
      "Chapter Six",
      "Chapter Seven",
      "Chapter Eight",
      "Chapter Nine",
      "Chapter Ten",
      "Chapter Eleven",
      "Chapter Twelve",
    ],
  },
  {
    id: "short-story",
    name: "Short story",
    description: "A single piece, no chapter divisions.",
    chapters: ["Story"],
  },
  {
    id: "collection",
    name: "Story collection",
    description: "Three stories to begin with; add more as you write them.",
    chapters: ["First Story", "Second Story", "Third Story"],
  },
];
