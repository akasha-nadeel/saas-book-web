import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { keepCaretInView, scrollParent } from "./caret-scroll";
import {
  pageBreaks,
  type BlockBox,
  type LineBox,
  type PageFlow,
  type PageGeometry,
  type Spacer,
} from "./page-breaks";

// The break arithmetic itself lives in `page-breaks.ts`, pure and shared with
// the reading view so one manuscript cannot come out as two different books.
// Re-exported here because this is where the rest of the app already looks for
// it — see click-to-type.ts and chapter-editor.tsx.
export {
  pageBreaks,
  type BlockBox,
  type LineBox,
  type PageFlow,
  type PageGeometry,
  type Spacer,
};

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

/**
 * Until when measuring is held off, as a timestamp.
 *
 * **Module-level rather than an option, because the caller is not the editor.**
 * The zoom gesture lives in `chapter-editor.tsx` and has no handle on the
 * plugin instance — it is constructed inside Tiptap's extension list — so a
 * prop would have to be threaded through the editor's whole configuration to
 * reach here. There is one paginated surface on screen at a time, which is what
 * makes a module-level flag honest rather than a shortcut.
 */
let suspendedUntil = 0;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

/** Every paginated surface currently mounted, so a resume can reach them. */
const live = new Set<PaginationView>();

/** Whether measuring is currently held off. */
function paginationSuspended(): boolean {
  return suspendedUntil > 0 && Date.now() < suspendedUntil;
}

/**
 * Hold off re-measuring for a moment — for the duration of a zoom gesture.
 *
 * Called on every wheel event of a pinch, each one pushing the window further
 * out, so the suspension lasts as long as the gesture and lapses shortly after
 * the writer stops. See the note in `schedule`.
 */
export function suspendPagination(ms = 250): void {
  suspendedUntil = Date.now() + ms;

  /**
   * One measure once it lapses, and only one.
   *
   * Nothing else would ask for it: the observer fires *during* the gesture and
   * is turned away, and a writer who is pinching is not typing, so no
   * transaction arrives to schedule one either. Harmless for the zoom itself —
   * breaks do not move — but a picture that finished loading mid-pinch would
   * leave the pagination stale until the next keystroke. The timer is reset by
   * each call, so a long gesture runs this once at the end rather than once
   * per event.
   */
  if (resumeTimer !== null) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    for (const view of live) view.resume();
  }, ms + 20);
}

export interface PaginationOptions {
  /** Latest geometry, read fresh each measure so a page-setup change is picked
   *  up without rebuilding the editor. Null disables pagination. */
  getGeometry: () => PageGeometry | null;
  /** Reports the page count so the sheet layer can be drawn. */
  onPages: (count: number) => void;
}

const key = new PluginKey<DecorationSet>("pagination");

/**
 * The blocks a page may break *inside*, by the DOM tag they render as.
 *
 * A paragraph splits between its lines, the way a word processor fills a page
 * to the bottom and carries the same paragraph over. A list and a blockquote
 * split between their children, which is the only place they *can* break —
 * cutting an entry in half would leave half a bullet on one sheet.
 *
 * **The list and the quote are the reason a pasted document came out broken.**
 * Only `P` was here, so a bullet list longer than a page — which is what most
 * pasted notes, specs and outlines are made of — was one atom that could
 * neither move nor break, and it overflowed its sheet and took the rest of the
 * chapter's pagination with it. See `overflowPast` in `page-breaks.ts` for the
 * other half of that fix; this half is what stops the overflow happening at
 * all in the common case.
 *
 * Everything else stays whole, as it always did: a picture, a rule, a code
 * block or a heading has nothing to break between.
 */
const SPLITTABLE = new Set(["P", "UL", "OL", "BLOCKQUOTE"]);

/** A list or a quote — it breaks between its children, not between its lines. */
const BY_CHILDREN = new Set(["UL", "OL", "BLOCKQUOTE"]);

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

/**
 * The visible pagination frame for the current geometry.
 *
 * Keeping the disabled state pure makes the nullable contract explicit: a
 * continuous editor has no decoration gaps and is always reported as one
 * page. Restoring geometry feeds the freshly measured spacers back through
 * the same path.
 */
export function paginationFrame(
  geometry: PageGeometry | null,
  flow: PageFlow,
): { spacers: Spacer[]; pageCount: number } {
  // The count is the arithmetic's own, not `spacers.length + 1`, which is only
  // right while every sheet is opened by a gap. A block taller than the page
  // covers several with no gap anywhere inside it — see `overflowPast`.
  return geometry
    ? { spacers: flow.spacers, pageCount: flow.pages }
    : { spacers: [], pageCount: 1 };
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
    live.add(this);
    this.schedule();
  }

  /**
   * The document's height in **layout** pixels, not painted ones.
   *
   * `offsetHeight` rather than `getBoundingClientRect().height`, and the
   * difference is the whole of why zooming used to stutter. The page is scaled
   * with the CSS `zoom` property, which a bounding rect reports and
   * `offsetHeight` does not — so every step of a pinch changed the measured
   * height, tripped the observer above, and re-paginated the entire chapter.
   * Sixty times a second, and every one of them wasted: this file computes
   * breaks in unzoomed pixels (see the note at the top), so the answer at 32%
   * is the answer at 400%.
   *
   * Reading the layout height instead makes a pure zoom change invisible here,
   * which is the truth of it — nothing about the document changed. A real
   * change, from an image loading or a web font settling, still moves this and
   * still re-measures.
   */
  private height(): number {
    return this.view.dom.offsetHeight;
  }

  /**
   * What is at the top of the window, and exactly where.
   *
   * This is the thing a word processor holds still. Not the caret — pinning
   * that means the sheets slide whenever the writing crosses onto a new page,
   * which is the page turning and should be left alone. What must not move is
   * the passage being looked at: repagination anywhere in the document, above
   * the window or below it, has to leave the visible page where it was.
   *
   * The anchor is the first block that reaches into the window, held by its
   * distance below the window's top edge.
   */
  private viewportAnchor(): { el: HTMLElement; offset: number } | null {
    const scroller = scrollParent(this.view.dom as HTMLElement);
    if (!scroller) return null;

    const top = scroller.getBoundingClientRect().top;
    for (const el of Array.from(this.view.dom.children) as HTMLElement[]) {
      if (el.classList.contains("pageflow-spacer")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.bottom > top) return { el, offset: rect.top - top };
    }
    return null;
  }

  /** Put the anchor back where it was, cancelling out whatever moved above it. */
  private holdViewport(anchor: { el: HTMLElement; offset: number } | null) {
    if (!anchor || !anchor.el.isConnected) return;

    const scroller = scrollParent(this.view.dom as HTMLElement);
    if (!scroller) return;

    const top = scroller.getBoundingClientRect().top;
    const drift = anchor.el.getBoundingClientRect().top - top - anchor.offset;
    // A whole pixel, so rounding cannot start a scroll of its own.
    if (Math.abs(drift) >= 1) scroller.scrollTop += drift;
  }

  /** Put a set of gaps on screen. Decorations only — the document is untouched. */
  private apply(spacers: Spacer[]) {
    this.applied = spacers;
    const tr = this.view.state.tr.setMeta(key, spacers);
    tr.setMeta("addToHistory", false);
    this.view.dispatch(tr);
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
    /**
     * **Not while the page is being zoomed.**
     *
     * `measure()` ends by putting the viewport back where it was
     * (`holdViewport`, which writes `scroller.scrollTop`), and a zoom gesture
     * is *also* writing `scrollTop` every frame to hold the point under the
     * pointer. Two writers on one property, sixty times a second, is the page
     * visibly shaking — which is exactly what it did.
     *
     * Suspending is safe rather than a compromise: breaks are computed in
     * unzoomed pixels, so the answer cannot change while only the zoom is
     * moving. The gesture lifts the suspension when it settles and one measure
     * runs then, which is the only one that was ever needed.
     */
    if (paginationSuspended()) return;
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

    const g = this.opts.getGeometry();
    if (!g) {
      const frame = paginationFrame(null, { spacers: this.applied, pages: 1 });
      this.opts.onPages(frame.pageCount);
      if (!settled(frame.spacers, this.applied)) this.apply(frame.spacers);
      this.lastHeight = this.height();
      return;
    }

    const paper = view.dom.closest(".pageflow-paper") as HTMLElement | null;
    if (!paper) return;

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

    // Everything from here happens with the window held still.
    //
    // The anchor is taken before the first change and put back after the last,
    // so none of it can be seen: not the gaps being hidden, which shortens the
    // document by an inch and a half a page and can leave the scroll position
    // past the new, shorter end for the browser to clamp; not the gaps coming
    // back, which does not undo that clamp; and not a break moving, which
    // shifts every line that follows it. See viewportAnchor for why it is the
    // top of the window that is held and not the caret.
    const anchor = this.viewportAnchor();

    for (const gap of gaps) gap.style.display = "none";

    // The gap heights are the arithmetic and nothing else.
    //
    // There was a correction here that measured how far the text after the
    // *first* seam missed its top margin and added that offset to every gap. It
    // is gone, and should not come back in that form: the first page is the one
    // page unlike the others, because it carries the chapter's title above the
    // prose. Whatever the first seam is out by is peculiar to it, so spreading
    // that figure across the rest pushed every later page down past its own
    // bottom margin — text sitting in the white, which is worse than the few
    // pixels it was trying to save. A per-seam correction would be sound; a
    // single global one cannot be.
    //
    // What it was compensating for has since been fixed at the source: the
    // offset being counted twice, lines measured by their glyph boxes rather
    // than their line boxes, and a paragraph that opens a page never being
    // split. The arithmetic stands on its own now.
    let flow: PageFlow;
    try {
      flow = this.breaksInNaturalFlow(paper, g);
    } finally {
      for (const gap of gaps) gap.style.display = "";
    }

    const frame = paginationFrame(g, flow);
    this.opts.onPages(frame.pageCount);

    if (!settled(frame.spacers, this.applied)) this.apply(frame.spacers);

    // The page the writer was looking at goes back exactly where it was, after
    // every change this pass made. Word's own behaviour: repagination does not
    // move the view, whatever it does to the text.
    this.holdViewport(anchor);

    // Only *then* is the caret considered, and only if it has been carried out
    // of sight — by its own line moving to the next sheet, most often. That
    // jump is the page turning and is left to happen; what is not left to
    // happen is losing the caret off the edge of the window. Usually it is
    // still visible and nothing moves at all.
    //
    // An earlier version pinned the caret's place on screen instead, which
    // cancelled the page turn by scrolling the whole desk by a page-gap: the
    // caret held still and the *sheets* lurched, in the middle of the window,
    // long before the writing had reached the foot of the page.
    if (view.hasFocus()) keepCaretInView(view);

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
  private breaksInNaturalFlow(paper: HTMLElement, g: PageGeometry): PageFlow {
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
    if (!(scale > 0)) return { spacers: [], pages: 1 };
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
        splittable: SPLITTABLE.has(node.tagName),
      });
      elements.set(pos, node);
    }

    return pageBreaks(blocks, g, (block) => {
      const node = elements.get(block.pos);
      if (!node) return null;
      try {
        return BY_CHILDREN.has(node.tagName)
          ? this.itemsOf(node, block.pos, contentTop, scale)
          : this.linesOf(node, block.pos, contentTop, scale);
      } catch {
        // Reading a block's parts must never be able to bring down the whole
        // pass. If it did, the measure would abort before reporting the page
        // count — and the page count is what draws the sheets, so a sheet
        // would stay on screen after the text that called for it had gone, with
        // no way to get rid of it short of reloading. Falling back to treating
        // the block as unsplittable is always safe.
        return null;
      }
    });
  }

  /**
   * A list's or a quote's children, as the places a page may break.
   *
   * The cheap half of splitting. A paragraph has to be taken apart
   * geometrically, because a soft wrap has no document position of its own —
   * see `linesOf`. A list does not: every `<li>` *is* a node, so the
   * rectangles come from the elements themselves and the positions from
   * walking the ProseMirror node's own children. No hit test, no Range, and
   * the answer is exact rather than inferred.
   *
   * Every break here is `inline: false` — between two items is between two
   * blocks, which is the older and simpler case. The widget lands inside the
   * `<ul>` as a plain `<div>`, which lays out as a block and takes no number
   * from an ordered list's counter.
   *
   * Returns null when the DOM and the document have drifted apart, so the
   * caller falls back to treating the whole list as unsplittable — which is
   * how this behaved before, and is never worse than wrong-looking.
   */
  private itemsOf(
    node: HTMLElement,
    pos: number,
    contentTop: number,
    scale: number,
  ): LineBox[] | null {
    const pmNode = this.view.state.doc.nodeAt(pos);
    if (!pmNode) return null;

    const children = Array.from(node.children) as HTMLElement[];
    if (children.length !== pmNode.childCount) return null;

    const boxes: LineBox[] = [];
    let offset = pos + 1;
    pmNode.forEach((child, _at, index) => {
      const rect = children[index].getBoundingClientRect();
      boxes.push({
        top: (rect.top - contentTop) / scale,
        height: rect.height / scale,
        // The first child breaks in front of the list itself, so an untouched
        // list moves exactly as it always did.
        pos: index === 0 ? pos : offset,
        inline: false,
      });
      offset += child.nodeSize;
    });

    return boxes;
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
    // Height only. A line can be perfectly real and have no width at all — a
    // run of spaces held down at the end of a paragraph wraps onto lines of its
    // own that measure nothing across. Dropping those left the lines failing to
    // cover the paragraph they came from, so the part of it below the last
    // visible word was invisible to the page-fill arithmetic: the caret walked
    // down through the bottom margin and off the sheet, and no break was ever
    // called for, because as far as this could see there was nothing there.
    const rects = Array.from(range.getClientRects()).filter((r) => r.height > 0);
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

      /* **A closure, not a hit test.** `posAtCoords` walks the DOM, and this
         used to run for every line of the paragraph before `pageBreaks` had
         decided which lines matter. On a 300,000-character paste — one
         paragraph, about thirteen thousand lines — that is thirteen thousand
         hit tests in one measure, and the tab stops responding. `pageBreaks`
         reads a position only where it actually places a break, perhaps one
         line in a page, so deferring turns thirteen thousand into twenty.

         The coordinates are captured now because they are already measured;
         only the lookup waits. */
      const at = () => {
        const found = view.posAtCoords({
          left: row.left + 1,
          top: (row.top + row.bottom) / 2,
        });
        // A position outside this paragraph means the mapping is not to be
        // trusted — a break there would tear a different block in half. Null
        // now costs this one break rather than the paragraph's whole ability
        // to split, which is what returning null from here used to do.
        return found && found.pos > first && found.pos < last ? found.pos : null;
      };

      lines.push({ ...box, pos: at, inline: true });
    }

    return lines;
  }

  destroy() {
    // A queued microtask cannot be cancelled, so it is flagged off instead.
    this.destroyed = true;
    this.observer.disconnect();
    live.delete(this);
  }

  /** Re-measure now, if anything was missed while measuring was suspended. */
  resume() {
    this.schedule();
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
