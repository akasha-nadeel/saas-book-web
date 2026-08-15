/*
 * Turns the three raw captures into the landing page's feature shots.
 *
 * Run with `node scripts/feature-shots.cjs` from the repo root; the captures live outside it, so
 * this is a one-shot tool rather than part of the build. Re-shoot and re-run it
 * when the Write, Tools or Collaborators screens change — a screenshot goes
 * stale silently, and nothing in the build will warn.
 *
 * **The frame is the whole window, uncropped.** An earlier pass cut each shot
 * down to its content and dropped the app's sidebar, on the grounds that the
 * sidebar repeats in all three and the UI is more legible at a larger scale.
 * The owner's call is the full screen, and it is defensible: the sidebar is
 * what makes each picture read as *one application* rather than three loose
 * panels, and at the size these sit on the page the type was never going to be
 * read word by word in either version — what a reader takes from a product
 * shot is the shape of the thing.
 *
 * **One thing is painted out, and only one.** Each capture has a browser
 * extension's floating button parked in the bottom-right corner. It is not
 * part of the product, and a stray control from somebody else's toolbar
 * sitting in a product shot reads as though it were. The patch is filled with
 * the median colour sampled from immediately beside it, so it takes the real
 * local background rather than a guessed white. Nothing else is retouched: a
 * screenshot that has been tidied is no longer evidence.
 *
 * **Quality.** The page already carries one picture that was squeezed to 49KB
 * at 1984x1326, and webp's ringing sat visibly on the small type. These are UI
 * shots whose entire content is small type, so they are written at quality 92
 * with `effort: 6`.
 *
 * The check printed is **PSNR against the source**, not bits per pixel. Bits
 * per pixel was tried first and is the wrong measure here: two of these screens
 * are mostly flat white, so they encode to about 0.3 bpp *and are still
 * visually lossless*, which made a bpp floor fire on the good cases and would
 * have pushed somebody into re-encoding them larger for nothing. Anything above
 * about 40 dB is indistinguishable at this size.
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC =
  "C:/Users/User/.claude/image-cache/6a7ad67c-b4f3-440b-89e7-d41db0de0250/";
const OUT = path.join(__dirname, "..", "public");

const JOBS = [
  ["376", "feature-shelf"],
  ["377", "feature-collab"],
  ["378", "feature-tools"],
];

/** The extension button's corner, measured on all three captures. */
const PATCH_W = 130;
const PATCH_H = 105;

/**
 * Trim a one-pixel border where the capture caught the browser window's own
 * edge — a solid black line, on the bottom of all three and the top of one.
 *
 * Measured rather than assumed: an edge counts only when nearly every pixel
 * along it is dark, so a screen whose content genuinely reaches the edge is
 * left alone. This is not cropping in the sense the frame is uncropped —
 * nothing of the app is lost — it is removing a hairline of somebody else's
 * window that would otherwise be drawn *inside* the page's rounded frame,
 * where it reads as a rule across the bottom of the screenshot.
 */
async function edgeTrim(img, m) {
  const dark = async (box) => {
    const buf = await img.clone().extract(box).greyscale().raw().toBuffer();
    return buf.reduce((a, v) => a + (v < 100 ? 1 : 0), 0) / buf.length;
  };
  const top = (await dark({ left: 0, top: 0, width: m.width, height: 1 })) > 0.9 ? 1 : 0;
  const bottom =
    (await dark({ left: 0, top: m.height - 1, width: m.width, height: 1 })) > 0.9 ? 1 : 0;
  return { top, bottom };
}

/** Median colour of a strip beside the patch, so the fill matches its ground. */
async function groundBeside(img, box) {
  const strip = { left: box.left - 40, top: box.top, width: 30, height: box.height };
  const { data, info } = await img
    .clone()
    .extract(strip)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = [[], [], []];
  for (let i = 0; i < data.length; i += info.channels) {
    ch[0].push(data[i]);
    ch[1].push(data[i + 1]);
    ch[2].push(data[i + 2]);
  }
  const mid = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  return { r: mid(ch[0]), g: mid(ch[1]), b: mid(ch[2]) };
}

(async () => {
  for (const [n, name] of JOBS) {
    const img = sharp(SRC + n + ".png");
    const m = await img.metadata();

    const box = {
      left: m.width - PATCH_W,
      top: m.height - PATCH_H,
      width: PATCH_W,
      height: PATCH_H,
    };
    const ground = await groundBeside(img, box);

    const patch = await sharp({
      create: {
        width: box.width,
        height: box.height,
        channels: 3,
        background: ground,
      },
    })
      .png()
      .toBuffer();

    const trim = await edgeTrim(img, m);
    const cleaned = await img
      .clone()
      .composite([{ input: patch, left: box.left, top: box.top }])
      .extract({
        left: 0,
        top: trim.top,
        width: m.width,
        height: m.height - trim.top - trim.bottom,
      })
      .png()
      .toBuffer();

    const dest = path.join(OUT, name + ".webp");
    await sharp(cleaned).webp({ quality: 92, effort: 6 }).toFile(dest);

    const a = await sharp(cleaned).greyscale().raw().toBuffer();
    const b = await sharp(dest).greyscale().raw().toBuffer();
    let se = 0;
    for (let i = 0; i < a.length; i++) se += (a[i] - b[i]) ** 2;
    const psnr = 10 * Math.log10((255 * 255) / (se / a.length));

    console.log(
      name.padEnd(16),
      `${m.width}x${m.height}`,
      "trim " + JSON.stringify(trim),
      (fs.statSync(dest).size / 1024).toFixed(0).padStart(3) + "KB",
      "PSNR " + psnr.toFixed(1) + " dB",
      `ground rgb(${ground.r},${ground.g},${ground.b})`,
      psnr > 40 ? "ok" : "<-- VISIBLE LOSS, raise quality",
    );
  }
})();
