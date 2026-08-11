/**
 * The moving strip under the hero.
 *
 * A landing page usually puts customer logos here, and OpenChapter has none to
 * put — a row of publishers' marks would be inventing them. So the strip names
 * the places a finished manuscript *goes* instead, which is both true of the
 * export pipeline and the thing a writer is actually nervous about: not who else
 * is here, but whether the book comes out again. Every name below opens one of
 * the formats `src/lib/export/` produces, and the format is set beside it so the
 * claim is checkable on sight rather than taken on faith.
 *
 * **The marks are the real ones, in their real colours**, and the lineup is
 * chosen around that: each entry is a brand whose actual logo and official hex
 * could be sourced, because a logo strip works on instant recognition and a
 * hand-drawn lookalike in a guessed colour reads as a mistake rather than as the
 * brand. Scrivener, Kobo and Adobe Acrobat are all true destinations but were
 * dropped from the row — no accurate mark exists in the open sets for the first
 * and last, and Kobo's is a wordmark that turns to mush at 24px beside its own
 * name.
 *
 * A mark is a list of paths rather than one, because several of these logos are
 * genuinely more than one colour: flattening Microsoft's four squares or
 * Google Play's four faces to a single fill is the *monochrome* logo, which is
 * a different mark from the one people recognise.
 *
 * This is nominative use — naming programs that read our exports. Paths for
 * Google Docs, LibreOffice Writer, Apple, Google Play and Obsidian come from
 * Simple Icons (CC0), with that project's official hex; Microsoft and Amazon
 * from Font Awesome Free 6 (CC BY 4.0, https://fontawesome.com) with each
 * brand's published colours, both having withdrawn from the open icon sets.
 * Trademarks belong to their respective owners.
 */

export type Mark = {
  /** The brand's own artboard. Simple Icons draw on 24, Font Awesome on 448×512. */
  viewBox: string;
  paths: { d: string; fill: string }[];
};

export type Destination = {
  name: string;
  /** The export that opens there — kept beside the name so the claim is checkable. */
  format: string;
  mark: Mark;
};

/**
 * Amazon's smile, on its own, because two screens want it.
 *
 * Exported rather than reached for through `DESTINATIONS` by name: a lookup on
 * the string "Amazon Kindle" is a rename away from rendering nothing, and this
 * is the one file carrying the attribution the licence requires (Font Awesome
 * Free 6, CC BY 4.0). Anything drawing this mark imports it from here, so the
 * path and the credit stay together.
 *
 * **Nominative use, and the distinction matters on a paid product.** Naming
 * the shop whose form these rules belong to is fair; dressing our own work in
 * their mark to imply they endorse it is not. So it appears at label size
 * beside the word "Amazon", never as decoration and never on anything that
 * could read as a partnership.
 */
export const AMAZON_MARK: Mark = {
  viewBox: "0 0 448 512",
  paths: [
    {
      d: "M257.7 162.7c-48.7 1.8-169.5 15.5-169.5 117.5 0 109.5 138.3 114 183.5 43.2 6.5 10.2 35.4 37.5 45.3 46.8l56.8-56s-32.3-25.3-32.3-52.8l0-147.1C341.5 89 317 32 229.2 32 141.2 32 94.5 87 94.5 136.3l73.5 6.8c16.3-49.5 54.2-49.5 54.2-49.5 40.7-.1 35.5 29.8 35.5 69.1zm0 86.8c0 80-84.2 68-84.2 17.2 0-47.2 50.5-56.7 84.2-57.8l0 40.6zM393.7 413c-7.7 10-70 67-174.5 67S34.7 408.5 10.2 379c-6.8-7.7 1-11.3 5.5-8.3 73.3 44.5 187.8 117.8 372.5 30.3 7.5-3.7 13.3 2 5.5 12zm39.8 2.2c-6.5 15.8-16 26.8-21.2 31-5.5 4.5-9.5 2.7-6.5-3.8s19.3-46.5 12.7-55c-6.5-8.3-37-4.3-48-3.2-10.8 1-13 2-14-.3-2.3-5.7 21.7-15.5 37.5-17.5 15.7-1.8 41-.8 46 5.7 3.7 5.1 0 27.1-6.5 43.1z",
      fill: "#FF9900",
    },
  ],
};

/**
 * The two other ebook shops' marks, lifted out for the same reason Amazon's is.
 *
 * The categories screen draws all three to say *every shop asks for these*, and
 * the note above applies unchanged: nominative use, at label size, beside words
 * that name what the row means. A logo strip that implied these shops had
 * checked anything would be the claim this screen most has to avoid — the
 * subjects come from Open Library, not from any of them.
 */
export const APPLE_BOOKS_MARK: Mark = {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701",
        fill: "#000000",
      },
    ],
  };

export const GOOGLE_PLAY_MARK: Mark = {
    viewBox: "0 0 24 24",
    // Four faces meeting at the fold: the spine blue, the top green, the
    // bottom red, the point yellow.
    paths: [
      {
        d: "M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z",
        fill: "#4285F4",
      },
      {
        d: "M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z",
        fill: "#34A853",
      },
      {
        d: "M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z",
        fill: "#EA4335",
      },
      {
        d: "M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z",
        fill: "#FBBC04",
      },
    ],
  };

export const DESTINATIONS: Destination[] = [
  {
    name: "Microsoft Word",
    format: "DOCX",
    mark: {
      viewBox: "0 0 448 512",
      // Four squares, four colours, clockwise from the top left.
      paths: [
        { d: "M0 32l214.6 0 0 214.6-214.6 0 0-214.6z", fill: "#F25022" },
        { d: "M233.4 32l214.6 0 0 214.6-214.6 0 0-214.6z", fill: "#7FBA00" },
        { d: "M0 265.4l214.6 0 0 214.6-214.6 0 0-214.6z", fill: "#00A4EF" },
        { d: "M233.4 265.4l214.6 0 0 214.6-214.6 0 0-214.6z", fill: "#FFB900" },
      ],
    },
  },
  {
    name: "Google Docs",
    format: "DOCX",
    mark: {
      viewBox: "0 0 24 24",
      // The rules on the page are cut out of the one shape, so the paper shows
      // through as white — a second fill would only paint over them.
      paths: [
        {
          d: "M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zm-.545 10.455H7.09v-1.364h7.09v1.364zm2.727-3.273H7.091v-1.364h9.818v1.364zm0-3.273H7.091V9.273h9.818v1.363zM14.727 6h6l-6-6v6z",
          fill: "#4285F4",
        },
      ],
    },
  },
  {
    name: "LibreOffice Writer",
    format: "DOCX",
    mark: {
      viewBox: "0 0 24 24",
      paths: [
        {
          d: "M22 0v7l-7-7h7zm0 9v12c0 1.662-1.338 3-3 3H5c-1.662 0-3-1.338-3-3V3c0-1.662 1.338-3 3-3h8l9 9zM6 10h5V9H6v1zm0 2h5v-1H6v1zm0 2h5v-1H6v1zm5 3H6v1h5v-1zm7-2H6v1h12v-1zm0-6h-6v5h6V9zm-1.5 2a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM14 11l-1 2h3l-2-2z",
          fill: "#083FA6",
        },
      ],
    },
  },
  {
    name: "Apple Books",
    format: "EPUB",
    mark: APPLE_BOOKS_MARK,
  },
  {
    /* Named for the shop rather than the device, because the mark is Amazon's
       own smile and a row that draws one brand's logo under another brand's
       name is the kind of mismatch a logo strip cannot survive. There is no
       accurate Kindle mark in the open sets — see the note at the top. */
    name: "Amazon Kindle",
    format: "EPUB",
    mark: AMAZON_MARK,
  },
  {
    name: "Google Play Books",
    format: "EPUB",
    mark: GOOGLE_PLAY_MARK,
  },
  {
    name: "Obsidian",
    format: "Markdown",
    mark: {
      viewBox: "0 0 24 24",
      paths: [
        {
          d: "M19.355 18.538a68.967 68.959 0 0 0 1.858-2.954.81.81 0 0 0-.062-.9c-.516-.685-1.504-2.075-2.042-3.362-.553-1.321-.636-3.375-.64-4.377a1.707 1.707 0 0 0-.358-1.05l-3.198-4.064a3.744 3.744 0 0 1-.076.543c-.106.503-.307 1.004-.536 1.5-.134.29-.29.6-.446.914l-.31.626c-.516 1.068-.997 2.227-1.132 3.59-.124 1.26.046 2.73.815 4.481.128.011.257.025.386.044a6.363 6.363 0 0 1 3.326 1.505c.916.79 1.744 1.922 2.415 3.5zM8.199 22.569c.073.012.146.02.22.02.78.024 2.095.092 3.16.29.87.16 2.593.64 4.01 1.055 1.083.316 2.198-.548 2.355-1.664.114-.814.33-1.735.725-2.58l-.01.005c-.67-1.87-1.522-3.078-2.416-3.849a5.295 5.295 0 0 0-2.778-1.257c-1.54-.216-2.952.19-3.84.45.532 2.218.368 4.829-1.425 7.531zM5.533 9.938c-.023.1-.056.197-.098.29L2.82 16.059a1.602 1.602 0 0 0 .313 1.772l4.116 4.24c2.103-3.101 1.796-6.02.836-8.3-.728-1.73-1.832-3.081-2.55-3.831zM9.32 14.01c.615-.183 1.606-.465 2.745-.534-.683-1.725-.848-3.233-.716-4.577.154-1.552.7-2.847 1.235-3.95.113-.235.223-.454.328-.664.149-.297.288-.577.419-.86.217-.47.379-.885.46-1.27.08-.38.08-.72-.014-1.043-.095-.325-.297-.675-.68-1.06a1.6 1.6 0 0 0-1.475.36l-4.95 4.452a1.602 1.602 0 0 0-.513.952l-.427 2.83c.672.59 2.328 2.316 3.335 4.711.09.21.175.43.253.653z",
          fill: "#7C3AED",
        },
      ],
    },
  },
];

/**
 * How many copies of the row the track holds. The animation travels -50%, so
 * the covered width is *half* of these — and that half has to be wider than the
 * widest viewport or a gap opens at the right edge as the loop comes round.
 * Seven names is under 1400px, so two rows of cover it is.
 */
const COPIES = 4;

export function WorksWith() {
  return (
    <section
      aria-label="Where your manuscript opens"
      className="border-t border-line bg-panel py-10 sm:py-12"
    >
      <p className="px-5 text-center font-sans text-sm font-semibold text-muted sm:px-8">
        Your book leaves in formats these already read — no licence, no lock-in.
      </p>

      {/* The window. overflow-hidden clips the track, and the mask fades both
          edges so names enter and leave rather than appearing at a hard line. */}
      <div
        className="oc-marquee relative mt-7 overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        {/* Identical copies, and the track travels exactly -50% — so the moment
            the front half has left, the back half is standing where it began
            and the loop has no seam. Every copy carries the same trailing gap or
            the join is tighter than the row. */}
        <div className="oc-marquee-track flex w-max items-center">
          {Array.from({ length: COPIES }, (_, i) => (
            // Only the first copy is the row; the rest are the same names again
            // for the loop's sake and would be read out four times over.
            <Group key={i} aria-hidden={i > 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Group({ "aria-hidden": hidden }: { "aria-hidden"?: boolean }) {
  return (
    <ul
      aria-hidden={hidden}
      className="flex shrink-0 items-center gap-10 pr-10 sm:gap-14 sm:pr-14"
    >
      {DESTINATIONS.map(({ name, format, mark }) => (
        <li key={name} className="flex shrink-0 items-center gap-3">
          <svg
            aria-hidden="true"
            viewBox={mark.viewBox}
            className="h-6 w-6 shrink-0"
          >
            {mark.paths.map((p) => (
              <path key={p.d} d={p.d} fill={p.fill} />
            ))}
          </svg>
          {/* The destination in full-strength ink, the format quietly beside it.
              Two weights rather than two rows: the row has to stay one line tall
              or the strip starts competing with the hero above it. */}
          <span className="font-display text-xl font-semibold whitespace-nowrap text-fg/75">
            {name}
          </span>
          <span className="font-sans text-[11px] font-semibold tracking-wide text-muted uppercase">
            {format}
          </span>
        </li>
      ))}
    </ul>
  );
}
