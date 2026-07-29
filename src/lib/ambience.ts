/**
 * Background sound to write to.
 *
 * Every scene here is *synthesised* — filtered noise shaped by the Web Audio
 * API — rather than a recording streamed from somewhere. That is the whole
 * design, and it follows from what this app is:
 *
 * - No files to ship. A convincing rain loop is several megabytes, and a
 *   drafting tool that runs offline should not grow a download to make a sound.
 * - No network. The manuscript never leaves the machine, and neither does this.
 * - No licence to keep track of, and no loop to hear repeating. Noise has no
 *   seam, so it never comes round again.
 *
 * The cost is what can be made this way. Weather is noise with a shape, so rain,
 * surf and wind are honest here. A café or a lo-fi bed is *music and voices* —
 * there is no filter that makes those out of noise, and pretending otherwise
 * would produce something a writer switches off in five seconds. Those want
 * real recordings, which is a licensing decision rather than a coding one.
 *
 * Framework-free on purpose, like the store: this holds a live audio graph that
 * has to outlive any component, so a writer moving from the shelf into a chapter
 * keeps the rain. `use-ambience.ts` is the React binding.
 */

export type SceneId = "rain" | "waves" | "wind" | "hush";

export interface Scene {
  id: SceneId;
  name: string;
  /** What it actually sounds like — a writer should not have to press it. */
  description: string;
}

export const SCENES: readonly Scene[] = [
  {
    id: "rain",
    name: "Rain",
    description: "Steady rain on a window, no thunder.",
  },
  {
    id: "waves",
    name: "Waves",
    description: "Surf rolling in and drawing back, about eight to the minute.",
  },
  {
    id: "wind",
    name: "Wind",
    description: "Wind in the eaves, rising and falling.",
  },
  {
    id: "hush",
    name: "Hush",
    description: "Flat brown noise. The one that covers a room rather than filling it.",
  },
];

export interface AmbienceState {
  /** The scene playing, or null for silence. */
  scene: SceneId | null;
  /** 0 to 1. */
  volume: number;
}

const DEFAULT_VOLUME = 0.4;

/** Volume is a writer's setting, so it survives moving around the app. */
let state: AmbienceState = { scene: null, volume: DEFAULT_VOLUME };

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToAmbience(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getAmbience(): AmbienceState {
  return state;
}

/** The server renders silence; the client fills it in after hydration. */
const SERVER_STATE: AmbienceState = Object.freeze({
  scene: null,
  volume: DEFAULT_VOLUME,
});

export function getServerAmbience(): AmbienceState {
  return SERVER_STATE;
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}

/* --------------------------------------------------------------------------
   The noise.

   Both fillers are pure and take the channel to write, so they can be tested
   without an AudioContext — which jsdom does not have.
   -------------------------------------------------------------------------- */

/**
 * White noise: every frequency at equal power. Bright and hissy on its own,
 * which is why nothing here uses it unfiltered.
 */
export function fillWhiteNoise(channel: Float32Array): void {
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }
}

/**
 * Brown noise: white noise integrated, so power falls away as frequency rises.
 * This is the low, even rush people mean by "static that is not annoying", and
 * it is the body of every scene here.
 *
 * The 0.02 / 1.02 pair is a leaky integrator — without the leak the running sum
 * wanders off and the whole buffer clips to one side. The 3.5 puts what is left
 * back up to a usable level, since integrating costs most of the amplitude.
 */
export function fillBrownNoise(channel: Float32Array): void {
  let last = 0;
  for (let i = 0; i < channel.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    channel[i] = Math.min(1, Math.max(-1, last * 3.5));
  }
}

/* --------------------------------------------------------------------------
   The graph.

   One AudioContext, built on the first press and never rebuilt. Browsers refuse
   to start audio without a gesture, so it cannot be made any earlier than that
   — which is also why nothing here resumes a scene on page load: the writer
   would see a scene selected and hear nothing.
   -------------------------------------------------------------------------- */

interface Voice {
  /** Everything that has to be stopped and unhooked when the scene changes. */
  sources: AudioScheduledSourceNode[];
  output: GainNode;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voice: Voice | null = null;

/** How long a fade in or out takes. Long enough that neither one is an event. */
const FADE = 1.2;

export function isAmbienceSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "AudioContext" in window ||
    "webkitAudioContext" in (window as Record<string, unknown>)
  );
}

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = state.volume;
  master.connect(ctx.destination);
  return ctx;
}

/** A looping buffer of the given noise. Ten seconds is past the point where a
 *  listener can hear the loop come round, and short enough to build instantly. */
function noiseSource(
  context: AudioContext,
  fill: (channel: Float32Array) => void,
): AudioBufferSourceNode {
  const buffer = context.createBuffer(1, context.sampleRate * 10, context.sampleRate);
  fill(buffer.getChannelData(0));

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

/** A very slow oscillator wired into an AudioParam — what makes surf swell and
 *  wind rise rather than sitting at one level. */
function slowModulator(
  context: AudioContext,
  target: AudioParam,
  hz: number,
  depth: number,
): OscillatorNode {
  const lfo = context.createOscillator();
  lfo.frequency.value = hz;

  const amount = context.createGain();
  amount.gain.value = depth;

  lfo.connect(amount);
  amount.connect(target);
  return lfo;
}

function buildVoice(context: AudioContext, scene: SceneId): Voice {
  const output = context.createGain();
  const sources: AudioScheduledSourceNode[] = [];

  if (scene === "rain") {
    // Brown noise for the body of it, band-limited so it is water rather than
    // hiss, plus a quieter bright layer for the patter on the glass.
    const body = noiseSource(context, fillBrownNoise);
    const bodyTone = context.createBiquadFilter();
    bodyTone.type = "lowpass";
    bodyTone.frequency.value = 1400;
    const bodyLevel = context.createGain();
    bodyLevel.gain.value = 0.9;
    body.connect(bodyTone).connect(bodyLevel).connect(output);

    const patter = noiseSource(context, fillWhiteNoise);
    const patterTone = context.createBiquadFilter();
    patterTone.type = "bandpass";
    patterTone.frequency.value = 3200;
    patterTone.Q.value = 0.6;
    const patterLevel = context.createGain();
    patterLevel.gain.value = 0.05;
    patter.connect(patterTone).connect(patterLevel).connect(output);

    sources.push(body, patter);
  } else if (scene === "waves") {
    const surf = noiseSource(context, fillBrownNoise);
    const tone = context.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 600;

    // The swell. Around 7.5 a minute, which is roughly how often surf actually
    // arrives, and deep enough that the trough is nearly silence.
    const swell = context.createGain();
    swell.gain.value = 0.5;
    const lfo = slowModulator(context, swell.gain, 0.125, 0.45);

    surf.connect(tone).connect(swell).connect(output);
    sources.push(surf, lfo);
  } else if (scene === "wind") {
    const air = noiseSource(context, fillBrownNoise);
    const tone = context.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 500;

    // Wind changes colour as it rises, not just loudness — so the modulation
    // goes on the filter, opening towards a whistle and closing back to a hum.
    const lfo = slowModulator(context, tone.frequency, 0.05, 320);

    const level = context.createGain();
    level.gain.value = 0.85;
    air.connect(tone).connect(level).connect(output);
    sources.push(air, lfo);
  } else {
    const hush = noiseSource(context, fillBrownNoise);
    const tone = context.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 900;
    hush.connect(tone).connect(output);
    sources.push(hush);
  }

  return { sources, output };
}

/** Unhook a voice, fading first so stopping is never a click. */
function releaseVoice(context: AudioContext, dying: Voice) {
  const end = context.currentTime + FADE;
  dying.output.gain.cancelScheduledValues(context.currentTime);
  dying.output.gain.setValueAtTime(dying.output.gain.value, context.currentTime);
  dying.output.gain.linearRampToValueAtTime(0, end);

  for (const source of dying.sources) {
    // A source stopped mid-fade would cut it off, so they outlive the ramp.
    try {
      source.stop(end + 0.05);
    } catch {
      // Already stopped. Nothing to do.
    }
  }
  window.setTimeout(
    () => dying.output.disconnect(),
    (FADE + 0.2) * 1000,
  );
}

export function playScene(scene: SceneId): void {
  const context = audioContext();
  if (!context || !master) return;

  // Built on a gesture, but a tab restored from the background can still find
  // the context suspended.
  void context.resume();

  if (voice) releaseVoice(context, voice);

  const next = buildVoice(context, scene);
  next.output.connect(master);
  next.output.gain.setValueAtTime(0, context.currentTime);
  next.output.gain.linearRampToValueAtTime(1, context.currentTime + FADE);
  for (const source of next.sources) source.start();

  voice = next;
  state = { ...state, scene };
  emit();
}

export function stopAmbience(): void {
  if (ctx && voice) releaseVoice(ctx, voice);
  voice = null;
  state = { ...state, scene: null };
  emit();
}

export function setAmbienceVolume(value: number): void {
  const volume = clampVolume(value);
  state = { ...state, volume };
  if (ctx && master) {
    // A short ramp rather than a jump: dragging a slider straight onto the gain
    // steps the signal, and steps in a signal are audible as crackle.
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
  }
  emit();
}
