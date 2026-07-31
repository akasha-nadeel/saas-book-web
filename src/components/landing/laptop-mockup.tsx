/**
 * The laptop in the hero, drawn rather than screenshotted.
 *
 * A screenshot would be one more asset to keep in step with an app that changes
 * every week, and would go stale silently. This is the real layout in miniature
 * — navy rail, chapter list, a page of prose on a white sheet — built from the
 * same tokens the app uses, so a change of palette carries here too.
 *
 * Decorative: it carries no controls and no text worth reading, so it is hidden
 * from assistive technology entirely rather than described badly.
 */
export function LaptopMockup() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-3xl select-none">
      {/* Lid. The bezel is the shelf navy, so the mockup reads as this app. */}
      <div className="rounded-t-2xl bg-[#0a1a2f] p-2.5 pb-0 shadow-2xl sm:p-3 sm:pb-0">
        <div className="aspect-[16/10] overflow-hidden rounded-lg bg-surface">
          <EditorScreen />
        </div>
      </div>

      {/* Base. Wider than the lid and a shade lighter, which is what reads as
          a hinge without drawing one. */}
      <div className="relative left-1/2 h-3 w-[108%] -translate-x-1/2 rounded-b-xl bg-[#0d2743] shadow-lg sm:h-3.5">
        <span className="absolute top-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-b-full bg-white/15" />
      </div>
    </div>
  );
}

/**
 * The editor's layout on its own, without the laptop around it.
 *
 * Exported because the landing hero sets it in a browser window rather than a
 * laptop lid — it is a web app, and the chrome that frames it should say so.
 * Drawing a second copy for that frame would give the page two mockups to keep
 * in step with one app.
 */
export function EditorScreen() {
  return (
    <div className="flex h-full">
      {/* The rail and chapter list, as the editor arranges them. */}
      <div className="hidden w-[26%] shrink-0 flex-col gap-2 bg-[#0a1a2f] p-2 sm:flex sm:gap-2.5 sm:p-3">
        {/* Sized inline, not with an arbitrary Tailwind value: v4 treats a bare
            length in text-[…] as ambiguous and drops the utility silently, so
            the wordmark rendered at body size inside a 3cm screen. */}
        <span
          className="font-display leading-none font-semibold text-white/90"
          style={{ fontSize: "0.6rem" }}
        >
          Open<span style={{ color: "#3a86d4" }}>Chapter</span>
        </span>
        <span className="mt-0.5 h-3 rounded bg-[#2670be] sm:h-4" />
        <div className="mt-1 flex flex-col gap-1.5">
          {["One", "Two", "Three", "Four", "Five"].map((label, i) => (
            <span
              key={label}
              className={`h-2 rounded sm:h-2.5 ${
                i === 1 ? "bg-white/25" : "bg-white/10"
              }`}
              style={{ width: `${88 - i * 7}%` }}
            />
          ))}
        </div>
      </div>

      {/* The manuscript, on its page. */}
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="flex items-center gap-1.5 border-b border-line px-2 py-1.5 sm:px-3">
          <span className="h-1.5 w-1.5 rounded-full bg-muted/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted/40" />
          <span className="ml-2 h-1.5 w-10 rounded bg-muted/25 sm:w-14" />
        </div>

        <div className="flex flex-1 justify-center overflow-hidden px-3 pt-3 sm:px-5 sm:pt-4">
          <div className="w-full max-w-[15rem] rounded-t bg-panel px-3 pt-3 shadow-sm sm:px-5 sm:pt-5">
            <span className="mx-auto block h-2 w-1/2 rounded bg-fg/70 sm:h-2.5" />
            <div className="mt-3 flex flex-col gap-1.5 sm:mt-4 sm:gap-2">
              {LINES.map((width, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded bg-fg/15"
                  style={{ width }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ragged right, the way set prose actually falls — a paragraph, then a break. */
const LINES = [
  "94%",
  "100%",
  "97%",
  "88%",
  "100%",
  "62%",
  "0%",
  "91%",
  "100%",
  "74%",
];
