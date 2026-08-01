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
 * **All six areas now have real work in them.** What is still unbuilt sits in
 * each area's own "Coming to this area" panel, as dead unclickable cards under
 * a PLANNED badge — the house rule is that a control either works or plainly
 * says it is not built, and a screen that quietly implies a working feature is
 * the exact thing this product is positioned against. The comments in `PLANNED`
 * record what has left each list, and a list that empties hides its panel
 * rather than heading an empty box.
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
    live: true,
    blurb: "What the book cost against what it earned.",
  },
  {
    id: "learn",
    label: "Learn",
    live: true,
    blurb: "The order to do things in, and what a shop expects.",
  },
  {
    id: "tools",
    label: "Tools",
    live: true,
    blurb: "The small jobs that cost a fortune elsewhere.",
  },
];

/** Planned contents, per area. Nothing here is clickable — none of it exists. */
const PLANNED: Record<string, [string, string][]> = {
  track: [
    // The sales import, cost against earnings, break-even and the ad sum have
    // all moved out of this list — they are built, on one Track page.
    [
      "The book-three curve",
      "Writers report no traction until their third book. Whether you are on that curve should not be a feeling. Needs more than one book's ledger to say anything, so it waits until there is one.",
    ],
  ],
  learn: [
    // The publishing roadmap and the beat sheets have moved out of this
    // list — both are built.
    // Honest numbers and the before-you-pay checks have moved out of this
    // list — both are built, on one "Before you spend" page.
    // Real length targets, the cover wall and the beat sheets have all moved
    // out of this list — they are built.
  ],
  tools: [
    [
      "Cover checker",
      "The wall shows you the shelf; this would check the file — resolution, trim ratio, and whether the title survives being shrunk.",
    ],
    // Comp titles has moved out of this list — it is built. See the Tools area
    // below, which now lists it as working and links to it per book.
    // The blurb workshop has moved out of this list — it is built. See the
    // Tools area, which links to it per book.
    // Category suggestions has moved out of this list — it is built.
    // The title check has moved out of this list — it is built.
    // Paperback setup has moved out of this list — it is built.
    ["ARC tracker", "Who holds it, who reviewed, when it is due."],
    [
      "Story bible",
      "Characters, places and timeline — across a series, not one book. The assistant reads the chapters and fills it in; it still cannot write into them.",
    ],
    // Version history has moved out of this list — it is built, in the
    // editor's Versions tab.
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

          {area === "tools" && <Tools books={active} />}

          {area === "learn" && <Learn books={active} />}

          {area === "track" && <Track books={active} />}
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
              {/* The roadmap sits with the three phases rather than under
                  Learn alone, because "what do I do next" is the question this
                  card is answering and the roadmap is the only thing here that
                  knows. */}
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Go href={`/book/${current.id}`} primary>
                  Write
                </Go>
                <Go href={`/book/${current.id}/read`}>Read</Go>
                <Go href={`/book/${current.id}/export`}>Prepare</Go>
                <Go href={`/book/${current.id}/roadmap`}>What next?</Go>
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
                    <Chip href={`/book/${book.id}/comps`}>Comps</Chip>
                    <Chip href={`/book/${book.id}/blurb`}>Blurb</Chip>
                    <Chip href={`/book/${book.id}/categories`}>Categories</Chip>
                    <Chip href={`/book/${book.id}/covers`}>Covers</Chip>
                    <Chip href={`/book/${book.id}/title-check`}>Title</Chip>
                    <Chip href={`/book/${book.id}/paperback`}>Paperback</Chip>
                    <Chip href={`/book/${book.id}/roadmap`}>Roadmap</Chip>
                    <Chip href={`/book/${book.id}/structure`}>Structure</Chip>
                    <Chip href={`/book/${book.id}/prose`}>Prose</Chip>
                    <Chip href={`/book/${book.id}/progress`}>Progress</Chip>
                    <Chip href={`/book/${book.id}/money`}>Money</Chip>
                    <Chip href={`/book/${book.id}/track`}>Track</Chip>
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

/**
 * Tools — the first area with something real in it besides the manuscript.
 *
 * Comp titles is built and links per book; everything else here is still a
 * dead card under a PLANNED badge. The two are kept in one area, and visibly
 * different from each other, rather than the working one being promoted to its
 * own screen: the point of this dashboard is that a writer can see at a glance
 * what the product does and does not do yet, and hiding the unbuilt ones would
 * make that harder to read, not easier.
 */
function Tools({ books }: { books: Book[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Working on a book">
        <p className="mb-4 text-muted">
          <strong className="text-fg">Comp titles</strong> — the published books
          yours sits beside, which every listing form and every query letter
          asks for. <strong className="text-fg">Blurb</strong> — counted against
          the shops&rsquo; limit, and shown five real blurbs from books like
          yours. <strong className="text-fg">Categories</strong> — which shelf
          you land on, from where comparable books are actually filed.{" "}
          <strong className="text-fg">Covers</strong> — yours at thumbnail size,
          beside the shelf it has to sit on. <strong className="text-fg">Title</strong>{" "}
          — whether somebody else&rsquo;s book turns up first when a reader
          searches for yours. All five read Google Books and Open Library, free,
          and none of them sends anything you have written.
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
                <span className="flex gap-2">
                  <Go href={`/book/${b.id}/comps`}>Comps</Go>
                  <Go href={`/book/${b.id}/blurb`}>Blurb</Go>
                  <Go href={`/book/${b.id}/categories`}>Categories</Go>
                  <Go href={`/book/${b.id}/covers`}>Covers</Go>
                  <Go href={`/book/${b.id}/title-check`}>Title</Go>
                  <Go href={`/book/${b.id}/paperback`}>Paperback</Go>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Coming to this area">
        <PlannedGrid items={PLANNED.tools} />
      </Panel>
    </div>
  );
}

/**
 * Learn — the order to do things in.
 *
 * One real thing so far, and it is the one three separate research threads
 * pointed at: writers do not lack tools, they lack the order. Most sharply the
 * writer who found out advance copies were essential *after* publishing.
 */
function Learn({ books }: { books: Book[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Blank page to published">
        <p className="mb-4 text-muted">
          <strong className="text-fg">Roadmap</strong> — every step in the order
          it has to happen, so you do not find out about advance copies after
          the book is already out; most of it ticks itself from what is in your
          book. <strong className="text-fg">Structure</strong> — the shape most
          novels share, with your word count on it, for when the middle has run
          out of road. <strong className="text-fg">Prose</strong> — what is in a
          chapter, counted, with no score and no rewriting.{" "}
          <strong className="text-fg">Progress</strong> — whether the writing is
          moving. <strong className="text-fg">Before you spend</strong> — what a
          book usually earns, and what to establish before paying anybody.
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
                <span className="flex gap-2">
                  <Go href={`/book/${b.id}/roadmap`}>Roadmap</Go>
                  <Go href={`/book/${b.id}/structure`}>Structure</Go>
                  <Go href={`/book/${b.id}/prose`}>Prose</Go>
                  <Go href={`/book/${b.id}/progress`}>Progress</Go>
                  <Go href={`/book/${b.id}/money`}>Before you spend</Go>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Only while there is something left to come. An empty "Coming to this
          area" panel is a heading promising a list and then not having one,
          which is the dead UI the house rule is about. */}
      {PLANNED.learn.length > 0 && (
        <Panel title="Coming to this area">
          <PlannedGrid items={PLANNED.learn} />
        </Panel>
      )}
    </div>
  );
}

/**
 * Track — the last of the six areas to become real.
 *
 * It was the one deliberately left until the end, because it is the largest:
 * everything else on the dashboard reads data the app already had, and this one
 * needed a ledger of its own and a file import to fill it.
 */
function Track({ books }: { books: Book[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel title="What each book cost against what it earned">
        <p className="mb-4 text-muted">
          Nobody keeps this, which is why the total is always a shock. Add what
          you have spent, import a sales report, and see how many more copies
          get you level. Amazon has no public API, so the report is a file you
          download and hand over — nothing is fetched and nothing is sent.
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
                <Go href={`/book/${b.id}/track`}>Open the ledger</Go>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {PLANNED.track.length > 0 && (
        <Panel title="Coming to this area">
          <PlannedGrid items={PLANNED.track} />
        </Panel>
      )}
    </div>
  );
}

// `PlannedArea` — the whole-area "none of this exists yet" wrapper — is gone.
// Every area now has real work in it and shows what is still coming in its own
// "Coming to this area" panel instead, which is the shape that survives an area
// being half built. It went out with Track, the last one that was empty.

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
