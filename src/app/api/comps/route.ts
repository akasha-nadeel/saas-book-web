import { NextResponse } from "next/server";
import {
  mergeComps,
  parseGoogle,
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
 * One source, and its failure is its own.
 *
 * Either service can be slow, rate-limited or briefly down, and neither should
 * take the other with it — half a list of comps is useful and an error page is
 * not. A source that fails contributes nothing and says so in the response, so
 * the screen can tell the writer the list is short rather than implying the
 * genre is empty.
 */
async function fetchSource(
  url: string,
  parse: (payload: unknown) => CompTitle[],
): Promise<{ books: CompTitle[]; ok: boolean }> {
  try {
    const response = await fetch(url, {
      headers: {
        // Both services ask callers to identify themselves. Open Library's
        // documentation is explicit that anonymous bulk traffic gets blocked.
        "User-Agent": "OpenChapter (comparable-titles; contact via openchapter)",
        Accept: "application/json",
      },
      // Slower than this and the writer has stopped waiting anyway.
      signal: AbortSignal.timeout(8000),
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) return { books: [], ok: false };
    return { books: parse(await response.json()), ok: true };
  } catch {
    return { books: [], ok: false };
  }
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

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

  const [google, openLibrary] = await Promise.all([
    fetchSource(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        query,
      )}&maxResults=${PER_SOURCE}&printType=books&orderBy=relevance` +
        (GOOGLE_KEY ? `&key=${encodeURIComponent(GOOGLE_KEY)}` : ""),
      parseGoogle,
    ),
    fetchSource(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(
        query,
      )}&limit=${PER_SOURCE}&fields=key,title,author_name,first_publish_year,publisher,number_of_pages_median,subject,isbn,cover_i`,
      parseOpenLibrary,
    ),
  ]);

  const books = mergeComps(google.books, openLibrary.books);

  return NextResponse.json(
    {
      query,
      books,
      summary: summarise(books),
      // Named so the screen can say "Open Library did not answer" rather than
      // leaving a writer to conclude that nothing like their book exists.
      sources: { google: google.ok, openLibrary: openLibrary.ok },
    },
    {
      headers: {
        "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      },
    },
  );
}
