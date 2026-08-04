/**
 * A catalogue book's cover, or a blank jacket where the catalogue has none.
 *
 * Shared by the two screens that put a shelf of other people's books on the
 * page — comps and the title check — because they are the same picture asking
 * the same question, and a placeholder that drifts between them makes one of
 * them look broken.
 *
 * **The empty state used to repeat the title, and that was the bug.** It drew
 * the title centred in the box at 11px, directly above the same title in
 * larger type on the card underneath. On a search where most records carry no
 * artwork — which is most searches once Open Library fails to answer, since
 * Google supplies covers only for the popular ones — the result was a wall of
 * grey rectangles each saying its name twice, and the eye read it as a grid
 * that had failed to load.
 *
 * So the placeholder says nothing the card already says. What it draws instead
 * is a **spine**: the one mark that makes a blank rectangle read as a book
 * seen face-on rather than as a missing image. The label under it is the
 * honest bit — the artwork is absent *from the catalogue*, not from the book,
 * and "No cover" alone would have been a small false claim about somebody's
 * published title.
 *
 * `aria-hidden`, all of it. The title, year and author sit beside this in real
 * text; a screen reader announcing "no cover art" before each of thirty books
 * is noise, and the `alt=""` on the real image is empty for the same reason.
 */
export function BookCover({
  src,
  className = "",
}: {
  /** The catalogue's thumbnail, when it has one. */
  src?: string;
  className?: string;
}) {
  return (
    <span
      className={`block overflow-hidden rounded-lg border border-line bg-raised ${className}`}
    >
      {src ? (
        // A plain img, not next/image: two third-party hosts whose URLs we do
        // not control, for a thumbnail. Adding them to the image config to
        // gain a resize is a configuration file that goes stale.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          className="aspect-[2/3] w-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden"
        >
          {/* The spine. A hairline and a slightly deeper ground down the
              binding edge, which is the whole of what makes this read as a
              book rather than as a hole in the grid. Percentage width so it
              stays in proportion at every track size the grid collapses to. */}
          <span className="absolute inset-y-0 left-0 w-[8%] border-r border-line bg-panel" />

          <span className="px-3 text-center text-[10px] leading-snug font-medium tracking-wide text-muted uppercase">
            No cover
            <br />
            in the catalogue
          </span>
        </span>
      )}
    </span>
  );
}
