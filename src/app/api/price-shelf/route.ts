import { NextResponse } from "next/server";
import { parseAppleList } from "@/lib/pricing/apple-list";
import { appleListUrl, shelfById } from "@/lib/pricing/shelves";

/**
 * One genre's best-seller list, from Apple Books' public US feed.
 *
 * **Cached for a day on both sides** — the fetch through Next's data cache and
 * the response through the CDN — so Apple is asked at most about once a day
 * per genre whatever the traffic, and a refresh that fails serves yesterday's
 * copy while it retries (`stale-while-revalidate`).
 *
 * **What leaves our server is a genre id**: nothing about the writer, their
 * book or their browser. `/privacy` says so.
 *
 * **An empty list is a failure, never an answer.** A feed that comes back
 * with no priced books is reported as Apple not answering, not drawn as a
 * genre where nothing costs anything — the rule the price check has always
 * kept about empty results.
 */

const CACHE_SECONDS = 86400;
const ATTEMPTS = 2;
const TIMEOUT_MS = 6000;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("shelf") ?? "";
  const shelf = shelfById(id);
  if (!shelf) {
    return NextResponse.json(
      { error: "Choose a genre from the list." },
      { status: 400 },
    );
  }

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const response = await fetch(appleListUrl(shelf), {
        headers: {
          Accept: "application/json",
          "User-Agent": "OpenChapter (price check; contact via openchapter)",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: CACHE_SECONDS },
      });
      if (response.ok) {
        const { books, updated } = parseAppleList(await response.json());
        if (books.length > 0) {
          return NextResponse.json(
            { shelf: shelf.id, source: "apple", store: "us", updated, books },
            {
              headers: {
                "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
              },
            },
          );
        }
      }
    } catch {
      // Timeout or network. One more attempt, then say so.
    }
  }

  return NextResponse.json(
    {
      error:
        "Apple Books did not answer just now, so there is no list to show. Try again in a moment.",
    },
    { status: 502 },
  );
}
