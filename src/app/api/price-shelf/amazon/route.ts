import { NextResponse } from "next/server";
import { requireProData } from "@/lib/billing/require-pro-data";
import { amazonDataConfigured, fetchAmazonShelf } from "@/lib/pricing/amazon-source";
import { shelfById } from "@/lib/pricing/shelves";

/**
 * One genre's Amazon Kindle best sellers, for Pro.
 *
 * **Checked on the server, before anything is fetched**, because every
 * request this route causes is paid for (`requireProData`). Then:
 * - 503 when no key is set, the switch that turns the Amazon view off;
 * - 404 for a genre with no Amazon list;
 * - 502 when Amazon's list could not be had. An empty list is a failure, never
 *   a genre where nothing costs anything — the Apple route's rule.
 *
 * **`private, no-store`, unlike the Apple route's public caching.** A gated
 * answer must never sit in a shared cache where the next person to ask, Pro or
 * not, would be handed it. The saving that caching buys lives on the server
 * instead (`amazon-source.ts`), where only this route can reach it.
 */
export async function GET(request: Request) {
  const refused = await requireProData("Amazon's best-seller prices");
  if (refused) return refused;

  if (!amazonDataConfigured()) {
    return NextResponse.json(
      { error: "Amazon's list isn't switched on yet." },
      { status: 503 },
    );
  }

  const shelf = shelfById(new URL(request.url).searchParams.get("shelf") ?? "");
  if (!shelf) {
    return NextResponse.json({ error: "Choose a genre from the list." }, { status: 400 });
  }
  if (!shelf.amazonBestsellers) {
    return NextResponse.json(
      { error: "There is no Amazon list for this genre yet." },
      { status: 404 },
    );
  }

  const answer = await fetchAmazonShelf(shelf);
  if (!answer.ok) {
    return NextResponse.json(
      {
        error:
          "Amazon's list couldn't be fetched just now, so there is nothing to show. Try again in a moment.",
      },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    { shelf: shelf.id, source: "amazon", store: "us", updated: answer.updated, books: answer.books },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
