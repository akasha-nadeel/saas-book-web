"use client";

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
 * Covers are paper-white against dark chrome, as in the reference. They are not
 * tinted per book: a shelf of invented colours reads as decoration, while a
 * shelf of white spines reads as a shelf, and the title is what tells them
 * apart — the same thing that does the work on a real one.
 */
export function BookCover({
  title,
  subtitle,
  author,
  words,
  image,
}: {
  title: string;
  subtitle?: string;
  author?: string;
  /** Drives how thick the page block looks. A long book is a fat book. */
  words: number;
  /** Cover art as a data URL. Replaces the typeset face when present. */
  image?: string | null;
}) {
  // Eight leaves at 40k words, which is where a novel starts. Capped, because
  // past a point more lines just turn into a grey smear.
  const leaves = Math.max(3, Math.min(8, Math.round(3 + words / 8000)));

  return (
    <div
      className="book-face relative aspect-[3/4] w-full rounded-l-[3px] rounded-r-md
                 bg-gradient-to-br from-white to-[#e8eaef]
                 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.75)]
                 transition-[transform,box-shadow] duration-200
                 group-hover:-translate-y-1.5
                 group-hover:shadow-[0_18px_34px_-12px_rgba(0,0,0,0.85)]"
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

      {/* Artwork hides the words, so hovering brings them back over a scrim.
          Only for covers that have a picture — a typeset face is already the
          text, and fading a second copy in over it would just shimmer.

          It rides on the shelf card's `group`, so in the previews and the tool
          rail, where there is no such ancestor, it never appears — which is
          right: those are not places you hover to identify a book. */}
      {image ? (
        <div
          className="absolute inset-0 flex flex-col rounded-l-[3px] rounded-r-md
                     bg-black/25 opacity-0 transition-opacity duration-200
                     group-hover:opacity-100"
        >
          {/* A shadow on the type rather than a heavier scrim. The artwork
              stays visible through the overlay, and the words stay legible
              even where they land on a pale part of it. */}
          <div
            className="book-face-inner flex h-full flex-col"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}
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
            className="book-face-title line-clamp-3 font-serif text-[#16191f]"
            title={title}
          >
            {title}
          </h3>
          {subtitle ? (
            <p className="book-face-subtitle line-clamp-2 font-serif text-[#4b5563] italic">
              {subtitle}
            </p>
          ) : null}
          {author ? (
            /* Pushed to the foot of the cover, where a byline sits. */
            <p className="book-face-author mt-auto truncate font-sans text-[#6b7280] uppercase">
              {author}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
