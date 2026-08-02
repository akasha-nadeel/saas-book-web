"use client";

import dynamic from "next/dynamic";
import type { ToolPageProps } from "@/lib/tool-page";

/**
 * What a tool shows while its chunk arrives: nothing.
 *
 * It was `LoadingScreen`, which is the *app's* splash — a full-height book mark
 * and the word "Loading…" — and in a panel that is wildly out of scale: pick a
 * different step and the whole right of the window is taken over by a logo,
 * for a chunk that is already cached and arrives in a frame or two. A
 * placeholder louder than the thing it stands in for is worse than no
 * placeholder.
 *
 * An empty box of the right size, so nothing jumps when the tool lands, and
 * `aria-busy` so the wait is announced to anyone who cannot see that it is
 * blank. The panel's title bar stays put throughout, which is what actually
 * tells a writer their press registered.
 */
const Pending = () => <div className="h-full" aria-busy="true" />;

/**
 * The tools a roadmap step can open *beside* the road rather than instead of
 * it.
 *
 * **Loaded on demand, one chunk each.** Importing six tool screens at the top
 * of the roadmap would put all six into the bundle of a page that mostly shows
 * a list — and one of them is the export screen, which reaches for `docx` and
 * `jszip`. A writer reading the road and never opening a panel should download
 * none of it. `ssr: false` because every one of these reads the library out of
 * `localStorage`, which the server cannot see.
 *
 * **The key is the URL segment**, so the registry is checked against the thing
 * the roadmap already stores — a step's `href` — rather than against a second
 * list of names that could disagree with it. Anything not in here (the editor
 * at `/book/<id>`, the reading view at `/read`) has no entry on purpose: both
 * are whole-window experiences, and the reading view in particular sets the
 * manuscript on pages by *measuring its column*, so in a panel it would
 * faithfully typeset the book at half the width somebody wanted to read it at.
 * Those keep navigating away, and `panelToolFor` returning null is how the
 * roadmap knows to draw an ordinary link.
 */
const TOOLS: Record<string, React.ComponentType<ToolPageProps>> = {
  comps: dynamic(() => import("@/components/comps/comps-page").then((m) => m.CompsPage), {
    ssr: false,
    loading: Pending,
  }),
  "title-check": dynamic(
    () => import("@/components/title-check/title-check-page").then((m) => m.TitleCheckPage),
    { ssr: false, loading: Pending },
  ),
  blurb: dynamic(() => import("@/components/blurb/blurb-page").then((m) => m.BlurbPage), {
    ssr: false,
    loading: Pending,
  }),
  categories: dynamic(
    () => import("@/components/categories/categories-page").then((m) => m.CategoriesPage),
    { ssr: false, loading: Pending },
  ),
  covers: dynamic(() => import("@/components/covers/covers-page").then((m) => m.CoversPage), {
    ssr: false,
    loading: Pending,
  }),
  export: dynamic(() => import("@/components/export/export-page").then((m) => m.ExportPage), {
    ssr: false,
    loading: Pending,
  }),
};

/**
 * The panel key for a step's destination, or null if it has to be navigated to.
 *
 * Takes what is left of the href once `/book/<id>/` is off the front, so
 * `/book/<id>` (the editor) yields the unchanged string and misses, and
 * `/book/<id>/read` yields "read" and misses because it is not in the map.
 */
export function panelToolFor(href: string, bookId: string): string | null {
  const rest = href.replace(`/book/${bookId}/`, "");
  return rest !== href && rest in TOOLS ? rest : null;
}

export function StepPanelTool({
  tool,
  bookId,
  heading,
}: {
  tool: string;
  bookId: string;
  /** The step's own title, drawn inside the tool's page rather than above it. */
  heading?: React.ReactNode;
}) {
  const Tool = TOOLS[tool];
  return Tool ? <Tool bookId={bookId} embedded heading={heading} /> : null;
}
