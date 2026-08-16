import type { Block } from "./blocks";

/**
 * Inline images, lifted out of the prose and into the package.
 *
 * The editor stores an inline image as a `data:` URL (see lib/image-import),
 * which is right for `localStorage` and wasteful in an EPUB. Two costs, and
 * neither is validity — EPUBCheck 5.3 passes a `data:` src without complaint,
 * which was checked rather than assumed:
 *
 *   - **Size.** base64 is a third larger than the bytes it encodes, and it sits
 *     inside XHTML where it compresses far worse than the image would on its
 *     own.
 *   - **Repetition.** A data URL is copied in full at every use. A scene-break
 *     ornament across forty chapters is forty copies; as a package resource it
 *     is one file referenced forty times.
 *
 * So the data URLs come out here: each becomes a real entry under
 * `OEBPS/images/`, listed in the manifest, and the block's `src` is rewritten to
 * the relative path. This is also the shape every EPUB produced by a real
 * typesetting tool has, which is worth something on its own when a shop's
 * converter — not the validator — is the thing reading the file.
 *
 * Kept separate from `epub.ts` and pure, so the parsing — the part with the
 * edge cases — is testable without building a zip.
 */

/** An image on its way into the package. */
export interface PackagedImage {
  /** Manifest id, e.g. `img-01`. */
  id: string;
  /** Path inside OEBPS, e.g. `images/img-01.jpeg`. */
  href: string;
  /** For the manifest's media-type. */
  mediaType: string;
  /** The decoded bytes, ready for the zip. */
  bytes: Uint8Array;
}

/**
 * The image types EPUB 3 defines as core media types. Anything else has to be
 * declared with a fallback, which is more machinery than an inline illustration
 * is worth — an unrecognised type is dropped instead, and the prose survives.
 */
const CORE_TYPES: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

/** `data:image/png;base64,iVBOR…` → the type and the payload. */
function parseDataUrl(
  src: string,
): { mediaType: string; base64: string } | null {
  // [\s\S] rather than `.` with the /s flag: base64 payloads are routinely
  // wrapped across lines, and the flag needs a newer target than this builds to.
  const match = /^data:([^;,]+)(;[^,]*)?,([\s\S]*)$/.exec(src);
  if (!match) return null;

  const mediaType = match[1].toLowerCase();
  // Only base64 payloads. A percent-encoded data URL is legal and vanishingly
  // rare here — the editor never writes one — and guessing wrong would put
  // corrupt bytes in the package rather than no bytes.
  if (!/;base64/i.test(match[2] ?? "")) return null;
  if (!CORE_TYPES[mediaType]) return null;

  return { mediaType, base64: match[3] };
}

export function decodeBase64(base64: string): Uint8Array | null {
  // Whitespace is legal inside base64 and atob refuses it.
  const clean = base64.replace(/\s+/g, "");
  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    // A truncated image is one that was already broken on the page. Dropping it
    // loses a picture; failing the export loses the book.
    return null;
  }
}

export interface ExtractedImages {
  /** The blocks with every extractable `src` rewritten to its package path. */
  blocks: Block[][];
  /** The files to write, in manifest order. */
  images: PackagedImage[];
}

/**
 * Rewrites each chapter's image blocks to point at package resources.
 *
 * Takes every chapter at once rather than one at a time, because the point of
 * de-duplication is across the book: the same ornament in chapter 2 and chapter
 * 30 has to resolve to the same file, and a per-chapter pass cannot know that.
 *
 * An image that cannot be decoded keeps its original `src` rather than being
 * dropped: a picture that still renders from its data URL beats a gap where the
 * writer put one. `storeReadiness` in publishing.ts reports the count, because
 * an image these cannot read is usually one that was already broken on the page.
 */
export function extractImages(chapters: Block[][]): ExtractedImages {
  const images: PackagedImage[] = [];
  /** data URL → href, so a repeated image is stored once. */
  const seen = new Map<string, string>();

  const blocks = chapters.map((chapterBlocks) =>
    chapterBlocks.map((block) => {
      if (block.kind !== "image" || !block.src) return block;
      // Already a package path, or a remote image the writer pointed at.
      if (!block.src.startsWith("data:")) return block;

      const existing = seen.get(block.src);
      if (existing) return { ...block, src: existing };

      const parsed = parseDataUrl(block.src);
      if (!parsed) return block;
      const bytes = decodeBase64(parsed.base64);
      if (!bytes) return block;

      const id = `img-${String(images.length + 1).padStart(2, "0")}`;
      const href = `images/${id}.${CORE_TYPES[parsed.mediaType]}`;
      images.push({ id, href, mediaType: parsed.mediaType, bytes });
      seen.set(block.src, href);

      // The chapters sit at the root of OEBPS beside `images/`, so the relative
      // path from a chapter file is the href unchanged.
      return { ...block, src: href };
    }),
  );

  return { blocks, images };
}

/**
 * The book's cover, as a package resource.
 *
 * Its own function rather than a pass through `extractImages`, because the cover
 * is not in the prose and needs a fixed id: `cover-image` is what the manifest's
 * `properties="cover-image"` and the EPUB 2 `<meta name="cover">` both point at,
 * and a reader that understands only one of the two still finds the artwork.
 *
 * Returns null for a cover that is missing or in a format EPUB will not carry,
 * which the readiness check reports rather than the export failing on.
 */
export function packageCover(dataUrl: string | null): PackagedImage | null {
  if (!dataUrl) return null;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const bytes = decodeBase64(parsed.base64);
  if (!bytes) return null;

  return {
    id: "cover-image",
    href: `images/cover.${CORE_TYPES[parsed.mediaType]}`,
    mediaType: parsed.mediaType,
    bytes,
  };
}

/**
 * Whether this picture can become a resource inside the package.
 *
 * **The one answer three places need, and they must not each work it out.**
 * `buildEpub` drops what it cannot carry, `storeReadiness` counts the same
 * pictures so the writer is told, and the export wizard's EPUB preview has to
 * show the file rather than a hopeful version of it — a preview that draws a
 * picture the file omits is a preview lying about the one thing it exists to
 * check.
 *
 * Three ways a picture fails, and only the first used to be noticed:
 *
 *   - a data URL whose base64 will not decode;
 *   - a data URL of a media type EPUB has no core support for, which is
 *     `ERROR(RSC-032) Fallback must be provided for foreign resources`;
 *   - a `src` on the open internet, which is `ERROR(RSC-006) Remote resource
 *     reference is not allowed in this context`. Not fixable by declaring
 *     anything: EPUB 3.3 permits remote audio, video and fonts, never a remote
 *     `<img>`.
 *
 * It decodes rather than sniffing the header, because a corrupt payload of a
 * *core* type would otherwise pass here and fail in `extractImages`, leaving an
 * `<img>` pointing at a file nothing wrote. Books hold a handful of pictures
 * and zipping them costs far more than reading them twice.
 */
export function packageable(block: Block): boolean {
  if (block.kind !== "image" || !block.src) return false;
  const parsed = parseDataUrl(block.src);
  if (!parsed) return false;
  return decodeBase64(parsed.base64) !== null;
}

/**
 * Images the EPUB cannot carry, and therefore leaves out.
 *
 * Reported by `storeReadiness`, so the writer hears it from the pre-upload
 * check rather than from the shop. Asked of the blocks *before* extraction —
 * afterwards every surviving picture is a package path and the question has
 * already been answered.
 */
export function undecodableImages(chapters: Block[][]): number {
  let count = 0;
  for (const blocks of chapters) {
    for (const block of blocks) {
      if (block.kind === "image" && !packageable(block)) count++;
    }
  }
  return count;
}
