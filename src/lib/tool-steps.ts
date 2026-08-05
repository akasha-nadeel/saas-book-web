import { STEPS, type Step } from "./roadmap";
import type { Book } from "./library-store";

/**
 * Which roadmap steps a tool screen finishes.
 *
 * A writer who has just chosen their categories has done the step called
 * "Choose categories", and until now they had to go and say so on a different
 * screen. So a tool's Save ticks the road behind it — but *which* steps it
 * ticks has to be derived rather than listed, or this file becomes a second
 * roadmap that disagrees with the first one the week somebody moves a step.
 *
 * It is derived from the step's own `href`, which is the same thing
 * `step-panel.tsx` keys its registry on: the step already knows where it is
 * done, and that answer cannot drift from the road.
 */

/** Every step whose destination is this tool, in road order. */
export function stepsForTool(bookId: string, tool: string): Step[] {
  const path = `/book/${bookId}/${tool}`;
  return STEPS.filter((step) => step.href?.(bookId) === path);
}

/**
 * Of those, the ones a press can actually tick.
 *
 * A step with a `done` detector works itself out from the book and
 * **`roadmapFor` ignores a stored tick on it** — deliberately, so a checklist
 * cannot be lied to. Writing one anyway would store a fact that changes
 * nothing, and would read to the next person as if the tick were doing work.
 *
 * That is not a gap. The detected steps on these screens are detected *from
 * the very thing the screen saves*: save a blurb and "Write the blurb" ticks
 * itself on the next read. Saving is what ticks them; this list is the rest.
 */
export function ticksForTool(bookId: string, tool: string): Step[] {
  return stepsForTool(bookId, tool).filter((step) => !step.done);
}

/** The hand-tickable steps for this tool that are not ticked yet. */
export function untickedFor(book: Book, tool: string): Step[] {
  const already = new Set(book.roadmapDone ?? []);
  return ticksForTool(book.id, tool).filter((step) => !already.has(step.id));
}
