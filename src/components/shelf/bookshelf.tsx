"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookCover } from "@/components/shelf/book-cover";
import { BookDetailsDialog } from "@/components/shelf/book-details-dialog";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import { AccountMenu } from "@/components/auth/account-menu";
import { HelpDialog } from "@/components/shelf/help-dialog";
import { SupportDialog } from "@/components/shelf/support-dialog";
import { ComingSoonDialog } from "@/components/shelf/coming-soon-dialog";
import { ImportDialog } from "@/components/shelf/import-dialog";
import { LoadingScreen } from "@/components/loading-screen";
import { type Account } from "@/lib/account";
import {
  archiveBook,
  bookChapterCount,
  bookWordCount,
  booksIn,
  deleteBook,
  migrateLegacy,
  restoreBook,
  trashBook,
  type Book,
  type BookView,
} from "@/lib/library-store";
import { relativeTime } from "@/lib/relative-time";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";

/**
 * The dashboard, as a prototype of the product this is becoming.
 *
 * The old screen was a shelf: one library, one grid of covers, and every
 * control on it about books. That was the right screen for a writing app. It
 * is the wrong screen for a product whose pitch is that writing the book is
 * *one part* of the job, and that the expensive, frightening parts are the
 * ones around it.
 *
 * So this is a hub with six areas — Overview, Write, Prepare, Track, Learn,
 * Tools — and **Write is one of them**. The arrangement is the argument: a
 * writer opening this should see immediately that the app has an opinion about
 * the whole job, not just the manuscript.
 *
 * **Two of the six are real. Four are not, and every one of them says so.**
 * Planned areas render their contents as dead, unclickable cards under a
 * PLANNED badge, because the house rule is that a control either works or
 * plainly says it is not built — and a prototype that quietly implies four
 * working sections is the exact thing this product is positioned against.
 *
 * The styling is deliberately plain. What is under review is the shape.
 */

type Area = "overview" | "write" | "prepare" | "track" | "learn" | "tools";

const AREAS: { id: Area; label: string; live: boolean; blurb: string }[] = [
  {
    id: "overview",
    label: "Overview",
    live: true,
    blurb: "Where the book is, and what to do next.",
  },
  {
    id: "write",
    label: "Write",
    live: true,
    blurb: "Draft it, and keep it safe. One part of the job.",
  },
  {
    id: "prepare",
    label: "Prepare",
    live: true,
    blurb: "Get it out without paying to find out what was wrong.",
  },
  {
    id: "track",
    label: "Track",
    live: false,
    blurb: "What the book cost against what it earned.",
  },
  {
    id: "learn",
    label: "Learn",
    live: false,
    blurb: "The order to do things in, and what a shop expects.",
  },
  {
    id: "tools",
    label: "Tools",
    live: false,
    blurb: "The small jobs that cost a fortune elsewhere.",
  },
];

/** Planned contents, per area. Nothing here is clickable — none of it exists. */
const PLANNED: Record<string, [string, string][]> = {
  track: [
    [
      "Import your KDP sales report",
      "Your sales already come as a spreadsheet. Reading one is a file import.",
    ],
    [
      "Cost against earnings",
      "Cover, editing, ads and proof copies on one side. Royalties on the other. Per book.",
    ],
    ["Break-even", "How many more copies before you stop being underwater."],
    [
      "The book-three curve",
      "Writers report no traction until their third book. Whether you are on that curve should not be a feeling.",
    ],
    [
      "Ad break-even",
      "How many sales at your royalty rate to cover what you have spent.",
    ],
  ],
  learn: [
    [
      "Publishing roadmap",
      "Every step from blank page to published, in order, so you do not learn about ARCs after you publish.",
    ],
    [
      "Genre beat sheets",
      "For the wall at 30,000 words of an 80,000-word book.",
    ],
    [
      "Honest numbers",
      "97% of books sell under 5,000 copies. Shown before you spend, not after.",
    ],
    [
      "Before you pay",
      "What to verify before hiring a publisher, a designer or a promotion service.",
    ],
    [
      "Real length targets",
      "How long books in your genre actually are, from books that exist.",
    ],
    [
      "What covers in your genre look like",
      "The books you are shelved beside, together on one page.",
    ],
  ],
  tools: [
    [
      "Cover checker",
      "Legible at thumbnail size? Enough resolution? Right ratio? We check covers. We do not design them.",
    ],
    [
      "Comp titles",
      "Books yours is genuinely like — found by reading your blurb and opening chapter, not by matching one word. What every listing and query letter asks for.",
    ],
    [
      "Blurb workshop",
      "Real per-store limits, plus five actual blurbs from books like yours and the length they run to. Not a chatbot writing it for you.",
    ],
    [
      "Category suggestions",
      "Worked out from where books like yours are actually filed, instead of a free-text box.",
    ],
    [
      "Is your title taken?",
      "One search, before you print it on anything.",
    ],
    [
      "Paperback setup",
      "Spine width, margins, gutter and bleed, worked out instead of guessed at.",
    ],
    ["ARC tracker", "Who holds it, who reviewed, when it is due."],
    [
      "Story bible",
      "Characters, places and timeline — across a series, not one book. The assistant reads the chapters and fills it in; it still cannot write into them.",
    ],
    [
      "Version history",
      "Snapshots and restore, so a bad afternoon is not permanent.",
    ],
    [
      "Writing provenance",
      "Evidence a human wrote the book, from the save history we already keep.",
    ],
  ],
};

const VIEW_LABEL: Record<BookView, string> = {
  active: "Books",
  archived: "Archived",
  trashed: "Trash",
};

type Sort = "recent" | "title" | "words";
const SORT_LABEL: Record<Sort, string> = {
  recent: "Recently opened",
  title: "Title A–Z",
  words: "Most words",
};

export function Bookshelf({
  /** The signed-in writer, or null when signed out or accounts are off. */
  account = null,
}: {
  account?: Account | null;
}) {
  const hydrated = useHydrated();
  const shelf = useShelf();

  const [area, setArea] = useState<Area>("overview");
  const [editing, setEditing] = useState<Book | null>(null);
  const [covering, setCovering] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<BookView>("active");
  const [dialog, setDialog] = useState<
    "templates" | "help" | "support" | "sounds" | "import" | null
  >(null);

  // `migrateLegacy` is idempotent, but running it twice is wasted work and
  // React runs effects twice in development.
  const migrated = useRef(false);
  useEffect(() => {
    if (!hydrated || migrated.current) return;
    migrated.current = true;
    migrateLegacy();
  }, [hydrated]);

  const active = useMemo(() => booksIn(shelf, "active"), [shelf]);

  const books = useMemo(() => {
    const list = booksIn(shelf, view);
    const by: Record<Sort, (a: Book, b: Book) => number> = {
      recent: (a, b) => b.lastOpenedAt - a.lastOpenedAt,
      title: (a, b) => a.title.localeCompare(b.title),
      words: (a, b) => bookWordCount(b) - bookWordCount(a),
    };
    return [...list].sort(by[sort]);
  }, [shelf, view, sort]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return books;
    return books.filter((b) => b.title.toLowerCase().includes(needle));
  }, [books, query]);

  const counts = useMemo(
    () => ({
      active: active.length,
      archived: booksIn(shelf, "archived").length,
      trashed: booksIn(shelf, "trashed").length,
    }),
    [shelf, active.length],
  );

  const totals = useMemo(
    () => ({
      words: active.reduce((s, b) => s + bookWordCount(b), 0),
      chapters: active.reduce((s, b) => s + bookChapterCount(b), 0),
    }),
    [active],
  );

  /**
   * The book to offer first: the one the shelf remembers, or the most recently
   * opened. Sorted *before* the fallback is taken — `active[0]` is insertion
   * order, not recency, so the one case this exists for (a remembered book that
   * has since been archived) would send the writer to an arbitrary one.
   */
  const current = useMemo(() => {
    const byRecent = [...active].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    return (
      byRecent.find((b) => b.id === shelf.lastOpenedBookId) ?? byRecent[0] ?? null
    );
  }, [active, shelf.lastOpenedBookId]);

  const handleTrash = (book: Book) => {
    if (window.confirm(`Move “${book.title}” to the trash?`)) trashBook(book.id);
  };

  const handleDeleteForever = (book: Book) => {
    const words = bookWordCount(book);
    const warning =
      words > 0
        ? `Permanently delete “${book.title}” and all ${words.toLocaleString()} words in it? This cannot be undone.`
        : `Permanently delete “${book.title}”? This cannot be undone.`;
    if (window.confirm(warning)) deleteBook(book.id);
  };

  if (!hydrated) return <LoadingScreen />;

  const meta = AREAS.find((a) => a.id === area)!;

  return (
    <div className="flex h-dvh bg-surface">
      {/* ---- The six areas ------------------------------------------- */}
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-panel p-4 md:flex">
        <Link href="/" className="mb-6 px-2 text-lg font-bold text-fg">
          Open<span className="text-accent">Chapter</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {AREAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setArea(a.id)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                area === a.id ? "bg-accent text-white" : "text-fg"
              }`}
            >
              <span className="font-medium">{a.label}</span>
              {!a.live && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    area === a.id
                      ? "bg-white/20 text-white"
                      : "bg-raised text-muted"
                  }`}
                >
                  Planned
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-6">
          <SideButton onClick={() => setDialog("help")}>Help</SideButton>
          <SideButton onClick={() => setDialog("support")}>Support</SideButton>
          <SideButton onClick={() => setDialog("templates")}>
            Templates
          </SideButton>
          <SideButton onClick={() => setDialog("sounds")}>
            Background sound
          </SideButton>
          <Link
            href="/upgrade"
            className="rounded-lg px-3 py-2 text-sm text-muted"
          >
            Pricing
          </Link>
        </div>
      </aside>

      {/* ---- The area ------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-line bg-panel/95 px-6 py-3 backdrop-blur">
          {/* The area picker again, for the widths where the rail is hidden. */}
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as Area)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg md:hidden"
          >
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {a.live ? "" : " (planned)"}
              </option>
            ))}
          </select>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your books"
            aria-label="Search your books"
            className="min-w-[8rem] flex-1 rounded-lg border border-line bg-surface px-3.5
                       py-2 text-sm text-fg outline-none focus-visible:ring-2
                       focus-visible:ring-accent/50"
          />
          <Link
            href="/book/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            New book
          </Link>
          <button
            type="button"
            onClick={() => setDialog("import")}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-fg"
          >
            Import
          </button>
          <AccountMenu account={account} />
        </header>

        <main className="px-6 pb-16">
          <div className="mt-8 mb-8 flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-fg">{meta.label}</h1>
            {!meta.live && <Badge>Not built yet</Badge>}
          </div>
          <p className="-mt-6 mb-8 text-muted">{meta.blurb}</p>

          {area === "overview" && (
            <Overview
              current={current}
              books={active.length}
              words={totals.words}
              chapters={totals.chapters}
              onGo={setArea}
            />
          )}

          {area === "write" && (
            <Write
              visible={visible}
              view={view}
              counts={counts}
              sort={sort}
              searching={query.trim().length > 0}
              onView={setView}
              onSort={setSort}
              onDetails={setEditing}
              onCover={setCovering}
              onTrash={handleTrash}
              onDeleteForever={handleDeleteForever}
            />
          )}

          {area === "prepare" && <Prepare books={active} />}

          {(area === "track" || area === "learn" || area === "tools") && (
            <PlannedArea items={PLANNED[area]} />
          )}
        </main>
      </div>

      {editing && (
        <BookDetailsDialog
          book={editing}
          onClose={() => setEditing(null)}
          onEditCover={() => {
            setCovering(editing);
            setEditing(null);
          }}
        />
      )}
      {covering && (
        <CoverDialog book={covering} onClose={() => setCovering(null)} />
      )}
      {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} />}
      {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === "support" && <SupportDialog onClose={() => setDialog(null)} />}
      {/* Both are complete features pointed at this dialog on purpose — see
          TODO.md. Re-pointing the button is the whole of switching either on. */}
      {dialog === "templates" && (
        <ComingSoonDialog title="Templates" onClose={() => setDialog(null)}>
          Start a book from a chapter skeleton instead of a blank page. Built,
          and held back until we have decided what the templates should be.
        </ComingSoonDialog>
      )}
      {dialog === "sounds" && (
        <ComingSoonDialog title="Background sound" onClose={() => setDialog(null)}>
          Rain, surf, wind or a flat hush while you write. Built, and held back
          until the scenes are real recordings rather than synthesised noise.
        </ComingSoonDialog>
      )}
    </div>
  );
}

/* ---- Areas --------------------------------------------------------------- */

function Overview({
  current,
  books,
  words,
  chapters,
  onGo,
}: {
  current: Book | null;
  books: number;
  words: number;
  chapters: number;
  onGo: (a: Area) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {current ? (
        <Panel title="Pick up where you left off">
          <div className="flex flex-wrap items-center gap-5">
            <Link href={`/book/${current.id}`} className="w-[84px] shrink-0">
              <CoverOf book={current} />
            </Link>
            <div className="min-w-[12rem] flex-1">
              <p className="text-xl font-bold text-fg">{current.title}</p>
              <p className="mt-1 text-sm text-muted">
                {bookChapterCount(current)} chapters ·{" "}
                {bookWordCount(current).toLocaleString()} words · opened{" "}
                {relativeTime(current.lastOpenedAt)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Go href={`/book/${current.id}`} primary>
                  Write
                </Go>
                <Go href={`/book/${current.id}/read`}>Read</Go>
                <Go href={`/book/${current.id}/export`}>Prepare</Go>
              </div>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel title="Nothing on the shelf yet">
          <p className="text-muted">
            Start typing and name the book later, or bring in a .docx, .epub,
            .md, .txt or .html file.
          </p>
          <Link
            href="/book/new"
            className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white"
          >
            Start a book
          </Link>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat value={String(books)} label="books" />
        <Stat value={words.toLocaleString()} label="words written" />
        <Stat value={String(chapters)} label="chapters" />
      </div>

      <Panel title="The rest of the job">
        <p className="mb-4 text-muted">
          Writing is one part. These are the others. Two work today; three are
          what we are building.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.filter((a) => a.id !== "overview").map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onGo(a.id)}
              className="rounded-xl border border-line bg-surface p-4 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="font-bold text-fg">{a.label}</span>
                {a.live ? <Badge live>Live</Badge> : <Badge>Planned</Badge>}
              </span>
              <span className="mt-1.5 block text-sm text-muted">{a.blurb}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Write({
  visible,
  view,
  counts,
  sort,
  searching,
  onView,
  onSort,
  onDetails,
  onCover,
  onTrash,
  onDeleteForever,
}: {
  visible: Book[];
  view: BookView;
  counts: Record<BookView, number>;
  sort: Sort;
  searching: boolean;
  onView: (v: BookView) => void;
  onSort: (s: Sort) => void;
  onDetails: (b: Book) => void;
  onCover: (b: Book) => void;
  onTrash: (b: Book) => void;
  onDeleteForever: (b: Book) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-lg border border-line bg-panel p-1">
          {(["active", "archived", "trashed"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
                view === v ? "bg-accent text-white" : "text-muted"
              }`}
            >
              {VIEW_LABEL[v]} <span className="opacity-70">{counts[v]}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as Sort)}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-fg"
          >
            {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center text-muted">
          {searching
            ? "No book here matches that."
            : view === "archived"
              ? "Nothing archived."
              : view === "trashed"
                ? "The trash is empty."
                : "Nothing on the shelf yet."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((book) => (
            <li
              key={book.id}
              className="rounded-xl border border-line bg-panel p-4"
            >
              <div className="flex gap-4">
                <Link href={`/book/${book.id}`} className="w-[64px] shrink-0">
                  <CoverOf book={book} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/book/${book.id}`}
                    className="block truncate font-bold text-fg"
                  >
                    {book.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {bookChapterCount(book)} chapters ·{" "}
                    {bookWordCount(book).toLocaleString()} words
                  </p>
                  <p className="text-xs text-muted">
                    Opened {relativeTime(book.lastOpenedAt)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {view === "active" ? (
                  <>
                    <Chip href={`/book/${book.id}`}>Write</Chip>
                    <Chip href={`/book/${book.id}/read`}>Read</Chip>
                    <Chip href={`/book/${book.id}/export`}>Prepare</Chip>
                    <ChipButton onClick={() => onDetails(book)}>
                      Details
                    </ChipButton>
                    <ChipButton onClick={() => onCover(book)}>Cover</ChipButton>
                    <ChipButton onClick={() => archiveBook(book.id)}>
                      Archive
                    </ChipButton>
                    <ChipButton onClick={() => onTrash(book)}>Trash</ChipButton>
                  </>
                ) : (
                  <>
                    <ChipButton onClick={() => restoreBook(book.id)}>
                      Restore
                    </ChipButton>
                    {view === "trashed" && (
                      <ChipButton onClick={() => onDeleteForever(book)}>
                        Delete for good
                      </ChipButton>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Prepare({ books }: { books: Book[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Check and export a book">
        <p className="mb-4 text-muted">
          The pre-upload check names what a shop would refuse, and says which
          problems would actually stop the upload. It never blocks your export.
        </p>
        {books.length === 0 ? (
          <p className="text-muted">No books yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {books.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3
                           rounded-lg border border-line bg-surface px-4 py-3"
              >
                <span className="truncate font-medium text-fg">{b.title}</span>
                <Go href={`/book/${b.id}/export`}>Check and export</Go>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Coming to this area">
        <PlannedGrid items={PLANNED.tools.slice(0, 4)} />
      </Panel>
    </div>
  );
}

function PlannedArea({ items }: { items: [string, string][] }) {
  return (
    <div>
      <p className="mb-6 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-muted">
        None of this exists yet. It is here so the shape of the product is
        visible — nothing below is clickable, and nothing below is charged for.
      </p>
      <PlannedGrid items={items} />
    </div>
  );
}

/* ---- Bits ---------------------------------------------------------------- */

function PlannedGrid({ items }: { items: [string, string][] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([name, note]) => (
        <li
          key={name}
          className="rounded-xl border border-dashed border-line bg-panel p-4 opacity-80"
        >
          <Badge>Planned</Badge>
          <p className="mt-2 font-bold text-fg">{name}</p>
          <p className="mt-1 text-sm text-muted">{note}</p>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-4 font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Badge({ children, live }: { children: ReactNode; live?: boolean }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
        live ? "bg-accent/15 text-accent" : "bg-raised text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <p className="text-2xl font-extrabold text-fg">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function Go({
  href,
  primary,
  children,
}: {
  href: string;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
        primary ? "bg-accent text-white" : "border border-line bg-surface text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

function Chip({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-line px-2.5 py-1 font-medium text-fg"
    >
      {children}
    </Link>
  );
}

function ChipButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-line px-2.5 py-1 font-medium text-muted"
    >
      {children}
    </button>
  );
}

function SideButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-2 text-left text-sm text-muted"
    >
      {children}
    </button>
  );
}

function CoverOf({ book }: { book: Book }) {
  // `useCover` returns the artwork itself, or null. Whether to draw the title
  // over it is the *book's* setting, not the image's — see `bareCover`.
  const cover = useCover(book.id);
  return (
    <BookCover
      title={book.title}
      subtitle={book.subtitle}
      author={book.author}
      words={bookWordCount(book)}
      image={cover ?? undefined}
      bare={book.bareCover}
      seed={book.id}
    />
  );
}
