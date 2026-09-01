"use client";

import { useState } from "react";
import { defaultJacketFor, seedIndex } from "@/lib/default-covers";

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
 *
 * **Since the default jacket arrived this is the ground rather than the face.**
 * A book with no artwork now wears one of the seven pictures in
 * `default-covers.ts`, and the palette is what sits under it — the colour that
 * shows while the file loads, and the whole face again if it never does.
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
  // The fold itself now lives in `default-covers.ts`, so the ground and the
  // jacket are chosen by one function rather than by two copies of one. The
  // arithmetic is unchanged — a book keeps the colour it already had.
  return COVER_PALETTES[seedIndex(seed, COVER_PALETTES.length)];
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
 * A book with its own artwork keeps it. **A book without one wears a default
 * jacket** — one of the seven pictures in `default-covers.ts`, fixed by its id
 * — with its title printed over it, over the cloth colour it has always had.
 *
 * **The jacket is decoration and is never the book's cover.** `getCover` and
 * `hasCover` go on answering null and false for a book wearing one, which is
 * what keeps the dashboard's "No cover" finding, `storeReadiness()`, the export
 * and the cover dialog's "Choose image" all correct without any of them
 * knowing this exists. Do not "fix" the finding that now looks wrong beside a
 * good-looking card: `TODO.md` explains, under the roadmap's "get a cover
 * made", that a placeholder attached like a real cover would tick off the most
 * expensive step in the list on the strength of a picture nobody chose.
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
  radius = "rounded-l-[3px] rounded-r-md",
}: {
  title: string;
  subtitle?: string;
  author?: string;
  /** Drives how thick the page block looks. A long book is a fat book. */
  words: number;
  /** Cover art as a data URL. Replaces the default jacket when present. */
  image?: string | null;
  /**
   * Show artwork bare: no caption, no scrim.
   *
   * **The writer's own artwork only.** It means *the picture already carries
   * the title*, which can only ever be true of a file somebody chose; the
   * default jacket carries no words, so a bare one would be an untitled book.
   */
  bare?: boolean;
  /** Stable key — the book id — that fixes which jacket and which muted palette
   *  a cover-less book wears. Falls back to the title when a book has no id
   *  yet. */
  seed?: string;
  /**
   * The corner, as the class pair it is drawn with.
   *
   * A jacket's rounding is proportional to nothing — it is a fixed few pixels,
   * which reads as a book at card size and as a lozenge at 20px. So the row
   * thumbs pass a tighter pair. A class string rather than a size token because
   * `BookThumb` already takes its `width` that way, and one convention in a
   * component beats two.
   */
  radius?: string;
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

  /*
   * A jacket that would not load, so the typeset cloth face can take over.
   *
   * Reachable rather than defensive: the jackets are static files, and a
   * browser offline, an extension blocking images, or a bad deploy all end the
   * same way. Without this the caption's white type would be left on a pale
   * grey box, which is the one state it cannot be read on.
   */
  const [jacketGone, setJacketGone] = useState(false);

  const jacket = image || jacketGone ? null : defaultJacketFor(seed ?? title);
  const art = image ?? jacket;

  return (
    <div
      className={`book-face relative aspect-[2/3] w-full ${radius}
                 ${BOOK_SHADOW}
                 transition-[transform,box-shadow] duration-200
                 group-hover:-translate-y-1.5
                 group-hover:shadow-[0_3px_8px_-2px_rgba(0,0,0,0.4),0_28px_52px_-12px_rgba(0,0,0,0.95)]`}
      // The cloth-cover colour, under whichever picture is on top of it: the
      // ground while a jacket loads, and the whole face again if it never does.
      style={{
        background: `linear-gradient(140deg, ${palette.from}, ${palette.to})`,
      }}
    >
      {/* Artwork sits under the spine and page-block shading, so a cover with
          a picture on it still reads as an object rather than a flat image. A
          plain <img>: the writer's own cover is a data URL already resized on
          import, so next/image has nothing left to optimise, and a jacket is a
          fixed static file drawn at a dozen different widths — which is the
          one shape `next/image` cannot size for.

          `object-cover` on a 2:3 box is what makes both of them right on every
          screen: a jacket is 9:16 and a writer's file is whatever their
          designer handed them, and neither is ever stretched. */}
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art}
          alt=""
          // The jacket alone: a writer's own cover is already in memory, and
          // lazily loading it would blank the card it is the whole point of.
          loading={jacket ? "lazy" : undefined}
          decoding="async"
          onError={jacket ? () => setJacketGone(true) : undefined}
          className={`absolute inset-0 h-full w-full object-cover ${radius}`}
        />
      ) : null}

      {/* Artwork hides the words, so they are printed back over it — always,
          the way they are on a real jacket, not only while the pointer is on
          it. Only for covers that have a picture: a typeset face is already
          the text, and a second copy over it would just double up.

          `bare` is honoured for the writer's own file and ignored on a default
          jacket, because it means *the picture already has the words on it* —
          which the seven never do. Left to apply to both, a book that had
          artwork with its title on it, then had it removed, would sit on the
          shelf as an untitled picture.

          The caption hides itself on covers too narrow to read it — see
          .book-face-caption. */}
      {art && !(image && bare) ? (
        <div className={`book-face-caption absolute inset-0 flex-col ${radius}`}>
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

      {/* The typeset cloth face, now the fallback rather than the usual state:
          it is what a cover-less book shows when its jacket will not load. The
          ink comes from the palette, which is the half that keeps it readable
          on a light ground as well as a dark one. */}
      {art ? null : (
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
