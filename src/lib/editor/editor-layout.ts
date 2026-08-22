/** The two ways the same editor surface can be presented. */
export type EditorLayoutMode = "continuous" | "paged";

/** The usable viewport, after mobile browser chrome and keyboards are applied. */
export interface EditorViewportMetrics {
  width: number;
  height: number;
}

export interface EditorLayout {
  mode: EditorLayoutMode;
  /** The chapter/book navigator owns a permanent column only on wide screens. */
  persistentBookNavigator: boolean;
  /** Formatting tools own the right rail from ordinary desktop widths. */
  persistentToolRail: boolean;
}

export const EDITOR_CONTINUOUS_WIDTH = 768;
export const EDITOR_SHORT_HEIGHT = 560;
export const EDITOR_SHORT_WIDTH = 1024;
export const EDITOR_TOOL_RAIL_WIDTH = 1024;
export const EDITOR_NAVIGATOR_WIDTH = 1280;

/**
 * Classify the space around the editor, not the device that happens to own it.
 *
 * A narrow window and a phone are the same constraint. Short landscape is the
 * second continuous case: a 800×360 tablet has enough width for a sheet and no
 * height left to write on once the sheet, desk, and keyboard are accounted for.
 */
export function editorLayoutFor({
  width,
  height,
}: EditorViewportMetrics): EditorLayout {
  const mode: EditorLayoutMode =
    width < EDITOR_CONTINUOUS_WIDTH ||
    (height < EDITOR_SHORT_HEIGHT && width < EDITOR_SHORT_WIDTH)
      ? "continuous"
      : "paged";

  return {
    mode,
    persistentBookNavigator:
      mode === "paged" && width >= EDITOR_NAVIGATOR_WIDTH,
    persistentToolRail: mode === "paged" && width >= EDITOR_TOOL_RAIL_WIDTH,
  };
}
