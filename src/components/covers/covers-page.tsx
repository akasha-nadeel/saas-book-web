"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { buildQuery, coversOf, type CompTitle } from "@/lib/comps/comps";
import {
  contrastOf,
  COVER_TYPES,
  edgeLightness,
  jpegComponents,
  coverReport,
  enlarge,
  IDEAL_HEIGHT,
  IDEAL_RATIO,
  reshape,
  type CoverCheck,
  type CoverFacts,
} from "@/lib/cover-check";
import {
  bookWordCount,
  findBook,
  getCover,
  getCoverFacts,
  setCoverFacts,
} from "@/lib/library-store";
import { ToolStepDone } from "@/components/ui/tool-save";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { saveCover } from "@/lib/cover-save";
import { useToolSave } from "@/lib/use-tool-save";
import {} from "@/lib/image-import";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";
import { toolShell, type ToolPageProps } from "@/lib/tool-page";

/**
 * Covers, in the only two ways we can honestly help with one.
 *
 * Covers are the loudest sales pain in the research — a bad one sinks a good
 * book, and a good one costs a thousand pounds. We cannot design covers, and
 * the cheap way to would be generative, which this product has said in public
 * it will not do. So this module is the two things that are left, and they
 * divide cleanly:
 *
 * - **`CoversPage`, the wall.** Twenty covers already selling in the same
 *   genre — what a writer would do themselves given a bookshop and an
 *   afternoon. The wall loads on arrival — the query is built from the book's
 *   own genre and blurb — because a search box over an empty page asks a
 *   writer to describe their book in words a catalogue will answer, which is
 *   the part nobody guesses cold. The size control is the feature rather than
 *   a convenience: nobody buys a book at the size a cover is designed at, they
 *   see it sixty pixels wide next to nine others and decide in about a second.
 *   A cover whose title cannot be read at 60px has a problem no amount of
 *   admiring it at full size will reveal — which is what Thumbnail is for, one
 *   press from the Large the wall opens at.
 *
 *   **The writer's own cover is the first tile in that wall**, and the route
 *   there is worth knowing. It began as a "Yours" panel above the shelf, came
 *   off on 2026-08-11 for being a large card holding one picture and a lot of
 *   empty desk, and came back the same day *inside* the wall rather than
 *   above it. That is the better answer and not merely a smaller one: a cover
 *   in its own frame at its own size always looks fine, which is precisely
 *   the illusion this tool exists to break. In the wall it takes the size
 *   control with everything else, so Thumbnail sets it at 60px against thirty
 *   real competitors at 60px — the comparison the screen is named for, which
 *   a separate panel could not make.
 *
 * - **`CoverChecker`, the file.** Whether a shop will refuse it: dimensions,
 *   shape, weight, contrast. Mechanical, and that is the whole list.
 *
 * **Neither half scores anything.** No palette analysis, no "34% less saturated
 * than your genre" — partly because reading pixels off another origin's image
 * needs CORS headers neither catalogue reliably sends, and mostly because it
 * would be a number invented to look like an answer. The two things that
 * actually decide a cover — is the title readable small, does it look like its
 * genre — are answered by looking. Looking is the skill being lent.
 */

/**
 * Choose what shows, before anything is written.
 *
 * Pressing "Crop to fit" used to download immediately, which is the wrong
 * shape of interaction for the one operation on this screen that *throws part
 * of a cover away*: a crop takes 1,084 pixels off a 1,672px-wide picture, and
 * which 1,084 is the entire question. Centred is a guess, and on a cover whose
 * subject sits left of frame it is usually the wrong one.
 *
 * So it opens where every tool that crops for a living opens — a frame at the
 * target shape with the picture live inside it and the picture draggable. What
 * you see in the frame is what gets written; there is no second interpretation
 * step between the preview and the file.
 *
 * **Padding is draggable too**, which is less obvious and still right: the bars
 * fall somewhere, and a cover with its title near the top wants them below it
 * rather than split evenly.
 *
 * `place` is the image's top-left on the output canvas, in output pixels —
 * negative for a crop, positive for a pad — so the preview and `writeShape`
 * share one number and cannot disagree about what was shown.
 */
function ShapeDialog({
  src,
  out,
  label,
  onCancel,
  onCreate,
  onUse,
}: {
  src: string;
  /** The plan: frame size, the artwork's rendered size, and the scale used. */
  out: {
    id: "crop" | "pad" | "enlarge";
    width: number;
    height: number;
    drawWidth: number;
    drawHeight: number;
    factor: number;
    tooSmall: boolean;
  };
  label: string;
  onCancel: () => void;
  onCreate: (place: { x: number; y: number }) => void;
  onUse: (place: { x: number; y: number }) => void;
}) {
  /* The slack in each axis, and the direction it runs. A crop has the image
     larger than the frame, so the offset is negative; a pad has it smaller, so
     the offset is positive. Both are "somewhere between 0 and D". */
  const dx = out.width - out.drawWidth;
  const dy = out.height - out.drawHeight;
  const bounds = {
    minX: Math.min(0, dx),
    maxX: Math.max(0, dx),
    minY: Math.min(0, dy),
    maxY: Math.max(0, dy),
  };

  const [place, setPlace] = useState({ x: dx / 2, y: dy / 2 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // Esc closes, like every other dialog in this app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  /* The frame is drawn at a readable size and the picture scaled to match, so
     one factor converts a pointer movement in CSS pixels into output pixels.
     Everything else is arithmetic in output pixels. */
  const FRAME = 260;
  const scale = FRAME / out.width;

  function clamp(next: { x: number; y: number }) {
    return {
      x: Math.min(bounds.maxX, Math.max(bounds.minX, next.x)),
      y: Math.min(bounds.maxY, Math.max(bounds.minY, next.y)),
    };
  }

  const canDrag = dx !== 0 || dy !== 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-fg">{label}</h3>
        <p className="mt-1 text-sm text-muted">
          {canDrag
            ? "Drag the picture to choose what shows. This frame is the file."
            : "This is the file."}
        </p>

        <div className="mt-4 flex justify-center">
          <div
            onPointerDown={(e) => {
              if (!canDrag) return;
              dragging.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const from = dragging.current;
              if (!from) return;
              setPlace((current) =>
                clamp({
                  x: current.x + (e.clientX - from.x) / scale,
                  y: current.y + (e.clientY - from.y) / scale,
                }),
              );
              dragging.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => {
              dragging.current = null;
            }}
            style={{ width: FRAME, height: out.height * scale }}
            className={`relative overflow-hidden rounded border border-line bg-surface ${
              canDrag ? "cursor-grab active:cursor-grabbing" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: place.x * scale,
                top: place.y * scale,
                width: out.drawWidth * scale,
                height: out.drawHeight * scale,
                maxWidth: "none",
              }}
            />
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-muted tabular-nums">
          {out.width} × {out.height}
          {out.tooSmall ? " · under the 1000px a shop asks for" : ""}
        </p>
        {/* Said in the dialog as well as on the button, because this is the
            last screen before the file exists and it is the one claim a writer
            could otherwise take the wrong way: the pixel count goes up and the
            picture does not get sharper. */}
        {out.factor > 1 && (
          <p className="mt-1.5 text-center text-xs text-muted">
            Scaled up {out.factor.toFixed(1)}× — passes the size check, carries
            no more detail.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-fg"
          >
            Cancel
          </button>
          {/* Two destinations, and the file is the primary one: this screen
              exists to prepare artwork for a shop, and the copy on the shelf
              here is a compressed thumbnail rather than the thing that gets
              uploaded. Setting it as the cover is genuinely useful and is the
              quieter of the two on purpose. */}
          <button
            type="button"
            onClick={() => onUse(place)}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-fg
                       hover:border-accent/40"
          >
            Use as my cover
          </button>
          <button
            type="button"
            onClick={() => onCreate(place)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
          >
            Download it
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A fill for the bars, taken from the cover's own corners.
 *
 * White bars round a dark cover read as a rendering fault in a shop's grid,
 * and black ones round a pale cover do the same. Averaging the four corners
 * lands close enough on almost every cover that the padding stops announcing
 * itself. Returns null when the canvas cannot be read — a cross-origin source
 * taints it — and the caller falls back to white rather than failing.
 */
function edgeColour(image: HTMLImageElement): string | null {
  try {
    const probe = document.createElement("canvas");
    probe.width = 2;
    probe.height = 2;
    const context = probe.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    // Squashing the whole image to 2×2 averages each quadrant for us.
    context.drawImage(image, 0, 0, 2, 2);
    const { data } = context.getImageData(0, 0, 2, 2);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = data.length / 4;
    return `rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})`;
  } catch {
    return null;
  }
}

/**
 * The other half: whether the *file* will be refused.
 *
 * Checks the artwork the writer is about to upload, not the copy this app
 * stores — that one is compressed to fit a 250KB cap and would fail a size
 * check it was never meant to pass. Saying so matters: a checker quietly
 * measuring the wrong file is worse than none.
 *
 * Everything happens in the browser. The image is read into a canvas to measure
 * contrast and then discarded; nothing is uploaded, which is both the honest
 * default and the only one consistent with the rest of the page.
 */
function CoverChecker({ bookId }: { bookId: string }) {
  /**
   * Why the writer came, from the dashboard's own link.
   *
   * They pressed "Fix the shape" on a finding and were sent here, so the crop
   * window is what they were promised. It cannot be opened on arrival — the
   * artwork is not kept, and there is nothing to crop until they hand it over
   * — so the intent waits in a ref and is spent on the first file that is
   * read. Spent once: a second file is a second decision, and re-opening the
   * window under somebody who has moved on is the kind of help that has to be
   * dismissed.
   */
  const params = useSearchParams();
  const askedFor = params.get("fix") ?? "";
  const [intent, setIntent] = useState(askedFor);
  /**
   * Whether a dashboard finding sent the writer here, rather than a rail link.
   *
   * **`check` and not `fix`, and the difference cost a picture.** Every cover
   * destination carries `?check=1`; only some carry a `fix=` intent, and once
   * the dashboard began folding several cover faults into one row (see
   * `findingsFrom`) the commonest arrival carried none at all. The stored cover
   * was loaded off the back of the *intent*, so pressing "Check the cover"
   * landed on an empty drop zone — the exact thing the note below says was
   * fixed. This is the arrival itself, which is what that behaviour was always
   * about.
   */
  const sentByFinding = params.get("check") !== null;

  /**
   * True when the picture loaded is the copy stored on the book rather than a
   * file the writer just handed over.
   *
   * The dashboard's "Fix the shape" used to land on an empty drop zone, which
   * is the wrong answer when the app is *already holding* a cover: it asked
   * the writer to go and find a file to fix a problem it could see, in a
   * picture it had. So the stored copy is opened instead.
   *
   * It is not the same picture and the screen has to say so. What is stored is
   * compressed to 700px to fit a browser, so cropping it puts the shape right
   * everywhere this app draws the book — the shelf, and the cover inside the
   * EPUB, which is the one that actually ships — while still being too small
   * for a shop's own upload. Fixing that needs the original, which is not
   * kept. Both halves are true and the writer is told both.
   */
  const [fromStored, setFromStored] = useState(false);

  const [facts, setFacts] = useState<CoverFacts | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  /** Which reshape is being previewed, or null when no dialog is open. */
  /** Which fix is being previewed. `draw` is the artwork's rendered size in
      output pixels — equal to its natural size for crop and pad, larger for an
      enlarge, which is the only mode that resamples. */
  const [shaping, setShaping] = useState<{
    id: "crop" | "pad" | "enlarge";
    width: number;
    height: number;
    drawWidth: number;
    drawHeight: number;
    factor: number;
    tooSmall: boolean;
  } | null>(null);
  /** What was just put right, shown in green until the next file or fix. */
  /* **A tone, not just a sentence.** This one slot carried three outcomes and
     painted all of them in `ok` green — including "this browser would not store
     the full-size copy", which is the one message on the screen that is not
     good news. A writer skims the colour before the words. */
  const [done, setDone] = useState<{
    text: string;
    tone: "ok" | "note";
  } | null>(null);

  /**
   * Throw away the checked file and everything said about it.
   *
   * Named rather than written at each button because there are two of them
   * now — one beside the artwork, one under the drop zone that stands where
   * the artwork would be — and a screen with two ways to clear a thing must
   * clear exactly the same things both times.
   *
   * The stored measurement goes with it: the dashboard reads `coverfacts:` for
   * its own findings, and it must not go on reporting a cover nobody is
   * checking any more.
   */
  function clearChecked() {
    setFacts(null);
    setPreview(null);
    setName(null);
    setError(null);
    setDone(null);
    setFromStored(false);
    setCoverFacts(bookId, null);
  }

  /**
   * Measure a file and report on it.
   *
   * `upscaledFrom` is passed only by the enlarge fix, which is the one caller
   * that *knows* the result is stretched — see `CoverFacts.upscaledFrom`. It is
   * recorded rather than detected, so it survives the reload that used to lose
   * the warning entirely.
   */
  async function read(
    file: File,
    upscaledFrom?: { width: number; height: number },
  ) {
    setError(null);
    setDone(null);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("not an image"));
        image.src = url;
      });

      /* **The colour mode, read off the bytes rather than the picture.**
         Only the head of the file is needed — the frame header sits before the
         image data, after however many EXIF and ICC segments a designer's tool
         left behind — so 256KB is generous and costs nothing on a local file.
         `jpegComponents` answers null for anything that is not a JPEG it can
         follow, and null stays null: the rule is dropped from the report
         rather than passed. */
      let components: number | undefined;
      try {
        const head = new Uint8Array(await file.slice(0, 262_144).arrayBuffer());
        components = jpegComponents(head) ?? undefined;
      } catch {
        // A file that cannot be re-read is not a reason to lose the six checks
        // that only need the picture.
      }

      // Contrast and edge lightness are measured on a small copy: a 2560px
      // cover is six million pixels and neither answer changes past a few
      // thousand. One canvas read serves both.
      let contrast: number | undefined;
      let edge: number | undefined;
      const canvas = document.createElement("canvas");
      canvas.width = 120;
      canvas.height = Math.max(
        1,
        Math.round((image.naturalHeight / image.naturalWidth) * 120),
      );
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        try {
          const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          contrast = contrastOf(pixels, 4);
          edge = edgeLightness(pixels, canvas.width, canvas.height);
        } catch {
          // A tainted canvas cannot be read. Every other check still works, so
          // these two notes are simply absent rather than the whole thing
          // failing.
        }
      }

      const measured: CoverFacts = {
        width: image.naturalWidth,
        height: image.naturalHeight,
        bytes: file.size,
        /* The browser's own sniffed type, not the extension: a `.jpg` that is
           really a PNG is refused by Amazon on what it *is*, and that is the
           writer who has no idea why. Empty for a type the browser cannot
           name, and the check is skipped rather than guessed at. */
        ...(file.type ? { type: file.type } : {}),
        ...(contrast !== undefined ? { contrast } : {}),
        ...(edge !== undefined ? { edge } : {}),
        ...(components !== undefined ? { components } : {}),
        ...(upscaledFrom ? { upscaledFrom } : {}),
      };
      setFacts(measured);
      setPreview(url);
      setFromStored(false);
      /* Kept so the dashboard can report the same findings. This is the only
         place the writer's real artwork is ever held — the copy on the book is
         compressed to fit a browser — so if these numbers are not written down
         here they cannot be known anywhere else. */
      setCoverFacts(bookId, measured);

      /* The window the dashboard promised, now that there is something to put
         in it — **but only if the file still has the problem it was promised
         for**.

         Spent on the first file either way, so it cannot fire on a later one.
         Opened only when the shape is actually off: a writer who fixed the
         cover elsewhere and dropped the corrected file was shown a crop window
         reading "This is the file", with nothing to drag and nothing to
         decide, over a check that had just told them the file was fine. A fix
         offered for a problem that is not there is worse than no offer — it
         makes the reader doubt the check that cleared it. */
      const stillOff =
        Math.abs(measured.height / measured.width - IDEAL_RATIO) > 0.05;
      if (intent === "shape") {
        setIntent("");
        if (stillOff) {
          const out = reshape(measured.width, measured.height, "crop");
          setShaping({
            id: "crop",
            width: out.width,
            height: out.height,
            drawWidth: measured.width,
            drawHeight: measured.height,
            factor: 1,
            tooSmall: out.tooSmall,
          });
        }
      }
    } catch {
      URL.revokeObjectURL(url);
      /* **A TIFF is not a broken file and must not be reported as one.**

         This screen tells writers Amazon takes JPEG *and* TIFF, which is true
         — and then no browser but Safari can decode a TIFF in an `<img>`, so a
         perfectly good cover arrived here and was told it "could not be read
         as an image". The screen contradicting its own advice, on the one
         format a careful designer is most likely to hand over.

         Nothing here can measure it — decoding TIFF would mean shipping a
         decoder for a format almost nobody drops — so the honest answer is to
         say which of the two things happened. A writer whose TIFF is fine
         needs to know it is fine and that we simply cannot look; a writer with
         a corrupt JPEG needs the opposite. Guessing from the file name as well
         as the type, since a `.tif` often arrives with no type at all. */
      const isTiff =
        file.type === "image/tiff" || /\.tiff?$/i.test(file.name ?? "");
      setError(
        isTiff
          ? "This is a TIFF, and browsers cannot open one — so it cannot be measured here. That is a limit of this page, not a problem with your file: Amazon accepts TIFF. Upload it as it is, or save a JPEG copy and drop that in to have it checked."
          : "That file could not be read as an image.",
      );
      setFacts(null);
      setPreview(null);
      setCoverFacts(bookId, null);
    }
  }

  /**
   * The reshaped copy, as bytes. One renderer, two destinations.
   *
   * **Nothing is uploaded** — the source is already in the browser as an object
   * URL and the result is a canvas. What happens to it afterwards is the
   * caller's business: a download, or the book's own cover.
   *
   * **One `drawImage` covers both modes**, which is why `place` is the image's
   * top-left *on the output canvas* rather than a source rectangle. Cropping is
   * a negative offset with the canvas clipping; padding a positive one. The
   * first version used the nine-argument form for both and put a negative
   * *source* offset into the pad case, which silently draws nothing.
   *
   * The destination size is the image's natural size either way, so the artwork
   * is copied 1:1 and never resampled.
   *
   * PNG: this re-wraps somebody's finished artwork, and re-encoding it lossily
   * here would throw away the quality they came to protect. The cover store
   * does its own compressing, to its own budget, further down.
   */
  async function renderShape(
    plan: NonNullable<typeof shaping>,
    place: { x: number; y: number },
  ): Promise<Blob | null> {
    if (!facts || !preview) return null;
    const out = plan;

    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("unreadable"));
      image.src = preview;
    });

    const canvas = document.createElement("canvas");
    canvas.width = out.width;
    canvas.height = out.height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    if (plan.id === "pad") {
      context.fillStyle = edgeColour(image) ?? "#ffffff";
      context.fillRect(0, 0, out.width, out.height);
    }
    /* Four-argument form: the artwork is drawn at `draw`, which equals its
       natural size for crop and pad — 1:1, no resampling — and is larger only
       for an enlarge, where interpolating is the entire point. */
    context.drawImage(
      image,
      Math.round(place.x),
      Math.round(place.y),
      plan.drawWidth,
      plan.drawHeight,
    );

    /* **JPEG, and this was PNG until the Amazon rules were read properly.**
       Every fix on this screen wrote a `.png` — the one format Amazon does not
       take for an ebook cover. So the repair produced a file that failed the
       check that offered it, and after 2026-08-11 it would have failed *our*
       check too: press Crop, and the reloaded result reports "PNG is not a
       format Amazon takes" on a file this screen had just written. A tool
       whose fix breaks a different rule is worse than a tool with no fix.

       0.92 rather than the browser's 0.8 default: this is somebody's cover
       and the only compression it will ever get from us. The one thing lost
       with PNG is transparency, which no ebook cover may have anyway — a
       shop composites onto white, and a transparent cover is how a title
       ends up invisible on the page. */
    return new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
  }

  async function downloadShape(
    plan: NonNullable<typeof shaping>,
    place: { x: number; y: number },
  ) {
    const blob = await renderShape(plan, place);
    if (!blob || !facts) return;
    const out = plan;
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `cover-${out.width}x${out.height}.jpg`;
    link.click();
    URL.revokeObjectURL(href);

    /* **Re-check the file that was just made, not the one that made it.**

       The findings describe whatever is loaded, so after a fix they described
       the *source* — a 396×605 cover still reading "Too small to upload"
       directly under an Enlarge button that had just produced a 1600×2560 one.
       Both statements were true and together they read as the fix having done
       nothing. Loading the result makes the check catch up with it, which is
       also what every crop tool does: what you are looking at afterwards is
       what you made. */
    /* **The type is passed, and it has to be.** `read` records `file.type` so
       the format rule has something to check, and a `File` built without one
       reports `""` — which the checker treats as "no file to read a type off"
       and skips. The result of a fix would then come back with the format row
       silently missing from its report. */
    /* **And the stretch is written down with it.** `plan.factor > 1` is only
       true of the enlarge, and `facts` here is still the *source* — so this is
       the one moment the app knows both sizes for certain. Recording it is
       what stops the reload turning a 6× upscale into seven green ticks. */
    const made = `cover-${out.width}x${out.height}.jpg`;
    const stretched =
      plan.factor > 1
        ? { width: facts.width, height: facts.height }
        : undefined;
    setName(made);
    await read(new File([blob], made, { type: "image/jpeg" }), stretched);
    /* Three outcomes, three sentences. The reshape message used to be the
       fallback for everything, so the format fix — which changes the container
       and nothing else — would have announced a shape it had not touched. A
       confirmation that overstates what it did is the same fault as a check
       that clears a bad file. */
    const sameSize = out.width === facts.width && out.height === facts.height;
    setDone({
      tone: "ok",
      text:
        plan.factor > 1
          ? `Written at ${out.width} × ${out.height}. It now passes the size check — but it was scaled up ${plan.factor.toFixed(1)}×, so it carries no more detail than the file you started with.`
          : sameSize
            ? `Written as a JPEG at ${out.width} × ${out.height}. Every pixel is where it was — only the format changed. Upload the download, not this file.`
            : `Written at ${out.width} × ${out.height}, ${IDEAL_RATIO}:1. Check the download and upload that file, not this one.`,
    });
  }

  /**
   * Put the reshaped picture on the book, without a round trip through disk.
   *
   * **Through `importImage`, not straight into the store.** That is the same
   * path the shelf's own cover picker uses, so this file is brought under the
   * same 250KB budget by the same quality ladder — rather than by a second,
   * slightly different upload route that drifts from the first. `setCover`
   * returns false when the write fails and that is honoured rather than
   * assumed.
   *
   * The full-resolution copy is still worth downloading: what lands on the book
   * is a compressed thumbnail for this app's own shelf, and the file a shop
   * wants is the one the Download button writes.
   */
  /* Not `useAsCover`: the `use` prefix makes the hooks rule read it as a hook
     and refuse the call inside a callback. */
  async function applyAsCover(
    plan: NonNullable<typeof shaping>,
    place: { x: number; y: number },
  ) {
    const blob = await renderShape(plan, place);
    if (!blob) return;

    const made = `cover-${plan.width}x${plan.height}.jpg`;
    const result = await saveCover(
      bookId,
      new File([blob], made, { type: "image/jpeg" }),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName(made);
    /* Stretched here too, and it matters more on this path than on the
       download: this one puts the picture *on the book*, so the note is what
       the dashboard will later be reading. `facts` is still the source. */
    await read(
      new File([blob], made, { type: "image/jpeg" }),
      plan.factor > 1 && facts
        ? { width: facts.width, height: facts.height }
        : undefined,
    );
    /* **Says what the export will actually package.** The old wording —
       "that copy is compressed for the shelf here" — was true of the *only*
       copy this app kept, and told a writer their file was worse than it was
       going to be. The full-size artwork is kept now (see cover-save.ts), so
       the honest thing to report is the size of what goes into the EPUB. The
       fallback case says so too rather than claiming a resolution it does not
       have. */
    setDone(
      result.printStored
        ? {
            tone: "ok",
            text: `Set as this book's cover, at ${result.width}×${result.height} — that is what goes into your EPUB.`,
          }
        : {
            // Half of this worked and half did not, so it is `note` rather than
            // `ok` or `stop`: the cover *is* on the book, and what the writer
            // has to act on is the export being worse than their artwork.
            tone: "note",
            text: "Set as this book's cover. This browser would not store the full-size copy, so the export will use a smaller one — download the file and upload it to the shop yourself.",
          },
    );
  }

  /**
   * The last measurement, for arriving from the dashboard.
   *
   * The findings there are links into this screen, and pressing one used to
   * land on an empty drop zone: the writer had just been told their cover is
   * the wrong shape, pressed the button offering to fix it, and arrived
   * somewhere that said nothing about a cover at all. The artwork itself is
   * deliberately never kept — it is the one file this app refuses to store —
   * but the numbers were, so the *findings* can be shown again even when the
   * picture cannot.
   *
   * Read once on mount. It only changes when this screen writes it, and this
   * screen has `facts` by then.
   */
  const stored = useMemo(() => getCoverFacts(bookId), [bookId]);

  /* What is on screen: the file just checked, or the last one measured. */
  const shown = facts ?? stored;
  /* Every rule with its answer, passes included — see `coverReport`. The
     failing rows *are* `checkCover`'s findings, so this screen and the
     dashboard cannot say different things about one file. */
  const report = shown ? coverReport(shown) : [];
  const problems = report.filter((c) => c.status === "problem").length;
  const notes = report.filter((c) => c.status === "note").length;

  /*
   * Put the cover the book already has on screen, and open the promised window
   * over it when one was asked for.
   *
   * **Arriving from a finding is what triggers this, not the errand.** It used
   * to run only for `fix=shape` and `fix=enlarge`, which was the same thing
   * while every cover finding carried an intent; the dashboard folds several
   * faults into one row now and that row sends none, so the commonest arrival
   * showed an empty drop zone — a writer who had just been told what was wrong
   * with their cover, pressing the button about it, and landing somewhere that
   * said nothing about a cover at all. That is the defect `fromStored` was
   * written to fix, reappearing through the door it did not cover.
   *
   * **The picture is shown; the report is left alone.** `setFacts` would make
   * the compressed copy the file under examination, and it is 700px — so a
   * cover the dashboard called "smaller than recommended" would greet the
   * writer with "Too small to upload", a harder verdict about a file they were
   * not asking about. So the numbers on screen stay the original's, read back
   * from `coverfacts`, and only the two errands that exist *to work on the
   * stored copy* make it the subject. The note beside the picture says which
   * one is which.
   */
  useEffect(() => {
    if (!sentByFinding || facts) return;
    const dataUrl = getCover(bookId);
    if (!dataUrl) return;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      /* Spent here rather than in the effect body: a synchronous setState in
         an effect cascades renders, and this is a callback from an external
         system, which is what effects are actually for. Spent whether or not
         a window opens — the stored cover has been examined either way. */
      setIntent("");
      const w = image.naturalWidth;
      const h = image.naturalHeight;

      /* Always, so the writer sees the cover they were just told about. */
      setFromStored(true);
      setPreview(dataUrl);

      /* Only an errand that is explicitly about the stored copy makes it the
         file being judged — which is what puts the repair panel under it. A
         plain "Check the cover" is a request to see the report, and the report
         is about the original. */
      const wantsShape = intent === "shape";
      if (!wantsShape && intent !== "enlarge") return;
      setFacts({ width: w, height: h, bytes: 0 });

      /* Open a window only for the errand that has a decision in it. An
         enlarge has none — it is a single button on the panel below — and
         running it unasked would replace somebody's cover with a blurrier one
         before they had read why that is what enlarging does. And not at all
         when the stored copy does not have the problem the finding named. */
      if (wantsShape && Math.abs(h / w - IDEAL_RATIO) > 0.05) {
        const out = reshape(w, h, "crop");
        setShaping({
          id: "crop",
          width: out.width,
          height: out.height,
          drawWidth: w,
          drawHeight: h,
          factor: 1,
          tooSmall: out.tooSmall,
        });
      }
    };
    image.src = dataUrl;
    return () => {
      cancelled = true;
    };
  }, [sentByFinding, intent, facts, bookId]);

  /* Named rather than inlined twice: the panel's visibility and each button's
     own visibility are the same two questions, and they must not drift. */
  const shapeOff = shown
    ? Math.abs(shown.height / shown.width - IDEAL_RATIO) > 0.05
    : false;
  const smallerThanIdeal = shown
    ? Math.max(shown.width, shown.height) < IDEAL_HEIGHT
    : false;
  /**
   * A format Amazon will not take, and one it will.
   *
   * **The one finding on this screen with a fix that is purely mechanical.**
   * Cropping asks which part of the picture survives; enlarging invents
   * pixels and has to say so. Re-encoding a PNG as a JPEG asks nothing and
   * costs nothing a cover can use — the only thing PNG carries that JPEG does
   * not is transparency, and a transparent ebook cover is a fault rather than
   * a feature, since a shop composites it onto its own white page.
   *
   * It goes through the same `reshape`/render path as the others rather than a
   * second one, drawing at the artwork's own size so not a pixel moves: the
   * output differs from the input in its container and nothing else.
   */
  const wrongFormat = Boolean(
    facts?.type && !COVER_TYPES.includes(facts.type as never),
  );

  /**
   * What can be done about one row of the report, attached to that row.
   *
   * **The remedies used to be a panel of their own under the list**, headed
   * "Fix the file" — three buttons in a blue box below four findings, with
   * nothing joining a button to the sentence it answered. A writer read "Too
   * small to upload", read "Squarer than Amazon asks for", and then met Crop,
   * Pad and Enlarge as a set and had to work out for themselves which belonged
   * to which. It is the same fault the dashboard's own rule exists to prevent:
   * *every finding carries its own way to be fixed*. The report already knows
   * which rule each row is, so the button belongs on the row.
   *
   * Three things this has to keep from the panel it replaces:
   *
   * - **The cost is on the button.** "29px trimmed", "falls under 1000px",
   *   "adds no detail" — a fix that quietly makes a different rule fail, or
   *   invents pixels, has to say so where it is pressed rather than in a
   *   dialog afterwards.
   * - **A row may carry two.** Shape is the one question with two honest
   *   answers — crop something away, or pad something on — so it gets both and
   *   the writer chooses. That is why this returns a list.
   * - **Most rows carry none.** A file too *large*, one already upscaled, a
   *   CMYK profile, a pale edge: real findings this app cannot mechanically
   *   put right, and inventing a button for them would be worse than the panel
   *   ever was. They stay as words.
   *
   * Gated on `facts`, so a row shows a fix only when there is a file to make
   * one from — arriving from a dashboard finding brings the numbers and not the
   * artwork — and on the row not being a pass, since a rule that passed has
   * nothing to answer.
   */
  const fixesFor = (
    check: CoverCheck,
  ): { key: string; label: string; cost: string; run: () => void }[] => {
    if (!facts || check.status === "pass") return [];

    /* Straight to the file with no dialog: nothing is cropped, nothing is
       scaled, and the only thing that can be lost is transparency, which an
       ebook cover must not have anyway. The container changes and nothing
       else. */
    if (check.id === "format" && wrongFormat) {
      return [
        {
          key: "format",
          label: "Save it as a JPEG",
          cost: `${facts.width} × ${facts.height} · same pixels, a format Amazon takes`,
          run: () =>
            void downloadShape(
              {
                id: "crop",
                width: facts.width,
                height: facts.height,
                drawWidth: facts.width,
                drawHeight: facts.height,
                factor: 1,
                tooSmall: false,
              },
              { x: 0, y: 0 },
            ),
        },
      ];
    }

    /* Both, because the question has two answers and neither is ours to make.
       They open a window rather than downloading, since each asks *where* —
       which part of the picture survives a crop, where the bars fall. */
    if (check.id === "shape" && shapeOff) {
      return (["crop", "pad"] as const).map((mode) => {
        const out = reshape(facts.width, facts.height, mode);
        return {
          key: mode,
          label: mode === "crop" ? "Crop to fit" : "Pad with bars",
          cost:
            `${out.width} × ${out.height} · ` +
            `${out.changed}px ${mode === "crop" ? "trimmed" : "added"}` +
            (out.tooSmall ? " · falls under 1000px" : ""),
          run: () =>
            setShaping({
              id: mode,
              width: out.width,
              height: out.height,
              // Crop and pad draw the artwork at its own size: 1:1, nothing
              // invented.
              drawWidth: facts.width,
              drawHeight: facts.height,
              factor: 1,
              tooSmall: out.tooSmall,
            }),
        };
      });
    }

    /* **Straight to the file, no dialog.** Enlarging asks nothing: the artwork
       is scaled to cover the frame and, when the shape is already right, there
       is not a pixel of slack to drag. A modal whose only content is a preview
       of the single possible answer is a step that exists to be dismissed.
       Centred, which is exact when the ratio matches and the sane default when
       it does not — and a writer who wants to choose has Crop and Pad, which
       appear on the row above for exactly that case. */
    if (check.id === "size" && smallerThanIdeal) {
      const big = enlarge(facts.width, facts.height);
      return [
        {
          key: "enlarge",
          label: `Enlarge to ${big.width} × ${big.height}`,
          cost: `scaled up ${big.factor.toFixed(1)}× · adds no detail`,
          run: () =>
            void downloadShape(
              { id: "enlarge", ...big, tooSmall: false },
              {
                x: (big.width - big.drawWidth) / 2,
                y: (big.height - big.drawHeight) / 2,
              },
            ),
        },
      ];
    }

    return [];
  };

  /* Worked out once, so the promise above the list and the buttons in it
     cannot disagree about whether there is anything to press. */
  const rows = report.map((check) => ({ check, fixes: fixesFor(check) }));
  const anyFix = rows.some((row) => row.fixes.length > 0);

  return (
    /* **No heading of its own.** It carried one — "Check the file" — from when
       it was a block below the Yours card. It now *is* the panel's contents
       when the file half is picked, and the panel's own `h2` says exactly
       that, so a second one under it was the same words twice. The deck stays:
       it is the one place that tells a writer to use their original file
       rather than the copy this app stored, which is the mistake that makes
       the check report a failure the real artwork does not have. */
    <section>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Whether a shop would refuse the artwork. It is measured in your browser
        and never sent anywhere. Use your original file, not the compressed copy
        stored here — that one would fail on size.
      </p>

      {/* ---- Nothing dropped yet ------------------------------------------

          **The drop zone is the whole screen only while it is the whole
          job.** It was drawn at the page's full `7xl` width — a 1700px dashed
          rectangle holding two centred lines, which is the shape a drop target
          takes when nobody has decided how big it should be. Every file input
          worth copying (Vercel, Linear, Figma, GitHub) constrains it: the
          target is generous, not unbounded, because a drop area wider than
          about a card stops reading as an object you can aim at.

          `max-w-xl` and the aspect of a book. That second part is the useful
          bit — the outline is roughly the shape of the thing it wants, so the
          control says what it takes before anybody reads the words in it.

          It is a real drop target, because the sentence promises one. This was
          a bare `<input type="file">`, which the browser draws as "Choose File
          | No file chosen" — the one undesigned control on a screen about how
          things look. Clicking still opens the picker, because the label wraps
          the input rather than replacing it. */}
      {!shown && (
        <DropZone
          className="mt-5 max-w-xl"
          onFile={(file) => {
            setName(file.name);
            void read(file);
          }}
        />
      )}

      {error && (
        <p className="mt-4 max-w-xl rounded-lg border border-stop-line bg-stop-bg px-3.5 py-2.5 text-sm text-stop-fg">
          {error}
        </p>
      )}

      {/* ---- A file, and its report ----------------------------------------

          **Two columns: the thing, and what is true of it.** This was one
          stack — a drop zone, then a named-file row, then a small preview with
          everything else in a column beside it — so the artwork the writer is
          deciding about was an 80px stamp two thirds of the way down, and the
          drop zone stayed at full width above a report about a file it had
          already taken. (It stayed because it hid on `facts` while the report
          drew from `facts ?? stored`: arriving from a dashboard finding showed
          both at once, which is the exact duplication the old comment claimed
          to have removed.)

          The shape is the one every asset inspector settles on — Figma's file
          panel, Squoosh, a Vercel image preview: the artifact on the left at a
          size worth looking at, with its identity and the actions that act on
          it; the report on the right. `20rem` is a fixed rail rather than a
          fraction, so the preview does not grow into a poster on a wide
          window, and `@2xl` reads the *container* because this screen is also
          drawn in the roadmap's panel at about half the width. */}
      {shown && (
        <div className="mt-5 grid gap-6 @2xl:grid-cols-[20rem_minmax(0,1fr)]">
          {/* **Capped at the rail's own width whether or not it is in the
              rail.** Below `@2xl` the grid stacks and this column becomes the
              full width of the panel — and everything in it is sized by the
              artwork's proportions, so an unbounded column drew a cover the
              width of the page and well over a thousand pixels tall. A
              preview is a preview at every width; it is the report beside it
              that wants the room. */}
          <div className="min-w-0 max-w-[20rem]">
            {/* **Two states, and the one with no artwork is a drop zone
                rather than a description of one.**

                Arriving from a dashboard finding, the measurements are read
                back from `coverfacts:` and the file itself is not — it is the
                one thing this app refuses to keep. What stood here then was a
                dashed box explaining that, above the file's name, the two
                buttons and the full measurement list: an inspector panel for a
                file that is not there, whose *only* useful sentence was "drop
                the file again". Every number in it is already in the report
                beside it, word for word and with the rule it broke — "735×1117
                will be accepted", "This is 1.52:1" — so the column was
                repeating the answer while withholding the thing that would
                make it current.

                A drop target says the same sentence as a control instead of as
                a caption, and it is the *same* control the empty screen uses,
                so dropping a file works identically wherever the writer
                happens to be looking. The report stays where it is: they came
                here because of it. */}
            {preview ? (
              <>
                {/* The picture at a size a decision can be made from. Framed
                    rather than bare: a cover with a white ground and no border
                    bleeds into the panel and stops looking like a file. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt=""
                  className="w-full rounded-lg border border-line bg-surface object-contain shadow-sm"
                />

                {/* The file's identity and the two things you can do to it.
                    Named, because "the file you checked" is otherwise a
                    picture and a writer with three exports in a folder cannot
                    tell which. Two states here rather than the old three: the
                    file just handed over, and the cover already on the book.
                    The third — a set of numbers with no picture — has its own
                    half of this branch now. */}
                <p className="mt-3 truncate text-sm font-medium text-fg">
                  {name ??
                    (fromStored ? "The cover on this book" : "Checked file")}
                </p>

                {/* **Replace is a first-class control now, not small print.**
                    It was a line inside the drop zone reading "drop another to
                    check it instead", which is an instruction rather than a
                    control — and once the drop zone went there was no way to
                    check a second file except Remove, then drop. The Image
                    Upload pattern names four things this has to allow: select,
                    preview, validate, *replace*. This is the fourth. */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* **Filled, and filled with `bg-fg`/`text-surface` rather
                      than a literal black.** It is the pair the pricing page's
                      paid card and the checkout's own button already use: the
                      two tokens invert *with* the palette, so this is
                      near-black carrying white by day and near-white carrying
                      black at night — where a typed `bg-black text-white`
                      would be a black hole in a black screen after sunset,
                      which is the one way to get a filled control wrong here.
                      It is not `bg-accent`, because the accent means "the way
                      forward" and this is the way *back* — a second run at the
                      same step. */}
                  <label
                    className="cursor-pointer rounded-md bg-fg px-2.5 py-1 text-xs
                               font-semibold text-surface transition-opacity
                               hover:opacity-90"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setName(file.name);
                          void read(file);
                        }
                      }}
                      className="sr-only"
                    />
                    Check another
                  </label>
                  <button
                    type="button"
                    onClick={clearChecked}
                    /* Quiet until hovered. It throws the checked file away, so
                       it carries the danger colour — but sitting permanently
                       red beside a neutral control it read as the primary
                       action of the pair, which it is not. */
                    className="rounded-md px-2.5 py-1 text-xs font-semibold text-muted
                               transition-colors hover:bg-stop-bg hover:text-danger
                               focus-visible:ring-2 focus-visible:ring-accent/50
                               focus-visible:outline-none"
                  >
                    Remove
                  </button>
                </div>

                {/* **The measurements as a labelled list, not a run of
                    numbers.** They were one grey line — `679 × 960 pixels ·
                    69KB · 1.41:1` — which is three different kinds of fact
                    separated by dots, none of them named. A definition list is
                    what every inspector panel uses, and the labels are what
                    make "1.41:1" mean anything to somebody who has not read
                    the checks below yet. */}
                <dl className="mt-4 border-t border-line pt-3 text-sm">
                  {[
                    [
                      "Pixels",
                      `${shown.width.toLocaleString()} × ${shown.height.toLocaleString()}`,
                    ],
                    ["Shape", `${(shown.height / shown.width).toFixed(2)}:1`],
                    /* No weight for the stored copy: its size on disk is an
                       artefact of this app's own compression, not a fact about
                       the writer's artwork, and printing it beside a shop's
                       50MB limit would invite exactly the wrong conclusion. */
                    ...(shown.bytes > 0
                      ? ([["File", fileSize(shown.bytes)]] as const)
                      : []),
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-4 py-1"
                    >
                      <dt className="text-muted">{label}</dt>
                      <dd className="font-medium text-fg tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <>
                <DropZone
                  onFile={(file) => {
                    setName(file.name);
                    void read(file);
                  }}
                />
                {/* Why there is a drop zone here rather than the file, said
                    once and quietly. The rule and the small type are what keep
                    it a footnote to the control rather than a second heading
                    above it. */}
                <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                  The report beside this is from the last file you checked. The
                  artwork itself is never kept here, so drop the same file again
                  to see it and to put anything right.
                </p>
                {/* The measurements outlive the picture, so there has to be a
                    way to throw them out — otherwise the dashboard goes on
                    reporting a cover nobody is checking, and this screen goes
                    on drawing a report with no file behind it. */}
                <button
                  type="button"
                  onClick={clearChecked}
                  className="mt-2 rounded-md px-2.5 py-1 text-xs font-semibold text-muted
                             transition-colors hover:bg-stop-bg hover:text-danger
                             focus-visible:ring-2 focus-visible:ring-accent/50
                             focus-visible:outline-none"
                >
                  Forget these measurements
                </button>
              </>
            )}

            {/* **The caveats, against the measurements rather than under the
                report.** They were the last thing on the right-hand column,
                which put them below the fix buttons — so the small print
                qualifying the numbers sat under the *remedies*, four hundred
                pixels from anything it was about, and on a long report it was
                off the bottom of the window entirely.

                Here it is a footnote to the thing it footnotes: what was
                measured, and the two things this screen cannot measure at all.
                The column is narrow, so the sentences wrap into a block rather
                than running the width of the page — which is the shape small
                print should have been all along. */}
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              Measured in your browser; the file is never uploaded. These are
              Amazon KDP&rsquo;s published figures and do not replace the
              shop&rsquo;s own check. Two things decide a cover and neither can
              be measured: whether the title is readable at 60px, and whether it
              looks like its genre. Both are on the shelf.
            </p>
          </div>

          <div className="min-w-0">
            {/* **Green, and only ever for something that happened.** Red for
                refused, amber for worth doing, green for passed or earned — so
                a fix that has actually been written is the one thing here
                entitled to it. It clears when a new file is read or the file is
                removed, because a confirmation outliving the thing it confirms
                is how a screen congratulates somebody for work they have
                undone. */}
            {done && (
              <p
                role="status"
                className={`mb-4 rounded-lg border px-3.5 py-2.5 text-sm ${
                  done.tone === "ok"
                    ? "border-ok-line bg-ok-bg text-ok-fg"
                    : "border-note-line bg-note-bg text-note-fg"
                }`}
              >
                {done.text}
              </p>
            )}

            {fromStored && (
              /* **Which picture this is, said before anything is done to it —
                 and it now has two things to say, because there are two ways
                 to arrive.** The second sentence used to promise that "putting
                 its shape right" fixes the EPUB, which is true of the crop and
                 enlarge errands and nonsense on a plain "Check the cover",
                 where there is no repair panel under it at all. So the offer is
                 made only when it is on offer, and the plain arrival is told
                 the thing it actually needs: the report is about the original,
                 and the original is what to hand over. */
              <p className="mb-4 rounded-lg border border-note-line bg-note-bg px-3.5 py-2.5 text-sm text-note-fg">
                This is the cover already on the book, not your original — the
                copy kept here is compressed to fit a browser.{" "}
                {facts
                  ? "Putting its shape right fixes the cover in your EPUB and on the shelf. For the file you upload to a shop, fix the original and check that."
                  : "The report beside it is of the original, measured when you last checked it. Drop that file in to work on it."}
              </p>
            )}

            {/* **One line saying how it went, before the detail.** Every
                report worth reading opens with its own summary — a deploy's
                check count, Lighthouse's category line — because the first
                question is "am I all right?" and the second is "which one".
                Counted from the rows below rather than stated, so it cannot
                disagree with them. */}
            <p className="text-sm font-semibold text-fg">
              {problems > 0
                ? `${problems} thing${problems === 1 ? "" : "s"} a shop would refuse`
                : notes > 0
                  ? `Nothing a shop would refuse · ${notes} worth knowing`
                  : "Nothing a shop would refuse"}
              <span className="ml-2 font-normal text-muted tabular-nums">
                {report.length} checks
              </span>
            </p>

            {/* **The panel's one surviving sentence.** "Fix the file" carried a
                deck promising that nothing is uploaded and the file is not
                changed, and that promise outlived the box: the buttons are on
                the rows now, so it is said once here, above all of them,
                rather than repeated on each. Only when there is something to
                press — a standing reassurance about a thing nobody can do is
                furniture. */}
            {anyFix && (
              <p className="mt-1 max-w-prose text-sm text-muted">
                Where a fix is offered below, you choose what shows before
                anything is written. Nothing is uploaded and this file is not
                changed — you get a copy.
              </p>
            )}

            {/* **The passes are shown, and that is the change that matters.**

                This drew only the failures, so a clean file rendered as one
                grey paragraph and a writer never learned what had been
                examined — which reads exactly like a check that did not run.
                It is the failure mode the title check has a standing rule
                about, and the fix is the one GitHub, Vercel and Lighthouse all
                use: list every rule, mark each one. A tick is what makes the
                two crosses beside it believable.

                One row per rule, in a fixed order, so the list does not
                reshuffle when a different file is dropped — see `coverReport`.
                Rows rather than cards: four bordered boxes down a column is
                four times the furniture for four sentences, and it made the
                two that mattered the same weight as the two that did not. The
                mark carries the status and the row carries the words. */}
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {rows.map(({ check, fixes }) => (
                <li key={check.id} className="flex gap-3 py-3">
                  <CheckMark status={check.status} />
                  {/* `flex-1` so a fix beneath the words spans the column the
                      words are in rather than shrinking to its own label. */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        check.status === "pass" ? "text-muted" : "text-fg"
                      }`}
                    >
                      {check.label}
                    </p>
                    {/* A pass needs no argument, so its detail is the
                        measurement and the rule in small print; a finding is
                        the thing the writer came for and is set at reading
                        size. Capped at a measure — this column is half of a
                        `7xl` page and an uncapped sentence here runs to about
                        a hundred and thirty characters. */}
                    <p
                      className={`mt-0.5 max-w-prose ${
                        check.status === "pass"
                          ? "text-xs text-muted"
                          : "text-sm text-muted"
                      }`}
                    >
                      {check.detail}
                    </p>

                    {/* **Under the words, not beside them.** A fix answers the
                        sentence above it, and a control on the right of a row
                        reads as a destination — which these are not: they act
                        here, on this file. Stacked when there are two, each
                        one line: what it will do on the left, what it costs on
                        the right. */}
                    {fixes.length > 0 && (
                      <div className="mt-2.5 flex flex-col gap-2">
                        {fixes.map((fix) => (
                          <button
                            key={fix.key}
                            type="button"
                            onClick={fix.run}
                            className={FIX_BUTTON}
                          >
                            <span className="text-sm font-semibold">
                              {fix.label}
                            </span>
                            <span className="text-xs text-badge-blue-ink/70 tabular-nums">
                              {fix.cost}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Only when everything passed. Under a list of ticks it is the
                one thing left to say; under a list with two crosses in it, it
                would be a change of subject at the moment somebody is reading
                what is wrong. */}
            {problems === 0 && notes === 0 && (
              <p className="mt-3 max-w-prose text-sm text-muted">
                That is the <em>file</em> checked. Whether the cover works is a
                different question, and the shelf is how you answer it.
              </p>
            )}
            {/* **The remedies are on the rows now, and the panel is gone.**

                It stood here — "Fix the file", a blue box holding Crop, Pad,
                Enlarge and the JPEG re-save — below a list of four findings
                that named the very problems those buttons answered, with
                nothing joining one to the other. A writer read two complaints
                and then met three remedies as a set, and had to pair them up
                themselves. The dashboard's own rule says a finding carries its
                own way to be fixed; the report knows which rule each row is, so
                the button belongs on the row. See `fixesFor`, which kept the
                three things the panel was right about: the cost is on the
                button, shape offers both of its answers, and a finding this app
                cannot mechanically put right gets no button at all. */}

            {/* **Where the "these were measured earlier" box used to be.**
                It stood here — under the report, where the fix panel would
                have been — to answer "so what do I do about it" for a writer
                who arrived from a dashboard finding with the numbers but no
                artwork. It said to drop the file again.

                The column on the left now *is* a drop zone in exactly that
                case, carrying the same sentence with the control attached to
                it, so this had become the second of two boxes on one screen
                asking for the same file — and the one with nothing to press.
                A sentence beats a box; a control beats both. */}
          </div>
        </div>
      )}

      {/* Opened by the shape buttons rather than downloading on the press —
          see `ShapeDialog`. Mounted here so it is torn down with the checker,
          and keyed on the mode so switching from crop to pad starts from that
          mode's own centred position rather than inheriting the last one. */}
      {shaping && facts && preview && (
        <ShapeDialog
          key={shaping.id}
          src={preview}
          out={shaping}
          label={
            shaping.id === "crop"
              ? "Crop to fit"
              : shaping.id === "pad"
                ? "Pad with bars"
                : "Enlarge"
          }
          onCancel={() => setShaping(null)}
          onCreate={(place) => {
            void downloadShape(shaping, place);
            setShaping(null);
          }}
          onUse={(place) => {
            void applyAsCover(shaping, place);
            setShaping(null);
          }}
        />
      )}
    </section>
  );
}

/**
 * The one drop target, in the two places a cover can be handed over.
 *
 * It was written out at the empty state and nowhere else, and the second place
 * needing it is what made this a component rather than a copy: the column
 * beside the report, when the measurements outlived the artwork. Two hand-kept
 * copies of a file input is how one of them ends up accepting a format the
 * other refuses, or losing its drag handling — and a writer who has learned
 * that dropping works on this screen must not find a spot where it silently
 * does not.
 *
 * **A real drop target, because the sentence promises one.** This was a bare
 * `<input type="file">`, which the browser draws as "Choose File | No file
 * chosen" — the one undesigned control on a screen about how things look.
 * Clicking still opens the picker, because the label wraps the input rather
 * than replacing it, and `dragging` is the component's own state: two of these
 * on one screen sharing a flag would light up together.
 *
 * The caller sizes it (`className`) and nothing else varies. The empty screen
 * caps it at `max-w-xl` — a drop area wider than about a card stops reading as
 * an object you can aim at — and in the report's rail it simply fills the
 * 20rem column.
 */
function DropZone({
  onFile,
  className = "",
}: {
  onFile: (file: File) => void;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2
                  rounded-xl border-2 border-dashed px-6 py-12 text-center
                  transition-colors ${className} ${
                    dragging
                      ? "border-accent bg-accent/8"
                      : "border-line bg-surface hover:border-accent/50 hover:bg-raised"
                  }`}
    >
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
        className="sr-only"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7 text-muted"
      >
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      <span className="text-sm font-semibold text-fg">
        Drop your cover here, or choose a file
      </span>
      {/* **What this page can check, which is not the same list as what Amazon
          takes.** Amazon takes JPEG and TIFF for an ebook cover; browsers
          cannot open a TIFF at all, so naming both here would promise a check
          that fails on one of them. It also does not say "JPEG or PNG", which
          is what it said for about an hour and is the exact advice that gets a
          cover rejected — PNG is what every design tool exports by default, so
          naming it would have been this screen causing the refusal it exists
          to prevent. The `accept` attribute deliberately stays wider than
          either list: a writer who picks a PNG must be *told* it is a PNG, not
          have the file quietly hidden by a picker that explains nothing. */}
      <span className="max-w-xs text-xs text-muted">
        The file you are about to upload — not the copy stored here. JPEG is
        what Amazon wants and what this page can measure.
      </span>
    </label>
  );
}

/**
 * One of the fix panel's buttons — the shape and the fill, in one place.
 *
 * **Blue on the panel's blue tint**, which is what the ground forced. They
 * were white cards with a hairline, which is the shape they take *anywhere
 * else*: a card on a grey desk is told from it by its own edge. On a blue tint
 * that edge does the job the ground already does, so three white slabs read as
 * the panel's furniture rather than as the three things to press — and this
 * panel is nothing but its buttons.
 *
 * All three parts come from the badge family: `-soft` for the ground, one step
 * deeper into the hue than the panel it sits on, `-ink` for the words, `-line`
 * for the edge. A saturated fill was tried first and is the wrong volume — it
 * makes three offers to *change somebody's file* the loudest thing on a screen
 * whose whole argument is that the report above them is the point. A tinted
 * control is still unmistakably a control and does not shout down the
 * diagnosis.
 *
 * The measurement beside each label goes to `-ink/70`: `text-muted` is the
 * chrome's grey and reads as switched off on a coloured ground, but the cost
 * of a fix is still the quieter half of its line.
 *
 * Hover deepens to `-line`, the direction daylight moves in this palette, and
 * the focus ring is offset against the panel — a ring drawn *on* a fill of
 * nearly its own hue is a ring nobody can see.
 */
/**
 * A fix, on the row that names the problem it answers.
 *
 * **The ground moved down a step when the blue panel went away.** These were
 * `badge-blue-soft` cards *on* a `badge-blue-bg` panel; standing on the report's
 * own white they would have been the darker of the two blues against no blue at
 * all — a control shouting on a list of sentences. So the panel's ground becomes
 * the button's, its line stays the border, and `soft` becomes the hover: the
 * same three tokens, each moved one place, which is what keeps this the app's
 * one *state* colour rather than a new blue invented for a button.
 *
 * The ring offsets against `panel`, which is what the report actually sits on
 * now — offsetting against a colour that is no longer behind it draws a halo in
 * the wrong shade.
 */
const FIX_BUTTON = `flex w-full flex-wrap items-center justify-between gap-x-4
  gap-y-1 rounded-lg border border-badge-blue-line bg-badge-blue-bg px-4 py-3
  text-left text-badge-blue-ink transition-colors hover:bg-badge-blue-soft
  focus-visible:ring-2 focus-visible:ring-badge-blue-ink
  focus-visible:ring-offset-2 focus-visible:ring-offset-panel
  focus-visible:outline-none`;

/**
 * A file size in the unit a person would use for it.
 *
 * It was always KB, which is right for a 69KB thumbnail and reads as noise the
 * moment a real cover turns up: a 4MB JPEG printed `4145KB`, four digits nobody
 * converts in their head, against a limit stated in MB two lines below. One
 * decimal above a megabyte, none below — the second decimal of a file size has
 * never told anybody anything.
 */
function fileSize(bytes: number): string {
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
}

/**
 * The mark against one check.
 *
 * **A shape as well as a colour**, which is not decoration: red-versus-green is
 * the one distinction about one in twelve men cannot make, and a checklist
 * whose entire meaning is carried in a hue fails for them completely. A cross,
 * an exclamation and a tick are legible in greyscale — the reason every serious
 * status list draws glyphs rather than dots.
 *
 * It takes the app's own status family — `stop` for what a shop refuses, `note`
 * for what is worth knowing, `ok` for what passed — so it is right in both
 * themes without a second palette. `aria-hidden`, because the row's own words
 * already say which it is; a screen reader hearing "problem" and then reading
 * "Too small to upload" has been told the same thing twice.
 *
 * **It is a filled disc rather than a tinted one**, and that is the `-solid`
 * half of the family rather than a new colour: `-bg` is a ground for a *banner*
 * of the hue, a few percent off the surface, so a 20px circle of it beside a
 * hairline read as a faint outline with a pale glyph in it — the mark carrying
 * the row's whole verdict was the quietest thing in the row. `-solid` is the
 * value tuned to carry white ink in both themes (see the note beside it in
 * `globals.css`), which is why the glyph is a literal `text-white`: those three
 * do not invert, so an ink token that crossed over would put black on them at
 * night. No border — a hairline of `-line` around a saturated fill is a second
 * edge saying nothing.
 */
function CheckMark({ status }: { status: CoverCheck["status"] }) {
  const look =
    status === "problem"
      ? { ring: "bg-stop-solid", d: "M6 6l8 8M14 6l-8 8" }
      : status === "note"
        ? { ring: "bg-note-solid", d: "M10 5v6M10 14v.5" }
        : { ring: "bg-ok-solid", d: "M5 10.5l3.5 3.5L15 7" };

  return (
    <span
      aria-hidden="true"
      className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${look.ring}`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d={look.d} />
      </svg>
    </span>
  );
}

/**
 * Smallest first, and **Large is the one it opens on.**
 *
 * The order is the ramp — thumbnail, browsing, large — because that is how a
 * reader's own view of a cover grows as they get interested, and the two small
 * ones are the test this screen exists to run: a title that dissolves at 60px
 * is a cover that fails in the place the decision is actually made.
 *
 * The *default* is the other question, and it went the other way. The wall now
 * loads on arrival, so the first thing anybody sees is thirty covers they did
 * not ask for — at 60px that is a grid of unreadable stamps, and a writer who
 * has never opened this tool cannot tell it is working, let alone what it is
 * showing them. Large is where a cover reads as a cover. Shrinking it is then
 * a deliberate press, which is the press this screen wants them to make.
 */
const SIZES = [
  { id: "thumb", label: "Thumbnail", width: 60, note: "as a shop shows it" },
  { id: "browse", label: "Browsing", width: 110, note: "as a shelf shows it" },
  { id: "large", label: "Large", width: 180, note: "as you designed it" },
] as const;

type SizeId = (typeof SIZES)[number]["id"];

/**
 * The shelf shown when the book says nothing about itself.
 *
 * A `subject:` term rather than a bare word, because both catalogues index
 * subjects and a plain "fiction" matches every book with the word in its
 * title. It is deliberately the broadest shelf there is: a narrower guess
 * would be a guess *about this book*, and the whole point of this fallback is
 * that we do not know what the book is. The caption never calls it theirs —
 * see `shelfIs`.
 */
const GENERAL_SHELF = 'subject:"Fiction"';

export function CoversPage({ bookId, embedded, heading }: ToolPageProps) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const myCover = useCover(bookId);

  /*
   * No draft: attaching artwork is already its own press, and `saveCover`
   * writes three stores the moment a file is chosen.
   *
   * What this control does is the *other* half — "Get a cover made" is the
   * one step on the road that is deliberately not detected, because a
   * generated placeholder is attached the same way a commissioned jacket is,
   * and ticking off the most expensive step in the list on the strength of a
   * gradient is the exact lie `roadmapFor` exists to prevent. So the writer
   * says when it is done, from the screen where they did it.
   */
  const save = useToolSave({ book, tool: "covers" });

  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CompTitle[]>([]);
  const [size, setSize] = useState<SizeId>("large");

  /**
   * Which half of this tool is on screen.
   *
   * The two do different work with different inputs, and stacked in one column
   * the second was always below the fold — a writer who came to check a file
   * before uploading had to scroll past a whole wall of other people's covers
   * to find out the checker existed. They are also used one at a time and
   * minutes apart: you look at the shelf while deciding what to commission,
   * and you check a file the day you have one.
   *
   * A segmented control is the pattern every tool with two parallel modes
   * settles on, and this file already owns one for the wall's sizes — so the
   * same control means the same thing twice on one screen rather than
   * introducing a second idea of what "pick a view" looks like.
   *
   * The shelf leads because it is what the step is called: "Get a cover made"
   * is answered by looking at the ones that sell, not by validating a PNG.
   */
  /**
   * Which half is open, seeded from `?check=1`.
   *
   * The dashboard's cover findings link here to be fixed, and every one of
   * them is fixed on the *file* side — a button reading "Fix the shape" that
   * delivered a search box for other people's covers would be the dead end
   * this app's own destination rule exists to prevent.
   *
   * Read with `useSearchParams`, not `window.location`: a lazy initialiser
   * reading the URL during a client navigation sees the *previous* one, which
   * is the mistake the dashboard's `?area=` already made once.
   */
  const params = useSearchParams();
  const [half, setHalf] = useState<"shelf" | "file">(
    params.get("check") ? "file" : "shelf",
  );
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * The free plan's three cover searches a day.
   *
   * **Only a search the writer asked for is counted.** The seed below now
   * *runs*, and charging for that would spend the three on three visits — a
   * limit on opening the screen rather than on searching it, which is the
   * standing rule everywhere in `free-limits.ts`. So the form calls
   * `gate.spend()` and the seed calls `search` straight.
   */
  const gate = useLimitGate({ action: "covers" });
  const shelfSearches = gate.allowance;

  const wall = useMemo(() => coversOf(books), [books]);

  /**
   * Covers whose URL did not load.
   *
   * **A dead link here drew an empty box**, which on a wall of sixteen reads as
   * a book with a blank cover rather than as a picture that did not arrive —
   * exactly the wrong lesson on the screen asking "does yours hold up beside
   * these?". The two catalogues are third-party hosts we do not control, so
   * some proportion of these URLs will always be stale.
   */
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const width = SIZES.find((s) => s.id === size)!.width;

  /* `useCallback` so the arrival effect below can depend on it honestly rather
     than lie to the linter about what it closes over. It captures nothing but
     setters, which are stable, so the list is empty and it is built once. */
  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/comps?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "That search did not work.");
        setState("error");
        return;
      }
      setBooks(data.books ?? []);
      setState("done");
    } catch {
      setError("Could not reach the search. Check your connection.");
      setState("error");
    }
  }, []);

  const seeded = useRef(false);
  /**
   * Whether the writer has touched the box — the same guard comps carries.
   *
   * The seed fires when `book` arrives, which is after hydration and can be
   * after somebody has started typing, since the shelf is read from storage on
   * the client. Without this a query typed on a slow load is silently replaced
   * by ours, and the results are for something nobody asked.
   */
  const touched = useRef(false);

  /**
   * Whether the wall on screen is this book's shelf or a stand-in.
   *
   * `null` while nothing has been seeded, `"book"` when the query came off the
   * book's own genre, blurb or categories, `"general"` when it did not. The
   * caption reads this, and that is the whole reason it exists: a wall of
   * general fiction presented as "the shelf your book sits on" is a claim
   * about somebody's book that nothing in the data supports. Cleared the
   * moment the writer edits the box, since after that the wall is theirs.
   */
  const [shelfIs, setShelfIs] = useState<"book" | "general" | null>(null);

  /**
   * **It opens on a shelf, not on an empty screen**, which is what comps has
   * always done and what this screen was the odd one out for.
   *
   * A writer arriving here has been sent to look at other people's covers. A
   * search box above an empty page asks them to describe their own book first
   * — in words a catalogue will answer, which nobody guesses right cold — and
   * the thing they came for is behind a press they have no reason to trust.
   * So the wall is there before anything is asked of them, with their own
   * cover beside it from the first paint.
   *
   * **Three seeds, in falling order of how much they know about the book**,
   * because the obvious one is silent far more often than it looks. A book
   * with no genre *and* no blurb — an import, or anything started before those
   * screens were visited — gives `buildQuery` nothing, and this screen then
   * showed the empty page it was supposed to have stopped showing.
   *
   * 1. The genre and blurb, as comps does.
   * 2. The categories, if any were set. They are the same kind of thing a
   *    `subject:` search takes, and a book that has been through the listing
   *    screen has them when it has nothing else.
   * 3. Failing both, **a general fiction shelf, said out loud.** These are real
   *    covers from the same catalogues, and they answer the question this tool
   *    is actually for — does a title still read at 60px, does mine look like a
   *    book — which does not need the right genre to be worth looking at. What
   *    it is *not* is this book's shelf, so `shelfIs` carries that and the
   *    caption says so rather than letting the page imply it.
   *
   * `/api/comps` is free, keyless and cached for a week, so an arrival search
   * costs a request nobody pays for — and it costs the writer none of the
   * three, per the gate above.
   */
  useEffect(() => {
    if (!book || seeded.current || touched.current) return;
    seeded.current = true;

    const fromBook =
      buildQuery({
        genre: book.genre,
        blurb: book.publishing?.description,
      }) ||
      (book.publishing?.subjects ?? [])
        .slice(0, 2)
        .map((s) => `subject:"${s}"`)
        .join(" ");

    setShelfIs(fromBook ? "book" : "general");
    setQuery(fromBook);
    void search(fromBook || GENERAL_SHELF);
  }, [book, search]);

  // The app's splash is for the app. In the roadmap's panel it would take
  // over half the window with a logo, so an embedded tool waits silently —
  // see `Pending` in `roadmap/step-panel.tsx`.
  if (!hydrated)
    return embedded ? (
      <div className={toolShell(embedded)} />
    ) : (
      <LoadingScreen />
    );

  if (!book) {
    return (
      <div className="grid h-[var(--oc-layout-height)] place-items-center bg-surface p-8 text-center">
        <div>
          <p className="text-lg font-bold text-fg">That book is not here.</p>
          <Link href="/" className="mt-3 inline-block text-accent">
            Back to your books
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={toolShell(embedded)}>
      {!embedded && (
        <ToolHeader
          book={book}
          tool="Covers"
          /* **The trail keeps the trade word, the heading says the job** — the
             split comps, the title check, the blurb and the categories screen
             all make. "Covers" is the word in the launcher and on the road, so
             it stays in the breadcrumb where a writer goes looking for it; as
             the `h1` it named the subject and not the work, which on a screen
             holding a wall of other people's artwork and a file checker left
             somebody to guess which of the two they had arrived at. */
          title="Does your cover hold up beside the shelf?"
          /* Matched to the container below. This screen's whole content is a
             wall of covers, and at 5xl the wall stopped a long way short of
             the window on both sides — the one page where extra width buys
             another column of the thing you came to look at. */
          /* Shortened for a deck that runs the header's full width: the
             closing flourish went and the two claims that cannot go — that we
             do not design covers, and will not generate one — stayed. Written
             long it broke into three short lines under a heading spanning the
             whole width, which is a column of text that lost its column. */
          action={<ToolStepDone state={save} />}
        >
          Your cover, in the shelf it has to sit on, at the size a reader meets
          it. We do not design covers and we will not generate one — this is the
          thing you would do yourself in a bookshop.
        </ToolHeader>
      )}

      {/* `@container`, so the checker's two columns size themselves off this
          column rather than off the window — the same reasoning the blurb and
          categories screens document. It matters here for the same reason it
          matters there: in the roadmap's panel this page is a ~700px column
          inside a full-width viewport, so a `lg:` breakpoint reading the
          window would put a 20rem rail beside a 200px one.

          Its absence was a real bug rather than a missing nicety. The checker
          asks for `@2xl:grid-cols-[20rem_…]` and with no container to measure
          that query never matched at any width, so the two columns silently
          stayed stacked and the artwork panel — which sizes itself by aspect
          ratio — grew to the full width of a `7xl` page and stood about 1,300
          pixels tall. */}
      <div className="@container mx-auto max-w-7xl px-(--oc-page-gutter) pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6">
        {heading}

        {/* The line the header carries when this screen owns the window.
        
            `ToolHeader` is suppressed in the roadmap's panel, and it was the
            only place this tool said what it is for — so the panel opened on a
            title, a search box and a file field, with nothing explaining why a
            screen called "Get a cover made" was asking to search. The panel
            gets the sentence too, since it is the frame that lost it. */}
        {embedded && (
          <div className="-mt-2 mb-6 flex items-start justify-between gap-4">
            <p className="max-w-2xl text-sm text-muted">
              Your cover, next to the shelf it has to sit on.
            </p>
            <ToolStepDone state={save} />
          </div>
        )}
        {/* **The switch, above the panel it switches and outside it.**

            Outside because it is not part of either half — it is the thing
            that chooses between them, and drawn inside it would have to be
            drawn twice, once in each.

            **Two segments rather than one toggling button.** A single button
            naming the other half was tried and is the weaker shape: it makes a
            reader work out that the word on the control is where they are
            *not*, and it never shows that there are exactly two halves at all.
            A segmented control states the whole choice and marks which one is
            on, which is why the size control below and the pricing page's
            cycle switch both take this form.

            It is that same control, deliberately: `rounded-lg` box, a hairline,
            `bg-panel` under `bg-accent` on the chosen one. One screen with two
            switches drawn differently is a screen that has to be learned
            twice. `w-fit`, so it hugs its words instead of stretching the page
            — a full-width segmented control reads as two buttons. */}
        <div
          role="tablist"
          aria-label="Cover tools"
          className="mt-8 flex w-fit gap-1 rounded-lg border border-line bg-panel p-1"
        >
          {(
            [
              ["shelf", "The shelf"],
              ["file", "Check a file"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={half === id}
              onClick={() => setHalf(id)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                half === id
                  ? "bg-accent text-accent-ink"
                  : "text-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* **One panel, two halves, and the button above swaps which is in
            it.** The two used to be a card and a block underneath it, with the
            checker appearing inside the *Yours* card while the wall sat loose
            below — so pressing a switch changed something in one container and
            something else in another. They are the same box now, at the same
            place on the page, and only the contents change. */}
        <section className="mt-3 rounded-xl border border-line bg-panel p-5">
          {/* Well above the `xl` other tool sections take, and it earns it: at
              `text-sm` this was a label stuck on a box rather than the name of
              the half of the screen that carries the answer, and this panel is
              the tallest block on the page with a search of its own at the
              top. `3xl` is a step under the page's own `h1`, which is the
              right relationship — the heading asks the question, this names
              the thing that answers it. Kept in step with "Yours" above.

              It also names which half you are in, which is what lets the
              control above it be one button rather than two. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-fg">
              {half === "shelf" ? "The shelf" : "Check the file"}
            </h2>
            {half === "shelf" && wall.length > 0 && (
              <span className="text-sm text-muted tabular-nums">
                {wall.length} covers
              </span>
            )}
          </div>

          {half === "file" ? (
            <CoverChecker bookId={book.id} />
          ) : (
            <>
              {/* **Everything that acts on this wall is inside it**, in the
                order comps settled on: the search, then the size, then the
                covers. The search used to live up in the Yours panel beside
                the tab strip that revealed this half — which made sense while
                a writer had to press before anything appeared, and stopped
                making sense the moment the wall loaded on arrival: the control
                that changes what you are looking at was a panel away from the
                thing it changes. Every shop that sells books puts its search
                directly above the covers it produces. */}
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  // Refused rather than disabled — the press past the limit is
                  // what puts the banner and the dialog on screen.
                  if (!gate.spend()) return;
                  void search(query);
                }}
              >
                <input
                  value={query}
                  onChange={(e) => {
                    // The seed is a starting point; once there is anything of
                    // the writer's in the box there is nothing left to start,
                    // so the arrival effect must not overwrite it.
                    touched.current = true;
                    // And the wall stops being ours to describe.
                    setShelfIs(null);
                    setQuery(e.target.value);
                  }}
                  placeholder="Words that describe your book"
                  aria-label="Search for comparable books"
                  className="min-w-[10rem] flex-1 rounded-lg border border-line bg-surface px-4 py-2.5
                           text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                />
                <button
                  type="submit"
                  disabled={state === "loading" || query.trim().length < 2}
                  className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
                >
                  {state === "loading" ? "Looking…" : "Show me the shelf"}
                </button>
              </form>

              {/* The other half of this screen — checking a file you already
                have — is not counted and not affected, which is why these sit
                under this form rather than under the tabs. */}
              <LeftPill allowance={shelfSearches} className="mt-2" />
              <LimitBanner allowance={shelfSearches} className="mt-4" />

              {/* Only when the wall is *not* this book's shelf. A caption naming
                the obvious case is furniture; this one has something to
                correct, and it belongs beside the covers it is correcting
                rather than up in the panel about your artwork. */}
              {shelfIs === "general" && (
                <p className="mt-3 max-w-prose text-xs text-muted">
                  This book has no genre, blurb or categories set, so these are
                  fiction generally rather than your own shelf. Describe the
                  book above to see that one.
                </p>
              )}

              {error && (
                <p className="mt-4 rounded-lg border border-line bg-surface p-4 text-sm text-fg">
                  {error}
                </p>
              )}

              {/* The control that matters. It opens on Large — see `SIZES` —
                  and the two smaller ones are the test: a title that dissolves
                  at 60px is a cover that fails where the decision is actually
                  made. Between the search and the covers because it acts on
                  the covers and not on the search: the row above changes
                  *which* books these are, this one changes how big they are
                  drawn — **including the writer's own, which is the whole
                  point of it now that theirs is in the wall.** */}
              {wall.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
                    {SIZES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSize(s.id)}
                        className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
                          size === s.id
                            ? "bg-accent text-accent-ink"
                            : "text-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <p className="max-w-prose text-sm text-muted">
                    {/* The count sits on the heading above, beside the thing it
                      counts. Said in both places it read as two figures a
                      reader had to reconcile. */}
                    {SIZES.find((s) => s.id === size)!.note}
                  </p>
                </div>
              )}

              {/* ---- The wall, and the writer's own cover leading it --------

                  **Theirs is *in* the shelf rather than in a panel above it.**
                  It used to be a card of its own headed "Yours", which was
                  taken off on 2026-08-11 for being a big box holding one
                  picture and a lot of empty desk. Putting it back as a card
                  would put the empty desk back with it — and it was never the
                  right shape anyway: a cover in its own frame, at its own
                  size, above a wall of other covers is a picture of your book
                  *near* the shelf rather than on it.

                  In the wall it is the comparison the screen is named for. It
                  takes the size control with everything else, so Thumbnail
                  draws it at 60px beside thirty real competitors at 60px —
                  which is the test this tool exists to run and the one thing a
                  separate panel could never do honestly, since a cover shown
                  alone always looks fine.

                  First, so it is found without hunting, and marked two ways:
                  the word **Yours** at full ink where a comp carries a muted
                  title, and a ring. The ring is `fg` rather than the accent —
                  the palette reserves indigo for what you can press, and this
                  is the same "you are here" job `CARD_EDGE_ACTIVE` does with
                  `border-fg` in the book panel.

                  It renders while the shelf is still loading, too: their own
                  cover needs no request, and a writer who arrives to a column
                  of grey rectangles should at least see the one thing this
                  screen never has to fetch. */}
              {(wall.length > 0 || state === "loading") && (
                <ul className="mt-4 flex flex-wrap gap-4">
                  <li style={{ width }}>
                    <div className="overflow-hidden rounded shadow-sm ring-2 ring-fg">
                      <BookCover
                        title={book.title}
                        subtitle={book.subtitle}
                        author={book.author}
                        words={bookWordCount(book)}
                        image={myCover ?? undefined}
                        bare={book.bareCover}
                        seed={book.id}
                      />
                    </div>
                    {/* Always named, at every size, unlike a comp's title —
                        without it this is just the first cover in a row and
                        the writer is comparing their book against itself. */}
                    <p className="mt-1.5 text-xs font-bold text-fg">
                      Yours
                      {!myCover && (
                        <span className="font-normal text-muted">
                          {" "}
                          · generated
                        </span>
                      )}
                    </p>
                  </li>

                  {state === "loading" && wall.length === 0
                    ? /* Shaped like the covers that replace them, at the size
                         currently picked, so nothing jumps when they land. */
                      Array.from({ length: 11 }, (_, i) => (
                        <li
                          key={`skeleton-${i}`}
                          aria-hidden
                          className="animate-pulse"
                          style={{ width }}
                        >
                          <div className="aspect-[2/3] w-full rounded bg-raised" />
                        </li>
                      ))
                    : wall.map((comp) => (
                        <li key={comp.key} style={{ width }}>
                          {/* A plain img: two third-party hosts whose URLs we do
                          not control, and next/image would mean a config file
                          listing them that goes stale. */}
                          {missing.has(comp.key) ? (
                            /* The title, set in the space the picture would
                               have taken, so the row keeps its rhythm and the
                               tile says what it is instead of saying nothing. */
                            <div
                              style={{ width }}
                              className="flex aspect-[2/3] items-center justify-center
                                         rounded border border-line bg-raised p-2
                                         text-center text-[11px] leading-tight text-muted
                                         shadow-sm"
                            >
                              <span className="line-clamp-4">{comp.title}</span>
                            </div>
                          ) : (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={comp.coverUrl}
                                alt={`Cover of ${comp.title}`}
                                style={{ width }}
                                className="rounded shadow-sm"
                                onError={() =>
                                  setMissing((was) =>
                                    was.has(comp.key)
                                      ? was
                                      : new Set(was).add(comp.key),
                                  )
                                }
                              />
                            </>
                          )}
                          {size !== "thumb" && (
                            <p className="mt-1.5 line-clamp-2 text-xs text-muted">
                              {comp.title}
                            </p>
                          )}
                        </li>
                      ))}
                </ul>
              )}

              {/* Inside the panel, where the covers would have been — it is the
                answer to the search two lines above it, and outside the box it
                read as a note about the page. */}
              {state === "done" && wall.length === 0 && (
                <p className="mt-5 text-sm text-muted">
                  No covers came back for that search. Try describing the story
                  rather than naming the genre.
                </p>
              )}
            </>
          )}
        </section>

        {/* Only once there is a wall to describe, and only while it is on
            screen. It ran unconditionally once, so a writer who had not
            searched yet read a paragraph about "the wall" and the fact that it
            is not scored, with nothing on screen it could be about — and the
            file half has no wall at all. */}
        {half === "shelf" && wall.length > 0 && (
          <div className="mt-10 border-t border-line pt-6">
            {/* The rule spans the page and the sentence does not.
                They were one element while a tool page was 3xl wide,
                where the two widths happened to agree; at 5xl a line of
                text run to the full container is about 160 characters,
                which is twice a readable measure. */}
            <p className="max-w-3xl text-xs text-muted">
              Covers are shown from Google Books and Open Library, at the size a
              reader meets them. The wall is not scored — a number comparing
              your cover to a genre would be invented to look like an answer.
              Look at the wall, then look at yours.
            </p>
          </div>
        )}
      </div>

      {gate.dialogOpen && (
        <LimitDialog action="covers" onClose={gate.closeDialog} />
      )}
    </div>
  );
}
