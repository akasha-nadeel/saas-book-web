"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppWindow } from "@/components/landing/app-window";

/**
 * The dashboard, working — the figure for "Before you upload".
 *
 * A drawn recreation of the shelf, with a pointer that works the product and a
 * camera that pushes in and out across three beats:
 *
 *   1. Overview   — the book card, the phase rail, the next step
 *   2. Prepare    — the pointer clicks Prepare in the sidebar; two books, each
 *                   carrying a readiness badge
 *   3. Findings   — the pointer opens the second book's row: five problems,
 *                   each with the control that fixes it beside it
 *
 * **The third beat is the whole reason it exists.** A static panel can show
 * that the app lists problems; only a moving one shows that the fix is *on the
 * problem*, which is the single claim this section is making and the thing
 * `checkup.ts` was built around. The strings are the real screen's — "Get it
 * out without paying to find out what was wrong", "Check and export", "1 of 2
 * books have their listing details in order" — so the figure can only go wrong
 * if the product does.
 *
 * **Everything is divs, inline SVG and text, including the covers.** The
 * reference for this figure carried a real cover as a base64 JPEG; it was
 * AI-generated, with the mangled lettering that always gives those away, and
 * the page prints "We will not design your cover or edit your prose with AI"
 * two sections further down. So both covers are drawn — abstract shapes and
 * title bars, obviously a stand-in rather than a book that exists — which is
 * the same rule the rest of the page's figures follow and costs the bundle
 * nothing.
 *
 * Type is inherited rather than asked for: the app's sans *is* Inter, which is
 * what this was drawn in.
 *
 * Three things keep it from being a nuisance, the same three as
 * `store-listing-demo.tsx`:
 *
 * - **It runs only while on screen**, and stops with the tab.
 * - **`prefers-reduced-motion` gets the finished third beat, parked** — every
 *   finding shown, no pointer, no camera — rather than no figure at all.
 * - **Every frame writes `transform` and `opacity` and nothing else.**
 *
 * And it **measures with the camera parked**. `getBoundingClientRect` reports
 * the *transformed* rect, so measuring through a live push records where a
 * target currently appears rather than where it sits, and the pointer then
 * lands short of everything it clicks — further short each time. Same rule as
 * `pagination.ts`.
 */

/* ---- stage geometry (design px; the stage scales to the screen) ---- */
const W = 760;
const H = 470;

type Rect = { x: number; y: number; w: number; h: number };
type Rects = Record<string, Rect>;
/** `e`: 0 linear, 1 sine, 2 cubic — the easing *into* this key. */
type CamKey = { t: number; k: string; z: number; e?: 0 | 1 | 2 };
type CurKey = { t: number; k: string; e?: 0 | 1 | 2 };

/* ---- the loop ----------------------------------------------------- *
 *  0.0  overview, slow push onto the book card
 *  3.2  camera swings to the sidebar, pointer flies in
 *  4.45 CLICK: Prepare
 *  6.1  camera pulls back over the Prepare page, pointer sets off
 *  7.4  CLICK: the second book's disclosure
 *  7.75 five findings stagger in; camera settles on the first two
 * 11.0  camera pulls back out, pointer leaves, panel returns to Overview
 * ------------------------------------------------------------------- */
const LOOP = 13.2;

const CAM: CamKey[] = [
  { t: 0.0, k: "wide", z: 1.0 },
  { t: 0.8, k: "wide", z: 1.05, e: 1 },
  { t: 3.2, k: "book", z: 1.4, e: 2 },
  { t: 4.3, k: "nav", z: 1.45, e: 2 },
  { t: 5.0, k: "nav", z: 1.45, e: 0 },
  { t: 6.1, k: "wide", z: 1.09, e: 2 },
  { t: 7.35, k: "badge", z: 1.5, e: 2 },
  { t: 8.1, k: "badge", z: 1.5, e: 1 },
  { t: 8.8, k: "f12", z: 1.44, e: 1 },
  { t: 11.0, k: "flow", z: 1.36, e: 1 },
  { t: 12.4, k: "wide", z: 1.0, e: 2 },
  { t: LOOP, k: "wide", z: 1.0, e: 0 },
];

/* The pointer is drawn at CUR_W × CUR_H and pivots on the arrow tip, so the
   tip — not the bounding box — is what lands on a target. */
const CUR_W = 24;
const CUR_H = 29;
const TIP_X = (3 * CUR_W) / 20;
const TIP_Y = (1.8 * CUR_H) / 24;

const PARK = { x: 690, y: 452 };

const CUR: CurKey[] = [
  { t: 0.0, k: "park" },
  { t: 3.2, k: "park", e: 0 },
  { t: 4.35, k: "prep", e: 2 },
  { t: 6.0, k: "prep", e: 0 },
  { t: 7.3, k: "chev", e: 2 },
  { t: 7.62, k: "chev", e: 0 },
  { t: 8.25, k: "chev2", e: 1 },
  { t: 9.7, k: "chev2", e: 0 },
  { t: 10.5, k: "act", e: 2 },
  { t: LOOP, k: "act", e: 0 },
];

const CLICKS = [
  { t: 4.45, k: "prep" },
  { t: 7.4, k: "chev" },
];

/* Seeded from the drawn layout so the camera and pointer aim sensibly before
   (or instead of) measurement; `measure()` replaces these. */
const SEED: Rects = {
  wide: { x: 0, y: 0, w: W, h: H },
  book: { x: 182, y: 118, w: 378, h: 112 },
  nav: { x: 8, y: 46, w: 132, h: 110 },
  prep: { x: 8, y: 100, w: 132, h: 25 },
  badge: { x: 634, y: 334, w: 92, h: 18 },
  chev: { x: 700, y: 334, w: 18, h: 18 },
  chev2: { x: 700, y: 214, w: 18, h: 18 },
  act: { x: 600, y: 258, w: 108, h: 22 },
  f12: { x: 194, y: 250, w: 520, h: 76 },
  flow: { x: 194, y: 326, w: 520, h: 110 },
};

/**
 * The five findings, worst first — the order `checkup()` puts them in.
 *
 * Red is what a shop would refuse, amber is what only costs you readers, which
 * is the same ladder the app uses and the distinction the section beside this
 * is about. Each carries the control that fixes it, because that pairing is
 * the thing being claimed.
 */
const FINDINGS = [
  {
    tone: "red",
    text: "There is nothing in the book to publish yet.",
    action: "Open the book",
  },
  {
    tone: "amber",
    text: "No ISBN. Amazon assigns its own, but Apple, Kobo and most aggregators want one.",
    action: "Set the ISBN",
  },
  {
    tone: "amber",
    text: "No blurb. This is the text a shop shows under the cover.",
    action: "Work on the blurb",
  },
  {
    tone: "amber",
    text: "No categories. These decide which shelf the book turns up on.",
    action: "Choose categories",
  },
  {
    tone: "amber",
    text: "No publisher. Your own name is the usual answer when self-publishing.",
    action: "Set the publisher",
  },
] as const;

const LABEL =
  "An animated recreation of the OpenChapter dashboard. It opens on the book The Salt Road, " +
  "then a pointer clicks Prepare in the sidebar, where two books each carry a readiness badge: two " +
  "things worth doing, and one to fix with four more. The pointer then opens the second book's row, " +
  "revealing five findings — nothing in the book to publish yet, no ISBN, no blurb, no categories, " +
  "no publisher — and each finding carries the control that fixes it.";

/* ------------------------------ math ------------------------------ */
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}
function ramp(t: number, a: number, b: number) {
  return clamp((t - a) / (b - a), 0, 1);
}
function easeSine(u: number) {
  return 0.5 - Math.cos(Math.PI * clamp(u, 0, 1)) / 2;
}
function easeCubic(u: number) {
  const x = clamp(u, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeOutCubic(u: number) {
  return 1 - Math.pow(1 - clamp(u, 0, 1), 3);
}
function centerOf(r: Rect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}
function segment<T extends { t: number }>(list: T[], t: number) {
  let i = 0;
  while (i < list.length - 2 && t >= list[i + 1]!.t) i++;
  return i;
}
function easedU(a: { t: number }, b: { t: number; e?: number }, t: number) {
  const u = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
  return b.e === 2 ? easeCubic(u) : b.e === 1 ? easeSine(u) : clamp(u, 0, 1);
}

/**
 * A pushed-in frame still has to contain what it is aiming at, so the authored
 * zoom is capped by what actually fits the measured target — a rect that grew
 * (longer text, a wrapped line) would otherwise be framed half off-screen.
 */
function zoomOf(key: CamKey, rects: Rects) {
  if (key.k === "wide") return key.z;
  const r = rects[key.k]!;
  return Math.min(key.z, Math.max(1, Math.min(W / (r.w + 24), H / (r.h + 24))));
}
function camAt(t: number, rects: Rects) {
  const i = segment(CAM, t);
  const a = CAM[i]!;
  const b = CAM[i + 1]!;
  const e = easedU(a, b, t);
  const ca = centerOf(rects[a.k]!);
  const cb = centerOf(rects[b.k]!);
  return {
    cx: lerp(ca.x, cb.x, e),
    cy: lerp(ca.y, cb.y, e),
    s: lerp(zoomOf(a, rects), zoomOf(b, rects), e),
  };
}

/* The pointer travels on a shallow arc — a straight line reads as a tween, a
   slight bow reads as a hand. */
function pointOf(k: string, rects: Rects) {
  if (k === "park") return PARK;
  return centerOf(rects[k]!);
}
function curAt(t: number, rects: Rects) {
  const i = segment(CUR, t);
  const a = CUR[i]!;
  const b = CUR[i + 1]!;
  const e = easedU(a, b, t);
  const pa = pointOf(a.k, rects);
  const pb = pointOf(b.k, rects);
  const x = lerp(pa.x, pb.x, e);
  const y = lerp(pa.y, pb.y, e);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 60) return { x, y };
  const bow = Math.min(d * 0.11, 44) * Math.sin(Math.PI * e);
  return { x: x + (dy / d) * bow, y: y - (dx / d) * bow };
}

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The nearest scrolling ancestor, or null for the viewport.
 *
 * Same reason as in `store-listing-demo.tsx`: this page owns its own scrolling
 * (`<body>` is `overflow-hidden` for the editor shell), so the element that
 * moves under the reader is a `div` rather than the document.
 */
function scrollParent(el: Element | null): Element | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return null;
}

/* ------------------------------ icons ------------------------------ */
const PATHS = {
  grid: "M4 4h6v6H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 14h6v6H4z",
  pencil: "M4 20l4.5-1.2L19 8.3l-3.3-3.3L5.2 15.5zM14.5 5.8l3.7 3.7",
  archive: "M3 6.5h18v3.5H3zM5 10v10h14V10M9.5 14h5",
  chart: "M4 18.5l5.2-6 3.8 2.8L20 7",
  tools: "M3.5 9.5h17V20h-17zM8.5 9.5V6h7v3.5M3.5 14h17",
  // Community wears the globe, because two people is Collaborators' mark in the
  // app and this figure is a picture of that sidebar. The two-people path that
  // used to sit here went with the swap: the row it would now belong to is
  // Collaborators, which this figure does not draw.
  globe:
    "M12 21a9 9 0 100-18 9 9 0 000 18M3 12h18M12 3a13.8 13.8 0 013.6 9 13.8 13.8 0 01-3.6 9 13.8 13.8 0 01-3.6-9 13.8 13.8 0 013.6-9z",
  help: "M12 21a9 9 0 100-18 9 9 0 000 18M9.4 9.4a2.7 2.7 0 015.3.7c0 1.8-2.7 2.2-2.7 4M12 17.3v.1",
  chat: "M4 5h16v10.5H9.5L4 19.5z",
  send: "M3 11.2L21 4l-7.2 17-2.9-6.9z",
  tag: "M4 4.5h7l9 9-6.5 6.5-9.5-9.5zM8.3 8.8v.1",
  search: "M10.6 17.2a6.6 6.6 0 100-13.2 6.6 6.6 0 000 13.2M15.4 15.4L20 20",
  book: "M12 6.4C10 5 7.2 4.4 4 4.4v12.9c3.2 0 6 .6 8 2 2-1.4 4.8-2 8-2V4.4c-3.2 0-6 .6-8 2M12 6.4v12.9",
  compass: "M12 21a9 9 0 100-18 9 9 0 000 18M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z",
  chev: "M9.5 5l7 7-7 7",
  plus: "M12 5.5v13M5.5 12h13",
  arrow: "M4 12h14.5M13 6.5l6 5.5-6 5.5",
  x: "M6.8 6.8l10.4 10.4M17.2 6.8L6.8 17.2",
  bang: "M12 5.4v8.2M12 17.6v.2",
  caret: "M6 9.5l6 6 6-6",
} as const;

function Ico({
  name,
  size = 13,
  color = "var(--color-lp-body)",
  sw = 1.7,
}: {
  name: keyof typeof PATHS;
  size?: number;
  color?: string;
  sw?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ display: "block", flex: "0 0 auto" }}
    >
      <path
        d={PATHS[name]}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------- book covers ----------------------------
 *
 * Drawn, and deliberately abstract: shapes and title bars rather than
 * lettering. A figure on this page must not carry a picture of a book that
 * does not exist and must not carry a generated one — see the note at the top.
 * ------------------------------------------------------------------- */
function Cover({ kind, w }: { kind: "salt" | "tide"; w: number }) {
  const h = Math.round((w * 88) / 62);
  const shared = {
    display: "block" as const,
    borderRadius: 2,
    boxShadow: "0 1px 3px rgba(15,15,16,.22)",
  };
  if (kind === "salt") {
    return (
      <svg viewBox="0 0 62 88" width={w} height={h} style={shared}>
        <rect x="0" y="0" width="62" height="88" fill="#1e3a4c" />
        <circle cx="31" cy="49" r="8" fill="#e6b177" />
        <path d="M0 57 Q31 50 62 57 L62 88 L0 88 Z" fill="#142936" />
        <path d="M0 68 Q31 62 62 68 L62 88 L0 88 Z" fill="#0d1e29" />
        <rect x="11" y="13" width="40" height="3" rx="1.5" fill="#f1e8d8" opacity=".9" />
        <rect x="11" y="20" width="26" height="3" rx="1.5" fill="#f1e8d8" opacity=".55" />
        <rect x="11" y="77" width="18" height="2" rx="1" fill="#f1e8d8" opacity=".7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 62 88" width={w} height={h} style={shared}>
      <rect x="0" y="0" width="62" height="88" fill="#d2601f" />
      <circle cx="31" cy="52" r="19" fill="#e88a3d" />
      <circle cx="31" cy="52" r="9" fill="#f4b072" />
      <rect x="12" y="12" width="38" height="3" rx="1.5" fill="#ffffff" opacity=".9" />
      <rect x="12" y="19" width="24" height="3" rx="1.5" fill="#ffffff" opacity=".6" />
      <rect x="12" y="76" width="20" height="2" rx="1" fill="#ffffff" opacity=".75" />
    </svg>
  );
}

/* ------------------------------ sidebar ------------------------------ */
function NavRow({
  icon,
  label,
  soon,
  on,
}: {
  icon: keyof typeof PATHS;
  label: string;
  soon?: boolean;
  on?: boolean;
}) {
  return (
    <div
      style={{
        height: 25,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 9px",
        borderRadius: 7,
      }}
    >
      <Ico name={icon} size={13} color={on ? "var(--color-lp-accent)" : "var(--color-lp-body)"} />
      <span
        style={{
          fontSize: 11,
          fontWeight: on ? 600 : 500,
          color: on ? "var(--color-lp-accent)" : "var(--color-lp-soft)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {soon ? (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--color-lp-faint)",
            background: "var(--color-lp-tint)",
            border: "1px solid var(--color-lp-edge)",
            borderRadius: 4,
            padding: "2px 4px",
            lineHeight: 1,
          }}
        >
          SOON
        </span>
      ) : null}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--color-lp-edge)", margin: "0 14px" }} />;
}

/* ------------------------------ phase rail ------------------------------ */
function Ring({ pct, lit }: { pct: number; lit?: boolean }) {
  const c = 2 * Math.PI * 8.2;
  return (
    <svg viewBox="0 0 22 22" width={20} height={20} style={{ display: "block" }}>
      <circle cx="11" cy="11" r="8.2" fill="none" stroke="var(--color-lp-edge)" strokeWidth="2" />
      {pct > 0 ? (
        <circle
          cx="11"
          cy="11"
          r="8.2"
          fill="none"
          stroke="var(--color-lp-accent-text)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c * pct + " " + c}
          transform="rotate(-90 11 11)"
        />
      ) : null}
      {lit ? <circle cx="11" cy="11" r="2.4" fill="var(--color-lp-accent-text)" opacity=".18" /> : null}
    </svg>
  );
}

/**
 * The five phases, in the order and under the labels `roadmap.ts` gives them.
 *
 * Written out rather than imported: this is a client component and the labels
 * are five short strings, where the module they come from would drag the whole
 * step list into a marketing bundle. They are checked by eye against `PHASES`,
 * and the section around this figure quotes that module directly.
 */
function PhaseRail() {
  const stations = [
    { label: "Write", pct: 0.26, lit: true },
    { label: "Revise", pct: 0 },
    { label: "Prepare", pct: 0.08 },
    { label: "Before you publish", pct: 0 },
    { label: "Publish", pct: 0 },
  ];
  return (
    <div style={{ position: "relative", padding: "16px 14px 14px" }}>
      <div style={{ position: "relative", display: "flex" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 10,
              left: "calc(" + (i + 0.5) * 20 + "% + 14px)",
              width: "calc(20% - 28px)",
              height: 1,
              background: "var(--color-lp-edge)",
            }}
          />
        ))}
        {stations.map((s) => (
          <div
            key={s.label}
            style={{
              flex: "1 1 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
              minWidth: 0,
            }}
          >
            <Ring pct={s.pct} lit={s.lit} />
            <span
              style={{
                fontSize: 9.5,
                fontWeight: s.lit ? 600 : 500,
                color: s.lit ? "var(--color-lp-ink)" : "var(--color-lp-faint)",
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ small parts ------------------------------ */
function Chip({ icon, label }: { icon: keyof typeof PATHS; label: string }) {
  return (
    <div
      style={{
        height: 24,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 10px",
        borderRadius: 7,
        background: "var(--color-lp-ground)",
        border: "1px solid var(--color-lp-edge)",
        boxShadow: "0 1px 1px rgba(15,15,16,.03)",
      }}
    >
      <Ico name={icon} size={12} color="var(--color-lp-body)" />
      <span
        style={{ fontSize: 10.5, fontWeight: 500, color: "var(--color-lp-ink)", whiteSpace: "nowrap" }}
      >
        {label}
      </span>
    </div>
  );
}

function Stat({ tone, label }: { tone: "red" | "amber"; label: string }) {
  const red = tone === "red";
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        color: red ? "var(--color-stop-fg)" : "var(--color-note-fg)",
        background: red ? "var(--color-stop-bg)" : "var(--color-note-bg)",
        border: "1px solid " + (red ? "var(--color-stop-line)" : "var(--color-note-line)"),
        borderRadius: 6,
        padding: "4px 7px",
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------------ overview panel ------------------------------ */
function OverviewPanel() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "18px 20px 0",
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          fontSize: 21,
          fontWeight: 700,
          color: "var(--color-lp-ink)",
          letterSpacing: "-0.015em",
          lineHeight: 1,
        }}
      >
        Overview
      </div>
      <div style={{ marginTop: 9, fontSize: 11, color: "var(--color-lp-body)" }}>
        What stands between your book and a shop, and what to do about it.
      </div>

      <div
        style={{
          marginTop: 14,
          background: "var(--color-lp-ground)",
          border: "1px solid var(--color-lp-edge)",
          borderRadius: 10,
          boxShadow: "0 1px 2px rgba(15,15,16,.04)",
        }}
      >
        <div style={{ display: "flex", gap: 16, padding: "14px 14px 12px" }}>
          <span data-cam="cover" style={{ display: "block", flex: "0 0 auto" }}>
            <Cover kind="salt" w={62} />
          </span>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    color: "var(--color-lp-faint)",
                  }}
                >
                  DRAFTING
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 16.5,
                    fontWeight: 700,
                    color: "var(--color-lp-ink)",
                    letterSpacing: "-0.015em",
                  }}
                >
                  The Salt Road
                </div>
                <div style={{ marginTop: 5, fontSize: 10.5, color: "var(--color-lp-faint)" }}>
                  1 chapter · 0 words · opened 3 minutes ago
                </div>
              </div>
              <Chip icon="caret" label="Change book" />
            </div>

            <div
              style={{
                marginTop: 12,
                maxWidth: 362,
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-lp-ink)" }}>
                0% of target
              </span>
              <span style={{ fontSize: 10.5, color: "var(--color-lp-faint)" }}>0 of 10,000</span>
            </div>
            <div
              style={{
                marginTop: 6,
                maxWidth: 362,
                height: 4,
                borderRadius: 2,
                background: "var(--color-lp-edge)",
              }}
            />

            <div data-cam="btns" style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <Chip icon="pencil" label="Open book" />
              <Chip icon="book" label="Read" />
              <Chip icon="compass" label="What to do next" />
              <div
                style={{
                  height: 24,
                  width: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2.5,
                  borderRadius: 7,
                  background: "var(--color-lp-ground)",
                  border: "1px solid var(--color-lp-edge)",
                }}
              >
                <span style={{ width: 2.5, height: 2.5, borderRadius: 2, background: "var(--color-lp-body)" }} />
                <span style={{ width: 2.5, height: 2.5, borderRadius: 2, background: "var(--color-lp-body)" }} />
                <span style={{ width: 2.5, height: 2.5, borderRadius: 2, background: "var(--color-lp-body)" }} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--color-lp-edge)" }} />
        <PhaseRail />

        <div style={{ padding: "0 14px 14px" }}>
          <div
            style={{
              height: 36,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "0 8px 0 14px",
              borderRadius: 8,
              background: "var(--color-lp-tint)",
            }}
          >
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "var(--color-lp-body)",
              }}
            >
              NEXT
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-lp-ink)" }}>
              Start the draft
            </span>
            <span style={{ flex: "1 1 auto" }} />
            <span
              style={{
                height: 22,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 10px",
                borderRadius: 6,
                background: "var(--color-lp-accent)",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-lp-accent-ink)" }}>Do this</span>
              <Ico name="arrow" size={11} color="var(--color-lp-accent-ink)" sw={2} />
            </span>
            <span style={{ fontSize: 9.5, color: "var(--color-lp-faint)" }}>1 of 18</span>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--color-lp-edge)" }} />
        <div style={{ padding: "12px 14px 0" }}>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: "0.09em",
              color: "var(--color-lp-faint)",
            }}
          >
            GET IT OUT
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--color-lp-body)" }}>
            The parts a shop sees.
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
            {["Cover", "Blurb", "Categories"].map((t) => (
              <div
                key={t}
                style={{
                  flex: "1 1 0",
                  height: 58,
                  borderRadius: 8,
                  background: "var(--color-lp-raised)",
                  border: "1px solid var(--color-lp-edge)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                <span
                  style={{ width: 16, height: 16, borderRadius: 8, border: "1.6px solid var(--color-lp-edge)" }}
                />
                <span style={{ fontSize: 9.5, fontWeight: 500, color: "var(--color-lp-faint)" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ prepare panel ------------------------------ */
function BookRow({
  kind,
  title,
  note,
  tone,
  badge,
  open,
  innerRef,
  hoverRef,
}: {
  kind: "salt" | "tide";
  title: string;
  note: string;
  tone: "red" | "amber";
  badge: string;
  open?: boolean;
  innerRef?: (el: HTMLDivElement | null) => void;
  hoverRef?: (el: HTMLSpanElement | null) => void;
}) {
  // Only the collapsed copy of the row is a camera target: both panels are in
  // the DOM at once (one at opacity 0), so without this the measurer would
  // find two elements answering to the same name.
  const marked = !!innerRef && !open;
  return (
    <div
      ref={innerRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "9px 10px",
        borderRadius: open ? "8px 8px 0 0" : 8,
        background: "var(--color-lp-raised)",
      }}
    >
      <Cover kind={kind} w={26} />
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: "var(--color-lp-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--color-lp-body)" }}>{note}</div>
      </div>
      <span data-cam={marked ? "badge" : undefined} style={{ display: "block", flex: "0 0 auto" }}>
        <Stat tone={tone} label={badge} />
      </span>
      <span
        data-cam={marked ? "chev" : open ? "chev2" : undefined}
        style={{
          position: "relative",
          width: 19,
          height: 19,
          flex: "0 0 auto",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: open ? "rotate(90deg)" : "none",
        }}
      >
        <span
          ref={hoverRef}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            background: "var(--color-lp-edge)",
            opacity: 0,
          }}
        />
        <span style={{ position: "relative" }}>
          <Ico name="chev" size={13} color="var(--color-lp-faint)" sw={2} />
        </span>
      </span>
    </div>
  );
}

function Finding({
  tone,
  text,
  action,
  first,
  innerRef,
}: {
  tone: "red" | "amber";
  text: string;
  action: string;
  first?: boolean;
  innerRef?: (el: HTMLDivElement | null) => void;
}) {
  const red = tone === "red";
  /*
   * A status is two tokens, not one, and which is which decides legibility.
   *
   * `-fg` is the *text* colour and crosses over between the themes: #b91c1c
   * reads on white and disappears on black, so the dark set answers with a
   * light red. `-solid` is the *fill*, and keeps one value in both, because a
   * block carrying white text has the same job whatever is behind it. Using
   * the text colour as a fill gives a pale block with white on it at night,
   * which is the failure this pair exists to prevent.
   */
  const ink = red ? "var(--color-stop-fg)" : "var(--color-note-fg)";
  const fill = red ? "var(--color-stop-solid)" : "var(--color-note-solid)";
  return (
    <div
      ref={innerRef}
      style={{
        minHeight: 32,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "5px 5px 5px 8px",
        borderRadius: 8,
        background: red ? "var(--color-stop-bg)" : "var(--color-note-bg)",
        border: "1px solid " + (red ? "var(--color-stop-line)" : "var(--color-note-line)"),
        willChange: "transform, opacity",
      }}
    >
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          background: fill,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
        }}
      >
        <Ico name={red ? "x" : "bang"} size={10} color="var(--color-lp-accent-ink)" sw={2.6} />
      </span>
      <span
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.35,
          color: ink,
        }}
      >
        {text}
      </span>
      {/* The control that fixes it, on the problem — the whole claim. */}
      <span
        data-cam={first ? "act" : undefined}
        style={{
          height: 22,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 9px",
          borderRadius: 6,
          background: fill,
          flex: "0 0 auto",
        }}
      >
        <span
          style={{ fontSize: 10, fontWeight: 700, color: "var(--color-lp-accent-ink)", whiteSpace: "nowrap" }}
        >
          {action}
        </span>
        <Ico name="arrow" size={11} color="var(--color-lp-accent-ink)" sw={2} />
      </span>
    </div>
  );
}

function PreparePanel({
  mode,
  rowRef,
  chevHoverRef,
  bannerRef,
}: {
  mode: "collapsed" | "expanded";
  rowRef?: (el: HTMLDivElement | null) => void;
  chevHoverRef?: (el: HTMLSpanElement | null) => void;
  bannerRef?: (i: number, el: HTMLDivElement | null) => void;
}) {
  const open = mode === "expanded";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "18px 20px 0",
        overflow: "hidden",
        willChange: "transform, opacity",
      }}
    >
      {/* Opened, the row grows past the bottom of the screen, so the whole page
          rides up rather than the findings being cut off. */}
      <div style={{ marginTop: open ? -128 : 0 }}>
        <div
          style={{
            fontSize: 21,
            fontWeight: 700,
            color: "var(--color-lp-ink)",
            letterSpacing: "-0.015em",
            lineHeight: 1,
          }}
        >
          Prepare
        </div>
        <div style={{ marginTop: 9, fontSize: 11, color: "var(--color-lp-body)" }}>
          Get it out without paying to find out what was wrong.
        </div>

        <div
          style={{
            marginTop: 14,
            background: "var(--color-lp-ground)",
            border: "1px solid var(--color-lp-edge)",
            borderRadius: 10,
            padding: "13px 14px 14px",
            boxShadow: "0 1px 2px rgba(15,15,16,.04)",
          }}
        >
          <div style={{ fontSize: 11.5, color: "var(--color-lp-ink)" }}>
            <span style={{ fontWeight: 700 }}>1 of 2</span> books have their listing details
            in order.
          </div>
          <div
            style={{
              marginTop: 7,
              fontSize: 10.5,
              lineHeight: 1.5,
              color: "var(--color-lp-body)",
              maxWidth: 520,
            }}
          >
            Title, author, cover and something to publish — the things a shop checks before it
            looks at the file. Open a book to run the rest, which has to read the manuscript.
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            background: "var(--color-lp-ground)",
            border: "1px solid var(--color-lp-edge)",
            borderRadius: 10,
            padding: "13px 14px 14px",
            boxShadow: "0 1px 2px rgba(15,15,16,.04)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--color-lp-ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Check and export
          </div>
          <div
            style={{
              marginTop: 7,
              fontSize: 10.5,
              lineHeight: 1.5,
              color: "var(--color-lp-body)",
              maxWidth: 520,
            }}
          >
            The check names what a shop would refuse and which problems would actually stop the
            upload. It never blocks your export — the file is yours whether or not a shop would
            take it.
          </div>

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <BookRow
              kind="tide"
              title="Low Tide"
              note="No ISBN. Amazon assigns its own, but Apple, Kobo and most aggregators want one."
              tone="amber"
              badge="2 worth doing"
            />
            <div>
              <BookRow
                kind="salt"
                title="The Salt Road"
                note="There is nothing in the book to publish yet."
                tone="red"
                badge="1 to fix · 4 more"
                open={open}
                innerRef={rowRef}
                hoverRef={chevHoverRef}
              />
              {open ? (
                <div
                  style={{
                    background: "var(--color-lp-raised)",
                    borderRadius: "0 0 8px 8px",
                    padding: "4px 12px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {FINDINGS.map((f, i) => (
                    <Finding
                      key={f.action}
                      tone={f.tone}
                      text={f.text}
                      action={f.action}
                      first={i === 0}
                      innerRef={bannerRef ? (el) => bannerRef(i, el) : undefined}
                    />
                  ))}
                  <div
                    style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-lp-accent)" }}>
                      Check and export this book
                    </span>
                    <Ico name="arrow" size={12} color="var(--color-lp-accent-text)" sw={2} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ the figure ------------------------------ */
export function CheckDemo() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const navHovRef = useRef<HTMLDivElement | null>(null);
  const chevHovRef = useRef<HTMLSpanElement | null>(null);
  const navOvRef = useRef<HTMLDivElement | null>(null);
  const navPrRef = useRef<HTMLDivElement | null>(null);
  const ovRef = useRef<HTMLDivElement | null>(null);
  const colRef = useRef<HTMLDivElement | null>(null);
  const expRef = useRef<HTMLDivElement | null>(null);
  const rowElRef = useRef<HTMLDivElement | null>(null);
  const curRef = useRef<HTMLDivElement | null>(null);
  const ripRef = useRef<HTMLDivElement | null>(null);
  const bannerEls = useRef<(HTMLDivElement | null)[]>([]);
  const rectsRef = useRef<Rects>(SEED);
  const tRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* --- one frame; every animated property is transform or opacity --- */
  const paint = useCallback((t: number, parked: boolean) => {
    const put = (el: HTMLElement | null, o: number, y: number) => {
      if (!el) return;
      el.style.opacity = String(o);
      el.style.transform = "translate3d(0," + y.toFixed(2) + "px,0)";
    };

    let s = 1;
    let tx = 0;
    let ty = 0;
    if (!parked) {
      const c = camAt(t, rectsRef.current);
      s = c.s;
      tx = clamp(W / 2 - c.cx * s, W * (1 - s), 0);
      ty = clamp(H / 2 - c.cy * s, H * (1 - s), 0);
    }
    if (camRef.current) {
      camRef.current.style.transform = parked
        ? "none"
        : "translate3d(" +
          tx.toFixed(2) +
          "px," +
          ty.toFixed(2) +
          "px,0) scale(" +
          s.toFixed(4) +
          ")";
    }

    /* overview: out on the Prepare click, back in to close the loop */
    const ovOut = easeSine(ramp(t, 4.5, 5.05));
    const ovIn = easeSine(ramp(t, 11.6, 12.2));
    const ovO = t < 11.55 ? 1 - ovOut : ovIn;
    put(ovRef.current, ovO, t < 11.55 ? -18 * ovOut : lerp(-14, 0, ovIn));

    /* prepare, collapsed */
    const colIn = easeSine(ramp(t, 4.52, 5.1));
    const colOut = easeSine(ramp(t, 7.5, 8.05));
    put(colRef.current, colIn * (1 - colOut), lerp(lerp(16, 0, colIn), -26, colOut));

    /* prepare, expanded */
    const expIn = easeSine(ramp(t, 7.55, 8.1));
    const expOut = easeSine(ramp(t, 11.6, 12.15));
    put(expRef.current, expIn * (1 - expOut), lerp(lerp(26, 0, expIn), 14, expOut));

    /* sidebar selection */
    const sel = easeCubic(t < 11.55 ? ramp(t, 4.5, 5.0) : 1 - ramp(t, 11.6, 12.1));
    if (pillRef.current)
      pillRef.current.style.transform = "translate3d(0," + (sel * 54).toFixed(2) + "px,0)";
    if (navOvRef.current) navOvRef.current.style.opacity = String(1 - sel);
    if (navPrRef.current) navPrRef.current.style.opacity = String(sel);

    /* hover affordances, in just before each click */
    if (navHovRef.current)
      navHovRef.current.style.opacity = String(ramp(t, 4.15, 4.35) * (1 - ramp(t, 4.5, 4.7)));
    if (chevHovRef.current)
      chevHovRef.current.style.opacity = String(ramp(t, 7.1, 7.3) * (1 - ramp(t, 7.45, 7.65)));

    /* findings, staggered top to bottom */
    for (let i = 0; i < bannerEls.current.length; i++) {
      const u = easeOutCubic(ramp(t, 7.75 + i * 0.11, 8.17 + i * 0.11));
      put(bannerEls.current[i] ?? null, u, lerp(16, 0, u));
    }

    /* pointer + click ripple, drawn over the screen in screen space */
    const cur = curRef.current;
    const rip = ripRef.current;
    if (parked) {
      if (cur) cur.style.opacity = "0";
      if (rip) rip.style.opacity = "0";
      return;
    }
    if (cur) {
      const p = curAt(t, rectsRef.current);
      let press = 1;
      for (const c of CLICKS) {
        if (t >= c.t && t < c.t + 0.26) {
          const d = t < c.t + 0.09 ? ramp(t, c.t, c.t + 0.09) : 1 - ramp(t, c.t + 0.09, c.t + 0.26);
          press = 1 - 0.18 * easeSine(d);
        }
      }
      cur.style.opacity = String(
        easeSine(ramp(t, 2.6, 3.15)) * (1 - easeSine(ramp(t, 11.0, 11.5)))
      );
      const k = (1 + (s - 1) * 0.42) * press;
      cur.style.transform =
        "translate3d(" +
        (p.x * s + tx - TIP_X).toFixed(2) +
        "px," +
        (p.y * s + ty - TIP_Y).toFixed(2) +
        "px,0) scale(" +
        k.toFixed(3) +
        ")";
    }
    if (rip) {
      let o = 0;
      let k = 0.4;
      let px = 0;
      let py = 0;
      for (const c of CLICKS) {
        const u = ramp(t, c.t, c.t + 0.55);
        if (u > 0 && u < 1) {
          const at = centerOf(rectsRef.current[c.k]!);
          px = at.x * s + tx;
          py = at.y * s + ty;
          o = (1 - u) * 0.6;
          k = lerp(0.35, 1.75, easeOutCubic(u));
        }
      }
      rip.style.opacity = String(o);
      rip.style.transform =
        "translate3d(" + px.toFixed(2) + "px," + py.toFixed(2) + "px,0) scale(" + k.toFixed(3) + ")";
    }
  }, []);

  /* --- measure with the camera parked, back in design px --- */
  const measure = useCallback(() => {
    const cam = camRef.current;
    if (!cam) return;
    const animated: (HTMLElement | null)[] = [
      cam,
      ovRef.current,
      colRef.current,
      expRef.current,
      rowElRef.current,
      ...bannerEls.current,
    ];
    const saved = animated.map((el) => (el ? el.style.transform : ""));
    for (const el of animated) if (el) el.style.transform = "none";

    // The stage's own fit scale is still applied, so every read is divided by
    // it and the rects come back in the design's own units.
    const base = cam.getBoundingClientRect();
    const k = base.width > 0 ? base.width / W : 1;
    const read = (el: Element | null): Rect | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return null;
      return {
        x: (r.left - base.left) / k,
        y: (r.top - base.top) / k,
        w: r.width / k,
        h: r.height / k,
      };
    };
    const pick = (sel: string) => read(cam.querySelector(sel));

    const cover = pick('[data-cam="cover"]');
    const btns = pick('[data-cam="btns"]');
    const b0 = read(bannerEls.current[0] ?? null);
    const b1 = read(bannerEls.current[1] ?? null);
    const b2 = read(bannerEls.current[2] ?? null);
    const b4 = read(bannerEls.current[4] ?? null);

    rectsRef.current = {
      wide: SEED.wide!,
      book: cover && btns ? union(cover, btns) : SEED.book!,
      nav: pick('[data-cam="nav"]') ?? SEED.nav!,
      prep: pick('[data-cam="prep"]') ?? SEED.prep!,
      badge: pick('[data-cam="badge"]') ?? SEED.badge!,
      chev: pick('[data-cam="chev"]') ?? SEED.chev!,
      chev2: pick('[data-cam="chev2"]') ?? SEED.chev2!,
      act: pick('[data-cam="act"]') ?? SEED.act!,
      f12: b0 && b1 ? union(b0, b1) : SEED.f12!,
      flow: b2 && b4 ? union(b2, b4) : SEED.flow!,
    };

    animated.forEach((el, i) => {
      if (el) el.style.transform = saved[i]!;
    });
  }, []);

  /* --- fit the fixed design to the screen's width --- */
  useIso(() => {
    const screen = screenRef.current;
    const stage = stageRef.current;
    if (!screen || !stage) return;
    const apply = () => {
      stage.style.transform =
        "scale(" + (screen.getBoundingClientRect().width / W).toFixed(5) + ")";
    };
    apply();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", apply);
      return () => window.removeEventListener("resize", apply);
    }
    const ro = new ResizeObserver(() => {
      apply();
      measure();
    });
    ro.observe(screen);
    return () => ro.disconnect();
  }, [measure]);

  /* --- first paint, and again once the fonts settle and reflow it --- */
  useIso(() => {
    measure();
    paint(reduced ? 9.5 : 0, reduced);
    let alive = true;
    if (document.fonts) {
      document.fonts.ready.then(() => {
        if (!alive) return;
        measure();
        paint(reduced ? 9.5 : tRef.current, reduced);
      });
    }
    return () => {
      alive = false;
    };
  }, [measure, paint, reduced]);

  /* --- run only while on screen and while the tab is visible --- */
  useEffect(() => {
    if (reduced) {
      paint(9.5, true);
      return;
    }
    const host = hostRef.current;
    if (!host) return;

    let onScreen = false;
    let running = false;

    const tick = (ts: number) => {
      if (!running) return;
      const dt = lastRef.current ? Math.min((ts - lastRef.current) / 1000, 0.05) : 0;
      lastRef.current = ts;
      tRef.current = (tRef.current + dt) % LOOP;
      paint(tRef.current, false);
      rafRef.current = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true;
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
    const settle = () => {
      if (onScreen && !document.hidden) start();
      else stop();
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") {
      onScreen = true;
      settle();
    } else {
      io = new IntersectionObserver(
        (entries) => {
          onScreen = entries[0]!.isIntersecting;
          settle();
        },
        { root: scrollParent(host), threshold: 0.15 }
      );
      io.observe(host);
    }
    document.addEventListener("visibilitychange", settle);

    return () => {
      stop();
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", settle);
    };
  }, [paint, reduced]);

  const sel0 = reduced ? 54 : 0;

  return (
    // The page's one screen — see `app-window.tsx`. It was a tablet slab,
    // and so was the listing demo, and the hero was a bare card: three devices
    // on one page, which reads as three products.
    //
    // `label` is what marks this as a picture rather than a control: the frame
    // then takes `role="img"`, and everything drawn inside is hidden behind
    // that one description rather than read out as a hundred stray words.
    //
    // The screen keeps its own aspect ratio, because the stage inside is a
    // fixed design in `W × H` px scaled to whatever width the column gives it.
    // The frame's title bar sits *above* that box, so it changes the height of
    // the whole figure and nothing about the measurement inside — `screenRef`
    // still measures the glass, and every rect the pointer aims at is taken
    // relative to it.
    <AppWindow
      label={LABEL}
      hostRef={hostRef}
      screenRef={screenRef}
      screenStyle={{ aspectRatio: `${W} / ${H}` }}
      screenClassName="relative overflow-hidden bg-lp-ground"
    >
        <div
          ref={stageRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: H,
            transformOrigin: "0 0",
            fontSize: 12,
            lineHeight: 1.35,
            color: "var(--color-lp-ink)",
          }}
        >
          <div
            ref={camRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              transformOrigin: "0 0",
              willChange: "transform",
            }}
          >
            {/* sidebar */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 148,
                height: H,
                background: "var(--color-lp-ground)",
                borderRight: "1px solid var(--color-lp-edge)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "13px 14px 4px",
                  fontSize: 15.5,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                <span style={{ color: "var(--color-lp-ink)" }}>Open</span>
                {/* The landing page's wordmark, not the app's — this is a
                    drawing of the product on a marketing page, and it has to
                    match the mark in the header a few inches above it. */}
                <span style={{ color: "var(--color-lp-wordmark)" }}>Chapter</span>
              </div>

              <div data-cam="nav" style={{ position: "relative", padding: "8px 8px 0" }}>
                <div
                  ref={pillRef}
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    right: 8,
                    height: 25,
                    borderRadius: 7,
                    background: "var(--color-lp-tint)",
                    transform: "translate3d(0," + sel0 + "px,0)",
                  }}
                />
                <div
                  ref={navHovRef}
                  style={{
                    position: "absolute",
                    top: 62,
                    left: 8,
                    right: 8,
                    height: 25,
                    borderRadius: 7,
                    background: "var(--color-lp-raised)",
                    opacity: 0,
                  }}
                />
                <div
                  style={{ position: "relative", display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {/* Each selectable row is drawn twice and cross-faded, so
                      "selected" costs an opacity rather than a repaint. */}
                  <div style={{ position: "relative" }}>
                    <NavRow icon="grid" label="Overview" />
                    <div
                      ref={navOvRef}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        opacity: reduced ? 0 : 1,
                      }}
                    >
                      <NavRow icon="grid" label="Overview" on />
                    </div>
                  </div>
                  <NavRow icon="pencil" label="Write" />
                  <div data-cam="prep" style={{ position: "relative" }}>
                    <NavRow icon="archive" label="Prepare" />
                    <div
                      ref={navPrRef}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        opacity: reduced ? 1 : 0,
                      }}
                    >
                      <NavRow icon="archive" label="Prepare" on />
                    </div>
                  </div>
                  <NavRow icon="chart" label="Track" />
                </div>
              </div>

              <div style={{ padding: "12px 0" }}>
                <Divider />
              </div>

              <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
                <NavRow icon="tools" label="Tools" />
                {/* Not built, and saying so on the real screen too. */}
                <NavRow icon="globe" label="Community" soon />
              </div>

              <div style={{ flex: "1 1 auto" }} />

              <div
                style={{ padding: "0 8px 12px", display: "flex", flexDirection: "column", gap: 2 }}
              >
                <NavRow icon="help" label="Help" />
                <NavRow icon="chat" label="Support" />
                <NavRow icon="send" label="Send feedback" />
                <NavRow icon="tag" label="Pricing" />
              </div>

              <Divider />

              <div
                style={{
                  padding: "10px 12px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    background: "var(--color-lp-edge)",
                    color: "var(--color-lp-soft)",
                    fontSize: 10,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                  }}
                >
                  E
                </span>
                <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                  {/* The same imaginary writer the listing form is filled in
                      for, so the two figures are one person's library. */}
                  <span
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--color-lp-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Elena Rosa
                  </span>
                  <span style={{ display: "block", fontSize: 9, color: "var(--color-lp-faint)" }}>Pro plan</span>
                </span>
                <span style={{ display: "flex", gap: 2 }}>
                  <span style={{ width: 2.5, height: 2.5, borderRadius: 2, background: "var(--color-lp-faint)" }} />
                  <span style={{ width: 2.5, height: 2.5, borderRadius: 2, background: "var(--color-lp-faint)" }} />
                  <span style={{ width: 2.5, height: 2.5, borderRadius: 2, background: "var(--color-lp-faint)" }} />
                </span>
              </div>
            </div>

            {/* top bar */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 148,
                width: W - 148,
                height: 42,
                background: "var(--color-lp-ground)",
                borderBottom: "1px solid var(--color-lp-edge)",
                display: "flex",
                alignItems: "center",
                padding: "0 14px 0 16px",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 250,
                  height: 23,
                  borderRadius: 7,
                  background: "var(--color-lp-raised)",
                  border: "1px solid var(--color-lp-edge)",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "0 6px 0 8px",
                }}
              >
                <Ico name="search" size={11} color="var(--color-lp-faint)" />
                <span style={{ flex: "1 1 auto", fontSize: 10.5, color: "var(--color-lp-faint)" }}>
                  Search your books
                </span>
                <span
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 3,
                    background: "var(--color-lp-tint)",
                    border: "1px solid var(--color-lp-edge)",
                    fontSize: 8,
                    color: "var(--color-lp-faint)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  /
                </span>
              </div>
              <span style={{ flex: "1 1 auto" }} />
              <div
                style={{
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 7,
                  background: "var(--color-lp-accent)",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px" }}
                >
                  <Ico name="plus" size={11} color="var(--color-lp-accent-ink)" sw={2.2} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-lp-accent-ink)" }}>New book</span>
                </span>
                <span style={{ width: 1, height: 24, background: "rgba(255,255,255,.24)" }} />
                <span style={{ display: "flex", alignItems: "center", padding: "0 6px" }}>
                  <Ico name="caret" size={11} color="var(--color-lp-ground)" sw={2.2} />
                </span>
              </div>
            </div>

            {/* panel */}
            <div
              style={{
                position: "absolute",
                top: 42,
                left: 148,
                width: W - 148,
                height: H - 42,
                background: "var(--color-lp-raised)",
                overflow: "hidden",
              }}
            >
              <div
                ref={ovRef}
                style={{ position: "absolute", inset: 0, opacity: reduced ? 0 : 1 }}
              >
                <OverviewPanel />
              </div>
              <div
                ref={colRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  transform: "translate3d(0,16px,0)",
                }}
              >
                <PreparePanel
                  mode="collapsed"
                  rowRef={(el) => {
                    rowElRef.current = el;
                  }}
                  chevHoverRef={(el) => {
                    chevHovRef.current = el;
                  }}
                />
              </div>
              <div
                ref={expRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: reduced ? 1 : 0,
                  transform: reduced ? "translate3d(0,0,0)" : "translate3d(0,26px,0)",
                }}
              >
                <PreparePanel
                  mode="expanded"
                  bannerRef={(i, el) => {
                    bannerEls.current[i] = el;
                  }}
                />
              </div>
            </div>
          </div>

          {/* The ripple and the pointer sit above the screen rather than inside
              the camera, so a push does not scale the hand doing the pushing. */}
          <div
            ref={ripRef}
            style={{
              position: "absolute",
              top: -22,
              left: -22,
              width: 44,
              height: 44,
              borderRadius: 22,
              border: "2px solid var(--color-lp-accent)",
              opacity: 0,
              willChange: "transform, opacity",
            }}
          />
          <div
            ref={curRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              transformOrigin: TIP_X + "px " + TIP_Y + "px",
              opacity: 0,
              willChange: "transform, opacity",
            }}
          >
            <svg
              width={CUR_W}
              height={CUR_H}
              viewBox="0 0 20 24"
              style={{ display: "block", filter: "drop-shadow(0 1.5px 2px rgba(15,15,16,.4))" }}
            >
              <path
                d="M3 1.8L3 19.4L7.6 15.1L10.4 21.4L13.3 20.1L10.6 14L16.7 13.6Z"
                fill="var(--color-lp-ink)"
                stroke="var(--color-lp-ground)"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
    </AppWindow>
  );
}
