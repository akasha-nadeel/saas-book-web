/**
 * The small illustrations beside each feature row.
 *
 * Drawn from the app's own tokens rather than screenshotted, for the same
 * reason as the laptop: a screenshot is an asset that goes stale silently while
 * the app keeps moving. All four are decorative and carry no readable content,
 * so they are hidden from assistive technology rather than described badly.
 */

/**
 * The white surface a figure is drawn on.
 *
 * It sits *inside* a feature card, which carries the grey ground — the same
 * two-layer arrangement the app itself uses for panel-on-surface, and what
 * makes each of these read as a piece of the product rather than as clip art
 * glued to a page.
 *
 * `ratio` because a bento is not a column: the three-across cards want a taller
 * figure than the two wide ones, and forcing one shape on both leaves either
 * whitespace or a squashed drawing.
 */
function Frame({
  children,
  ratio = "4/3",
}: {
  children: React.ReactNode;
  ratio?: string;
}) {
  return (
    <div
      aria-hidden="true"
      style={{ aspectRatio: ratio }}
      className="relative w-full select-none overflow-hidden rounded-2xl
                 border border-line bg-surface p-5 shadow-sm sm:p-6"
    >
      {children}
    </div>
  );
}

/** A manuscript page, with the seam where one sheet ends and the next begins. */
export function PageFigure() {
  return (
    <Frame>
      <div className="mx-auto flex h-full max-w-[16rem] flex-col">
        <div className="rounded-t-md bg-panel px-5 pt-5 pb-4 shadow-sm">
          <span className="mx-auto block h-2.5 w-1/2 rounded bg-fg/70" />
          <div className="mt-4 flex flex-col gap-2">
            {["96%", "100%", "89%", "100%", "71%"].map((w, i) => (
              <span key={i} className="h-1.5 rounded bg-fg/15" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* The break. Measured in lines, so a paragraph carries over it. */}
        <div className="flex items-center gap-2 py-2">
          <span className="h-px flex-1 bg-line" />
          <span className="font-sans text-[10px] text-muted">page 12</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex-1 rounded-b-md bg-panel px-5 pt-4 shadow-sm">
          <div className="flex flex-col gap-2">
            {["100%", "93%", "100%"].map((w, i) => (
              <span key={i} className="h-1.5 rounded bg-fg/15" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** The shelf: covers on a desk, one of them the book you were last in. */
export function ShelfFigure() {
  return (
    <Frame>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-20 rounded bg-fg/25" />
          <span className="ml-auto h-6 w-16 rounded-full bg-accent" />
        </div>

        <div className="grid flex-1 grid-cols-4 gap-2.5">
          {COVERS.map((c, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div
                className={`flex-1 rounded-md shadow-sm ${
                  i === 0 ? "ring-2 ring-accent" : ""
                }`}
                style={{ background: c }}
              />
              <span className="h-1.5 w-4/5 rounded bg-fg/15" />
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

const COVERS = [
  "linear-gradient(150deg,#5b74c9,#8f6fd0)",
  "linear-gradient(150deg,#2f4f7a,#1f3557)",
  "linear-gradient(150deg,#c98a5b,#a5613a)",
  "linear-gradient(150deg,#4f8a7a,#2f5f52)",
];

/** What the export dialog produces. */
export function FormatFigure() {
  return (
    <Frame>
      <div className="grid h-full grid-cols-2 gap-3">
        {["EPUB", "DOCX", "PDF", "MD"].map((label) => (
          <div
            key={label}
            className="flex flex-col justify-between rounded-xl border border-line bg-panel p-3"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-accent"
              >
                <path d="M11 2H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6l-4-4Z" />
                <path d="M11 2v4h4" />
              </svg>
            </span>
            <span className="font-sans text-xs font-semibold text-fg">{label}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** The read-through: the whole book as a spread you turn. */
export function ReadFigure() {
  return (
    <Frame>
      <div className="flex h-full items-center justify-center">
        <div className="flex h-[86%] w-full max-w-[18rem] overflow-hidden rounded-md shadow-lg">
          {[0, 1].map((side) => (
            <div
              key={side}
              className={`flex-1 bg-panel px-4 py-5 ${
                side === 0 ? "border-r border-line" : ""
              }`}
            >
              {side === 0 && (
                <span className="mx-auto mb-3 block h-2 w-2/3 rounded bg-fg/60" />
              )}
              <div className="flex flex-col gap-1.5">
                {(side === 0
                  ? ["100%", "92%", "100%", "80%", "100%", "66%"]
                  : ["94%", "100%", "88%", "100%", "97%", "45%"]
                ).map((w, i) => (
                  <span
                    key={i}
                    className="h-1.5 rounded bg-fg/15"
                    style={{ width: w }}
                  />
                ))}
              </div>
              <span className="mt-4 block text-center font-sans text-[10px] text-muted">
                {side === 0 ? "24" : "25"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/**
 * The assistant panel: a question about the open chapter, and an answer.
 *
 * Written as bars rather than lorem text, like every other figure here. The one
 * real word is the mark — a writer who has seen the sparkle in the rail should
 * recognise what this card is about before reading its title.
 */
export function AssistantFigure() {
  return (
    <Frame ratio="4/3">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/12">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 text-accent"
            >
              <path d="M9.6 2.6c.9 3.4 1.7 4.2 5.1 5.1-3.4.9-4.2 1.7-5.1 5.1-.9-3.4-1.7-4.2-5.1-5.1 3.4-.9 4.2-1.7 5.1-5.1z" />
              <path d="M15 12.4c.45 1.7.85 2.1 2.55 2.55-1.7.45-2.1.85-2.55 2.55-.45-1.7-.85-2.1-2.55-2.55 1.7-.45 2.1-.85 2.55-2.55z" />
            </svg>
          </span>
          <span className="h-2 w-16 rounded bg-fg/25" />
        </div>

        {/* The writer's question, on the accent; the answer on the page's own
            ground. Two speakers, told apart by ground rather than by a label. */}
        <div className="ml-auto w-4/5 rounded-xl rounded-br-sm bg-accent px-3 py-2.5">
          <div className="flex flex-col gap-1.5">
            {["100%", "72%"].map((w, i) => (
              <span
                key={i}
                className="h-1.5 rounded bg-white/70"
                style={{ width: w }}
              />
            ))}
          </div>
        </div>

        <div className="w-[88%] rounded-xl rounded-bl-sm border border-line bg-panel px-3 py-2.5">
          <div className="flex flex-col gap-1.5">
            {["100%", "94%", "100%", "58%"].map((w, i) => (
              <span
                key={i}
                className="h-1.5 rounded bg-fg/15"
                style={{ width: w }}
              />
            ))}
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 rounded-lg border border-line px-3 py-2">
          <span className="h-1.5 flex-1 rounded bg-fg/10" />
          <span className="h-5 w-10 rounded-md bg-accent/15" />
        </div>
      </div>
    </Frame>
  );
}

/**
 * Words per chapter, against the target the book was started with.
 *
 * The one figure here that shows a number, because it is the one thing on this
 * page a writer measures themselves by — and a bar chart with its axis label
 * blanked out would be a chart pretending to have data. The chapter that is
 * open takes the accent; the rest are the same grey the other figures use.
 */
export function ProgressFigure({ ratio = "4/3" }: { ratio?: string }) {
  // Heights as a share of the plot, and a deliberately uneven run: chapters are
  // not the same length, and a smooth ramp would read as a stock illustration.
  const bars = [46, 62, 38, 74, 55, 88, 41, 67];
  const open = 5;

  return (
    <Frame ratio={ratio}>
      <div className="flex h-full flex-col">
        <span className="font-sans text-[10px] text-muted">Words written</span>
        <span className="mt-0.5 font-display text-xl font-semibold text-fg">
          41,208
        </span>

        <div className="relative mt-4 flex flex-1 items-end gap-1.5">
          {/* The target, drawn across the bars rather than beside them — a line
              a writer is over or under, which is the only question it answers. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-line"
            style={{ bottom: "72%" }}
          />
          {bars.map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={`flex-1 rounded-t-sm ${
                i === open ? "bg-accent" : "bg-accent/15"
              }`}
            />
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="h-1.5 w-10 rounded bg-fg/12" />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent/25" />
            <span className="h-1.5 w-8 rounded bg-fg/12" />
          </span>
        </div>
      </div>
    </Frame>
  );
}
