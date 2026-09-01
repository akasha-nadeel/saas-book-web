/**
 * Setting a book's cover, in one place.
 *
 * **Four screens did this by hand and had already drifted.** The new-book form,
 * the cover dialog, the covers tool and the EPUB importer each called
 * `importImage` and `setCover` themselves — and only the dialog also *measured*
 * the artwork, so a writer who set their cover anywhere else left the dashboard
 * with nothing to check and saw no cover findings at all. That reads as the
 * check having passed rather than as never having run.
 *
 * A cover is now three things, and they are only ever written together:
 *
 * - **the thumbnail**, 700px, in `localStorage` — what the shelf renders and
 *   the only one small enough to sync;
 * - **the artwork**, full size, in IndexedDB — what the EPUB packages, so the
 *   file a shop receives is the picture the writer actually made;
 * - **the measurements**, in `localStorage` — what `cover-check.ts` reports,
 *   taken from the *original* rather than from what survived the resize.
 *
 * This lives beside the store rather than inside it because it is async and
 * touches a second backend, and `library-store.ts` earns its rule by being
 * neither. It is the store's `setCover` that remains the one writer of the
 * localStorage keys.
 */

import { setCover, setCoverFacts } from "./library-store";
import { contrastOf } from "./cover-check";
import {
  COVER_MAX_BYTES,
  COVER_MAX_EDGE,
  importImage,
  originalImage,
} from "./image-import";
import {
  deletePrintCover,
  putPrintCover,
  type PrintCover,
} from "./cover-store";

/**
 * The ceiling on the artwork kept for the EPUB.
 *
 * The shops ask for 1600×2560 and nothing is gained by carrying more into a
 * file that has to be downloaded — Amazon's own limit for the packaged image
 * is well under this. A writer's 4000px master is scaled to fit rather than
 * refused, because it is still far better than the 700px thumbnail was.
 */
export const PRINT_MAX_EDGE = 2560;

/**
 * The weight ceiling on that same copy.
 *
 * **A backstop rather than a target, and it is nearly never reached.** A
 * 1600×2560 JPEG at the quality `originalImage` starts from lands around a
 * megabyte, so an ordinary cover is kept exactly as the writer made it. What
 * this stops is the file that used to go through whole: a 25MB export from a
 * design tool, sitting in IndexedDB and then inside the writer's EPUB, where it
 * is a download a reader waits on and a file some readers refuse outright.
 *
 * Four megabytes is deliberately generous — well above what any shop asks for
 * a cover — because the writer's picture is the thing being protected here and
 * the budget only exists to catch the extreme.
 */
export const PRINT_MAX_BYTES = 4_000_000;

export type SaveCoverResult =
  | {
      ok: true;
      /** The thumbnail, for a caller that shows it immediately. */
      src: string;
      /** The size of the artwork kept for the export. */
      width: number;
      height: number;
      /**
       * False when only the thumbnail could be stored — IndexedDB refused, or
       * is unavailable. The cover *is* set and the shelf shows it; the export
       * will package the smaller copy. Worth saying, never worth failing on.
       */
      printStored: boolean;
    }
  | { ok: false; error: string };

/**
 * Take a picked file and make it this book's cover.
 *
 * Returns the same shape whether or not the full-size copy could be kept, so a
 * caller that does not care can ignore `printStored` and still be correct.
 */
export async function saveCover(
  bookId: string,
  file: File,
): Promise<SaveCoverResult> {
  const thumb = await importImage(file, {
    maxEdge: COVER_MAX_EDGE,
    maxBytes: COVER_MAX_BYTES,
    // JPEG, not WebP: this copy is the fallback the EPUB packages when there
    // is no full-size artwork, and a shop's converter should never meet a
    // format it might not take. See `Encoding` in image-import.
    encode: "jpeg",
  });
  if (!thumb.ok) return { ok: false, error: thumb.error };

  if (!setCover(bookId, thumb.src)) {
    return {
      ok: false,
      error:
        "The cover could not be stored — this browser is out of room. The book itself is saved.",
    };
  }

  // Measured from the file the writer picked, never from the thumbnail: the
  // whole point of the check is to report their artwork, and by this line the
  // thumbnail is 700px whatever they started with.
  setCoverFacts(bookId, {
    width: thumb.natural.width,
    height: thumb.natural.height,
    bytes: file.size,
    ...(await contrastFor(file)),
  });

  const full = await originalImage(file, PRINT_MAX_EDGE, PRINT_MAX_BYTES);
  const printStored = full
    ? await putPrintCover(bookId, {
        dataUrl: full.src,
        width: full.width,
        height: full.height,
      })
    : false;

  return {
    ok: true,
    src: thumb.src,
    width: full?.width ?? thumb.natural.width,
    height: full?.height ?? thumb.natural.height,
    printStored,
  };
}

/**
 * Keep an imported book's full-size cover, once the book has an id.
 *
 * The thumbnail rides in through `setupFromImport`, because
 * `createBookFromImport` takes it synchronously and the shelf needs it at
 * once. The copy the export packages has to wait for a book to belong to,
 * which is what the caller has on the line after the book is made and the
 * parser never had.
 *
 * Silent on failure by design: the cover is already set and visible, and what
 * is lost is export resolution rather than the picture.
 */
export async function keepImportedCover(
  bookId: string,
  print: PrintCover | undefined,
): Promise<void> {
  if (print) await putPrintCover(bookId, print);
}

/** Clears all three, so nothing is left pointing at a cover that is gone. */
export async function clearCover(bookId: string): Promise<void> {
  setCover(bookId, null);
  setCoverFacts(bookId, null);
  await deletePrintCover(bookId);
}

/**
 * How much light and dark the artwork has, for the "too flat to see" check.
 *
 * Sampled at 120px wide — the deviation of a picture does not need six million
 * pixels to estimate — and returns nothing rather than a number it could not
 * measure. A canvas tainted by a cross-origin source throws on `getImageData`,
 * and one missing note is a fair price for never inventing the figure.
 */
async function contrastFor(file: File): Promise<{ contrast?: number }> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("unreadable"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = Math.max(
      1,
      Math.round((image.naturalHeight / image.naturalWidth) * 120),
    );
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return {};
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      contrast: contrastOf(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
        4,
      ),
    };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}
