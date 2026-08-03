import type JSZip from "jszip";
import { COVER_MAX_BYTES, COVER_MAX_EDGE, importImage } from "../image-import";

/**
 * The artwork inside an EPUB, resized to what a browser will hold.
 *
 * Apart from `epub.ts` because it is the one step that needs a canvas: it
 * decodes a picture and re-encodes it, which is a browser doing real work
 * rather than a parser reading a string, and jsdom has neither half. Keeping
 * it here leaves everything in `epub.ts` testable.
 *
 * The budget is the one every other cover in the app is held to
 * (`COVER_MAX_EDGE` / `COVER_MAX_BYTES` — the same numbers the cover dialog
 * passes), because this ends up at the same key, in the same five megabytes,
 * next to covers the writer chose by hand. A book's own artwork arriving at
 * full print resolution would quietly spend a fifth of the origin's storage on
 * pixels nothing ever draws: the shelf renders it about 150px wide.
 */

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * A data URL for the cover at `path`, or null.
 *
 * Null covers every way this can fail — a manifest pointing at an entry that
 * is not in the zip, a format no browser decodes, artwork still too large
 * after resizing — and every one of them is survivable: the book arrives
 * without a cover, which is a state the app already knows how to talk about.
 * Failing the whole import over the picture would be losing a manuscript to
 * save a thumbnail.
 */
export async function epubCover(
  zip: JSZip,
  path: string,
): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;

  const type = TYPES[path.split(".").pop()?.toLowerCase() ?? ""];
  // JSZip hands back a Blob with no type at all, and `importImage` refuses
  // anything that is not declared an image — so the extension has to be turned
  // into a media type here or every cover would be rejected as "not an image".
  if (!type) return null;

  try {
    const blob = await entry.async("blob");
    const file = new File([blob], path.split("/").pop() ?? "cover", { type });
    const result = await importImage(file, {
      maxEdge: COVER_MAX_EDGE,
      maxBytes: COVER_MAX_BYTES,
    });
    return result.ok ? result.src : null;
  } catch {
    return null;
  }
}
