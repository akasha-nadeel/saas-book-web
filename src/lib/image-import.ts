/**
 * Turning a picked file into something the manuscript can hold.
 *
 * A picture goes *inside* the chapter, as a data URL in the Tiptap document —
 * so it is carried by every save of that chapter, sent up on every sync, and
 * packaged into every export. A single phone photo is 3–5MB before base64
 * inflates it by a third.
 *
 * **That was a quota argument and is now a weight argument.** The manuscript
 * moved off `localStorage`'s five megabytes onto IndexedDB in 2026-08-17, so an
 * unshrunk photo no longer threatens autosaves on unrelated chapters. What it
 * still does is make the chapter slow to save, slow to sync and heavy in the
 * finished file a reader downloads — and a 4000px photograph in a book set at
 * 6×9 is carrying about eight times the pixels the page can print.
 *
 * So every image is downscaled and re-encoded before it goes near the document,
 * and one that is still too big afterwards is refused with a reason.
 */

/** Longest edge, in pixels, after downscaling. */
export const MAX_EDGE = 1400;

/** Refuse anything still larger than this once encoded. */
export const MAX_BYTES = 900_000;

export const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";

/**
 * What to re-encode as, when a resize forces a re-encode at all.
 *
 * **WebP is right inside the manuscript and wrong on a cover.** An inline
 * illustration rides along in every save, every sync and every exported file,
 * and WebP is meaningfully smaller at the same quality; no shop has ever
 * objected to one.
 * A cover is different: it is the single image a shop's converter looks at
 * first, and while WebP is a legal EPUB 3 core media type, KDP's pipeline is
 * not a safe bet for it. One cover per book is not where bytes are won.
 */
export type Encoding = "webp" | "jpeg";

export type ImportResult =
  | {
      ok: true;
      src: string;
      bytes: number;
      /** The pixel size of the file the writer picked, before any resize. */
      natural: { width: number; height: number };
    }
  | { ok: false; error: string };

/**
 * Fit within MAX_EDGE without distorting or upscaling.
 * Pure, and the part most worth testing.
 */
export function targetSize(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };

  const scale = maxEdge / longest;
  return {
    // Round rather than floor: flooring a 1-pixel-tall image gives zero, and a
    // zero-sized canvas throws.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Rough byte length of a data URL's payload, without decoding it. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return 0;
  const payload = dataUrl.length - comma - 1;
  const padding = dataUrl.endsWith("==") ? 2 : dataUrl.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload * 3) / 4) - padding);
}

export function describeBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1000))}KB`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not decode"));
    };
    img.src = url;
  });
}

/**
 * A cover is rendered about 150px wide on the shelf, so it needs a fraction of
 * what an inline illustration does. Every book carries one, and they all share
 * the same few megabytes of origin storage.
 */
export const COVER_MAX_EDGE = 700;
export const COVER_MAX_BYTES = 250_000;

export async function importImage(
  file: File,
  limits: { maxEdge?: number; maxBytes?: number; encode?: Encoding } = {},
): Promise<ImportResult> {
  const maxEdge = limits.maxEdge ?? MAX_EDGE;
  const maxBytes = limits.maxBytes ?? MAX_BYTES;
  const encode = limits.encode ?? "webp";

  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "That file isn’t an image." };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, error: "That image couldn’t be read." };
  }

  const size = targetSize(img.naturalWidth, img.naturalHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) return { ok: false, error: "That image couldn’t be resized." };
  context.drawImage(img, 0, 0, size.width, size.height);

  /*
   * WebP where it is asked for and available, JPEG otherwise.
   *
   * PNG is never offered: a photograph as PNG is several times larger for no
   * visible gain, and this is a strict storage budget. The fallback is not
   * hypothetical — `toDataURL` returns a PNG data URL for a type the browser
   * cannot encode, which is why the result is *checked* rather than trusted.
   */
  let src =
    encode === "webp"
      ? canvas.toDataURL("image/webp", 0.82)
      : canvas.toDataURL("image/jpeg", 0.9);
  if (encode === "webp" && !src.startsWith("data:image/webp")) {
    src = canvas.toDataURL("image/jpeg", 0.82);
  }

  const bytes = dataUrlBytes(src);
  if (bytes > maxBytes) {
    return {
      ok: false,
      error: `Still ${describeBytes(bytes)} after resizing — too large to store in the browser. Try a smaller crop.`,
    };
  }

  return {
    ok: true,
    src,
    bytes,
    natural: { width: img.naturalWidth, height: img.naturalHeight },
  };
}

/**
 * A picked file as a data URL, unchanged.
 *
 * For the cover's full-size copy, which goes into the EPUB: re-encoding
 * artwork somebody has already exported at the size a shop asks for can only
 * lose something, and the storage that holds it is measured in hundreds of
 * megabytes rather than five. So the writer's own bytes are kept when the
 * format is one an EPUB can carry, and only a format EPUB will not take —
 * WebP has patchy converter support, and anything exotic — is re-encoded.
 *
 * Reads the pixel size too, because the caller needs it and has the image
 * decoded anyway.
 */
export async function originalImage(
  file: File,
  maxEdge: number,
): Promise<
  { src: string; width: number; height: number } | null
> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return null;
  }

  const keepAsIs =
    (file.type === "image/jpeg" || file.type === "image/png") &&
    Math.max(img.naturalWidth, img.naturalHeight) <= maxEdge;

  if (keepAsIs) {
    const src = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (src) {
      return { src, width: img.naturalWidth, height: img.naturalHeight };
    }
  }

  // Anything else: down to the ceiling if it is over it, and out as JPEG.
  const size = targetSize(img.naturalWidth, img.naturalHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // A transparent PNG re-encoded to JPEG goes black where it was clear, which
  // on a cover is the whole background. White is what paper is.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(img, 0, 0, size.width, size.height);

  return {
    src: canvas.toDataURL("image/jpeg", 0.92),
    width: size.width,
    height: size.height,
  };
}
