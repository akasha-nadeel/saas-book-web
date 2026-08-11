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
  const askedFor = useSearchParams().get("fix") ?? "";
  const [intent, setIntent] = useState(askedFor);

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
  const [dragging, setDragging] = useState(false);
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
  const [done, setDone] = useState<string | null>(null);

  async function read(file: File) {
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
    const made = `cover-${out.width}x${out.height}.jpg`;
    setName(made);
    await read(new File([blob], made, { type: "image/jpeg" }));
    /* Three outcomes, three sentences. The reshape message used to be the
       fallback for everything, so the format fix — which changes the container
       and nothing else — would have announced a shape it had not touched. A
       confirmation that overstates what it did is the same fault as a check
       that clears a bad file. */
    const sameSize = out.width === facts.width && out.height === facts.height;
    setDone(
      plan.factor > 1
        ? `Written at ${out.width} × ${out.height}. It now passes the size check — but it was scaled up ${plan.factor.toFixed(1)}×, so it carries no more detail than the file you started with.`
        : sameSize
          ? `Written as a JPEG at ${out.width} × ${out.height}. Every pixel is where it was — only the format changed. Upload the download, not this file.`
          : `Written at ${out.width} × ${out.height}, ${IDEAL_RATIO}:1. Check the download and upload that file, not this one.`,
    );
  }

  /**
   * Put the reshaped picture on the book, without a round trip through disk.
   *
   * **Through `importImage`, not straight into the store.** That is the same
   * path the shelf's own cover picker uses, so this file gets the same
   * shrinking to the same 250KB budget and the same refusal message when it
   * cannot get there — rather than a second, slightly different upload route
   * that drifts from the first. `setCover` returns false when the write fails
   * and that is honoured rather than assumed.
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
    await read(new File([blob], made, { type: "image/jpeg" }));
    /* **Says what the export will actually package.** The old wording —
       "that copy is compressed for the shelf here" — was true of the *only*
       copy this app kept, and told a writer their file was worse than it was
       going to be. The full-size artwork is kept now (see cover-save.ts), so
       the honest thing to report is the size of what goes into the EPUB. The
       fallback case says so too rather than claiming a resolution it does not
       have. */
    setDone(
      result.printStored
        ? `Set as this book's cover, at ${result.width}×${result.height} — that is what goes into your EPUB.`
        : "Set as this book's cover. This browser would not store the full-size copy, so the export will use a smaller one — download the file and upload it to the shop yourself.",
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
   * Open the promised window on the cover the book already has.
   *
   * Runs once, only when sent here by a finding, and only when the stored
   * cover really does have the problem the finding named — the same guard the
   * dropped-file path uses, for the same reason.
   */
  useEffect(() => {
    if ((intent !== "shape" && intent !== "enlarge") || facts) return;
    const dataUrl = getCover(bookId);
    if (!dataUrl) return;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      /* Spent here rather than in the effect body: a synchronous setState in
         an effect cascades renders, and this is a callback from an external
         system, which is what effects are actually for. Spent whether or not
         the window opens — the stored cover has been examined either way. */
      setIntent("");
      const w = image.naturalWidth;
      const h = image.naturalHeight;

      /* Load the stored cover for either errand, but only *open* a window for
         the one that has a decision in it. An enlarge has none — it is a
         single button on the panel below — and running it unasked would
         replace somebody's cover with a blurrier one before they had read why
         that is what enlarging does. */
      const wantsShape = intent === "shape";
      if (wantsShape && Math.abs(h / w - IDEAL_RATIO) <= 0.05) return;

      /* Shown, not stored: `setCoverFacts` is deliberately not called here.
         These are the compressed copy's dimensions, and writing them over the
         original's measurement would make the dashboard report the wrong
         file — the exact confusion this screen warns about. */
      setFromStored(true);
      setPreview(dataUrl);
      setFacts({ width: w, height: h, bytes: 0 });

      if (wantsShape) {
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
  }, [intent, facts, bookId]);

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
            if (file) {
              setName(file.name);
              void read(file);
            }
          }}
          className={`mt-5 flex max-w-xl cursor-pointer flex-col items-center justify-center
                      gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center
                      transition-colors ${
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
              if (file) {
                setName(file.name);
                void read(file);
              }
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
          {/* **Not "JPEG or PNG", which is what this said for about an hour
              and is the exact advice that gets a cover rejected.** Amazon takes
              JPEG and TIFF for an ebook cover; PNG is what every design tool
              exports by default, so naming it here would have been this screen
              causing the refusal it exists to prevent. The `accept` attribute
              deliberately stays wider than the rule — a writer who picks a PNG
              anyway must be *told* it is a PNG, not have the file quietly
              hidden by a picker with no explanation. */}
          {/* **What this page can check, which is not the same list.** Amazon
              takes JPEG and TIFF; browsers cannot open a TIFF at all, so
              naming both here promised a check that fails on one of them. The
              `accept` attribute deliberately stays wider than either list — a
              writer who picks a PNG must be *told* it is a PNG, not have the
              file quietly hidden by a picker that explains nothing. */}
          <span className="max-w-xs text-xs text-muted">
            The file you are about to upload — not the copy stored here. JPEG is
            what Amazon wants and what this page can measure.
          </span>
        </label>
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
            {/* The picture at a size a decision can be made from. Framed
                rather than bare: a cover with a white ground and no border
                bleeds into the panel and stops looking like a file. */}
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="w-full rounded-lg border border-line bg-surface object-contain shadow-sm"
              />
            ) : (
              /* **The numbers outlived the picture, and the box says so —
                 briefly.** Arriving from a dashboard finding, the
                 measurements are read back from `coverfacts:` and the artwork
                 itself is not kept.

                 It was drawn at the aspect ratio those numbers describe, on
                 the reasoning that the shape *is* one of the findings. In
                 practice that made an empty 320 × 512 rectangle holding one
                 line of grey text — the largest thing on the screen, saying
                 the least, and towering over the report it was supposed to
                 support. Absence is not worth an illustration. Two lines and
                 a rule under them, with the shape stated properly in the list
                 below where every other measurement is. */
              <div
                className="rounded-lg border border-dashed border-line bg-surface
                           px-3.5 py-3 text-xs text-muted"
              >
                The artwork itself is not kept here — only what was measured.
                Drop the file again to see it.
              </div>
            )}

            {/* The file's identity and the two things you can do to it. Named,
                because "the file you checked" is otherwise a picture and a
                writer with three exports in a folder cannot tell which.

                Three states, because there are three: a file handed over now,
                the cover already on the book, and a set of numbers left from a
                check that happened on some earlier visit. Calling that third
                one "Checked file" implied a file was present. */}
            <p className="mt-3 truncate text-sm font-medium text-fg">
              {name ??
                (fromStored
                  ? "The cover on this book"
                  : facts
                    ? "Checked file"
                    : "Last checked file")}
            </p>

            {/* **Replace is a first-class control now, not small print.** It
                was a line inside the drop zone reading "drop another to check
                it instead", which is an instruction rather than a control —
                and once the drop zone went there was no way to check a second
                file except Remove, then drop. The Image Upload pattern names
                four things this has to allow: select, preview, validate,
                *replace*. This is the fourth. */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label
                className="cursor-pointer rounded-md border border-line px-2.5 py-1
                           text-xs font-semibold text-fg transition-colors hover:bg-raised"
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
                onClick={() => {
                  setFacts(null);
                  setPreview(null);
                  setName(null);
                  setError(null);
                  setDone(null);
                  setFromStored(false);
                  // The measurement goes with the file it measured; the
                  // dashboard must not keep reporting a cover nobody is
                  // checking any more.
                  setCoverFacts(bookId, null);
                }}
                /* Quiet until hovered. It throws the checked file away, so it
                   carries the danger colour — but sitting permanently red
                   beside a neutral control it read as the primary action of
                   the pair, which it is not. */
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-muted
                           transition-colors hover:bg-stop-bg hover:text-danger
                           focus-visible:ring-2 focus-visible:ring-accent/50
                           focus-visible:outline-none"
              >
                Remove
              </button>
            </div>

            {/* **The measurements as a labelled list, not a run of numbers.**
                They were one grey line — `679 × 960 pixels · 69KB · 1.41:1` —
                which is three different kinds of fact separated by dots, none
                of them named. A definition list is what every inspector panel
                uses, and the labels are what make "1.41:1" mean anything to
                somebody who has not read the checks below yet. */}
            <dl className="mt-4 border-t border-line pt-3 text-sm">
              {[
                [
                  "Pixels",
                  `${shown.width.toLocaleString()} × ${shown.height.toLocaleString()}`,
                ],
                ["Shape", `${(shown.height / shown.width).toFixed(2)}:1`],
                /* No weight for the stored copy: its size on disk is an
                   artefact of this app's own compression, not a fact about the
                   writer's artwork, and printing it beside a shop's 50MB limit
                   would invite exactly the wrong conclusion. */
                ...(shown.bytes > 0
                  ? ([["File", fileSize(shown.bytes)]] as const)
                  : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-1">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-medium text-fg tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
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
                className="mb-4 rounded-lg border border-ok-line bg-ok-bg px-3.5 py-2.5 text-sm text-ok-fg"
              >
                {done}
              </p>
            )}

            {fromStored && (
              /* Which picture this is, said before anything is done to it. */
              <p className="mb-4 rounded-lg border border-note-line bg-note-bg px-3.5 py-2.5 text-sm text-note-fg">
                This is the cover already on the book, not your original — the
                copy kept here is compressed to fit a browser. Putting its shape
                right fixes the cover in your EPUB and on the shelf. For the
                file you upload to a shop, fix the original and check that.
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
              {report.map((check) => (
                <li key={check.id} className="flex gap-3 py-3">
                  <CheckMark status={check.status} />
                  <div className="min-w-0">
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

            {/* **Putting the shape right, and only the shape.**

                Offered when the ratio is off, which is the one complaint on
                this screen that can be answered honestly without inventing
                pixels: both modes draw the artwork at 1:1, so nothing is
                resampled. "Too small" gets no button on purpose — scaling a
                554px cover up to 1600 would clear the shop's check and hand
                back a softer picture, and a tool that makes its own warning
                disappear while making the book worse has helped nobody.

                Both choices are shown with what each costs, rather than one
                being picked: cropping trims the long edge and on a cover that
                is usually a byline near the border, while padding keeps every
                pixel and adds bars. Neither is right in general.

                Nothing is uploaded and the original is untouched — the result
                is drawn in a canvas and handed straight to the writer as a
                download. */}
            {/* **Every fix the file has, in one panel.** Shape when the ratio
                is off; size when it is under what shops recommend. The panel
                appears when either applies and hides when neither does, so a
                clean file gets no repair shop it does not need.

                The enlarge is the one that resamples, and it took two asks to
                add. It is here because refusing it did not stop anyone wanting
                a 1600×2560 file — it only stopped them getting one where the
                screen could say what it costs. So the cost is on the button, in
                the dialog, and in the confirmation afterwards, and it is the
                only fix whose green message declines to call the result
                better. */}
            {/* **Under the report, not over it.** It sat above the findings,
                so a writer met three buttons offering to change their file
                before reading a word about what was wrong with it — a remedy
                ahead of the diagnosis. The order is what the report is for:
                here is the file, here is what each rule says, here is what can
                be done about the two that failed. */}
            {facts && (shapeOff || smallerThanIdeal || wrongFormat) && (
              <div className="mt-5 rounded-lg border border-line bg-surface p-4">
                <p className="text-sm font-bold text-fg">Fix the file</p>
                <p className="mt-1 max-w-prose text-sm text-muted">
                  You choose what shows before anything is written. Nothing is
                  uploaded and this file is not changed — you get a copy.
                </p>

                {/* **The format fix, and it is the plainest one here.**

                    It had no button at first, on the reasoning that re-saving
                    is the writer's job. That was wrong twice over. The remedy
                    is entirely mechanical — the same canvas the other two fixes
                    already use, drawing the artwork at its own size so not a
                    pixel moves — and the writers who most need it are the ones
                    least likely to own something that re-encodes an image.
                    Telling somebody their file is the wrong container while
                    holding the one line of code that changes the container is
                    the sort of help that is really a shrug.

                    Straight to the file with no dialog, like the enlarge: there
                    is nothing to choose. Nothing is cropped, nothing is scaled,
                    and the only thing that can be lost is transparency, which
                    an ebook cover must not have anyway. */}
                {wrongFormat && (
                  <button
                    type="button"
                    onClick={() =>
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
                      )
                    }
                    className="mt-3 flex w-full flex-wrap items-center justify-between gap-x-4
                               gap-y-1 rounded-lg border border-line bg-panel px-4 py-3
                               text-left transition-colors hover:border-accent/40
                               hover:bg-raised focus-visible:ring-2
                               focus-visible:ring-accent/50 focus-visible:outline-none"
                  >
                    <span className="text-sm font-semibold text-fg">
                      Save it as a JPEG
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      {facts.width} × {facts.height} · same pixels, a format
                      Amazon takes
                    </span>
                  </button>
                )}
                {/* **Banners, not chips.** These were small boxes in a row
                    while the findings under them were full-width bordered
                    rows, so the *actions* were the smallest thing in a panel
                    of statements — and on a narrow window the third one
                    wrapped onto its own line and looked like a different kind
                    of control from the two beside it.

                    Stacked and full width, each reads as one line: what it
                    will do on the left, what it costs on the right. Same shape
                    as the rows they sit above, which is what makes the panel
                    read as answer-then-consequence rather than as two
                    unrelated lists. */}
                <div className="mt-3 flex flex-col gap-2">
                  {shapeOff &&
                    (["crop", "pad"] as const).map((mode) => {
                      const out = reshape(facts.width, facts.height, mode);
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() =>
                            setShaping({
                              id: mode,
                              width: out.width,
                              height: out.height,
                              // Crop and pad draw the artwork at its own size:
                              // 1:1, nothing invented.
                              drawWidth: facts.width,
                              drawHeight: facts.height,
                              factor: 1,
                              tooSmall: out.tooSmall,
                            })
                          }
                          className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1
                                     rounded-lg border border-line bg-panel px-4 py-3 text-left
                                     transition-colors hover:border-accent/40 hover:bg-raised
                                     focus-visible:ring-2 focus-visible:ring-accent/50
                                     focus-visible:outline-none"
                        >
                          <span className="text-sm font-semibold text-fg">
                            {mode === "crop" ? "Crop to fit" : "Pad with bars"}
                          </span>
                          <span className="text-xs text-muted tabular-nums">
                            {out.width} × {out.height} ·{" "}
                            {mode === "crop"
                              ? `${out.changed}px trimmed`
                              : `${out.changed}px added`}
                            {out.tooSmall ? " · falls under 1000px" : ""}
                          </span>
                        </button>
                      );
                    })}

                  {smallerThanIdeal &&
                    (() => {
                      const big = enlarge(facts.width, facts.height);
                      return (
                        <button
                          type="button"
                          /* **Straight to the file, no dialog.** The other two
                             open one because they ask a question — which part
                             of the picture survives a crop, where the bars
                             fall. Enlarging asks nothing: the artwork is
                             scaled to cover the frame and, when the shape is
                             already right, there is not a pixel of slack to
                             drag. A modal whose only content is a preview of
                             the single possible answer is a step that exists
                             to be dismissed.

                             Centred, which is exact when the ratio matches and
                             the sane default when it does not — and a writer
                             who wants to choose has Crop and Pad, which appear
                             for exactly that case. */
                          onClick={() =>
                            void downloadShape(
                              { id: "enlarge", ...big, tooSmall: false },
                              {
                                x: (big.width - big.drawWidth) / 2,
                                y: (big.height - big.drawHeight) / 2,
                              },
                            )
                          }
                          className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1
                                     rounded-lg border border-line bg-panel px-4 py-3 text-left
                                     transition-colors hover:border-accent/40 hover:bg-raised
                                     focus-visible:ring-2 focus-visible:ring-accent/50
                                     focus-visible:outline-none"
                        >
                          <span className="text-sm font-semibold text-fg">
                            Enlarge to {big.width} × {big.height}
                          </span>
                          <span className="text-xs text-muted tabular-nums">
                            scaled up {big.factor.toFixed(1)}× · adds no detail
                          </span>
                        </button>
                      );
                    })()}
                </div>
              </div>
            )}

            {!facts && (shapeOff || smallerThanIdeal) && (
              /* Arrived from the dashboard: the numbers survived, the picture
                 did not. Saying which is better than either hiding the
                 findings — the writer came here *because* of them — or showing
                 fix buttons that have nothing to work on.

                 It stands where the fix panel would have been, which is what
                 makes it read as the answer to "so what do I do about it" — the
                 question the report directly above has just raised. */
              <p className="mt-5 max-w-prose rounded-lg border border-line bg-surface p-4 text-sm text-muted">
                These were measured when you last checked this file. The artwork
                itself is never kept here, so drop the same file again to put
                any of it right.
              </p>
            )}

            <p className="mt-4 max-w-prose text-xs text-muted">
              Measured in your browser; the file is never uploaded. These are
              Amazon KDP&rsquo;s published figures and do not replace the
              shop&rsquo;s own check. Two things decide a cover and neither can
              be measured: whether the title is readable at 60px, and whether it
              looks like its genre. Both are on the shelf.
            </p>
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
 */
function CheckMark({ status }: { status: CoverCheck["status"] }) {
  const look =
    status === "problem"
      ? {
          ring: "border-stop-line bg-stop-bg text-stop-fg",
          d: "M6 6l8 8M14 6l-8 8",
        }
      : status === "note"
        ? {
            ring: "border-note-line bg-note-bg text-note-fg",
            d: "M10 5v6M10 14v.5",
          }
        : {
            ring: "border-ok-line bg-ok-bg text-ok-fg",
            d: "M5 10.5l3.5 3.5L15 7",
          };

  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${look.ring}`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3"
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
      <div className="grid h-dvh place-items-center bg-surface p-8 text-center">
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
          /* **The deck runs the page, as comps' does.** Capped at 2xl it broke
             into three short lines under a heading spanning the full width,
             with an acre of empty header beside it — a column of text that
             lost its column. `ToolHeader`'s own note is the condition that
             comes with widening it: shorten the words in the same change, or
             the cap returns as a hundred-and-sixty-character line. So the
             closing flourish went and the two claims that cannot go — that we
             do not design covers, and will not generate one — stayed. */
          deckWidth="full"
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
      <div className="@container mx-auto max-w-7xl px-6 pt-6 pb-16">
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
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={comp.coverUrl}
                            alt={`Cover of ${comp.title}`}
                            style={{ width }}
                            className="rounded shadow-sm"
                          />
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
