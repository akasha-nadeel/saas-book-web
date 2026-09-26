"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { Spinner } from "@/components/ui/spinner";
import { Picker } from "@/components/ui/picker";
import { BookCover } from "@/components/ui/book-cover";
import type { CompTitle } from "@/lib/comps/comps";
import {
  priceFacts,
  priceQuery,
  shelfForGenre,
  MIN_PRICES,
  PRICE_SHELVES,
  type PriceLook,
  type PriceShelf,
  type PricedBook,
} from "@/lib/comps/price-check";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { findBook, setPref } from "@/lib/library-store";
import { useHydrated, usePrefs, useShelf } from "@/lib/use-library";
import { ViewMenu } from "@/components/ui/view-menu";
import { isGrid, resultsGridClass, type ShelfLayout } from "@/lib/shelf-layout";
import { remember, recall } from "@/lib/comps/search-memory";
import { toolShell, type ToolPageProps, toolMeasure } from "@/lib/tool-page";

/**
 * What comparable ebooks are charging.
 *
 * **The screen reports and does not advise.** There is no recommended price on
 * it, and there must never be one: what a book should cost depends on the
 * writer's royalty rate, their series, their launch plan and what they are
 * trying to do, none of which a catalogue search knows. What it can do
 * honestly is show the real figures and let the writer read them.
 *
 * **Three things have to be said out loud every time, and they are on the page
 * rather than in this comment.** The prices are Google Play's, in the US
 * store; they are ebook prices, because neither catalogue carries a paperback
 * price; and the count of books that carried a price sits beside every figure
 * drawn from them, because "the median is $4.99" from six books and from
 * sixteen are different statements.
 *
 * **An empty result is never rendered as a cheap shelf.** A search that could
 * not reach Google, or that reached it and found books nobody sells, has found
 * no prices — which is a different thing from having found low ones, and the
 * wording keeps them apart. This is the title check's rule pointed at a
 * different field.
 */

type State = "idle" | "loading" | "done" | "error";

const money = (n: number) =>
  n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;

/**
 * The dropdown value that means "I will type my own genre".
 *
 * A sentinel rather than an empty string, because empty already means *not
 * chosen yet* and the two need different sentences under the control.
 */
const OWN_GENRE = "__own";

/** This tool's slots in the tab's memory. See `search-memory.ts`. */
const MEMORY = "price-check";
/**
 * The browsing wall is kept apart from the answer, on purpose.
 *
 * It arrives on its own schedule, seconds after mount, and a writer may have
 * typed into the form while it was in flight. Folding it into the one snapshot
 * would mean that late write carrying mount-time form values back over
 * whatever they had since typed. Two keys, two writers, no merge.
 */
const MEMORY_BROWSE = "price-check:browse";

/**
 * Everything worth having back when a writer leaves the area and returns.
 *
 * The form as well as the answer: coming back to the figure but not to the
 * genre that produced it would leave the screen unable to explain itself.
 */
interface Kept {
  shelfLabel: string;
  ownGenre: string;
  setting: string;
  event: string;
  look: PriceLook | null;
  searched: string | null;
  sources: { google: boolean; openLibrary: boolean } | null;
  keyRefused: boolean;
}

/** The wall shown before anything has been searched. */
interface PricedShelf {
  label: string;
  books: PriceLook["prices"];
}

/**
 * A shelf to browse while the form is empty.
 *
 * **Chosen in an effect rather than during render**, which is the note
 * `randomShelf` carries on the title check: a `Math.random()` read while
 * rendering hands the server one shelf and the browser another, and React
 * reports a hydration mismatch.
 */
function randomShelf(): PriceShelf {
  const i = Math.floor(Math.random() * PRICE_SHELVES.length);
  return PRICE_SHELVES[i] ?? PRICE_SHELVES[0];
}

export function PriceCheckPage({
  bookId,
  embedded,
  heading,
}: Omit<ToolPageProps, "bookId"> & { bookId?: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = bookId ? findBook(shelf, bookId) : null;

  /**
   * The form, as three answers rather than one box.
   *
   * **`shelfLabel` starts on the book's own genre** through `shelfForGenre`,
   * and on nothing when the tool is opened from the dashboard with no book.
   * A lazy initialiser is right here rather than an effect: the shelf is read
   * once at mount and the writer owns it afterwards, so an effect syncing it
   * would overwrite their choice every time the store ticked.
   */
  /**
   * What this tool was showing when it was last unmounted, if anything.
   *
   * Read once, into the lazy initialisers below. The dashboard throws the
   * whole component away on an area switch, so without this a writer who
   * glanced at their shelf came back to an empty form — see
   * `search-memory.ts`.
   */
  /* A lazy `useState` rather than a ref: reading `ref.current` during render
     is what `react-hooks` rightly refuses, and a lazy initialiser is the tool
     for a value read exactly once at mount. */
  const [kept] = useState(() => recall<Kept>(MEMORY));

  const [shelfLabel, setShelfLabel] = useState<string>(
    () => kept?.shelfLabel ?? shelfForGenre(book?.genre)?.label ?? "",
  );
  const [ownGenre, setOwnGenre] = useState(() => kept?.ownGenre ?? "");
  const [setting, setSetting] = useState(() => kept?.setting ?? "");
  const [event, setEvent] = useState(() => kept?.event ?? "");
  /** Whether the writer has asked for the form back after an answer. */
  const [editing, setEditing] = useState(false);

  const [look, setLook] = useState<PriceLook | null>(() => kept?.look ?? null);
  const [searched, setSearched] = useState<string | null>(
    () => kept?.searched ?? null,
  );
  /**
   * Which catalogues answered.
   *
   * Load-bearing here for the same reason it is on the title check: a search
   * that never ran returns nothing, and nothing drawn as "no prices on this
   * shelf" is a confident answer from a request that failed. Google is the
   * half that matters — it is the only one that carries prices at all — so its
   * failure has its own sentence.
   */
  const [sources, setSources] = useState<{
    google: boolean;
    openLibrary: boolean;
  } | null>(() => kept?.sources ?? null);
  const [keyRefused, setKeyRefused] = useState(() => kept?.keyRefused ?? false);
  const [state, setState] = useState<State>(() =>
    kept?.look ? "done" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  /** The wall shown before anything is searched. Restored, or fetched once. */
  const [keptBrowse] = useState(() => recall<PricedShelf>(MEMORY_BROWSE));
  const [browse, setBrowse] = useState<PricedShelf | null>(keptBrowse);
  const [browseLoading, setBrowseLoading] = useState(() => !keptBrowse);

  const layout = usePrefs().researchLayout;

  /**
   * The browsing wall, fetched once per tab.
   *
   * **It is not a check and must not read as one.** No median, no spread, no
   * figure of any kind — a verdict on a question nobody asked is the loudest
   * thing that can be put on a screen, which is why the title check does not
   * arrive having already checked either. Just books and what they cost.
   *
   * **It spends nothing.** Only a press spends one of the day's three; the
   * same rule the title check's browsing shelf follows.
   *
   * The ref guards a second fetch within one mount; `kept.browse` guards it
   * across mounts, which is the expensive half — this is a five-page sweep.
   */
  const askedBrowse = useRef(false);
  useEffect(() => {
    if (askedBrowse.current || keptBrowse) return;
    askedBrowse.current = true;

    const shelf = randomShelf();
    void fetch(
      `/api/comps?sweep=1&only=google&q=${encodeURIComponent(shelf.words)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const books = (data.books ?? []) as CompTitle[];
        /* Through `priceFacts` for the gathering alone — the summary it also
           computes is deliberately not read here. */
        const priced = priceFacts(books).prices.slice(0, 60);
        if (priced.length === 0) return;
        const wall = { label: shelf.label, books: priced };
        setBrowse(wall);
        remember<PricedShelf>(MEMORY_BROWSE, wall);
      })
      .catch(() => {
        // Nothing to say: the form is there and still works.
      })
      .finally(() => setBrowseLoading(false));
  }, [keptBrowse]);

  const gate = useLimitGate({ action: "priceCheck" });
  const checks = gate.allowance;

  /** The shelf behind the dropdown, or null while it is unset or free text. */
  const chosen =
    PRICE_SHELVES.find((option) => option.label === shelfLabel) ?? null;
  /* Derived on every render rather than kept in state, so the line under the
     form and the string `check` sends cannot drift apart. */
  const query = priceQuery({
    shelf: chosen,
    genre: shelfLabel === OWN_GENRE ? ownGenre : "",
    setting,
    event,
  });

  async function check(query: string) {
    const asked = query.trim();
    if (asked.length < 2) return;

    setState("loading");
    setError(null);

    try {
      /* **Swept, and Google alone.** Both halves of that were measured and the
         first reverses what this comment used to say. One page lets whichever
         academic edition Google ranked first set the median: `small town
         contemporary romance` answered $9.99 off five prices and $5.99 off
         twelve, and searches too thin to summarise fell from four in ten to
         one in ten at five pages. The medians that moved were all small
         samples; the ones already drawn from seven or more did not move. The
         table is on `SWEEP_PAGES` in the route.

         `only=google` because Open Library carries no prices for any book, so
         swept it is five hundred records fetched and discarded — and its
         records were also padding the denominator this screen turns on. */
      const response = await fetch(
        `/api/comps?sweep=1&only=google&q=${encodeURIComponent(asked)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "That search did not work.");
        setState("error");
        return;
      }

      const books = (data.books ?? []) as CompTitle[];
      const found = priceFacts(books);
      const answered =
        data.sources && typeof data.sources === "object" ? data.sources : null;
      const refused = data?.why?.google === "key";

      setLook(found);
      setSources(answered);
      setKeyRefused(refused);
      setSearched(asked);
      // The press that answers is the press that steps the form aside.
      setEditing(false);
      setState("done");

      /* **Kept here, where the facts are made**, rather than mirrored out of
         state by an effect — one copy, written once, at the moment there is
         something worth keeping. The form goes in with the answer: coming
         back to a figure without the genre that produced it would leave the
         screen unable to explain itself. */
      remember<Kept>(MEMORY, {
        shelfLabel,
        ownGenre,
        setting,
        event,
        look: found,
        searched: asked,
        sources: answered,
        keyRefused: refused,
      });
    } catch {
      setError("Could not reach the search. Check your connection.");
      setState("error");
    }
  }

  if (!hydrated) {
    return embedded ? <div className={toolShell(embedded)} /> : <LoadingScreen />;
  }

  const answered = state === "done" && look !== null && searched !== null;
  const stale = answered && query !== searched;
  /** Google is the only source that carries prices, so it is the one that counts. */
  const searchRan = sources?.google === true;
  /**
   * The form steps aside once there is an answer.
   *
   * **The same rule the title check applies to its heading** — the result
   * names itself, so the controls that produced it stop earning the space. The
   * way back is the `Change` press, which is the whole of what keeps this from
   * making the tool single-use until a reload.
   *
   * Reopening deliberately leaves the result standing: a writer adjusting a
   * box is comparing it against what the last search said.
   */
  const showForm = !answered || editing;

  return (
    <div className={toolShell(embedded)}>
      {!embedded && book && (
        <ToolHeader
          book={book}
          tool="Price check"
          title="What do books like yours charge?"
          width="7xl"
        >
          The real prices of the ebooks a reader would see beside yours, every
          one of them listed. We never tell you what to charge &mdash; that
          depends on things a catalogue cannot know.
        </ToolHeader>
      )}

      <div
        className={`@container ${toolMeasure(embedded)} pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6`}
      >
        {/* The header is suppressed in the dashboard and the roadmap's panel,
            and it is the only place the premise is stated. Same repetition the
            title check makes, for the same reason. */}
        {embedded && (
          <p className="-mt-2 mb-2 max-w-2xl text-sm text-muted">
            The real prices of the ebooks a reader would see beside yours,
            every one of them listed. We never tell you what to charge &mdash;
            that depends on things a catalogue cannot know.
          </p>
        )}

        <section
          className={`rounded-2xl border border-line bg-panel p-5 @2xl:p-6 ${
            heading ? "" : "mt-6"
          }`}
        >
          {heading && (
            <div className="mb-5 border-b border-line pb-5">{heading}</div>
          )}

          {/* **Says what the writer gets, not what the form wants.** This read
              "Describe the book, the way a reader would" — an instruction
              about filling in a form, on a screen whose whole job is to answer
              a question. The size matches the title check's own section
              heading (`text-2xl font-bold tracking-tight`), because the two
              tools sit next to each other in the rail and a writer moving
              between them should not meet two different kinds of screen. */}
          {showForm && (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-fg">
                See what books like yours are selling for
              </h2>
              <p className="mt-1 mb-4 max-w-prose text-sm text-muted">
                Pick your genre and we will show you the real prices of the
                ebooks a reader would see beside yours. The two boxes are
                optional.
              </p>
            </>
          )}

          {/* **The collapsed form, and the way back to it.** Naming
              `searched` rather than `query`: the two part company the moment
              the form reopens and something is typed, and this line sits above
              the figure that `searched` produced. */}
          {!showForm && searched && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Showing prices for{" "}
                <span className="font-semibold text-fg">{searched}</span>
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                /* `text-accent-ink`, never a literal white: the fill is a
                   bright periwinkle at night and the brand indigo by day, so
                   the ink on it has to flip with it. See `docs/styling.md`. */
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold
                           text-accent-ink"
              >
                Change
              </button>
            </div>
          )}

          {/* The idiom is `paperback-page.tsx`'s: a label, its control, and a
              hint under it, in a grid that drops to one column on a phone. */}
          {showForm && (
          <form
            className="grid gap-4 @2xl:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              // Refused rather than disabled — the fourth press is what puts
              // the banner and the dialog on screen.
              if (!gate.spend()) return;
              void check(query);
            }}
          >
            {/* **`Picker`, not a native `<select>`, and the reason is a bug
                this screen actually had.** A focused native select changes its
                value on a mouse wheel in Chrome — so scrolling past this card
                on the dashboard silently re-picked the writer's genre, and the
                form then searched a shelf nobody chose. `ui/picker.tsx` is a
                menu of `menuitemradio` rows and does not do that; its own doc
                argues the same case on appearance grounds. It is a button, so
                it cannot sit inside a `<label>` — the label is a `<span>` and
                `Picker` carries its own accessible name. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-fg">
                Genre or shelf
              </span>
              <Picker
                label="Genre or shelf"
                value={shelfLabel}
                width={240}
                onChange={setShelfLabel}
                triggerClassName="w-full justify-between border border-line bg-surface px-3 py-2"
                options={[
                  { value: "", label: "Choose one" },
                  ...PRICE_SHELVES.map((option) => ({
                    value: option.label,
                    label: option.label,
                  })),
                  /* The escape hatch. Twelve measured shelves are not every
                     shelf, and a writer outside them must not be stuck. */
                  { value: OWN_GENRE, label: "Something else…" },
                ]}
              />
              {shelfLabel === OWN_GENRE ? (
                <input
                  value={ownGenre}
                  onChange={(e) => setOwnGenre(e.target.value)}
                  placeholder="your genre, in a reader's words"
                  aria-label="Your own genre"
                  className="mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-fg
                             outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                />
              ) : (
                <span className="text-xs text-muted">
                  {chosen
                    ? "Enough on its own — the boxes are optional."
                    : "The one field that matters."}
                </span>
              )}
            </div>

            {/* `aria-label` on the inputs as well as the visible span: the span
                names the field for a sighted reader, and without the attribute
                a screen reader falls back to the placeholder, which here is an
                example rather than a name. */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-fg">
                Where it happens
              </span>
              <input
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                placeholder={chosen?.setting ?? "a place"}
                aria-label="Where it happens"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-fg
                           outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              />
              <span className="text-xs text-muted">Optional.</span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-fg">What happens</span>
              <input
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                placeholder={chosen?.event ?? "the thing that starts it"}
                aria-label="What happens"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-fg
                           outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              />
              <span className="text-xs text-muted">Optional.</span>
            </label>

            <div className="@2xl:col-span-3 flex flex-wrap items-center justify-between gap-3">
              {/* **The whole honesty of the form is this line.** Three shelves
                  search for more words than their own name, so showing the
                  name alone would mean searching words the writer never saw.
                  What is printed here is exactly what `check` sends. */}
              <p className="text-sm text-muted">
                {query ? (
                  <>
                    Searching for{" "}
                    <span className="font-semibold text-fg">{query}</span>
                  </>
                ) : (
                  "Choose a genre to search."
                )}
              </p>
              <button
                type="submit"
                // Never disabled by the limit: the refused press is the only
                // moment there is anything to say about it.
                disabled={state === "loading" || query.length < 2}
                className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5
                           font-semibold text-accent-ink disabled:opacity-50"
              >
                {state === "loading" && <Spinner className="h-4 w-4" />}
                {state === "loading" ? "Looking…" : "Check prices"}
              </button>
            </div>
          </form>
          )}

          {/* Only reachable with the form open — collapsed, the form and the
              answer cannot disagree. */}
          {showForm && stale && (
            <p className="mt-3 text-sm text-muted">
              Showing prices for &ldquo;{searched}&rdquo;. Press Check prices
              for what the form says now.
            </p>
          )}

          {/* The badge goes with the control it meters. The banner does not:
              it is a refusal notice, and one that hid itself because a result
              was on screen would be a press that silently did nothing. */}
          {showForm && <LeftPill allowance={checks} className="mt-3" />}
          <LimitBanner
            allowance={checks}
            refused={gate.refused}
            className="mt-4"
          />

          {state === "loading" && (
            /* A shaped skeleton rather than a spinner alone: the blank page was
               the bug the title check's loading state was written against. */
            <div className="mt-6 animate-pulse" aria-busy="true">
              <div className="h-5 w-2/5 rounded bg-raised" />
              <div className="mt-3 h-24 rounded bg-raised" />
              <div className="mt-4 h-4 w-40 rounded bg-raised" />
            </div>
          )}

          {error && (
            <p className="mt-6 rounded-lg border border-line p-4 text-sm text-muted">
              {error}
            </p>
          )}

          {answered && !searchRan && (
            <p className="mt-6 rounded-lg border border-line p-4 text-sm text-muted">
              Google Books did not answer just now, and it is the only
              catalogue that carries prices &mdash; so this is not a result.
              Press Check prices again in a moment.
            </p>
          )}

          {answered && searchRan && look && <Result look={look} />}

          {keyRefused && answered && (
            <p className="mt-4 text-sm text-muted">
              Google Books refused the API key, so no prices came back. That is
              a fault at our end rather than an empty shelf.
            </p>
          )}
        </section>

        {answered && searchRan && look && look.prices.length > 0 && (
          <PriceList
            look={look}
            layout={layout}
            onLayout={(next) => setPref("researchLayout", next)}
          />
        )}

        {/* The wall, only while nothing has been answered. It is replaced by
            the result rather than sitting under it — two walls of prices, one
            of them about a shelf nobody asked for, is how a browsing aid turns
            into a second answer. */}
        {!answered && !browse && browseLoading && (
          /* The wall is a five-page sweep, so its wait is real. The title
             check learned this the same way: the space under the form went
             blank until a hundred covers arrived at once, which reads as a
             screen that has finished and has nothing on it. */
          <div
            aria-busy="true"
            className="mt-5 h-40 animate-pulse rounded-2xl border border-line bg-panel"
          />
        )}

        {!answered && browse && (
          <BrowseWall
            shelf={browse}
            layout={layout}
            onLayout={(next) => setPref("researchLayout", next)}
          />
        )}
      </div>

      {gate.dialogOpen && (
        <LimitDialog action="priceCheck" onClose={gate.closeDialog} />
      )}
    </div>
  );
}

/**
 * Why a search came back with few prices, and what to do instead.
 *
 * **It names the cause rather than saying "try different words".** The cause
 * is known and measured: Google's corpus is mostly books it has *scanned*,
 * which carry no price, plus the smaller set it *sells*, which do. A title or
 * a common phrase lands in the first — `i love you` found three priced books
 * in a hundred records — while a genre and a setting lands in the second.
 * Telling a writer to try different words without saying which way is asking
 * them to guess at our vocabulary.
 */
function WhyThin() {
  return (
    <>
      Some shelves simply have few books on sale, and a broad one matches
      everything Google ever scanned. Try a narrower shelf, or clear the two
      boxes &mdash; a genre on its own often finds more than a genre with
      words added to it.
    </>
  );
}

/**
 * The figures, or an honest account of why there are none.
 *
 * Three outcomes and each is worded to be unmistakable from the others:
 * nothing carried a price, too few did to summarise, and enough did.
 */
function Result({ look }: { look: PriceLook }) {
  if (look.from === 0) {
    return (
      <div className="mt-6">
        <p className="text-fg">
          None of the {look.of} books this search found had a price on them.
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted">
          That means Google does not sell them, not that they are cheap.{" "}
          <WhyThin />
        </p>
      </div>
    );
  }

  if (!look.summary) {
    return (
      <div className="mt-6">
        <p className="text-fg">
          {/* Explicit space, like the one in `title-check-page.tsx`: a text
              chunk carrying an entity loses the space that follows an
              expression on the same line, which set this as "58books". */}
          Only {look.from} of {look.of}
          {" "}
          books carried a price &mdash; too few to say what this shelf charges.
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted">
          A median wants at least {MIN_PRICES}. Here is what the search did
          find. <WhyThin />
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-fg">
        <span className="text-4xl font-bold">{money(look.summary.median)}</span>{" "}
        is the median of {look.summary.from}{" "}
        {look.summary.from === 1 ? "price" : "prices"}, from{" "}
        {look.from} of {look.of} books that carried one.
        {/* **The spread, which used to live under the chart.** It is the one
            fact that caption carried and this sentence did not, and it is the
            reason a lone median is not the whole answer — a single figure with
            no range around it invites being read as *the* price.

            Printed only when the two ends differ: on a shelf where every book
            is $4.99, "half sit between $4.99 and $4.99" is true, useless, and
            reads like a fault. */}
        {look.summary.middleLow !== look.summary.middleHigh && (
          <>
            {" "}
            Half sit between {money(look.summary.middleLow)} and{" "}
            {money(look.summary.middleHigh)}.
          </>
        )}
      </p>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Google Play, US store, ebooks only. Neither catalogue carries paperback
        prices, so this says nothing about print.
        {look.free > 0 && (
          <>
            {" "}
            {look.free === 1 ? "One book was" : `${look.free} books were`}{" "}
            listed free and{" "}
            {look.free === 1 ? "is" : "are"} kept out of the median.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * The books themselves, in whichever mode the View menu is on.
 *
 * **One renderer for the result list and the browsing wall**, because they are
 * the same thing — priced books — and two copies would drift the moment either
 * gained a field. `isGrid` picks the shape, exactly as it does on the title
 * check's shelves.
 *
 * **The price is on the book in every mode.** It is the only reason this list
 * exists; a mode that drew jackets and titles without it would be a shelf
 * rather than a price check.
 */
function PricedBooks({
  books,
  layout,
}: {
  books: PricedBook[];
  layout: ShelfLayout;
}) {
  const label = (p: PricedBook) => (p.amount === 0 ? "Free" : money(p.amount));

  if (isGrid(layout)) {
    return (
      <ul className={`mt-4 ${resultsGridClass(layout)}`}>
        {books.map((p) => (
          <li key={p.book.key} className="min-w-0">
            <a
              href={p.book.infoUrl}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <BookCover src={p.book.coverUrl} className="rounded-sm!" />
              <span className="mt-2 block truncate text-sm font-medium text-fg">
                {p.book.title}
              </span>
            </a>
            <span className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="truncate text-xs text-muted">
                {p.book.authors[0] ?? "Unknown author"}
              </span>
              <span className="shrink-0 text-sm font-semibold text-fg tabular-nums">
                {label(p)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-line">
      {books.map((p) => (
        <li
          key={p.book.key}
          /* **`items-center`, not `items-baseline`.** A baseline row lines the
             cover's bottom edge up with the title's baseline and hangs the
             thumbnail below the row. */
          className="flex items-center gap-3 py-2.5"
        >
          {/* `BookCover` draws a spine when the catalogue gave no thumbnail,
              so a book without one is still a book rather than a gap. Its
              `<img>` is lazy, which keeps a long list's third-party requests
              down to the rows actually on screen.

              **Squarer than `BookCover`'s own `rounded-lg`**: a printed cover
              has near-square corners, and 8px on a 32px thumbnail reads as an
              app icon. The `!` is load-bearing — two radius utilities land on
              one element and which wins is decided by the order Tailwind emits
              them, not the order written here. */}
          <span className="w-8 shrink-0">
            <BookCover src={p.book.coverUrl} className="rounded-sm!" />
          </span>
          <span className="min-w-0 flex-1">
            {p.book.infoUrl ? (
              <a
                href={p.book.infoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                {p.book.title}
              </a>
            ) : (
              <span className="text-fg">{p.book.title}</span>
            )}
            <span className="block truncate text-sm text-muted">
              {p.book.authors[0] ?? "Unknown author"}
              {p.book.year ? ` · ${p.book.year}` : ""}
              {p.book.publisher ? ` · ${p.book.publisher}` : ""}
            </span>
          </span>
          <span className="shrink-0 font-semibold text-fg tabular-nums">
            {label(p)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every priced book from the search, cheapest first.
 *
 * **This is the evidence and it is not optional.** A median with no list under
 * it asks to be trusted; a median with the books under it can be checked, and
 * the check is often the useful part — a writer who sees that four of the
 * dearer titles are academic reference books has learned more about their
 * search than any figure could tell them.
 */
function PriceList({
  look,
  layout,
  onLayout,
}: {
  look: PriceLook;
  layout: ShelfLayout;
  onLayout: (next: ShelfLayout) => void;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">
            The books, cheapest first
          </h2>
          <p className="mt-1 text-sm text-muted">
            {look.from} of {look.of} had a price. Open one to see the listing
            yourself.
          </p>
        </div>
        <ViewMenu value={layout} onChange={onLayout} />
      </div>

      <PricedBooks books={look.prices} layout={layout} />
    </section>
  );
}

/**
 * A shelf to look at before anything has been searched.
 *
 * **It is not a check and says so.** No median, no spread, no figure of any
 * kind — a verdict on a question nobody asked is the loudest thing a screen
 * can carry, which is why the title check does not arrive having already
 * checked either. Just books and what they cost, and a caption naming the
 * shelf so a wall of strangers' prices cannot read as an answer about the
 * writer's own book.
 */
function BrowseWall({
  shelf,
  layout,
  onLayout,
}: {
  shelf: PricedShelf;
  layout: ShelfLayout;
  onLayout: (next: ShelfLayout) => void;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 max-w-prose text-sm text-muted">
          Not a price check yet &mdash; just what {shelf.books.length}{" "}
          {shelf.label.toLowerCase()} ebooks are charging, while you decide.
        </p>
        <ViewMenu value={layout} onChange={onLayout} />
      </div>

      <PricedBooks books={shelf.books} layout={layout} />
    </section>
  );
}
