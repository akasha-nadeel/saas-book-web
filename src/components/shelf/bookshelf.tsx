"use client";

import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import { BookDetailsDialog } from "@/components/shelf/book-details-dialog";
import { CollabArea } from "@/components/collab/collab-area";
import { SharedBadge } from "@/components/collab/shared-badge";
import { CoverDialog } from "@/components/shelf/cover-dialog";
import { AccountMenu } from "@/components/auth/account-menu";
import { HelpDialog } from "@/components/shelf/help-dialog";
import { SupportDialog } from "@/components/shelf/support-dialog";
import { FeedbackDialog } from "@/components/shelf/feedback-dialog";
import { ComingSoonDialog } from "@/components/shelf/coming-soon-dialog";
import { ConfirmDialog } from "@/components/ui/dialog";
import { LoadingScreen } from "@/components/loading-screen";
import { type Account } from "@/lib/account";
import {
  archiveBook,
  bookChapterCount,
  bookWordCount,
  booksAgainstPlan,
  booksIn,
  deleteBook,
  getArcRaw,
  getCoverFacts,
  hasCover,
  migrateLegacy,
  restoreBook,
  setFavourite,
  trashBook,
  type Book,
  type BookView,
} from "@/lib/library-store";
import { findingsFrom, type FindingLevel, type Fix } from "@/lib/checkup";
import { relativeTime } from "@/lib/relative-time";
import { nounFor, plural } from "@/lib/plural";
import { withReturn, type AreaId } from "@/lib/areas";
import {
  useActivity,
  useCover,
  useHydrated,
  useLedger,
  useLibrarySettled,
  useCoverEpoch,
  useShelf,
} from "@/lib/use-library";
import {
  pace,
  recentDays,
  streak,
  type Activity,
  type Pace,
} from "@/lib/activity";
import { targetShare } from "@/lib/target";
import { WritingPerformanceCard } from "@/components/shelf/writing-performance-card";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { UpgradeDialog } from "@/components/upgrade/upgrade-dialog";
import { usePlan, type PlanState } from "@/lib/use-plan";
import {
  parseArc,
  summarise as summariseArc,
  type ArcSummary,
} from "@/lib/arc";
import { totals, type Entry, type Ledger } from "@/lib/ledger";
import { curveOf, MIN_WINDOW_DAYS, type LeftOut } from "@/lib/curve";
import { ProGate, useEntitled } from "@/components/upgrade/pro-gate";
import { storeReadiness, type ReadinessIssue } from "@/lib/publishing";
import { progressOf, roadmapFor, type Phase } from "@/lib/roadmap";
import { shelfIcons } from "@/components/shelf/shelf-icons";
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

type Area = "overview" | "write" | "prepare" | "track" | "tools" | "collab";

/**
 * The one element the six areas scroll inside, by id.
 *
 * An id rather than a ref because the thing that needs to reach it is a click
 * handler declared above the markup — the same reason the export wizard names
 * its own scroller. See `goToArea`.
 */
const AREA_SCROLLER = "shelf-area-scroll";

const AREAS: {
  id: Area;
  label: string;
  live: boolean;
  icon: React.ReactNode;
  stage: boolean;
}[] = [
  {
    id: "overview",
    label: "Overview",
    live: true,
    icon: shelfIcons.overview,
    stage: true,
  },
  {
    id: "write",
    label: "Write",
    live: true,
    icon: shelfIcons.write,
    stage: true,
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

/**
 * The four lists the shelf can show, which is one more than the store has.
 *
 * `BookView` is where a book *is* — active, archived, trashed, and never two
 * of them. A favourite is not a place: it is an active book with a star on it,
 * counted among the active ones and still there when the star comes off. So it
 * is a filter laid over `active` here rather than a fourth state in the store,
 * and `booksIn` never has to answer for it.
 */
type ShelfView = BookView | "favourite";

const SHELF_VIEWS: readonly ShelfView[] = [
  "active",
  "favourite",
  "archived",
  "trashed",
];

/**
 * The three the rail lists under Write, which is `SHELF_VIEWS` without
 * `active`.
 *
 * Write *is* the active list — pressing it opens exactly what a "Books" row
 * would have — so naming it twice in one column was two doors into one room.
 * The segmented control below `md` keeps all four, because there is no rail
 * there and it is the only way to reach any of them.
 */
const RAIL_VIEWS: readonly ShelfView[] = ["favourite", "archived", "trashed"];

const VIEW_LABEL: Record<ShelfView, string> = {
  active: "Books",
  favourite: "Favourites",
  archived: "Archived",
  trashed: "Trash",
};

const VIEW_ICON: Record<ShelfView, ReactNode> = {
  active: shelfIcons.write,
  favourite: shelfIcons.heart,
  archived: shelfIcons.archive,
  trashed: shelfIcons.trash,
};

const SIDEBAR_ICONS: Record<string, ReactNode> = {
  overview: (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/sidebar/Dashboard-Square--Streamline-Flex.png"
      alt=""
      className="h-5 w-5 object-contain opacity-75 dark:invert dark:opacity-90"
    />
  ),
  write: (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/sidebar/Pencil-Line--Streamline-Flex.png"
      alt=""
      className="h-5 w-5 object-contain opacity-75 dark:invert dark:opacity-90"
    />
  ),
  favourite: (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/sidebar/Heart--Streamline-Flex.png"
      alt=""
      className="h-5 w-5 object-contain opacity-75 dark:invert dark:opacity-90"
    />
  ),
  archived: (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/sidebar/Archive-Box--Streamline-Flex.png"
      alt=""
      className="h-5 w-5 object-contain opacity-75 dark:invert dark:opacity-90"
    />
  ),
  trashed: (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/sidebar/Recycle-Bin-2--Streamline-Flex.png"
      alt=""
      className="h-5 w-5 object-contain opacity-75 dark:invert dark:opacity-90"
    />
  ),
  support: (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/sidebar/support.png"
      alt=""
      className="h-5 w-5 object-contain opacity-75 dark:invert dark:opacity-90"
    />
  ),
  feedback: (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/sidebar/feedbacks.png"
      alt=""
      className="h-5 w-5 object-contain opacity-75 dark:invert dark:opacity-90"
    />
  ),
  pricing: (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/sidebar/pricing.png"
      alt=""
      className="h-5 w-5 object-contain opacity-75 dark:invert dark:opacity-90"
    />
  ),
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
  /* The band's line distinguishes an empty shelf from one still arriving, and
     only `useLibrarySettled` can tell those apart — see the note on it. */
  const settled = useLibrarySettled();
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
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get("area");
  const [picked, setPicked] = useState<Area | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // What the URL says, until the writer clicks something. After that their
  // click wins — retyping the URL on every tab change would stack history
  // entries and make the back button walk the tabs instead of leaving.
  const area: Area =
    picked ??
    (AREAS.some((a) => a.id === asked) ? (asked as Area) : "overview");
  const setArea = setPicked;

  /**
   * Switch area *and* go back to the top of it.
   *
   * The areas share one scroll container, so walking from a scrolled Track to
   * Tools landed the writer part-way down Tools — past the first group of the
   * page they had just asked for. `<body>` is `overflow-hidden` here, so this
   * is a div's `scrollTop` rather than the window's, and nothing resets it.
   *
   * Imperative, in the handler, rather than an effect keyed on `area` — the
   * same shape the export wizard uses when it changes step. An effect would
   * also fire for `showInPrepare`, whose whole job is to scroll a particular
   * book's card *into view* (see `startOpen` further down); child effects run
   * before parent ones, so the reset would land after the card had scrolled
   * and quietly undo it. Only the navigation controls call this.
   */
  /**
   * Open one of the shelf's four lists.
   *
   * Both halves, always: the rail can be pressed from Overview or Track, where
   * setting the view alone would change a list nobody is looking at and leave
   * the press doing nothing visible.
   */
  const showShelf = (next: ShelfView) => {
    setView(next);
    goToArea("write");
  };

  const goToArea = (next: Area) => {
    setNavigationOpen(false);
    setArea(next);
    /**
     * **Written back with `replace`, which is what makes both halves work.**
     *
     * The area was read from `?area=` and never written, so the URL stayed `/`:
     * a refresh landed on Overview however deep the writer had gone, and no
     * area could be linked or bookmarked. The note above is right that `push`
     * would be worse — it stacks a history entry per tab and turns Back into a
     * walk through them instead of a way out of the dashboard. `replace` does
     * neither: one entry, edited in place, so Back still leaves and a reload
     * comes back to where they were.
     */
    router.replace(next === "overview" ? "/" : `/?area=${next}`, {
      scroll: false,
    });
    document.getElementById(AREA_SCROLLER)?.scrollTo({ top: 0 });
  };
  /**
   * Which book Prepare should open, and how many times it has been asked.
   *
   * The count is what makes the second press work. Overview's banner sends a
   * writer here to see one book's findings, and if the *id* were the whole
   * state then pressing it, closing the row, and pressing it again would ask
   * for a book that is already the target — no change, no reopen, a button
   * that appears to have stopped working. Bumping a nonce changes the row's
   * key every time, so each press is a fresh instruction rather than a
   * restatement of the last one.
   */
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const showInPrepare = (bookId: string) => {
    setFocus((f) => ({ id: bookId, n: (f?.n ?? 0) + 1 }));
    setArea("prepare");
  };

  const [editing, setEditing] = useState<Book | null>(null);
  const [covering, setCovering] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<ShelfView>("active");
  const [dialog, setDialog] = useState<
    "help" | "support" | "feedback" | "community" | "audiobook" | null
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
    // Favourites read from the active shelf and then filter, so a starred book
    // that is later archived leaves this list with it rather than lingering in
    // a fifth place of its own.
    const list =
      view === "favourite"
        ? booksIn(shelf, "active").filter((b) => b.favourite)
        : booksIn(shelf, view);
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
      favourite: active.filter((b) => b.favourite).length,
      archived: booksIn(shelf, "archived").length,
      trashed: booksIn(shelf, "trashed").length,
    }),
    [shelf, active],
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

  /* Both were `window.confirm`, which the browser can be told to stop showing —
     see `ui/dialog.tsx`. Two questions about a whole book, so the book waits in
     state and the answer arrives through a callback. */
  /* One `usePlan()` for the whole dashboard. It fetches per mount, and both
     the restore gate below and `ProCard` need the answer, so the card takes it
     as a prop rather than asking again. */
  const plan = usePlan();

  const [trashing, setTrashing] = useState<Book | null>(null);
  const [erasing, setErasing] = useState<Book | null>(null);
  /* The third question, and the one that is not a confirmation: a restore the
     free plan has no room for. Only ever a book coming out of the *trash* —
     the archive stopped being a way round the limit when archived books
     started counting against it. See `booksAgainstPlan`. */
  const [noRoomFor, setNoRoomFor] = useState<Book | null>(null);

  const handleTrash = (book: Book) => setTrashing(book);
  const handleDeleteForever = (book: Book) => setErasing(book);
  const handleRestore = (book: Book) => {
    /* **Only a book coming out of the trash can be refused.** An archived book
       already spends its slot — see `booksAgainstPlan` — so unarchiving gives
       the writer back something the plan was already counting, and stopping
       them at that door would be stopping them from opening their own
       manuscript. Trash wins over archive on a book that is both, exactly as
       `booksIn` reads it, so the trash flag is the one tested. */
    if (!book.trashedAt) {
      restoreBook(book.id);
      return;
    }

    /* The same test `new-book-form.tsx` makes, and it has to stay the same.
       With no gateway configured there are no plans and nothing is held back,
       so `plan.billing` is half of the question.

       **`!plan.loading` is the other half, and leaving it out was a bug.**
       `usePlan()` starts at UNKNOWN — `loading: true, pro: false` — and asks
       the server on mount, so for the width of that request a Pro account is
       indistinguishable from a free one. Gating on `plan.loading` meant
       *gating during it*: land straight on `/?area=write`, press Restore
       before the answer arrives, and a writer with unlimited books is told
       there is no room. Not knowing yet is not a reason to refuse. The server
       is the real enforcement — `enforce_launch_book_limit` exempts Pro — so
       the cost of waving through a restore we would have refused is that
       Postgres refuses it instead, which is the right way round. */
    const gated =
      !plan.loading &&
      plan.billing &&
      !plan.pro &&
      booksAgainstPlan(shelf).length >= LAUNCH_LIMITS.freeBooks;
    if (gated) {
      setNoRoomFor(book);
      return;
    }
    restoreBook(book.id);
  };

  if (!hydrated) return <LoadingScreen />;

  const meta = AREAS.find((a) => a.id === area)!;

  return (
    /* Every cover under here can open "Edit book details" — see
       `EditCoverContext`. The value is `setCovering` itself, so the dialog a
       cover opens is the same one the ⋯ menu opens; two ways in, one dialog. */
    <EditCoverContext.Provider value={setCovering}>
      <div className="flex h-[var(--oc-layout-height)] bg-surface">
        {/* ---- The six areas ------------------------------------------- */}
        {/* The rail is compact: primary workflow first, secondary account/help
          actions directly underneath, and only the signed-in account pinned to
          the foot. A mostly empty sidebar reads like unfinished space. */}
        {/* pb-3, not the pb-14 this used to carry. That padding existed to keep
          the last item clear of Next's dev-tools badge, which sits in this
          exact corner — and it left a hand's width of empty rail at the bottom
          of the shipped product to dodge something only a developer ever sees.
          The badge is moved to bottom-right in next.config.ts instead. */}
        <aside
          className={`shelf-sidebar hidden min-h-0 shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-in-out md:flex ${
            sidebarCollapsed ? "w-16" : "w-56"
          }`}
        >
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-2 pt-4 pb-2">
            <div className="flex min-h-full flex-col">
              {sidebarCollapsed ? (
                <div className="mb-6 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(false)}
                    title="Expand sidebar"
                    aria-label="Expand sidebar"
                    className="group relative flex h-10 w-10 items-center justify-center rounded-xl p-1 text-muted transition-all duration-200 hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
                  >
                    {/* Logo shown by default, hidden on hover */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/oc-icon.png"
                      alt="OpenChapter"
                      className="h-7 w-7 object-contain transition-all duration-200 group-hover:scale-75 group-hover:opacity-0 dark:invert"
                    />

                    {/* Expand icon hidden by default, smoothly appears on hover */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/icons/sidebar/panel-expand.png"
                      alt=""
                      className="absolute h-5 w-5 object-contain scale-75 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-80 dark:invert dark:group-hover:opacity-90"
                    />
                  </button>
                </div>
              ) : (
                <div className="mb-6 flex items-center justify-between px-2">
                  <Link
                    href="/"
                    className="min-w-0 text-xl font-bold tracking-tight text-fg transition-opacity hover:opacity-85"
                  >
                    Open<span className="text-wordmark">Chapter</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    title="Collapse sidebar"
                    aria-label="Collapse sidebar"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/icons/sidebar/panel-collapse.png"
                      alt=""
                      className="h-4 w-4 object-contain opacity-75 hover:opacity-100 transition-opacity dark:invert dark:opacity-85"
                    />
                  </button>
                </div>
              )}

              <nav className="flex flex-col gap-0.5">
                {AREAS.filter((a) => a.stage).map((a) => (
                  <Fragment key={a.id}>
                    <SideItem
                      icon={SIDEBAR_ICONS[a.id] ?? a.icon}
                      collapsed={sidebarCollapsed}
                      /* Write is the *active list*, not merely the area.
                         Asking `area === "write"` alone lit Write and Trash at
                         once, which is a rail claiming the writer is in two
                         places. Everywhere else the area is the whole of it. */
                      active={
                        a.id === "write"
                          ? area === "write" && view === "active"
                          : area === a.id
                      }
                      onClick={() =>
                        a.id === "write" ? showShelf("active") : goToArea(a.id)
                      }
                    >
                      {a.label}
                    </SideItem>

                    {/* The other three lists, as rows exactly like the one
                        above them. */}
                    {a.id === "write" &&
                      RAIL_VIEWS.map((v) => (
                        <SideItem
                          key={v}
                          icon={SIDEBAR_ICONS[v] ?? VIEW_ICON[v]}
                          collapsed={sidebarCollapsed}
                          active={area === "write" && view === v}
                          onClick={() => showShelf(v)}
                          badge={
                            <span className="text-xs tabular-nums text-muted">
                              {counts[v]}
                            </span>
                          }
                        >
                          {VIEW_LABEL[v]}
                        </SideItem>
                      ))}
                  </Fragment>
                ))}
              </nav>

              {AREAS.some((a) => !a.stage) && (
                <>
                  <div className="my-3 h-px bg-line" />
                  <nav className="flex flex-col gap-0.5">
                    {AREAS.filter((a) => !a.stage).map((a) => (
                      <SideItem
                        key={a.id}
                        icon={SIDEBAR_ICONS[a.id] ?? a.icon}
                        collapsed={sidebarCollapsed}
                        active={area === a.id}
                        onClick={() => goToArea(a.id)}
                      >
                        {a.label}
                      </SideItem>
                    ))}
                  </nav>
                </>
              )}

              {/* Getting help, then giving it back. */}
              <div className="mt-3 border-t border-line pt-3 flex flex-col gap-0.5">
                <SideItem
                  icon={SIDEBAR_ICONS.support}
                  collapsed={sidebarCollapsed}
                  onClick={() => setDialog("support")}
                >
                  Support
                </SideItem>
                <SideItem
                  icon={SIDEBAR_ICONS.feedback}
                  collapsed={sidebarCollapsed}
                  onClick={() => setDialog("feedback")}
                >
                  Send feedback
                </SideItem>
                <SideItem
                  icon={SIDEBAR_ICONS.pricing}
                  collapsed={sidebarCollapsed}
                  href="/upgrade"
                >
                  Pricing
                </SideItem>
              </div>
            </div>
          </div>

          {/* Outside the scroller */}
          <footer className="shrink-0 border-t border-line bg-panel px-2 pt-2 pb-3">
            <AccountMenu
              account={account}
              variant="bar"
              collapsed={sidebarCollapsed}
            />
          </footer>
        </aside>

        {navigationOpen && (
          <MobileDashboardNavigation
            account={account}
            area={area}
            onArea={goToArea}
            onClose={() => setNavigationOpen(false)}
            onDialog={setDialog}
          />
        )}

        {/* On a phone the area switcher belongs where a thumb can reach it,
          not in the most valuable line of the header. It remains mounted while
          its modal is open so the browser can return focus to the trigger when
          the drawer closes. The modal top layer makes the page behind it inert. */}
        <button
          type="button"
          onClick={() => setNavigationOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={navigationOpen}
          aria-controls="mobile-dashboard-navigation"
          className="fixed bottom-[calc(0.75rem+var(--oc-safe-bottom))] left-1/2 z-40 flex h-12 max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border border-line bg-white px-4 text-sm font-semibold text-fg shadow-[0_8px_28px_rgba(0,0,0,0.12)] outline-none transition-all hover:bg-raised active:translate-y-px focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:bg-panel dark:border-line md:hidden"
        >
          <span className="flex items-center text-fg/80 [&>svg]:h-4 [&>svg]:w-4">{meta.icon}</span>
          <span className="min-w-0 max-w-40 truncate font-semibold text-fg">{meta.label}</span>
          <span aria-hidden="true" className="ml-1 text-base leading-none text-muted">
            ☰
          </span>
        </button>

        {/* ---- The area ------------------------------------------------ */}
        {/* Named so `goToArea` can put it back to the top on a switch. */}
        <div id={AREA_SCROLLER} className="flex-1 overflow-y-auto">
          {/* The bar keeps its full-width background and border — a sticky
            header that stopped short of the edges would tear as the page
            scrolled under it — but its *contents* sit in the same max-w-6xl
            column as the page, so the search lines up with the heading below
            and the account chip lines up with the right edge of the cards. */}
          <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
            {/* Tighter from `md` up, and only from `md` up. The 44px minimum
              is a *touch* target — it exists so a thumb can hit the search box
              and the New book button — so it stays wherever there is no mouse.
              On a pointer it is 40px, which takes a fifth off the bar and gives
              the line back to the page. */}
            <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 md:flex md:flex-wrap md:py-2">
              <Link
                href="/"
                className="col-start-1 row-start-1 flex h-11 min-w-0 items-center text-xl font-bold tracking-tight text-fg outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-accent/60 md:hidden"
              >
                Open<span className="text-wordmark">Chapter</span>
              </Link>

              {/* Capped rather than `flex-1`. At full width it was the loudest
              thing on the screen, and it is a filter for one list, not the
              product's main verb. */}
              <div className="relative col-start-1 row-start-2 min-w-0 md:min-w-[8rem] md:max-w-sm md:flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                  {shelfIcons.search}
                </span>
                <input
                  ref={searchRef}
                  name="book-search"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    // The results live in Write. Searching from Overview used to
                    // filter a list nobody could see, so the box appeared broken.
                    if (e.target.value.trim()) setArea("write");
                  }}
                  placeholder="Search your books…"
                  aria-label="Search your books"
                  className="min-h-11 w-full rounded-lg border border-line bg-surface py-2 pr-4 pl-9
                         text-sm text-fg outline-none focus-visible:ring-2
                         focus-visible:ring-accent/50 sm:pr-12 md:min-h-10"
                />
                <kbd
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-2.5 my-auto hidden h-5
                         items-center rounded border border-line bg-raised px-1.5
                         text-[11px] font-medium text-muted sm:flex"
                >
                  /
                </kbd>
              </div>

              {/* **One button that opens the menu, not a split one.**

              It was a split button — the label a `<Link>` straight to
              `/book/new`, a hairline, and the chevron opening the other three
              ways in. The shape is a promise that the two halves do different
              things, and it collects mis-presses for it: the target that reads
              as "the button" is the words, and pressing the words skipped the
              choice the menu exists to offer. Nothing is lost by folding them
              together, because **"Blank book" is the first item in that menu**
              and goes exactly where the label used to — one press became two
              for the commonest path, and the other three stopped being hidden
              behind a 20px chevron.

              The divider went with it. A hairline down a button says there are
              two controls here; there is one. */}
              <div className="col-start-2 row-start-2 flex items-stretch justify-self-end md:ml-auto">
                <Menu
                  label="New book"
                  align="end"
                  width={248}
                  triggerClassName="flex h-11 w-11 items-center justify-center gap-1.5 whitespace-nowrap
                                    rounded-lg bg-accent text-sm font-semibold text-accent-ink
                                    transition-colors hover:bg-accent-strong active:bg-accent-strong
                                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                                    sm:w-auto sm:py-2 sm:pr-2.5 sm:pl-3.5 md:h-10"
                  trigger={
                    <>
                      {shelfIcons.plus}
                      <span className="hidden sm:inline">New book</span>
                      {/* Kept, and it is the whole of what tells a writer
                            this opens rather than acts. */}
                      <span className="hidden sm:block">{shelfIcons.chevron}</span>
                    </>
                  }
                >
                  {/* **Four ways in, and all four are the same road.**
                        "Import a file…" used to open a dialog that parsed the
                        manuscript, asked for a title and made the book there
                        and then — a second, shorter creation path, so an
                        imported book arrived with no author, no genre and no
                        word-count goal while a blank one was asked for all
                        three. The three tabs that were inside that dialog are
                        named here instead, because a writer with a recording
                        cannot discover that this app takes recordings from a
                        menu item that says "file", and each carries the writer
                        into `/book/new` with the source it names. */}
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
                      <MenuLink
                        href="/book/new?source=file"
                        icon={shelfIcons.upload}
                        onNavigate={close}
                      >
                        Local file
                      </MenuLink>
                      <MenuLink
                        href="/book/new?source=paste"
                        icon={shelfIcons.paste}
                        onNavigate={close}
                      >
                        Paste text
                      </MenuLink>
                    </>
                  )}
                </Menu>
              </div>

              {/* Only where there is no sidebar to hold it. The account moved
                to the foot of the rail, and the rail is `hidden md:flex` —
                so on a phone this is the one way to reach sign-out, and
                removing it outright would have stranded exactly the writers
                least able to work around it. */}
              <div className="col-start-2 row-start-1 justify-self-end md:hidden">
                <AccountMenu account={account} />
              </div>
            </div>
          </header>

          {/* Capped, so the cards do not stretch to a metre wide on a desktop
            monitor and leave the eye travelling between a number and its
            label. */}
          <main className="mx-auto max-w-6xl px-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:px-6 md:pb-16">
            <div className="mt-8 mb-7 flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-fg">
                {area === "write" ? VIEW_LABEL[view] : meta.label}
              </h1>
              {!meta.live && <Badge>Not built yet</Badge>}
            </div>

            {area === "overview" && (
              <Overview
                plan={plan}
                current={current}
                books={active.length}
                words={totals.words}
                chapters={totals.chapters}
              />
            )}

            {area === "write" && (
              <Write
                /* Only over the active list. Archived, Trash and Favourites
                   are lists a writer came to *manage*, and a card about the
                   book they are drafting is an interruption on all three. */
                banner={
                  view === "active" ? (
                    <CurrentBookCard
                      current={current}
                      all={active}
                      onDetails={setEditing}
                      onCover={setCovering}
                      onPrepare={showInPrepare}
                    />
                  ) : null
                }
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
                onRestore={handleRestore}
              />
            )}

            {area === "prepare" && (
              <Prepare books={active} onCover={setCovering} focus={focus} />
            )}

            {area === "tools" && <Tools books={active} current={current} />}

            {area === "track" && <Track books={active} />}

            {/* Mounted only when the area is open, so the member-list request is
              never made by a writer who does not share books. */}
            {/* The signed-in writer's own face is already here — resolved on the
              server and handed down with the page — so the disc that leads
              every pile paints with the first frame instead of waiting on a
              round trip for something we were already holding. */}
            {area === "collab" && <CollabArea account={account} />}
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
        {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}
        {dialog === "support" && (
          <SupportDialog onClose={() => setDialog(null)} />
        )}
        {dialog === "feedback" && (
          <FeedbackDialog onClose={() => setDialog(null)} />
        )}
        {/* What it will be, in the writer's terms — and no date. A date is a
          promise with a number on it, which is the thing the landing page
          refuses to make about unbuilt work, and this screen is held to the
          same rule. */}
        {dialog === "community" && (
          <ComingSoonDialog title="Community" onClose={() => setDialog(null)}>
            Somewhere to ask the writers who have already been through this —
            what a cover cost them, which aggregator paid, whether the third
            book is really where it turns. Not built yet, and it is not here as
            a preview: this button exists so you know it is coming rather than
            wondering whether you missed it.
          </ComingSoonDialog>
        )}
        {/* Says what it will do and what is honestly true of it now. The
            transcription itself is written and tested — what is not finished
            is the way in, and claiming otherwise would be the "no claim the
            code can't back" rule broken on the one screen where a writer is
            deciding whether to trust the rest of it. */}
        {dialog === "audiobook" && (
          <ComingSoonDialog
            title="Audiobook to text"
            onClose={() => setDialog(null)}
          >
            Hand over a recording of your book being read and get the words
            back, split into chapters at the pauses a narrator leaves. The
            transcription behind it works; the way into it is not finished, so
            it is named here rather than offered — you are not missing a button
            somewhere.
          </ComingSoonDialog>
        )}

        {trashing && (
          <ConfirmDialog
            title="Move this book to the trash?"
            body={
              <>
                <span className="text-fg">{trashing.title}</span> leaves your
                shelf. You can restore it from the trash.
              </>
            }
            confirmLabel="Move to trash"
            onConfirm={() => trashBook(trashing.id)}
            onClose={() => setTrashing(null)}
          />
        )}

        {noRoomFor && (
          /* The same comparison the new-book form shows, because it is the same
             limit — two screens wording one refusal differently is how a plan
             stops being legible. `restore` only changes the line above the
             headline. */
          <UpgradeDialog reason="restore" onClose={() => setNoRoomFor(null)} />
        )}

        {erasing && (
          <ConfirmDialog
            title="Delete this book for good?"
            body={
              <>
                <span className="text-fg">{erasing.title}</span>
                {bookWordCount(erasing) > 0 ? (
                  <>
                    {" "}
                    and all{" "}
                    <span className="text-fg">
                      {bookWordCount(erasing).toLocaleString()} words
                    </span>{" "}
                    in it
                  </>
                ) : null}{" "}
                would be gone. This cannot be undone.
              </>
            }
            confirmLabel="Delete for good"
            onConfirm={() => deleteBook(erasing.id)}
            onClose={() => setErasing(null)}
          />
        )}
      </div>
    </EditCoverContext.Provider>
  );
}

function MobileDashboardNavigation({
  account,
  area,
  onArea,
  onClose,
  onDialog,
}: {
  account: Account | null;
  area: Area;
  onArea: (area: Area) => void;
  onClose: () => void;
  onDialog: (
    dialog: "help" | "support" | "feedback" | "community" | "audiobook",
  ) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    /* Do not call `close()` from this effect's cleanup. React Strict Mode runs
       mount effects through a setup/cleanup/setup cycle in development; a
       cleanup close fires the dialog's `onClose`, clears `navigationOpen`, and
       makes the drawer disappear the instant it is opened on localhost. An
       unmounted dialog leaves the top layer automatically, so cleanup has no
       browser resource to release. The guard also makes the second Strict Mode
       setup harmless. */
    if (!dialog.open) dialog.showModal();
  }, []);

  const showDialog = (
    value: "help" | "support" | "feedback" | "community",
  ) => {
    onClose();
    requestAnimationFrame(() => onDialog(value));
  };

  return (
    <dialog
      id="mobile-dashboard-navigation"
      ref={ref}
      aria-label="Dashboard navigation"
      data-dialog-presentation="navigation"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      className="oc-mobile-navigation fixed inset-0 m-0 h-[var(--oc-visual-height)] max-h-none w-full max-w-none bg-panel p-0 text-fg backdrop:bg-black/65 md:hidden"
    >
      <section className="flex h-full min-h-0 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-line pt-(--oc-safe-top) pr-[max(0.5rem,var(--oc-safe-right))] pl-[max(1rem,var(--oc-safe-left))]">
          <Link
            href="/"
            onClick={onClose}
            className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight text-fg"
          >
            Open<span className="text-wordmark">Chapter</span>
          </Link>
          <button
            type="button"
            autoFocus
            onClick={() => ref.current?.close()}
            aria-label="Close navigation"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span aria-hidden="true" className="text-2xl leading-none">×</span>
          </button>
        </header>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto py-4 pr-[max(0.75rem,var(--oc-safe-right))] pl-[max(0.75rem,var(--oc-safe-left))]">
          <nav aria-label="Book workflow" className="flex flex-col gap-1">
            {AREAS.filter((item) => item.stage).map((item) => (
              <SideItem
                key={item.id}
                icon={SIDEBAR_ICONS[item.id] ?? item.icon}
                active={area === item.id}
                onClick={() => onArea(item.id)}
              >
                {item.label}
              </SideItem>
            ))}
          </nav>

          <div className="mt-4 border-t border-line pt-3 pb-3">
            <SideItem
              icon={SIDEBAR_ICONS.support}
              onClick={() => showDialog("support")}
            >
              Support
            </SideItem>
            <SideItem
              icon={SIDEBAR_ICONS.feedback}
              onClick={() => showDialog("feedback")}
            >
              Send feedback
            </SideItem>
            <SideItem icon={SIDEBAR_ICONS.pricing} href="/upgrade">
              Pricing
            </SideItem>
          </div>
        </div>

        <footer className="shrink-0 border-t border-line bg-panel pt-2 pr-[max(0.75rem,var(--oc-safe-right))] pb-[max(0.75rem,var(--oc-safe-bottom))] pl-[max(0.75rem,var(--oc-safe-left))]">
          <AccountMenu account={account} variant="bar" />
        </footer>
      </section>
    </dialog>
  );
}

/* ---- Areas --------------------------------------------------------------- */

/*
 * `FINDINGS_SHOWN` lived here — how many findings the Overview card listed
 * before offering the rest. It is gone with the list: the card now carries the
 * counts and a way to Prepare, which holds every finding with its fix. The
 * reasoning behind the old number is the reasoning for the change, and it was
 * written down at the time: "a dashboard that lists eleven problems is not a
 * dashboard, it is the export screen with a different heading". Five was a
 * smaller version of the same mistake.
 */

/** What a book is *doing*, in the writer's terms rather than the roadmap's. */
const PHASE_STATE: Record<Phase, string> = {
  write: "Drafting",
  revise: "Revising",
  prepare: "Getting it ready",
  launch: "Before you publish",
  publish: "Publishing",
};

/**
 * The pictures behind the band, and the order they come round in.
 *
 * Two, both of somebody reading or writing at the edge of a day. They are
 * decoration and carry no information, so they are `aria-hidden` and their
 * `alt` is empty — a screen reader that read "a person sitting above the
 * clouds" here would be reading out the wallpaper.
 */
const BAND_SLIDES: readonly {
  src: string;
  position: string;
  /**
   * A thin wash, for a picture bright enough to swallow white type.
   *
   * Per picture rather than over all six, which is the whole point of it. A
   * scrim across every slide was here once and came off: five of these are
   * dark where the words sit and were being dimmed to protect type that was
   * already legible. The ringed planet is the exception — a pale sky behind
   * the greeting — so it is the one that carries one.
   */
  scrim?: boolean;
}[] = [
  /* `position` is the crop, and every picture carries its own because the
     subject is never in the same place twice.

     The numbers run high — 86%, 88%, 92% — and that is arithmetic rather than
     taste. The band is about four times as wide as it is tall; these files are
     16:9 or squarer. `object-cover` scales to fill the width, so most of the
     height is cropped away, and a centred crop keeps the middle: which in a
     picture of somebody sitting under a big sky is the sky. The figure is
     almost always in the bottom third, so the window has to be pulled most of
     the way down the frame to hold it. */
  { src: "/banner-dawn.webp", position: "50% 74%" },
  { src: "/banner-night.webp", position: "50% 78%" },
  /* These two were re-shot at full size, so their crops are re-set with them:
     the earlier files were 735px wide and the band stretched them. */
  { src: "/banner-swirl.webp", position: "64% 52%" },
  { src: "/banner-planet.webp", position: "60% 74%", scrim: true },
  { src: "/banner-lantern.webp", position: "50% 92%" },
  { src: "/banner-lamplight.webp", position: "45% 86%" },
] as const;

/** How long each one holds before the next fades up. */
const BAND_DWELL_MS = 7000;

/**
 * Whether the writer has asked their system to keep still.
 *
 * `useSyncExternalStore` rather than an effect that sets state: the query is an
 * external source with a subscription of its own, which is exactly what the
 * hook is for, and it avoids a first paint that animates before being told not
 * to. `ThemeSync` listens to `prefers-color-scheme` the same way.
 */
function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // On the server there is nobody to ask, and "still" is the safe answer:
    // markup that arrives already animating cannot be un-animated politely.
    () => true,
  );
}

/**
 * The band across the top of the dashboard, and the only full-bleed thing on it.
 *
 * It sits **above** the page's own title rather than inside the area, which is
 * the arrangement the reference uses and the one that reads correctly: the band
 * is about the writer and the session, the title underneath is about the screen
 * they are looking at.
 *
 * **No gutter.** It runs the full width of the content column — the negative
 * margin cancels `main`'s padding — and takes square corners with it, because a
 * rounded rectangle inset from both edges is a *card*, and a card is a thing on
 * the page rather than the top of it.
 *
 * The trail names where the writer is. Two levels and no links: the rail beside
 * it is how you move, so a clickable "Dashboard" here would be a second door to
 * the room you are already standing in.
 *
 * **The type is white whatever the theme is**, and that is not the theme being
 * ignored. It sits on a photograph, so it follows the photograph — the same
 * reasoning the landing page's `lp-*` set is built on, and why the scrim under
 * it is part of the picture rather than a colour token. Everything below the
 * band goes back to the writer's chosen theme at once.
 */
function WelcomeBand({
  account,
  current,
  settled,
}: {
  account: Account | null;
  current: Book | null;
  settled: boolean;
}) {
  const greeting = useGreeting();
  const still = usePrefersReducedMotion();
  const [slide, setSlide] = useState(0);

  /*
   * The pictures come round on their own, and stop when asked to.
   *
   * Nothing here is a control a writer is waiting on, so a system that has said
   * "reduce motion" gets the first picture and no interval at all — not a
   * slower one. The dots below still work, so the second picture is reachable
   * by choice rather than only by waiting.
   */
  useEffect(() => {
    if (still) return;
    const id = window.setInterval(
      () => setSlide((n) => (n + 1) % BAND_SLIDES.length),
      BAND_DWELL_MS,
    );
    return () => window.clearInterval(id);
  }, [still]);

  /**
   * The first name, and only if a provider gave us one.
   *
   * An email address is not a name — greeting somebody as
   * "kha.akashanadeel@gmail.com" is worse than greeting them as nobody — so
   * `account.name` is the only source, and the band simply drops the comma when
   * there is nothing to put after it.
   */
  const firstName = account?.name?.trim().split(/\s+/)[0] ?? null;

  /**
   * The one line under the greeting, and it reports rather than cheers.
   *
   * A band like this usually carries a slogan. What a writer opening the app
   * wants from it is where they left off, so that is what it says — the book
   * and when it was last open, or, on an empty shelf, the plain fact of that.
   */
  const standing = current
    ? `Last open: ${current.title}, ${relativeTime(current.lastOpenedAt)}.`
    : settled
      ? "Nothing on the shelf yet. Start one, or bring in a manuscript you already have."
      : "Fetching your shelf…";

  return (
    <section className="relative -mx-4 overflow-hidden px-4 py-10 sm:-mx-6 sm:px-6 sm:py-12">
      {/* The pictures, stacked and crossfaded. Both are in the markup from the
          first paint so the second does not arrive as a white flash seven
          seconds in; only the opacity moves. */}
      {BAND_SLIDES.map((picture, i) => (
        // A plain <img>, like the covers and the account photo: these are two
        // fixed decorations already sized for the strip, so next/image would
        // add a loader and a config entry for no gain a writer could see.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={picture.src}
          src={picture.src}
          alt=""
          aria-hidden="true"
          fetchPriority={i === 0 ? "high" : "low"}
          style={{ objectPosition: picture.position }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
            i === slide ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* **Nothing between the type and the picture, on five of the six.** A
          scrim across all of them was the first answer and came off: the
          pictures are the point, and dimming five dark ones to protect type
          that was already legible is the interface apologising for them.

          The sixth earns one. The ringed planet is pale exactly where the
          greeting sits, and white on that sky is not readable at any weight.
          It fades in and out with its own picture rather than being switched
          on, so the change between slides stays one movement. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-black transition-opacity duration-1000 ease-in-out ${
          BAND_SLIDES[slide].scrim ? "opacity-35" : "opacity-0"
        }`}
      />

      <div className="relative z-10 max-w-xl">
        <nav aria-label="Breadcrumb" className="text-xs font-medium text-white/70">
          <ol className="flex items-center gap-1.5">
            <li>Dashboard</li>
            <li aria-hidden="true">›</li>
            <li className="text-white" aria-current="page">
              Overview
            </li>
          </ol>
        </nav>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-pretty text-white sm:text-3xl">
          {greeting}
          {/* The name, in the same white as the rest of the line. It wore an
              accent pill, which was the reference's highlight copied across
              without the reason: on that page the band is a flat colour and the
              pill is the only thing lifting the name off it. Here the band is a
              photograph, the greeting already stands out against it, and the
              pill was a blue rectangle stamped over the picture. */}
          {firstName ? `, ${firstName}` : null}
        </h2>
        <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-white/85">
          {standing}
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href={START.href}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
          >
            {START.label}
          </Link>
          <Link
            href={IMPORT.href}
            className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm"
          >
            {IMPORT.label}
          </Link>
        </div>
      </div>

      {/* Dots, and they are buttons rather than pips. Something that moves on
          its own has to be steerable, or a writer who wants the other picture
          can only wait for it. */}
      <div className="absolute right-4 bottom-4 z-10 flex gap-1.5 sm:right-6 sm:bottom-5">
        {BAND_SLIDES.map((picture, i) => (
          <button
            key={picture.src}
            type="button"
            onClick={() => setSlide(i)}
            aria-label={`Show picture ${i + 1} of ${BAND_SLIDES.length}`}
            aria-current={i === slide}
            className={`h-1.5 rounded-full transition-all ${
              i === slide ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The book a writer is in the middle of, and what is standing in its way.
 *
 * It opened the dashboard until the owner moved it here, and here is the better
 * place for it: a card about *one* book among a list of books, rather than
 * above three figures about the whole shelf. Overview keeps what is true of the
 * writer — the week, the plan, the target — and Write keeps what is true of a
 * manuscript.
 *
 * Everything it carries came with it unchanged: the picker, the phase, the
 * findings banner and its dismissal, and the three controls. The state lives
 * here now rather than in `Overview`, which is the whole of what the move cost.
 */
function CurrentBookCard({
  current,
  all,
  onDetails,
  onCover,
  onPrepare,
}: {
  current: Book | null;
  all: Book[];
  onDetails: (b: Book) => void;
  onCover: (b: Book) => void;
  onPrepare: (bookId: string) => void;
}) {
  void onPrepare;

  const settled = useLibrarySettled();

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

  /* `waved`, `coverEpoch` and the `counts` memo went with the readiness
     banner below — see the note at its old site. `storeReadiness` is still
     the one source of these findings and the export screen still reads it;
     what is gone is this screen counting them for a banner that had nowhere
     to send anybody. */

  const steps = useMemo(
    () => (book ? roadmapFor(book, book.roadmapDone ?? []) : []),
    [book],
  );
  const progress = useMemo(
    () => (steps.length > 0 ? progressOf(steps) : null),
    [steps],
  );



  return (
    <>

      {book ? (
        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-4 p-4 sm:flex sm:flex-wrap sm:gap-5 sm:p-5">
            {/* **The cover edits the book, it no longer opens it.** It was a
                `<Link>` to `/book/<id>`, and the two cannot both live on one
                picture. Nothing is stranded by the change: "Open book" and
                "Read" are the two buttons directly under this card, and the
                title beside it is still a link — where the cover was the
                *only* way to something, it kept its link. What it buys is the
                thing a writer reaches for when they look at a cover and find
                their title printed twice, or the wrong name under it. */}
            <span className="col-start-1 row-start-1 w-20 shrink-0 sm:w-[92px]">
              <CoverOf book={book} editable />
            </span>

            <div className="contents sm:block sm:min-w-[16rem] sm:flex-1 sm:basis-auto">
              <div className="col-start-2 row-start-1 flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4">
                <div className="min-w-0">
                  {/* The state of the book, not a greeting. This was "Pick up
                      where you left off", which made the largest block on the
                      first screen a writing prompt — wrong for most people who
                      arrive, who already have a manuscript and want to know
                      what is standing between it and a shop. */}
                  {/* The badge rides the phase line rather than sitting under
                      the title, the same place the book's own overview puts it:
                      whose book this is belongs *above* the name, and here it
                      also costs no height on a shelf of one's own books, where
                      it draws nothing. */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="text-xs font-bold tracking-widest text-muted uppercase">
                      {progress?.next
                        ? PHASE_STATE[progress.next.phase]
                        : "Every step done"}
                    </p>
                    <SharedBadge book={book} />
                  </div>
                  <h2 className="mt-1.5 line-clamp-2 text-pretty break-words text-xl font-bold text-fg">
                    {book.title}
                  </h2>
                  <p className="mt-1 text-sm leading-snug text-muted">
                    <span>
                      {plural(bookChapterCount(book), "chapter")} ·{" "}
                      {plural(bookWordCount(book), "word")}
                    </span>
                    <span className="block sm:inline">
                      <span className="hidden sm:inline"> · </span>
                      Opened {relativeTime(book.lastOpenedAt)}
                    </span>
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
                    triggerClassName="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border
                                      border-line bg-surface px-3 py-2 text-xs
                                      font-semibold text-fg hover:bg-raised active:bg-raised focus-visible:outline-none
                                      focus-visible:ring-2 focus-visible:ring-accent/50"
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
              {/* The target used to draw a bar here. It is a gauge in the
                  column beside this card now — one figure in one place, rather
                  than the same percentage twice on one screen. */}

              {/* ---- The diagnosis, and why it is not here ---------------

                  **The readiness banner came off this card on 2026-08-25.**
                  It counted what a shop would refuse, and it offered a way
                  to the list that puts those right — and under the launch
                  flag there is no such list. Every destination in
                  `DESTINATIONS` is a tool `HIDDEN_BOOK_TOOL_PATHS`
                  redirects home: listing, covers, categories, paperback. So
                  the first screen a writer saw named four problems with
                  their book and led nowhere at all.

                  A finding nobody can act on is worse than no finding: it is
                  the invented-verdict failure this app refuses everywhere
                  else, arriving by the back door. The export screen keeps
                  its own readiness step, because the thing it points at —
                  the export — is reachable.

                  `checkup.ts`, `findingsFrom` and `storeReadiness` are
                  untouched and still tested. This is a gate over them, not
                  their removal, and it lifts when the Prepare tools do. See
                  TODO.md under "Taken out on purpose". */}

              {/* The three verbs for a book, then ⋯.

                  This row was two buttons and a menu, under a note warning
                  that four of equal weight make the writer read all four to
                  find the one they want. That warning still stands and is why
                  this is *three* and not five — what changed is that the third
                  is not a fourth thing competing, it is the question the whole
                  screen is answering: write it, read it, or find out what
                  comes next.

                  Its two former homes are gone rather than kept as spares. It
                  was in the ⋯ menu, which is now for what is genuinely
                  secondary, and a hidden copy of a control sitting visible on
                  the same card is dead weight that has to be maintained
                  anyway. */}
              <div className="col-span-2 mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm sm:flex sm:flex-wrap">
                <Link
                  href={`/book/${book.id}`}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border
                             border-accent bg-accent px-4 py-2 font-semibold text-accent-ink
                             transition-colors hover:bg-accent-strong active:bg-accent-strong focus-visible:outline-none
                             focus-visible:ring-2 focus-visible:ring-accent/50 sm:border-line
                             sm:bg-surface sm:text-fg sm:hover:bg-raised"
                >
                  {shelfIcons.write}
                  Open book
                </Link>
                <Link
                  href={`/book/${book.id}/export`}
                  aria-label="Export this book"
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border
                             border-line bg-surface px-4 py-2 font-semibold text-fg
                             transition-colors hover:bg-raised active:bg-raised focus-visible:outline-none
                             focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  {shelfIcons.prepare}
                  Export
                </Link>
                <Menu
                  label={`More for ${book.title}`}
                  width={232}
                  triggerClassName="flex h-11 w-11 items-center justify-center justify-self-end
                                    rounded-lg border border-line bg-surface text-fg transition-colors
                                    hover:bg-raised active:bg-raised focus-visible:outline-none focus-visible:ring-2
                                    focus-visible:ring-accent/50 sm:h-auto sm:w-auto sm:px-2.5 sm:py-2"
                  trigger={shelfIcons.more}
                >
                  {(close) => (
                    <>
                      {/* The "Prepare" pair that used to head this menu —
                          Export and publish, What to do next — is gone: both
                          are now on the card itself, one as a button in the
                          row above and both as tiles in "Get it out" at the
                          foot. A menu whose first half repeats what is already
                          on screen teaches a writer that it holds nothing, and
                          then they stop opening it for the things it does
                          hold. What is left is what has no other way in. */}
                      <MenuLabel>This book</MenuLabel>
                      {/* Here rather than on the card, by the rule the note
                          above states: the row holds what a writer reaches for
                          every day, and this menu holds what has no other way
                          in. A whole-book read is a thing you do once, near
                          the end — not a third button beside Open and
                          Export. */}
                      <MenuLink
                        href={`/book/${book.id}/consistency`}
                        icon={shelfIcons.search}
                        onNavigate={close}
                      >
                        Check for consistency
                      </MenuLink>
                      <MenuButton
                        icon={shelfIcons.info}
                        onClick={() => {
                          onDetails(book);
                          close();
                        }}
                      >
                        Details
                      </MenuButton>
                      {/* "Edit", because it is one.
                      
                          This sat directly under "Details" and was called
                          "Book details" — two near-identical names, one of
                          which opens a read-only card and the other a form
                          with Save and Cancel. Nothing in either label said
                          which was which, so the only way to find the edit
                          screen was to open both. A menu item is a promise
                          about what happens next; this one now keeps it, and
                          takes the pencil so the pair differ by mark as well
                          as by word. */}
                      <MenuButton
                        icon={shelfIcons.write}
                        onClick={() => {
                          onCover(book);
                          close();
                        }}
                      >
                        Edit title, author and cover
                      </MenuButton>
                    </>
                  )}
                </Menu>
              </div>
            </div>
          </div>
        </section>
      ) : settled ? (
        <EmptyState
          title="Nothing on the shelf yet"
          primary={START}
          secondary={IMPORT}
        >
          Start one and name it later, or bring in a manuscript you already have
          — .docx, .epub, .md, .txt or .html. Then this screen tells you what
          stands between it and a shop.
        </EmptyState>
      ) : (
        /* **Waiting, not empty — and the difference is the first thing a
            writer saw on signing in.** On a machine that has just signed in,
            storage is genuinely empty for the second or two the library takes
            to come down, and `useHydrated` cannot tell that apart from a shelf
            with nothing on it. So the dashboard greeted somebody with thirteen
            chapters on the server with "Nothing on the shelf yet", then
            swapped it for their book once the download landed.

            A placeholder rather than a spinner, and at the height of the card
            it is standing in for, so the page does not jump when the real one
            arrives. No words: there is nothing true to say yet, and "Loading
            your books" would be a claim about somebody who may simply have
            none. */
        <div
          aria-hidden="true"
          className="h-64 animate-pulse rounded-2xl border border-line bg-panel"
        />
      )}
    </>
  );
}

function Overview({
  plan,
  current,
  books,
  words,
  chapters,
}: {
  /** Read once at the root, because the restore gate reads it too. */
  plan: PlanState;
  /** The book the shelf is on — the dial is about this one, and follows it. */
  current: Book | null;
  books: number;
  words: number;
  chapters: number;
}) {
  const activity = useActivity();
  /* `useLibrarySettled` used to be read here for the empty state. The empty
     state moved out with the book card, and the band above the title reads it
     from the shell now — one caller, at the top. */

  /*
   * **Advance readers past their date are not counted here any more.**
   *
   * Every book's list was read at this point, filtered through `isOverdue`,
   * and drawn as the amber panel below — the one thing on this screen that was
   * *urgent* rather than merely true. The whole of it came out on 2026-08-13
   * with the rest of the chasing, so the read, the frozen clock it needed and
   * the panel are all gone rather than left computing something nothing draws.
   * The rule survives in `arc.ts`; see TODO.md under "Taken out on purpose".
   */

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

  return (
    <div className="flex flex-col gap-5">
      {/* ---- What is on the shelf ----------------------------------------

          Three cards rather than three rows in one panel. As rows they read as
          a footnote to the book; as cards they are the row every dashboard of
          this kind opens with, and they are the only figures on this screen
          that are true of the whole library rather than of one manuscript. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure
          icon={shelfIcons.overview}
          label={books === 1 ? "book" : "books"}
          value={books.toLocaleString()}
          iconColor="text-blue-700 dark:text-blue-400"
        />
        <Figure
          icon={shelfIcons.write}
          label={nounFor(words, "word")}
          value={words.toLocaleString()}
          iconColor="text-emerald-700 dark:text-emerald-400"
        />
        <Figure
          icon={shelfIcons.prepare}
          label={nounFor(chapters, "chapter")}
          value={chapters.toLocaleString()}
          iconColor="text-amber-700 dark:text-amber-400"
        />
      </div>

      {/* ---- The book, and the figures beside it --------------------------

          The book takes the wide column because it is what the screen is for:
          a diagnosis, with the controls that answer it. The four counts are a
          margin note and read as one — stacked in a single panel rather than
          scattered as four cards, which is what they were, and which gave a
          rounding error the same weight as the manuscript. */}
      {/* ---- The week, the plan, and the target ---------------------------

          Two columns of equal weight, which is the shape the reference uses
          and the right one here now that the book has moved: what is left are
          three cards about the *writer* rather than about one manuscript, and
          none of them outranks the others enough to take the wide side.

          The book card that stood on the left is at the top of Write, where a
          card about one book belongs among the books. */}
      {/* No `items-start`: the two columns run to the same floor, which is
          what the reference does and what stops a short card leaving a step
          across the middle of the screen. The week card is the one that
          stretches — its chart has somewhere to grow into, where the dial and
          the plan card are the size they are. */}
      <div className="grid gap-5">
        <WritingPerformanceCard />

        <div className="grid gap-5 lg:grid-cols-2">
          <ProCard plan={plan} />
          {/* Nothing at all until this book carries a target — an empty dial
              is a nought per cent nobody asked for. The place to set one is
              the book card in Write, which is where the picker lives. */}
          {current?.targetWords ? (
            <TargetGauge book={current} target={current.targetWords} />
          ) : null}
        </div>
      </div>


      {/* An amber panel counting advance readers past their date stood here
          until 2026-08-13 — the one *urgent* thing this screen ever raised —
          and it came out with the rest of the chasing, to be rebuilt with it.
          `isOverdue` in `arc.ts` is the rule it was computed from and is kept
          for that; see TODO.md under "Taken out on purpose". */}

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
    </div>
  );
}

// `CoverShelf` is gone. Two rows of covers stood between the band and the book
// for an afternoon, and they pushed the diagnosis — the thing this screen is
// for — below the fold on a laptop to show a shelf the rail already opens.
// Nothing was lost with it: Write lists every book, with a cover each.

/**
 * The band over the Write area.
 *
 * The same strip as `WelcomeBand` in every way that shows — full bleed to the
 * window's own margin, a breadcrumb, a statement, and the two doors onto a new
 * book — and a different thing underneath, because the picture is a drawing
 * rather than a photograph. A flat illustration cannot be a *ground*: white
 * type on it is unreadable and stretching a square across a wide strip crops it
 * to a shoulder. So the ground is the app's own accent at a wash, the type is
 * the ordinary ink, and the drawing stands on the floor of the band at its own
 * aspect. `scripts/cut-illustration.cjs` is what took its white background off.
 *
 * **It reports rather than cheers**, which is the rule the other band was
 * argued into: what it says is how many books are on the shelf, and the line
 * under it is what the two buttons do. A slogan here would be the one thing
 * this screen has no room for.
 *
 * `settled` is the reconcile gate, not the storage one — until the library has
 * finished reconciling, a count of nought is a fact about the *loading* and not
 * about the writer, and a band that opens with "nothing on the shelf yet" over
 * a shelf of six books is the screen lying for a beat.
 */
function WriteBand({ books, settled }: { books: number; settled: boolean }) {
  const empty = settled && books === 0;

  return (
    <section
      className="relative -mx-4 overflow-hidden bg-accent/8 px-4 sm:-mx-6 sm:px-6"
    >
      <div className="flex items-end gap-6">
        <div className="max-w-xl py-9 sm:py-10">
          <nav aria-label="Breadcrumb" className="text-xs font-medium text-muted">
            <ol className="flex items-center gap-1.5">
              <li>Dashboard</li>
              <li aria-hidden="true">›</li>
              <li className="text-fg" aria-current="page">
                Books
              </li>
            </ol>
          </nav>

          <h2 className="mt-3 text-2xl font-bold tracking-tight text-pretty text-fg sm:text-3xl">
            {empty
              ? "Nothing on the shelf yet"
              : `${plural(books, "book")} on the shelf`}
          </h2>
          <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-muted">
            {empty
              ? "Start one, or bring in a manuscript you already have."
              : "Open one to carry on, start the next, or bring in a manuscript you already have."}
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href={START.href}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              {START.label}
            </Link>
            <Link
              href={IMPORT.href}
              className="rounded-lg border border-line bg-panel px-4 py-2 text-sm font-semibold text-fg"
            >
              {IMPORT.label}
            </Link>
          </div>
        </div>

        {/* A plain <img>, like the other band's slides: a fixed decoration
            already sized for its slot. It stands on the band's floor — no
            bottom padding under it — because the drawing has a desk along its
            own bottom edge, and a gap under a desk reads as a mistake. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/write-band.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none ml-auto hidden w-[40%] max-w-80 shrink-0
                     self-end select-none sm:block"
        />
      </div>
    </section>
  );
}

/**
 * The band over the Favourites list.
 *
 * `WriteBand`'s shape — full bleed, breadcrumb, a statement, a drawing at the
 * right — with two deliberate differences.
 *
 * **The picture keeps its own background, and the band takes that colour.**
 * The other two illustrations were cut out and set on the app's own ground;
 * this one is a wide frame of flat grey with the figure standing at the right
 * of it, and cutting her out would throw away the thing that makes it work. So
 * the band is painted the picture's own `#e7e1e3` and the drawing stands on it,
 * which makes the seam between the two invisible at any width. What *was*
 * trimmed is only the empty grey the figure is not standing in — the frame is
 * a quarter figure and three quarters air, and at the band's height that left
 * her about the size of a postage stamp.
 *
 * **The type is pinned dark rather than tokened**, and the band is light in
 * both themes. That is the same rule `WelcomeBand` follows in the other
 * direction: type over a picture takes its colour from the picture, which does
 * not know what theme it is in, and `text-fg` would turn white at night over a
 * grey that stays grey. Three literals, all of them the picture's, and they
 * live nowhere else.
 *
 * **No buttons.** The other band offers the two doors onto a new book because
 * Write is where books are made; Favourites is a *filter over* that list and
 * there is nothing here to start. What the line does instead is answer the
 * question the screen raises — a star moves nothing, and it does not travel.
 */
function FavouritesBand({
  books,
  settled,
}: {
  books: number;
  settled: boolean;
}) {
  /* Settled, not hydrated: a count of nought before the library has finished
     reconciling is a fact about the loading, and "nothing starred yet" over
     three starred books is the screen lying for a beat. */
  const empty = settled && books === 0;

  return (
    <section
      className="relative -mx-4 overflow-hidden bg-[#e7e1e3] px-4
                 sm:-mx-6 sm:min-h-68 sm:px-6"
    >
      {/* A plain <img>, like the other two bands: a fixed decoration already
          sized for its slot. Hidden below `sm`, where the band is the width of
          a phone and the figure would be standing on the sentence.

          **Half again the height of the band, and anchored near its top.** At
          the band's own height the whole figure fits and every part of her is
          small; run tall and clipped, the band holds the heart, the arms and
          the head at a size worth looking at, and her legs run off the bottom
          edge — which is what `overflow-hidden` on the section is for. The
          small top offset is so the heart clears the band's top edge rather
          than being shaved by it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/favourites-band.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-3.5 right-4 hidden h-[150%]
                   w-auto select-none sm:right-6 sm:block"
      />

      <div className="relative z-10 max-w-xl py-9 sm:py-10">
        <nav aria-label="Breadcrumb" className="text-xs font-medium text-[#6b6873]">
          <ol className="flex items-center gap-1.5">
            <li>Dashboard</li>
            <li aria-hidden="true">›</li>
            <li className="text-[#1c1b22]" aria-current="page">
              Favourites
            </li>
          </ol>
        </nav>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-pretty text-[#1c1b22] sm:text-3xl">
          {empty ? "Nothing starred yet" : `${plural(books, "book")} starred`}
        </h2>
        <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-[#4a4750]">
          {empty
            ? "Star a book from its ⋯ menu and it shows up here."
            : "A star is a filter rather than a folder: the book stays on the shelf with the rest."}{" "}
          Stars stay in this browser.
        </p>
      </div>
    </section>
  );
}

/**
 * The word target of the book the writer is in, as a half-dial.
 *
 * The same figure the book card used to draw as a bar, and now the only place
 * it appears — two readings of one percentage on one screen is two things to
 * keep in step.
 *
 * **It follows the shelf's own idea of "the book you are in"** — `current` in
 * the screen above, which is the remembered book and failing that the most
 * recently opened one. So the dial moves to whatever was last worked on rather
 * than being pinned to a book chosen once.
 *
 * A shelf-wide version of this — every target added up, with the words capped
 * per book so one novel could not lend its overshoot to another — was built and
 * taken out again on 2026-08-24. It was a truer figure about the *library* and
 * a worse one to open the day with: a writer wants to know where the book they
 * are in stands, and the three counts across the top of this screen are already
 * the whole shelf.
 *
 * **It names its book, and it opens it.** The card that used to sit beside it —
 * with the title, the cover and the picker — is in Write now, so a dial
 * captioned only "Target" would be a percentage of nothing a reader could see,
 * and a percentage with no way into the book it is about is a dead end.
 *
 * All three judgements come from `lib/target.ts` and none are re-derived here:
 * the share is floored so nothing rounds up into a claim, a non-zero count
 * under one per cent says so in words, and `met` is asked of the words
 * themselves. The arc turns green only on `met`, which is the house rule that
 * green is the verdict for having arrived rather than a colour for 94%.
 *
 * Two things the first draft got wrong, both worth keeping written down. The
 * figure was positioned in HTML over the SVG and landed on the arc itself; it
 * is a `<text>` inside the drawing now, so it sits in the dial's mouth at any
 * width. And a round line-cap on an arc of *zero* length draws a dot — so a
 * book at "under 1%" wore a bead at the left end of an empty track. The value
 * arc is not drawn at all until there is something to draw.
 */
function TargetGauge({ book, target }: { book: Book; target: number }) {
  /* Summed on read like everywhere else — no count is stored, so this is the
     same number the shelf card and the editor's own footer show. */
  const words = bookWordCount(book);
  const { share, label, met } = targetShare(words, target);
  /* One id per instance. Two dials on a page would otherwise share a gradient
     definition, and the second would silently paint with the first one's. */
  const fillId = useId();

  /* A half circle of radius 58 centred at (70, 72): the arc runs left to right
     over the top, so its length is pi times r and the dash is the part
     written. Stroke rather than a filled wedge, because a stroke can be
     rounded at both ends. */
  const radius = 58;
  const length = Math.PI * radius;
  const drawn = (share / 100) * length;
  const remaining = Math.max(0, target - words);

  /* Where the drawn arc ends, for the pointer. The sweep runs from pi (left)
     to 0 (right), so the angle falls as the share rises. */
  const angle = Math.PI * (1 - share / 100);
  const tip = {
    x: 70 + Math.cos(angle) * radius,
    y: 72 - Math.sin(angle) * radius,
  };

  return (
    <div className="flex flex-col rounded-lg border border-line bg-panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-fg">Target</h3>
        <p className="min-w-0 truncate text-xs font-medium text-muted">
          {book.title}
        </p>
      </div>

      <svg
        viewBox="0 0 140 88"
        className="mx-auto mt-4 block w-[210px] max-w-full"
        role="img"
        aria-label={`${label} of a ${target.toLocaleString()} word target`}
      >
        <defs>
          {/* Two stops of one hue, not two hues. The rule this house keeps is
              that a colour means something; a wash from pale to full is the
              same colour saying "more of it", which is what the dial is for. */}
          <linearGradient id={fillId} x1="0" y1="1" x2="1" y2="0">
            <stop
              offset="0%"
              stopColor="currentColor"
              stopOpacity={met ? 0.45 : 0.35}
            />
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
        </defs>

        <path
          d="M12 72a58 58 0 0 1 116 0"
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          className="stroke-raised"
        />

        {share > 0 && (
          <g className={met ? "text-ok-fg" : "text-accent"}>
            <path
              d="M12 72a58 58 0 0 1 116 0"
              fill="none"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${drawn} ${length}`}
              stroke={`url(#${fillId})`}
            />
            {/* The pointer, at the head of the drawn arc. Drawn only when there
                is an arc to point at the end of — at nought it would sit on the
                left cap and read as a value nobody has reached. */}
            <circle
              cx={tip.x}
              cy={tip.y}
              r="5.5"
              className="fill-panel stroke-current"
              strokeWidth="3.5"
            />
          </g>
        )}

        {/* In the drawing rather than over it, so the figure keeps the mouth of
            the dial at every width. */}
        <text
          x="70"
          y="68"
          textAnchor="middle"
          className={`fill-current text-[19px] font-extrabold ${
            met ? "text-ok-fg" : "text-fg"
          }`}
        >
          {label}
        </text>
      </svg>

      {/* Two labelled figures, the shape the reference closes on. Named rather
          than left as a bare pair: "24" and "29,976" on one line are two
          numbers a reader has to guess the relationship between. */}
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <span className="text-accent">{shelfIcons.write}</span>
          <div className="min-w-0">
            <dt className="text-xs text-muted">written</dt>
            <dd className="text-sm font-bold tabular-nums text-fg">
              {words.toLocaleString()}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">{shelfIcons.prepare}</span>
          <div className="min-w-0">
            <dt className="text-xs text-muted">{met ? "over by" : "to go"}</dt>
            <dd className="text-sm font-bold tabular-nums text-fg">
              {met
                ? (words - target).toLocaleString()
                : remaining.toLocaleString()}
            </dd>
          </div>
        </div>
      </dl>

      {/* The way into the book the figure is about. Bordered rather than
          filled: the plan card directly above it holds the one filled action
          in this column, and two of them side by side is two things claiming
          to be the way forward. It lands on the book's own screen — the
          overview, where the chapters and the tools are — rather than in a
          chapter, because the writer may be coming here to look rather than
          to type. */}
      <Link
        href={`/book/${book.id}`}
        className="mt-4 block rounded-lg border border-line bg-surface px-4 py-2.5
                   text-center text-sm font-semibold text-fg transition-colors hover:bg-raised"
      >
        Open book
      </Link>
    </div>
  );
}



/**
 * What Pro adds, for somebody who is not on it.
 *
 * **Shown to nobody who is already paying, and nobody who cannot pay** — no
 * gateway configured means nothing is for sale and nothing is held back, which
 * is the rule the whole billing layer follows.
 *
 * The gradient is the documented exception to the one-hue rule (`upgrade-from`
 * / `upgrade-to`, declared identically in both themes because this is a *fill*:
 * following the chrome would put a white slab across a black screen at night).
 * It is the same block `LimitBanner` uses, so the app has one shape for this
 * and not two.
 *
 * Every number is read from `LAUNCH_LIMITS` rather than written out, so the
 * card cannot drift from what the plan actually sells.
 *
 * **The drawing has no background of its own.** It arrived as a flat grey
 * rectangle behind a figure, and a grey rectangle on a purple card is a
 * sticker: the fill was flood-filled away from the frame's edge — a colour key
 * would have punched holes in the phone screen and the speech bubble, which are
 * white too — so what sits on the gradient is the figure alone. `.webp` with an
 * alpha channel, 26KB. `scripts/cut-illustration.cjs` is how it was cut, kept
 * for the next time the picture changes.
 *
 * It is **decoration and says so** — `alt=""` and `aria-hidden` — because
 * everything it depicts is already in the words beside it. It is also hidden
 * below `sm`, where the card is the full width of a phone and there is no room
 * for a figure without squeezing the sentence into a column.
 */
function ProCard({ plan }: { plan: PlanState }) {
  if (plan.loading || !plan.billing || plan.pro) return null;

  return (
    /* A row rather than a picture positioned over the words. The figure is a
       flex item, so the sentence beside it can never end up under a yellow
       sleeve at some width nobody tested — which is exactly what an absolutely
       placed drawing and a hand-tuned measure would do on the one column this
       card is narrowest in. */
    <section
      className="flex gap-4 overflow-hidden rounded-lg bg-linear-to-r
                 from-upgrade-from to-upgrade-to p-5 sm:min-h-52"
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-white">Room for the next book</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/85">
          Pro takes the shelf from {plural(LAUNCH_LIMITS.freeBooks, "book")} to
          unlimited, the assistant from{" "}
          {LAUNCH_LIMITS.freeAssistantRepliesPerMonth} replies a month to{" "}
          {LAUNCH_LIMITS.proAssistantRepliesPerMonth}. Every export format is
          free on either plan.
        </p>
        <Link
          href="/upgrade"
          className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-upgrade-ink"
        >
          See what Pro adds
        </Link>
      </div>

      {/* A plain <img>, like the band's slides and the covers: a fixed
          decoration already sized for its slot, where next/image would add a
          loader and a config entry for no gain a reader could see.

          `-mb-5` cancels the card's own padding so the figure stands on the
          bottom edge rather than floating above it, and the cap stops it
          growing into a poster on a wide screen. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/upgrade-card.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none -mb-5 hidden w-[44%] max-w-72 shrink-0
                   self-end select-none sm:block"
      />
    </section>
  );
}

/**
 * One line of the shelf's summary: a word, and the number of them.
 *
 * Rows in one panel rather than a card each. Four counts as four cards gave
 * "25 books" the same weight on the screen as the manuscript beside it; here
 * they read as what they are — the margin note to the book, not a rival.
 *
 * **The glyph sits in a tinted square, and every one of them is the same
 * tint.** The reference this follows gives each figure its own pastel, which
 * is four hues carrying no information; one accent wash reads as a set, keeps
 * the rule that a hue means something, and still does the job the bubble is
 * there for — giving the eye a fixed left edge to run down.
 *
 * Label above the number, not beside it. A label and a figure on one line make
 * the eye choose between them; stacked, the word is read once and the column
 * of numbers can then be scanned on its own.
 */
function Figure({
  icon,
  label,
  value,
  cardBg = "bg-panel border-line",
  iconColor = "text-fg",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  cardBg?: string;
  iconColor?: string;
}) {
  return (
    /* A `<dl>` per card, not one list split across three. Each of these is a
       single name and its value, and a description list with one pair in it is
       exactly that — where three cards sharing one `<dl>` would tell a screen
       reader they were three parts of one thing. */
    <dl
      className={`flex min-h-28 items-center gap-4 rounded-[8px] border px-6 py-6 sm:min-h-32 sm:py-7 ${cardBg}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center [&>svg]:h-7 [&>svg]:w-7 [&>svg]:stroke-[2] ${iconColor}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="truncate text-xs font-semibold uppercase tracking-wider text-black dark:text-white sm:text-sm">
          {label}
        </dt>
        <dd className="mt-0.5 text-2xl leading-tight font-extrabold tabular-nums text-black dark:text-white sm:text-3xl">
          {value}
        </dd>
      </div>
    </dl>
  );
}

// `DeskFigure` is gone. It was a drawn book and a stack behind it, standing in
// the band while the band was a flat tint — and a line drawing over a
// photograph is two illustrations arguing.
//
// The rule it was built on stands and is worth keeping written down: a *figure*
// in this app is drawn in markup and true of the product, because a figure
// makes a claim. The two pictures that replaced it make none — they are
// wallpaper, and they say so by being `aria-hidden` with no alt text and by
// carrying nothing a reader would lose if they never loaded.

/**
 * "Good morning", once the browser can say what morning is.
 *
 * Kept out of the component because the reasoning is the whole of it: the
 * server has no idea what o'clock it is where the writer is, so a clock read
 * during the server render is a guess React then swaps out from under them on
 * hydration. `useHydrated` is the flag this file already keeps for that shape
 * of question — neutral in the server's markup, specific the moment the client
 * owns the page.
 */
function useGreeting(): string {
  const hydrated = useHydrated();
  if (!hydrated) return "Welcome back";

  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Somewhere to go, or something to do. Empty states take one of each. */
type EmptyAction =
  { label: string; href: string } | { label: string; onClick: () => void };

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
      <p className={`mt-2 max-w-md text-muted ${bare ? "" : "mx-auto"}`}>
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
const START = {
  label: "Start a book",
  href: "/book/new",
} as const satisfies EmptyAction;
/* Into the same wizard the menu's three sources use, rather than the older
   `/book/import` page — an imported book should be asked the same questions a
   blank one is, and there is no reason for the empty state to be the one door
   that skips them. */
const IMPORT = {
  label: "Import a manuscript",
  href: "/book/new?source=file",
} as const satisfies EmptyAction;

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
/**
 * The badge at the head of a finding, in that finding's colour.
 *
 * A filled rounded square rather than a line icon, and it is the one filled
 * glyph on these screens. Every other icon in the dashboard is a 1.75 stroke,
 * which is right for chrome — it sits beside a label without shouting. This
 * one is not chrome: it marks a row as a *refusal* or a *warning* at the head
 * of a banner whose whole job is to be read before the words are, and an
 * outline would make it one more quiet line among the rest.
 *
 * **Two glyphs, not one.** A cross for what a shop would refuse, an
 * exclamation for what is merely worth doing — so the two levels are told
 * apart by shape as well as by hue, which is what makes the distinction
 * survive for a reader who cannot separate red from amber. Colour alone would
 * be the one thing the status family exists not to do.
 *
 * The glyph is knocked out in the banner's own ground rather than in white, so
 * a single drawing serves the pale banner by day and the near-black one at
 * night with no second colour to keep in step.
 */
function AlertMark({ level }: { level: FindingLevel }) {
  const stop = level === "fix";
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-[18px] w-[18px] shrink-0 ${
        stop ? "text-stop-fg" : "text-note-fg"
      }`}
    >
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
      <path
        d={stop ? "M9 9l6 6M15 9l-6 6" : "M12 7.4v6M12 15.9v.7"}
        stroke={stop ? "var(--color-stop-bg)" : "var(--color-note-bg)"}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function FixLink({
  book,
  fix,
  level,
  onCover,
  from,
}: {
  book: Book;
  fix: Fix;
  level: FindingLevel;
  onCover: (b: Book) => void;
  /**
   * The area this was pressed in, so the tool can offer a way back to it.
   *
   * A fix takes the writer out of the dashboard entirely, and the tool's only
   * exit was "All tools" — which returns to the launcher rather than to the
   * list they were working through. Naming the origin is the whole of the fix;
   * `ToolHeader` does the rest.
   */
  from?: AreaId;
}) {
  /*
   * Filled in the severity of the row it sits in, so the banner is one
   * statement rather than a notice with an unrelated action beside it.
   *
   * **`-solid`, not `-fg`, and white ink written literally.** `-fg` is tuned
   * to be read *on* the banner, which at night makes it a bright red or a
   * bright amber — and white on those is around 1.9:1, a button nobody can
   * read. The `-solid` pair is the fill: dark enough for white in either
   * theme, and identical in both blocks because nothing sits on it but its own
   * ink. That is also why `text-white` is right here where it is wrong on
   * `bg-accent` — this fill does not cross over, so an ink token that did
   * would put black on it at night.
   */
  const className = `shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold
                     text-white transition-opacity hover:opacity-90 ${
                       level === "fix" ? "bg-stop-solid" : "bg-note-solid"
                     }`;

  if (fix.kind === "route") {
    return (
      <Link
        href={withReturn(
          `/book/${book.id}${fix.path ? `/${fix.path}` : ""}`,
          from,
        )}
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

// `TargetBar` is gone, and its arithmetic is not: the flooring, the "under 1%"
// and the verdict read off the words rather than the percentage all moved to
// `lib/target.ts`, where they are tested and where `TargetGauge` reads them.
// The bar had one caller — the book card on this screen — and the gauge in the
// column beside it replaced that. The Progress tool draws its own.

function Write({
  banner,
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
  onRestore,
}: {
  /** The current book's card, over the active list. Null on the other three. */
  banner: ReactNode;
  visible: Book[];
  view: ShelfView;
  counts: Record<ShelfView, number>;
  sort: Sort;
  searching: boolean;
  onView: (v: ShelfView) => void;
  /** Empties the box in the header, which lives on the screen above this. */
  onClearSearch: () => void;
  onSort: (s: Sort) => void;
  onDetails: (b: Book) => void;
  onCover: (b: Book) => void;
  onTrash: (b: Book) => void;
  onDeleteForever: (b: Book) => void;
  /** Not `restoreBook` itself: the free plan may have no room for the book. */
  onRestore: (b: Book) => void;
  /** Opens the sheet holding every per-book tool. */
}) {
  const settled = useLibrarySettled();

  return (
    <div>
      {/* The book in hand, above the shelf it came off. It opened the dashboard
          until the owner moved it here — a card about one manuscript reads as an
          answer among a list of books, and as an interruption above three
          figures about the whole library. */}
      {banner && <div className="mb-6">{banner}</div>}

      <div className="flex flex-wrap items-center justify-between gap-4 md:justify-end">
        {/* One question, one control. The rail carries these four from `md` up,
            where it is on screen; below that there is no rail, so the segmented
            control is the only way to reach the archive and it stays. Two live
            copies of the same state on one screen is two things to keep in step
            and two answers when they drift. */}
        <div
          className="scroll-slim flex max-w-full gap-1 overflow-x-auto rounded-lg
                     border border-line bg-panel p-1 md:hidden"
        >
          {SHELF_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={`shrink-0 rounded-md px-3.5 py-1.5 text-sm font-medium ${
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

      {visible.length === 0 && !settled && !searching ? (
        /* The same wait the Overview makes, for the same reason: on a machine
           that has just signed in, an empty list means "still arriving" rather
           than "you have no books", and this screen used to announce the
           second. A search that found nothing is exempt — that answer is about
           the query and is already true of whatever is loaded. */
        <ul
          aria-hidden="true"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[0, 1, 2].map((card) => (
            <li
              key={card}
              className="h-36 animate-pulse rounded-xl border border-line bg-panel"
            />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <div className="mt-6">
          {searching ? (
            <EmptyState
              title="No book here matches that"
              primary={{ label: "Clear the search", onClick: onClearSearch }}
            >
              This searches titles. To look inside a book, open it and use the
              search tab — that one reads the prose.
            </EmptyState>
          ) : view === "favourite" ? (
            <EmptyState
              title="No favourites yet"
              primary={{
                label: "Back to your books",
                onClick: () => onView("active"),
              }}
            >
              Star a book from its ⋯ menu and it shows up here. Nothing moves —
              a favourite is still on the shelf with the rest.
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
        /* **Covers first, and as many across as the column allows.**

            This was a row card: a 64px thumbnail on the left with three lines
            of text beside it, three to a row. It read as a file listing of
            books rather than as a shelf of them, and it spent nothing on the
            one thing a writer recognises their own work by from across a room.
            The cover is the card now — full width, at the 2:3 of a 6×9 novel,
            which is the trim the whole app is built around — and the words sit
            under it, centred, the way every shelf of jackets from a bookshop
            table to a storefront grid arranges them.

            Narrow cards fit more across, so the grid runs to four and five
            where it used to stop at three. */
        <ul
          className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4
                     2xl:grid-cols-5"
        >
          {visible.map((book) => (
            <li
              key={book.id}
              /* `relative` anchors the floating heart, which has to sit over
                 the cover without being *inside* the link that wraps it.

                 **The card itself does not react to hover, only the book on
                 it.** `BookCover` already lifts and deepens its shadow on
                 `group-hover`, which is why this is a `group` — a second
                 shadow on the card underneath made two things move for one
                 pointer, and the jacket is the thing the writer is reaching
                 for. */
              className="group relative flex flex-col rounded-xl border
                         border-line bg-panel p-3"
            >
              {/* **One link over the cover and the words together**, rather
                  than a link on the title and a separate one on the jacket.
                  A shelf of covers promises that the cover opens the book, and
                  the alternative — a pseudo-element stretched over the card —
                  needs `after:content-['']`, which Tailwind v4 silently drops
                  here. Wrapping is what the markup wanted anyway: one tab stop
                  per book instead of two, and one focus ring around the part
                  that actually opens something. */}
              <Link
                href={`/book/${book.id}`}
                className="flex flex-1 flex-col rounded-lg outline-none
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {/* Not `editable`. The cover used to open "Edit title, author
                    and cover", which was right for a 64px thumbnail beside a
                    title — nothing else could have wanted that press. At full
                    card width it is the book's own face and the largest target
                    on the screen, so it opens the book, and editing stays one
                    press away in the ⋯ menu where it already lived. */}
                <CoverOf book={book} />

                <div className="pt-3 text-center">
                  <span className="block text-sm leading-snug font-bold text-balance text-fg">
                    {book.title}
                  </span>

                  {/* Small, letterspaced and quiet, which is the slot a shop
                      grid gives its genre line. Nothing goes under it where
                      that grid puts a star rating — see the house rule about
                      invented numbers. `span`, not `p`: this is inside an
                      anchor, and a paragraph there is invalid markup. */}
                  <span className="mt-1.5 block font-sans text-[0.6875rem] font-semibold tracking-[0.06em] text-muted uppercase">
                    {plural(bookChapterCount(book), "chapter")} ·{" "}
                    {plural(bookWordCount(book), "word")}
                  </span>
                  <span className="mt-0.5 block font-sans text-xs text-muted">
                    Opened {relativeTime(book.lastOpenedAt)}
                  </span>
                </div>
              </Link>

              {(view === "active" || view === "favourite") && (
                /* **Out of the menu and onto the jacket**, which is where a
                   shelf of covers puts it. Favouriting was three presses behind
                   ⋯ and invisible until you went looking, while the state it
                   toggles was already a fact about the card with nowhere to
                   show itself.

                   A sibling of the link rather than a child of it: a button
                   inside an anchor is invalid markup and swallows the press on
                   half the browsers that accept it. It is positioned against
                   the `li`, and `z-10` lifts it over the link it overlaps. */
                <button
                  type="button"
                  onClick={() => setFavourite(book.id, !book.favourite)}
                  aria-pressed={book.favourite}
                  aria-label={
                    book.favourite
                      ? `Remove ${book.title} from favourites`
                      : `Add ${book.title} to favourites`
                  }
                  /* **A set heart stays; an unset one waits to be asked for.**
                     An empty outline on every jacket is a control repeated as
                     many times as there are books, and it competes with the
                     covers for exactly the attention this layout was rebuilt
                     to give them. Once it is filled it stops being a control
                     and becomes a fact about the book, which is worth its
                     place — that is the difference between the two states.

                     Hidden with opacity rather than removed, so it keeps its
                     size in the layout, stays in the tab order, and appears on
                     `focus-visible` for anyone arriving by keyboard, who has
                     no hover to reveal it with. */
                  className={`absolute top-5 right-5 z-10 flex h-8 w-8 items-center
                             justify-center rounded-lg border border-line/60
                             bg-panel/85 shadow-sm outline-none transition
                             hover:bg-panel focus-visible:opacity-100
                             focus-visible:ring-2 focus-visible:ring-accent/60 ${
                               book.favourite
                                 ? "text-danger"
                                 : "opacity-0 text-muted group-hover:opacity-100"
                             }`}
                >
                  {book.favourite ? shelfIcons.heartFilled : shelfIcons.heart}
                </button>
              )}

              {/* The link above is `flex-1`, so this row sits on the floor of
                  every card and a two-line title never pushes one card's
                  buttons below its neighbour's. */}
              <div className="mt-3 flex items-center gap-2">
                  {view === "active" || view === "favourite" ? (
                    <>
                      {/* **Outlined, and now full width.** The argument against
                          a filled accent here only got stronger with more cards
                          on screen: twenty filled blue buttons is a grid of
                          primaries, and the accent goes back to meaning New
                          book. Width rather than colour is what gives this its
                          weight in a narrow card. */}
                      <Link
                        href={`/book/${book.id}`}
                        className="flex flex-1 items-center justify-center gap-1.5
                                   rounded-lg border border-line bg-surface px-3 py-1.5
                                   text-sm font-semibold text-fg transition-colors
                                   hover:bg-raised"
                      >
                        {shelfIcons.write}
                        Write
                      </Link>
                      <Menu
                        label={`More for ${book.title}`}
                        align="end"
                        width={244}
                        triggerClassName="flex shrink-0 items-center rounded-lg border
                                          border-line bg-surface px-2 py-1.5 text-fg
                                          transition-colors hover:bg-raised"
                        trigger={shelfIcons.more}
                      >
                        {(close) => (
                          <>
                            <MenuLink
                              href={`/book/${book.id}/consistency`}
                              icon={shelfIcons.search}
                              onNavigate={close}
                            >
                              Check for consistency
                            </MenuLink>
                            <MenuLink
                              href={`/book/${book.id}/export`}
                              icon={shelfIcons.prepare}
                              onNavigate={close}
                            >
                              Export and publish
                            </MenuLink>

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
                              icon={shelfIcons.write}
                              onClick={() => {
                                onCover(book);
                                close();
                              }}
                            >
                              Edit title, author and cover
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
                        onClick={() => onRestore(book)}
                        className="flex-1 rounded-lg border border-line bg-surface
                                   px-3 py-1.5 text-sm font-semibold text-fg
                                   transition-colors hover:bg-raised"
                      >
                        Restore
                      </button>
                      {view === "trashed" && (
                        /* An icon rather than "Delete for good" spelled out.
                           The words do not fit beside Restore at this width and
                           wrapped to a second line under it, where a permanent
                           delete sat looking like a footnote. */
                        <button
                          type="button"
                          onClick={() => onDeleteForever(book)}
                          aria-label={`Delete ${book.title} for good`}
                          title="Delete for good"
                          className="flex shrink-0 items-center rounded-lg px-2 py-1.5
                                     text-danger transition-colors hover:bg-raised"
                        >
                          {shelfIcons.trash}
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
function Prepare({
  books,
  onCover,
  focus,
}: {
  books: Book[];
  /** The three commonest problems are fixed in a dialog the shelf owns. */
  onCover: (b: Book) => void;
  /** A book to open on arrival, sent by Overview's banner. */
  focus?: { id: string; n: number } | null;
}) {
  /**
   * Read once per shelf change rather than per render. Cheap on its own —
   * `hasCover` tests for the key instead of fetching a 250KB data URL — but it
   * is a loop over every book and there is no reason to run it on a keystroke.
   */
  /* Covers live at their own key, so adding one leaves `books` untouched and
     this memo would keep its old answer — the "No cover" finding surviving the
     cover that fixed it. See `useCoverEpoch`. */
  const coverEpoch = useCoverEpoch();
  const rows = useMemo(
    () =>
      books.map((book) => ({
        book,
        issues: storeReadiness({
          book,
          ...(book.publishing ? { meta: book.publishing } : {}),
          hasCover: hasCover(book.id),
          // Measured from the writer's real artwork by the cover checker; null
          // until they have checked one, and the findings stay silent.
          coverFacts: getCoverFacts(book.id),
          // Chapters with prose in them. The count is denormalised into the
          // shelf, so this needs no chapter bodies.
          chapterCount: book.chapters.filter((c) => c.words > 0).length,
          // Not knowable without the manuscript; the export page does these.
          brokenImages: 0,
        }),
      })),
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
       `coverEpoch` is not read in the body and the rule is right about that.
       It is here because `hasCover` reads `localStorage`, which the rule
       cannot see: the epoch is the only value that changes when a cover is
       written, so removing it as "unnecessary" is precisely what left the
       "No cover" finding on screen after the cover arrived. */
    [books, coverEpoch],
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
          <EmptyState
            bare
            title="No book to check yet"
            primary={IMPORT}
            secondary={START}
          >
            Bring one in and this names what a shop would refuse before you find
            out from a rejection.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map(({ book, issues }) => (
              /* Keyed on the nonce when this is the book being asked
                 for, so a second press remounts the row and opens it again
                 even if the writer had closed it. Every other row keeps a
                 stable key and its own open/shut. */
              <PrepareRow
                key={focus?.id === book.id ? `${book.id}:${focus.n}` : book.id}
                book={book}
                issues={issues}
                onCover={onCover}
                startOpen={focus?.id === book.id}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * One book, with its worst problem said out loud — and the rest a press away.
 *
 * **The row opens; it does not navigate.** It used to be one big link to the
 * export screen, and a badge reading "2 worth doing" beside a chevron is a
 * promise to *show me those two* — while the export screen opens on "How do
 * you want it? Pick a format", a different question about a flow nobody asked
 * to start. The two things the row named were never on the far side of it.
 *
 * They were here all along: `storeReadiness()` has already returned them to
 * draw this row's summary, and the count in the badge is `issues.length`. So
 * the chevron now does what a chevron beside a count does everywhere else —
 * it expands the item and shows them, each with the control that fixes it,
 * through the same `Fix` map the dashboard's findings use.
 *
 * Export stays reachable and is now a *named* action rather than the accidental
 * destination of every click on the row. Going to a five-step export flow is a
 * decision, and it should take pressing something that says so.
 */
function PrepareRow({
  book,
  issues,
  onCover,
  startOpen,
}: {
  book: Book;
  issues: ReadinessIssue[];
  onCover: (b: Book) => void;
  /** Open on mount — this is the book Overview's banner asked for. */
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(startOpen));

  /*
   * Bring it into view when it was asked for by name.
   *
   * Prepare is a list, and the book somebody pressed for is rarely the first
   * row — arriving with it open below the fold is the same as arriving with it
   * shut. `nearest` rather than `center` so a row already on screen does not
   * jump for no reason, and `smooth` so the movement reads as the page
   * answering rather than as a reload.
   */
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!startOpen) return;
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [startOpen]);
  const blocking = issues.filter((i) => i.level === "blocking");
  const advisory = issues.filter((i) => i.level === "advisory");
  /* Only the ones with somewhere to go — a field with no destination would be a
     line of text in a list whose whole promise is that each row is actionable —
     and the cover file's several faults as one row, since all of their buttons
     open the same report. See `findingsFrom`. */
  const findings = findingsFrom(issues);

  return (
    <li
      ref={ref}
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={findings.length === 0}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors
                   hover:bg-raised disabled:hover:bg-transparent"
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

        {/* Points down when open, which is the whole of what a disclosure
            chevron has to say. It pointed right and went somewhere else. */}
        {findings.length > 0 && (
          <span
            aria-hidden="true"
            className={`shrink-0 text-muted transition-transform ${
              open ? "rotate-90" : ""
            }`}
          >
            {shelfIcons.chevronRight}
          </span>
        )}
      </button>

      {open && findings.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <ul className="flex flex-col gap-2">
            {findings.map((finding) => (
              <li
                key={finding.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border
                            px-3 py-2 ${
                              finding.level === "fix"
                                ? "border-stop-line bg-stop-bg"
                                : "border-note-line bg-note-bg"
                            }`}
              >
                {/* Severity across the whole row — see the note on the
                    Overview list, which this matches deliberately. Two screens
                    showing the same findings in two liveries would read as two
                    different kinds of problem. */}
                <AlertMark level={finding.level} />
                <span
                  className={`min-w-[10rem] flex-1 text-sm font-medium ${
                    finding.level === "fix" ? "text-stop-fg" : "text-note-fg"
                  }`}
                >
                  {finding.title}
                </span>
                <FixLink
                  book={book}
                  fix={finding.fix}
                  level={finding.level}
                  onCover={onCover}
                  from="prepare"
                />
              </li>
            ))}
          </ul>

          {/* Named, so going to the export flow is a decision rather than what
              happens when you press anything on this row. */}
          <Link
            href={withReturn(`/book/${book.id}/export`, "prepare")}
            className="mt-3 inline-block text-sm font-semibold text-accent"
          >
            Check and export this book →
          </Link>
        </div>
      )}
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
        {/* The "Working on" chip. Free to take the dialog — this cover was
            never wrapped in anything. */}
        <span className="w-10 shrink-0">
          <CoverOf book={book} editable />
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
  const reviewed = rows.reduce((n, r) => n + r.readers.reviewed, 0);
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

          {/* The note counted what was past its date and now counts what came
              back, which is the other half of the same sentence and the half
              this app can still answer. */}
          <Stat
            icon={shelfIcons.calendar}
            value={String(out)}
            label="advance copies out"
            note={
              reviewed > 0 ? `${reviewed} reviewed so far` : "none reviewed yet"
            }
          />
        </section>
      )}

      {anyMoney && <BookCurve books={books} ledger={ledger} />}

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-bold text-fg">Every book</h2>
        <p className="mt-1 mb-4 text-muted">
          What each one cost against what it earned, and who still has an
          advance copy. Amazon has no public API, so a sales report is a file
          you download and hand over — nothing is fetched and nothing is sent.
        </p>

        {books.length === 0 ? (
          <EmptyState
            bare
            title="Nothing to track yet"
            primary={IMPORT}
            secondary={START}
          >
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
 * The book-three curve: whether each book did better than the last.
 *
 * The folklore is everywhere in the research and nobody can check it — *no
 * traction until your third book* — and a writer two books in cannot tell
 * whether they are on it or whether it is a story people tell each other. That
 * decides whether they write a third, which makes it worth answering properly
 * or not at all.
 *
 * **Everything difficult about it is in `curve.ts`**, and the hard part is the
 * refusing: like-for-like windows, no publication date means no place on the
 * curve, a book out for a fortnight is left off, and a book with no sales rows
 * is a gap in the record rather than a zero. This component draws what
 * survives that and says what did not.
 *
 * **The folklore is quoted, never applied.** It is stated as a thing writers
 * report, next to the writer's own figures, and no sentence here tells them
 * which side of it they are on — that would be a prediction off two or three
 * points, which is exactly the kind of number this product refuses. "Each
 * earned more than the last" is a fact about four figures; "you are on the
 * curve" is a forecast, and we do not sell those.
 *
 * It renders only where there is money recorded at all — see the call site.
 * A writer three chapters into a first draft has not asked this question.
 */
function BookCurve({ books, ledger }: { books: Book[]; ledger: Entry[] }) {
  const curve = useMemo(() => curveOf(books, ledger), [books, ledger]);
  const entitled = useEntitled();

  // Part of Pro, with the money screens it reads from. Drawn as its own
  // section rather than hidden, because the row above it already shows the
  // library's totals — a gap where a named section was is harder to read than
  // a card saying what belongs there.
  if (!entitled) {
    return (
      <ProGate
        title="Book over book"
        what="Whether each book did better than the last, measured over the same stretch of each one's own life — so a book out for three years is not compared against one out for three months. It answers what writers repeat to each other about there being no traction until a third book, with your own figures rather than a forecast."
      >
        {null}
      </ProGate>
    );
  }

  const missing: Record<LeftOut, string> = {
    "no-date": "no publication date set",
    "too-new": "out too recently to compare",
    "no-sales": "no sales recorded",
  };

  if (!curve.ready) {
    return (
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-bold text-fg">Book over book</h2>
        <p className="mt-1 text-muted">
          Writers report little traction until a third book. Whether you are on
          that curve should be something you can look at rather than something
          you feel — but it takes two books measured the same way, and there
          {curve.placed === 1 ? " is one" : " are none"} here so far.
        </p>
        {curve.left.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {curve.left.map(({ title, why }) => (
              <li key={`${title}:${why}`} className="text-sm text-muted">
                <span className="text-fg">{title}</span> — {missing[why]}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          A book joins this once it has a publication date in its listing
          details, a sales report imported, and {MIN_WINDOW_DAYS} days behind
          it.
        </p>
      </section>
    );
  }

  const most = Math.max(...curve.books.map((b) => b.earned), 1);
  const months = Math.round(curve.windowDays / 30);

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-bold text-fg">Book over book</h2>
      <p className="mt-1 mb-4 text-muted">
        What each earned in its first{" "}
        {months >= 2 ? `${months} months` : `${curve.windowDays} days`} on sale
        — the same stretch of each book&rsquo;s own life, because a book that
        has been out for three years has earned more than one out for three
        months whatever else is true.
      </p>

      <ol className="flex flex-col gap-3">
        {curve.books.map((entry, i) => (
          <li key={entry.bookId} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-sm text-muted tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-fg">
                  {entry.title}
                </span>
                <span className="shrink-0 text-sm font-bold text-fg tabular-nums">
                  {entry.earned.toLocaleString()}
                </span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-raised">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.max((entry.earned / most) * 100, 1)}%`,
                  }}
                />
              </span>
              <span className="mt-1 block text-xs text-muted">
                from {entry.rows} {entry.rows === 1 ? "row" : "rows"}
                {entry.units > 0
                  ? `, ${entry.units.toLocaleString()} ${entry.units === 1 ? "copy" : "copies"}`
                  : ", no copy counts recorded"}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-sm text-fg">
        {curve.eachAboveTheLast
          ? `Each of these earned more than the one before it in the same ${months >= 2 ? `${months} months` : `${curve.windowDays} days`}.`
          : "These do not rise book over book."}{" "}
        <span className="text-muted">
          {curve.books.length < 3
            ? "Two books is a comparison rather than a curve; the third is the one the folklore is about."
            : "Writers commonly report little traction until a third book. This is your own record of it, not a forecast."}
        </span>
      </p>

      {curve.left.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Not on this:{" "}
          {curve.left
            .map(({ title, why }) => `${title} (${missing[why]})`)
            .join(", ")}
          .
        </p>
      )}
    </section>
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
          <CoverOf book={book} editable />
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-fg">
          {book.title}
        </span>
        {/* A red "N late" flag sat here and went with the chasing on
            2026-08-13. Nothing replaces it: the row's own Advance copies cell
            below already says how many are out and how many reviewed, and a
            second badge repeating one of those would be decoration. */}
      </div>

      <div className="grid grid-cols-2 border-t border-line">
        <Cell href={`/book/${book.id}/track`} label="Money" divider>
          {recorded ? (
            <>
              <span className={money.net >= 0 ? "text-ok-fg" : "text-fg"}>
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

// `plural` used to live here, privately. It moved to `src/lib/plural.ts` once
// it turned out that everywhere it could not reach was printing "1 words",
// "1 days written" and "1 copies".

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
  badge,
  children,
  collapsed = false,
}: {
  icon: ReactNode;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  /** A marker at the right of the row — "Soon" on anything not built yet. */
  badge?: ReactNode;
  children: ReactNode;
  collapsed?: boolean;
}) {
  const labelText = typeof children === "string" ? children : undefined;
  const className = `flex min-h-10 items-center rounded-lg transition-colors ${
    collapsed
      ? "justify-center p-2.5"
      : "gap-2.5 px-3 py-2 text-left text-sm font-medium"
  } ${
    active
      ? "bg-blue-500/15 font-semibold text-fg dark:bg-blue-500/25"
      : "text-fg/80 hover:bg-raised/70 hover:text-fg"
  }`;

  const body = collapsed ? (
    <span className="shrink-0">{icon}</span>
  ) : (
    <>
      <span className="shrink-0">{icon}</span>
      <span className={badge ? "mr-auto truncate" : "truncate"}>{children}</span>
      {badge}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        title={labelText}
        aria-label={labelText}
        className={className}
      >
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={labelText}
      aria-label={labelText}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {body}
    </button>
  );
}

// `SideShelfView` is gone. It was a second, quieter rail row for the shelf's
// lists, and the lists turned out to be rows like any other — `SideItem` with
// its `badge` slot carrying the count. One component for every row in the rail
// again.

// `SideGroup` is gone with the Extras group it labelled. The rail is one list
// and a footer again, so nothing needs naming.

/**
 * The way a cover anywhere on the dashboard reaches "Edit book details".
 *
 * A context rather than a prop threaded through five components, and the
 * reason is the shape of this file rather than a preference: `CoverOf` is
 * called from `Overview`, `Write`, `PrepareRow`, `Tools` and `TrackRow`, and
 * only the first three are handed `onCover` today. Threading it into the other
 * two — and through `Track`, which merely renders rows — would put a prop
 * about a *dialog* into components that have nothing else to do with one.
 *
 * The provider is `Bookshelf` itself, which owns `covering`, so every consumer
 * is inside it by construction. Null is the honest default for a `CoverOf`
 * rendered outside that tree: it draws a plain cover rather than a control
 * that would do nothing.
 */
const EditCoverContext = createContext<((book: Book) => void) | null>(null);

/**
 * A book's cover, and — where it is asked for — the control that edits it.
 *
 * **`editable` is opt-in, and it has to be.** Three of the five callers draw
 * this *inside* something that is already interactive: Overview and Write wrap
 * it in a `<Link>` to the book, and `PrepareRow` puts it inside a row-wide
 * `<button>`. A `<button>` nested in either is invalid HTML that browsers
 * silently unnest, which shows up as the outer control losing its own click
 * rather than as anything visible. So a caller that wants the dialog says so,
 * and takes responsibility for what it removed to make room.
 */
function CoverOf({ book, editable }: { book: Book; editable?: boolean }) {
  // `useCover` returns the artwork itself, or null. Whether to draw the title
  // over it is the *book's* setting, not the image's — see `bareCover`.
  const cover = useCover(book.id);
  const openEdit = useContext(EditCoverContext);

  const face = (
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

  if (!editable || !openEdit) return face;

  return (
    <button
      type="button"
      onClick={() => openEdit(book)}
      /* The cover is the picture of the book, so the label has to say what
         pressing it *does* — "The Shadow" alone would announce a link to the
         book, which is what this used to be. */
      aria-label={`Edit title, author and cover for ${book.title}`}
      className="block w-full cursor-pointer rounded-sm outline-none
                 transition-transform hover:-translate-y-0.5
                 focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      {face}
    </button>
  );
}
