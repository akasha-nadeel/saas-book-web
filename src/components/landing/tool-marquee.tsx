import { TOOL_MARK_HUES, TOOL_MARKS } from "@/components/shelf/tool-marks";
import { ALL_TOOLS, type BookTool } from "@/lib/book-tools";

/**
 * The sixteen tools again, as three rows sliding past the closing ask.
 *
 * **The same list, said a second way, and deliberately so.** The cloud higher
 * up asks the reader to hover; this asks nothing. A reader who has scrolled to
 * the last screen has already decided most of what they think, and what this
 * row is for is the size of the thing — sixteen named tools going past is a
 * quantity you feel rather than count. The reference does exactly this under
 * its own closing ask.
 *
 * **Read from `ALL_TOOLS`, like everything else on this page**, so it cannot
 * name a tool that does not exist, and the tiles are tinted from
 * `TOOL_MARK_HUES` so a row of them matches the cloud above rather than being
 * a second, differently-dressed set of the same marks.
 *
 * **No JavaScript.** A marquee is a translate on a loop, which CSS has had for
 * years: each row holds its list *twice* and slides exactly half its own width,
 * so the moment the first copy leaves the frame the second is in precisely the
 * place it started. That is the whole trick, and it is why the duplicate is not
 * optional — with one copy the row would empty out and snap.
 *
 * The duplicate is `aria-hidden`, which matters more here than it looks: the
 * names are real text, and without it a screen reader would read all sixteen
 * tools and then read them again.
 */

/** A row's worth of tools, rotated so the three rows do not start together. */
function rotate(list: readonly BookTool[], by: number): BookTool[] {
  return [...list.slice(by), ...list.slice(0, by)];
}

function Row({
  tools,
  reverse,
  seconds,
}: {
  tools: BookTool[];
  /** Right rather than left. The middle row runs against the other two. */
  reverse?: boolean;
  seconds: number;
}) {
  const run = (hidden: boolean) => (
    <ul
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-10 pr-10 sm:gap-14 sm:pr-14"
    >
      {tools.map((tool) => {
        const hue = TOOL_MARK_HUES[tool.icon] ?? "#146ef5";
        return (
          <li
            key={tool.path}
            className="flex shrink-0 items-center gap-3.5 sm:gap-4"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border sm:h-14 sm:w-14"
              style={{
                backgroundColor: `color-mix(in srgb, ${hue} 10%, #ffffff)`,
                borderColor: `color-mix(in srgb, ${hue} 38%, #ffffff)`,
                boxShadow:
                  "0 8px 20px -10px rgba(15,15,16,0.45), 0 2px 5px -2px rgba(15,15,16,0.2)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                {TOOL_MARKS[tool.icon]}
              </svg>
            </span>
            {/* The name at the reference's weight: this row is the one place
                on the page where all sixteen are readable at a glance, which
                is what it is here to be. */}
            <span className="whitespace-nowrap text-[1.375rem] font-semibold tracking-tight text-lp-ink sm:text-[1.625rem]">
              {tool.name}
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex w-max" style={{ animationDuration: `${seconds}s` }}>
      {/* The animation class is on this wrapper rather than on each list, so
          the two copies move as one strip. */}
      <div
        className={`flex w-max ${reverse ? "oc-marquee-right" : "oc-marquee-left"}`}
        style={{ animationDuration: `${seconds}s` }}
      >
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}

export function ToolMarquee() {
  return (
    /* `overflow-hidden` is what makes it a marquee rather than a very wide
       page — the strip is twice the list and has to be clipped to the window.
       The mask fades both ends so items enter and leave rather than being
       chopped at a hard edge, which is the difference between this reading as
       a moving row and as a row with two cuts in it. */
    <div
      className="overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]"
      role="presentation"
    >
      <div className="flex flex-col gap-6 sm:gap-8">
        <Row tools={rotate(ALL_TOOLS, 0)} seconds={64} />
        <Row tools={rotate(ALL_TOOLS, 6)} seconds={72} reverse />
        <Row tools={rotate(ALL_TOOLS, 11)} seconds={68} />
      </div>
    </div>
  );
}
