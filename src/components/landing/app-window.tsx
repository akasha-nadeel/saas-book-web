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
      className={`rounded-[1.4rem] border border-lp-edge bg-lp-ground p-1.5 shadow-[0_28px_70px_-28px_rgba(15,15,16,0.45),0_8px_24px_-12px_rgba(15,15,16,0.25)] sm:p-2 ${
        picture ? "select-none" : ""
      }`}
    >
      {/* The glass carries the hairline and the rounding, so whatever is
          inside can be square-edged and simply be clipped by it. Ring and
          glass are both pale in daylight, and without that line between them
          the frame flattens back into a card. */}
      <div className="overflow-hidden rounded-[1.05rem] border border-lp-line bg-lp-ground">
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
