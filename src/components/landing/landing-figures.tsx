/**
 * The small illustrations beside each feature row.
 *
 * Drawn from the app's own tokens rather than screenshotted, for the same
 * reason as the laptop: a screenshot is an asset that goes stale silently while
 * the app keeps moving. All four are decorative and carry no readable content,
 * so they are hidden from assistive technology rather than described badly.
 */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl
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
