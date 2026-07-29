import { toBlocks, type Block, type LoadedChapter } from "./blocks";
import { download } from "./index";
import { speechChunks, trackName } from "./narrate";

/**
 * A book, read aloud, as one MP3 per chapter in a zip.
 *
 * A track per chapter rather than a single file for the whole book, for two
 * reasons. It is how audiobooks are actually shipped — a listener resumes at a
 * chapter, not at a byte offset. And stitching hundreds of separately-generated
 * MP3 fragments into one continuous file is fragile; keeping the joins inside a
 * chapter, where the reader's voice and settings are unchanged, is where naive
 * concatenation is safe.
 *
 * The work is driven from the client so a forty-chapter book is forty visible
 * steps. One request for a whole book would either succeed after many minutes
 * or fail having produced nothing, with no way to say how far it had got.
 */

/** Reported as each chunk lands, so the dialog can show real progress. */
export interface NarrationProgress {
  chapter: number;
  chapters: number;
  chapterTitle: string;
  chunk: number;
  chunks: number;
}

export class NarrationError extends Error {}

/**
 * Prose as a narrator should receive it: no markdown, no list bullets, no
 * heading marks. Those are typography, and a speech model reads them aloud.
 */
export function blocksToSpeech(blocks: readonly Block[]): string {
  const paragraphs: string[] = [];

  for (const block of blocks) {
    // An image has no words, and a scene break is a mark on the page rather
    // than something to say. Both would otherwise contribute an empty line.
    if (block.kind === "image" || block.kind === "sceneBreak") continue;

    const text = block.runs
      .map((run) => run.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    if (text) paragraphs.push(text);
  }

  return paragraphs.join("\n\n");
}

async function narrate(text: string, voice: string): Promise<Uint8Array> {
  const response = await fetch("/api/narrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new NarrationError(
      payload?.error ?? "The narrator could not read that passage.",
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Reads a whole book and hands back a zip.
 *
 * `onProgress` is called before each request rather than after, so the label
 * describes what is happening now rather than what has just finished.
 */
export async function exportAudiobook(
  title: string,
  chapters: readonly LoadedChapter[],
  voice: string,
  onProgress: (progress: NarrationProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Dynamic, as the other heavy exporters are: a writer who never makes an
  // audiobook never downloads the zip library.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  let written = 0;

  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i];
    const chunks = speechChunks(blocksToSpeech(toBlocks(chapter.doc)));

    // A chapter with no prose produces no track rather than a moment of
    // silence a listener has to skip.
    if (chunks.length === 0) continue;

    const parts: Uint8Array[] = [];
    for (let c = 0; c < chunks.length; c += 1) {
      if (signal?.aborted) throw new NarrationError("Stopped.");

      onProgress({
        chapter: i + 1,
        chapters: chapters.length,
        chapterTitle: chapter.title,
        chunk: c + 1,
        chunks: chunks.length,
      });

      parts.push(await narrate(chunks[c], voice));
    }

    zip.file(trackName(i, chapters.length, chapter.title), concat(parts));
    written += 1;
  }

  if (written === 0) {
    throw new NarrationError("There is nothing written to read aloud yet.");
  }

  const blob = await zip.generateAsync({ type: "blob" });
  download(blob, `${title || "Audiobook"} (audiobook).zip`);
}

/** One chapter's fragments end to end. */
function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
