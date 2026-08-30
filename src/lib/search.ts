import type { Editor } from "@tiptap/react";
import { getBody, orderedChapters, saveBody, type Book } from "./library-store";

/**
 * Searching and replacing the prose of a book.
 *
 * The shelf search matches titles; this reads the chapters themselves. A
 * chapter is stored as a Tiptap document, so its words have to be walked out of
 * the JSON before they can be matched. Results carry snippets around every hit so
 * the writer can inspect and navigate to all matching occurrences.
 */

export interface SearchOptions {
  caseSensitive?: boolean;
  matchWord?: boolean;
  chapterId?: string | null;
}

export interface SearchMatch {
  id: string;
  chapterId: string;
  chapterTitle: string;
  index: number;
  totalInChapter: number;
  before: string;
  match: string;
  after: string;
}

export interface ChapterSearchGroup {
  chapterId: string;
  chapterTitle: string;
  matches: SearchMatch[];
}

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

export interface EditorMatchRange {
  from: number;
  to: number;
  text: string;
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "codeBlock",
  "horizontalRule",
]);

export interface DocNode {
  type?: string;
  text?: string;
  content?: DocNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plain text of a stored chapter document. */
export function chapterText(title: string, raw: string | null): string {
  const parts: string[] = [];
  if (title) parts.push(title);
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

const SNIPPET_BEFORE = 30;
const SNIPPET_AFTER = 38;

export function buildSearchRegex(query: string, options: SearchOptions): RegExp | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const pattern = escapeRegExp(trimmed);
  const flags = options.caseSensitive ? "g" : "gi";
  const regexStr = options.matchWord ? `\\b${pattern}\\b` : pattern;
  try {
    return new RegExp(regexStr, flags);
  } catch {
    return null;
  }
}

/**
 * Detailed search returning all occurrences grouped by chapter.
 */
export function searchChaptersDetailed(
  book: Book,
  query: string,
  options: SearchOptions = {},
): ChapterSearchGroup[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const regex = buildSearchRegex(query, options);
  if (!regex) return [];

  const groups: ChapterSearchGroup[] = [];
  const chapters = orderedChapters(book);
  const targetChapters = options.chapterId
    ? chapters.filter((c) => c.id === options.chapterId)
    : chapters;

  for (const chapter of targetChapters) {
    const raw = getBody(chapter.id);
    const text = chapterText(chapter.title, raw);
    
    // Find all match indices
    regex.lastIndex = 0;
    const matches: SearchMatch[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchedText = match[0];
      if (!matchedText) {
        regex.lastIndex++;
        continue;
      }

      const start = Math.max(0, matchIndex - SNIPPET_BEFORE);
      const end = Math.min(text.length, matchIndex + matchedText.length + SNIPPET_AFTER);

      matches.push({
        id: `${chapter.id}-${matches.length}-${matchIndex}`,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        index: matches.length,
        totalInChapter: 0,
        before: (start > 0 ? "… " : "") + text.slice(start, matchIndex),
        match: matchedText,
        after: text.slice(matchIndex + matchedText.length, end) + (end < text.length ? " …" : ""),
      });

      // Avoid infinite loop on zero-length matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }

    if (matches.length > 0) {
      for (const m of matches) {
        m.totalInChapter = matches.length;
      }
      groups.push({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        matches,
      });
    }
  }

  return groups;
}

/**
 * Legacy simple search for compatibility.
 */
export function searchChapters(book: Book, query: string): SearchHit[] {
  const groups = searchChaptersDetailed(book, query);
  return groups.map((g) => ({
    chapterId: g.chapterId,
    title: g.chapterTitle,
    count: g.matches.length,
    before: g.matches[0]?.before ?? "",
    match: g.matches[0]?.match ?? "",
    after: g.matches[0]?.after ?? "",
  }));
}

/**
 * Finds all match positions within a live Tiptap ProseMirror document.
 */
export function findMatchesInEditor(
  editor: Editor | null | undefined,
  query: string,
  options: SearchOptions = {},
): EditorMatchRange[] {
  const trimmed = query.trim();
  if (!trimmed || !editor || editor.isDestroyed) return [];

  const regex = buildSearchRegex(query, options);
  if (!regex) return [];

  const ranges: EditorMatchRange[] = [];

  try {
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;

      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(node.text)) !== null) {
        const matchIndex = match.index;
        const matchedText = match[0];
        if (!matchedText) {
          regex.lastIndex++;
          continue;
        }

        const from = pos + matchIndex;
        const to = from + matchedText.length;
        ranges.push({ from, to, text: matchedText });

        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    });
  } catch {
    return [];
  }

  return ranges;
}

/**
 * Focuses and scrolls to a match range in the live Tiptap editor.
 */
export function selectMatchInEditor(
  editor: Editor | null | undefined,
  range: { from: number; to: number },
): boolean {
  if (!editor || editor.isDestroyed) return false;
  try {
    editor
      .chain()
      .setTextSelection({ from: range.from, to: range.to })
      .scrollIntoView()
      .run();
    return true;
  } catch {
    return false;
  }
}

/**
 * Replaces a single range in the live Tiptap editor.
 */
export function replaceMatchInEditor(
  editor: Editor | null | undefined,
  range: { from: number; to: number },
  replacement: string,
): boolean {
  if (!editor || editor.isDestroyed) return false;
  try {
    const tr = editor.state.tr;
    tr.insertText(replacement, range.from, range.to);
    editor.view.dispatch(tr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Replaces all occurrences in the live Tiptap editor atomically with full undo history.
 */
export function replaceAllInEditor(
  editor: Editor | null | undefined,
  query: string,
  replacement: string,
  options: SearchOptions = {},
): number {
  if (!editor || editor.isDestroyed) return 0;
  const ranges = findMatchesInEditor(editor, query, options);
  if (ranges.length === 0) return 0;

  try {
    const tr = editor.state.tr;
    // Replace in reverse order so character indices remain exact
    const sorted = [...ranges].sort((a, b) => b.from - a.from);
    for (const { from, to } of sorted) {
      tr.insertText(replacement, from, to);
    }
    editor.view.dispatch(tr);
    return ranges.length;
  } catch {
    return 0;
  }
}

/**
 * Replaces matching occurrences inside a Tiptap JSON node hierarchy.
 */
export function replaceTextInDocNode(
  node: DocNode,
  regex: RegExp,
  replacement: string,
): { node: DocNode; replacedCount: number } {
  let count = 0;
  if (!node || typeof node !== "object") return { node, replacedCount: 0 };

  const copy: DocNode = { ...node };

  if (typeof copy.text === "string") {
    regex.lastIndex = 0;
    const matches = copy.text.match(regex);
    if (matches) {
      count += matches.length;
      copy.text = copy.text.replace(regex, replacement);
    }
  }

  if (Array.isArray(copy.content)) {
    copy.content = copy.content.map((child) => {
      const result = replaceTextInDocNode(child, regex, replacement);
      count += result.replacedCount;
      return result.node;
    });
  }

  return { node: copy, replacedCount: count };
}

function countWordsInDoc(node: DocNode): number {
  const words: string[] = [];
  walk(node, words);
  return words.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Replace occurrences in a single chapter.
 */
export async function replaceInChapter(
  bookId: string,
  chapterId: string,
  query: string,
  replacement: string,
  options: SearchOptions = {},
): Promise<number> {
  const raw = getBody(chapterId);
  if (!raw) return 0;

  const regex = buildSearchRegex(query, options);
  if (!regex) return 0;

  try {
    const doc = JSON.parse(raw) as DocNode;
    const { node: newDoc, replacedCount } = replaceTextInDocNode(doc, regex, replacement);
    if (replacedCount > 0) {
      const words = countWordsInDoc(newDoc);
      await saveBody(bookId, chapterId, newDoc, words);
    }
    return replacedCount;
  } catch {
    return 0;
  }
}

/**
 * Replace occurrences across the whole book (or filtered by chapterId in options).
 */
export async function replaceAllInBook(
  book: Book,
  query: string,
  replacement: string,
  options: SearchOptions = {},
): Promise<number> {
  const chapters = orderedChapters(book);
  const targets = options.chapterId
    ? chapters.filter((c) => c.id === options.chapterId)
    : chapters;

  let totalReplaced = 0;
  for (const chapter of targets) {
    const replaced = await replaceInChapter(
      book.id,
      chapter.id,
      query,
      replacement,
      options,
    );
    totalReplaced += replaced;
  }

  return totalReplaced;
}
