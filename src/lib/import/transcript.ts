/**
 * Turning a transcript back into prose.
 *
 * Speech-to-text returns punctuated sentences in one continuous run. It has no
 * paragraphs, because a narrator does not speak them — they pause. Handed
 * straight to the importer that run becomes a single enormous paragraph in a
 * single chapter, and `splitIntoChapters` finds nothing to split on, because
 * the "Chapter Four" the narrator read aloud is buried mid-line.
 *
 * So the structure has to be put back before the text reaches the import path.
 * The timings are what carry it: a narrator's pause between paragraphs is
 * markedly longer than the one between sentences, and the transcriber reports
 * where every segment started and ended. No second model needed — the
 * information is already in the response.
 */

export interface TranscriptSegment {
  text: string;
  startSecond: number;
  endSecond: number;
}

/**
 * A silence at least this long ends a paragraph.
 *
 * Narrators breathe for roughly a third of a second between sentences and pause
 * deliberately between paragraphs. A second and a bit sits above the first and
 * below the second, and errs towards fewer, longer paragraphs — a paragraph
 * break in the wrong place is a visible mistake in the prose, while a missing
 * one only reads as a long paragraph.
 */
const PARAGRAPH_GAP_SECONDS = 1.2;

/** Sentences per paragraph when there are no timings to go on. */
const SENTENCES_PER_PARAGRAPH = 4;

/**
 * The transcript as prose: paragraphs separated by a blank line, which is what
 * `parseText` reads as a paragraph break.
 *
 * Prefers the timings and falls back to counting sentences, because `segments`
 * is documented as "if available" — not every model returns it, and a fallback
 * that produces readable paragraphs beats one that produces a wall of text.
 */
export function transcriptToProse(
  text: string,
  segments?: readonly TranscriptSegment[],
): string {
  const paragraphs =
    segments && segments.length > 1
      ? paragraphsFromTimings(segments)
      : paragraphsFromSentences(text);

  return paragraphs.filter((p) => p.length > 0).join("\n\n");
}

/** Break wherever the narrator stopped for longer than a sentence's worth. */
export function paragraphsFromTimings(
  segments: readonly TranscriptSegment[],
): string[] {
  const paragraphs: string[] = [];
  let current: string[] = [];
  let previousEnd: number | null = null;

  for (const segment of segments) {
    const spoken = segment.text.trim();
    if (!spoken) continue;

    const silence =
      previousEnd === null ? 0 : segment.startSecond - previousEnd;

    if (current.length > 0 && silence >= PARAGRAPH_GAP_SECONDS) {
      paragraphs.push(current.join(" "));
      current = [];
    }

    current.push(spoken);
    previousEnd = segment.endSecond;
  }

  if (current.length > 0) paragraphs.push(current.join(" "));
  return paragraphs;
}

/**
 * No timings: group sentences into paragraphs of a readable length.
 *
 * Arbitrary, and honestly so — without the pauses there is nothing in the text
 * that says where a paragraph ended. Four sentences is close to the average for
 * narrative prose, and the writer can move the breaks in the editor, which is
 * far easier than breaking up one unbroken page.
 */
export function paragraphsFromSentences(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    // Split after terminal punctuation, keeping it with the sentence it ends.
    .split(/(?<=[.!?…])\s+/)
    .filter((s) => s.length > 0);

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push(sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(" "));
  }
  return paragraphs;
}
