/*
 * Lifts a flat drawing off its background, for the app's two illustrations.
 *
 *   node scripts/cut-illustration.cjs <source> <out.webp> [width]
 *
 * Both sources live outside the tree, like the feature shots' captures, so this
 * is a one-shot tool rather than part of the build. What it has made:
 *
 *   public/upgrade-card.webp  the figure on the dashboard's Pro card
 *   public/write-band.webp    the desk on the Write area's band
 *
 * **A flood fill from the border, not a colour key.** The phone screen, the
 * speech bubble and the laptop lid are white too, and a key would punch holes
 * in all three. Only the background is connected to the edge of the frame.
 *
 * Two things it then tidies: the anti-aliased rim, which would otherwise draw a
 * pale outline round the figure on a dark card, and any hairline the drawing
 * rests on, which reads as a scratch once the ground under it is gone.
 */
const sharp = require("sharp");

const SRC = process.argv[2];
const OUT = process.argv[3];
const WIDTH = Number(process.argv[4] || 1100);

if (!SRC || !OUT) {
  console.error("usage: node scripts/cut-illustration.cjs <source> <out.webp> [width]");
  process.exit(1);
}

// The faint rays behind the figure sit a few units either side of 243, so the
// test is "light and unsaturated" rather than an exact match.
const isBackground = (r, g, b) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 225 && max - min <= 10;
};

(async () => {
  const img = sharp(SRC).resize({ width: WIDTH });
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: ch } = info;
  const seen = new Uint8Array(w * h);
  const stack = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    const p = i * ch;
    if (!isBackground(data[p], data[p + 1], data[p + 2])) return;
    seen[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    data[i * ch + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  /* One pass over what is left: a pixel that still carries background colour
     but touches a cleared one is the anti-aliased rim of the cut, and left
     opaque it draws a pale outline round the figure on a dark card. */
  const cleared = (x, y) =>
    x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * ch + 3] === 0;

  const soften = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * ch;
      if (data[p + 3] === 0) continue;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      if (min < 200 || max - min > 24) continue;
      if (cleared(x + 1, y) || cleared(x - 1, y) || cleared(x, y + 1) || cleared(x, y - 1)) {
        // Darker than the background means it is partly the figure; keep that
        // share of it rather than cutting a notch out of the outline.
        soften.push([p, Math.max(0, Math.min(255, (243 - min) * 8))]);
      }
    }
  }
  for (const [p, alpha] of soften) data[p + 3] = alpha;

  /* The ground line goes too.
   *
   * The drawing rests on a hairline that runs the width of the frame. It is not
   * background — it is darker than the fill, so the flood leaves it — and on the
   * card it reads as two stray scratches either side of the figure's coat.
   *
   * Found by shape rather than by colour, because it is the same navy as the
   * hair and the sparkles: a pixel belongs to it when nothing is drawn five
   * rows above or below it *and* the same is true 25 columns to either side.
   * A sparkle's point is thin but nothing is thin for fifty pixels across.
   */
  const alphaAt = (x, y) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * ch + 3];

  const thin = (x, y) =>
    alphaAt(x, y) !== 0 &&
    alphaAt(x, y - 5) === 0 &&
    alphaAt(x, y + 5) === 0;

  /* The test either side is "nothing thick here", not "more line here" —
     otherwise the two ends of the line keep a stub 25px long, because past the
     end there is nothing drawn at all and a strict test reads that as a wall. */
  const clearOrThin = (x, y) => alphaAt(x, y) === 0 || thin(x, y);

  /* Seeds first, then the line is followed along itself.
     A seed proves there is a hairline here; walking outwards from it over
     neighbouring thin pixels takes the rest of it, and stops where the line
     runs under the coat — a pixel with the coat five rows above it is not thin,
     so the walk cannot eat into the figure. Testing every pixel against the
     25px rule instead would leave a stub that long at each end. */
  const onLine = new Uint8Array(w * h);
  const queue = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!thin(x, y)) continue;
      if (clearOrThin(x - 25, y) && clearOrThin(x + 25, y)) {
        onLine[y * w + x] = 1;
        queue.push([x, y]);
      }
    }
  }

  let scratches = 0;
  while (queue.length) {
    const [x, y] = queue.pop();
    data[(y * w + x) * ch + 3] = 0;
    scratches++;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (onLine[ny * w + nx] || !thin(nx, ny)) continue;
        onLine[ny * w + nx] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  const info2 = await sharp(data, { raw: { width: w, height: h, channels: ch } })
    .trim({ threshold: 0 })
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(OUT);

  const kept = [...Array(w * h)].filter((_, i) => data[i * ch + 3] !== 0).length;
  console.log(
    `${OUT} ${info2.width}x${info2.height} ${Math.round(info2.size / 1024)}KB · ` +
      `${Math.round((kept / (w * h)) * 100)}% of the frame kept`,
  );
})();
