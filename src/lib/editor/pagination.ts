import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { keepCaretInView, scrollParent } from "./caret-scroll";

/**
 * Print layout for the editor: the manuscript set on real page sheets.
 *
 * A live editor is one continuous surface — ProseMirror will not fragment it
 * into pages. So this does what a word processor does under the hood: it
 * measures the rendered blocks, works out where each page ends, and inserts a
 * spacer at that point that pushes the next block down onto the following sheet.
 * The spacers are *decorations*, never document content — the manuscript itself
 * is never touched, so undo, autosave and export see the same text they always
 * did. The white sheets behind are drawn by React from the page count reported
 * here.
 *
 * Everything is measured in unzoomed CSS pixels (offsetTop/offsetHeight, which a
 * CSS transform does not affect), so the page breaks are the same at every zoom
 * level — zoom only scales what is already laid out.
 */

/** Page geometry in CSS pixels, at 96px to the inch. */
export interface PageGeometry {
  pageW: number;
  pageH: number;
  /** Margins. */
  mT: number;
  mB: number;
  mL: number;
  mR: number;
  /** Page height less its top and bottom margins — the text area. */
  contentH: number;
  /** The desk gap drawn between one sheet and the next. */
  gap: number;
}

export interface PaginationOptions {
  /** Latest geometry, read fresh each measure so a page-setup change is picked
   *  up without rebuilding the editor. Null disables pagination. */
  getGeometry: () => PageGeometry | null;
  /** Reports the page count so the sheet layer can be drawn. */
  onPages: (count: number) => void;
}

export interface Spacer {
  /** Document position the gap is inserted before. */
  pos: number;
  /** Its height in unzoomed pixels. */
  height: number;
  /**
   * The gap falls inside a paragraph rather than between two blocks, so the
   * widget has to be an inline one that the surrounding text flows around.
   */
  inline: boolean;
}

/**
 * One laid-out line, in natural-flow pixels measured from the top of the first
 * page's text area — that is, the document as it would be with no page gaps in
 * it at all.
 *
 * `top` and `height` are the *line box*: the full stripe of the column the line
 * occupies, leading and all. Not the text's own rectangle, which is the em box
 * of the glyphs and is shorter — measuring that instead makes every line look
 * smaller than it is, so the page appears to have room it does not have and the
 * last line of each page spills into the bottom margin.
 */
export interface LineBox {
  top: number;
  height: number;
  /** Where a break before this line inserts its gap. */
  pos: number;
  /** True for every line but a block's first: breaking there splits a
   *  paragraph, so the gap is inline. A block's first line breaks between
   *  blocks, which is the older and simpler case. */
  inline: boolean;
}

/** A top-level block, measured with one rectangle read — the cheap pass. */
export interface BlockBox {
  top: number;
  height: number;
  /** Document position before the block. */
  pos: number;
  /** Whether a page may break inside it rather than only in front of it. */
  splittable: boolean;
}

/**
 * Where the pages break.
 *
 * The whole of the pagination arithmetic, kept pure and away from the DOM so it
 * can be tested against numbers rather than against a browser. It walks the
 * lines in order, keeping the natural-flow y at which the current page's text
 * area begins, and opens a new page as soon as a line would overhang the one it
 * is on.
 *
 * Working in *lines* rather than in blocks is the point of it. A paragraph is
 * not an atom: Word fills a page to the bottom and continues the same paragraph
 * on the next sheet, and a manuscript full of long paragraphs looks wrong any
 * other way — pushing a whole twenty-line paragraph down leaves a hole where a
 * page should have been full.
 */
export function pageBreaks(
  blocks: BlockBox[],
  g: PageGeometry,
  /**
   * A block's lines, fetched only for a block that actually straddles a page
   * edge. Reading line boxes means a Range, its rectangles and a position
   * lookup per line; doing that for every paragraph in a chapter on every
   * keystroke is what made typing stutter. At most one block per page needs it.
   */
  linesOf: (block: BlockBox) => LineBox[] | null,
): Spacer[] {
  const gapBetween = g.mB + g.gap + g.mT;
  const spacers: Spacer[] = [];
  let pageStart = 0;

  /** Any part of it falls past the foot of the page it is on. */
  const runsPast = (top: number, height: number) =>
    // The +1 forgives a sub-pixel overshoot rather than breaking a page early.
    top + height - pageStart > g.contentH + 1;

  /**
   * ...and there is something above it on this page, so moving it down is worth
   * doing. A thing that *starts* a page and still does not fit is taller than a
   * page: it has nowhere better to go, and pushing it would only strand an empty
   * sheet in front of it.
   */
  const canMove = (top: number) => top > pageStart;

  const breakBefore = (top: number, pos: number, inline: boolean) => {
    const height = Math.round(g.contentH - (top - pageStart) + gapBetween);
    if (height <= 0) return;
    spacers.push({ pos, height, inline });
    pageStart = top;
  };

  for (const block of blocks) {
    if (!runsPast(block.top, block.height)) continue;

    // Asked of any block that overhangs, *including* one that starts the page:
    // a paragraph longer than a whole page cannot be moved anywhere, but it can
    // still be broken, and it must be. Requiring it to be movable first is what
    // let a long opening paragraph run straight off the bottom of the sheet,
    // through the margin and into the desk below.
    const lines = block.splittable ? linesOf(block) : null;
    if (lines && lines.length > 1) {
      // A block long enough to cross several pages breaks as many times as it
      // needs to, so this runs over all of its lines rather than stopping at
      // the first.
      for (const line of lines) {
        if (canMove(line.top) && runsPast(line.top, line.height)) {
          breakBefore(line.top, line.pos, line.inline);
        }
      }
      continue;
    }

    if (canMove(block.top)) breakBefore(block.top, block.pos, false);
  }

  return spacers;
}

const key = new PluginKey<DecorationSet>("pagination");

/** A gap that fills the rest of a page and the margins around the seam. Not part
 *  of the document — a widget the editor draws and the writer cannot enter. */
function spacerElement(height: number, inline: boolean): HTMLElement {
  // A gap inside a paragraph is a block box, so that it is outside the inline
  // flow and the caret can never be rendered on it — see the note beside
  // .pageflow-spacer-inline in globals.css. A span rather than a div because a
  // div inside a <p> is invalid markup that browsers will happily reparent, and
  // display is a matter for the stylesheet either way.
  const el = document.createElement(inline ? "span" : "div");
  el.className = inline
    ? "pageflow-spacer pageflow-spacer-inline"
    : "pageflow-spacer";
  el.style.height = `${height}px`;
  el.setAttribute("contenteditable", "false");
  el.setAttribute("aria-hidden", "true");
  return el;
}

function decorationsFor(doc: import("@tiptap/pm/model").Node, spacers: Spacer[]) {
  const widgets = spacers.map((s) =>
    Decoration.widget(s.pos, () => spacerElement(s.height, s.inline), {
      side: -1,
      key: `pageflow:${s.pos}:${s.height}:${s.inline}`,
      // The gap is furniture, not a place in the text: a click near it should
      // land on a real position, and the caret should never appear to be "in"
      // a page break.
      ignoreSelection: true,
    }),
  );
  return DecorationSet.create(doc, widgets);
}

/** Same breaks, within a pixel or two — used to stop the measure/apply loop once
 *  it has settled rather than chase sub-pixel jitter forever. */
function settled(a: Spacer[], b: Spacer[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].pos !== b[i].pos) return false;
    if (a[i].inline !== b[i].inline) return false;
    if (Math.abs(a[i].height - b[i].height) > 2) return false;
  }
  return true;
}

class PaginationView {
  private view: EditorView;
  private opts: PaginationOptions;
  private applied: Spacer[] = [];
  private queued = false;
  private destroyed = false;
  /** The editor's height as this class last left it — see the observer. */
  private lastHeight = 0;
  private observer: ResizeObserver;
  // The document and geometry last measured, so selection-only changes are
  // ignored — re-measuring (and possibly re-inserting a spacer) on every caret
  // move was what jostled the page while a writer dragged to select text.
  private lastDoc: PMNode | null = null;
  private lastGeomKey = "";

  constructor(view: EditorView, opts: PaginationOptions) {
    this.view = view;
    this.opts = opts;
    this.lastDoc = view.state.doc;
    this.lastGeomKey = this.geomKey();
    // Images and web-fonts change heights after the doc has stopped changing, so
    // a size change re-measures even when no transaction fired.
    //
    // Only a height this class did not itself produce counts. Measuring hides
    // every page gap and puts it back, which changes the editor's height twice
    // and so trips this observer — which would schedule another measure, which
    // would trip it again, a loop that re-measured the whole chapter every
    // frame for as long as the editor was open. Comparing against the height
    // left behind by the last measure breaks it.
    this.observer = new ResizeObserver(() => {
      if (this.destroyed) return;
      if (Math.abs(this.height() - this.lastHeight) < 1) return;
      this.schedule();
    });
    this.observer.observe(view.dom);
    this.schedule();
  }

  private height(): number {
    return this.view.dom.getBoundingClientRect().height;
  }

  /**
   * The learned correction, in page pixels, added to every seam.
   *
   * Starts at nothing and is taught by the rendered result — see the note where
   * it is updated. Held on the view rather than recomputed, so the correction
   * survives from one keystroke to the next instead of being rediscovered (and
   * mis-drawn once) on each.
   */
  private seam = 0;

  /** The computed gaps with the learned seam correction folded in. */
  private trim(spacers: Spacer[]): Spacer[] {
    if (this.seam === 0) return spacers;
    return spacers.map((s) => ({
      ...s,
      height: Math.max(1, Math.round(s.height + this.seam)),
    }));
  }

  /**
   * Fold the miss at the first seam into the offset carried by all of them.
   *
   * Only ever called with the layout at rest — see the caller. A whole pixel
   * before anything moves, since below that it would be chasing rounding and
   * would never settle.
   */
  private learnSeam(g: PageGeometry, raw: Spacer[]) {
    const error = this.seamError(g);
    if (error === null || Math.abs(error) < 1) return;

    // Clamped: a wild reading — a font swapping in, a measure caught mid-
    // relayout — must nudge the offset, never send it somewhere it cannot come
    // back from.
    this.seam = Math.max(-200, Math.min(200, this.seam - error));

    const corrected = this.trim(raw);
    if (!settled(corrected, this.applied)) this.apply(corrected);
  }

  /** Put a set of gaps on screen. Decorations only — the document is untouched. */
  private apply(spacers: Spacer[]) {
    this.applied = spacers;
    const tr = this.view.state.tr.setMeta(key, spacers);
    tr.setMeta("addToHistory", false);
    this.view.dispatch(tr);
  }

  /**
   * How far the text after a seam missed the top of its page, in page pixels.
   *
   * Positive means it landed too low, negative too high. Null when there is
   * nothing to measure.
   *
   * A gap's job is precisely this: its bottom edge must fall on the next page's
   * text-area top, so that the first line of that page begins exactly under the
   * top margin — and so the caret, arriving from the foot of the page before,
   * lands where a writer expects it. Everything else about the gap is arithmetic
   * in service of that one edge.
   */
  private seamError(g: PageGeometry): number | null {
    const view = this.view;
    const flow = view.dom.closest(".pageflow") as HTMLElement | null;
    if (!flow) return null;

    const gap = view.dom.querySelector<HTMLElement>(".pageflow-spacer");
    if (!gap) return null;

    const flowRect = flow.getBoundingClientRect();
    const scale = g.pageW ? flowRect.width / g.pageW : 1;
    if (!(scale > 0)) return null;

    // Page two's text begins one page and one desk gap down, plus its own top
    // margin. The first seam is measured because every seam has the same shape;
    // one is enough to learn the correction for all of them.
    const wanted = flowRect.top + (g.pageH + g.gap + g.mT) * scale;
    return (gap.getBoundingClientRect().bottom - wanted) / scale;
  }

  private geomKey(): string {
    const g = this.opts.getGeometry();
    return g
      ? `${g.pageW}:${g.pageH}:${g.mT}:${g.mB}:${g.mL}:${g.mR}:${g.contentH}:${g.gap}`
      : "";
  }

  update() {
    // Only the document and the page geometry move a page break; the selection
    // never does. Skipping selection-only updates keeps a drag-to-select from
    // triggering a measure that could shift the page under the pointer.
    const doc = this.view.state.doc;
    const geomKey = this.geomKey();
    if (this.lastDoc && this.lastDoc.eq(doc) && geomKey === this.lastGeomKey) {
      return;
    }
    this.lastDoc = doc;
    this.lastGeomKey = geomKey;
    this.schedule();
  }

  /**
   * Re-measure before the browser paints, not on the next frame.
   *
   * A microtask runs at the end of the current task — after the keystroke has
   * been applied to the document and the DOM updated, but *before* style, layout
   * and paint. So the page gaps are always in place in the frame the edit
   * appears in, and the un-paginated document is never shown.
   *
   * On an animation frame instead, every keystroke painted one frame of text
   * that had not been broken into pages yet: the line being typed hanging below
   * the foot of the sheet, and the caret out in the bottom margin or the gap
   * between two sheets. A single frame of that is a flicker; holding Enter or
   * Backspace, where a keystroke arrives about every other frame, makes it most
   * of what you see.
   */
  private schedule() {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (this.destroyed) return;
      try {
        this.measure();
      } catch (err) {
        // Measurement is best-effort chrome; on any failure the editor stays a
        // plain continuous surface rather than breaking. Silence here once hid a
        // stuck page count for a long time, so it speaks up under the debug flag.
        if (
          typeof location !== "undefined" &&
          location.search.includes("paginate-debug")
        ) {
          console.warn("[paginate] measure failed", err);
        }
      }
    });
  }

  private measure() {
    const view = this.view;
    // Mid-composition (IME) the DOM is in flux; wait for it to settle.
    if (view.composing) return;

    const paper = view.dom.closest(".pageflow-paper") as HTMLElement | null;
    const g = this.opts.getGeometry();
    if (!paper || !g) return;

    // Every gap already on screen is hidden for the duration of the measure, so
    // what is read back is the document's *natural* flow — the shape it would
    // have with no page breaks in it at all. Reasoning about that shape is what
    // makes the pass idempotent: the breaks are computed from the text, never
    // from the last set of breaks, so they cannot drift a little further down
    // the page on every pass. It also keeps the gaps out of the line rectangles
    // below, which would otherwise read a page-tall spacer as a line of prose.
    //
    // Hiding, measuring and restoring all happen inside one animation frame,
    // before the browser paints, so nothing flickers.
    const gaps = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".pageflow-spacer"),
    );

    // Hiding the gaps shortens the document by an inch and a half a page, which
    // can leave the scroll position past the new, shorter end — and the browser
    // clamps it there and then. Restoring the gaps does *not* undo that clamp,
    // so the view would creep upward on every measure, which is to say
    // constantly while somebody holds Enter or Backspace. The offset is put back
    // by hand for that reason. It has to be read before the first hide and
    // written after the last restore, with no layout read in between that could
    // let the browser settle on the clamped value.
    const scroller = scrollParent(view.dom as HTMLElement);
    const scrollTop = scroller?.scrollTop ?? 0;

    for (const gap of gaps) gap.style.display = "none";

    // The arithmetic result, kept untouched. Every trimmed set below is derived
    // from *this*, never from an already-trimmed one — folding the correction
    // into a value that already carries it counts it twice, so the seam
    // overshoots by as much as it was out and then chases itself.
    let raw: Spacer[];
    try {
      raw = this.breaksInNaturalFlow(paper, g);
    } finally {
      for (const gap of gaps) gap.style.display = "";
      if (scroller && scroller.scrollTop !== scrollTop) {
        scroller.scrollTop = scrollTop;
      }
    }

    const spacers = this.trim(raw);
    this.opts.onPages(spacers.length + 1);

    if (!settled(spacers, this.applied)) {
      this.apply(spacers);

      // The caret moving to the next page is not something to undo.
      //
      // When the line being written no longer fits, it belongs on the next
      // sheet, and the caret goes with it — that jump is the page turning, and
      // it is what Word shows too. An earlier version pinned the caret's place
      // on screen across the change, which cancelled the jump by scrolling the
      // whole desk by a page-gap instead: the caret held still and the *sheets*
      // lurched, in the middle of the window, long before the writing had
      // reached the foot of the page.
      //
      // So the view is left alone, and only checked: if the caret has gone out
      // of sight it is brought back by the smallest scroll that does it, and if
      // it is still visible — which it usually is — nothing moves at all.
      if (view.hasFocus()) keepCaretInView(view);
    } else {
      // Nothing moved this pass, so the layout has come to rest — and only now
      // is it worth asking where the text actually landed.
      //
      // The gap height above is arithmetic: fill the rest of the page, then
      // cross the seam. It is only ever as right as its assumptions, and page
      // layout has more of those than it looks — the chapter's title block
      // eating into the first page, a paragraph broken mid-way being wrapped in
      // anonymous blocks by the browser, sub-pixel rounding at three zoom
      // levels. Each lands the first line of the next page a few pixels off its
      // top margin, and no amount of care in the formula finds them all. So the
      // formula is an estimate, the result is measured, and the miss is carried
      // as an offset on every seam.
      //
      // Doing this on *every* pass was a mistake worth spelling out: it read a
      // layout that was still moving, shifted the offset on that reading, and
      // then dispatched a second change resizing every gap in the document —
      // mid-keystroke. Pressing Enter in the middle of a page would suddenly
      // heave everything below it. A loop that corrects itself has to settle
      // before it measures, or it chases its own tail; so the correction is
      // learned between edits, and while the writing is moving the last good
      // offset simply stands.
      this.learnSeam(g, raw);
    }

    this.report(g);

    // Recorded last, so the observer above can tell a height this class caused
    // from one the document caused.
    this.lastHeight = this.height();
  }

  /**
   * Where the text actually landed, against where it was meant to land.
   *
   * Off by default and switched on by adding `?paginate-debug` to the address.
   * Page geometry is one of the few things that cannot be reasoned about from
   * the outside: a break can be a line out for half a dozen reasons that all
   * look identical on screen, and the only way to tell them apart is to compare
   * the number asked for against the number the browser used.
   */
  private report(g: PageGeometry) {
    if (typeof location === "undefined") return;
    if (!location.search.includes("paginate-debug")) return;

    const view = this.view;
    const flow = view.dom.closest(".pageflow") as HTMLElement | null;
    if (!flow) return;

    const flowRect = flow.getBoundingClientRect();
    const scale = g.pageW ? flowRect.width / g.pageW : 1;

    // The first block whose top falls below each gap: the line that opens the
    // page, and the one whose position tells us whether the gap was right.
    const blocks = (Array.from(view.dom.children) as HTMLElement[]).filter(
      (el) => !el.classList.contains("pageflow-spacer"),
    );
    const gaps = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".pageflow-spacer"),
    );

    const rows = gaps.map((gap, i) => {
      const gapRect = gap.getBoundingClientRect();
      const opener = blocks.find(
        (el) => el.getBoundingClientRect().top >= gapRect.bottom - 1,
      );
      // Page i+1's text area begins here, in client pixels.
      const wanted =
        flowRect.top + ((i + 1) * (g.pageH + g.gap) + g.mT) * scale;
      const got = opener ? opener.getBoundingClientRect().top : NaN;
      return {
        page: i + 2,
        gapPx: +(gapRect.height / scale).toFixed(1),
        wantedY: +wanted.toFixed(1),
        actualY: +got.toFixed(1),
        // The number that matters: how far the text is from where the page
        // wants it, in unzoomed page pixels. Zero is right.
        offBy: +(((got - wanted) / scale) || 0).toFixed(1),
        inline: gap.classList.contains("pageflow-spacer-inline"),
      };
    });

    console.log("[paginate]", {
      scale: +scale.toFixed(3),
      page: { w: g.pageW, h: g.pageH, mT: g.mT, mB: g.mB, contentH: g.contentH, gap: g.gap },
      openerH: +((blocks[0]?.getBoundingClientRect().top ?? 0) - flowRect.top).toFixed(1),
      breaks: rows,
    });
  }

  /** Runs with every existing gap hidden — see measure. */
  private breaksInNaturalFlow(paper: HTMLElement, g: PageGeometry): Spacer[] {
    const view = this.view;

    // Positions are read with getBoundingClientRect and normalised by the zoom
    // scale, so they are true page pixels relative to the top of the page's text
    // area — which sits below the chapter's number and title. Measuring from the
    // editor node instead left the header out of the first page's budget, so it
    // over-filled and the last line spilled into the seam. `scale` is the pages'
    // rendered zoom: the page's on-screen width over its unscaled CSS width
    // (g.pageW). Derived this way it is right whether the zoom is a CSS `zoom` or
    // a transform, since it never trusts offsetWidth.
    const paperRect = paper.getBoundingClientRect();
    const scale = g.pageW ? paperRect.width / g.pageW : 1;
    if (!(scale > 0)) return [];
    const contentTop = paperRect.top + g.mT * scale;

    // The document position before each top-level node, so a break maps to a
    // place a widget can sit.
    const offsets: number[] = [];
    view.state.doc.forEach((_node, offset) => {
      offsets.push(offset);
    });

    // The cheap pass: one rectangle per block. Only a block that turns out to
    // straddle a page edge is looked at line by line, and that is at most one
    // per page — see pageBreaks.
    const blocks: BlockBox[] = [];
    const elements = new Map<number, HTMLElement>();
    let index = 0;

    for (const node of Array.from(view.dom.children) as HTMLElement[]) {
      if (node.classList.contains("pageflow-spacer")) continue;
      const pos = offsets[index];
      index++;
      if (pos === undefined) break;

      const rect = node.getBoundingClientRect();
      blocks.push({
        top: (rect.top - contentTop) / scale,
        height: rect.height / scale,
        pos,
        // Only prose splits. An image, a rule, a code block or a heading has
        // nothing to break between, and stays whole as it always did.
        splittable: node.tagName === "P",
      });
      elements.set(pos, node);
    }

    return pageBreaks(blocks, g, (block) => {
      const node = elements.get(block.pos);
      if (!node) return null;
      try {
        return this.linesOf(node, block.pos, contentTop, scale);
      } catch {
        // Reading a paragraph's lines must never be able to bring down the
        // whole pass. If it did, the measure would abort before reporting the
        // page count — and the page count is what draws the sheets, so a sheet
        // would stay on screen after the text that called for it had gone, with
        // no way to get rid of it short of reloading. Falling back to treating
        // the paragraph as unsplittable is always safe.
        return null;
      }
    });
  }

  /**
   * A paragraph's laid-out lines, each with the document position a break before
   * it would sit at.
   *
   * A soft line wrap has no position of its own — the place between the last
   * character of one visual line and the first of the next is a single point in
   * the document — so the lines are found geometrically, from the rectangles the
   * text actually occupies, and each is mapped back to a position by asking the
   * view what lives at its first character.
   *
   * Returns null when anything cannot be read with confidence, so the caller
   * falls back to treating the paragraph as one unsplittable block, which is how
   * this worked before and is never worse than wrong-looking.
   */
  private linesOf(
    node: HTMLElement,
    pos: number,
    contentTop: number,
    scale: number,
  ): LineBox[] | null {
    const view = this.view;

    const pmNode = view.state.doc.nodeAt(pos);
    if (!pmNode) return null;
    // Inside the paragraph's content, exclusive of its own open and close
    // tokens: a break has to land between two characters of the text.
    const first = pos + 1;
    const last = pos + pmNode.nodeSize - 1;

    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter(
      (r) => r.width > 0 && r.height > 0,
    );
    if (rects.length === 0) return null;

    // One rect per run of text per line, so runs sharing a top edge are one
    // line. A pixel of tolerance: sub-pixel layout puts the parts of a line a
    // hair apart when they differ in size or style.
    const rows: { top: number; bottom: number; left: number }[] = [];
    for (const r of rects) {
      const row = rows[rows.length - 1];
      if (row && Math.abs(r.top - row.top) <= 1) {
        row.bottom = Math.max(row.bottom, r.bottom);
        row.left = Math.min(row.left, r.left);
      } else {
        rows.push({ top: r.top, bottom: r.bottom, left: r.left });
      }
    }

    // The edges between one line's stripe of the column and the next.
    //
    // A rectangle from a text Range is the *glyphs'* box, not the line's: it
    // leaves out the leading above and below, so it comes up short of the line
    // height by several pixels. Using it as the line height would tell the page
    // it has room it does not have, and the last line of every page would spill
    // into the bottom margin. So the boundary between two lines is taken as the
    // midpoint of the blank between their glyph boxes — which is exactly where
    // the line boxes meet when the leading is even — and the outermost edges
    // come from the paragraph's own box, leading included.
    const blockRect = node.getBoundingClientRect();
    const edges: number[] = [blockRect.top];
    for (let i = 1; i < rows.length; i++) {
      edges.push((rows[i - 1].bottom + rows[i].top) / 2);
    }
    edges.push(blockRect.bottom);

    const lines: LineBox[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const box = {
        top: (edges[i] - contentTop) / scale,
        height: (edges[i + 1] - edges[i]) / scale,
      };

      // The first line breaks between blocks, at the paragraph's own position —
      // the older, simpler case, and the one that keeps a break before an
      // untouched paragraph identical to what it always was.
      if (i === 0) {
        lines.push({ ...box, pos, inline: false });
        continue;
      }

      // Just inside the line's leading edge, half way down it: the point the
      // browser resolves to this line's first character rather than to the end
      // of the line above.
      const at = view.posAtCoords({
        left: row.left + 1,
        top: (row.top + row.bottom) / 2,
      });
      // A position outside this paragraph means the mapping is not to be
      // trusted — a break there would tear a different block in half.
      if (!at || at.pos <= first || at.pos >= last) return null;

      lines.push({ ...box, pos: at.pos, inline: true });
    }

    return lines;
  }

  destroy() {
    // A queued microtask cannot be cancelled, so it is flagged off instead.
    this.destroyed = true;
    this.observer.disconnect();
  }
}

export const Pagination = Extension.create<PaginationOptions>({
  name: "pagination",

  addOptions() {
    return {
      getGeometry: () => null,
      onPages: () => {},
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(key) as Spacer[] | undefined;
            if (meta) return decorationsFor(tr.doc, meta);
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return key.getState(state);
          },
        },
        view(view) {
          return new PaginationView(view, opts);
        },
      }),
    ];
  },
});
