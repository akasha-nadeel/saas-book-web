"use client";

import { useEffect, useRef } from "react";
import {
  SCENES,
  playScene,
  setAmbienceVolume,
  stopAmbience,
  type SceneId,
} from "@/lib/ambience";
import { useAmbience, useAmbienceSupported } from "@/lib/use-ambience";
import { Button } from "@/components/ui/button";

/**
 * The sound mixer: pick a scene, set the level, close it and keep writing.
 *
 * It goes on playing after this closes and after the writer moves into a
 * chapter — the engine holds the audio graph at module scope, so the dialog is
 * a control rather than the thing making the sound. Coming back here is how it
 * is turned off, and the shelf's button says when something is playing.
 */
export function SoundsDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { scene, volume } = useAmbience();
  const supported = useAmbienceSupported();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const choose = (id: SceneId) => {
    if (scene === id) stopAmbience();
    else playScene(id);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[30rem] max-w-[calc(100vw-2rem)] rounded-lg bg-tremor-background
                 p-0 text-tremor-content-strong backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">Background sound</h2>
        <p className="mt-2 font-sans text-sm leading-relaxed text-tremor-content">
          Keeps playing while you write. Pick the same one again to stop it.
        </p>

        {!supported ? (
          /* No Web Audio, nothing to offer. Said plainly rather than showing
             four buttons that would do nothing. */
          <p role="alert" className="mt-5 font-sans text-sm text-danger">
            This browser has no Web Audio support, so there is nothing to play.
          </p>
        ) : (
          <>
            <ul className="mt-5 flex flex-col gap-2">
              {SCENES.map((s) => {
                const on = scene === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => choose(s.id)}
                      aria-pressed={on}
                      className={`flex w-full cursor-pointer items-center gap-3
                                  rounded-lg border-2 px-3.5 py-3 text-left
                                  outline-none transition-colors
                                  focus-visible:ring-2 focus-visible:ring-accent/50
                                  ${
                                    on
                                      ? "border-accent bg-accent/10"
                                      : "border-tremor-border hover:border-accent/50 hover:bg-tremor-background-subtle"
                                  }`}
                    >
                      {/* Three bars that rise and fall while this scene is the
                          one playing — the state is worth seeing from across
                          the room, and it is the only moving thing here. */}
                      <span
                        aria-hidden="true"
                        className="flex h-5 w-5 shrink-0 items-end justify-center gap-0.5"
                      >
                        {[0, 1, 2].map((bar) => (
                          <span
                            key={bar}
                            className={`w-1 rounded-full ${
                              on
                                ? "bg-accent oc-eq"
                                : "h-1.5 bg-muted/50"
                            }`}
                            style={
                              on
                                ? { animationDelay: `${bar * 160}ms` }
                                : undefined
                            }
                          />
                        ))}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block font-sans text-sm font-semibold">
                          {s.name}
                        </span>
                        <span className="mt-0.5 block font-sans text-xs leading-relaxed text-tremor-content">
                          {s.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <label className="mt-5 flex items-center gap-3">
              <span className="font-sans text-sm text-tremor-content">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => setAmbienceVolume(Number(e.target.value) / 100)}
                className="h-1.5 flex-1 cursor-pointer accent-accent"
              />
              <span className="w-9 text-right font-sans text-xs tabular-nums text-tremor-content">
                {Math.round(volume * 100)}%
              </span>
            </label>
          </>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {/* Only offered when there is something to stop. */}
          {scene ? (
            <Button variant="secondary" onClick={stopAmbience} className="text-tremor-content hover:bg-tremor-background-subtle hover:text-tremor-content-strong">
              Stop
            </Button>
          ) : (
            <span />
          )}

          <Button onClick={onClose}>
            Back to writing
          </Button>
        </div>
      </div>
    </dialog>
  );
}
