"use client";

/**
 * Cloth-cover palettes for books with no artwork of their own.
 *
 * A book is assigned one deterministically from its id, so its cover is its own
 * and never shifts. They were eight muted hues — slate blue, sage, sand — and
 * are now eight *values*, because the app has one palette and no colour in it.
 *
 * **Eight greys work where eight hues did by running the full ladder**, from
 * near-white to near-black, rather than crowding the light end where the cloth
 * colours all sat. So the four dark ones print their titles in light ink and
 * the four light ones in dark, which is a second axis of difference and is what
 * keeps a shelf of these from reading as one book eight times.
 *
 * Each still carries its own ink and muted, for the reason it always did: a
 * flat black title on every cover is a swatch card, not a shelf.
 */
const COVER_PALETTES: {
  from: string;
  to: string;
  ink: string;
  muted: string;
}[] = [
  { from: "#ededed", to: "#dcdcdc", ink: "#1a1a1a", muted: "#5c5c5c" }, // chalk
  { from: "#d4d4d4", to: "#c2c2c2", ink: "#1f1f1f", muted: "#565656" }, // bone
  { from: "#bdbdbd", to: "#a8a8a8", ink: "#1c1c1c", muted: "#4b4b4b" }, // ash
  { from: "#9c9c9c", to: "#8a8a8a", ink: "#141414", muted: "#3d3d3d" }, // pewter
  { from: "#6e6e6e", to: "#5c5c5c", ink: "#f5f5f5", muted: "#d0d0d0" }, // slate
  { from: "#4a4a4a", to: "#3a3a3a", ink: "#f0f0f0", muted: "#c0c0c0" }, // graphite
  { from: "#2e2e2e", to: "#222222", ink: "#ededed", muted: "#a8a8a8" }, // charcoal
  { from: "#171717", to: "#0d0d0d", ink: "#e5e5e5", muted: "#949494" }, // ink
];

function coverPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

/**
 * What makes a cover sit on a surface rather than float above it: a tight
 * contact shadow at its foot, and a soft cast falling well below.
 *
 * Exported so anything that frames a book's artwork itself — at the page's
 * real trim rather than through this component — wears the same treatment
 * rather than a copy of it that quietly drifts.
 */
export const BOOK_SHADOW =
  "shadow-[0_2px_6px_-2px_rgba(0,0,0,0.35),0_20px_42px_-12px_rgba(0,0,0,0.9)]";

/**
 * A book as an object rather than a row.
 *
 * Two parts of three, which is a 6×9 novel — the trim the app is built around
 * and the shape a real page is drawn at. It was three parts of four,
 * a squarer card that reads as a thumbnail rather than as a book, and made a
 * shelf disagree with the page the same book was written on.
 *
 * The depth is built from three things, none of them a 3D transform: a spine
 * darkening down the left edge, a page-block of hairlines down the right, and a
 * shadow that grows as the cover lifts. Rotating the card in perspective was
 * the obvious approach and is the wrong one — text rendered on a rotated plane
 * loses subpixel antialiasing and goes soft, and the title is the one thing on
 * a shelf that has to stay readable.
 *
 * An image-less book wears a muted cloth colour of its own rather than plain
 * white — see COVER_PALETTES. The colours are desaturated and share a weight,
 * so a shelf of them still reads as a shelf, not a paint chart, while giving
 * each book a little identity. A book with its own artwork keeps it.
 */
export function BookCover({
  title,
  subtitle,
  author,
  words,
  image,
  bare,
  seed,
  pageBlock = true,
}: {
  title: string;
  subtitle?: string;
  author?: string;
  /** Drives how thick the page block looks. A long book is a fat book. */
  words: number;
  /** Cover art as a data URL. Replaces the typeset face when present. */
  image?: string | null;
  /** Show artwork bare: no caption, no scrim. Ignored without artwork. */
  bare?: boolean;
  /** Stable key — the book id — that fixes which muted palette an image-less
   *  cover wears. Falls back to the title when a book has no id yet. */
  seed?: string;
  /**
   * Draw the page block down the right edge. On by default, because on a shelf
   * it is what gives a book thickness.
   *
   * The landing hero turns it off: there the books are tilted in perspective
   * and seen nearly face-on, where a strip of hairlines reads as a white bar
   * stuck to the edge rather than as leaves.
   */
  pageBlock?: boolean;
}) {
  // Eight leaves at 40k words, which is where a novel starts. Capped, because
  // past a point more lines just turn into a grey smear.
  const leaves = Math.max(3, Math.min(8, Math.round(3 + words / 8000)));

  // Its own muted colour, fixed by the book so it never changes under it.
  const palette = coverPalette(seed ?? title);

  return (
    <div
      className={`book-face relative aspect-[2/3] w-full rounded-l-[3px] rounded-r-md
                 ${BOOK_SHADOW}
                 transition-[transform,box-shadow] duration-200
                 group-hover:-translate-y-1.5
                 group-hover:shadow-[0_3px_8px_-2px_rgba(0,0,0,0.4),0_28px_52px_-12px_rgba(0,0,0,0.95)]`}
      // The cloth-cover colour. Covered by artwork when a book has its own,
      // so it only shows on the typeset face — which is the point.
      style={{
        background: `linear-gradient(140deg, ${palette.from}, ${palette.to})`,
      }}
    >
      {/* Artwork sits under the spine and page-block shading, so a cover with
          a picture on it still reads as an object rather than a flat image. A
          plain <img>: these are data URLs already resized on import, so
          next/image has nothing left to optimise. */}
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full rounded-l-[3px] rounded-r-md object-cover"
        />
      ) : null}

      {/* Artwork hides the words, so they are printed back over it — always,
          the way they are on a real jacket, not only while the pointer is on
          it. Only for covers that have a picture: a typeset face is already
          the text, and a second copy over it would just double up.

          The caption hides itself on covers too narrow to read it — see
          .book-face-caption. */}
      {image && !bare ? (
        <div className="book-face-caption absolute inset-0 flex-col rounded-l-[3px] rounded-r-md">
          {/* No scrim over the artwork — it shows at full strength. The type
              carries its own legibility instead: a tight dark halo for edge
              definition plus a soft spread for contrast, so white words hold
              even where they land on a pale part of the picture. */}
          <div
            className="book-face-inner flex h-full flex-col"
            style={{
              textShadow:
                "0 1px 2px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.55)",
            }}
          >
            <p className="book-face-title line-clamp-3 font-serif text-white">
              {title}
            </p>
            {subtitle ? (
              <p className="book-face-subtitle line-clamp-2 font-serif text-white/90 italic">
                {subtitle}
              </p>
            ) : null}
            {author ? (
              <p className="book-face-author mt-auto truncate font-sans text-white/85 uppercase">
                {author}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* The spine: a hard fold line with the shading falling away from it. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-5 rounded-l-[3px]
                   bg-gradient-to-r from-black/25 via-black/[0.07] to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-[5px] w-px bg-black/15"
      />

      {/* The page block, edge-on. Repeating hairlines rather than one flat
          strip, so it reads as leaves instead of a border. */}
      {pageBlock ? (
        <div
          aria-hidden="true"
          className="absolute inset-y-1.5 right-0 rounded-r-md"
          style={{
            width: `${leaves}px`,
            backgroundImage:
              "repeating-linear-gradient(to right, rgba(0,0,0,0.16) 0 1px, rgba(255,255,255,0.85) 1px 2px)",
          }}
        />
      ) : null}

      {image ? null : (
        <div className="book-face-inner relative flex h-full flex-col">
          <h3
            // Clamped, so a long title wraps like a title and then stops rather
            // than growing past the bottom of the cover.
            className="book-face-title line-clamp-3 font-serif"
            style={{ color: palette.ink }}
            title={title}
          >
            {title}
          </h3>
          {subtitle ? (
            <p
              className="book-face-subtitle line-clamp-2 font-serif italic"
              style={{ color: palette.muted }}
            >
              {subtitle}
            </p>
          ) : null}
          {author ? (
            /* Pushed to the foot of the cover, where a byline sits. */
            <p
              className="book-face-author mt-auto truncate font-sans uppercase"
              style={{ color: palette.muted }}
            >
              {author}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
