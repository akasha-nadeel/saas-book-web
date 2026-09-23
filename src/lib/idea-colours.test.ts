import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AA_TEXT, contrast, parseHex } from "./contrast";
import { IDEA_COLOURS } from "./ideas";
import { TINTS } from "./library-store";

/**
 * The idea board's six grounds, held to the floor in every palette they land
 * in.
 *
 * **This reads `globals.css` rather than a second copy of the values**, the
 * shape `theme-tints.test.ts` and `launch.test.ts` both use: one source, and a
 * test that holds it to its promises. It exists because a card's ground is not
 * written anywhere — it is `color-mix(in srgb, var(--idea-N) var(--idea-wash),
 * var(--color-panel))`, so there are six hues × eight palettes = forty-eight
 * grounds that nobody ever typed and nobody can eyeball. A hue that looks
 * pleasant on white can put `--color-fg` at 3:1 over one tint's panel, which
 * is legible in a screenshot and tiring at 13px for an afternoon.
 *
 * Choosing an sRGB mix in the CSS is what makes this possible: the blend is a
 * plain per-channel average, so the exact colour the browser paints can be
 * computed here. An oklab mix would have needed a colour-space implementation
 * in the test, and a value that cannot be checked is a value that drifts.
 *
 * **If a hue cannot make a palette that passes, the hue changes and not the
 * floor** — the same rule `theme-tints.test.ts` states for the themes.
 */

const CSS = readFileSync("src/app/globals.css", "utf8");

/** Every `--color-*` and `--idea-*` a block states. */
function tokensOf(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) return {};
  const block = CSS.slice(start, CSS.indexOf("\n}", start));

  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = line.match(/--((?:color|idea)-[a-z0-9-]+):\s*([^;]+);/);
    if (match) out[match[1]] = match[2].trim().replace(/\/\*.*$/, "").trim();
  }
  return out;
}

/* `@theme` is the dark set and the base every other block re-points from, so a
   palette's real value for a token is its own falling back to this — exactly
   how the cascade resolves it in the browser. */
const BASE = tokensOf("@theme");
const SCHEMES = {
  light: tokensOf('[data-theme="light"]'),
  dark: tokensOf('[data-theme="dark"]'),
};

/**
 * The eight palettes a card can land on, each with the scheme it runs under.
 *
 * **A tint sets `data-tint` and takes its scheme from `data-theme`**, which is
 * the whole reason the hues are stated in three blocks rather than eight — so
 * a tint's grounds are its own `--color-panel` mixed with its *scheme's* hues,
 * and the test has to resolve them the same way the browser does.
 */
const PALETTES: {
  name: string;
  scheme: "light" | "dark";
  tokens: Record<string, string>;
}[] = [
  { name: "dark", scheme: "dark", tokens: BASE },
  { name: "light", scheme: "light", tokens: SCHEMES.light },
  ...TINTS.map((tint) => ({
    name: tint.id,
    scheme: tint.scheme,
    tokens: tokensOf(`[data-tint="${tint.id}"]`),
  })),
];

/** A token as that palette resolves it: its own, then its scheme's, then base. */
function valueOf(
  palette: (typeof PALETTES)[number],
  token: string,
): string {
  return (
    palette.tokens[token] ?? SCHEMES[palette.scheme][token] ?? BASE[token] ?? ""
  );
}

/** What `color-mix(in srgb, hue pct, ground)` actually paints. */
function mix(hue: string, ground: string, percent: number): string {
  const a = parseHex(hue);
  const b = parseHex(ground);
  if (!a || !b) return "";
  const channel = (i: number) =>
    Math.round(a[i] * percent + b[i] * (1 - percent));
  return `#${[0, 1, 2]
    .map((i) => channel(i).toString(16).padStart(2, "0"))
    .join("")}`;
}

const pct = (value: string) => Number.parseFloat(value) / 100;
const HUES = Object.keys(BASE).filter((name) => /^idea-\d+$/.test(name));

describe("the idea board's grounds", () => {
  it("declares as many hues as the code reaches for", () => {
    // A seventh nobody picks is invisible; a sixth that is missing is a card
    // with no ground at all. Neither shows up anywhere but here.
    expect(HUES).toHaveLength(IDEA_COLOURS);
  });

  it("states both scheme sets, not just one", () => {
    // Without a set in the dark block, `data-theme="dark"` on a subtree of a
    // light tree inherits the pale hues and the board comes out washed out on
    // black — the same hole the dark block was written to close.
    for (const [name, tokens] of Object.entries(SCHEMES)) {
      const hues = Object.keys(tokens).filter((k) => /^idea-\d+$/.test(k));
      expect(hues, name).toHaveLength(IDEA_COLOURS);
      for (const key of ["idea-wash", "idea-edge-wash", "idea-meta-dim"]) {
        expect(tokens[key], `${name}: ${key}`).toBeTruthy();
      }
    }
  });

  it("states washes the mixes can use", () => {
    for (const palette of PALETTES) {
      for (const key of ["idea-wash", "idea-meta-dim"]) {
        const value = pct(valueOf(palette, key));
        expect(Number.isFinite(value), `${palette.name}: ${key}`).toBe(true);
        expect(value, `${palette.name}: ${key}`).toBeGreaterThan(0);
        expect(value, `${palette.name}: ${key}`).toBeLessThan(1);
      }
    }
  });

  it("finds all eight palettes in the stylesheet", () => {
    // A selector renamed out from under this test would otherwise make it pass
    // by checking nothing.
    for (const palette of PALETTES) {
      expect(Object.keys(palette.tokens).length, palette.name).toBeGreaterThan(
        10,
      );
    }
  });

  it.each(PALETTES.map((p) => p.name))(
    "keeps body text legible on every ground in %s",
    (name) => {
      const palette = PALETTES.find((p) => p.name === name)!;
      const WASH = pct(valueOf(palette, "idea-wash"));
      const DIM = pct(valueOf(palette, "idea-meta-dim"));
      const panel = valueOf(palette, "color-panel");
      const fg = valueOf(palette, "color-fg");

      for (const hue of HUES) {
        const ground = mix(valueOf(palette, hue), panel, WASH);
        expect(ground, `${name}: ${hue} did not mix`).not.toBe("");

        const ink = contrast(fg, ground);
        expect(ink, `${name}: fg on ${hue}`).not.toBeNull();
        expect(ink ?? 0, `${name}: fg on ${hue}`).toBeGreaterThanOrEqual(
          AA_TEXT,
        );

        /* The date and the two actions, which are `fg` dimmed towards the
           card's own ground. **They are text and not decoration**, so they
           answer to the same floor — the line `theme-tints.test.ts` draws
           about `muted`. This is the check that sent `--color-muted` off
           these cards in the first place: the six tints already ship it under
           AA against a plain panel, and a hue on top took the dark three to
           3.76. */
        const small = mix(ground, fg, DIM);
        const meta = contrast(small, ground);
        expect(meta ?? 0, `${name}: small print on ${hue}`).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      }
    },
  );

  it("keeps a card's edge findable against its own ground", () => {
    // The border is the same hue, harder. Set the two close together and the
    // card loses its edge in every palette at once.
    for (const palette of PALETTES) {
      const wash = pct(valueOf(palette, "idea-wash"));
      const edge = pct(valueOf(palette, "idea-edge-wash"));
      expect(edge, palette.name).toBeGreaterThan(wash * 1.25);
      expect(edge, palette.name).toBeLessThanOrEqual(1);
    }
  });
});
