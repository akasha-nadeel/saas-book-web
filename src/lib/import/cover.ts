import type JSZip from "jszip";
import {
  COVER_MAX_BYTES,
  COVER_MAX_EDGE,
  importImage,
  originalImage,
} from "../image-import";
import { PRINT_MAX_BYTES, PRINT_MAX_EDGE } from "../cover-save";
import type { PrintCover } from "../cover-store";

/**
 * The artwork inside an EPUB, resized to what a browser will hold.
 *
 * Apart from `epub.ts` because it is the one step that needs a canvas: it
 * decodes a picture and re-encodes it, which is a browser doing real work
 * rather than a parser reading a string, and jsdom has neither half. Keeping
 * it here leaves everything in `epub.ts` testable.
 *
 * **Two copies come out, for the two jobs.** The thumbnail is held to the
 * budget every other cover is (`COVER_MAX_EDGE` / `COVER_MAX_BYTES` — the same
 * numbers the cover dialog passes), because it lands in the same store as
 * covers chosen by hand and is *synced*, and the shelf renders it about 150px
 * wide. The full-size copy goes to IndexedDB, where a few hundred
 * kilobytes cost nothing, because it is what the *next* export packages — an
 * imported book whose cover arrived at 1600×2560 and left at 495×700 is the
 * same silent downgrade this whole change exists to stop.
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
): Promise<{ thumb: string; print: PrintCover | null } | null> {
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
      // JPEG for the same reason the cover dialog uses it: this copy is what
      // the export falls back to, and a shop's converter should never have to
      // take a format it might not know.
      encode: "jpeg",
    });
    if (!result.ok) return null;

    const full = await originalImage(file, PRINT_MAX_EDGE, PRINT_MAX_BYTES);
    return {
      thumb: result.src,
      print: full
        ? { dataUrl: full.src, width: full.width, height: full.height }
        : null,
    };
  } catch {
    return null;
  }
}
