"use client";

import { useState } from "react";
import { AppWindow } from "@/components/landing/app-window";

/**
 * The dashboard, drawn, with a sidebar that works.
 *
 * **This is the hero's whole argument.** A visitor who has not signed up
 * cannot open the application, so the page either tells them what it is like
 * or shows them. Every earlier version of this hero showed one still of one
 * screen — true, but inert, and it opened on a chapter rather than on the
 * screen a writer actually lands on. This opens on the shelf and lets them
 * press: the five sections in the rail are the five the app has, and clicking
 * one changes the pane the way it does in the product.
 *
 * **What is real and what is drawn, because the line matters.** The
 * *navigation* is real — five sections, the counts consistent between the rail
 * and the panes, the addresses genuine routes. The *contents* are drawn: this
 * is markup at a fixed design mapped onto its container, the standing rule for
 * every figure on this page, which is what keeps it sharp at any width and
 * stops it going stale against a bitmap nobody re-shoots. Nothing here reads a
 * visitor's own library and nothing may be added that looks as though it does.
 *
 * **The demo library is not anybody's real one.** It reuses the three books
 * the rest of the page already draws, and the account chip is a placeholder.
 * A marketing page is a bad place for a real person's shelf, and the covers in
 * a real one are somebody else's artwork.
 *
 * **Everything is sized in `cqw` against a 1000px design**, the convention the
 * other drawn screens use — see the note on `W` in `mvp-screens.tsx`. The
 * container's width *is* the zoom, so the whole thing scales as one drawing
 * rather than reflowing into a small-screen layout it does not have.
 */

const W = 1000;

/** The demo shelf, drawn once and read by every pane so the counts agree. */
const BOOKS = [
  { title: "Breathe Again", author: "A. Nadeel", chapters: 12, words: 41208, spine: "#39405b", opened: "2 hours ago" },
  { title: "The Long Winter", author: "A. Nadeel", chapters: 8, words: 22740, spine: "#5b4a3f", opened: "yesterday" },
  { title: "Notes on a Quiet Year", author: "A. Nadeel", chapters: 3, words: 6180, spine: "#3f5b4f", opened: "last week" },
] as const;

const SECTIONS = [
  { id: "overview", label: "Overview", count: null, url: "openchapter.app/" },
  { id: "write", label: "Write", count: null, url: "openchapter.app/?area=write" },
  { id: "favourites", label: "Favourites", count: 1, url: "openchapter.app/?area=write" },
  { id: "archived", label: "Archived", count: 1, url: "openchapter.app/?area=write" },
  { id: "trash", label: "Trash", count: 2, url: "openchapter.app/?area=write" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const fmt = (n: number) => n.toLocaleString("en-GB");

export function DashboardDemo() {
  const [active, setActive] = useState<SectionId>("overview");
  const current = SECTIONS.find((s) => s.id === active)!;

  return (
    <AppWindow
      chrome={{ url: current.url }}
      screenStyle={{ aspectRatio: `${W} / 620` }}
      screenClassName="@container flex overflow-hidden bg-lp-tint leading-[1.35]"
    >
      {/* ---- The rail ------------------------------------------------- */}
      <aside className="flex w-[21cqw] shrink-0 flex-col border-r border-lp-line bg-lp-ground px-[1.6cqw] py-[1.8cqw]">
        <p className="px-[0.8cqw] text-[1.9cqw] font-bold tracking-tight text-lp-ink">
          Open<span className="text-lp-wordmark">Chapter</span>
        </p>

        {/* **The label, and it is not decoration.** A demo that looks exactly
            like the product is only honest while it says which it is — so the
            badge sits where the account's own state would sit, inside the
            drawing, and travels with every screenshot anyone takes of this
            page. It is the same device the reference this page follows uses,
            for the same reason: the shelf below is three invented books, and a
            visitor must never be left to wonder whether it is theirs. */}
        <span className="mt-[0.9cqw] ml-[0.8cqw] w-fit rounded-full bg-lp-raised px-[0.8cqw] py-[0.3cqw] text-[1cqw] font-medium text-lp-body">
          Demo data
        </span>

        <ul className="mt-[2.2cqw] space-y-[0.35cqw]">
          {SECTIONS.map((section) => {
            const on = section.id === active;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => setActive(section.id)}
                  className={`flex w-full items-center gap-[0.9cqw] rounded-[0.7cqw] px-[0.8cqw] py-[0.72cqw] text-left text-[1.32cqw] transition-colors ${
                    on
                      ? "bg-lp-accent/10 font-semibold text-lp-accent-text"
                      : "text-lp-body hover:bg-lp-raised"
                  }`}
                >
                  <Glyph name={section.id} />
                  <span className="flex-1">{section.label}</span>
                  {section.count !== null && (
                    <span className="text-[1.15cqw] text-lp-faint">
                      {section.count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="my-[1.5cqw] border-t border-lp-line" />

        <ul className="space-y-[0.35cqw]">
          {["Support", "Send feedback", "Pricing"].map((name) => (
            <li
              key={name}
              className="flex items-center gap-[0.9cqw] rounded-[0.7cqw] px-[0.8cqw] py-[0.72cqw] text-[1.32cqw] text-lp-body"
            >
              <Glyph name="dot" />
              {name}
            </li>
          ))}
        </ul>

        {/* The account chip, pinned to the foot the way the app pins it. */}
        <div className="mt-auto flex items-center gap-[0.8cqw] border-t border-lp-line pt-[1.2cqw]">
          <span className="flex h-[2.4cqw] w-[2.4cqw] items-center justify-center rounded-full bg-lp-raised text-[1.15cqw] font-semibold text-lp-body">
            A
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[1.2cqw] font-medium text-lp-ink">
              Your account
            </span>
            <span className="block text-[1.05cqw] text-lp-faint">Pro plan</span>
          </span>
        </div>
      </aside>

      {/* ---- The pane -------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The top bar: search on the left, the one filled action on the right. */}
        <div className="flex shrink-0 items-center gap-[1.2cqw] border-b border-lp-line bg-lp-ground px-[1.8cqw] py-[1.1cqw]">
          <span className="flex h-[2.9cqw] flex-1 items-center gap-[0.7cqw] rounded-[0.7cqw] border border-lp-line px-[0.9cqw] text-[1.2cqw] text-lp-faint">
            <Glyph name="search" />
            Search your books…
            <span className="ml-auto rounded-[0.35cqw] border border-lp-line px-[0.45cqw] text-[1cqw]">
              /
            </span>
          </span>
          <span className="flex h-[2.9cqw] items-center rounded-[0.7cqw] bg-lp-accent px-[1.2cqw] text-[1.2cqw] font-semibold text-lp-accent-ink">
            + New book
          </span>
        </div>

        {/* **It scrolls, and that is not a detail.** The window is cut by the
            hero's bottom edge, so without this a visitor sees the top of one
            pane and has no way to reach the rest — the demo would be a picture
            again. The app's own panes scroll here too, which is why the bar
            belongs inside the frame rather than on the page. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {active === "overview" && <Overview />}
          {active === "write" && <Write />}
          {active === "favourites" && <Favourites />}
          {active === "archived" && <Archived />}
          {active === "trash" && <Trash />}
        </div>
      </div>
    </AppWindow>
  );
}

/* ---- The five panes ------------------------------------------------- */

function Overview() {
  const words = BOOKS.reduce((n, b) => n + b.words, 0);
  const chapters = BOOKS.reduce((n, b) => n + b.chapters, 0);
  return (
    <div>
      <Banner
        crumb="Overview"
        title="Good afternoon"
        lead={`Last open: ${BOOKS[0]!.title}, ${BOOKS[0]!.opened}.`}
        bgImage="/banner-bg.png"
      />
      <div className="px-[1.8cqw] py-[1.6cqw]">
        <h3 className="text-[1.9cqw] font-semibold text-lp-ink">Overview</h3>
        <div className="mt-[1.2cqw] grid grid-cols-3 gap-[1cqw]">
          {([
            ["books", String(BOOKS.length)],
            ["words", fmt(words)],
            ["chapters", String(chapters)],
          ] as const).map(([label, value]) => (
            <div
              key={label}
              className="flex items-center gap-[0.9cqw] rounded-[0.8cqw] border border-lp-line bg-lp-ground px-[1.1cqw] py-[1cqw]"
            >
              <span className="flex h-[2.6cqw] w-[2.6cqw] shrink-0 items-center justify-center rounded-full bg-lp-accent/10 text-lp-accent-text">
                <Glyph name={label === "books" ? "overview" : label === "words" ? "write" : "archived"} />
              </span>
              <span>
                <span className="block text-[1.1cqw] text-lp-faint">{label}</span>
                <span className="block text-[1.9cqw] font-semibold text-lp-ink">
                  {value}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-[1cqw] grid grid-cols-2 gap-[1cqw]">
          <Card title="Writing" note="Last 14 days">
            <span className="flex items-center gap-[0.9cqw]">
              <span className="flex h-[2.6cqw] w-[2.6cqw] shrink-0 items-center justify-center rounded-full bg-lp-accent/10 text-lp-accent-text">
                <Glyph name="calendar" />
              </span>
              <span>
                <span className="block text-[1.1cqw] text-lp-faint">This week</span>
                <span className="block text-[1.9cqw] font-semibold text-lp-ink">
                  {fmt(4820)}
                </span>
              </span>
            </span>
            <span className="mt-[0.5cqw] block text-[1.05cqw] text-lp-faint">
              words across 6 days · 6 days running
            </span>
            <span className="mt-[0.9cqw] block border-t border-lp-line pt-[0.9cqw] text-[1.15cqw] text-lp-body">
              Net words a day
            </span>
            <Spark />
          </Card>
          <Card title="Target" note={BOOKS[0]!.title}>
            <Gauge written={BOOKS[0]!.words} target={60000} />
            <span className="mt-[0.9cqw] flex gap-[1.6cqw] border-t border-lp-line pt-[0.9cqw]">
              {([
                ["written", fmt(BOOKS[0]!.words), "write"],
                ["to go", fmt(60000 - BOOKS[0]!.words), "archived"],
              ] as const).map(([label, value, mark]) => (
                <span key={label} className="flex items-center gap-[0.6cqw]">
                  <span className="text-lp-accent-text">
                    <Glyph name={mark} />
                  </span>
                  <span>
                    <span className="block text-[1.05cqw] text-lp-faint">{label}</span>
                    <span className="block text-[1.35cqw] font-semibold text-lp-ink">
                      {value}
                    </span>
                  </span>
                </span>
              ))}
            </span>
            <span className="mt-[0.9cqw] block rounded-[0.6cqw] bg-lp-raised py-[0.6cqw] text-center text-[1.2cqw] font-medium text-lp-ink">
              Open book
            </span>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Write() {
  return (
    <div>
      <Banner
        crumb="Books"
        title={`${BOOKS.length} books on the shelf`}
        lead="Open one to carry on, start the next, or bring in a manuscript you already have."
      />
      <div className="px-[1.8cqw] py-[1.6cqw]">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[1.9cqw] font-semibold text-lp-ink">Books</h3>
          <Sort />
        </div>
        <div className="mt-[1.2cqw] space-y-[0.8cqw]">
          {BOOKS.slice(0, 2).map((book) => (
            <div
              key={book.title}
              className="flex items-center gap-[1.2cqw] rounded-[0.8cqw] border border-lp-line bg-lp-ground p-[1cqw]"
            >
              <Cover book={book} w={4.4} />
              <span className="min-w-0 flex-1">
                <span className="block font-code text-[0.95cqw] tracking-[0.12em] text-lp-faint uppercase">
                  Drafting
                </span>
                <span className="block text-[1.6cqw] font-semibold text-lp-ink">
                  {book.title}
                </span>
                <span className="block text-[1.15cqw] text-lp-faint">
                  {book.chapters} chapters · {fmt(book.words)} words · Opened{" "}
                  {book.opened}
                </span>
                <span className="mt-[0.7cqw] flex gap-[0.6cqw]">
                  <Pill>Open book</Pill>
                  <Pill>Export</Pill>
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Favourites() {
  return (
    <div>
      <Banner
        crumb="Favourites"
        title="1 book starred"
        lead="A star is a filter rather than a folder: the book stays on the shelf with the rest."
      />
      <ShelfPane heading="Favourites" books={BOOKS.slice(0, 1)} star />
    </div>
  );
}

function Archived() {
  return <ShelfPane heading="Archived" books={BOOKS.slice(1, 2)} action="Restore" pad />;
}

function Trash() {
  return <ShelfPane heading="Trash" books={BOOKS.slice(0, 3)} action="Restore" pad />;
}

/* ---- The furniture --------------------------------------------------- */

function Banner({ crumb, title, lead, bgImage }: { crumb: string; title: string; lead: string; bgImage?: string }) {
  return (
    <div
      className="relative overflow-hidden px-[1.8cqw] py-[1.8cqw]"
      style={
        bgImage
          ? {
              backgroundImage: `url('${bgImage}')`,
              backgroundSize: "100% auto",
              backgroundPosition: "center 65%",
              backgroundRepeat: "no-repeat",
            }
          : { backgroundColor: "var(--color-lp-card-1)" }
      }
    >
      {bgImage && <span aria-hidden="true" className="absolute inset-0 bg-black/20" />}
      <p className={`relative text-[1.1cqw] ${bgImage ? "text-white/90" : "text-lp-body"}`}>
        Dashboard <span className={bgImage ? "text-white/50" : "text-lp-faint"}>›</span> {crumb}
      </p>
      <p className={`relative mt-[0.5cqw] text-[2.5cqw] font-bold tracking-tight ${bgImage ? "text-white" : "text-lp-ink"}`}>
        {title}
      </p>
      <p className={`relative mt-[0.4cqw] max-w-[38cqw] text-[1.25cqw] ${bgImage ? "text-white/90" : "text-lp-body"}`}>{lead}</p>
      <span className="relative mt-[1cqw] flex gap-[0.7cqw]">
        <span className="rounded-[0.6cqw] bg-lp-accent px-[1.1cqw] py-[0.6cqw] text-[1.2cqw] font-semibold text-lp-accent-ink">
          Start a book
        </span>
        <span className="rounded-[0.6cqw] border border-lp-line bg-lp-ground px-[1.1cqw] py-[0.6cqw] text-[1.2cqw] font-semibold text-lp-ink">
          Import a manuscript
        </span>
      </span>
    </div>
  );
}

function ShelfPane({
  heading,
  books,
  action,
  pad,
  star,
}: {
  heading: string;
  books: readonly (typeof BOOKS)[number][];
  action?: string;
  pad?: boolean;
  star?: boolean;
}) {
  return (
    <div className={`px-[1.8cqw] ${pad ? "pt-[1.8cqw]" : "pt-[1.6cqw]"} pb-[1.6cqw]`}>
      <h3 className="text-[1.9cqw] font-semibold text-lp-ink">{heading}</h3>
      <div className="mt-[0.9cqw] flex justify-end">
        <Sort />
      </div>
      <div className="mt-[1cqw] grid grid-cols-4 gap-[1cqw]">
        {books.map((book) => (
          <div
            key={book.title}
            className="rounded-[0.8cqw] border border-lp-line bg-lp-ground p-[0.9cqw] text-center"
          >
            <span className="relative block">
              <Cover book={book} w={9} />
              {star && (
                <span className="absolute top-[0.5cqw] right-[0.9cqw] flex h-[1.9cqw] w-[1.9cqw] items-center justify-center rounded-[0.45cqw] bg-lp-ground text-[1.1cqw] text-danger">
                  ♥
                </span>
              )}
            </span>
            <span className="mt-[0.7cqw] block text-[1.25cqw] font-semibold text-lp-ink">
              {book.title}
            </span>
            <span className="block font-code text-[0.95cqw] tracking-[0.1em] text-lp-faint uppercase">
              {book.chapters} chapters · {fmt(book.words)} words
            </span>
            <span className="block text-[1.05cqw] text-lp-faint">
              Opened {book.opened}
            </span>
            <span className="mt-[0.7cqw] flex items-center justify-center gap-[0.5cqw]">
              <Pill>{action ?? "Write"}</Pill>
              <span className="rounded-[0.5cqw] border border-lp-line px-[0.7cqw] py-[0.45cqw] text-[1.1cqw] leading-none text-lp-body">
                ⋯
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cover({ book, w }: { book: (typeof BOOKS)[number]; w: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: `${w}cqw`, aspectRatio: "2 / 3", background: book.spine }}
      className="inline-flex shrink-0 flex-col justify-center gap-[0.3cqw] rounded-[0.4cqw] px-[0.7cqw]"
    >
      <span className="block h-[0.28cqw] rounded-full bg-white/70" />
      <span className="block h-[0.28cqw] w-3/4 rounded-full bg-white/45" />
    </span>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[0.8cqw] border border-lp-line bg-lp-ground px-[1.1cqw] py-[1cqw]">
      <div className="flex items-baseline justify-between">
        <span className="text-[1.35cqw] font-semibold text-lp-ink">{title}</span>
        <span className="text-[1.05cqw] text-lp-faint">{note}</span>
      </div>
      <div className="mt-[0.8cqw]">{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-[0.5cqw] border border-lp-line px-[0.9cqw] py-[0.45cqw] text-[1.1cqw] font-medium text-lp-ink">
      {children}
    </span>
  );
}

function Sort() {
  return (
    <span className="flex items-center gap-[0.6cqw] text-[1.15cqw] text-lp-faint">
      Sort
      <span className="rounded-[0.5cqw] border border-lp-line px-[0.8cqw] py-[0.4cqw] text-lp-body">
        Recently opened
      </span>
    </span>
  );
}

/**
 * Net words a day — the shape the real card draws, not a number.
 *
 * A flat run and one spike, which is what a writer's fortnight actually looks
 * like and what the app's own chart shows on this demo shelf. It carries **no
 * axis figures**: a drawn chart with numbers on it is a measurement nobody
 * made, and the card above already states the only figure this pane is
 * entitled to.
 */
function Spark() {
  return (
    <svg
      viewBox="0 0 200 54"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-[0.7cqw] block h-[5cqw] w-full"
    >
      <path
        d="M0 50 H120 C132 50 138 48 144 30 C150 10 156 4 162 4 C168 4 174 12 180 30 C186 46 192 50 200 50"
        fill="none"
        stroke="var(--color-lp-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M0 50 H120 C132 50 138 48 144 30 C150 10 156 4 162 4 C168 4 174 12 180 30 C186 46 192 50 200 50 V54 H0 Z"
        fill="var(--color-lp-accent)"
        opacity="0.12"
      />
    </svg>
  );
}

/**
 * The target dial.
 *
 * A semicircle, the swept part drawn to the share actually written. The
 * percentage is **derived from the two figures beside it** rather than typed,
 * so the dial, the caption and the arc cannot disagree — the same rule the
 * rest of the page holds every figure to.
 */
function Gauge({ written, target }: { written: number; target: number }) {
  const share = Math.min(written / target, 1);
  /* Half of a circle of r=42: pi * 42, to the pixel the browser will use. */
  const arc = Math.PI * 42;
  return (
    <span className="relative block">
      <svg viewBox="0 0 100 56" aria-hidden="true" className="block h-[6cqw] w-full">
        <path
          d="M8 50 A42 42 0 0 1 92 50"
          fill="none"
          stroke="var(--color-lp-raised)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M8 50 A42 42 0 0 1 92 50"
          fill="none"
          stroke="var(--color-lp-ink)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${arc * share} ${arc}`}
        />
      </svg>
      <span className="absolute inset-x-0 bottom-0 text-center text-[2.1cqw] font-bold text-lp-ink">
        {Math.round(share * 100)}%
      </span>
    </span>
  );
}

/** The rail's marks. Drawn rather than imported: five shapes, one file. */
function Glyph({ name }: { name: string }) {
  const common = "h-[1.5cqw] w-[1.5cqw] shrink-0";
  if (name === "search")
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[1.4cqw] w-[1.4cqw] shrink-0">
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5 14 14" strokeLinecap="round" />
      </svg>
    );
  if (name === "dot")
    return <span aria-hidden="true" className={`${common} rounded-full bg-lp-raised`} />;
  const paths: Record<string, string> = {
    calendar: "M3 4h10v9H3zM3 7h10M6 2v3M10 2v3",
    overview: "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z",
    write: "M3 13l1-3 7-7 2 2-7 7-3 1z",
    favourites: "M8 13.5S2.5 10 2.5 6.4A2.9 2.9 0 018 5a2.9 2.9 0 015.5 1.4c0 3.6-5.5 7.1-5.5 7.1z",
    archived: "M2 4h12v3H2zM3 7h10v6H3z",
    trash: "M3 4h10M6 4V2.5h4V4M4.5 4l.6 9h5.8l.6-9",
  };
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className={common}>
      <path d={paths[name] ?? paths.overview!} strokeLinejoin="round" />
    </svg>
  );
}
