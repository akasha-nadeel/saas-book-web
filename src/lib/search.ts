import { getBody, orderedChapters, type Book } from "./library-store";

/**
 * Searching the prose of a book.
 *
 * The shelf search matches titles; this reads the chapters themselves. A
 * chapter is stored as a Tiptap document, so its words have to be walked out of
 * the JSON before they can be matched — done here, once, rather than in the
 * component. Results carry a snippet around the first hit so the writer can see
 * the sentence without opening the chapter.
 */

export interface SearchHit {
  chapterId: string;
  title: string;
  /** How many times the query appears in the chapter. */
  count: number;
  /** The first hit's context, split so the match can be marked. */
  before: string;
  match: string;
  after: string;
}

// Block nodes get a break after them, so words in adjacent paragraphs are not
// run together into a false match.
const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "codeBlock",
  "horizontalRule",
]);

interface DocNode {
  type?: string;
  text?: string;
  content?: DocNode[];
}

/** Plain text of a stored chapter document — its title is searched too. */
export function chapterText(title: string, raw: string | null): string {
  const parts: string[] = [title];
  if (raw) {
    try {
      walk(JSON.parse(raw) as DocNode, parts);
    } catch {
      // A corrupt body just contributes nothing rather than failing the search.
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function walk(node: DocNode, out: string[]): void {
  if (!node || typeof node !== "object") return;
  if (typeof node.text === "string") out.push(node.text);
  if (Array.isArray(node.content)) for (const child of node.content) walk(child, out);
  if (node.type && BLOCK_TYPES.has(node.type)) out.push("\n");
}

const SNIPPET_BEFORE = 32;
const SNIPPET_AFTER = 48;

/**
 * Every chapter whose title or text contains the query, in reading order.
 *
 * A one-character query matches nearly everything, so searching waits for two.
 */
export function searchChapters(book: Book, query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const hits: SearchHit[] = [];

  for (const chapter of orderedChapters(book)) {
    const text = chapterText(chapter.title, getBody(chapter.id));
    const lower = text.toLowerCase();

    const first = lower.indexOf(needle);
    if (first < 0) continue;

    let count = 0;
    for (let i = first; i >= 0; i = lower.indexOf(needle, i + needle.length)) {
      count += 1;
    }

    const start = Math.max(0, first - SNIPPET_BEFORE);
    const end = Math.min(text.length, first + needle.length + SNIPPET_AFTER);

    hits.push({
      chapterId: chapter.id,
      title: chapter.title,
      count,
      before: (start > 0 ? "… " : "") + text.slice(start, first),
      match: text.slice(first, first + needle.length),
      after: text.slice(first + needle.length, end) + (end < text.length ? " …" : ""),
    });
  }

  return hits;
}
