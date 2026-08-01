"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookCover } from "@/components/shelf/book-cover";
import { BookDetailsDialog } from "@/components/shelf/book-details-dialog";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import { BookToolsDialog } from "@/components/shelf/book-tools-dialog";
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
  hasCover,
  migrateLegacy,
  restoreBook,
  trashBook,
  type Book,
  type BookView,
} from "@/lib/library-store";
import { relativeTime } from "@/lib/relative-time";
import {
  useActivity,
  useCover,
  useHydrated,
  useShelf,
} from "@/lib/use-library";
import { pace, streak } from "@/lib/activity";
import { storeReadiness, type ReadinessIssue } from "@/lib/publishing";
import { progressOf, roadmapFor } from "@/lib/roadmap";
import { shelfIcons } from "@/components/shelf/shelf-icons";
import {
  Menu,
  MenuButton,
  MenuLabel,
  MenuLink,
  MenuSeparator,
} from "@/components/ui/menu";

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

const AREAS: {
  id: Area;
  label: string;
  live: boolean;
  blurb: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "overview",
    label: "Overview",
    live: true,
    blurb: "Where the book is, and what to do next.",
    icon: shelfIcons.overview,
  },
  {
    id: "write",
    label: "Write",
    live: true,
    blurb: "Draft it, and keep it safe. One part of the job.",
    icon: shelfIcons.write,
  },
  {
    id: "prepare",
    label: "Prepare",
    live: true,
    blurb: "Get it out without paying to find out what was wrong.",
    icon: shelfIcons.prepare,
  },
  {
    id: "track",
    label: "Track",
    live: true,
    blurb: "What the book cost against what it earned.",
    icon: shelfIcons.track,
  },
  {
    id: "learn",
    label: "Learn",
    live: true,
    blurb: "The order to do things in, and what a shop expects.",
    icon: shelfIcons.learn,
  },
  {
    id: "tools",
    label: "Tools",
    live: true,
    blurb: "The small jobs that cost a fortune elsewhere.",
    icon: shelfIcons.tools,
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
    // The cover checker has moved out of this list — it is built, on the
    // covers page under the wall.
    // Comp titles has moved out of this list — it is built. See the Tools area
    // below, which now lists it as working and links to it per book.
    // The blurb workshop has moved out of this list — it is built. See the
    // Tools area, which links to it per book.
    // Category suggestions has moved out of this list — it is built.
    // The title check has moved out of this list — it is built.
    // Paperback setup has moved out of this list — it is built.
    // The ARC tracker has moved out of this list — it is built, and it landed
    // in Track rather than here: reviews and money are the two halves of what
    // happens to a book after it goes out, and a writer chasing one is usually
    // looking at the other.
    // The story bible has moved out of this list — it is built, in the
    // editor's Story bible tab. Series-wide and AI-filled are still to come.
    // Version history has moved out of this list — it is built, in the
    // editor's Versions tab.
    // Writing provenance has moved out of this list — it is built, as the
    // Writing record. What is *not* built, and is not going in this list
    // either, is a C2PA signature: its value is a chain to a certificate
    // authority, and signing with a key we ship in the browser would produce a
    // file that looks like the real thing and carries none of its weight.
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
  const [tooling, setTooling] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<BookView>("active");
  const [dialog, setDialog] = useState<
    "templates" | "help" | "support" | "sounds" | "import" | null
  >(null);

  /**
   * `/` puts the caret in the search box, the convention every list-shaped app
   * shares. Ignored while the writer is already in a field, or typing a date
   * into the advance-copies form would jump them somewhere else mid-word.
   */
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    const byRecent = [...active].sort(
      (a, b) => b.lastOpenedAt - a.lastOpenedAt,
    );
    return (
      byRecent.find((b) => b.id === shelf.lastOpenedBookId) ??
      byRecent[0] ??
      null
    );
  }, [active, shelf.lastOpenedBookId]);

  const handleTrash = (book: Book) => {
    if (window.confirm(`Move “${book.title}” to the trash?`))
      trashBook(book.id);
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
      {/* The rail is three groups rather than one list with everything else
          shoved to the bottom by `mt-auto`. That arrangement left a hand's
          width of empty panel between Tools and Help on any normal screen,
          which reads as an unfinished sidebar; and it filed Templates and
          Background sound — two extras — beside Help and Pricing, which are
          chrome. Grouping says which is which and closes the hole. */}
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-panel px-3 pt-4 pb-14 md:flex">
        <Link
          href="/"
          className="mb-6 px-2 text-2xl font-extrabold tracking-tight text-fg"
        >
          Open<span className="text-accent">Chapter</span>
        </Link>

        <nav className="flex flex-col gap-0.5">
          {AREAS.map((a) => (
            <SideItem
              key={a.id}
              icon={a.icon}
              active={area === a.id}
              onClick={() => setArea(a.id)}
            >
              {a.label}
            </SideItem>
          ))}
        </nav>

        <div className="my-3 h-px bg-line" />

        <SideGroup label="Extras" />
        <div className="flex flex-col gap-0.5">
          <SideItem
            icon={shelfIcons.template}
            onClick={() => setDialog("templates")}
          >
            Templates
          </SideItem>
          <SideItem icon={shelfIcons.sound} onClick={() => setDialog("sounds")}>
            Background sound
          </SideItem>
        </div>

        <div className="mt-auto flex flex-col gap-0.5 pt-6">
          <SideItem icon={shelfIcons.help} onClick={() => setDialog("help")}>
            Help
          </SideItem>
          <SideItem
            icon={shelfIcons.support}
            onClick={() => setDialog("support")}
          >
            Support
          </SideItem>
          <SideItem icon={shelfIcons.pricing} href="/upgrade">
            Pricing
          </SideItem>
        </div>
      </aside>

      {/* ---- The area ------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto">
        {/* The bar keeps its full-width background and border — a sticky
            header that stopped short of the edges would tear as the page
            scrolled under it — but its *contents* sit in the same max-w-6xl
            column as the page, so the search lines up with the heading below
            and the account chip lines up with the right edge of the cards. */}
        <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
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

            {/* Capped rather than `flex-1`. At full width it was the loudest
              thing on the screen, and it is a filter for one list, not the
              product's main verb. */}
            <div className="relative min-w-[8rem] max-w-sm flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                {shelfIcons.search}
              </span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  // The results live in Write. Searching from Overview used to
                  // filter a list nobody could see, so the box appeared broken.
                  if (e.target.value.trim()) setArea("write");
                }}
                placeholder="Search your books"
                aria-label="Search your books"
                className="w-full rounded-lg border border-line bg-surface py-2 pr-12 pl-9
                         text-sm text-fg outline-none focus-visible:ring-2
                         focus-visible:ring-accent/50"
              />
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-2.5 my-auto flex h-5
                         items-center rounded border border-line bg-raised px-1.5
                         text-[11px] font-medium text-muted"
              >
                /
              </kbd>
            </div>

            {/* A split button. New book is the verb; import and templates are
              two other ways to arrive at the same place, and three peer
              buttons in a header made none of them read as the main one. */}
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-stretch">
                <Link
                  href="/book/new"
                  className="flex items-center gap-1.5 rounded-l-lg bg-accent py-2 pr-3 pl-3.5
                         text-sm font-semibold text-white"
                >
                  {shelfIcons.plus}
                  New book
                </Link>
                <span aria-hidden="true" className="w-px bg-white/25" />
                <Menu
                  label="Other ways to start a book"
                  align="end"
                  width={248}
                  triggerClassName="flex items-center rounded-r-lg bg-accent px-1.5 text-white"
                  trigger={shelfIcons.chevron}
                >
                  {(close) => (
                    <>
                      <MenuLabel>Start a book</MenuLabel>
                      <MenuLink
                        href="/book/new"
                        icon={shelfIcons.plus}
                        onNavigate={close}
                      >
                        Blank book
                      </MenuLink>
                      <MenuButton
                        icon={shelfIcons.upload}
                        onClick={() => {
                          setDialog("import");
                          close();
                        }}
                      >
                        Import a file…
                      </MenuButton>
                      <MenuButton
                        icon={shelfIcons.template}
                        onClick={() => {
                          setDialog("templates");
                          close();
                        }}
                      >
                        From a template
                      </MenuButton>
                    </>
                  )}
                </Menu>
              </div>

              <AccountMenu account={account} />
            </div>
          </div>
        </header>

        {/* Capped, so the cards do not stretch to a metre wide on a desktop
            monitor and leave the eye travelling between a number and its
            label. */}
        <main className="mx-auto max-w-6xl px-6 pb-16">
          {/* One block. The heading and its line used to be two siblings with
              `mb-8` and `-mt-6` cancelling each other out — a spacing bug
              waiting to be inherited by the next area added. */}
          <div className="mt-8 mb-7">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-fg">{meta.label}</h1>
              {!meta.live && <Badge>Not built yet</Badge>}
            </div>
            <p className="mt-1.5 text-muted">{meta.blurb}</p>
          </div>

          {area === "overview" && (
            <Overview
              current={current}
              books={active.length}
              words={totals.words}
              chapters={totals.chapters}
              onGo={setArea}
              onDetails={setEditing}
              onCover={setCovering}
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
              onTools={setTooling}
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
      {tooling && (
        <BookToolsDialog book={tooling} onClose={() => setTooling(null)} />
      )}
      {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} />}
      {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === "support" && (
        <SupportDialog onClose={() => setDialog(null)} />
      )}
      {/* Both are complete features pointed at this dialog on purpose — see
          TODO.md. Re-pointing the button is the whole of switching either on. */}
      {dialog === "templates" && (
        <ComingSoonDialog title="Templates" onClose={() => setDialog(null)}>
          Start a book from a chapter skeleton instead of a blank page. Built,
          and held back until we have decided what the templates should be.
        </ComingSoonDialog>
      )}
      {dialog === "sounds" && (
        <ComingSoonDialog
          title="Background sound"
          onClose={() => setDialog(null)}
        >
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
  onDetails,
  onCover,
}: {
  current: Book | null;
  books: number;
  words: number;
  chapters: number;
  onGo: (a: Area) => void;
  onDetails: (b: Book) => void;
  onCover: (b: Book) => void;
}) {
  const activity = useActivity();

  /**
   * Momentum, not totals.
   *
   * The three numbers here were books, words and chapters — facts about the
   * library that change by a rounding error in a week and answer no question a
   * writer actually has on opening the app. `activity.ts` has been recording
   * net words per day all along, and "did I write this week" is the question
   * the screen is being asked.
   */
  const week = useMemo(() => pace(activity, 7), [activity]);
  const month = useMemo(() => pace(activity, 30), [activity]);
  const run = useMemo(() => streak(activity), [activity]);

  /**
   * Whether the day log has anything in it at all.
   *
   * Not "did they write this month" — a writer back after a fallow summer has
   * a log worth showing and a zero week is a true fact about them. This is the
   * narrower question of whether the log has ever recorded a day, which is the
   * only case where three zeros would misrepresent the shelf behind them.
   */
  const logged = useMemo(
    () => Object.values(activity).some((n) => n !== 0),
    [activity],
  );

  /**
   * The next unfinished step for the book being offered.
   *
   * `roadmapFor` works most of it out from the book itself, so this is not a
   * checklist somebody has to maintain — it is the same answer the roadmap
   * page gives, surfaced where the writer already is.
   */
  const next = useMemo(
    () =>
      current
        ? progressOf(roadmapFor(current, current.roadmapDone ?? []))
        : null,
    [current],
  );

  return (
    <div className="flex flex-col gap-5">
      {current ? (
        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="flex flex-wrap items-start gap-5 p-5">
            <Link
              href={`/book/${current.id}`}
              className="w-[92px] shrink-0 transition-transform hover:-translate-y-0.5"
            >
              <CoverOf book={current} />
            </Link>

            <div className="min-w-[14rem] flex-1">
              <p className="text-xs font-bold tracking-widest text-muted uppercase">
                Pick up where you left off
              </p>
              <p className="mt-1.5 text-xl font-bold text-fg">
                {current.title}
              </p>
              <p className="mt-1 text-sm text-muted">
                {plural(bookChapterCount(current), "chapter")} ·{" "}
                {bookWordCount(current).toLocaleString()} words · opened{" "}
                {relativeTime(current.lastOpenedAt)}
              </p>

              {/* Only when the writer set a goal. A bar against a target we
                  invented would be the made-up number this app keeps
                  refusing to print. */}
              {current.targetWords ? (
                <TargetBar
                  words={bookWordCount(current)}
                  target={current.targetWords}
                />
              ) : null}

              {/* One primary, one secondary, everything else behind ⋯. Four
                  buttons of equal weight made the writer read all four to
                  find the one they wanted, every single time. */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/book/${current.id}`}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2
                             font-semibold text-white"
                >
                  {shelfIcons.write}
                  Continue writing
                </Link>
                <Link
                  href={`/book/${current.id}/read`}
                  className="flex items-center gap-1.5 rounded-lg border border-line
                             bg-surface px-4 py-2 font-semibold text-fg"
                >
                  {shelfIcons.read}
                  Read
                </Link>
                <Menu
                  label={`More for ${current.title}`}
                  width={232}
                  triggerClassName="flex items-center rounded-lg border border-line
                                    bg-surface px-2.5 py-2 text-fg"
                  trigger={shelfIcons.more}
                >
                  {(close) => (
                    <>
                      <MenuLabel>Prepare</MenuLabel>
                      <MenuLink
                        href={`/book/${current.id}/export`}
                        icon={shelfIcons.prepare}
                        onNavigate={close}
                      >
                        Export and publish
                      </MenuLink>
                      <MenuLink
                        href={`/book/${current.id}/roadmap`}
                        icon={shelfIcons.compass}
                        onNavigate={close}
                      >
                        What to do next
                      </MenuLink>
                      <MenuSeparator />
                      <MenuLabel>This book</MenuLabel>
                      <MenuButton
                        icon={shelfIcons.info}
                        onClick={() => {
                          onDetails(current);
                          close();
                        }}
                      >
                        Details
                      </MenuButton>
                      <MenuButton
                        icon={shelfIcons.image}
                        onClick={() => {
                          onCover(current);
                          close();
                        }}
                      >
                        Change cover
                      </MenuButton>
                    </>
                  )}
                </Menu>
              </div>
            </div>
          </div>

          {/* The next step, on the rail of the card that asked "what now?".
              It is the roadmap's own answer rather than a second opinion. */}
          {next?.next && (
            <Link
              href={`/book/${current.id}/roadmap`}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line
                         bg-surface px-5 py-3 text-sm"
            >
              <span className="font-semibold text-accent">Next</span>
              <span className="text-fg">{next.next.title}</span>
              <span className="ml-auto text-xs text-muted">
                {next.done} of {next.total} done
              </span>
            </Link>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-line bg-panel p-8 text-center">
          <p className="text-lg font-bold text-fg">Nothing on the shelf yet</p>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Start typing and name the book later, or bring in a .docx, .epub,
            .md, .txt or .html file.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/book/new"
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white"
            >
              Start a book
            </Link>
            <Link
              href="/book/import"
              className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg"
            >
              Import a file
            </Link>
          </div>
        </section>
      )}

      {/* Three zeros beside a shelf of finished books is a lie by arithmetic:
          the day log only started when it shipped, so a writer with 6,000 words
          behind them opens this and reads that they have written nothing. Until
          there is a single logged day, the momentum cards are one card that
          says why they are empty. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {logged ? (
          <>
            <Stat
              icon={shelfIcons.write}
              value={week.words.toLocaleString()}
              label="words this week"
              note={
                week.daysWritten > 0
                  ? `across ${week.daysWritten} ${week.daysWritten === 1 ? "day" : "days"}`
                  : "nothing yet this week"
              }
            />
            <Stat
              icon={shelfIcons.calendar}
              value={String(run)}
              label={run === 1 ? "day running" : "days running"}
              // Stated, never scolded. The research was explicit about how
              // writers feel regarding apps that turn a streak into a stick.
              note={run > 0 ? "keep it or don't" : "a broken streak is fine"}
            />
            <Stat
              icon={shelfIcons.target}
              value={String(month.daysWritten)}
              label="days in the last 30"
              note={
                month.daysWritten > 0
                  ? `${month.perWritingDay.toLocaleString()} words on a day you write`
                  : "the log is waiting"
              }
            />
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-panel px-5 py-4 sm:col-span-2 lg:col-span-3">
            <div className="flex items-center gap-2 text-muted">
              {shelfIcons.calendar}
              <p className="text-sm font-medium">No writing log yet</p>
            </div>
            <p className="mt-1.5 text-sm text-fg">
              It starts the first time you write here and counts net words a day
              — so a day of cutting counts too.
            </p>
            <p className="mt-1 text-xs text-muted">
              Anything already on your shelf was written before the log existed,
              which is why it is not in here.
            </p>
          </div>
        )}

        <Stat
          icon={shelfIcons.overview}
          value={String(books)}
          label={books === 1 ? "book" : "books"}
          note={`${words.toLocaleString()} words · ${chapters} chapters`}
        />
      </div>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-bold text-fg">The rest of the job</h2>
        {/* Was "Two work today; three are what we are building" — untrue since
            the last five features shipped, and exactly the kind of stale claim
            the house rules exist to catch. All five areas work. */}
        <p className="mt-1 mb-4 text-muted">
          Writing is one part. These are the others, and all five of them work
          today.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.filter((a) => a.id !== "overview").map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onGo(a.id)}
              className="group rounded-xl border border-line bg-surface p-4 text-left
                         transition-colors hover:border-accent/40"
            >
              <span className="flex items-center gap-2">
                <span className="text-muted group-hover:text-accent">
                  {a.icon}
                </span>
                <span className="font-bold text-fg">{a.label}</span>
                {!a.live && <Badge>Planned</Badge>}
              </span>
              <span className="mt-1.5 block text-sm text-muted">{a.blurb}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Words against the goal the writer set.
 *
 * Capped at 100% so a book that overshoots does not draw a bar out of its own
 * box, and it says the raw pair as well as the percentage — a writer past their
 * target wants to see by how much, not a full bar that stops telling them
 * anything.
 */
function TargetBar({ words, target }: { words: number; target: number }) {
  const share = Math.min(100, Math.round((words / target) * 100));
  return (
    <div className="mt-3.5 max-w-sm">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-fg">{share}% of target</span>
        <span className="text-muted">
          {words.toLocaleString()} of {target.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${share}%` }}
        />
      </div>
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
  onTools,
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
  /** Opens the sheet holding every per-book tool. */
  onTools: (b: Book) => void;
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
                    {plural(bookChapterCount(book), "chapter")} ·{" "}
                    {bookWordCount(book).toLocaleString()} words
                  </p>
                  <p className="text-xs text-muted">
                    Opened {relativeTime(book.lastOpenedAt)}
                  </p>
                </div>
              </div>
              {/* Two verbs and a menu, where there were twenty-one chips.
                  Nothing had weight before: Write and Trash were the same
                  size and colour, and a pill has room for a name but not for
                  what the thing is. */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                {view === "active" ? (
                  <>
                    <Link
                      href={`/book/${book.id}`}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5
                                 text-sm font-semibold text-white"
                    >
                      {shelfIcons.write}
                      Write
                    </Link>
                    <Link
                      href={`/book/${book.id}/read`}
                      className="flex items-center gap-1.5 rounded-lg border border-line
                                 bg-surface px-3.5 py-1.5 text-sm font-semibold text-fg"
                    >
                      {shelfIcons.read}
                      Read
                    </Link>
                    <Menu
                      label={`More for ${book.title}`}
                      align="end"
                      width={244}
                      triggerClassName="ml-auto flex items-center rounded-lg border
                                        border-line bg-surface px-2 py-1.5 text-fg"
                      trigger={shelfIcons.more}
                    >
                      {(close) => (
                        <>
                          <MenuLink
                            href={`/book/${book.id}/export`}
                            icon={shelfIcons.prepare}
                            onNavigate={close}
                          >
                            Export and publish
                          </MenuLink>
                          <MenuLink
                            href={`/book/${book.id}/roadmap`}
                            icon={shelfIcons.compass}
                            onNavigate={close}
                          >
                            What to do next
                          </MenuLink>
                          {/* The other thirteen live behind this rather than
                              on the card, where they were a wall of names with
                              nothing to say what any of them did. */}
                          <MenuButton
                            icon={shelfIcons.tools}
                            onClick={() => {
                              onTools(book);
                              close();
                            }}
                          >
                            All tools for this book…
                          </MenuButton>

                          <MenuSeparator />
                          <MenuButton
                            icon={shelfIcons.info}
                            onClick={() => {
                              onDetails(book);
                              close();
                            }}
                          >
                            Details
                          </MenuButton>
                          <MenuButton
                            icon={shelfIcons.image}
                            onClick={() => {
                              onCover(book);
                              close();
                            }}
                          >
                            Change cover
                          </MenuButton>

                          {/* Below the line, and the destructive one is
                              coloured — both of these sat in the same grey as
                              Write, one pill away from it. */}
                          <MenuSeparator />
                          <MenuButton
                            icon={shelfIcons.archive}
                            onClick={() => {
                              archiveBook(book.id);
                              close();
                            }}
                          >
                            Archive
                          </MenuButton>
                          <MenuButton
                            danger
                            icon={shelfIcons.trash}
                            onClick={() => {
                              onTrash(book);
                              close();
                            }}
                          >
                            Move to trash
                          </MenuButton>
                        </>
                      )}
                    </Menu>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => restoreBook(book.id)}
                      className="rounded-lg border border-line bg-surface px-3.5 py-1.5
                                 text-sm font-semibold text-fg"
                    >
                      Restore
                    </button>
                    {view === "trashed" && (
                      <button
                        type="button"
                        onClick={() => onDeleteForever(book)}
                        className="rounded-lg px-3.5 py-1.5 text-sm font-semibold
                                   text-red-600 dark:text-red-400"
                      >
                        Delete for good
                      </button>
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

/**
 * Prepare — what a shop would refuse, before you find out from the shop.
 *
 * This was a list of book titles with an identical "Check and export" button
 * beside each, and the state of every one of them hidden behind that button.
 * On the *one screen* in the app whose entire subject is readiness, a writer
 * could not see which of their books was ready without opening seven pages.
 *
 * `storeReadiness()` is pure and works off the book alone, so the answer can
 * simply be shown. Each row now names its own worst problem, and the strip at
 * the top says how many books would pass today.
 *
 * **It reports the listing half only, and says so.** The blocking checks that
 * need the manuscript — images that will not package, missing alt text — are
 * `checkStoreReadiness()` on the export page, because they have to read every
 * chapter. Counting them here would mean parsing the whole library to draw a
 * list. So a book that reads "Ready" here has nothing wrong with its *details*,
 * which is a narrower claim than "a shop will take it", and the row says which.
 */
function Prepare({ books }: { books: Book[] }) {
  /**
   * Read once per shelf change rather than per render. Cheap on its own —
   * `hasCover` tests for the key instead of fetching a 250KB data URL — but it
   * is a loop over every book and there is no reason to run it on a keystroke.
   */
  const rows = useMemo(
    () =>
      books.map((book) => ({
        book,
        issues: storeReadiness({
          book,
          ...(book.publishing ? { meta: book.publishing } : {}),
          hasCover: hasCover(book.id),
          // Chapters with prose in them. The count is denormalised into the
          // shelf, so this needs no chapter bodies.
          chapterCount: book.chapters.filter((c) => c.words > 0).length,
          // Not knowable without the manuscript; the export page does these.
          brokenImages: 0,
        }),
      })),
    [books],
  );

  const ready = rows.filter(
    (r) => !r.issues.some((i) => i.level === "blocking"),
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {books.length > 0 && (
        <section className="rounded-2xl border border-line bg-panel px-5 py-4">
          <p className="text-fg">
            <strong>
              {ready} of {books.length}
            </strong>{" "}
            {books.length === 1 ? "book has" : "books have"} their listing
            details in order.
          </p>
          <p className="mt-1 text-sm text-muted">
            Title, author, cover and something to publish — the things a shop
            checks before it looks at the file. Open a book to run the rest,
            which has to read the manuscript.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-bold text-fg">Check and export</h2>
        <p className="mt-1 mb-4 text-muted">
          The check names what a shop would refuse and which problems would
          actually stop the upload. It never blocks your export — the file is
          yours whether or not a shop would take it.
        </p>

        {books.length === 0 ? (
          <p className="text-muted">No books yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map(({ book, issues }) => (
              <PrepareRow key={book.id} book={book} issues={issues} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * One book, with its worst problem said out loud.
 *
 * The whole row is the link. A button labelled "Check and export" repeated down
 * a column is the same word seven times and a smaller target than the row it
 * sits in, so the arrow marks it and the row takes the click.
 */
function PrepareRow({
  book,
  issues,
}: {
  book: Book;
  issues: ReadinessIssue[];
}) {
  const blocking = issues.filter((i) => i.level === "blocking");
  const advisory = issues.filter((i) => i.level === "advisory");

  return (
    <li>
      <Link
        href={`/book/${book.id}/export`}
        className="flex items-center gap-4 rounded-xl border border-line bg-surface
                   px-4 py-3 transition-colors hover:border-accent/40"
      >
        <span className="w-9 shrink-0">
          <CoverOf book={book} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-fg">
            {book.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {blocking.length > 0
              ? // The first is the worst — storeReadiness orders them. Naming
                // it beats a count, because "no author name" is a thing a
                // writer can go and fix and "3 issues" is not.
                blocking[0].message
              : advisory.length > 0
                ? advisory[0].message
                : `${plural(bookChapterCount(book), "chapter")} · ${plural(bookWordCount(book), "word")}`}
          </span>
        </span>

        {blocking.length > 0 ? (
          <Flag tone="stop">
            {blocking.length} to fix
            {advisory.length > 0 ? ` · ${advisory.length} more` : ""}
          </Flag>
        ) : advisory.length > 0 ? (
          <Flag tone="note">{advisory.length} worth doing</Flag>
        ) : (
          <Flag tone="ok">Details in order</Flag>
        )}

        <span aria-hidden="true" className="shrink-0 text-muted">
          {shelfIcons.chevronRight}
        </span>
      </Link>
    </li>
  );
}

/**
 * A readiness marker.
 *
 * Colour *and* a word, never colour alone — a red pill and a green pill are the
 * same pill to a red-green colourblind reader, and this is the screen where the
 * difference decides whether they upload.
 */
function Flag({
  tone,
  children,
}: {
  tone: "ok" | "note" | "stop";
  children: ReactNode;
}) {
  const tones = {
    ok: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    note: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
    stop: "bg-red-500/12 text-red-700 dark:text-red-400",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
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
          beside the shelf it has to sit on, and a check on the file a shop will
          receive. <strong className="text-fg">Title</strong> — whether somebody
          else&rsquo;s book turns up first when a reader searches for yours. All
          five read Google Books and Open Library, free, and none of them sends
          anything you have written.{" "}
          <strong className="text-fg">Writing record</strong> — the day-by-day
          trail your work left, for when somebody accuses you of not having
          written it. Evidence rather than proof, and it says so in the document
          it produces.
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
                  <Go href={`/book/${b.id}/provenance`}>Record</Go>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {PLANNED.tools.length > 0 && (
        <Panel title="Coming to this area">
          <PlannedGrid items={PLANNED.tools} />
        </Panel>
      )}
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
 *
 * The two panels are the two halves of what happens to a book once it is out —
 * what it earned, and whether anybody said anything about it.
 */
function Track({ books }: { books: Book[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Who has an advance copy">
        <p className="mb-4 text-muted">
          One launch in the research ran across seven sites and a spreadsheet;
          another writer worked out advance copies mattered only after the book
          was already published. This is the list, with the dates attached — who
          holds it, who read it, and who is late. It does not find readers for
          you, and it does not send anything.
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
                <Go href={`/book/${b.id}/arc`}>Advance copies</Go>
              </li>
            ))}
          </ul>
        )}
      </Panel>

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

/**
 * A number with something to hang it on.
 *
 * The old one was a value and a word. "6,236 words" invites the question it
 * cannot answer — is that a lot, is it more than last week — so every card
 * now carries a second line that says what the figure is *against*.
 */
function Stat({
  value,
  label,
  note,
  icon,
}: {
  value: string;
  label: string;
  note?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-extrabold text-fg">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
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
        primary
          ? "bg-accent text-white"
          : "border border-line bg-surface text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * "1 chapters" was on the shelf for as long as the shelf has existed. Only ever
 * an -s, because every count this is used for takes one.
 */
function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

// `Chip` and `ChipButton` are gone. They existed for the book card's row of
// twenty-one identical pills, and that row is now two buttons and a menu.

/**
 * One rail row, as a button or a link.
 *
 * The active state is a tinted panel with accent text rather than the solid
 * blue bar it replaced. At six items a saturated block is the heaviest thing
 * on the screen and pulls the eye away from the work; the tint is enough to
 * answer "where am I" without competing with the page.
 */
function SideItem({
  icon,
  active,
  href,
  onClick,
  children,
}: {
  icon: ReactNode;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = `flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm
     font-medium transition-colors ${
       active
         ? "bg-accent/10 text-accent"
         : "text-muted hover:bg-raised hover:text-fg"
     }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {icon}
      {children}
    </button>
  );
}

/** A rail section heading. Small, quiet, and only where a group needs naming. */
function SideGroup({ label }: { label: string }) {
  return (
    <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">
      {label}
    </p>
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
