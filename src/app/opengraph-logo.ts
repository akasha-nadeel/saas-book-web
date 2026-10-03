/**
 * The OC mark, inlined, for the link-preview card alone.
 *
 * `opengraph-image.tsx` is rendered by Satori on the server, which cannot read
 * `public/` unless the file is traced into the function bundle — and
 * `next.config.ts` is load-bearing enough that adding a tracing entry for one
 * picture is the dearer of the two options. So the mark travels as a data URI:
 * `public/logo-mark.png` flattened onto white at 192px and quantised to eight
 * colours, which is 4KB rather than the original 100KB.
 *
 * **Flattened onto white on purpose.** The source is a blue mark on
 * transparency; drawn straight onto the card's navy its inner strokes sit at
 * about 3.4:1 and the letters go soft. The white tile is what the favicon
 * already does.
 *
 * Regenerate from `public/logo-mark.png` if the mark ever changes — it is a
 * copy, and a copy goes stale silently.
 */
export const OG_LOGO_DATA_URI =
  "data:image/png;base64," +
  "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";
