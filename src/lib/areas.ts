/**
 * The dashboard's five areas, by id, and what to call them.
 *
 * A tool screen fills the window with none of the dashboard around it, so the
 * only way back is whatever the tool draws — and until now that was "All
 * tools", which returns to the *launcher* rather than to wherever the writer
 * actually came from. Somebody who pressed "Choose categories" on a finding in
 * Prepare, fixed it, and wanted to see the rest of the list had no route back
 * to that list at all.
 *
 * So a link into a tool may carry `?from=<area>`, and the tool offers a way
 * back to it. This module is what turns that id into a word, and it lives on
 * its own because both ends need it: the dashboard is one enormous client
 * component, and importing it into every tool header to read five labels would
 * pull the whole shelf into every tool page.
 */
export type AreaId = "overview" | "write" | "prepare" | "track" | "tools";

export const AREA_LABELS: Record<AreaId, string> = {
  overview: "Overview",
  write: "Write",
  prepare: "Prepare",
  track: "Track",
  tools: "Tools",
};

/**
 * The label for a `?from=` value, or null if it is not an area.
 *
 * Anyone can put anything in a query string, so this is a lookup against a
 * fixed set rather than a cast — the same reasoning as `safeNext()` on the
 * auth redirect, at much lower stakes.
 */
export function areaLabel(from: string | null | undefined): string | null {
  if (!from) return null;
  return from in AREA_LABELS ? AREA_LABELS[from as AreaId] : null;
}

/** Appends `?from=<area>` to a tool path, for a link that wants a way back. */
export function withReturn(path: string, from: AreaId | undefined): string {
  if (!from) return path;
  return `${path}${path.includes("?") ? "&" : "?"}from=${from}`;
}
