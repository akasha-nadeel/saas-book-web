/**
 * Picking a writer up where they left off.
 *
 * The top-voted pain in the research, and the one nothing on the market
 * addresses, because every writing app is built for somebody with two
 * uninterrupted hours:
 *
 *   "I have about 17 free minutes with no interruptions and no distractions a
 *    day to write."
 *   "…because I don't write enough it takes me a long time to get caught up
 *    with where I left off, and it takes forever to get back in the groove."
 *
 * Seventeen minutes minus the ten it takes to remember where you were is seven
 * minutes of writing. **The cost of stopping and starting is the thing being
 * attacked here**, and the fix is not clever: show the last paragraph they
 * wrote, and the note they left themselves, before they have to go looking.
 *
 * Everything in this module is pure — a stored Tiptap document in, the tail of
 * the prose out. Nothing new is stored: the note is the chapter notes panel
 * that already exists, and the paragraph is read back out of the manuscript.
 */

/**
 * The last paragraph of a stored chapter.
 *
 * Walks the document from the end rather than extracting all of it and taking
 * the tail: a long chapter is a lot of text to assemble in order to throw away
 * every line but one, and this runs on the overview of a book that may have
 * forty of them.
 *
 * Returns null for a chapter with nothing in it — a writer opening a blank
 * chapter is not resuming, and an empty quotation under "where you left off"
 * reads as a fault.
 */
export function lastParagraph(raw: string | null): string | null {
  if (!raw) return null;

  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return null;
  }

  const blocks = (doc as { content?: unknown })?.content;
  if (!Array.isArray(blocks)) return null;

  for (let i = blocks.length - 1; i >= 0; i--) {
    const text = textOf(blocks[i]).trim();
    if (text) return text;
  }
  return null;
}

/** Every string in a node, in order. Nested lists and quotes included. */
function textOf(node: unknown): string {
  const record = node as { text?: unknown; content?: unknown };
  if (typeof record?.text === "string") return record.text;
  if (!Array.isArray(record?.content)) return "";
  return record.content.map(textOf).join("");
}

/**
 * The tail of a paragraph, cut at a word.
 *
 * The *end* rather than the beginning, which is the opposite of how a preview
 * usually works and is the whole point: a writer resuming needs the sentence
 * they stopped in the middle of, not the one they started the paragraph with.
 */
export function tail(text: string, limit = 320): string {
  if (text.length <= limit) return text;
  const cut = text.slice(text.length - limit);
  const space = cut.indexOf(" ");
  return `…${space > -1 ? cut.slice(space + 1) : cut}`;
}

/**
 * The first line of the writer's own note, for the one-line summary.
 *
 * Writers use the notes panel for everything — research, links, a list of names
 * — so the whole note is not a prompt. The first line usually is, because a
 * note left for tomorrow gets written at the top.
 */
export function noteHint(notes: string | null, limit = 160): string | null {
  if (!notes) return null;
  const first = notes
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!first) return null;
  return first.length > limit ? `${first.slice(0, limit).trimEnd()}…` : first;
}
