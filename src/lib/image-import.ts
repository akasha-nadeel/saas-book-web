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
 * So every image is downscaled and re-encoded before it goes near the document.
 *
 * **The budgets are met rather than enforced, and that is the 2026-09-01
 * change.** This used to encode once at a fixed quality and *refuse* anything
 * still over the cap — "Still 312KB after resizing — too large to store in the
 * browser. Try a smaller crop." A writer who had done nothing wrong was handed
 * an image editor's job and no way forward, and the picture they wanted was
 * usually two quality points from fitting. Now the encoder walks a ladder until
 * the file fits: **quality first, pixels second**, because blur from
 * over-compression reads worse at these sizes than a slightly smaller picture.
 * The refusal is still down there, at the bottom of both ladders, where no real
 * photograph reaches it.
 */

/** Longest edge, in pixels, after downscaling. */
export const MAX_EDGE = 1400;

/** The budget an encoded picture is brought under. */
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
      /**
       * The pixel size actually stored, after the resize to `maxEdge`.
       *
       * Distinct from `natural` because it is the one the *page* meets: how
       * wide a picture will draw, and so whether it fits the text column, is a
       * fact about the bytes kept rather than about the file chosen. See
       * `insertWidthPercent`, which is the caller that cares.
       *
       * It can now come back smaller than `maxEdge` asked for: a picture that
       * will not fit its budget at any quality is stepped down in size as well.
       * It has always meant "what was kept", so no caller has to change.
       */
      stored: { width: number; height: number };
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

/**
 * Where the encoder starts, per format.
 *
 * The two numbers this module has always used: JPEG at 0.9 because a cover is
 * the one picture a shop looks at first, WebP at 0.82 because it holds detail
 * at a lower figure than JPEG does and rides along in every save.
 */
export const START_QUALITY: Record<Encoding, number> = {
  jpeg: 0.9,
  webp: 0.82,
};

/**
 * How far quality may fall, and in what steps.
 *
 * 0.6 is the floor because below it JPEG ringing shows on type and on the flat
 * grounds most cover artwork is built from — past that point a smaller picture
 * is the honest trade, which is what the edge ladder is for. The step is coarse
 * on purpose: each one is a re-encode, and eight passes to save two kilobytes
 * is a spinner nobody asked for.
 */
export const QUALITY_FLOOR = 0.6;
const QUALITY_STEP = 0.08;

/**
 * How far the picture itself may shrink once quality has bottomed out.
 *
 * 0.85 a step is about half the pixels over three steps, and three is where a
 * 700px cover would be down to 430 — well past anything a real photograph
 * needs, and the point at which the trouble is with the file rather than with
 * the budget.
 */
const EDGE_SHRINK = 0.85;
const EDGE_STEPS = 3;

/**
 * Every encode to try, in order, best first.
 *
 * Pure, so the policy can be read and tested without a canvas. Quality is
 * walked all the way down at each size before the size is touched, and the
 * quality ladder **restarts from the top after a shrink** — a smaller picture
 * at 0.9 both weighs less and looks better than a larger one at 0.6, so
 * carrying the low quality forward would throw away the gain the shrink just
 * bought.
 *
 * The first attempt is the one every ordinary file uses; the rest exist so that
 * nothing is ever refused for being large.
 */
export function encodeAttempts(
  maxEdge: number,
  startQuality: number,
): { edge: number; quality: number }[] {
  const attempts: { edge: number; quality: number }[] = [];
  let edge = Math.max(1, Math.round(maxEdge));

  for (let step = 0; step <= EDGE_STEPS; step++) {
    let last = startQuality;
    for (
      let quality = startQuality;
      quality >= QUALITY_FLOOR - 0.001;
      quality -= QUALITY_STEP
    ) {
      // Rounded, or floating-point drift puts 0.74 through the encoder as
      // 0.7400000000000001 and the ladder stops being readable in a log.
      last = Math.round(quality * 100) / 100;
      attempts.push({ edge, quality: last });
    }
    /* The floor, when the step does not land on it. From 0.9 the ladder
       reaches 0.66 and then falls short of 0.6 by two hundredths, so without
       this the last rung before a shrink is a quality the module says is
       allowed and never actually tries. */
    if (last > QUALITY_FLOOR) attempts.push({ edge, quality: QUALITY_FLOOR });

    edge = Math.max(1, Math.round(edge * EDGE_SHRINK));
  }

  return attempts;
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
 * A decoded picture, and the two things this module does with one.
 *
 * `release` is why this exists rather than an `HTMLImageElement` passed around.
 * A 50-megapixel photograph is about 200MB decoded, and a DOM image hands that
 * back to the collector whenever it feels like it — which on a phone, halfway
 * through a re-encode, is too late. An `ImageBitmap` is closed the moment we
 * are done with it.
 */
interface Decoded {
  width: number;
  height: number;
  draw: (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => void;
  release: () => void;
}

/**
 * Decode a picked file, by the best route the browser offers.
 *
 * `createImageBitmap` first: it decodes off the main thread, so a big file does
 * not freeze the page while it is read, and it takes
 * **`imageOrientation: "from-image"`** — which is the whole reason a phone
 * photograph comes out upright. `drawImage` from a bitmap ignores EXIF rotation
 * otherwise, and a sideways cover is the kind of bug a writer blames themselves
 * for.
 *
 * The `<img>` path stays underneath for browsers without the API, and for the
 * ones that have it and refuse a particular file — hence a try/catch around the
 * fast path rather than a feature test alone.
 */
async function decode(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (context, width, height) =>
          context.drawImage(bitmap, 0, 0, width, height),
        release: () => bitmap.close(),
      };
    } catch {
      // Fall through rather than fail: a browser that refuses a file here has
      // often opened the same one as an <img>.
    }
  }

  try {
    const img = await loadImage(file);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (context, width, height) =>
        context.drawImage(img, 0, 0, width, height),
      release: () => {},
    };
  } catch {
    return null;
  }
}

/**
 * A cover is rendered about 150px wide on the shelf, so it needs a fraction of
 * what an inline illustration does. Every book carries one, and they all share
 * the same few megabytes of origin storage — and unlike the artwork kept for
 * the export, this copy is *synced*, which is what sets the budget.
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

  const source = await decode(file);
  if (!source) return { ok: false, error: "That image couldn’t be read." };

  const natural = { width: source.width, height: source.height };

  /*
   * WebP where it is asked for and available, JPEG otherwise.
   *
   * PNG is never offered: a photograph as PNG is several times larger for no
   * visible gain, and this is a strict storage budget. The fallback is not
   * hypothetical — `toDataURL` returns a PNG data URL for a type the browser
   * cannot encode, which is why the result is *checked* rather than trusted.
   * Once it has answered wrong the type is switched for good, so the rest of
   * the ladder is not spent asking the same question over again.
   */
  let type = encode === "webp" ? "image/webp" : "image/jpeg";

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    source.release();
    return { ok: false, error: "That image couldn’t be resized." };
  }

  let drawn = "";
  let last: { bytes: number } | null = null;

  try {
    for (const attempt of encodeAttempts(maxEdge, START_QUALITY[encode])) {
      const size = targetSize(natural.width, natural.height, attempt.edge);

      /* Redrawn only when the size actually moves. The quality ladder is four
         re-encodes of one canvas, and rescaling between them would be three
         resamples of the same picture for nothing. */
      const key = `${size.width}x${size.height}`;
      if (key !== drawn) {
        canvas.width = size.width;
        canvas.height = size.height;
        source.draw(context, size.width, size.height);
        drawn = key;
      }

      let src = canvas.toDataURL(type, attempt.quality);
      if (type === "image/webp" && !src.startsWith("data:image/webp")) {
        type = "image/jpeg";
        src = canvas.toDataURL(type, attempt.quality);
      }

      const bytes = dataUrlBytes(src);
      last = { bytes };
      if (bytes <= maxBytes) {
        return { ok: true, src, bytes, natural, stored: size };
      }
    }
  } finally {
    source.release();
  }

  /* The bottom of both ladders. A 700px picture at 0.6 does not reach 250KB, so
     getting here means something is wrong with the file rather than with its
     size — and the writer still gets a figure and something to do about it. */
  return {
    ok: false,
    error: `Still ${describeBytes(last?.bytes ?? 0)} after resizing — too large to store in the browser. Try a smaller crop.`,
  };
}

/**
 * A picked file as a data URL, at the size and weight the export wants.
 *
 * For the cover's full-size copy, which goes into the EPUB: re-encoding artwork
 * somebody has already exported at the size a shop asks for can only lose
 * something, and the storage that holds it is measured in hundreds of megabytes
 * rather than five. So the writer's own bytes are kept when the format is one
 * an EPUB can carry and the file is already inside both budgets; only a format
 * EPUB will not take — WebP has patchy converter support, and anything exotic —
 * or a file over one of them is re-encoded.
 *
 * **`maxBytes` is a backstop, not a target.** A 2560px cover encodes at around
 * a megabyte, so an ordinary file never meets the ladder at all. What it stops
 * is a 25MB master going whole into somebody's EPUB, where it is a download a
 * reader waits on and a file some readers refuse.
 *
 * Reads the pixel size too, because the caller needs it and has the image
 * decoded anyway.
 */
export async function originalImage(
  file: File,
  maxEdge: number,
  maxBytes: number,
): Promise<{ src: string; width: number; height: number } | null> {
  const source = await decode(file);
  if (!source) return null;

  const natural = { width: source.width, height: source.height };
  const keepAsIs =
    (file.type === "image/jpeg" || file.type === "image/png") &&
    Math.max(natural.width, natural.height) <= maxEdge &&
    file.size <= maxBytes;

  if (keepAsIs) {
    source.release();
    const src = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (src) return { src, width: natural.width, height: natural.height };
    return null;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    source.release();
    return null;
  }

  let drawn = "";
  let last: { src: string; width: number; height: number } | null = null;

  try {
    /* The same ladder the thumbnail walks, started higher: this copy is the one
       a shop receives, so it gives quality up later and more grudgingly. */
    for (const attempt of encodeAttempts(maxEdge, 0.92)) {
      const size = targetSize(natural.width, natural.height, attempt.edge);

      const key = `${size.width}x${size.height}`;
      if (key !== drawn) {
        canvas.width = size.width;
        canvas.height = size.height;
        // A transparent PNG re-encoded to JPEG goes black where it was clear,
        // which on a cover is the whole background. White is what paper is.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size.width, size.height);
        source.draw(context, size.width, size.height);
        drawn = key;
      }

      const src = canvas.toDataURL("image/jpeg", attempt.quality);
      last = { src, width: size.width, height: size.height };
      if (dataUrlBytes(src) <= maxBytes) return last;
    }
  } finally {
    source.release();
  }

  /* Whatever the smallest attempt produced. There is no refusal on this path,
     unlike the thumbnail's: the cover is already set and the shelf is showing
     it, and heavy artwork is a slower export rather than a broken one. */
  return last;
}
