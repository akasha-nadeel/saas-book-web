"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import { BookDetailsDialog } from "@/components/shelf/book-details-dialog";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import { BookToolsDialog } from "@/components/shelf/book-tools-dialog";
import { AccountMenu } from "@/components/auth/account-menu";
import { HelpDialog } from "@/components/shelf/help-dialog";
import { SupportDialog } from "@/components/shelf/support-dialog";
import { FeedbackDialog } from "@/components/shelf/feedback-dialog";
import { ImportDialog } from "@/components/shelf/import-dialog";
import { LoadingScreen } from "@/components/loading-screen";
import { type Account } from "@/lib/account";
import {
  archiveBook,
  bookChapterCount,
  bookWordCount,
  booksIn,
  deleteBook,
  getArcRaw,
  hasCover,
  migrateLegacy,
  restoreBook,
  setRoadmapStep,
  trashBook,
  type Book,
  type BookView,
} from "@/lib/library-store";
import {
  checkup,
  countFindings,
  type FindingLevel,
  type Fix,
} from "@/lib/checkup";
import { relativeTime } from "@/lib/relative-time";
import {
  useActivity,
  useCover,
  useHydrated,
  useLedger,
  useShelf,
} from "@/lib/use-library";
import { pace, streak } from "@/lib/activity";
import {
  isOverdue,
  parseArc,
  summarise as summariseArc,
  type ArcSummary,
} from "@/lib/arc";
import { totals, type Ledger } from "@/lib/ledger";
import { storeReadiness, type ReadinessIssue } from "@/lib/publishing";
import { PHASES, progressOf, roadmapFor, type Phase } from "@/lib/roadmap";
import { shelfIcons } from "@/components/shelf/shelf-icons";
import { ThemeRow } from "@/components/theme/theme-toggle";
import { ToolGrid } from "@/components/shelf/tool-grid";
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
 * So this is a hub with five areas — Overview, Write, Prepare, Track, Tools —
 * and **Write is one of them**. The arrangement is the argument: a writer
 * opening this should see immediately that the app has an opinion about the
 * whole job, not just the manuscript.
 *
 * **Overview is a diagnosis, not a greeting.** It used to open on "Pick up
 * where you left off" and end with four tiles, three of which counted words —
 * a writing app's dashboard on a product whose whole argument is that writing
 * is one part of the job. The person arriving usually *has* a book, often
 * finished, often imported, and came because they do not know what is standing
 * between it and a shop. A word count and a Continue writing button answer a
 * question they did not ask.
 *
 * So the card is now: which book this is about (changeable — the last one
 * opened is often not the one with the problem), what state it is in, and then
 * **the findings** — what is actually wrong with it, worst first, each with the
 * button that fixes it. `checkup()` decides every part of that and is pure and
 * tested; this file chooses only how it looks.
 *
 * Under the findings, and deliberately under them, is the road: the five phase
 * dials and the roadmap's own next step. Both are "what next" and they are
 * different questions — the findings are what is wrong with the *book*, the
 * step is where you are on the *road* — so they are stacked rather than set
 * side by side, where the writer had to work out which one to obey.
 *
 * Every block still has to answer a question nothing else does; that is the
 * rule that removed the grid of area cards, which were four buttons
 * duplicating four rail items on screen at the same time. The findings are the
 * near miss — the Prepare area lists readiness book by book — and they stay
 * distinct because this is one book examined in depth and that is every book at
 * a glance. When there are more findings than fit, this points at the export
 * screen rather than growing into it.
 *
 * There were six. **Learn is gone**: it had become a per-book list of roadmap
 * progress with a menu of four tools hanging off it, which is the roadmap page
 * told thinly, plus four links that are also in Tools. Two screens answering
 * one question is one screen to forget to update, and the roadmap is the one
 * that actually answers it — so the rail item went and the roadmap kept the
 * job. Nothing was deleted but the index.
 *
 * **All six areas are real, and nothing on this screen is a preview.** Every
 * feature the dashboard names is built and works; there is no longer a
 * "Coming to this area" panel anywhere, because there is nothing to put in one.
 * The house rule still stands for the next thing that ships half-finished — a
 * control either works or plainly says it is not built — and `Badge` is kept
 * for it. Pending work lives in TODO.md, which is where it can be read in full
 * rather than glimpsed as a grey card.
 */

type Area = "overview" | "write" | "prepare" | "track" | "tools";

const AREAS: {
  id: Area;
  label: string;
  live: boolean;
  blurb: string;
  icon: React.ReactNode;
  /**
   * A stage in the book's life rather than something you consult.
   *
   * Overview, Write, Prepare and Track happen in that order; Tools is open at
   * any point. The rail draws the two apart on this, so the order in this array
   * stays the order on screen and the flag is the only thing to change if an
   * area ever moves between them.
   */
  stage: boolean;
}[] = [
  {
    id: "overview",
    label: "Overview",
    live: true,
    blurb: "What stands between your book and a shop, and what to do about it.",
    icon: shelfIcons.overview,
    stage: true,
  },
  {
    id: "write",
    label: "Write",
    live: true,
    blurb: "Draft it, and keep it safe. One part of the job.",
    icon: shelfIcons.write,
    stage: true,
  },
  {
    id: "prepare",
    label: "Prepare",
    live: true,
    blurb: "Get it out without paying to find out what was wrong.",
    icon: shelfIcons.prepare,
    stage: true,
  },
  {
    id: "track",
    label: "Track",
    live: true,
    blurb: "What the book cost against what it earned.",
    icon: shelfIcons.track,
    stage: true,
  },
  {
    id: "tools",
    label: "Tools",
    live: true,
    blurb: "The small jobs that cost a fortune elsewhere.",
    icon: shelfIcons.tools,
    stage: false,
  },
];

// `PLANNED` is gone. It held the unbuilt features, per area, as dead cards
// under a badge — and it emptied as they shipped. The last entry was the
// book-three curve, which is not waiting on work: it needs more than one book's
// ledger before it can say anything, and that is the writer's data rather than
// ours to produce. TODO.md keeps it, with the reasoning.
//
// The mechanism is worth rebuilding the day something ships half-finished: the
// house rule is that a control either works or plainly says it is not built,
// and an unbuilt feature belongs on the screen saying so rather than hidden.
// `Badge` is still here for it.

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

  /**
   * Which area is open, taken from `?area=` and written back to it.
   *
   * Two things needed this. A tool page is a whole screen with none of the
   * dashboard on it, so coming back has to land on the area the writer left
   * rather than dumping them on Overview — and without a URL there was nothing
   * for a link to aim at. A reload used to lose the area for the same reason.
   *
   * `useSearchParams` rather than reading `window.location` in a lazy
   * initialiser, which was tried and is wrong: on a client navigation the
   * router renders the new page before the History API has caught up, so the
   * initialiser saw the *previous* URL and the area arrived as Overview every
   * time. This hook is fed by the router and is correct during the navigation
   * that sets it.
   */
  const params = useSearchParams();
  const asked = params.get("area");
  const [picked, setPicked] = useState<Area | null>(null);

  // What the URL says, until the writer clicks something. After that their
  // click wins — retyping the URL on every tab change would stack history
  // entries and make the back button walk the tabs instead of leaving.
  const area: Area =
    picked ??
    (AREAS.some((a) => a.id === asked) ? (asked as Area) : "overview");
  const setArea = setPicked;
  const [editing, setEditing] = useState<Book | null>(null);
  const [covering, setCovering] = useState<Book | null>(null);
  const [tooling, setTooling] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<BookView>("active");
  const [dialog, setDialog] = useState<
    "help" | "support" | "feedback" | "import" | null
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

        {/* Two groups, because there are two kinds of item here and the flat
            list said so nowhere. Overview, Write, Prepare and Track are the
            arc of a book's life, in the order it happens. Tools is not a
            stage — you open it at any point — so a rule separates it rather
            than letting the eye read five equal steps and expect Tools to come
            after Track. */}
        <nav className="flex flex-col gap-0.5">
          {AREAS.filter((a) => a.stage).map((a) => (
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

        <nav className="flex flex-col gap-0.5">
          {AREAS.filter((a) => !a.stage).map((a) => (
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

        {/* Getting help, then giving it back, then the account. Help before
            Support because Support's own first line points at the guide, and
            Feedback after both because it is the other direction: nothing
            comes back, and a writer reaching for it is not stuck. */}
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
          <SideItem
            icon={shelfIcons.feedback}
            onClick={() => setDialog("feedback")}
          >
            Send feedback
          </SideItem>
          <SideItem icon={shelfIcons.pricing} href="/upgrade">
            Pricing
          </SideItem>

          {/* Last, and not a SideItem: the four above go somewhere, this one
              changes what you are looking at. Separated by a rule for the same
              reason — a control that acts on the app itself is a different kind
              of thing from a list of places. */}
          <ThemeRow className="mt-2 border-t border-line px-3 pt-3" />
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
                         text-sm font-semibold text-accent-ink"
                >
                  {shelfIcons.plus}
                  New book
                </Link>
                <span aria-hidden="true" className="w-px bg-white/25" />
                <Menu
                  label="Other ways to start a book"
                  align="end"
                  width={248}
                  triggerClassName="flex items-center rounded-r-lg bg-accent px-1.5 text-accent-ink"
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
              all={active}
              books={active.length}
              words={totals.words}
              chapters={totals.chapters}
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
              onClearSearch={() => setQuery("")}
              onDetails={setEditing}
              onCover={setCovering}
              onTrash={handleTrash}
              onDeleteForever={handleDeleteForever}
              onTools={setTooling}
            />
          )}

          {area === "prepare" && <Prepare books={active} />}

          {area === "tools" && <Tools books={active} current={current} />}

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
      {dialog === "feedback" && (
        <FeedbackDialog onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/* ---- Areas --------------------------------------------------------------- */

/**
 * How many findings the card shows before it points at the full check.
 *
 * Five is about a screen's worth. A dashboard that lists eleven problems is
 * not a dashboard, it is the export screen with a different heading — and the
 * point of this one is that a writer can read it in a glance and know what to
 * press.
 */
const FINDINGS_SHOWN = 5;

/** What a book is *doing*, in the writer's terms rather than the roadmap's. */
const PHASE_STATE: Record<Phase, string> = {
  write: "Drafting",
  revise: "Revising",
  prepare: "Getting it ready",
  launch: "Before you publish",
  publish: "Publishing",
};

function Overview({
  current,
  all,
  books,
  words,
  chapters,
  onDetails,
  onCover,
}: {
  current: Book | null;
  /** Every active book, for the things that are only true across the shelf. */
  all: Book[];
  books: number;
  words: number;
  chapters: number;
  onDetails: (b: Book) => void;
  onCover: (b: Book) => void;
}) {
  const activity = useActivity();

  /**
   * Advance readers whose date has gone, across every book.
   *
   * The one thing on this screen that is *urgent* rather than merely true. A
   * date that has passed is unambiguous — no judgement, no threshold, nothing
   * inferred — which is what makes it safe to raise here. Readiness problems
   * are deliberately not raised: a writer on chapter three has no ISBN and
   * that is not a problem, and a dashboard that says so every morning is the
   * scold the research warned about.
   *
   * Read straight from the store rather than through `useArc`, because a hook
   * cannot be called in a loop and there is one list per book. They are names
   * and dates, so this is nothing like reading covers.
   */
  // Read once when the screen opens, not in the memo: `Date.now()` during
  // render is a different answer every pass, so whether a reader is late would
  // depend on which unrelated state change last re-rendered the dashboard.
  // Once per visit is also the right cadence — lateness turns over at midnight.
  const [now] = useState(() => Date.now());

  /** Advance readers per book. One read, used by the checkup and by `late`. */
  const readers = useMemo(
    () => new Map(all.map((b) => [b.id, parseArc(getArcRaw(b.id))])),
    [all],
  );

  const late = useMemo(() => {
    return all
      .map((b) => ({
        book: b,
        count: (readers.get(b.id) ?? []).filter((r) => isOverdue(r, now))
          .length,
      }))
      .filter((row) => row.count > 0);
  }, [all, readers, now]);

  /**
   * Momentum, not totals.
   *
   * The three numbers here were books, words and chapters — facts about the
   * library that change by a rounding error in a week and answer no question a
   * writer actually has on opening the app. `activity.ts` has been recording
   * net words per day all along, and "did I write this week" is the question
   * the screen is being asked.
   */
  // The thirty-day figure went with the tile that carried it. The Progress
  // tool has the full picture, per book and with a finish date; this screen
  // needs one line about whether there is movement.
  const week = useMemo(() => pace(activity, 7), [activity]);
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
   * Which book this screen is about.
   *
   * The last one opened until the writer says otherwise, and *sticky* after
   * that: a diagnosis you cannot hold still is one you cannot work through,
   * and with seven books on the shelf the one most recently opened is often
   * not the one with the problem.
   */
  const [picked, setPicked] = useState<string | null>(null);
  const book = useMemo(
    () => all.find((b) => b.id === picked) ?? current,
    [all, picked, current],
  );

  /**
   * The diagnosis: what is wrong with this book, and where each is fixed.
   *
   * `checkup` is pure and tested, and it is the whole of the thinking — this
   * component decides nothing about severity, order or destinations. Cheap
   * enough to run on a shelf change: `hasCover` tests for the key rather than
   * fetching a 250KB data URL, the chapter count is denormalised into the
   * shelf, and no manuscript is parsed to draw this screen.
   */
  const findings = useMemo(
    () =>
      book
        ? checkup({
            book,
            hasCover: hasCover(book.id),
            chapterCount: book.chapters.filter((c) => c.words > 0).length,
            arcCount: readers.get(book.id)?.length ?? 0,
          })
        : [],
    [book, readers],
  );
  const counts = useMemo(() => countFindings(findings), [findings]);

  const steps = useMemo(
    () => (book ? roadmapFor(book, book.roadmapDone ?? []) : []),
    [book],
  );
  const progress = useMemo(
    () => (steps.length > 0 ? progressOf(steps) : null),
    [steps],
  );

  return (
    <div className="flex flex-col gap-5">
      {book ? (
        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="flex flex-wrap items-start gap-5 p-5">
            <Link
              href={`/book/${book.id}`}
              className="w-[92px] shrink-0 transition-transform hover:-translate-y-0.5"
            >
              <CoverOf book={book} />
            </Link>

            <div className="min-w-[16rem] flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  {/* The state of the book, not a greeting. This was "Pick up
                      where you left off", which made the largest block on the
                      first screen a writing prompt — wrong for most people who
                      arrive, who already have a manuscript and want to know
                      what is standing between it and a shop. */}
                  <p className="text-xs font-bold tracking-widest text-muted uppercase">
                    {progress?.next
                      ? PHASE_STATE[progress.next.phase]
                      : "Every step done"}
                  </p>
                  <p className="mt-1.5 text-xl font-bold text-fg">
                    {book.title}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {plural(bookChapterCount(book), "chapter")} ·{" "}
                    {bookWordCount(book).toLocaleString()} words · opened{" "}
                    {relativeTime(book.lastOpenedAt)}
                  </p>
                </div>

                {/* Which book is being diagnosed, changeable from here.

                    The screen used to be about whichever book was opened last,
                    with no way to say otherwise — and the book you opened last
                    is very often not the one with the problem. Seven books and
                    no switch meant opening one just to be told about it. */}
                {all.length > 1 && (
                  <Menu
                    label="Choose which book this is about"
                    align="end"
                    width={260}
                    triggerClassName="flex shrink-0 items-center gap-1.5 rounded-lg border
                                      border-line bg-surface px-3 py-1.5 text-xs
                                      font-semibold text-fg"
                    trigger={
                      <>
                        Change book
                        {shelfIcons.chevron}
                      </>
                    }
                  >
                    {(close) => (
                      <>
                        <MenuLabel>Your books</MenuLabel>
                        {all.map((b) => (
                          <MenuButton
                            key={b.id}
                            icon={
                              b.id === book.id ? (
                                shelfIcons.check
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="block h-[18px] w-[18px]"
                                />
                              )
                            }
                            onClick={() => {
                              setPicked(b.id);
                              close();
                            }}
                          >
                            {b.title}
                          </MenuButton>
                        ))}
                      </>
                    )}
                  </Menu>
                )}
              </div>

              {/* Only when the writer set a goal. A bar against a target we
                  invented would be the made-up number this app keeps
                  refusing to print. */}
              {book.targetWords ? (
                <TargetBar
                  words={bookWordCount(book)}
                  target={book.targetWords}
                />
              ) : null}

              {/* ---- The diagnosis ---------------------------------------

                  The thing the screen is for. Everything here comes from
                  `checkup`, which is pure and tested and decides all of it —
                  severity, order, and where each one is put right. This
                  component chooses nothing except how it looks.

                  There is no score. A percentage or a grade out of ten would be
                  the invented number this app refuses everywhere else, and on
                  the first screen a writer sees it would be the most damaging
                  place to print one. Two counts and a list of real problems say
                  more and claim less. */}
              <div className="mt-4">
                <p className="text-sm">
                  {counts.fix > 0 ? (
                    <>
                      <strong className="text-fg">
                        {plural(counts.fix, "thing")}
                      </strong>{" "}
                      <span className="text-muted">
                        would stop a shop taking this
                      </span>
                    </>
                  ) : (
                    <span className="text-fg">
                      <strong>Nothing here would stop a shop</strong> taking it.
                    </span>
                  )}
                  {counts.note > 0 && (
                    <span className="text-muted">
                      {" · "}
                      {counts.note} worth doing
                    </span>
                  )}
                </p>

                {findings.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {findings.slice(0, FINDINGS_SHOWN).map((finding) => (
                      <li
                        key={finding.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl
                                   border border-line bg-surface px-3.5 py-3"
                      >
                        <div className="min-w-[12rem] flex-1">
                          <p className="text-sm font-semibold text-fg">
                            {finding.title}
                          </p>
                          <p className="text-sm text-muted">{finding.why}</p>
                        </div>
                        <FixLink
                          book={book}
                          fix={finding.fix}
                          level={finding.level}
                          onCover={onCover}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    The listing details are in order. The checks that need the
                    manuscript itself run on the export screen.
                  </p>
                )}

                {findings.length > FINDINGS_SHOWN && (
                  <Link
                    href={`/book/${book.id}/export`}
                    className="mt-2.5 inline-block text-sm font-semibold text-accent"
                  >
                    {findings.length - FINDINGS_SHOWN} more, with the full check
                    →
                  </Link>
                )}
              </div>

              {/* One primary, one secondary, everything else behind ⋯. Four
                  buttons of equal weight made the writer read all four to
                  find the one they wanted, every single time. */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/book/${book.id}`}
                  className="flex items-center gap-1.5 rounded-lg border border-line
                             bg-surface px-4 py-2 font-semibold text-fg"
                >
                  {shelfIcons.write}
                  Open book
                </Link>
                <Link
                  href={`/book/${book.id}/read`}
                  className="flex items-center gap-1.5 rounded-lg border border-line
                             bg-surface px-4 py-2 font-semibold text-fg"
                >
                  {shelfIcons.read}
                  Read
                </Link>
                <Menu
                  label={`More for ${book.title}`}
                  width={232}
                  triggerClassName="flex items-center rounded-lg border border-line
                                    bg-surface px-2.5 py-2 text-fg"
                  trigger={shelfIcons.more}
                >
                  {(close) => (
                    <>
                      <MenuLabel>Prepare</MenuLabel>
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
                      <MenuSeparator />
                      <MenuLabel>This book</MenuLabel>
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
                        Book details
                      </MenuButton>
                    </>
                  )}
                </Menu>
              </div>
            </div>
          </div>

          {/* Where this book is across the whole job, and the next thing to
              do — both the roadmap's own answers rather than second opinions.

              The phases are the point, and they are this product's argument
              rendered: writing is one of five, and a writer who has finished
              drafting can see they are a fifth of the way rather than done.
              "2 of 18" said the same thing in a way nobody can picture. */}
          {progress && steps.length > 0 && (
            <div className="border-t border-line bg-surface px-5 py-3.5">
              <Link
                href={`/book/${book.id}/roadmap`}
                className="block"
                aria-label="The whole road, and what each step is for"
              >
                <div className="flex">
                  {PHASES.map((phase, i) => {
                    const inPhase = steps.filter(
                      (st) => st.phase === phase.id,
                    );
                    const done = inPhase.filter((st) => st.done).length;
                    return (
                      <div
                        key={phase.id}
                        className="relative flex min-w-0 flex-1 flex-col items-center"
                      >
                        {/* The line between the rings, drawn from the left edge
                            to this one's centre. It is what makes five dials
                            read as a sequence rather than as five gauges — and
                            the sequence is the thing this strip is for. */}
                        {i > 0 && (
                          <span
                            aria-hidden="true"
                            className="absolute top-[15px] right-1/2 left-0 h-px bg-line"
                          />
                        )}
                        <PhaseRing done={done} total={inPhase.length} />
                        <p
                          className={`mt-1.5 text-center text-[10px] leading-tight ${
                            // The phase the book is standing in, named twice on
                            // one card — as the eyebrow above and as the lit
                            // dial here. Two views of one fact rather than two
                            // facts: the eyebrow says where you are, the strip
                            // says how far along that is.
                            progress.next?.phase === phase.id
                              ? "font-semibold text-fg"
                              : "text-muted"
                          }`}
                        >
                          {phase.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Link>

              {/* The roadmap's own next step, under the dials rather than above
                  the findings.

                  Both are "what to do next" and they are not the same question:
                  the findings are what is *wrong with the book*, the step is
                  where you are *on the road*. Stacked, the card reads as one
                  thought — here is the state of it, here is the position. Side
                  by side they competed, and the writer had to work out which
                  one to obey. */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
                {progress.next ? (
                  <>
                    <span className="text-xs font-bold tracking-widest text-muted uppercase">
                      Next
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-fg">
                      {progress.next.title}
                    </span>

                    {/* "Finish the first draft" and "Revise" have no detector on
                        purpose — finishing is a decision, not a word count. But
                        somebody who *imported* a finished manuscript arrives
                        already past both, and with no way to say so they stay
                        at Drafting forever, never reach the publishing phases,
                        and never get told what a shop would refuse. The tick
                        lives on the roadmap page; the writer is standing here. */}
                    {!progress.next.automatic && (
                      <button
                        type="button"
                        onClick={() =>
                          setRoadmapStep(book.id, progress.next!.id, true)
                        }
                        className="rounded-lg border border-line bg-panel px-3 py-1.5
                                   text-xs font-semibold text-fg hover:border-accent/40"
                      >
                        Already done
                      </button>
                    )}
                    <Link
                      href={progress.next.href?.(book.id) ?? `/book/${book.id}`}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold
                                 text-accent-ink"
                    >
                      Do this →
                    </Link>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-fg">
                    Every step done. That is the whole list.
                  </span>
                )}
                <span className="text-xs text-muted">
                  {progress.done} of {progress.total}
                </span>
              </div>
            </div>
          )}
        </section>
      ) : (
        <EmptyState title="Nothing on the shelf yet" primary={START} secondary={IMPORT}>
          Start one and name it later, or bring in a manuscript you already have
          — .docx, .epub, .md, .txt or .html. Then this screen tells you what
          stands between it and a shop.
        </EmptyState>
      )}

      {/* Nothing when nothing is late, which is most days. A panel that has
          to explain that it is empty is a panel earning its place by being
          there rather than by saying anything. */}
      {late.length > 0 && (
        <section className="rounded-2xl border border-note-line bg-note-bg p-5">
          <p className="font-bold text-fg">
            {late.reduce((n, row) => n + row.count, 0)} advance{" "}
            {late.reduce((n, row) => n + row.count, 0) === 1
              ? "reader is"
              : "readers are"}{" "}
            past their date
          </p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {late.map(({ book, count }) => (
              <li key={book.id}>
                <Link
                  href={`/book/${book.id}/arc`}
                  className="flex flex-wrap items-center gap-x-2 text-sm"
                >
                  <span className="font-semibold text-fg">{book.title}</span>
                  <span className="text-muted">{count} to chase</span>
                  <span className="text-accent">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Am I moving -------------------------------------------------

          Last, and half the size it was. There were four tiles here and three
          of them counted the same thing — words this week, days running, days
          in the last 30 — which made the foot of the screen a writing tracker
          and, with the old writing-first card above it, made the whole
          dashboard one. Writing is a fifth of this product's road; it does not
          get three quarters of the numbers.

          The two kept are the two that answer different questions: is there
          movement, and how much is on the shelf. The full picture, per book and
          with a finish date, is the Progress tool — which is where somebody
          who actually wants it goes.

          Three zeros beside a shelf of finished books is a lie by arithmetic:
          the day log only started when it shipped, so a writer with 6,000 words
          behind them would read that they had written nothing. Until there is a
          single logged day, this is one card that says why it is empty. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {logged ? (
          <Stat
            icon={shelfIcons.write}
            value={week.words.toLocaleString()}
            label="words this week"
            note={
              week.daysWritten > 0
                ? // The streak, folded in rather than given a tile of its own.
                  // Stated, never scolded: the research was explicit about how
                  // this audience feels about apps that turn a streak into a
                  // stick, and a number that large on a screen this size was
                  // doing the scolding by size alone.
                  `across ${plural(week.daysWritten, "day")}${
                    run > 0 ? ` · ${plural(run, "day")} running` : ""
                  }`
                : "nothing yet this week — that is allowed"
            }
          />
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-panel px-5 py-4">
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
    </div>
  );
}

/** Somewhere to go, or something to do. Empty states take one of each. */
type EmptyAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

function ActionButton({
  action,
  primary,
}: {
  action: EmptyAction;
  primary?: boolean;
}) {
  const className = `rounded-lg px-5 py-2.5 text-sm font-semibold ${
    primary
      ? "bg-accent text-accent-ink"
      : "border border-line bg-surface text-fg hover:border-accent/40"
  }`;

  return "href" in action ? (
    <Link href={action.href} className={className}>
      {action.label}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

/**
 * A screen with nothing on it, which is a screen with something to say.
 *
 * Four of these were a single grey sentence — "No books yet.", "The trash is
 * empty." — with nothing to press. An empty screen is the one moment a writer
 * is guaranteed to be looking and has nothing else to read, so spending it on a
 * statement of the obvious is the most expensive silence in the app.
 *
 * **The two kinds are opposites and the difference is the whole design.** An
 * area with *no books at all* is somebody at the start: it owes them the two
 * ways in, and a line about what this area will do once there is a book. A
 * *filter* with nothing in it — archived, trash, a search that matched nothing
 * — is not that at all. The library is fine; this view is narrow. Offering
 * "Start a book" there answers a question nobody asked and quietly implies they
 * have none, so those get the way *back* instead, and a line explaining what
 * the view is for.
 *
 * `bare` drops the frame, for the two that already sit inside a card.
 */
function EmptyState({
  title,
  children,
  primary,
  secondary,
  bare,
}: {
  title: string;
  /** One line: what this area does for you, or what this view holds. */
  children: ReactNode;
  primary?: EmptyAction;
  secondary?: EmptyAction;
  bare?: boolean;
}) {
  return (
    <div
      className={
        bare
          ? "py-2"
          : "rounded-2xl border border-line bg-panel px-6 py-10 text-center"
      }
    >
      <p className="text-lg font-bold text-fg">{title}</p>
      <p
        className={`mt-2 max-w-md text-muted ${bare ? "" : "mx-auto"}`}
      >
        {children}
      </p>
      {(primary || secondary) && (
        <div
          className={`mt-5 flex flex-wrap gap-2 ${bare ? "" : "justify-center"}`}
        >
          {primary && <ActionButton action={primary} primary />}
          {secondary && <ActionButton action={secondary} />}
        </div>
      )}
    </div>
  );
}

/**
 * The two ways a book gets here, as actions for an empty state.
 *
 * Which one leads is the area's own answer. Write and Overview put *Start a
 * book* first, because drafting is what those two are for. Prepare, Track and
 * Tools put *Import* first, because all three work on a book that already
 * exists — and the person who lands on them with an empty shelf is far more
 * likely to have a manuscript in a file than to be about to type one.
 */
const START: EmptyAction = { label: "Start a book", href: "/book/new" };
const IMPORT: EmptyAction = {
  label: "Import a manuscript",
  href: "/book/import",
};

/**
 * The way out of a finding.
 *
 * Every finding carries one, and that is the difference between a diagnosis and
 * a list of reasons to feel bad. Three of them are dialogs rather than pages —
 * the title, the author and the cover are all edited in the book-details dialog
 * the shelf already owns — which is why `checkup` describes destinations as a
 * union instead of a URL, and why this has to be a component rather than a
 * `<Link>` with a computed href.
 *
 * The one that must be fixed is filled; the one worth doing is outlined. Same
 * two-weight ladder as the badges, and the same reasoning: weight carries the
 * severity so that a reader who cannot separate the hues loses nothing.
 */
function FixLink({
  book,
  fix,
  level,
  onCover,
}: {
  book: Book;
  fix: Fix;
  level: FindingLevel;
  onCover: (b: Book) => void;
}) {
  const className = `shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
    level === "fix"
      ? "bg-accent text-accent-ink"
      : "border border-line bg-panel text-fg hover:border-accent/40"
  }`;

  if (fix.kind === "route") {
    return (
      <Link
        href={`/book/${book.id}${fix.path ? `/${fix.path}` : ""}`}
        className={className}
      >
        {fix.action} →
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onCover(book)} className={className}>
      {fix.action}
    </button>
  );
}

/**
 * One phase of the job, as a dial.
 *
 * A ring rather than a bar because these are five *stations*, not five
 * measurements: a row of bars reads as a chart to compare across, where dials
 * on a line read as a route with a position on it. The arc still carries the
 * fraction, so nothing is lost in the change — a phase three-quarters done
 * looks three-quarters done.
 *
 * A finished phase takes a tick instead of a full ring. A complete circle and a
 * nearly-complete one are two arcs a couple of degrees apart, and "done" is the
 * one state on this strip that should never be mistaken for "almost".
 */
function PhaseRing({ done, total }: { done: number; total: number }) {
  const share = total > 0 ? done / total : 0;
  const complete = total > 0 && done === total;

  // Circumference of r=13 on the 32 box below, so the dash can be set as a
  // length rather than a percentage — SVG has no percentage dash.
  const circumference = 2 * Math.PI * 13;

  return (
    <span className="relative rounded-full bg-surface">
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="block h-[30px] w-[30px]"
      >
        <circle
          cx="16"
          cy="16"
          r="13"
          fill="none"
          strokeWidth="3.5"
          className="stroke-raised"
        />
        {share > 0 && (
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${share * circumference} ${circumference}`}
            // From the top rather than from three o'clock, which is where a
            // dial is read from and where SVG starts.
            transform="rotate(-90 16 16)"
            className="stroke-accent"
          />
        )}
        {complete && (
          <path
            d="m11 16.2 3.2 3.2 6.4-6.8"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-accent"
          />
        )}
      </svg>
    </span>
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
  onClearSearch,
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
  /** Empties the box in the header, which lives on the screen above this. */
  onClearSearch: () => void;
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
                view === v ? "bg-accent text-accent-ink" : "text-muted"
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
        <div className="mt-6">
          {searching ? (
            <EmptyState
              title="No book here matches that"
              primary={{ label: "Clear the search", onClick: onClearSearch }}
            >
              This searches titles. To look inside a book, open it and use the
              search tab — that one reads the prose.
            </EmptyState>
          ) : view === "archived" ? (
            <EmptyState
              title="Nothing archived"
              primary={{
                label: "Back to your books",
                onClick: () => onView("active"),
              }}
            >
              Archiving takes a finished book off the shelf without deleting
              anything — its chapters, notes and cover stay exactly as they are.
            </EmptyState>
          ) : view === "trashed" ? (
            <EmptyState
              title="The trash is empty"
              primary={{
                label: "Back to your books",
                onClick: () => onView("active"),
              }}
            >
              A deleted book waits here with everything still in it, so you can
              put it back. Nothing goes for good until you say so.
            </EmptyState>
          ) : (
            <EmptyState
              title="Nothing on the shelf yet"
              primary={START}
              secondary={IMPORT}
            >
              Start one and name it later, or bring in a manuscript you already
              have — .docx, .epub, .md, .txt or .html.
            </EmptyState>
          )}
        </div>
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
                                 text-sm font-semibold text-accent-ink"
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
                            Book details
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
                                   text-danger underline underline-offset-4"
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
          // Bare: the card above already carries the paragraph explaining what
          // the check is, so this says only what is missing and how to fix it.
          // Import leads here — the person on this screen with an empty shelf
          // has a manuscript somewhere, or they would not be reading about
          // what a shop refuses.
          <EmptyState bare title="No book to check yet" primary={IMPORT} secondary={START}>
            Bring one in and this names what a shop would refuse before you find
            out from a rejection.
          </EmptyState>
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
  /*
   * The one place in a greyscale app that keeps its hues, because here the
   * colour *is* the information: red, amber and green are the three words
   * everybody already reads without reading, and this badge exists to be read
   * at a glance down a column of books.
   *
   * Built in three parts rather than two — a **near-black ground of the hue, a
   * hairline one step up from it, and saturated ink on top.** A translucent
   * wash with pale ink was the first attempt and reads as a faded sticker: on
   * black, lightening the *text* is what makes a colour legible, and darkening
   * the *ground* is what keeps the badge sitting in the page instead of glowing
   * off it. The border is what stops it dissolving into the card behind.
   *
   * Squared off rather than a capsule, for the same reason: at this size a full
   * pill reads as a tag someone stuck on, and these are a property of the row.
   *
   * Weight still carries it for anyone who cannot separate the three — "3 to
   * fix" and "4 worth doing" say the severity in words.
   */
  const tones = {
    ok: "border-ok-line bg-ok-bg text-ok-fg",
    note: "border-note-line bg-note-bg text-note-fg",
    stop: "border-stop-line bg-stop-bg text-stop-fg",
  };
  return (
    <span
      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Tools — what the product can do, rather than a grid of ways to reach it.
 *
 * This area was seven books down the page with the same seven buttons on each:
 * forty-nine controls, all of them one word, above a paragraph that named seven
 * tools in a single run-on block. Every other area on this dashboard was fixed
 * by *hiding* its controls behind a menu. This one is the opposite case, and
 * getting that backwards would have been the easy mistake — the area's whole
 * job is to show a writer what they have, so a compact row of ⋯ menus would
 * work directly against it.
 *
 * The fix is to turn it round. It was book-first and needed to be tool-first:
 * one book chosen at the top, then every tool named *and* explained. Forty-nine
 * anonymous buttons become one picker and fifteen described cards — and the
 * fifteen are the same ones a book card's ⋯ menu opens, out of one list in
 * `lib/book-tools.ts`.
 */
function Tools({
  books,
  current,
}: {
  books: Book[];
  /** The book to offer first — the same one the Overview leads with. */
  current: Book | null;
}) {
  const [chosenId, setChosen] = useState<string | null>(null);

  // The picked book, or the one the shelf was already offering. Resolved rather
  // than copied into state, so a rename or a deletion cannot leave this holding
  // a stale book.
  const book = books.find((b) => b.id === chosenId) ?? current;

  if (!book) {
    return (
      <EmptyState
        title="Nothing to point them at"
        primary={IMPORT}
        secondary={START}
      >
        All fifteen work on a book. Bring one in and they light up — comps,
        categories, blurb, cover, paperback and the rest.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section
        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl
                          border border-line bg-panel px-5 py-4"
      >
        <span className="w-10 shrink-0">
          <CoverOf book={book} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-widest text-muted uppercase">
            Working on
          </p>
          <p className="mt-0.5 truncate text-lg font-bold text-fg">
            {book.title}
          </p>
        </div>

        {/* One picker instead of repeating every tool for every book. With
            seven books and fifteen tools the old shape would now be a hundred
            and five controls. */}
        {books.length > 1 && (
          <Menu
            label="Choose a book"
            align="end"
            width={260}
            triggerClassName="flex items-center gap-1.5 rounded-lg border border-line
                              bg-surface px-3.5 py-2 text-sm font-semibold text-fg"
            trigger={
              <>
                Change book
                {shelfIcons.chevron}
              </>
            }
          >
            {(close) => (
              <>
                <MenuLabel>Your books</MenuLabel>
                {books.map((b) => (
                  <MenuButton
                    key={b.id}
                    // The slot is filled either way, blank where there is no
                    // tick. Passing `undefined` collapses it, and then the one
                    // checked row sits indented while the rest start further
                    // left — a list where the current item is the only one out
                    // of line reads as a rendering fault.
                    icon={
                      b.id === book.id ? (
                        shelfIcons.check
                      ) : (
                        <span
                          aria-hidden="true"
                          className="block h-[18px] w-[18px]"
                        />
                      )
                    }
                    onClick={() => {
                      setChosen(b.id);
                      close();
                    }}
                  >
                    {b.title}
                  </MenuButton>
                ))}
              </>
            )}
          </Menu>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-bold text-fg">Everything that works on a book</h2>
        <p className="mt-1 mb-5 text-muted">
          The jobs that cost a fortune to hand to somebody else. All of it is
          built and none of it is held back — a tool that is not finished is not
          on this list.
        </p>
        <ToolGrid bookId={book.id} />
      </section>
    </div>
  );
}

/**
 * Track — what happened to each book after it went out.
 *
 * This was two panels, each a list of the same seven titles with an identical
 * button beside every one: fourteen rows a hundred pixels tall, carrying seven
 * book names and no numbers. On the screen whose entire subject is *what the
 * book cost against what it earned*, neither figure appeared anywhere.
 *
 * It is one list now, and each row shows both halves of the answer. The money
 * comes from the ledger, the reviews from the advance-copy list, and each half
 * links to the page that can change it. The strip on top adds the library up,
 * because "am I down overall" is a question no per-book page can answer.
 *
 * **Nothing here is estimated.** A book with no rows says so rather than
 * showing a zero, which on a money screen would read as a fact about the book
 * instead of a gap in the record.
 */
function Track({ books }: { books: Book[] }) {
  const ledger = useLedger();

  /**
   * Both halves, per book.
   *
   * The advance-copy lists are read straight from the store rather than through
   * `useArc`, because a hook cannot be called in a loop and there is one list
   * per book. Recomputed only when the shelf or the ledger changes; the arc
   * lists are small — names and dates — so this is nothing like reading covers.
   */
  const rows = useMemo(
    () =>
      books.map((book) => ({
        book,
        money: totals(ledger.filter((e) => e.bookId === book.id)),
        readers: summariseArc(parseArc(getArcRaw(book.id))),
      })),
    [books, ledger],
  );

  const library = useMemo(() => totals(ledger), [ledger]);
  const out = rows.reduce((n, r) => n + r.readers.out, 0);
  const late = rows.reduce((n, r) => n + r.readers.overdue, 0);
  const anyMoney = ledger.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {books.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {anyMoney ? (
            <>
              <Stat
                icon={shelfIcons.track}
                value={library.spent.toLocaleString()}
                label="spent"
                note="across every book"
              />
              <Stat
                icon={shelfIcons.track}
                value={library.earned.toLocaleString()}
                label="earned"
                note={
                  library.units > 0
                    ? `${library.units.toLocaleString()} ${library.units === 1 ? "copy" : "copies"} recorded`
                    : "no copy counts recorded"
                }
              />
              <Stat
                icon={shelfIcons.target}
                value={`${library.net >= 0 ? "+" : "\u2212"}${Math.abs(library.net).toLocaleString()}`}
                label={library.net >= 0 ? "ahead" : "down"}
                note={
                  library.net >= 0
                    ? "rarer than anyone tells you"
                    : "which is the normal place to be"
                }
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-panel px-5 py-4 sm:col-span-2 lg:col-span-3">
              <div className="flex items-center gap-2 text-muted">
                {shelfIcons.track}
                <p className="text-sm font-medium">Nothing recorded yet</p>
              </div>
              <p className="mt-1.5 text-sm text-fg">
                Start with what you have already spent. It is the number that
                matters most and the one nobody writes down.
              </p>
            </div>
          )}

          <Stat
            icon={shelfIcons.calendar}
            value={String(out)}
            label="advance copies out"
            note={late > 0 ? `${late} past their date` : "none late"}
          />
        </section>
      )}

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-bold text-fg">Every book</h2>
        <p className="mt-1 mb-4 text-muted">
          What each one cost against what it earned, and who still has an
          advance copy. Amazon has no public API, so a sales report is a file
          you download and hand over — nothing is fetched and nothing is sent.
        </p>

        {books.length === 0 ? (
          <EmptyState bare title="Nothing to track yet" primary={IMPORT} secondary={START}>
            Costs, royalties and advance readers all hang off a book. Bring one
            in and this starts keeping the account.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {rows.map(({ book, money, readers }) => (
              <TrackRow
                key={book.id}
                book={book}
                money={money}
                readers={readers}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * One book, with both halves of what happened to it.
 *
 * Two cells rather than two rows in two separate lists: money and reviews are
 * the same question asked twice, and a writer chasing one is usually looking at
 * the other. Each cell is its own link, so the row does not have to choose a
 * single destination.
 */
function TrackRow({
  book,
  money,
  readers,
}: {
  book: Book;
  money: Ledger;
  readers: ArcSummary;
}) {
  const recorded = money.spent > 0 || money.earned > 0;

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="w-8 shrink-0">
          <CoverOf book={book} />
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-fg">
          {book.title}
        </span>
        {readers.overdue > 0 && <Flag tone="stop">{readers.overdue} late</Flag>}
      </div>

      <div className="grid grid-cols-2 border-t border-line">
        <Cell href={`/book/${book.id}/track`} label="Money" divider>
          {recorded ? (
            <>
              <span
                className={
                  money.net >= 0 ? "text-ok-fg" : "text-fg"
                }
              >
                {money.net >= 0 ? "+" : "\u2212"}
                {Math.abs(money.net).toLocaleString()}
              </span>{" "}
              <span className="text-xs font-normal text-muted">
                {money.net >= 0 ? "ahead" : "down"}
              </span>
            </>
          ) : (
            // Not "0". A zero here reads as a fact about the book rather than
            // an empty record, on the one screen where that difference is the
            // whole point.
            <span className="text-muted">Nothing recorded</span>
          )}
        </Cell>

        <Cell href={`/book/${book.id}/arc`} label="Advance copies">
          {readers.total > 0 ? (
            <>
              {readers.out}{" "}
              <span className="text-xs font-normal text-muted">
                out · {readers.reviewed} reviewed
              </span>
            </>
          ) : (
            <span className="text-muted">Nobody yet</span>
          )}
        </Cell>
      </div>
    </li>
  );
}

function Cell({
  href,
  label,
  divider,
  children,
}: {
  href: string;
  label: string;
  divider?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2.5 transition-colors hover:bg-raised ${
        divider ? "border-r border-line" : ""
      }`}
    >
      <span className="block text-[11px] font-bold tracking-wider text-muted uppercase">
        {label}
      </span>
      <span className="mt-0.5 block truncate text-sm font-bold text-fg">
        {children}
      </span>
    </Link>
  );
}

// `PlannedArea` — the whole-area "none of this exists yet" wrapper — is gone.
// Every area now has real work in it and shows what is still coming in its own
// "Coming to this area" panel instead, which is the shape that survives an area
// being half built. It went out with Track, the last one that was empty.

/* ---- Bits ---------------------------------------------------------------- */

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

// `Go` is gone with the last of the button rows. Every area now leads with
// one named action or a described card, so a generic "link that looks like a
// button" had nothing left to be.

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
 * filled bar it replaced. At six items a saturated block is the heaviest thing
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

// `SideGroup` is gone with the Extras group it labelled. The rail is one list
// and a footer again, so nothing needs naming.

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
