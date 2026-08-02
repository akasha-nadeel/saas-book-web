"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The store-listing form, filling itself in.
 *
 * **The hints are the point, not the inputs.** Any form can ask for an ISBN;
 * the line underneath saying *"Amazon assigns its own; Apple and Kobo want
 * yours"* is the thing a writer cannot get anywhere without paying somebody.
 * So the figure is drawn label-first with the hint given equal weight, which is
 * the opposite of how a form is usually shown off — and it is why the camera
 * pushes in rather than sitting still: at the size this panel gets, a 12px hint
 * is texture until something points at it.
 *
 * **All six fields, not a representative four.** An earlier version showed
 * two-thirds of the form to keep the panel short, which is the kind of edit
 * that looks like design and is actually a small lie: the reader counts what
 * they are shown, and a page whose whole claim is being checkable cannot round
 * its own screenshots down. The pass starts on an *empty* form, because that is
 * the state a writer actually arrives at, and the Skip line stays — "you can
 * add this later" is a promise the export really honours and the most
 * reassuring thing here.
 *
 * The strings are copied from `publishing-card.tsx` rather than imported —
 * that file is a Client Component full of inputs and state, and pulling it in
 * to read six sentences would ship the whole export screen to a marketing page.
 * The cost is that they can drift; the check against that is that they are
 * short, quoted here, and a change to a hint is a change somebody is already
 * reading. The three language options are the real first three of that file's
 * `LANGUAGES` for the same reason a figure is drawn rather than screenshotted:
 * inventing plausible ones ("Español", "Français") would put something on the
 * page that nobody can find in the product.
 *
 * **It is drawn, not recorded.** Same rule as every other figure on this page —
 * a screen capture is an asset that goes stale silently while the app moves, on
 * the one page whose whole pitch is being checkable. Nothing here is a video.
 *
 * Three things keep it from being a nuisance:
 *
 * - **It runs only while it is on screen**, and stops when the tab is hidden.
 *   The landing page scrolls inside its own container (`<body>` is
 *   `overflow-hidden` for the editor shell), so the observer is pointed at the
 *   nearest scrolling ancestor rather than left on the default root.
 * - **`prefers-reduced-motion` gets the finished form** — every field filled,
 *   no pointer, no movement — rather than no figure at all.
 * - **Every frame writes `transform` and `opacity` and nothing else.** The one
 *   exception is the typed text, which is React state; it changes at most once
 *   per character.
 *
 * Positions are *measured* rather than hard-coded: the pointer aims at the real
 * boxes through `getBoundingClientRect`, so the path stays honest when the grid
 * folds to one column on a phone or the manuscript font loads late.
 */

type Pt = { x: number; y: number };
type Cam = { x: number; y: number; z: number };
type FieldDef = {
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  type?: "select";
  suffix?: "chevron" | "calendar";
};
type Step = {
  i: number;
  travelFrom: number;
  clickAt: number;
  focusFrom: number;
  focusTo: number;
  typeStart: number;
  typeEnd: number;
  openAt: number;
  optionTravelFrom: number;
  optionClickAt: number;
  closeAt: number;
};

const INK = "#312e81"; // the page's one action colour — see landing-page.tsx

/*
 * The pace. Deliberately slower than a real hand: this runs beside three
 * paragraphs of prose, and a reader who is reading them should still catch a
 * whole field being filled in when they glance across. A demo that outruns the
 * copy beside it is a demo nobody sees.
 */
const CPS = 72; // ms per typed character
const REST = 1100; // opening beat on the whole form
const TRAVEL = 700; // pointer flight between two fields
const SETTLE = 320; // how long a finished field is held before moving on
const ZOOM = 1.08; // the camera push, capped again per frame against the width
const PAD = 28; // horizontal padding of the form, in px — the crop's budget
const SAFE = 10; // px of screen edge the zoom must never eat into

/** The real first three of `LANGUAGES` in `publishing-card.tsx`. */
const LANGS = ["English", "English (United Kingdom)", "English (United States)"];

const FIELDS: FieldDef[] = [
  {
    label: "ISBN",
    hint: "13 digits. Amazon assigns its own; Apple and Kobo want yours.",
    value: "978-0-306-40615-7",
    placeholder: "978-0-306-40615-7",
  },
  {
    label: "Language",
    hint: "Decides which storefront the book is listed on.",
    value: "English",
    placeholder: "Select a language",
    type: "select",
    suffix: "chevron",
  },
  {
    label: "Publisher",
    hint: "Your own name is the usual answer when self-publishing.",
    value: "Elena Rosa",
    placeholder: "Your imprint",
  },
  {
    label: "Publication date",
    hint: "Leave empty until it has one.",
    value: "08/02/2026",
    placeholder: "mm/dd/yyyy",
    suffix: "calendar",
  },
  {
    label: "Series",
    hint: "The shelf this book belongs to, if any.",
    value: "The salt cycle",
    placeholder: "Series name",
  },
  {
    label: "Number in series",
    hint: "As a reader would count it.",
    value: "1",
    placeholder: "2",
  },
];

/** One pass over the six fields, then the button. All times in ms. */
const TL = (() => {
  const steps: Step[] = [];
  const clicks: { at: number; k: string }[] = [];
  let t = REST;
  FIELDS.forEach((f, i) => {
    const travelFrom = t;
    t += i === 0 ? TRAVEL + 80 : TRAVEL;
    const clickAt = t;
    clicks.push({ at: clickAt, k: "f" + i });
    const s: Step = {
      i,
      travelFrom,
      clickAt,
      focusFrom: clickAt + 10,
      focusTo: 0,
      typeStart: 0,
      typeEnd: 0,
      openAt: -1,
      optionTravelFrom: -1,
      optionClickAt: -1,
      closeAt: -1,
    };
    if (f.type === "select") {
      s.openAt = clickAt + 30;
      s.optionTravelFrom = clickAt + 260;
      t = s.optionTravelFrom + 520;
      s.optionClickAt = t;
      clicks.push({ at: t, k: "opt" });
      s.typeStart = t + 60;
      s.typeEnd = s.typeStart;
      s.closeAt = t + 90;
      t = s.closeAt + SETTLE;
      s.focusTo = t;
    } else {
      t = clickAt + 190;
      s.typeStart = t;
      t += f.value.length * CPS;
      s.typeEnd = t;
      t += SETTLE;
      s.focusTo = t;
    }
    steps.push(s);
  });
  const contFrom = t;
  const contArrive = t + 900;
  const contClick = contArrive + 260;
  clicks.push({ at: contClick, k: "cont" });
  const outro = contClick + 1800;
  return { steps, clicks, contFrom, contArrive, contClick, outro, loop: outro + 620 };
})();

/** Pointer keyframes as anchor names; resolved against measured geometry per frame. */
const PATH = (() => {
  const p: { t: number; k: string }[] = [
    { t: 0, k: "park" },
    { t: TL.steps[0].travelFrom, k: "park" },
  ];
  TL.steps.forEach((s, i) => {
    p.push({ t: s.clickAt, k: "f" + i });
    const next = i + 1 < TL.steps.length ? TL.steps[i + 1].travelFrom : TL.contFrom;
    if (s.optionClickAt > 0) {
      p.push({ t: s.optionTravelFrom, k: "f" + i });
      p.push({ t: s.optionClickAt, k: "opt" });
      p.push({ t: next, k: "opt" });
    } else {
      p.push({ t: next, k: "f" + i });
    }
  });
  p.push({ t: TL.contArrive, k: "cont" });
  p.push({ t: TL.loop, k: "cont" });
  return p;
})();

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Short down-up pulse around a click instant. */
const pulse = (t: number, at: number) => {
  const d = t - at;
  if (d < -90 || d > 130) return 0;
  return d < 0 ? (d + 90) / 90 : 1 - d / 130;
};

/**
 * The nearest scrolling ancestor, or null for the viewport.
 *
 * This page owns its own scrolling, so the element that moves under the reader
 * is a `div`, not the document. Pointing the observer at it is the reliable
 * reading of "is this on screen".
 */
function scrollParent(el: Element | null): Element | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return null;
}

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/* The cursor is drawn in a 24×26 grid and shown at 17px wide, so its hotspot —
   the tip of the arrow — moves with it. Hard-coding 4.5/2.4 would hang the
   pointer a few pixels off every field it clicks. */
const CUR_W = 26;
const CUR_H = (26 / 24) * CUR_W;
const HX = (4.5 / 24) * CUR_W;
const HY = (2.4 / 24) * CUR_W;

const BOX =
  "flex h-[38px] w-full items-center rounded-lg border border-[#dcdce0] bg-white px-3 text-sm leading-none text-[#0f0f10]";
const RING = "pointer-events-none absolute -inset-[3px] rounded-[11px] opacity-0";
const RING_SHADOW = { boxShadow: `0 0 0 2px ${INK}, 0 0 0 5px rgba(49,46,129,0.13)` };

export function StoreListingDemo() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLDivElement | null>(null);
  const btnGlowRef = useRef<HTMLSpanElement | null>(null);
  const ddRef = useRef<HTMLSpanElement | null>(null);
  const optRef = useRef<HTMLSpanElement | null>(null);
  const optHiRef = useRef<HTMLSpanElement | null>(null);
  const boxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ringRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const caretRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rippleRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const pts = useRef<Record<string, Pt>>({});
  const size = useRef({ w: 460, h: 560 });
  const cam = useRef<Cam>({ x: 0, y: 0, z: 1 });
  const snap = useRef(true);
  const clock = useRef(0);
  const lastLens = useRef(FIELDS.map(() => -1));

  const [lens, setLens] = useState(() => FIELDS.map(() => 0));
  // Seeded rather than switched on in an effect: with no IntersectionObserver
  // (a very old browser, or jsdom) the figure should run rather than sit dark
  // forever, and nothing rendered depends on this, so the server's answer
  // differing from the client's costs nothing.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);

  /* ---------- measurement: the pointer aims at real element positions ---------- */

  const measure = useCallback(() => {
    const screen = screenRef.current;
    if (!screen) return;

    /*
     * Park the camera first, and put it back after.
     *
     * This runs at mount, on every resize, and again when the fonts land — and
     * that last one arrives a second or two in, by which time a push is usually
     * in flight. `getBoundingClientRect` reports the *transformed* rect, so
     * measuring through a live camera records where a field currently appears
     * rather than where it sits in the layout, and since the pointer is drawn
     * inside that same transform the zoom then gets applied to it twice. The
     * pointer lands short of every field, and further short each time this is
     * called. Same rule as `pagination.ts`: measure the natural flow, always.
     */
    const camEl = camRef.current;
    const held = camEl ? camEl.style.transform : "";
    if (camEl) camEl.style.transform = "none";

    const s = screen.getBoundingClientRect();
    size.current = { w: s.width, h: s.height };
    const rel = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left - s.left, t: r.top - s.top, w: r.width, h: r.height };
    };
    const next: Record<string, Pt> = { park: { x: s.width - 34, y: s.height - 20 } };
    boxRefs.current.forEach((el, i) => {
      const r = rel(el);
      if (r) {
        next["f" + i] = { x: r.l + Math.min(40, r.w * 0.35), y: r.t + r.h * 0.55 };
        next["c" + i] = { x: r.l + r.w / 2, y: r.t + r.h / 2 };
      }
    });
    const o = rel(optRef.current);
    if (o) next.opt = { x: o.l + 28, y: o.t + o.h * 0.5 };
    const b = rel(btnRef.current);
    if (b) {
      next.cont = { x: b.l + b.w * 0.5 + 18, y: b.t + b.h * 0.5 };
      next.cCont = { x: b.l + b.w / 2, y: b.t + b.h / 2 };
    }
    pts.current = { ...pts.current, ...next };
    if (camEl) camEl.style.transform = held;
    snap.current = true;
  }, []);

  useIso(() => {
    measure();
    const screen = screenRef.current;
    if (!screen || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(screen);
    // The hints reflow when the manuscript face arrives, which moves every box
    // below them; measuring only at mount leaves the pointer clicking air.
    if (document.fonts) document.fonts.ready.then(() => measure());
    return () => ro.disconnect();
  }, [measure]);

  /* ---------- one frame: transform + opacity only ---------- */

  const apply = useCallback((t: number, dt: number) => {
    const P = pts.current;
    const park = P.park || { x: 0, y: 0 };
    const at = (k: string) => P[k] || park;

    /* pointer along the keyframed path */
    let p = park;
    for (let i = 0; i < PATH.length - 1; i++) {
      const a = PATH[i];
      const b = PATH[i + 1];
      if (t >= a.t && t <= b.t) {
        const pa = at(a.k);
        const pb = at(b.k);
        const e = easeInOut(seg(t, a.t, b.t));
        p = { x: lerp(pa.x, pb.x, e), y: lerp(pa.y, pb.y, e) };
        break;
      }
    }

    let press = 0;
    for (const c of TL.clicks) press = Math.max(press, pulse(t, c.at));

    const fade = Math.min(seg(t, 0, 260), 1 - seg(t, TL.outro, TL.outro + 340));
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${(p.x - HX).toFixed(2)}px, ${(
        p.y - HY
      ).toFixed(2)}px, 0) scale(${(1 - press * 0.17).toFixed(3)})`;
      cursorRef.current.style.opacity = Math.min(seg(t, 140, 480), fade).toFixed(3);
    }

    /* camera: a gentle push that drifts down the form, then eases back out */
    let active = -1;
    for (const s of TL.steps) if (t >= s.travelFrom && t < s.focusTo) active = s.i;
    const working = clamp01(seg(t, REST + 240, REST + 900) - seg(t, TL.contFrom, TL.contArrive));
    // Cap the push so the padding can absorb the crop — a narrower screen needs
    // a gentler zoom or the outer column loses its first characters.
    const half = Math.max(1, size.current.w / 2);
    const tz = 1 + (Math.min(ZOOM, (half - SAFE) / Math.max(1, half - PAD)) - 1) * working;
    const focus =
      active >= 0
        ? at("c" + active)
        : t >= TL.contFrom
          ? at("cCont")
          : { x: half, y: size.current.h * 0.42 };
    const tx = half;
    const ty = focus.y;
    const k = snap.current || dt > 1e5 ? 1 : 1 - Math.exp(-dt / 200);
    cam.current.x += (tx - cam.current.x) * k;
    cam.current.y += (ty - cam.current.y) * k;
    cam.current.z += (tz - cam.current.z) * (snap.current || dt > 1e5 ? 1 : 1 - Math.exp(-dt / 260));
    snap.current = false;
    if (camRef.current) {
      const { w, h } = size.current;
      const z = cam.current.z;
      const ox = clamp(w / 2 - z * cam.current.x, w - z * w, 0);
      const oy = clamp(h / 2 - z * cam.current.y, h - z * h, 0);
      camRef.current.style.transform = `translate3d(${ox.toFixed(2)}px, ${oy.toFixed(
        2
      )}px, 0) scale(${z.toFixed(4)})`;
    }

    /* per-field focus ring, typed value, caret */
    const solid = Math.floor(t / 520) % 2 === 0 ? 1 : 0;
    let changed = false;
    const nextLens = lastLens.current.slice();
    TL.steps.forEach((s, i) => {
      const f = FIELDS[i];
      const focusOp = clamp01(
        seg(t, s.focusFrom, s.focusFrom + 110) - seg(t, s.focusTo - 60, s.focusTo + 60)
      );
      const ring = ringRefs.current[i];
      if (ring) ring.style.opacity = focusOp.toFixed(3);

      const len =
        f.type === "select"
          ? t >= s.typeStart
            ? f.value.length
            : 0
          : Math.max(0, Math.min(f.value.length, Math.floor((t - s.typeStart) / CPS)));
      if (nextLens[i] !== len) {
        nextLens[i] = len;
        changed = true;
      }

      const txt = textRefs.current[i];
      if (txt) txt.style.opacity = fade.toFixed(3);
      const caret = caretRefs.current[i];
      if (caret) {
        const typing = f.type !== "select" && t >= s.typeStart && t <= s.typeEnd + 120;
        caret.style.opacity = (
          focusOp *
          (typing ? 1 : solid) *
          fade *
          (f.type === "select" ? 0 : 1)
        ).toFixed(3);
      }
    });
    if (changed) {
      lastLens.current = nextLens;
      setLens(nextLens);
    }

    /* language dropdown */
    const sel = TL.steps[1];
    const open = clamp01(
      seg(t, sel.openAt, sel.openAt + 150) - seg(t, sel.closeAt, sel.closeAt + 130)
    );
    if (ddRef.current) {
      ddRef.current.style.opacity = (open * fade).toFixed(3);
      ddRef.current.style.transform = `translate3d(0, ${(-7 * (1 - open)).toFixed(
        2
      )}px, 0) scale(${(0.975 + 0.025 * open).toFixed(4)})`;
    }
    if (optHiRef.current) {
      const hi = clamp01(
        seg(t, sel.optionTravelFrom + 230, sel.optionTravelFrom + 340) -
          seg(t, sel.closeAt, sel.closeAt + 100)
      );
      optHiRef.current.style.opacity = (hi * 0.1).toFixed(3);
    }

    /* continue button */
    const hover = clamp01(
      seg(t, TL.contArrive - 110, TL.contArrive + 40) - seg(t, TL.outro, TL.outro + 220)
    );
    const down = pulse(t, TL.contClick);
    if (btnRef.current)
      btnRef.current.style.transform = `scale(${(1 + hover * 0.006 - down * 0.022).toFixed(4)})`;
    if (btnGlowRef.current) btnGlowRef.current.style.opacity = (hover * 0.12).toFixed(3);

    /* click ripples */
    TL.clicks.forEach((c, i) => {
      const el = rippleRefs.current[i];
      if (!el) return;
      const r = seg(t, c.at, c.at + 540);
      const a = at(c.k);
      el.style.opacity = (r > 0 && r < 1 ? 0.3 * (1 - r) : 0).toFixed(3);
      el.style.transform = `translate3d(${(a.x - 17).toFixed(1)}px, ${(a.y - 17).toFixed(
        1
      )}px, 0) scale(${(0.25 + r * 1.7).toFixed(3)})`;
    });
  }, []);

  /* ---------- reduced motion: finished form, no pointer, no movement ---------- */

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useIso(() => {
    if (!reduced) return;
    const full = FIELDS.map((f) => f.value.length);
    lastLens.current = full;
    setLens(full);
    clock.current = 0;
    if (cursorRef.current) cursorRef.current.style.opacity = "0";
    if (camRef.current) camRef.current.style.transform = "none";
    if (ddRef.current) ddRef.current.style.opacity = "0";
    if (btnRef.current) btnRef.current.style.transform = "none";
    if (btnGlowRef.current) btnGlowRef.current.style.opacity = "0";
    const fadeAll = (els: (HTMLElement | null)[], op: string) => {
      for (const el of els) if (el) el.style.opacity = op;
    };
    fadeAll(ringRefs.current, "0");
    fadeAll(caretRefs.current, "0");
    fadeAll(rippleRefs.current, "0");
    fadeAll(textRefs.current, "1");
  }, [reduced]);

  /* ---------- only animate while on screen ---------- */

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(e.isIntersecting);
      },
      { root: scrollParent(el), threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (reduced || !visible || hidden) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const next = clock.current + dt;
      if (next >= TL.loop) snap.current = true;
      clock.current = next % TL.loop;
      apply(clock.current, dt);
      raf = requestAnimationFrame(tick);
    };
    snap.current = true;
    apply(clock.current, 1e6);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, visible, hidden, apply]);

  /* ---------- markup ---------- */

  return (
    // A tablet, held slightly off the page.
    //
    // The bezel and the shadow are doing one job between them: they say *this
    // is a real screen in a real product*, which a bordered card on a white
    // page does not. The shadow is deliberately tight and dark rather than the
    // big soft blur a template reaches for — a diffuse shadow reads as a
    // sticker floating above the page, a short one reads as an object resting
    // on it, and the second is the impression worth having.
    <div
      ref={hostRef}
      role="img"
      aria-label="A store-listing form filling itself in — ISBN, language, publisher, publication date, series and number in series — and then being submitted."
      className="rounded-[1.75rem] border border-[#b9b9c4] bg-[#e2e2e8] p-3 select-none
                 shadow-[0_2px_0_#b9b9c4,0_10px_18px_-8px_rgba(15,15,16,0.30),0_30px_46px_-18px_rgba(15,15,16,0.55)]"
    >
      {/* The screen carries its own hairline: bezel and screen are both pale,
          and without it the glass has no edge and the whole thing reads as one
          flat card again. */}
      <div
        ref={screenRef}
        aria-hidden="true"
        className="relative overflow-hidden rounded-[1.25rem] border border-[#d8d8de] bg-white"
      >
        {/* Everything the camera moves lives in here, padding included — the
            push has to be able to crop into the margin rather than into the
            fields. */}
        <div ref={camRef} className="relative origin-top-left will-change-transform">
          <div className="px-7 pt-7 pb-6">
            <p className="oc-heading font-serif text-xl text-[#0f0f10]">
              What a shop asks for
            </p>
            <p className="mt-1 text-sm text-[#8a8a92]">
              Saved to the book, so you answer these once rather than once per export.
            </p>

            <div className="mt-6 grid gap-x-5 gap-y-5 sm:grid-cols-2">
              {FIELDS.map((f, i) => (
                <div key={f.label} className={f.type === "select" ? "relative z-20" : "relative"}>
                  <p className="text-xs font-medium text-[#0f0f10]">{f.label}</p>
                  <div
                    ref={(el) => {
                      boxRefs.current[i] = el;
                    }}
                    className="relative mt-1.5"
                  >
                    <div className={f.suffix ? BOX + " justify-between" : BOX}>
                      <span
                        ref={(el) => {
                          textRefs.current[i] = el;
                        }}
                        className="flex min-w-0 items-center whitespace-pre"
                      >
                        {lens[i] > 0 ? (
                          f.value.slice(0, lens[i])
                        ) : (
                          <span className="text-[#b0b0b8]">{f.placeholder}</span>
                        )}
                        <span
                          ref={(el) => {
                            caretRefs.current[i] = el;
                          }}
                          className="ml-px h-[15px] w-[1.5px] shrink-0 rounded-full bg-[#312e81] opacity-0"
                        />
                      </span>
                      {f.suffix === "chevron" ? (
                        <svg width="11" height="7" viewBox="0 0 14 9" fill="none">
                          <path
                            d="M1 1.5 7 7.5 13 1.5"
                            stroke="#0f0f10"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                      {f.suffix === "calendar" ? (
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <rect
                            x="1.4"
                            y="2.9"
                            width="13.2"
                            height="11.7"
                            rx="2"
                            stroke="#0f0f10"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M1.4 6.4h13.2M5 1.4v2.6M11 1.4v2.6"
                            stroke="#0f0f10"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : null}
                    </div>

                    <span
                      ref={(el) => {
                        ringRefs.current[i] = el;
                      }}
                      className={RING}
                      style={RING_SHADOW}
                    />

                    {f.type === "select" ? (
                      <span
                        ref={ddRef}
                        className="pointer-events-none absolute top-[44px] right-0 left-0 z-30 block
                                   origin-top rounded-lg border border-[#e6e6e8] bg-white p-1 opacity-0
                                   shadow-[0_1px_2px_rgba(15,15,16,0.10),0_6px_12px_-4px_rgba(15,15,16,0.18)]
                                   will-change-transform"
                      >
                        {LANGS.map((l, li) => (
                          <span
                            key={l}
                            ref={li === 0 ? optRef : undefined}
                            className="relative flex h-[30px] items-center rounded-md px-2 text-xs text-[#0f0f10]"
                          >
                            <span
                              ref={li === 0 ? optHiRef : undefined}
                              className="absolute inset-0 rounded-md bg-[#312e81] opacity-0"
                            />
                            <span className="relative">{l}</span>
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#8a8a92]">{f.hint}</p>
                </div>
              ))}
            </div>

            {/* A drawing of a button, not a button: nothing on this figure is
                pressable, and a real <button> here would be a tab stop that
                does nothing. */}
            <div
              ref={btnRef}
              className="relative mt-6 flex h-[42px] w-full items-center justify-center
                         rounded-lg text-sm font-semibold text-white will-change-transform"
              style={{ backgroundColor: INK }}
            >
              <span
                ref={btnGlowRef}
                className="pointer-events-none absolute inset-0 rounded-lg bg-white opacity-0"
              />
              <span className="relative">Continue</span>
            </div>

            <p className="mt-3 text-center text-xs text-[#8a8a92]">
              Skip — you can add this later
            </p>
          </div>

          {/* Ripples and pointer live inside the camera layer so they stay glued
              to the fields while it moves. */}
          {TL.clicks.map((c, i) => (
            <span
              key={c.at}
              ref={(el) => {
                rippleRefs.current[i] = el;
              }}
              className="pointer-events-none absolute top-0 left-0 z-40 h-[34px] w-[34px]
                         rounded-full bg-[#312e81] opacity-0 will-change-transform"
            />
          ))}

          <div
            ref={cursorRef}
            className="pointer-events-none absolute top-0 left-0 z-50 opacity-0 will-change-transform"
            style={{ transformOrigin: `${HX}px ${HY}px` }}
          >
            <svg width={CUR_W} height={CUR_H} viewBox="0 0 24 26" fill="none">
              <path
                d="M4.5 2.4 L4.5 20.6 L9.6 16.1 L12.7 23.2 L16.1 21.7 L13.1 14.8 L19.5 14.8 Z"
                fill="#0f0f10"
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
