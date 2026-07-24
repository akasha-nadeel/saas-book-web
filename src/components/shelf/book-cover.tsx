"use client";

/**
 * Muted cloth-cover palettes for books with no artwork of their own.
 *
 * A book is assigned one deterministically from its id, so its colour is its
 * own and never shifts. A shelf of these reads as a library rather than a paint
 * chart because every one is desaturated and they share a weight. Each carries
 * its own ink so the title stays legible — and tonal — instead of a flat black
 * on every hue.
 */
const COVER_PALETTES: {
  from: string;
  to: string;
  ink: string;
  muted: string;
}[] = [
  { from: "#cfd8e1", to: "#bcc8d5", ink: "#2b3a49", muted: "#586878" }, // slate blue
  { from: "#d2dac9", to: "#c0ccb6", ink: "#34402c", muted: "#606e57" }, // sage
  { from: "#e5dcc8", to: "#d6cbb2", ink: "#463c28", muted: "#786b50" }, // sand
  { from: "#dfcecc", to: "#cebbb9", ink: "#473839", muted: "#7b6666" }, // dusty rose
  { from: "#d5cfe0", to: "#c4bad3", ink: "#3a3448", muted: "#675f7d" }, // lavender
  { from: "#dfcbbc", to: "#d0b7a4", ink: "#4a3729", muted: "#806655" }, // clay
  { from: "#c7d8d4", to: "#b3c9c4", ink: "#28403b", muted: "#54706b" }, // muted teal
  { from: "#dbd5cb", to: "#cbc4b6", ink: "#3c3931", muted: "#6d675b" }, // greige
];

function coverPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

/**
 * A book as an object rather than a row.
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
}) {
  // Eight leaves at 40k words, which is where a novel starts. Capped, because
  // past a point more lines just turn into a grey smear.
  const leaves = Math.max(3, Math.min(8, Math.round(3 + words / 8000)));

  // Its own muted colour, fixed by the book so it never changes under it.
  const palette = coverPalette(seed ?? title);

  return (
    <div
      className="book-face relative aspect-[3/4] w-full rounded-l-[3px] rounded-r-md
                 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.85)]
                 transition-[transform,box-shadow] duration-200
                 group-hover:-translate-y-1.5
                 group-hover:shadow-[0_22px_40px_-10px_rgba(0,0,0,0.9)]"
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
      <div
        aria-hidden="true"
        className="absolute inset-y-1.5 right-0 rounded-r-md"
        style={{
          width: `${leaves}px`,
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(0,0,0,0.16) 0 1px, rgba(255,255,255,0.85) 1px 2px)",
        }}
      />

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
