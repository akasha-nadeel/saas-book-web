import type { Block } from "./blocks";

/**
 * Pictures re-encoded into something an EPUB is allowed to carry.
 *
 * **WebP is not an EPUB core media type, and shipping it is why a book's
 * illustrations were invisible.** `image-import.ts` stores an inline picture as
 * WebP — the right call for the browser, where the size saving is real and the
 * budget is shared — and the EPUB packaged those bytes straight through, with
 * `media-type="image/webp"` in the manifest and no fallback. EPUB 3 names four
 * image types a reading system must understand (GIF, JPEG, PNG, SVG); anything
 * else is a *foreign resource* and needs a fallback nobody supplied. Measured on
 * a real export: the JPEG cover drew and all four inline pictures were blank,
 * because the reader was under no obligation to decode them.
 *
 * So they are converted here, on the way into the package. Two things follow
 * from doing it at *export* rather than at import:
 *
 * - **Books that already exist are fixed.** Changing what the editor stores
 *   would only help pictures added afterwards, and every manuscript written
 *   before today would go on exporting blank illustrations.
 * - **The manuscript keeps its own storage rule.** A WebP is a third smaller
 *   than the JPEG of it, and inside a browser origin that matters; inside a zip
 *   that is downloaded once it does not. The two questions get the two answers
 *   they deserve.
 *
 * What is *not* done here is guessing. A picture this cannot decode is left
 * exactly as it was, so `packageable` drops it and `undecodableImages` counts
 * it — the writer is told by the pre-upload check rather than by the shop.
 */

/**
 * The image types EPUB 3 requires a reading system to support.
 *
 * The one list, and `epub-images.ts` reads it too — a second copy is how the
 * packager and the recoder come to disagree about what needs converting.
 */
export const EPUB_CORE_IMAGE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
];

/** Whether the package may carry this media type with no fallback. */
export function isCoreImageType(mediaType: string): boolean {
  return EPUB_CORE_IMAGE_TYPES.includes(mediaType.toLowerCase());
}

/** The media type of a `data:` URL, lower-cased, or null if it is not one. */
export function dataUrlType(src: string): string | null {
  const match = /^data:([^;,]+)/.exec(src);
  return match ? match[1].toLowerCase() : null;
}

/** Whether this src is a data URL of a type the package cannot carry as-is. */
export function needsRecoding(src: string): boolean {
  const type = dataUrlType(src);
  return type !== null && !isCoreImageType(type);
}

/**
 * How long to wait for one picture to decode before giving up on it.
 *
 * **There is no network here** — a data URL is bytes already in hand — so this
 * is not a patience setting, it is a guarantee that the export finishes. An
 * `Image` promises to fire `load` or `error`, and an environment that fires
 * neither leaves the promise pending for ever, which would hang `buildEpub`
 * with no error and no file. Losing one illustration is a cost; an export that
 * never returns is the writer losing the book.
 */
const DECODE_MS = 5000;

function loadDataUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error("decode timed out")), DECODE_MS);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("could not decode"));
    };
    img.src = src;
  });
}

/**
 * Whether any pixel is less than opaque.
 *
 * **This decides PNG against JPEG, and getting it wrong is visible either way.**
 * JPEG has no alpha channel, so a logo with a transparent ground comes out on a
 * black box; PNG keeps it, and costs several times the bytes on a photograph
 * that never needed it. A book's pictures are few enough to simply look.
 *
 * Any failure reads as "has alpha", because PNG is the answer that cannot lose
 * information — a larger file beats a ruined picture.
 */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return true;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * One picture, re-encoded into a core type — or returned untouched.
 *
 * Untouched rather than thrown on purpose: a picture that cannot be converted
 * is one `packageable` will refuse, which drops it from the file and counts it
 * for the readiness check. That is the path this app already takes for a
 * picture it cannot carry, and adding a second, louder one here would mean an
 * export that fails outright over one broken illustration.
 */
export async function recodeDataUrl(src: string): Promise<string> {
  if (!needsRecoding(src)) return src;
  if (typeof document === "undefined") return src;

  try {
    /* The canvas is asked for *before* the picture is decoded, because an
       environment with no 2D context cannot convert anything and there is no
       point waiting on an image to find that out. It is also what keeps this
       fast where there is no decoder at all. */
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return src;

    const img = await loadDataUrl(src);
    // A decoded picture with no size is one the browser did not really read.
    if (!img.naturalWidth || !img.naturalHeight) return src;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    context.drawImage(img, 0, 0);

    /* Quality 0.92 rather than the 0.82 the editor stores at: this is a
       re-encode of something already lossy, and compressing it a second time at
       the same setting is where the artefacts become visible. */
    const out = hasTransparency(canvas)
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", 0.92);

    // `toDataURL` answers with a PNG for a type it cannot encode, so the result
    // is checked rather than trusted — the same guard `importImage` carries.
    return needsRecoding(out) ? src : out;
  } catch {
    return src;
  }
}

/**
 * Every picture in the book, converted once.
 *
 * Cached on the data URL, because a scene-break ornament repeated across forty
 * chapters is one picture and forty blocks — the same de-duplication
 * `extractImages` does with its `seen` map, done a step earlier so the encoding
 * work is not repeated either.
 */
export async function recodeBlocks(chapters: Block[][]): Promise<Block[][]> {
  const done = new Map<string, string>();

  for (const blocks of chapters) {
    for (const block of blocks) {
      if (block.kind !== "image" || !block.src) continue;
      if (!needsRecoding(block.src) || done.has(block.src)) continue;
      done.set(block.src, await recodeDataUrl(block.src));
    }
  }

  if (done.size === 0) return chapters;

  return chapters.map((blocks) =>
    blocks.map((block) => {
      if (block.kind !== "image" || !block.src) return block;
      const out = done.get(block.src);
      return out && out !== block.src ? { ...block, src: out } : block;
    }),
  );
}
