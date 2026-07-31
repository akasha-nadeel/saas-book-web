/**
 * A small picture of each thing the toolkit cards name.
 *
 * These exist so those cards can carry the export page's tilt — a preview
 * angled off the corner that straightens under the pointer. The rule
 * format-previews.tsx sets is that the tilt has to be earned: a card that
 * tilts a decoration is a trick, and a card that tilts *the thing it is
 * describing* is an answer to the question the card is asking. So each of
 * these is drawn to the shape of the panel it names — the search panel has a
 * field and hits, the reader has a spread with its folios, dictation has the
 * meter and the words it is hearing — and a writer who has used the app should
 * recognise which is which before reading the title above it.
 *
 * Drawn from the app's own tokens rather than screenshotted, for the reason
 * landing-figures.tsx gives: a screenshot is an asset that goes stale silently
 * while the app keeps moving.
 *
 * All decorative. The card's own title and description say everything these
 * do, so they are hidden from assistive technology rather than described
 * twice.
 */

/** Prose stands in as bars, at the weight the other landing figures use. */
function Lines({
  widths,
  className = "bg-fg/12",
}: {
  widths: string[];
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {widths.map((w, i) => (
        <span
          key={i}
          className={`h-1.5 rounded ${className}`}
          style={{ width: w }}
        />
      ))}
    </div>
  );
}

/** One row in a list — a mark, a title, and something underneath it. */
function Row({
  mark,
  width = "70%",
  sub,
}: {
  mark?: React.ReactNode;
  width?: string;
  sub?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
      {mark}
      <span className="flex flex-1 flex-col gap-1">
        <span className="h-1.5 rounded bg-fg/20" style={{ width }} />
        {sub && <span className="h-1 w-1/3 rounded bg-fg/10" />}
      </span>
    </div>
  );
}

const Star = (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-2.5 w-2.5 shrink-0 text-accent"
  >
    <path d="m10 2.5 2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.7z" />
  </svg>
);

/** The ⌘K panel: a field with something typed, and the hits under it. */
export function SearchFigure() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="h-3 w-3 shrink-0 text-accent"
        >
          <circle cx="8.8" cy="8.8" r="5.3" />
          <path d="m12.7 12.7 4 4" strokeLinecap="round" />
        </svg>
        <span className="h-1.5 w-16 rounded bg-fg/25" />
      </div>
      <div className="mt-2 flex flex-col gap-0.5">
        <Row width="78%" sub />
        <Row width="62%" sub />
        <Row width="70%" sub />
      </div>
    </div>
  );
}


/** The bookmarks panel: starred chapters from more than one book. */
export function BookmarksFigure() {
  return (
    <div className="p-3">
      <span className="block h-1.5 w-14 rounded bg-fg/25" />
      <div className="mt-2 flex flex-col gap-0.5">
        <Row mark={Star} width="72%" sub />
        <Row mark={Star} width="58%" sub />
        <Row mark={Star} width="80%" sub />
      </div>
    </div>
  );
}

/** The listening bar: the meter, and the words as they are heard. */
export function DictationFigure() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/8 px-2.5 py-2">
        <span className="flex h-3 items-center gap-[2px]">
          {[6, 11, 8].map((h, i) => (
            <span
              key={i}
              className="w-[2px] rounded-full bg-accent"
              style={{ height: `${h}px` }}
            />
          ))}
        </span>
        <span className="h-1.5 flex-1 rounded bg-fg/15" />
      </div>
      <div className="mt-2.5 px-0.5">
        <Lines widths={["100%", "84%", "46%"]} />
      </div>
    </div>
  );
}

/** The read-through: two pages of a spread, with their folios. */
export function SpreadFigure() {
  return (
    <div className="flex h-full gap-px p-3">
      {[0, 1].map((side) => (
        <div
          key={side}
          className={`flex-1 px-2.5 py-3 ${side === 0 ? "border-r border-line" : ""}`}
        >
          {side === 0 && (
            <span className="mx-auto mb-2 block h-1.5 w-2/3 rounded bg-fg/45" />
          )}
          <Lines
            widths={
              side === 0
                ? ["100%", "90%", "100%", "72%"]
                : ["94%", "100%", "82%", "100%"]
            }
          />
          <span className="mt-2 block text-center font-sans text-[8px] text-muted">
            {side === 0 ? "24" : "25"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The target: what is written against what was set. */
export function TargetFigure() {
  return (
    <div className="p-3">
      <span className="block font-sans text-[10px] text-muted">
        41,208 of 90,000
      </span>
      <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-fg/10">
        <span className="block h-full w-[46%] rounded-full bg-accent" />
      </span>
      <div className="mt-3 flex items-end gap-1">
        {[40, 62, 35, 70, 52, 84, 44].map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-t-[2px] bg-accent/20"
            style={{ height: `${h * 0.3}px` }}
          />
        ))}
      </div>
    </div>
  );
}

/** A title page: the generated front matter, centred as it prints. */
export function MatterFigure() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
      <span className="h-2 w-3/5 rounded bg-fg/45" />
      <span className="h-1.5 w-2/5 rounded bg-fg/15" />
      <span className="mt-3 h-1.5 w-1/3 rounded bg-fg/15" />
    </div>
  );
}

