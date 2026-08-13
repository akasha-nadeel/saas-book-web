import type { CSSProperties, ReactNode, Ref } from "react";

/**
 * The window the landing page shows its product in — one frame, three uses.
 *
 * The page had two devices and then three: a tablet slab under the check demo,
 * another under the listing form, and a bare rounded card in the hero. Three
 * frames on one page reads as three products, and the hero's frameless card
 * read as something worse — a form, the shape of a thing about to ask for your
 * email. So there is one frame now and everything sits in it.
 *
 * **It is a window, not a monitor.** An earlier pass drew the full device:
 * traffic-light dots, a centred title bar, a stand underneath. It was the
 * wrong reference. Three grey dots are somebody else's operating system, and
 * borrowed chrome dates a page to the year it was designed and quietly says
 * "this is a picture of software" — where the whole argument here is that the
 * software is *right there*, one of these being a live control rather than a
 * drawing. The stand had the same problem in furniture form: it framed the
 * product as a photograph on a desk.
 *
 * What is left is a soft ring, a hairline and a long shadow. The product's own
 * chrome shows through it and is the only chrome on screen, which is what
 * makes the thing look like an app rather than a screenshot of one.
 *
 * **`label` is what decides whether this is a picture or a thing.** The two
 * demos are pictures — drawn recreations that move on their own — so they pass
 * a label, take `role="img"`, and their contents hide behind that one
 * description. The hero passes none, because what is inside it is a real file
 * input: a screen reader has to meet the control, not a sentence describing a
 * picture of one. Getting that backwards would make the only working thing on
 * the page invisible to the people who most need it announced.
 */
export function AppWindow({
  title,
  badge,
  label,
  bezel = false,
  fill = false,
  hostRef,
  screenRef,
  screenClassName = "",
  screenStyle,
  children,
}: {
  /**
   * A slim strip along the top of the window, drawn only when there is
   * something to put in it.
   *
   * The two demos pass neither: what they draw already *has* a header — a
   * sidebar, a wordmark, a page title — and a second bar above it would be a
   * window inside a window. Only the hero uses it, because the drop zone has
   * no chrome of its own and the badge has to live somewhere the eye lands.
   */
  title?: string;
  badge?: ReactNode;
  /** Present when the contents are a drawn picture rather than a control. */
  label?: string;
  /**
   * Draw the shell as a dark bezel instead of the pale ring.
   *
   * **Still one frame, at two volumes — not a second device.** The pale ring
   * is right for a figure floating inside a section that is already about it:
   * a heading above it, a paragraph beside it, the section's own words doing
   * the pointing. It separates the product from the ground without drawing a
   * machine round it. It is *wrong* for a window that has to carry its own
   * half of the page, where the frame is what says "look here" — a pale ring
   * on a pale band simply disappears at that size.
   *
   * The bezel does the holding. Same rounding, same glass, same hairline
   * inside it; only the shell's value changes, so the two still read as one
   * component rather than as two products.
   *
   * One window takes it: the hero's check, which owns its section outright and
   * sits on the page's own ground. Everything else keeps the ring, including
   * the three refusal figures — they wore the bezel while those refusals were
   * bands on white, and lost it when they moved onto tinted cards, because a
   * bezel inside a panel is two frames around one screen. That is the test:
   * reach for it when the window is the loudest thing in its section and has
   * nothing else framing it — not because it looks more finished, or the page
   * is back to having several devices on it.
   */
  bezel?: boolean;
  /**
   * Stretch to the height of whatever holds it, rather than sizing to the
   * drawn screen inside.
   *
   * For a figure that shares a row with a column of words: content-sized, a
   * short screen leaves the tinted card looking half-empty beside a full
   * column of text, and the two read as unrelated heights that happen to be
   * adjacent. Filled, the frame is the row — which is what makes a card read
   * as *a page beside a screen* rather than as two things dropped in a box.
   *
   * The drawn screen keeps its own size and sits at the top of the glass. That
   * is not a gap to be closed: a real application window has its content at
   * the top and space below it, which is exactly what this then looks like.
   */
  fill?: boolean;
  hostRef?: Ref<HTMLDivElement>;
  screenRef?: Ref<HTMLDivElement>;
  screenClassName?: string;
  screenStyle?: CSSProperties;
  children: ReactNode;
}) {
  const picture = label !== undefined;

  return (
    /*
     * The ring, and the shadow that lifts it off the page.
     *
     * A pale ring a few pixels wide is the whole of the effect: it separates
     * the product from whatever it is floating on — a gradient in the hero, a
     * tinted band further down — without drawing a device around it. The
     * shadow is long and soft here rather than the short tight one the old
     * tablets used, because this is meant to hover above the page rather than
     * rest on it.
     */
    <div
      ref={hostRef}
      {...(picture ? { role: "img", "aria-label": label } : {})}
      className={`rounded-[1.4rem] shadow-[0_28px_70px_-28px_rgba(15,15,16,0.45),0_8px_24px_-12px_rgba(15,15,16,0.25)] ${
        fill ? "flex h-full flex-col" : ""
      } ${
        bezel
          ? /* A real bezel, so it needs real depth: thicker than the ring it
               replaces, drawn in the page's own darkest ink rather than a
               borrowed grey, and no border of its own — the value *is* the
               edge, and a hairline round a dark bezel reads as a seam. */
            "bg-lp-stage p-2 sm:p-3"
          : "border border-lp-edge bg-lp-ground p-1.5 sm:p-2"
      } ${picture ? "select-none" : ""}`}
    >
      {/* The glass carries the hairline and the rounding, so whatever is
          inside can be square-edged and simply be clipped by it. Ring and
          glass are both pale in daylight, and without that line between them
          the frame flattens back into a card. */}
      <div
        className={`overflow-hidden rounded-[1.05rem] border border-lp-line bg-lp-ground ${
          fill ? "min-h-0 flex-1" : ""
        }`}
      >
        {(title || badge) && (
          <div className="flex min-h-11 items-center gap-3 border-b border-lp-line bg-lp-well px-4 sm:px-5">
            {title && (
              <span className="min-w-0 truncate font-code text-[0.6875rem] tracking-[0.14em] text-lp-faint uppercase">
                {title}
              </span>
            )}
            {badge && <span className="ml-auto shrink-0">{badge}</span>}
          </div>
        )}

        <div
          ref={screenRef}
          {...(picture ? { "aria-hidden": true } : {})}
          style={screenStyle}
          className={screenClassName}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
