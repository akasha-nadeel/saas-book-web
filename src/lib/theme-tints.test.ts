import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AA_TEXT, RULE_MIN, contrast, parseHex } from "./contrast";
import { TINTS } from "./library-store";

/**
 * The six named themes, held to the floors their block claims to clear.
 *
 * **This reads `globals.css` rather than a second copy of the values**, which
 * is the shape `credits.test.ts` already uses against the SQL migration: one
 * source, and a test that holds it to its promises. A palette can be chosen by
 * eye and look convincing while one of its pairs sits at 3:1 — legible in a
 * screenshot at the size a designer looks at it, and tiring at 11px for a
 * working day.
 *
 * If a swatch cannot make a theme that passes, **the theme changes and not the
 * floor**.
 */

const CSS = readFileSync("src/app/globals.css", "utf8");

/** Every `--color-*` a `[data-tint="…"]` block states, in declaration order. */
function tokensOf(tint: string): Record<string, string> {
  const start = CSS.indexOf(`[data-tint="${tint}"] {`);
  if (start === -1) return {};
  const end = CSS.indexOf("\n}", start);
  const block = CSS.slice(start, end);

  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = line.match(/--color-([a-z-]+):\s*([^;]+);/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

const BLOCKS = Object.fromEntries(
  TINTS.map((tint) => [tint.id, tokensOf(tint.id)]),
);

describe("the named themes", () => {
  it("all have a block in globals.css", () => {
    for (const tint of TINTS) {
      expect(Object.keys(BLOCKS[tint.id]).length, tint.id).toBeGreaterThan(10);
    }
  });

  /**
   * CLAUDE.md's rule that a token stated in one block must be stated in the
   * other, enforced rather than remembered — a name in five blocks of six is a
   * hairline nobody notices for a month, because the sixth theme silently keeps
   * whatever the base scheme had.
   */
  it("all state exactly the same token names", () => {
    const names = TINTS.map(
      (tint) => [tint.id, Object.keys(BLOCKS[tint.id]).sort()] as const,
    );
    const [, first] = names[0];
    for (const [id, set] of names) expect(set, id).toEqual(first);
  });

  it.each(TINTS.map((t) => [t.id, t.name] as const))(
    "%s is readable",
    (id) => {
      const t = BLOCKS[id];

      const ratio = (a: string, b: string) => {
        const value = contrast(t[a], t[b]);
        // A token that is a `color-mix` cannot be measured against a ground —
        // there is no ground behind it yet. `selected` is the only one, and it
        // is a wash over a surface rather than something read.
        expect(value, `${id}: ${a} on ${b} is not a plain colour`).not.toBeNull();
        return value ?? 0;
      };

      // Body text, and the panels it is read on.
      expect(ratio("fg", "surface"), `${id} fg/surface`).toBeGreaterThanOrEqual(AA_TEXT);
      expect(ratio("fg", "panel"), `${id} fg/panel`).toBeGreaterThanOrEqual(AA_TEXT);

      // `muted` sets hints and metadata. That is text, not decoration.
      expect(ratio("muted", "surface"), `${id} muted/surface`).toBeGreaterThanOrEqual(AA_TEXT);

      /* The pair CLAUDE.md works through for the indigo, and the one that
         catches a pretty theme you cannot read a button on: the accent has to
         be legible *as a link* on the ground, and its own ink legible *on it*
         as a fill. */
      expect(ratio("accent", "surface"), `${id} accent/surface`).toBeGreaterThanOrEqual(AA_TEXT);
      expect(ratio("accent-ink", "accent"), `${id} ink/accent`).toBeGreaterThanOrEqual(AA_TEXT);

      // A hairline the eye can find. Not a WCAG figure — see `RULE_MIN`.
      expect(ratio("line", "surface"), `${id} line/surface`).toBeGreaterThanOrEqual(RULE_MIN);
      expect(ratio("lifted-line", "lifted"), `${id} liftedLine/lifted`).toBeGreaterThanOrEqual(RULE_MIN);
    },
  );

  it("gives every theme a ground distinguishable from its panels", () => {
    // Not a contrast floor — a sameness floor. A panel that matches the desk
    // it lies on is not a panel, which is the note `[data-paper="black"]`
    // makes about a sheet.
    for (const tint of TINTS) {
      const t = BLOCKS[tint.id];
      expect(t.surface, tint.id).not.toBe(t.panel);
      expect(t.surface, tint.id).not.toBe(t.raised);
    }
  });

  /**
   * The one duplication in the theming: the bootstrap script is inline and
   * cannot import `TINTS`, so it repeats the six names and their schemes. This
   * is what stops the two drifting.
   */
  it("agrees with the bootstrap script's own map", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const map = layout.match(/var M=\{([^}]*)\}/);
    expect(map, "the bootstrap's tint map").not.toBeNull();

    const pairs = Object.fromEntries(
      map![1].split(",").map((entry) => {
        const [name, scheme] = entry.split(":");
        return [name.trim(), scheme.trim().replace(/'/g, "")];
      }),
    );

    expect(Object.keys(pairs).sort()).toEqual(TINTS.map((t) => t.id).sort());
    for (const tint of TINTS) expect(pairs[tint.id], tint.id).toBe(tint.scheme);
  });

  it("shows every seed as a colour the picker can paint", () => {
    // The swatch is painted straight from `TINTS`, so a seed that is not a
    // plain hex is a blank circle in the picker.
    for (const tint of TINTS) {
      expect(parseHex(tint.seed), tint.id).not.toBeNull();
    }
  });
});
