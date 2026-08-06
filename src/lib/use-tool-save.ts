"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setRoadmapStep, type Book } from "./library-store";
import { ticksForTool, untickedFor } from "./tool-steps";
import type { Step } from "./roadmap";

/**
 * What a tool screen's saving knows, kept out of the controls that draw it.
 *
 * Every tool answers the same two questions — is there anything of the
 * writer's that has not been written down, and does finishing here finish a
 * step of the road — and the answers are wired to four things: whether the bar
 * at the foot of the window is up, what it says, the roadmap tick, and the
 * guard that stops somebody walking away from a draft. One hook so those
 * cannot disagree.
 *
 * **The tool passes its own `dirty` and its own `commit`.** It has to: a draft
 * blurb is a string, a draft listing is six fields, and there is no shape this
 * module could impose on both that would not be a worse fit than the screen's
 * own state. What this owns is everything that is the *same* on all of them.
 */

export interface ToolSaveState {
  /** The writer has edits on screen that are not in the store. */
  dirty: boolean;
  /** Road steps this press would tick, in road order. Often empty. */
  willTick: readonly Step[];
  /** Steps this tool can tick at all, ticked or not. */
  steps: readonly Step[];
  /** What was ticked by the last press, for the bar's own line. */
  ticked: readonly Step[];
  /** True for a few seconds after a press. */
  flashing: boolean;
  save: () => void;
  /** Throw the draft away and go back to what is stored, if the tool can. */
  discard?: (() => void) | undefined;
}

export function useToolSave({
  book,
  tool,
  dirty = false,
  commit,
  discard,
}: {
  /**
   * Undefined until the store has been read, and for a book that is not here.
   *
   * Taken rather than looked up, because every one of these screens has found
   * it already — and nullable because this hook has to be called *above* the
   * loading and not-found returns, where the screens have no book yet.
   * `findBook` answers `null` and a screen holding it in state answers
   * `undefined`; both are the same thing here.
   */
  book: Book | null | undefined;
  /** The URL segment, so the road is found by the step's own `href`. */
  tool: string;
  /** Whether the screen holds edits the store does not have. */
  dirty?: boolean;
  /** Writes them. Absent on a tool whose press only ticks the road. */
  commit?: () => void;
  /**
   * Puts the form back to what is stored.
   *
   * Optional, and every screen with a draft supplies it: the bar offers a way
   * out that is not "leave the page", because a writer who has changed their
   * mind about four categories should not have to undo four presses or
   * navigate away and come back.
   */
  discard?: () => void;
}): ToolSaveState {
  const bookId = book?.id;

  /*
   * **A book somebody let this writer read offers nothing to save, anywhere.**
   *
   * One check here rather than sixteen in the screens, and it is the same reason
   * this hook exists at all: a Save bar that appears and is then refused by
   * Postgres is the dead UI the house rules forbid, and a *roadmap tick* on
   * somebody else's book would be worse than dead — it is local-only, so it would
   * silently record progress against a manuscript this writer does not own.
   *
   * Absence of a role means the book is their own; a viewer is the only case that
   * lands here. An editor may write the manuscript, but these screens write the
   * `books` row — the blurb, the categories, the listing details — which is the
   * owner's alone, so `canWriteBook` is not the test. It is ownership.
   */
  const readOnly = Boolean(book?.role);

  const steps = useMemo(
    () => (bookId && !readOnly ? ticksForTool(bookId, tool) : []),
    [bookId, tool, readOnly],
  );
  const willTick = useMemo(
    () => (book && !readOnly ? untickedFor(book, tool) : []),
    [book, tool, readOnly],
  );

  const [ticked, setTicked] = useState<readonly Step[]>([]);
  const [flashing, setFlashing] = useState(false);

  /*
   * `commit` and the step list are read through a ref rather than named as
   * dependencies.
   *
   * The screen rebuilds `commit` on every keystroke — it closes over the
   * draft — so a `save` that depended on it would change identity constantly,
   * and the guard below registers `save`. Re-registering a module-level slot
   * on every character is how you end up with a cleanup from the previous
   * render clearing the guard the current one just installed.
   */
  const latest = useRef({ commit, willTick, bookId, locked: readOnly });
  /* Synced in an effect rather than written during render — a ref assignment
     in the render body is a side effect in a function React may call twice.
     No dependency list, so it runs after every commit; and `save` is only ever
     called from an event handler, which is strictly after the effect that
     armed it. */
  useEffect(() => {
    latest.current = { commit, willTick, bookId, locked: readOnly };
  });

  const save = useCallback(() => {
    const { commit: write, willTick: pending, bookId: id, locked } = latest.current;
    // Belt and braces: the bar is already absent, but a keyboard shortcut or a
    // stale closure must not be the one path that writes somebody else's book.
    if (!id || locked) return;
    write?.();
    for (const step of pending) setRoadmapStep(id, step.id, true);
    setTicked(pending);
    setFlashing(true);
  }, []);

  /* The flash is a confirmation, not a state — it says the press landed on a
     screen where the *result* of saving is often invisible (a stored blurb
     looks exactly like an unstored one). Cleared on a timer rather than on the
     next edit, so it does not vanish the moment somebody keeps typing. */
  useEffect(() => {
    if (!flashing) return;
    const timer = window.setTimeout(() => setFlashing(false), 4000);
    return () => window.clearTimeout(timer);
  }, [flashing, ticked]);

  // `dirty` forced false is what keeps the bar down: every screen draws it from
  // this, so there is no second place to remember.
  return {
    dirty: dirty && !readOnly,
    willTick,
    steps,
    ticked,
    flashing,
    save,
    discard,
  };
}
