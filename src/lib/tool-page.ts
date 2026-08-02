import type { ReactNode } from "react";

/**
 * What every tool screen takes, now that it can be opened in two places.
 *
 * A tool used to be one thing: a whole window at `/book/<id>/<tool>`, with its
 * own `ToolHeader` and its own `h-dvh`. The roadmap now opens the same six
 * tools in a panel beside the road, so the writer can do a step without losing
 * their place in the eighteen — and a component that assumes it owns the
 * viewport cannot do that. Hence one flag rather than six copies of each
 * screen, which is the version of this that goes stale.
 *
 * `embedded` says two things and only two, and both are about the *frame*
 * rather than the work:
 *
 * - **No `ToolHeader`.** It draws the breadcrumb, the book chip and the tool's
 *   name as the page's `h1`. Inside a panel that is a second heading under the
 *   panel's own title bar, and a breadcrumb pointing out of a panel that has a
 *   Close button two inches away.
 * - **`h-full`, not `h-dvh`.** The panel is a flex child with a real height;
 *   a child claiming the whole viewport inside it overflows by exactly the
 *   height of the title bar, which reads as a rendering bug rather than a
 *   layout one.
 *
 * Nothing else may hang off it. The moment `embedded` starts hiding *features*
 * — a control here, a section there — there are two products in one file and
 * the panel becomes the lesser one, which is precisely the thing that makes a
 * writer navigate away to "the real screen".
 */
export interface ToolPageProps {
  bookId: string;
  /** Rendered inside the roadmap's panel rather than as a whole window. */
  embedded?: boolean;
  /**
   * The panel's own title, drawn *in the page* rather than on a bar above it.
   *
   * It goes inside the tool's content column and not in the panel's chrome for
   * two reasons. A fixed strip carrying two lines of text costs that height on
   * every screen and at every scroll position, in the half of the window doing
   * the actual work — and a title pinned above a scrolling region belongs to
   * the frame rather than to what is written under it, which is the wrong
   * relationship for a heading.
   *
   * Passed in rather than built here because only the roadmap knows what to
   * call it: the *step* the writer pressed ("Choose categories"), not the
   * tool's own name for itself. Ignored unless `embedded` — a whole-window
   * tool already has its `ToolHeader`.
   */
  heading?: ReactNode;
}

/**
 * The outermost wrapper class for a tool screen, in either frame.
 *
 * Here rather than written out at six call sites so the pair cannot drift —
 * the whole failure mode of this flag is one screen keeping `h-dvh` and
 * nobody noticing until it is opened in the panel.
 */
export function toolShell(embedded: boolean | undefined, extra = "bg-surface") {
  return `${embedded ? "h-full" : "h-dvh"} overflow-y-auto ${extra}`;
}
