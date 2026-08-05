/**
 * One slot for "there is work on screen that has not been written down yet".
 *
 * A tool screen with a draft can be left four ways, and only one of them is a
 * link: the breadcrumb and the back control (anchors), the browser's own back
 * button (`popstate`), closing or reloading the tab (`beforeunload`), and the
 * Close button on the roadmap's panel (an ordinary `<button>` that no listener
 * can see is a navigation at all).
 *
 * The first three are caught by listeners inside `ToolSave`, because they are
 * events. The fourth cannot be — so any control that takes a writer away from
 * a tool without navigating calls `confirmLeave` and gets the same dialog. It
 * is a module slot rather than React context on purpose: the roadmap page is
 * the *parent* of the tool that owns the draft, so context would have to be
 * provided above the thing that fills it in.
 *
 * Exactly one tool is on screen at a time — a whole window, or one panel
 * beside the road — so one slot is enough. `setLeaveGuard(null)` on cleanup,
 * and a guard that only installs itself while there is something to lose, mean
 * a clean screen falls through to `proceed()` with no dialog and no delay.
 */

/** Asks the writer, then runs `proceed` if they say go. */
export type LeaveGuard = (proceed: () => void) => void;

let guard: LeaveGuard | null = null;

export function setLeaveGuard(next: LeaveGuard | null) {
  guard = next;
}

/** True while a tool holds edits that have not been saved. */
export function hasUnsavedWork(): boolean {
  return guard !== null;
}

/**
 * Do this, once the writer has had the chance to keep their work.
 *
 * Falls straight through when nothing is pending, so a caller never has to ask
 * first — `confirmLeave(close)` is correct on every screen, including the
 * fifteen that have nothing to save.
 */
export function confirmLeave(proceed: () => void) {
  if (guard) guard(proceed);
  else proceed();
}
