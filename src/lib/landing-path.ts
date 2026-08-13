/**
 * The arithmetic behind the landing page's winding order path.
 *
 * The section draws the five phases as stations on a single curve, with a
 * marker that rides down it as the reader scrolls; the station the marker has
 * reached is at full strength and the rest are dimmed. Three questions decide
 * all of that, and all three are arithmetic rather than drawing, so they live
 * here where they can be tested and the component stays a component.
 *
 * **The component measures, this module decides.** Where the stations actually
 * sit on screen is a layout question — it changes with the viewport, with the
 * font, with how a sentence happens to wrap — so the component reads their real
 * positions and hands them over. Nothing here knows a breakpoint or a class
 * name, which is what lets one code path serve the phone and the desktop: the
 * curve is drawn through wherever the stations landed.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * A smooth SVG path through every one of these points, in order.
 *
 * **Catmull-Rom converted to cubic Bézier**, which is the standard way to get a
 * curve that actually passes *through* its points rather than being pulled
 * near them. A plain Bézier through the same points would sag away from the
 * stations, and the stations are the whole point — a marker that rides the
 * curve has to arrive at the dot the reader is looking at.
 *
 * The conversion is the textbook one: for a segment from `b` to `c`, with `a`
 * and `d` the points either side, the control points are `b + (c - a)/6` and
 * `c - (d - b)/6`. At the two ends the missing neighbour is the endpoint
 * itself, which is what stops the curve flicking outwards as it starts and
 * finishes.
 *
 * `slack` scales those control arms. At 1 it is the true Catmull-Rom curve; at
 * 0 it is straight lines. It is here because the right amount of wander is a
 * *drawing* decision made against a particular layout, and a number the caller
 * passes is honest about that where a constant buried in the maths would not
 * be. Below about 0.5 the curve stops reading as a line somebody drew and
 * starts reading as a chart.
 *
 * Fewer than two points draws nothing: one station is not a road, and an `M`
 * with no line after it is an empty path that still reports a length, which
 * would have the marker riding a curve nobody can see.
 */
export function curveThrough(points: Point[], slack = 1): string {
  if (points.length < 2) return "";

  const at = (i: number) =>
    points[Math.max(0, Math.min(points.length - 1, i))]!;

  let d = `M ${round(points[0]!.x)} ${round(points[0]!.y)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const a = at(i - 1);
    const b = at(i);
    const c = at(i + 1);
    const e = at(i + 2);

    const c1 = {
      x: b.x + ((c.x - a.x) / 6) * slack,
      y: b.y + ((c.y - a.y) / 6) * slack,
    };
    const c2 = {
      x: c.x - ((e.x - b.x) / 6) * slack,
      y: c.y - ((e.y - b.y) / 6) * slack,
    };

    d += ` C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(c.x)} ${round(c.y)}`;
  }

  return d;
}

/** Two decimals is a tenth of a pixel on a 4K screen, and it halves the string. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Where the reading line sits down the window, as a fraction of it.
 *
 * The middle, which is where every scrollytelling piece puts it and for the
 * reason it survives: it is the only line on the screen that is equally far
 * from both edges, so a station arriving there has the reader's attention
 * whichever direction they are scrolling.
 */
export const READING_LINE = 0.5;

/**
 * How far the reader has travelled through the section, 0 to 1.
 *
 * **The marker *is* the reading line, and that is not a metaphor.** Progress is
 * the reading line's position measured inside the section, so multiplying it
 * back by the section's height puts the marker exactly on that line for as long
 * as the section is crossing it. The marker therefore never appears to lag or
 * race the scroll — it cannot, because it is drawn at the one place the reader
 * is already looking. What moves is its *horizontal* position, which the curve
 * decides, and that is the whole effect.
 *
 * Clamped at both ends, so the marker parks on the first station before the
 * section arrives and on the last one after it has gone rather than sliding off
 * the ends of the road.
 *
 * A section of no height reads as finished rather than as a division by zero:
 * nothing is left to travel through.
 */
export function progressOf(
  top: number,
  height: number,
  viewport: number,
  line = READING_LINE,
): number {
  if (height <= 0) return 1;
  return clamp((viewport * line - top) / height, 0, 1);
}

/**
 * How lit a station is, from how far the marker is from it — 1 at the station,
 * 0 beyond `reach`.
 *
 * **Smoothstep rather than a straight ramp**, because the ease is what makes
 * this read as attention moving rather than as a value being computed: a linear
 * fade arrives and departs at full speed, which the eye catches as two hard
 * edges at the ends of each station's turn.
 *
 * Distance is taken as given rather than signed, so a station reads the same
 * approaching as leaving. That is deliberate — the alternative, holding a
 * station lit once passed, ends with every station lit by the foot of the
 * section and nothing to show for the scroll.
 *
 * A `reach` of nothing lights only an exact hit, which is the safe answer for a
 * degenerate layout: it dims everything rather than lighting everything.
 */
export function focus(distance: number, reach: number): number {
  if (reach <= 0) return distance === 0 ? 1 : 0;
  const t = clamp(1 - Math.abs(distance) / reach, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * What that becomes on screen: an opacity between `dim` and 1.
 *
 * **`dim` is a floor rather than a fade to nothing**, and the floor is the
 * accessible half of this effect. Every station is a real sentence about the
 * book somebody is trying to publish, and a station at 0.1 is text that has
 * been taken away from a reader who is not scrolling — including one who
 * cannot. At the floor these stay legible; the lighting says *this is the one*
 * rather than *the others are not for you*.
 */
export function litness(distance: number, reach: number, dim: number): number {
  return dim + (1 - dim) * focus(distance, reach);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
