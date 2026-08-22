"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setLeaveGuard } from "@/lib/unsaved";
import type { ToolSaveState } from "@/lib/use-tool-save";

/**
 * Saving a tool screen, in two controls with one rule between them.
 *
 * `ToolSaveBar` is a bar that appears at the foot of the window **only once
 * there is something to lose**, and stays there until it is saved or thrown
 * away. That condition is the whole design: a Save button that is always on
 * screen is furniture, and a writer learns to stop reading it. One that
 * appears the moment they change something is the app noticing, and it is
 * impossible to walk past.
 *
 * It sat at the top right first, which is where a form's Save usually goes and
 * which was wrong here for a specific reason: these screens scroll, and the
 * keyword boxes, the category list and the ARC form are all *below* the fold
 * on an ordinary laptop. A control anchored to the top of the document is a
 * control that is not on screen at the moment it becomes relevant.
 *
 * `ToolStepDone` is the other half, for the four tools that hold no draft at
 * all — covers, comps, the title check, the export flow. Nothing on those can
 * be unsaved, so a Save bar would never appear and never be true; what they
 * *do* have is a step of the road that no detector can tick, because deciding
 * on a title or commissioning a cover leaves no trace in the library. So they
 * get a quiet button that says exactly what it does.
 *
 * The guards live here because they belong to the same fact. A draft in
 * component state is lost by a link, the browser's back button, or a closed
 * tab, and none of those three is caught by one mechanism — so all three are
 * below, and anything that leaves a tool *without* navigating (the roadmap
 * panel's Close, or swapping the panel for another step) calls `confirmLeave`
 * and gets the same dialog. They install only while there is something to
 * lose: a clean screen adds no listeners at all.
 */

type Ask =
  /** An in-app link the writer clicked. */
  | { kind: "link"; to: string }
  /** The browser's back button. */
  | { kind: "back" }
  /** A control that leaves without navigating, via `confirmLeave`. */
  | { kind: "guard"; proceed: () => void };

export function ToolSaveBar({ state }: { state: ToolSaveState }) {
  const { dirty, willTick, ticked, flashing, save, discard } = state;
  const router = useRouter();
  const [ask, setAsk] = useState<Ask | null>(null);

  /*
   * Set the moment the writer chooses to go, and checked at the top of every
   * handler below.
   *
   * Without it the popstate guard is a trap: "leave without saving" walks the
   * history back past the sentinel this component pushed, that walk fires
   * `popstate`, and a handler still armed pushes another sentinel and asks the
   * question again — forever, with the writer holding the back button.
   */
  const leaving = useRef(false);

  const go = useCallback(
    (how: Ask) => {
      leaving.current = true;
      setAsk(null);
      if (how.kind === "link") router.push(how.to);
      /* Two entries back: the sentinel below, and the page itself. */
      else if (how.kind === "back") window.history.go(-2);
      else how.proceed();
    },
    [router],
  );

  /* ---- The three ways out that fire an event ---------------------------- */

  useEffect(() => {
    if (!dirty) return;

    /* Closing the tab or reloading. The browser writes the wording, not us —
       every one of them ignores a custom string now. */
    const onUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
    };

    /*
     * Any link in the app, caught in the capture phase before Next's router
     * hears the click.
     *
     * A `<Link>` renders an anchor, so one listener covers the breadcrumb, the
     * back control, and every link a tool draws inside itself — where hooking
     * the router would need a wrapper around each of them. Modified clicks and
     * new-tab targets are left alone: those do not take the draft away.
     */
    const onClick = (e: MouseEvent) => {
      if (leaving.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      /* A link to where we already are is not leaving — an anchor to `#top`,
         or the tool's own link back to itself from a card. */
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;

      e.preventDefault();
      e.stopPropagation();
      setAsk({ kind: "link", to: url.pathname + url.search + url.hash });
    };

    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    setLeaveGuard((proceed) => setAsk({ kind: "guard", proceed }));

    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
      setLeaveGuard(null);
    };
  }, [dirty]);

  /*
   * The browser's back button, which fires no event that can be cancelled.
   *
   * The only lever is a spare history entry: push one while the draft is
   * unsaved, and a back press lands on it instead of leaving the page, at
   * which point we can ask. Pushed **once per mount** — re-pushing every time
   * the draft goes clean and dirty again would stack up entries and cost the
   * writer a press for each of them later.
   *
   * The cost is real and worth naming: after saving, a writer who then uses
   * the browser's back button spends one press on the spent sentinel. The
   * alternative is losing a draft silently, which is worse.
   */
  const sentinel = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    if (!sentinel.current) {
      sentinel.current = true;
      window.history.pushState(null, "", window.location.href);
    }
    const onPop = () => {
      if (leaving.current) return;
      window.history.pushState(null, "", window.location.href);
      setAsk({ kind: "back" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);

  /* Esc means stay, like every other dialog in this app. */
  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAsk(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);

  /* ---- The bar ---------------------------------------------------------- */

  /* Saved a moment ago, so the bar says so on its way out rather than
     vanishing. A control that disappears the instant it is pressed leaves a
     writer wondering whether the press or the disappearing was the event. */
  const showing = dirty || flashing;

  return (
    <>
      {showing && (
        <div
          /* `fixed`, so it is anchored to the bottom of the *window* rather
             than to the bottom of a scrolling column — which is the whole
             point: the keyword boxes, the category list and the ARC form are
             all below the fold on an ordinary laptop, and a control that
             scrolls with them is not on screen at the moment it matters.

             Where it centres depends on where it lands, and both answers are
             right. On a whole-window tool there is no containing block, so it
             centres on the window. In the roadmap's panel the panel's own
             entrance animation makes it the containing block, so the bar sits
             over the panel — which is better, because that is the half of the
             screen holding the draft. If that ever stops being true the bar
             centres on the window instead, which is a worse answer rather
             than a broken one.

             `bottom-6` and not `bottom-0`: a strip welded to the bottom edge
             reads as chrome that was always there. A card floating above it
             reads as something that just arrived, which is exactly what it is.

             `pointer-events-none` on the positioner with the card taking them
             back, so the empty width either side of a narrow bar does not
             swallow clicks on the page underneath. */
          className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+var(--oc-safe-bottom))] z-40 flex justify-center px-[max(1rem,var(--oc-safe-left))]"
          role="status"
          aria-live="polite"
        >
          <div
            className={`oc-save-bar pointer-events-auto flex w-full max-w-2xl flex-wrap items-center
                        gap-x-4 gap-y-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${
                          dirty
                            ? "border-note-line bg-note-bg"
                            : "border-ok-line bg-ok-bg"
                        }`}
          >
            <span
              aria-hidden="true"
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm
                          font-bold ${
                            dirty
                              ? "bg-note-fg text-note-bg"
                              : "bg-ok-fg text-ok-bg"
                          }`}
            >
              {dirty ? "!" : "✓"}
            </span>

            <p className="min-w-0 flex-1 text-sm leading-snug">
              {dirty ? (
                <>
                  <strong className="font-bold text-fg">Unsaved changes</strong>
                  <span className="text-muted">
                    {" · "}
                    {willTick.length
                      ? `saving also ticks ${willTick
                          .map((s) => `“${s.title}”`)
                          .join(" and ")} on your roadmap`
                      : "nothing here is on your book yet"}
                  </span>
                </>
              ) : (
                <>
                  <strong className="font-bold text-fg">Saved</strong>
                  <span className="text-muted">
                    {ticked.length
                      ? ` · ticked ${ticked
                          .map((s) => `“${s.title}”`)
                          .join(" and ")} on your roadmap`
                      : ""}
                  </span>
                </>
              )}
            </p>

            {dirty && (
              <span className="flex shrink-0 items-center gap-1">
                {/* Quiet, and first, so the destructive one is never the
                    thing a thumb lands on. It throws the draft away rather
                    than the writer's work on the book — the fields go back to
                    what is stored. */}
                {discard && (
                  <button
                    type="button"
                    onClick={discard}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-muted
                               outline-none transition-colors hover:text-fg
                               focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    Discard
                  </button>
                )}
                {/* The app's one action colour — indigo in daylight, and the
                    white the whole chrome switches to at night, because on
                    black a hue has nowhere to stand. `text-accent-ink` rather
                    than a fixed white for the same reason: the fill inverts
                    between themes and a hard-coded ink is invisible in
                    exactly one of them. */}
                <button
                  type="button"
                  onClick={save}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold
                             text-accent-ink outline-none transition-transform
                             hover:-translate-y-px focus-visible:ring-2
                             focus-visible:ring-accent/50"
                >
                  Save changes
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {ask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Unsaved changes"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAsk(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-line bg-panel p-5 text-left shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-fg">
              You have unsaved changes
            </h3>
            <p className="mt-2 text-sm text-muted">
              Nothing on this screen has been written to your book yet. Leave
              now and it is gone.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  save();
                  go(ask);
                }}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
              >
                Save and leave
              </button>
              <button
                type="button"
                onClick={() => setAsk(null)}
                className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-fg"
              >
                Stay here
              </button>
              {/* Last and quietest. It is the one press that destroys work, so
                  it does not get the weight of a bordered button beside the
                  two that keep it. */}
              <button
                type="button"
                onClick={() => go(ask)}
                className="px-4 py-1.5 text-sm font-semibold text-danger hover:underline"
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * For a tool that holds no draft: tick the step of the road it finishes.
 *
 * Four screens are like this — covers, comps, the title check and the export
 * flow. Everything on them either commits on the press that made it (a cover
 * is three stores written by `saveCover`) or is not stored at all (a search is
 * not an edit). So there is never anything unsaved, the bar above would never
 * be true, and what is actually missing is different: the road's step.
 *
 * Those four steps carry no detector, and deliberately. Nothing in a library
 * records that a writer read the readiness list, settled on two comps, or paid
 * somebody to draw a jacket — and `roadmap.ts` is explicit that ticking "Get a
 * cover made" off the fact that *some* artwork is attached would mark the most
 * expensive step in the list done on the strength of a placeholder gradient.
 *
 * So it is a press, and it writes immediately: there is one thing to record,
 * the writer just said it, and holding that behind a second Save would be a
 * confirmation step for a checkbox.
 */
export function ToolStepDone({
  state,
  className = "",
}: {
  state: ToolSaveState;
  className?: string;
}) {
  const { willTick, steps, flashing, save } = state;
  if (steps.length === 0) return null;

  const done = willTick.length === 0;
  const names = (list: readonly { title: string }[]) =>
    list.map((s) => `“${s.title}”`).join(" and ");

  return (
    <div className={`flex shrink-0 flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={save}
        disabled={done}
        title={
          done
            ? `${names(steps)} is ticked on your roadmap`
            : `Tick ${names(willTick)} on your roadmap`
        }
        className={
          done
            ? "rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted"
            : "rounded-lg border border-line px-4 py-2 text-sm font-semibold text-fg" +
              " outline-none transition-colors hover:border-accent/60 hover:bg-raised" +
              " focus-visible:ring-2 focus-visible:ring-accent/50"
        }
      >
        <span aria-hidden="true" className={done ? "mr-1.5 text-ok-fg" : "mr-1.5 text-muted"}>
          ✓
        </span>
        {done ? "Step done" : "Mark step done"}
      </button>

      {flashing && (
        <p className="max-w-[16rem] text-right text-xs text-muted">
          Ticked on your roadmap
        </p>
      )}
    </div>
  );
}
