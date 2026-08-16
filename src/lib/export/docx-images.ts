/**
 * Pictures, for the Word file.
 *
 * **A Word export that loses the pictures is the failure this app measures
 * other tools by.** Until now the DOCX writer put the italic words `[image]`
 * where a picture was — a visible marker rather than a silent hole, which was
 * the right instinct and the wrong resting place: a writer sending a
 * manuscript to an agent sends it without the illustrations, and finds out
 * from the agent. Scrivener's markdown export does the same thing and it is
 * the reason nobody recommends it for a book with pictures in it.
 *
 * Two things make this less simple than it looks.
 *
 * **Word does not take WebP, and WebP is what this app stores.** Inline
 * pictures are encoded as WebP on import (see `image-import.ts`, where the
 * saving inside a manuscript is worth having and no shop has objected), while
 * `docx` will only package `jpg`, `png`, `gif` or `bmp`. So anything that is
 * not already a format Word knows is drawn onto a canvas and re-encoded as
 * PNG. Lossless, because the alternative is re-compressing somebody's artwork
 * a second time on the way out.
 *
 * **A DOCX image carries its size in pixels, not a percentage.** The editor
 * stores a width as a share of the column, because that is the only thing that
 * survives a change of trim size — so the share has to be resolved against the
 * real column here. `fitImage` is that arithmetic and is pure, which is the
 * half worth testing; the decoding needs a browser and is not.
 */

/**
 * The text column, in CSS pixels at 96dpi.
 *
 * US Letter at the one-inch margins `buildDocx` sets for manuscript format,
 * which is also Word's own default — so this holds for both of its modes.
 */
export const COLUMN_PX = 624;

export interface DocxImage {
  data: Uint8Array;
  /** Narrowed to what `docx` will package. */
  type: "png" | "jpg";
  width: number;
  height: number;
}

/**
 * How big the picture goes in the file.
 *
 * A stored width is a percentage of the column (`resizable-image.ts`), so it
 * is resolved against the real column here. With none, the picture goes at its
 * own size — capped at the column, or Word silently pushes it past the margin
 * and the manuscript comes out with a picture running off the paper.
 *
 * The ratio is always the picture's own: a width is honoured and a height is
 * never taken from the writer, because the two together are how a picture gets
 * squashed.
 */
export function fitImage(
  natural: { width: number; height: number },
  requested: string | undefined,
  column: number = COLUMN_PX,
): { width: number; height: number } {
  if (natural.width <= 0 || natural.height <= 0) {
    return { width: 0, height: 0 };
  }

  const share = requested?.trim().match(/^(\d+(?:\.\d+)?)%$/);
  const asked = share ? (column * Number(share[1])) / 100 : natural.width;

  const width = Math.max(1, Math.round(Math.min(asked, column)));
  return {
    width,
    height: Math.max(1, Math.round((width * natural.height) / natural.width)),
  };
}

/** What `docx` can package as-is, by the blob type a browser reports. */
const READY: Record<string, "png" | "jpg"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "png", // an animated GIF is one frame in a manuscript anyway
  "image/bmp": "png",
};

/**
 * Decode every distinct picture in the book once.
 *
 * Keyed by `src`, so an ornament used in forty chapters is decoded once and
 * packaged once — the same reasoning `epub-images.ts` de-duplicates on.
 *
 * **Every failure resolves rather than throws.** A picture that will not decode
 * leaves no entry, and the writer gets the `[image]` marker for that one rather
 * than an export that died. Losing one picture is survivable; losing the
 * manuscript is not.
 */
export async function resolveImages(
  srcs: Iterable<string>,
): Promise<Map<string, DocxImage>> {
  const out = new Map<string, DocxImage>();

  await Promise.all(
    [...new Set(srcs)].map(async (src) => {
      try {
        const blob = await (await fetch(src)).blob();
        const bitmap = await createImageBitmap(blob);
        const ready = READY[blob.type];

        let bytes = blob;
        let type: "png" | "jpg" = ready === "jpg" ? "jpg" : "png";

        if (blob.type !== "image/png" && blob.type !== "image/jpeg") {
          // WebP and anything else Word will not open: redrawn as PNG rather
          // than re-compressed, so nobody's artwork loses a second generation.
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
          const png = await new Promise<Blob | null>((done) =>
            canvas.toBlob(done, "image/png"),
          );
          if (!png) return;
          bytes = png;
          type = "png";
        }

        out.set(src, {
          data: new Uint8Array(await bytes.arrayBuffer()),
          type,
          width: bitmap.width,
          height: bitmap.height,
        });
      } catch {
        // No entry: the marker stands in for this one.
      }
    }),
  );

  return out;
}
