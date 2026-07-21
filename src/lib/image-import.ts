/**
 * Turning a picked file into something the manuscript can hold.
 *
 * The whole app lives in localStorage, which browsers cap at roughly 5MB per
 * origin — for the entire library, not per book. A single phone photo is 3–5MB
 * before base64 inflates it by a third, so embedding one unchanged would fill
 * the quota and start failing autosaves on every chapter, not just this one.
 *
 * So every image is downscaled and re-encoded before it goes near the document,
 * and one that is still too big afterwards is refused with a reason rather than
 * quietly breaking saves later.
 */

/** Longest edge, in pixels, after downscaling. */
export const MAX_EDGE = 1400;

/** Refuse anything still larger than this once encoded. */
export const MAX_BYTES = 900_000;

export const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";

export type ImportResult =
  | { ok: true; src: string; bytes: number }
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

export async function importImage(file: File): Promise<ImportResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "That file isn’t an image." };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, error: "That image couldn’t be read." };
  }

  const size = targetSize(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) return { ok: false, error: "That image couldn’t be resized." };
  context.drawImage(img, 0, 0, size.width, size.height);

  // WebP where it is available, JPEG otherwise. PNG is not offered: a
  // photograph as PNG is several times larger for no visible gain, and this is
  // a strict storage budget.
  let src = canvas.toDataURL("image/webp", 0.82);
  if (!src.startsWith("data:image/webp")) {
    src = canvas.toDataURL("image/jpeg", 0.82);
  }

  const bytes = dataUrlBytes(src);
  if (bytes > MAX_BYTES) {
    return {
      ok: false,
      error: `Still ${describeBytes(bytes)} after resizing — too large to store in the browser. Try a smaller crop.`,
    };
  }

  return { ok: true, src, bytes };
}
