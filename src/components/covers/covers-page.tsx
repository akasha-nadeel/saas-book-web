"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { buildQuery, coversOf, type CompTitle } from "@/lib/comps/comps";
import {
  checkCover,
  contrastOf,
  enlarge,
  IDEAL_HEIGHT,
  IDEAL_RATIO,
  reshape,
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
 * - **`CoversPage`, the wall.** The writer's cover beside twenty others in the
 *   same genre — what they would do themselves given a bookshop and an
 *   afternoon. The size control is the feature rather than a convenience:
 *   nobody buys a book at the size a cover is designed at, they see it sixty
 *   pixels wide next to nine others and decide in about a second, so the wall
 *   opens at thumbnail. A cover whose title cannot be read at 60px has a
 *   problem no amount of admiring it at full size will reveal.
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

      // Contrast is measured on a small copy: a 2560px cover is six million
      // pixels and the answer does not change past a few thousand.
      let contrast: number | undefined;
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
          contrast = contrastOf(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
            4,
          );
        } catch {
          // A tainted canvas cannot be read. Every other check still works, so
          // the contrast note is simply absent rather than the whole thing
          // failing.
        }
      }

      const measured: CoverFacts = {
        width: image.naturalWidth,
        height: image.naturalHeight,
        bytes: file.size,
        ...(contrast !== undefined ? { contrast } : {}),
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
      setError("That file could not be read as an image.");
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

    return new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
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
    link.download = `cover-${out.width}x${out.height}.png`;
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
    const made = `cover-${out.width}x${out.height}.png`;
    setName(made);
    await read(new File([blob], made));
    setDone(
      plan.factor > 1
        ? `Written at ${out.width} × ${out.height}. It now passes the size check — but it was scaled up ${plan.factor.toFixed(1)}×, so it carries no more detail than the file you started with.`
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

    const made = `cover-${plan.width}x${plan.height}.png`;
    const result = await saveCover(
      bookId,
      new File([blob], made, { type: "image/png" }),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName(made);
    await read(new File([blob], made));
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
  const findings = shown ? checkCover(shown) : [];

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

  return (
    /* Sized for the card it now sits in. It was written as a standalone
       section — `mt-6` and a `text-xl font-extrabold` heading — which inside a
       panel titled "Yours" at `text-sm` put the sub-part in larger type than
       the thing containing it. The divider above supplies the gap, and the
       heading drops to the card's own scale. */
    <section>
      <h2 className="text-sm font-bold text-fg">Check the file</h2>
      <p className="mt-1.5 max-w-2xl text-sm text-muted">
        Whether a shop would refuse the artwork. Use your original file, not the
        compressed copy stored here — that one would fail on size.
      </p>

      {/* **The drop zone goes once a file is in, and comes back on Remove.**
          Carbon writes this one down: once a file is uploaded the drop area is
          removed, so the control shows the single file it holds rather than an
          invitation to add another beside it. Ours kept both on screen, which
          left a screen-wide dashed rectangle saying "drop another to check it
          instead" directly above the file it had already checked — two ways to
          do the same thing, and the larger of them was the one that was no
          longer the point.

          Removing is now the only way back to it, which is why that control is
          named and coloured rather than quiet. */}
      {/* A real drop target, because the sentence above promises one. This was
          a bare `<input type="file">`, which the browser draws as "Choose File |
          No file chosen" — the one undesigned control on a screen about how
          things look, under a line inviting the writer to *drop* a file on
          something that could not be dropped on. The words and the control now
          agree, and clicking still opens the picker, because the label wraps
          the input rather than replacing it. */}
      {!facts && (
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
          className={`mt-4 flex cursor-pointer flex-col items-center gap-1.5 rounded-xl
                      border-2 border-dashed px-6 py-7 text-center transition-colors ${
                        dragging
                          ? "border-accent bg-accent/8"
                          : "border-line bg-surface hover:border-accent/50"
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
          <span className="text-sm font-semibold text-fg">
            {name ?? "Drop your cover here, or choose a file"}
          </span>
          <span className="text-xs text-muted">
            {name
              ? "Drop another to check it instead."
              : "The file you are about to upload — not the copy stored here."}
          </span>
        </label>
      )}

      {error && <p className="mt-4 text-sm text-fg">{error}</p>}

      {/* **Green, and only ever for something that happened.** The status
          family in this app is red for refused, amber for worth doing, green
          for passed or earned — so a fix that has actually been written is the
          one thing on this screen entitled to it. It clears when a new file is
          read or the file is removed, because a confirmation outliving the
          thing it confirms is how a screen ends up congratulating somebody for
          work they have since undone. */}
      {done && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-ok-line bg-ok-bg px-3.5 py-2.5 text-sm text-ok-fg"
        >
          {done}
        </p>
      )}

      {/* **A way back out, which there was not one of.**

          Once a file was checked it stayed checked: the only escape was
          dropping a different one, and nothing on screen said so except a line
          of small print inside the drop zone. Every design system that has
          written this pattern down puts a named file and an explicit remove
          beside it — Carbon removes the drop zone once a file is in and gives
          the entry a close control; the Image Upload pattern lists *select,
          preview, validate, replace* as the four things the control has to
          let somebody do. Ours did three.

          The row names the file as well, because "the file you checked" is
          otherwise a picture at 80px and a writer with three exports in a
          folder cannot tell which one this was. */}
      {facts && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-3.5 py-2.5">
          <span className="min-w-0 truncate text-sm text-fg">
            {name ?? "Checked file"}
          </span>
          <button
            type="button"
            onClick={() => {
              setFacts(null);
              setPreview(null);
              setName(null);
              setError(null);
              setDone(null);
              setFromStored(false);
              // The measurement goes with the file it measured; the dashboard
              // must not keep reporting a cover nobody is checking any more.
              setCoverFacts(bookId, null);
            }}
            /* Red, because it is now the only way out of this state and it
               throws the checked file away. Grey read as a secondary label
               rather than a control. */
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-danger
                       hover:bg-stop-bg focus-visible:ring-2
                       focus-visible:ring-accent/50 focus-visible:outline-none"
          >
            Remove
          </button>
        </div>
      )}

      {shown && (
        <div className="mt-6 flex flex-wrap gap-6">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="h-[120px] w-[80px] shrink-0 rounded object-cover shadow-sm"
            />
          )}
          <div className="min-w-[16rem] flex-1">
            <p className="max-w-prose text-sm text-muted">
              {shown.width.toLocaleString()} × {shown.height.toLocaleString()}{" "}
              pixels
              {/* No weight for the stored copy: its size on disk is an artefact
                  of this app's own compression, not a fact about the writer's
                  artwork, and printing it beside a shop's 50MB limit would
                  invite exactly the wrong conclusion. */}
              {shown.bytes > 0 ? ` · ${(shown.bytes / 1024).toFixed(0)}KB` : ""}{" "}
              · {(shown.height / shown.width).toFixed(2)}:1
            </p>

            {fromStored && (
              /* Which picture this is, said before anything is done to it. */
              <p className="mt-2 max-w-prose rounded-lg border border-note-line bg-note-bg px-3.5 py-2.5 text-sm text-note-fg">
                This is the cover already on the book, not your original — the
                copy kept here is compressed to fit a browser. Putting its shape
                right fixes the cover in your EPUB and on the shelf. For the
                file you upload to a shop, fix the original and check that.
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
            {facts && (shapeOff || smallerThanIdeal) && (
              <div className="mt-3 rounded-lg border border-line bg-panel p-4">
                <p className="text-sm font-bold text-fg">Fix the file</p>
                <p className="mt-1 max-w-prose text-sm text-muted">
                  You choose what shows before anything is written. Nothing is
                  uploaded and this file is not changed — you get a copy.
                </p>
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
                                     rounded-lg border border-line bg-surface px-4 py-3 text-left
                                     hover:border-accent/40 focus-visible:ring-2
                                     focus-visible:ring-accent/50 focus-visible:outline-none"
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
                                     rounded-lg border border-line bg-surface px-4 py-3 text-left
                                     hover:border-accent/40 focus-visible:ring-2
                                     focus-visible:ring-accent/50 focus-visible:outline-none"
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
                 fix buttons that have nothing to work on. */
              <p className="mt-3 rounded-lg border border-line bg-panel p-4 text-sm text-muted">
                Measured when you last checked this file. The artwork itself is
                never kept here, so drop the same file again to put any of this
                right.
              </p>
            )}

            {findings.length === 0 ? (
              <p className="mt-3 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
                Nothing a shop would refuse, and nothing worth flagging. That is
                the <em>file</em> checked. Whether the cover works is a
                different question, and the shelf above is how you answer it.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {findings.map((finding) => (
                  <li
                    key={finding.id}
                    className="rounded-lg border border-line bg-panel p-4"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                          finding.level === "problem"
                            ? "bg-stop-bg text-stop-fg"
                            : "bg-raised text-muted"
                        }`}
                      >
                        {finding.level === "problem" ? "problem" : "note"}
                      </span>
                      <span className="font-bold text-fg">{finding.label}</span>
                    </span>
                    <p className="max-w-prose mt-1.5 text-sm text-muted">
                      {finding.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-xs text-muted">
              Measured in your browser; the file is never uploaded. These are
              Amazon KDP&rsquo;s published figures and do not replace the
              shop&rsquo;s own check. Two things decide a cover and neither can
              be measured: whether the title is readable at 60px, and whether it
              looks like its genre. Both are up there on the wall.
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

/** Thumbnail first: it is the size the decision is actually made at. */
const SIZES = [
  { id: "thumb", label: "Thumbnail", width: 60, note: "as a shop shows it" },
  { id: "browse", label: "Browsing", width: 110, note: "as a shelf shows it" },
  { id: "large", label: "Large", width: 180, note: "as you designed it" },
] as const;

type SizeId = (typeof SIZES)[number]["id"];

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
  const [size, setSize] = useState<SizeId>("thumb");

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

  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    setQuery(
      buildQuery({ genre: book.genre, blurb: book.publishing?.description }),
    );
  }, [book]);

  /**
   * The free plan's ten cover searches.
   *
   * Every search here is one the writer pressed for — this screen seeds the box
   * but never runs it — so there is no free arrival search to carve out, as
   * there is on comps and the title check.
   */
  const gate = useLimitGate({ action: "covers" });
  const shelfSearches = gate.allowance;

  const wall = useMemo(() => coversOf(books), [books]);
  const width = SIZES.find((s) => s.id === size)!.width;

  async function search(q: string) {
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
  }

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
          /* Matched to the container below. This screen's whole content is a
             wall of covers, and at 5xl the wall stopped a long way short of
             the window on both sides — the one page where extra width buys
             another column of the thing you came to look at. */
          action={<ToolStepDone state={save} />}
        >
          Your cover, next to the shelf it has to sit on. We do not design
          covers and we will not generate one — this is the thing you would do
          yourself in a bookshop, if you had the afternoon.
        </ToolHeader>
      )}

      <div className="mx-auto max-w-7xl px-6 pt-6 pb-16">
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
        {/* **Yours is on screen from the start, not summoned by a search.**
            It used to sit inside `wall.length > 0`, so a writer arriving on
            this tool saw a search box and a dashed box of instructions — and
            the one thing the screen could show them without asking anything,
            their own cover, was hidden behind a button. The shelf needs a
            query; this does not.

            The space beside it was empty because the cover is a fixed width
            and the panel is not. What fills it is what a writer is deciding
            *about* — the words printed on the artwork, at the size they are
            actually read — plus whether this is real artwork or the generated
            stand-in. Facts off the book, not advice about it. */}
        <section className="mt-8 rounded-xl border border-line bg-panel p-5">
          <h2 className="text-sm font-bold text-fg">Yours</h2>
          <div className="mt-3 flex flex-wrap items-start gap-6">
            <div className="shrink-0" style={{ width }}>
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

            {/* **The controls live in the card, beside what they act on.**
                They were stacked above it — a tab strip, then a search row,
                then the cover — so the screen read as three unrelated bands
                and the widest element on it was a text field. Put beside the
                cover they explain themselves: this is yours, and this is how
                you want to look at it.

                The metadata that briefly sat here (title, subtitle, author,
                artwork) is gone. It was true and it was the wrong thing: a
                writer on this screen is not checking their own title, they are
                deciding whether the artwork survives a shelf, and four rows
                restating the fields printed on the picture beside them is a
                caption nobody needs.

                `w-full` under the fold and `flex-1` beside it, so on a phone
                the controls sit under the cover at full width rather than
                squeezing into whatever the cover leaves. */}
            <div className="w-full min-w-[16rem] flex-1">
              <div
                role="tablist"
                aria-label="Cover tools"
                className="flex gap-1 rounded-lg border border-line bg-surface p-1"
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
                    className={`flex-1 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      half === id
                        ? "bg-accent text-accent-ink"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {half === "shelf" ? (
                <>
                  <form
                    className="mt-3 flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      // Refused rather than disabled — the eleventh press
                      // is what puts the banner and the dialog on screen.
                      if (!gate.spend()) return;
                      void search(query);
                    }}
                  >
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
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

                  {/* The other half of this screen — checking a file you
                      already have — is not counted and not affected, which is
                      why the note sits under this form rather than the tabs. */}
                  <LeftPill allowance={shelfSearches} className="mt-2" />
                  <LimitBanner allowance={shelfSearches} className="mt-4" />
                  <p className="mt-3 max-w-prose text-xs text-muted">
                    {myCover
                      ? "Shown at the size a reader meets it. Whether the title still reads at thumbnail size is what the shelf below answers."
                      : "No artwork on this book yet, so that is the generated one. Search, and compare it with the shelf."}
                  </p>
                </>
              ) : (
                <p className="mt-3 max-w-prose text-xs text-muted">
                  Drop the file you are about to upload just here. It is
                  measured in your browser and never sent anywhere.
                </p>
              )}
            </div>
          </div>

          {/* **The half's own content, inside the same box.** The card held the
              controls and then handed off to a separate block underneath — so
              choosing "Check a file" lit a tab in one container and drew the
              answer in another, with desk showing between them. A tab strip
              and the thing it switches belong to one surface; that is what
              makes it read as a switch rather than as two features that happen
              to be stacked.

              Divided rather than boxed again: a nested card inside a card is
              the pattern this page has just finished removing elsewhere. */}
          {/* Tightened twice now. The gap above this rule is set by the cover's
              height rather than by the controls beside it — in file mode the
              right column is a tab strip and two lines, so the row is as tall
              as the picture and the divider lands well under the text. Trimming
              the margins is the part that is ours to trim. */}
          <div className="mt-2 border-t border-line pt-3">
            {half === "shelf" ? (
              wall.length === 0 &&
              state !== "loading" &&
              !error && (
                <>
                  <p className="text-sm font-semibold text-fg">
                    We do not design covers.
                  </p>
                  <p className="mt-1.5 max-w-2xl text-sm text-muted">
                    Press <strong className="text-fg">Show me the shelf</strong>{" "}
                    to see yours beside the covers already selling in your
                    genre, at the size a reader meets them.
                  </p>
                </>
              )
            ) : (
              <CoverChecker bookId={book.id} />
            )}
          </div>
        </section>

        <div hidden={half !== "shelf"}>
          {error && (
            <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
              {error}
            </p>
          )}

          {wall.length > 0 && (
            <>
              {/* The control that matters. Thumbnail is the default because it
                is where the decision is really made. */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-lg border border-line bg-panel p-1">
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
                  {/* The count moved onto the shelf panel's own heading, where
                    it is beside the thing it counts. Said in both places it
                    read as two figures a reader had to reconcile. */}
                  {SIZES.find((s) => s.id === size)!.note}
                </p>
              </div>

              {/* **The shelf, boxed like Yours.** It was a bare heading over a
                loose grid, so the two halves of the one comparison — your
                cover and the wall it has to survive — were drawn as different
                kinds of thing. Same panel, same padding: the eye reads them as
                a pair, which is the entire point of the screen. */}
              <section className="mt-8 rounded-xl border border-line bg-panel p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-sm font-bold text-fg">The shelf</h2>
                  <span className="text-xs text-muted tabular-nums">
                    {wall.length} covers
                  </span>
                </div>
                <ul className="mt-3 flex flex-wrap gap-4">
                  {wall.map((comp) => (
                    <li key={comp.key} style={{ width }}>
                      {/* A plain img: two third-party hosts whose URLs we do not
                        control, and next/image would mean a config file listing
                        them that goes stale. */}
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
              </section>
            </>
          )}

          {state === "done" && wall.length === 0 && (
            <p className="mt-8 text-muted">
              No covers came back for that search. Try describing the story
              rather than naming the genre.
            </p>
          )}

          {/* Only once there is a wall to describe. It ran unconditionally, so
            a writer who had not searched yet read a paragraph about "the wall"
            and the fact that it is not scored, with nothing on screen it could
            be about. */}
          {wall.length > 0 && (
            <div className="mt-10 border-t border-line pt-6">
              {/* The rule spans the page and the sentence does not.
              They were one element while a tool page was 3xl wide,
              where the two widths happened to agree; at 5xl a line of
              text run to the full container is about 160 characters,
              which is twice a readable measure. */}
              <p className="max-w-3xl text-xs text-muted">
                Covers are shown from Google Books and Open Library, at the size
                a reader meets them. The wall is not scored — a number comparing
                your cover to a genre would be invented to look like an answer.
                Look at the wall, then look at yours.
              </p>
            </div>
          )}
        </div>
      </div>

      {gate.dialogOpen && (
        <LimitDialog action="covers" onClose={gate.closeDialog} />
      )}
    </div>
  );
}
