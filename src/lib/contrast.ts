/**
 * How readable one colour is against another.
 *
 * **Written because the app grew nine themes and a claim about them.** A
 * palette can be chosen by eye and look convincing while one of its pairs sits
 * at 3:1 — which is legible in a screenshot, at the size a designer looks at
 * it, and tiring at 11px for a working day. WCAG's ratio is the only thing here
 * that settles that argument, so it is computed rather than assumed and a test
 * holds every theme to it.
 *
 * This is the AA arithmetic and nothing more: sRGB, no alpha, no perceptual
 * model. Colours that arrive with transparency are the caller's problem —
 * `color-mix` and `rgb(… / …)` cannot be read against a ground without knowing
 * what is behind them, so `parseHex` answers null and the caller skips rather
 * than guessing.
 */

/** The floor for body text and anything read rather than glanced at. */
export const AA_TEXT = 4.5;

/**
 * The floor for a hairline.
 *
 * Not a WCAG figure — the standard has nothing to say about a divider, which is
 * neither text nor a control. It is a floor for "visible at all": below about
 * 1.2 a rule between two surfaces is a rule the eye cannot find, which is how a
 * panel loses its edge and reads as one flat wash.
 */
export const RULE_MIN = 1.2;

/** `#abc` or `#aabbcc` to its three channels. Null for anything else. */
export function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;

  if (hex.length === 3) {
    const [r, g, b] = [...hex].map((c) => parseInt(c + c, 16));
    return [r, g, b];
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  /* Eight digits is a hex with alpha, which cannot be measured against a ground
     without knowing the ground behind *it*. Refused rather than truncated. */
  return null;
}

/**
 * Relative luminance, per WCAG 2.
 *
 * The channel curve is the specification's own, not a gamma of 2.2: they differ
 * most in the dark end, which is exactly where this app's themes live.
 */
export function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The ratio between two colours, from 1 (identical) to 21 (black on white).
 *
 * Order does not matter — the lighter of the two is always the numerator, which
 * is why this takes two colours rather than "ink" and "ground".
 */
export function contrast(a: string, b: string): number | null {
  const one = parseHex(a);
  const two = parseHex(b);
  if (!one || !two) return null;

  const first = luminance(one);
  const second = luminance(two);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
