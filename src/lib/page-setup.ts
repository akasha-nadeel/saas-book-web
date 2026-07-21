/**
 * Page geometry — the Word "Layout" tab, in inches.
 *
 * Kept apart from storage and from React: this is a table of paper sizes and a
 * little arithmetic, and it is the part worth testing. CSS understands `in`
 * natively, so the numbers here go straight into styles without a pixel-per-inch
 * fudge factor.
 */

export type PageSize =
  | "letter"
  | "tabloid"
  | "legal"
  | "statement"
  | "executive"
  | "a3"
  | "a4"
  | "a5"
  | "b4";

export type Orientation = "portrait" | "landscape";
export type MarginPreset =
  | "normal"
  | "narrow"
  | "moderate"
  | "wide"
  | "mirrored";
export type ColumnCount = 1 | 2 | 3;

export interface PageSetup {
  size: PageSize;
  orientation: Orientation;
  margins: MarginPreset;
  columns: ColumnCount;
  /**
   * Whether the page fills the editing column instead of sitting at its
   * physical width.
   *
   * These are two different questions and were fighting each other while they
   * shared one answer: a Letter page cannot fill a window wider than 8.5in
   * without ceasing to be Letter. Size, orientation and margins describe the
   * document that leaves the app; this describes the surface you write on.
   * Export ignores it entirely.
   */
  fit: boolean;
}

export const DEFAULT_PAGE: PageSetup = Object.freeze({
  size: "letter",
  orientation: "portrait",
  margins: "normal",
  columns: 1,
  fit: true,
});

/** Portrait dimensions in inches. Landscape swaps them; see pageMetrics. */
export const PAGE_SIZES: Record<
  PageSize,
  { label: string; width: number; height: number }
> = {
  letter: { label: "Letter", width: 8.5, height: 11 },
  tabloid: { label: "Tabloid", width: 11, height: 17 },
  legal: { label: "Legal", width: 8.5, height: 14 },
  statement: { label: "Statement", width: 5.5, height: 8.5 },
  executive: { label: "Executive", width: 7.25, height: 10.5 },
  a3: { label: "A3", width: 11.69, height: 16.54 },
  a4: { label: "A4", width: 8.27, height: 11.69 },
  a5: { label: "A5", width: 5.83, height: 8.27 },
  b4: { label: "B4 (JIS)", width: 10.12, height: 14.33 },
};

export const MARGIN_PRESETS: Record<
  MarginPreset,
  { label: string; top: number; bottom: number; left: number; right: number }
> = {
  normal: { label: "Normal", top: 1, bottom: 1, left: 1, right: 1 },
  narrow: { label: "Narrow", top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
  moderate: { label: "Moderate", top: 1, bottom: 1, left: 0.75, right: 0.75 },
  wide: { label: "Wide", top: 1, bottom: 1, left: 2, right: 2 },
  // Word's Mirrored is inside 1.25 / outside 1, which only differs between
  // facing pages. This view is a continuous scroll with no verso, so it renders
  // as the recto: inside on the left.
  mirrored: { label: "Mirrored", top: 1, bottom: 1, left: 1.25, right: 1 },
};

export interface PageMetrics {
  /** Inches. */
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function pageMetrics(setup: PageSetup): PageMetrics {
  const size = PAGE_SIZES[setup.size] ?? PAGE_SIZES[DEFAULT_PAGE.size];
  const margins =
    MARGIN_PRESETS[setup.margins] ?? MARGIN_PRESETS[DEFAULT_PAGE.margins];

  const landscape = setup.orientation === "landscape";

  return {
    // Orientation swaps the sheet, not the margins: a 1" top margin stays at
    // the top of the page however the paper is turned.
    width: landscape ? size.height : size.width,
    height: landscape ? size.width : size.height,
    top: margins.top,
    bottom: margins.bottom,
    left: margins.left,
    right: margins.right,
  };
}

/** The width the text actually occupies, once margins are taken off. */
export function textWidth(setup: PageSetup): number {
  const m = pageMetrics(setup);
  return m.width - m.left - m.right;
}
