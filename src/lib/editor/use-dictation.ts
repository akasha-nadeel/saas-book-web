"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Dictation: speak, and the words land on the page.
 *
 * This uses the browser's own SpeechRecognition rather than the transcriber
 * behind the audiobook import, and the difference is not an oversight. That one
 * takes a finished file and costs money per minute; this one is live, free, and
 * already running on the machine. Sending a continuous microphone stream to a
 * paid API to watch words appear would be the wrong trade in both directions.
 *
 * The cost is reach: it is a Chrome and Edge feature. `supported` says so, and
 * the button that uses this hides itself rather than offering something that
 * cannot work. It is also not private — Chrome sends the audio to Google — so
 * the control says as much before a writer turns it on.
 */

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
  };
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  /** Fired when the engine starts and stops hearing a voice, as against noise. */
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function recogniser(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: Ctor;
    webkitSpeechRecognition?: Ctor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * What the microphone is picking up *right now*.
 *
 * Kept apart from the React state below, and deliberately. `listening` changes
 * twice a session; these change several times a second while somebody talks,
 * and putting them in state would re-render the whole editor shell — the
 * manuscript, the panels, the rails — at that rate, which is exactly the moment
 * a writer would notice jank. Components that want them subscribe instead, so
 * only the indicator repaints.
 */
export interface DictationLive {
  /** Words the engine has heard but not yet committed to. */
  interim: string;
  /** A voice is being heard, as against silence or room noise. */
  hearing: boolean;
}

/** Frozen and shared: `useSyncExternalStore` loops on an unstable snapshot. */
const SILENT: DictationLive = Object.freeze({ interim: "", hearing: false });

export interface Dictation {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  /** See DictationLive. Read these through `useDictationLive`. */
  subscribe: (onChange: () => void) => () => void;
  live: () => DictationLive;
}

/**
 * The live reading, for whichever component is showing it.
 *
 * Server-rendered as silence: there is no microphone there, and the snapshot
 * has to be referentially stable or the store spins — the same reason
 * use-library.ts freezes its empty shelf.
 */
export function useDictationLive(dictation: Dictation): DictationLive {
  return useSyncExternalStore(
    dictation.subscribe,
    dictation.live,
    () => SILENT,
  );
}

/**
 * @param onText called with each finished phrase, ready to insert.
 *
 * Only final results are handed over. Interim ones change as the recogniser
 * reconsiders — inserting those would have words rewriting themselves under the
 * writer's caret, and every correction would land in the undo history.
 */
const NEVER_CHANGES = () => () => {};
const hasEngine = () => recogniser() !== null;
const NOT_ON_SERVER = () => false;

export function useDictation(onText: (text: string) => void): Dictation {
  // Read the way useHydrated does: the server renders as unsupported and the
  // client fills it in after hydration, with no effect setting state to do it.
  const supported = useSyncExternalStore(
    NEVER_CHANGES,
    hasEngine,
    NOT_ON_SERVER,
  );

  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  // Kept in a ref so the recogniser's handlers always reach the current
  // callback without the engine having to be rebuilt on every render.
  const sink = useRef(onText);
  useEffect(() => {
    sink.current = onText;
  });
  // Distinguishes a stop the writer asked for from the recogniser stopping on
  // its own, which it does after a pause and which should simply resume.
  const wanted = useRef(false);

  // The live reading, held outside React. See DictationLive.
  const live = useRef<DictationLive>(SILENT);
  const listeners = useRef(new Set<() => void>());

  const subscribe = useCallback((onChange: () => void) => {
    listeners.current.add(onChange);
    return () => {
      listeners.current.delete(onChange);
    };
  }, []);

  const readLive = useCallback(() => live.current, []);

  /**
   * Publish a new reading, and only when it is actually new — an unchanged
   * snapshot must keep its reference or every subscriber re-renders for
   * nothing, several times a second.
   */
  const setLive = useCallback((next: DictationLive) => {
    const now = live.current;
    if (now.interim === next.interim && now.hearing === next.hearing) return;
    live.current = next;
    for (const listener of listeners.current) listener();
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
    setLive(SILENT);
  }, [setLive]);

  const start = useCallback(() => {
    const Ctor = recogniser();
    if (!Ctor) return;

    setError(null);
    wanted.current = true;

    const engine = new Ctor();
    engine.continuous = true;
    engine.interimResults = true;
    engine.lang = navigator.language || "en-US";

    engine.onresult = (event) => {
      let finished = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finished += result[0].transcript;
        // Interim results are still not *inserted* — see the note above; they
        // rewrite themselves as the engine reconsiders, and every correction
        // would land in the undo history. Shown, though: they are the only
        // honest answer to "is it hearing me", and a writer watching their own
        // words appear knows the microphone is working before a single one is
        // committed.
        else pending += result[0].transcript;
      }

      setLive({ interim: pending.trim(), hearing: true });

      const text = finished.trim();
      if (text) sink.current(text);
    };

    // A voice started and stopped, as against silence. Cheaper and more honest
    // than metering the input ourselves: the engine is already listening, and a
    // second audio stream just to draw a level would be a second thing to get
    // wrong. The interim text clears with the voice that produced it.
    engine.onspeechstart = () => {
      setLive({ interim: live.current.interim, hearing: true });
    };
    engine.onspeechend = () => {
      setLive({ interim: "", hearing: false });
    };

    engine.onerror = (event) => {
      const code = event.error;
      // "no-speech" and "aborted" are ordinary: a pause, or our own stop.
      if (code === "no-speech" || code === "aborted") return;
      setError(
        code === "not-allowed"
          ? "Microphone access was refused. Allow it in the address bar to dictate."
          : "Dictation stopped unexpectedly.",
      );
      wanted.current = false;
      setListening(false);
      setLive(SILENT);
    };

    // Chrome ends the session after a silence even with continuous set. If the
    // writer has not asked to stop, they are still dictating — just thinking.
    engine.onend = () => {
      setLive(SILENT);
      if (!wanted.current) {
        setListening(false);
        return;
      }
      try {
        engine.start();
      } catch {
        setListening(false);
      }
    };

    try {
      engine.start();
      recognition.current = engine;
      setListening(true);
    } catch {
      setError("Dictation could not start.");
      setListening(false);
    }
  }, [setLive]);

  // Leaving the chapter with the microphone live would keep listening to a room
  // whose writer has gone.
  useEffect(() => {
    return () => {
      wanted.current = false;
      recognition.current?.abort();
    };
  }, []);

  return { supported, listening, error, start, stop, subscribe, live: readLive };
}
