import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaveController, type AutosaveState } from "./use-autosave";

/**
 * The save indicator in the corner of the editor.
 *
 * It is one word, and it is the only thing on the screen that tells a writer
 * whether their work is safe — so the whole of this file is about the cases
 * where it could say the wrong one.
 */

const DEBOUNCE = 800;
const MAX_WAIT = 5000;

function controllerWith(save: (v: string) => void | Promise<void>) {
  const seen: AutosaveState[] = [];
  const controller = createAutosaveController<string>({
    onChange: (state) => seen.push(state),
    debounceMs: DEBOUNCE,
    maxWaitMs: MAX_WAIT,
  });
  controller.setSave(save);
  controller.activate();
  return { controller, seen, words: () => seen.map((s) => s.status) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("reports a save that worked", async () => {
  const { controller, words } = controllerWith(() => {});
  controller.schedule("hello");
  await vi.advanceTimersByTimeAsync(DEBOUNCE + 10);
  expect(words()).toEqual(["unsaved", "saving", "saved"]);
});

/**
 * **The bug this file was written for.**
 *
 * React runs an effect setup → cleanup → setup under StrictMode, which Next
 * turns on by default in development, and the cleanup disposes the controller.
 * `disposed` was a one-way latch and only `emit` was gated on it — so the
 * second setup got a controller that still saved and could never say anything
 * again. The indicator sat on its initial "Saved" for the life of the page,
 * through failures and through a full origin.
 *
 * That is how a writer came to be looking at "Saved" beside a
 * `QuotaExceededError`. Not to be "simplified" by dropping `activate`.
 */
it("still reports after being disposed and set up again", async () => {
  const { controller, words } = controllerWith(() => {});

  // Exactly what StrictMode does to the effect that owns it.
  controller.dispose();
  controller.activate();

  controller.schedule("hello");
  await vi.advanceTimersByTimeAsync(DEBOUNCE + 10);
  expect(words()).toContain("saved");
});

it("goes quiet once it is really gone", async () => {
  const { controller, words } = controllerWith(() => {});
  controller.dispose();
  controller.schedule("hello");
  await vi.advanceTimersByTimeAsync(DEBOUNCE + 10);
  // A disposed controller belongs to an unmounted component; calling its
  // setState is the React warning nobody can act on.
  expect(words()).toEqual([]);
});

describe("a save that fails", () => {
  it("says so rather than claiming the work is safe", async () => {
    const { controller, words } = controllerWith(() => {
      throw new Error("nope");
    });
    controller.schedule("hello");
    await vi.advanceTimersByTimeAsync(DEBOUNCE + 10);
    expect(words()).toContain("error");
    expect(words()).not.toContain("saved");
  });

  /**
   * **A failure must not be retried in a tight loop**, which is what it used to
   * be: the value went back into `pending` and the `finally` saw work to do and
   * called `flush` again at once. Right after a save that *worked* — those are
   * newer keystrokes — and catastrophic after one that did not, because the
   * commonest cause is a full origin and nothing about trying again a
   * microtask later makes room. Measured: the editor crawled and the console
   * took fifty identical quota errors in seconds.
   */
  it("waits before trying again instead of spinning", async () => {
    const save = vi.fn(() => {
      throw new Error("nope");
    });
    const { controller } = controllerWith(save);

    controller.schedule("hello");
    await vi.advanceTimersByTimeAsync(DEBOUNCE + 10);
    expect(save).toHaveBeenCalledTimes(1);

    // Nothing at all in the second after it — this is the spin that was there.
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("keeps the writer's work for the retry", async () => {
    const seenValues: string[] = [];
    let failing = true;
    const { controller } = controllerWith((v) => {
      seenValues.push(v);
      if (failing) throw new Error("nope");
    });

    controller.schedule("the sentence");
    await vi.advanceTimersByTimeAsync(DEBOUNCE + 10);
    failing = false;
    await vi.advanceTimersByTimeAsync(6000);

    // The same words, not a truncated or empty document.
    expect(seenValues).toEqual(["the sentence", "the sentence"]);
  });

  it("complains once, not on every attempt", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { controller } = controllerWith(() => {
      throw new Error("nope");
    });

    controller.schedule("hello");
    await vi.advanceTimersByTimeAsync(DEBOUNCE + 10);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

/**
 * A novelist in flow can type for ten minutes without a pause long enough to
 * trip a debounce, which is why there are two timers rather than one.
 */
it("saves on the ceiling timer even while the typing never stops", async () => {
  const save = vi.fn(() => {});
  const { controller } = controllerWith(save);

  for (let i = 0; i < 20; i++) {
    controller.schedule(`draft ${i}`);
    await vi.advanceTimersByTimeAsync(400); // always under the debounce
  }

  expect(save).toHaveBeenCalled();
});
