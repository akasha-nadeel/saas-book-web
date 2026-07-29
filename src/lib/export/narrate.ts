/**
 * Preparing a manuscript to be read aloud.
 *
 * Speech models take a few thousand characters per request; a chapter is many
 * times that and a book is many times a chapter. So the text has to be cut up,
 * and *where* it is cut is the whole problem: a break mid-sentence is audible.
 * The reader stops, the next request starts cold, and the join lands in the
 * middle of a clause.
 *
 * So cuts are made at the largest boundary that fits — paragraph, then
 * sentence, then, only if a single sentence is somehow longer than a whole
 * request, at a word. Splitting mid-word never happens.
 */

/**
 * Characters per request.
 *
 * The common ceiling is 4096. Sitting under it leaves room for the model to be
 * handed a slightly longer chunk than we measured — and a request refused for
 * length costs a round trip and produces nothing.
 */
export const MAX_SPEECH_CHARS = 3500;

/**
 * The text of one chapter, cut into pieces a speech model will accept.
 *
 * Returns [] for text with nothing in it, so a chapter with no prose produces
 * no requests rather than one that bills for silence.
 */
export function speechChunks(
  text: string,
  limit: number = MAX_SPEECH_CHARS,
): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  // Paragraphs first: a break between them is a pause the listener expects
  // anyway, so it is the one cut that costs nothing.
  for (const paragraph of clean.split(/\n{2,}/)) {
    const piece = paragraph.trim();
    if (!piece) continue;

    if (piece.length > limit) {
      flush();
      for (const part of splitLongPassage(piece, limit)) {
        chunks.push(part);
      }
      continue;
    }

    if (current.length + piece.length + 2 > limit) flush();
    current = current ? `${current}\n\n${piece}` : piece;
  }

  flush();
  return chunks;
}

/** A paragraph too long for one request: cut at sentences, then at words. */
function splitLongPassage(passage: string, limit: number): string[] {
  const out: string[] = [];
  let current = "";

  for (const sentence of passage.split(/(?<=[.!?…])\s+/)) {
    if (sentence.length > limit) {
      if (current.trim()) out.push(current.trim());
      current = "";
      out.push(...splitOnWords(sentence, limit));
      continue;
    }

    if (current.length + sentence.length + 1 > limit) {
      if (current.trim()) out.push(current.trim());
      current = "";
    }
    current = current ? `${current} ${sentence}` : sentence;
  }

  if (current.trim()) out.push(current.trim());
  return out;
}

/** The last resort. Never mid-word: a split word is unreadable aloud. */
function splitOnWords(sentence: string, limit: number): string[] {
  const out: string[] = [];
  let current = "";

  for (const word of sentence.split(/\s+/)) {
    if (current.length + word.length + 1 > limit) {
      if (current) out.push(current);
      current = "";
    }
    current = current ? `${current} ${word}` : word;
  }

  if (current) out.push(current);
  return out;
}

/**
 * A track name that sorts in reading order in any file browser.
 *
 * Zero-padded, because "10" sorting before "2" would shuffle a listener's book
 * — which is the one thing a chapter number is there to prevent.
 */
export function trackName(index: number, total: number, title: string): string {
  const width = String(total).length;
  const number = String(index + 1).padStart(width, "0");
  const safe = title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return `${number} ${safe || "Untitled"}.mp3`;
}
