import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

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

interface Spacer {
  /** Document position the gap is inserted before. */
  pos: number;
  /** Its height in unzoomed pixels. */
  height: number;
}

const key = new PluginKey<DecorationSet>("pagination");

/** A gap that fills the rest of a page and the margins around the seam. Not part
 *  of the document — a widget the editor draws and the writer cannot enter. */
function spacerElement(height: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "pageflow-spacer";
  el.style.height = `${height}px`;
  el.setAttribute("contenteditable", "false");
  el.setAttribute("aria-hidden", "true");
  return el;
}

function decorationsFor(doc: import("@tiptap/pm/model").Node, spacers: Spacer[]) {
  const widgets = spacers.map((s) =>
    Decoration.widget(s.pos, () => spacerElement(s.height), {
      side: -1,
      key: `pageflow:${s.pos}:${s.height}`,
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
    if (Math.abs(a[i].height - b[i].height) > 2) return false;
  }
  return true;
}

class PaginationView {
  private view: EditorView;
  private opts: PaginationOptions;
  private applied: Spacer[] = [];
  private raf = 0;
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
    this.observer = new ResizeObserver(() => this.schedule());
    this.observer.observe(view.dom);
    this.schedule();
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

  private schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      try {
        this.measure();
      } catch {
        // Measurement is best-effort chrome; on any failure the editor stays a
        // plain continuous surface rather than breaking.
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
    const contentTop = paperRect.top + g.mT * scale;

    // Block positions in the natural flow — with any spacers already present
    // subtracted back out, so we always reason about the un-paginated layout.
    let cumulativeSpacer = 0;
    const blocks: { top: number; height: number }[] = [];
    for (const node of Array.from(view.dom.children) as HTMLElement[]) {
      const rect = node.getBoundingClientRect();
      const height = rect.height / scale;
      if (node.classList.contains("pageflow-spacer")) {
        cumulativeSpacer += height;
        continue;
      }
      const top = (rect.top - contentTop) / scale - cumulativeSpacer;
      blocks.push({ top, height });
    }

    // The document position before each top-level node, so a break maps to a
    // place a widget can sit.
    const offsets: number[] = [];
    view.state.doc.forEach((_node, offset) => {
      offsets.push(offset);
    });

    const gapBetween = g.mB + g.gap + g.mT;
    const spacers: Spacer[] = [];
    let pageStart = 0;
    let hasContent = false;

    for (let i = 0; i < blocks.length && i < offsets.length; i++) {
      const b = blocks[i];
      // +1 to forgive a sub-pixel overshoot rather than break a page early.
      if (hasContent && b.top + b.height - pageStart > g.contentH + 1) {
        const consumed = b.top - pageStart;
        const height = Math.round(g.contentH - consumed + gapBetween);
        // A block taller than a whole page has nowhere to go; leave it to
        // overflow its sheet rather than open an empty page before it.
        if (height > 0) {
          spacers.push({ pos: offsets[i], height });
          pageStart = b.top;
        }
      }
      hasContent = true;
    }

    this.opts.onPages(spacers.length + 1);

    if (!settled(spacers, this.applied)) {
      this.applied = spacers;
      const tr = view.state.tr.setMeta(key, spacers);
      tr.setMeta("addToHistory", false);
      view.dispatch(tr);
    }
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
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
