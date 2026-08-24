/**
 * The geometry behind a sparkline, kept out of the component that draws one.
 *
 * A polyline through fourteen daily totals is honest and looks like a seismograph
 * — every day a corner, and the eye reads the corners rather than the shape. A
 * smoothed curve reads as the trend it is, and it is *the same data*: every
 * point is still on the line, and nothing between two days is claimed to have
 * been measured. That is the line this module will not cross — the curve may
 * bend between two real points, it may never invent a third.
 *
 * Pure, so the arithmetic can be tested without a DOM, and because a chart path
 * that silently drops its first point is exactly the kind of bug that looks
 * like a design choice.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * A Catmull-Rom spline through every point, written as SVG cubic segments.
 *
 * Catmull-Rom rather than a hand-rolled quadratic because it is *interpolating*
 * — the curve passes through each control point instead of being pulled towards
 * it, which is the whole requirement here. The tension is fixed at the standard
 * 1/6: enough to round the corners, not enough to overshoot into a value the
 * day never had.
 *
 * Fewer than two points has no line in it and returns an empty string, which
 * renders as nothing rather than as a stray dot.
 */
export function smoothPath(points: Point[]): string {
  if (points.length < 2) return "";

  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  let d = `M${round(points[0].x)},${round(points[0].y)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const before = at(i - 1);
    const from = at(i);
    const to = at(i + 1);
    const after = at(i + 2);

    const c1 = {
      x: from.x + (to.x - before.x) / 6,
      y: from.y + (to.y - before.y) / 6,
    };
    const c2 = {
      x: to.x - (after.x - from.x) / 6,
      y: to.y - (after.y - from.y) / 6,
    };

    d +=
      `C${round(c1.x)},${round(c1.y)} ` +
      `${round(c2.x)},${round(c2.y)} ` +
      `${round(to.x)},${round(to.y)}`;
  }

  return d;
}

/**
 * The same curve, closed down to a floor so it can be filled.
 *
 * Built from `smoothPath` rather than beside it, so the fill and the line can
 * never disagree about where the curve went.
 */
export function smoothArea(points: Point[], floor: number): string {
  const line = smoothPath(points);
  if (!line) return "";

  const first = points[0];
  const last = points[points.length - 1];
  return `${line}L${round(last.x)},${round(floor)} L${round(first.x)},${round(floor)} Z`;
}

/** Two decimals is finer than any screen this is drawn on. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
