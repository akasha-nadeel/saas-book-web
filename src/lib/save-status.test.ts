import { beforeEach, expect, it, vi } from "vitest";
import {
  getSaveState,
  resetSaveState,
  setSaveState,
  subscribeToSaveState,
} from "@/lib/save-status";

beforeEach(() => {
  resetSaveState();
});

it("starts saved with no timestamp", () => {
  expect(getSaveState()).toEqual({ status: "saved", lastSavedAt: null });
});

it("returns an identical reference on repeat reads", () => {
  // useSyncExternalStore compares snapshots by identity; a fresh object each
  // call is an infinite render loop.
  expect(getSaveState()).toBe(getSaveState());
});

it("keeps the same reference when set to an equal value", () => {
  // Autosave reports on every keystroke while a save is pending. Without this,
  // each report would be a new object and re-render the whole panel.
  const before = getSaveState();
  setSaveState({ status: "saved", lastSavedAt: null });
  expect(getSaveState()).toBe(before);
});

it("changes reference when the status changes", () => {
  const before = getSaveState();
  setSaveState({ status: "saving", lastSavedAt: null });
  expect(getSaveState()).not.toBe(before);
  expect(getSaveState().status).toBe("saving");
});

it("changes reference when only the timestamp moves", () => {
  const at = new Date(1_000_000);
  setSaveState({ status: "saved", lastSavedAt: at });
  const before = getSaveState();

  setSaveState({ status: "saved", lastSavedAt: new Date(2_000_000) });
  expect(getSaveState()).not.toBe(before);
});

it("notifies subscribers, and stops after unsubscribe", () => {
  const seen = vi.fn();
  const unsubscribe = subscribeToSaveState(seen);

  setSaveState({ status: "unsaved", lastSavedAt: null });
  expect(seen).toHaveBeenCalledTimes(1);

  // An unchanged value must not wake anybody up.
  setSaveState({ status: "unsaved", lastSavedAt: null });
  expect(seen).toHaveBeenCalledTimes(1);

  unsubscribe();
  setSaveState({ status: "error", lastSavedAt: null });
  expect(seen).toHaveBeenCalledTimes(1);
});
