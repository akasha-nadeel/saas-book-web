"use client";

import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  booksIn,
  deleteBook,
  dismissBanner,
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
  usePrefs,
  useShelf,
} from "@/lib/use-library";
import { pace, streak } from "@/lib/activity";
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
  blurb: string;
  icon: React.ReactNode;
  stage: boolean;
}[] = [
  {
    id: "overview",
    label: "Overview",
    live: true,
    blurb: "See your books and continue writing.",
    icon: shelfIcons.overview,
    stage: true,
  },
  {
    id: "write",
    label: "Write",
    live: true,
    blurb: "Create books, manage chapters and write safely.",
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
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get("area");
  const [picked, setPicked] = useState<Area | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);

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
  const [trashing, setTrashing] = useState<Book | null>(null);
  const [erasing, setErasing] = useState<Book | null>(null);

  const handleTrash = (book: Book) => setTrashing(book);
  const handleDeleteForever = (book: Book) => setErasing(book);

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
        <aside className="shelf-sidebar hidden min-h-0 w-56 shrink-0 flex-col border-r border-line md:flex">
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-2">
            <div className="flex min-h-full flex-col">
              <Link
                href="/"
                className="mb-6 px-2 text-2xl font-bold tracking-tight text-fg"
              >
                Open<span className="text-wordmark">Chapter</span>
              </Link>

              <nav className="flex flex-col gap-0.5">
                {AREAS.filter((a) => a.stage).map((a) => (
                  <Fragment key={a.id}>
                    <SideItem
                      icon={a.icon}
                      active={area === a.id}
                      onClick={() => goToArea(a.id)}
                    >
                      {a.label}
                    </SideItem>

                    {/* The four lists, under the area that shows them.
                        Indented and unpaired with the rail's own icons on
                        purpose: they are scopes of Write, not places beside
                        it, and a flat list of seven would have read as seven
                        equal destinations.

                        Always present, never conditional on being in Write.
                        A rail whose rows appear and disappear as you move
                        through it is a rail nobody learns the shape of, and
                        "Trash 26" is a destination a writer goes looking for
                        from wherever they happen to be. */}
                    {a.id === "write" && (
                      <div className="mt-0.5 mb-1 flex flex-col gap-0.5">
                        {SHELF_VIEWS.map((v) => (
                          <SideShelfView
                            key={v}
                            icon={VIEW_ICON[v]}
                            count={counts[v]}
                            active={area === "write" && view === v}
                            onClick={() => showShelf(v)}
                          >
                            {VIEW_LABEL[v]}
                          </SideShelfView>
                        ))}
                      </div>
                    )}
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
                        icon={a.icon}
                        active={area === a.id}
                        onClick={() => goToArea(a.id)}
                      >
                        {a.label}
                      </SideItem>
                    ))}
                  </nav>
                </>
              )}

              {/* Getting help, then giving it back. Help before Support because
                Support's own first line points at the guide, and Feedback after
                both because it is the other direction: nothing comes back, and
                a writer reaching for it is not stuck. */}
              <div className="mt-3 border-t border-line pt-3 flex flex-col gap-0.5">
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
              </div>
            </div>
          </div>

          {/* Outside the scroller: who you are remains reachable at every
            navigation scroll position, and everything that is a setting rather
            than a place stays anchored to the foot of the rail.

            This row opens the menu that holds the account, the plan and the
            theme. It sits at the very foot, where every tool built in the last
            five years puts it — it used to be a chip in the top-right corner,
            which is the other convention and the one this product was not
            otherwise following.

            One row rather than two. Theme had a row of its own here and has
            moved inside the menu, because it is a setting about the app and
            that menu is now where the app's settings are. */}
          <footer className="shrink-0 border-t border-line bg-panel px-3 pt-2 pb-3">
            <AccountMenu account={account} variant="bar" />
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
          className="fixed bottom-[calc(0.75rem+var(--oc-safe-bottom))] left-1/2 z-40 flex h-12 max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-fg/15 bg-fg px-4 text-sm font-semibold text-surface shadow-[0_12px_32px_rgb(0_0_0/0.24)] outline-none transition-[transform,background-color] hover:bg-fg/90 active:translate-y-px focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface md:hidden"
        >
          <span className="text-surface/80">{meta.icon}</span>
          <span className="min-w-0 max-w-40 truncate">{meta.label}</span>
          <span aria-hidden="true" className="ml-1 text-base leading-none text-surface/70">
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
            <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 md:flex md:flex-wrap">
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
                         focus-visible:ring-accent/50 sm:pr-12"
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
                                    sm:w-auto sm:py-2 sm:pr-2.5 sm:pl-3.5"
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
            {/* One block. The heading and its line used to be two siblings with
              `mb-8` and `-mt-6` cancelling each other out — a spacing bug
              waiting to be inherited by the next area added. */}
            <div className="mt-8 mb-7">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-fg">
                  {meta.label}
                </h1>
                {!meta.live && <Badge>Not built yet</Badge>}
              </div>
              <p className="mt-1.5 text-muted">{meta.blurb}</p>
            </div>

            {area === "overview" && (
              <Overview
                account={account}
                onSeeBooks={() => showShelf("active")}
                current={current}
                all={active}
                books={active.length}
                words={totals.words}
                chapters={totals.chapters}
                onDetails={setEditing}
                onCover={setCovering}
                onPrepare={showInPrepare}
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
                icon={item.icon}
                active={area === item.id}
                onClick={() => onArea(item.id)}
              >
                {item.label}
              </SideItem>
            ))}
          </nav>

          <div className="mt-4 border-t border-line pt-3 pb-3">
            <SideItem
              icon={shelfIcons.support}
              onClick={() => showDialog("support")}
            >
              Support
            </SideItem>
            <SideItem
              icon={shelfIcons.feedback}
              onClick={() => showDialog("feedback")}
            >
              Send feedback
            </SideItem>
            <SideItem icon={shelfIcons.pricing} href="/upgrade">
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

function Overview({
  account,
  current,
  all,
  books,
  words,
  chapters,
  onDetails,
  onCover,
  onSeeBooks,
  onPrepare,
}: {
  /** For the greeting, and only that. Null signed out or with no accounts. */
  account: Account | null;
  current: Book | null;
  /** Every active book, for the things that are only true across the shelf. */
  all: Book[];
  books: number;
  words: number;
  chapters: number;
  onDetails: (b: Book) => void;
  onCover: (b: Book) => void;
  /** Opens the shelf's own list — the three counts are counting it. */
  onSeeBooks: () => void;
  /**
   * Goes to Prepare with this book's row already open.
   *
   * One callback rather than "change area" plus "expand that row", because
   * from here they are one intention: *show me those findings*. Splitting them
   * would let a caller do half of it and land the writer on a list of books
   * with nothing opened, which is the version of this that reads as a dead
   * button.
   */
  onPrepare: (bookId: string) => void;
}) {
  void onPrepare;

  const activity = useActivity();
  // Only the *empty* half of this screen waits on it — see `useLibrarySettled`.
  // A book that is already readable is drawn at once.
  const settled = useLibrarySettled();

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

  /**
   * Which book this screen is about.
   *
   * The last one opened until the writer says otherwise, and *sticky* after
   * that: a diagnosis you cannot hold still is one you cannot work through,
   * and with seven books on the shelf the one most recently opened is often
   * not the one with the problem.
   */
  /**
   * Morning, afternoon or evening — and not until the browser can say.
   *
   * The server has no idea what o'clock it is where the writer is, so a clock
   * read during the server render is a guess that React then swaps out from
   * under them on hydration. `useHydrated` is the flag this file already keeps
   * for exactly that shape of question, so the greeting is neutral in the
   * server's markup and specific the moment the client owns the page.
   */
  const greeting = useGreeting();

  /**
   * The first name, and only if a provider gave us one.
   *
   * An email address is not a name — greeting somebody as
   * "kha.akashanadeel@gmail.com" is worse than greeting them as nobody — so
   * `account.name` is the only source, and the band simply drops the comma
   * when there is nothing to put after it.
   */
  const firstName = account?.name?.trim().split(/\s+/)[0] ?? null;

  const [picked, setPicked] = useState<string | null>(null);
  const book = useMemo(
    () => all.find((b) => b.id === picked) ?? current,
    [all, picked, current],
  );

  /**
   * The one line under the greeting, and it reports rather than cheers.
   *
   * A band like this usually carries a slogan. What a writer opening the app
   * wants from it is where they left off, so that is what it says — the book
   * and when it was last open, or, on an empty shelf, the plain fact of that.
   * Nothing here is computed to sound encouraging.
   */
  const standing = current
    ? `Last open: ${current.title}, ${relativeTime(current.lastOpenedAt)}.`
    : settled
      ? "Nothing on the shelf yet. Start one, or bring in a manuscript you already have."
      : "Fetching your shelf…";

  /**
   * What Prepare will actually show for this book.
   *
   * The banner counts *this* and not `checkup()`, because the button under it
   * says "See them in Prepare" — and a count that does not match the list it
   * promises is a broken promise the moment somebody presses it.
   *
   * The two differ for a good reason. `checkup` withholds advisory findings
   * until the book reaches a selling phase, so a writer on chapter three is
   * not scolded about an ISBN; `Prepare` runs `storeReadiness()` raw. That
   * gate is worth keeping — but it was making this card claim *"the listing
   * details are in order"* about a book Prepare listed two outstanding things
   * for. The gate may decide what to *raise*; it may not make the screen say
   * something untrue.
   *
   * So the all-clear is now earned rather than assumed: green means nothing is
   * outstanding at all, and anything withheld shows as a count without being
   * spelled out — which is the quiet version of the same fact, and the reason
   * the gate existed.
   */
  /**
   * The banner the writer has waved away, and exactly which one.
   *
   * A dismissal here is not "hide this box forever" — this is the first screen
   * a writer sees and the one place the app says a shop would refuse their
   * book, so a permanent hide would let a *new* blocking problem arrive
   * silently behind an X pressed weeks ago. The signature is the book and its
   * two counts, so waving away "1 to fix · 4 worth doing" hides exactly that,
   * and the moment the situation changes the banner returns with the new
   * figures.
   *
   * **Persisted now, where it used to live only in component state.** The
   * argument for memory was that coming back on a fresh visit is the safe
   * direction for a diagnosis to fail in. That is true of a *changed*
   * diagnosis and false of an unchanged one: pressing × and finding the same
   * red row on the next visit is not a safe failure, it is the app not
   * listening — and a banner that ignores its own dismiss control teaches a
   * writer to ignore the banner. The signature keeps the safety where it was
   * doing the work, so a new blocking problem still speaks up.
   *
   * `prefs.dismissed` rather than a field on the book, for the reason
   * `matterAsked` is there: it records something about the reader, not the
   * manuscript.
   */
  const waved = usePrefs().dismissed;

  /* Same staleness as the list below: the badge counts a missing cover, and a
     cover written after this ran leaves `book` unchanged. */
  const coverEpoch = useCoverEpoch();
  const counts = useMemo(() => {
    if (!book) return { fix: 0, note: 0 };
    const issues = storeReadiness({
      book,
      ...(book.publishing ? { meta: book.publishing } : {}),
      hasCover: hasCover(book.id),
      coverFacts: getCoverFacts(book.id),
      chapterCount: book.chapters.filter((c) => c.words > 0).length,
      // The two that need the manuscript are the export screen's job.
      brokenImages: 0,
    });
    return {
      fix: issues.filter((i) => i.level === "blocking").length,
      note: issues.filter((i) => i.level === "advisory").length,
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
       `coverEpoch` is not read in the body and the rule is right about that.
       It is here because `hasCover` reads `localStorage`, which the rule
       cannot see: the epoch is the only value that changes when a cover is
       written, so removing it as "unnecessary" is precisely what left the
       "No cover" finding on screen after the cover arrived. */
  }, [book, coverEpoch]);

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
      {/* ---- The welcome band --------------------------------------------

          A **tinted** band, not a filled one. The saturated version put the
          loudest thing on the screen above the quietest, and the accent is
          spent on actions here — so the ground is the accent at a tenth and
          the two buttons inside it keep the full strength. The writer's name
          takes the highlight, which is the one thing in the band that is
          theirs.

          The figure is drawn, on the same 24-grid as the rail's icons. The
          reference carries a stock illustration of somebody at a desk; the
          house rule is that figures are drawn in markup and true of the
          product, so this is a book, its pages and a stack beside it — the
          thing the app is actually about. It is decoration and marked
          `aria-hidden`, and it goes at `sm` where there is no room. */}
      <section
        className="relative overflow-hidden rounded-3xl bg-accent/10 px-6 py-8
                   sm:px-9 sm:py-10"
      >
        <div className="relative z-10 max-w-xl">
          <h2 className="text-pretty text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            {greeting}
            {firstName ? (
              <>
                {" "}
                <span className="rounded-lg bg-accent/20 px-2 py-0.5 text-accent">
                  {firstName}
                </span>
              </>
            ) : null}
          </h2>
          <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-muted">
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
              className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg"
            >
              {IMPORT.label}
            </Link>
          </div>
        </div>
        <DeskFigure />
      </section>

      {/* ---- The book, and the figures beside it --------------------------

          The book takes the wide column because it is what the screen is for:
          a diagnosis, with the controls that answer it. The four counts are a
          margin note and read as one — stacked in a single panel rather than
          scattered as four cards, which is what they were, and which gave a
          rounding error the same weight as the manuscript. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:items-start">
        <div className="flex flex-col gap-5">
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
              {book.targetWords ? (
                <div className="col-span-2 min-w-0">
                  <TargetBar
                    words={bookWordCount(book)}
                    target={book.targetWords}
                  />
                </div>
              ) : null}

              {/* ---- The diagnosis, as one line -------------------------

                  A summary and a way to the list, not the list.

                  Everything here still comes from `checkup`, which is pure and
                  tested and decides severity, order and where each thing is
                  put right. What changed is how much of it belongs on *this*
                  screen. Seven full-width banners, each with its own button,
                  turned the first thing a writer sees into a wall of things
                  wrong with their book — and pushed the book's own controls,
                  the phase dials and the next step below the fold. Overview is
                  meant to be the state of the book at a glance; it had become
                  a worklist.

                  So the counts stay and the work moves. Prepare is the screen
                  built for exactly this — one row per book, opened to show
                  every finding with its fix — and sending a writer there costs
                  one press and gains them the version that can actually be
                  worked through.

                  There is still no score. A percentage or a grade would be the
                  invented number this app refuses everywhere else, and on the
                  first screen a writer sees it would be the most damaging place
                  to print one. Two counts and a way to the detail say more and
                  claim less. */}
              {!waved.includes(`${book.id}:${counts.fix}:${counts.note}`) && (
                <div
                  className={`col-span-2 mt-4 flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl
                            border px-3.5 py-3 ${
                              counts.fix > 0
                                ? "border-stop-line bg-stop-bg"
                                : counts.note > 0
                                  ? "border-note-line bg-note-bg"
                                  : "border-ok-line bg-ok-bg"
                            }`}
                >
                  {counts.fix + counts.note > 0 ? (
                    <AlertMark level={counts.fix > 0 ? "fix" : "note"} />
                  ) : (
                    <span aria-hidden="true" className="shrink-0 text-ok-fg">
                      {shelfIcons.check}
                    </span>
                  )}

                  <p className="min-w-[12rem] flex-1 text-sm">
                    {counts.fix > 0 ? (
                      <>
                        <strong className="text-stop-fg">
                          {plural(counts.fix, "thing")}
                        </strong>{" "}
                        <span className="text-stop-fg/80">
                          would stop a shop taking this
                        </span>
                      </>
                    ) : counts.note > 0 ? (
                      /* True and incomplete on purpose: nothing is *blocking*,
                       and there is still work. Saying only the first half is
                       how this card came to claim a book was in order while
                       Prepare listed two things for it. */
                      <span className="text-note-fg">
                        <strong>Nothing would stop a shop</strong> taking it,
                        but there is more to do.
                      </span>
                    ) : (
                      /* The one verdict on this screen worth colouring, and it is
                       the *good* one. A clear book used to get the same neutral
                       sentence a blocked one got, so the best news the screen
                       can carry looked like no news. */
                      <span className="text-ok-fg">
                        <strong>Nothing here would stop a shop</strong> taking
                        it. The listing details are in order.
                      </span>
                    )}
                    {counts.note > 0 && (
                      <span
                        className={
                          counts.fix > 0 ? "text-stop-fg/80" : "text-note-fg"
                        }
                      >
                        {counts.fix > 0 ? " · " : " "}
                        {counts.note} worth doing
                      </span>
                    )}
                  </p>

                  {/* Waving it away, and only here.
                
                    The Prepare rows keep theirs: that screen *is* the list, and
                    a dismissable row on it would be a way to lose work rather
                    than a way to stop being told. This one is a summary on a
                    dashboard, and a writer who has read it should be able to
                    put it down. */}
                  <button
                    type="button"
                    onClick={() =>
                      dismissBanner(book.id, counts.fix, counts.note)
                    }
                    aria-label="Dismiss until this changes"
                    title="Dismiss until this changes"
                    className={`shrink-0 rounded-md p-1 transition-opacity hover:opacity-70 ${
                      counts.fix > 0
                        ? "text-stop-fg"
                        : counts.note > 0
                          ? "text-note-fg"
                          : "text-ok-fg"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      className="h-[15px] w-[15px]"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              )}

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
        </div>

        {/* The right column: what is true across the shelf, quietly.

            Both panels carry a hairline *and* a shadow, which is one thing in
            two themes rather than two decisions. In daylight the shadow is the
            lift and the line barely shows; at night a shadow on a near-black
            ground is invisible and the hairline is the whole of it. That is
            the elevation rule this app already follows — see docs/styling.md
            — and it is why neither is conditional. */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
            {/* A heading with its own way out, the pattern the reference uses
                for "View Report". It goes to Write, which is the list these
                three numbers are counting — a live destination, not an
                ornament, which is the only kind of control this house ships. */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold tracking-widest text-muted uppercase">
                Your shelf
              </h3>
              <button
                type="button"
                onClick={onSeeBooks}
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1
                           text-xs font-semibold text-fg transition-colors
                           hover:bg-raised focus-visible:ring-2
                           focus-visible:ring-accent/50 focus-visible:outline-none"
              >
                See all
              </button>
            </div>
            <dl className="mt-4 flex flex-col gap-4">
              <Figure
                icon={shelfIcons.overview}
                label={books === 1 ? "book" : "books"}
                value={books.toLocaleString()}
              />
              <Figure
                icon={shelfIcons.write}
                label={nounFor(words, "word")}
                value={words.toLocaleString()}
              />
              <Figure
                icon={shelfIcons.prepare}
                label={nounFor(chapters, "chapter")}
                value={chapters.toLocaleString()}
              />
            </dl>
          </div>

          {/* Movement, kept apart from the totals: they answer different
              questions, and the one that can be unknown is the one that says
              so. "—" rather than 0 — the log started when it shipped, so a
              shelf written before it has nothing in here and a zero would be
              a lie by arithmetic. */}
          <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
            <div className="flex items-center gap-3.5">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl
                           bg-accent/10 text-accent"
              >
                {shelfIcons.calendar}
              </span>
              <div className="min-w-0">
                <h3 className="text-xs font-medium text-muted">This week</h3>
                <p className="text-xl leading-tight font-extrabold tabular-nums text-fg">
                  {logged ? week.words.toLocaleString() : "—"}
                </p>
              </div>
            </div>
            <p className="mt-3.5 text-xs leading-relaxed text-muted">
              {logged
                ? week.daysWritten > 0
                  ? `${nounFor(week.words, "word")} across ${plural(
                      week.daysWritten,
                      "day",
                    )}${run > 0 ? ` · ${plural(run, "day")} running` : ""}`
                  : "nothing yet this week — that is allowed"
                : "The log starts the first time you write here, and counts net words a day — so a day of cutting counts too. Anything already on your shelf came before it."}
            </p>
          </div>
        </aside>
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
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl
                   bg-accent/10 text-accent"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted">{label}</dt>
        <dd className="text-xl leading-tight font-extrabold tabular-nums text-fg">
          {value}
        </dd>
      </div>
    </div>
  );
}

/**
 * The band's decoration: a book, its pages, and one more behind it.
 *
 * Drawn here rather than fetched, for the reason every other figure in this
 * product is drawn — a stock illustration of somebody at a desk is a picture
 * of nothing this app does, and it is one more asset to keep. Two flat tones
 * of the accent and a hairline, so it reads at any theme without a second
 * palette.
 *
 * Decoration and nothing else: `aria-hidden`, and gone below `lg` where the
 * words need the whole width.
 */
function DeskFigure() {
  return (
    <svg
      viewBox="0 0 240 160"
      aria-hidden="true"
      className="pointer-events-none absolute right-6 bottom-0 hidden h-[88%] w-auto lg:block"
    >
      {/* The page block behind, set back and paler. */}
      <rect
        x="34"
        y="34"
        width="150"
        height="96"
        rx="6"
        className="fill-accent/10"
      />
      {/* The open book: two leaves meeting at the spine. */}
      <path
        d="M32 118V50c22-9 44-9 66 0v68c-22-9-44-9-66 0Z"
        className="fill-surface stroke-accent/35"
        strokeWidth="2.5"
      />
      <path
        d="M164 118V50c-22-9-44-9-66 0v68c22-9 44-9 66 0Z"
        className="fill-surface stroke-accent/35"
        strokeWidth="2.5"
      />
      <path d="M98 50v68" className="stroke-accent/45" strokeWidth="2.5" />
      {/* Lines of type, shorter as they fall — a paragraph, not a barcode. */}
      {[66, 78, 90].map((y, i) => (
        <g key={y} className="stroke-accent/25" strokeWidth="3.5" strokeLinecap="round">
          <path d={`M46 ${y}h${44 - i * 8}`} />
          <path d={`M110 ${y}h${44 - i * 8}`} />
        </g>
      ))}
      {/* A closed one, stacked at the edge, so the shelf is implied. */}
      <rect x="176" y="86" width="44" height="12" rx="3" className="fill-accent/30" />
      <rect x="182" y="102" width="44" height="12" rx="3" className="fill-accent/20" />
      <rect x="176" y="118" width="44" height="12" rx="3" className="fill-accent/30" />
    </svg>
  );
}

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

/**
 * Words against the goal the writer set.
 *
 * Capped at 100% so a book that overshoots does not draw a bar out of its own
 * box, and it says the raw pair as well as the percentage — a writer past their
 * target wants to see by how much, not a full bar that stops telling them
 * anything.
 */
function TargetBar({ words, target }: { words: number; target: number }) {
  /* **Rounded down, and the verdict read off the words rather than the
     percentage.** This was `Math.round`, which is wrong at both ends of the
     bar. At the bottom it turned every early session into "0% of target" — 215
     words into a 110,000-word novel is 0.195%, and a writer who has just
     written a page being told they are at nought is the app failing to count
     what it asked them to do. At the top it was worse: 99.6% rounds to 100, so
     a book *short* of its target printed "100% of target" in the green that is
     kept for having got there. A number that rounds up into a claim is the one
     kind this screen must not print.

     So the figure only ever understates, and `met` asks the question directly
     — the words against the target, not the percentage they were flattened
     into. Guarded against a target of nought, which would divide to Infinity. */
  const exact = target > 0 ? (words / target) * 100 : 0;
  const share = Math.max(0, Math.min(100, Math.floor(exact)));
  const met = target > 0 && words >= target;

  /* Under one per cent is said in words. Rounding down is honest and "0%" is
     not: it reads as *nothing counted*, which is a different fact from *a
     little counted*, and the writer it is shown to has just written the
     little. */
  const label = words > 0 && share === 0 ? "under 1%" : `${share}%`;

  // The bar is the accent while it is a *measure* and turns green once the
  // target is met, because at that point it stops measuring and becomes a
  // verdict — which is the one thing green is kept for here. Reaching a target
  // you set yourself is the rarest good news on this screen and it should not
  // look like 94%.
  return (
    <div className="mt-4 w-full max-w-none sm:mt-3.5 sm:max-w-sm">
      <div className="flex items-baseline justify-between text-xs">
        <span className={`font-semibold ${met ? "text-ok-fg" : "text-fg"}`}>
          {label} of target
        </span>
        <span className="text-muted">
          {words.toLocaleString()} of {target.toLocaleString()}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Word target progress"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(words, target)}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"
      >
        <div
          className={`h-full rounded-full ${met ? "bg-ok-fg" : "bg-accent"}`}
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
}: {
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
  /** Opens the sheet holding every per-book tool. */
}) {
  const settled = useLibrarySettled();

  return (
    <div>
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
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((book) => (
            <li
              key={book.id}
              className="rounded-xl border border-line bg-panel p-4"
            >
              <div className="flex gap-4">
                {/* Edits rather than opens, as on the Overview card. The
                    title beside it is still a link to the book, and the two
                    buttons under the card are Write and Read. */}
                <span className="w-[64px] shrink-0">
                  <CoverOf book={book} editable />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/book/${book.id}`}
                    className="block truncate font-bold text-fg"
                  >
                    {book.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {plural(bookChapterCount(book), "chapter")} ·{" "}
                    {plural(bookWordCount(book), "word")}
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
                {view === "active" || view === "favourite" ? (
                  <>
                    {/* **Outlined, like Read beside it**, at the owner's
                        request. It was the filled accent — the card's one
                        primary — and the argument for that was that writing is
                        what a writer came for. Against a wall of cards the
                        cost showed: twelve books put twelve filled blue
                        buttons on one screen, which is a grid of primaries,
                        and a colour that means "the way forward" everywhere
                        else stops meaning anything when it is the wallpaper.
                        Matched to Read, the pair reads as two ways into the
                        same book and the accent goes back to being spent on
                        New book, which is the one action on this screen that
                        is not per-card. */}
                    <Link
                      href={`/book/${book.id}`}
                      className="flex items-center gap-1.5 rounded-lg border border-line
                                 bg-surface px-3.5 py-1.5 text-sm font-semibold text-fg"
                    >
                      {shelfIcons.write}
                      Write
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

                          <MenuSeparator />
                          <MenuButton
                            icon={
                              book.favourite
                                ? shelfIcons.heartFilled
                                : shelfIcons.heart
                            }
                            onClick={() => {
                              setFavourite(book.id, !book.favourite);
                              close();
                            }}
                          >
                            {book.favourite
                              ? "Remove from favourites"
                              : "Add to favourites"}
                          </MenuButton>
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
}: {
  icon: ReactNode;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  /** A marker at the right of the row — "Soon" on anything not built yet. */
  badge?: ReactNode;
  children: ReactNode;
}) {
  const className = `flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm
     font-medium transition-colors ${
       active
         ? "bg-accent/10 text-accent"
         : "text-muted hover:bg-raised hover:text-fg"
     }`;

  // `mr-auto` on the label rather than `ml-auto` on the badge, so a row without
  // one keeps the icon and its word tight together exactly as before.
  const body = (
    <>
      {icon}
      <span className={badge ? "mr-auto" : undefined}>{children}</span>
      {badge}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
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
      {body}
    </button>
  );
}

/**
 * One of the shelf's four lists, in the rail under Write.
 *
 * A quieter row than `SideItem` by design — smaller, indented, and its count
 * set in the muted colour — because these are scopes of the area above rather
 * than areas themselves, and a rail where everything shouts has no hierarchy
 * at all. The indent lines the label up with the icons above it, so the four
 * read as a list hanging off Write rather than four more top-level rows.
 *
 * **The count is always shown, zero included.** "Archived 0" is an answer;
 * hiding the row until something is archived would mean the rail changes shape
 * as a writer works, and the one time they go looking for the archive is the
 * time it would not be there.
 */
function SideShelfView({
  icon,
  count,
  active,
  onClick,
  children,
}: {
  icon: ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-9 items-center gap-2.5 rounded-lg py-1.5 pr-2.5 pl-[1.375rem]
         text-left text-[0.8125rem] transition-colors ${
           active
             ? "bg-accent/10 font-medium text-accent"
             : "text-muted hover:bg-raised hover:text-fg"
         }`}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="mr-auto truncate">{children}</span>
      {/* Tabular figures so 0, 25 and 26 sit on one right edge rather than
          shuffling as the shelf changes. */}
      <span
        className={`text-xs tabular-nums ${active ? "text-accent/80" : "text-muted/70"}`}
      >
        {count}
      </span>
    </button>
  );
}

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
