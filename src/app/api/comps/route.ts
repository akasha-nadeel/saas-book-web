import { NextResponse } from "next/server";
import {
  mergeComps,
  openLibraryQuery,
  parseGoogle,
  reportedTotal,
  parseOpenLibrary,
  summarise,
  type CompTitle,
} from "@/lib/comps/comps";

/**
 * Comparable titles, from Google Books and Open Library.
 *
 * **Server-side rather than from the browser**, for three reasons that are not
 * about secrets — neither service needs a key, and there is nothing here worth
 * hiding. It is that a shared cache is worth having (twenty writers in the same
 * genre ask nearly the same question), that one service being down should cost
 * its half of the results rather than the whole panel, and that a browser
 * calling two third parties directly hands both of them the reader's IP and
 * user agent for a request the reader did not make.
 *
 * The manuscript never comes here. What arrives is a *query* — words the writer
 * typed, or words lifted out of a blurb they wrote for a shop to read. That
 * matters: the page promises the book stays on the machine, and a comp search
 * has to stay inside that promise.
 *
 * No plan gate. This is the free half of the feature and it stays free; the
 * model that ranks these is the part that costs money, and it lives at
 * `/api/comps/rank` — a separate route so that this one needs no key, no
 * account and no plan, and so a writer with none of those still gets comps.
 *
 * **Google Books works without a key and rate-limits hard without one** — an
 * anonymous quota is per IP, and a server is one IP for every writer using it,
 * so it answers 429 quickly under any real traffic. `GOOGLE_BOOKS_API_KEY` is
 * therefore optional in the way everything else here is optional: set it and
 * the Google half keeps working, leave it and that half degrades to nothing
 * while Open Library carries the feature. Open Library needs no key at all.
 *
 * **No launch gate, as of 2026-09-02.** This route answered 404 through
 * `launchFeatureEnabled()` while the whole comps cluster was hidden. The
 * search half is live again and this is the route it runs on; the two model
 * routes over it (`query` and `rank`) keep theirs — which is the split three
 * paragraphs up doing the job it was built for: the free half ships without
 * the paid one. `COMPS_RANKING_LIVE` in `launch.ts` is the client-side half
 * of the same fact, and is what keeps the page from drawing a button those
 * gated routes would refuse.
 */

/** Optional. See the note above: without it, Google answers 429 under load. */
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY;

/** How long an answer is worth keeping. Published books do not move quickly. */
const CACHE_SECONDS = 60 * 60 * 24;

/**
 * Enough to summarise from, few enough to read.
 *
 * **40 is Google's own ceiling**, not a preference: `maxResults` above it is a
 * rejected request, so this is the most one call can return and asking for it
 * costs nothing extra. In practice Google under-delivers — a live search for
 * `subject:"Mystery"` returns 20 items against a claimed 300, and paging with
 * `startIndex` runs dry around 200 — so the real yield is nearer 50–70 books
 * once the two sources are merged and authorless records dropped.
 *
 * **Deeper is worse, which is why there is no pagination here.** Open Library
 * alone would serve thousands, and results are ordered by relevance: at offset
 * 400 a mystery search is returning 1971 children's series books. Every answer
 * on these screens is a *count* — "17 of 34 are filed under Mystery" — so a
 * larger, looser sample does not sharpen the figure, it drags it toward a fact
 * about the whole genre. The covers wall has the same problem in pictures.
 */
const PER_SOURCE = 40;

/**
 * **The deep sweep, and why it is a parameter rather than a bigger
 * `PER_SOURCE`.**
 *
 * Everything the note above says about depth is true *of comps*. Every answer
 * on that screen is a proportion — "17 of 34 are filed under Mystery" — so a
 * larger, looser sample does not sharpen the figure, it drags it toward a fact
 * about the whole genre, and at offset 400 a mystery search really is returning
 * children's series books.
 *
 * The title check asks a different question, and one page is the wrong answer
 * to it. *Who else has published under this name* is an existence question,
 * where a truncated sample is not a looser answer but a wrong one — and the
 * catalogues do not order by title match, so the forty records are effectively
 * arbitrary. Measured against Open Library on 2026-09-02, for
 * `title:"spiderman"` (4,072 records reported):
 *
 * | records read | exact | close |
 * |---|---|---|
 * | 40 | 2 | 5 |
 * | 200 | 6 | 6 |
 * | 500 | **12** | **27** |
 *
 * Six times the exact matches, and the curve was still climbing. A screen that
 * answers "2 books share your title" when the number is at least 12 is not
 * being conservative; it is wrong, and wrong in the direction that costs a
 * writer the decision the screen exists to inform.
 *
 * So `?sweep=1`, sent by the title check and by nothing else.
 *
 * **The page counts are each service's own ceiling, not a preference.** Open
 * Library takes `limit` up to 100; Google's `maxResults` stops at 40 and it
 * runs dry around `startIndex` 200 anyway, so five pages each is as deep as
 * either will usefully go.
 */
const SWEEP_PAGES = 5;
const OPEN_LIBRARY_SWEEP_PER_PAGE = 100;

/**
 * One source, and its failure is its own.
 *
 * Either service can be slow, rate-limited or briefly down, and neither should
 * take the other with it — half a list of comps is useful and an error page is
 * not. A source that fails contributes nothing and says so in the response, so
 * the screen can tell the writer the list is short rather than implying the
 * genre is empty.
 */
/**
 * **The retry is here rather than in the writer's fingers.**
 *
 * Both of these fail *transiently* and often: Google rate-limits a burst — and
 * a burst is what walking the shelf chips looks like, one request per click —
 * while Open Library goes away for stretches and times out. Without a retry
 * the screen handed that straight to the writer, who learned to press Find
 * comps two or three times because the third one usually worked. That is a
 * user performing the machine's error handling, and it is worse than a wait:
 * the failure is invisible, so the lesson learnt is "this button is unreliable"
 * rather than "the catalogue was busy".
 *
 * One press now covers the retries, and the screen stays in its loading state
 * across them, which is the honest picture — the search really is still going.
 *
 * **Only what a retry can fix is retried.** A 429 or a 5xx is the service
 * saying "not now", and a timeout is no answer at all; those come back. Any
 * other 4xx is the request itself being wrong, and asking again identically
 * changes nothing but the bill.
 *
 * **The deadline is the safety rail.** Attempts are cheap when a service fails
 * fast (a 429 answers in milliseconds) and expensive when it hangs, so a fixed
 * attempt count can mean twenty-odd seconds of dead screen on the bad path.
 * The budget below bounds the whole chain instead, and the two sources run in
 * parallel, so it bounds the request.
 */
const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 5000;
/** Total budget for one source, retries included, when it is the only hope. */
const SOURCE_BUDGET_MS = 8000;
/** Short, and growing: a rate limit wants a pause, not a hammering. */
const BACKOFF_MS = [300, 900];

/**
 * How long a source that has *already lost* is allowed to keep the writer.
 *
 * The retries above fixed the three-clicks problem and immediately bought a
 * worse one: with Open Library down and Google answering in half a second,
 * every search still took **12.5 seconds**, measured — because waiting on both
 * means waiting for the slowest, and the slowest was a service spending its
 * whole budget failing. The writer paid the full price of a retry whose result
 * could no longer change what they were about to see.
 *
 * So once *either* source has come back with something, the other gets this
 * long to finish and is then given up on. Both healthy is unaffected: they
 * answer together in well under a second. Both struggling is unaffected too —
 * nothing has succeeded, so nothing is being cut short, and the full budget
 * applies. It is only the lopsided case that is capped, which is the one that
 * was hurting.
 */
const STRAGGLER_MS = 2500;

/**
 * Why a source came back empty-handed, in the few words the screen can use.
 *
 * A failure is not one thing, and the difference decides what a writer should
 * do next. `limited` is a quota — pressing the button again is what *caused*
 * it, and the honest instruction is to wait. `slow` and `down` are the service,
 * where trying again shortly is exactly right. Collapsing them into "did not
 * answer" is what taught a writer to click five times into a rate limit.
 */
/**
 * `key` is the fourth, and it is the one failure here that is nobody's weather.
 *
 * A wrong `GOOGLE_BOOKS_API_KEY` answers **400** with "API key not valid",
 * which the retry rule below correctly treats as *the request is wrong, asking
 * again changes nothing* — so Google silently contributes no records at all,
 * and without this the screen reported it as `down`: try again shortly. Nobody
 * is going to try again into a permanent 400. `googleKeyed` does not catch it
 * either, because it only asks whether a key is *set*.
 *
 * Told apart so the screen can say the key was refused. Every other failure
 * here is something to wait out; this one is something to go and fix, and the
 * two want opposite sentences.
 */
export type SourceFailure = "limited" | "slow" | "down" | "key" | null;

async function fetchSource(
  url: string,
  parse: (payload: unknown) => CompTitle[],
): Promise<{
  books: CompTitle[];
  ok: boolean;
  reported: number | null;
  why: SourceFailure;
}> {
  const started = Date.now();
  let why: SourceFailure = "down";

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          // Both services ask callers to identify themselves. Open Library's
          // documentation is explicit that anonymous bulk traffic gets blocked.
          "User-Agent":
            "OpenChapter (comparable-titles; contact via openchapter)",
          Accept: "application/json",
        },
        // Slower than this and the writer has stopped waiting anyway.
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        next: { revalidate: CACHE_SECONDS },
      });

      if (response.ok) {
        const payload = await response.json();
        return {
          books: parse(payload),
          ok: true,
          reported: reportedTotal(payload),
          why: null,
        };
      }

      // 429 is a quota, and Google's is per short window rather than per
      // request — so it outlasts anything worth waiting for inside one
      // response. Recorded so the screen can say "wait" instead of "retry".
      why = response.status === 429 ? "limited" : "down";

      /* A 400 is usually the query, but from Google it is most often the key,
         and the two want opposite things said. The body is read rather than
         the status guessed from, because "your key is wrong" and "your search
         is wrong" are both 400 and only one of them is the operator's to fix.
         Read defensively: this is an error path, and failing to parse an error
         must not throw a second one. */
      if (response.status === 400) {
        try {
          const body = await response.json();
          const message = String(body?.error?.message ?? "");
          if (/api key not valid|invalid.{0,10}api key/i.test(message)) {
            why = "key";
          }
        } catch {
          // Not JSON, or not shaped like Google's error. `down` stands.
        }
      }

      // Refused rather than overloaded: the query is the problem, so the same
      // query will be refused again.
      if (response.status !== 429 && response.status < 500) {
        return { books: [], ok: false, reported: null, why };
      }
    } catch {
      // Timeout or network — no answer, which is exactly what a retry is for.
      why = "slow";
    }

    const backoff = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
    // Checked before sleeping, so the budget is never spent on a pause before
    // an attempt there is no room left to make.
    if (Date.now() - started + backoff >= SOURCE_BUDGET_MS) break;
    if (attempt < ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  return { books: [], ok: false, reported: null, why };
}

/**
 * One source, however many pages of it, as a single result.
 *
 * **Pages in parallel, and a page that fails costs its own records only.** The
 * alternative — sequential, stopping at the first failure — turns one slow page
 * into five times the wait and one 429 into a truncated sweep that looks like a
 * short shelf. Every page keeps the retry, the timeout and the `why` that
 * `fetchSource` already gives it; the source is `ok` if any page was, and its
 * `why` is the first real complaint any page made.
 *
 * `reported` comes from the first page, since it is the catalogue's count of
 * the whole result and does not change as you walk it.
 */
async function fetchPages(
  urls: string[],
  parse: (payload: unknown) => CompTitle[],
): Promise<{
  books: CompTitle[];
  ok: boolean;
  reported: number | null;
  why: SourceFailure;
}> {
  const pages = await Promise.all(urls.map((url) => fetchSource(url, parse)));
  return {
    books: pages.flatMap((page) => page.books),
    ok: pages.some((page) => page.ok),
    reported: pages[0]?.reported ?? null,
    why: pages.find((page) => page.why)?.why ?? null,
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  /* Asked for, never assumed. Comps is deliberately shallow — see
     `SWEEP_PAGES` — so this is opt-in and the title check is the only caller
     that opts in. */
  const sweep = params.get("sweep") === "1";

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Say a little more about the book to search for." },
      { status: 400 },
    );
  }
  // A cap rather than a truncation: a query this long is a paste, and both
  // services answer it with nothing useful anyway.
  if (query.length > 300) {
    return NextResponse.json(
      { error: "That search is too long. A sentence is plenty." },
      { status: 400 },
    );
  }

  /* Resolves the moment either source comes back with records, which is what
     starts the straggler's clock. Never rejects: a source that fails simply
     does not resolve it, so two failures leave both on the full budget. */
  let announceFirst: () => void = () => {};
  const somethingArrived = new Promise<void>((resolve) => {
    announceFirst = resolve;
  });

  const raced = (
    pending: ReturnType<typeof fetchSource>,
  ): ReturnType<typeof fetchSource> => {
    const watched = pending.then((result) => {
      if (result.ok) announceFirst();
      return result;
    });
    return Promise.race([
      watched,
      somethingArrived
        .then(() => new Promise((r) => setTimeout(r, STRAGGLER_MS)))
        // Given up on, not failed — but it contributed nothing either way, and
        // `ok: false` is what makes the screen say which catalogue is missing.
        // "slow" is the literal truth: it was still going when we stopped.
        .then(() => ({
          books: [],
          ok: false,
          reported: null,
          why: "slow" as SourceFailure,
        })),
    ]);
  };

  /* One page each, or five. Each page is its own URL, so each caches on its
     own under `revalidate` and a repeated sweep costs nothing. */
  const googlePages = Array.from(
    { length: sweep ? SWEEP_PAGES : 1 },
    (_, page) =>
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        query,
      )}&maxResults=${PER_SOURCE}&startIndex=${page * PER_SOURCE}` +
      `&printType=books&orderBy=relevance` +
      (GOOGLE_KEY ? `&key=${encodeURIComponent(GOOGLE_KEY)}` : ""),
  );

  const openLibraryPerPage = sweep
    ? OPEN_LIBRARY_SWEEP_PER_PAGE
    : PER_SOURCE;
  const openLibraryPages = Array.from(
    { length: sweep ? SWEEP_PAGES : 1 },
    (_, page) =>
      // Translated, not passed through: the two catalogues use different
      // field prefixes and Open Library answers one it does not know with
      // zero results rather than an error. See `openLibraryQuery`.
      `https://openlibrary.org/search.json?q=${encodeURIComponent(
        openLibraryQuery(query),
      )}&limit=${openLibraryPerPage}&offset=${page * openLibraryPerPage}` +
      `&fields=key,title,author_name,first_publish_year,publisher,number_of_pages_median,subject,isbn,cover_i`,
  );

  const [google, openLibrary] = await Promise.all([
    raced(fetchPages(googlePages, parseGoogle)),
    raced(fetchPages(openLibraryPages, parseOpenLibrary)),
  ]);

  // Across pages as well as across sources: the same book turning up on page
  // one and page three is one book, and `mergeComps` already knew how to say
  // so.
  const books = mergeComps(google.books, openLibrary.books);

  return NextResponse.json(
    {
      query,
      books,
      summary: summarise(books),
      // Named so the screen can say "Open Library did not answer" rather than
      // leaving a writer to conclude that nothing like their book exists.
      sources: { google: google.ok, openLibrary: openLibrary.ok },
      // Not just *that* a source failed but how, because "wait a minute" and
      // "try again now" are opposite instructions and the wrong one is what
      // makes a writer press the button into a quota.
      why: { google: google.why, openLibrary: openLibrary.why },
      // Whether Google *could* have answered, which is a different fact from
      // whether it did. Unkeyed, it 429s under any real traffic — so a screen
      // telling the writer to try again in a moment is promising a retry that
      // fails identically every time. With a key, a failure really is weather.
      googleKeyed: Boolean(GOOGLE_KEY),
      // How many the catalogue says exist, against the handful it handed over.
      // Without it a screen counting what it fetched reads as counting the
      // world, which is the invented-number problem arriving by accident.
      reported: google.reported,
      // What the *other* catalogue says exists, which is the one that carries
      // a sweep. Without it the title check can say how many records it read
      // and not how many there were, and a 12% sweep reading as the whole
      // shelf is exactly the invented verdict this app refuses elsewhere.
      reportedOpenLibrary: openLibrary.reported,
      // How many records were actually read, before merging. The honest
      // denominator for anything counted off `books`.
      scanned: google.books.length + openLibrary.books.length,
      swept: sweep,
    },
    {
      headers: {
        "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      },
    },
  );
}
