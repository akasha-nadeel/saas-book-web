import type { ReactNode } from "react";
import { AppWindow } from "@/components/landing/app-window";
import { LAUNCH_LIMITS } from "@/lib/launch";

/**
 * The dashboard, drawn — Overview, as a writer lands on it.
 *
 * **This is the hero's whole argument.** A visitor who has not signed up
 * cannot open the application, so the page shows them the screen a writer
 * actually lands on. The rail is the app's own `RAIL` (`shelf/bookshelf.tsx`)
 * row for row, with Overview lit.
 *
 * **It is a still, on purpose** (2026-09-24, the owner's call). An earlier
 * version made the rail clickable and let the pane scroll; the owner wanted
 * Overview always on screen, no scrollbar and nothing to press in the rail.
 * So the rail rows are list items rather than buttons, and the pane is cut by
 * the frame rather than scrolled.
 *
 * **It is drawn to match the real dashboard, pictures included.** The banner
 * and the resume card paint the same files under `public/` the app does, at
 * the same crop, with the same words — so when Overview changes, this file is
 * the second place to change it.
 *
 * **The demo library is not anybody's real one.** Three invented books, and
 * the account chip and the greeting are placeholders. A marketing page is a
 * bad place for a real person's shelf.
 *
 * **Everything is sized in `cqw` against a 1000px design**, the convention the
 * other drawn screens use — see the note on `W` in `mvp-screens.tsx`. The
 * container's width *is* the zoom, so the whole thing scales as one drawing
 * rather than reflowing into a small-screen layout it does not have.
 */

const W = 1000;

/** The demo shelf, drawn once so the header, the counters and the bars agree. */
const BOOKS = [
  { title: "Breathe Again", chapters: 12, words: 41208, jacket: 1, opened: "2 hours ago" },
  { title: "The Long Winter", chapters: 8, words: 22740, jacket: 4, opened: "yesterday" },
  { title: "Notes on a Quiet Year", chapters: 3, words: 6180, jacket: 6, opened: "last week" },
] as const;

type DemoBook = (typeof BOOKS)[number];

/** The rail, in `RAIL`'s order. `null` is a rule between groups. */
const SECTIONS = [
  { id: "overview", label: "Overview", count: null },
  { id: "write", label: "Write", count: null },
  { id: "favourites", label: "Favourites", count: 1 },
  { id: "archived", label: "Archived", count: 1 },
  null,
  { id: "title-check", label: "Title check", count: null },
  { id: "ideas", label: "Ideas", count: null },
  { id: "paperback", label: "Paperback", count: null, pro: true },
  null,
  { id: "trash", label: "Trash", count: 2 },
] as const;

const fmt = (n: number) => n.toLocaleString("en-GB");

const FORMAT_NAMES: Record<string, string> = { epub: "EPUB", pdf: "PDF", docx: "Word" };

/** `overviewBannerLine()` in `bookshelf.tsx`, read off the same list. */
function formatsLine(): string {
  const names = LAUNCH_LIMITS.freeExports.map((f) => FORMAT_NAMES[f] ?? f);
  const list =
    names.length <= 1
      ? (names[0] ?? "")
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} — free on every plan, and the file is yours.`;
}

export function DashboardDemo() {
  const chapters = BOOKS.reduce((n, b) => n + b.chapters, 0);

  return (
    <AppWindow
      chrome={{ url: "openchapter.app/" }}
      screenStyle={{ aspectRatio: `${W} / 620` }}
      screenClassName="@container flex overflow-hidden bg-lp-ground leading-[1.35]"
    >
      {/* ---- The rail ------------------------------------------------- */}
      <aside className="flex w-[19cqw] shrink-0 flex-col border-r border-lp-line bg-lp-tint px-[1cqw] py-[1.6cqw]">
        <div className="flex items-center gap-[0.6cqw] px-[0.6cqw]">
          <p className="text-[1.75cqw] font-bold tracking-tight text-lp-ink">
            Open<span className="text-lp-wordmark">Chapter</span>
          </p>
          <span className="text-lp-body">
            <Glyph name="search" />
          </span>
          <span className="ml-auto text-lp-faint">
            <Glyph name="collapse" />
          </span>
        </div>

        {/* **The label, and it is not decoration.** A demo that looks exactly
            like the product is only honest while it says which it is — so the
            badge sits inside the drawing and travels with every screenshot
            anyone takes of this page. */}
        <span className="mt-[0.7cqw] ml-[0.6cqw] w-fit rounded-full bg-lp-raised px-[0.8cqw] py-[0.25cqw] text-[0.95cqw] font-medium text-lp-body">
          Demo data
        </span>

        <ul className="mt-[1.4cqw] space-y-[0.2cqw]">
          {SECTIONS.map((section, i) => {
            if (!section)
              return <li key={`rule-${i}`} aria-hidden="true" className="mx-[0.8cqw] my-[0.8cqw] border-t border-lp-line" />;
            const on = section.id === "overview";
            return (
              <li
                key={section.id}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-[0.9cqw] rounded-[0.7cqw] px-[0.8cqw] py-[0.6cqw] text-[1.25cqw] text-lp-ink ${
                  on ? "bg-lp-accent/12 font-semibold" : ""
                }`}
              >
                <Glyph name={section.id} />
                <span className="flex-1">{section.label}</span>
                {"pro" in section && section.pro && <ProBadge />}
                {section.count !== null && (
                  <span className="text-[1.1cqw] text-lp-body">{section.count}</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mx-[0.8cqw] my-[0.8cqw] border-t border-lp-line" />

        <ul className="space-y-[0.2cqw]">
          {(["How it works", "Support"] as const).map((name) => (
            <li
              key={name}
              className="flex items-center gap-[0.9cqw] rounded-[0.7cqw] px-[0.8cqw] py-[0.6cqw] text-[1.25cqw] text-lp-ink"
            >
              <Glyph name={name === "Support" ? "support" : "help"} />
              {name}
            </li>
          ))}
        </ul>

        {/* The account chip, pinned to the foot the way the app pins it. */}
        <div className="mt-auto flex items-center gap-[0.8cqw] border-t border-lp-line px-[0.6cqw] pt-[1.1cqw]">
          <span className="flex h-[2.6cqw] w-[2.6cqw] shrink-0 items-center justify-center rounded-full bg-[#1f5e3a] text-[1.2cqw] font-semibold text-white">
            A
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.2cqw] font-medium text-lp-ink">
              Your account
            </span>
            <span className="block text-[1cqw] text-lp-body">Free plan</span>
          </span>
          <span className="text-[1.3cqw] leading-none text-lp-body">⋯</span>
        </div>
      </aside>

      {/* ---- The pane --------------------------------------------------
          Cut by the frame, never scrolled: Overview is the one screen this
          shows, and the hero carries no scrollbar. */}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden px-[2.4cqw] pt-[2.4cqw]">
        <div className="flex items-start gap-[1.2cqw] border-b border-lp-line pb-[1.6cqw]">
          <div className="min-w-0 flex-1">
            <p className="text-[2.3cqw] font-extrabold tracking-tight text-lp-ink">Hello there !</p>
            <p className="mt-[0.3cqw] text-[1.3cqw] text-lp-body">
              Welcome back — {BOOKS.length} books, {chapters} chapters on the shelf.
            </p>
          </div>
          <span className="flex items-center gap-[0.6cqw] rounded-[0.7cqw] bg-lp-accent px-[1.3cqw] py-[0.75cqw] text-[1.3cqw] font-semibold text-lp-accent-ink">
            + New book
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.2cqw] w-[1.2cqw]">
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="mt-[2cqw]">
          <Overview />
        </div>
      </div>
    </AppWindow>
  );
}

/* ---- Overview --------------------------------------------------------- */

function Overview() {
  const words = BOOKS.reduce((n, b) => n + b.words, 0);
  const chapters = BOOKS.reduce((n, b) => n + b.chapters, 0);
  const top = Math.max(...BOOKS.map((b) => b.words));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_24cqw] gap-[1.6cqw]">
      <div className="flex min-w-0 flex-col gap-[1.6cqw]">
        <Banner
          image="/overview-banner.webp"
          eyebrow="Write it, then leave with it"
          title="Your book, in the shops’ own formats"
          subtitle={formatsLine()}
          ink="dark"
          action="Start a book"
        />
        <div className="grid grid-cols-3 gap-[1.6cqw]">
          {([
            ["Books", String(BOOKS.length)],
            ["Words", fmt(words)],
            ["Chapters", String(chapters)],
          ] as const).map(([label, value]) => (
            <div
              key={label}
              className="flex min-h-[11cqw] flex-col justify-center rounded-[0.8cqw] border border-lp-line px-[2cqw]"
            >
              <span className="text-[1.3cqw] font-semibold text-lp-ink">{label}</span>
              <span className="mt-[0.3cqw] text-[3cqw] leading-tight font-extrabold text-lp-ink tabular-nums">
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-[0.8cqw] border border-lp-line px-[2.2cqw] py-[2cqw]">
          <p className="text-[1.6cqw] font-semibold text-lp-ink">Your writing</p>
          <p className="mt-[0.3cqw] text-[1.25cqw] text-lp-body">
            Whether the writing is moving. Counted across every book, over the last 30 days.
          </p>
          <div className="mt-[1.6cqw] overflow-hidden rounded-[0.8cqw] border border-lp-line">
            <div className="flex bg-lp-raised/40">
              {([
                ["Written", "last 30 days", `+${fmt(4820)}`],
                ["Manuscript", "every book", fmt(words)],
              ] as const).map(([name, note, value], i) => (
                <span
                  key={name}
                  className={`flex-1 px-[1.6cqw] py-[1.1cqw] ${i === 0 ? "border-r border-lp-line bg-lp-ground" : ""}`}
                >
                  <span className="block text-[1cqw] font-medium text-lp-body">
                    {name} · {note}
                  </span>
                  <span className="mt-[0.2cqw] block text-[1.9cqw] font-bold text-lp-ink tabular-nums">
                    {value}
                  </span>
                </span>
              ))}
            </div>
            <div className="px-[1.6cqw] py-[1.4cqw]">
              <Spark />
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-[1.6cqw]">
        <Resume book={BOOKS[0]!} />
        <div className="rounded-[0.8cqw] border border-lp-line px-[1.6cqw] py-[1.5cqw]">
          <div className="flex items-center justify-between">
            <span className="text-[1.3cqw] font-semibold text-lp-ink">Words by book</span>
            <span className="text-[1cqw] font-medium text-lp-body">Now</span>
          </div>
          <div className="mt-[1.2cqw] space-y-[0.7cqw]">
            {BOOKS.map((book) => (
              <Bar key={book.title} share={book.words / top} value={fmt(book.words)}>
                <Cover book={book} w={1.7} />
                <span className="truncate">{book.title}</span>
              </Bar>
            ))}
          </div>
        </div>
        <div className="rounded-[0.8cqw] border border-lp-line px-[1.6cqw] py-[1.5cqw]">
          <div className="flex items-center justify-between">
            <span className="text-[1.3cqw] font-semibold text-lp-ink">Days of the week</span>
            <span className="text-[1cqw] font-medium text-lp-body">30 days</span>
          </div>
          <div className="mt-[1.2cqw] space-y-[0.7cqw]">
            {([
              ["Tuesday", 2140],
              ["Saturday", 1310],
              ["Thursday", 860],
              ["Monday", 510],
            ] as const).map(([day, n]) => (
              <Bar key={day} share={n / 2140} value={`+${fmt(n)}`}>
                <span>{day}</span>
              </Bar>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- The furniture --------------------------------------------------- */

type BannerProps = {
  image: string;
  title: string;
  subtitle: string;
  eyebrow?: string;
  ink: "light" | "dark";
  crop?: string;
  scrim?: boolean;
  action?: string;
};

/** `INK` in `section-banner.tsx`: decided by the picture, not the theme. */
const INK = {
  light: { title: "#f6f6f8", body: "#e4e4ea", eyebrow: "#c9c9d2" },
  dark: { title: "#141310", body: "#2c2a24", eyebrow: "#3d3a33" },
} as const;

/** `SectionBanner`, drawn: the picture is the ground and the type sits on it. */
function Banner({ image, title, subtitle, eyebrow, ink, crop = "center", scrim, action }: BannerProps) {
  const colour = INK[ink];
  return (
    <div
      className={`relative isolate flex min-h-[25cqw] flex-col justify-center overflow-hidden rounded-[0.8cqw] border px-[3cqw] py-[2.6cqw] shadow-sm ${
        ink === "light" ? "border-white/15" : "border-black/10"
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-cover"
        style={{ backgroundImage: `url('${image}')`, backgroundPosition: crop }}
      />
      {scrim && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 -z-10 ${
            ink === "light"
              ? "bg-[linear-gradient(105deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.5)_30%,rgba(0,0,0,0)_55%)]"
              : "bg-[linear-gradient(105deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.5)_30%,rgba(255,255,255,0)_55%)]"
          }`}
        />
      )}
      {eyebrow && (
        <p
          className="text-[1.05cqw] font-semibold tracking-[0.08em] uppercase"
          style={{ color: colour.eyebrow }}
        >
          {eyebrow}
        </p>
      )}
      <p
        className={`max-w-[34cqw] text-[2.5cqw] leading-tight font-bold text-balance ${eyebrow ? "mt-[0.6cqw]" : ""}`}
        style={{ color: colour.title }}
      >
        {title}
      </p>
      <p
        className="mt-[0.7cqw] max-w-[29cqw] text-[1.3cqw] leading-relaxed"
        style={{ color: colour.body }}
      >
        {subtitle}
      </p>
      {action && (
        <span className="mt-[1.6cqw] inline-flex w-fit items-center gap-[0.6cqw] rounded-[0.7cqw] bg-[#febc8c] px-[1.4cqw] py-[0.8cqw] text-[1.3cqw] font-semibold text-[#2a1a0e] shadow-md">
          {action}
          <span aria-hidden="true">→</span>
        </span>
      )}
    </div>
  );
}

/** "Where you left off", over the resume card's own photograph. */
function Resume({ book }: { book: DemoBook }) {
  return (
    <div className="relative isolate flex min-h-[25cqw] flex-col justify-center overflow-hidden rounded-[0.8cqw] border border-white/15 px-[1.8cqw] py-[1.8cqw] text-white shadow-sm">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-cover"
        style={{ backgroundImage: "url('/resume-card-background.webp')", backgroundPosition: "50% 100%" }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.42)_52%,rgba(0,0,0,0.06)_100%)]"
      />
      <div className="flex items-baseline justify-between gap-[0.6cqw]">
        <span className="shrink-0 text-[1.4cqw] font-bold">Where you left off</span>
        <span className="min-w-0 truncate text-[0.95cqw] text-white/70">{book.title}</span>
      </div>
      <p className="mt-[1cqw] text-[1.2cqw] leading-relaxed text-white/85">
        …and when the tide went out she walked the length of the bay without
        once looking back at the house, because she already knew it would still
        be standing.
      </p>
      <span className="mt-[1.4cqw] w-fit rounded-[0.7cqw] bg-neutral-950 px-[1.6cqw] py-[0.8cqw] text-[1.25cqw] font-semibold text-white shadow-sm">
        Open book
      </span>
    </div>
  );
}

/** A book's default jacket, as `BookThumb` draws one in "Words by book". */
function Cover({ book, w }: { book: DemoBook; w: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${w}cqw`,
        aspectRatio: "2 / 3",
        backgroundImage: `url('/default-covers/jacket-${book.jacket}.jpg')`,
      }}
      className="inline-block shrink-0 rounded-l-[0.1cqw] rounded-r-[0.3cqw] bg-cover bg-center shadow-sm"
    />
  );
}

/** One row of a Tremor `BarList`: a tinted bar under the name, value right. */
function Bar({ share, value, children }: { share: number; value: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-[1cqw]">
      <div className="relative min-w-0 flex-1">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-[0.35cqw] bg-[#bfe9f4]"
          style={{ width: `${Math.max(share, 0.08) * 100}%` }}
        />
        <span className="relative flex h-[2.3cqw] items-center gap-[0.6cqw] px-[0.6cqw] text-[1.05cqw] text-lp-ink">
          {children}
        </span>
      </div>
      <span className="text-[1.05cqw] text-lp-ink tabular-nums">{value}</span>
    </div>
  );
}

function ProBadge() {
  return (
    <span className="rounded-[0.4cqw] bg-linear-to-r from-upgrade-from to-upgrade-to px-[0.6cqw] py-[0.15cqw] text-[0.85cqw] font-bold tracking-wide text-white uppercase">
      Pro
    </span>
  );
}

/**
 * Words written a day — the shape the real chart draws, not a number.
 *
 * It carries **no axis figures**: a drawn chart with numbers on it is a
 * measurement nobody made, and the tab above already states the only figure
 * this pane is entitled to.
 */
function Spark() {
  const line =
    "M0 50 H40 C48 50 52 38 58 38 C64 38 66 50 72 50 H110 C120 50 126 20 134 20 C142 20 146 44 152 44 C160 44 166 10 176 10 C186 10 192 46 200 50";
  return (
    <svg viewBox="0 0 200 54" preserveAspectRatio="none" aria-hidden="true" className="block h-[9cqw] w-full">
      <defs>
        <linearGradient id="oc-demo-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} V54 H0 Z`} fill="url(#oc-demo-spark)" />
      <path d={line} fill="none" stroke="#06b6d4" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The rail's marks, on `shelf-icons`' 24-grid with its 1.75 stroke. */
function Glyph({ name }: { name: string }) {
  const paths: Record<string, string> = {
    overview: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    write: "M4 20l1.5-5L16 4.5a2.1 2.1 0 013 3L8.5 18 4 20zM14 7l3 3",
    favourites:
      "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z",
    archived: "M3.5 5h17v4h-17zM5 9h14v10H5zM10 13h4",
    "title-check": "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM15.5 15.5L20 20",
    search: "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM15.5 15.5L20 20",
    ideas: "M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z",
    paperback: "M14.5 4.5l5 5L9 20H4v-5L14.5 4.5zM12 7l5 5M7.5 12.5l2 2",
    trash: "M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6",
    help: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01",
    support: "M4 19l1.3-3.6A8 8 0 1112 20a8 8 0 01-3.6-.9L4 19z",
    collapse: "M4 5h16v14H4zM9 5v14M15 10l-2 2 2 2",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[1.6cqw] w-[1.6cqw] shrink-0"
    >
      <path d={paths[name] ?? paths.overview!} />
    </svg>
  );
}
